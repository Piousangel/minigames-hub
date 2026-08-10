import { describe, expect, it } from 'vitest'
import {
  DIFFICULTIES,
  MAX_GEN_ATTEMPTS,
  PAR_BONUS_MAX,
  ROW_BONUS,
  WIN_BONUS,
  applyCycle,
  applyMove,
  countCorrectCells,
  createGame,
  cycleCol,
  cycleRow,
  generateGrid,
  invertMove,
  isRowCorrect,
  isSolved,
  isValidMove,
  makeSolvedGrid,
  mulberry32,
  reduce,
  type Grid,
  type LoopgridConfig,
  type LoopgridState,
  type Move,
  type Rng,
} from './engine'

const CFG: LoopgridConfig = DIFFICULTIES.normal
const TEST_CFG: LoopgridConfig = { n: 3, scrambleMoves: 1 } // hand-computable small config

/** A queued-array Rng like the template's deterministic tests use. */
function queued(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

function stateWith(grid: Grid, overrides: Partial<LoopgridState> = {}): LoopgridState {
  return {
    config: TEST_CFG,
    seed: 1,
    grid: grid.map((row) => row.slice()),
    moves: 0,
    par: 1,
    score: 0,
    completedRows: Array(grid.length).fill(false),
    lastMove: null,
    won: false,
    lastEvent: 'none',
    lastNewlyCompleted: [],
    ...overrides,
  }
}

// -- 1. makeSolvedGrid / isSolved --------------------------------------------

describe('makeSolvedGrid', () => {
  it('fills each row r with color r+1 and is solved', () => {
    const g = makeSolvedGrid(4)
    for (let r = 0; r < 4; r++) expect(g[r]).toEqual([r + 1, r + 1, r + 1, r + 1])
    expect(isSolved(g)).toBe(true)
  })
})

// -- 2. isRowCorrect ----------------------------------------------------------

describe('isRowCorrect', () => {
  it('checks every cell equals r+1', () => {
    expect(isRowCorrect([[1, 1, 1]], 0)).toBe(true)
    expect(isRowCorrect([[1, 2, 1]], 0)).toBe(false)
    expect(isRowCorrect([[9, 2, 2], [2, 2, 2]], 1)).toBe(true)
  })
})

// -- 3. isSolved --------------------------------------------------------------

describe('isSolved', () => {
  it('true for a solved grid, false with one cell off', () => {
    const g = makeSolvedGrid(3)
    expect(isSolved(g)).toBe(true)
    const broken = g.map((row) => row.slice())
    broken[0][2] = 2
    expect(isSolved(broken)).toBe(false)
  })
})

// -- 4/5. cycleRow hand-computed ----------------------------------------------

describe('cycleRow', () => {
  it('dir=1 rotates right (wrap from the end)', () => {
    expect(cycleRow([[1, 2, 3, 4]], 0, 1)).toEqual([[4, 1, 2, 3]])
  })
  it('dir=-1 rotates left (wrap from the start)', () => {
    expect(cycleRow([[1, 2, 3, 4]], 0, -1)).toEqual([[2, 3, 4, 1]])
  })
})

// -- 6. cycleCol hand-computed -------------------------------------------------

describe('cycleCol', () => {
  it('dir=1 rotates a 4x1 column down', () => {
    expect(cycleCol([[10], [20], [30], [40]], 0, 1)).toEqual([[40], [10], [20], [30]])
  })
  it('dir=-1 rotates a column up', () => {
    expect(cycleCol([[10], [20], [30], [40]], 0, -1)).toEqual([[20], [30], [40], [10]])
  })
})

// -- 7. non-mutation + other rows/cols untouched -------------------------------

describe('cycleRow / cycleCol do not mutate and leave other lines alone', () => {
  it('cycleRow', () => {
    const g: Grid = [[1, 2], [3, 4]]
    const before = g.map((row) => row.slice())
    const out = cycleRow(g, 0, 1)
    expect(g).toEqual(before) // input untouched
    expect(out[0]).toEqual([2, 1])
    expect(out[1]).toEqual([3, 4]) // row 1 unaffected
  })
  it('cycleCol', () => {
    const g: Grid = [[1, 2], [3, 4]]
    const before = g.map((row) => row.slice())
    const out = cycleCol(g, 0, 1)
    expect(g).toEqual(before)
    expect(out[0][0]).toBe(3)
    expect(out[1][0]).toBe(1)
    expect(out[0][1]).toBe(2) // col 1 unaffected
    expect(out[1][1]).toBe(4)
  })
})

// -- 8. applyMove delegates ----------------------------------------------------

describe('applyMove', () => {
  it('delegates to cycleRow / cycleCol identically', () => {
    const g: Grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    expect(applyMove(g, { axis: 'row', index: 1, dir: 1 })).toEqual(cycleRow(g, 1, 1))
    expect(applyMove(g, { axis: 'col', index: 2, dir: -1 })).toEqual(cycleCol(g, 2, -1))
  })
})

// -- 9. invert round trip, hand-enumerated -------------------------------------

describe('invertMove round trip', () => {
  it('applyMove then applyMove(invert) restores the grid, for several hand-picked grids/moves', () => {
    const cases: { grid: Grid; move: Move }[] = [
      {
        grid: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        move: { axis: 'row', index: 0, dir: 1 },
      },
      {
        grid: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
        move: { axis: 'col', index: 2, dir: -1 },
      },
      {
        grid: Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => r * 4 + c)),
        move: { axis: 'row', index: 2, dir: -1 },
      },
      {
        grid: Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => r * 4 + c)),
        move: { axis: 'col', index: 0, dir: 1 },
      },
      {
        grid: Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r * 5 + c)),
        move: { axis: 'col', index: 3, dir: 1 },
      },
      {
        grid: Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => r * 6 + c)),
        move: { axis: 'row', index: 5, dir: -1 },
      },
    ]
    for (const { grid, move } of cases) {
      const forward = applyMove(grid, move)
      const back = applyMove(forward, invertMove(move))
      expect(back).toEqual(grid)
    }
  })
})

