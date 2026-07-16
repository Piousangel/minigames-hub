import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  advance,
  bpmForStage,
  BPM_MAX,
  comboForStage,
  cycleProgress,
  cyclesPerStageFor,
  distanceToDue,
  gcd,
  HIT_POINTS,
  isBoundaryTick,
  isConfluenceTick,
  isDueAt,
  laneSlots,
  lcm,
  LOCK_BONUS,
  CONFLUENCE_BASE,
  msPerTick,
  mulberry32,
  nearestDueTick,
  newGame,
  nextConfluenceTick,
  SPAWN_LEAD_TICKS,
  STAGE_BONUS,
  tap,
  TICKS_PER_BEAT,
  TOLERANCE,
  type ClockKey,
  type PolytapState,
  type Rng,
  type Slot,
} from './engine'

// -- Helpers ----------------------------------------------------------------

const R = (): Rng => mulberry32(1)
const NO_RNG: Rng = () => {
  throw new Error('rng consumed')
}

interface Tap {
  tick: number
  key: ClockKey
}

interface AutoOpts {
  /** Deliberately let a slot go unplayed. */
  skip?: (s: Slot) => boolean
  /** Tap at a tick other than dueTick (to build spreads). */
  tapTick?: (s: Slot) => number
}

interface AutoResult {
  state: PolytapState
  script: Tap[]
  maxSlots: number
  scores: number[]
  seen: Slot[]
}

/** A perfect player: taps every slot exactly on its dueTick unless told otherwise. */
function autoplay(seed: number, untilTick: number, opts?: AutoOpts): AutoResult {
  const rng = mulberry32(seed)
  let s = newGame(seed)
  const script: Tap[] = []
  const scores: number[] = [s.score]
  const seenIds = new Set<number>()
  const seen: Slot[] = []
  let maxSlots = 0

  for (let t = 1; t <= untilTick; t++) {
    s = advance(s, t, rng)
    maxSlots = Math.max(maxSlots, s.slots.length)
    scores.push(s.score)
    for (const sl of s.slots) {
      if (!seenIds.has(sl.id)) {
        seenIds.add(sl.id)
        seen.push(sl)
      }
    }
    if (s.over) break

    const when = (sl: Slot) => (opts?.tapTick ? opts.tapTick(sl) : sl.dueTick)
    const pending = s.slots.filter((sl) => !sl.hit && when(sl) === t && !opts?.skip?.(sl))
    for (const sl of pending) {
      s = tap(s, sl.key)
      script.push({ tick: t, key: sl.key })
      scores.push(s.score)
      if (s.over) break
    }
    if (s.over) break
  }
  return { state: s, script, maxSlots, scores, seen }
}

/** Replay a recorded script, advancing in caller-chosen chunks. */
function replayChunked(seed: number, script: Tap[], untilTick: number, chunkRng: Rng): PolytapState {
  const rng = mulberry32(seed)
  let s = newGame(seed)
  let i = 0
  let t = 0
  while (t < untilTick && !s.over) {
    let target = Math.min(t + 1 + Math.floor(chunkRng() * 37), untilTick)
    if (i < script.length && script[i].tick < target) target = script[i].tick
    s = advance(s, target, rng)
    t = target
    while (i < script.length && script[i].tick === t && !s.over) {
      s = tap(s, script[i].key)
      i++
    }
  }
  return s
}

function summary(s: PolytapState) {
  return {
    score: s.score,
    cyclesCleared: s.cyclesCleared,
    stage: s.stage,
    hits: s.hits,
    locks: s.locks,
    rngCalls: s.rngCalls,
    bpm: s.bpm,
  }
}

// -- 1. Utilities -----------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const c = mulberry32(43)
    const seqA = Array.from({ length: 8 }, () => a())
    const seqB = Array.from({ length: 8 }, () => b())
    const seqC = Array.from({ length: 8 }, () => c())
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const x of seqA) expect(x).toBeGreaterThanOrEqual(0)
    for (const x of seqA) expect(x).toBeLessThan(1)
  })
})

