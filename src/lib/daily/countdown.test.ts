import { describe, expect, it } from 'vitest'
import { formatHMS, nextEditionLabel, secondsToNextEdition } from './countdown'

const at = (iso: string) => Date.parse(iso)

describe('다음 호 카운트다운(UTC 자정)', () => {
  it('UTC 23:59:59 → 00:00:01, 자정을 넘으면 23:59:59부터 다시', () => {
    expect(nextEditionLabel(at('2026-11-20T23:59:59.000Z'))).toBe('00:00:01')
    expect(nextEditionLabel(at('2026-11-20T23:59:59.999Z'))).toBe('00:00:01')
    expect(nextEditionLabel(at('2026-11-21T00:00:00.000Z'))).toBe('23:59:59')
    expect(nextEditionLabel(at('2026-11-21T00:00:00.001Z'))).toBe('23:59:59')
    expect(nextEditionLabel(at('2026-11-21T00:00:01.000Z'))).toBe('23:59:59')
    expect(nextEditionLabel(at('2026-11-21T00:00:02.000Z'))).toBe('23:59:58')
  })
  it('한낮', () => {
    expect(nextEditionLabel(at('2026-11-20T09:37:55.000Z'))).toBe('14:22:05')
  })
  it('시간대와 무관(같은 순간이면 같은 값)', () => {
    expect(secondsToNextEdition(at('2026-11-20T08:00:00+09:00'))).toBe(secondsToNextEdition(at('2026-11-19T23:00:00Z')))
  })
  it('늘 8글자(고정 폭)', () => {
    for (const s of [0, 1, 59, 3600, 86_399]) expect(formatHMS(s)).toHaveLength(8)
    expect(formatHMS(3661)).toBe('01:01:01')
  })
})
