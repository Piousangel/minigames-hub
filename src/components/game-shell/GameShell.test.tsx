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
