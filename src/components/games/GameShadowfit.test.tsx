import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { challengeQuery } from '@/lib/challenge'
import { generateWall, solveMoves, type Move } from '@/lib/games/shadowfit/engine'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))

import { sendHit } from '@/lib/hit'
import { GameShadowfit } from './GameShadowfit'

const STORAGE_KEY = 'best:shadowfit'
const SEED = 12345

const KEY: Record<string, string> = {
  'x1': 'ArrowDown',
  'x-1': 'ArrowUp',
  'y1': 'ArrowRight',
  'y-1': 'ArrowLeft',
  'z1': 'q',
  'z-1': 'e',
}

/** Solve wall 0 of `seed` on the keyboard and slam it right away (perfect, full early bonus). */
function solveFirstWall(seed: number): number {
  const wall = generateWall(seed, 0)
  const moves = solveMoves(wall.piece, wall.holeKey) as Move[]
  for (const m of moves) fireEvent.keyDown(window, { key: KEY[`${m.axis}${m.dir}`] })
  fireEvent.keyDown(window, { key: ' ' })
  return (100 + 5 * wall.approachTicks + 50) * 1
}

function runUntilOver() {
  for (let i = 0; i < 600; i++) {
    act(() => {
      vi.advanceTimersByTime(100)
    })
    if (screen.queryByTestId('game-over')) return
  }
}

const FAKE = ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'] as const

describe('GameShadowfit challenge links', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(sendHit).mockClear()
    vi.useFakeTimers({ toFake: [...FAKE] })
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('a ?vs= link shows the banner, replays the challenger seed and never writes best', () => {
    window.history.replaceState(null, '', `/shadowfit?${challengeQuery({ seed: SEED, score: 600, name: 'Ana' })}`)
    render(<GameShadowfit storageKey={STORAGE_KEY} />)

    const banner = screen.getByTestId('challenge-banner')
    expect(banner).toHaveTextContent('Ana scored 600 on this exact run. Beat it!')
    expect(banner).toHaveTextContent("Challenge runs don't count toward your best.")
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()

    // Same seed → same first wall as the challenger.
    const wall = generateWall(SEED, 0)
    expect(screen.getByTestId('wall')).toHaveAttribute(
      'aria-label',
      `Wall 1 — hole ${wall.hole.map((c) => `(${c[0]},${c[1]})`).join(' ')}`,
    )

    fireEvent.keyDown(window, { key: 'Enter' }) // start
    expect(screen.queryByTestId('challenge-leave')).not.toBeInTheDocument() // hidden mid-run
    const gain = solveFirstWall(SEED)
    expect(screen.getByTestId('score')).toHaveTextContent(String(gain))
    runUntilOver() // idle → three crashes

    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByTestId('challenge-result')).toHaveTextContent(`${600 - gain} short of 600`)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(screen.getByTestId('best')).toHaveTextContent('0')
    expect(sendHit).toHaveBeenCalledWith('shadowfit', 'challenge-done')
    expect(screen.getByTestId('challenge-leave')).toBeInTheDocument()

    // Rematch replays the same seed — even when freshSeed() would pick a different one.
    vi.setSystemTime(0)
    const OTHER = 777
    const otherHole = generateWall(OTHER, 0).hole.map((c) => `(${c[0]},${c[1]})`).join(' ')
    const sameHole = wall.hole.map((c) => `(${c[0]},${c[1]})`).join(' ')
    expect(otherHole).not.toBe(sameHole) // sanity: the decoy seed really gives a different board
    const rand = vi.spyOn(Math, 'random').mockReturnValue(OTHER / 2 ** 31) // freshSeed() → OTHER
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }))
    rand.mockRestore()
    expect(screen.getByTestId('challenge-banner')).toBeInTheDocument()
    expect(screen.getByTestId('wall')).toHaveAttribute('aria-label', `Wall 1 — hole ${sameHole}`)
  })

  it('beating the challenger shows the win line and "Send it back"', () => {
    window.history.replaceState(null, '', `/shadowfit?${challengeQuery({ seed: SEED, score: 10, name: 'Bo' })}`)
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    const gain = solveFirstWall(SEED)
    runUntilOver()
    expect(screen.getByTestId('challenge-result')).toHaveTextContent(`+${gain - 10} over Bo's 10`)
    expect(screen.getByRole('button', { name: 'Send it back to Bo' })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('Play solo clears the challenge params and drops the banner', () => {
    window.history.replaceState(null, '', `/shadowfit?${challengeQuery({ seed: 9, score: 40, name: 'Bo' })}&x=1`)
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    fireEvent.click(screen.getByTestId('challenge-leave'))
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?x=1')
  })

  it('a solo run records best and does not send challenge-done', () => {
    vi.setSystemTime(0)
    const rand = vi.spyOn(Math, 'random').mockReturnValue(SEED / 2 ** 31) // freshSeed() → SEED
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    expect(screen.queryByTestId('challenge-banner')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Enter' })
    const gain = solveFirstWall(SEED)
    runUntilOver()
    rand.mockRestore()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBe(gain)
    expect(sendHit).not.toHaveBeenCalledWith('shadowfit', 'challenge-done')
  })

  it('shares only after success: challenge-sent fires on a copied link, not on a cancelled share sheet', async () => {
    vi.setSystemTime(0)
    const rand = vi.spyOn(Math, 'random').mockReturnValue(SEED / 2 ** 31)
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    solveFirstWall(SEED)
    runUntilOver()
    rand.mockRestore()

    const share = vi.fn().mockRejectedValue(new Error('AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }))
    })
    expect(share).toHaveBeenCalled()
    expect(sendHit).not.toHaveBeenCalledWith('shadowfit', 'challenge-sent')

    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }))
    })
    expect(writeText.mock.calls[0][0]).toContain('/shadowfit?vs=')
    expect(sendHit).toHaveBeenCalledWith('shadowfit', 'challenge-sent')
  })
})

