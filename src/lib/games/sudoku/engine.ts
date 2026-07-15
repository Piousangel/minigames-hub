/**
 * Sudoku engine — pure & deterministic.
 *
 * All randomness is injected via an `Rng` (a `() => number` in [0, 1)); no pure
 * function here calls `Math.random`, so seeding an RNG makes generation fully
 * reproducible (used by the tests). The board is a flat-friendly `number[][]`
 * (`grid[row][col]`), with `0` meaning an empty cell.
 */

export const SIZE = 9
export const BOX = 3
export const EMPTY = 0

export type Rng = () => number
export type Grid = number[][] // [row][col], 0 = empty
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface SudokuGame {
  /** The starting board shown to the player (givens; 0 = blank). */
  puzzle: Grid
  /** The unique full solution. */
  solution: Grid
  difficulty: Difficulty
}

/** Target number of clues (filled cells) left in the puzzle per difficulty. */
export const CLUE_TARGETS: Record<Difficulty, number> = {
  easy: 43,
  medium: 34,
  hard: 28,
}

export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(EMPTY))
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row])
}

/** Fisher–Yates shuffle into a new array, driven by the injected RNG. */
function shuffled<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Can `val` (1-9) legally go at (row, col)? Checks the row, column and 3×3 box,
 * ignoring the target cell itself (so it works both for placing into an empty
 * cell and for validating an already-filled one). `val === 0` is always valid.
 */
export function isValidPlacement(grid: Grid, row: number, col: number, val: number): boolean {
  if (val === EMPTY) return true
  for (let c = 0; c < SIZE; c++) {
    if (c !== col && grid[row][c] === val) return false
  }
  for (let r = 0; r < SIZE; r++) {
    if (r !== row && grid[r][col] === val) return false
  }
  const boxR = row - (row % BOX)
  const boxC = col - (col % BOX)
  for (let r = boxR; r < boxR + BOX; r++) {
    for (let c = boxC; c < boxC + BOX; c++) {
      if ((r !== row || c !== col) && grid[r][c] === val) return false
    }
  }
  return true
}

/** Immutably set a cell, returning a new grid. Never mutates `grid`. */
export function setCell(grid: Grid, row: number, col: number, val: number): Grid {
  const next = cloneGrid(grid)
  next[row][col] = val
  return next
}

/** Every cell filled (may still be invalid). */
export function isComplete(grid: Grid): boolean {
  return grid.every((row) => row.every((v) => v !== EMPTY))
}

/**
 * The set of filled cells that violate Sudoku rules (row/col/box duplicate),
 * as `"row,col"` keys — used by the UI to flag conflicts in red.
 */
export function findConflicts(grid: Grid): Set<string> {
  const bad = new Set<string>()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c]
      if (v !== EMPTY && !isValidPlacement(grid, r, c, v)) bad.add(`${r},${c}`)
    }
  }
  return bad
}

/** Fully filled AND rule-valid (every row/col/box is a permutation of 1-9). */
export function isSolved(grid: Grid): boolean {
  return isComplete(grid) && findConflicts(grid).size === 0
}

/** Number of filled cells (clues). */
export function countGivens(grid: Grid): number {
  let n = 0
  for (const row of grid) for (const v of row) if (v !== EMPTY) n++
  return n
}

/**
 * Find the empty cell with the fewest legal candidates (MRV heuristic). Returns
 * the cell plus its candidate list, or `null` if the grid is full. If any empty
 * cell has zero candidates, returns that cell with an empty list (a dead end).
 */
function mostConstrained(grid: Grid): { r: number; c: number; cands: number[] } | null {
  let best: { r: number; c: number; cands: number[] } | null = null
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== EMPTY) continue
      const cands: number[] = []
      for (let v = 1; v <= 9; v++) {
        if (isValidPlacement(grid, r, c, v)) cands.push(v)
      }
      if (cands.length === 0) return { r, c, cands }
      if (best === null || cands.length < best.cands.length) {
        best = { r, c, cands }
        if (cands.length === 1) return best
      }
    }
  }
  return best
}

