#!/usr/bin/env node
/**
 * 1st-party 실유저 분석 리포트 — Cloudflare Analytics Engine(mg_events)을 SQL API로 조회.
 * 봇 섞인 CF 존 통계와 달리, 우리 비콘(/api/hit)이 실제 브라우저 게임플레이만 기록하므로
 * "어떤 게임이 진짜 뜨는지 / 체류 / 유입 / 재방문"의 참신호다.
 *
 * 사용:  CF_ANALYTICS_TOKEN=<토큰> node scripts/analytics.mjs [일수]
 *   - 토큰: Cloudflare API 토큰(권한: Account Analytics = Read). 커밋 금지, 환경변수로만.
 *   - 일수: 조회 기간(기본 7). 예: node scripts/analytics.mjs 30
 *
 * mg_events 스키마(우리 worker writeDataPoint 기준):
 *   index1=slug, blob1=event(view|pageview|dwell|win|lose|finish|challenge-*), blob2=country, blob3=referrer, blob4=vid,
 *   blob5=유입 태그(?ref=, 예: share — 2026-10 추가, 이전 행은 ''), double1=dwell(초)
 */

const ACCOUNT = process.env.CF_ACCOUNT_ID || 'f9ca01fb346f810310bfb49234926972'
const TOKEN = process.env.CF_ANALYTICS_TOKEN
const DAYS = Number(process.argv[2]) || 7

if (!TOKEN) {
  console.error('❌ CF_ANALYTICS_TOKEN 환경변수가 없습니다.')
  console.error('   사용: CF_ANALYTICS_TOKEN=<토큰> node scripts/analytics.mjs [일수]')
  process.exit(1)
}

