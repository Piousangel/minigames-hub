#!/usr/bin/env node
// 마케팅 게시 큐 발행기. 아침 팀(마케터)이 PR에 넣은 docs/marketing/queue/YYYY-MM-DD.json 을
// main 머지 후 GitHub Actions(marketing-post.yml)가 실제 채널에 게시한다.
// 에이전트 샌드박스에는 계정 자격증명이 없다 — 자격증명은 저장소 시크릿에만 있고 여기서만 쓴다(배포와 같은 구조).
//
// 큐 파일 형식:
// { "posts": [
//   { "channel": "bluesky", "text": "...", "url": "https://..." },
//   { "channel": "x", "text": "...", "url": "https://..." },
//   { "channel": "reddit", "subreddit": "battleship", "title": "...", "text": "...", "url": "https://..." }
// ] }
//
// 안전장치: 오늘·어제 날짜 파일만, 채널당 하루 1건, 이미 posted 된 항목은 다시 안 올림,
// url이 있으면 200이 될 때까지(배포 완료) 기다린 뒤 게시. 자격증명 없는 채널은 skipped로 기록.
// 결과는 docs/marketing/posted.json(원장)에 남는다. DRY_RUN=1 이면 게시하지 않고 출력만.
import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const QUEUE_DIR = 'docs/marketing/queue'
const LEDGER = 'docs/marketing/posted.json'
const DRY = process.env.DRY_RUN === '1'
const env = process.env

const kstDate = (offsetDays = 0) =>
  new Date(Date.now() + 9 * 3600e3 - offsetDays * 86400e3).toISOString().slice(0, 10)

const LIMITS = { bluesky: 300, x: 280, reddit: 40000 }

function withUrl(text, url, channel) {
  if (!url || text.includes(url)) return text
  const joined = `${text}\n\n${url}`
  // X는 URL을 23자로 센다. 대략적으로 본문이 넘치면 본문을 자른다.
  const max = LIMITS[channel] ?? 10000
  const urlCost = channel === 'x' ? 23 : url.length
  if (text.length + 2 + urlCost <= max) return joined
  return `${text.slice(0, max - urlCost - 3)}…\n\n${url}`
}

async function waitFor200(url) {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow' })
      if (r.ok) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 30_000))
  }
  return false
}

