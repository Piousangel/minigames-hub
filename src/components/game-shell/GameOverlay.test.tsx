import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameOverlay } from './GameOverlay'
import { GameNavProvider } from '@/components/GameNav'

const RUN_KEY = 'run:count'

function renderOverlay(seedRunCount: number) {
  if (seedRunCount > 0) sessionStorage.setItem(RUN_KEY, String(seedRunCount))
  return render(
    <GameNavProvider slug="snake">
      <GameOverlay show variant="lose" title="Game over" testId="game-over" />
    </GameNavProvider>,
  )
}

describe('GameOverlay — support-the-site nudge', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('shows the support link on a RUN milestone (3rd game in a row)', () => {
    renderOverlay(2) // provider bumps this to 3 on mount — a milestone
    expect(screen.getByTestId('overlay-support')).toBeInTheDocument()
    expect(screen.getByTestId('overlay-support')).toHaveAttribute(
      'href',
      expect.stringContaining('ko-fi.com'),
    )
  })

  it('does not show the support link on a non-milestone run (e.g. the 4th game)', () => {
    renderOverlay(3) // bumps to 4 — not a milestone
    expect(screen.queryByTestId('overlay-support')).not.toBeInTheDocument()
  })

  it('does not show the support link on the very first game of a session', () => {
    renderOverlay(0) // bumps to 1
    expect(screen.queryByTestId('overlay-support')).not.toBeInTheDocument()
  })
})

describe('GameOverlay — leaderboard discovery nudge', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('shows a leaderboard link for a game with a leaderboard (snake), even on the first game', () => {
    renderOverlay(0) // bumps to 1 — not a RUN milestone, but leaderboard link isn't gated on that
    const link = screen.getByTestId('overlay-leaderboard')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '#leaderboard')
  })

  it('does not show a leaderboard link for a game without one', () => {
    sessionStorage.setItem(RUN_KEY, '0')
    render(
      <GameNavProvider slug="no-such-leaderboard-game">
        <GameOverlay show variant="lose" title="Game over" testId="game-over" />
      </GameNavProvider>,
    )
    expect(screen.queryByTestId('overlay-leaderboard')).not.toBeInTheDocument()
  })
})

describe('GameOverlay — compact (opt-in)', () => {
  const panel = () => screen.getByText('Game over').parentElement!

  it('keeps the default spacing when compact is not passed', () => {
    render(<GameOverlay show variant="lose" title="Game over" tone="cozy" />)
    expect(panel()).toHaveClass('gap-4', 'mx-3', 'px-6', 'py-5')
    expect(screen.getByText('Game over')).toHaveClass('text-[1.7rem]')
  })

  it('tightens the panel when compact', () => {
    render(<GameOverlay show variant="lose" title="Game over" tone="cozy" compact />)
    expect(panel()).toHaveClass('gap-2', 'mx-2', 'px-4', 'py-2.5')
    expect(panel()).not.toHaveClass('gap-4')
    expect(screen.getByText('Game over')).toHaveClass('text-[1.4rem]')
  })
})

// R7f: 판이 짧아 상자가 덮개보다 크면 덮개 자리(부모) 최소 높이를 상자 + 24px로 — 들어가면 아무것도 안 바꾼다(R7e 함정 ③)
describe('GameOverlay — 짧은 판에서 상자가 판 밖으로 넘치지 않게', () => {
  function layout(panelH: number, overlayH: number) {
    const off = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!
    const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight')!
    const offParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')!
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement) {
        return this.parentElement
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('data-overlay-panel') ? panelH : 0
      },
    })
    Object.defineProperty(Element.prototype, 'clientHeight', {
      configurable: true,
      get(this: Element) {
        return this.getAttribute('role') === 'alertdialog' ? overlayH : 0
      },
    })
    return () => {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', off)
      Object.defineProperty(Element.prototype, 'clientHeight', client)
      Object.defineProperty(HTMLElement.prototype, 'offsetParent', offParent)
    }
  }
  const ui = (show: boolean) => (
    <div data-testid="seat" style={{ minHeight: '10px' }}>
      <GameOverlay show={show} variant="lose" title="Game over" testId="game-over" />
    </div>
  )

  it('상자(440) > 덮개(168): 부모 최소 높이 464px, 닫으면 원래 값으로', () => {
    const restore = layout(440, 168)
    try {
      const { rerender } = render(ui(true))
      expect(screen.getByTestId('seat').style.minHeight).toBe('464px')
      rerender(ui(false))
      expect(screen.getByTestId('seat').style.minHeight).toBe('10px')
    } finally {
      restore()
    }
  })

  it('같은 자리에 덮개 둘이 동시에 떠도 마지막이 닫힐 때 원래 값으로', () => {
    const restore = layout(440, 168)
    const two = (a: boolean, b: boolean) => (
      <div data-testid="seat" style={{ minHeight: '10px' }}>
        <GameOverlay show={a} variant="lose" title="A" />
        <GameOverlay show={b} variant="win" title="B" />
      </div>
    )
    try {
      const { rerender } = render(two(true, false))
      rerender(two(true, true))
      expect(screen.getByTestId('seat').style.minHeight).toBe('464px')
      rerender(two(false, true))
      expect(screen.getByTestId('seat').style.minHeight).toBe('464px')
      rerender(two(false, false))
      expect(screen.getByTestId('seat').style.minHeight).toBe('10px')
    } finally {
      restore()
    }
  })

  it('상자가 들어가면(252 ≤ 386) 부모를 건드리지 않는다', () => {
    const restore = layout(252, 386)
    try {
      render(ui(true))
      expect(screen.getByTestId('seat').style.minHeight).toBe('10px')
    } finally {
      restore()
    }
  })
})
