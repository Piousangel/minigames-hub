export const SIZE = 4
export const CELLS = SIZE * SIZE // 16

export type Direction = 'up' | 'down' | 'left' | 'right'
export type Rng = () => number

/**
 * Sliding puzzle (15-puzzle) state.
 *
 * `tiles` is a flat length-16 array indexed by `row * SIZE + col`.
 * Values 1..15 are the numbered tiles; `0` is the empty slot.
 * The solved arrangement is `[1, 2, …, 15, 0]`.
 */
export interface SlidingState {
  tiles: number[]
  moves: number
  solved: boolean
}

/** The goal arrangement: 1..15 in order followed by the empty slot. */
export const solvedTiles = (): number[] => Array.from({ length: CELLS }, (_, i) => (i + 1) % CELLS)

const rowOf = (index: number): number => Math.floor(index / SIZE)
const colOf = (index: number): number => index % SIZE

/** Two board indices are adjacent when they share a row/col and touch. */
export function areAdjacent(a: number, b: number): boolean {
  const dr = Math.abs(rowOf(a) - rowOf(b))
  const dc = Math.abs(colOf(a) - colOf(b))
  return dr + dc === 1
}

/** Indices orthogonally adjacent to `index` on the board. */
export function neighborsOf(index: number): number[] {
  const r = rowOf(index)
  const c = colOf(index)
  const out: number[] = []
  if (r > 0) out.push(index - SIZE)
  if (r < SIZE - 1) out.push(index + SIZE)
  if (c > 0) out.push(index - 1)
  if (c < SIZE - 1) out.push(index + 1)
  return out
}

/**
 * The tile index that slides into the empty slot for a given direction.
 * A direction is the direction the *tile travels*, e.g. `'up'` slides the tile
 * directly below the gap upward. Returns -1 when no tile can move that way.
 */
export function neighborForDirection(empty: number, dir: Direction): number {
  const r = rowOf(empty)
  const c = colOf(empty)
  switch (dir) {
    case 'up':
      return r < SIZE - 1 ? empty + SIZE : -1 // tile below moves up
    case 'down':
      return r > 0 ? empty - SIZE : -1 // tile above moves down
    case 'left':
      return c < SIZE - 1 ? empty + 1 : -1 // tile to the right moves left
    case 'right':
      return c > 0 ? empty - 1 : -1 // tile to the left moves right
  }
}

const tilesSolved = (tiles: number[]): boolean => {
  for (let i = 0; i < CELLS; i++) if (tiles[i] !== (i + 1) % CELLS) return false
  return true
}

export function isSolved(state: SlidingState): boolean {
  return tilesSolved(state.tiles)
}

/**
 * Apply a move. `tileOrDir` is either a tile value (1..15) to slide into the
 * gap, or a `Direction`. Illegal moves (non-adjacent tile, or a direction with
 * no tile to move) return the same state reference — the move counter only
 * advances on a legal slide.
 */
export function move(state: SlidingState, tileOrDir: number | Direction): SlidingState {
  const empty = state.tiles.indexOf(0)
  let tileIndex: number
  if (typeof tileOrDir === 'number') {
    tileIndex = state.tiles.indexOf(tileOrDir)
    if (tileIndex < 0 || !areAdjacent(tileIndex, empty)) return state
  } else {
    tileIndex = neighborForDirection(empty, tileOrDir)
    if (tileIndex < 0) return state
  }
  const tiles = state.tiles.slice()
  tiles[empty] = tiles[tileIndex]
  tiles[tileIndex] = 0
  return { tiles, moves: state.moves + 1, solved: tilesSolved(tiles) }
}

/** Inversion count over the numbered tiles (empty ignored). */
export function inversions(tiles: number[]): number {
  const arr = tiles.filter((v) => v !== 0)
  let inv = 0
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] > arr[j]) inv++
    }
  }
  return inv
}

/**
 * Parity solvability test for a 4-wide board. With an even width the puzzle is
 * solvable iff the blank's row counted from the bottom (1-indexed) and the
 * inversion count have opposite parity.
 */
export function isSolvable(tiles: number[]): boolean {
  const inv = inversions(tiles)
  const emptyRowFromBottom = SIZE - rowOf(tiles.indexOf(0))
  return (emptyRowFromBottom % 2 === 0) === (inv % 2 === 1)
}

/**
 * Produce a solvable, shuffled game by walking the empty slot through random
 * legal moves from the solved board. Building the scramble out of real moves
 * guarantees solvability without any parity repair, and we never undo the
 * previous step so the walk keeps making progress. Guarantees the result is not
 * already solved.
 */
export function newGame(rng: Rng): SlidingState {
  const tiles = solvedTiles()
  let empty = CELLS - 1
  let prev = -1
  const steps = 200
  for (let n = 0; n < steps; n++) {
    const options = neighborsOf(empty).filter((i) => i !== prev)
    const pick = options[Math.floor(rng() * options.length) % options.length]
    tiles[empty] = tiles[pick]
    tiles[pick] = 0
    prev = empty
    empty = pick
  }
  // Extremely unlikely, but never hand back a solved board.
  let guard = 0
  while (tilesSolved(tiles) && guard < CELLS) {
    const options = neighborsOf(empty).filter((i) => i !== prev)
    const pick = options[guard % options.length]
    tiles[empty] = tiles[pick]
    tiles[pick] = 0
    prev = empty
    empty = pick
    guard++
  }
  return { tiles, moves: 0, solved: false }
}
