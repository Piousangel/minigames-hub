import { describe, expect, it } from 'vitest'
import {
  BOARDS,
  MAX_GUESSES,
  WORD_LENGTH,
  boardKeyHints,
  boardRows,
  createGame,
  dailySeed,
  generatePuzzle,
  guessesUsed,
  isBoardSolved,
  mergedKeyHints,
  mulberry32,
  reduce,
  score,
  solvedCount,
  submit,
  type QuadleState,
} from './engine'
import { ANSWERS, isValidGuess } from '@/lib/games/wordguess/engine'

// Fixed seed → a known, byte-stable puzzle. Any drift in generation or in the
// upstream answer pool breaks this golden and must be reviewed intentionally.
const GOLDEN_SEED = 12345
const GOLDEN_ANSWERS = ['worse', 'front', 'never', 'swift']

/** Play a whole scripted sequence of words through the reducer. */
function play(state: QuadleState, words: string[]): QuadleState {
  return words.reduce((s, w) => submit(s, w), state)
}

describe('constants', () => {
  it('four boards, nine guesses, five letters', () => {
    expect(BOARDS).toBe(4)
    expect(MAX_GUESSES).toBe(9)
    expect(WORD_LENGTH).toBe(5)
  })
})

describe('mulberry32 / dailySeed determinism', () => {
  it('mulberry32 is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('mulberry32 differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })

  it('dailySeed is a stable 32-bit unsigned hash', () => {
    const s = dailySeed('2026-07-20')
    expect(s).toBe(dailySeed('2026-07-20'))
    expect(s).toBe(s >>> 0)
    expect(dailySeed('2026-07-20')).not.toBe(dailySeed('2026-07-21'))
  })
})

describe('generatePuzzle', () => {
  it('picks exactly BOARDS words', () => {
    expect(generatePuzzle(mulberry32(7))).toHaveLength(BOARDS)
  })

  it('picks four DISTINCT answers', () => {
    for (const seed of [0, 1, 2, 55, 12345, 99999]) {
      const words = generatePuzzle(mulberry32(seed))
      expect(new Set(words).size).toBe(BOARDS)
    }
  })

  it('only picks words from the shared answer pool', () => {
    const words = generatePuzzle(mulberry32(2024))
    for (const w of words) expect(ANSWERS).toContain(w)
  })

  it('consumes rng deterministically (same seed → same puzzle)', () => {
    expect(generatePuzzle(mulberry32(GOLDEN_SEED))).toEqual(
      generatePuzzle(mulberry32(GOLDEN_SEED)),
    )
  })

  it('survives a degenerate rng that always returns 0', () => {
    // A constant rng would keep re-picking one word; the distinctness guard must
    // still terminate (though it cannot fill all four — it returns what it can).
    const words = generatePuzzle(() => 0)
    expect(words.length).toBeGreaterThanOrEqual(1)
    expect(new Set(words).size).toBe(words.length)
  })
})

describe('createGame (GOLDEN)', () => {
  it('fixed seed → four specific answers', () => {
    expect(createGame(GOLDEN_SEED).answers).toEqual(GOLDEN_ANSWERS)
  })

  it('daily seed is stable for a date', () => {
    const a = createGame(dailySeed('2026-07-20')).answers
    const b = createGame(dailySeed('2026-07-20')).answers
    expect(a).toEqual(b)
    expect(a).toEqual(['unify', 'rocky', 'apply', 'drink'])
  })

  it('starts unsolved and playing', () => {
    const s = createGame(GOLDEN_SEED)
    expect(s.status).toBe('playing')
    expect(s.guesses).toEqual([])
    expect(s.solvedAt).toEqual([null, null, null, null])
    expect(solvedCount(s)).toBe(0)
    expect(guessesUsed(s)).toBe(0)
    expect(score(s)).toBe(0)
  })
})

describe('submit — validation', () => {
  it('rejects a non-word without consuming a guess (same reference)', () => {
    const s = createGame(GOLDEN_SEED)
    const next = submit(s, 'zzzzz')
    expect(next).toBe(s)
    expect(next.guesses).toHaveLength(0)
  })

  it('rejects wrong-length input', () => {
    const s = createGame(GOLDEN_SEED)
    expect(submit(s, 'cat')).toBe(s)
    expect(submit(s, 'toolong')).toBe(s)
    expect(submit(s, '')).toBe(s)
  })

  it('accepts an extra-dictionary word that is a valid guess but never an answer', () => {
    const s = createGame(GOLDEN_SEED)
    expect(isValidGuess('fjord')).toBe(true)
    const next = submit(s, 'fjord')
    expect(next).not.toBe(s)
    expect(next.guesses).toEqual(['fjord'])
  })

  it('lowercases the accepted guess', () => {
    const s = createGame(GOLDEN_SEED)
    expect(submit(s, 'FJORD').guesses).toEqual(['fjord'])
  })

  it('does nothing once the game is over', () => {
    let s = createGame(GOLDEN_SEED)
    s = play(s, GOLDEN_ANSWERS) // win
    expect(s.status).toBe('won')
    const after = submit(s, 'fjord')
    expect(after).toBe(s)
  })
})

