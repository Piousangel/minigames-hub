import { todayUTC } from './dailyDate'

/**
 * Day-streak: daily 게임의 재방문 동기. "어제도 완료했으면 +1, 아니면 1로 리셋,
 * 같은 날 중복은 없음." 날짜는 전부 UTC(todayUTC와 동일 경계).
 *
 * 코어(bumpStreak/currentStreak)는 `today`를 주입받을 수 있어 순수·테스트 가능하다.
 * 저장(loadStreak/saveStreak)은 전용 키 하나에 JSON으로 — best:<slug>에는 절대 넣지
 * 않는다(리더보드가 Number()로 읽어 NaN이 된다).
 */
export interface DailyStreak {
  lastDate: string // 마지막으로 완료한 UTC 날짜 'YYYY-MM-DD'
  streak: number // 그날까지 연속 완료 일수 (>= 1)
}

/** 'YYYY-MM-DD'(UTC)의 하루 전. 문자열 산술이 아니라 UTC Date로 정확히. */
export function prevDayUTC(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** 오늘 데일리를 완료했을 때 호출. 같은 날 두 번 불러도 안전(멱등). */
export function bumpStreak(prev: DailyStreak | undefined, today: string = todayUTC()): DailyStreak {
  if (prev?.lastDate === today) return prev // 오늘 이미 셈함
  const streak = prev?.lastDate === prevDayUTC(today) ? prev.streak + 1 : 1
  return { lastDate: today, streak }
}

/**
 * 지금 화면에 보일 streak. 마지막 완료가 오늘이거나 어제면 살아있고, 그보다 오래면
 * 끊긴 것이라 0. (저장된 streak 숫자를 그대로 보이면 죽은 기록을 살아있는 척 표시한다.)
 */
export function currentStreak(prev: DailyStreak | undefined, today: string = todayUTC()): number {
  if (!prev) return 0
  return prev.lastDate === today || prev.lastDate === prevDayUTC(today) ? prev.streak : 0
}

/** 전용 키에서 로드. 손상/부재 시 undefined. */
export function loadStreak(key: string): DailyStreak | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const o = JSON.parse(raw) as unknown
    if (
      o &&
      typeof (o as DailyStreak).lastDate === 'string' &&
      typeof (o as DailyStreak).streak === 'number'
    ) {
      return { lastDate: (o as DailyStreak).lastDate, streak: (o as DailyStreak).streak }
    }
  } catch {
    // 손상 → streak 없음
  }
  return undefined
}

export function saveStreak(key: string, s: DailyStreak): void {
  try {
    localStorage.setItem(key, JSON.stringify(s))
  } catch {
    // 저장 실패 무시
  }
}
