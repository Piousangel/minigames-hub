import { describe, it, expect } from 'vitest'
import { prevDayUTC, bumpStreak, currentStreak, type DailyStreak } from './dailyStreak'

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
    expect(bumpStreak(undefined, '2026-07-18')).toEqual({ lastDate: '2026-07-18', streak: 1 })
  })
  it('increments when yesterday was completed', () => {
    const prev: DailyStreak = { lastDate: '2026-07-17', streak: 4 }
    expect(bumpStreak(prev, '2026-07-18')).toEqual({ lastDate: '2026-07-18', streak: 5 })
  })
  it('resets to 1 when a day was missed', () => {
    const prev: DailyStreak = { lastDate: '2026-07-15', streak: 9 }
    expect(bumpStreak(prev, '2026-07-18')).toEqual({ lastDate: '2026-07-18', streak: 1 })
  })
  it('is idempotent — completing again the same day does not double-count', () => {
    const first = bumpStreak({ lastDate: '2026-07-17', streak: 2 }, '2026-07-18')
    expect(first).toEqual({ lastDate: '2026-07-18', streak: 3 })
    expect(bumpStreak(first, '2026-07-18')).toBe(first) // same reference, no change
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
  it('is 0 when the streak is broken (missed a day) — never shows a dead streak as alive', () => {
    expect(currentStreak({ lastDate: '2026-07-16', streak: 7 }, '2026-07-18')).toBe(0)
  })
})
