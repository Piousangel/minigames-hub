import { describe, expect, it } from 'vitest'
import { gamePages } from './registry'
import { GAME_INTROS } from './gameIntros'

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

describe('GAME_INTROS', () => {
  it('레지스트리의 모든 게임 페이지에 intro가 있다', () => {
    const missing = gamePages.map((g) => g.slug).filter((slug) => !GAME_INTROS[slug])
    expect(missing).toEqual([])
  })

  it('모든 intro는 120단어 이상이다', () => {
    for (const g of gamePages) {
      const intro = GAME_INTROS[g.slug]
      if (!intro) continue // 누락은 위 테스트가 잡는다
      expect(wordCount(intro), g.slug).toBeGreaterThanOrEqual(120)
    }
  })

  it('레지스트리에 없는 slug의 intro는 없다', () => {
    const slugs = new Set(gamePages.map((g) => g.slug))
    expect(Object.keys(GAME_INTROS).filter((k) => !slugs.has(k))).toEqual([])
  })
})
