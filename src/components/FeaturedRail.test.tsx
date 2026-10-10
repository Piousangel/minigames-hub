import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { FeaturedRail } from './FeaturedRail'

const items = ['solitaire', 'chess', '2048', 'snake'].map((slug) => ({
  slug,
  title: `T-${slug}`,
  description: 'd',
  category: 'Puzzle' as const,
  daily: false,
}))
const curated = ['solitaire', 'chess', '2048']

const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
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

  it('인기 데이터로 같은 개수의 카드를 재정렬하고 뱃지 표시', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          games: [
            { slug: 'snake', players: 4 },
            { slug: 'chess', players: 2 },
            { slug: '2048', players: 1 },
          ],
        }),
      }),
    )
    render(<FeaturedRail curated={curated} items={items} />)
    await waitFor(() => expect(titles()).toEqual(['T-snake', 'T-chess', 'T-solitaire']))
    expect(screen.getAllByTestId('popular-badge')).toHaveLength(2)
  })
})
