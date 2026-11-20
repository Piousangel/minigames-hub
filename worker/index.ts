// Cloudflare Worker: 리더보드 API(/api/*) + 정적 에셋 서빙(그 외).
// /api 외 경로는 정적 에셋(assets)이 직접 처리하고, 매칭 없을 때만 이 워커가 호출됨.
import {
  LEADERBOARD_GAMES,
  TOP_N,
  cleanScore,
  SCORE_RATE_LIMIT_MS,
  isoWeek,
  safeDisplayName,
  scoreRateKey,
  type ScoreRow,
} from '../src/lib/leaderboard'
import { topPercent } from '../src/lib/leaderboardOrder'
import { hashKey } from '../src/lib/hashKey'
import {
  emptyReactionCounts,
  isValidReaction,
  type ReactionCounts,
} from '../src/lib/reactions'
import {
  COMMENT_RATE_LIMIT_MS,
  cleanCommentText,
  containsLink,
  isHoneypotTripped,
  type CommentRow,
} from '../src/lib/comments'
import { isValidGameSlug } from '../src/lib/slug'
import { RATE_LIMIT_PRUNE_BATCH, rateLimitPruneCutoff, shouldPruneRateLimits } from '../src/lib/rateLimitPrune'
import { buildPopularSql, createTtlCache, parsePopularRows, type PopularResponse } from '../src/lib/popular'
import { SUBMIT_MAX_BYTES, dayAcceptable, verifyDay } from '../src/lib/games/slime/verify'
import { readVisitors, recordVisit, type VisitorsPayload } from '../src/lib/visitors'

// 최소 타입(CF 타입 의존 없이) — 번들은 wrangler(esbuild)가 처리.
interface D1Stmt {
  bind(...vals: unknown[]): D1Stmt
  all<T = unknown>(): Promise<{ results: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
}
interface D1Database {
  prepare(query: string): D1Stmt
  /** 여러 문장을 왕복 한 번으로 실행(D1 batch). 결과는 문장 순서대로. */
  batch<T = unknown>(stmts: D1Stmt[]): Promise<{ results: T[] }[]>
}
interface AnalyticsEngine {
  writeDataPoint(event: { indexes?: string[]; blobs?: (string | null)[]; doubles?: number[] }): void
}
interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> }
  DB: D1Database
  ANALYTICS?: AnalyticsEngine
  /** AE SQL API 읽기용 시크릿(Account Analytics:Read). 없으면 /api/popular는 빈 목록. */
  CF_ANALYTICS_TOKEN?: string
  CF_ACCOUNT_ID?: string
  /** 레이트리밋 키 해시용 선택 시크릿(없으면 salt 없이 해시). */
  RATE_SALT?: string
}

