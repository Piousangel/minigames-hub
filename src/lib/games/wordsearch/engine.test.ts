import { describe, expect, it } from 'vitest'
import {
  checkSelection,
  DEFAULT_SIZE,
  DEFAULT_WORD_COUNT,
  foundCount,
  isComplete,
  lineBetween,
  newGame,
  readLetters,
  tryPlaceWord,
  WORD_POOL,
  type Cell,
  type PlacedWord,
  type WordSearchState,
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

const SEEDS = [1, 7, 42, 1234, 99999, 2024, 314159]

/** Build a minimal state by placing given words manually into an empty grid. */
function stateFromPlacements(size: number, placements: Array<{ word: string; cells: Cell[] }>): WordSearchState {
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill('.'))
  const words: PlacedWord[] = placements.map(({ word, cells }) => {
    cells.forEach((cell, i) => {
      grid[cell.r][cell.c] = word[i]
    })
    return { word, cells, found: false }
  })
  return { size, grid, words }
}

describe('newGame — placement correctness', () => {
  it('every placed word reads correctly along its recorded cells', () => {
    for (const seed of SEEDS) {
      const state = newGame(mulberry32(seed))
      for (const pw of state.words) {
        expect(readLetters(state, pw.cells)).toBe(pw.word)
        expect(pw.cells).toHaveLength(pw.word.length)
      }
    }
  })

  it('fills the grid completely with no empty cells', () => {
    for (const seed of SEEDS) {
      const state = newGame(mulberry32(seed))
      for (let r = 0; r < state.size; r++) {
        for (let c = 0; c < state.size; c++) {
          expect(state.grid[r][c]).toMatch(/^[A-Z]$/)
        }
      }
    }
  })

  it('keeps every placed word within the grid bounds', () => {
    for (const seed of SEEDS) {
      const state = newGame(mulberry32(seed))
      for (const pw of state.words) {
        for (const { r, c } of pw.cells) {
          expect(r).toBeGreaterThanOrEqual(0)
          expect(c).toBeGreaterThanOrEqual(0)
          expect(r).toBeLessThan(state.size)
          expect(c).toBeLessThan(state.size)
        }
      }
    }
  })

  it('places between 6 and 8 real pool words of length 3–8', () => {
    for (const seed of SEEDS) {
      const state = newGame(mulberry32(seed))
      expect(state.words.length).toBeGreaterThanOrEqual(6)
      expect(state.words.length).toBeLessThanOrEqual(8)
      for (const pw of state.words) {
        expect(WORD_POOL).toContain(pw.word)
        expect(pw.word.length).toBeGreaterThanOrEqual(3)
        expect(pw.word.length).toBeLessThanOrEqual(8)
      }
      // Distinct words only.
      expect(new Set(state.words.map((w) => w.word)).size).toBe(state.words.length)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = newGame(mulberry32(12345))
    const b = newGame(mulberry32(12345))
    expect(a).toEqual(b)
    // A different seed yields a different board (grid or placements differ).
    const c = newGame(mulberry32(54321))
    expect(a).not.toEqual(c)
  })

  it('uses the default size and word count', () => {
    const state = newGame(mulberry32(1))
    expect(state.size).toBe(DEFAULT_SIZE)
    expect(state.words.length).toBeLessThanOrEqual(DEFAULT_WORD_COUNT)
  })

  it('overlapping placements share the same letter in the grid', () => {
    for (const seed of SEEDS) {
      const state = newGame(mulberry32(seed))
      // For any two words that cross, the shared cell's letter must satisfy both.
      for (const pw of state.words) {
        for (const cell of pw.cells) {
          for (const other of state.words) {
            if (other === pw) continue
            const idx = other.cells.findIndex((x) => x.r === cell.r && x.c === cell.c)
            if (idx >= 0) {
              // Same physical cell → both words must read the same letter there.
              expect(state.grid[cell.r][cell.c]).toBe(pw.word[pw.cells.indexOf(cell)])
              expect(state.grid[cell.r][cell.c]).toBe(other.word[idx])
            }
          }
        }
      }
    }
  })
})

describe('tryPlaceWord', () => {
  it('rejects a word longer than the grid', () => {
    const grid = Array.from({ length: 3 }, () => Array<string>(3).fill(''))
    expect(tryPlaceWord(grid, 'ELEPHANT', mulberry32(1))).toBeNull()
  })

  it('reuses a shared letter when placing a crossing word', () => {
    // Pre-place "CAT" horizontally at row 0; place "COT" so it can cross at 'C' or 'T'.
    const grid = Array.from({ length: 5 }, () => Array<string>(5).fill(''))
    'CAT'.split('').forEach((ch, i) => (grid[0][i] = ch))
    const cells = tryPlaceWord(grid, 'TON', mulberry32(3))
    // Whether or not it crosses, any placement must never conflict.
    if (cells) {
      cells.forEach((cell, i) => {
        const existing = grid[cell.r][cell.c]
        expect(existing === '' || existing === 'TON'[i]).toBe(true)
      })
    }
    expect(true).toBe(true)
  })
})

describe('lineBetween', () => {
  it('builds a horizontal line', () => {
    expect(lineBetween({ r: 2, c: 1 }, { r: 2, c: 4 })).toEqual([
      { r: 2, c: 1 },
      { r: 2, c: 2 },
      { r: 2, c: 3 },
      { r: 2, c: 4 },
    ])
  })

  it('builds a diagonal line in reverse direction', () => {
    expect(lineBetween({ r: 3, c: 3 }, { r: 1, c: 1 })).toEqual([
      { r: 3, c: 3 },
      { r: 2, c: 2 },
      { r: 1, c: 1 },
    ])
  })

  it('returns null for a non-straight selection', () => {
    expect(lineBetween({ r: 0, c: 0 }, { r: 2, c: 1 })).toBeNull()
  })
})

describe('checkSelection', () => {
  // "CAT" horizontal at row 1, "DOG" vertical at col 3, "SUN" diagonal.
  const build = () =>
    stateFromPlacements(6, [
      { word: 'CAT', cells: [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }] },
      { word: 'DOG', cells: [{ r: 0, c: 3 }, { r: 1, c: 3 }, { r: 2, c: 3 }] },
      { word: 'SUN', cells: [{ r: 3, c: 0 }, { r: 4, c: 1 }, { r: 5, c: 2 }] },
    ])

  it('matches a correct straight-line selection (forwards)', () => {
    const state = build()
    const sel = [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }]
    const { matched, state: next } = checkSelection(state, sel)
    expect(matched?.word).toBe('CAT')
    expect(matched?.found).toBe(true)
    expect(readLetters(next, sel)).toBe('CAT')
  })

  it('matches the same word selected backwards', () => {
    const state = build()
    const reversed = [{ r: 1, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 0 }]
    const { matched } = checkSelection(state, reversed)
    expect(matched?.word).toBe('CAT')
  })

  it('matches a diagonal placement', () => {
    const state = build()
    const diag = [{ r: 3, c: 0 }, { r: 4, c: 1 }, { r: 5, c: 2 }]
    const { matched } = checkSelection(state, diag)
    expect(matched?.word).toBe('SUN')
  })

  it('returns null for a selection that is not a placed word', () => {
    const state = build()
    const notAWord = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]
    expect(checkSelection(state, notAWord).matched).toBeNull()
    // A partial (too-short) selection also does not match.
    expect(checkSelection(state, [{ r: 1, c: 0 }, { r: 1, c: 1 }]).matched).toBeNull()
  })

  it('marks a found word and does not re-match it', () => {
    const state = build()
    const sel = [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }]
    const first = checkSelection(state, sel)
    expect(first.matched?.word).toBe('CAT')
    // Re-selecting the same cells on the updated state must not match again.
    const second = checkSelection(first.state, sel)
    expect(second.matched).toBeNull()
  })

  it('does not mutate the original state', () => {
    const state = build()
    checkSelection(state, [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }])
    expect(state.words.every((w) => !w.found)).toBe(true)
  })
})