// ---- 채널 어댑터 ----
const adapters = {
  bluesky: {
    ready: () => env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD,
    async post(p) {
      const s = await (
        await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ identifier: env.BLUESKY_HANDLE, password: env.BLUESKY_APP_PASSWORD }),
        })
      ).json()
      if (!s.accessJwt) throw new Error(`bluesky login: ${JSON.stringify(s).slice(0, 200)}`)
      const text = withUrl(p.text, p.url, 'bluesky')
      const record = { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() }
      if (p.url && text.includes(p.url)) {
        const enc = new TextEncoder()
        const start = enc.encode(text.slice(0, text.indexOf(p.url))).length
        record.facets = [
          {
            index: { byteStart: start, byteEnd: start + enc.encode(p.url).length },
            features: [{ $type: 'app.bsky.richtext.facet#link', uri: p.url }],
          },
        ]
      }
      const r = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${s.accessJwt}` },
        body: JSON.stringify({ repo: s.did, collection: 'app.bsky.feed.post', record }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(`bluesky: ${r.status} ${JSON.stringify(j).slice(0, 200)}`)
      return `https://bsky.app/profile/${env.BLUESKY_HANDLE}/post/${j.uri.split('/').pop()}`
    },
  },

  x: {
    ready: () => env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET,
    async post(p) {
      const url = 'https://api.x.com/2/tweets'
      const oauth = {
        oauth_consumer_key: env.X_API_KEY,
        oauth_nonce: randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: String(Math.floor(Date.now() / 1000)),
        oauth_token: env.X_ACCESS_TOKEN,
        oauth_version: '1.0',
      }
      const pct = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
      const params = Object.keys(oauth).sort().map((k) => `${pct(k)}=${pct(oauth[k])}`).join('&')
      const base = ['POST', pct(url), pct(params)].join('&')
      const key = `${pct(env.X_API_SECRET)}&${pct(env.X_ACCESS_SECRET)}`
      oauth.oauth_signature = createHmac('sha1', key).update(base).digest('base64')
      const header = 'OAuth ' + Object.keys(oauth).sort().map((k) => `${pct(k)}="${pct(oauth[k])}"`).join(', ')
      const r = await fetch(url, {
        method: 'POST',
        headers: { authorization: header, 'content-type': 'application/json' },
        body: JSON.stringify({ text: withUrl(p.text, p.url, 'x') }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(`x: ${r.status} ${JSON.stringify(j).slice(0, 200)}`)
      return `https://x.com/i/web/status/${j.data.id}`
    },
  },

  reddit: {
    ready: () => env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET && env.REDDIT_USERNAME && env.REDDIT_PASSWORD,
    async post(p) {
      if (!p.subreddit || !p.title) throw new Error('reddit: subreddit·title 필요')
      const ua = `script:team-poster:1.0 (by /u/${env.REDDIT_USERNAME})`
      const t = await (
        await fetch('https://www.reddit.com/api/v1/access_token', {
          method: 'POST',
          headers: {
            authorization: 'Basic ' + Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString('base64'),
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent': ua,
          },
          body: new URLSearchParams({ grant_type: 'password', username: env.REDDIT_USERNAME, password: env.REDDIT_PASSWORD }),
        })
      ).json()
      if (!t.access_token) throw new Error(`reddit login: ${JSON.stringify(t).slice(0, 200)}`)
      const r = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers: { authorization: `Bearer ${t.access_token}`, 'content-type': 'application/x-www-form-urlencoded', 'user-agent': ua },
        body: new URLSearchParams({
          sr: p.subreddit,
          kind: 'self',
          title: p.title,
          text: withUrl(p.text, p.url, 'reddit'),
          api_type: 'json',
        }),
      })
      const j = await r.json()
      const errs = j?.json?.errors
      if (!r.ok || (errs && errs.length)) throw new Error(`reddit: ${r.status} ${JSON.stringify(errs ?? j).slice(0, 200)}`)
      return j.json.data.url
    },
  },
}

// ---- 실행 ----
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : []
const done = new Set(ledger.filter((e) => e.status === 'posted').map((e) => e.id))
const postedToday = new Set(ledger.filter((e) => e.status === 'posted' && e.date === kstDate()).map((e) => e.channel))
const allowedDates = new Set([kstDate(), kstDate(1)])

const files = existsSync(QUEUE_DIR) ? readdirSync(QUEUE_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)) : []
let changed = false
for (const f of files.sort()) {
  const date = f.slice(0, 10)
  if (!allowedDates.has(date)) continue
  const { posts = [] } = JSON.parse(readFileSync(join(QUEUE_DIR, f), 'utf8'))
  for (const [i, p] of posts.entries()) {
    const id = `${date}#${i}`
    if (done.has(id)) continue
    const a = adapters[p.channel]
    const entry = { id, date: kstDate(), channel: p.channel, at: new Date().toISOString() }
    if (!a) entry.status = 'skipped-unknown-channel'
    else if (postedToday.has(p.channel)) entry.status = 'skipped-daily-limit'
    else if (!a.ready()) entry.status = 'skipped-no-credentials'
    else if (DRY) entry.status = 'dry-run'
    else {
      if (p.url && !(await waitFor200(p.url))) entry.status = 'skipped-url-not-live'
      else {
        try {
          entry.link = await a.post(p)
          entry.status = 'posted'
          postedToday.add(p.channel)
        } catch (e) {
          entry.status = 'error'
          entry.error = String(e.message ?? e).slice(0, 300)
        }
      }
    }
    console.log(`${id} ${p.channel}: ${entry.status}${entry.link ? ' ' + entry.link : ''}${entry.error ? ' ' + entry.error : ''}`)
    if (DRY) continue
    // 같은 id의 이전 skipped/error 기록은 최신 결과로 교체
    const prev = ledger.findIndex((e) => e.id === id)
    if (prev >= 0) ledger[prev] = entry
    else ledger.push(entry)
    changed = true
  }
}
if (changed) writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n')
