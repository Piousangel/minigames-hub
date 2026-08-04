import { describe, expect, it, vi } from 'vitest'
import {
  applyGravity,
  clearMatches,
  COLORS,
  createGame,
  EMPTY,
  findMatches,
  generateBoard,
  HEIGHT,
  MAX_WAVES,
  mulberry32,
  MOVES_START,
  refill,
  resolveBoard,
  resolveSteps,
  rotateRowRight,
  shear,
  shearGrid,
  TILE_SCORE,
  tilt,
  WIDTH,
  type GameState,
  type Grid,
  type Rng,
} from './engine'

// -------- helpers --------

/** Cycles through distinct-color values that never form a new match on the
 * small cascade fixtures below (colors 0,1,2, one call per EMPTY cell). */
function safeRng(): Rng {
  const seq = [0.05, 0.25, 0.45]
  let i = 0
  return () => seq[i++ % seq.length]
}

function makeState(overrides: Partial<GameState> & { grid: Grid }): GameState {
  return {
    score: 0,
    movesLeft: MOVES_START,
    comboStreak: 0,
    bestCombo: 0,
    over: false,
    ...overrides,
  }
}

// A 3-col x 5-row grid with exactly one horizontal 3-match in row 2. Clearing
// it and refilling with `safeRng()` produces no further matches (single wave).
const SINGLE_MATCH_GRID: Grid = [
  [1, 2, 1],
  [2, 1, 2],
  [0, 0, 0],
  [1, 2, 1],
  [2, 1, 2],
]

// Same shape, but a controlled 6-value rng sequence: the wave-1 refill fills
// row 0 with [1,1,1] (a fresh horizontal match), and the wave-2 refill (safe
// values) settles it — exactly two cascade waves.
function twoWaveRng(): Rng {
  const seq = [0.3, 0.3, 0.3, 0.05, 0.25, 0.45]
  let i = 0
  return () => seq[i++ % seq.length]
}

// -------- A. rotate/shear 구조 불변식 --------

describe('rotateRowRight', () => {
  it('1. rotates right by k, wrapping the tail to the front', () => {
    expect(rotateRowRight([0, 1, 2, 3], 1)).toEqual([3, 0, 1, 2])
  })

  it('2. k=0 returns a value-identical new array', () => {
    const row = [4, 5, 6]
    const out = rotateRowRight(row, 0)
    expect(out).toEqual(row)
    expect(out).not.toBe(row)
  })

  it('3. k=WIDTH wraps fully around (modular identity)', () => {
    const row = [1, 2, 3, 4, 5, 6]
    expect(rotateRowRight(row, WIDTH)).toEqual(row)
  })
})

describe('shearGrid', () => {
  const sample: Grid = [
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5],
  ]

  it('4. never changes row 0 (shift is always 0*dir), for both directions', () => {
    expect(shearGrid(sample, 1)[0]).toEqual(sample[0])
    expect(shearGrid(sample, -1)[0]).toEqual(sample[0])
  })

  it('5. preserves the color multiset across the whole board', () => {
    const before = sample.flat().slice().sort()
    const after = shearGrid(sample, 1).flat().slice().sort()
    expect(after).toEqual(before)
  })

  it('6. is its own inverse under the opposite direction', () => {
    expect(shearGrid(shearGrid(sample, 1), -1)).toEqual(sample)
    expect(shearGrid(shearGrid(sample, -1), 1)).toEqual(sample)
  })

  it('7. is periodic with period WIDTH', () => {
    let g = sample
    for (let i = 0; i < WIDTH; i++) g = shearGrid(g, 1)
    expect(g).toEqual(sample)
  })
})

// -------- B. 매치 탐지 --------

describe('findMatches', () => {
  it('8. detects a horizontal run of exactly 3', () => {
    const grid: Grid = [[1, 1, 1, 2]]
    const matches = findMatches(grid)
    expect(matches).toHaveLength(3)
    expect(new Set(matches.map((m) => `${m.row},${m.col}`))).toEqual(
      new Set(['0,0', '0,1', '0,2']),
    )
  })

  it('9. a run of length 2 is not a match', () => {
    const grid: Grid = [[1, 1, 2]]
    expect(findMatches(grid)).toEqual([])
  })

  it('10. detects a vertical run of 4 (all 4 cells, over-length run)', () => {
    const grid: Grid = [[5], [5], [5], [5]]
    const matches = findMatches(grid)
    expect(matches).toHaveLength(4)
  })

  it('11. a horizontal/vertical T-intersection counts the shared cell once', () => {
    const grid: Grid = [
      [1, 1, 1],
      [2, 1, 2],
      [3, 1, 3],
    ]
    const matches = findMatches(grid)
    const keys = matches.map((m) => `${m.row},${m.col}`)
    expect(new Set(keys).size).toBe(keys.length) // no duplicates
    expect(new Set(keys)).toEqual(new Set(['0,0', '0,1', '0,2', '1,1', '2,1']))
  })
})

