export type Rng = () => number

/**
 * Number Memory — pure, deterministic state machine.
 *
 *   idle → show (number flashes) → input (player types) → submit
 *              ▲                                            │
 *              └──────────── correct: level + 1 ────────────┤
 *                            wrong: over (record reached) ──┘
 *
 * The number grows one digit each level: level N shows an N-digit number.
 * No `Math.random` here — the caller injects the RNG so every generated
 * number and transition is reproducible and unit-testable.
 */

export type Phase = 'idle' | 'show' | 'input' | 'over'

export interface NumberMemoryState {
  phase: Phase
  /** Current level (1-based). The number to recall has exactly `level` digits. */
  level: number
  /** The current level's number as a numeric string of length `level`. */
  number: string
  /** Highest level successfully cleared so far (the run's score). 0 before any. */
  reached: number
  over: boolean
}

/**
 * Generate a numeric string of exactly `length` digits using the injected rng.
 * The leading digit is 1–9 (never 0) so the string length always equals
 * `length` and a typed guess can match it without leading-zero ambiguity.
 * `rng` must yield a value in [0, 1).
 */
export function generateNumber(length: number, rng: Rng): string {
  const len = Math.max(1, Math.floor(length))
  let out = String(1 + Math.floor(rng() * 9)) // first digit 1–9
  for (let i = 1; i < len; i++) {
    out += String(Math.floor(rng() * 10)) // remaining digits 0–9
  }
  return out
}

/** Fresh game: level 1 with a 1-digit number ready to show. */
export function newGame(rng: Rng): NumberMemoryState {
  return {
    phase: 'show',
    level: 1,
    number: generateNumber(1, rng),
    reached: 0,
    over: false,
  }
}

/**
 * Generate the current level's number (length = `level`) and enter the `show`
 * phase. Used on start and after advancing a level.
 */
export function nextNumber(state: NumberMemoryState, rng: Rng): NumberMemoryState {
  return {
    ...state,
    number: generateNumber(state.level, rng),
    phase: 'show',
  }
}

/**
 * Grade the player's guess against the current number.
 * - correct → advance to the next level (reached = level just cleared), stay
 *   in play; the caller then invokes `nextNumber` to reveal the longer number.
 * - wrong → game over; `reached` holds the highest level cleared.
 * Ignored once the game is over.
 */
export function submit(state: NumberMemoryState, guess: string): NumberMemoryState {
  if (state.over) return state
  if (guess === state.number) {
    return {
      ...state,
      level: state.level + 1,
      reached: state.level,
      phase: 'show',
    }
  }
  return { ...state, phase: 'over', over: true }
}

/** Whether a guess matches the current number (does not mutate state). */
export function isCorrect(state: NumberMemoryState, guess: string): boolean {
  return guess === state.number
}
