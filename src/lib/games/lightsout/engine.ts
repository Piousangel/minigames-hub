export const SIZE = 5

/** Number of random legal presses used to scramble a fresh board. */
export const SCRAMBLE_PRESSES = 8

export type Grid = boolean[][] // [row][col], true = light on
export type Rng = () => number

export interface GameState {
  grid: Grid
  moves: number
  solved: boolean
}

/** A fresh grid with every light off. */
export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false))
}

const clone = (grid: Grid): Grid => grid.map((row) => [...row])

/** The cell (row,col) and its orthogonal neighbours that lie on the board. */
export function crossCells(row: number, col: number): Array<[number, number]> {
  const deltas: Array<[number, number]> = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  const out: Array<[number, number]> = []
  for (const [dr, dc] of deltas) {
    const r = row + dr
    const c = col + dc
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) out.push([r, c])
  }
  return out
}

/** Toggle a cell and its orthogonal neighbours on a fresh grid copy. */
export function toggle(grid: Grid, row: number, col: number): Grid {
  const next = clone(grid)
  for (const [r, c] of crossCells(row, col)) {
    next[r][c] = !next[r][c]
  }
  return next
}

/** All lights off = solved. */
export function isSolved(grid: Grid): boolean {
  return grid.every((row) => row.every((cell) => !cell))
}

/**
 * Apply a press: toggle the cell + neighbours and advance the move counter.
 * Pure — never mutates the input state.
 */
export function press(state: GameState, row: number, col: number): GameState {
  if (state.solved) return state
  const grid = toggle(state.grid, row, col)
  return {
    grid,
    moves: state.moves + 1,
    solved: isSolved(grid),
  }
}

/**
 * Produce a SOLVABLE scramble: start from all-off and apply N random legal
 * presses. Because every press is reversible (pressing the same cell twice is
 * the identity), the all-off solution is always reachable. Retries until the
 * board is not already solved so the player always has something to do.
 */
export function newGame(rng: Rng): GameState {
  let grid = emptyGrid()
  // Very unlikely to loop more than once, but guard against a scramble that
  // happens to cancel itself back to all-off.
  for (let attempt = 0; attempt < 100; attempt++) {
    grid = emptyGrid()
    for (let i = 0; i < SCRAMBLE_PRESSES; i++) {
      const row = Math.floor(rng() * SIZE)
      const col = Math.floor(rng() * SIZE)
      grid = toggle(grid, row, col)
    }
    if (!isSolved(grid)) break
  }
  return { grid, moves: 0, solved: false }
}