// -------- C. 제거/중력/리필 --------

describe('clearMatches / applyGravity / refill', () => {
  it('12. clearMatches EMPTYs only the matched cells, leaves the rest untouched', () => {
    const grid: Grid = [
      [1, 2],
      [3, 4],
    ]
    const out = clearMatches(grid, [{ row: 0, col: 0 }])
    expect(out).toEqual([
      [EMPTY, 2],
      [3, 4],
    ])
  })

  it('13. applyGravity compacts a column downward, preserving relative order', () => {
    const grid: Grid = [[EMPTY], [1], [EMPTY], [2]]
    expect(applyGravity(grid)).toEqual([[EMPTY], [EMPTY], [1], [2]])
  })

  it('14. applyGravity is a no-op on an EMPTY-free column', () => {
    const grid: Grid = [[1], [2], [3]]
    expect(applyGravity(grid)).toEqual(grid)
  })

  it('15. refill calls rng exactly once per EMPTY cell, leaves no EMPTY, values in range', () => {
    const grid: Grid = [
      [EMPTY, 1],
      [2, EMPTY],
    ]
    let calls = 0
    const rng: Rng = () => {
      calls++
      return 0.42
    }
    const { grid: out } = refill(grid, rng)
    expect(calls).toBe(2)
    for (const row of out) for (const v of row) expect(v).not.toBe(EMPTY)
    for (const row of out) for (const v of row) expect(v).toBeGreaterThanOrEqual(0)
    for (const row of out) for (const v of row) expect(v).toBeLessThan(COLORS)
  })
})

// -------- D. 보드 생성 --------

describe('generateBoard', () => {
  it('16. produces a board with zero matches, across many seeds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const grid = generateBoard(mulberry32(seed * 7919))
      expect(findMatches(grid)).toEqual([])
    }
  })

  it('17. is deterministic for a fixed seed', () => {
    const a = generateBoard(mulberry32(999))
    const b = generateBoard(mulberry32(999))
    expect(a).toEqual(b)
  })
})

// -------- E. 캐스케이드 해소 --------

describe('resolveSteps', () => {
  it('18. a single 3-run resolves in exactly one wave with gained = 3*TILE_SCORE*1', () => {
    const { steps } = resolveSteps(SINGLE_MATCH_GRID, safeRng())
    expect(steps).toHaveLength(1)
    expect(steps[0].gained).toBe(3 * TILE_SCORE * 1)
    expect(steps[0].waveIndex).toBe(1)
  })

  it('19. a refill-triggered new match cascades into a second wave with the waveIndex=2 multiplier', () => {
    const { steps } = resolveSteps(SINGLE_MATCH_GRID, twoWaveRng())
    expect(steps).toHaveLength(2)
    expect(steps[0].waveIndex).toBe(1)
    expect(steps[1].waveIndex).toBe(2)
    expect(steps[1].gained).toBe(3 * TILE_SCORE * 2)
  })

  it('20. MAX_WAVES safety net stops a constant-rng infinite cascade and returns normally', () => {
    const rng: Rng = () => 0
    const { steps } = resolveSteps(SINGLE_MATCH_GRID, rng)
    expect(steps.length).toBeLessThanOrEqual(MAX_WAVES)
    expect(steps.length).toBe(MAX_WAVES)
  })
})

// -------- F. shear/resolveBoard/tilt 통합 --------

describe('shear', () => {
  it('21. decrements movesLeft by exactly 1, regardless of whether a match resulted', () => {
    const state = makeState({ grid: generateBoard(mulberry32(1)), movesLeft: 10 })
    const out = shear(state, 1)
    expect(out.movesLeft).toBe(9)
  })

  it('22. is a complete no-op when state.over is true', () => {
    const state = makeState({ grid: generateBoard(mulberry32(2)), movesLeft: 0, over: true })
    const out = shear(state, 1)
    expect(out).toEqual(state)
    expect(out).toBe(state)
  })
})

