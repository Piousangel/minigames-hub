#!/usr/bin/env node
// 마케팅 게시 성과: docs/marketing/posted.json 에서 최근 14일 posted 항목의 반응(좋아요·리포스트·댓글·점수)을
// 채널 API로 읽어 마크다운으로 출력한다. 지표 워크플로(metrics.yml)가 지표 파일 끝에 붙인다.
// Bluesky는 공개 API(인증 불필요). Reddit은 자격증명이 있으면 OAuth, 없으면 공개 JSON. X는 X_BEARER_TOKEN이 있을 때만.
// 사이트 유입은 지표 파일의 '유입 태그(?ref=)' 줄에서 본다(게시 링크에 ref=<채널>이 붙는다).
import { existsSync, readFileSync } from 'node:fs'

const LEDGER = 'docs/marketing/posted.json'
const env = process.env
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : []
const since = Date.now() - 14 * 86400e3
const posted = ledger.filter((e) => e.status === 'posted' && Date.parse(e.at) > since)
const skipped = ledger.filter((e) => e.status !== 'posted' && Date.parse(e.at) > Date.now() - 2 * 86400e3)

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers: { 'user-agent': 'team-marketing-stats/1.0', ...headers } })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

const stats = {
  async bluesky(e) {
    const j = await getJson(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(e.ref)}`)
    const p = j.posts?.[0]
    if (!p) throw new Error('not found')
    return `♥${p.likeCount ?? 0} ↻${p.repostCount ?? 0} 💬${p.replyCount ?? 0}`
  },
  async reddit(e) {
    let j
    if (env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET) {
      const t = await (
        await fetch('https://www.reddit.com/api/v1/access_token', {
          method: 'POST',
          headers: {
            authorization: 'Basic ' + Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString('base64'),
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent': 'team-marketing-stats/1.0',
          },
          body: new URLSearchParams({ grant_type: 'client_credentials' }),
        })
      ).json()
      j = await getJson(`https://oauth.reddit.com/by_id/${e.ref}`, { authorization: `Bearer ${t.access_token}` })
    } else {
      j = await getJson(`https://www.reddit.com/by_id/${e.ref}.json`)
    }
    const d = j.data?.children?.[0]?.data
    if (!d) throw new Error('not found')
    return `점수 ${d.score} · 댓글 ${d.num_comments}${d.removed_by_category ? ` · 삭제됨(${d.removed_by_category})` : ''}`
  },
  async threads(e) {
    if (!env.THREADS_ACCESS_TOKEN) throw new Error('THREADS_ACCESS_TOKEN 없음')
    const j = await getJson(`https://graph.threads.net/v1.0/${e.ref}/insights?metric=views,likes,replies,reposts&access_token=${env.THREADS_ACCESS_TOKEN}`)
    const v = Object.fromEntries((j.data ?? []).map((m) => [m.name, m.values?.[0]?.value ?? m.total_value?.value ?? 0]))
    return `조회${v.views ?? '?'} ♥${v.likes ?? 0} ↻${v.reposts ?? 0} 💬${v.replies ?? 0}`
  },
  async x(e) {
    if (!env.X_BEARER_TOKEN) throw new Error('X_BEARER_TOKEN 없음')
    const j = await getJson(`https://api.x.com/2/tweets?ids=${e.ref}&tweet.fields=public_metrics`, {
      authorization: `Bearer ${env.X_BEARER_TOKEN}`,
    })
    const m = j.data?.[0]?.public_metrics
    if (!m) throw new Error('not found')
    return `♥${m.like_count} ↻${m.retweet_count} 💬${m.reply_count} 노출${m.impression_count ?? '?'}`
  },
}

console.log('\n## 마케팅 게시 성과 (최근 14일)\n')
if (posted.length === 0) {
  console.log('게시된 글 없음.')
} else {
  console.log('| 날짜 | 채널 | 링크 | 반응 |')
  console.log('|---|---|---|---|')
  for (const e of posted.sort((a, b) => b.at.localeCompare(a.at))) {
    let r
    try {
      r = e.ref && stats[e.channel] ? await stats[e.channel](e) : '조회 불가(ref 없음)'
    } catch (err) {
      r = `조회 실패(${String(err.message).slice(0, 60)})`
    }
    console.log(`| ${e.date} | ${e.channel} | ${e.link} | ${r} |`)
  }
}
// Threads 토큰 수명 점검: 60일 장기 토큰. 갱신 엔드포인트로 연장을 시도하고(남은 기간이 24시간 이상일 때만 가능), 결과를 알린다.
if (env.THREADS_ACCESS_TOKEN) {
  try {
    const r = await getJson(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${env.THREADS_ACCESS_TOKEN}`)
    const days = Math.floor((r.expires_in ?? 0) / 86400)
    console.log(`\nThreads 토큰: 갱신 성공, 남은 기간 약 ${days}일${r.access_token && r.access_token !== env.THREADS_ACCESS_TOKEN ? ' (새 토큰이 발급됨 — 시크릿 교체 필요할 수 있음)' : ''}`)
  } catch (err) {
    console.log(`\n⚠️ Threads 토큰: 갱신 실패(${String(err.message).slice(0, 60)}) — 만료됐을 수 있다. 사람이 새 토큰을 발급해 시크릿을 교체해야 한다.`)
  }
}
if (skipped.length) {
  console.log(`\n최근 2일 게시 안 됨: ${skipped.map((e) => `${e.id} ${e.channel}=${e.status}${e.error ? `(${e.error.slice(0, 80)})` : ''}`).join(' · ')}`)
}
process.exit(0) // 남은 keep-alive 소켓 때문에 프로세스가 안 끝나는 것 방지
