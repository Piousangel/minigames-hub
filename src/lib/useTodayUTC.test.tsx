import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTodayUTC } from './useTodayUTC'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-31T23:59:58Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTodayUTC', () => {
  it('returns the current UTC date after mount', () => {
    const { result } = renderHook(() => useTodayUTC())
    expect(result.current).toBe('2026-10-31')
  })

  it('rolls over at the next UTC midnight', () => {
    const { result } = renderHook(() => useTodayUTC())
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBe('2026-11-01')
  })

  it('keeps re-arming itself for later midnights', () => {
    const { result } = renderHook(() => useTodayUTC())
    act(() => {
      vi.advanceTimersByTime(3000 + 24 * 60 * 60 * 1000)
    })
    expect(result.current).toBe('2026-11-02')
  })

  it('stops its timer when unmounted', () => {
    const { unmount } = renderHook(() => useTodayUTC())
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
