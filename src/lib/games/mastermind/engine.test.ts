import { describe, expect, it } from 'vitest'
import {
  CODE_LENGTH,
  MAX_GUESSES,
  NUM_COLORS,
  guessesRemaining,
  isValidGuess,
  newGame,
  randomCode,
  score,
  submitGuess,
  type GameState,
} from './engine'

// Play a fresh game with a fixed secret so scoring/status is deterministic.
const withSecret = (secret: number[]): GameState => ({
  secret,
  guesses: [],
  status: 'playing',
})

describe('score — basics', () => {
  it('all-black on an exact match (win feedback)', () => {
    expect(score([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ black: 4, white: 0 })
  })

  it('zero pegs when no color appears at all', () => {
    expect(score([0, 0, 1, 1], [2, 2, 3, 3])).toEqual({ black: 0, white: 0 })
  })

  it('all-white when every color is right but every position is wrong', () => {
    expect(score([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ black: 0, white: 4 })
  })

  it('mixes blacks and whites', () => {
    // pos0 exact (black). colors 1 and 2 present but swapped (2 whites). color 5 absent.
    expect(score([0, 1, 2, 3], [0, 2, 1, 5])).toEqual({ black: 1, white: 2 })
  })
})

describe('score — duplicate-color peg counting (non-double-count)', () => {
  it('secret has a dup, guess has a dup — one exact, no extra white credit', () => {
    // secret 0,0,1,2  guess 0,0,2,1 -> pos0,1 exact (2 black); colors 1,2 swapped (2 white).
    expect(score([0, 0, 1, 2], [0, 0, 2, 1])).toEqual({ black: 2, white: 2 })
  })

  it('guess floods a color the secret has only once — capped by secret count', () => {
    // secret has a single 0; guess has three 0s. Only one 0 can be credited.
    // pos0 exact (black); remaining guess 0s find no more secret 0s -> 0 white.
    expect(score([0, 1, 2, 3], [0, 0, 0, 0])).toEqual({ black: 1, white: 0 })
  })

  it('guess dup with no positional match earns exactly one white', () => {
    // secret single 0 (pos0); guess two 0s off-position -> one white, not two.
    expect(score([0, 1, 2, 3], [4, 0, 0, 5])).toEqual({ black: 0, white: 1 })
  })

  it('both sides doubled, all off-position — white capped at the overlap', () => {
    // secret 0,0,1,1  guess 1,1,0,0 -> 0 black, min counts give 4 white.
    expect(score([0, 0, 1, 1], [1, 1, 0, 0])).toEqual({ black: 0, white: 4 })
  })

  it('black + white never exceeds the code length under heavy duplication', () => {
    const fb = score([2, 2, 2, 3], [2, 2, 3, 2])
    expect(fb.black + fb.white).toBeLessThanOrEqual(CODE_LENGTH)
    expect(fb).toEqual({ black: 2, white: 2 })
  })
})

describe('isValidGuess', () => {
  it('rejects a guess of the wrong length', () => {
    expect(isValidGuess([0, 1, 2])).toBe(false)
    expect(isValidGuess([0, 1, 2, 3, 4])).toBe(false)
  })

  it('rejects out-of-range or non-integer colors', () => {
    expect(isValidGuess([0, 1, 2, NUM_COLORS])).toBe(false)
    expect(isValidGuess([0, 1, 2, -1])).toBe(false)
    expect(isValidGuess([0, 1, 2, 3.5])).toBe(false)
  })

  it('accepts a well-formed guess with repeats', () => {
    expect(isValidGuess([0, 0, 5, 5])).toBe(true)
  })
})

describe('submitGuess — win / lose / invalid', () => {
  it('wins on 4 black pegs', () => {
    const next = submitGuess(withSecret([1, 2, 3, 4]), [1, 2, 3, 4])
    expect(next.status).toBe('won')
    expect(next.guesses).toHaveLength(1)
    expect(next.guesses[0]).toMatchObject({ black: 4, white: 0 })
  })

  it('rejects an invalid-length guess without mutating state', () => {
    const state = withSecret([0, 1, 2, 3])
    const next = submitGuess(state, [0, 1, 2])
    expect(next).toBe(state)
    expect(next.guesses).toHaveLength(0)
  })

  it('loses after MAX_GUESSES wrong guesses', () => {
    let state = withSecret([0, 0, 0, 0])
    const wrong = [1, 1, 1, 1]
    for (let i = 0; i < MAX_GUESSES; i++) {
      expect(state.status).toBe('playing')
      state = submitGuess(state, wrong)
    }
    expect(state.guesses).toHaveLength(MAX_GUESSES)
    expect(state.status).toBe('lost')
  })

  it('a winning guess on the final attempt still wins, not loses', () => {
    let state = withSecret([2, 3, 4, 5])
    for (let i = 0; i < MAX_GUESSES - 1; i++) state = submitGuess(state, [0, 0, 0, 0])
    expect(state.status).toBe('playing')
    state = submitGuess(state, [2, 3, 4, 5])
    expect(state.status).toBe('won')
  })

  it('ignores further guesses once the game is over', () => {
    const won = submitGuess(withSecret([0, 1, 2, 3]), [0, 1, 2, 3])
    const after = submitGuess(won, [1, 1, 1, 1])
    expect(after).toBe(won)
  })

  it('tracks remaining guesses', () => {
    let state = withSecret([0, 1, 2, 3])
    expect(guessesRemaining(state)).toBe(MAX_GUESSES)
    state = submitGuess(state, [5, 5, 5, 5])
    expect(guessesRemaining(state)).toBe(MAX_GUESSES - 1)
  })
})

describe('newGame / randomCode', () => {
  it('newGame produces a valid secret and empty playing state from an rng', () => {
    // rng returns 0.5 -> floor(0.5*6)=3 for every peg.
    const state = newGame(() => 0.5)
    expect(state.secret).toEqual([3, 3, 3, 3])
    expect(isValidGuess(state.secret)).toBe(true)
    expect(state.guesses).toEqual([])
    expect(state.status).toBe('playing')
  })

  it('randomCode maps rng across the full color range deterministically', () => {
    const seq = [0, 0.999, 0.5, 0.16]
    let i = 0
    const code = randomCode(() => seq[i++])
    expect(code).toEqual([0, NUM_COLORS - 1, 3, 0])
    expect(code).toHaveLength(CODE_LENGTH)
  })
})
