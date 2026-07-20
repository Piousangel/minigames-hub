import { describe, it, expect } from 'vitest'
import { isNew, NEW_WINDOW_DAYS } from './newGames'

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
