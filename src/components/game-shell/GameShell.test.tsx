import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameShell } from './GameShell'

function renderShell(onNewGame = vi.fn(), onToggleMute = vi.fn()) {
  render(
    <GameShell
      stats={[{ label: 'Score', value: 0 }]}
      headerExtra={<button type="button">Extra</button>}
      onNewGame={onNewGame}
      muted={false}
      onToggleMute={onToggleMute}
    >
      <div data-testid="board" />
    </GameShell>,
  )
  return { onNewGame, onToggleMute }
}

// Games listen for Space/Enter on window. If a mouse/touch click leaves focus on a header
// button, the next Space/Enter re-activates that button instead of reaching the game.
describe('GameShell header controls — pointer clicks do not keep focus', () => {
  it('a mouse click on New Game / Mute / header extras runs the handler but leaves focus off the button', async () => {
    const user = userEvent.setup()
    const { onNewGame, onToggleMute } = renderShell()
    for (const name of ['New Game', 'Mute sound', 'Extra']) {
      const btn = screen.getByRole('button', { name })
      await user.click(btn)
      expect(document.activeElement).not.toBe(btn)
    }
    expect(onNewGame).toHaveBeenCalledTimes(1)
    expect(onToggleMute).toHaveBeenCalledTimes(1)

    // A later Space goes to the page, not to New Game again.
    await user.keyboard(' ')
    expect(onNewGame).toHaveBeenCalledTimes(1)
  })

  it('mousedown on a header button is default-prevented (no focus steal); elsewhere it is not', () => {
    renderShell()
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'New Game' }))).toBe(false)
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Mute sound' }))).toBe(false)
    expect(fireEvent.mouseDown(screen.getByTestId('board'))).toBe(true)
  })

  it('blurs a button that still got focus from a pointer click (e.g. touch), but not a keyboard activation', () => {
    const { onNewGame } = renderShell()
    const btn = screen.getByRole('button', { name: 'New Game' })
    btn.focus()
    fireEvent.click(btn, { detail: 0 }) // Enter/Space on a focused button
    expect(document.activeElement).toBe(btn)
    fireEvent.click(btn, { detail: 1 }) // pointer click
    expect(document.activeElement).not.toBe(btn)
    expect(onNewGame).toHaveBeenCalledTimes(2)
  })

  it('stays keyboard accessible: Tab focuses the buttons and Enter/Space activate them', async () => {
    const user = userEvent.setup()
    const { onNewGame, onToggleMute } = renderShell()
    await user.tab() // Extra
    await user.tab() // Mute
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mute sound' }))
    await user.keyboard('{Enter}')
    expect(onToggleMute).toHaveBeenCalledTimes(1)
    await user.tab() // New Game
    const ng = screen.getByRole('button', { name: 'New Game' })
    expect(document.activeElement).toBe(ng)
    await user.keyboard(' ')
    await user.keyboard('{Enter}')
    expect(onNewGame).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(ng)
  })
})

// compactHeader(opt-in, 2048): 점수 자릿수가 늘어도 헤더가 줄바꿈되지 않게 — 기본값은 기존 레이아웃 그대로.
describe('GameShell compactHeader', () => {
  function renderWith(compactHeader?: boolean) {
    return render(
      <GameShell
        stats={[
          { label: 'Score', value: 12345, testId: 'score' },
          { label: 'Best', value: 23456 },
        ]}
        onNewGame={vi.fn()}
        muted={false}
        onToggleMute={vi.fn()}
        compactHeader={compactHeader}
      >
        <div />
      </GameShell>,
    )
  }

  it('off by default: stats row wraps as before', () => {
    renderWith()
    const stats = screen.getByTestId('game-shell-stats')
    expect(stats).toHaveClass('flex-wrap')
    expect(stats).not.toHaveClass('flex-nowrap')
  })

  it('on: header and stats never wrap, values use tabular-nums, New Game stays on one line', () => {
    renderWith(true)
    expect(screen.getByTestId('game-shell-header')).toHaveClass('flex-nowrap', 'min-h-11')
    const stats = screen.getByTestId('game-shell-stats')
    expect(stats).toHaveClass('flex-nowrap', 'min-w-0')
    expect(stats).not.toHaveClass('flex-wrap')
    expect(screen.getByTestId('score')).toHaveClass('tabular-nums')
    expect(screen.getByTestId('score').parentElement).toHaveClass('whitespace-nowrap')
    expect(screen.getByRole('button', { name: 'New Game' })).toHaveClass('whitespace-nowrap')
    // 접근성 이름("Score 12345")은 그대로
    expect(screen.getByTestId('score').parentElement).toHaveTextContent('Score 12345')
  })
})
