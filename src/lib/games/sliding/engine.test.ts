import { describe, expect, it } from 'vitest'
import {
  CELLS,
  SIZE,
  areAdjacent,
  inversions,
  isSolvable,
  isSolved,
  move,
  neighborForDirection,
  newGame,
  solvedTiles,
  type SlidingState,
} from './engine'

const S = (tiles: number[], moves = 0): SlidingState => ({
  tiles: [...tiles],
  moves,
  solved: false,
})

const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]

describe('solvedTiles / isSolved', () => {
  it('goal arrangement is 1..15 then empty', () => {
    expect(solvedTiles()).toEqual(SOLVED)
    expect(solvedTiles()).toHaveLength(CELLS)
  })
  it('isSolved is true only for the goal arrangement', () => {
    expect(isSolved(S(SOLVED))).toBe(true)
    expect(isSolved(S([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15]))).toBe(false)
  })
})

describe('adjacency', () => {
  it('horizontal and vertical neighbours are adjacent', () => {
    expect(areAdjacent(5, 6)).toBe(true) // same row
    expect(areAdjacent(5, 9)).toBe(true) // same col
  })
  it('diagonal, distant, and wrap-around cells are not adjacent', () => {
    expect(areAdjacent(5, 10)).toBe(false) // diagonal
    expect(areAdjacent(3, 4)).toBe(false) // row wrap (col 3 -> col 0)
    expect(areAdjacent(5, 5)).toBe(false) // self
  })
})

describe('move — tile clicks', () => {
  it('sliding an adjacent tile swaps it with the gap and counts the move', () => {
    // gap at index 15; tile 15 sits at index 14 (adjacent). Click it.
    const before = S([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0])
    const after = move(before, 15)
    expect(after.tiles).toEqual(SOLVED.slice(0, 14).concat([0, 15]))
    expect(after.moves).toBe(1)
    expect(after.solved).toBe(false)
  })
  it('a non-adjacent tile click is illegal: same state, no move counted', () => {
    const before = S(SOLVED, 3)
    expect(move(before, 1)).toBe(before) // tile 1 is far from the gap
    expect(move(before, 1).moves).toBe(3)
  })
  it('a completing slide flips solved to true', () => {
    // one move from solved: tile 15 at the corner, gap at index 14
    const oneAway = S([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15])
    const done = move(oneAway, 15)
    expect(isSolved(done)).toBe(true)
    expect(done.solved).toBe(true)
    expect(done.moves).toBe(1)
  })
})

describe('move — directions', () => {
  it('neighborForDirection resolves the sliding tile relative to the gap', () => {
    // gap at index 5 (row 1, col 1)
    expect(neighborForDirection(5, 'up')).toBe(9) // tile below
    expect(neighborForDirection(5, 'down')).toBe(1) // tile above
    expect(neighborForDirection(5, 'left')).toBe(6) // tile to the right
    expect(neighborForDirection(5, 'right')).toBe(4) // tile to the left
  })
  it('a direction with no tile to move (gap at edge) is illegal', () => {
    // gap at index 15 (bottom-right corner): nothing below or to the right
    const before = S(SOLVED, 2)
    expect(neighborForDirection(15, 'up')).toBe(-1)
    expect(neighborForDirection(15, 'left')).toBe(-1)
    expect(move(before, 'up')).toBe(before)
    expect(move(before, 'left')).toBe(before)
  })
  it("'down' pulls the tile above the gap into it", () => {
    const before = S([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0])
    // gap at 15, tile 12 at index 11 (directly above)
    const after = move(before, 'down')
    expect(after.tiles[15]).toBe(12)
    expect(after.tiles[11]).toBe(0)
    expect(after.moves).toBe(1)
  })
})

describe('isSolvable', () => {
  it('the solved board is solvable', () => {
    expect(isSolvable(SOLVED)).toBe(true)
    expect(inversions(SOLVED)).toBe(0)
  })
  it('a board one legal move away is solvable', () => {
    expect(isSolvable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15])).toBe(true)
  })
  it('swapping two non-empty tiles (an illegal edit) makes it unsolvable', () => {
    // swap tiles 14 and 15 in the solved board -> parity flips
    const bad = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0]
    expect(isSolvable(bad)).toBe(false)
  })
})

describe('newGame', () => {
  const rngs: Array<[string, () => number]> = [
    ['Math.random', Math.random],
    ['constant 0', () => 0],
    ['constant 0.99', () => 0.99],
    ['sawtooth', (() => { let n = 0; return () => ((n = (n + 0.37) % 1)) })()],
  ]
  it.each(rngs)('produces a solvable, unsolved permutation with %s', (_label, rng) => {
    const s = newGame(rng)
    // every value 0..15 appears exactly once
    expect([...s.tiles].sort((a, b) => a - b)).toEqual(Array.from({ length: CELLS }, (_, i) => i))
    expect(isSolvable(s.tiles)).toBe(true) // shuffling by legal moves guarantees this
    expect(isSolved(s)).toBe(false)
    expect(s.moves).toBe(0)
    expect(s.solved).toBe(false)
  })
  it('every scramble stays on a 4x4 board', () => {
    const s = newGame(Math.random)
    expect(s.tiles).toHaveLength(SIZE * SIZE)
  })
})
