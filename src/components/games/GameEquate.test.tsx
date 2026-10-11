import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { GameEquate } from './GameEquate'

// jsdom has no layout, so the 390px overflow (audit 2026-10-10: ten 44px digit
// keys + gaps = 476px) is checked arithmetically from the rendered rows.
const KEY_MIN_PX = 44 // h-11 / min-w-11 touch target
const WIDE_KEY_PX = 56 // "Enter" / "⌫" with px-3
const GAP_PX = 4 // gap-1
const PHONE_CONTENT_PX = 390 - 2 * 16 // 16px side gutters

describe('GameEquate keypad', () => {
  beforeEach(() => localStorage.clear())

  it('every keypad row fits a 390px phone at the 44px minimum key width', async () => {
    render(<GameEquate storageKey="best:equate" />)
    const pad = await screen.findByTestId('equate-keypad')
    const rows = Array.from(pad.children) as HTMLElement[]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const keys = within(row).getAllByRole('button')
      const wide = keys.filter((k) => /enter|back/.test(k.dataset.testid ?? '')).length
      const minWidth = (keys.length - wide) * KEY_MIN_PX + wide * WIDE_KEY_PX + (keys.length - 1) * GAP_PX
      expect(minWidth, `row with ${keys.length} keys`).toBeLessThanOrEqual(PHONE_CONTENT_PX)
    }
  })

  it('still offers all 15 symbols plus Enter and Backspace', async () => {
    render(<GameEquate storageKey="best:equate" />)
    await screen.findByTestId('equate-keypad')
    for (const d of '0123456789') expect(screen.getByTestId(`equate-key-${d}`)).toBeInTheDocument()
    for (const id of ['add', 'sub', 'mul', 'div', 'eq', 'enter', 'back']) {
      expect(screen.getByTestId(`equate-key-${id}`)).toBeInTheDocument()
    }
  })
})