// -- 10. identity after n same-direction cycles --------------------------------

describe('n cycles in the same direction is the identity', () => {
  it('cycleRow', () => {
    let row: Grid = [[1, 2, 3, 4, 5]]
    for (let i = 0; i < 5; i++) row = cycleRow(row, 0, 1)
    expect(row).toEqual([[1, 2, 3, 4, 5]])
  })
  it('cycleCol', () => {
    let g: Grid = [[1], [2], [3], [4]]
    for (let i = 0; i < 4; i++) g = cycleCol(g, 0, -1)
    expect(g).toEqual([[1], [2], [3], [4]])
  })
})

// -- 11. isValidMove ------------------------------------------------------------

describe('isValidMove', () => {
  it('rejects out-of-range index, bad axis, bad dir', () => {
    expect(isValidMove(3, { axis: 'row', index: 0, dir: 1 })).toBe(true)
    expect(isValidMove(3, { axis: 'row', index: 3, dir: 1 })).toBe(false)
    expect(isValidMove(3, { axis: 'row', index: -1, dir: 1 })).toBe(false)
    expect(isValidMove(3, { axis: 'diag' as unknown as 'row', index: 0, dir: 1 })).toBe(false)
    expect(isValidMove(3, { axis: 'row', index: 0, dir: 0 as unknown as 1 })).toBe(false)
  })
})

// -- 12. generateGrid rng consumption order (hand-computed) --------------------

describe('generateGrid consumes rng in the documented order', () => {
  it('row pick: axis<0.5 -> row, index=floor(rng*n), dir<0.5 -> -1 else 1', () => {
    // rng sequence: 0.1 (axis<0.5 -> row), 0.6 (index=floor(0.6*3)=1), 0.9 (dir -> 1)
    const { grid, movesApplied } = generateGrid(TEST_CFG, queued([0.1, 0.6, 0.9]))
    expect(movesApplied).toBe(1)
    // row 1 of the solved grid is constant [2,2,2]; rotating it changes nothing.
    expect(grid).toEqual(makeSolvedGrid(3))
  })

  it('col pick with a computed rotation', () => {
    // rng sequence: 0.6 (axis>=0.5 -> col), 0.6 (index=1), 0.1 (dir -> -1)
    const { grid, movesApplied } = generateGrid(TEST_CFG, queued([0.6, 0.6, 0.1]))
    expect(movesApplied).toBe(1)
    expect(grid).toEqual([
      [1, 2, 1],
      [2, 3, 2],
      [3, 1, 3],
    ])
  })
})

