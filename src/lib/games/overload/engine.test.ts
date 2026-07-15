import { describe, expect, it } from 'vitest'
import {
  addCharge,
  BASE_SCORE,
  CAPACITY,
  capacityOf,
  CELLS,
  CLEAR_TARGET,
  COLS,
  endlessDensity,
  ENDLESS_REFILL,
  ENDLESS_START_TAPS,
  MAX_STEPS,
  mulberry32,
  NEIGHBORS,
  neighborsOf,
  newGame,
  nextBoard,
  PERFECT_STORM_BONUS,
  puzzleDensity,
  resolveCascade,
  resolveStep,
  ROWS,
  seedBoard,
  TAP_BUDGET,
  TAP_SAVE_BONUS,
  type GameState,
} from './engine'

/** Build a minimal puzzle-mode state around a given board for headline tests. */
function stateOf(charges: number[], overrides: Partial<GameState> = {}): GameState {
  return {
    charges,
    tapsLeft: TAP_BUDGET,
    score: 0,
    mode: 'puzzle',
    level: 1,
    seed: 1,
    cleared: false,
    over: false,
    ...overrides,
  }
}

describe('capacities', () => {
  it('corner=2, edge=3, centre=4 with the right counts and total', () => {
    expect(capacityOf(0)).toBe(2) // top-left corner
    expect(capacityOf(COLS - 1)).toBe(2) // top-right corner
    expect(capacityOf(CELLS - 1)).toBe(2) // bottom-right corner
    expect(capacityOf(1)).toBe(3) // top edge
    expect(capacityOf(2 * COLS + 2)).toBe(4) // interior (r2,c2)

    const counts = { 2: 0, 3: 0, 4: 0 } as Record<number, number>
    let total = 0
    for (let i = 0; i < CELLS; i++) {
      counts[CAPACITY[i]]++
      total += CAPACITY[i]
    }
    expect(counts[2]).toBe(4)
    expect(counts[3]).toBe(16)
    expect(counts[4]).toBe(16)
    expect(total).toBe(120)
    expect(CAPACITY[10]).toBe(capacityOf(10))
  })
})

describe('neighbours', () => {
  it('counts match capacity, are ascending, and symmetric', () => {
    expect(neighborsOf(0)).toEqual([1, 6]) // corner → 2
    expect(neighborsOf(1)).toEqual([0, 2, 7]) // edge → 3
    expect(neighborsOf(2 * COLS + 2)).toEqual([8, 13, 15, 20]) // centre → 4

    for (let i = 0; i < CELLS; i++) {
      const nb = NEIGHBORS[i]
      expect(nb.length).toBe(CAPACITY[i])
      // ascending
      expect(nb.slice().sort((a, b) => a - b)).toEqual(nb)
      // symmetric
      for (const j of nb) expect(NEIGHBORS[j]).toContain(i)
    }
  })
})

describe('single overload', () => {
  it('a lone critical centre cell overloads to exactly its 4 neighbours', () => {
    const board = new Array(CELLS).fill(0)
    const centre = 2 * COLS + 2 // index 14
    board[centre] = CAPACITY[centre] - 1 // 3, critical
    const result = resolveCascade(withTap(board, centre))

    expect(result.waves.length).toBe(1)
    expect(result.chainLength).toBe(1)
    expect(result.scoreDelta).toBe(BASE_SCORE)
    expect(result.charges[centre]).toBe(0)
    for (const n of NEIGHBORS[centre]) expect(result.charges[n]).toBe(1)
    expect(result.truncated).toBe(false)
  })
})

describe('corner / edge push counts', () => {
  it('a corner overloads into exactly 2 cells, an edge into exactly 3', () => {
    const corner = new Array(CELLS).fill(0)
    corner[0] = CAPACITY[0] // 2 -> already at capacity
    const cs = resolveStep(corner)
    expect(cs?.overloaded).toEqual([0])
    for (const n of NEIGHBORS[0]) expect(cs?.next[n]).toBe(1)
    expect(NEIGHBORS[0].length).toBe(2)

    const edge = new Array(CELLS).fill(0)
    edge[1] = CAPACITY[1] // 3
    const es = resolveStep(edge)
    expect(es?.overloaded).toEqual([1])
    for (const n of NEIGHBORS[1]) expect(es?.next[n]).toBe(1)
    expect(NEIGHBORS[1].length).toBe(3)
  })
})

