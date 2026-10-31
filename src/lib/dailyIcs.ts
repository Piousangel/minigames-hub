/**
 * 매일 반복 알림용 .ics(RFC 5545) 생성 — 서버·권한 없이 사용자의 캘린더 앱이 대신 알려 준다.
 * 전부 순수 함수: 현재 시각은 `nowMilliseconds`로 주입받는다.
 */

const MILLISECONDS_PER_DAY = 86_400_000
const MAXIMUM_LINE_OCTETS = 75
const textEncoder = new TextEncoder()

/** 엄밀히 미래인 다음 UTC 자정(정확히 자정이면 24시간 뒤). */
export function nextUtcMidnightMilliseconds(nowMilliseconds: number): number {
  return nowMilliseconds - (nowMilliseconds % MILLISECONDS_PER_DAY) + MILLISECONDS_PER_DAY
}

/** ms → 'YYYYMMDDTHHMMSSZ'. */
export function formatIcsUtc(milliseconds: number): string {
  return new Date(milliseconds)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** TEXT 값 이스케이프: 역슬래시·세미콜론·쉼표·개행. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** 75옥텟 단위로 접는다(접힌 줄은 공백으로 시작). 멀티바이트 문자는 쪼개지 않는다. */
export function foldIcsLine(line: string): string {
  const physicalLines: string[] = []
  let currentLine = ''
  let currentOctets = 0
  for (const character of line) {
    const characterOctets = textEncoder.encode(character).length
    // 이어지는 줄은 맨 앞 공백 1옥텟을 쓰므로 본문 한도는 74옥텟.
    const limit = physicalLines.length === 0 ? MAXIMUM_LINE_OCTETS : MAXIMUM_LINE_OCTETS - 1
    if (currentOctets + characterOctets > limit) {
      physicalLines.push(currentLine)
      currentLine = ''
      currentOctets = 0
    }
    currentLine += character
    currentOctets += characterOctets
  }
  physicalLines.push(currentLine)
  return physicalLines.join('\r\n ')
}

export interface DailyIcsInput {
  uid: string
  summary: string
  description: string
  url: string
  nowMilliseconds: number
}

export function buildDailyIcs(input: DailyIcsInput): string {
  const summary = escapeIcsText(input.summary)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quick MiniGames//Daily Reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    // 같은 UID를 다시 내려받을 때 캘린더가 "갱신"으로 받아들이도록 날마다 커지는 번호를 둔다.
    `SEQUENCE:${Math.floor(input.nowMilliseconds / MILLISECONDS_PER_DAY)}`,
    `DTSTAMP:${formatIcsUtc(input.nowMilliseconds)}`,
    `DTSTART:${formatIcsUtc(nextUtcMidnightMilliseconds(input.nowMilliseconds))}`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${summary}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
    `URL:${input.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}
