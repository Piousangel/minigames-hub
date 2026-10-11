import { describe, expect, it } from 'vitest'
import {
  CLUTCH_BONUS,
  MAX_SEATS,
  ROUND_CLEAR_BONUS,
  SCORE_PER_ELIMINATION,
  START_SEATS,
  WINDOW_MIN,
  WINDOW_RAMP_EVERY,
  WINDOW_RAMP_STEP,
  WINDOW_START,
  armWindow,
  computeWindowTicks,
  createGame,
  generateSchedule,
  isDanger,
  mulberry32,
  nextSeatCount,
  reduce,
  resolveK,
  startIdx,
  type CountcircleState,
} from './engine'

// -- helpers ----------------------------------------------------------------

/** A 'playing' state with a real schedule, ready to be overridden per-test. */
function bare(over: Partial<CountcircleState> = {}): CountcircleState {
  const g = createGame(1)
  const started = reduce(g, { type: 'start' })
  return { ...started, ...over }
}

// -- 1. mulberry32 -----------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).toEqual(seqB)
  })
})

// -- 2. generateSchedule ------------------------------------------------------

describe('generateSchedule', () => {
  it('produces exactly `count` entries, all picks in [0,1)', () => {
    const sch = generateSchedule(7, 500)
    expect(sch.entries.length).toBe(500)
    for (const e of sch.entries) {
      expect(e.pick).toBeGreaterThanOrEqual(0)
      expect(e.pick).toBeLessThan(1)
    }
  })
})

// -- 3/4. resolveK -------------------------------------------------------------

describe('resolveK', () => {
  it('pick=0 maps to K=1', () => {
    expect(resolveK(0, 8)).toBe(1)
    expect(resolveK(0, 2)).toBe(1)
    expect(resolveK(0, 50)).toBe(1)
  })

  it('pick near 1 maps to K = n-1', () => {
    for (const n of [3, 5, 8, 20]) {
      expect(resolveK(0.999999, n)).toBe(n - 1)
    }
  })

  it('result always stays within [1, n-1] across a pick sweep', () => {
    for (const n of [2, 3, 4, 8, 15, 60]) {
      for (let i = 0; i < 100; i++) {
        const pick = i / 100
        const k = resolveK(pick, n)
        expect(k).toBeGreaterThanOrEqual(1)
        expect(k).toBeLessThanOrEqual(Math.max(1, n - 1))
      }
    }
  })

  it('degenerate n=2 always resolves to K=1', () => {
    for (const pick of [0, 0.1, 0.5, 0.9, 0.999]) {
      expect(resolveK(pick, 2)).toBe(1)
    }
  })
})

// -- 5/6/7. computeWindowTicks -------------------------------------------------

describe('computeWindowTicks', () => {
  it('starts at WINDOW_START with zero eliminations', () => {
    expect(computeWindowTicks(0)).toBe(WINDOW_START)
  })

  it('drops by WINDOW_RAMP_STEP after WINDOW_RAMP_EVERY eliminations', () => {
    expect(computeWindowTicks(WINDOW_RAMP_EVERY)).toBe(WINDOW_START - WINDOW_RAMP_STEP)
  })

  it('clamps at WINDOW_MIN for very large eliminations', () => {
    expect(computeWindowTicks(1_000_000)).toBe(WINDOW_MIN)
  })

  it('is monotonically non-increasing', () => {
    let prev = computeWindowTicks(0)
    for (let e = 1; e <= 200; e++) {
      const cur = computeWindowTicks(e)
      expect(cur).toBeLessThanOrEqual(prev)
      prev = cur
    }
  })
})

// -- 8. nextSeatCount -----------------------------------------------------------

describe('nextSeatCount', () => {
  it('round 1 starts at START_SEATS', () => {
    expect(nextSeatCount(1)).toBe(START_SEATS)
  })

  it('is non-decreasing in round index', () => {
    let prev = nextSeatCount(1)
    for (let r = 2; r <= 40; r++) {
      const cur = nextSeatCount(r)
      expect(cur).toBeGreaterThanOrEqual(prev)
      prev = cur
    }
  })

  it('clamps at MAX_SEATS for large round indices', () => {
    expect(nextSeatCount(10_000)).toBe(MAX_SEATS)
  })
})

