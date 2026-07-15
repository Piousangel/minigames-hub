import { describe, expect, it } from 'vitest'
import {
  CLUE_TARGETS,
  countGivens,
  countSolutions,
  emptyGrid,
  findConflicts,
  generateSolution,
  isComplete,
  isSolved,
  isValidPlacement,
  makePuzzle,
  newGame,
  setCell,
  solve,
  SIZE,
  type Difficulty,
  type Grid,
} from './engine'

/** Deterministic PRNG so every test is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Parse a 81-char string ("." or "0" = blank) into a Grid. */
function parse(s: string): Grid {
  const chars = s.replace(/\s/g, '').split('')
  expect(chars).toHaveLength(81)
  const g = emptyGrid()
  chars.forEach((ch, i) => {
    g[Math.floor(i / 9)][i % 9] = ch === '.' || ch === '0' ? 0 : Number(ch)
  })
  return g
}

/** Assert every row, column and box is a permutation of 1..9. */
function assertFullyValid(grid: Grid) {
  const want = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let r = 0; r < SIZE; r++) {
    expect([...grid[r]].sort((a, b) => a - b)).toEqual(want)
  }
  for (let c = 0; c < SIZE; c++) {
    const col = grid.map((row) => row[c]).sort((a, b) => a - b)
    expect(col).toEqual(want)
  }
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      const box: number[] = []
      for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) box.push(grid[r][c])
      expect(box.sort((a, b) => a - b)).toEqual(want)
    }
  }
}

// A well-known puzzle with a single solution.
const KNOWN_PUZZLE =
  '53..7....' +
  '6..195...' +
  '.98....6.' +
  '8...6...3' +
  '4..8.3..1' +
  '7...2...6' +
  '.6....28.' +
  '...419..5' +
  '....8..79'

describe('generateSolution', () => {
  it('produces a fully valid complete grid (rows/cols/boxes are 1-9)', () => {
    const grid = generateSolution(mulberry32(1))
    expect(isComplete(grid)).toBe(true)
    expect(isSolved(grid)).toBe(true)
    assertFullyValid(grid)
  })

  it('different seeds yield different full grids', () => {
    const a = generateSolution(mulberry32(1))
    const b = generateSolution(mulberry32(999))
    expect(a).not.toEqual(b)
    assertFullyValid(a)
    assertFullyValid(b)
  })
})

describe('isValidPlacement', () => {
  it('rejects a duplicate in the same row', () => {
    const g = emptyGrid()
    g[0][0] = 5
    expect(isValidPlacement(g, 0, 8, 5)).toBe(false)
    expect(isValidPlacement(g, 0, 8, 6)).toBe(true)
  })

  it('rejects a duplicate in the same column', () => {
    const g = emptyGrid()
    g[0][3] = 7
    expect(isValidPlacement(g, 8, 3, 7)).toBe(false)
    expect(isValidPlacement(g, 8, 3, 2)).toBe(true)
  })

  it('rejects a duplicate in the same 3x3 box', () => {
    const g = emptyGrid()
    g[0][0] = 9
    expect(isValidPlacement(g, 2, 2, 9)).toBe(false) // same box
    expect(isValidPlacement(g, 2, 3, 9)).toBe(true) // neighbouring box
  })

  it('ignores the target cell itself and treats 0 as always valid', () => {
    const g = emptyGrid()
    g[4][4] = 3
    expect(isValidPlacement(g, 4, 4, 3)).toBe(true) // validating its own value
    expect(isValidPlacement(g, 4, 4, 0)).toBe(true)
  })
})

describe('solve', () => {
  it('solves a known puzzle to a valid completion', () => {
    const solved = solve(parse(KNOWN_PUZZLE))
    expect(solved).not.toBeNull()
    expect(isSolved(solved as Grid)).toBe(true)
    assertFullyValid(solved as Grid)
  })

  it('returns null for an unsolvable grid', () => {
    const g = emptyGrid()
    g[0][0] = 1
    g[0][1] = 1 // immediate row conflict — no completion exists
    expect(solve(g)).toBeNull()
  })
})

