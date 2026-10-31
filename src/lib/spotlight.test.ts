import { describe, it, expect } from 'vitest'
import { dayNumberUTC, pickSpotlight, dailyGameSlugs, spotlightFor } from './spotlight'
import { nextDayUTC } from './dailyStreak'
import { gameMeta } from '@/lib/games/gameMeta'

function makePool(size: number): string[] {
  return Array.from({ length: size }, (_, index) => `s${index}`)
}

/** `dayNumber % cycleLength === 0` 인 첫 날짜(주기 시작일). */
function firstCycleStartDate(cycleLength: number): string {
  let date = '2026-01-01'
  while ((dayNumberUTC(date) as number) % cycleLength !== 0) date = nextDayUTC(date)
  return date
}

function datesFrom(startDate: string, count: number): string[] {
  const dates: string[] = []
  let date = startDate
  for (let index = 0; index < count; index++) {
    dates.push(date)
    date = nextDayUTC(date)
  }
  return dates
}

describe('dayNumberUTC', () => {
  it('counts days since 1970-01-01 (UTC)', () => {
    expect(dayNumberUTC('1970-01-01')).toBe(0)
    expect(dayNumberUTC('1970-01-02')).toBe(1)
    expect(dayNumberUTC('2026-11-01')).toBe(Math.floor(Date.UTC(2026, 10, 1) / 86_400_000))
  })

  it('returns null for malformed or impossible dates', () => {
    expect(dayNumberUTC('abc')).toBeNull()
    expect(dayNumberUTC('')).toBeNull()
    expect(dayNumberUTC('2026-13-45')).toBeNull()
    expect(dayNumberUTC('2026-02-30')).toBeNull()
  })
})

describe('pickSpotlight', () => {
  const pool = makePool(28)

  it('is deterministic for the same date and pool', () => {
    expect(pickSpotlight('2026-11-01', pool)).toBe(pickSpotlight('2026-11-01', pool))
  })

  it('returns null for an empty pool or an invalid date', () => {
    expect(pickSpotlight('2026-11-01', [])).toBeNull()
    expect(pickSpotlight('not-a-date', pool)).toBeNull()
  })

  it('always returns the only game of a single-game pool', () => {
    for (const date of datesFrom('2026-11-01', 5)) {
      expect(pickSpotlight(date, ['only'])).toBe('only')
    }
  })

  it('ignores pool order and duplicates', () => {
    const shuffledWithDuplicates = [...pool].reverse().concat(pool.slice(0, 5))
    for (const date of datesFrom('2026-11-01', 10)) {
      expect(pickSpotlight(date, shuffledWithDuplicates)).toBe(pickSpotlight(date, pool))
    }
  })

  it('shows every game exactly once inside an aligned cycle', () => {
    const cycleDates = datesFrom(firstCycleStartDate(28), 28)
    const picks = cycleDates.map((date) => pickSpotlight(date, pool))
    expect(new Set(picks).size).toBe(28)
  })

  it('picks different games on different days of the same cycle', () => {
    const [first, second] = datesFrom(firstCycleStartDate(28), 2)
    expect(pickSpotlight(first, pool)).not.toBe(pickSpotlight(second, pool))
  })

  it.each([28, 3])('never repeats the previous day across cycle boundaries (pool of %i)', (size) => {
    const smallPool = makePool(size)
    const startDate = firstCycleStartDate(size)
    const dates = datesFrom(startDate, size * 6)
    for (let index = 1; index < dates.length; index++) {
      expect(pickSpotlight(dates[index], smallPool)).not.toBe(pickSpotlight(dates[index - 1], smallPool))
    }
  })
})

describe('real data', () => {
  it('only contains games that have a daily mode', () => {
    const slugs = dailyGameSlugs()
    expect(slugs.length).toBeGreaterThan(0)
    for (const slug of slugs) expect(gameMeta[slug]?.daily).toBe(true)
  })

  it('spotlightFor picks one of the daily games', () => {
    expect(dailyGameSlugs()).toContain(spotlightFor('2026-11-01'))
  })
})
