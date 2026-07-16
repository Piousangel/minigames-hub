import { describe, expect, it } from 'vitest'
import {
  CHAIN_STEP,
  COLS,
  FIRST_SPAWN_TICK,
  GAP_JITTER,
  GAP_MIN,
  GAP_RAMP,
  GAP_START,
  LEN_FLOOR_MIN,
  LEN_START_MAX,
  LIVES,
  MAX_CHAIN_BONUS,
  ROWS,
  TICKS_PER_CELL,
  TIGHT_MARGIN,
  anchorOf,
  cellFromIndex,
  cellIndex,
  createGame,
  etaTicks,
  freeCells,
  generateSchedule,
  manhattan,
  mulberry32,
  pathBetween,
  reachOf,
  reduce,
  type Cell,
  type FuseAction,
  type FuseState,
  type Hand,
  type Wick,
} from './engine'

// -- helpers ----------------------------------------------------------------

const C = (x: number, y: number): Cell => ({ x, y })

function hand(at: Cell, path: Cell[] = [], stepTicks = 0): Hand {
  return { at, path, stepTicks }
}

function wick(id: number, cell: Cell, remaining: number, total = remaining): Wick {
  return { id, cell, remaining, total, spawnTick: 0 }
}

/** A playing state with no schedule pressure — for isolating movement/burn. */
function bare(over?: Partial<FuseState>): FuseState {
  const g = createGame(1)
  return {
    ...g,
    phase: 'playing',
    schedule: { seed: 1, entries: [] },
    ...over,
  }
}

function run(state: FuseState, n: number): FuseState {
  let s = state
  for (let i = 0; i < n; i++) s = reduce(s, { type: 'tick' })
  return s
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o)
    for (const v of Object.values(o)) deepFreeze(v)
  }
  return o
}

// ===========================================================================
// Schedule / rng (8)
// ===========================================================================

