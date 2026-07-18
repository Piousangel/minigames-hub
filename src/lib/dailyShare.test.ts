import { describe, it, expect } from 'vitest'
import { gradeFewer, gradeMore, gradeRatio, barGlyph, glyphBlocks, dailySerial } from './dailyShare'

describe('gradeFewer (par daily, fewer is better)', () => {
  it('under par is S', () => expect(gradeFewer(4, 5)).toBe('S'))
  it('on par is A', () => expect(gradeFewer(5, 5)).toBe('A'))
  it('+1 is B', () => expect(gradeFewer(6, 5)).toBe('B'))
  it('+2 is C', () => expect(gradeFewer(7, 5)).toBe('C'))
  it('+3 or more is D', () => {
    expect(gradeFewer(8, 5)).toBe('D')
    expect(gradeFewer(20, 5)).toBe('D')
  })
})

describe('gradeMore (Ricochet chain, more is better)', () => {
  it('+3 over par is S', () => expect(gradeMore(10, 7)).toBe('S'))
  it('+2 is A', () => expect(gradeMore(9, 7)).toBe('A'))
  it('+1 is B', () => expect(gradeMore(8, 7)).toBe('B'))
  it('on par is C', () => expect(gradeMore(7, 7)).toBe('C'))
  it('under par is D', () => expect(gradeMore(5, 7)).toBe('D'))
})

describe('gradeRatio (endless, PB-relative)', () => {
  it('new best is S', () => expect(gradeRatio(500, 500, true)).toBe('S'))
  it('best 0 is S', () => expect(gradeRatio(0, 0, false)).toBe('S'))
  it('>=85% of best is A', () => expect(gradeRatio(90, 100, false)).toBe('A'))
  it('>=60% is B', () => expect(gradeRatio(60, 100, false)).toBe('B'))
  it('>=35% is C', () => expect(gradeRatio(40, 100, false)).toBe('C'))
  it('below 35% is D', () => expect(gradeRatio(10, 100, false)).toBe('D'))
})

describe('barGlyph', () => {
  it('par daily: n = max(used, par), fills used', () => {
    const g = barGlyph(5, 7, 'x') // used 5, par 7
    expect(g.cells).toHaveLength(7)
    expect(g.cells.slice(0, 5).every((v) => v === 1)).toBe(true)
    expect(g.cells.slice(5).every((v) => v === 0.15)).toBe(true)
    expect(g.par).toBe(7)
  })
  it('caps cells at 10', () => {
    expect(barGlyph(20, 15, 'x').cells).toHaveLength(10)
  })
  it('endless: no par, n = max(mag, 1)', () => {
    const g = barGlyph(6, undefined, 'x')
    expect(g.cells).toHaveLength(6)
    expect(g.par).toBeUndefined()
  })
})

describe('glyphBlocks (text snippet)', () => {
  it('filled vs empty with par bar', () => {
    expect(glyphBlocks([1, 1, 1, 0.15, 0.15], 3)).toBe('▰▰▰│▱▱')
  })
  it('no par bar when omitted', () => {
    expect(glyphBlocks([1, 0.15])).toBe('▰▱')
  })
})

describe('dailySerial', () => {
  it('is monotonic and positive after launch', () => {
    expect(dailySerial('2026-01-01')).toBe(1)
    expect(dailySerial('2026-01-10')).toBe(10)
    expect(dailySerial('2026-07-18')).toBeGreaterThan(190)
  })
})