const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`
// AE는 표본을 쓰므로 정확한 카운트는 SUM(_sample_interval). 기간 필터는 INTERVAL.
const SINCE = `timestamp > NOW() - INTERVAL '${DAYS}' DAY`

async function q(sql) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: sql,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`JSON 파싱 실패: ${text.slice(0, 300)}`)
  }
}

function table(rows, cols) {
  if (!rows || rows.length === 0) return '  (데이터 없음)'
  const widths = cols.map((c) => Math.max(c.h.length, ...rows.map((r) => String(r[c.k] ?? '').length)))
  const line = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join('  ')
  const out = [line(cols.map((c) => c.h))]
  out.push(widths.map((w) => '─'.repeat(w)).join('  '))
  for (const r of rows) out.push(line(cols.map((c) => r[c.k] ?? '')))
  return out.map((l) => '  ' + l).join('\n')
}

async function main() {
  console.log(`\n📊 Quick MiniGames — 실유저 분석 (최근 ${DAYS}일, 봇 제외)\n${'='.repeat(52)}`)

  // 0) 총량 + 방문당 플레이 + 순방문자
  const totals = await q(
    `SELECT SUM(_sample_interval) AS views, COUNT(DISTINCT blob4) AS visitors
     FROM mg_events WHERE blob1='view' AND ${SINCE}`,
  )
  const t = totals.data?.[0] || {}
  const views = Number(t.views || 0)
  const visitors = Number(t.visitors || 0)
  console.log(`\n[요약]`)
  console.log(`  실 게임 조회수(views): ${views}`)
  console.log(`  순 방문자(vid 기준):   ${visitors}`)
  console.log(`  방문당 플레이 수:      ${visitors ? (views / visitors).toFixed(2) : '—'}  (체류=이 값↑)`)

  // 1) 뜨는 게임 top
  const top = await q(
    `SELECT index1 AS game, SUM(_sample_interval) AS plays
     FROM mg_events WHERE blob1='view' AND ${SINCE} GROUP BY game ORDER BY plays DESC LIMIT 25`,
  )
  console.log(`\n[가장 많이 플레이된 게임]`)
  console.log(table(top.data, [{ h: 'game', k: 'game' }, { h: 'plays', k: 'plays' }]))

  // 2) 체류(dwell) top — 오래 붙잡는 게임
  const dwell = await q(
    `SELECT index1 AS game, ROUND(AVG(double1),1) AS avg_sec, SUM(_sample_interval) AS n
     FROM mg_events WHERE blob1='dwell' AND double1>1 AND double1<3600 AND ${SINCE}
     GROUP BY game HAVING n>=3 ORDER BY avg_sec DESC LIMIT 25`,
  )
  console.log(`\n[평균 체류시간 top (n≥3)]`)
  console.log(table(dwell.data, [{ h: 'game', k: 'game' }, { h: 'avg_sec', k: 'avg_sec' }, { h: 'n', k: 'n' }]))

  // 3) 유입 리퍼러
  const refs = await q(
    `SELECT blob3 AS referrer, SUM(_sample_interval) AS n
     FROM mg_events WHERE blob1='view' AND blob3!='' AND ${SINCE} GROUP BY referrer ORDER BY n DESC LIMIT 15`,
  )
  console.log(`\n[유입 출처(referrer)]`)
  console.log(table(refs.data, [{ h: 'referrer', k: 'referrer' }, { h: 'n', k: 'n' }]))

  // 3.5) 사이트 전체 도달 — 'pageview'(RecordPageView, 전 페이지)는 홈만 보고 나간
  // 방문자까지 잡는다. 'view'(게임 전용)만 보면 하한선만 보인다.
  const pv = await q(
    `SELECT SUM(_sample_interval) AS pageviews, COUNT(DISTINCT blob4) AS visitors
     FROM mg_events WHERE blob1='pageview' AND ${SINCE}`,
  )
  const p = pv.data?.[0] || {}
  console.log(`\n[사이트 전체 도달 — 홈·카테고리 포함]`)
  console.log(`  전체 페이지뷰:  ${Number(p.pageviews || 0)}`)
  console.log(`  순방문자(vid):  ${Number(p.visitors || 0)}   (게임 페이지만 센 위 숫자보다 항상 크거나 같음)`)

  const landing = await q(
    `SELECT index1 AS page, SUM(_sample_interval) AS n
     FROM mg_events WHERE blob1='pageview' AND ${SINCE} GROUP BY page ORDER BY n DESC LIMIT 15`,
  )
  console.log(`\n[페이지별 조회]`)
  console.log(table(landing.data, [{ h: 'page', k: 'page' }, { h: 'n', k: 'n' }]))

  // 3.6) 외부 유입 — 커뮤니티 배포·SEO 캠페인이 실제로 사람을 데려왔는지 판정하는 표.
  // 내부 이동(quickminigames.site/...)을 빼면 남는 게 진짜 외부 채널이다.
  const ext = await q(
    `SELECT blob3 AS referrer, SUM(_sample_interval) AS hits, COUNT(DISTINCT blob4) AS visitors
     FROM mg_events
     WHERE (blob1='view' OR blob1='pageview') AND blob3!=''
       AND blob3 NOT LIKE '%quickminigames.site%' AND ${SINCE}
     GROUP BY referrer ORDER BY visitors DESC LIMIT 20`,
  )
  console.log(`\n[★ 외부 유입 출처 — 캠페인 성패 판정]`)
  console.log(
    table(ext.data, [
      { h: 'referrer', k: 'referrer' },
      { h: 'hits', k: 'hits' },
      { h: 'visitors', k: 'visitors' },
    ]),
  )

  // 4) 국가
  const geo = await q(
    `SELECT blob2 AS country, SUM(_sample_interval) AS n
     FROM mg_events WHERE blob1='view' AND ${SINCE} GROUP BY country ORDER BY n DESC LIMIT 12`,
  )
  // 3.7) 도전 링크 루프 — 1:1 도전장(src/lib/challenge.ts)의 7일 판정 표.
  // share_in = ?ref=share 로 들어온 진입(blob5 태그), challenge-sent = 결과 화면에서 도전장을
  // 실제로 공유/복사, challenge-done = 도전장으로 들어와 한 판을 끝냄. share_in ≥1 이고 sent가
  // 2번째 사람에게서 나오면(되받아치기) 루프가 닫힌 것.
  // 진입은 'pageview'만 센다 — 게임 페이지는 'view'(RecordPlay)와 'pageview'(RecordPageView)가
  // 둘 다 발화해서, 둘 다 세면 hits가 2배가 된다.
  const loop = await q(
    `SELECT
       if(blob1='pageview', 'share_in', blob1) AS step,
       SUM(_sample_interval) AS hits, COUNT(DISTINCT blob4) AS visitors
     FROM mg_events
     WHERE (blob1='pageview' AND blob5='share'
        OR blob1='challenge-sent' OR blob1='challenge-done') AND ${SINCE}
     GROUP BY step ORDER BY step`,
  )
  console.log(`\n[★ 도전 링크 루프 — share_in / challenge-sent / challenge-done]`)
  console.log(
    table(loop.data, [
      { h: 'step', k: 'step' },
      { h: 'hits', k: 'hits' },
      { h: 'visitors', k: 'visitors' },
    ]),
  )

  console.log(`\n[국가]`)
  console.log(table(geo.data, [{ h: 'country', k: 'country' }, { h: 'n', k: 'n' }]))

  // 5) 완주(win/lose/finish) — recordResult 부르는 게임. endless(승리 조건 없음)는 'finish'
  const wl = await q(
    `SELECT index1 AS game, SUM(_sample_interval) AS finishes
     FROM mg_events WHERE blob1 IN ('win','lose','finish') AND ${SINCE} GROUP BY game ORDER BY finishes DESC LIMIT 15`,
  )
  console.log(`\n[완주 이벤트(win/lose/finish) top]`)
  console.log(table(wl.data, [{ h: 'game', k: 'game' }, { h: 'finishes', k: 'finishes' }]))

  console.log(`\n${'='.repeat(52)}\n해석: plays↑=SEO/유입 잘됨, avg_sec↑=붙잡는 게임(더 만들 것),`)
  console.log(`referrer로 채널 확인, 방문당 플레이↑가 체류 북극성.\n`)
}

main().catch((e) => {
  console.error('\n❌ 조회 실패:', e.message)
  console.error('   토큰 권한(Account Analytics: Read)·Account ID 확인. 데이터가 아직 적으면 빈 표가 정상.')
  process.exit(1)
})
