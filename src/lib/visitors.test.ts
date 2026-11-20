import { beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import {
  ipBucket,
  isBotUA,
  isSameSite,
  todayFromPayload,
  prevDay,
  pruneBefore,
  readVisitors,
  recordVisit,
  resetVisitCache,
  utcDay,
  visitorHash,
  visitorsLine,
  type VisitDb,
  type VisitStmt,
} from './visitors'

// 전제: Node 22.5+의 node:sqlite. 진짜 SQLite(node:sqlite)에 마이그레이션 파일을 그대로 적용해 D1 대신 쓴다 — INSERT OR IGNORE·PK 의미를 가짜가 아니라 엔진으로 검사.
type Row = Record<string, unknown>
interface SqliteDb {
  exec(sql: string): void
  prepare(sql: string): { all(...v: unknown[]): Row[]; run(...v: unknown[]): { changes: number | bigint } }
}
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (p: string) => SqliteDb }

function d1(db: SqliteDb): VisitDb {
  const stmt = (q: string, vals: unknown[] = []): VisitStmt => ({
    bind: (...v: unknown[]) => stmt(q, v),
    all: async <T,>() => ({ results: db.prepare(q).all(...vals) as T[] }),
    run: async () => ({ meta: { changes: Number(db.prepare(q).run(...vals).changes) } }),
  })
  return { prepare: (q) => stmt(q) }
}

const MIGRATION = readFileSync(new URL('../../db/migrations/0002_visitors.sql', import.meta.url), 'utf8')
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const T0 = Date.parse('2026-11-20T03:00:00Z')

let raw: SqliteDb
let db: VisitDb
beforeEach(() => {
  raw = new DatabaseSync(':memory:')
  raw.exec(MIGRATION)
  db = d1(raw)
  resetVisitCache()
})

const visit = (ip: string | null, now = T0, ua: string | null = CHROME, defer?: (p: Promise<unknown>) => void) =>
  recordVisit(db, { ip, ua, now, defer })

