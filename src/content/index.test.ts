import { describe, expect, it } from 'vitest'
import { gamePages } from '@/lib/games/registry'
import { ARTICLES, GUIDES, guideForGame } from './index'

describe('content registry', () => {
  it('공략 slug는 모두 실제 게임 slug이고 중복이 없다', () => {
    const games = new Set(gamePages.map((g) => g.slug))
    const slugs = GUIDES.map((g) => g.slug)
    expect(slugs.filter((s) => !games.has(s))).toEqual([])
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('공략·기사 slug가 서로 겹치지 않는다(/guides/<slug> 충돌 방지)', () => {
    const all = [...GUIDES.map((g) => g.slug), ...ARTICLES.map((a) => a.slug)]
    expect(new Set(all).size).toBe(all.length)
  })

  it('battleship 공략이 등록되어 게임 페이지에서 링크된다', () => {
    const g = guideForGame('battleship')
    expect(g?.sections.length).toBeGreaterThanOrEqual(5)
    expect(g?.tables?.[0].rows.every((r) => r.length === g.tables![0].columns.length)).toBe(true)
  })
})
