// Mastermind — pure, deterministic engine.
//
// The secret is a 4-peg code drawn from 6 colors (repeats allowed). Each guess
// is scored with the classic peg feedback:
//   - BLACK peg: right color in the right position.
//   - WHITE peg: right color in the wrong position.
// The scoring uses the standard non-double-counting algorithm: exact matches are
// removed first, then whites are the per-color overlap of the leftover pegs. A
// single secret peg can satisfy at most one guess peg (and vice versa).

export const CODE_LENGTH = 4
export const NUM_COLORS = 6
export const MAX_GUESSES = 10

/** A color index in [0, NUM_COLORS). */
export type Peg = number
/** A full 4-peg guess or secret code. */
export type Code = Peg[]

export type Rng = () => number

export interface Feedback {
  /** Right color, right position. Win at CODE_LENGTH. */
  black: number
  /** Right color, wrong position (non-double-counted). */
  white: number
}

export interface Guess extends Feedback {
  pegs: Code
}

export type Status = 'playing' | 'won' | 'lost'

export interface GameState {
  secret: Code
  guesses: Guess[]
  status: Status
}

/** A guess is legal iff it has exactly CODE_LENGTH pegs, each a valid color. */
export function isValidGuess(guess: Code): boolean {
  return (
    Array.isArray(guess) &&
    guess.length === CODE_LENGTH &&
    guess.every((p) => Number.isInteger(p) && p >= 0 && p < NUM_COLORS)
  )
}

/** rng-picked secret; never touches Math.random so callers stay deterministic. */
export function randomCode(rng: Rng): Code {
  return Array.from({ length: CODE_LENGTH }, () => Math.floor(rng() * NUM_COLORS))
}

/**
 * Score a guess against a secret using the standard algorithm.
 *
 * 1. Count blacks (exact position matches).
 * 2. For the remaining (non-black) positions, tally color counts in both the
 *    secret and the guess, and sum the per-color minimum — that overlap is the
 *    white count. This guarantees black + white never exceeds CODE_LENGTH and a
 *    duplicate color is never counted twice.
 */
export function score(secret: Code, guess: Code): Feedback {
  const secretRest = new Array<number>(NUM_COLORS).fill(0)
  const guessRest = new Array<number>(NUM_COLORS).fill(0)
  let black = 0

  for (let i = 0; i < CODE_LENGTH; i++) {
    if (guess[i] === secret[i]) {
      black++
    } else {
      secretRest[secret[i]]++
      guessRest[guess[i]]++
    }
  }

  let white = 0
  for (let c = 0; c < NUM_COLORS; c++) {
    white += Math.min(secretRest[c], guessRest[c])
  }

  return { black, white }
}

export function newGame(rng: Rng): GameState {
  return { secret: randomCode(rng), guesses: [], status: 'playing' }
}

/**
 * Submit a guess. Returns the same state unchanged if the game is over or the
 * guess is invalid (wrong length / out-of-range color). Otherwise appends the
 * scored guess and updates status: 'won' on 4 blacks, 'lost' when the guess
 * budget is exhausted without a win.
 */
export function submitGuess(state: GameState, guess: Code): GameState {
  if (state.status !== 'playing') return state
  if (!isValidGuess(guess)) return state

  const feedback = score(state.secret, guess)
  const pegs = [...guess]
  const guesses = [...state.guesses, { pegs, ...feedback }]

  const status: Status =
    feedback.black === CODE_LENGTH ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing'

  return { secret: state.secret, guesses, status }
}

/** Guesses left before the game is lost. */
export function guessesRemaining(state: GameState): number {
  return Math.max(0, MAX_GUESSES - state.guesses.length)
}
