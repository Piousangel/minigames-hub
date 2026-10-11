import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameCleave } from './GameCleave'
import type { CleaveState, Item } from '@/lib/games/cleave/engine'

// A fixed opening: item 0 carries a huge magenta value and sits in pile A under
// the default alternating split, so the rival clearly leans A (the LEFT column).
vi.mock('@/lib/games/cleave/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/cleave/engine')>()
  const items: Item[] = [
    { id: 0, myValue: 2, theirValue: 10, sealed: false, bandLo: 10, bandHi: 10 },
    { id: 1, myValue: 3, theirValue: 1, sealed: false, bandLo: 1, bandHi: 1 },
    { id: 2, myValue: 1, theirValue: 1, sealed: false, bandLo: 1, bandHi: 1 },
    { id: 3, myValue: 4, theirValue: 2, sealed: true, bandLo: 1, bandHi: 3 },
  ]
  return {
    ...real,
    createGame: (seed: number): CleaveState => {
      const base = real.createGame(seed)
      const g = real.bestGuaranteed(items)
      return {
        ...base,
        board: {
          round: 1,
          items,
          maxVal: 12,
          sealedIndex: 3,
          bestGuaranteed: g,
          hindsightOptimum: real.hindsightOptimum(items),
          quota: Math.ceil(real.QUOTA_RATIO * g),
        },
        assign: real.defaultAssign(items.length),
      }
    },
  }
})

describe('GameCleave margin meter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('grows toward pile A (left) when the rival leans A', async () => {
    render(<GameCleave storageKey="best:cleave" />)
    await screen.findByTestId('cleave-board')
    expect(screen.getByText('Rival leans A')).toBeTruthy()

    const halfA = screen.getByTestId('cleave-meter-A')
    const halfB = screen.getByTestId('cleave-meter-B')
    // A's half is the LEFT half: its right edge sits on the centre line and the
    // bar scales out from there toward the left.
    expect(halfA.className).toContain('right-1/2')
    expect(halfB.className).toContain('left-1/2')
    const barA = halfA.firstElementChild as HTMLElement
    const barB = halfB.firstElementChild as HTMLElement
    expect(barA.style.transformOrigin).toBe('right center')
    expect(barB.style.transformOrigin).toBe('left center')
    expect(barA.style.transform).not.toBe('scaleX(0)')
    expect(barB.style.transform).toBe('scaleX(0)')
  })
})