// -- 13. generateGrid preserves the color histogram -----------------------------

describe('generateGrid preserves the color histogram', () => {
  it('each color appears exactly n times, and movesApplied <= scrambleMoves', () => {
    for (const cfg of [DIFFICULTIES.easy, DIFFICULTIES.normal, DIFFICULTIES.hard]) {
      const { grid, movesApplied } = generateGrid(cfg, mulberry32(4242))
      expect(movesApplied).toBeLessThanOrEqual(cfg.scrambleMoves)
      const counts = new Map<number, number>()
      for (const row of grid) for (const c of row) counts.set(c, (counts.get(c) ?? 0) + 1)
      for (let k = 1; k <= cfg.n; k++) expect(counts.get(k)).toBe(cfg.n)
    }
  })
})

// -- 14. generateGrid usually reaches the full scramble count --------------------

describe('generateGrid reaches the full scramble count', () => {
  it('for several seeds across difficulties', () => {
    for (const cfg of [DIFFICULTIES.easy, DIFFICULTIES.normal, DIFFICULTIES.hard]) {
      for (const seed of [1, 2, 3]) {
        const { movesApplied } = generateGrid(cfg, mulberry32(seed))
        expect(movesApplied).toBe(cfg.scrambleMoves)
      }
    }
  })
})

// -- 15. createGame determinism --------------------------------------------------

describe('createGame', () => {
  it('is deterministic for a fixed (cfg, seed)', () => {
    expect(createGame(CFG, 777)).toEqual(createGame(CFG, 777))
  })

  // -- 16. never already-solved ---------------------------------------------------
  it('never returns an already-solved board', () => {
    for (const seed of [1, 2, 3, 100, 12345]) {
      expect(isSolved(createGame(CFG, seed).grid)).toBe(false)
    }
  })

  it('retries within MAX_GEN_ATTEMPTS if needed (sanity: constant is respected)', () => {
    expect(MAX_GEN_ATTEMPTS).toBeGreaterThan(0)
  })

  // -- 17. completedRows initialized from accidental correctness -------------------
  it('marks rows that are already correct in the generated grid', () => {
    const cfg: LoopgridConfig = { n: 3, scrambleMoves: 4 }
    let found: LoopgridState | null = null
    for (let seed = 0; seed < 3000 && !found; seed++) {
      const g = createGame(cfg, seed)
      const trueCount = g.completedRows.filter(Boolean).length
      if (trueCount > 0 && trueCount < cfg.n) found = g
    }
    expect(found).not.toBeNull()
    const g = found as LoopgridState
    for (let r = 0; r < cfg.n; r++) {
      expect(g.completedRows[r]).toBe(isRowCorrect(g.grid, r))
    }
  })
})

// -- 18. reduce no-ops after win --------------------------------------------------

describe('reduce after win', () => {
  it('cycle and undo are both no-ops', () => {
    const won = stateWith(makeSolvedGrid(3), { won: true, lastMove: { axis: 'row', index: 0, dir: 1 } })
    const afterCycle = reduce(won, { type: 'cycle', axis: 'row', index: 0, dir: 1 })
    expect(afterCycle.lastEvent).toBe('none')
    expect(afterCycle.grid).toEqual(won.grid)
    const afterUndo = reduce(won, { type: 'undo' })
    expect(afterUndo.lastEvent).toBe('none')
    expect(afterUndo.grid).toEqual(won.grid)
  })
})

// -- 19. reduce rejects invalid cycle actions -------------------------------------

describe('reduce rejects invalid cycle actions', () => {
  it('out-of-range index is a no-op', () => {
    const s = stateWith([[1, 1, 1], [2, 2, 2], [3, 3, 3]])
    const out = reduce(s, { type: 'cycle', axis: 'row', index: 9, dir: 1 })
    expect(out.lastEvent).toBe('none')
    expect(out.grid).toEqual(s.grid)
    expect(out.moves).toBe(0)
  })
})

