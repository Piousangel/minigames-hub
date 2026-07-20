/**
 * Quadle — pure engine for a Quordle-style 4-board word puzzle.
 *
 * Four hidden 5-letter words sit behind four boards shown at once. Every guess
 * (a legal 5-letter dictionary word) is scored against ALL four boards at the
 * same time (Wordle coloring per board). You get 9 guesses total (the Quordle
 * standard for four boards). A board "locks" the moment a guess equals its
 * answer; win = all four solved within 9 guesses; lose = guesses run out with
 * any board still unsolved.
 *
 * Purity: every function here is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through an injected `Rng`, and is
 * consumed ONLY when generating the puzzle (`generatePuzzle` / `createGame`).
 * The reducer (`submit`) consumes no rng, so every outcome is golden-testable
 * from a fixed seed + a scripted sequence of guesses.
 *
 * The word list is NOT duplicated — answers, validation and scoring are reused
 * wholesale from the Word Guess (Wordle) engine.
 */

import {
  ANSWERS,
  WORD_LENGTH,
  isValidGuess,
  scoreGuess,
  type LetterState,
} from '@/lib/games/wordguess/engine'

export type { LetterState }
export { WORD_LENGTH }

export type Rng = () => number // float in [0,1)

/** Boards shown simultaneously. */
export const BOARDS = 4
/** Total guesses allowed (Quordle: 6 base + one per board beyond the first). */
export const MAX_GUESSES = 9

export type Status = 'playing' | 'won' | 'lost'

export interface QuadleState {
  /** The four hidden answers, lowercased. */
  answers: string[]
  /** Submitted guess words in order, lowercased (≤ MAX_GUESSES). */
  guesses: string[]
  /** Per board: the guess index (0-based) that solved it, else null. */
  solvedAt: (number | null)[]
  status: Status
}

export type QuadleAction =
  | { type: 'submit'; word: string }
  | { type: 'reset'; seed: number }

// -- PRNG (byte-identical to the wordguess/clusters template's mulberry32) ----

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash of a date string 'YYYY-MM-DD' → 32-bit unsigned seed. */
export function dailySeed(dateStr: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// -- Puzzle generation -------------------------------------------------------

/**
 * Pick four DISTINCT answers from the shared answer pool. Consumes the injected
 * rng and nothing else — the only place randomness enters the game. Guards
 * against duplicate picks (a board must never share an answer with another) and
 * against a pathological rng that never advances.
 */
export function generatePuzzle(rng: Rng): string[] {
  const chosen: string[] = []
  const used = new Set<string>()
  let guard = 0
  while (chosen.length < BOARDS && guard < 100000) {
    guard++
    const idx = Math.floor(rng() * ANSWERS.length)
    const w = ANSWERS[Math.min(ANSWERS.length - 1, Math.max(0, idx))]
    if (!used.has(w)) {
      used.add(w)
      chosen.push(w)
    }
  }
  return chosen
}

/** Start a fresh game from a numeric seed (daily or practice). */
export function createGame(seed: number): QuadleState {
  const answers = generatePuzzle(mulberry32(seed))
  return {
    answers,
    guesses: [],
    solvedAt: answers.map(() => null),
    status: 'playing',
  }
}

// -- Reducer -----------------------------------------------------------------

/**
 * Submit a guess against all four boards at once. Returns the SAME state
 * reference (no change) when the game is over or the guess is not a legal
 * dictionary word — so an invalid guess never consumes one of the nine tries,
 * and the caller can detect a rejection by reference equality (to shake/buzz).
 * On a legal guess: append the word, lock any board it newly solves, then
 * recompute status (won when all four are solved, lost once MAX_GUESSES have
 * been used without solving all four).
 */
export function submit(state: QuadleState, guess: string): QuadleState {
  if (state.status !== 'playing') return state
  const word = guess.toLowerCase()
  if (!isValidGuess(word)) return state

  const guesses = [...state.guesses, word]
  const guessIndex = guesses.length - 1
  const solvedAt = state.solvedAt.map((prev, b) => {
    if (prev !== null) return prev
    // "newly solved" = a full all-correct score, i.e. the guess equals the answer.
    return word === state.answers[b].toLowerCase() ? guessIndex : null
  })

  const allSolved = solvedAt.every((s) => s !== null)
  const outOfGuesses = guesses.length >= MAX_GUESSES
  const status: Status = allSolved ? 'won' : outOfGuesses ? 'lost' : 'playing'

  return { ...state, guesses, solvedAt, status }
}

/** Pure reducer over the two actions. `reset` regenerates from a fresh seed. */
export function reduce(state: QuadleState, action: QuadleAction): QuadleState {
  switch (action.type) {
    case 'reset':
      return createGame(action.seed)
    case 'submit':
      return submit(state, action.word)
    default:
      return state
  }
}

// -- Derived helpers (pure, for the component) -------------------------------

/** correct > present > absent — a letter never downgrades once known. */
const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 }

/**
 * The per-row coloring for one board: for each submitted guess, the
 * LetterState[] produced by scoring that guess against that board's answer.
 */
export function boardRows(state: QuadleState, boardIndex: number): LetterState[][] {
  const answer = state.answers[boardIndex]
  return state.guesses.map((g) => scoreGuess(g, answer))
}

/** Best-known state per letter for ONE board (that board's keyboard hint). */
export function boardKeyHints(state: QuadleState, boardIndex: number): Map<string, LetterState> {
  const map = new Map<string, LetterState>()
  const answer = state.answers[boardIndex]
  for (const g of state.guesses) {
    const res = scoreGuess(g, answer)
    for (let i = 0; i < g.length; i++) {
      const letter = g[i]
      const next = res[i]
      const prev = map.get(letter)
      if (!prev || RANK[next] > RANK[prev]) map.set(letter, next)
    }
  }
  return map
}

/**
 * A single MERGED keyboard hint across all four boards. Only unambiguous
 * signals survive the merge: a letter is greyed ('absent') only when it has
 * been guessed and appears in NONE of the four answers. Everything else stays
 * neutral, because 'correct'/'present' differ per board and can't be shown as
 * one color without lying about some board.
 */
export function mergedKeyHints(state: QuadleState): Map<string, LetterState> {
  const guessed = new Set<string>()
  for (const g of state.guesses) for (const ch of g) guessed.add(ch)
  const map = new Map<string, LetterState>()
  for (const letter of guessed) {
    const inAny = state.answers.some((a) => a.toLowerCase().includes(letter))
    if (!inAny) map.set(letter, 'absent')
  }
  return map
}

/** True when board `boardIndex` has been solved (locked). */
export function isBoardSolved(state: QuadleState, boardIndex: number): boolean {
  return state.solvedAt[boardIndex] !== null
}

/** Number of guesses submitted so far. */
export function guessesUsed(state: QuadleState): number {
  return state.guesses.length
}

/** Number of boards solved so far (0..BOARDS). */
export function solvedCount(state: QuadleState): number {
  return state.solvedAt.reduce<number>((n, s) => n + (s !== null ? 1 : 0), 0)
}

/**
 * Higher is better. A win rewards speed (fewer guesses → bigger bonus); a
 * non-win is scored purely on boards solved. Zero before any progress. Stored
 * in `best:<slug>` as a PLAIN number string — never JSON.
 */
export function score(state: QuadleState): number {
  if (state.status === 'won') {
    return 1000 + (MAX_GUESSES - guessesUsed(state)) * 100
  }
  return solvedCount(state) * 150
}
