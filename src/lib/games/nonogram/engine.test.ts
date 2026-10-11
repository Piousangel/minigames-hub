import { describe, expect, it } from 'vitest'
import {
  clueEquals,
  colFilledClue,
  deriveClues,
  EMPTY,
  FILLED,
  findMistakes,
  hasMistakes,
  isSolved,
  isLineSolvable,
  lineToClue,
  MARKED,
  newGame,
  nextInCycle,
  randomSolution,
  rowFilledClue,
  setCell,
  SIZES,
  toggleCell,
  type NonogramState,
  type Solution,
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

/** Build a state from a boolean picture (clues derived from it, empty grid). */
function stateFromSolution(solution: Solution, difficulty: 'easy' | 'hard' = 'easy'): NonogramState {
  const { rows, cols } = deriveClues(solution)
  const size = solution.length
  return {
    size,
    difficulty,
    solution,
    rowClues: rows,
    colClues: cols,
    grid: Array.from({ length: size }, () => Array(size).fill(EMPTY)),
  }
}

// A small known picture:
//   X . X X
//   . . . .
//   X X X .
//   X . . X
const KNOWN: Solution = [
  [true, false, true, true],
  [false, false, false, false],
  [true, true, true, false],
  [true, false, false, true],
]

describe('lineToClue', () => {
  it('splits runs of filled cells into run-lengths', () => {
    expect(lineToClue([true, false, true, true])).toEqual([2 - 1, 2]) // [1,2]
    expect(lineToClue([true, true, false, false, true])).toEqual([2, 1])
  })

  it('an empty line yields [0]', () => {
    expect(lineToClue([false, false, false])).toEqual([0])
  })

  it('a fully filled line yields a single run of its length', () => {
    expect(lineToClue([true, true, true, true])).toEqual([4])
  })
})

describe('deriveClues', () => {
  it('derives row and column clues from a known grid', () => {
    const { rows, cols } = deriveClues(KNOWN)
    expect(rows).toEqual([[1, 2], [0], [3], [1, 1]])
    // columns: c0=X,.,X,X -> [1,2]; c1=.,.,X,. -> [1]; c2=X,.,X,. -> [1,1]; c3=X,.,.,X -> [1,1]
    expect(cols).toEqual([[1, 2], [1], [1, 1], [1, 1]])
  })

  it('an empty row and empty column both derive to [0]', () => {
    const solution: Solution = [
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ]
    const { rows, cols } = deriveClues(solution)
    expect(rows).toEqual([[0], [0], [0]])
    expect(cols).toEqual([[0], [0], [0]])
  })
})

describe('isSolved', () => {
  it('filling exactly the solution cells wins', () => {
    let s = stateFromSolution(KNOWN)
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) if (KNOWN[r][c]) s = setCell(s, r, c, FILLED)
    expect(isSolved(s)).toBe(true)
  })

  it('a wrong extra fill is not solved', () => {
    let s = stateFromSolution(KNOWN)
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) if (KNOWN[r][c]) s = setCell(s, r, c, FILLED)
    // KNOWN[1][1] is empty in the picture — filling it breaks the solution.
    s = setCell(s, 1, 1, FILLED)
    expect(isSolved(s)).toBe(false)
    expect(hasMistakes(s)).toBe(true)
  })

  it('a missing fill is not solved', () => {
    let s = stateFromSolution(KNOWN)
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) if (KNOWN[r][c]) s = setCell(s, r, c, FILLED)
    s = setCell(s, 0, 0, EMPTY) // remove a required cell
    expect(isSolved(s)).toBe(false)
    expect(hasMistakes(s)).toBe(false) // removing a fill is not a wrong-fill mistake
  })

  it('X-marks on non-picture cells do not affect the solved check', () => {
    let s = stateFromSolution(KNOWN)
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        if (KNOWN[r][c]) s = setCell(s, r, c, FILLED)
        else s = setCell(s, r, c, MARKED) // mark every blank with an X
      }
    expect(isSolved(s)).toBe(true)
    expect(hasMistakes(s)).toBe(false)
  })
})

describe('toggleCell / nextInCycle', () => {
  it('cycles empty → filled → marked → empty', () => {
    expect(nextInCycle(EMPTY)).toBe(FILLED)
    expect(nextInCycle(FILLED)).toBe(MARKED)
    expect(nextInCycle(MARKED)).toBe(EMPTY)

    let s = stateFromSolution(KNOWN)
    expect(s.grid[0][0]).toBe(EMPTY)
    s = toggleCell(s, 0, 0)
    expect(s.grid[0][0]).toBe(FILLED)
    s = toggleCell(s, 0, 0)
    expect(s.grid[0][0]).toBe(MARKED)
    s = toggleCell(s, 0, 0)
    expect(s.grid[0][0]).toBe(EMPTY)
  })
})

