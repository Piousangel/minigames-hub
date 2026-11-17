import { describe, it, expect } from 'vitest'
import { isNew, latestSlug, NEW_WINDOW_DAYS } from './newGames'

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
