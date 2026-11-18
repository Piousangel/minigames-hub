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
