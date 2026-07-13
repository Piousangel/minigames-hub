import { describe, expect, it } from 'vitest'
import { computeAccuracy, computeWpm, sampleWords, WORDS } from './engine'

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
