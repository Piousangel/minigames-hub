import { describe, expect, it } from 'vitest'
import {
  generateNumber,
  isCorrect,
  newGame,
  nextNumber,
  submit,
  type NumberMemoryState,
} from './engine'

/** Deterministic seeded PRNG (mulberry32) for reproducible tests. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('generateNumber', () => {
  it('level 1 number has exactly 1 digit', () => {
    expect(generateNumber(1, () => 0)).toHaveLength(1)
  })

  it('level N number has exactly N digits', () => {
    for (let n = 1; n <= 12; n++) {
      expect(generateNumber(n, seeded(n + 1))).toHaveLength(n)
    }
  })

  it('matches the expected string for a given rng (deterministic mapping)', () => {
    // rng()=0 → first digit 1, remaining digits 0 → "100"
    expect(generateNumber(3, () => 0)).toBe('100')
    // rng()=0.999… → first digit 9, remaining digits 9 → "999"
    expect(generateNumber(3, () => 0.9999)).toBe('999')
  })

  it('produces a purely numeric string with no leading zero', () => {
    for (let n = 1; n <= 8; n++) {
      const s = generateNumber(n, seeded(1000 + n))
      expect(s).toMatch(/^[1-9][0-9]*$/)
      expect(s).toHaveLength(n)
    }
  })

  it('is deterministic for the same seed', () => {
    expect(generateNumber(6, seeded(42))).toBe(generateNumber(6, seeded(42)))
  })
})

describe('newGame', () => {
  it('starts at level 1 with a 1-digit number in the show phase', () => {
    const s = newGame(seeded(7))
    expect(s.level).toBe(1)
    expect(s.number).toHaveLength(1)
    expect(s.phase).toBe('show')
    expect(s.reached).toBe(0)
    expect(s.over).toBe(false)
  })
})

describe('nextNumber', () => {
  it('generates a number whose length matches the current level', () => {
    let s: NumberMemoryState = { phase: 'input', level: 5, number: '', reached: 4, over: false }
    s = nextNumber(s, seeded(3))
    expect(s.number).toHaveLength(5)
    expect(s.phase).toBe('show')
  })
})

describe('submit', () => {
  it('correct guess advances to the next level and records the cleared level', () => {
    const s = newGame(() => 0) // number "1" at level 1
    const next = submit(s, '1')
    expect(next.over).toBe(false)
    expect(next.level).toBe(2)
    expect(next.reached).toBe(1) // cleared level 1
  })

  it('wrong guess ends the game and keeps the level reached', () => {
    // Simulate having cleared level 3, now attempting level 4.
    const s: NumberMemoryState = { phase: 'input', level: 4, number: '4231', reached: 3, over: false }
    const next = submit(s, '0000')
    expect(next.over).toBe(true)
    expect(next.phase).toBe('over')
    expect(next.reached).toBe(3) // highest level cleared is preserved
  })

  it('wrong guess at level 1 records reached 0', () => {
    const s = newGame(() => 0) // number "1"
    const next = submit(s, '9')
    expect(next.over).toBe(true)
    expect(next.reached).toBe(0)
  })

  it('is ignored once the game is over', () => {
    const over: NumberMemoryState = { phase: 'over', level: 4, number: '4231', reached: 3, over: true }
    expect(submit(over, '4231')).toBe(over)
  })

  it('tracks level and score across a multi-level run deterministically', () => {
    const rng = seeded(99)
    let s = newGame(rng)
    let cleared = 0
    for (let i = 0; i < 5; i++) {
      expect(s.number).toHaveLength(s.level) // each level's number length == level
      const guess = s.number // recall correctly
      s = submit(s, guess)
      cleared++
      expect(s.reached).toBe(cleared)
      expect(s.level).toBe(cleared + 1)
      s = nextNumber(s, rng) // reveal the next, longer number
    }
    expect(s.level).toBe(6)
    expect(s.number).toHaveLength(6)
    expect(s.over).toBe(false)
  })
})

describe('isCorrect', () => {
  it('reports whether a guess matches the current number without mutating', () => {
    const s = newGame(() => 0) // "1"
    expect(isCorrect(s, '1')).toBe(true)
    expect(isCorrect(s, '2')).toBe(false)
    expect(s.over).toBe(false) // unchanged
  })
})
