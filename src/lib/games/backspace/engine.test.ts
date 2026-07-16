import { describe, expect, it } from 'vitest'
import {
  advance,
  BASE_SPEED,
  BLOCK_H,
  CLUTCH_WINDOW,
  currentScore,
  DECAY_TICKS,
  DISTANCE_PER_POINT,
  FORCED_REWIND,
  live,
  LANES,
  MAX_CLUTCH,
  MAX_HISTORY,
  MAX_SPEED,
  maxBlockedFor,
  METER_MAX,
  METER_START,
  meterPct,
  mulberry32,
  nearestImpactTicks,
  newSession,
  nextRandom,
  REFILL_PER_TICK,
  REWIND_COST,
  SPAWN_GAP,
  spawnRow,
  speedFor,
  type AdvanceInput,
  type Session,
  type TickState,
} from './engine'

const FWD: AdvanceInput = { move: 0, rewind: false }
const REW: AdvanceInput = { move: 0, rewind: true }

function runForward(s: Session, n: number, input: AdvanceInput = FWD): Session {
  let cur = s
  for (let i = 0; i < n; i++) cur = advance(cur, input)
  return cur
}

/** A safe TickState with no obstacles (never collides on a forward tick). */
function safeTick(partial: Partial<TickState> = {}): TickState {
  return {
    tick: 0,
    markerLane: 2,
    rows: [],
    worldDistance: 0,
    scoreDistance: 0,
    speed: BASE_SPEED,
    spawnAccum: 0,
    nextRowId: 0,
    rngState: 12345 >>> 0,
    ...partial,
  }
}

/** Deep-copy a tick (so ring padding entries are distinct objects). */
function copyTick(t: TickState): TickState {
  return { ...t, rows: t.rows.map((r) => ({ ...r })) }
}

/** Build a session whose live state (+ optional history padding) is `t`. */
function sessionWith(t: TickState, meta: Partial<Session> = {}, pad = 0): Session {
  const base = newSession(999)
  const history: TickState[] = []
  for (let i = 0; i < pad; i++) history.push(copyTick(t))
  history.push(t)
  return {
    ...base,
    history,
    cursor: history.length - 1,
    mode: 'playing',
    ...meta,
  }
}

