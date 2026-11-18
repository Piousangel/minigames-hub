import { describe, expect, it, vi } from 'vitest'
import worker from '../../../worker/index'
import { LEADERBOARD_GAMES } from '../leaderboard'

type Stmt = { sql: string; args: unknown[] }

function fakeEnv(rowsByGame: Record<string, { name: string; score: number }[]>) {
  const batches: Stmt[][] = []
  const prepare = vi.fn((sql: string) => ({
    bind: (...args: unknown[]) => ({ sql, args }) as Stmt,
  }))
  const batch = vi.fn(async (stmts: Stmt[]) => {
    batches.push(stmts)
    return stmts.map((s) => ({ results: rowsByGame[String(s.args[0])] ?? [] }))
  })
  return { env: { DB: { prepare, batch } } as never, batches, prepare }
}

describe('/api/leaderboards 허브 조회', () => {
  it('게임별 LIMIT 3 질의를 batch 한 번으로 읽고(전체 행 스캔 없음) 비어 있지 않은 보드만 돌려준다', async () => {
    const games = Object.keys(LEADERBOARD_GAMES)
    const g0 = games[0]
    const g1 = games[1]
    const { env, batches } = fakeEnv({
      [g0]: [
        { name: 'A', score: 90 },
        { name: 'B', score: 80 },
        { name: 'C', score: 70 },
        { name: 'D', score: 60 }, // DB가 4개를 줘도 3개로 자른다(방어)
      ],
      [g1]: [{ name: 'Z', score: 5 }],
    })
    const res = await worker.fetch(new Request('https://quickminigames.site/api/leaderboards'), env)
    const body = (await res.json()) as { week: string; boards: Record<string, { name: string; score: number }[]> }
    expect(batches).toHaveLength(1)
    expect(batches[0]).toHaveLength(games.length)
    for (const s of batches[0]) {
      expect(s.sql).toContain('LIMIT 3')
      expect(s.sql).toContain('game=? AND week=?')
    }
    expect(body.boards[g0].map((r) => r.name)).toEqual(['A', 'B', 'C'])
    expect(body.boards[g1]).toEqual([{ name: 'Z', score: 5 }])
    expect(Object.keys(body.boards).sort()).toEqual([g0, g1].sort())
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60')
  })

  it('엣지 캐시: 두 번째 호출은 D1을 건드리지 않고, 점수 제출은 캐시를 지우며, 캐시 장애는 조회를 막지 않는다', async () => {
    const store = new Map<string, Response>()
    const cache = {
      match: vi.fn(async (r: Request) => store.get(r.url)?.clone()),
      put: vi.fn(async (r: Request, res: Response) => void store.set(r.url, res)),
      delete: vi.fn(async (r: Request) => store.delete(r.url)),
    }
    ;(globalThis as { caches?: unknown }).caches = { default: cache }
    try {
      const g0 = Object.keys(LEADERBOARD_GAMES)[0]
      const { env, batches } = fakeEnv({ [g0]: [{ name: 'A', score: 9 }] })
      const pending: Promise<unknown>[] = []
      const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) }
      const hub = () => worker.fetch(new Request('https://quickminigames.site/api/leaderboards'), env, ctx)
      const r1 = await hub()
      await Promise.all(pending)
      expect(r1.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60')
      expect(cache.put).toHaveBeenCalledTimes(1)
      await hub()
      expect(batches).toHaveLength(1) // 두 번째는 캐시 적중 — D1 batch 호출 없음

      // 점수 제출 → 허브 캐시 삭제
      ;(env as { DB: { prepare: (s: string) => unknown } }).DB.prepare = vi.fn((sql: string) => ({
        bind: (...a: unknown[]) => ({ sql, a, run: async () => ({ meta: { changes: 1 } }), all: async () => ({ results: [] }) }),
      }))
      await worker.fetch(
        new Request('https://quickminigames.site/api/score', { method: 'POST', body: JSON.stringify({ game: g0, score: 5, name: 'Z' }) }),
        env,
        ctx,
      )
      await Promise.all(pending)
      expect(cache.delete).toHaveBeenCalledTimes(1)

      // 캐시가 던져도 D1로 진행
      cache.match.mockRejectedValueOnce(new Error('cache down'))
      store.clear()
      const fresh = fakeEnv({ [g0]: [{ name: 'B', score: 3 }] })
      const r3 = await worker.fetch(new Request('https://quickminigames.site/api/leaderboards'), fresh.env, ctx)
      expect(r3.status).toBe(200)
    } finally {
      delete (globalThis as { caches?: unknown }).caches
    }
  })
})
