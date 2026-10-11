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

// ── Line solver (uniqueness check) ─────────────────────────────────────────
// Line-by-line deduction: for every row/column, enumerate every placement of
// its runs that agrees with what is already known, and fix the cells on which
// all placements agree. Repeat until nothing changes. If every cell gets fixed
// the puzzle has exactly one solution AND a player can reach it by pure logic
// (no guessing) — which is the bar for a fair nonogram.

/** Known-cell state used by the solver: null = undecided. */
type Known = Array<boolean | null>

/**
 * Intersect all placements of `clue` consistent with `known`.
 * Returns the refined line, or null when no placement fits (contradiction).
 */
function solveLine(clue: Clue, known: Known): Known | null {
  const n = known.length
  const runs = clue.length === 1 && clue[0] === 0 ? [] : clue
  // canFill[i][j]: can runs[j..] be placed in cells i..n-1 consistently?
  const memo = new Map<number, boolean>()
  const canEmpty = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (known[k] === true) return false
    return true
  }
  const canRun = (from: number, len: number) => {
    if (from + len > n) return false
    for (let k = from; k < from + len; k++) if (known[k] === false) return false
    return from + len === n || known[from + len] !== true
  }
  const fits = (i: number, j: number): boolean => {
    if (j === runs.length) return canEmpty(i, n)
    if (i >= n) return false
    const key = i * 64 + j
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    let ok = false
    // Option A: cell i is empty, place runs[j..] from i+1.
    if (known[i] !== true && fits(i + 1, j)) ok = true
    // Option B: run j starts at i (followed by a gap unless at the edge).
    if (!ok && canRun(i, runs[j]) && fits(Math.min(n, i + runs[j] + 1), j + 1)) ok = true
    memo.set(key, ok)
    return ok
  }
  if (!fits(0, 0)) return null
  const canBeFilled = Array<boolean>(n).fill(false)
  const canBeEmpty = Array<boolean>(n).fill(false)
  // Walk every reachable (i, j) state forward, recording what each cell can be.
  const seen = new Set<number>()
  const walk = (i: number, j: number) => {
    const key = i * 64 + j
    if (seen.has(key)) return
    seen.add(key)
    if (j === runs.length) {
      for (let k = i; k < n; k++) canBeEmpty[k] = true
      return
    }
    if (known[i] !== true && fits(i + 1, j)) {
      canBeEmpty[i] = true
      walk(i + 1, j)
    }
    const len = runs[j]
    if (canRun(i, len) && fits(Math.min(n, i + len + 1), j + 1)) {
      for (let k = i; k < i + len; k++) canBeFilled[k] = true
      if (i + len < n) canBeEmpty[i + len] = true
      walk(Math.min(n, i + len + 1), j + 1)
    }
  }
  walk(0, 0)
  return known.map((v, k) => (v !== null ? v : canBeFilled[k] && !canBeEmpty[k] ? true : !canBeFilled[k] ? false : null))
}

/**
 * True when the clues derived from `solution` pin down every cell by line
 * logic alone — i.e. the puzzle is unique and solvable without guessing.
 */
export function isLineSolvable(solution: Solution): boolean {
  const size = solution.length
  const { rows, cols } = deriveClues(solution)
  const grid: Known[] = Array.from({ length: size }, () => Array<boolean | null>(size).fill(null))
  let changed = true
  while (changed) {
    changed = false
    for (let r = 0; r < size; r++) {
      const next = solveLine(rows[r], grid[r])
      if (!next) return false
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== next[c]) {
          grid[r][c] = next[c]
          changed = true
        }
      }
    }
    for (let c = 0; c < size; c++) {
      const col = grid.map((row) => row[c])
      const next = solveLine(cols[c], col)
      if (!next) return false
      for (let r = 0; r < size; r++) {
        if (grid[r][c] !== next[r]) {
          grid[r][c] = next[r]
          changed = true
        }
      }
    }
  }
  return grid.every((row) => row.every((v) => v !== null))
}

/** Upper bound on regeneration attempts before accepting a picture anyway. */
const MAX_GEN_ATTEMPTS = 500

/** Create a fresh game: random picture + clues derived from it. */
export function newGame(rng: Rng, difficulty: Difficulty = 'easy'): NonogramState {
  const size = SIZES[difficulty]
  // Re-roll until the picture is uniquely line-solvable. The cap only guards
  // against a pathological rng; isSolved checks clues, so even a fallback
  // picture is always winnable.
  let solution = randomSolution(size, rng, DENSITY[difficulty])
  for (let i = 1; i < MAX_GEN_ATTEMPTS && !isLineSolvable(solution); i++) {
    solution = randomSolution(size, rng, DENSITY[difficulty])
  }
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
 * True when the filled cells satisfy every row and column clue.
 * Judged against the clues, not the hidden picture: a fill that matches all
 * clues is a valid answer even if the picture were ambiguous. X-marks and
 * empty cells are both "not filled", so marks never make or break a win.
 */
export function isSolved(state: NonogramState): boolean {
  const { rowClues, colClues, size } = state
  for (let r = 0; r < size; r++) if (!clueEquals(rowFilledClue(state, r), rowClues[r])) return false
  for (let c = 0; c < size; c++) if (!clueEquals(colFilledClue(state, c), colClues[c])) return false
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