// -- 9. startIdx ------------------------------------------------------------

describe('startIdx', () => {
  it('is always within [0, seats) for even and odd seat counts', () => {
    for (const seats of [2, 3, 8, 9, 11, 60]) {
      const idx = startIdx(seats)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(seats)
    }
  })
})

// -- 10. createGame -----------------------------------------------------------

describe('createGame', () => {
  it('produces the documented initial shape', () => {
    const g = createGame(99)
    expect(g.phase).toBe('idle')
    expect(g.round).toBe(1)
    expect(g.seats).toBe(START_SEATS)
    expect(g.survivors).toEqual(Array.from({ length: START_SEATS }, (_, i) => i))
    expect(g.playerIdx).toBe(startIdx(START_SEATS))
    expect(g.score).toBe(0)
    expect(g.eliminations).toBe(0)
    expect(g.roundsCleared).toBe(0)
    expect(g.cursor).toBe(0)
  })
})

// -- 11. reduce: start --------------------------------------------------------

describe("reduce 'start'", () => {
  it('arms the first window exactly as armWindow would', () => {
    const g = createGame(2024)
    const next = reduce(g, { type: 'start' })
    const armed = armWindow(g.survivors, g.playerIdx, g.count, g.schedule, g.cursor, g.eliminations)
    expect(next.phase).toBe('playing')
    expect(next.target).toBe(armed.target)
    expect(next.k).toBe(armed.k)
    expect(next.windowTicks).toBe(armed.windowTicks)
    expect(next.dangerAtStart).toBe(next.target === next.playerIdx)
  })
})

// -- 12. reduce: tick, non-final ----------------------------------------------

describe("reduce 'tick' (waiting)", () => {
  it('only decrements windowTicks when windowTicks > 1', () => {
    const s = bare({ windowTicks: 5 })
    const next = reduce(s, { type: 'tick' })
    expect(next.windowTicks).toBe(4)
    expect(next.survivors).toEqual(s.survivors)
    expect(next.playerIdx).toBe(s.playerIdx)
    expect(next.score).toBe(s.score)
    expect(next.target).toBe(s.target)
    expect(next.events.resolved).toBe(false)
  })
})

// -- 13/14. non-fatal resolution goldens --------------------------------------

describe("reduce 'tick' (non-fatal resolution)", () => {
  it('golden A: target < playerIdx shifts playerIdx down by one', () => {
    const survivors = [0, 1, 2, 3, 4, 5, 6, 7]
    const s = bare({
      survivors,
      playerIdx: 5,
      target: 2,
      windowTicks: 1,
      dangerAtStart: false,
      eliminations: 0,
      score: 0,
    })
    const next = reduce(s, { type: 'tick' })

    expect(next.events.resolved).toBe(true)
    expect(next.events.eliminatedSeat).toBe(2)
    expect(next.events.wasPlayer).toBe(false)
    expect(next.survivors).toEqual([0, 1, 3, 4, 5, 6, 7])
    expect(next.survivors.length).toBe(survivors.length - 1)
    expect(next.playerIdx).toBe(4) // shifted down by one
    expect(next.survivors[next.playerIdx]).toBe(5) // still the same seat
    expect(next.count).toBe(2 % next.survivors.length)
    expect(next.score).toBe(SCORE_PER_ELIMINATION)
    expect(next.eliminations).toBe(1)

    // a fresh window has been armed from the next schedule entry
    const armed = armWindow(next.survivors, next.playerIdx, next.count, s.schedule, s.cursor, next.eliminations)
    expect(next.target).toBe(armed.target)
    expect(next.k).toBe(armed.k)
    expect(next.windowTicks).toBe(armed.windowTicks)
  })

  it('golden B: target > playerIdx leaves playerIdx unchanged', () => {
    const survivors = [0, 1, 2, 3, 4, 5, 6, 7]
    const s = bare({
      survivors,
      playerIdx: 2,
      target: 5,
      windowTicks: 1,
      dangerAtStart: false,
      eliminations: 0,
      score: 0,
    })
    const next = reduce(s, { type: 'tick' })

    expect(next.events.resolved).toBe(true)
    expect(next.events.eliminatedSeat).toBe(5)
    expect(next.events.wasPlayer).toBe(false)
    expect(next.survivors).toEqual([0, 1, 2, 3, 4, 6, 7])
    expect(next.playerIdx).toBe(2) // unaffected — target was after the player
    expect(next.survivors[next.playerIdx]).toBe(2)
    expect(next.count).toBe(5 % next.survivors.length)
    expect(next.score).toBe(SCORE_PER_ELIMINATION)
    expect(next.eliminations).toBe(1)
  })
})

