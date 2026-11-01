import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { TodayBoard } from './TodayBoard'
import type { BrowseItem } from '@/components/GameBrowser'
import { gamePages } from '@/lib/games/registry'
import { spotlightFor } from '@/lib/spotlight'

const items: BrowseItem[] = gamePages.map((page) => ({
  slug: page.slug,
  title: page.h1,
  description: page.shortDescription,
  category: 'Puzzle',
}))

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

function linkCount(container: HTMLElement, slug: string): number {
  return container.querySelectorAll(`a[href="/${slug}"]`).length
}

describe('TodayBoard — spotlight de-duplication', () => {
  it('never shows the spotlight game a second time under "Picks for today"', () => {
    vi.setSystemTime(new Date('2026-12-12T10:00:00Z'))
    const { container } = render(<TodayBoard items={items} />)
    const spotlightSlug = spotlightFor('2026-12-12') as string
    expect(linkCount(container, spotlightSlug)).toBe(1)
  })

  it('keeps de-duplicating after the page stays open across UTC midnight', () => {
    vi.setSystemTime(new Date('2026-12-12T23:59:58Z'))
    const { container } = render(<TodayBoard items={items} />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    const newSpotlightSlug = spotlightFor('2026-12-13') as string
    expect(linkCount(container, newSpotlightSlug)).toBe(1)
  })
})
