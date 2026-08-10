import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectiveBanner } from './ObjectiveBanner'

describe('ObjectiveBanner', () => {
  it('renders the objective and a primary control glyph for a game with both', () => {
    render(<ObjectiveBanner slug="snake" />)
    expect(screen.getByTestId('objective')).toBeInTheDocument()
    const glyph = screen.getByTestId('controls-glyph')
    expect(glyph).toHaveTextContent('↑↓←→')
    expect(glyph).toHaveAttribute('aria-label', 'Controls: Arrow keys')
  })

  it('shows a combined aria-label when a game lists two control schemes', () => {
    render(<ObjectiveBanner slug="breakout" />)
    const glyph = screen.getByTestId('controls-glyph')
    expect(glyph).toHaveAttribute('aria-label', 'Controls: Move mouse/finger or Arrow keys')
  })

  it('renders nothing for a slug with no objective text', () => {
    const { container } = render(<ObjectiveBanner slug="no-such-game" />)
    expect(container).toBeEmptyDOMElement()
  })
})
