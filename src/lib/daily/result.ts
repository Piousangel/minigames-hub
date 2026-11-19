/**
 * 데일리 결과(오리지널 3종 공통) — 계획서 2장 `DailyResult` + 날짜별 완료 기록(리디자인 v2 R5).
 *
 * 완료 기록 키 하나의 규칙: `garden:done:<그 게임의 일일 날짜 YYYY-MM-DD>:<slug>` (값 = 그날 최고 DailyResult JSON).
 * - 날짜는 **그 게임이 일일을 바꾸는 기준의 날짜**다. 뿅 착지·도토리 = UTC 날짜(todayUTC), 말랑 미끄럼길 = 현지 날짜
 *   (todayLocal, 오너 11-19 '나라별 자정'). 말랑 자체 일일 로직은 그대로 두고 완료 신호만 이 키로 남긴다.
 *   홈 오늘의 정원(garden.ts)은 말랑 칸을 현지 날짜로, 나머지를 UTC 날짜로 읽는다(D3). DECISIONS 11-20 R5.
 * - '끝냈다' = 말랑은 그날 8스테이지를 모두 지나감(dailyOver), 뿅·도토리는 Daily 모드 한 판이 끝남(연습 판은 세지 않음).
 * - 같은 날 여러 번 끝내면(뿅·도토리 Daily는 다시 할 수 있다) 기록은 primary가 더 높을 때만 바뀐다. 연속 기록은 하루 1번만 센다.
 *
 * 순수 함수 — 저장소를 주입받는다. 저장소가 던지거나 값이 깨져 있어도 던지지 않는다.
 */

export type DailyResult = {
  slug: string
  primary: { label: string; value: number }
  secondary?: { label: string; value: string }
  /** 이 게임을 연달아 끝낸 날 수(오늘 포함). */
  streak: number
  bloomed: boolean
}

/** 저장되는 모양 = DailyResult + 그 기록의 날짜. */
export type DoneRecord = DailyResult & { day: string }

export const DONE_PREFIX = 'garden:done:'
export const doneKey = (day: string, slug: string): string => `${DONE_PREFIX}${day}:${slug}`
/** 연속 기록(게임마다 1개): { last: 마지막으로 끝낸 날, n: 그날까지 연속 일수 }. */
export const streakKey = (slug: string): string => `garden:streak:${slug}`

/** 같은 탭 안에서 완료가 기록됐음을 알리는 이벤트(storage 이벤트는 다른 탭에만 간다). 헤더 pill이 듣는다. */
export const GARDEN_DONE_EVENT = 'garden:done'

/** 이만큼 지난 완료 기록은 쓸 때 지운다(정원은 오늘만, 연속은 streak 키가 따로 든다). */
export const DONE_KEEP_DAYS = 14

const DAY_MS = 86_400_000
const ISO = /^\d{4}-\d{2}-\d{2}$/

/** 'YYYY-MM-DD' ± n일(달력 날짜 계산이라 시간대와 무관). */
export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

