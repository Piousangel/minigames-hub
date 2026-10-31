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

  it('still knows yesterday was teased after a newer teaser was seen the next day', () => {
    // 다음 날 첫 방문이 게임 페이지면 그 날의 "내일" 예고가 먼저 기록된다 — 홈의 배지가 사라지면 안 된다.
    markTeaserSeen('2026-11-02')
    markTeaserSeen('2026-11-03')
    expect(wasTeasedFor('2026-11-02')).toBe(true)
    expect(wasTeasedFor('2026-11-03')).toBe(true)
  })

  it('keeps only the three most recent teased dates', () => {
    for (const date of ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']) markTeaserSeen(date)
    expect(wasTeasedFor('2026-11-01')).toBe(false)
    expect(wasTeasedFor('2026-11-04')).toBe(true)
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
