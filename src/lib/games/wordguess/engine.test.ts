import { describe, expect, it } from 'vitest'
import {
  ANSWERS,
  MAX_GUESSES,
  VALID_GUESSES,
  WORD_LENGTH,
  dailySeed,
  isValidGuess,
  mulberry32,
  newGame,
  restoreGame,
  scoreGuess,
  submitGuess,
  type GameState,
} from './engine'

const start = (answer: string): GameState => ({ answer, guesses: [], status: 'playing' })

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

  it('newGame(mulberry32(dailySeed(date))) is deterministic for the same date', () => {
    const gameA = newGame(mulberry32(dailySeed('2026-08-11')))
    const gameB = newGame(mulberry32(dailySeed('2026-08-11')))
    expect(gameA.answer).toBe(gameB.answer)
  })
})

describe('word list integrity', () => {
  it('every answer is a lowercase 5-letter word', () => {
    for (const w of ANSWERS) {
      expect(w).toMatch(/^[a-z]{5}$/)
    }
    expect(ANSWERS.length).toBeGreaterThanOrEqual(200)
  })

  it('every answer is itself a valid guess (so a win is always accepted)', () => {
    for (const w of ANSWERS) {
      expect(VALID_GUESSES.has(w)).toBe(true)
    }
  })
})

describe('scoreGuess — basic feedback', () => {
  it('all correct when guess equals answer', () => {
    expect(scoreGuess('crane', 'crane')).toEqual([
      'correct', 'correct', 'correct', 'correct', 'correct',
    ])
  })

  it('all absent when no letters overlap', () => {
    expect(scoreGuess('fghij', 'crane'.replace('crane', 'crane'))).toBeDefined()
    expect(scoreGuess('booms', 'chart')).toEqual([
      'absent', 'absent', 'absent', 'absent', 'absent',
    ])
  })

  it('marks present for right letter in wrong position', () => {
    // answer "cider", guess "price": c and r and i present but misplaced, e present
    // Simpler: answer "brain", guess "grain" -> only first letter differs.
    expect(scoreGuess('grain', 'brain')).toEqual([
      'absent', 'correct', 'correct', 'correct', 'correct',
    ])
  })

  it('mixes correct/present/absent', () => {
    // answer "point" = p-o-i-n-t, guess "toner" = t-o-n-e-r:
    // t present (answer has t at idx4), o correct (idx1), n present (answer n at idx3),
    // e absent, r absent.
    expect(scoreGuess('toner', 'point')).toEqual([
      'present', 'correct', 'present', 'absent', 'absent',
    ])
  })
})

describe('scoreGuess — duplicate-letter rules', () => {
  it('two guessed copies but one in answer, none correctly placed → one present, one absent', () => {
    // answer "abide" has a single 'a'. guess "algae": positions of 'a' are 0 and 3.
    // Neither aligns with answer's 'a' (index 0? answer a-b-i-d-e, so index0 is 'a').
    // Use answer "video" (one 'o'? no o... ) — pick answer "chair" (one 'a' at idx2),
    // guess "aroma" has 'a' at 0 and 4, neither matches idx2 → first 'a' present, second absent.
    const res = scoreGuess('aroma', 'chair')
    expect(res[0]).toBe('present') // first a consumes the single answer 'a'
    expect(res[4]).toBe('absent') // second a has no remaining copy
  })

  it('two guessed copies, one is correctly placed → that one correct, the other absent', () => {
    // answer "chair" has a single 'a' at index 2. guess "salsa"? no.
    // guess "abaca"? messy. Use answer "steal" (one 'a' at idx3), guess "aroma":
    // a at idx0 and idx4; answer 'a' at idx3 so neither correct → present + absent.
    // For a correctly-placed dup: answer "array" (a at 0 and 2... two a's).
    // Use answer "llama": l l a m a. guess "allay": a l l a y.
    // Let's craft cleanly: answer "abbey" (b at 2 and? a-b-b-e-y two b's).
    // guess "bribe": b-r-i-b-e. answer b's at idx1,2. guess b's at idx0,3.
    // No b aligns → both b present? there are two answer b's so both present.
    // Instead: answer "abide" (single b at idx1). guess "bobby": b at 0,2,3.
    // idx? answer b at idx1. guess "bobby": positions 0:b,1:o,2:b,3:b,4:y.
    // none of guess b at idx1, so first b present, rest absent (only one answer b).
    const res = scoreGuess('bobby', 'abide')
    expect(res[0]).toBe('present')
    expect(res[2]).toBe('absent')
    expect(res[3]).toBe('absent')
  })

  it('correct placement wins the copy over an earlier misplaced one', () => {
    // answer "razor" — single 'r' at idx0 and idx4 (two r's actually). Use single.
    // answer "video" has single 'o' at idx4. guess "otoro"? contrived.
    // Clean case: answer "eaten"? two e's.
    // Use answer "pilot" (single 'o' at idx3). guess "spoon": o at idx2 and idx3.
    // answer o at idx3 → the idx3 o is correct; idx2 o is absent (only one o).
    const res = scoreGuess('spoon', 'pilot')
    // p present (answer has p at 0), o: idx2 absent, idx3 correct
    expect(res[3]).toBe('correct')
    expect(res[2]).toBe('absent')
  })

  it('three guessed copies, two in answer → two marked, one absent', () => {
    // answer "geese" g-e-e-s-e has three e's actually (idx1,2,4). Use two-e answer.
    // answer "abide"? one e. Use answer "There"? proper. Use answer "sheet": s-h-e-e-t
    // two e's at idx2,3. guess "eerie": e-e-r-i-e, three e's at 0,1,4.
    // none align with idx2/3 → first two e's present, third absent.
    const res = scoreGuess('eerie', 'sheet')
    expect(res.filter((r) => r === 'present').length).toBe(2)
    expect(res.filter((r) => r === 'absent').length).toBe(3) // e#3 + r + i
  })
})

