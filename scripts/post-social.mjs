#!/usr/bin/env node
// 마케팅 게시 큐 발행기. 아침 팀(마케터)이 PR에 넣은 docs/marketing/queue/YYYY-MM-DD.json 을
// main 머지 후 GitHub Actions(marketing-post.yml)가 실제 채널에 게시한다.
// 에이전트 샌드박스에는 계정 자격증명이 없다 — 자격증명은 저장소 시크릿에만 있고 여기서만 쓴다(배포와 같은 구조).
//
// 큐 파일 형식:
// { "posts": [
//   { "channel": "bluesky", "text": "...", "url": "https://...", "lang": "en" },   // 링크 카드(미리보기 이미지)가 자동으로 붙는다
//   { "channel": "x", "text": "...", "url": "https://..." },
//   { "channel": "threads", "text": "한국어 글(500자 이내)", "url": "https://..." },   // 링크 미리보기 자동
//   // 이미지: images 는 저장소 안 파일 경로(JPG/PNG, 장당 900KB 이하 권장) 배열. 문자열 또는 { path, alt }.
//   //   bluesky: 최대 4장(링크 카드 대신 이미지 첨부), threads: 1장은 이미지 게시·2장 이상은 캐러셀(공개 raw URL 사용 → main에 머지된 파일만)
//   { "channel": "threads", "text": "...", "url": "https://...", "images": [{ "path": "docs/marketing/images/a.jpg", "alt": "게임 화면" }] },
//   { "channel": "reddit", "subreddit": "battleship", "title": "...", "text": "...", "url": "https://..." }
// ] }
//
// 안전장치: 오늘·어제 날짜 파일만, 채널당 하루 1건, 같은 채널·같은 URL은 14일 안에 다시 안 올림, 이미 posted 된 항목은 다시 안 올림,
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

const LIMITS = { bluesky: 300, x: 280, reddit: 40000, threads: 500 }
const DEDUPE_DAYS = 14

// 유입 측정용: 게시 링크에 ?ref=<채널> 을 붙인다(사이트가 ref 태그를 AE에 기록 → 지표 파일에서 채널별 유입 확인).
function tagUrl(url, channel) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (!u.searchParams.has('ref')) u.searchParams.set('ref', channel)
    return u.toString()
  } catch {
    return url
  }
}

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

// Bluesky 링크 카드: 페이지의 og:title·og:description·og:image를 읽어 external embed로 붙인다(미리보기 이미지가 있으면 반응이 크게 오른다).
async function blueskyCard(url, jwt) {
  try {
    const html = await (await fetch(url, { redirect: 'follow' })).text()
    const meta = (prop) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1]
    const title = meta('og:title') ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? url
    const external = { uri: url, title: title.slice(0, 300), description: (meta('og:description') ?? '').slice(0, 1000) }
    let img = meta('og:image')
    if (!img) {
      // 페이지에 og:image가 없으면 사이트 대표 이미지로 대신한다(공략·레벨 페이지에 아직 없음 — 백로그)
      const home = await (await fetch(new URL('/', url))).text()
      img = home.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? home.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i)?.[1]
    }
    if (img) {
      const r = await fetch(new URL(img, url))
      const type = r.headers.get('content-type') ?? 'image/png'
      const buf = Buffer.from(await r.arrayBuffer())
      if (r.ok && buf.length < 950_000) {
        const up = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
          method: 'POST',
          headers: { 'content-type': type, authorization: `Bearer ${jwt}` },
          body: buf,
        })
        const uj = await up.json()
        if (uj.blob) external.thumb = uj.blob
      }
    }
    return { $type: 'app.bsky.embed.external', external }
  } catch {
    return null // 카드 실패는 게시를 막지 않는다
  }
}

