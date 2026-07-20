import { describe, it, expect } from 'vitest'
import { COLLECTIONS, COLLECTION_SLUGS, collectionsForGame } from './collections'
import { gamePages } from './registry'

const validSlugs = new Set(gamePages.map((g) => g.slug))

describe('collections 규약 (doorway/thin-content 가드)', () => {
  it('컬렉션이 하나 이상 있다', () => {
    expect(COLLECTION_SLUGS.length).toBeGreaterThan(0)
  })

  for (const key of Object.keys(COLLECTIONS)) {
    const c = COLLECTIONS[key]
    describe(key, () => {
      it('slug이 키와 일치', () => {
        expect(c.slug).toBe(key)
      })
      it('멤버 게임 ≥5', () => {
        expect(c.games.length).toBeGreaterThanOrEqual(5)
      })
      it('모든 멤버 slug이 registry에 존재', () => {
        for (const s of c.games) expect(validSlugs.has(s), `${key}: 알 수 없는 게임 ${s}`).toBe(true)
      })
      it('멤버 중복 없음', () => {
        expect(new Set(c.games).size).toBe(c.games.length)
      })
      it('필수 필드가 채워짐', () => {
        expect(c.h1.length).toBeGreaterThan(0)
        expect(c.title.length).toBeGreaterThan(0)
        expect(c.metaDescription.length).toBeGreaterThan(0)
        expect(c.faq.length).toBeGreaterThanOrEqual(3)
      })
      it('intro가 충분히 길다(얇은 콘텐츠 금지, ≥120단어)', () => {
        expect(c.intro.split(/\s+/).length).toBeGreaterThanOrEqual(120)
      })
    })
  }

  it('intro가 컬렉션마다 고유(near-duplicate 금지)', () => {
    const intros = COLLECTION_SLUGS.map((s) => COLLECTIONS[s].intro)
    expect(new Set(intros).size).toBe(intros.length)
    // 첫 120자 접두어도 서로 달라야 한다(표절성 템플릿 방지).
    const prefixes = intros.map((i) => i.slice(0, 120))
    expect(new Set(prefixes).size).toBe(prefixes.length)
  })

  it('FAQ 질문이 컬렉션마다 고유 조합', () => {
    const faqSets = COLLECTION_SLUGS.map((s) => COLLECTIONS[s].faq.map((f) => f.q).join('|'))
    expect(new Set(faqSets).size).toBe(faqSets.length)
  })

  it('collectionsForGame이 역링크를 바르게 찾는다', () => {
    // clusters는 여러 컬렉션에 속한다.
    const forClusters = collectionsForGame('clusters').map((c) => c.slug)
    expect(forClusters).toContain('games-like-connections')
    expect(collectionsForGame('__nope__')).toHaveLength(0)
  })
})
