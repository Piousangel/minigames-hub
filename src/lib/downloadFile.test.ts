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
    const createdBlobs: Blob[] = []
    const createObjectURL = vi.fn((blob: Blob) => {
      createdBlobs.push(blob)
      return 'blob:fake'
    })
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
    expect(createdBlobs[0].type).toBe('text/calendar')
    // 일부 브라우저는 클릭 직후 해제하면 저장이 취소되므로 지연 해제한다.
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeObjectURL).not.toHaveBeenCalled() // iOS·Safari는 클릭 뒤에도 blob을 늦게 읽는다
    vi.advanceTimersByTime(40_000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    vi.useRealTimers()
  })

  it('returns false instead of throwing when object URLs are unsupported', () => {
    expect(() => downloadTextFile('a.ics', 'text/calendar', 'x')).not.toThrow()
    expect(downloadTextFile('a.ics', 'text/calendar', 'x')).toBe(false)
  })

  it('removes the temporary link and revokes the URL even when click() throws', () => {
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.useFakeTimers()

    expect(downloadTextFile('a.ics', 'text/calendar', 'x')).toBe(false)

    expect(document.querySelector('a[download]')).toBeNull()
    vi.advanceTimersByTime(40_000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    vi.useRealTimers()
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