// Workers Cache API 최소 타입(caches.default). 로컬/테스트 런타임엔 없을 수 있어 optional 취급.
interface EdgeCache {
  match(req: Request): Promise<Response | undefined>
  put(req: Request, res: Response): Promise<void>
  delete?(req: Request): Promise<boolean>
}
function edgeCache(): EdgeCache | undefined {
  return (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default
}
let warnedNoSalt = false
/**
 * 레이트리밋용 클라이언트 키 = IP의 해시. CF-Connecting-IP가 없으면(로컬 개발 등) 한 버킷('unknown')을 공유한다 —
 * 운영에서는 Cloudflare가 항상 넣어 준다. RATE_SALT 시크릿이 없으면 salt 없는 해시라 IPv4 전수 대입으로 되돌릴 수 있다
 * (원본을 그대로 보관하지 않는 수준의 보호): 강한 비식별이 필요하면 `wrangler secret put RATE_SALT`로 설정한다.
 * 옛 원본-IP 키 행은 기존 정리(passCooldown의 하루 지난 행 삭제)가 하루 안에 지운다.
 */
async function clientKey(request: Request, env: Env): Promise<string> {
  if (!env.RATE_SALT && !warnedNoSalt) {
    warnedNoSalt = true
    console.warn('RATE_SALT 시크릿이 없어 IP 해시에 salt를 쓰지 않는다(wrangler secret put RATE_SALT 권장)')
  }
  return hashKey(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.RATE_SALT)
}
function hubCacheKey(origin: string, week: string): Request {
  return new Request(`${origin}/api/leaderboards?week=${week}`)
}

const POPULAR_TTL_SEC = 21_600 // 6시간 — AE는 하루 몇 번만 조회
const POPULAR_FAIL_TTL_SEC = 300 // 토큰 없음/실패 시 짧게

interface PopularPayload {
  json: string
  ttlSec: number
}

// AE SQL 원본 조회. 절대 throw하지 않는다 — 어떤 실패든 { games: [] } + 짧은 TTL.
async function loadPopular(env: Env): Promise<{ value: PopularPayload; ttlMs: number }> {
  let body: PopularResponse = { games: [] }
  let ttlSec = POPULAR_FAIL_TTL_SEC
  if (env.CF_ANALYTICS_TOKEN && env.CF_ACCOUNT_ID) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}` },
          body: buildPopularSql(),
        },
      )
      if (res.ok) {
        body = { games: parsePopularRows(await res.json()) }
        // 빈 결과를 6시간 굳히면, 토큰 등록 직후·데이터가 막 쌓이기 시작한 때 레일이 반나절
        // 큐레이션에 묶인다 — 비어 있으면 실패와 같은 짧은 TTL로 곧 다시 본다.
        ttlSec = body.games.length > 0 ? POPULAR_TTL_SEC : POPULAR_FAIL_TTL_SEC
        console.log('popular: AE rows', body.games.length)
      } else {
        console.warn('popular: AE query failed', res.status)
      }
    } catch (e) {
      console.warn('popular: AE query error', e)
    }
  }
  return { value: { json: JSON.stringify(body), ttlSec }, ttlMs: ttlSec * 1000 }
}

// isolate 단위 메모리 캐시 + in-flight 공유(createTtlCache). caches.default가 no-op인 *.workers.dev
// 에서도 AE 조회를 제한하고, 동시 미스가 몰려도 AE 쿼리는 isolate당 하나. env는 배포 단위로 고정이라
// 첫 요청의 env를 붙잡아도 안전하다.
let popularIsolateCache: (() => Promise<PopularPayload>) | null = null

// 홈 Featured 레일 인기 순위(src/lib/popular.ts). 엣지 캐시(커스텀 도메인) → isolate 캐시 → AE SQL.
// 어떤 실패든 { games: [] } 200 — 클라이언트는 큐레이션 순서를 유지한다(페이지를 절대 깨지 않음).
async function popularResponse(request: Request, env: Env, defer: Defer): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default
  const key = new Request(new URL('/api/popular?v=2', request.url).toString(), { method: 'GET' })
  if (cache) {
    try {
      const hit = await cache.match(key)
      if (hit) return hit
    } catch {
      // 캐시 장애는 무시하고 원본 조회
    }
  }

  popularIsolateCache ??= createTtlCache(() => loadPopular(env))
  const { json: payload, ttlSec } = await popularIsolateCache()
  const response = new Response(payload, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${ttlSec}`,
    },
  })
  if (cache) defer(cache.put(key, response.clone()).catch(() => {}))
  return response
}

// 오늘 방문자(src/lib/visitors.ts). 엣지 60초 + isolate 15초 캐시 — 홈을 여는 사람마다 D1을 읽지 않는다.
const VISITORS_TTL_SEC = 60
const VISITORS_ISOLATE_MS = 15_000
let visitorsIsolate: { at: number; day: string; body: VisitorsPayload } | null = null

