// Cloudflare Worker: 리더보드 API(/api/*) + 정적 에셋 서빙(그 외).
// /api 외 경로는 정적 에셋(assets)이 직접 처리하고, 매칭 없을 때만 이 워커가 호출됨.
import {
  LEADERBOARD_GAMES,
  TOP_N,
  cleanName,
  cleanScore,
  isoWeek,
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

async function commentsFor(env: Env, slug: string): Promise<CommentRow[]> {
  const { results } = await env.DB.prepare(
    'SELECT name, text, created_at FROM comments WHERE slug=? ORDER BY created_at DESC LIMIT ?',
  )
    .bind(slug, COMMENTS_PER_GAME)
    .all<{ name: string; text: string; created_at: number }>()
  return results.map((r) => ({ slug, name: r.name, text: r.text, createdAt: r.created_at }))
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

      // IP당 쿨다운을 원자적 UPSERT 하나로 판정한다 — 예전엔 SELECT로 마지막 작성 시각을
      // 읽은 뒤 별도 INSERT로 갱신했는데, 그 사이에 동시 요청 두 개가 같은 stale 값을 보고
      // 둘 다 통과할 수 있었다(TOCTOU 경쟁 상태, 리뷰에서 발견). WHERE 절이 있는 ON CONFLICT
      // DO UPDATE는 조건이 거짓이면 행을 안 바꾸고 조용히 끝나므로(에러 아님), changes로
      // "이번에 갱신됐는지(=쿨다운 통과)"를 판정할 수 있다. 신규 IP는 충돌이 없어 무조건
      // INSERT되므로 changes=1.
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      const now = Date.now()
      const limitResult = await env.DB.prepare(
        'INSERT INTO comment_rate_limits (ip, last_at) VALUES (?,?) ' +
          'ON CONFLICT(ip) DO UPDATE SET last_at = excluded.last_at ' +
          'WHERE excluded.last_at - comment_rate_limits.last_at >= ?',
      )
        .bind(ip, now, COMMENT_RATE_LIMIT_MS)
        .run()
      if ((limitResult.meta?.changes ?? 0) === 0) return json({ error: 'slow down' }, 429)

      await env.DB.prepare(
        'INSERT INTO comments (slug, name, text, created_at) VALUES (?,?,?,?)',
      )
        .bind(game, name, text, now)
        .run()

      return json({ comments: await commentsFor(env, game) })
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
        if (slug) {
          // blobs: event, country, referrer, 익명 방문자 id(vid). vid로 재방문·방문당 플레이 계산.
          env.ANALYTICS?.writeDataPoint({
            indexes: [slug],
            blobs: [event, country, ref, vid],
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
