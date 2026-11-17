import { describe, it, expect } from 'vitest'
import { isNew, latestSlug, latestSlugs, NEW_WINDOW_DAYS } from './newGames'

const now = Date.parse('2026-07-20T12:00:00Z')

describe('isNew', () => {
  it('오늘 추가는 NEW', () => {
    expect(isNew('2026-07-20', now)).toBe(true)
  })
  it('창(window) 경계 직전은 NEW', () => {
    expect(isNew('2026-07-02', now)).toBe(true) // 18일 전
  })
  it('창을 벗어나면 NEW 아님', () => {
    const old = new Date(now - (NEW_WINDOW_DAYS + 2) * 86_400_000).toISOString().slice(0, 10)
    expect(isNew(old, now)).toBe(false)
  })
  it('addedDate 없으면/손상되면 false', () => {
    expect(isNew(undefined, now)).toBe(false)
    expect(isNew('nope', now)).toBe(false)
  })
})

describe('latestSlug', () => {
  it('addedDate가 가장 늦은 게임을 고른다', () => {
    expect(latestSlug({ a: { addedDate: '2026-10-01' }, b: { addedDate: '2026-11-17' }, c: { addedDate: '2026-11-02' } })).toBe('b')
  })
  it('동률이면 나중에 선언된 게임, addedDate 없는 게임은 무시', () => {
    expect(latestSlug({ a: { addedDate: '2026-11-17' }, b: {}, c: { addedDate: '2026-11-17' } })).toBe('c')
  })
  it('addedDate가 하나도 없으면 null', () => {
    expect(latestSlug({ a: {}, b: {} })).toBeNull()
  })
  it('실제 gameMeta에서 항상 하나를 돌려준다', () => {
    expect(latestSlug()).toBeTruthy()
  })
})

describe('latestSlugs', () => {
  const meta = { a: { addedDate: '2026-10-01' }, b: { addedDate: '2026-11-17' }, c: { addedDate: '2026-11-02' }, d: { addedDate: '2026-11-17' }, e: {} }
  it('날짜 내림차순, 동률은 나중에 선언된 쪽이 앞, 날짜 없는 게임은 제외한다', () => {
    expect(latestSlugs(3, meta)).toEqual(['d', 'b', 'c'])
  })
  it('n이 더 크면 가진 만큼만, 0이면 빈 배열', () => {
    expect(latestSlugs(10, meta)).toEqual(['d', 'b', 'c', 'a'])
    expect(latestSlugs(0, meta)).toEqual([])
  })
  it('첫 항목은 latestSlug와 같다', () => {
    expect(latestSlugs(1, meta)[0]).toBe(latestSlug(meta))
  })
  it('실제 gameMeta에서 최대 3개, 중복 없이', () => {
    const l = latestSlugs(3)
    expect(l.length).toBeGreaterThan(0)
    expect(l.length).toBeLessThanOrEqual(3)
    expect(new Set(l).size).toBe(l.length)
  })
})