async function visitorsResponse(request: Request, env: Env, defer: Defer): Promise<Response> {
  const cache = edgeCache()
  const key = new Request(new URL('/api/visitors?v=1', request.url).toString(), { method: 'GET' })
  if (cache) {
    try {
      const hit = await cache.match(key)
      if (hit) {
        // 존 'Browser Cache TTL'이 적중 응답 max-age를 늘리지 않게 다시 지정(/api/leaderboards와 같은 이유)
        const headers = new Headers(hit.headers)
        headers.set('Cache-Control', `public, max-age=${VISITORS_TTL_SEC}`)
        return new Response(hit.body, { status: hit.status, headers })
      }
    } catch {
      // 캐시 장애는 무시하고 원본 조회
    }
  }
  const now = Date.now()
  const day = new Date(now).toISOString().slice(0, 10)
  let body: VisitorsPayload
  if (visitorsIsolate && visitorsIsolate.day === day && now - visitorsIsolate.at < VISITORS_ISOLATE_MS) {
    body = visitorsIsolate.body
  } else {
    body = await readVisitors(env.DB, now)
    if (body.today != null) visitorsIsolate = { at: now, day, body }
  }
  const res = new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 실패(null)는 캐시하지 않는다 — 마이그레이션 직후 곧바로 보이게
      'cache-control': body.today == null ? 'no-store' : `public, max-age=${VISITORS_TTL_SEC}`,
    },
  })
  if (cache && body.today != null) defer(cache.put(key, res.clone()).catch(() => {}))
  return res
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

// POST 핸들러 3곳(score/reaction/comment)이 같은 파싱 패턴을 썼다 — 공용 헬퍼로 통일.
async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

async function top(env: Env, game: string, week: string): Promise<ScoreRow[]> {
  const { results } = await env.DB.prepare(
    'SELECT name, score FROM scores WHERE game=? AND week=? ORDER BY score DESC, created_at ASC LIMIT ?',
  )
    .bind(game, week, TOP_N)
    .all<ScoreRow>()
  return results
}

async function reactionCounts(env: Env, slug: string): Promise<ReactionCounts> {
  const { results } = await env.DB.prepare('SELECT emoji, count FROM reactions WHERE slug=?')
    .bind(slug)
    .all<{ emoji: string; count: number }>()
  const counts = emptyReactionCounts()
  for (const r of results) {
    if (isValidReaction(r.emoji)) counts[r.emoji] = r.count
  }
  return counts
}

const COMMENTS_PER_GAME = 50
const COMMENTS_RECENT_GLOBAL = 100

// 키당 쿨다운을 원자적 UPSERT 하나로 판정한다 — 예전엔 SELECT로 마지막 시각을 읽은 뒤
// 별도 INSERT로 갱신했는데, 그 사이에 동시 요청 두 개가 같은 stale 값을 보고 둘 다 통과할
// 수 있었다(TOCTOU 경쟁 상태, 리뷰에서 발견). WHERE 절이 있는 ON CONFLICT DO UPDATE는
// 조건이 거짓이면 행을 안 바꾸고 조용히 끝나므로(에러 아님), changes로 "이번에 갱신됐는지
// (=쿨다운 통과)"를 판정할 수 있다. 신규 키는 충돌이 없어 무조건 INSERT되므로 changes=1.
// 테이블 이름은 comment_rate_limits지만 점수 제출('score:<ip>:<game>' 키)도 같이 쓴다 —
// 새 테이블(=원격 D1 마이그레이션) 없이 배포하려고.
// 응답 뒤에 이어 돌릴 작업 — Workers의 ctx.waitUntil. 정리 DELETE를 사용자 요청 경로에서 뺀다.
type Defer = (p: Promise<unknown>) => void

