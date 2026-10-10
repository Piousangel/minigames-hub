import { describe, expect, it } from 'vitest'
import { buildPopularSql, createTtlCache, MIN_PLAYERS, parsePopularRows, rankFeatured } from './popular'

const curated = ['solitaire', 'chess', '2048', 'flow', 'unblock']
const known = new Set([...curated, 'reactor', 'snake', 'beatline'])

describe('buildPopularSql', () => {
  it('distinct vid, dwell 임계, 기간, JSON 포맷', () => {
    const sql = buildPopularSql(14, 15, 200)
    expect(sql).toContain('COUNT(DISTINCT blob4) AS players')
    expect(sql).toContain("blob1 = 'dwell'")
    expect(sql).toContain('double1 >= 15')
    expect(sql).toContain("INTERVAL '14' DAY")
    expect(sql).toContain("blob4 != ''")
    expect(sql).toContain("blob4 != 'anon'")
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
  it('형태만 맞춘다(문자열 숫자 변환·비문자 slug/NaN 제거) — 검증·정렬은 rankFeatured 몫', () => {
    const rows = parsePopularRows({
      data: [
        { slug: 'chess', players: '3' },
        { slug: 'flow', players: 7 },
        { slug: 42, players: 9 },
        { slug: 'x', players: 'nan' },
      ],
    })
    expect(rows).toEqual([
      { slug: 'chess', players: 3 },
      { slug: 'flow', players: 7 },
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

  it('기본 임계는 3명', () => {
    expect(MIN_PLAYERS).toBe(3)
  })

  it('1~2명짜리 봇 스파이크는 무시', () => {
    const r = rankFeatured(curated, [{ slug: 'chess', players: 1 }, { slug: 'unblock', players: 2 }], { known })
    expect(r.order).toEqual(curated)
    expect(r.popular.size).toBe(0)
  })

  it('인기작이 players 내림차순으로 앞에, 나머지는 큐레이션 순', () => {
    const r = rankFeatured(
      curated,
      [
        { slug: 'flow', players: 3 },
        { slug: 'unblock', players: 5 },
        { slug: 'chess', players: 2 },
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
        { slug: 'flow', players: 4 },
        { slug: 'chess', players: 4 },
      ],
      { known },
    )
    expect(r.order.slice(0, 2)).toEqual(['chess', 'flow'])
  })

  it('큐레이션 밖 게임은 아무리 인기여도 들어오지 않는다(조작 방지)', () => {
    const r = rankFeatured(
      curated,
      [
        { slug: 'snake', players: 99 },
        { slug: 'reactor', players: 50 },
        { slug: '2048', players: 3 },
      ],
      { known },
    )
    expect(r.order).toEqual(['2048', 'solitaire', 'chess', 'flow', 'unblock'])
    expect([...r.popular]).toEqual(['2048'])
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

  it('결과는 항상 큐레이션의 순열', () => {
    const many = [...known].map((slug, i) => ({ slug, players: 10 + i }))
    const r = rankFeatured(curated, many, { known })
    expect([...r.order].sort()).toEqual([...curated].sort())
  })

  it('잘못된 형식의 슬러그·중복 행도 안전', () => {
    const r = rankFeatured(
      curated,
      [
        { slug: 'BAD SLUG', players: 9 },
        { slug: 'flow', players: 3 },
        { slug: 'flow', players: 5 },
      ],
      { known },
    )
    expect(r.order).toEqual(['flow', 'solitaire', 'chess', '2048', 'unblock'])
  })

  it('minPlayers 옵션', () => {
    const r = rankFeatured(curated, [{ slug: 'flow', players: 3 }], { known, minPlayers: 4 })
    expect(r.order).toEqual(curated)
  })
})

describe('createTtlCache', () => {
  it('동시 미스는 loader 1회로 합치고, TTL 동안 재사용, 만료 후 재조회', async () => {
    let now = 1000
    let calls = 0
    const get = createTtlCache(async () => {
      calls++
      return { value: calls, ttlMs: 100 }
    }, () => now)
    const [a, b] = await Promise.all([get(), get()])
    expect([a, b, calls]).toEqual([1, 1, 1])
    now = 1099
    expect(await get()).toBe(1)
    now = 1100
    expect(await get()).toBe(2)
    expect(calls).toBe(2)
  })

  it('결과별 TTL(실패 짧게)', async () => {
    let now = 0
    let n = 0
    const get = createTtlCache(async () => ({ value: ++n, ttlMs: n === 1 ? 10 : 1000 }), () => now)
    expect(await get()).toBe(1)
    now = 10
    expect(await get()).toBe(2)
    now = 500
    expect(await get()).toBe(2)
  })
})