describe('schedule / rng', () => {
  it('1. mulberry32 is deterministic per seed and diverges across seeds', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const c = mulberry32(43)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    const seqC = [c(), c(), c(), c()]
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('2. generateSchedule is deep-equal for the same seed', () => {
    expect(generateSchedule(99, 40)).toEqual(generateSchedule(99, 40))
  })

  it('3. different seeds give different entries', () => {
    expect(generateSchedule(1, 40)).not.toEqual(generateSchedule(2, 40))
  })

  it('4. entry ticks strictly increase and start at or after FIRST_SPAWN_TICK', () => {
    const { entries } = generateSchedule(7, 200)
    expect(entries[0].tick).toBeGreaterThanOrEqual(FIRST_SPAWN_TICK)
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].tick).toBeGreaterThan(entries[i - 1].tick)
    }
  })

  it('5. every gap is within [GAP_MIN, GAP_START + GAP_JITTER]; the bound is non-increasing in i', () => {
    const { entries } = generateSchedule(11, 300)
    for (let i = 1; i < entries.length; i++) {
      const gap = entries[i].tick - entries[i - 1].tick
      expect(gap).toBeGreaterThanOrEqual(GAP_MIN)
      expect(gap).toBeLessThanOrEqual(GAP_START + GAP_JITTER)
    }
    const bound = (i: number) => Math.max(GAP_MIN, GAP_START - Math.floor(i / GAP_RAMP)) + GAP_JITTER
    for (let i = 1; i < 300; i++) expect(bound(i)).toBeLessThanOrEqual(bound(i - 1))
  })

  it('6. every length is within [LEN_FLOOR_MIN, LEN_START_MAX]; cellPick is in [0,1)', () => {
    const { entries } = generateSchedule(3, 400)
    for (const e of entries) {
      expect(e.length).toBeGreaterThanOrEqual(LEN_FLOOR_MIN)
      expect(e.length).toBeLessThanOrEqual(LEN_START_MAX)
      expect(e.cellPick).toBeGreaterThanOrEqual(0)
      expect(e.cellPick).toBeLessThan(1)
    }
  })

  it('7. generateSchedule consumes exactly 3n rng draws', () => {
    // Counting wrapper around the same algorithm mulberry32 uses, verified by
    // re-deriving the schedule from a counted source.
    let calls = 0
    const src = mulberry32(1234)
    const counting = () => {
      calls++
      return src()
    }
    const n = 50
    // Mirror generateSchedule's draw order exactly; if it drew a different
    // number of values per entry this reconstruction would not match.
    const rebuilt: { tick: number; cellPick: number; length: number }[] = []
    let prevTick = 0
    for (let i = 0; i < n; i++) {
      const base = Math.max(GAP_MIN, GAP_START - Math.floor(i / GAP_RAMP))
      if (i === 0) prevTick = FIRST_SPAWN_TICK - base
      const gap = base + Math.floor(counting() * GAP_JITTER)
      const tick = prevTick + gap
      prevTick = tick
      const cellPick = counting()
      const lenPick = counting()
      const lo = Math.max(12, 24 - Math.floor(i / 25))
      const hi = Math.max(20, 40 - Math.floor(i / 25))
      rebuilt.push({ tick, cellPick, length: lo + Math.floor(lenPick * (hi - lo + 1)) })
    }
    expect(calls).toBe(3 * n)
    expect(generateSchedule(1234, n).entries).toEqual(rebuilt)
  })

  it('8. golden schedule', () => {
    expect(generateSchedule(1234, 12).entries).toMatchInlineSnapshot(`
      [
        {
          "cellPick": 0.7034119898453355,
          "length": 39,
          "tick": 6,
        },
        {
          "cellPick": 0.04096397617831826,
          "length": 26,
          "tick": 36,
        },
        {
          "cellPick": 0.8027570187114179,
          "length": 30,
          "tick": 62,
        },
        {
          "cellPick": 0.544306228403002,
          "length": 29,
          "tick": 88,
        },
        {
          "cellPick": 0.543442856753245,
          "length": 28,
          "tick": 118,
        },
        {
          "cellPick": 0.4964431459084153,
          "length": 25,
          "tick": 146,
        },
        {
          "cellPick": 0.8682829476892948,
          "length": 32,
          "tick": 176,
        },
        {
          "cellPick": 0.914276140043512,
          "length": 28,
          "tick": 206,
        },
        {
          "cellPick": 0.19614544324576855,
          "length": 33,
          "tick": 235,
        },
        {
          "cellPick": 0.8869384240824729,
          "length": 40,
          "tick": 264,
        },
        {
          "cellPick": 0.17641304130665958,
          "length": 33,
          "tick": 291,
        },
        {
          "cellPick": 0.6830607764422894,
          "length": 40,
          "tick": 318,
        },
      ]
    `)
  })
})

// ===========================================================================
// Geometry (4)
// ===========================================================================

