import { isoWeek } from './leaderboard'

/**
 * 리더보드 주간 표기(리디자인 v2, /leaderboards 정원 틀). 서버가 주는 ISO 주 문자열("2026-W47")을
 * 사람 말("This week · Nov 16–22")로 바꾼다. 주 = ISO-8601, UTC 월요일 00:00 ~ 일요일 끝(서버 isoWeek와 같은 기준).
 * 달 이름은 고정 영어 표(로캘·Intl 차이로 서버 HTML과 클라이언트가 달라지지 않게).
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const DAY = 86_400_000

/** "2026-W47" → 그 주 월요일 00:00 UTC. 형식이 틀리거나 주 번호가 그 해에 없으면 null. */
export function isoWeekStart(week: string): Date | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week)
  if (!m) return null
  const year = Number(m[1])
  const w = Number(m[2])
  if (w < 1 || w > 53) return null
  // 1월 4일은 늘 1주차 → 그 주 월요일이 1주차 시작
  const jan4 = Date.UTC(year, 0, 4)
  const dow = new Date(jan4).getUTCDay() || 7
  const start = new Date(jan4 - (dow - 1) * DAY + (w - 1) * 7 * DAY)
  // 53주차가 없는 해(예: 2025-W53 → 2026-W01)는 거른다
  if (isoWeek(start) !== week) return null
  return start
}

/** 월요일 시작일 → "Nov 16–22" / 달이 넘어가면 "Nov 30 – Dec 6" (연도가 넘어가도 같은 모양: "Dec 29 – Jan 4"). */
export function formatWeekRange(start: Date): string {
  const end = new Date(start.getTime() + 6 * DAY)
  const sm = MONTHS[start.getUTCMonth()]
  const em = MONTHS[end.getUTCMonth()]
  if (sm === em && start.getUTCFullYear() === end.getUTCFullYear()) return `${sm} ${start.getUTCDate()}–${end.getUTCDate()}`
  return `${sm} ${start.getUTCDate()} – ${em} ${end.getUTCDate()}`
}

/**
 * 머리 라벨. 지금(UTC) 주와 같으면 "This week · Nov 16–22", 다르면(캐시가 자정을 넘긴 경우 등) "Week of Nov 10–16".
 * 형식이 틀린 값은 null(라벨을 안 그린다).
 */
export function weekLabel(week: string, now: Date): string | null {
  const start = isoWeekStart(week)
  if (!start) return null
  const range = formatWeekRange(start)
  return isoWeek(now) === week ? `This week · ${range}` : `Week of ${range}`
}
