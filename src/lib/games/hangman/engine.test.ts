import { describe, expect, it } from 'vitest'
import {
  MAX_MISSES,
  WORDS,
  answerLetters,
  guessLetter,
  isHit,
  isLetter,
  isLost,
  isWon,
  maskedLetters,
  maskedWord,
  newGame,
  type GameState,
} from './engine'

const start = (word: string, category = 'Test'): GameState => ({
  word,
  category,
  guessed: [],
  misses: 0,
  status: 'playing',
})

// Guess a sequence of letters in order, threading the state.
const play = (state: GameState, letters: string): GameState =>
  letters.split('').reduce((s, l) => guessLetter(s, l), state)

describe('word list integrity', () => {
  it('bundles a few hundred common words, each 4–9 lowercase letters', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(200)
    for (const { word, category } of WORDS) {
      expect(word).toMatch(/^[a-z]{4,9}$/)
      expect(category.length).toBeGreaterThan(0)
    }
  })
})

describe('newGame', () => {
  it('picks a word from WORDS using the injected rng (no Math.random)', () => {
    expect(newGame(() => 0).word).toBe(WORDS[0].word)
    expect(newGame(() => 0.999999).word).toBe(WORDS[WORDS.length - 1].word)
  })

  it('is deterministic for a fixed rng', () => {
    const rng = () => 0.42
    expect(newGame(rng).word).toBe(newGame(rng).word)
  })

  it('starts empty, with no misses, playing, and carries a category hint', () => {
    const s = newGame(() => 0.3)
    expect(s.guessed).toEqual([])
    expect(s.misses).toBe(0)
    expect(s.status).toBe('playing')
    expect(typeof s.category).toBe('string')
    expect(s.category.length).toBeGreaterThan(0)
  })
})

describe('guessLetter — correct guesses', () => {
  it('a correct guess reveals every instance of that letter', () => {
    // "puppy" has three p's.
    const s = guessLetter(start('puppy'), 'p')
    const mask = maskedLetters(s)
    expect(mask).toEqual(['P', null, 'P', 'P', null])
    expect(s.misses).toBe(0)
    expect(isHit(s, 'p')).toBe(true)
  })

  it('does not increment misses on a hit', () => {
    const s = play(start('cat', 'x'), 'c')
    expect(s.misses).toBe(0)
    expect(s.guessed).toContain('c')
  })
})

describe('guessLetter — wrong guesses', () => {
  it('a wrong guess increments misses and records the letter', () => {
    const s = guessLetter(start('cloud'), 'z')
    expect(s.misses).toBe(1)
    expect(s.guessed).toEqual(['z'])
    expect(s.status).toBe('playing')
  })

  it('accumulates misses across several wrong guesses', () => {
    const s = play(start('cloud'), 'zqwk') // none appear in "cloud"
    expect(s.misses).toBe(4)
  })
})

describe('win detection', () => {
  it('wins when all distinct letters are revealed', () => {
    // "moon" distinct letters: m, o, n.
    const s = play(start('moon'), 'mon')
    expect(isWon(s)).toBe(true)
    expect(s.status).toBe('won')
  })

  it('does not win while a letter is still hidden', () => {
    const s = play(start('moon'), 'mo')
    expect(isWon(s)).toBe(false)
    expect(s.status).toBe('playing')
  })

  it('wrong guesses along the way do not block a win (as long as < MAX_MISSES)', () => {
    const s = play(start('sky'), 'xsky') // x wrong, then s,k,y
    expect(s.misses).toBe(1)
    expect(s.status).toBe('won')
  })
})

describe('lose detection', () => {
  it('loses after exactly MAX_MISSES wrong guesses', () => {
    // "quiz" — pick six letters that never appear in it.
    const wrong = 'abcdef' // none of these are in "quiz"
    expect(wrong.length).toBe(MAX_MISSES)
    const s = play(start('quiz'), wrong)
    expect(s.misses).toBe(MAX_MISSES)
    expect(isLost(s)).toBe(true)
    expect(s.status).toBe('lost')
  })

  it('does not lose at MAX_MISSES - 1 wrong guesses', () => {
    const s = play(start('quiz'), 'abcde') // five wrong
    expect(s.misses).toBe(5)
    expect(isLost(s)).toBe(false)
    expect(s.status).toBe('playing')
  })

  it('reveals the full word once the game is lost', () => {
    const s = play(start('quiz'), 'abcdef')
    expect(maskedWord(s)).toBe('Q U I Z')
  })
})

describe('duplicate guesses', () => {
  it('a repeated guess is a no-op (same state reference)', () => {
    const first = guessLetter(start('cloud'), 'c')
    const again = guessLetter(first, 'c')
    expect(again).toBe(first)
  })

  it('a repeated wrong guess does not double-count misses', () => {
    const first = guessLetter(start('cloud'), 'z')
    const again = guessLetter(first, 'z')
    expect(again).toBe(first)
    expect(again.misses).toBe(1)
  })
})

describe('case-insensitivity', () => {
  it('accepts uppercase input and treats it the same as lowercase', () => {
    const s = guessLetter(start('cloud'), 'C')
    expect(s.guessed).toEqual(['c'])
    expect(s.misses).toBe(0)
    expect(maskedLetters(s)[0]).toBe('C')
  })

  it('an uppercase repeat of a lowercase guess is still a no-op', () => {
    const first = guessLetter(start('cloud'), 'c')
    expect(guessLetter(first, 'C')).toBe(first)
  })
})

describe('input guarding', () => {
  it('rejects non-letters without changing state', () => {
    const s = start('cloud')
    expect(guessLetter(s, '1')).toBe(s)
    expect(guessLetter(s, '')).toBe(s)
    expect(guessLetter(s, 'ab')).toBe(s)
    expect(guessLetter(s, ' ')).toBe(s)
  })

  it('isLetter validates single a–z characters', () => {
    expect(isLetter('a')).toBe(true)
    expect(isLetter('Z')).toBe(true)
    expect(isLetter('1')).toBe(false)
    expect(isLetter('ab')).toBe(false)
    expect(isLetter('')).toBe(false)
  })

  it('ignores further guesses once the game is over', () => {
    const won = play(start('moon'), 'mon')
    expect(won.status).toBe('won')
    expect(guessLetter(won, 'x')).toBe(won)
  })
})

describe('helpers', () => {
  it('answerLetters returns the distinct letters of the word', () => {
    expect(answerLetters(start('moon'))).toEqual(new Set(['m', 'o', 'n']))
  })

  it('maskedWord uses a custom blank when provided', () => {
    const s = guessLetter(start('cat'), 'c')
    expect(maskedWord(s, '•')).toBe('C • •')
  })
})