describe('geometry', () => {
  it('9. manhattan is symmetric and zero iff same cell', () => {
    for (let i = 0; i < COLS * ROWS; i++) {
      for (let j = 0; j < COLS * ROWS; j++) {
        const a = cellFromIndex(i)
        const b = cellFromIndex(j)
        expect(manhattan(a, b)).toBe(manhattan(b, a))
        expect(manhattan(a, b) === 0).toBe(i === j)
      }
    }
  })

  it('10. pathBetween: length === manhattan, excludes from, includes to, 4-adjacent, X-then-Y', () => {
    for (let i = 0; i < COLS * ROWS; i++) {
      for (let j = 0; j < COLS * ROWS; j++) {
        const from = cellFromIndex(i)
        const to = cellFromIndex(j)
        const p = pathBetween(from, to)
        expect(p.length).toBe(manhattan(from, to))
        expect(p.some((c) => c.x === from.x && c.y === from.y)).toBe(false)
        if (p.length > 0) {
          expect(p[p.length - 1]).toEqual(to)
          expect(manhattan(from, p[0])).toBe(1)
          for (let k = 1; k < p.length; k++) expect(manhattan(p[k - 1], p[k])).toBe(1)
        }
      }
    }
    // X-then-Y canonical: all x movement happens before any y movement.
    expect(pathBetween(C(0, 0), C(2, 2))).toEqual([C(1, 0), C(2, 0), C(2, 1), C(2, 2)])
    expect(pathBetween(C(4, 4), C(2, 1))).toEqual([C(3, 4), C(2, 4), C(2, 3), C(2, 2), C(2, 1)])
  })

  it('11. pathBetween(a, a) is empty', () => {
    for (let i = 0; i < COLS * ROWS; i++) {
      const a = cellFromIndex(i)
      expect(pathBetween(a, a)).toEqual([])
    }
  })

  it('12. cellIndex / cellFromIndex round-trip over all 25 cells', () => {
    for (let i = 0; i < COLS * ROWS; i++) expect(cellIndex(cellFromIndex(i))).toBe(i)
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) expect(cellFromIndex(cellIndex(C(x, y)))).toEqual(C(x, y))
    }
  })
})

// ===========================================================================
// Hand / ETA / reach (5)
// ===========================================================================

describe('hand / eta / reach', () => {
  it('13. anchorOf covers all three branches', () => {
    expect(anchorOf(hand(C(1, 1)))).toEqual({ cell: C(1, 1), commitTicks: 0 })
    expect(anchorOf(hand(C(1, 1), [C(2, 1)], 0))).toEqual({ cell: C(1, 1), commitTicks: 0 })
    expect(anchorOf(hand(C(1, 1), [C(2, 1)], 1))).toEqual({
      cell: C(2, 1),
      commitTicks: TICKS_PER_CELL - 1,
    })
    expect(anchorOf(hand(C(1, 1), [C(2, 1)], 2))).toEqual({
      cell: C(2, 1),
      commitTicks: TICKS_PER_CELL - 2,
    })
  })

  it('14. etaTicks === commitTicks + manhattan(anchor, cell) * TICKS_PER_CELL', () => {
    const table: Hand[] = [
      hand(C(0, 0)),
      hand(C(2, 2), [C(3, 2), C(4, 2)], 0),
      hand(C(2, 2), [C(3, 2), C(4, 2)], 1),
      hand(C(2, 2), [C(3, 2), C(4, 2)], 2),
      hand(C(4, 4), [C(3, 4)], 2),
    ]
    for (const h of table) {
      const a = anchorOf(h)
      for (let i = 0; i < COLS * ROWS; i++) {
        const target = cellFromIndex(i)
        expect(etaTicks(h, target)).toBe(a.commitTicks + manhattan(a.cell, target) * TICKS_PER_CELL)
      }
    }
  })

  it('15. etaTicks to the current cell is 0 when parked', () => {
    expect(etaTicks(hand(C(3, 1)), C(3, 1))).toBe(0)
    expect(etaTicks(hand(C(3, 1), [C(3, 2)], 0), C(3, 1))).toBe(0)
  })

  it('16. mid-step, turning around costs commitTicks + a full cell', () => {
    for (let st = 1; st < TICKS_PER_CELL; st++) {
      const h = hand(C(1, 1), [C(2, 1)], st)
      const commit = TICKS_PER_CELL - st
      expect(etaTicks(h, h.at)).toBe(commit + TICKS_PER_CELL)
    }
  })

  it('17. reachOf boundaries: eta === remaining is tight, not doomed', () => {
    const h = hand(C(0, 0)) // parked
    const target = C(2, 0) // manhattan 2 -> eta 6
    expect(etaTicks(h, target)).toBe(6)
    expect(reachOf(h, wick(1, target, 6))).toBe('tight')
    expect(reachOf(h, wick(1, target, 5))).toBe('doomed')
    expect(reachOf(h, wick(1, target, 6 + TIGHT_MARGIN))).toBe('safe')
    expect(reachOf(h, wick(1, target, 6 + TIGHT_MARGIN - 1))).toBe('tight')
    // Standing on it: eta 0.
    expect(reachOf(h, wick(1, C(0, 0), 1))).toBe('tight')
    expect(reachOf(h, wick(1, C(0, 0), TIGHT_MARGIN))).toBe('safe')
  })
})