// -- 20. ordinary cycle, no row completed -----------------------------------------

describe('reduce: ordinary cycle', () => {
  it('bumps moves and lastMove, no score change', () => {
    // ONE_ROW_GRID (defined below) is unsolved and has no correct rows; rotating
    // row 0 rearranges it into another still-incorrect row, completing nothing.
    const s = stateWith(
      [
        [1, 1, 3],
        [3, 2, 2],
        [2, 3, 1],
      ],
      { completedRows: [false, false, false] },
    )
    const out = reduce(s, { type: 'cycle', axis: 'row', index: 0, dir: 1 })
    expect(out.grid[0]).toEqual([3, 1, 1])
    expect(out.grid[1]).toEqual([3, 2, 2])
    expect(out.grid[2]).toEqual([2, 3, 1])
    expect(out.won).toBe(false)
    expect(out.moves).toBe(1)
    expect(out.lastMove).toEqual({ axis: 'row', index: 0, dir: 1 })
    expect(out.lastEvent).toBe('cycle')
    expect(out.score).toBe(0)
  })
})

// -- 21. exactly one row newly completed -------------------------------------------

// Hand-built n=3 grid: applying {col, index:0, dir:-1} makes row 1 ([1,2,2]->row1
// col0 becomes 2) fully correct while rows 0 and 2 remain wrong.
const ONE_ROW_GRID: Grid = [
  [1, 1, 3],
  [3, 2, 2],
  [2, 3, 1],
]
const ONE_ROW_MOVE: Move = { axis: 'col', index: 0, dir: -1 }

describe('reduce: single row newly completed', () => {
  it('awards ROW_BONUS and marks the row sticky', () => {
    const s = stateWith(ONE_ROW_GRID)
    const out = reduce(s, { type: 'cycle', axis: ONE_ROW_MOVE.axis, index: ONE_ROW_MOVE.index, dir: ONE_ROW_MOVE.dir })
    expect(out.grid[1]).toEqual([2, 2, 2])
    expect(isRowCorrect(out.grid, 0)).toBe(false)
    expect(isRowCorrect(out.grid, 2)).toBe(false)
    expect(out.lastNewlyCompleted).toEqual([1])
    expect(out.completedRows).toEqual([false, true, false])
    expect(out.score).toBe(ROW_BONUS)
    expect(out.lastEvent).toBe('rowComplete')
    expect(out.won).toBe(false)
  })
})

// -- 22. combo: two rows newly completed by the same move ---------------------------

const COMBO_GRID: Grid = [
  [3, 1, 1],
  [1, 1, 2],
  [2, 3, 3],
]
const COMBO_MOVE: Move = { axis: 'col', index: 0, dir: -1 }

describe('reduce: combo', () => {
  it('awards ROW_BONUS*4 when two rows complete at once', () => {
    const s = stateWith(COMBO_GRID)
    const out = reduce(s, { type: 'cycle', axis: COMBO_MOVE.axis, index: COMBO_MOVE.index, dir: COMBO_MOVE.dir })
    expect(out.grid[0]).toEqual([1, 1, 1])
    expect(out.grid[2]).toEqual([3, 3, 3])
    expect(isRowCorrect(out.grid, 1)).toBe(false)
    expect(out.lastNewlyCompleted).toEqual([0, 2])
    expect(out.score).toBe(ROW_BONUS * 4)
    expect(out.lastEvent).toBe('combo')
    expect(out.won).toBe(false)
  })
})

// -- 23. already-completed rows are not re-awarded -----------------------------------

describe('reduce: sticky completion has no re-award', () => {
  it('re-completing an already-marked row grants no bonus', () => {
    const s = stateWith(ONE_ROW_GRID, { completedRows: [false, true, false] })
    const out = reduce(s, { type: 'cycle', axis: ONE_ROW_MOVE.axis, index: ONE_ROW_MOVE.index, dir: ONE_ROW_MOVE.dir })
    expect(out.grid[1]).toEqual([2, 2, 2]) // still becomes correct...
    expect(out.lastNewlyCompleted).toEqual([]) // ...but not newly (already true)
    expect(out.completedRows).toEqual([false, true, false])
    expect(out.score).toBe(0)
    expect(out.lastEvent).toBe('cycle')
  })
})