describe('recordVisit', () => {
  it('같은 IP는 하루에 한 번만 센다(3회 방문 → 1)', async () => {
    expect(await visit('203.0.113.7')).toBe('counted')
    expect(await visit('203.0.113.7', T0 + 60_000)).toBe('seen')
    expect(await visit('203.0.113.7', T0 + 3_600_000)).toBe('seen')
    expect((await readVisitors(db, T0)).today).toBe(1)
  })

  it('다른 IP는 각각 센다', async () => {
    await visit('203.0.113.7')
    await visit('203.0.113.8')
    await visit('198.51.100.1')
    expect((await readVisitors(db, T0)).today).toBe(3)
  })

  it('UTC 자정 경계: 23:59:59와 00:00:00은 다른 날 — 다음 날 다시 1로 시작하고 어제 숫자는 남는다', async () => {
    const lastSec = Date.parse('2026-11-20T23:59:59Z')
    const nextDay = Date.parse('2026-11-21T00:00:00Z')
    await visit('203.0.113.7', lastSec)
    await visit('203.0.113.8', lastSec)
    expect(await visit('203.0.113.7', nextDay)).toBe('counted')
    const r = await readVisitors(db, nextDay)
    expect(r).toEqual({ tz: 'UTC', day: '2026-11-21', today: 1, yesterday: 2 })
  })

  it('봇·스크립트 UA와 빈 UA는 세지 않는다', async () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0)',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'curl/8.7.1',
      'python-requests/2.32.3',
      '',
      null,
    ]) {
      expect(await visit('203.0.113.9', T0, ua)).toBe('bot')
    }
    expect((await readVisitors(db, T0)).today).toBe(0)
  })

  it('다른 사이트 요청(sameSite=false)은 세지 않는다', async () => {
    expect(await recordVisit(db, { ip: '203.0.113.7', ua: CHROME, now: T0, sameSite: false })).toBe('cross-site')
    expect((await readVisitors(db, T0)).today).toBe(0)
  })

  it('자정 정리 뒤 늦게 도착한 지난 날 요청은 다시 세지 않는다(솔트 재생성 없음)', async () => {
    const d = Date.parse('2026-11-20T23:59:59.900Z')
    await visit('203.0.113.7', d)
    const pending: Promise<unknown>[] = []
    await visit('198.51.100.1', Date.parse('2026-11-21T00:00:00.100Z'), CHROME, (p) => pending.push(p))
    await Promise.all(pending)
    resetVisitCache() // 다른 isolate
    expect(await visit('203.0.113.7', d)).toBe('stale')
    expect(raw.prepare("SELECT visitors, salt FROM visit_days WHERE day = '2026-11-20'").all()[0]).toEqual({ visitors: 1, salt: null })
  })

  it('자정 경쟁: 솔트를 캐시한 isolate가 정리 뒤에 지난 날로 넣어도 숫자는 오르지 않는다', async () => {
    await visit('203.0.113.7', T0)
    await pruneBefore(db, '2026-11-21') // 다른 isolate가 다음 날 정리를 끝냄(이 isolate 솔트 캐시는 그대로)
    expect(await visit('203.0.113.7', T0 + 1000)).toBe('stale')
    expect(raw.prepare("SELECT visitors FROM visit_days WHERE day = '2026-11-20'").all()[0].visitors).toBe(1)
  })

  it('IP가 없으면 세지 않는다', async () => {
    expect(await visit(null)).toBe('no-ip')
    expect(await visit('')).toBe('no-ip')
  })

  it('IP 원문은 어디에도 저장하지 않는다(해시만, 솔트는 날이 지나면 지운다)', async () => {
    const ip = '203.0.113.77'
    await visit(ip)
    const dump = JSON.stringify([raw.prepare('SELECT * FROM visit_seen').all(), raw.prepare('SELECT * FROM visit_days').all()])
    expect(dump).not.toContain(ip)
    expect(dump).not.toContain('203.0.113')
    const seen = raw.prepare('SELECT h FROM visit_seen').all()
    expect(seen).toHaveLength(1)
    expect(String(seen[0].h)).toMatch(/^[0-9a-f]{32}$/)

    // 다음 날 첫 방문 → 지난 날 해시 행 삭제 + 솔트 NULL, 숫자는 보존
    const pending: Promise<unknown>[] = []
    await visit('198.51.100.1', Date.parse('2026-11-21T08:00:00Z'), CHROME, (p) => pending.push(p))
    await Promise.all(pending)
    expect(raw.prepare("SELECT COUNT(*) n FROM visit_seen WHERE day = '2026-11-20'").all()[0].n).toBe(0)
    const old = raw.prepare("SELECT visitors, salt FROM visit_days WHERE day = '2026-11-20'").all()[0]
    expect(old).toEqual({ visitors: 1, salt: null })
  })

  it('같은 IP라도 날마다 해시가 다르다(날짜를 넘겨 추적할 수 없다)', async () => {
    await visit('203.0.113.7', T0)
    const day1 = raw.prepare('SELECT h FROM visit_seen').all()[0].h
    const salt1 = raw.prepare('SELECT salt FROM visit_days').all()[0].salt
    const pending: Promise<unknown>[] = []
    await visit('203.0.113.7', T0 + 86_400_000, CHROME, (p) => pending.push(p))
    await Promise.all(pending)
    const rows = raw.prepare('SELECT day, h FROM visit_seen').all()
    expect(rows).toHaveLength(1)
    expect(rows[0].day).toBe('2026-11-21')
    expect(rows[0].h).not.toBe(day1)
    expect(raw.prepare("SELECT salt FROM visit_days WHERE day = '2026-11-21'").all()[0].salt).not.toBe(salt1)
    expect(await visitorHash('203.0.113.7', 'a')).not.toBe(await visitorHash('203.0.113.7', 'b'))
  })

  it('isolate 캐시가 비어도(다른 isolate) 같은 날 같은 IP는 다시 세지 않는다', async () => {
    await visit('203.0.113.7')
    resetVisitCache()
    expect(await visit('203.0.113.7', T0 + 10_000)).toBe('seen')
  })

  it('IPv6는 /64 단위 — 같은 집의 주소 회전은 한 명', async () => {
    await visit('2001:db8:abcd:12::1')
    expect(await visit('2001:db8:abcd:12:ffff::9')).toBe('seen')
    expect(await visit('2001:db8:abcd:13::1')).toBe('counted')
    expect((await readVisitors(db, T0)).today).toBe(2)
  })
})

