import { describe, expect, it } from 'vitest'
import {
  CHIP_MAX,
  CHIP_MIN,
  INITIAL_TARGETS,
  START_LIVES,
  TARGET_STEP,
  TOSS_GRANT_EVERY,
  bustFraction,
  bustingChipCount,
  canToss,
  dailySeed,
  drawChip,
  laneDistance,
  laneRisk,
  mulberry32,
  newGame,
  placeChip,
  toss,
  wouldBust,
  wouldLock,
  type Rng,
  type StackpotState,
} from './engine'

/** Array-backed stub Rng: yields the queued values in order, tracks consumption. */
function queueRng(values: number[]): { rng: Rng; remaining: () => number } {
  let i = 0
  const rng: Rng = () => {
    const v = values[i] ?? 0
    i++
    return v
  }
  return { rng, remaining: () => values.length - i }
}

/** Build a state directly for targeted transition tests (fixed tray/next, no queue coupling). */
function stateWith(overrides: Partial<StackpotState>): StackpotState {
  const base = newGame(mulberry32(1))
  return { ...base, ...overrides }
}

describe('newGame', () => {
  it('initializes fresh run and consumes exactly 2 draws (tray then next)', () => {
    // drawChip = 1 + floor(v*9). 0 -> 1, 0.5 -> 5.
    const { rng, remaining } = queueRng([0, 0.5, 0.99, 0.99])
    const s = newGame(rng)
    expect(s.lanes.map((l) => l.target)).toEqual([...INITIAL_TARGETS])
    expect(s.lanes.every((l) => l.total === 0)).toBe(true)
    expect(s.lives).toBe(START_LIVES)
    expect(s.combo).toBe(1)
    expect(s.score).toBe(0)
    expect(s.locksTotal).toBe(0)
    expect(s.longestCombo).toBe(1)
    expect(s.tossesLeft).toBe(1)
    expect(s.over).toBe(false)
    expect(s.tray).toBe(1) // first draw (0)
    expect(s.next).toBe(5) // second draw (0.5)
    expect(remaining()).toBe(2) // only 2 consumed of 4
  })
})

describe('drawChip', () => {
  it('maps domain edges to 1..9', () => {
    expect(drawChip(() => 0)).toBe(CHIP_MIN)
    expect(drawChip(() => 0.9999)).toBe(CHIP_MAX)
    expect(drawChip(() => 0.5)).toBe(5)
    // full-range coverage
    for (let k = 0; k < 9; k++) {
      const v = (k + 0.5) / 9
      expect(drawChip(() => v)).toBe(k + 1)
    }
  })
})

describe('placeChip PLACE (sub-target)', () => {
  it('adds to total, leaves combo untouched, consumes one rng, slides tray<-next', () => {
    const { rng, remaining } = queueRng([0.1, 0.2, 0.6]) // tray, next, then next-after-place
    let s = newGame(rng) // tray, next drawn (2)
    const trayBefore = s.tray
    const nextBefore = s.next
    s = placeChip(s, 0, rng)
    expect(s.lanes[0].total).toBe(trayBefore)
    expect(s.lanes[0].target).toBe(INITIAL_TARGETS[0])
    expect(s.combo).toBe(1)
    expect(s.event.type).toBe('place')
    expect(s.tray).toBe(nextBefore) // old next slid into tray
    expect(remaining()).toBe(0) // exactly one more draw consumed
  })
})

describe('placeChip LOCK (exact)', () => {
  it('banks target×combo, resets lane, +5 target, +1 combo/locks, records multiplier', () => {
    const { rng } = queueRng([0, 0, 0]) // tray=1,next=1
    // Lane 0 sits at total 14, target 15; a chip of 1 locks it exactly.
    let s = stateWith({ lanes: [{ total: 14, target: 15 }, { total: 0, target: 20 }, { total: 0, target: 25 }, { total: 0, target: 30 }], tray: 1, combo: 1 })
    s = placeChip(s, 0, rng)
    expect(s.event.type).toBe('lock')
    expect(s.event.banked).toBe(15) // 15 × 1
    expect(s.event.multiplier).toBe(1) // pre-increment combo
    expect(s.score).toBe(15)
    expect(s.lanes[0].total).toBe(0)
    expect(s.lanes[0].target).toBe(15 + TARGET_STEP)
    expect(s.combo).toBe(2)
    expect(s.locksTotal).toBe(1)
    expect(s.longestCombo).toBe(2)
  })
})