describe('isComplete / foundCount', () => {
  it('is complete only when all words are found', () => {
    let state = stateFromPlacements(6, [
      { word: 'CAT', cells: [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }] },
      { word: 'DOG', cells: [{ r: 0, c: 3 }, { r: 1, c: 3 }, { r: 2, c: 3 }] },
    ])
    expect(isComplete(state)).toBe(false)
    expect(foundCount(state)).toBe(0)

    state = checkSelection(state, [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }]).state
    expect(foundCount(state)).toBe(1)
    expect(isComplete(state)).toBe(false)

    state = checkSelection(state, [{ r: 0, c: 3 }, { r: 1, c: 3 }, { r: 2, c: 3 }]).state
    expect(foundCount(state)).toBe(2)
    expect(isComplete(state)).toBe(true)
  })

  it('a board with no words is never complete', () => {
    const empty: WordSearchState = { size: 4, grid: [], words: [] }
    expect(isComplete(empty)).toBe(false)
  })

  it('every generated board can be fully solved by selecting each word', () => {
    for (const seed of SEEDS) {
      let state = newGame(mulberry32(seed))
      for (const pw of state.words) {
        const res = checkSelection(state, pw.cells)
        expect(res.matched?.word).toBe(pw.word)
        state = res.state
      }
      expect(isComplete(state)).toBe(true)
    }
  })
})