// -- 15. clutch golden ----------------------------------------------------------

describe('clutch escape', () => {
  it('a move out of the targeted seat before resolution awards CLUTCH_BONUS', () => {
    const survivors = [0, 1, 2, 3, 4, 5, 6, 7]
    let s = bare({
      survivors,
      playerIdx: 3,
      target: 3, // player IS the target at window open
      windowTicks: 3,
      dangerAtStart: true,
      eliminations: 0,
      score: 0,
    })
    expect(isDanger(s)).toBe(true)

    s = reduce(s, { type: 'move', dir: 'right' }) // escape to seat 4
    expect(s.playerIdx).toBe(4)
    expect(s.target).toBe(3) // target index is fixed for the window
    expect(s.dangerAtStart).toBe(true) // unaffected by move

    s = reduce(s, { type: 'tick' }) // windowTicks 3 -> 2
    s = reduce(s, { type: 'tick' }) // windowTicks 2 -> 1
    const next = reduce(s, { type: 'tick' }) // windowTicks 1 -> resolve

    expect(next.events.resolved).toBe(true)
    expect(next.events.wasPlayer).toBe(false)
    expect(next.events.clutch).toBe(true)
    expect(next.score).toBe(SCORE_PER_ELIMINATION + CLUTCH_BONUS)
  })
})

// -- 16. death golden -------------------------------------------------------

describe('death', () => {
  it('resolving with the player still on the target seat ends the run', () => {
    const survivors = [0, 1, 2, 3, 4, 5, 6, 7]
    const s = bare({
      survivors,
      playerIdx: 3,
      target: 3,
      windowTicks: 1,
      dangerAtStart: true,
      eliminations: 0,
      score: 40,
    })
    const next = reduce(s, { type: 'tick' })

    expect(next.phase).toBe('over')
    expect(next.events.over).toBe(true)
    expect(next.events.wasPlayer).toBe(true)
    expect(next.score).toBe(40) // unchanged — fatal resolution never scores
    expect(next.eliminations).toBe(1)
  })
})

// -- 17. round clear golden ---------------------------------------------------

describe('round clear', () => {
  it('eliminating the last non-player seat clears the round in the same tick', () => {
    const s = bare({
      survivors: [3, 7],
      playerIdx: 0, // seat 3
      target: 1, // seat 7, non-player
      windowTicks: 1,
      dangerAtStart: false,
      eliminations: 0,
      score: 0,
      round: 1,
      roundsCleared: 0,
      seats: 2,
    })
    const next = reduce(s, { type: 'tick' })

    expect(next.events.resolved).toBe(true)
    expect(next.events.roundClear).toBe(true)
    expect(next.phase).toBe('playing') // still alive, no death
    expect(next.round).toBe(2)
    expect(next.roundsCleared).toBe(1)
    expect(next.seats).toBe(nextSeatCount(2))
    expect(next.survivors).toEqual(Array.from({ length: nextSeatCount(2) }, (_, i) => i))
    expect(next.playerIdx).toBe(startIdx(nextSeatCount(2)))
    expect(next.score).toBe(SCORE_PER_ELIMINATION + ROUND_CLEAR_BONUS)
    // a new window is already armed — not waiting on another tick
    expect(next.windowTicks).toBeGreaterThan(0)
  })
})

