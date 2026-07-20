/**
 * Equate — a Nerdle-style daily "guess the equation" puzzle.
 *
 * A hidden 8-character arithmetic equation (e.g. `13+27=40`) must be guessed in
 * six tries. Each guessed equation is colored Wordle-style, per tile:
 *   green  — right symbol, right spot
 *   purple — symbol is in the answer but in the wrong spot
 *   grey   — symbol not in the answer (accounting for duplicates)
 * A guess is only accepted if it is itself a VALID equation (left side evaluates,
 * with standard operator precedence, to the integer on the right).
 *
 * Purity: every function here is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through an injected `Rng`, and is
 * consumed ONLY when picking the daily equation (`generatePuzzle`). The reducer
 * (submit / new / reset) consumes no rng, so every outcome is golden-testable
 * from a fixed seed. Arithmetic is integer-only; there is no `eval`/`Function`.
 */

export type Rng = () => number // float in [0,1)

/** Per-tile feedback, Wordle-style. */
export type TileState = 'green' | 'purple' | 'grey'

export type Status = 'playing' | 'won' | 'lost'

export interface GameState {
  /** The hidden answer — an 8-char valid equation. */
  answer: string
  /** Submitted valid equations, in order (max MAX_GUESSES). */
  guesses: string[]
  status: Status
}

export const COLS = 8
export const MAX_GUESSES = 6
export const SYMBOLS = '0123456789+-*/='

// -- PRNG (byte-identical to the clusters/wordguess template's mulberry32) ----

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

// -- Equation validation + evaluation ----------------------------------------
// A safe hand-rolled tokenizer + evaluator. NO eval / Function. Integer-only.

const DIGITS = '0123456789'
const OPS = '+-*/'

type Token =
  | { kind: 'num'; value: number; raw: string }
  | { kind: 'op'; op: string }

/**
 * Tokenize one side of an equation (digits + `+ - * /`). Returns null on any
 * malformation: a bad character, an operator at the start/end, two operators in
 * a row, or a multi-digit number with a leading zero.
 */
function tokenizeSide(s: string): Token[] | null {
  if (s.length === 0) return null
  const tokens: Token[] = []
  let i = 0
  let expectNumber = true // an operator may only follow a number
  while (i < s.length) {
    const c = s[i]
    if (DIGITS.includes(c)) {
      if (!expectNumber) return null // number right after a number can't happen (no separators) — but a number after a number means we were mid-number; handled below
      let j = i
      while (j < s.length && DIGITS.includes(s[j])) j++
      const raw = s.slice(i, j)
      if (raw.length > 1 && raw[0] === '0') return null // leading zero in a multi-digit number
      tokens.push({ kind: 'num', value: Number(raw), raw })
      i = j
      expectNumber = false
    } else if (OPS.includes(c)) {
      if (expectNumber) return null // operator at start of side or right after another operator
      tokens.push({ kind: 'op', op: c })
      i++
      expectNumber = true
    } else {
      return null // stray character (space, second '=', etc.)
    }
  }
  if (expectNumber) return null // trailing operator (side ends on an operator)
  return tokens
}

/**
 * Evaluate a tokenized side with standard precedence: `*` and `/` bind tighter
 * than `+` and `-`. Division must be exact (integer result) and never by zero;
 * a non-exact or divide-by-zero returns null. Integer arithmetic throughout.
 */
function evalTokens(tokens: Token[]): number | null {
  // First pass: fold * and / into their left neighbor.
  const folded: Token[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.kind === 'op' && (t.op === '*' || t.op === '/')) {
      const left = folded.pop()
      const right = tokens[i + 1]
      if (!left || left.kind !== 'num' || !right || right.kind !== 'num') return null
      let value: number
      if (t.op === '*') {
        value = left.value * right.value
      } else {
        if (right.value === 0) return null // /0
        if (left.value % right.value !== 0) return null // must divide evenly
        value = left.value / right.value
      }
      folded.push({ kind: 'num', value, raw: '' })
      i++ // consumed the right operand
    } else {
      folded.push(t)
    }
  }
  // Second pass: left-to-right + and -.
  let acc: number | null = null
  let pendingOp: string | null = null
  for (const t of folded) {
    if (t.kind === 'num') {
      if (acc === null) acc = t.value
      else if (pendingOp === '+') acc += t.value
      else if (pendingOp === '-') acc -= t.value
      else return null
      pendingOp = null
    } else {
      if (t.op !== '+' && t.op !== '-') return null
      if (pendingOp !== null || acc === null) return null
      pendingOp = t.op
    }
  }
  if (pendingOp !== null) return null
  return acc
}

/** Evaluate a full side string (tokenize + evaluate). null when invalid. */
export function evaluateSide(s: string): number | null {
  const tokens = tokenizeSide(s)
  if (!tokens) return null
  return evalTokens(tokens)
}

/**
 * True when `s` is a legal Equate equation:
 *   - exactly COLS (8) characters,
 *   - exactly one `=`, both sides non-empty,
 *   - each side well-formed (no leading zeros, no malformed operators, no /0),
 *   - the left side evaluates (standard precedence) to the integer on the right.
 */
export function isValidEquation(s: string): boolean {
  if (typeof s !== 'string' || s.length !== COLS) return false
  // Only allowed symbols overall.
  for (const c of s) if (!SYMBOLS.includes(c)) return false
  // Exactly one '='.
  let eq = -1
  let eqCount = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=') {
      eqCount++
      eq = i
    }
  }
  if (eqCount !== 1) return false
  const left = s.slice(0, eq)
  const right = s.slice(eq + 1)
  if (left.length === 0 || right.length === 0) return false
  // Nerdle rule: the right side is a bare non-negative integer (no operators).
  for (const c of right) if (OPS.includes(c)) return false
  const lv = evaluateSide(left)
  const rv = evaluateSide(right)
  if (lv === null || rv === null) return false
  return lv === rv
}

