import { describe, expect, it } from 'vitest'
import { orderBoards, parseRankInfo, rankLine, topPercent } from './leaderboardOrder'

const meta = {
  a: { addedDate: '2026-10-01' },
  b: { addedDate: '2026-11-17' },
  c: { addedDate: '2026-11-17' }, // b와 같은 날: 나중에 선언된 c가 앞
  d: {}, // 날짜 없음 → 맨 뒤
}

describe('orderBoards', () => {
  it('최신 게임 순, 같은 날은 나중에 선언된 쪽이 앞, 날짜 없는 게임은 맨 뒤', () => {
    const slugs = ['a', 'b', 'c', 'd']
    const r = orderBoards(slugs, { a: [1], b: [1], c: [1], d: [1] }, meta)
    expect(r.active).toEqual(['c', 'b', 'a', 'd'])
    expect(r.empty).toEqual([])
  })
  it('점수 있는 보드는 active, 빈 보드는 empty로 나뉘고 각각 최신 순', () => {
    const r = orderBoards(['a', 'b', 'c', 'd'], { a: [1], d: [1] }, meta)
    expect(r.active).toEqual(['a', 'd'])
    expect(r.empty).toEqual(['c', 'b'])
  })
  it('아직 로딩 중(null)이면 모두 empty로 두되 순서는 최신 순', () => {
    expect(orderBoards(['a', 'b'], null, meta).empty).toEqual(['b', 'a'])
  })
})

describe('순위 정보', () => {
  it('topPercent: 올림, 최소 1, 최대 100', () => {
    expect(topPercent(1, 100)).toBe(1)
    expect(topPercent(3, 12)).toBe(25)
    expect(topPercent(5, 7)).toBe(72)
    expect(topPercent(7, 7)).toBe(100)
    expect(topPercent(0, 7)).toBe(100)
  })
  it('parseRankInfo: 이상값·옛 응답은 null', () => {
    expect(parseRankInfo({ rank: 3, total: 12 })).toEqual({ rank: 3, total: 12, topPercent: 25 })
    expect(parseRankInfo({})).toBeNull()
    expect(parseRankInfo({ rank: 5, total: 3 })).toBeNull()
    expect(parseRankInfo({ rank: 0, total: 3 })).toBeNull()
    expect(parseRankInfo(null)).toBeNull()
  })
  it('rankLine: 혼자일 때·1위·그 외', () => {
    expect(rankLine({ rank: 1, total: 1, topPercent: 1 })).toContain("You're #1")
    expect(rankLine({ rank: 1, total: 9, topPercent: 12 })).toContain('top of the board')
    expect(rankLine({ rank: 3, total: 12, topPercent: 25 })).toBe('#3 of 12 scores this week · top 25%')
  })
})