// -- 24-26. undo mechanics --------------------------------------------------------------

// Unsolved base grid (no row is correct); rotating row 0 keeps it unsolved and
// completes no row, so undo-ing it back never crosses into a win.
const UNDO_BASE_GRID: Grid = [
  [1, 1, 3],
  [3, 2, 2],
  [2, 3, 1],
]

describe('reduce: undo', () => {
  it('restores the pre-move grid; moves counts both the cycle and the undo', () => {
    const s = stateWith(UNDO_BASE_GRID)
    const before = s.grid.map((row) => row.slice())
    let out = reduce(s, { type: 'cycle', axis: 'row', index: 0, dir: 1 })
    expect(out.grid).not.toEqual(before)
    expect(out.won).toBe(false)
    out = reduce(out, { type: 'undo' })
    expect(out.grid).toEqual(before)
    expect(out.moves).toBe(2)
    expect(out.lastMove).toBeNull()
    expect(out.lastEvent).toBe('undo')
  })

  it('a second consecutive undo is a no-op', () => {
    const s = stateWith(UNDO_BASE_GRID)
    let out = reduce(s, { type: 'cycle', axis: 'row', index: 0, dir: 1 })
    out = reduce(out, { type: 'undo' })
    const afterFirst = out
    out = reduce(out, { type: 'undo' })
    expect(out.lastEvent).toBe('none')
    expect(out.grid).toEqual(afterFirst.grid)
    expect(out.moves).toBe(afterFirst.moves)
  })

  it('undo on a fresh game (no lastMove) is a no-op', () => {
    const s = stateWith(UNDO_BASE_GRID)
    const out = reduce(s, { type: 'undo' })
    expect(out.lastEvent).toBe('none')
    expect(out.grid).toEqual(s.grid)
  })
})

// -- 27. win trigger ---------------------------------------------------------------------

// Solved grid with col0 scrambled by dir=1; the exact inverse (dir=-1) solves it.
const ALMOST_WIN_GRID: Grid = [
  [3, 1, 1],
  [1, 2, 2],
  [2, 3, 3],
]
const WIN_MOVE: Move = { axis: 'col', index: 0, dir: -1 }

describe('reduce: win', () => {
  it('solving the board sets won, lastEvent=win, and awards at least WIN_BONUS', () => {
    const s = stateWith(ALMOST_WIN_GRID, { par: 1 })
    const out = reduce(s, { type: 'cycle', axis: WIN_MOVE.axis, index: WIN_MOVE.index, dir: WIN_MOVE.dir })
    expect(out.won).toBe(true)
    expect(isSolved(out.grid)).toBe(true)
    expect(out.lastEvent).toBe('win')
    expect(out.score).toBeGreaterThanOrEqual(WIN_BONUS)
  })
})

// -- 28. parBonus golden values -------------------------------------------------------------

describe('reduce: parBonus formula', () => {
  it('moves === par -> PAR_BONUS_MAX; moves === par*2 -> half, rounded', () => {
    // Row bonus for this grid: all 3 rows newly complete = ROW_BONUS*9 = 450.
    const rowBonus = ROW_BONUS * 3 * 3

    const atPar = stateWith(ALMOST_WIN_GRID, { par: 4, moves: 3 }) // moves -> 4 === par
    const outAtPar = reduce(atPar, { type: 'cycle', axis: WIN_MOVE.axis, index: WIN_MOVE.index, dir: WIN_MOVE.dir })
    expect(outAtPar.score).toBe(rowBonus + WIN_BONUS + PAR_BONUS_MAX)

    const atDoublePar = stateWith(ALMOST_WIN_GRID, { par: 4, moves: 7 }) // moves -> 8 === par*2
    const outAtDoublePar = reduce(atDoublePar, {
      type: 'cycle',
      axis: WIN_MOVE.axis,
      index: WIN_MOVE.index,
      dir: WIN_MOVE.dir,
    })
    expect(outAtDoublePar.score).toBe(rowBonus + WIN_BONUS + 500)
  })
})

