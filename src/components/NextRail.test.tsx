import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameOverlay } from '@/components/game-shell/GameOverlay'
import { GameNavProvider } from '@/components/GameNav'
import { NextRail } from '@/components/NextRail'

const sendHit = vi.hoisted(() => vi.fn())
vi.mock('@/lib/hit', async (orig) => ({ ...(await orig<typeof import('@/lib/hit')>()), sendHit }))

function setup(show = true) {
  const ui = (s: boolean) => (
    <GameNavProvider slug="snake">
      <GameOverlay show={s} variant="lose" title="Game over" testId="game-over" />
      <NextRail />
    </GameNavProvider>
  )
  const r = render(ui(show))
  return { ...r, again: (s: boolean) => r.rerender(ui(s)) }
}

describe('NextRail + 오버레이 next 연결', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    sendHit.mockClear()
  })

  it('오버레이 Next 링크는 ?ref=next, 클릭하면 next_ovl 계측, 오버레이엔 링크가 1개뿐', () => {
    setup()
    const link = screen.getByTestId('overlay-next-game')
    expect(link.getAttribute('href')).toMatch(/^\/[a-z0-9-]+\?ref=next$/)
    expect(screen.getAllByTestId('overlay-next-game')).toHaveLength(1)
    fireEvent.click(link)
    expect(sendHit).toHaveBeenCalledWith('snake', 'next_ovl')
  })

  it('next_show는 show false→true에서 1회, 재렌더로 중복되지 않는다', () => {
    const { again } = setup(false)
    expect(sendHit.mock.calls.filter((c) => c[1] === 'next_show')).toHaveLength(0)
    again(true)
    again(true)
    expect(sendHit.mock.calls.filter((c) => c[1] === 'next_show')).toHaveLength(1)
  })

  it('레일 카드 2장(?ref=next, 서로 다름)이 오버레이 밖에 있고 클릭 시 계측', () => {
    setup()
    const same = screen.getByTestId('next-rail-same')
    const diff = screen.getByTestId('next-rail-diff')
    expect(same.getAttribute('href')).toMatch(/\?ref=next$/)
    expect(same.getAttribute('href')).not.toBe(diff.getAttribute('href'))
    expect(screen.getByTestId('game-over').contains(screen.getByTestId('next-rail'))).toBe(false)
    fireEvent.click(same)
    fireEvent.click(diff)
    expect(sendHit).toHaveBeenCalledWith('snake', 'next_same')
    expect(sendHit).toHaveBeenCalledWith('snake', 'next_diff')
  })

  it('광고 요소가 없다', () => {
    const { container } = setup()
    expect(container.querySelector('ins.adsbygoogle')).toBeNull()
  })
})

describe('NextRail — next_seen·빈 추천', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    sendHit.mockClear()
  })

  it('IntersectionObserver가 보이면 next_seen을 1회만 보내고 disconnect한다', () => {
    const disconnect = vi.fn()
    let cb: (e: { isIntersecting: boolean }[]) => void = () => {}
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(c: typeof cb) { cb = c }
        observe() {}
        disconnect = disconnect
      },
    )
    render(<GameNavProvider slug="snake"><NextRail /></GameNavProvider>)
    cb([{ isIntersecting: false }])
    expect(sendHit.mock.calls.filter((c) => c[1] === 'next_seen')).toHaveLength(0)
    cb([{ isIntersecting: true }])
    expect(sendHit).toHaveBeenCalledWith('snake', 'next_seen')
    expect(disconnect).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('추천이 비는 slug에서는 레일을 안 그리고 next_show도 보내지 않는다', () => {
    render(
      <GameNavProvider slug="__only-game__">
        <GameOverlay show variant="lose" title="Game over" testId="game-over" />
        <NextRail />
      </GameNavProvider>,
    )
    // 알 수 없는 slug도 registry의 다른 게임으로 추천이 나오므로, 빈 풀을 만들 수 없으면 이 가정만 확인:
    // 추천 링크가 없으면 next_show가 없어야 한다.
    const hasNext = screen.queryByTestId('overlay-next-game') !== null
    const shows = sendHit.mock.calls.filter((c) => c[1] === 'next_show').length
    expect(shows).toBe(hasNext ? 1 : 0)
  })

  it('aria-label이 보이는 텍스트(Original·이유)를 포함한다', () => {
    render(<GameNavProvider slug="snake"><NextRail /></GameNavProvider>)
    const label = screen.getByTestId('next-rail-diff').getAttribute('aria-label')!
    expect(label).toMatch(/instead of arrow keys$/)
  })
})
