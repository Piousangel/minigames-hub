import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { SpotlightReveal } from './SpotlightReveal'
import type { BrowseItem } from '@/components/GameBrowser'
import { spotlightFor } from '@/lib/spotlight'
import { markTeaserSeen } from '@/lib/spotlightSeen'
import { markPlayed } from '@/lib/today'

vi.mock('@/lib/spotlight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/spotlight')>()
  return { ...actual, spotlightFor: vi.fn(actual.spotlightFor) }
})

const realSpotlightFor = (await vi.importActual<typeof import('@/lib/spotlight')>('@/lib/spotlight')).spotlightFor
const TODAY = '2026-11-01'
const spotlightSlug = realSpotlightFor(TODAY) as string

function makeItem(slug: string): BrowseItem {
  return { slug, title: `Title of ${slug}`, description: 'A short description', category: 'Puzzle', daily: true }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`))
  localStorage.clear()
  vi.mocked(spotlightFor).mockImplementation(realSpotlightFor)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('SpotlightReveal', () => {
  it("shows today's spotlight game with a link to it", () => {
    const { container } = render(<SpotlightReveal items={[makeItem(spotlightSlug)]} />)

    expect(screen.getByTestId('spotlight-reveal')).toHaveTextContent("TODAY'S SPOTLIGHT")
    expect(screen.getByTestId('spotlight-reveal')).toHaveTextContent(`Title of ${spotlightSlug}`)
    expect(container.querySelector(`a[href="/${spotlightSlug}"]`)).not.toBeNull()
  })

  it('marks it as teased only when yesterday\'s teaser was seen', () => {
    const { unmount } = render(<SpotlightReveal items={[makeItem(spotlightSlug)]} />)
    expect(screen.queryByTestId('spotlight-teased')).not.toBeInTheDocument()
    unmount()

    markTeaserSeen(TODAY)
    render(<SpotlightReveal items={[makeItem(spotlightSlug)]} />)
    expect(screen.getByTestId('spotlight-teased')).toBeInTheDocument()
  })

  it('marks it as opened once the spotlight game was visited today', () => {
    const { unmount } = render(<SpotlightReveal items={[makeItem(spotlightSlug)]} />)
    expect(screen.queryByTestId('spotlight-opened')).not.toBeInTheDocument()
    unmount()

    markPlayed(TODAY, spotlightSlug)
    render(<SpotlightReveal items={[makeItem(spotlightSlug)]} />)
    expect(screen.getByTestId('spotlight-opened')).toHaveTextContent('Opened today')
  })

  it('switches to the next spotlight when UTC midnight passes with the page left open', () => {
    vi.setSystemTime(new Date(`${TODAY}T23:59:58Z`))
    const tomorrowSlug = realSpotlightFor('2026-11-02') as string
    render(<SpotlightReveal items={[makeItem(spotlightSlug), makeItem(tomorrowSlug)]} />)
    expect(screen.getByTestId('spotlight-reveal')).toHaveTextContent(`Title of ${spotlightSlug}`)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByTestId('spotlight-reveal')).toHaveTextContent(`Title of ${tomorrowSlug}`)
  })

  it('renders nothing when the spotlight game is not in the browse list', () => {
    const { container } = render(<SpotlightReveal items={[makeItem('some-other-game')]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when there is no spotlight game', () => {
    vi.mocked(spotlightFor).mockReturnValue(null)
    const { container } = render(<SpotlightReveal items={[makeItem(spotlightSlug)]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('still renders the card when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    render(<SpotlightReveal items={[makeItem(spotlightSlug)]} />)
    expect(screen.getByTestId('spotlight-reveal')).toBeInTheDocument()
    expect(screen.queryByTestId('spotlight-teased')).not.toBeInTheDocument()
    expect(screen.queryByTestId('spotlight-opened')).not.toBeInTheDocument()
  })
})