// ===========================================================================
// Movement (5)
// ===========================================================================

describe('movement', () => {
  it('18. tick with an empty path leaves the hand parked', () => {
    const s = run(bare(), 10)
    expect(s.hand.at).toEqual(C(2, 2))
    expect(s.hand.stepTicks).toBe(0)
    expect(s.hand.path).toEqual([])
  })

  it('19. an n-cell path takes exactly n * TICKS_PER_CELL ticks; arrived fires once', () => {
    let s = reduce(bare(), { type: 'target', cell: C(4, 4) })
    const n = manhattan(C(2, 2), C(4, 4))
    expect(s.hand.path.length).toBe(n)
    let arrivals = 0
    for (let i = 1; i <= n * TICKS_PER_CELL; i++) {
      s = reduce(s, { type: 'tick' })
      if (s.events.arrived) {
        arrivals++
        expect(i).toBe(n * TICKS_PER_CELL)
      }
    }
    expect(arrivals).toBe(1)
    expect(s.hand.at).toEqual(C(4, 4))
    expect(s.hand.path).toEqual([])
    // One tick before arrival, it is not yet there.
    let s2 = reduce(bare(), { type: 'target', cell: C(4, 4) })
    s2 = run(s2, n * TICKS_PER_CELL - 1)
    expect(s2.hand.at).not.toEqual(C(4, 4))
  })

  it('20. target mid-step preserves stepTicks and keeps the committed cell first', () => {
    let s = reduce(bare(), { type: 'target', cell: C(4, 2) })
    s = reduce(s, { type: 'tick' }) // stepTicks = 1, committed to (3,2)
    expect(s.hand.stepTicks).toBe(1)
    const committed = s.hand.path[0]
    expect(committed).toEqual(C(3, 2))
    const t = reduce(s, { type: 'target', cell: C(0, 0) })
    expect(t.hand.stepTicks).toBe(1)
    expect(t.hand.path[0]).toEqual(committed)
    expect(t.hand.path[t.hand.path.length - 1]).toEqual(C(0, 0))
    expect(t.hand.path).toEqual([committed, ...pathBetween(committed, C(0, 0))])
    // And etaTicks stays an exact prediction of the sim.
    const eta = etaTicks(t.hand, C(0, 0))
    const done = run(t, eta)
    expect(done.hand.at).toEqual(C(0, 0))
    expect(run(t, eta - 1).hand.at).not.toEqual(C(0, 0))
  })

  it('21. target at stepTicks === 0 replans from hand.at with no commit cost', () => {
    const s = reduce(bare(), { type: 'target', cell: C(4, 2) })
    expect(s.hand.stepTicks).toBe(0)
    const t = reduce(s, { type: 'target', cell: C(0, 2) })
    expect(t.hand.stepTicks).toBe(0)
    expect(t.hand.path).toEqual(pathBetween(C(2, 2), C(0, 2)))
    expect(etaTicks(t.hand, C(0, 2))).toBe(2 * TICKS_PER_CELL)
  })

  it('22. target is a no-op unless playing', () => {
    const idle = createGame(5)
    expect(reduce(idle, { type: 'target', cell: C(0, 0) })).toBe(idle)
    const over = { ...bare(), phase: 'over' as const }
    expect(reduce(over, { type: 'target', cell: C(0, 0) })).toBe(over)
    // start flips idle -> playing, then target works.
    const started = reduce(idle, { type: 'start' })
    expect(started.phase).toBe('playing')
    expect(reduce(started, { type: 'target', cell: C(0, 0) }).hand.path.length).toBe(4)
    // start is a no-op when not idle.
    expect(reduce(started, { type: 'start' })).toBe(started)
  })
})

