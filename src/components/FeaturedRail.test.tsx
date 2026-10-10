import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { FeaturedRail, __resetPopularFetchForTest } from './FeaturedRail'

const items = ['solitaire', 'chess', '2048', 'snake'].map((slug) => ({
  slug,
  title: `T-${slug}`,
  description: 'd',
  category: 'Puzzle' as const,
  daily: false,
}))
const curated = ['solitaire', 'chess', '2048']

const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

const ok = (games: unknown) => ({ ok: true, json: async () => ({ games }) })

beforeEach(() => {
  __resetPopularFetchForTest()
  sessionStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('FeaturedRail', () => {
  it('API 실패 시 큐레이션 순서 유지, 뱃지 없음', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)
    render(<FeaturedRail curated={curated} items={items} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/popular'))
    expect(titles()).toEqual(['T-solitaire', 'T-chess', 'T-2048'])
    expect(screen.queryByTestId('popular-badge')).toBeNull()
  })

  it('큐레이션 게임만 재정렬(밖의 인기작은 무시)하고 뱃지 표시', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok([
          { slug: 'snake', players: 40 },
          { slug: '2048', players: 5 },
          { slug: 'chess', players: 3 },
          { slug: 'solitaire', players: 2 },
        ]),
      ),
    )
    render(<FeaturedRail curated={curated} items={items} />)
    await waitFor(() => expect(titles()).toEqual(['T-2048', 'T-chess', 'T-solitaire']))
    expect(screen.getAllByTestId('popular-badge')).toHaveLength(2)
  })

  it('빈/실패 결과는 세션에 캐시하지 않아 다음 마운트에서 다시 요청', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([{ slug: 'chess', players: 9 }]))
    vi.stubGlobal('fetch', fetchMock)
    render(<FeaturedRail curated={curated} items={items} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    cleanup()
    __resetPopularFetchForTest()
    render(<FeaturedRail curated={curated} items={items} />)
    await waitFor(() => expect(titles()[0]).toBe('T-chess'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('성공 결과는 세션 캐시로 재요청 없음', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ slug: 'chess', players: 9 }]))
    vi.stubGlobal('fetch', fetchMock)
    render(<FeaturedRail curated={curated} items={items} />)
    await waitFor(() => expect(titles()[0]).toBe('T-chess'))
    cleanup()
    __resetPopularFetchForTest()
    render(<FeaturedRail curated={curated} items={items} />)
    await waitFor(() => expect(titles()[0]).toBe('T-chess'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('동시 마운트(Strict Mode 이중 effect 등)는 요청 1회로 공유', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ slug: 'chess', players: 9 }]))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <>
        <FeaturedRail curated={curated} items={items} />
        <FeaturedRail curated={curated} items={items} />
      </>,
    )
    await waitFor(() => expect(titles().filter((t) => t === 'T-chess')).toHaveLength(2))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
