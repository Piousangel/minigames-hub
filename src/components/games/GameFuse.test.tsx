import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameFuse } from './GameFuse'
import { TICK_MS } from '@/lib/games/fuse/engine'

// rAF is driven by hand so the 90 ms tick loop runs deterministically.
let rafQueue: FrameRequestCallback[] = []
let now = 0
function stepFrames(n: number) {
  for (let i = 0; i < n; i++) {
    now += TICK_MS
    const q = rafQueue
    rafQueue = []
    act(() => {
      for (const cb of q) cb(now)
    })
  }
}

describe('GameFuse focus handling', () => {
  beforeEach(() => {
    localStorage.clear()
    rafQueue = []
    now = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not steal focus back from New Game while the run ticks', async () => {
    render(<GameFuse storageKey="best:fuse" />)
    const cells = await screen.findAllByTestId('fuse-cell')
    fireEvent.click(cells[0]) // starts the run
    stepFrames(2)

    const newGame = screen.getByRole('button', { name: /new game/i })
    newGame.focus()
    expect(document.activeElement).toBe(newGame)

    stepFrames(10) // ~1 s of ticks -> many state changes
    expect(document.activeElement).toBe(newGame)
  })

  it('does not grab focus on mount', async () => {
    render(<GameFuse storageKey="best:fuse" />)
    await screen.findAllByTestId('fuse-cell')
    expect(document.activeElement).toBe(document.body)
  })

  it('arrow keys still move DOM focus between cells', async () => {
    render(<GameFuse storageKey="best:fuse" />)
    const cells = await screen.findAllByTestId('fuse-cell')
    cells[12].focus()
    fireEvent.keyDown(cells[12], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cells[13])
    fireEvent.keyDown(cells[13], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cells[18])
  })
})