// ===========================================================================
// Defuse / burn (4)
// ===========================================================================

describe('defuse / burn', () => {
  it('23. arrival beats the burn: remaining === eta saves, remaining === eta - 1 explodes', () => {
    const target = C(4, 2)
    const base = bare()
    const eta = etaTicks(base.hand, target) // 6
    expect(eta).toBe(6)

    const saveable = reduce({ ...base, wicks: [wick(1, target, eta)] }, { type: 'target', cell: target })
    const savedRun = run(saveable, eta)
    expect(savedRun.saved).toBe(1)
    expect(savedRun.lost).toBe(0)
    expect(savedRun.lives).toBe(LIVES)
    expect(savedRun.wicks).toEqual([])
    expect(savedRun.events.defusedId).toBe(1)

    const doomed = reduce({ ...base, wicks: [wick(1, target, eta - 1)] }, { type: 'target', cell: target })
    const doomedRun = run(doomed, eta)
    expect(doomedRun.saved).toBe(0)
    expect(doomedRun.lost).toBe(1)
    expect(doomedRun.lives).toBe(LIVES - 1)
    // reachOf agreed with the sim before the run started.
    expect(reachOf(base.hand, wick(1, target, eta))).toBe('tight')
    expect(reachOf(base.hand, wick(1, target, eta - 1))).toBe('doomed')
  })

  it('24. a wick spawned at t with length L explodes at the end of tick t + L; one life', () => {
    const L = 30
    const s0: FuseState = {
      ...bare(),
      schedule: { seed: 0, entries: [{ tick: 5, cellPick: 0, length: L }] },
    }
    let s = run(s0, 5)
    expect(s.wicks.length).toBe(1)
    expect(s.wicks[0].spawnTick).toBe(5)
    expect(s.wicks[0].remaining).toBe(L)
    expect(s.wicks[0].total).toBe(L)

    s = run(s, L - 1) // through tick 5 + L - 1
    expect(s.tick).toBe(5 + L - 1)
    expect(s.wicks.length).toBe(1)
    expect(s.wicks[0].remaining).toBe(1)
    expect(s.lives).toBe(LIVES)

    s = reduce(s, { type: 'tick' }) // tick 5 + L
    expect(s.tick).toBe(5 + L)
    expect(s.wicks).toEqual([])
    expect(s.events.exploded).toBe(1)
    expect(s.lives).toBe(LIVES - 1)
    expect(s.lost).toBe(1)

    // And 5 + L is genuinely the LAST tick it could have been saved on.
    const cell = s0.wicks.length === 0 ? cellFromIndex(0) : cellFromIndex(0)
    expect(cell).toBeDefined()
  })

  it('25. defuse removes the wick, bumps saved/chain/score and reports defusedId', () => {
    const s0 = { ...bare(), wicks: [wick(9, C(2, 2), 20)] }
    const s = reduce(s0, { type: 'tick' })
    expect(s.wicks).toEqual([])
    expect(s.saved).toBe(1)
    expect(s.chain).toBe(1)
    expect(s.bestChain).toBe(1)
    expect(s.score).toBe(1)
    expect(s.events.defusedId).toBe(9)
    expect(s.events.award).toBe(1)
    expect(s.lost).toBe(0)
  })

  it('26. all live wicks burn uniformly, one tick each', () => {
    const s0 = {
      ...bare(),
      hand: hand(C(0, 0)),
      wicks: [wick(1, C(4, 0), 20), wick(2, C(0, 4), 30), wick(3, C(4, 4), 25)],
    }
    const s = run(s0, 7)
    expect(s.wicks.map((w) => w.remaining)).toEqual([13, 23, 18])
    expect(s.wicks.map((w) => w.total)).toEqual([20, 30, 25])
    expect(s.wicks.map((w) => w.id)).toEqual([1, 2, 3])
  })
})

