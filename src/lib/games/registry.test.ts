import { describe, expect, it } from 'vitest'
import { gamePages } from './registry'
import { themes2048 } from './g2048/themes'

describe('gamePages 레지스트리', () => {
  it('slug는 유일하고 URL-safe다', () => {
    const slugs = gamePages.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/)
  })
  it('모든 페이지에 SEO 텍스트 섹션이 있다', () => {
    for (const g of gamePages) {
      expect(g.howToPlay.length).toBeGreaterThanOrEqual(3)
      expect(g.strategy.length).toBeGreaterThanOrEqual(3)
      expect(g.faq.length).toBeGreaterThanOrEqual(3)
    }
  })
  it('2048 페이지의 themeKey는 실제 테마를 가리킨다', () => {
    for (const g of gamePages.filter((g) => g.game === '2048')) {
      expect(themes2048[g.themeKey]).toBeDefined()
    }
  })
  it('2048 테마는 2~2048 타일 표기를 모두 가진다', () => {
    const required = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]
    for (const t of Object.values(themes2048)) {
      for (const v of required) expect(t.tiles[v], `${t.key}:${v}`).toBeTruthy()
    }
  })
})
