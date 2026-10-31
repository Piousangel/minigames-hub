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
  freezes?: number // 남은 프리즈(자비). undefined = 0. 하루 놓쳐도 리셋 대신 이어감.
  maxStreak?: number // 역대 최고 스트릭(트로피 케이스용). 리셋돼도 보존.
}

/** 프리즈: 하루 놓쳐도 스트릭을 지키는 자비 인프라. 프리즈 없는 스트릭은 이탈 장치다
 *  (DOMAIN.md §3 — Duolingo가 프리즈를 늘리자 리텐션 상승). */
const FREEZE_MAX = 2
const FREEZE_EVERY = 5 // 스트릭이 5의 배수에 닿을 때마다 +1

/** 하루의 밀리초. 날짜 경계를 다루는 모듈이 같은 상수를 쓴다. */
export const MILLISECONDS_PER_DAY = 86_400_000

/** 'YYYY-MM-DD'(UTC)의 하루 전. 문자열 산술이 아니라 UTC Date로 정확히. */
export function prevDayUTC(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** 'YYYY-MM-DD'(UTC)의 하루 뒤. prevDayUTC와 같은 방식. */
export function nextDayUTC(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** from→to 사이 UTC 일수(to가 나중). 파싱 실패 시 Infinity. */
export function daysBetweenUTC(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00Z')
  const b = Date.parse(to + 'T00:00:00Z')
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity
  return Math.round((b - a) / 86_400_000)
}

/**
 * 오늘 데일리를 완료했을 때 호출. 같은 날 두 번 불러도 안전(멱등).
 * - 어제 완료(gap 1) → +1
 * - 하루 놓침(gap 2) + 프리즈 잔량 → 프리즈 1 소모하고 +1 (스트릭 유지)
 * - 그 외 → 1로 리셋(프리즈도 0)
 * - 새 스트릭이 5의 배수면 프리즈 +1(최대 2)
 */
export function bumpStreak(prev: DailyStreak | undefined, today: string = todayUTC()): DailyStreak {
  if (prev?.lastDate === today) return prev // 오늘 이미 셈함
  let streak: number
  let freezes = Math.min(prev?.freezes ?? 0, FREEZE_MAX)
  if (!prev) {
    streak = 1
  } else {
    const gap = daysBetweenUTC(prev.lastDate, today)
    if (gap === 1) {
      streak = prev.streak + 1
    } else if (gap === 2 && freezes > 0) {
      streak = prev.streak + 1
      freezes -= 1 // 자비 소모: 어제 놓친 것을 프리즈가 메운다
    } else {
      streak = 1
      freezes = 0
    }
  }
  if (streak % FREEZE_EVERY === 0) freezes = Math.min(freezes + 1, FREEZE_MAX)
  // 최고 기록은 리셋돼도 보존한다(트로피 케이스). 방금 끊긴 prev.streak도 과거 최고로 반영하여
  // maxStreak를 안 쓰던 기존 기록도 첫 리셋에서 올바른 최고값을 얻게 한다.
  const maxStreak = Math.max(prev?.maxStreak ?? 0, prev?.streak ?? 0, streak)
  return { lastDate: today, streak, freezes, maxStreak }
}

/**
 * 지금 화면에 보일 streak. 오늘/어제 완료면 살아있고, 하루 놓쳤어도 프리즈가 있으면
 * 아직 살아있다(오늘 하면 프리즈가 메움). 그보다 오래면 0(죽은 기록을 살아있는 척 안 함).
 */
export function currentStreak(prev: DailyStreak | undefined, today: string = todayUTC()): number {
  if (!prev) return 0
  if (prev.lastDate === today) return prev.streak
  const gap = daysBetweenUTC(prev.lastDate, today)
  if (gap === 1) return prev.streak
  if (gap === 2 && (prev.freezes ?? 0) > 0) return prev.streak // 프리즈로 아직 살아있음
  return 0
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
      const d = o as DailyStreak
      // freezes/maxStreak를 반드시 보존한다 — 안 그러면 매 로드에서 사라져 무의미해진다.
      return {
        lastDate: d.lastDate,
        streak: d.streak,
        ...(typeof d.freezes === 'number' ? { freezes: d.freezes } : {}),
        ...(typeof d.maxStreak === 'number' ? { maxStreak: d.maxStreak } : {}),
      }
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

/**
 * 다음 UTC 자정까지 남은 ms. '다음 데일리까지 HH:MM:SS' 카운트다운(어포인트먼트 메커닉,
 * DOMAIN §3 — Wordle의 '아침 의식')용. nowMs를 주입받아 순수·테스트 가능.
 */
export function msUntilNextUTCDay(nowMs: number): number {
  const rem = nowMs % MILLISECONDS_PER_DAY
  return rem === 0 ? 0 : MILLISECONDS_PER_DAY - rem
}

/** ms → 'HH:MM:SS'(음수/NaN은 00:00:00). 카운트다운 표시용. */
export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** 스트릭 마일스톤(손실회피 루프 유지, DOMAIN §3). */
export const STREAK_MILESTONES = [7, 30, 100, 365] as const

/** streak가 정확히 마일스톤이면 그 값, 아니면 null(도달 축하 표시용). */
export function milestoneReached(streak: number): number | null {
  return STREAK_MILESTONES.includes(streak as (typeof STREAK_MILESTONES)[number]) ? streak : null
}

/** 다음 마일스톤(이미 최대 초과면 null). 진척 넛지용. */
export function nextMilestone(streak: number): number | null {
  return STREAK_MILESTONES.find((m) => m > streak) ?? null
}