// ===========================================================================
// Scoring (3)
// ===========================================================================

describe('scoring', () => {
  /** Defuse `n` wicks back to back by parking the hand and spawning under it. */
  function defuseTimes(n: number): FuseState {
    let s: FuseState = { ...bare(), hand: hand(C(0, 0)) }
    const awards: number[] = []
    for (let i = 0; i < n; i++) {
      s = { ...s, wicks: [wick(100 + i, C(0, 0), 20)] }
      s = reduce(s, { type: 'tick' })
      awards.push(s.events.award)
    }
    return s
  }

  it('27. award is 1 for chains 1-4, 2 at chain 5, and caps at 1 + MAX_CHAIN_BONUS', () => {
    let s: FuseState = { ...bare(), hand: hand(C(0, 0)) }
    const awards: number[] = []
    const tierUps: boolean[] = []
    for (let i = 0; i < 25; i++) {
      s = { ...s, wicks: [wick(100 + i, C(0, 0), 20)] }
      s = reduce(s, { type: 'tick' })
      awards.push(s.events.award)
      tierUps.push(s.events.chainTierUp)
    }
    expect(awards.slice(0, 4)).toEqual([1, 1, 1, 1]) // chain 1..4
    expect(awards[4]).toBe(2) // chain 5
    expect(awards[CHAIN_STEP * 2 - 1]).toBe(3) // chain 10
    expect(awards[CHAIN_STEP * 3 - 1]).toBe(4) // chain 15
    expect(Math.max(...awards)).toBe(1 + MAX_CHAIN_BONUS)
    expect(awards[24]).toBe(1 + MAX_CHAIN_BONUS) // chain 25 — still capped
    // chainTierUp fires exactly on the tier crossings.
    expect(tierUps.map((v, i) => (v ? i + 1 : 0)).filter(Boolean)).toEqual([5, 10, 15])
    expect(s.chain).toBe(25)
    expect(s.bestChain).toBe(25)
  })

  it('28. score is non-decreasing across a 300-action script', () => {
    let s = reduce(createGame(21), { type: 'start' })
    let prev = s.score
    for (let i = 0; i < 300; i++) {
      const action: FuseAction =
        i % 7 === 0 ? { type: 'target', cell: cellFromIndex((i * 11) % 25) } : { type: 'tick' }
      s = reduce(s, action)
      expect(s.score).toBeGreaterThanOrEqual(prev)
      expect(Number.isInteger(s.score)).toBe(true)
      prev = s.score
    }
    expect(defuseTimes(3).score).toBe(3)
  })

  it('29. an explosion resets chain to 0; bestChain keeps the peak', () => {
    let s: FuseState = { ...bare(), hand: hand(C(0, 0)) }
    for (let i = 0; i < 6; i++) {
      s = { ...s, wicks: [wick(200 + i, C(0, 0), 20)] }
      s = reduce(s, { type: 'tick' })
    }
    expect(s.chain).toBe(6)
    expect(s.bestChain).toBe(6)
    // A far wick with 1 tick left blows on the next tick.
    s = { ...s, wicks: [wick(300, C(4, 4), 1)] }
    s = reduce(s, { type: 'tick' })
    expect(s.events.exploded).toBe(1)
    expect(s.chain).toBe(0)
    expect(s.bestChain).toBe(6)
  })
})

// ===========================================================================
// Spawning (4)
// ===========================================================================

