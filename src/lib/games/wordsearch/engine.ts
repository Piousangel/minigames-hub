// Word Search engine — pure & deterministic.
//
// The player finds hidden words in a square grid of letters by dragging a
// straight line (horizontal, vertical, or 45° diagonal, in either direction)
// across the letters that spell a word. This module holds no React and no
// Math.random: all randomness is injected via `rng`, so every generated board
// is reproducible from a seed. Words are placed first (sharing letters where
// they cross), then the remaining cells are filled with random letters.

export type Rng = () => number

/** A single grid coordinate. */
export interface Cell {
  r: number
  c: number
}

/** A word placed on the board, with the exact cells it occupies (start→end). */
export interface PlacedWord {
  word: string
  cells: Cell[]
  found: boolean
}

export interface WordSearchState {
  size: number
  /** [row][col] uppercase letters. Never contains empty cells after newGame. */
  grid: string[][]
  words: PlacedWord[]
}

/** The 8 travel directions as [dr, dc]: orthogonal + diagonal, both ways. */
export const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // right
  [0, -1], // left
  [1, 0], // down
  [-1, 0], // up
  [1, 1], // down-right
  [1, -1], // down-left
  [-1, 1], // up-right
  [-1, -1], // up-left
]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const EMPTY = ''

export const DEFAULT_SIZE = 11
export const DEFAULT_WORD_COUNT = 7

/**
 * Themed word sets. Kept short (3–8 letters, A–Z only) so any word fits a
 * ~10–12 grid. A fresh board draws from the combined pool.
 */
export const THEMES: Record<string, string[]> = {
  animals: ['CAT', 'DOG', 'LION', 'TIGER', 'HORSE', 'MOUSE', 'PANDA', 'ZEBRA', 'SNAKE', 'EAGLE', 'SHARK', 'WHALE', 'OTTER', 'FOX', 'WOLF'],
  food: ['BREAD', 'APPLE', 'MANGO', 'LEMON', 'GRAPE', 'PIZZA', 'PASTA', 'HONEY', 'OLIVE', 'PEACH', 'BERRY', 'CANDY', 'CREAM', 'TOAST'],
  space: ['STAR', 'MOON', 'COMET', 'ORBIT', 'SOLAR', 'PLANET', 'GALAXY', 'ROCKET', 'METEOR', 'NEBULA', 'COSMOS', 'LUNAR'],
  nature: ['RIVER', 'OCEAN', 'FOREST', 'MEADOW', 'CANYON', 'DESERT', 'ISLAND', 'VALLEY', 'BREEZE', 'CLOUD', 'STORM', 'FLOWER', 'GARDEN', 'PEBBLE'],
  color: ['RED', 'BLUE', 'GREEN', 'AMBER', 'CORAL', 'IVORY', 'OLIVE', 'PLUM', 'TEAL', 'GOLD', 'VIOLET', 'INDIGO'],
  tech: ['CODE', 'BYTE', 'PIXEL', 'CLOUD', 'ROBOT', 'LASER', 'CABLE', 'MODEM', 'ARRAY', 'CACHE', 'LOGIC', 'INPUT', 'DEBUG'],
  misc: ['MUSIC', 'DANCE', 'DREAM', 'LIGHT', 'MAGIC', 'PUZZLE', 'RIDDLE', 'SECRET', 'WONDER', 'BRIGHT', 'SPARK', 'GLOW'],
}

/** The flat pool of every themed word, de-duplicated. */
export const WORD_POOL: string[] = Array.from(new Set(Object.values(THEMES).flat()))

/** Fisher–Yates shuffle using the injected rng (non-mutating). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Inclusive integer in [min, max] from the rng. */
function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/**
 * The straight line of cells from `start` to `end`, inclusive, when they lie on
 * a horizontal, vertical, or 45° diagonal line. Returns null otherwise. Used by
 * the UI to turn a drag (first letter → last letter) into a selection.
 */
export function lineBetween(start: Cell, end: Cell): Cell[] | null {
  const dRow = end.r - start.r
  const dCol = end.c - start.c
  const rowDist = Math.abs(dRow)
  const colDist = Math.abs(dCol)
  // Must be orthogonal or a perfect diagonal.
  if (!(rowDist === 0 || colDist === 0 || rowDist === colDist)) return null
  const len = Math.max(rowDist, colDist) + 1
  const stepR = Math.sign(dRow)
  const stepC = Math.sign(dCol)
  const cells: Cell[] = []
  for (let i = 0; i < len; i++) {
    cells.push({ r: start.r + stepR * i, c: start.c + stepC * i })
  }
  return cells
}

