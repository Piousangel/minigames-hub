/**
 * Loopgrid — pure engine.
 *
 * An N×N Möbius grid puzzle. A color is an integer 1..N whose value IS the
 * answer row index+1: `grid[r][c] === r+1` means the cell is correctly
 * placed, and the board is solved when every row is monochrome in its own
 * color. There are no empty cells and no "invalid" cell states — the only
 * operation is cycling (rotating) an entire row or column by one step, wrap-
 * ping the end value back to the start. Because every cycle is a bijection
 * on the row/column, `invertMove` is always the exact inverse: undo is just
 * re-applying the same axis+index with the opposite direction.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, used
 * solely in board generation. The reducer's cycle/undo/win logic consumes no
 * rng, so every score / completion / win outcome is golden-testable from a
 * fixed script.
 */

export type Rng = () => number // returns a float in [0,1)
export type Color = number // 1..N; value === answer row index + 1
export type Grid = Color[][] // grid[r][c], row-major, always N×N

export type Axis = 'row' | 'col'
export type Dir = 1 | -1
// row: dir=1 -> cycles right (each cell takes its left neighbor's value, the
//   rightmost wraps in from the left edge). dir=-1 -> cycles left.
// col: dir=1 -> cycles down (each cell takes its upper neighbor's value, the
//   bottom wraps in from the top edge). dir=-1 -> cycles up.
// Row and col share the same sign convention: dir=1 is a "rotate right/down
// by one" (content moves toward the higher index, wrapping at the end).

export interface Move {
  axis: Axis
  index: number // 0..n-1
  dir: Dir
}

export interface LoopgridConfig {
  n: number // grid side length = number of colors, 4..6
  scrambleMoves: number // random cycles applied at generation time (par upper bound)
}

export type LoopgridEvent =
  | 'none'
  | 'cycle' // ordinary cycle, no row newly completed
  | 'rowComplete' // exactly one row newly completed by this cycle
  | 'combo' // two or more rows newly completed by the same cycle
  | 'undo' // the last move's inverse was reapplied
  | 'win'

export interface LoopgridState {
  config: LoopgridConfig
  seed: number
  grid: Grid
  moves: number // total cycles applied (undo counts too — it's a real cycle)
  par: number
  score: number
  completedRows: boolean[] // length n; true once row r has ever been correct (sticky)
  lastMove: Move | null // the move just applied; null right after an undo
  won: boolean
  lastEvent: LoopgridEvent
  lastNewlyCompleted: number[] // row indices newly completed by the last action
}

export type LoopgridAction =
  | { type: 'cycle'; axis: Axis; index: number; dir: Dir }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

/** Identical impl to the template's mulberry32. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEFAULT_N = 5
export const ROW_BONUS = 50
export const WIN_BONUS = 1000
export const PAR_BONUS_MAX = 1000
export const MAX_GEN_ATTEMPTS = 30 // seed retries if a scramble lands already-solved

export const DIFFICULTIES = {
  easy: { n: 4, scrambleMoves: 14 },
  normal: { n: 5, scrambleMoves: 22 },
  hard: { n: 6, scrambleMoves: 32 },
} satisfies Record<'easy' | 'normal' | 'hard', LoopgridConfig>

export const DAILY_CONFIG: LoopgridConfig = DIFFICULTIES.normal

// -- Pure primitives --------------------------------------------------------

/** grid[r][c] === r+1 for every r,c. */
export function makeSolvedGrid(n: number): Grid {
  return Array.from({ length: n }, (_, r) => Array<Color>(n).fill(r + 1))
}

function rotateRight<T>(arr: T[]): T[] {
  const n = arr.length
  if (n === 0) return arr.slice()
  return arr.map((_, i) => arr[(i - 1 + n) % n])
}

function rotateLeft<T>(arr: T[]): T[] {
  const n = arr.length
  if (n === 0) return arr.slice()
  return arr.map((_, i) => arr[(i + 1) % n])
}

/** Cycle row `r` in place-ish (returns a new grid); other rows unchanged. */
export function cycleRow(grid: Grid, r: number, dir: Dir): Grid {
  return grid.map((row, ri) => (ri === r ? (dir === 1 ? rotateRight(row) : rotateLeft(row)) : row.slice()))
}

/** Cycle column `c` (returns a new grid); other columns unchanged. */
export function cycleCol(grid: Grid, c: number, dir: Dir): Grid {
  const col = grid.map((row) => row[c])
  const newCol = dir === 1 ? rotateRight(col) : rotateLeft(col)
  return grid.map((row, ri) => {
    const newRow = row.slice()
    newRow[c] = newCol[ri]
    return newRow
  })
}

export function applyMove(grid: Grid, move: Move): Grid {
  return move.axis === 'row' ? cycleRow(grid, move.index, move.dir) : cycleCol(grid, move.index, move.dir)
}

export function invertMove(move: Move): Move {
  return { axis: move.axis, index: move.index, dir: (-move.dir) as Dir }
}

export function isValidMove(
  n: number,
  m: { axis: unknown; index: number; dir: unknown },
): m is Move {
  if (m.axis !== 'row' && m.axis !== 'col') return false
  if (!Number.isInteger(m.index) || m.index < 0 || m.index >= n) return false
  if (m.dir !== 1 && m.dir !== -1) return false
  return true
}