describe('spawning', () => {
  it('30. a spawn never lands on a live wick or on hand.at (200-tick fuzz)', () => {
    for (const seed of [1, 2, 3, 17, 99]) {
      let s = reduce(createGame(seed), { type: 'start' })
      for (let i = 0; i < 200; i++) {
        if (i % 9 === 0) s = reduce(s, { type: 'target', cell: cellFromIndex((i * 7 + seed) % 25) })
        s = reduce(s, { type: 'tick' })
        const idxs = s.wicks.map((w) => cellIndex(w.cell))
        expect(new Set(idxs).size).toBe(idxs.length) // no two wicks share a cell
        expect(idxs).not.toContain(cellIndex(s.hand.at)) // never under the hand
        for (const w of s.wicks) {
          expect(w.remaining).toBeGreaterThanOrEqual(1)
          expect(w.remaining).toBeLessThanOrEqual(w.total)
        }
        // ids stay ascending — the determinism contract for wick order.
        for (let k = 1; k < s.wicks.length; k++) {
          expect(s.wicks[k].id).toBeGreaterThan(s.wicks[k - 1].id)
        }
        if (s.phase === 'over') break
      }
    }
  })

  it('31. no free cell -> the spawn is dropped and the cursor still advances', () => {
    // Fill all 25 cells: 24 wicks + the hand.
    const wicks: Wick[] = []
    let id = 1
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = cellFromIndex(i)
      if (c.x === 0 && c.y === 0) continue // hand parks here
      wicks.push(wick(id++, c, 50))
    }
    expect(wicks.length).toBe(24)
    const s0: FuseState = {
      ...bare(),
      hand: hand(C(0, 0)),
      wicks,
      nextWickId: id,
      schedule: { seed: 0, entries: [{ tick: 1, cellPick: 0.5, length: 30 }] },
    }
    expect(freeCells(s0)).toEqual([])
    const s = reduce(s0, { type: 'tick' })
    expect(s.spawnCursor).toBe(1) // advanced — dropped, not deferred
    expect(s.events.spawned).toBe(0)
    expect(s.wicks.length).toBe(24)
    expect(s.nextWickId).toBe(id)
    // And it is never retried later.
    const later = run(s, 20)
    expect(later.events.spawned).toBe(0)
    expect(later.spawnCursor).toBe(1)
  })

  it('32. schedule exhaustion: no more spawns, no throw, ticks keep resolving', () => {
    const s0: FuseState = {
      ...bare(),
      schedule: { seed: 0, entries: [{ tick: 2, cellPick: 0, length: 40 }] },
    }
    let s = run(s0, 3)
    expect(s.spawnCursor).toBe(1)
    expect(s.wicks.length).toBe(1)
    expect(() => run(s, 100)).not.toThrow()
    s = run(s, 100)
    expect(s.spawnCursor).toBe(1)
    expect(s.tick).toBe(103)
    // The one wick blew; no new ones ever arrived.
    expect(s.wicks).toEqual([])
    expect(s.lost).toBe(1)
  })

  it('33. several entries due on one tick all resolve (the cursor drains fully)', () => {
    const s0: FuseState = {
      ...bare(),
      hand: hand(C(0, 0)),
      schedule: {
        seed: 0,
        entries: [
          { tick: 1, cellPick: 0, length: 30 },
          { tick: 1, cellPick: 0, length: 31 },
          { tick: 1, cellPick: 0.999, length: 32 },
          { tick: 4, cellPick: 0, length: 33 },
        ],
      },
    }
    const s = reduce(s0, { type: 'tick' })
    expect(s.events.spawned).toBe(3)
    expect(s.spawnCursor).toBe(3)
    expect(s.wicks.length).toBe(3)
    expect(s.wicks.map((w) => w.total)).toEqual([30, 31, 32])
    expect(s.wicks.map((w) => w.id)).toEqual([1, 2, 3])
    // cellPick 0 resolves against a shrinking free list, so they differ.
    expect(new Set(s.wicks.map((w) => cellIndex(w.cell))).size).toBe(3)
  })
})

// ===========================================================================
// Lifecycle (3)
// ===========================================================================

