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
  vi.unstubAllGlobals()
})

describe('SpotlightTeaser', () => {
  it("shows tomorrow's category and when it opens, without naming the game", () => {
    const { container } = renderTeaser()
    const slug = realSpotlightFor('2026-11-01') as string
    const gameTitle = gamePages.find((page) => page.slug === slug)!.h1

    expect(screen.getByTestId('spotlight-teaser')).toHaveTextContent("TOMORROW'S SPOTLIGHT")
    expect(screen.getByTestId('spotlight-teaser')).toHaveTextContent(gameMeta[slug].category)
    expect(screen.getByTestId('spotlight-teaser')).toHaveTextContent('00:00 UTC')
    // 스포일러 없음: 이름·slug·링크가 DOM에 없다.
    expect(container.textContent).not.toContain(gameTitle)
    expect(container.textContent).not.toContain(slug)
    expect(container.querySelector(`[href*="/${slug}"]`)).toBeNull()
  })

  it('does not run a per-second interval (it only waits for the next UTC midnight)', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    renderTeaser()
    expect(setIntervalSpy).not.toHaveBeenCalled()
    setIntervalSpy.mockRestore()
  })

  it('keeps the status live region mounted (empty) before any click so screen readers announce later updates', () => {
    renderTeaser()
    const status = screen.getByTestId('spotlight-ics-status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toBeEmptyDOMElement()
    // display:none인 빈 리전은 접근성 트리에 없어서 첫 메시지가 읽히지 않는다.
    expect(status.className).not.toMatch(/hidden/)
  })

  it('reads the hidden game as a mystery instead of question marks, and shows the local opening time', () => {
    renderTeaser()
    expect(screen.getByText('Mystery game')).toBeInTheDocument()
    expect(screen.getByTestId('spotlight-teaser')).toHaveTextContent(/00:00 UTC \(\d{1,2}:\d{2} your time\)/)
  })

  it('does not rebuild the local-time formatter when the parent re-renders', () => {
    const toLocaleTimeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString')
    const { rerender } = renderTeaser()
    const callsAfterMount = toLocaleTimeSpy.mock.calls.length
    for (let i = 0; i < 5; i++) {
      rerender(
        <GameNavProvider slug="snake">
          <SpotlightTeaser />
        </GameNavProvider>,
      )
    }
    expect(toLocaleTimeSpy.mock.calls.length).toBe(callsAfterMount)
    toLocaleTimeSpy.mockRestore()
  })

  it('labels the button by what it does', () => {
    renderTeaser()
    expect(screen.getByTestId('spotlight-ics')).toHaveTextContent('Add to calendar')
  })

  it('only records the teaser as seen once the card is actually on screen', () => {
    let notifyVisibility: IntersectionObserverCallback = () => {}
    const disconnect = vi.fn()
    class FakeIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        notifyVisibility = callback
      }
      observe() {}
      disconnect = disconnect
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)

    renderTeaser()
    expect(wasTeasedFor('2026-11-01')).toBe(false)

    act(() => {
      notifyVisibility([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    })

    expect(wasTeasedFor('2026-11-01')).toBe(true)
    expect(disconnect).toHaveBeenCalled()
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
    expect(sendHit).toHaveBeenCalledWith('snake', 'spotlight_ics_click')
    expect(screen.getByTestId('spotlight-ics-status')).toHaveTextContent(/download started/i)
  })

  it('tags the calendar link with ref=ics so returns from the reminder are measurable', async () => {
    const { entryTag } = await vi.importActual<typeof import('@/lib/hit')>('@/lib/hit')
    renderTeaser()
    fireEvent.click(screen.getByTestId('spotlight-ics'))

    const content = vi.mocked(downloadTextFile).mock.calls[0][2]
    const url = content.match(/^URL:(.+)$/m)?.[1].trim()
    expect(url).toBe('https://quickminigames.site/daily?ref=ics')
    // 사이트의 유입 태그 파서가 이 값을 그대로 읽는지(태그 형식 규칙과 어긋나지 않는지) 확인한다.
    expect(entryTag(new URL(url!).search)).toBe('ics')
  })

  it('survives rapid repeated clicks: every click saves the file but the analytics hit is sent once', () => {
    renderTeaser()
    const button = screen.getByTestId('spotlight-ics')
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(downloadTextFile).toHaveBeenCalledTimes(3)
    expect(sendHit).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('spotlight-ics-status')).toHaveTextContent(/download started/i)
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
    expect(screen.getByTestId('spotlight-teaser')).toHaveTextContent('00:00 UTC')
  })

  it('renders nothing when there is no spotlight game', () => {
    vi.mocked(spotlightFor).mockReturnValue(null)
    const { container } = renderTeaser()
    expect(screen.queryByTestId('spotlight-teaser')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})