describe('readVisitors', () => {
  it('표가 없으면(마이그레이션 전) null — 화면은 줄을 숨긴다', async () => {
    const empty = d1(new DatabaseSync(':memory:'))
    expect(await readVisitors(empty, T0)).toEqual({ tz: 'UTC', day: '2026-11-20', today: null, yesterday: null })
  })
  it('기록이 없는 날은 0', async () => {
    expect(await readVisitors(db, T0)).toMatchObject({ today: 0, yesterday: 0 })
  })
})

describe('helpers', () => {
  it('isSameSite: Sec-Fetch-Site 우선, 없으면 Origin 호스트, 둘 다 없으면 false', () => {
    const h = (o: Record<string, string>) => new Headers(o)
    expect(isSameSite(h({ 'sec-fetch-site': 'same-origin' }), 'quickminigames.site')).toBe(true)
    expect(isSameSite(h({ 'sec-fetch-site': 'cross-site', origin: 'https://quickminigames.site' }), 'quickminigames.site')).toBe(false)
    expect(isSameSite(h({ 'sec-fetch-site': 'none' }), 'quickminigames.site')).toBe(false)
    expect(isSameSite(h({ origin: 'https://quickminigames.site' }), 'quickminigames.site')).toBe(true)
    expect(isSameSite(h({ origin: 'https://evil.example' }), 'quickminigames.site')).toBe(false)
    expect(isSameSite(h({}), 'quickminigames.site')).toBe(false)
  })
  it('todayFromPayload: 어제 날짜 응답(자정 직후 캐시)은 버린다', () => {
    expect(todayFromPayload({ day: '2026-11-20', today: 42 }, T0)).toBe(42)
    expect(todayFromPayload({ day: '2026-11-19', today: 300 }, T0)).toBeNull()
    expect(todayFromPayload({ day: '2026-11-20', today: null }, T0)).toBeNull()
    expect(todayFromPayload(null, T0)).toBeNull()
  })
  it('utcDay·prevDay', () => {
    expect(utcDay(Date.parse('2026-11-20T23:59:59.999Z'))).toBe('2026-11-20')
    expect(prevDay('2026-03-01')).toBe('2026-02-28')
    expect(prevDay('2026-01-01')).toBe('2025-12-31')
  })
  it('ipBucket', () => {
    expect(ipBucket('203.0.113.7')).toBe('203.0.113.7')
    expect(ipBucket('2001:0db8:abcd:0012:0000:0000:0000:0001')).toBe('2001:db8:abcd:12::/64')
    expect(ipBucket('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(ipBucket('::1')).toBe('0:0:0:0::/64')
    expect(ipBucket('')).toBe('')
    expect(ipBucket('::ffff:203.0.113.7')).toBe('203.0.113.7')
  })
  it('사람 브라우저 UA는 봇이 아니다', () => {
    expect(isBotUA(CHROME)).toBe(false)
    expect(isBotUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1')).toBe(false)
    expect(isBotUA('Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.135 Mobile Safari/537.36 KAKAOTALK/10.8.5 (INAPP)')).toBe(false)
  })
  it('visitorsLine: 작은 숫자는 문장, 10 이상은 숫자, null은 숨김', () => {
    expect(visitorsLine(null)).toBeNull()
    expect(visitorsLine(0)).toBeNull()
    expect(visitorsLine(1)).toBe('A few visitors in the garden today')
    expect(visitorsLine(9)).toBe('A few visitors in the garden today')
    expect(visitorsLine(10)).toBe('Today in the garden: 10 visitors')
    expect(visitorsLine(1234)).toBe('Today in the garden: 1,234 visitors')
  })
})

describe('스키마', () => {
  it('db/schema.sql과 마이그레이션의 visit_* 정의가 같다', () => {
    const norm = (s: string) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim()
    const tables = (s: string) => [...norm(s).matchAll(/CREATE TABLE IF NOT EXISTS (visit_\w+) \(([^;]*)\);/g)].map((m) => [m[1], m[2]])
    const schema = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')
    expect(tables(MIGRATION).map((t) => t[0])).toEqual(['visit_days', 'visit_seen'])
    expect(tables(schema)).toEqual(tables(MIGRATION))
  })
})