// -- 18/19. move mechanics ------------------------------------------------------

describe("reduce 'move'", () => {
  // Audit 2026-10-10 (engine.ts:262): move used to swap seat ids inside
  // survivors[], but the renderer draws each seat id at a FIXED angle — so the
  // player ring never moved and the target ring / neighbor buttons jumped to the
  // wrong seats. Seat ids are physical seats: a move only changes playerIdx.
  it('moves the player into the left neighbor seat (survivors = fixed physical seats)', () => {
    const survivors = [10, 11, 12, 13, 14]
    const s = bare({ survivors, playerIdx: 2, target: 4, k: 2, windowTicks: 5, dangerAtStart: false })
    const next = reduce(s, { type: 'move', dir: 'left' })
    expect(next.survivors).toEqual([10, 11, 12, 13, 14]) // seats never reorder
    expect(next.survivors[next.playerIdx]).toBe(11) // player now sits in seat 11
    expect(next.survivors[next.target]).toBe(14) // the targeted seat is unchanged
    expect(next.playerIdx).toBe(1)
    expect(next.events.moved).toBe(true)
    // window fields untouched
    expect(next.target).toBe(4)
    expect(next.k).toBe(2)
    expect(next.windowTicks).toBe(5)
    expect(next.dangerAtStart).toBe(false)
  })

  it('moves the player into the right neighbor seat', () => {
    const survivors = [10, 11, 12, 13, 14]
    const s = bare({ survivors, playerIdx: 2, target: 4, k: 2, windowTicks: 5, dangerAtStart: false })
    const next = reduce(s, { type: 'move', dir: 'right' })
    expect(next.survivors).toEqual(survivors)
    expect(next.survivors[next.playerIdx]).toBe(13)
    expect(next.playerIdx).toBe(3)
  })

  it('two moves right put the player two physical seats over (and the seat ids stay sorted)', () => {
    const survivors = [0, 1, 2, 3, 4, 5, 6, 7]
    let s = bare({ survivors, playerIdx: 4, target: 0, k: 1, windowTicks: 9 })
    s = reduce(s, { type: 'move', dir: 'right' })
    s = reduce(s, { type: 'move', dir: 'right' })
    expect(s.survivors[s.playerIdx]).toBe(6)
    // Neighbors of the player's seat are the physically adjacent seats.
    const n = s.survivors.length
    expect(s.survivors[(s.playerIdx - 1 + n) % n]).toBe(5)
    expect(s.survivors[(s.playerIdx + 1) % n]).toBe(7)
  })

  it('wraps around the circle at both boundaries', () => {
    const survivors = [10, 11, 12, 13, 14]
    const atStart = bare({ survivors, playerIdx: 0 })
    const leftFromStart = reduce(atStart, { type: 'move', dir: 'left' })
    expect(leftFromStart.playerIdx).toBe(survivors.length - 1)

    const atEnd = bare({ survivors, playerIdx: survivors.length - 1 })
    const rightFromEnd = reduce(atEnd, { type: 'move', dir: 'right' })
    expect(rightFromEnd.playerIdx).toBe(0)
  })

  it('is rejected outside "playing" and leaves state untouched', () => {
    const idle = createGame(5)
    const rejectedIdle = reduce(idle, { type: 'move', dir: 'left' })
    expect(rejectedIdle.survivors).toEqual(idle.survivors)
    expect(rejectedIdle.playerIdx).toBe(idle.playerIdx)
    expect(rejectedIdle.events.illegal).toBe(true)

    const over = { ...bare(), phase: 'over' as const }
    const rejectedOver = reduce(over, { type: 'move', dir: 'right' })
    expect(rejectedOver.survivors).toEqual(over.survivors)
    expect(rejectedOver.events.illegal).toBe(true)
  })
})

// -- 21. tick rejection ---------------------------------------------------------