/**
 * Count solutions of `grid`, stopping as soon as `limit` are found (default 2).
 * A return of `1` means the puzzle is uniquely solvable; `>= 2` means ambiguous;
 * `0` means unsolvable. Does not mutate `grid`.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  // Any duplicate among the already-filled cells makes the grid unsolvable.
  // Backtracking never re-checks givens, so without this guard an invalid
  // input triggers a full (exponential) search — detect it up front instead.
  if (findConflicts(grid).size > 0) return 0
  const work = cloneGrid(grid)
  let count = 0

  const search = (): boolean => {
    const spot = mostConstrained(work)
    if (spot === null) {
      count++
      return count >= limit // true → abort further search
    }
    if (spot.cands.length === 0) return false // dead end
    for (const v of spot.cands) {
      work[spot.r][spot.c] = v
      if (search()) {
        work[spot.r][spot.c] = EMPTY
        return true
      }
      work[spot.r][spot.c] = EMPTY
    }
    return false
  }

  search()
  return count
}

/** Solve `grid`, returning a completed copy or `null` if unsolvable. */
export function solve(grid: Grid): Grid | null {
  if (findConflicts(grid).size > 0) return null // invalid givens → unsolvable
  const work = cloneGrid(grid)

  const search = (): boolean => {
    const spot = mostConstrained(work)
    if (spot === null) return true
    if (spot.cands.length === 0) return false
    for (const v of spot.cands) {
      work[spot.r][spot.c] = v
      if (search()) return true
      work[spot.r][spot.c] = EMPTY
    }
    return false
  }

  return search() ? work : null
}

/**
 * Generate a complete, valid 9×9 grid via backtracking, trying candidates in an
 * RNG-shuffled order so different seeds yield different boards.
 */
export function generateSolution(rng: Rng): Grid {
  const grid = emptyGrid()
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  const fill = (pos: number): boolean => {
    if (pos === SIZE * SIZE) return true
    const r = Math.floor(pos / SIZE)
    const c = pos % SIZE
    if (grid[r][c] !== EMPTY) return fill(pos + 1)
    for (const v of shuffled(order, rng)) {
      if (isValidPlacement(grid, r, c, v)) {
        grid[r][c] = v
        if (fill(pos + 1)) return true
        grid[r][c] = EMPTY
      }
    }
    return false
  }

  fill(0)
  return grid
}

/**
 * Carve a puzzle from a full solution by removing cells in RNG-shuffled order,
 * keeping only removals that preserve a UNIQUE solution. Removes down to (but
 * never past) the difficulty's clue target; if uniqueness blocks removals the
 * final clue count may sit slightly above target.
 */
export function makePuzzle(solution: Grid, difficulty: Difficulty, rng: Rng): Grid {
  const target = CLUE_TARGETS[difficulty]
  const puzzle = cloneGrid(solution)
  const positions = shuffled(
    Array.from({ length: SIZE * SIZE }, (_, i) => i),
    rng,
  )
  let clues = SIZE * SIZE

  for (const pos of positions) {
    if (clues <= target) break
    const r = Math.floor(pos / SIZE)
    const c = pos % SIZE
    if (puzzle[r][c] === EMPTY) continue
    const saved = puzzle[r][c]
    puzzle[r][c] = EMPTY
    if (countSolutions(puzzle, 2) === 1) {
      clues--
    } else {
      puzzle[r][c] = saved // removal broke uniqueness — put it back
    }
  }

  return puzzle
}

/** Build a fresh game: a full solution plus a unique-solution puzzle. */
export function newGame(difficulty: Difficulty, rng: Rng): SudokuGame {
  const solution = generateSolution(rng)
  const puzzle = makePuzzle(solution, difficulty, rng)
  return { puzzle, solution, difficulty }
}
