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
  isValidReactionSlug,
  type ReactionCounts,
} from '../src/lib/reactions'

// 최소 타입(CF 타입 의존 없이) — 번들은 wrangler(esbuild)가 처리.
interface D1Stmt {
  bind(...vals: unknown[]): D1Stmt
  all<T = unknown>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
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
      let body: Record<string, unknown>
      try {
        body = (await request.json()) as Record<string, unknown>
      } catch {
        return json({ error: 'bad json' }, 400)
      }
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
      if (!isValidReactionSlug(game)) return json({ error: 'unknown game' }, 400)
      return json({ counts: await reactionCounts(env, game) })
    }

    if (url.pathname === '/api/reaction' && request.method === 'POST') {
      let body: Record<string, unknown>
      try {
        body = (await request.json()) as Record<string, unknown>
      } catch {
        return json({ error: 'bad json' }, 400)
      }
      const game = String(body.game ?? '')
      const emoji = String(body.emoji ?? '')
      if (!isValidReactionSlug(game)) return json({ error: 'unknown game' }, 400)
      if (!isValidReaction(emoji)) return json({ error: 'unknown emoji' }, 400)
      await env.DB.prepare(
        'INSERT INTO reactions (slug, emoji, count) VALUES (?,?,1) ' +
          'ON CONFLICT(slug, emoji) DO UPDATE SET count = count + 1',
      )
        .bind(game, emoji)
        .run()
      return json({ counts: await reactionCounts(env, game) })
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
