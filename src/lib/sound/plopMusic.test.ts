import { describe, expect, it } from 'vitest'
import { BARS, BEAT_S, BPM, barNotes, midiToHz } from './plopMusic'

describe('plopMusic', () => {
  it('같은 틴트·마디는 항상 같은 악보(결정적)', () => {
    for (const t of [0, 1, 2] as const) for (let b = 0; b < BARS; b++) expect(barNotes(t, b)).toEqual(barNotes(t, b))
  })
  it('16마디 순환: 마디 16은 마디 0과 같다', () => {
    expect(barNotes(0, BARS)).toEqual(barNotes(0, 0))
  })
  it('틴트마다 악보가 다르다', () => {
    expect(barNotes(0, 0)).not.toEqual(barNotes(1, 0))
    expect(barNotes(0, 0)).not.toEqual(barNotes(2, 0))
  })
  it('음역과 박 위치가 안전하다(귀가 아프지 않은 범위, 마디 안)', () => {
    for (const t of [0, 1, 2] as const)
      for (let b = 0; b < BARS; b++)
        for (const n of barNotes(t, b)) {
          expect(n.midi).toBeGreaterThanOrEqual(36)
          expect(n.midi).toBeLessThanOrEqual(90)
          expect(n.beat).toBeGreaterThanOrEqual(0)
          expect(n.beat).toBeLessThan(4)
          expect(n.gain).toBeGreaterThan(0)
          expect(n.gain).toBeLessThanOrEqual(0.25)
        }
  })
  it('모든 마디에 패드·베이스가 있고, 리드는 한 마디에 8개를 넘지 않는다', () => {
    for (let b = 0; b < BARS; b++) {
      const ns = barNotes(1, b)
      expect(ns.some((n) => n.kind === 'pad')).toBe(true)
      expect(ns.some((n) => n.kind === 'bass')).toBe(true)
      expect(ns.filter((n) => n.kind === 'lead').length).toBeLessThanOrEqual(8)
    }
  })
  it('템포와 변환', () => {
    expect(BPM).toBe(84)
    expect(BEAT_S).toBeCloseTo(0.714, 2)
    expect(midiToHz(69)).toBeCloseTo(440, 6)
    expect(midiToHz(81)).toBeCloseTo(880, 6)
  })
})
