import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SpotlightTeaser } from './SpotlightTeaser'
import { GameNavProvider } from '@/components/GameNav'
import { spotlightFor } from '@/lib/spotlight'
import { downloadTextFile } from '@/lib/downloadFile'
import { sendHit } from '@/lib/hit'
import { wasTeasedFor } from '@/lib/spotlightSeen'
import { gamePages } from '@/lib/games/registry'
import { gameMeta } from '@/lib/games/gameMeta'

vi.mock('@/lib/downloadFile', () => ({ downloadTextFile: vi.fn(() => true) }))
vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))
vi.mock('@/lib/spotlight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/spotlight')>()
  return { ...actual, spotlightFor: vi.fn(actual.spotlightFor) }
})

const realSpotlightFor = (await vi.importActual<typeof import('@/lib/spotlight')>('@/lib/spotlight')).spotlightFor

function renderTeaser() {
  return render(
    <GameNavProvider slug="snake">
      <SpotlightTeaser />
    </GameNavProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-31T12:00:00Z'))
  localStorage.clear()
  sessionStorage.clear()
  vi.mocked(spotlightFor).mockImplementation(realSpotlightFor)
  vi.mocked(downloadTextFile).mockReset().mockReturnValue(true)
  vi.mocked(sendHit).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SpotlightTeaser', () => {
  it("shows tomorrow's category and a countdown, without naming the game", () => {
    const { container } = renderTeaser()
    const slug = realSpotlightFor('2026-11-01') as string
    const gameTitle = gamePages.find((page) => page.slug === slug)!.h1

    expect(screen.getByTestId('spotlight-teaser')).toHaveTextContent("TOMORROW'S SPOTLIGHT")
    expect(screen.getByTestId('spotlight-teaser')).toHaveTextContent(gameMeta[slug].category)
    expect(screen.getByTestId('spotlight-countdown')).toHaveTextContent('12:00:00')
    // 스포일러 없음: 이름·slug·링크가 DOM에 없다.
    expect(container.textContent).not.toContain(gameTitle)
    expect(container.textContent).not.toContain(slug)
    expect(container.querySelector(`[href*="/${slug}"]`)).toBeNull()
  })

  it('ticks the countdown every second', () => {
    renderTeaser()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId('spotlight-countdown')).toHaveTextContent('11:59:59')
  })

  it('remembers that tomorrow was teased', () => {
    renderTeaser()
    expect(wasTeasedFor('2026-11-01')).toBe(true)
  })

  it('downloads a daily .ics and reports a hit when the button is pressed', () => {
    renderTeaser()
    fireEvent.click(screen.getByTestId('spotlight-ics'))

    expect(downloadTextFile).toHaveBeenCalledTimes(1)
    const [filename, mimeType, content] = vi.mocked(downloadTextFile).mock.calls[0]
    expect(filename).toBe('quickminigames-daily.ics')
    expect(mimeType).toBe('text/calendar')
    expect(content).toContain('RRULE:FREQ=DAILY')
    expect(content).toContain('DTSTART:20261101T000000Z')
    expect(sendHit).toHaveBeenCalledWith('snake', 'spotlight_ics')
    expect(screen.getByTestId('spotlight-ics-status')).toHaveTextContent(/saved/i)
  })

  it('explains the failure instead of throwing when the file cannot be saved', () => {
    vi.mocked(downloadTextFile).mockReturnValue(false)
    renderTeaser()
    fireEvent.click(screen.getByTestId('spotlight-ics'))

    expect(screen.getByTestId('spotlight-ics-status')).toHaveTextContent(/couldn.t save/i)
    expect(sendHit).not.toHaveBeenCalled()
  })

  it('moves on to the new "tomorrow" when UTC midnight passes during the session', () => {
    vi.setSystemTime(new Date('2026-10-31T23:59:58Z'))
    renderTeaser()
    expect(wasTeasedFor('2026-11-01')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(wasTeasedFor('2026-11-02')).toBe(true)
    expect(screen.getByTestId('spotlight-countdown')).toHaveTextContent('23:59:59')
  })

  it('renders nothing when there is no spotlight game', () => {
    vi.mocked(spotlightFor).mockReturnValue(null)
    const { container } = renderTeaser()
    expect(screen.queryByTestId('spotlight-teaser')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})