// -- Equation bank -----------------------------------------------------------
// Hand-verified 8-char equations, all passing isValidEquation (a test iterates
// the whole bank to prove it). The bank — not live generation — is the source
// of truth for daily answers.

export const BANK: readonly string[] = [
  // two-digit addition (result two digits)
  '13+27=40', '48+24=72', '36+45=81', '19+58=77', '27+38=65',
  '44+29=73', '15+76=91', '28+63=91', '57+16=73', '39+24=63',
  '62+17=79', '25+49=74', '18+47=65', '34+29=63', '46+38=84',
  '29+53=82', '41+38=79', '53+19=72',
  // subtraction
  '85-27=58', '91-46=45', '73-28=45', '60-14=46', '52-17=35',
  '94-38=56', '81-45=36', '70-23=47', '66-19=47', '88-49=39',
  '57-28=29', '43-16=27', '92-57=35', '75-38=37', '80-53=27', '64-27=37',
  // multiplication (three-digit result)
  '4*25=100', '8*15=120', '9*12=108', '6*18=108', '25*4=100',
  '15*8=120', '12*9=108', '18*6=108', '8*16=128', '9*13=117',
  // division (exact)
  '120/8=15', '144/9=16', '126/9=14', '150/6=25', '132/6=22',
  '108/12=9', '160/8=20', '168/8=21', '135/9=15', '216/8=27',
  '162/6=27', '128/8=16', '153/9=17',
  // mixed precedence (multiply/divide before add/subtract)
  '2+3*4=14', '5*4+7=27', '3*9-5=22', '4*5+9=29', '6*7-9=33',
  '2*8+9=25', '7*8-6=50', '9*6-4=50', '3*7+8=29', '8*7-5=51',
  '4*8+3=35', '6*9-7=47', '20-2*6=8', '50-6*7=8',
]

/**
 * Pick a daily/practice answer from the bank. Consumes exactly one draw from the
 * injected RNG — the ONLY place rng is used in the whole engine.
 */
export function generatePuzzle(rng: Rng): string {
  const idx = Math.floor(rng() * BANK.length)
  return BANK[Math.min(BANK.length - 1, Math.max(0, idx))]
}

// -- Coloring ----------------------------------------------------------------

/**
 * Score a guessed equation against the answer with correct duplicate handling.
 *
 * Two passes, classic Wordle rule:
 *  1. Mark exact-position matches 'green' and consume those answer positions.
 *  2. For the rest, a symbol is 'purple' only while unconsumed copies of it
 *     remain in the answer's leftover multiset — otherwise 'grey'. So a guess
 *     with three `1`s against an answer holding two `1`s yields at most two
 *     colored (green+purple) and the surplus grey.
 */
export function scoreRow(guess: string, answer: string): TileState[] {
  const n = guess.length
  const result: TileState[] = new Array(n).fill('grey')
  const remaining: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'green'
    } else {
      const a = answer[i]
      remaining[a] = (remaining[a] ?? 0) + 1
    }
  }
  for (let i = 0; i < n; i++) {
    if (result[i] === 'green') continue
    const c = guess[i]
    if ((remaining[c] ?? 0) > 0) {
      result[i] = 'purple'
      remaining[c] -= 1
    }
  }
  return result
}

// -- Keyboard tint -----------------------------------------------------------

// green > purple > grey — a symbol never downgrades once known.
const RANK: Record<TileState, number> = { grey: 0, purple: 1, green: 2 }

/** Best-known state per symbol across all submitted guesses (keyboard tint). */
export function keyStates(state: GameState): Map<string, TileState> {
  const map = new Map<string, TileState>()
  for (const g of state.guesses) {
    const row = scoreRow(g, state.answer)
    for (let i = 0; i < g.length; i++) {
      const sym = g[i]
      const next = row[i]
      const prev = map.get(sym)
      if (!prev || RANK[next] > RANK[prev]) map.set(sym, next)
    }
  }
  return map
}

// -- State + reducer ---------------------------------------------------------

/** Start a fresh game, choosing an answer via the injected RNG. */
export function newGame(rng: Rng): GameState {
  return { answer: generatePuzzle(rng), guesses: [], status: 'playing' }
}

/** Number of guesses used so far. */
export function guessesUsed(state: GameState): number {
  return state.guesses.length
}

/**
 * Submit a guess. Returns the SAME state reference (no change, no guess
 * consumed) when the game is over or the guess is not a valid equation — the
 * caller can detect a rejected guess by reference equality and react (shake).
 * On a valid guess the state advances: append it, then win (exact answer) or
 * lose (MAX_GUESSES reached) or keep playing. Consumes NO rng.
 */
export function submitGuess(state: GameState, guess: string): GameState {
  if (state.status !== 'playing') return state
  if (!isValidEquation(guess)) return state
  const guesses = [...state.guesses, guess]
  const won = guess === state.answer
  const lost = !won && guesses.length >= MAX_GUESSES
  return { ...state, guesses, status: won ? 'won' : lost ? 'lost' : 'playing' }
}

/** Reset to a fresh game with a new answer from the injected rng. */
export function resetGame(rng: Rng): GameState {
  return newGame(rng)
}

/**
 * Score: higher is better, positive int. A win scores 1000 plus a bonus for
 * every guess saved; 0 until won.
 */
export function score(state: GameState): number {
  if (state.status !== 'won') return 0
  return 1000 + (MAX_GUESSES - guessesUsed(state)) * 100
}