describe('isValidGuess', () => {
  it('accepts a dictionary word', () => {
    expect(isValidGuess('crane')).toBe(true)
  })
  it('is case-insensitive', () => {
    expect(isValidGuess('CRANE')).toBe(true)
  })
  it('rejects non-words', () => {
    expect(isValidGuess('zzzzz')).toBe(false)
    expect(isValidGuess('qwxyz')).toBe(false)
  })
  it('rejects wrong length', () => {
    expect(isValidGuess('cat')).toBe(false)
    expect(isValidGuess('cranes')).toBe(false)
    expect(isValidGuess('')).toBe(false)
  })
})

describe('newGame', () => {
  it('picks an answer from ANSWERS using the injected rng', () => {
    expect(newGame(() => 0).answer).toBe(ANSWERS[0])
    expect(newGame(() => 0.999999).answer).toBe(ANSWERS[ANSWERS.length - 1])
  })
  it('starts empty and playing', () => {
    const s = newGame(() => 0.5)
    expect(s.guesses).toEqual([])
    expect(s.status).toBe('playing')
  })
  it('never touches Math.random (deterministic per rng)', () => {
    const rng = () => 0.42
    expect(newGame(rng).answer).toBe(newGame(rng).answer)
  })
})

describe('submitGuess', () => {
  it('appends a scored guess and stays playing', () => {
    const next = submitGuess(start('crane'), 'slate')
    expect(next.guesses).toHaveLength(1)
    expect(next.guesses[0].word).toBe('slate')
    expect(next.guesses[0].result).toHaveLength(WORD_LENGTH)
    expect(next.status).toBe('playing')
  })

  it('wins on the correct answer', () => {
    const next = submitGuess(start('crane'), 'crane')
    expect(next.status).toBe('won')
    expect(next.guesses[0].result.every((r) => r === 'correct')).toBe(true)
  })

  it('is case-insensitive on the guess and still wins', () => {
    expect(submitGuess(start('crane'), 'CRANE').status).toBe('won')
  })

  it('rejects an invalid guess by returning the same state reference', () => {
    const s = start('crane')
    expect(submitGuess(s, 'zzzzz')).toBe(s)
    expect(submitGuess(s, 'abc')).toBe(s)
  })

  it('loses after MAX_GUESSES wrong-but-valid guesses', () => {
    let s = start('crane')
    const wrong = ['slate', 'point', 'bough', 'dwelt'.replace('dwelt', 'mound'), 'first', 'lucky']
    for (const g of wrong) {
      s = submitGuess(s, g)
    }
    expect(s.guesses).toHaveLength(MAX_GUESSES)
    expect(s.status).toBe('lost')
  })

  it('does not lose if the last of six guesses is correct', () => {
    let s = start('crane')
    const seq = ['slate', 'point', 'bough', 'mound', 'first', 'crane']
    for (const g of seq) s = submitGuess(s, g)
    expect(s.status).toBe('won')
    expect(s.guesses).toHaveLength(6)
  })

  it('ignores further guesses once the game is over', () => {
    const won = submitGuess(start('crane'), 'crane')
    expect(submitGuess(won, 'slate')).toBe(won)
  })
})

describe('restoreGame — replaying saved daily guesses', () => {
  const base = (): GameState => ({ answer: 'crane', guesses: [], status: 'playing' })

  it('replays saved words into the same state submitGuess would produce', () => {
    let live = base()
    for (const w of ['slate', 'crane']) live = submitGuess(live, w)
    expect(restoreGame(base(), ['slate', 'crane'])).toEqual(live)
    expect(restoreGame(base(), ['slate', 'crane'])!.status).toBe('won')
  })

  it('an empty list restores the fresh board', () => {
    expect(restoreGame(base(), [])).toEqual(base())
  })

  it('rejects corrupt saves (invalid word, too many guesses, words after the game ended)', () => {
    expect(restoreGame(base(), ['zzzzz'])).toBeNull()
    expect(restoreGame(base(), ['crane', 'slate'])).toBeNull() // guess after a win
    const wrong = Array.from({ length: MAX_GUESSES + 1 }, () => 'slate')
    expect(restoreGame(base(), wrong)).toBeNull()
    expect(restoreGame(base(), [42 as unknown as string])).toBeNull()
  })
})
