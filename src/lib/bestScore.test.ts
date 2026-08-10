import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateBestScore } from './bestScore'

describe('updateBestScore', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    })
  })

  it('returns true, updates the ref, persists, and calls setBest on a new high score', () => {
    const bestRef = { current: 10 }
    const setBest = vi.fn()
    const result = updateBestScore(25, bestRef, 'best:x', setBest)

    expect(result).toBe(true)
    expect(bestRef.current).toBe(25)
    expect(localStorage.getItem('best:x')).toBe('25')
    expect(setBest).toHaveBeenCalledWith(25)
  })

  it('returns false and leaves the ref/storage untouched when the score does not beat the best', () => {
    const bestRef = { current: 25 }
    const setBest = vi.fn()
    const result = updateBestScore(10, bestRef, 'best:x', setBest)

    expect(result).toBe(false)
    expect(bestRef.current).toBe(25)
    expect(localStorage.getItem('best:x')).toBeNull()
    expect(setBest).not.toHaveBeenCalled()
  })

  it('returns false on an equal score (strictly greater is required, not >=)', () => {
    const bestRef = { current: 25 }
    const setBest = vi.fn()
    const result = updateBestScore(25, bestRef, 'best:x', setBest)

    expect(result).toBe(false)
    expect(setBest).not.toHaveBeenCalled()
  })

  it('returns false for a zero or negative score even against a zero best', () => {
    const bestRef = { current: 0 }
    const setBest = vi.fn()

    expect(updateBestScore(0, bestRef, 'best:x', setBest)).toBe(false)
    expect(updateBestScore(-5, bestRef, 'best:x', setBest)).toBe(false)
    expect(setBest).not.toHaveBeenCalled()
  })

  it('treats bestRef.current === 0 as "no best yet" — any positive score wins', () => {
    const bestRef = { current: 0 }
    const setBest = vi.fn()
    const result = updateBestScore(1, bestRef, 'best:x', setBest)

    expect(result).toBe(true)
    expect(bestRef.current).toBe(1)
  })

  it('does not throw when localStorage.setItem fails (quota exceeded, storage disabled) — callers run this inside a requestAnimationFrame loop, where an uncaught throw would kill the loop', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceededError')
      },
    })
    const bestRef = { current: 0 }
    const setBest = vi.fn()

    expect(() => updateBestScore(50, bestRef, 'best:x', setBest)).not.toThrow()
    // The in-memory best still counts for this session even though persistence failed.
    expect(bestRef.current).toBe(50)
    expect(setBest).toHaveBeenCalledWith(50)
  })
})