/** The valid start-index range along one axis so a word of `len` stays in bounds. */
function startRange(step: number, size: number, len: number): [number, number] {
  if (step === 0) return [0, size - 1]
  if (step > 0) return [0, size - len]
  return [len - 1, size - 1]
}

/**
 * Attempt to place `word` into `grid`. Tries random directions/positions; a
 * placement is valid only if every cell is empty or already holds the same
 * letter (so crossing words share letters). Returns the placed cells, or null.
 */
export function tryPlaceWord(grid: string[][], word: string, rng: Rng, attempts = 100): Cell[] | null {
  const size = grid.length
  const len = word.length
  if (len > size) return null

  for (let a = 0; a < attempts; a++) {
    const [dr, dc] = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length)]
    const [rLo, rHi] = startRange(dr, size, len)
    const [cLo, cHi] = startRange(dc, size, len)
    if (rLo > rHi || cLo > cHi) continue
    const r0 = randInt(rng, rLo, rHi)
    const c0 = randInt(rng, cLo, cHi)

    const cells: Cell[] = []
    let ok = true
    for (let i = 0; i < len; i++) {
      const r = r0 + dr * i
      const c = c0 + dc * i
      const existing = grid[r][c]
      if (existing !== EMPTY && existing !== word[i]) {
        ok = false
        break
      }
      cells.push({ r, c })
    }
    if (ok) return cells
  }
  return null
}

/**
 * Create a fresh board: place `wordCount` distinct words from the pool into a
 * `size`×`size` grid in random directions (sharing letters where they cross),
 * then fill every remaining cell with a random letter.
 */
export function newGame(rng: Rng, size = DEFAULT_SIZE, wordCount = DEFAULT_WORD_COUNT): WordSearchState {
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(EMPTY))
  const pool = shuffle(WORD_POOL, rng).filter((w) => w.length <= size)

  const words: PlacedWord[] = []
  for (const word of pool) {
    if (words.length >= wordCount) break
    const cells = tryPlaceWord(grid, word, rng)
    if (!cells) continue
    cells.forEach((cell, i) => {
      grid[cell.r][cell.c] = word[i]
    })
    words.push({ word, cells, found: false })
  }

  // Fill the leftover cells with random letters.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === EMPTY) grid[r][c] = LETTERS[Math.floor(rng() * LETTERS.length)]
    }
  }

  return { size, grid, words }
}

/** True when two cell sequences are identical (same order). */
function sameCells(a: Cell[], b: Cell[]): boolean {
  return a.length === b.length && a.every((cell, i) => cell.r === b[i].r && cell.c === b[i].c)
}

/** True when `selection` traces a placed word's cells, in either direction. */
function cellsMatch(selection: Cell[], target: Cell[]): boolean {
  return sameCells(selection, target) || sameCells(selection, target.slice().reverse())
}

/** The uppercase letters read along a line of cells in the grid. */
export function readLetters(state: WordSearchState, cells: Cell[]): string {
  return cells.map(({ r, c }) => state.grid[r]?.[c] ?? '').join('')
}

export interface CheckResult {
  /** The (possibly updated) state with the matched word marked found. */
  state: WordSearchState
  /** The word that was matched by this selection, or null. */
  matched: PlacedWord | null
}

/**
 * Check a drag selection (an ordered line of cells, start→end). If it traces a
 * not-yet-found placed word in either direction, that word is marked found and
 * returned. Otherwise `matched` is null and the state is unchanged.
 */
export function checkSelection(state: WordSearchState, cells: Cell[]): CheckResult {
  if (cells.length < 2) return { state, matched: null }
  for (const pw of state.words) {
    if (pw.found) continue
    if (cellsMatch(cells, pw.cells)) {
      const updated: PlacedWord = { ...pw, found: true }
      const words = state.words.map((w) => (w === pw ? updated : w))
      return { state: { ...state, words }, matched: updated }
    }
  }
  return { state, matched: null }
}

/** True when every placed word has been found. */
export function isComplete(state: WordSearchState): boolean {
  return state.words.length > 0 && state.words.every((w) => w.found)
}

/** How many words have been found so far. */
export function foundCount(state: WordSearchState): number {
  return state.words.reduce((n, w) => n + (w.found ? 1 : 0), 0)
}
