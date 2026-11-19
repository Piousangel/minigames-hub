import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { GameBrowser, type BrowseItem } from './GameBrowser'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const items: BrowseItem[] = [
  { slug: '2048', title: '2048', description: 'Merge tiles', category: 'Puzzle' },
  { slug: 'snake', title: 'Snake', description: 'Eat apples', category: 'Arcade' },
]

/**
 * 헤더 검색·All games 버튼은 다른 페이지에서 홈 앵커(/#search, /#all-games)로 보낸다(R2).
 * 도착 후 맞춤 스크롤·포커스는 GameBrowser 몫 — 여기서 깨지면 헤더 검색이 '홈 맨 위'로만 간다.
 */
describe('GameBrowser 해시 도착', () => {
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  function setup(hash: string) {
    vi.useFakeTimers()
    window.history.replaceState(null, '', `/${hash}`)
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(<GameBrowser items={items} />)
    return scroll
  }

  it('#search: 입력에 포커스하고, 늦게 커지는 위쪽 콘텐츠를 따라 몇 번 다시 맞춘다', () => {
    const scroll = setup('#search')
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search games' }))
    act(() => vi.advanceTimersByTime(2000))
    expect(scroll.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(scroll).toHaveBeenLastCalledWith({ block: 'center' })
  })

  it('#all-games: 목록 머리로 맞추고, 사용자가 스크롤하면 그만둔다', () => {
    const scroll = setup('#all-games')
    act(() => vi.advanceTimersByTime(10))
    expect(scroll).toHaveBeenLastCalledWith({ block: 'start' })
    const n = scroll.mock.calls.length
    window.dispatchEvent(new Event('wheel'))
    act(() => vi.advanceTimersByTime(2000))
    expect(scroll.mock.calls.length).toBe(n)
  })

  it('해시가 없으면 아무것도 하지 않는다', () => {
    const scroll = setup('')
    act(() => vi.advanceTimersByTime(2000))
    expect(scroll).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(document.body)
  })
})

/** R4 씨앗 도서관: 접혀도 링크는 전부 HTML에, 'My games' 필터가 예전 My Games 레일(즐겨찾기)을 대신한다. */
describe('GameBrowser 씨앗 도서관(R4)', () => {
  const many: BrowseItem[] = Array.from({ length: 30 }, (_, i) => ({
    slug: `g${i}`,
    title: `Game ${i}`,
    description: `d${i}`,
    category: (['Puzzle', 'Arcade', 'Classic', 'Skill'] as const)[i % 4],
    daily: i % 5 === 0,
  }))

  afterEach(() => localStorage.clear())

  it('접힌 상태: 30개 링크가 모두 있고 그리드는 data-collapsed, Show all 30으로 편다', () => {
    const { container } = render(<GameBrowser items={many} />)
    expect(container.querySelectorAll('[data-testid="library-grid"] a[href^="/g"]')).toHaveLength(30)
    const grid = screen.getByTestId('library-grid')
    expect(grid).toHaveAttribute('data-collapsed', 'true')
    expect(grid.querySelectorAll('li.hidden')).toHaveLength(6) // 24개 뒤만 접힘
    const toggle = screen.getByTestId('library-toggle')
    expect(toggle).toHaveTextContent('Show all 30')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    act(() => toggle.click())
    expect(grid).not.toHaveAttribute('data-collapsed')
    expect(grid.querySelectorAll('li.hidden')).toHaveLength(0)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it("'My games' 필터: 비었으면 안내 문구, 하트로 담으면 바로 결과에 나온다(최근에 담은 순)", () => {
    render(<GameBrowser items={many} />)
    act(() => screen.getByRole('button', { name: /My games/ }).click())
    expect(screen.getByText(/No saved games yet/)).toBeInTheDocument()
    act(() => screen.getByRole('button', { name: 'All' }).click())
    act(() => screen.getByRole('button', { name: 'Add Game 3 to My Games' }).click())
    act(() => screen.getByRole('button', { name: 'Add Game 12 to My Games' }).click())
    act(() => screen.getByRole('button', { name: /My games/ }).click())
    const titles = Array.from(screen.getByTestId('browse-results').querySelectorAll('h3')).map((h) => h.textContent)
    expect(titles).toEqual(['Game 12', 'Game 3'])
  })

  it('필터 칩·하트는 44px(h-11, bugs Q2)', () => {
    render(<GameBrowser items={many} />)
    expect(screen.getByRole('button', { name: 'Daily' }).className).toMatch(/\bh-11\b/)
    expect(screen.getAllByRole('button', { name: /to My Games$/ })[0].className).toMatch(/\bh-11\b/)
  })
})
