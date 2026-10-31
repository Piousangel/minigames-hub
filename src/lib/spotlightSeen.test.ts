// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markTeaserSeen, wasTeasedFor } from './spotlightSeen'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('spotlightSeen', () => {
  it('remembers which spotlight date was teased', () => {
    markTeaserSeen('2026-11-01')
    expect(wasTeasedFor('2026-11-01')).toBe(true)
    expect(wasTeasedFor('2026-11-02')).toBe(false)
  })

  it('is false when nothing was ever stored', () => {
    expect(wasTeasedFor('2026-11-01')).toBe(false)
  })

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => markTeaserSeen('2026-11-01')).not.toThrow()
    expect(wasTeasedFor('2026-11-01')).toBe(false)
  })

  it('treats a corrupted stored value as not seen', () => {
    localStorage.setItem('spotlight:seen', '{"oops":')
    expect(wasTeasedFor('2026-11-01')).toBe(false)
  })
})