describe('gcd / lcm', () => {
  it('matches the clock periods we actually use', () => {
    expect(gcd(36, 48)).toBe(12)
    expect(lcm(36, 48)).toBe(144)
    expect(gcd(36, 60)).toBe(12)
    expect(lcm(36, 60)).toBe(180)
    expect(gcd(48, 84)).toBe(12)
    expect(lcm(48, 84)).toBe(336)
  })
})

// -- 2. Construction --------------------------------------------------------

describe('newGame', () => {
  it('starts in warm-up with a single J clock and consumes no rng', () => {
    const s = newGame(7)
    expect(s.stage).toBe(0)
    expect(s.clocks).toHaveLength(1)
    expect(s.clocks[0].key).toBe('j')
    expect(s.clocks[0].periodTicks).toBe(48)
    expect(s.lives).toBe(3)
    expect(s.score).toBe(0)
    expect(s.cyclesCleared).toBe(0)
    expect(s.tick).toBe(0)
    expect(s.over).toBe(false)
    expect(s.rngCalls).toBe(0)
    expect(s.bpm).toBe(96)
    expect(s.cycleTicks).toBe(48)
    expect(s.cyclesPerStage).toBe(4)
    expect(s.slots).toEqual([])
  })
})

// -- 3. Clock maths ---------------------------------------------------------

describe('nearestDueTick / distanceToDue', () => {
  const clock = newGame(1).clocks[0] // offset 0, period 48

  it('is exact on, around, and before the offset', () => {
    expect(nearestDueTick(clock, 48)).toBe(48)
    expect(distanceToDue(clock, 48)).toBe(0)
    expect(distanceToDue(clock, 50)).toBe(2)
    expect(distanceToDue(clock, 46)).toBe(2)
    expect(nearestDueTick(clock, 70)).toBe(48)
    expect(nearestDueTick(clock, 74)).toBe(96)
  })

  it('never returns a negative or NaN distance, even for negative rel', () => {
    const shifted = { ...clock, offsetTicks: 192, periodTicks: 36 }
    expect(nearestDueTick(shifted, 100)).toBe(84)
    expect(distanceToDue(shifted, 100)).toBe(16)
    for (let t = -500; t <= 500; t++) {
      const d = distanceToDue(shifted, t)
      expect(Number.isNaN(d)).toBe(false)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(18)
    }
  })

  it('is symmetric around a due tick', () => {
    for (let k = 0; k <= 24; k++) {
      expect(distanceToDue(clock, 96 + k)).toBe(distanceToDue(clock, 96 - k))
    }
  })

  it('isDueAt agrees with distanceToDue === 0', () => {
    for (let t = -100; t <= 300; t++) {
      expect(isDueAt(clock, t)).toBe(distanceToDue(clock, t) === 0)
    }
  })
})

describe('critical spacing invariant', () => {
  it('an old-grid slot can never exist at a stage transition', () => {
    const MIN_PERIOD_TICKS = 3 * TICKS_PER_BEAT
    expect(SPAWN_LEAD_TICKS + TOLERANCE + 1).toBeLessThan(MIN_PERIOD_TICKS)
  })
})

// -- 4. Spawning ------------------------------------------------------------

