import { afterEach, describe, expect, it, vi } from 'vitest'
import { todayLocal, todayUTC } from './dailyDate'

describe('todayLocal', () => {
  afterEach(() => vi.useRealTimers())
  it('현지 시각 기준 날짜(UTC와 하루 어긋날 수 있다)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 20, 23, 30)) // 현지 11-20 23:30
    expect(todayLocal()).toBe('2026-11-20')
    vi.setSystemTime(new Date(2026, 10, 21, 0, 5)) // 현지 11-21 00:05
    expect(todayLocal()).toBe('2026-11-21')
  })
  it('월·일은 두 자리로 채운다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0))
    expect(todayLocal()).toBe('2026-01-05')
  })
  it('todayUTC는 그대로 UTC 날짜', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 20, 23, 30)))
    expect(todayUTC()).toBe('2026-11-20')
  })
})
