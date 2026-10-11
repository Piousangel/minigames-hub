import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameMancala, Stones } from './GameMancala'

describe('GameMancala layout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('the overlay container is positioned so GameOverlay (absolute inset-0) covers only the board', () => {
    render(<GameMancala storageKey="best:mancala" />)
    const wrapper = screen.getByTestId('mancala-board').parentElement as HTMLElement
    expect(wrapper.className.split(/\s+/)).toContain('relative')
  })
})

describe('Mancala Stones', () => {
  it('draws pips for small pits on every viewport', () => {
    const { container } = render(<Stones count={4} tone="you" />)
    expect(container.querySelectorAll('[data-stone]')).toHaveLength(4)
    expect(container.querySelector('[data-stone-count]')).toBeNull()
  })

  it('switches to a number on phones once pips would spill out of the small pit', () => {
    const { container } = render(<Stones count={6} tone="you" />)
    const num = container.querySelector('[data-stone-count]') as HTMLElement
    const pips = container.querySelector('[data-stone-pips]') as HTMLElement
    expect(num).toHaveTextContent('6')
    // Number on phones only, pips from sm: up.
    expect(num.className).toMatch(/\bsm:hidden\b/)
    expect(pips.className).toMatch(/(^|\s)hidden(\s|$)/)
    expect(pips.className).toMatch(/\bsm:flex\b/)
  })

  it('always shows a number for crowded pits', () => {
    const { container } = render(<Stones count={9} tone="cpu" />)
    expect(container.querySelector('[data-stone-pips]')).toBeNull()
    expect(container.querySelector('[data-stone-count]')?.className).not.toMatch(/sm:hidden/)
  })
})
