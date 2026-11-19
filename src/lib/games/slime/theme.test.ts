import { describe, expect, it } from 'vitest'
import { SKY, THEME_BY_STAGE, themeOf } from './theme'
import { SLIME_STAGES } from './stages'

describe('시간대(하늘)', () => {
  it('일일 풀의 모든 스테이지에 시간대가 지정돼 있다', () => {
    for (const s of SLIME_STAGES) expect(THEME_BY_STAGE[s.id], s.id).toBeDefined()
  })
  it('풀의 스테이지는 서로 다른 시간대를 쓴다', () => {
    expect(new Set(SLIME_STAGES.map((s) => themeOf(s.id))).size).toBe(SLIME_STAGES.length)
  })
  it('모르는 id는 노을(현행)', () => {
    expect(themeOf('zzz')).toBe('sunset')
    expect(SKY.sunset.veil).toBe(0)
  })
})
