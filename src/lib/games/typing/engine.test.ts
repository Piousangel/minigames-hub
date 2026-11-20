import { describe, expect, it } from 'vitest'
import { compareToBest, computeAccuracy, computeWpm, liveWpm, sampleWords, WORDS } from './engine'

describe('sampleWords', () => {
  it('count만큼 WORDS에서 뽑고 rng가 같으면 결과도 같다', () => {
    const a = sampleWords(50, () => 0)
    expect(a).toHaveLength(50)
    for (const w of a) expect(WORDS).toContain(w)
    expect(a.every((w) => w === WORDS[0])).toBe(true) // rng 0 → 항상 첫 단어
  })
})

describe('computeWpm', () => {
  it('60초에 250자 정타 = 50 WPM', () => {
    expect(computeWpm(250, 60_000)).toBe(50)
  })
  it('30초에 100자 = 40 WPM', () => {
    expect(computeWpm(100, 30_000)).toBe(40)
  })
  it('경과 0이면 0', () => {
    expect(computeWpm(100, 0)).toBe(0)
  })
})

describe('computeAccuracy', () => {
  it('90/100 = 90%', () => {
    expect(computeAccuracy(90, 100)).toBe(90)
  })
  it('아무것도 안 쳤으면 100%', () => {
    expect(computeAccuracy(0, 0)).toBe(100)
  })
})

describe('compareToBest', () => {
  it('기록이 없으면 첫 기록(0 WPM이면 동률 취급)', () => {
    expect(compareToBest(42, 0)).toEqual({ kind: 'first', diff: 42 })
    expect(compareToBest(0, 0)).toEqual({ kind: 'tie', diff: 0 })
  })
  it('직전 최고보다 높으면 new + 차이', () => {
    expect(compareToBest(61, 55)).toEqual({ kind: 'new', diff: 6 })
  })
  it('같으면 tie', () => {
    expect(compareToBest(55, 55)).toEqual({ kind: 'tie', diff: 0 })
  })
  it('낮으면 short + 모자란 만큼', () => {
    expect(compareToBest(40, 55)).toEqual({ kind: 'short', diff: 15 })
  })
})

describe('liveWpm', () => {
  it('3초 전에는 null(— 표시) — 첫 단어 하나로 수백 WPM이 튀지 않게', () => {
    expect(liveWpm(10, 1000)).toBeNull()
    expect(liveWpm(10, 2999)).toBeNull()
  })
  it('3초부터는 실제 경과 기준 computeWpm과 같다', () => {
    expect(liveWpm(25, 3000)).toBe(computeWpm(25, 3000))
    expect(liveWpm(100, 30_000)).toBe(40)
  })
})
