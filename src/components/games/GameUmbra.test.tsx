import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { TRACK } from '@/lib/games/umbra/engine'
import { EXIT_MARKER_REM, trackCss } from '@/lib/games/umbra/layout'
import { GameUmbra } from './GameUmbra'

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('GameUmbra', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'performance', 'Date'],
    })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lane keys still judge after clicking Start with the mouse (focus left on BODY)', () => {
    render(<GameUmbra storageKey="best:umbra" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    // The Start button unmounts; focus falls back to <body>.
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(document.activeElement).toBe(document.body)

    advance(1000) // first marble spawns after 0.75s
    for (const key of ['1', '2', '3']) fireEvent.keyDown(document.body, { key })
    expect(screen.queryAllByTestId('judgement').length).toBeGreaterThan(0)
  })

  it('browser shortcuts (Cmd/Ctrl + R/A/S/D) are left alone now that keys live on window', () => {
    render(<GameUmbra storageKey="best:umbra" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    advance(1000)
    // fireEvent returns false when the handler called preventDefault (i.e. hijacked the shortcut).
    expect(fireEvent.keyDown(document.body, { key: 'r', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(document.body, { key: 'r', ctrlKey: true })).toBe(true)
    for (const key of ['a', 's', 'd']) {
      expect(fireEvent.keyDown(document.body, { key, metaKey: true })).toBe(true)
    }
    expect(screen.queryAllByTestId('judgement')).toHaveLength(0)
  })

  it('Enter/Space on a focused shell button before the run keeps its own action (window keys must not hijack it)', () => {
    render(<GameUmbra storageKey="best:umbra" />)
    const mute = screen.getByRole('button', { name: 'Mute sound' })
    mute.focus()
    // Not prevented → the browser still activates the focused button natively.
    expect(fireEvent.keyDown(mute, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(mute, { key: ' ' })).toBe(true)
    // …and the run did not start behind the player's back.
    expect(screen.getByTestId('umbra-start')).toBeInTheDocument()
  })

  it('a lane key with focus on a lane button still taps during a run', () => {
    render(<GameUmbra storageKey="best:umbra" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    advance(1000)
    const lane = screen.getAllByTestId('lane')[0]
    lane.focus()
    for (const key of ['1', '2', '3']) expect(fireEvent.keyDown(lane, { key })).toBe(false)
    expect(screen.queryAllByTestId('judgement').length).toBeGreaterThan(0)
  })

  it('renders the marble on a track that ends at the visible exit-marker line', () => {
    render(<GameUmbra storageKey="best:umbra" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    advance(800)
    const marble = document.querySelector<HTMLElement>('.um-marble')
    expect(marble).not.toBeNull()
    // Positions are mapped onto the lane minus the marker box, not the full 100cqw.
    expect(marble!.style.transform).toContain(`- ${EXIT_MARKER_REM}rem`)
  })
})

describe('umbra layout', () => {
  it('maps the engine exit (x = TRACK) exactly onto the marker line', () => {
    expect(trackCss(TRACK)).toBe(`calc(1 * (100cqw - ${EXIT_MARKER_REM}rem))`)
    expect(trackCss(0)).toBe(`calc(0 * (100cqw - ${EXIT_MARKER_REM}rem))`)
  })
})
