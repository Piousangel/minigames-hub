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
