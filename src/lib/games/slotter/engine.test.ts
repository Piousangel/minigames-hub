import { describe, expect, it } from 'vitest'
import {
  BASE_POINTS,
  DEFAULT_CONFIG,
  MAX_ROW_LENGTH,
  SPEED_BONUS_MAX,
  STREAK_MULT_CAP,
  STREAK_MULT_STEP,
  cardProgress,
  correctIndex,
  createGame,
  deadlineForStreak,
  mulberry32,
  pickCardValue,
  place,
  spawnCard,
  tick,
  type Rng,
  type SlotterConfig,
  type SlotterState,
} from './engine'

const CFG: SlotterConfig = DEFAULT_CONFIG

/** A queued-array Rng for deterministic crafted tests. */
function queued(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

/** Hand-build a state for tick/place tests (bypasses generation). */
function stateWith(overrides: Partial<SlotterState> = {}): SlotterState {
  return {
    config: CFG,
    row: [],
    card: null,
    score: 0,
    streak: 0,
    bestStreak: 0,
    placed: 0,
    over: false,
    lastEvent: { type: 'none' },
    nextId: 1,
    ...overrides,
  }
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    expect([a(), a(), a(), a(), a()]).toEqual([b(), b(), b(), b(), b()])
  })
})

describe('correctIndex', () => {
  it('finds the boundary in a populated row (exhaustive around each gap)', () => {
    const row = [10, 30, 50]
    expect(correctIndex(row, 5)).toBe(0)
    expect(correctIndex(row, 20)).toBe(1)
    expect(correctIndex(row, 40)).toBe(2)
    expect(correctIndex(row, 60)).toBe(3)
  })

  it('is always 0 for an empty row', () => {
    expect(correctIndex([], 1)).toBe(0)
    expect(correctIndex([], 99)).toBe(0)
  })
})

describe('deadlineForStreak', () => {
  it('equals initialDeadlineTicks at streak 0', () => {
    expect(deadlineForStreak(0, CFG)).toBe(CFG.initialDeadlineTicks)
  })

  it('clamps to minDeadlineTicks for a huge streak', () => {
    expect(deadlineForStreak(1000, CFG)).toBe(CFG.minDeadlineTicks)
  })

  it('is monotonically non-increasing in streak', () => {
    const samples = [0, 1, 2, 5, 10, 20, 29, 30, 31, 100]
    let prev = Infinity
    for (const s of samples) {
      const d = deadlineForStreak(s, CFG)
      expect(d).toBeLessThanOrEqual(prev)
      expect(d).toBeGreaterThanOrEqual(CFG.minDeadlineTicks)
      prev = d
    }
  })
})

describe('pickCardValue', () => {
  it('always returns an integer within [valueMin, valueMax]', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed)
      const v = pickCardValue([], CFG, rng)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(CFG.valueMin)
      expect(v).toBeLessThanOrEqual(CFG.valueMax)
    }
  })

  it('never returns a value already present in row (near-full small range)', () => {
    const smallCfg: SlotterConfig = { ...CFG, valueMin: 1, valueMax: 12 }
    const row = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // all but 12 taken
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed)
      const v = pickCardValue(row, smallCfg, rng)
      expect(v).toBe(12)
    }
  })
})