describe('combo escalation', () => {
  it('applies increasing multipliers across consecutive locks; bust resets combo but keeps peak', () => {
    const { rng } = queueRng(new Array(20).fill(0)) // plenty of draws; values irrelevant here
    // Lock lane0 at ×1 (banks 15), lane grows to 20.
    let s = stateWith({ lanes: [{ total: 14, target: 15 }, { total: 15, target: 20 }, { total: 0, target: 25 }, { total: 0, target: 30 }], tray: 1, combo: 1 })
    s = { ...s, tray: 1 }
    s = placeChip(s, 0, rng) // lock lane0 ×1 -> banked 15, combo 2
    expect(s.score).toBe(15)
    expect(s.combo).toBe(2)
    // Now lock lane1 (total 15, target 20) with a 5 at combo ×2 -> banks 40.
    s = { ...s, tray: 5 }
    s = placeChip(s, 1, rng)
    expect(s.event.banked).toBe(40) // 20 × 2
    expect(s.score).toBe(55)
    expect(s.combo).toBe(3)
    expect(s.longestCombo).toBe(3)
    // Bust lane2: total 0 target 25, chip so big it overshoots — force via near-target.
    s = { ...s, lanes: s.lanes.map((l, i) => (i === 2 ? { total: 24, target: 25 } : l)), tray: 9 }
    s = placeChip(s, 2, rng)
    expect(s.event.type).toBe('bust')
    expect(s.combo).toBe(1) // reset
    expect(s.longestCombo).toBe(3) // peak retained
    expect(s.event.brokeCombo).toBe(true)
  })
})

describe('placeChip BUST (overshoot)', () => {
  it('loses a life, resets lane, combo->1, marks lifeLost; over only at 0 lives', () => {
    const { rng } = queueRng(new Array(10).fill(0.9))
    let s = stateWith({ lanes: [{ total: 24, target: 25 }, { total: 0, target: 20 }, { total: 0, target: 25 }, { total: 0, target: 30 }], tray: 5, combo: 3, lives: 3 })
    s = { ...s, tray: 5 }
    s = placeChip(s, 0, rng) // 24+5=29 > 25 -> bust
    expect(s.event.type).toBe('bust')
    expect(s.event.lifeLost).toBe(true)
    expect(s.lives).toBe(2)
    expect(s.lanes[0].total).toBe(0)
    expect(s.combo).toBe(1)
    expect(s.over).toBe(false)
  })

  it('bust on last life sets over=true and still advances tray once', () => {
    const { rng, remaining } = queueRng([0.5]) // one draw available for the tray advance
    let s = stateWith({ lanes: [{ total: 24, target: 25 }, { total: 0, target: 20 }, { total: 0, target: 25 }, { total: 0, target: 30 }], lives: 1 })
    s = { ...s, tray: 9, next: 4 }
    s = placeChip(s, 0, rng)
    expect(s.over).toBe(true)
    expect(s.lives).toBe(0)
    expect(s.tray).toBe(4) // old next slid in
    expect(remaining()).toBe(0) // exactly one rng consumed for the advance
  })
})

describe('toss grant', () => {
  it('grants exactly one toss when a lock crosses a TOSS_GRANT_EVERY boundary', () => {
    const { rng } = queueRng(new Array(10).fill(0))
    // Sit at locksTotal = TOSS_GRANT_EVERY - 1; next lock hits the boundary.
    let s = stateWith({ lanes: [{ total: 14, target: 15 }, { total: 0, target: 20 }, { total: 0, target: 25 }, { total: 0, target: 30 }], locksTotal: TOSS_GRANT_EVERY - 1, tossesLeft: 1 })
    s = { ...s, tray: 1 }
    s = placeChip(s, 0, rng)
    expect(s.locksTotal).toBe(TOSS_GRANT_EVERY)
    expect(s.tossesLeft).toBe(2) // exactly one granted
  })
})

