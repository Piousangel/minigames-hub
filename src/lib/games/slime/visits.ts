/**
 * 말랑 미끄럼길 기기 단위 재방문 측정(순수 로직 + 얇은 저장소 접착).
 * 하루에 한 번만 쏘는 이벤트를 고른다 — AE에서 distinct vid로 세면 "오늘 시작한 기기 / 끝낸 기기 / 돌아온 기기" 퍼널이 된다.
 *   sl_daily_start    오늘 첫 시도가 기록됐다
 *   sl_daily_complete 오늘 일일이 끝났다(dailyOver가 참이 됨)
 *   sl_return         오늘 첫 시작 + 이 기기가 전에 다른 날 플레이했다. 간격 버킷 sl_return_d1 / _d2_7 / _d8p 를 같이 쏜다
 * 날짜는 todayLocal()의 'YYYY-MM-DD'(현지 자정 기준). 이 파일은 날짜를 직접 읽지 않는다.
 * 중복 방지는 localStorage 'slime:visit' = {lastDay, firedToday:{day, events[]}}.
 */

export const VISIT_KEY = 'slime:visit'
/** 이 키가 있으면 그날 플레이한 것(시도를 기록할 때만 저장된다). slime:visit이 생기기 전부터 놀던 기기의 마지막 날을 여기서 찾는다. */
export const DAILY_PREFIX = 'slime:daily2:'

export type VisitTrigger = 'start' | 'complete'
export type ReturnBucket = 'sl_return_d1' | 'sl_return_d2_7' | 'sl_return_d8p'

export interface VisitRecord {
  /** 마지막으로 일일을 시작한 날(오늘 시작했으면 오늘). 처음이면 null */
  lastDay: string | null
  /** 그날 이미 쏜 이벤트(다른 날이면 무시) */
  firedToday: { day: string; events: string[] }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const EMPTY: VisitRecord = { lastDay: null, firedToday: { day: '', events: [] } }

/** 저장값 해석. 깨졌거나 모양이 다르면 빈 기록. */
export function parseVisit(raw: string | null): VisitRecord {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<VisitRecord> | null
    if (!v || typeof v !== 'object') return EMPTY
    const lastDay = typeof v.lastDay === 'string' && ISO.test(v.lastDay) ? v.lastDay : null
    const f = v.firedToday
    const firedToday =
      f && typeof f.day === 'string' && Array.isArray(f.events) ? { day: f.day, events: f.events.filter((e): e is string => typeof e === 'string') } : EMPTY.firedToday
    return { lastDay, firedToday }
  } catch {
    return EMPTY
  }
}

/** from→to 날짜 차(일). 'YYYY-MM-DD'를 UTC 자정으로 읽어 DST와 무관하게 센다. */
export const dayGap = (from: string, to: string): number => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000)

export function returnBucket(gap: number): ReturnBucket {
  if (gap <= 1) return 'sl_return_d1'
  if (gap <= 7) return 'sl_return_d2_7'
  return 'sl_return_d8p'
}

/** 저장소 키 목록에서 오늘 이전의 마지막 플레이 날(없으면 null). */
export function lastDayFromKeys(keys: readonly string[], today: string): string | null {
  let best: string | null = null
  for (const k of keys) {
    if (!k.startsWith(DAILY_PREFIX)) continue
    const d = k.slice(DAILY_PREFIX.length)
    if (ISO.test(d) && d < today && (best === null || d > best)) best = d
  }
  return best
}

/**
 * 이번 계기(trigger)에 쏠 이벤트와 갱신된 기록. 같은 날 같은 이벤트는 다시 고르지 않는다.
 * fallbackLastDay: 기록에 lastDay가 없을 때 쓸 과거 플레이 날(lastDayFromKeys 결과).
 */
export function visitEvents(rec: VisitRecord, today: string, trigger: VisitTrigger, fallbackLastDay: string | null = null): { events: string[]; next: VisitRecord } {
  const already = rec.firedToday.day === today ? rec.firedToday.events : []
  const head = trigger === 'start' ? 'sl_daily_start' : 'sl_daily_complete'
  if (already.includes(head)) return { events: [], next: rec }

  const events = [head]
  let lastDay = rec.lastDay
  if (trigger === 'start') {
    const prev = rec.lastDay ?? fallbackLastDay
    const gap = prev ? dayGap(prev, today) : 0
    if (gap >= 1) events.push('sl_return', returnBucket(gap))
    lastDay = today
  }
  // complete는 lastDay를 건드리지 않는다 — 시작 없이 완료만 잡힌 날(배포 전 진행분)에 오늘을 적으면 그날 늦게 쏠 시작의 재방문 판정이 지워진다
  return { events, next: { lastDay, firedToday: { day: today, events: [...already, ...events] } } }
}

/** localStorage 모양의 최소 인터페이스(테스트에서 가짜로 갈아 끼운다). */
export interface VisitStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  readonly length: number
  key(index: number): string | null
}

/**
 * 저장소를 읽어 쏠 이벤트를 고르고 기록을 저장한다. 저장소를 못 쓰면 []를 돌려준다(측정 실패가 판을 막지 않게).
 * 저장을 못 하면 중복 방지가 안 되므로 그때도 쏘지 않는다.
 */
export function trackVisit(storage: VisitStorage, today: string, trigger: VisitTrigger): string[] {
  try {
    const rec = parseVisit(storage.getItem(VISIT_KEY))
    let fallback: string | null = null
    if (trigger === 'start' && rec.lastDay === null) {
      const keys: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i)
        if (k) keys.push(k)
      }
      fallback = lastDayFromKeys(keys, today)
    }
    const { events, next } = visitEvents(rec, today, trigger, fallback)
    if (events.length) storage.setItem(VISIT_KEY, JSON.stringify(next))
    return events
  } catch {
    return []
  }
}