describe('GameShadowfit keyboard & pause', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: [...FAKE] })
    vi.setSystemTime(0)
    vi.spyOn(Math, 'random').mockReturnValue(SEED / 2 ** 31)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    window.history.replaceState(null, '', '/')
  })

  it('ignores ctrl/meta/alt shortcuts entirely', () => {
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    const before = screen.getByTestId('piece').innerHTML
    expect(fireEvent.keyDown(window, { key: 'r', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'r', ctrlKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'd', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 's', ctrlKey: true })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'q', altKey: true })).toBe(true)
    expect(screen.getByTestId('piece').innerHTML).toBe(before)
    // a plain key still rotates
    expect(fireEvent.keyDown(window, { key: 'd' })).toBe(false)
    expect(screen.getByTestId('piece').innerHTML).not.toBe(before)
  })

  it('on the game-over screen Enter/Space on overlay buttons activate the button, not the game', () => {
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    solveFirstWall(SEED)
    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()

    const share = screen.getByRole('button', { name: 'Challenge a friend' })
    share.focus()
    expect(fireEvent.keyDown(share, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(share, { key: ' ' })).toBe(true)
    const input = screen.getByRole('textbox', { name: 'Your name for the challenge link' })
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(input, { key: 'r' })).toBe(true)
    expect(screen.getByTestId('game-over')).toBeInTheDocument()

    expect(fireEvent.keyDown(document.body, { key: 'Enter' })).toBe(false)
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
  })

  it('pause freezes the wall and hides the board; a rotate key only resumes', () => {
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const bar = screen.getByTestId('approach-bar').style.transform
    fireEvent.keyDown(window, { key: 'p' })
    expect(screen.getByText('Paused')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByTestId('approach-bar').style.transform).toBe(bar)
    const piece = screen.getByTestId('piece').innerHTML
    fireEvent.keyDown(window, { key: 'ArrowDown' }) // resumes without rotating
    expect(screen.queryByText('Paused')).not.toBeInTheDocument()
    expect(screen.getByTestId('piece').innerHTML).toBe(piece)
  })

  it('Space/Enter on the ready card start the run right after a mouse click on New Game', () => {
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    for (const key of [' ', 'Enter']) {
      const ng = screen.getByRole('button', { name: 'New Game' })
      // A browser click: mousedown (moves focus unless prevented) then click.
      if (fireEvent.mouseDown(ng)) ng.focus()
      fireEvent.click(ng, { detail: 1 })
      expect(screen.getByTestId('shadowfit-start')).toBeInTheDocument() // ready card
      expect(fireEvent.keyDown(document.activeElement ?? document.body, { key })).toBe(false)
      expect(screen.queryByTestId('shadowfit-start')).not.toBeInTheDocument() // run started
    }
  })

  it('R mid-run (or paused) does nothing; on the ready card and game-over it restarts', () => {
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const bar = screen.getByTestId('approach-bar').style.transform
    expect(fireEvent.keyDown(window, { key: 'r' })).toBe(true)
    expect(screen.queryByTestId('shadowfit-start')).not.toBeInTheDocument()
    expect(screen.getByTestId('approach-bar').style.transform).toBe(bar)
    fireEvent.keyDown(window, { key: 'p' })
    expect(fireEvent.keyDown(window, { key: 'r' })).toBe(true)
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.queryByTestId('shadowfit-start')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'p' })

    runUntilOver()
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(fireEvent.keyDown(window, { key: 'r' })).toBe(false)
    expect(screen.queryByTestId('game-over')).not.toBeInTheDocument()
    expect(screen.getByTestId('shadowfit-start')).toBeInTheDocument()
    expect(fireEvent.keyDown(window, { key: 'r' })).toBe(false) // ready: rerolls, still ready
    expect(screen.getByTestId('shadowfit-start')).toBeInTheDocument()
  })

  it('auto-pauses when the tab is hidden', () => {
    render(<GameShadowfit storageKey={STORAGE_KEY} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    vis.mockRestore()
    expect(screen.getByText('Paused')).toBeInTheDocument()
  })
})