describe('submit — solving boards simultaneously', () => {
  it('a guess solves EXACTLY one board when it equals one answer', () => {
    const s = createGame(GOLDEN_SEED) // worse, front, never, swift
    const next = submit(s, 'front') // board index 1
    expect(solvedCount(next)).toBe(1)
    expect(next.solvedAt).toEqual([null, 0, null, null])
    expect(isBoardSolved(next, 1)).toBe(true)
    expect(isBoardSolved(next, 0)).toBe(false)
    expect(next.status).toBe('playing')
  })

  it('records the guess index at which a board locked', () => {
    let s = createGame(GOLDEN_SEED)
    s = submit(s, 'fjord') // guess 0, solves nothing
    s = submit(s, 'front') // guess 1, solves board 1
    expect(s.solvedAt[1]).toBe(1)
  })

  it('a solved board never unlocks or changes its solve index', () => {
    let s = createGame(GOLDEN_SEED)
    s = submit(s, 'front') // board 1 solved at guess 0
    s = submit(s, 'fjord') // later guesses cannot touch it
    s = submit(s, 'front') // re-guessing the same word keeps the original index
    expect(s.solvedAt[1]).toBe(0)
    expect(solvedCount(s)).toBe(1)
  })

  it('one guess can solve two boards at once if two answers were identical is impossible (answers are distinct)', () => {
    const s = createGame(GOLDEN_SEED)
    const next = submit(s, 'worse')
    expect(solvedCount(next)).toBe(1) // distinct answers ⇒ at most one match
  })
})

describe('boardRows / boardKeyHints coloring', () => {
  it('scores each guess against each board independently', () => {
    const s = submit(createGame(GOLDEN_SEED), 'front') // answers: worse, front, never, swift
    // board 1 answer is "front" → all correct
    expect(boardRows(s, 1)[0]).toEqual(
      new Array(WORD_LENGTH).fill('correct'),
    )
    // board 0 answer is "worse": guess "front" shares only 'r' (present, wrong spot)
    const row0 = boardRows(s, 0)[0]
    expect(row0).toHaveLength(WORD_LENGTH)
    expect(row0[2]).toBe('present') // the 'o'? check letters concretely below
  })

  it('boardRows has one row per submitted guess', () => {
    let s = createGame(GOLDEN_SEED)
    s = submit(s, 'fjord')
    s = submit(s, 'crane')
    expect(boardRows(s, 0)).toHaveLength(2)
    expect(boardRows(s, 3)).toHaveLength(2)
  })

  it('boardKeyHints upgrades a letter, never downgrades', () => {
    let s = createGame(GOLDEN_SEED) // board 1 = front
    s = submit(s, 'rebar') // 'r' present in front (wrong spot)
    let hint = boardKeyHints(s, 1).get('r')
    expect(hint).toBe('present')
    s = submit(s, 'front') // now 'r' is correct
    hint = boardKeyHints(s, 1).get('r')
    expect(hint).toBe('correct')
  })
})

describe('mergedKeyHints', () => {
  it('greys a letter only when absent from ALL four answers', () => {
    // answers: worse, front, never, swift — none contains 'z'
    let s = createGame(GOLDEN_SEED)
    s = submit(s, 'zesty') // 'z' absent everywhere; 't' is in front/swift
    const map = mergedKeyHints(s)
    expect(map.get('z')).toBe('absent')
    expect(map.has('t')).toBe(false) // present in some answer ⇒ stays neutral
  })

  it('is empty before any guess', () => {
    expect(mergedKeyHints(createGame(GOLDEN_SEED)).size).toBe(0)
  })
})

