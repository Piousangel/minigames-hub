import { describe, it, expect } from 'vitest'
import {
  nextUtcMidnightMilliseconds,
  formatIcsUtc,
  escapeIcsText,
  foldIcsLine,
  buildDailyIcs,
} from './dailyIcs'

const textEncoder = new TextEncoder()
const octetLength = (text: string) => textEncoder.encode(text).length
const unfold = (folded: string) => folded.replace(/\r\n /g, '')

describe('nextUtcMidnightMilliseconds', () => {
  it('returns the next UTC midnight after midday', () => {
    expect(nextUtcMidnightMilliseconds(Date.UTC(2026, 9, 31, 12))).toBe(Date.UTC(2026, 10, 1))
  })

  it('is strictly in the future: exactly at midnight gives the following midnight', () => {
    expect(nextUtcMidnightMilliseconds(Date.UTC(2026, 10, 1))).toBe(Date.UTC(2026, 10, 2))
  })

  it('handles the last millisecond of a day', () => {
    expect(nextUtcMidnightMilliseconds(Date.UTC(2026, 9, 31, 23, 59, 59, 999))).toBe(Date.UTC(2026, 10, 1))
  })
})

describe('formatIcsUtc', () => {
  it('formats as YYYYMMDDTHHMMSSZ', () => {
    expect(formatIcsUtc(Date.UTC(2026, 10, 1))).toBe('20261101T000000Z')
    expect(formatIcsUtc(Date.UTC(2026, 9, 31, 12, 5, 9))).toBe('20261031T120509Z')
  })
})

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
    expect(escapeIcsText('line1\r\nline2')).toBe('line1\\nline2')
  })
})

describe('foldIcsLine', () => {
  it('keeps short lines untouched', () => {
    expect(foldIcsLine('SUMMARY:hello')).toBe('SUMMARY:hello')
  })

  it('folds long ASCII lines to at most 75 octets per physical line and unfolds back', () => {
    const line = `DESCRIPTION:${'x'.repeat(200)}`
    const folded = foldIcsLine(line)
    for (const physicalLine of folded.split('\r\n')) {
      expect(octetLength(physicalLine)).toBeLessThanOrEqual(75)
    }
    expect(unfold(folded)).toBe(line)
  })

  it('never splits a multibyte character', () => {
    const line = `SUMMARY:${'가'.repeat(40)}`
    const folded = foldIcsLine(line)
    for (const physicalLine of folded.split('\r\n')) {
      expect(octetLength(physicalLine)).toBeLessThanOrEqual(75)
      expect(physicalLine).not.toContain('�')
    }
    expect(unfold(folded)).toBe(line)
  })
})

describe('buildDailyIcs', () => {
  const input = {
    uid: 'daily-reminder@quickminigames.site',
    summary: "Today's daily puzzles are live",
    description: 'New daily boards just unlocked.',
    url: 'https://quickminigames.site/daily',
    nowMilliseconds: Date.UTC(2026, 9, 31, 12),
  }

  it('produces a CRLF-terminated VCALENDAR with the required fields', () => {
    const calendar = buildDailyIcs(input)
    expect(calendar.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(calendar.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(calendar).toContain('PRODID:')
    expect(calendar).toContain('UID:daily-reminder@quickminigames.site\r\n')
    expect(calendar).toContain('DTSTAMP:20261031T120000Z\r\n')
    expect(calendar).toContain('DTSTART:20261101T000000Z\r\n')
    expect(calendar).toContain('RRULE:FREQ=DAILY\r\n')
    expect(calendar).toContain('URL:https://quickminigames.site/daily\r\n')
  })

  it('carries a SEQUENCE so a re-downloaded file updates the same event instead of being ignored', () => {
    const dayNumber = Math.floor(Date.UTC(2026, 9, 31, 12) / 86_400_000)
    expect(buildDailyIcs(input)).toContain(`SEQUENCE:${dayNumber}\r\n`)
    const nextDayInput = { ...input, nowMilliseconds: Date.UTC(2026, 10, 1, 12) }
    expect(buildDailyIcs(nextDayInput)).toContain(`SEQUENCE:${dayNumber + 1}\r\n`)
  })

  it('alerts at the start time with a display alarm', () => {
    const calendar = buildDailyIcs(input)
    expect(calendar).toContain('BEGIN:VALARM\r\n')
    expect(calendar).toContain('ACTION:DISPLAY\r\n')
    expect(calendar).toContain('TRIGGER:PT0S\r\n')
  })

  it('uses CRLF only and keeps every physical line within 75 octets', () => {
    const calendar = buildDailyIcs({ ...input, description: 'x'.repeat(300) })
    expect(calendar).not.toMatch(/(?<!\r)\n/)
    for (const physicalLine of calendar.split('\r\n')) {
      expect(octetLength(physicalLine)).toBeLessThanOrEqual(75)
    }
  })

  it('escapes special characters so the line structure cannot break', () => {
    const calendar = buildDailyIcs({ ...input, summary: 'a,b;c\nBEGIN:EVIL' })
    expect(calendar).toContain('SUMMARY:a\\,b\\;c\\nBEGIN:EVIL\r\n')
    expect(calendar.match(/^BEGIN:EVIL/m)).toBeNull()
  })

  it('is deterministic for the same input', () => {
    expect(buildDailyIcs(input)).toBe(buildDailyIcs(input))
  })
})
