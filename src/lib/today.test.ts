import { describe, it, expect } from 'vitest'
import { questKey, pickDailyPicks, QUEST_TARGET } from './today'
import { gamePages } from './games/registry'

describe('pickDailyPicks exclusions', () => {
  it('never returns an excluded slug and still returns the requested count', () => {
    const unconstrained = pickDailyPicks('2026-11-01')
    for (const excluded of unconstrained) {
      const picks = pickDailyPicks('2026-11-01', 3, [excluded])
      expect(picks).not.toContain(excluded)
      expect(picks).toHaveLength(3)
    }
  })

  it('leaves the default picks unchanged when nothing is excluded', () => {
    expect(pickDailyPicks('2026-11-01', 3, [])).toEqual(pickDailyPicks('2026-11-01'))
  })
})

describe('questKey', () => {
  it('embeds the date so it auto-resets at UTC midnight', () => {
    expect(questKey('2026-07-18')).toBe('quest:2026-07-18')
  })
})

describe('pickDailyPicks', () => {
  const slugs = new Set(gamePages.map((g) => g.slug))

  it('returns QUEST_TARGET distinct real slugs', () => {
    const picks = pickDailyPicks('2026-07-18')
    expect(picks).toHaveLength(QUEST_TARGET)
    expect(new Set(picks).size).toBe(QUEST_TARGET) // distinct
    picks.forEach((s) => expect(slugs.has(s)).toBe(true)) // real games
  })

  it('is deterministic — same date, same picks (every browser agrees)', () => {
    expect(pickDailyPicks('2026-07-18')).toEqual(pickDailyPicks('2026-07-18'))
  })

  it('rotates — different dates generally give different picks', () => {
    const a = pickDailyPicks('2026-07-18')
    const b = pickDailyPicks('2026-07-19')
    expect(a).not.toEqual(b)
  })

  it('respects a custom count', () => {
    expect(pickDailyPicks('2026-07-18', 5)).toHaveLength(5)
  })
})
