import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ContinueRow, type ContinueItem } from './ContinueRow'
import { __resetPopularFetchForTest } from '@/lib/home/usePopular'
import { RECENT_KEY } from '@/components/RecordPlay'
import { spotlightFor } from '@/lib/spotlight'

vi.mock('@/lib/spotlight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/spotlight')>()
  return { ...actual, spotlightFor: vi.fn(() => null) }
})

const mk = (slug: string): ContinueItem => ({ slug, title: `T-${slug}`, description: '', category: 'Puzzle' })
const curated = ['solitaire', 'chess', '2048', 'flow', 'unblock'].map(mk)
const items = [...curated, mk('snake'), mk('tetris'), mk('sudoku')]

const titles = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
const ok = (games: unknown) => ({ ok: true, json: async () => ({ games }) })

beforeEach(() => {
  vi.mocked(spotlightFor).mockReturnValue(null)
  __resetPopularFetchForTest()
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * 예전 FeaturedRail.test(인기 재정렬·세션 캐시·요청 공유)를 Continue 줄의 '인기 4'로 옮기고,
 * 최근 플레이(단골) 분기를 더했다. 늘 4칸(CLS 0)인지도 본다.
 */
describe('ContinueRow — 첫 방문(인기 4)', () => {
  it('API 실패 시 큐레이션 앞 4개 그대로', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)
    render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/popular'))
    expect(titles()).toEqual(['T-solitaire', 'T-chess', 'T-2048', 'T-flow'])
    expect(screen.getByTestId('continue-row')).toHaveAttribute('data-state', 'first')
  })

  it('큐레이션 안에서만 재정렬(밖의 인기작은 무시)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok([
          { slug: 'snake', players: 40 },
          { slug: 'unblock', players: 9 },
          { slug: '2048', players: 5 },
        ]),
      ),
    )
    render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(titles()).toEqual(['T-unblock', 'T-2048', 'T-solitaire', 'T-chess']))
  })

  it('빈 결과는 캐시하지 않아 다음 마운트에서 다시 요청, 성공 결과는 세션 캐시', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([{ slug: 'chess', players: 9 }]))
    vi.stubGlobal('fetch', fetchMock)
    render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    cleanup()
    __resetPopularFetchForTest()
    render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(titles()[0]).toBe('T-chess'))
    cleanup()
    __resetPopularFetchForTest()
    render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(titles()[0]).toBe('T-chess'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('동시 마운트는 요청 1회로 공유', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ slug: 'chess', players: 9 }]))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <>
        <ContinueRow curated={curated} items={items} />
        <ContinueRow curated={curated} items={items} />
      </>,
    )
    await waitFor(() => expect(titles().filter((t) => t === 'T-chess')).toHaveLength(2))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('ContinueRow — 단골(최근 플레이)', () => {
  it('최근 플레이 4개 이상이면 그 순서로 4칸, 인기 요청 없음, ?ref=home-continue', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem(RECENT_KEY, JSON.stringify(['sudoku', 'snake', 'gone-game', 'tetris', 'chess', 'flow']))
    const { container } = render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(screen.getByTestId('continue-row')).toHaveAttribute('data-state', 'returning'))
    expect(titles()).toEqual(['T-sudoku', 'T-snake', 'T-tetris', 'T-chess']) // 없는 slug는 건너뜀
    expect(container.querySelector('a[href="/sudoku?ref=home-continue"]')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Pick up where you left off')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('최근 플레이가 4개 미만이면 인기로 채워 늘 4칸(중복 없음)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    localStorage.setItem(RECENT_KEY, JSON.stringify(['chess']))
    render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(screen.getByTestId('continue-row')).toHaveAttribute('data-state', 'returning'))
    expect(titles()).toEqual(['T-chess', 'T-solitaire', 'T-2048', 'T-flow'])
    expect(screen.getAllByTestId('continue-tile')).toHaveLength(4)
  })

  it('저장값이 깨져 있으면 첫 방문 모양', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    localStorage.setItem(RECENT_KEY, '{not json')
    render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(titles()).toEqual(['T-solitaire', 'T-chess', 'T-2048', 'T-flow']))
    expect(screen.getByTestId('continue-row')).toHaveAttribute('data-state', 'first')
  })
})

describe('ContinueRow — 즐겨찾기·스포트라이트', () => {
  it('최근 플레이 뒤를 즐겨찾기(최근에 담은 순)로 채우고, 그다음 인기', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    localStorage.setItem(RECENT_KEY, JSON.stringify(['snake']))
    localStorage.setItem('favorites', JSON.stringify(['sudoku', 'snake']))
    const { container } = render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(titles()).toEqual(['T-snake', 'T-sudoku', 'T-solitaire', 'T-chess']))
    expect(container.querySelector('a[href="/sudoku?ref=home-saved"]')).not.toBeNull()
    expect(container.querySelector('a[href="/solitaire?ref=home-popular"]')).not.toBeNull()
  })

  it('즐겨찾기만 있어도 단골 모양(Saved games)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    localStorage.setItem('favorites', JSON.stringify(['tetris']))
    render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(screen.getByTestId('continue-row')).toHaveAttribute('data-state', 'returning'))
    expect(screen.getByText('Saved games')).toBeInTheDocument()
    expect(titles()[0]).toBe('T-tetris')
  })

  it('인기로 채우는 칸에서 오늘의 스포트라이트 게임은 뺀다(아래 스포트라이트 줄과 중복 방지)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    vi.mocked(spotlightFor).mockReturnValue('chess')
    render(<ContinueRow curated={curated} items={items} />)
    await waitFor(() => expect(titles()).toEqual(['T-solitaire', 'T-2048', 'T-flow', 'T-unblock']))
  })
})