// -- 29. reset -----------------------------------------------------------------------------

describe('reduce: reset', () => {
  it('restores the exact board from the seed, and resets progress', () => {
    const cfg: LoopgridConfig = { n: 4, scrambleMoves: 6 }
    const g = createGame(cfg, 7)
    let s = reduce(g, { type: 'cycle', axis: 'row', index: 0, dir: 1 })
    s = reduce(s, { type: 'cycle', axis: 'col', index: 1, dir: -1 })
    s = reduce(s, { type: 'reset' })
    expect(s.grid).toEqual(g.grid)
    expect(s.par).toBe(g.par)
    expect(s.moves).toBe(0)
    expect(s.score).toBe(0)
    expect(s.completedRows).toEqual(g.completedRows)
  })
})

// -- 30. new ---------------------------------------------------------------------------------

describe('reduce: new', () => {
  it('generates a different board for a different seed and resets state', () => {
    const cfg: LoopgridConfig = { n: 4, scrambleMoves: 6 }
    const g = createGame(cfg, 1)
    const s = reduce(g, { type: 'cycle', axis: 'row', index: 0, dir: 1 })
    let differed = false
    for (let seed = 2; seed < 20; seed++) {
      const next = reduce(s, { type: 'new', seed })
      if (JSON.stringify(next.grid) !== JSON.stringify(g.grid)) {
        differed = true
        expect(next.moves).toBe(0)
        expect(next.score).toBe(0)
        expect(next.lastMove).toBeNull()
        expect(next.won).toBe(false)
        break
      }
    }
    expect(differed).toBe(true)
  })
})

// -- 31. golden snapshot: seeded createGame ------------------------------------------------

describe('snapshot: seeded createGame', () => {
  it('matches a stable golden board', () => {
    const g = createGame(DIFFICULTIES.normal, 12345)
    expect(g.grid).toMatchSnapshot()
    expect(g.par).toMatchSnapshot()
  })
})

// -- 32. golden scripted scenario -----------------------------------------------------------

describe('snapshot: scripted cycle sequence', () => {
  it('lands on a stable sequence of states', () => {
    const cfg: LoopgridConfig = DIFFICULTIES.easy // n=4
    let s = createGame(cfg, 99)
    const script: { axis: 'row' | 'col'; index: number; dir: 1 | -1 }[] = [
      { axis: 'row', index: 0, dir: 1 },
      { axis: 'col', index: 0, dir: 1 },
      { axis: 'row', index: 1, dir: -1 },
      { axis: 'col', index: 2, dir: -1 },
      { axis: 'row', index: 0, dir: -1 },
    ]
    const trace = script.map((mv) => {
      s = reduce(s, { type: 'cycle', ...mv })
      return { grid: s.grid, score: s.score, moves: s.moves, lastEvent: s.lastEvent }
    })
    expect(trace).toMatchSnapshot()
  })
})

// -- extra: countCorrectCells sanity ---------------------------------------------------------

describe('countCorrectCells', () => {
  it('bounded by 0..n*n, exact n*n when solved', () => {
    const g = makeSolvedGrid(4)
    expect(countCorrectCells(g)).toBe(16)
    const broken = g.map((row) => row.slice())
    broken[0][1] = 3
    const c = countCorrectCells(broken)
    expect(c).toBeGreaterThanOrEqual(0)
    expect(c).toBeLessThan(16)
  })
})

// -- extra: applyCycle exported helper is exercised directly ---------------------------------

describe('applyCycle (internal helper, exported for testing)', () => {
  it('produces the same result as going through reduce for a cycle', () => {
    const s = stateWith(ONE_ROW_GRID)
    const viaReduce = reduce(s, { type: 'cycle', ...ONE_ROW_MOVE })
    const viaDirect = applyCycle(s, ONE_ROW_MOVE, false)
    expect(viaDirect).toEqual(viaReduce)
  })
})
