import { describe, it, expect } from 'vitest'
import {
  BANK,
  COLS,
  MAX_GUESSES,
  SYMBOLS,
  dailySeed,
  evaluateSide,
  generatePuzzle,
  guessesUsed,
  isValidEquation,
  keyStates,
  mulberry32,
  newGame,
  resetGame,
  score,
  scoreRow,
  submitGuess,
  type GameState,
} from './engine'

// -- constants ---------------------------------------------------------------

describe('constants', () => {
  it('has an 8-column board, 6 guesses, and the 15 symbols', () => {
    expect(COLS).toBe(8)
    expect(MAX_GUESSES).toBe(6)
    expect(SYMBOLS).toBe('0123456789+-*/=')
    expect(SYMBOLS.length).toBe(15)
  })
})

// -- mulberry32 / dailySeed --------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()])
  })

  it('produces floats in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('dailySeed', () => {
  it('is stable and differs by date (FNV-1a)', () => {
    expect(dailySeed('2026-07-20')).toBe(dailySeed('2026-07-20'))
    expect(dailySeed('2026-07-20')).not.toBe(dailySeed('2026-07-21'))
    expect(dailySeed('2026-07-20') >>> 0).toBe(dailySeed('2026-07-20'))
  })
})

// -- evaluateSide ------------------------------------------------------------

describe('evaluateSide', () => {
  it('applies standard precedence (* and / before + and -)', () => {
    expect(evaluateSide('2+3*4')).toBe(14)
    expect(evaluateSide('20-2*6')).toBe(8)
    expect(evaluateSide('2*8+9')).toBe(25)
  })

  it('divides only when it divides evenly', () => {
    expect(evaluateSide('6/3')).toBe(2)
    expect(evaluateSide('72/8')).toBe(9)
    expect(evaluateSide('7/2')).toBeNull()
  })

  it('rejects divide-by-zero and malformed sides', () => {
    expect(evaluateSide('1/0')).toBeNull()
    expect(evaluateSide('1++1')).toBeNull()
    expect(evaluateSide('+1')).toBeNull()
    expect(evaluateSide('1+')).toBeNull()
    expect(evaluateSide('')).toBeNull()
  })

  it('rejects a multi-digit number with a leading zero', () => {
    expect(evaluateSide('01')).toBeNull()
    expect(evaluateSide('0')).toBe(0)
  })
})

// -- isValidEquation ---------------------------------------------------------

describe('isValidEquation', () => {
  it('accepts a correct 8-char equation', () => {
    expect(isValidEquation('13+27=40')).toBe(true)
    expect(isValidEquation('8*16=128')).toBe(true)
    expect(isValidEquation('120/8=15')).toBe(true)
    expect(isValidEquation('85-27=58')).toBe(true)
  })

  it('rejects a wrong arithmetic result (1+1=3)', () => {
    expect(isValidEquation('1+1=3')).toBe(false)
  })

  it('rejects a leading zero (01+1=2)', () => {
    expect(isValidEquation('01+1=2')).toBe(false)
    expect(isValidEquation('01+09=10')).toBe(false)
  })

  it('rejects divide-by-zero (1/0=0)', () => {
    expect(isValidEquation('1/0=0')).toBe(false)
    expect(isValidEquation('10/0=10')).toBe(false)
  })

  it('rejects a double operator (1++1=2)', () => {
    expect(isValidEquation('1++1=2')).toBe(false)
    expect(isValidEquation('12++4=16')).toBe(false)
  })

  it('rejects an operator at the start of a side (=1+1)', () => {
    expect(isValidEquation('=1+1')).toBe(false)
    expect(isValidEquation('+13=013')).toBe(false)
  })

  it('honors precedence: 2+3*4=14 valid, 2+3*4=20 invalid', () => {
    expect(isValidEquation('2+3*4=14')).toBe(true)
    expect(isValidEquation('2+3*4=20')).toBe(false)
  })

  it('rejects the wrong length', () => {
    expect(isValidEquation('1+1=2')).toBe(false) // 5 chars
    expect(isValidEquation('123+456=579')).toBe(false) // 11 chars
  })

  it('requires exactly one =', () => {
    expect(isValidEquation('1+1=2=2x')).toBe(false)
    expect(isValidEquation('12+3456')).toBe(false) // no =
  })

  it('rejects an empty side', () => {
    expect(isValidEquation('1234567=')).toBe(false)
    expect(isValidEquation('=1234567')).toBe(false)
  })

  it('rejects stray characters', () => {
    expect(isValidEquation('1+1 =2=2')).toBe(false)
    expect(isValidEquation('1+1=2.0z')).toBe(false)
  })

  it('requires a bare integer on the right (no operators)', () => {
    // A valid arithmetic identity, but Nerdle disallows an expression on the right.
    expect(isValidEquation('90=45+45')).toBe(false)
  })
})