describe('spawning', () => {
  it('never re-uses the stage-start tick as a due', () => {
    const s = advance(newGame(1), 48, R())
    const js = laneSlots(s, 'j')
    expect(js.length).toBeGreaterThan(0)
    expect(Math.min(...js.map((x) => x.dueTick))).toBe(48)
    expect(s.slots.every((x) => x.dueTick > s.stageStartTick)).toBe(true)
  })

  it('is idempotent — advancing to the same tick twice duplicates nothing', () => {
    const once = advance(newGame(1), 48, R())
    const twice = advance(once, 48, R())
    expect(twice.slots).toEqual(once.slots)
    expect(twice.events).toEqual([])
    const pairs = twice.slots.map((x) => `${x.clockId}:${x.dueTick}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it('keeps slots sorted by dueTick then clockId', () => {
    const { state, seen } = autoplay(3, 900)
    expect(seen.length).toBeGreaterThan(10)
    for (let i = 1; i < state.slots.length; i++) {
      const a = state.slots[i - 1]
      const b = state.slots[i]
      expect(a.dueTick < b.dueTick || (a.dueTick === b.dueTick && a.clockId <= b.clockId)).toBe(true)
    }
  })
})

// -- 5. Chunk independence --------------------------------------------------

describe('advance', () => {
  it('is independent of how the timeline is chunked', () => {
    const bulk = advance(newGame(5), 600, R())
    let step = newGame(5)
    const rng = R()
    for (let t = 1; t <= 600; t++) step = advance(step, t, rng)
    expect(step.tick).toBe(bulk.tick)
    expect(step.score).toBe(bulk.score)
    expect(step.lives).toBe(bulk.lives)
    expect(step.cyclesCleared).toBe(bulk.cyclesCleared)
    expect(step.stage).toBe(bulk.stage)
    expect(step.slots).toEqual(bulk.slots)
  })

  it('is a no-op when toTick is not in the future', () => {
    const s = advance(newGame(1), 100, R())
    const same = advance(s, 100, R())
    expect({ ...same, events: [] }).toEqual({ ...s, events: [] })
    expect(same.events).toEqual([])
    expect(advance(s, 40, R()).events).toEqual([])
  })
})

// -- 6. Tap ------------------------------------------------------------------

describe('tap', () => {
  it('scores a hit inside the window without costing a life', () => {
    let s = advance(newGame(1), 48, R())
    s = tap(s, 'j')
    expect(s.hits).toBe(1)
    expect(s.score).toBe(10)
    expect(s.lives).toBe(3)
    expect(s.events).toEqual([{ type: 'hit', key: 'j', dueTick: 48, isConfluence: false }])
  })

  it('accepts exactly ±TOLERANCE', () => {
    for (const t of [48 - TOLERANCE, 48 + TOLERANCE]) {
      const s = tap(advance(newGame(1), t, R()), 'j')
      expect(s.hits).toBe(1)
      expect(s.strays).toBe(0)
    }
  })

  it('rejects ±(TOLERANCE + 1) as a stray', () => {
    // These are warm-up (stage 0) taps: strays/misses are classified and
    // counted for feedback, but cost no life in the no-fail sandbox.
    // Early side: the window has not opened yet, so the stray stands alone.
    const early = tap(advance(newGame(1), 48 - TOLERANCE - 1, R()), 'j')
    expect(early.strays).toBe(1)
    expect(early.hits).toBe(0)
    expect(early.misses).toBe(0)
    expect(early.lives).toBe(3)
    expect(early.events[0]).toEqual({ type: 'stray', key: 'j' })

    // Late side: due + TOLERANCE + 1 IS the closing tick, so the miss has
    // already fired. The stray then lands on top of it — both are counted,
    // but in warm-up neither takes a life.
    const late = tap(advance(newGame(1), 48 + TOLERANCE + 1, R()), 'j')
    expect(late.strays).toBe(1)
    expect(late.hits).toBe(0)
    expect(late.misses).toBe(1)
    expect(late.lives).toBe(3)
  })

  it('turns a second tap in the same window into a stray', () => {
    let s = advance(newGame(1), 48, R())
    s = tap(s, 'j')
    s = tap(s, 'j')
    expect(s.hits).toBe(1)
    expect(s.strays).toBe(1)
    expect(s.lives).toBe(3) // warm-up: no life lost
  })

  it('does not consume a slot on a stray — the beat still comes back as a miss', () => {
    let s = advance(newGame(1), 40, R()) // far from due 48
    s = tap(s, 'j')
    expect(s.strays).toBe(1)
    s = advance(s, 52, R()) // window for due 48 closes
    expect(s.misses).toBe(1) // the stray did not consume the beat
    expect(s.lives).toBe(3) // warm-up: neither the stray nor the miss costs a life
  })
})

describe('misses', () => {
  it('fires exactly when the window closes, not before', () => {
    const before = advance(newGame(1), 48 + TOLERANCE, R())
    expect(before.misses).toBe(0)
    expect(before.lives).toBe(3)
    const after = advance(before, 48 + TOLERANCE + 1, R())
    expect(after.misses).toBe(1)
    expect(after.lives).toBe(3) // warm-up: the miss is counted but costs no life
    expect(after.events).toContainEqual({ type: 'miss', key: 'j', dueTick: 48 })
  })
})

// -- 7. Game over ------------------------------------------------------------

describe('game over', () => {
  it('does not end the run on strays during warm-up (no-fail sandbox)', () => {
    let s = advance(newGame(1), 20, R())
    for (let i = 0; i < 5; i++) s = tap(s, 'j') // all strays, tick 20 far from due 48
    expect(s.strays).toBe(5)
    expect(s.lives).toBe(3)
    expect(s.over).toBe(false)
  })

  it('ends the run when lives run out AFTER warm-up (stage 1+)', () => {
    // Hit every warm-up beat (dueTick <= 192) to reach stage 1, then miss
    // everything. Regular stage-1 misses each dock a life until the run ends.
    const { state } = autoplay(1, 400, { skip: (sl) => sl.dueTick > 192 })
    expect(state.stage).toBeGreaterThanOrEqual(1)
    expect(state.over).toBe(true)
    expect(state.overReason).toBe('lives')
    expect(state.events).toContainEqual({ type: 'over', reason: 'lives' })
  })

  it('freezes the state — later taps and advances change nothing but events', () => {
    // Drive to a real game-over in stage 1, then confirm the state is frozen.
    const { state: s } = autoplay(1, 400, { skip: (sl) => sl.dueTick > 192 })
    expect(s.over).toBe(true)
    const frozen = { ...s, events: [] }
    expect({ ...tap(s, 'f'), events: [] }).toEqual(frozen)
    expect({ ...advance(s, 5000, R()), events: [] }).toEqual(frozen)
    expect(tap(s, 'f').events).toEqual([])
  })
})

// -- 8. Warm-up --------------------------------------------------------------

describe('warm-up (stage 0)', () => {
  it('forgives a dropped beat — no life lost, run continues', () => {
    const { state } = autoplay(1, 60, { skip: () => true })
    expect(state.over).toBe(false)
    expect(state.lives).toBe(3) // no-fail warm-up: the miss costs nothing
    expect(state.misses).toBe(1) // ...but it is still counted for feedback
  })

  it('does not credit warm-up cycles to cyclesCleared', () => {
    const { state } = autoplay(1, 60)
    expect(state.cyclesInStage).toBe(1)
    expect(state.cyclesCleared).toBe(0)
    expect(state.score).toBe(10) // one J hit, no confluence bonus
  })

  it('hands over to stage 1 after four cycles, still without touching the rng', () => {
    const { state } = autoplay(1, 200)
    expect(state.stage).toBe(1)
    expect(state.rngCalls).toBe(0)
    expect(state.clocks.map((c) => c.periodTicks)).toEqual([36, 48])
    expect(state.clocks.map((c) => c.key)).toEqual(['f', 'j'])
    expect(state.cycleTicks).toBe(144)
    expect(state.stageStartTick).toBe(192)
  })
})

// -- 9. Stage 1 --------------------------------------------------------------

describe('stage 1', () => {
  it('announces the joining clock and pays the stage bonus', () => {
    const rng = R()
    let s = newGame(1)
    const events = []
    for (let t = 1; t <= 200; t++) {
      s = advance(s, t, rng)
      events.push(...s.events)
      for (const sl of s.slots.filter((x) => !x.hit && x.dueTick === t)) s = tap(s, sl.key)
    }
    expect(events).toContainEqual({ type: 'clockJoin', key: 'f', periodBeats: 3 })
    expect(events).toContainEqual({ type: 'stageUp', stage: 1, periods: [3, 4], bpm: 100 })
    // 4 warm-up J hits (40) + stage bonus (250)
    expect(s.score).toBe(4 * 10 + STAGE_BONUS * 1)
  })

  it('lays a cycle out as four F slots, three J slots, and one shared collision', () => {
    const { seen } = autoplay(1, 345)
    const cycle = seen.filter((x) => x.dueTick > 192 && x.dueTick <= 336)
    expect(cycle.filter((x) => x.key === 'f').map((x) => x.dueTick)).toEqual([228, 264, 300, 336])
    expect(cycle.filter((x) => x.key === 'j').map((x) => x.dueTick)).toEqual([240, 288, 336])
    const conf = cycle.filter((x) => x.isConfluence)
    expect(conf).toHaveLength(2)
    expect(conf.every((x) => x.dueTick === 336)).toBe(true)
  })

  it('leaves no stale slot behind at the transition', () => {
    const { state } = autoplay(1, 200)
    expect(state.slots.every((x) => x.dueTick > state.stageStartTick)).toBe(true)
  })

  it('clears a confluence and pays the escalating bonus', () => {
    const { state } = autoplay(1, 345)
    expect(state.cyclesCleared).toBe(1)
    expect(state.locks).toBe(1)
    expect(state.bestSpread).toBe(0)
    const { seen } = autoplay(1, 345)
    expect(seen.length).toBeGreaterThan(0)
    // 4 warm-up hits + 250 stage bonus + 7 stage-1 hits + 100*1 + 50 lock
    expect(state.score).toBe(40 + 250 + 70 + CONFLUENCE_BASE * 1 + LOCK_BONUS)
  })

  it('kills the run on a dropped collision even with lives to spare', () => {
    const { state } = autoplay(1, 400, { skip: (s) => s.key === 'j' && s.isConfluence })
    expect(state.over).toBe(true)
    expect(state.overReason).toBe('confluence')
    expect(state.lives).toBe(2)
    expect(state.cyclesCleared).toBe(0)
  })
})

// -- 10. LOCK ----------------------------------------------------------------

describe('LOCK', () => {
  const at336 = (f: number, j: number) => (s: Slot) =>
    s.dueTick === 336 ? (s.key === 'f' ? f : j) : s.dueTick

  it('locks when the two keys land within SYNC_TICKS', () => {
    const { state } = autoplay(1, 345, { tapTick: at336(335, 337) }) // spread 2
    expect(state.locks).toBe(1)
    expect(state.bestSpread).toBe(2)
    expect(state.score).toBe(40 + 250 + 70 + CONFLUENCE_BASE * 1 + LOCK_BONUS)
  })

  it('does not lock at spread 3, and keeps bestSpread at the minimum', () => {
    const { state } = autoplay(1, 345, { tapTick: at336(334, 337) }) // spread 3
    expect(state.locks).toBe(0)
    expect(state.bestSpread).toBe(3)
    expect(state.score).toBe(40 + 250 + 70 + CONFLUENCE_BASE * 1)
    expect(state.cyclesCleared).toBe(1)
  })
})

// -- 11. Stage parameters ----------------------------------------------------

describe('stage parameters', () => {
  it('draws exactly one rng value on entering stage 2 and none before', () => {
    const early = autoplay(9, 700).state
    expect(early.stage).toBe(1)
    expect(early.rngCalls).toBe(0)
    const later = autoplay(9, 800).state
    expect(later.stage).toBe(2)
    expect(later.rngCalls).toBe(1)
  })

  it('never repeats the previous combo and is stable per seed', () => {
    for (const seed of [1, 2, 3, 12345]) {
      const rng = mulberry32(seed)
      const rng2 = mulberry32(seed)
      let prev: number[] = [3, 4]
      for (let stage = 2; stage < 30; stage++) {
        const next = comboForStage(stage, prev, rng)
        expect(next).toHaveLength(2)
        expect(next[0]).toBeLessThan(next[1])
        expect(next).not.toEqual(prev)
        expect(comboForStage(stage, prev, rng2)).toEqual(next)
        prev = next
      }
    }
  })

  it('cyclesPerStageFor keeps stages roughly equal length, always 2..4', () => {
    expect(cyclesPerStageFor(4)).toBe(4)
    expect(cyclesPerStageFor(12)).toBe(4)
    expect(cyclesPerStageFor(15)).toBe(3)
    expect(cyclesPerStageFor(20)).toBe(2)
    expect(cyclesPerStageFor(21)).toBe(2)
    expect(cyclesPerStageFor(28)).toBe(2)
    for (let b = 1; b <= 120; b++) {
      const n = cyclesPerStageFor(b)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(4)
    }
  })

  it('bpmForStage is monotone non-decreasing and capped', () => {
    let prev = 0
    for (let stage = 0; stage <= 40; stage++) {
      const bpm = bpmForStage(stage)
      expect(bpm).toBeGreaterThanOrEqual(prev)
      expect(bpm).toBeLessThanOrEqual(BPM_MAX)
      prev = bpm
    }
    expect(bpmForStage(0)).toBe(96)
    expect(bpmForStage(40)).toBe(BPM_MAX)
  })
})

// -- 12. Score / slot invariants ---------------------------------------------

describe('invariants', () => {
  it('keeps score a non-negative integer that never decreases (perfect play)', () => {
    const { scores } = autoplay(12345, 2000)
    let prev = -1
    for (const v of scores) {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('keeps score a non-negative integer that never decreases (sloppy play)', () => {
    const { scores } = autoplay(777, 2000, { skip: (s) => s.dueTick % 7 === 0 })
    let prev = -1
    for (const v of scores) {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('does not leak slots over a long run', () => {
    const { maxSlots, state } = autoplay(2024, 3000)
    expect(state.over).toBe(false)
    expect(maxSlots).toBeLessThanOrEqual(8)
  })

  it('never keeps a slot past its closing tick', () => {
    const rng = R()
    let s = newGame(11)
    for (let t = 1; t <= 1200; t++) {
      s = advance(s, t, rng)
      if (s.over) break
      for (const sl of s.slots) expect(sl.dueTick + TOLERANCE).toBeGreaterThanOrEqual(s.tick)
      for (const sl of s.slots.filter((x) => !x.hit && x.dueTick === t)) s = tap(s, sl.key)
    }
  })
})

// -- 13. Determinism contract ------------------------------------------------

describe('rng contract', () => {
  it('consumes no rng outside stage transitions', () => {
    // Stage 1 begins at 192; stage 2 not until 768. Nothing in between draws.
    const rng = R()
    let s = newGame(4)
    for (let t = 1; t <= 190; t++) {
      s = advance(s, t, rng)
      for (const sl of s.slots.filter((x) => !x.hit && x.dueTick === t)) s = tap(s, sl.key)
    }
    // Warm-up -> stage 1 also draws nothing.
    expect(() => {
      let g = s
      for (let t = 191; t <= 700; t++) {
        g = advance(g, t, NO_RNG)
        for (const sl of g.slots.filter((x) => !x.hit && x.dueTick === t)) g = tap(g, sl.key)
      }
      expect(g.stage).toBe(1)
    }).not.toThrow()
  })

  it('tap never touches the rng (it has no rng parameter at all)', () => {
    let s = advance(newGame(1), 48, NO_RNG)
    s = tap(s, 'j')
    s = tap(s, 'f')
    expect(s.hits).toBe(1)
    expect(s.strays).toBe(1)
  })
})

// -- 14. Goldens -------------------------------------------------------------

const GOLDEN_A = {
  score: 9430,
  cyclesCleared: 10,
  stage: 4,
  hits: 93,
  locks: 10,
  rngCalls: 3,
  bpm: 112,
}

describe('golden', () => {
  it('A — a perfect 2400-tick run is pinned', () => {
    const { state } = autoplay(12345, 2400)
    expect(state.over).toBe(false)
    expect(summary(state)).toEqual(GOLDEN_A)
  })

  it('A — the pinned score decomposes exactly as the scoring rules claim', () => {
    const { state } = autoplay(12345, 2400)
    // A perfect player is always dead-on, so every confluence LOCKs.
    expect(state.locks).toBe(state.cyclesCleared)
    expect(state.bestSpread).toBe(0)
    expect(state.strays + state.misses).toBe(0)

    const fromHits = state.hits * HIT_POINTS
    let fromStages = 0
    for (let st = 1; st <= state.stage; st++) fromStages += STAGE_BONUS * st
    let fromCycles = 0
    for (let i = 1; i <= state.cyclesCleared; i++) fromCycles += CONFLUENCE_BASE * i + LOCK_BONUS

    expect(fromHits).toBe(930)
    expect(fromStages).toBe(2500)
    expect(fromCycles).toBe(6000)
    expect(fromHits + fromStages + fromCycles).toBe(GOLDEN_A.score)
    expect(state.rngCalls).toBe(Math.max(0, state.stage - 1))
    expect(state.bpm).toBe(bpmForStage(state.stage))
  })

  it('B — the same script twice is byte-identical', () => {
    const a = autoplay(12345, 2400).state
    const b = autoplay(12345, 2400).state
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('C — replaying that script in random chunks lands on the same state', () => {
    const { script } = autoplay(12345, 2400)
    const chunked = replayChunked(12345, script, 2400, mulberry32(99))
    expect(summary(chunked)).toEqual(GOLDEN_A)
    expect(chunked.tick).toBe(2400)
  })

  it('D — the failure path is pinned too', () => {
    const { state } = autoplay(12345, 2400, {
      skip: (s) => s.key === 'j' && s.dueTick === 624, // 3rd confluence of stage 1
    })
    expect(state.over).toBe(true)
    expect(state.overReason).toBe('confluence')
    expect(state.cyclesCleared).toBe(2)
    // 40 warm-up + 250 stage + 140 (14 hits over cycles 1-2) + 400 (confluence
    // 1+2 with locks) + 60 (the six hits landed before the drop) = 890.
    expect(state.score).toBe(890)
    expect(state.lives).toBe(2) // sudden death, with lives still on the board
    expect(state.misses).toBe(1)
  })
})

// -- 15. Render helpers ------------------------------------------------------

describe('render helpers', () => {
  it('msPerTick tracks bpm', () => {
    expect(msPerTick(96)).toBeCloseTo(52.0833, 3)
    expect(msPerTick(120)).toBeCloseTo(41.6667, 3)
    expect(msPerTick(120) * TICKS_PER_BEAT * 120).toBeCloseTo(60000, 6)
  })

  it('nextConfluenceTick / cycleProgress / laneSlots read the live grid', () => {
    const { state } = autoplay(1, 250)
    expect(state.stage).toBe(1)
    expect(nextConfluenceTick(state)).toBe(336)
    expect(isConfluenceTick(state, 336)).toBe(true)
    expect(isBoundaryTick(state, 336)).toBe(true)
    expect(cycleProgress(state)).toEqual({ done: 0, total: 4 })
    expect(laneSlots(state, 'f').every((s) => s.key === 'f')).toBe(true)
  })

  it('boundary and confluence coincide once two clocks are live', () => {
    const { state } = autoplay(1, 250)
    for (let t = state.stageStartTick + 1; t <= state.stageStartTick + 600; t++) {
      expect(isBoundaryTick(state, t)).toBe(isConfluenceTick(state, t))
    }
  })
})

// -- 16. Source guard --------------------------------------------------------

describe('purity', () => {
  it('the engine source contains no ambient time or randomness', () => {
    const src = readFileSync(join(__dirname, 'engine.ts'), 'utf8')
    expect(/Math\.random/.test(src)).toBe(false)
    expect(/Date\.now/.test(src)).toBe(false)
    expect(/performance\.now/.test(src)).toBe(false)
    expect(/new Date/.test(src)).toBe(false)
  })
})
