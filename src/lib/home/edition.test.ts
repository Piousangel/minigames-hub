import { describe, expect, it } from 'vitest'
import { EDITION_EPOCH_UTC, editionFor, editionLine } from './edition'

describe('editionFor (오늘 호, UTC 자정 기준)', () => {
  it('No.1 = 기준일 2026-07-18 UTC 0시', () => {
    expect(EDITION_EPOCH_UTC).toBe('2026-07-18')
    expect(editionFor(new Date('2026-07-18T00:00:00Z'))).toEqual({ no: 1, dateUTC: '2026-07-18', label: 'Sat, Jul 18' })
  })

  it('리디자인 시안 날짜 2026-11-19 = No. 125, "Thu, Nov 19"', () => {
    const e = editionFor(new Date('2026-11-19T12:00:00Z'))
    expect(e).toEqual({ no: 125, dateUTC: '2026-11-19', label: 'Thu, Nov 19' })
    expect(editionLine(e)).toBe('No. 125 · Thu, Nov 19')
  })

  it('경계: UTC 23:59:59.999까지 같은 호, 00:00에 다음 호', () => {
    const before = editionFor(new Date('2026-11-19T23:59:59.999Z'))
    const after = editionFor(new Date('2026-11-20T00:00:00.000Z'))
    expect(before.no).toBe(125)
    expect(before.label).toBe('Thu, Nov 19')
    expect(after.no).toBe(126)
    expect(after.dateUTC).toBe('2026-11-20')
    expect(after.label).toBe('Fri, Nov 20')
  })

  it('현지 시간대와 무관 — 서울 아침 8시(=전날 UTC 23시)는 아직 전날 호', () => {
    // 2026-11-20 08:00 KST = 2026-11-19 23:00 UTC
    const e = editionFor(new Date('2026-11-20T08:00:00+09:00'))
    expect(e.dateUTC).toBe('2026-11-19')
    expect(e.no).toBe(125)
  })

  it('기준일 이전(틀린 기기 시계)은 No.1 아래로 내려가지 않는다', () => {
    expect(editionFor(new Date('2026-01-01T00:00:00Z')).no).toBe(1)
  })

  it('윤년·월 경계도 하루씩 센다', () => {
    const a = editionFor(new Date('2028-02-28T10:00:00Z')).no
    expect(editionFor(new Date('2028-02-29T10:00:00Z')).no).toBe(a + 1)
    expect(editionFor(new Date('2028-03-01T10:00:00Z')).no).toBe(a + 2)
  })
})
