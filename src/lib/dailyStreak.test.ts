import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  prevDayUTC,
  bumpStreak,
  currentStreak,
  loadStreak,
  saveStreak,
  msUntilNextUTCDay,
  formatCountdown,
  milestoneReached,
  nextMilestone,
  type DailyStreak,
} from './dailyStreak'

describe('daily countdown + milestones', () => {
  it('msUntilNextUTCDay: 자정 정각이면 0', () => {
    expect(msUntilNextUTCDay(Date.parse('2026-07-19T00:00:00Z'))).toBe(0)
  })
  it('msUntilNextUTCDay: 자정 1시간 전이면 1시간', () => {
    expect(msUntilNextUTCDay(Date.parse('2026-07-19T23:00:00Z'))).toBe(3_600_000)
  })
  it('formatCountdown: HH:MM:SS 패딩', () => {
    expect(formatCountdown(3_661_000)).toBe('01:01:01')
    expect(formatCountdown(0)).toBe('00:00:00')
    expect(formatCountdown(-5)).toBe('00:00:00')
    expect(formatCountdown(NaN)).toBe('00:00:00')
  })
  it('milestoneReached: 정확히 마일스톤일 때만', () => {
    expect(milestoneReached(7)).toBe(7)
    expect(milestoneReached(30)).toBe(30)
    expect(milestoneReached(8)).toBeNull()
    expect(milestoneReached(0)).toBeNull()
  })
  it('nextMilestone: 다음 목표, 최대 초과면 null', () => {
    expect(nextMilestone(0)).toBe(7)
    expect(nextMilestone(7)).toBe(30)
    expect(nextMilestone(400)).toBeNull()
  })
})

describe('loadStreak/saveStreak roundtrip', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    })
  })
  it('preserves freezes across save/load (regression: loadStreak dropped freezes)', () => {
    saveStreak('k', { lastDate: '2026-07-18', streak: 5, freezes: 2 })
    expect(loadStreak('k')).toEqual({ lastDate: '2026-07-18', streak: 5, freezes: 2 })
  })
  it('loads without freezes when none stored', () => {
    saveStreak('k', { lastDate: '2026-07-18', streak: 3 })
    expect(loadStreak('k')).toEqual({ lastDate: '2026-07-18', streak: 3 })
  })
})

describe('prevDayUTC', () => {
  it('goes back one UTC day', () => {
    expect(prevDayUTC('2026-07-18')).toBe('2026-07-17')
  })
  it('crosses month boundaries', () => {
    expect(prevDayUTC('2026-08-01')).toBe('2026-07-31')
  })
  it('crosses year boundaries', () => {
    expect(prevDayUTC('2026-01-01')).toBe('2025-12-31')
  })
  it('handles leap day', () => {
    expect(prevDayUTC('2028-03-01')).toBe('2028-02-29')
  })
})

describe('bumpStreak', () => {
  it('starts a streak at 1 when there is no history', () => {
    expect(bumpStreak(undefined, '2026-07-18')).toEqual({ lastDate: '2026-07-18', streak: 1, freezes: 0 })
  })
  it('increments when yesterday was completed (5th day grants a freeze)', () => {
    const prev: DailyStreak = { lastDate: '2026-07-17', streak: 4 }
    expect(bumpStreak(prev, '2026-07-18')).toEqual({ lastDate: '2026-07-18', streak: 5, freezes: 1 })
  })
  it('increments without a freeze when not a multiple of 5', () => {
    expect(bumpStreak({ lastDate: '2026-07-17', streak: 2 }, '2026-07-18')).toEqual({ lastDate: '2026-07-18', streak: 3, freezes: 0 })
  })
  it('resets to 1 and clears freezes when 2+ days were missed', () => {
    const prev: DailyStreak = { lastDate: '2026-07-15', streak: 9, freezes: 2 }
    expect(bumpStreak(prev, '2026-07-18')).toEqual({ lastDate: '2026-07-18', streak: 1, freezes: 0 })
  })
  it('is idempotent - same day does not double-count', () => {
    const first = bumpStreak({ lastDate: '2026-07-17', streak: 2 }, '2026-07-18')
    expect(bumpStreak(first, '2026-07-18')).toBe(first)
  })
  it('spends a freeze to bridge exactly one missed day', () => {
    const prev: DailyStreak = { lastDate: '2026-07-16', streak: 7, freezes: 1 }
    expect(bumpStreak(prev, '2026-07-18')).toEqual({ lastDate: '2026-07-18', streak: 8, freezes: 0 })
  })
  it('does not bridge two missed days even with freezes', () => {
    expect(bumpStreak({ lastDate: '2026-07-15', streak: 5, freezes: 2 }, '2026-07-18').streak).toBe(1)
  })
  it('caps freezes at 2', () => {
    expect(bumpStreak({ lastDate: '2026-07-17', streak: 9, freezes: 2 }, '2026-07-18').freezes).toBe(2)
  })
})

describe('currentStreak', () => {
  it('is 0 with no history', () => {
    expect(currentStreak(undefined, '2026-07-18')).toBe(0)
  })
  it('shows the streak when last completion was today', () => {
    expect(currentStreak({ lastDate: '2026-07-18', streak: 7 }, '2026-07-18')).toBe(7)
  })
  it('shows the streak when last completion was yesterday (still alive)', () => {
    expect(currentStreak({ lastDate: '2026-07-17', streak: 7 }, '2026-07-18')).toBe(7)
  })
  it('is 0 when a day was missed and there is no freeze', () => {
    expect(currentStreak({ lastDate: '2026-07-16', streak: 7 }, '2026-07-18')).toBe(0)
  })
  it('stays alive when a day was missed but a freeze is available', () => {
    expect(currentStreak({ lastDate: '2026-07-16', streak: 7, freezes: 1 }, '2026-07-18')).toBe(7)
  })
  it('is 0 when 2+ days were missed even with a freeze', () => {
    expect(currentStreak({ lastDate: '2026-07-15', streak: 7, freezes: 2 }, '2026-07-18')).toBe(0)
  })
})
