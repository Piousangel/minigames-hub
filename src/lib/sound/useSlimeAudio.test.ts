import { describe, expect, it } from 'vitest'
import { acornFreq } from './useSlimeAudio'

describe('acornFreq', () => {
  it('도토리를 연속으로 먹을수록 음이 올라간다(도-미-솔), 범위를 벗어나도 안전', () => {
    expect(acornFreq(1)).toBeLessThan(acornFreq(2))
    expect(acornFreq(2)).toBeLessThan(acornFreq(3))
    expect(acornFreq(0)).toBe(acornFreq(1))
    expect(acornFreq(9)).toBe(acornFreq(3))
  })
})
