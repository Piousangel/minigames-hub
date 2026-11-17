/**
 * 플레이 기록 저장. 토스 Storage(앱을 지워도 유지되는 네이티브 저장소)에 사용자 식별키별로 JSON 한 덩어리로 둔다.
 * 시작할 때 한 번 읽고, 판이 끝날 때 한 번 쓴다(브릿지 과다 호출 방지).
 */
import { getUserKey, kv } from './toss'

export interface Save {
  best: number
  /** 오늘 데일리를 처음 끝낸 날(KST yyyy-mm-dd). 같은 날 재도전은 최고기록에 넣지 않는다. */
  dailyTriedDay: string | null
  /** 데일리 성공 기록 */
  streak: number
  lastClearDay: string | null
  /** 오늘 데일리 첫 판 점수 */
  dailyScore: number | null
  muted: boolean
  seenHowTo: boolean
  plays: number
}

const EMPTY: Save = {
  best: 0,
  dailyTriedDay: null,
  streak: 0,
  lastClearDay: null,
  dailyScore: null,
  muted: false,
  seenHowTo: false,
  plays: 0,
}

let key = 'recoil:save:local'
let cache: Save = { ...EMPTY }

export async function loadSave(): Promise<Save> {
  const user = await getUserKey()
  key = `recoil:save:${user}`
  try {
    const raw = await kv.get(key)
    if (raw) cache = { ...EMPTY, ...(JSON.parse(raw) as Partial<Save>) }
  } catch {
    cache = { ...EMPTY }
  }
  return cache
}

export function getSave(): Save {
  return cache
}

export async function updateSave(patch: Partial<Save>): Promise<Save> {
  cache = { ...cache, ...patch }
  await kv.set(key, JSON.stringify(cache))
  return cache
}

/** 한국 시간 기준 오늘(yyyy-mm-dd). 토스 사용자는 국내라 데일리 경계를 KST 자정으로 둔다. */
export function todayKST(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10)
}

export function yesterdayKST(now = Date.now()): string {
  return todayKST(now - 86400_000)
}

/** 오늘 데일리를 깼을 때의 연속 기록 */
export function nextStreak(s: Save, today: string): number {
  if (s.lastClearDay === today) return s.streak
  if (s.lastClearDay === yesterdayKST(Date.parse(today + 'T12:00:00+09:00'))) return s.streak + 1
  return 1
}

/** 화면에 보여줄 현재 연속 기록(어제나 오늘 깬 기록이 없으면 0) */
export function liveStreak(s: Save, today: string): number {
  if (s.lastClearDay === today) return s.streak
  if (s.lastClearDay === yesterdayKST(Date.parse(today + 'T12:00:00+09:00'))) return s.streak
  return 0
}