export function isRowCorrect(grid: Grid, r: number): boolean {
  const row = grid[r]
  for (let c = 0; c < row.length; c++) if (row[c] !== r + 1) return false
  return true
}

export function isSolved(grid: Grid): boolean {
  for (let r = 0; r < grid.length; r++) if (!isRowCorrect(grid, r)) return false
  return true
}

export function countCorrectCells(grid: Grid): number {
  let count = 0
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]
    for (let c = 0; c < row.length; c++) if (row[c] === r + 1) count++
  }
  return count
}

// -- Board generation via random cycles --------------------------------------

/**
 * Build a board by applying `cfg.scrambleMoves` random cycles to a solved
 * grid. Each attempt consumes exactly 3 rng draws in a fixed order (axis,
 * index, dir) regardless of whether the resulting move is applied, so the
 * whole sequence is reproducible from `seed` alone. A candidate that is the
 * exact inverse of the immediately preceding applied move is discarded
 * (rng already consumed, no reroll) to avoid a pointless A->A round trip.
 */
export function generateGrid(cfg: LoopgridConfig, rng: Rng): { grid: Grid; movesApplied: number } {
  const n = cfg.n
  let grid = makeSolvedGrid(n)
  let applied = 0
  let attempts = 0
  let lastMove: Move | null = null
  const maxAttempts = cfg.scrambleMoves * 20

  while (applied < cfg.scrambleMoves && attempts < maxAttempts) {
    attempts++
    const axis: Axis = rng() < 0.5 ? 'row' : 'col'
    const index = Math.floor(rng() * n)
    const dir: Dir = rng() < 0.5 ? -1 : 1
    const move: Move = { axis, index, dir }

    if (lastMove && lastMove.axis === move.axis && lastMove.index === move.index && lastMove.dir === -move.dir) {
      continue // exact inverse of the previous move: skip, attempt still spent
    }

    grid = applyMove(grid, move)
    lastMove = move
    applied++
  }

  return { grid, movesApplied: applied }
}

export function createGame(cfg: LoopgridConfig, seed: number): LoopgridState {
  let useSeed = seed
  let result = generateGrid(cfg, mulberry32(useSeed))
  let attempts = 0
  while (isSolved(result.grid) && attempts < MAX_GEN_ATTEMPTS) {
    useSeed = (useSeed + 1) >>> 0
    result = generateGrid(cfg, mulberry32(useSeed))
    attempts++
  }

  const n = cfg.n
  const completedRows = Array.from({ length: n }, (_, r) => isRowCorrect(result.grid, r))

  return {
    config: cfg,
    seed,
    grid: result.grid,
    moves: 0,
    par: Math.max(1, result.movesApplied),
    score: 0,
    completedRows,
    lastMove: null,
    won: false,
    lastEvent: 'none',
    lastNewlyCompleted: [],
  }
}

// -- Reducer ------------------------------------------------------------------

/**
 * Shared core for both `cycle` and `undo`: apply `move` to the grid, tally
 * newly-completed rows (sticky — never re-awarded), and detect the win.
 * `isUndo` only affects the reported `lastEvent` (forced to `'undo'`) and
 * `lastMove` (cleared to null) — scoring is otherwise symmetric, and a win
 * always takes priority over the undo label if the resulting grid happens
 * to be solved.
 */
export function applyCycle(state: LoopgridState, move: Move, isUndo: boolean): LoopgridState {
  const nextGrid = applyMove(state.grid, move)
  const moves = state.moves + 1
  const n = state.config.n

  const newlyCompleted: number[] = []
  for (let r = 0; r < n; r++) {
    if (!state.completedRows[r] && isRowCorrect(nextGrid, r)) newlyCompleted.push(r)
  }
  const completedRows = state.completedRows.slice()
  for (const r of newlyCompleted) completedRows[r] = true

  const m = newlyCompleted.length
  const bonus = m > 0 ? ROW_BONUS * m * m : 0
  let score = state.score + bonus

  const solved = isSolved(nextGrid)
  let event: LoopgridEvent
  if (solved) {
    const parBonus = Math.round(PAR_BONUS_MAX * Math.min(1, state.par / Math.max(1, moves)))
    score += WIN_BONUS + parBonus
    event = 'win'
  } else {
    event = isUndo ? 'undo' : m >= 2 ? 'combo' : m === 1 ? 'rowComplete' : 'cycle'
  }

  return {
    ...state,
    grid: nextGrid,
    moves,
    score,
    completedRows,
    lastMove: isUndo ? null : move,
    won: solved,
    lastEvent: event,
    lastNewlyCompleted: newlyCompleted,
  }
}

export function reduce(state: LoopgridState, action: LoopgridAction): LoopgridState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    case 'cycle': {
      if (state.won) return { ...state, lastEvent: 'none' }
      const candidate = { axis: action.axis, index: action.index, dir: action.dir }
      if (!isValidMove(state.config.n, candidate)) return { ...state, lastEvent: 'none' }
      return applyCycle(state, candidate, false)
    }
    case 'undo': {
      if (state.won) return { ...state, lastEvent: 'none' }
      if (state.lastMove === null) return { ...state, lastEvent: 'none' }
      return applyCycle(state, invertMove(state.lastMove), true)
    }
    default:
      return state
  }
}