function parse(raw: string | null): unknown {
  if (raw == null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** 저장값 → DoneRecord. 모양이 틀리면 null(손상·옛 형식은 '안 끝남'으로 본다). */
export function asDoneRecord(v: unknown, day: string, slug: string): DoneRecord | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const p = o.primary as Record<string, unknown> | undefined
  if (o.slug !== slug || o.day !== day || !p || typeof p.label !== 'string' || !isNum(p.value)) return null
  const s = o.secondary as Record<string, unknown> | undefined
  const secondary = s && typeof s.label === 'string' && typeof s.value === 'string' ? { label: s.label, value: s.value } : undefined
  return {
    slug,
    day,
    primary: { label: p.label, value: p.value },
    ...(secondary ? { secondary } : {}),
    streak: isNum(o.streak) && o.streak >= 1 ? Math.floor(o.streak) : 1,
    bloomed: true,
  }
}

export function readDone(storage: Pick<Storage, 'getItem'>, day: string, slug: string): DoneRecord | null {
  try {
    return asDoneRecord(parse(storage.getItem(doneKey(day, slug))), day, slug)
  } catch {
    return null
  }
}

/** 지금 연속 일수(오늘 또는 어제 끝냈으면 이어지는 중, 그보다 오래면 0). */
export function readStreak(storage: Pick<Storage, 'getItem'>, slug: string, day: string): number {
  try {
    const v = parse(storage.getItem(streakKey(slug))) as { last?: unknown; n?: unknown } | null
    if (!v || typeof v.last !== 'string' || !ISO.test(v.last) || !isNum(v.n) || v.n < 1) return 0
    return v.last === day || v.last === shiftDay(day, -1) ? Math.floor(v.n) : 0
  } catch {
    return 0
  }
}

/** 오늘 끝냈을 때의 연속 일수: 오늘 이미 셌으면 그대로, 어제 끝냈으면 +1, 아니면 1. */
export function nextStreak(prev: { last: string; n: number } | null, day: string): number {
  if (!prev) return 1
  if (prev.last === day) return Math.max(1, prev.n)
  if (prev.last === shiftDay(day, -1)) return prev.n + 1
  return 1
}

export type DoneInput = { slug: string; day: string; primary: DailyResult['primary']; secondary?: DailyResult['secondary'] }

/**
 * 완료를 기록하고 화면에 보일 DailyResult(이번 판 숫자 + 갱신된 연속)를 돌려준다.
 * 저장소를 못 써도 결과는 돌려준다(시트는 뜬다, 정원 칸만 안 핀다).
 */
export function recordDone(storage: Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'key' | 'removeItem' | 'length'>>, input: DoneInput): DailyResult {
  const { slug, day, primary, secondary } = input
  let streak = 1
  try {
    const raw = parse(storage.getItem(streakKey(slug))) as { last?: unknown; n?: unknown } | null
    const prev = raw && typeof raw.last === 'string' && ISO.test(raw.last) && isNum(raw.n) && raw.n >= 1 ? { last: raw.last, n: Math.floor(raw.n) } : null
    streak = nextStreak(prev, day)
    // 날짜를 거꾸로 돌린 기기(last가 오늘보다 뒤)는 연속을 덮어쓰지 않는다
    if (!prev || prev.last <= day) storage.setItem(streakKey(slug), JSON.stringify({ last: day, n: streak }))
    const old = readDone(storage, day, slug)
    if (!old || primary.value > old.primary.value) {
      const rec: DoneRecord = { slug, day, primary, ...(secondary ? { secondary } : {}), streak, bloomed: true }
      storage.setItem(doneKey(day, slug), JSON.stringify(rec))
    } else if (old.streak !== streak) {
      storage.setItem(doneKey(day, slug), JSON.stringify({ ...old, streak }))
    }
    pruneDone(storage, day)
  } catch {
    /* 저장소 막힘 — 결과만 돌려준다 */
  }
  return { slug, primary, ...(secondary ? { secondary } : {}), streak, bloomed: true }
}

/** DONE_KEEP_DAYS보다 오래된 완료 기록을 지운다(key·removeItem이 있는 저장소에서만). */
export function pruneDone(storage: Partial<Pick<Storage, 'key' | 'removeItem' | 'length'>>, today: string): void {
  if (typeof storage.key !== 'function' || typeof storage.removeItem !== 'function' || typeof storage.length !== 'number') return
  const cutoff = shiftDay(today, -DONE_KEEP_DAYS)
  const stale: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (!k || !k.startsWith(DONE_PREFIX)) continue
    const d = k.slice(DONE_PREFIX.length, DONE_PREFIX.length + 10)
    if (ISO.test(d) && d < cutoff) stale.push(k)
  }
  for (const k of stale) storage.removeItem(k)
}

/** 브라우저에서 기록 + 같은 탭 알림. 게임 컴포넌트가 쓴다. */
export function recordDoneInBrowser(input: DoneInput): DailyResult {
  let res: DailyResult = { slug: input.slug, primary: input.primary, ...(input.secondary ? { secondary: input.secondary } : {}), streak: 1, bloomed: true }
  try {
    res = recordDone(window.localStorage, input)
  } catch {
    /* localStorage 접근 자체가 막힘 */
  }
  try {
    window.dispatchEvent(new CustomEvent(GARDEN_DONE_EVENT, { detail: { slug: input.slug } }))
  } catch {
    /* 이벤트 실패는 무시 */
  }
  return res
}