describe('simultaneous double overload (order independence)', () => {
  it('two adjacent cells at capacity explode together, order-independent', () => {
    const a = 2 * COLS + 2 // 14
    const b = 2 * COLS + 3 // 15, adjacent to 14
    const board = new Array(CELLS).fill(0)
    board[a] = CAPACITY[a] // 4
    board[b] = CAPACITY[b] // 4

    const res = resolveCascade(board)
    expect(res.waves.length).toBe(1)
    expect(res.chainLength).toBe(2)
    // Each reset to 0 then received +1 from the other adjacent explosion.
    expect(res.charges[a]).toBe(1)
    expect(res.charges[b]).toBe(1)
    // The union of both neighbourhoods (minus a,b which end at 1) each got +1.
    const nonzero = res.charges
      .map((v, i) => (v > 0 ? i : -1))
      .filter((i) => i >= 0)
      .sort((x, y) => x - y)
    expect(nonzero).toEqual([8, 9, 13, 14, 15, 16, 20, 21])

    // Order independence: a hand-swapped overloaded ordering yields identical output.
    const step = resolveStep(board)!
    const swapped = board.slice()
    for (const i of [...step.overloaded].reverse()) swapped[i] = 0
    for (const i of [...step.overloaded].reverse()) {
      for (const n of NEIGHBORS[i]) swapped[n] += 1
    }
    expect(swapped).toEqual(step.next)
  })
})

describe('multiplier accumulation', () => {
  it('wave1=1 overload, wave2=2 overloads → score 50, chain 3, mult 2', () => {
    const board = new Array(CELLS).fill(0)
    board[14] = 4 // centre, at capacity → wave 1
    board[13] = 3 // primed, overloads in wave 2 after +1
    board[15] = 3 // primed, overloads in wave 2 after +1

    const res = resolveCascade(board)
    expect(res.waves.length).toBe(2)
    expect(res.waves[0].overloaded).toEqual([14])
    expect(res.waves[0].multiplier).toBe(1)
    expect(res.waves[1].overloaded).toEqual([13, 15])
    expect(res.waves[1].multiplier).toBe(2)
    expect(res.chainLength).toBe(3)
    // 1·10·1  +  2·10·2  =  10 + 40 = 50
    expect(res.scoreDelta).toBe(50)
  })
})

describe('perfect storm (board-spanning chain)', () => {
  it('a board-spanning cascade sets cleared and awards the bonus', () => {
    // A fully-critical board detonates in a massive chain (>= CLEAR_TARGET).
    const board = Array.from({ length: CELLS }, (_, i) => CAPACITY[i] - 1)
    const tapsLeft = 5
    const st = stateOf(board, { tapsLeft })
    const { state, result } = addCharge(st, 14)

    expect(result.chainLength).toBeGreaterThanOrEqual(CLEAR_TARGET)
    expect(state.cleared).toBe(true)
    expect(state.over).toBe(false)
    const bonus = PERFECT_STORM_BONUS + (tapsLeft - 1) * TAP_SAVE_BONUS
    expect(state.score).toBe(result.scoreDelta + bonus)
    expect(state.tapsLeft).toBe(tapsLeft - 1)
  })

  it('a small chain does NOT clear the board', () => {
    const board = new Array(CELLS).fill(0)
    board[14] = CAPACITY[14] - 1 // single overload only
    const { state, result } = addCharge(stateOf(board), 14)
    expect(result.chainLength).toBe(1)
    expect(state.cleared).toBe(false)
  })
})

describe('golden seed (locks the deterministic pipeline)', () => {
  it('mulberry32(12345) + seedBoard + tap 30 → fixed chain, score, board', () => {
    const board = seedBoard(mulberry32(12345), puzzleDensity(1))
    expect(board).toEqual([
      0, 2, 1, 2, 2, 0, 2, 2, 3, 1, 3, 2, 1, 0, 3, 3, 0, 2, 2, 3, 3, 3, 3, 2, 2, 2, 0, 3, 3, 0, 1,
      2, 2, 2, 1, 0,
    ])
    const res = resolveCascade(withTap(board, 30))
    expect(res.truncated).toBe(false)
    expect(res.chainLength).toBe(56)
    expect(res.scoreDelta).toBe(6390)
    expect(res.charges).toEqual([
      0, 2, 2, 1, 2, 0, 2, 3, 0, 3, 3, 2, 2, 2, 2, 0, 1, 2, 2, 2, 3, 1, 3, 1, 2, 1, 2, 2, 3, 2, 1,
      0, 1, 2, 1, 1,
    ])
  })
})

describe('termination safety cap', () => {
  it('an oscillating fully-critical board returns within MAX_STEPS instead of hanging', () => {
    const board = Array.from({ length: CELLS }, (_, i) => CAPACITY[i] - 1)
    const res = resolveCascade(withTap(board, 14))
    // This configuration conserves energy and oscillates forever; the cap engages.
    expect(res.truncated).toBe(true)
    expect(res.waves.length).toBe(MAX_STEPS)
    expect(res.charges).toHaveLength(CELLS)
    // Still a valid, board-spanning chain.
    expect(res.chainLength).toBeGreaterThanOrEqual(CLEAR_TARGET)
  })

  it('a stable board returns null / empty cascade', () => {
    const board = new Array(CELLS).fill(0)
    expect(resolveStep(board)).toBeNull()
    const res = resolveCascade(board)
    expect(res.waves).toHaveLength(0)
    expect(res.chainLength).toBe(0)
    expect(res.truncated).toBe(false)
  })
})