describe('resolveBoard', () => {
  it('is a complete no-op when state.over is true (defensive guard, matches shear\'s contract)', () => {
    const state = makeState({ grid: SINGLE_MATCH_GRID, over: true, comboStreak: 3 })
    const out = resolveBoard(state, safeRng())
    expect(out).toEqual(state)
    expect(out).toBe(state)
  })

  it('23. resets comboStreak to 0 after a no-match tilt, even if it was previously positive', () => {
    const noMatchGrid: Grid = [
      [0, 1, 2],
      [1, 2, 0],
      [2, 0, 1],
    ]
    expect(findMatches(noMatchGrid)).toEqual([])
    const state = makeState({ grid: noMatchGrid, comboStreak: 5, bestCombo: 5 })
    const out = resolveBoard(state, safeRng())
    expect(out.comboStreak).toBe(0)
    expect(out.score).toBe(state.score)
  })

  it('24. two consecutive matching tilts raise comboStreak 1 -> 2, and the 2nd tilt scores gained*2', () => {
    const state = makeState({ grid: SINGLE_MATCH_GRID })
    const first = resolveBoard(state, safeRng())
    expect(first.comboStreak).toBe(1)
    expect(first.score).toBe(30 * 1) // gained(30) * comboStreak(1)

    const second = resolveBoard({ ...first, grid: SINGLE_MATCH_GRID }, safeRng())
    expect(second.comboStreak).toBe(2)
    expect(second.score - first.score).toBe(30 * 2) // gained(30) * comboStreak(2)
  })

  it('25. bestCombo tracks the running max across a mixed match/no-match script', () => {
    const noMatchGrid: Grid = [
      [0, 1, 2],
      [1, 2, 0],
      [2, 0, 1],
    ]
    let s = makeState({ grid: SINGLE_MATCH_GRID })
    s = resolveBoard(s, safeRng()) // combo 1
    s = resolveBoard({ ...s, grid: SINGLE_MATCH_GRID }, safeRng()) // combo 2
    s = resolveBoard({ ...s, grid: noMatchGrid }, safeRng()) // combo 0
    s = resolveBoard({ ...s, grid: SINGLE_MATCH_GRID }, safeRng()) // combo 1
    s = resolveBoard({ ...s, grid: SINGLE_MATCH_GRID }, safeRng()) // combo 2
    s = resolveBoard({ ...s, grid: SINGLE_MATCH_GRID }, safeRng()) // combo 3
    expect(s.comboStreak).toBe(3)
    expect(s.bestCombo).toBe(3)
  })
})

describe('createGame', () => {
  it('26. starts with a settled board and zeroed counters', () => {
    const state = createGame(mulberry32(42))
    expect(state.over).toBe(false)
    expect(state.movesLeft).toBe(MOVES_START)
    expect(state.score).toBe(0)
    expect(state.comboStreak).toBe(0)
    expect(state.bestCombo).toBe(0)
    expect(findMatches(state.grid)).toEqual([])
  })
})

describe('golden scenario', () => {
  const SEED = 12345
  const DIRS: (1 | -1)[] = [1, 1, -1, 1, -1, -1, 1, 1, -1, 1]

  function run() {
    const rng = mulberry32(SEED)
    let s = createGame(rng)
    for (const d of DIRS) s = tilt(s, d, rng)
    return s
  }

  it('27. reproduces the exact recorded final state and grid for a fixed seed + dir script', () => {
    const final = run()
    expect({
      score: final.score,
      movesLeft: final.movesLeft,
      comboStreak: final.comboStreak,
      bestCombo: final.bestCombo,
      over: final.over,
    }).toEqual({ score: 240, movesLeft: 20, comboStreak: 0, bestCombo: 1, over: false })
    expect(final.grid).toEqual([
      [4, 4, 0, 3, 2, 2],
      [1, 4, 1, 0, 0, 4],
      [4, 1, 2, 0, 1, 3],
      [0, 2, 0, 3, 4, 2],
      [3, 3, 4, 3, 1, 1],
      [3, 4, 0, 2, 0, 0],
      [0, 3, 3, 0, 2, 3],
      [2, 4, 4, 0, 2, 4],
    ])
  })

  it('28. once movesLeft hits 0, over flips true and further shear calls are no-ops', () => {
    let s = makeState({ grid: generateBoard(mulberry32(7)), movesLeft: 1 })
    s = shear(s, 1)
    expect(s.movesLeft).toBe(0)
    expect(s.over).toBe(true)
    const again = shear(s, 1)
    expect(again).toEqual(s)
    expect(again).toBe(s)
    const yetAgain = shear(again, -1)
    expect(yetAgain).toBe(again)
  })
})

// -------- G. 결정론/오염 가드 --------

describe('determinism / contamination guards', () => {
  const SEED = 12345
  const DIRS: (1 | -1)[] = [1, 1, -1, 1, -1, -1, 1, 1, -1, 1]

  function run() {
    const rng = mulberry32(SEED)
    let s = createGame(rng)
    for (const d of DIRS) s = tilt(s, d, rng)
    return s
  }

  it('29. two independently replayed sessions with the same seed+script produce identical final state', () => {
    expect(run()).toEqual(run())
  })

  it('30. never touches global Math.random (seed-only rng throughout)', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('leaked')
    })
    try {
      expect(() => run()).not.toThrow()
    } finally {
      spy.mockRestore()
    }
  })
})

// Sanity: HEIGHT/COLORS constants match the spec's shape assumptions used above.
describe('constants sanity', () => {
  it('HEIGHT > WIDTH so every shift 0..WIDTH-1 appears at least once', () => {
    expect(HEIGHT).toBeGreaterThan(WIDTH)
  })
})