// ---- 이미지 첨부 ----
// 큐의 images 항목을 정규화하고 파일을 검증한다. 문제가 있으면 오류를 던져 게시를 건너뛴다(깨진 글 방지).
function loadImages(p, max) {
  const list = (p.images ?? []).slice(0, max).map((x) => (typeof x === 'string' ? { path: x, alt: '' } : x))
  return list.map((x) => {
    if (!x.path || !existsSync(x.path)) throw new Error(`image-missing:${x.path}`)
    const ext = x.path.toLowerCase().split('.').pop()
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : null
    if (!mime) throw new Error(`image-type:${x.path}`)
    const buf = readFileSync(x.path)
    if (buf.length > 950_000) throw new Error(`image-too-large:${x.path}`)
    return { path: x.path, alt: (x.alt ?? '').slice(0, 300), mime, buf }
  })
}

// Threads는 이미지를 공개 URL로만 받는다. 저장소가 공개라 raw.githubusercontent.com 을 쓴다(main에 머지된 뒤 몇 초~분 내 열린다).
const rawUrl = (path) => `https://raw.githubusercontent.com/${env.GITHUB_REPOSITORY}/main/${path}`

async function blueskyImages(imgs, jwt) {
  const out = []
  for (const im of imgs) {
    const up = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
      method: 'POST',
      headers: { 'content-type': im.mime, authorization: `Bearer ${jwt}` },
      body: im.buf,
    })
    const uj = await up.json()
    if (!uj.blob) throw new Error(`bluesky image upload: ${JSON.stringify(uj).slice(0, 150)}`)
    out.push({ alt: im.alt || 'Acorn Hop', image: uj.blob })
  }
  return { $type: 'app.bsky.embed.images', images: out }
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
      const record = { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString(), langs: [p.lang ?? 'en'] }
      const imgs = loadImages(p, 4)
      if (imgs.length) record.embed = await blueskyImages(imgs, s.accessJwt)
      else if (p.url) {
        const card = await blueskyCard(p.url, s.accessJwt)
        if (card) record.embed = card
      }
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
      return { link: `https://bsky.app/profile/${env.BLUESKY_HANDLE}/post/${j.uri.split('/').pop()}`, ref: j.uri }
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
      return { link: `https://x.com/i/web/status/${j.data.id}`, ref: j.data.id }
    },
  },

  // Threads(Meta 공식 API). 본인 계정을 앱의 Threads 테스터로 넣으면 앱 검수 없이 본인 계정에 게시할 수 있다.
  // 토큰은 60일 장기 토큰이다. 실행할 때마다 갱신을 시도하고, 남은 기간은 지표 파일에 경고로 나온다(marketing-stats).
  threads: {
    ready: () => !!env.THREADS_ACCESS_TOKEN, // THREADS_USER_ID 없으면 'me'
    async post(p) {
      const base = `https://graph.threads.net/v1.0/${env.THREADS_USER_ID || 'me'}`
      const text = withUrl(p.text, p.url, 'threads')
      const tk = env.THREADS_ACCESS_TOKEN
      const imgs = loadImages(p, 10)
      let params
      if (imgs.length === 0) {
        params = new URLSearchParams({ media_type: 'TEXT', text, access_token: tk })
        if (p.url) params.set('link_attachment', p.url) // 링크 미리보기 카드
      } else {
        for (const im of imgs) if (!(await waitFor200(rawUrl(im.path)))) throw new Error(`threads image not public yet: ${im.path}`)
        if (imgs.length === 1) {
          params = new URLSearchParams({ media_type: 'IMAGE', image_url: rawUrl(imgs[0].path), text, access_token: tk })
        } else {
          const kids = []
          for (const im of imgs) {
            const k = await fetch(`${base}/threads`, {
              method: 'POST',
              body: new URLSearchParams({ media_type: 'IMAGE', image_url: rawUrl(im.path), is_carousel_item: 'true', access_token: tk }),
            })
            const kj = await k.json()
            if (!k.ok || !kj.id) throw new Error(`threads carousel item: ${k.status} ${JSON.stringify(kj).slice(0, 200)}`)
            kids.push(kj.id)
          }
          await new Promise((r) => setTimeout(r, 8000))
          params = new URLSearchParams({ media_type: 'CAROUSEL', children: kids.join(','), text, access_token: tk })
        }
      }
      const c = await fetch(`${base}/threads`, { method: 'POST', body: params })
      const cj = await c.json()
      if (!c.ok || !cj.id) throw new Error(`threads container: ${c.status} ${JSON.stringify(cj).slice(0, 200)}`)
      await new Promise((r) => setTimeout(r, 5000)) // 컨테이너 처리 대기(문서 권장)
      const pub = await fetch(`${base}/threads_publish`, {
        method: 'POST',
        body: new URLSearchParams({ creation_id: cj.id, access_token: env.THREADS_ACCESS_TOKEN }),
      })
      const pj = await pub.json()
      if (!pub.ok || !pj.id) throw new Error(`threads publish: ${pub.status} ${JSON.stringify(pj).slice(0, 200)}`)
      const meta = await (await fetch(`https://graph.threads.net/v1.0/${pj.id}?fields=permalink&access_token=${env.THREADS_ACCESS_TOKEN}`)).json().catch(() => ({}))
      return { link: meta.permalink ?? `https://www.threads.com/`, ref: pj.id }
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
      return { link: j.json.data.url, ref: j.json.data.name }
    },
  },
}