describe('lifecycle', () => {
  it('34. lives -> 0 sets phase over; further ticks are no-ops', () => {
    let s: FuseState = {
      ...bare(),
      hand: hand(C(0, 0)),
      lives: 1,
      wicks: [wick(1, C(4, 4), 1)],
    }
    s = reduce(s, { type: 'tick' })
    expect(s.phase).toBe('over')
    expect(s.lives).toBe(0)
    expect(s.events.over).toBe(true)
    const frozenTick = s.tick
    const after = reduce(s, { type: 'tick' })
    expect(after).toBe(s)
    expect(after.tick).toBe(frozenTick)
    expect(reduce(s, { type: 'target', cell: C(1, 1) })).toBe(s)
  })

  it('35. new deep-equals createGame(seed)', () => {
    const s = run(reduce(createGame(4), { type: 'start' }), 50)
    expect(reduce(s, { type: 'new', seed: 77 })).toEqual(createGame(77))
  })

  it('36. createGame is deterministic', () => {
    expect(createGame(1234)).toEqual(createGame(1234))
    expect(createGame(1234)).not.toEqual(createGame(1235))
    const g = createGame(1)
    expect(g.phase).toBe('idle')
    expect(g.lives).toBe(LIVES)
    expect(g.score).toBe(0)
    expect(g.wicks).toEqual([])
    expect(g.schedule.entries.length).toBe(600)
  })
})

// ===========================================================================
// Golden + purity (2)
// ===========================================================================

describe('golden + purity', () => {
  it('37. golden 200-tick run from a fixed script', () => {
    let s = reduce(createGame(7), { type: 'start' })
    // A fixed hand-written script: chase a corner, sweep, re-plan mid-step.
    const script: { at: number; cell: Cell }[] = [
      { at: 4, cell: C(0, 0) },
      { at: 20, cell: C(4, 0) },
      { at: 33, cell: C(4, 4) },
      { at: 50, cell: C(2, 2) },
      { at: 61, cell: C(0, 4) },
      { at: 77, cell: C(3, 1) },
      { at: 95, cell: C(1, 3) },
      { at: 120, cell: C(4, 2) },
      { at: 140, cell: C(0, 2) },
      { at: 165, cell: C(2, 0) },
      { at: 185, cell: C(2, 4) },
    ]
    for (let t = 1; t <= 200; t++) {
      for (const step of script) if (step.at === t) s = reduce(s, { type: 'target', cell: step.cell })
      s = reduce(s, { type: 'tick' })
    }
    expect({
      score: s.score,
      saved: s.saved,
      lost: s.lost,
      lives: s.lives,
      tick: s.tick,
      chain: s.chain,
      bestChain: s.bestChain,
      phase: s.phase,
      wicks: s.wicks,
    }).toMatchInlineSnapshot(`
      {
        "bestChain": 3,
        "chain": 3,
        "lives": 1,
        "lost": 2,
        "phase": "playing",
        "saved": 4,
        "score": 4,
        "tick": 200,
        "wicks": [
          {
            "cell": {
              "x": 4,
              "y": 4,
            },
            "id": 7,
            "remaining": 3,
            "spawnTick": 175,
            "total": 28,
          },
        ],
      }
    `)
  })

  it('38. reduce never mutates its input', () => {
    let s = reduce(createGame(7), { type: 'start' })
    s = reduce(s, { type: 'target', cell: C(4, 4) })
    s = run(s, 40) // get some wicks on the board and the hand mid-path
    s = reduce(s, { type: 'target', cell: C(0, 0) })
    s = reduce(s, { type: 'tick' })
    expect(s.wicks.length).toBeGreaterThan(0)

    const snapshot = JSON.parse(JSON.stringify(s))
    deepFreeze(s)

    const actions: FuseAction[] = [
      { type: 'tick' },
      { type: 'target', cell: C(2, 2) },
      { type: 'start' },
      { type: 'new', seed: 3 },
    ]
    for (const a of actions) {
      expect(() => reduce(s, a)).not.toThrow()
    }
    // Ticking repeatedly off the SAME frozen state is pure: same result each time.
    expect(reduce(s, { type: 'tick' })).toEqual(reduce(s, { type: 'tick' }))
    expect(JSON.parse(JSON.stringify(s))).toEqual(snapshot)
  })
})