describe('constants & invariants', () => {
  it('MAX_HISTORY equals METER_MAX / REWIND_COST', () => {
    expect(MAX_HISTORY).toBe(METER_MAX / REWIND_COST)
  })

  it('SPAWN_GAP exceeds MAX_SPEED so at most one spawn per tick', () => {
    expect(SPAWN_GAP).toBeGreaterThan(MAX_SPEED)
  })

  it('speedFor is monotonic non-decreasing and clamped to [BASE_SPEED, MAX_SPEED]', () => {
    let prev = -1
    for (let d = 0; d <= 20000; d += 137) {
      const s = speedFor(d)
      expect(s).toBeGreaterThanOrEqual(BASE_SPEED)
      expect(s).toBeLessThanOrEqual(MAX_SPEED)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
    expect(speedFor(0)).toBe(BASE_SPEED)
    expect(speedFor(10_000_000)).toBe(MAX_SPEED)
  })

  it('maxBlockedFor is monotonic and clamped to [1, LANES-1]', () => {
    let prev = 0
    for (let d = 0; d <= 20000; d += 211) {
      const m = maxBlockedFor(d)
      expect(m).toBeGreaterThanOrEqual(1)
      expect(m).toBeLessThanOrEqual(LANES - 1)
      expect(m).toBeGreaterThanOrEqual(prev)
      prev = m
    }
    expect(maxBlockedFor(0)).toBe(1)
    expect(maxBlockedFor(10_000_000)).toBe(LANES - 1)
  })
})

describe('rng', () => {
  it('nextRandom returns [0,1) draws and advances state purely', () => {
    const a = nextRandom(1)
    const b = nextRandom(1)
    expect(a).toEqual(b) // pure
    expect(a.value).toBeGreaterThanOrEqual(0)
    expect(a.value).toBeLessThan(1)
    expect(a.rngState).not.toBe(1)
  })

  it('nextRandom matches the mulberry32 draw sequence for the same seed', () => {
    const ref = mulberry32(42)
    let state = 42 >>> 0
    for (let i = 0; i < 20; i++) {
      const step = nextRandom(state)
      expect(step.value).toBeCloseTo(ref(), 12)
      state = step.rngState
    }
  })
})

describe('spawnRow', () => {
  it('always leaves at least one open lane and advances rng/id/accum', () => {
    let t = safeTick({ spawnAccum: SPAWN_GAP, worldDistance: 50_000 }) // maxBlocked = 4
    for (let i = 0; i < 500; i++) {
      const before = t
      t = spawnRow(t)
      const row = t.rows[t.rows.length - 1]
      // popcount of blocked mask must be <= LANES-1 (>=1 open lane).
      let bits = 0
      for (let l = 0; l < LANES; l++) bits += (row.blocked >> l) & 1
      expect(bits).toBeGreaterThanOrEqual(1)
      expect(bits).toBeLessThanOrEqual(LANES - 1)
      expect(row.y).toBe(-BLOCK_H)
      expect(t.nextRowId).toBe(before.nextRowId + 1)
      expect(t.spawnAccum).toBe(before.spawnAccum - SPAWN_GAP)
      expect(t.rngState).not.toBe(before.rngState)
      t = { ...t, spawnAccum: t.spawnAccum + SPAWN_GAP } // top up for next iter
    }
  })
})

describe('newSession', () => {
  it('has the documented initial shape', () => {
    const s = newSession(7)
    expect(s.mode).toBe('idle')
    expect(s.over).toBe(false)
    expect(s.meter).toBe(METER_START)
    expect(s.clutchMult).toBe(1)
    expect(s.ticksSinceClutch).toBe(0)
    expect(s.peakScore).toBe(0)
    expect(s.cursor).toBe(0)
    expect(s.history).toHaveLength(1)
    const t = live(s)
    expect(t).toMatchObject({
      tick: 0,
      markerLane: 2,
      rows: [],
      worldDistance: 0,
      scoreDistance: 0,
      speed: BASE_SPEED,
      spawnAccum: 0,
      nextRowId: 0,
      rngState: 7,
    })
  })
})

describe('forward advance', () => {
  it('moves the world, scores, and appends to history', () => {
    const s0 = newSession(1)
    const s1 = advance(s0, FWD)
    const t = live(s1)
    expect(t.tick).toBe(1)
    expect(t.worldDistance).toBe(BASE_SPEED)
    expect(t.scoreDistance).toBe(BASE_SPEED) // clutchMult 1
    expect(s1.cursor).toBe(1)
    expect(s1.history).toHaveLength(2)
    expect(s1.mode).toBe('playing')
    expect(s1.meter).toBe(Math.min(METER_MAX, METER_START + REFILL_PER_TICK))
  })

  it('clamps the marker lane at 0 and 4 (no move event when clamped)', () => {
    const left = sessionWith(safeTick({ markerLane: 0 }))
    const l1 = advance(left, { move: -1, rewind: false })
    expect(live(l1).markerLane).toBe(0)
    expect(l1.events.moved).toBe(false)

    const right = sessionWith(safeTick({ markerLane: 4 }))
    const r1 = advance(right, { move: 1, rewind: false })
    expect(live(r1).markerLane).toBe(4)
    expect(r1.events.moved).toBe(false)
  })

  it('applies a valid lane move and flags it', () => {
    const s = sessionWith(safeTick({ markerLane: 2 }))
    const s1 = advance(s, { move: 1, rewind: false })
    expect(live(s1).markerLane).toBe(3)
    expect(s1.events.moved).toBe(true)
  })
})

// A row that, after ONE forward tick at BASE_SPEED, sits in the collision band
// on lane 2 (y 470 -> 473; band is [478-64, 522) overlap; blocked bit 2).
function collisionTick(partial: Partial<TickState> = {}): TickState {
  return safeTick({ markerLane: 2, rows: [{ id: 0, y: 470, blocked: 1 << 2 }], ...partial })
}

describe('collision resolution', () => {
  it('is FATAL when the meter cannot fund a rewind', () => {
    const s = sessionWith(collisionTick(), { meter: REWIND_COST - 1 })
    const s1 = advance(s, FWD)
    expect(s1.over).toBe(true)
    expect(s1.mode).toBe('over')
    expect(s1.events.crashed).toBe(true)
  })

  it('triggers the safety net (auto-rewind, meter drain, non-fatal) when funded', () => {
    const s = sessionWith(collisionTick(), { meter: 5000 }, 25) // cursor 25
    const s1 = advance(s, FWD)
    expect(s1.over).toBe(false)
    expect(s1.events.autoSaved).toBe(true)
    expect(s1.events.crashed).toBe(false)
    expect(s1.mode).toBe('rewinding')
    const n = Math.min(FORCED_REWIND, 25, Math.floor(5000 / REWIND_COST))
    expect(s1.cursor).toBe(25 - n)
    expect(s1.meter).toBe(5000 - n * REWIND_COST)
  })

  it('is FATAL when the safety net cannot fund even one step (n === 0)', () => {
    // meter funded but cursor 0 => n = min(20, 0, ...) = 0 => fatal.
    const s = sessionWith(collisionTick(), { meter: 5000 }, 0)
    expect(s.cursor).toBe(0)
    const s1 = advance(s, FWD)
    expect(s1.over).toBe(true)
    expect(s1.events.crashed).toBe(true)
  })

  it('lets a fork onto an open lane dodge the wall', () => {
    // Same wall, but move onto lane 0 (open) before resolving -> no collision.
    const s = sessionWith(collisionTick({ markerLane: 1 }), { meter: 5000 }, 5)
    const s1 = advance(s, { move: -1, rewind: false }) // lane 1 -> 0
    expect(live(s1).markerLane).toBe(0)
    expect(s1.over).toBe(false)
    expect(s1.events.autoSaved).toBe(false)
    expect(s1.events.crashed).toBe(false)
  })
})

describe('manual rewind', () => {
  it('is a no-op with meterEmpty at buffer start (cursor 0), no drain', () => {
    const s = sessionWith(safeTick(), { meter: 5000 }, 0)
    const s1 = advance(s, REW)
    expect(s1.cursor).toBe(0)
    expect(s1.meter).toBe(5000)
    expect(s1.events.meterEmpty).toBe(true)
    expect(s1.events.rewound).toBe(false)
  })

  it('is a no-op with meterEmpty when the meter is short, no drain', () => {
    const s = sessionWith(safeTick(), { meter: REWIND_COST - 1 }, 5)
    const s1 = advance(s, REW)
    expect(s1.cursor).toBe(s.cursor)
    expect(s1.meter).toBe(REWIND_COST - 1)
    expect(s1.events.meterEmpty).toBe(true)
  })

  it('rewinds the cursor and drains one step when funded', () => {
    const s = runForward(newSession(3), 10)
    const before = s.cursor
    const s1 = advance(s, REW)
    expect(s1.cursor).toBe(before - 1)
    expect(s1.meter).toBe(s.meter - REWIND_COST)
    expect(s1.events.rewound).toBe(true)
    expect(s1.mode).toBe('rewinding')
  })

  it('never drives the meter negative', () => {
    let s = sessionWith(safeTick(), { meter: REWIND_COST }, 5)
    s = advance(s, REW) // drains to exactly 0
    expect(s.meter).toBe(0)
    s = advance(s, REW) // now short -> no drain
    expect(s.meter).toBe(0)
    expect(s.meter).toBeGreaterThanOrEqual(0)
  })
})

describe('clutch multiplier', () => {
  // A wall near impact on lane 2 (nearestImpactTicks small, within CLUTCH_WINDOW).
  function nearWall(): TickState {
    return safeTick({ markerLane: 2, rows: [{ id: 0, y: 400, blocked: 1 << 2 }] })
  }

  it('nearestImpactTicks reports a small value within the window', () => {
    const n = nearestImpactTicks(nearWall())
    expect(n).toBeLessThanOrEqual(CLUTCH_WINDOW)
    expect(n).toBeGreaterThan(0)
  })

  it('a clutch rewind banks the multiplier (capped at MAX_CLUTCH)', () => {
    const s = sessionWith(nearWall(), { meter: 5000, clutchMult: 1, mode: 'playing' }, 5)
    const s1 = advance(s, REW)
    expect(s1.events.clutch).toBe(true)
    expect(s1.events.banked).toBe(true)
    expect(s1.clutchMult).toBe(2)
    expect(s1.ticksSinceClutch).toBe(0)

    const capped = sessionWith(nearWall(), { meter: 5000, clutchMult: MAX_CLUTCH, mode: 'playing' }, 5)
    const c1 = advance(capped, REW)
    expect(c1.events.clutch).toBe(true)
    expect(c1.events.banked).toBe(false)
    expect(c1.clutchMult).toBe(MAX_CLUTCH)
  })

  it('does not re-fire clutch on a continued hold (mode already rewinding)', () => {
    const s = sessionWith(nearWall(), { meter: 5000, clutchMult: 1, mode: 'rewinding' }, 5)
    const s1 = advance(s, REW)
    expect(s1.events.clutch).toBe(false)
    expect(s1.clutchMult).toBe(1)
  })

  it('decays the multiplier after DECAY_TICKS of survival', () => {
    const s = sessionWith(safeTick(), { meter: 5000, clutchMult: 3, ticksSinceClutch: DECAY_TICKS - 1 }, 2)
    const s1 = advance(s, FWD)
    expect(s1.clutchMult).toBe(2)
    expect(s1.ticksSinceClutch).toBe(0)
  })
})

describe('peak score', () => {
  it('is monotonic across a rewind', () => {
    const s = runForward(newSession(5), 40)
    const peak = currentScore(s)
    expect(peak).toBe(Math.floor(live(s).scoreDistance / DISTANCE_PER_POINT))
    const rewound = advance(s, REW)
    expect(currentScore(rewound)).toBe(peak) // never dips
  })
})

describe('history ring buffer', () => {
  it('never exceeds MAX_HISTORY (drops the oldest on overflow)', () => {
    const history: TickState[] = []
    for (let i = 0; i < MAX_HISTORY; i++) history.push(copyTick(safeTick({ tick: i })))
    const base = newSession(1)
    const full: Session = { ...base, history, cursor: history.length - 1, meter: METER_MAX, mode: 'playing' }
    expect(full.history).toHaveLength(MAX_HISTORY)
    const s1 = advance(full, FWD)
    expect(s1.history.length).toBe(MAX_HISTORY)
    expect(s1.cursor).toBe(MAX_HISTORY - 1)
    // oldest (tick 0) dropped.
    expect(s1.history[0].tick).toBe(1)
  })

  it('caps refill at METER_MAX', () => {
    const s = sessionWith(safeTick(), { meter: METER_MAX - 5 }, 2)
    const s1 = advance(s, FWD)
    expect(s1.meter).toBe(METER_MAX)
  })
})

describe('forking (copy-on-write)', () => {
  it('a move while rewound edits only history[cursor], leaving the future snapshot untouched', () => {
    const s = runForward(newSession(9), 6) // cursor 6
    const rewound = advance(s, REW) // cursor 5, length 7
    const futureSnap = rewound.history[6]
    const moved = advance(rewound, { move: 1, rewind: true }) // edit history[5], then cursor 4
    expect(moved.history[6]).toBe(futureSnap) // same reference — untouched
    expect(moved.history[5].markerLane).toBe(3) // edited from 2 -> 3
  })

  it('resuming forward truncates the abandoned future', () => {
    const s = runForward(newSession(11), 6) // cursor 6, length 7
    const rewound = advance(s, REW) // cursor 5
    const resumed = advance(rewound, { move: 1, rewind: false }) // fork onto lane 3
    expect(live(resumed).markerLane).toBe(3)
    expect(resumed.cursor).toBe(resumed.history.length - 1)
    // The abandoned tick-6 branch (markerLane 2) is gone; the new live is the fork.
    expect(live(resumed).tick).toBe(6)
  })
})

describe('determinism', () => {
  it('same seed + same input log yields deep-equal sessions', () => {
    const inputs: AdvanceInput[] = []
    for (let i = 0; i < 120; i++) {
      inputs.push({ move: (i % 7 === 0 ? 1 : i % 5 === 0 ? -1 : 0) as -1 | 0 | 1, rewind: false })
    }
    let a = newSession(0xabcdef)
    let b = newSession(0xabcdef)
    for (const inp of inputs) {
      a = advance(a, inp)
      b = advance(b, inp)
      if (a.over) break
    }
    expect(a).toEqual(b)
  })

  it('a rewind then identical-input replay reproduces a bit-exact TickState', () => {
    const s = runForward(newSession(0x1234), 60)
    const snapshot = copyTick(live(s))
    const rewound = advance(s, REW) // cursor back one
    const replay = advance(rewound, FWD) // replay the same branch forward
    expect(live(replay)).toEqual(snapshot)
  })
})

describe('reckless-hold starvation', () => {
  it('a recurring wall drains the meter and then turns fatal', () => {
    // Every history entry is the same collision-precursor, so each safety-net
    // rewind lands on an identical state that re-collides — the reckless loop.
    const s = sessionWith(collisionTick(), { meter: 350 }, 30)
    let cur = s
    let steps = 0
    while (!cur.over && steps < 50) {
      cur = advance(cur, FWD)
      steps++
    }
    expect(cur.over).toBe(true)
    expect(cur.events.crashed).toBe(true)
    expect(steps).toBeLessThan(50)
  })
})

describe('idempotent over & helpers', () => {
  it('advance on an over session returns it unchanged', () => {
    const over = { ...newSession(1), over: true, mode: 'over' as const }
    expect(advance(over, FWD)).toBe(over)
  })

  it('meterPct reflects the meter fraction', () => {
    const s = sessionWith(safeTick(), { meter: METER_MAX / 2 })
    expect(meterPct(s)).toBeCloseTo(0.5, 6)
  })
})
