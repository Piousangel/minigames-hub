import { describe, expect, it } from 'vitest'
import {
  COMBO_BASE,
  DIFFICULTIES,
  HAND_SIZE,
  MATCH_BASE,
  type CarouselConfig,
  type CarouselState,
  type Color,
  type Slot,
  applyMatch,
  colorFromRng,
  createGame,
  emptyRing,
  matchRun,
  mulberry32,
  nextColor,
  occupiedCount,
  place,
  reduce,
  splitSeed,
} from './engine'

const CFG: CarouselConfig = DIFFICULTIES.normal

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** Hand-build a state for place()/reduce() tests (bypasses generation). */
function stateWith(overrides: Partial<CarouselState> = {}): CarouselState {
  const config = overrides.config ?? { ...CFG, ringSize: 6, rotateStep: 1, colors: 5 }
  return {
    config,
    seed: 1,
    ring: emptyRing(config.ringSize),
    loaderPos: 0,
    hand: [1, 2, 3],
    rngCursor: HAND_SIZE,
    score: 0,
    placements: 0,
    cleared: 0,
    comboStreak: 0,
    longestRun: 0,
    gameOver: false,
    lastEvent: 'none',
    lastPlacement: null,
    ...overrides,
  }
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('colorFromRng / nextColor / splitSeed', () => {
  it('colorFromRng always returns 1..colors across a spread of rng values', () => {
    const samples = [0, 0.0001, 0.25, 0.4999, 0.5, 0.75, 0.999999]
    for (const colors of [1, 2, 4, 6]) {
      for (const v of samples) {
        const c = colorFromRng(() => v, colors)
        expect(c).toBeGreaterThanOrEqual(1)
        expect(c).toBeLessThanOrEqual(colors)
      }
    }
  })

  it('nextColor stays in range 1..colors for cursor 0..99 (property)', () => {
    for (let i = 0; i < 100; i++) {
      const c = nextColor(777, i, 5)
      expect(c).toBeGreaterThanOrEqual(1)
      expect(c).toBeLessThanOrEqual(5)
    }
  })

  it('nextColor is pure: same (seed, cursor) always yields the same color', () => {
    expect(nextColor(42, 7, 5)).toBe(nextColor(42, 7, 5))
    expect(nextColor(999, 3, 6)).toBe(nextColor(999, 3, 6))
  })

  it('different cursors produce a non-constant sequence (sanity)', () => {
    const seq = Array.from({ length: 20 }, (_, i) => nextColor(1234, i, 5))
    const distinct = new Set(seq)
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('splitSeed mixes seed and cursor deterministically', () => {
    expect(splitSeed(1, 0)).toBe(splitSeed(1, 0))
    expect(splitSeed(1, 0)).not.toBe(splitSeed(1, 1))
  })
})

describe('matchRun', () => {
  it('single unmatched marble returns just itself', () => {
    const ring: Slot[] = [1, 2, 3, 4]
    expect(matchRun(ring, 0)).toEqual([0])
  })

  it('exactly 3 in a row', () => {
    const ring: Slot[] = [9, 5, 5, 5, 8]
    expect(matchRun(ring, 2)).toEqual([1, 2, 3])
  })

  it('4 and 5 in a row match precisely', () => {
    const ring4: Slot[] = [9, 5, 5, 5, 5, 8]
    expect(matchRun(ring4, 3)).toEqual([1, 2, 3, 4])
    const ring5: Slot[] = [5, 5, 5, 5, 5, 8]
    expect(matchRun(ring5, 2)).toEqual([0, 1, 2, 3, 4])
  })

  it('wraps across the array boundary', () => {
    const ring: Slot[] = [1, 2, 3, 1, 1, 1] // index 5 wraps to index 0
    expect(matchRun(ring, 5)).toEqual([3, 4, 5, 0])
  })

  it('a ring that is entirely one color terminates with exactly N unique indices', () => {
    const ring: Slot[] = Array(6).fill(7)
    const run = matchRun(ring, 3)
    expect(run.length).toBe(6)
    expect(new Set(run).size).toBe(6)
  })

  it('returns a run shorter than 3 honestly (matchRun itself does not filter)', () => {
    const ring: Slot[] = [1, 2, 2, 3]
    expect(matchRun(ring, 1)).toEqual([1, 2])
  })

  it('empty slot returns []', () => {
    const ring: Slot[] = [null, 1, 2]
    expect(matchRun(ring, 0)).toEqual([])
  })
})

describe('applyMatch', () => {
  it('clears only the given indices, leaves the rest, and does not mutate the input', () => {
    const ring: Slot[] = [1, 2, 3, 4]
    const out = applyMatch(ring, [1, 3])
    expect(out).toEqual([1, null, 3, null])
    expect(ring).toEqual([1, 2, 3, 4]) // untouched
    expect(out).not.toBe(ring)
  })
})

describe('createGame', () => {
  it('produces a fresh, empty-ring state', () => {
    const g = createGame(CFG, 100)
    expect(g.ring.every((s) => s === null)).toBe(true)
    expect(g.loaderPos).toBe(0)
    expect(g.hand.length).toBe(HAND_SIZE)
    expect(g.rngCursor).toBe(HAND_SIZE)
    expect(g.gameOver).toBe(false)
    expect(g.score).toBe(0)
    expect(g.placements).toBe(0)
    expect(g.cleared).toBe(0)
    expect(g.comboStreak).toBe(0)
    expect(g.longestRun).toBe(0)
  })

  it('is deterministic: same (config, seed) => deep-equal state', () => {
    expect(createGame(CFG, 55)).toEqual(createGame(CFG, 55))
  })
})

describe('place() basic flow', () => {
  it('a non-matching placement: hand refills, ring updates, loader advances, score unchanged', () => {
    const cfg: CarouselConfig = { ringSize: 6, rotateStep: 1, colors: 5 }
    const s0 = stateWith({ config: cfg, hand: [2, 4, 1], loaderPos: 0 })
    const s1 = place(s0, 0)
    expect(s1.lastEvent).toBe('place')
    expect(s1.score).toBe(s0.score)
    expect(s1.placements).toBe(1)
    expect(s1.ring[0]).toBe(2)
    expect(s1.hand[1]).toBe(s0.hand[1])
    expect(s1.hand[2]).toBe(s0.hand[2])
    expect(s1.hand[0]).not.toBe(undefined)
    expect(s1.loaderPos).toBe((0 + cfg.rotateStep) % cfg.ringSize)
  })

  it('rngCursor increases by exactly 1 per successful placement', () => {
    const s0 = stateWith({ rngCursor: 3 })
    const s1 = place(s0, 0)
    expect(s1.rngCursor).toBe(4)
  })
})

describe('scoring / combo golden scenarios', () => {
  const cfg: CarouselConfig = { ringSize: 6, rotateStep: 1, colors: 6 }

  it('reproduces the spec golden sequence: 30 -> 75 -> 145 -> (miss) 145', () => {
    // Turn 1: run=3, streak 0->1. points = 10*3 + 15*0 = 30
    const ring1: Slot[] = [null, 1, 1, null, null, null]
    const t1 = place(stateWith({ config: cfg, ring: ring1, loaderPos: 0, hand: [1, 2, 3], comboStreak: 0, score: 0 }), 0)
    expect(t1.lastPlacement?.matched).toBe(true)
    expect(t1.lastPlacement?.runLength).toBe(3)
    expect(t1.lastPlacement?.points).toBe(30)
    expect(t1.score).toBe(30)
    expect(t1.comboStreak).toBe(1)

    // Turn 2: run=3, streak 1->2. points = 10*3 + 15*1 = 45. cumulative 75.
    const ring2: Slot[] = [null, null, 2, 2, null, null]
    const t2 = place(stateWith({ config: cfg, ring: ring2, loaderPos: 1, hand: [2, 3, 4], comboStreak: 1, score: 30 }), 0)
    expect(t2.lastPlacement?.runLength).toBe(3)
    expect(t2.lastPlacement?.points).toBe(45)
    expect(t2.score).toBe(75)
    expect(t2.comboStreak).toBe(2)

    // Turn 3: run=4, streak 2->3. points = 10*4 + 15*2 = 70. cumulative 145.
    const ring3: Slot[] = [null, null, null, 3, 3, 3]
    const t3 = place(stateWith({ config: cfg, ring: ring3, loaderPos: 2, hand: [3, 4, 5], comboStreak: 2, score: 75 }), 0)
    expect(t3.lastPlacement?.runLength).toBe(4)
    expect(t3.lastPlacement?.points).toBe(70)
    expect(t3.score).toBe(145)
    expect(t3.comboStreak).toBe(3)

    // Turn 4: no match. points 0, streak resets, score stays 145.
    const ring4: Slot[] = [null, null, null, null, 5, 6]
    const t4 = place(stateWith({ config: cfg, ring: ring4, loaderPos: 3, hand: [4, 1, 2], comboStreak: 3, score: 145 }), 0)
    expect(t4.lastPlacement?.matched).toBe(false)
    expect(t4.lastPlacement?.points).toBe(0)
    expect(t4.score).toBe(145)
    expect(t4.comboStreak).toBe(0)
  })

  it('comboStreak resets to 0 on a miss, then the next match starts back at streak=1 (no bonus)', () => {
    const s0 = stateWith({ config: cfg, ring: emptyRing(6), loaderPos: 0, hand: [1, 2, 3], comboStreak: 5, score: 100 })
    const s1 = place(s0, 0) // isolated marble, no neighbors -> no match
    expect(s1.lastPlacement?.matched).toBe(false)
    expect(s1.comboStreak).toBe(0)
    expect(s1.score).toBe(100)

    // Now engineer a match at the new loader position using whatever color landed in hand[0].
    const color = s1.hand[0]
    const ring2 = s1.ring.slice()
    ring2[(s1.loaderPos + 1) % cfg.ringSize] = color
    ring2[(s1.loaderPos + 2) % cfg.ringSize] = color
    const s2 = place({ ...s1, ring: ring2 }, 0)
    expect(s2.lastPlacement?.matched).toBe(true)
    expect(s2.lastPlacement?.runLength).toBe(3)
    expect(s2.comboStreak).toBe(1)
    expect(s2.lastPlacement?.points).toBe(MATCH_BASE * 3) // streak-1 = 0, no combo bonus
  })

  it('run=5 uses the same points formula, no special-casing for long runs', () => {
    const ring: Slot[] = [null, 1, 1, 1, 1, null]
    const s = place(stateWith({ config: cfg, ring, loaderPos: 0, hand: [1, 2, 3], comboStreak: 2, score: 0 }), 0)
    // placing at 0 joins with 1,2,3,4 -> run length 5
    expect(s.lastPlacement?.runLength).toBe(5)
    expect(s.lastPlacement?.points).toBe(MATCH_BASE * 5 + COMBO_BASE * (3 - 1))
  })

  it('cleared and longestRun accumulate/max correctly across placements', () => {
    const s0 = stateWith({ config: cfg, ring: [null, 1, 1, null, null, null], loaderPos: 0, hand: [1, 9, 9], cleared: 2, longestRun: 2 })
    const s1 = place(s0, 0) // run=3
    expect(s1.cleared).toBe(2 + 3)
    expect(s1.longestRun).toBe(3)

    const s2 = place({ ...s1, ring: [null, null, 4, 4, 4, 4], loaderPos: 1, hand: [4, 9, 9] }, 0) // run=5
    expect(s2.cleared).toBe(s1.cleared + 5)
    expect(s2.longestRun).toBe(5)
  })
})

describe('game over', () => {
  const cfg: CarouselConfig = { ringSize: 5, rotateStep: 2, colors: 3 }

  it('triggers gameover when the loader would next land on an occupied slot', () => {
    const ring: Slot[] = [null, null, 1, null, null] // index 2 pre-filled
    const s0 = stateWith({ config: cfg, ring, loaderPos: 0, hand: [2, 3, 1] })
    const s1 = place(s0, 0) // places at 0 (no match), loader -> (0+2)%5 = 2, which is occupied
    expect(s1.gameOver).toBe(true)
    expect(s1.lastEvent).toBe('gameover')
  })

  it('place() on an already-gameOver state is a total no-op except lastEvent', () => {
    const ring: Slot[] = [1, null, 2, null, 3]
    const s0 = stateWith({ config: cfg, ring, loaderPos: 1, hand: [1, 2, 3], gameOver: true, score: 42, rngCursor: 9 })
    const s1 = place(s0, 0)
    expect(s1.lastEvent).toBe('none')
    expect(s1.ring).toEqual(ring)
    expect(s1.loaderPos).toBe(1)
    expect(s1.score).toBe(42)
    expect(s1.rngCursor).toBe(9)
  })

  it('loaderPos === (placements * rotateStep) % ringSize holds across a run of placements (property)', () => {
    const config: CarouselConfig = DIFFICULTIES.normal
    let s = createGame(config, 4242)
    for (let i = 0; i < 20 && !s.gameOver; i++) {
      s = place(s, i % HAND_SIZE)
      expect(s.loaderPos).toBe((s.placements * config.rotateStep) % config.ringSize)
    }
  })
})

describe('reduce / actions', () => {
  it('reset reproduces createGame(config, seed) exactly', () => {
    const g = createGame(CFG, 321)
    let s = place(g, 0)
    s = reduce(s, { type: 'reset' })
    expect(s).toEqual(createGame(g.config, g.seed))
  })

  it('new starts a fresh game with the given seed', () => {
    const g = createGame(CFG, 1)
    const s = reduce(g, { type: 'new', seed: 999 })
    expect(s).toEqual(createGame(g.config, 999))
  })

  it('an out-of-range handIndex is a no-op', () => {
    const g = createGame(CFG, 1)
    const s1 = reduce(g, { type: 'place', handIndex: -1 })
    expect(s1.lastEvent).toBe('none')
    expect(s1.ring).toEqual(g.ring)
    expect(s1.hand).toEqual(g.hand)

    const s2 = reduce(g, { type: 'place', handIndex: HAND_SIZE })
    expect(s2.lastEvent).toBe('none')
    expect(s2.ring).toEqual(g.ring)
  })
})

describe('determinism (golden)', () => {
  it('replaying the same seed + handIndex script twice yields deep-equal final states', () => {
    const script = [0, 1, 2, 1, 0, 2, 2, 1, 0, 1, 2, 0, 1, 1, 0]
    function run(): CarouselState {
      let s = createGame(CFG, 8675309)
      for (const idx of script) {
        if (s.gameOver) break
        s = place(s, idx)
      }
      return s
    }
    expect(run()).toEqual(run())
  })
})

describe('difficulty config sanity', () => {
  it('every preset has gcd(rotateStep, ringSize) === 1 (loader visits every slot once per revolution)', () => {
    for (const key of Object.keys(DIFFICULTIES) as (keyof typeof DIFFICULTIES)[]) {
      const { rotateStep, ringSize } = DIFFICULTIES[key]
      expect(gcd(rotateStep, ringSize)).toBe(1)
    }
  })
})

describe('score is integer and non-decreasing', () => {
  it('holds across a 20-turn scripted playthrough', () => {
    let s = createGame(CFG, 13)
    let prevScore = s.score
    for (let i = 0; i < 20 && !s.gameOver; i++) {
      s = place(s, i % HAND_SIZE)
      expect(Number.isInteger(s.score)).toBe(true)
      expect(s.score).toBeGreaterThanOrEqual(prevScore)
      prevScore = s.score
    }
  })
})

describe('occupiedCount / emptyRing', () => {
  it('emptyRing is all-null of the right length; occupiedCount counts non-null slots', () => {
    const ring = emptyRing(8)
    expect(ring.length).toBe(8)
    expect(occupiedCount(ring)).toBe(0)
    const partial: Slot[] = [1, null, 2, null, null]
    expect(occupiedCount(partial)).toBe(2)
  })
})

describe('color helper stays in range through direct construction', () => {
  it('colorFromRng never emits 0 or > colors for boundary rng outputs', () => {
    const c: Color = colorFromRng(() => 0, 4)
    expect(c).toBe(1)
    const c2: Color = colorFromRng(() => 0.999999, 4)
    expect(c2).toBe(4)
  })
})