describe("reduce 'tick' rejection", () => {
  it('is a no-op outside "playing"', () => {
    const idle = createGame(5)
    const rejectedIdle = reduce(idle, { type: 'tick' })
    expect(rejectedIdle).toEqual({ ...idle, events: rejectedIdle.events })
    expect(rejectedIdle.events.resolved).toBe(false)
    expect(rejectedIdle.events.moved).toBe(false)
    expect(rejectedIdle.events.illegal).toBe(false)

    const over = { ...bare(), phase: 'over' as const }
    const rejectedOver = reduce(over, { type: 'tick' })
    expect(rejectedOver.survivors).toEqual(over.survivors)
    expect(rejectedOver.windowTicks).toBe(over.windowTicks)
  })
})

// -- 22. new === createGame ------------------------------------------------------

describe("reduce 'new'", () => {
  it('is deep-equal to createGame(seed)', () => {
    const viaReduce = reduce(bare(), { type: 'new', seed: 777 })
    const viaCreate = createGame(777)
    expect(viaReduce).toEqual(viaCreate)
  })
})

// -- 23. full-run determinism golden ---------------------------------------------

describe('deterministic full-run golden', () => {
  it('replays a fixed seed + scripted action sequence to a hardcoded outcome', () => {
    // Script: always dodge the moment the player becomes the target, otherwise
    // just let ticks run. This produces a long-lived, reproducible run that
    // exercises ordinary eliminations, clutches, and at least one round clear.
    let s = createGame(4242)
    s = reduce(s, { type: 'start' })

    for (let step = 0; step < 400 && s.phase === 'playing'; step++) {
      if (isDanger(s)) {
        s = reduce(s, { type: 'move', dir: 'right' })
      }
      s = reduce(s, { type: 'tick' })
    }

    // Values below were captured from one real run of the engine above (see
    // the commit that introduced this test) — this is a regression pin, not a
    // hand-derived expectation.
    expect(s.phase).toBe('playing')
    expect(s.score).toBe(695)
    expect(s.eliminations).toBe(32)
    expect(s.round).toBe(4)
    expect(s.roundsCleared).toBe(3)
    expect(s.survivors.length).toBe(15)
    expect(s.playerIdx).toBe(7)
  })
})

// -- 24. invariant fuzz -----------------------------------------------------------

describe('invariant fuzzing', () => {
  it('holds core invariants across a long randomized (but fixed-seed) action script', () => {
    const localRng = mulberry32(999)
    let s = createGame(31415)
    s = reduce(s, { type: 'start' })
    let maxScore = 0

    for (let i = 0; i < 800; i++) {
      if (s.phase !== 'playing') break
      const roll = localRng()
      if (roll < 0.5) {
        s = reduce(s, { type: 'move', dir: roll < 0.25 ? 'left' : 'right' })
      } else {
        s = reduce(s, { type: 'tick' })
      }

      expect(s.playerIdx).toBeGreaterThanOrEqual(0)
      expect(s.playerIdx).toBeLessThan(s.survivors.length)
      expect(s.survivors[s.playerIdx]).toBeDefined()
      // Seat ids are physical seats in circle order: always strictly ascending.
      for (let j = 1; j < s.survivors.length; j++) expect(s.survivors[j]).toBeGreaterThan(s.survivors[j - 1])
      expect(s.score).toBeGreaterThanOrEqual(maxScore)
      maxScore = s.score
      expect(s.round).toBe(s.roundsCleared + 1)
    }
  })
})

// -- bonus: armWindow cursor overflow fallback -----------------------------------

describe('armWindow cursor overflow', () => {
  it('reuses the last schedule entry instead of crashing when the cursor overruns', () => {
    const schedule = generateSchedule(1, 3)
    const survivors = [0, 1, 2, 3]
    const farCursor = 999
    expect(() => armWindow(survivors, 0, 0, schedule, farCursor, 0)).not.toThrow()
    const armed = armWindow(survivors, 0, 0, schedule, farCursor, 0)
    const lastEntryArmed = armWindow(survivors, 0, 0, schedule, schedule.entries.length - 1, 0)
    expect(armed.target).toBe(lastEntryArmed.target)
    expect(armed.k).toBe(lastEntryArmed.k)
  })
})
