import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it } from 'vitest'
import worker from '../../worker/index'
import { resetVisitCache } from './visitors'

// 워커 전체(default export)를 진짜 SQLite(node:sqlite, Node 22.5+) 위에서 돌린다 — /api/hit 'pageview' → visit_days.
type Row = Record<string, unknown>
interface SqliteDb {
  exec(sql: string): void
  prepare(sql: string): { all(...v: unknown[]): Row[]; run(...v: unknown[]): { changes: number | bigint } }
}
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (p: string) => SqliteDb }

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function setup() {
  const raw = new DatabaseSync(':memory:')
  raw.exec(readFileSync(new URL('../../db/migrations/0002_visitors.sql', import.meta.url), 'utf8'))
  const stmt = (q: string, vals: unknown[] = []) => ({
    bind: (...v: unknown[]) => stmt(q, v),
    all: async () => ({ results: raw.prepare(q).all(...vals) }),
    run: async () => ({ meta: { changes: Number(raw.prepare(q).run(...vals).changes) } }),
  })
  const env = { ASSETS: { fetch: async () => new Response('') }, DB: { prepare: (q: string) => stmt(q), batch: async () => [] } }
  const pending: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) }
  const hit = async (event: string, ip: string, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) => {
    const res = await worker.fetch(
      new Request('https://quickminigames.site/api/hit', {
        method: 'POST',
        headers: { 'cf-connecting-ip': ip, 'user-agent': CHROME, ...headers },
        body: JSON.stringify({ slug: 'home', event, vid: 'v' }),
      }),
      env as never,
      ctx,
    )
    // waitUntil 안의 작업이 또 waitUntil을 걸 수 있다(정리) — 빌 때까지 기다린다
    while (pending.length) await pending.shift()
    return res.status
  }
  const count = () => Number(raw.prepare('SELECT COALESCE(SUM(visitors), 0) n FROM visit_days').all()[0].n)
  return { hit, count }
}

beforeEach(() => resetVisitCache())

describe('워커 /api/hit → 오늘 방문자', () => {
  it("'pageview'만 센다 — 'view'·'dwell'은 세지 않는다, 응답은 늘 204", async () => {
    const { hit, count } = setup()
    expect(await hit('dwell', '203.0.113.1')).toBe(204)
    expect(await hit('view', '203.0.113.1')).toBe(204)
    expect(count()).toBe(0)
    expect(await hit('pageview', '203.0.113.1')).toBe(204)
    expect(await hit('pageview', '203.0.113.1')).toBe(204)
    expect(count()).toBe(1)
  })
  it('다른 사이트·헤더 없는 요청(curl)은 세지 않고, Origin이 같은 사이트면 센다', async () => {
    const { hit, count } = setup()
    await hit('pageview', '203.0.113.2', { 'sec-fetch-site': 'cross-site' })
    await hit('pageview', '203.0.113.3', {})
    await hit('pageview', '203.0.113.4', { origin: 'https://evil.example' })
    expect(count()).toBe(0)
    await hit('pageview', '203.0.113.5', { origin: 'https://quickminigames.site' })
    expect(count()).toBe(1)
  })
})
