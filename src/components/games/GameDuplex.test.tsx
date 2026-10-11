import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PACKS } from '@/lib/games/duplex/engine'
import { GameDuplex } from './GameDuplex'

const STORAGE_KEY = 'best:duplex'
const mirror = () => screen.getByTestId('duplex-mirror').textContent ?? ''
const prev = () => screen.getByRole('button', { name: 'Previous level' })
const next = () => screen.getByRole('button', { name: 'Next level' })

describe('GameDuplex level navigation respects pack locks (audit 2026-10-10)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('◀ on Level 1 does not wrap into the locked last pack', () => {
    render(<GameDuplex storageKey={STORAGE_KEY} />)
    expect(mirror()).toContain('Horizontal')
    expect(prev()).toBeDisabled()
    fireEvent.click(prev())
    expect(mirror()).toContain('Horizontal')
    expect(mirror()).not.toContain('Anti-Diagonal')
  })

  it('▶ stops at the end of the last unlocked pack', () => {
    render(<GameDuplex storageKey={STORAGE_KEY} />)
    const firstPackLen = PACKS[0].end - PACKS[0].start + 1
    for (let i = 0; i < firstPackLen + 3; i++) fireEvent.click(next())
    expect(mirror()).toContain('Horizontal')
    expect(next()).toBeDisabled()
  })

  it('▶ crosses into the next pack once it is unlocked, and never wraps past the end', () => {
    // Every level solved → every pack unlocked.
    localStorage.setItem(
      `${STORAGE_KEY}:solved`,
      JSON.stringify(Array.from({ length: PACKS[PACKS.length - 1].end + 1 }, (_, i) => i)),
    )
    render(<GameDuplex storageKey={STORAGE_KEY} />)
    for (let i = 0; i < PACKS[0].end + 1; i++) fireEvent.click(next())
    expect(mirror()).toContain('Vertical')
    for (let i = 0; i < 40; i++) fireEvent.click(next())
    expect(mirror()).toContain('Anti-Diagonal')
    expect(next()).toBeDisabled()
  })
})