describe('win / loss transitions', () => {
  it('a full win: solving all four boards flips status to won', () => {
    const s = play(createGame(GOLDEN_SEED), GOLDEN_ANSWERS)
    expect(s.status).toBe('won')
    expect(solvedCount(s)).toBe(BOARDS)
    expect(guessesUsed(s)).toBe(4)
  })

  it('a win can still happen on the last (9th) guess', () => {
    let s = createGame(GOLDEN_SEED)
    // burn 5 non-solving guesses, then solve all four on guesses 6–9
    s = play(s, ['fjord', 'fjord', 'fjord', 'fjord', 'fjord'])
    expect(s.status).toBe('playing')
    s = play(s, GOLDEN_ANSWERS)
    expect(guessesUsed(s)).toBe(9)
    expect(s.status).toBe('won')
  })

  it('a loss at nine guesses when a board is left unsolved', () => {
    // 'fjord' is a legal guess that is never an answer ⇒ solves nothing
    const s = play(createGame(GOLDEN_SEED), new Array(MAX_GUESSES).fill('fjord'))
    expect(guessesUsed(s)).toBe(MAX_GUESSES)
    expect(solvedCount(s)).toBe(0)
    expect(s.status).toBe('lost')
  })

  it('a loss with three of four solved still loses', () => {
    let s = createGame(GOLDEN_SEED)
    s = play(s, ['worse', 'front', 'never']) // 3 solved in 3 guesses
    s = play(s, new Array(6).fill('fjord')) // 6 more misses → 9 total
    expect(guessesUsed(s)).toBe(9)
    expect(solvedCount(s)).toBe(3)
    expect(s.status).toBe('lost')
  })

  it('invalid guesses never push toward a loss', () => {
    let s = createGame(GOLDEN_SEED)
    for (let i = 0; i < 20; i++) s = submit(s, 'zzzzz')
    expect(guessesUsed(s)).toBe(0)
    expect(s.status).toBe('playing')
  })
})

describe('score', () => {
  it('is 0 before any progress', () => {
    expect(score(createGame(GOLDEN_SEED))).toBe(0)
  })

  it('rewards a win, and rewards speed (fewer guesses → higher)', () => {
    const fast = play(createGame(GOLDEN_SEED), GOLDEN_ANSWERS) // 4 guesses
    let slow = createGame(GOLDEN_SEED)
    slow = play(slow, ['fjord', 'fjord', 'fjord', 'fjord', 'fjord'])
    slow = play(slow, GOLDEN_ANSWERS) // 9 guesses
    expect(fast.status).toBe('won')
    expect(slow.status).toBe('won')
    expect(score(fast)).toBe(1000 + (MAX_GUESSES - 4) * 100)
    expect(score(slow)).toBe(1000 + (MAX_GUESSES - 9) * 100)
    expect(score(fast)).toBeGreaterThan(score(slow))
  })

  it('a non-win scores on boards solved (150 each)', () => {
    let s = createGame(GOLDEN_SEED)
    s = play(s, ['worse', 'front']) // 2 solved, still playing
    expect(score(s)).toBe(2 * 150)
  })

  it('score is monotonic as boards get solved', () => {
    let s = createGame(GOLDEN_SEED)
    const scores = [score(s)]
    for (const w of GOLDEN_ANSWERS) {
      s = submit(s, w)
      scores.push(score(s))
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1])
    }
    // last step (the win) jumps strictly up
    expect(scores[scores.length - 1]).toBeGreaterThan(scores[scores.length - 2])
  })
})

describe('reduce', () => {
  it('dispatches submit', () => {
    const s = createGame(GOLDEN_SEED)
    expect(reduce(s, { type: 'submit', word: 'front' }).solvedAt[1]).toBe(0)
  })

  it('reset regenerates a fresh, playing game from a seed', () => {
    let s = play(createGame(GOLDEN_SEED), GOLDEN_ANSWERS)
    expect(s.status).toBe('won')
    s = reduce(s, { type: 'reset', seed: 999 })
    expect(s.status).toBe('playing')
    expect(s.guesses).toEqual([])
    expect(s.answers).toEqual(['white', 'rural', 'fruit', 'steel'])
  })
})

describe('purity / determinism', () => {
  it('submit does not mutate its input state', () => {
    const s = createGame(GOLDEN_SEED)
    const snapshotGuesses = [...s.guesses]
    const snapshotSolved = [...s.solvedAt]
    submit(s, 'front')
    expect(s.guesses).toEqual(snapshotGuesses)
    expect(s.solvedAt).toEqual(snapshotSolved)
    expect(s.status).toBe('playing')
  })

  it('the same seed + same guesses yields identical state', () => {
    const a = play(createGame(GOLDEN_SEED), ['fjord', 'front', 'worse'])
    const b = play(createGame(GOLDEN_SEED), ['fjord', 'front', 'worse'])
    expect(a).toEqual(b)
  })
})