describe('immutability', () => {
  it('setCell does not mutate the original state or its solution', () => {
    const s = stateFromSolution(KNOWN)
    const gridSnapshot = s.grid.map((row) => [...row])
    const solutionSnapshot = s.solution.map((row) => [...row])
    const next = setCell(s, 2, 2, FILLED)
    expect(next).not.toBe(s)
    expect(next.grid[2][2]).toBe(FILLED)
    expect(s.grid).toEqual(gridSnapshot) // original grid untouched
    expect(s.solution).toEqual(solutionSnapshot) // solution untouched
  })
})

describe('findMistakes', () => {
  it('returns exactly the filled cells that are not part of the picture', () => {
    let s = stateFromSolution(KNOWN)
    s = setCell(s, 0, 0, FILLED) // correct
    s = setCell(s, 1, 1, FILLED) // wrong
    s = setCell(s, 3, 2, FILLED) // wrong
    const mistakes = findMistakes(s)
    expect(mistakes).toContainEqual([1, 1])
    expect(mistakes).toContainEqual([3, 2])
    expect(mistakes).not.toContainEqual([0, 0])
    expect(mistakes).toHaveLength(2)
  })
})

describe('rowFilledClue / colFilledClue', () => {
  it('reflect only FILLED cells and match the target when a line is complete', () => {
    let s = stateFromSolution(KNOWN)
    // Fill row 0 exactly: X . X X
    s = setCell(s, 0, 0, FILLED)
    s = setCell(s, 0, 2, FILLED)
    s = setCell(s, 0, 3, FILLED)
    // An X-mark must not be counted as filled.
    s = setCell(s, 0, 1, MARKED)
    expect(clueEquals(rowFilledClue(s, 0), s.rowClues[0])).toBe(true)
    // Column 1 has only one picture cell (row 2); still empty here.
    expect(colFilledClue(s, 1)).toEqual([0])
  })
})

describe('newGame', () => {
  it('uses the correct size per difficulty and starts empty', () => {
    const easy = newGame(mulberry32(1), 'easy')
    const hard = newGame(mulberry32(1), 'hard')
    expect(easy.size).toBe(SIZES.easy)
    expect(hard.size).toBe(SIZES.hard)
    expect(easy.grid.flat().every((v) => v === EMPTY)).toBe(true)
    expect(isSolved(easy)).toBe(false)
  })

  it('generated puzzle clues match its own solution across seeds', () => {
    for (const seed of [1, 7, 42, 1234, 99999]) {
      for (const diff of ['easy', 'hard'] as const) {
        const g = newGame(mulberry32(seed), diff)
        const { rows, cols } = deriveClues(g.solution)
        expect(g.rowClues).toEqual(rows)
        expect(g.colClues).toEqual(cols)
        // Filling exactly the solution wins the generated puzzle.
        let s = g
        for (let r = 0; r < g.size; r++)
          for (let c = 0; c < g.size; c++) if (g.solution[r][c]) s = setCell(s, r, c, FILLED)
        expect(isSolved(s)).toBe(true)
      }
    }
  })

  it('defaults to easy difficulty', () => {
    expect(newGame(mulberry32(3)).difficulty).toBe('easy')
  })
})

describe('randomSolution', () => {
  it('is deterministic for a given seed and never fully empty', () => {
    const a = randomSolution(5, mulberry32(2024), 0.5)
    const b = randomSolution(5, mulberry32(2024), 0.5)
    expect(a).toEqual(b)
    expect(a.some((row) => row.some(Boolean))).toBe(true)
  })
})

describe('clue-based win (audit: non-unique boards were unwinnable)', () => {
  // Two different pictures share the same clues: the classic 2x2 diagonal pair.
  //   X .      . X
  //   . X  vs  X .   — rows [1],[1], cols [1],[1] for both.
  const DIAG: Solution = [
    [true, false],
    [false, true],
  ]

  it('a fill that satisfies every clue wins even if it differs from the hidden picture', () => {
    let s = stateFromSolution(DIAG)
    s = setCell(s, 0, 1, FILLED)
    s = setCell(s, 1, 0, FILLED)
    expect(isSolved(s)).toBe(true)
  })

  it('isLineSolvable rejects an ambiguous picture and accepts a unique one', () => {
    expect(isLineSolvable(DIAG)).toBe(false)
    expect(isLineSolvable(KNOWN)).toBe(true)
  })

  it('every generated puzzle is uniquely solvable by line logic', () => {
    for (let seed = 1; seed <= 60; seed++) {
      expect(isLineSolvable(newGame(mulberry32(seed), 'easy').solution)).toBe(true)
    }
    for (let seed = 1; seed <= 20; seed++) {
      expect(isLineSolvable(newGame(mulberry32(seed), 'hard').solution)).toBe(true)
    }
  })

  it('newGame stays deterministic per seed', () => {
    expect(newGame(mulberry32(77), 'hard').solution).toEqual(newGame(mulberry32(77), 'hard').solution)
  })
})