// -- bank --------------------------------------------------------------------

describe('BANK', () => {
  it('has at least 50 entries', () => {
    expect(BANK.length).toBeGreaterThanOrEqual(50)
  })

  it('every entry is a valid 8-char equation', () => {
    for (const eq of BANK) {
      expect(eq.length, `${eq} should be 8 chars`).toBe(COLS)
      expect(isValidEquation(eq), `${eq} should be valid`).toBe(true)
    }
  })

  it('has no duplicate entries', () => {
    expect(new Set(BANK).size).toBe(BANK.length)
  })
})

// -- generatePuzzle (golden) -------------------------------------------------

describe('generatePuzzle', () => {
  it('is a golden pick for a fixed seed', () => {
    expect(generatePuzzle(mulberry32(12345))).toBe('20-2*6=8')
    expect(generatePuzzle(mulberry32(42))).toBe('8*16=128')
    expect(generatePuzzle(mulberry32(1))).toBe('120/8=15')
  })

  it('always returns a bank entry', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(BANK).toContain(generatePuzzle(mulberry32(seed)))
    }
  })

  it('newGame answer comes from the daily seed deterministically', () => {
    const a = newGame(mulberry32(dailySeed('2026-07-20')))
    const b = newGame(mulberry32(dailySeed('2026-07-20')))
    expect(a.answer).toBe(b.answer)
    expect(BANK).toContain(a.answer)
    expect(a.status).toBe('playing')
    expect(a.guesses).toEqual([])
  })
})

// -- scoreRow (coloring) -----------------------------------------------------

describe('scoreRow', () => {
  it('marks all green for an exact match', () => {
    expect(scoreRow('13+27=40', '13+27=40')).toEqual([
      'green', 'green', 'green', 'green', 'green', 'green', 'green', 'green',
    ])
  })

  it('marks a symbol in the wrong spot purple', () => {
    // answer 18+12=30 ; guess starts 1... with a stray 1 that belongs elsewhere
    const r = scoreRow('11+45=56', '18+12=30')
    expect(r[0]).toBe('green') // 1 == 1
    expect(r[1]).toBe('purple') // second guess 1 lives at answer pos3
  })

  it('marks absent symbols grey', () => {
    const r = scoreRow('99/9=110', '13+27=40')
    // '9' and '/' and '1' etc — only shared symbols can color
    expect(r.every((s) => s === 'grey' || s === 'purple' || s === 'green')).toBe(true)
    expect(r[0]).toBe('grey') // 9 not in answer
  })

  it('handles duplicate symbols: two answer 1s, three guess 1s → one purple, rest grey', () => {
    // answer has 1s at pos3 and pos4; one guess 1 lands green (pos4),
    // one leftover answer 1 (pos3) colors exactly one other guess 1 purple.
    const r = scoreRow('11+51=16', '55+11=66')
    expect(r).toEqual([
      'purple', // guess 1 -> leftover answer 1 (pos3)
      'grey', // no more 1s left
      'green', // +
      'purple', // 5 -> leftover answer 5 (answer has two 5s)
      'green', // 1 == 1 (consumes an answer 1)
      'green', // =
      'grey', // 1 vs 6, no 1s left
      'green', // 6 == 6
    ])
    // The three guess 1s resolve to exactly one green + one purple + one grey.
    expect(r.filter((_, i) => '11+51=16'[i] === '1')).toEqual(['purple', 'grey', 'green', 'grey'])
  })

  it('does not over-award purple when greens already consumed the copies', () => {
    // answer 18+12=30 has two 1s, both matched green by guess 1..1..
    const r = scoreRow('11+11=11', '18+12=30')
    expect(r[0]).toBe('green') // 1==1
    expect(r[3]).toBe('green') // 1==1
    // the surplus 1s have no leftover to borrow → grey
    expect(r[1]).toBe('grey')
    expect(r[4]).toBe('grey')
    expect(r[6]).toBe('grey')
    expect(r[7]).toBe('grey')
  })
})

// -- keyStates ---------------------------------------------------------------

