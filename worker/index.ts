// Cloudflare Worker: 리더보드 API(/api/*) + 정적 에셋 서빙(그 외).
// /api 외 경로는 정적 에셋(assets)이 직접 처리하고, 매칭 없을 때만 이 워커가 호출됨.
import {
  LEADERBOARD_GAMES,
  TOP_N,
  cleanName,
  cleanScore,
  SCORE_RATE_LIMIT_MS,
  isoWeek,
  scoreRateKey,
  type ScoreRow,
} from '../src/lib/leaderboard'
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

// 최소 타입(CF 타입 의존 없이) — 번들은 wrangler(esbuild)가 처리.
interface D1Stmt {
  bind(...vals: unknown[]): D1Stmt
  all<T = unknown>(): Promise<{ results: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
}
interface D1Database {
  prepare(query: string): D1Stmt
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
}

// Workers Cache API 최소 타입(caches.default). 로컬/테스트 런타임엔 없을 수 있어 optional 취급.
interface EdgeCache {
  match(req: Request): Promise<Response | undefined>
  put(req: Request, res: Response): Promise<void>
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
        ttlSec = POPULAR_TTL_SEC
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
  const key = new Request(new URL('/api/popular?v=1', request.url).toString(), { method: 'GET' })
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
    if (url.pathname === '/api/leaderboards' && request.method === 'GET') {
      const week = isoWeek(new Date())
      const { results } = await env.DB.prepare(
        'SELECT game, name, score FROM scores WHERE week=? ORDER BY game ASC, score DESC, created_at ASC',
      )
        .bind(week)
        .all<{ game: string; name: string; score: number }>()
      const boards: Record<string, ScoreRow[]> = {}
      for (const r of results) {
        if (!LEADERBOARD_GAMES[r.game]) continue
        const list = (boards[r.game] ??= [])
        if (list.length < 3) list.push({ name: r.name, score: r.score })
      }
      return json({ week, boards })
    }

    if (url.pathname === '/api/score' && request.method === 'POST') {
      const body = await parseJsonBody(request)
      if (!body) return json({ error: 'bad json' }, 400)
      const game = String(body.game ?? '')
      if (!LEADERBOARD_GAMES[game]) return json({ error: 'unknown game' }, 400)
      const score = cleanScore(body.score)
      if (score === null || score <= 0) return json({ error: 'bad score' }, 400)
      const name = cleanName(body.name)
      // IP+게임당 제출 쿨다운. 예전엔 레이트리밋이 전혀 없어 curl 루프로 보드를 도배할 수 있었다.
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      if (!(await passCooldown(env, scoreRateKey(ip, game), SCORE_RATE_LIMIT_MS, defer))) {
        return json({ error: 'slow down' }, 429)
      }
      const week = isoWeek(new Date())
      await env.DB.prepare(
        'INSERT INTO scores (game, week, name, score, created_at) VALUES (?,?,?,?,?)',
      )
        .bind(game, week, name, score, Date.now())
        .run()
      return json({ week, top: await top(env, game, week), submitted: { name, score } })
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
      const name = cleanName(body.name)
      // 링크 차단은 본문·이름 둘 다 검사한다 — 본문만 검사하면 이름 필드(최대 16자, 짧은
      // 링크엔 충분)로 통째로 우회된다(리뷰에서 발견된 실제 우회 경로).
      if (containsLink(text) || containsLink(name)) return json({ error: 'links not allowed' }, 400)

      // IP당 30초 쿨다운(passCooldown — 원자적 UPSERT, TOCTOU 없음).
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      const now = Date.now()
      if (!(await passCooldown(env, ip, COMMENT_RATE_LIMIT_MS, defer, now))) return json({ error: 'slow down' }, 429)

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
