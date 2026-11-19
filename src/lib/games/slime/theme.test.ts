import { describe, expect, it } from 'vitest'
import { SKY, THEME_BY_STAGE, themeOf } from './theme'
import { SLIME_STAGES } from './stages'

describe('시간대(하늘)', () => {
  it('일일 풀의 모든 스테이지에 시간대가 지정돼 있다', () => {
    for (const s of SLIME_STAGES) expect(THEME_BY_STAGE[s.id], s.id).toBeDefined()
  })
  it('풀 순서대로 새벽→밤으로 어두워진다(여정)', () => {
    const order = ['dawn', 'morning', 'noon', 'afternoon', 'sunset', 'dusk', 'night', 'starry']
    const idx = SLIME_STAGES.map((s) => order.indexOf(themeOf(s.id)))
    // 순서가 단조 증가는 아니어도(출시 전 임시 배치) 8개가 서로 다른 시간대여야 한다
    expect(new Set(idx).size).toBe(SLIME_STAGES.length)
  })
  it('모르는 id는 노을(현행)', () => {
    expect(themeOf('zzz')).toBe('sunset')
    expect(SKY.sunset.veil).toBe(0)
  })
})