describe('keyStates', () => {
  it('keeps the best state per symbol (green > purple > grey)', () => {
    let s: GameState = { answer: '13+27=40', guesses: [], status: 'playing' }
    s = submitGuess(s, '120/8=15') // valid 8-char but wrong
    const map = keyStates(s)
    expect(map.get('/')).toBe('grey') // '/' not in the answer
    expect(map.get('1')).toBe('green') // pos0 '1' == answer pos0 '1'
  })

  it('upgrades a symbol to green when a later guess nails its spot', () => {
    let s: GameState = { answer: '2*8+9=25', guesses: [], status: 'playing' }
    s = submitGuess(s, '4*5+9=29') // valid, some symbols misplaced
    s = submitGuess(s, '2*8+9=25') // exact
    const map = keyStates(s)
    expect(map.get('2')).toBe('green')
    expect(map.get('8')).toBe('green')
  })
})

// -- reducer: submit / win / lose / reject -----------------------------------

describe('submitGuess', () => {
  it('rejects an invalid equation without consuming a guess (same ref)', () => {
    const s: GameState = { answer: '13+27=40', guesses: [], status: 'playing' }
    const next = submitGuess(s, '1+1=333') // not valid
    expect(next).toBe(s) // reference-equal → rejected
    expect(next.guesses.length).toBe(0)
  })

  it('appends a valid guess and stays playing', () => {
    const s: GameState = { answer: '13+27=40', guesses: [], status: 'playing' }
    const next = submitGuess(s, '85-27=58')
    expect(next).not.toBe(s)
    expect(next.guesses).toEqual(['85-27=58'])
    expect(next.status).toBe('playing')
  })

  it('wins on the exact answer', () => {
    let s: GameState = { answer: '2*8+9=25', guesses: [], status: 'playing' }
    s = submitGuess(s, '13+27=40') // valid, wrong
    s = submitGuess(s, '2*8+9=25') // exact
    expect(s.status).toBe('won')
    expect(guessesUsed(s)).toBe(2)
  })

  it('loses after six wrong-but-valid guesses', () => {
    let s: GameState = { answer: '2*8+9=25', guesses: [], status: 'playing' }
    const wrong = ['13+27=40', '48+24=72', '85-27=58', '36+45=81', '120/8=15', '8*16=128']
    for (const g of wrong) s = submitGuess(s, g)
    expect(s.guesses.length).toBe(MAX_GUESSES)
    expect(s.status).toBe('lost')
  })

  it('does not exceed MAX_GUESSES after loss (no-op once over)', () => {
    let s: GameState = { answer: '2*8+9=25', guesses: [], status: 'playing' }
    const wrong = ['13+27=40', '48+24=72', '85-27=58', '36+45=81', '120/8=15', '8*16=128']
    for (const g of wrong) s = submitGuess(s, g)
    const after = submitGuess(s, '13+27=40')
    expect(after).toBe(s) // game over → no change
    expect(after.guesses.length).toBe(MAX_GUESSES)
  })

  it('rejected invalid guess in the middle does not consume a slot', () => {
    let s: GameState = { answer: '2*8+9=25', guesses: [], status: 'playing' }
    s = submitGuess(s, '13+27=40')
    const rejected = submitGuess(s, '2+2=5678') // valid form, wrong arithmetic
    expect(rejected).toBe(s)
    expect(rejected.guesses.length).toBe(1)
  })
})

// -- resetGame ---------------------------------------------------------------

describe('resetGame', () => {
  it('returns a fresh playing state from the rng', () => {
    const s = resetGame(mulberry32(12345))
    expect(s.status).toBe('playing')
    expect(s.guesses).toEqual([])
    expect(s.answer).toBe('20-2*6=8')
  })
})

// -- score -------------------------------------------------------------------

describe('score', () => {
  it('is 0 before a win', () => {
    const s: GameState = { answer: '13+27=40', guesses: [], status: 'playing' }
    expect(score(s)).toBe(0)
    expect(score({ ...s, status: 'lost' })).toBe(0)
  })

  it('rewards fewer guesses (monotonic)', () => {
    const answer = '2*8+9=25'
    const wrong = ['13+27=40', '48+24=72', '85-27=58', '36+45=81', '120/8=15']

    // Win in 1
    let fast: GameState = { answer, guesses: [], status: 'playing' }
    fast = submitGuess(fast, answer)
    const scoreFast = score(fast)

    // Win in 3
    let slow: GameState = { answer, guesses: [], status: 'playing' }
    slow = submitGuess(slow, wrong[0])
    slow = submitGuess(slow, wrong[1])
    slow = submitGuess(slow, answer)
    const scoreSlow = score(slow)

    expect(scoreFast).toBeGreaterThan(scoreSlow)
    expect(scoreFast).toBe(1000 + (MAX_GUESSES - 1) * 100)
    expect(scoreSlow).toBe(1000 + (MAX_GUESSES - 3) * 100)
  })
})
