import { describe, expect, it } from 'vitest'
import { buildPopularSql, MIN_PLAYERS, parsePopularRows, rankFeatured } from './popular'

const curated = ['solitaire', 'chess', '2048', 'flow', 'unblock']
const known = new Set([...curated, 'reactor', 'snake', 'beatline'])

describe('buildPopularSql', () => {
  it('distinct vid, dwell 임계, 기간, JSON 포맷', () => {
    const sql = buildPopularSql(14, 15, 200)
    expect(sql).toContain('COUNT(DISTINCT blob4) AS players')
    expect(sql).toContain("blob1 = 'dwell'")
    expect(sql).toContain('double1 >= 15')
    expect(sql).toContain("INTERVAL '14' DAY")
    expect(sql).toContain('GROUP BY slug')
    expect(sql).toContain('LIMIT 200')
    expect(sql).toMatch(/FORMAT JSON$/)
    // AE SQL 미지원 함수는 쓰지 않는다
    expect(sql).not.toMatch(/position/i)
  })

  it('숫자 인자를 정수로 강제', () => {
    expect(buildPopularSql(3.7, 9.9, 10.2)).toContain("INTERVAL '3' DAY")
    expect(buildPopularSql(0, -5, 0)).toContain('double1 >= 0')
  })
})

describe('parsePopularRows', () => {
  it('문자열 숫자 변환·잘못된 행 제거·내림차순', () => {
    const rows = parsePopularRows({
      data: [
        { slug: 'chess', players: '3' },
        { slug: 'flow', players: 7 },
        { slug: 'BAD SLUG', players: 9 },
        { slug: 'x', players: 'nan' },
        { slug: 'snake', players: 0 },
      ],
    })
    expect(rows).toEqual([
      { slug: 'flow', players: 7 },
      { slug: 'chess', players: 3 },
    ])
  })

  it('형태가 이상하면 빈 배열', () => {
    expect(parsePopularRows(null)).toEqual([])
    expect(parsePopularRows({ data: 'x' })).toEqual([])
    expect(parsePopularRows({})).toEqual([])
  })
})

describe('rankFeatured', () => {
  it('데이터 없으면 정확히 큐레이션 순서, 뱃지 없음', () => {
    const r = rankFeatured(curated, [], { known })
    expect(r.order).toEqual(curated)
    expect(r.popular.size).toBe(0)
  })

  it('기본 임계는 2명', () => {
    expect(MIN_PLAYERS).toBe(2)
  })

  it('1명짜리 봇 스파이크는 무시', () => {
    const r = rankFeatured(curated, [{ slug: 'reactor', players: 1 }, { slug: 'unblock', players: 1 }], { known })
    expect(r.order).toEqual(curated)
    expect(r.popular.size).toBe(0)
  })

  it('인기작이 players 내림차순으로 앞에, 나머지는 큐레이션 순', () => {
    const r = rankFeatured(
      curated,
      [
        { slug: 'flow', players: 3 },
        { slug: 'unblock', players: 5 },
      ],
      { known },
    )
    expect(r.order).toEqual(['unblock', 'flow', 'solitaire', 'chess', '2048'])
    expect([...r.popular]).toEqual(['unblock', 'flow'])
  })

  it('동률은 큐레이션 순서 유지', () => {
    const r = rankFeatured(
      curated,
      [
        { slug: 'flow', players: 2 },
        { slug: 'chess', players: 2 },
      ],
      { known },
    )
    expect(r.order.slice(0, 2)).toEqual(['chess', 'flow'])
  })

  it('큐레이션 밖 인기작이 들어오면 끝쪽 큐레이션이 밀려나고 길이는 고정', () => {
    const r = rankFeatured(curated, [{ slug: 'snake', players: 4 }], { known })
    expect(r.order).toEqual(['snake', 'solitaire', 'chess', '2048', 'flow'])
    expect(r.order).toHaveLength(curated.length)
  })

  it('동률이면 큐레이션 게임이 큐레이션 밖 게임보다 먼저', () => {
    const r = rankFeatured(
      curated,
      [
        { slug: 'snake', players: 3 },
        { slug: '2048', players: 3 },
      ],
      { known },
    )
    expect(r.order.slice(0, 2)).toEqual(['2048', 'snake'])
  })

  it('레지스트리에 없는 슬러그는 버린다', () => {
    const r = rankFeatured(curated, [{ slug: 'deleted-game', players: 50 }], { known })
    expect(r.order).toEqual(curated)
    expect(r.popular.has('deleted-game')).toBe(false)
  })

  it('큐레이션 중 레지스트리에 없는 것도 빠진다', () => {
    const r = rankFeatured([...curated, 'ghost'], [], { known })
    expect(r.order).toEqual(curated)
  })

  it('인기작이 레일보다 많아도 길이 고정', () => {
    const many = [...known].map((slug, i) => ({ slug, players: 10 + i }))
    const r = rankFeatured(curated, many, { known })
    expect(r.order).toHaveLength(curated.length)
    expect(new Set(r.order).size).toBe(curated.length)
  })

  it('minPlayers 옵션', () => {
    const r = rankFeatured(curated, [{ slug: 'flow', players: 2 }], { known, minPlayers: 3 })
    expect(r.order).toEqual(curated)
  })
})