describe('createGame', () => {
  it('produces the initial invariants', () => {
    const g = createGame(CFG, 1)
    expect(g.row).toEqual([])
    expect(g.card).not.toBeNull()
    expect(g.score).toBe(0)
    expect(g.streak).toBe(0)
    expect(g.over).toBe(false)
    expect(g.lastEvent.type).toBe('spawn')
  })

  it('is deterministic: identical seed => identical serialized state', () => {
    const a = createGame(CFG, 555)
    const b = createGame(CFG, 555)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('different seeds usually produce different first card values', () => {
    const seeds: [number, number][] = [
      [1, 2],
      [10, 20],
      [100, 999],
    ]
    let anyDiffer = false
    for (const [s1, s2] of seeds) {
      const a = createGame(CFG, s1)
      const b = createGame(CFG, s2)
      if (a.card!.value !== b.card!.value) anyDiffer = true
    }
    expect(anyDiffer).toBe(true)
  })
})

describe('tick', () => {
  it('decrements remainingTicks by exactly 1, lastEvent none, card identity preserved', () => {
    const g = createGame(CFG, 1)
    const id = g.card!.id
    const value = g.card!.value
    const before = g.card!.remainingTicks
    const t = tick(g)
    expect(t.card!.remainingTicks).toBe(before - 1)
    expect(t.card!.id).toBe(id)
    expect(t.card!.value).toBe(value)
    expect(t.over).toBe(false)
    expect(t.lastEvent).toEqual({ type: 'none' })
  })

  it('times out exactly when remainingTicks hits 0 (off-by-one guard)', () => {
    let s = stateWith({
      card: { id: 1, value: 42, deadlineTicks: 3, remainingTicks: 1 },
    })
    s = tick(s)
    expect(s.card!.remainingTicks).toBe(0)
    expect(s.over).toBe(true)
    expect(s.lastEvent).toEqual({ type: 'timeout', value: 42 })
  })

  it('is a zero-op once over', () => {
    let s = stateWith({
      card: { id: 1, value: 42, deadlineTicks: 3, remainingTicks: 0 },
      over: true,
    })
    const before = s
    s = tick(s)
    expect(s.card).toEqual(before.card)
    expect(s.over).toBe(true)
    expect(s.lastEvent).toEqual({ type: 'none' })
  })

  it('is a zero-op when card is null', () => {
    const s = tick(stateWith({ card: null }))
    expect(s.card).toBeNull()
    expect(s.lastEvent).toEqual({ type: 'none' })
  })
})

describe('place', () => {
  it('correct insertion into an empty row: index=0 is the only answer', () => {
    const s0 = stateWith({ card: { id: 7, value: 50, deadlineTicks: 40, remainingTicks: 40 } })
    const s = place(s0, 0, queued([0.5]))
    expect(s.row).toEqual([50])
    expect(s.streak).toBe(1)
    expect(s.bestStreak).toBe(1)
    expect(s.placed).toBe(1)
    expect(s.score).toBeGreaterThan(0)
    expect(s.card).not.toBeNull()
    expect(s.card!.id).not.toBe(7)
    expect(s.lastEvent.type).toBe('insert')
  })

  it('correct insertion into a populated row lands at the expected array shape', () => {
    const s0 = stateWith({
      row: [10, 30, 50],
      card: { id: 1, value: 20, deadlineTicks: 40, remainingTicks: 40 },
    })
    const s = place(s0, 1, queued([0.1]))
    expect(s.row).toEqual([10, 20, 30, 50])
  })

  it('wrong index actually splices the value in and ends the run', () => {
    const s0 = stateWith({
      row: [10, 30, 50],
      card: { id: 1, value: 20, deadlineTicks: 40, remainingTicks: 40 },
    })
    const s = place(s0, 2, queued([0.1])) // correctIndex is 1, click 2 instead
    expect(s.over).toBe(true)
    expect(s.card).toBeNull()
    expect(s.row).toEqual([10, 30, 20, 50])
    expect(s.lastEvent).toEqual({ type: 'wrong', index: 2, correctIndex: 1, value: 20 })
    expect(s.score).toBe(0)
    expect(s.streak).toBe(0)
  })

  it('index < 0 is a zero-op', () => {
    const s0 = stateWith({
      row: [10, 30],
      card: { id: 1, value: 20, deadlineTicks: 40, remainingTicks: 40 },
    })
    const s = place(s0, -1, queued([0.1]))
    expect(s.row).toBe(s0.row)
    expect(s.card).toBe(s0.card)
    expect(s.lastEvent).toEqual({ type: 'none' })
  })

  it('index > row.length is a zero-op', () => {
    const s0 = stateWith({
      row: [10, 30],
      card: { id: 1, value: 20, deadlineTicks: 40, remainingTicks: 40 },
    })
    const s = place(s0, 3, queued([0.1]))
    expect(s.row).toBe(s0.row)
    expect(s.card).toBe(s0.card)
    expect(s.lastEvent).toEqual({ type: 'none' })
  })

  it('is a zero-op once over (no re-click after wrong/timeout)', () => {
    const s0 = stateWith({
      row: [10, 20, 30],
      card: { id: 1, value: 15, deadlineTicks: 40, remainingTicks: 40 },
      over: true,
    })
    const s = place(s0, 1, queued([0.1]))
    expect(s.row).toBe(s0.row)
    expect(s.lastEvent).toEqual({ type: 'none' })
  })

  it('is a zero-op when card is null and not over (defensive)', () => {
    const s0 = stateWith({ row: [1, 2], card: null, over: false })
    const s = place(s0, 1, queued([0.1]))
    expect(s.row).toBe(s0.row)
    expect(s.lastEvent).toEqual({ type: 'none' })
  })

  it('trims from the left when the row exceeds maxRowLength, preserving order', () => {
    const fullRow = Array.from({ length: MAX_ROW_LENGTH }, (_, i) => (i + 1) * 10) // [10..100]
    const s0 = stateWith({
      row: fullRow,
      card: { id: 1, value: 15, deadlineTicks: 40, remainingTicks: 40 }, // belongs at index 1 (between 10 and 20)
    })
    const s = place(s0, 1, queued([0.1]))
    expect(s.row.length).toBe(MAX_ROW_LENGTH)
    // Pre-insert min (10) is the leftmost of the 11-element array and gets shifted away.
    expect(s.row).not.toContain(10)
    expect(s.row[0]).toBe(15)
    for (let i = 0; i + 1 < s.row.length; i++) expect(s.row[i]).toBeLessThan(s.row[i + 1])
  })

  it('scoring golden example matches the worked calculation', () => {
    // streak=4 (newStreak=5), row.length=3, deadlineTicks=40, remainingTicks=30
    // base = 10 + 3*2 = 16; speedBonus = round(20 * 30/40) = 15; multiplier = min(4, 1+1) = 2
    // gained = (16+15)*2 = 62
    const s0 = stateWith({
      row: [1, 2, 3],
      card: { id: 9, value: 999, deadlineTicks: 40, remainingTicks: 30 },
      streak: 4,
      bestStreak: 4,
      score: 100,
    })
    const s = place(s0, 3, queued([0.1])) // 999 > all -> correctIndex 3
    expect(s.lastEvent).toMatchObject({ type: 'insert', gained: 62, streak: 5, multiplier: 2 })
    expect(s.score).toBe(162)
  })

  it('bestStreak tracks streak exactly across consecutive correct placements', () => {
    let s = stateWith({ card: { id: 1, value: 10, deadlineTicks: 40, remainingTicks: 40 } })
    s = place(s, 0, queued([0.11, 0.22, 0.33]))
    s = place(s, correctIndex(s.row, s.card!.value), queued([0.44, 0.55]))
    s = place(s, correctIndex(s.row, s.card!.value), queued([0.66, 0.77]))
    expect(s.streak).toBe(3)
    expect(s.bestStreak).toBe(3)
  })
})

describe('end-to-end golden scenario', () => {
  it('replays a fixed seed script to a stable, hardcoded final state', () => {
    let s = createGame(CFG, 4242)
    // First card fixed by seed 4242.
    const firstValue = s.card!.value
    expect(s.row).toEqual([])
    expect(s.card!.deadlineTicks).toBe(CFG.initialDeadlineTicks)

    // Tick twice, then insert correctly (row is empty -> correctIndex 0).
    s = tick(s)
    s = tick(s)
    const remainingAtPlace1 = s.card!.remainingTicks
    s = place(s, 0, mulberry32(9999))
    expect(s.row).toEqual([firstValue])
    expect(s.lastEvent.type).toBe('insert')
    expect(s.streak).toBe(1)

    // Tick 3 more times, then insert wrong on purpose.
    s = tick(s)
    s = tick(s)
    s = tick(s)
    const secondValue = s.card!.value
    const ci = correctIndex(s.row, secondValue)
    const wrongIndex = ci === 0 ? 1 : 0 // guaranteed different from ci in a 1-length row
    s = place(s, wrongIndex, mulberry32(1))

    expect(s.over).toBe(true)
    expect(s.card).toBeNull()
    expect(s.lastEvent).toEqual({
      type: 'wrong',
      index: wrongIndex,
      correctIndex: ci,
      value: secondValue,
    })
    // Hardcoded expectations pinned from this exact seed/script.
    expect(remainingAtPlace1).toBe(CFG.initialDeadlineTicks - 2)
    expect(s.placed).toBe(1)
    expect(s.streak).toBe(1) // frozen at the value it held before the wrong placement

    // Further tick/place calls after game over must be zero-ops on all state
    // fields except lastEvent, which collapses to 'none' on each zero-op call.
    const frozen = s
    s = tick(s)
    expect(s.lastEvent).toEqual({ type: 'none' })
    s = place(s, 0, mulberry32(2))
    expect(s.lastEvent).toEqual({ type: 'none' })
    expect(s.row).toEqual(frozen.row)
    expect(s.card).toEqual(frozen.card)
    expect(s.score).toBe(frozen.score)
    expect(s.streak).toBe(frozen.streak)
    expect(s.over).toBe(frozen.over)
  })
})

describe('timeout golden scenario', () => {
  it('ends the run at exactly deadlineTicks ticks, not off by one', () => {
    let s = createGame(CFG, 77)
    const deadline = s.card!.deadlineTicks
    for (let i = 0; i < deadline - 1; i++) {
      s = tick(s)
      expect(s.over).toBe(false)
    }
    expect(s.card!.remainingTicks).toBe(1)
    s = tick(s)
    expect(s.card!.remainingTicks).toBe(0)
    expect(s.over).toBe(true)
    expect(s.lastEvent.type).toBe('timeout')
  })
})

describe('cardProgress', () => {
  it('is 0 with no active card', () => {
    expect(cardProgress(stateWith({ card: null }))).toBe(0)
  })

  it('reflects elapsed fraction of the deadline', () => {
    const s = stateWith({ card: { id: 1, value: 5, deadlineTicks: 40, remainingTicks: 30 } })
    expect(cardProgress(s)).toBeCloseTo(10 / 40)
  })

  it('is 0 immediately after spawn and approaches 1 near timeout', () => {
    const fresh = stateWith({ card: { id: 1, value: 5, deadlineTicks: 20, remainingTicks: 20 } })
    expect(cardProgress(fresh)).toBe(0)
    const nearEnd = stateWith({ card: { id: 1, value: 5, deadlineTicks: 20, remainingTicks: 1 } })
    expect(cardProgress(nearEnd)).toBeCloseTo(19 / 20)
  })
})

describe('spawnCard', () => {
  it('fixes deadlineTicks at spawn-time streak', () => {
    const base = stateWith({ streak: 6, card: null })
    const spawned = spawnCard(base, mulberry32(3))
    expect(spawned.card!.deadlineTicks).toBe(deadlineForStreak(6, CFG))
    expect(spawned.card!.remainingTicks).toBe(spawned.card!.deadlineTicks)
    expect(spawned.lastEvent).toEqual({ type: 'spawn', value: spawned.card!.value })
  })

  it('assigns a monotonically increasing nextId', () => {
    const base = stateWith({ nextId: 5, card: null })
    const spawned = spawnCard(base, mulberry32(1))
    expect(spawned.card!.id).toBe(5)
    expect(spawned.nextId).toBe(6)
  })
})

describe('STREAK_MULT / STREAK_MULT_STEP behavior sanity', () => {
  it('multiplier caps at STREAK_MULT_CAP for very large streaks', () => {
    const multiplierFor = (streak: number) => Math.min(STREAK_MULT_CAP, 1 + Math.floor(streak / STREAK_MULT_STEP))
    expect(multiplierFor(0)).toBe(1)
    expect(multiplierFor(STREAK_MULT_STEP)).toBe(2)
    expect(multiplierFor(1000)).toBe(STREAK_MULT_CAP)
  })

  it('BASE_POINTS and SPEED_BONUS_MAX are positive finite constants', () => {
    expect(BASE_POINTS).toBeGreaterThan(0)
    expect(SPEED_BONUS_MAX).toBeGreaterThan(0)
  })
})