// 게시 전에 이미지 문제를 미리 잡는다(없는 파일·형식·크기). 문제 없으면 null.
function imageProblem(p) {
  if (!p.images?.length) return null
  try {
    loadImages(p, 10)
    return null
  } catch (e) {
    return String(e.message).split(':')[0] // image-missing / image-type / image-too-large
  }
}

// ---- 실행 ----
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : []
const done = new Set(ledger.filter((e) => e.status === 'posted').map((e) => e.id))
const postedToday = new Set(ledger.filter((e) => e.status === 'posted' && e.date === kstDate()).map((e) => e.channel))
const allowedDates = new Set([kstDate(), kstDate(1)])

const files = existsSync(QUEUE_DIR) ? readdirSync(QUEUE_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)) : []
let changed = false
// 최신 날짜 먼저: 오늘 큐가 우선이고, 어제 남은 항목은 같은 채널의 오늘 몫이 없을 때만 나간다.
for (const f of files.sort().reverse()) {
  const date = f.slice(0, 10)
  if (!allowedDates.has(date)) continue
  const { posts = [] } = JSON.parse(readFileSync(join(QUEUE_DIR, f), 'utf8'))
  for (const [i, p] of posts.entries()) {
    const id = `${date}#${i}`
    if (done.has(id)) continue
    const a = adapters[p.channel]
    const plainUrl = p.url
    p.url = tagUrl(p.url, p.channel)
    const entry = { id, date: kstDate(), channel: p.channel, at: new Date().toISOString(), url: plainUrl }
    const recentDup =
      plainUrl &&
      ledger.some(
        (e) => e.status === 'posted' && e.channel === p.channel && e.url === plainUrl && Date.now() - Date.parse(e.at) < DEDUPE_DAYS * 86400e3,
      )
    if (!a) entry.status = 'skipped-unknown-channel'
    else if (recentDup) entry.status = 'skipped-recent-duplicate'
    else if (postedToday.has(p.channel)) entry.status = 'skipped-daily-limit'
    else if (!a.ready()) entry.status = 'skipped-no-credentials'
    else if (imageProblem(p)) entry.status = `skipped-${imageProblem(p)}`
    else if (DRY) entry.status = 'dry-run'
    else {
      if (p.url && !(await waitFor200(p.url))) entry.status = 'skipped-url-not-live'
      else {
        try {
          const r = await a.post(p)
          entry.link = r.link
          entry.ref = r.ref
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
