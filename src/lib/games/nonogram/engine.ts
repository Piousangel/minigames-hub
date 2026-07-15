// Nonogram (Picross) engine — pure & deterministic.
//
// The player fills grid cells to match a hidden picture. Number clues on each
// row and column give the run-lengths of consecutive filled cells. This module
// holds no React and no Math.random: all randomness is injected via `rng` so
// every generated puzzle is reproducible from a seed. The solution grid is
// immutable — player marks live in a separate `grid`.

export type Rng = () => number

/** Player-mark state of a single cell. */
export const EMPTY = 0
export const FILLED = 1
export const MARKED = 2 // an "X" the player uses to note a cell is definitely blank
export type Cell = typeof EMPTY | typeof FILLED | typeof MARKED

export type Solution = boolean[][] // [row][col], true = part of the picture
export type Clue = number[] // run-lengths; an empty line is [0]

export type Difficulty = 'easy' | 'hard'

/** Grid size per difficulty. */
export const SIZES: Record<Difficulty, number> = { easy: 5, hard: 10 }

/** Fill probability used when generating a random picture. */
const DENSITY: Record<Difficulty, number> = { easy: 0.55, hard: 0.5 }

export interface NonogramState {
  size: number
  difficulty: Difficulty
  /** The hidden picture. Treat as immutable — never mutate in place. */
  solution: Solution
  rowClues: Clue[]
  colClues: Clue[]
  /** Player marks, same dimensions as `solution`. */
  grid: Cell[][]
}

/** An all-empty player grid of the given size. */
export function emptyGrid(size: number): Cell[][] {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(EMPTY))
}

/**
 * Run-length clue for a single line of booleans.
 * `[true,true,false,true]` → `[2,1]`; an all-false line → `[0]`.
 */
export function lineToClue(line: boolean[]): Clue {
  const runs: number[] = []
  let run = 0
  for (const on of line) {
    if (on) {
      run += 1
    } else if (run > 0) {
      runs.push(run)
      run = 0
    }
  }
  if (run > 0) runs.push(run)
  return runs.length > 0 ? runs : [0]
}

/** Derive every row and column clue from a solution grid. */
export function deriveClues(solution: Solution): { rows: Clue[]; cols: Clue[] } {
  const size = solution.length
  const rows = solution.map((row) => lineToClue(row))
  const cols: Clue[] = []
  for (let c = 0; c < size; c++) {
    cols.push(lineToClue(solution.map((row) => row[c])))
  }
  return { rows, cols }
}

/** Randomly generate a solution picture (at least one filled cell). */
export function randomSolution(size: number, rng: Rng, density: number): Solution {
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => rng() < density),
  )
  // Never hand back an all-empty picture — that would be a non-puzzle.
  if (!grid.some((row) => row.some(Boolean))) {
    grid[Math.floor(rng() * size)][Math.floor(rng() * size)] = true
  }
  return grid
}

/** Create a fresh game: random picture + clues derived from it. */
export function newGame(rng: Rng, difficulty: Difficulty = 'easy'): NonogramState {
  const size = SIZES[difficulty]
  const solution = randomSolution(size, rng, DENSITY[difficulty])
  const { rows, cols } = deriveClues(solution)
  return {
    size,
    difficulty,
    solution,
    rowClues: rows,
    colClues: cols,
    grid: emptyGrid(size),
  }
}

/** Immutably set one cell to an explicit value. */
export function setCell(state: NonogramState, r: number, c: number, value: Cell): NonogramState {
  if (state.grid[r][c] === value) return state
  const grid = state.grid.map((row, i) => (i === r ? row.map((v, j) => (j === c ? value : v)) : row))
  return { ...state, grid }
}

/** The next value when cycling a cell: empty → filled → marked-X → empty. */
export function nextInCycle(current: Cell): Cell {
  return current === EMPTY ? FILLED : current === FILLED ? MARKED : EMPTY
}

/** Immutably advance one cell through the empty→filled→marked→empty cycle. */
export function toggleCell(state: NonogramState, r: number, c: number): NonogramState {
  return setCell(state, r, c, nextInCycle(state.grid[r][c]))
}

/**
 * True when the filled cells exactly reproduce the solution.
 * X-marks and empty cells are both treated as "not filled" — a marked cell
 * never counts as filled, so marks can never make or break a win.
 */
export function isSolved(state: NonogramState): boolean {
  const { grid, solution, size } = state
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((grid[r][c] === FILLED) !== solution[r][c]) return false
    }
  }
  return true
}

/** Cells the player filled that are NOT part of the picture (their mistakes). */
export function findMistakes(state: NonogramState): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const { grid, solution, size } = state
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === FILLED && !solution[r][c]) out.push([r, c])
    }
  }
  return out
}

/** Convenience validation helper: does the player have any wrong fill? */
export function hasMistakes(state: NonogramState): boolean {
  return findMistakes(state).length > 0
}

/** The clue currently produced by the player's FILLED cells in a given row. */
export function rowFilledClue(state: NonogramState, r: number): Clue {
  return lineToClue(state.grid[r].map((v) => v === FILLED))
}

/** The clue currently produced by the player's FILLED cells in a given column. */
export function colFilledClue(state: NonogramState, c: number): Clue {
  return lineToClue(state.grid.map((row) => row[c] === FILLED))
}

/** Array equality for clue comparisons. */
export function clueEquals(a: Clue, b: Clue): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}
