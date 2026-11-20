import { describe, expect, it } from 'vitest'
import { isoWeek } from './leaderboard'
import { formatWeekRange, isoWeekStart, weekLabel } from './leaderboardWeek'

describe('isoWeekStart', () => {
  it('2026-W47 = 11월 16일(월) 00:00 UTC (지시서 예시의 "Nov 17–23"은 요일이 하루 밀린 값)', () => {
    expect(isoWeekStart('2026-W47')?.toISOString()).toBe('2026-11-16T00:00:00.000Z')
  })
  it('1주차가 전년도 12월에서 시작하는 해', () => {
    // 2025-01-01은 수요일 → 2025-W01은 2024-12-30(월)부터
    expect(isoWeekStart('2025-W01')?.toISOString()).toBe('2024-12-30T00:00:00.000Z')
    // 2027-01-01은 금요일 → 2027-W01은 2027-01-04(월)부터
    expect(isoWeekStart('2027-W01')?.toISOString()).toBe('2027-01-04T00:00:00.000Z')
  })
  it('53주차가 있는 해만 허용', () => {
    expect(isoWeekStart('2025-W53')).toBeNull() // 2025는 52주(2026은 목요일 시작이라 53주)
    expect(isoWeekStart('2026-W53')?.toISOString()).toBe('2026-12-28T00:00:00.000Z')
    expect(isoWeekStart('2020-W53')?.toISOString()).toBe('2020-12-28T00:00:00.000Z')
  })
  it('형식이 틀리면 null', () => {
    for (const w of ['', '2026-47', '2026-W7', '2026-W00', 'W47', '2026-W54']) expect(isoWeekStart(w), w).toBeNull()
  })
  it('서버 isoWeek와 왕복: 1년 내내 시작일의 주 = 그 날의 주, 시작일은 월요일', () => {
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 1, 1); t += 86_400_000) {
      const d = new Date(t + 13 * 3_600_000)
      const start = isoWeekStart(isoWeek(d))!
      expect(start.getUTCDay()).toBe(1)
      expect(d.getTime() - start.getTime()).toBeGreaterThanOrEqual(0)
      expect(d.getTime() - start.getTime()).toBeLessThan(7 * 86_400_000)
    }
  })
})

describe('formatWeekRange', () => {
  it('같은 달', () => expect(formatWeekRange(new Date('2026-11-16T00:00:00Z'))).toBe('Nov 16–22'))
  it('달이 넘어감', () => expect(formatWeekRange(new Date('2026-11-30T00:00:00Z'))).toBe('Nov 30 – Dec 6'))
  it('해가 넘어감', () => expect(formatWeekRange(new Date('2025-12-29T00:00:00Z'))).toBe('Dec 29 – Jan 4'))
})

describe('weekLabel', () => {
  it('지금 주면 This week', () => {
    expect(weekLabel('2026-W47', new Date('2026-11-20T03:00:00Z'))).toBe('This week · Nov 16–22')
  })
  it('UTC 기준: 일요일 23:59 UTC까지 같은 주, 월요일 00:00 UTC부터 다음 주', () => {
    expect(weekLabel('2026-W47', new Date('2026-11-22T23:59:59Z'))).toBe('This week · Nov 16–22')
    expect(weekLabel('2026-W47', new Date('2026-11-23T00:00:00Z'))).toBe('Week of Nov 16–22')
  })
  it('형식이 틀리면 null', () => expect(weekLabel('bad', new Date())).toBeNull())
})
