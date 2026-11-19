import { describe, expect, it, vi } from 'vitest'
import worker from '../../../../worker/index'
import { encodeLine } from './canon'
import { slimeSubmitBody, type DailyProgress } from './daily'
import { SLIME_STAGES, STAGE_HINTS } from './stages'
import { dist, processStroke } from './strokePipeline'
import type { Pt } from './types'

function rawFrom(wp: Pt[]): Pt[] {
  const out: Pt[] = [wp[0]]
  for (let i = 1; i < wp.length; i++) {
    const n = Math.max(1, Math.ceil(dist(wp[i - 1], wp[i]) / 4))
    for (let k = 1; k <= n; k++) out.push({ x: wp[i - 1].x + ((wp[i].x - wp[i - 1].x) * k) / n, y: wp[i - 1].y + ((wp[i].y - wp[i - 1].y) * k) / n })
  }
  return out
}
const s0 = SLIME_STAGES[0]
const winLine = encodeLine(processStroke(rawFrom(STAGE_HINTS[s0.id]), s0.ink)!)
const today = () => new Date().toISOString().slice(0, 10)

type Row = { total: number; score_id: number | null }
/** slime_daily·scores 최소 가짜 D1. hasTable=false면 slime_daily 질의가 'no such table'로 던진다. */
function fakeDb(opts: { hasTable: boolean; existing?: Row }) {
  const sqls: { sql: string; args: unknown[] }[] = []
  const mk = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      sql,
      args,
      run: async () => {
        sqls.push({ sql, args })
        if (!opts.hasTable && sql.includes('slime_daily')) throw new Error('D1_ERROR: no such table: slime_daily')
        return { meta: { changes: 1 } }
      },
      all: async () => {
        sqls.push({ sql, args })
        if (!opts.hasTable && sql.includes('slime_daily')) throw new Error('D1_ERROR: no such table: slime_daily')
        if (sql.startsWith('SELECT total, score_id FROM slime_daily')) return { results: opts.existing ? [opts.existing] : [] }
        if (sql.includes('RETURNING id')) return { results: [{ id: 77 }] }
        if (sql.includes('COUNT(*)')) return { results: [{ total: 3, above: 1 }] }
        return { results: [] }
      },
    }),
  })
  const DB = {
    prepare: vi.fn(mk),
    batch: vi.fn(async (stmts: { sql: string; args: unknown[] }[]) => {
      for (const s of stmts) sqls.push({ sql: s.sql, args: s.args })
      return stmts.map(() => ({ results: [] }))
    }),
  }
  return { env: { DB } as never, sqls }
}
const post = (path: string, body: unknown) =>
  new Request(`https://quickminigames.site${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'CF-Connecting-IP': '203.0.113.9' } })

describe('POST /api/slime/submit', () => {
  const body = () => ({ v: 2, day: today(), vid: 'abcdef12-3456', name: 'Mal', stages: [[{ lines: [winLine], score: 99999 }]] })

  it('서버가 다시 계산한 점수로 저장한다(클라가 보낸 score는 무시) — 새 (day, player)면 scores INSERT + slime_daily INSERT', async () => {
    const { env, sqls } = fakeDb({ hasTable: true })
    const res = await worker.fetch(post('/api/slime/submit', body()), env)
    expect(res.status).toBe(200)
    const j = (await res.json()) as { submitted: { score: number }; verified: { total: number; cleared: number }; improved: boolean; rank: number }
    expect(j.verified.cleared).toBe(1)
    expect(j.submitted.score).toBe(j.verified.total)
    expect(j.submitted.score).toBeGreaterThan(0)
    expect(j.submitted.score).toBeLessThanOrEqual(400)
    expect(j.improved).toBe(true)
    expect(j.rank).toBe(2)
    const ins = sqls.find((s) => s.sql.startsWith('INSERT INTO scores'))!
    expect(ins.args[0]).toBe('slime-slide')
    expect(ins.args[3]).toBe(j.verified.total)
    const sd = sqls.find((s) => s.sql.startsWith('INSERT INTO slime_daily'))!
    expect(sd.args[0]).toBe(today())
    expect(String(sd.args[1])).toMatch(/^v:/) // vid는 해시로만 저장
    expect(String(sd.args[1])).not.toContain('abcdef12')
    expect(sd.args[6]).toBe(77)
  })

  it('같은 (day, player) 재제출: 점수가 오르면 기존 scores 행을 UPDATE(새 행 없음), 안 오르면 아무것도 쓰지 않는다', async () => {
    const up = fakeDb({ hasTable: true, existing: { total: 1, score_id: 5 } })
    const r1 = (await (await worker.fetch(post('/api/slime/submit', body()), up.env)).json()) as { improved: boolean }
    expect(r1.improved).toBe(true)
    expect(up.sqls.some((s) => s.sql.startsWith('INSERT INTO scores'))).toBe(false)
    expect(up.sqls.find((s) => s.sql.startsWith('UPDATE scores'))!.args[2]).toBe(5)

    const same = fakeDb({ hasTable: true, existing: { total: 10_000, score_id: 5 } })
    const r2 = (await (await worker.fetch(post('/api/slime/submit', body()), same.env)).json()) as { improved: boolean; submitted: { score: number } }
    expect(r2.improved).toBe(false)
    expect(r2.submitted.score).toBe(10_000)
    expect(same.sqls.some((s) => /^(INSERT INTO scores|UPDATE)/.test(s.sql))).toBe(false)
  })

  it('slime_daily 표가 없으면(원격 마이그레이션 전) 검증된 점수만 scores에 한 번 추가한다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { env, sqls } = fakeDb({ hasTable: false })
    const res = await worker.fetch(post('/api/slime/submit', body()), env)
    expect(res.status).toBe(200)
    expect(sqls.filter((s) => s.sql.startsWith('INSERT INTO scores')).length).toBe(1)
    warn.mockRestore()
  })

  it('위조·형식 오류는 400: 선 없는 시도, 점 건너뛴 선, 먼 날짜, 버전, 본문 과대', async () => {
    const { env } = fakeDb({ hasTable: true })
    const bad = async (b: unknown) => (await worker.fetch(post('/api/slime/submit', b), env)).status
    expect(await bad({ ...body(), stages: [[{ score: 400 }]] })).toBe(400)
    expect(await bad({ ...body(), stages: [[{ lines: [[winLine[0], winLine[winLine.length - 1]]] }]] })).toBe(400)
    expect(await bad({ ...body(), day: '2020-01-01' })).toBe(400)
    expect(await bad({ ...body(), v: 1 })).toBe(400)
    const big = { ...body(), pad: 'x'.repeat(40_000) }
    expect(await bad(big)).toBe(413)
  })

  it('숫자만 받는 /api/score는 slime-slide를 받지 않는다(curl 한 줄 1위 방지)', async () => {
    const { env } = fakeDb({ hasTable: true })
    const res = await worker.fetch(post('/api/score', { game: 'slime-slide', score: 400, name: 'Z' }), env)
    expect(res.status).toBe(400)
  })
})

describe('slimeSubmitBody(클라 제출 본문)', () => {
  it('마지막으로 시도한 스테이지까지 선을 그린 순서대로 싣고, 선 없는 옛 시도가 있으면 null', () => {
    const p: DailyProgress = [[{ outcome: 'nest', stars: 2, score: 250, hint: false, line: winLine }], [], []]
    expect(slimeSubmitBody('2026-11-20', p, 'A', 'vid-1')).toEqual({ v: 2, day: '2026-11-20', vid: 'vid-1', name: 'A', stages: [[{ lines: [winLine] }]] })
    expect(slimeSubmitBody('2026-11-20', [[{ outcome: 'fell', stars: 0, score: 0, hint: false }]], 'A', 'v')).toBeNull()
    expect(slimeSubmitBody('2026-11-20', [[], []], 'A', 'v')).toBeNull()
  })
})