describe('toss', () => {
  it('decrements tosses, swaps tray<-next, one rng, lanes/lives/combo untouched', () => {
    const { rng, remaining } = queueRng([0.3]) // one draw for the new next
    let s = stateWith({ tossesLeft: 2, combo: 4, lives: 3 })
    s = { ...s, tray: 7, next: 2 }
    const lanesBefore = JSON.stringify(s.lanes)
    s = toss(s, rng)
    expect(s.event.type).toBe('toss')
    expect(s.event.chip).toBe(7) // old tray discarded
    expect(s.tray).toBe(2) // old next
    expect(s.tossesLeft).toBe(1)
    expect(s.combo).toBe(4)
    expect(s.lives).toBe(3)
    expect(JSON.stringify(s.lanes)).toBe(lanesBefore)
    expect(remaining()).toBe(0)
  })

  it('is a no-op (same ref, zero rng) when tossesLeft === 0 or over', () => {
    const { rng, remaining } = queueRng([0.5, 0.5])
    const zero = stateWith({ tossesLeft: 0 })
    expect(toss(zero, rng)).toBe(zero)
    const done = stateWith({ tossesLeft: 3, over: true })
    expect(toss(done, rng)).toBe(done)
    expect(remaining()).toBe(2) // no-op paths consumed no rng from the probe queue
  })
})

describe('no-op guards', () => {
  it('placing on over-state or out-of-range lane returns same ref, consumes zero rng', () => {
    const setup = queueRng([0.5, 0.5])
    const s = newGame(setup.rng) // consumes 2
    const over = { ...s, over: true }
    const probe = queueRng([0.1, 0.2, 0.3])
    expect(placeChip(over, 0, probe.rng)).toBe(over)
    expect(placeChip(s, -1, probe.rng)).toBe(s)
    expect(placeChip(s, 4, probe.rng)).toBe(s)
    expect(placeChip(s, 1.5, probe.rng)).toBe(s)
    expect(probe.remaining()).toBe(3) // untouched
  })
})

describe('read helpers', () => {
  it('laneDistance / wouldLock / wouldBust', () => {
    const lane = { total: 22, target: 25 }
    expect(laneDistance(lane)).toBe(3)
    expect(wouldLock(lane, 3)).toBe(true)
    expect(wouldLock(lane, 2)).toBe(false)
    expect(wouldBust(lane, 4)).toBe(true)
    expect(wouldBust(lane, 3)).toBe(false)
  })

  it('bustingChipCount = clamp(9 - distance, 0, 9) and bustFraction', () => {
    expect(bustingChipCount({ total: 0, target: 15 })).toBe(0) // distance 15 -> clamp low
    expect(bustingChipCount({ total: 14, target: 15 })).toBe(8) // distance 1 -> 9-1
    expect(bustingChipCount({ total: 8, target: 12 })).toBe(5) // distance 4 -> 9-4
    expect(bustFraction({ total: 14, target: 15 })).toBeCloseTo(8 / 9)
  })

  it('laneRisk thresholds: distance 2 -> danger, 4 -> warn, 5 -> safe', () => {
    expect(laneRisk({ total: 23, target: 25 })).toBe('danger') // d=2
    expect(laneRisk({ total: 21, target: 25 })).toBe('warn') // d=4
    expect(laneRisk({ total: 20, target: 25 })).toBe('safe') // d=5
    expect(laneRisk({ total: 24, target: 25 })).toBe('danger') // d=1
  })

  it('canToss', () => {
    const { rng } = queueRng([0.5, 0.5])
    const s = newGame(rng)
    expect(canToss(s)).toBe(true)
    expect(canToss({ ...s, tossesLeft: 0 })).toBe(false)
    expect(canToss({ ...s, over: true })).toBe(false)
  })
})

describe('determinism + daily seed', () => {
  it('identical seed + identical actions produce identical states', () => {
    const SEED = 123456789
    const run = () => {
      const rng = mulberry32(SEED)
      let s = newGame(rng)
      for (let i = 0; i < 12; i++) s = placeChip(s, i % 4, rng)
      return s
    }
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })

  it('dailySeed is stable and differs for neighboring dates', () => {
    expect(dailySeed('2026-07-15')).toBe(dailySeed('2026-07-15'))
    expect(dailySeed('2026-07-15')).not.toBe(dailySeed('2026-07-16'))
  })
})
