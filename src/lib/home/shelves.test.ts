import { describe, expect, it } from 'vitest'
import { gamePages } from '@/lib/games/registry'
import { CATEGORIES, gameMeta, type GameCategory } from '@/lib/games/gameMeta'
import { LIBRARY_PREVIEW, libraryOrder, shelves } from './shelves'

describe('shelves (D4: 수는 계산값)', () => {
  it('합계 = gamePages.length, 선반 4개는 Puzzle·Arcade·Classic·Skill 순서', () => {
    const s = shelves(gamePages, gameMeta)
    expect(s.map((x) => x.category)).toEqual(CATEGORIES)
    expect(s.reduce((n, x) => n + x.count, 0)).toBe(gamePages.length)
    for (const x of s) expect(x.count).toBeGreaterThan(0)
  })

  it('각 선반 수 = 그 카테고리 게임 수(registry × gameMeta 직접 집계와 같음)', () => {
    const s = shelves(gamePages, gameMeta)
    for (const x of s) {
      const direct = gamePages.filter((p) => (gameMeta[p.slug]?.category ?? 'Arcade') === x.category).length
      expect(x.count).toBe(direct)
    }
  })

  it('D5 마스코트 1:1, 라우트 slug는 카테고리 소문자', () => {
    const s = shelves(gamePages, gameMeta)
    expect(s.map((x) => x.host)).toEqual(['mallang', 'tori', 'haessi', 'bomi'])
    expect(s.map((x) => x.slug)).toEqual(CATEGORIES.map((c) => c.toLowerCase()))
  })

  it('gameMeta에 없는 slug는 DEFAULT_META(Arcade)로 센다 — 누락 없이 합계 유지', () => {
    const s = shelves([{ slug: 'nope' }, { slug: '2048' }], gameMeta)
    expect(s.find((x) => x.category === 'Arcade')?.count).toBe(1)
    expect(s.find((x) => x.category === 'Puzzle')?.count).toBe(1)
  })
})

describe('libraryOrder', () => {
  const items = gamePages.map((p) => ({ slug: p.slug, category: (gameMeta[p.slug]?.category ?? 'Arcade') as GameCategory }))

  it('길이·집합이 그대로(113개 모두 한 번씩)', () => {
    const o = libraryOrder(items)
    expect(o).toHaveLength(items.length)
    expect(new Set(o.map((x) => x.slug))).toEqual(new Set(items.map((x) => x.slug)))
  })

  it('앞 24개(접힌 상태)에 네 카테고리가 모두 6개씩', () => {
    const head = libraryOrder(items).slice(0, LIBRARY_PREVIEW)
    for (const c of CATEGORIES) expect(head.filter((x) => x.category === c)).toHaveLength(6)
  })

  it('카테고리 안 순서는 registry 순서', () => {
    const o = libraryOrder(items)
    for (const c of CATEGORIES) {
      expect(o.filter((x) => x.category === c).map((x) => x.slug)).toEqual(items.filter((x) => x.category === c).map((x) => x.slug))
    }
  })
})