async function passCooldown(
  env: Env,
  key: string,
  intervalMs: number,
  defer: Defer,
  now = Date.now(),
): Promise<boolean> {
  const result = await env.DB.prepare(
    'INSERT INTO comment_rate_limits (ip, last_at) VALUES (?,?) ' +
      'ON CONFLICT(ip) DO UPDATE SET last_at = excluded.last_at ' +
      'WHERE excluded.last_at - comment_rate_limits.last_at >= ?',
  )
    .bind(key, now, intervalMs)
    .run()
  const passed = (result.meta?.changes ?? 0) > 0
  // 테이블이 무한히 자라지 않게 가끔(통과 호출의 ~1%) 하루 넘은 행을 지운다. 그 행들은 어떤
  // 쿨다운보다도 오래돼 "없는 행"과 판정이 같으므로 UPSERT 의미에 영향 없음.
  // 응답 뒤(waitUntil)에 돌리고, 한 번에 RATE_LIMIT_PRUNE_BATCH행만 지워 첫 정리가 거대한
  // 단일 DELETE로 D1 한도에 걸리지 않게 한다(남은 행은 다음 정리 때). 실패는 로그만.
  if (passed && shouldPruneRateLimits()) {
    defer(
      env.DB.prepare(
        'DELETE FROM comment_rate_limits WHERE rowid IN ' +
          '(SELECT rowid FROM comment_rate_limits WHERE last_at < ? LIMIT ?)',
      )
        .bind(rateLimitPruneCutoff(now), RATE_LIMIT_PRUNE_BATCH)
        .run()
        .catch((e: unknown) => console.warn('rate-limit prune failed', e)),
    )
  }
  return passed
}

async function commentsFor(env: Env, slug: string): Promise<CommentRow[]> {
  const { results } = await env.DB.prepare(
    'SELECT name, text, created_at FROM comments WHERE slug=? ORDER BY created_at DESC LIMIT ?',
  )
    .bind(slug, COMMENTS_PER_GAME)
    .all<{ name: string; text: string; created_at: number }>()
  return results.map((r) => ({ slug, name: r.name, text: r.text, createdAt: r.created_at }))
}

// 제출 직후 순위: 이번 주 이 게임의 전체 제출 수와, 내 점수보다 높은 제출 수(동점은 같은 순위).
// idx_scores_board(game, week, score DESC)로 범위 스캔 한 번. 사용자별 1행 정리는 아직 없어 total은 '제출 수'다.
// 순위는 덤이다 — 조회가 실패해도 이미 저장된 제출을 실패로 돌려주면 사용자가 재시도해 중복 행이 생기므로 삼킨다.
async function rankFor(
  env: Env,
  game: string,
  week: string,
  score: number,
): Promise<{ rank: number; total: number; topPercent: number } | undefined> {
  try {
    const { results: cnt } = await env.DB.prepare(
      'SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN score > ? THEN 1 ELSE 0 END), 0) AS above FROM scores WHERE game=? AND week=?',
    )
      .bind(score, game, week)
      .all<{ total: number; above: number }>()
    const total = Number(cnt[0]?.total ?? 0)
    const rank = Number(cnt[0]?.above ?? 0) + 1
    if (total >= 1 && rank <= total) return { rank, total, topPercent: topPercent(rank, total) }
  } catch (e) {
    console.warn('score rank lookup failed', e)
  }
  return undefined
}

const SLIME_SLUG = 'slime-slide'

/**
 * POST /api/slime/submit — 말랑 미끄럼길 하루 진행을 서버가 재생해 검증하고(클라 점수 무시) 주간 보드에 (day, player)당 1행으로 올린다.
 * 본문: { v: 2, day: 'YYYY-MM-DD'(현지 날짜), vid?, name, stages: [[{ lines: [[[x2,y2],...]] }, ...], ...] }
 * - day는 UTC−12~+14 어딘가의 오늘(+30분 유예). 주 보드는 제출 시각이 아니라 day의 ISO 주(일요일 밤 제출이 월요일로 새지 않게).
 * - 같은 (day, player)의 재제출은 점수가 오를 때만 기존 scores 행을 갱신(보드 도배 방지). player = vid 해시, 없으면 IP 해시.
 * - slime_daily 표가 아직 없으면(원격 마이그레이션 전) 검증된 점수만 scores에 추가한다(기존 /api/score와 같은 동작, 경고 로그).
 */