describe('countSolutions', () => {
  it('a proper puzzle has exactly one solution', () => {
    expect(countSolutions(parse(KNOWN_PUZZLE), 2)).toBe(1)
  })

  it('an empty (maximally ambiguous) grid has more than one solution', () => {
    expect(countSolutions(emptyGrid(), 2)).toBe(2) // capped at the limit
    expect(countSolutions(emptyGrid(), 2)).toBeGreaterThan(1)
  })

  it('generated puzzles are uniquely solvable', () => {
    const { puzzle } = newGame('medium', mulberry32(42))
    expect(countSolutions(puzzle, 2)).toBe(1)
  })
})

describe('isComplete / isSolved', () => {
  it('detects completion and rejects an invalid full grid', () => {
    const solution = generateSolution(mulberry32(7))
    expect(isComplete(solution)).toBe(true)
    expect(isSolved(solution)).toBe(true)

    // Swap two cells in a row to break validity while staying complete.
    const broken = setCell(setCell(solution, 0, 0, solution[0][1]), 0, 1, solution[0][0])
    expect(isComplete(broken)).toBe(true)
    expect(isSolved(broken)).toBe(false)
  })

  it('an unfinished grid is not solved', () => {
    const puzzle = parse(KNOWN_PUZZLE)
    expect(isComplete(puzzle)).toBe(false)
    expect(isSolved(puzzle)).toBe(false)
  })
})

describe('findConflicts', () => {
  it('flags exactly the cells that duplicate within a unit', () => {
    const g = emptyGrid()
    g[0][0] = 4
    g[0][5] = 4 // row duplicate → both flagged
    g[3][3] = 8 // lone value → not flagged
    const conflicts = findConflicts(g)
    expect(conflicts.has('0,0')).toBe(true)
    expect(conflicts.has('0,5')).toBe(true)
    expect(conflicts.has('3,3')).toBe(false)
    expect(conflicts.size).toBe(2)
  })
})

describe('setCell immutability', () => {
  it('does not mutate the original grid (givens stay intact)', () => {
    const { puzzle } = newGame('easy', mulberry32(3))
    const snapshot = puzzle.map((row) => [...row])
    // Find a blank cell and fill it via setCell.
    let target: [number, number] | null = null
    for (let r = 0; r < SIZE && !target; r++)
      for (let c = 0; c < SIZE && !target; c++) if (puzzle[r][c] === 0) target = [r, c]
    expect(target).not.toBeNull()
    const [r, c] = target as [number, number]
    const next = setCell(puzzle, r, c, 5)
    expect(next[r][c]).toBe(5)
    expect(puzzle).toEqual(snapshot) // original untouched
    expect(next).not.toBe(puzzle)
  })
})

describe('newGame / difficulty clue counts', () => {
  const cases: Array<[Difficulty, number, number]> = [
    // [difficulty, min clues, max clues]
    ['easy', CLUE_TARGETS.easy, 52],
    ['medium', CLUE_TARGETS.medium, 46],
    ['hard', CLUE_TARGETS.hard, 40],
  ]

  it.each(cases)('%s: puzzle is a valid subset of its solution with clue count in range', (difficulty, min, max) => {
    const { puzzle, solution, difficulty: d } = newGame(difficulty, mulberry32(11))
    expect(d).toBe(difficulty)
    expect(isSolved(solution)).toBe(true)

    // Every clue matches the solution; puzzle solves back to that solution.
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (puzzle[r][c] !== 0) expect(puzzle[r][c]).toBe(solution[r][c])
    expect(solve(puzzle)).toEqual(solution)

    const clues = countGivens(puzzle)
    expect(clues).toBeGreaterThanOrEqual(min)
    expect(clues).toBeLessThanOrEqual(max)
  })

  it('easy keeps more clues than medium, which keeps more than hard', () => {
    const easy = countGivens(newGame('easy', mulberry32(5)).puzzle)
    const medium = countGivens(newGame('medium', mulberry32(5)).puzzle)
    const hard = countGivens(newGame('hard', mulberry32(5)).puzzle)
    expect(easy).toBeGreaterThan(medium)
    expect(medium).toBeGreaterThan(hard)
  })

  it('makePuzzle output stays uniquely solvable across seeds', () => {
    const solution = generateSolution(mulberry32(21))
    for (const seed of [1, 2, 3]) {
      const puzzle = makePuzzle(solution, 'hard', mulberry32(seed))
      expect(countSolutions(puzzle, 2)).toBe(1)
    }
  })
})