describe('purity / immutability', () => {
  it('addCharge and resolveCascade never mutate their inputs', () => {
    const board = seedBoard(mulberry32(7), puzzleDensity(1))
    const snapshot = board.slice()
    const st = stateOf(board.slice())
    const stateSnapshot = { ...st, charges: st.charges.slice() }

    resolveCascade(withTap(board, 3))
    expect(board).toEqual(snapshot)

    addCharge(st, 3)
    expect(st.charges).toEqual(stateSnapshot.charges)
    expect(st.score).toBe(stateSnapshot.score)
    expect(st.tapsLeft).toBe(stateSnapshot.tapsLeft)

    // Deterministic: same inputs → deep-equal outputs.
    const r1 = addCharge(stateOf(board.slice()), 3)
    const r2 = addCharge(stateOf(board.slice()), 3)
    expect(r1.state).toEqual(r2.state)
    expect(r1.result).toEqual(r2.result)
  })
})

describe('out of taps', () => {
  it('the last tap without a clear ends the run', () => {
    const board = new Array(CELLS).fill(0) // tap causes no overload, no clear
    const st = stateOf(board, { tapsLeft: 1 })
    const { state } = addCharge(st, 0)
    expect(state.tapsLeft).toBe(0)
    expect(state.over).toBe(true)
    expect(state.cleared).toBe(false)
  })

  it('no-op when over / cleared / out of taps / bad index', () => {
    const board = new Array(CELLS).fill(0)
    for (const st of [
      stateOf(board, { over: true }),
      stateOf(board, { cleared: true }),
      stateOf(board, { tapsLeft: 0 }),
    ]) {
      const { state, result } = addCharge(st, 5)
      expect(state).toBe(st)
      expect(result.waves).toHaveLength(0)
    }
    const good = stateOf(board)
    expect(addCharge(good, -1).state).toBe(good)
    expect(addCharge(good, CELLS).state).toBe(good)
  })
})

describe('seed stability', () => {
  it('every seeded charge is below capacity and at least one cell is critical', () => {
    for (let s = 1; s <= 50; s++) {
      const board = seedBoard(mulberry32(s), puzzleDensity(3))
      expect(board).toHaveLength(CELLS)
      let criticals = 0
      for (let i = 0; i < CELLS; i++) {
        expect(board[i]).toBeGreaterThanOrEqual(0)
        expect(board[i]).toBeLessThan(CAPACITY[i]) // stable — no auto-overload
        if (board[i] === CAPACITY[i] - 1) criticals++
      }
      expect(criticals).toBeGreaterThanOrEqual(1)
      // A stable board triggers no cascade on its own.
      expect(resolveStep(board)).toBeNull()
    }
  })
})

describe('game lifecycle', () => {
  it('newGame / nextBoard set taps and density per mode', () => {
    const rng = mulberry32(42)
    const puzzle = newGame(rng, 'puzzle', 99)
    expect(puzzle.tapsLeft).toBe(TAP_BUDGET)
    expect(puzzle.level).toBe(1)
    expect(puzzle.seed).toBe(99)
    expect(puzzle.mode).toBe('puzzle')

    const advanced = nextBoard(puzzle, rng, 100)
    expect(advanced.level).toBe(2)
    expect(advanced.tapsLeft).toBe(TAP_BUDGET) // puzzle resets
    expect(advanced.seed).toBe(100)

    const endless = newGame(rng, 'endless', 5)
    expect(endless.tapsLeft).toBe(ENDLESS_START_TAPS)
    const endlessNext = nextBoard({ ...endless, tapsLeft: 3 }, rng, 6)
    expect(endlessNext.tapsLeft).toBe(3 + ENDLESS_REFILL) // endless refills
  })

  it('density formulas scale and clamp', () => {
    expect(puzzleDensity(1)).toBeCloseTo(0.45)
    expect(puzzleDensity(100)).toBeCloseTo(0.85) // clamped
    expect(endlessDensity(1)).toBeCloseTo(0.4)
    expect(endlessDensity(100)).toBeCloseTo(0.9) // clamped
    expect(ROWS * COLS).toBe(CELLS)
  })
})

/** Helper: copy a board and add one charge at index (mirrors addCharge's tap). */
function withTap(board: number[], index: number): number[] {
  const c = board.slice()
  c[index] += 1
  return c
}
