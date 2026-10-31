// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile } from './downloadFile'

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('downloadTextFile', () => {
  it('clicks a temporary download link with the given filename and mime type', () => {
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clickedFilenames: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedFilenames.push(this.download)
    })

    vi.useFakeTimers()

    const succeeded = downloadTextFile('quickminigames-daily.ics', 'text/calendar', 'BEGIN:VCALENDAR')

    expect(succeeded).toBe(true)
    expect(clickedFilenames).toEqual(['quickminigames-daily.ics'])
    const blob = createObjectURL.mock.calls[0][0] as unknown as Blob
    expect(blob.type).toBe('text/calendar')
    // 일부 브라우저는 클릭 직후 해제하면 저장이 취소되므로 지연 해제한다.
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    vi.useRealTimers()
  })

  it('returns false instead of throwing when object URLs are unsupported', () => {
    expect(() => downloadTextFile('a.ics', 'text/calendar', 'x')).not.toThrow()
    expect(downloadTextFile('a.ics', 'text/calendar', 'x')).toBe(false)
  })

  it('returns false when creating the object URL throws', () => {
    Object.assign(URL, {
      createObjectURL: () => {
        throw new Error('blocked')
      },
      revokeObjectURL: vi.fn(),
    })
    expect(downloadTextFile('a.ics', 'text/calendar', 'x')).toBe(false)
  })
})