async function slimeSubmit(request: Request, env: Env, defer: Defer, origin: string): Promise<Response> {
  const text = await request.text().catch(() => '')
  if (text.length > SUBMIT_MAX_BYTES) return json({ error: 'too large' }, 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text) as Record<string, unknown>
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  const day = String(body.day ?? '')
  if (body.v !== 2 || !dayAcceptable(day, Date.now())) return json({ error: 'bad day' }, 400)
  const v = verifyDay(day, body.stages)
  if (!v.ok) return json({ error: v.error }, 400)
  if (v.total <= 0) return json({ error: 'no score' }, 400)
  const name = safeDisplayName(body.name)
  const ipKey = await clientKey(request, env)
  if (!(await passCooldown(env, scoreRateKey(ipKey, SLIME_SLUG), SCORE_RATE_LIMIT_MS, defer))) {
    return json({ error: 'slow down' }, 429)
  }
  const vid = typeof body.vid === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.vid) ? body.vid : ''
  const player = vid ? `v:${await hashKey(vid, env.RATE_SALT)}` : `ip:${ipKey}`
  const week = isoWeek(new Date(Date.parse(day + 'T00:00:00Z')))
  const now = Date.now()
  let score = v.total
  let improved = true
  let inserted = false
  try {
    const { results } = await env.DB.prepare('SELECT total, score_id FROM slime_daily WHERE day=? AND player=?')
      .bind(day, player)
      .all<{ total: number; score_id: number | null }>()
    const prev = results[0]
    if (prev && Number(prev.total) >= v.total) {
      improved = false
      score = Number(prev.total)
    } else if (prev && prev.score_id != null) {
      await env.DB.batch([
        env.DB.prepare('UPDATE scores SET score=?, name=? WHERE id=?').bind(v.total, name, prev.score_id),
        env.DB.prepare('UPDATE slime_daily SET total=?, cleared=?, hints=?, attempts=?, updated_at=? WHERE day=? AND player=?').bind(
          v.total, v.cleared, v.hints, v.attempts, now, day, player,
        ),
      ])
    } else {
      const { results: ins } = await env.DB.prepare(
        'INSERT INTO scores (game, week, name, score, created_at) VALUES (?,?,?,?,?) RETURNING id',
      )
        .bind(SLIME_SLUG, week, name, v.total, now)
        .all<{ id: number }>()
      inserted = true
      await env.DB.prepare(
        'INSERT INTO slime_daily (day, player, total, cleared, hints, attempts, score_id, updated_at) VALUES (?,?,?,?,?,?,?,?) ' +
          'ON CONFLICT(day, player) DO UPDATE SET total=excluded.total, cleared=excluded.cleared, hints=excluded.hints, ' +
          'attempts=excluded.attempts, score_id=excluded.score_id, updated_at=excluded.updated_at',
      )
        .bind(day, player, v.total, v.cleared, v.hints, v.attempts, ins[0]?.id ?? null, now)
        .run()
    }
  } catch (e) {
    // slime_daily 표가 없을 때(원격 마이그레이션 전): 검증된 점수만 추가한다. scores에 넣은 뒤 slime_daily에서 실패했다면 다시 넣지 않는다.
    const msg = String((e as Error)?.message ?? e)
    if (!/slime_daily/.test(msg)) throw e
    console.warn('slime_daily unavailable, fallback to append', msg)
    if (!inserted) {
      await env.DB.prepare('INSERT INTO scores (game, week, name, score, created_at) VALUES (?,?,?,?,?)')
        .bind(SLIME_SLUG, week, name, v.total, now)
        .run()
    }
  }
  const hubCache = edgeCache()
  if (improved && hubCache?.delete) defer(hubCache.delete(hubCacheKey(origin, week)).then(() => undefined, () => undefined))
  env.ANALYTICS?.writeDataPoint({ indexes: [SLIME_SLUG], blobs: ['sl_submit_verified', '', '', '', improved ? 'up' : 'same'], doubles: [v.total] })
  const rankFields = await rankFor(env, SLIME_SLUG, week, score)
  return json({
    week,
    top: await top(env, SLIME_SLUG, week),
    submitted: { name, score },
    verified: { total: v.total, cleared: v.cleared, hints: v.hints },
    improved,
    ...rankFields,
  })
}

