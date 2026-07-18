import { gamePages } from '@/lib/games/registry'

/**
 * "오늘" 메타 — 사이트 전역 데일리 퀘스트("오늘 3게임")와 오늘의 픽.
 * 사이트 전역 day-streak은 dailyStreak.ts('site:streak' 키)를 그대로 쓴다.
 *
 * 퀘스트 키에 UTC 날짜를 박아 자정에 자연 리셋 → 청소 로직 불필요.
 * 오늘의 픽은 날짜 시드로 파생하는 순수 함수라 저장하지 않는다(브라우저마다 동일).
 */

export const QUEST_TARGET = 3

export function questKey(date: string): string {
  return `quest:${date}`
}

/** 오늘 플레이한 distinct slug 목록. */
export function loadPlayedToday(date: string): string[] {
  try {
    const raw = localStorage.getItem(questKey(date))
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** 오늘 플레이 기록(중복 없음). */
export function markPlayed(date: string, slug: string): void {
  try {
    const list = loadPlayedToday(date)
    if (list.includes(slug)) return
    localStorage.setItem(questKey(date), JSON.stringify([...list, slug]))
  } catch {
    /* localStorage 불가 무시 */
  }
}

// -- 오늘의 픽 (날짜 시드 결정론 추첨) --

function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 날짜(YYYY-MM-DD) 기준 distinct N개 게임 slug를 결정론 추첨. 순수 — 모든 브라우저 동일,
 * 매일 회전(롱테일 게임 노출). date를 주입받아 테스트 가능.
 */
export function pickDailyPicks(date: string, n = QUEST_TARGET): string[] {
  const pool = gamePages.map((g) => g.slug)
  const rng = mulberry32(hashSeed(date))
  const out: string[] = []
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}