export default {
  async fetch(request: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const defer: Defer = (p) => (ctx ? ctx.waitUntil(p) : void p)
    const url = new URL(request.url)

    if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
      const game = url.searchParams.get('game') ?? ''
      if (!LEADERBOARD_GAMES[game]) return json({ error: 'unknown game' }, 400)
      const week = isoWeek(new Date())
      return json({ week, top: await top(env, game, week) })
    }

    // 전체 주간 랭킹 허브: 게임별 톱3를 한 번에.
    // 예전엔 그 주 전체 행을 읽어 JS에서 3개씩 잘랐다 — 주간 1만 행 × 하루 1천 호출이면 D1 무료 읽기
    // 한도(500만 행/일)를 넘는다. 이제 게임별 LIMIT 3(idx_scores_board = game, week, score DESC)을 batch
    // 한 번으로 읽어 읽는 행이 게임 수×3(+ 같은 점수가 몰린 경계 동점 행)으로 억제되고, 응답을 60초 엣지
    // 캐시에 둬 같은 분의 방문은 D1을 건드리지 않는다. 점수 제출(POST /api/score)은 이 캐시를 지운다.
    // 한계: created_at이 인덱스에 없어 같은 점수가 아주 많으면 그 동점 행까지 읽는다 → 필요해지면
    // (game, week, score DESC, created_at) 인덱스를 원격 D1 마이그레이션으로 추가.
    // 엣지 캐시는 데이터센터별이고 *.workers.dev에선 no-op(아래 popular 주석)이라 커스텀 도메인에서만 효과가 있다.
    if (url.pathname === '/api/leaderboards' && request.method === 'GET') {
      const week = isoWeek(new Date())
      const cache = edgeCache()
      const cacheKey = hubCacheKey(url.origin, week)
      if (cache) {
        try {
          const cached = await cache.match(cacheKey)
          if (cached) {
            // Cloudflare 존의 'Browser Cache TTL'이 적중 응답에 max-age=14400(4시간)을 덮어쓴다(라이브 확인).
            // 브라우저가 옛 보드를 몇 시간씩 들고 있지 않게 적중 경로에서 헤더를 다시 지정한다.
            const headers = new Headers(cached.headers)
            headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
            return new Response(cached.body, { status: cached.status, headers })
          }
        } catch {
          // 캐시 장애는 조회를 막지 않는다 — 원본(D1)으로 진행
        }
      }
      const games = Object.keys(LEADERBOARD_GAMES)
      const batch = await env.DB.batch<ScoreRow>(
        games.map((g) =>
          env.DB.prepare(
            'SELECT name, score FROM scores WHERE game=? AND week=? ORDER BY score DESC, created_at ASC LIMIT 3',
          ).bind(g, week),
        ),
      )
      const boards: Record<string, ScoreRow[]> = {}
      games.forEach((g, i) => {
        const rows = batch[i]?.results ?? []
        if (rows.length) boards[g] = rows.slice(0, 3)
      })
      const res = json({ week, boards })
      // 브라우저는 캐시하지 않고(max-age=0) 엣지만 60초(s-maxage) — 제출 직후 새로고침하면 바로 반영
      res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60')
      // 새 주 초반의 빈 보드는 캐시하지 않는다(첫 제출이 TTL 동안 안 보이는 것 방지)
      if (cache && Object.keys(boards).length > 0) defer(cache.put(cacheKey, res.clone()).catch(() => undefined))
      return res
    }

    if (url.pathname === '/api/score' && request.method === 'POST') {
      const body = await parseJsonBody(request)
      if (!body) return json({ error: 'bad json' }, 400)
      const game = String(body.game ?? '')
      if (!LEADERBOARD_GAMES[game]) return json({ error: 'unknown game' }, 400)
      // 말랑 미끄럼길은 숫자만 받는 이 경로를 닫는다 — 선 증거를 서버가 재생하는 /api/slime/submit만 받는다(curl 한 줄 1위 방지).
      if (game === SLIME_SLUG) return json({ error: 'use /api/slime/submit' }, 400)
      const score = cleanScore(body.score, game)
      if (score === null || score <= 0) return json({ error: 'bad score' }, 400)
      // 이름에 링크·연락처가 들어 있으면 'Anon'으로(보드가 광고판이 되는 것 방지). 거절하지 않아 점수는 등록된다.
      const name = safeDisplayName(body.name)
      // IP+게임당 제출 쿨다운. 예전엔 레이트리밋이 전혀 없어 curl 루프로 보드를 도배할 수 있었다.
      // 원본 IP는 저장하지 않는다 — 해시한 키로만 쿨다운을 건다
      const ipKey = await clientKey(request, env)
      if (!(await passCooldown(env, scoreRateKey(ipKey, game), SCORE_RATE_LIMIT_MS, defer))) {
        return json({ error: 'slow down' }, 429)
      }
      const week = isoWeek(new Date())
      await env.DB.prepare(
        'INSERT INTO scores (game, week, name, score, created_at) VALUES (?,?,?,?,?)',
      )
        .bind(game, week, name, score, Date.now())
        .run()
      // 허브 엣지 캐시 무효화 — 제출한 사람이 곧바로 허브를 열었을 때 옛 보드를 보지 않게
      const hubCache = edgeCache()
      if (hubCache?.delete) defer(hubCache.delete(hubCacheKey(url.origin, week)).then(() => undefined, () => undefined))
      const rankFields = await rankFor(env, game, week, score)
      return json({ week, top: await top(env, game, week), submitted: { name, score }, ...rankFields })
    }

    if (url.pathname === '/api/slime/submit' && request.method === 'POST') {
      return slimeSubmit(request, env, defer, url.origin)
    }

    // 게임별 이모지 리액션(무계정, UGC 없음) — src/lib/reactions.ts 참고.
    if (url.pathname === '/api/reactions' && request.method === 'GET') {
      const game = url.searchParams.get('game') ?? ''
      if (!isValidGameSlug(game)) return json({ error: 'unknown game' }, 400)
      return json({ counts: await reactionCounts(env, game) })
    }

    if (url.pathname === '/api/reaction' && request.method === 'POST') {
      const body = await parseJsonBody(request)
      if (!body) return json({ error: 'bad json' }, 400)
      const game = String(body.game ?? '')
      const emoji = String(body.emoji ?? '')
      if (!isValidGameSlug(game)) return json({ error: 'unknown game' }, 400)
      if (!isValidReaction(emoji)) return json({ error: 'unknown emoji' }, 400)
      await env.DB.prepare(
        'INSERT INTO reactions (slug, emoji, count) VALUES (?,?,1) ' +
          'ON CONFLICT(slug, emoji) DO UPDATE SET count = count + 1',
      )
        .bind(game, emoji)
        .run()
      return json({ counts: await reactionCounts(env, game) })
    }

    // 게임별 익명 댓글(Approach A, 2026-08-10) — src/lib/comments.ts 참고. slug 없이 호출하면
    // 전 게임 최신순(운영자 모니터링용 — UI로 안 노출, curl/wrangler d1로 직접 조회하는 게 기본
    // 사용법이지만 API로도 열어둠).
    if (url.pathname === '/api/comments' && request.method === 'GET') {
      const game = url.searchParams.get('game')
      if (game !== null) {
        if (!isValidGameSlug(game)) return json({ error: 'unknown game' }, 400)
        return json({ comments: await commentsFor(env, game) })
      }
      const { results } = await env.DB.prepare(
        'SELECT slug, name, text, created_at FROM comments ORDER BY created_at DESC LIMIT ?',
      )
        .bind(COMMENTS_RECENT_GLOBAL)
        .all<{ slug: string; name: string; text: string; created_at: number }>()
      return json({
        comments: results.map((r) => ({ slug: r.slug, name: r.name, text: r.text, createdAt: r.created_at })),
      })
    }

    if (url.pathname === '/api/comment' && request.method === 'POST') {
      const body = await parseJsonBody(request)
      if (!body) return json({ error: 'bad json' }, 400)
      const game = String(body.game ?? '')
      if (!isValidGameSlug(game)) return json({ error: 'unknown game' }, 400)

      // 허니팟: 봇이 자동으로 채우는 미끼 필드. 값이 있으면 저장하지 않되, 성공한 것처럼
      // 응답해 봇에게 거부됐다는 신호를 안 준다.
      if (isHoneypotTripped(body.hp)) {
        return json({ comments: await commentsFor(env, game) })
      }

      const text = cleanCommentText(body.text)
      if (text.length === 0) return json({ error: 'empty comment' }, 400)
      const name = safeDisplayName(body.name)
      // 링크 차단은 본문·이름 둘 다 검사한다 — 본문만 검사하면 이름 필드(최대 16자, 짧은
      // 링크엔 충분)로 통째로 우회된다(리뷰에서 발견된 실제 우회 경로).
      if (containsLink(text) || containsLink(name)) return json({ error: 'links not allowed' }, 400)

      // IP당 30초 쿨다운(passCooldown — 원자적 UPSERT, TOCTOU 없음).
      const ipKey = await clientKey(request, env)
      const now = Date.now()
      if (!(await passCooldown(env, `comment:${ipKey}`, COMMENT_RATE_LIMIT_MS, defer, now))) return json({ error: 'slow down' }, 429)

      await env.DB.prepare(
        'INSERT INTO comments (slug, name, text, created_at) VALUES (?,?,?,?)',
      )
        .bind(game, name, text, now)
        .run()

      return json({ comments: await commentsFor(env, game) })
    }

    if (url.pathname === '/api/popular' && request.method === 'GET') {
      return popularResponse(request, env, defer)
    }

    if (url.pathname === '/api/visitors' && request.method === 'GET') {
      return visitorsResponse(request, env, defer)
    }

    // 1st-party 분석 비콘: 게임별 조회('view')·체류('dwell', 초)를 Analytics Engine에 기록.
    // sendBeacon(POST, same-origin)로 논블로킹. 실패해도 UX에 영향 없게 항상 204.
    if (url.pathname === '/api/hit' && request.method === 'POST') {
      try {
        const b = JSON.parse(await request.text()) as Record<string, unknown>
        const slug = String(b.slug ?? '').slice(0, 40)
        const event = String(b.event ?? 'view').slice(0, 20)
        const dwellRaw = Number(b.dwell)
        const dwell = Number.isFinite(dwellRaw) && dwellRaw >= 0 ? Math.min(dwellRaw, 86_400) : 0
        const country = (request as unknown as { cf?: { country?: string } }).cf?.country ?? 'XX'
        const ref = (b.ref != null ? String(b.ref) : request.headers.get('referer') ?? '').slice(0, 200)
        const vid = String(b.vid ?? '').slice(0, 64)
        const tag = String(b.tag ?? '').slice(0, 20)
        // 오늘 방문자: 모든 페이지가 보내는 'pageview'(RecordPageView, 사람이 연 페이지의 JS 비콘)만 센다.
        // 같은 날 같은 IP는 한 번(IP 원문 미저장, src/lib/visitors.ts). 응답 뒤에 돌려 204를 늦추지 않는다.
        if (event === 'pageview' && env.DB) {
          defer(
            recordVisit(env.DB, {
              ip: request.headers.get('CF-Connecting-IP'),
              ua: request.headers.get('user-agent'),
              now: Date.now(),
              secret: env.RATE_SALT,
              defer,
            }).catch((e: unknown) => console.warn('visit count failed', e)),
          )
        }
        if (slug) {
          // blobs: event, country, referrer, 익명 방문자 id(vid), 유입 태그(?ref=, 예: share).
          // vid로 재방문·방문당 플레이 계산.
          env.ANALYTICS?.writeDataPoint({
            indexes: [slug],
            blobs: [event, country, ref, vid, tag],
            doubles: [dwell],
          })
        }
      } catch {
        // 잘못된 비콘은 조용히 무시
      }
      return new Response(null, { status: 204 })
    }

    // 그 외: 정적 에셋(존재하면 assets가 직접 처리, 없으면 404 페이지)
    return env.ASSETS.fetch(request)
  },
}
