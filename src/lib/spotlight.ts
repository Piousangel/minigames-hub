import { gamePages } from '@/lib/games/registry'
import { gameMeta } from '@/lib/games/gameMeta'
import { hashSeed, mulberry32 } from '@/lib/today'
import { MILLISECONDS_PER_DAY } from '@/lib/dailyStreak'

/**
 * "내일의 스포트라이트" 선정 — 날짜만으로 하루 한 게임을 고르는 순수 함수들.
 * 서버·저장소가 없어도 모든 브라우저가 같은 날 같은 게임을 얻는다.
 *
 * 풀(N개)을 N일 한 주기로 돌린다: 주기마다 시드 셔플한 순열을 하루씩 소비하므로
 * 정렬된 한 주기 안에서는 모든 게임이 정확히 한 번 나온다. 주기가 바뀔 때 전날과
 * 같은 게임이 이어지면 새 순열의 첫째·둘째를 맞바꾼다(N ≥ 3 에서만 보장).
 * 알려진 한계: 풀 크기가 바뀌면(데일리 게임 추가) 그날부터 순열이 달라진다.
 */

/** 'YYYY-MM-DD'(UTC) → 1970-01-01부터의 일수. 형식이 틀리거나 없는 날짜면 null. */
export function dayNumberUTC(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const milliseconds = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(milliseconds)) return null
  // 2026-02-30처럼 달력에 없는 날짜가 다음 달로 넘어가 파싱되는 경우를 걸러낸다.
  if (new Date(milliseconds).toISOString().slice(0, 10) !== date) return null
  return Math.floor(milliseconds / MILLISECONDS_PER_DAY)
}

/** 주기 번호를 시드로 한 Fisher–Yates 셔플(입력은 정렬된 풀). */
function shuffledCycle(sortedPool: readonly string[], cycleIndex: number): string[] {
  const random = mulberry32(hashSeed(`spotlight:${cycleIndex}`))
  const shuffled = [...sortedPool]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function cyclePermutation(sortedPool: readonly string[], cycleIndex: number): string[] {
  const permutation = shuffledCycle(sortedPool, cycleIndex)
  if (cycleIndex > 0 && sortedPool.length >= 3) {
    // 직전 주기의 맞바꿈은 인덱스 0·1만 건드리므로 마지막 원소는 원본 순열과 같다.
    const previousLast = shuffledCycle(sortedPool, cycleIndex - 1)[sortedPool.length - 1]
    if (permutation[0] === previousLast) {
      ;[permutation[0], permutation[1]] = [permutation[1], permutation[0]]
    }
  }
  return permutation
}

export function pickSpotlight(date: string, pool: readonly string[]): string | null {
  const dayNumber = dayNumberUTC(date)
  const sortedPool = [...new Set(pool)].sort()
  if (dayNumber === null || sortedPool.length === 0) return null
  const poolSize = sortedPool.length
  const cycleIndex = Math.floor(dayNumber / poolSize)
  const positionInCycle = ((dayNumber % poolSize) + poolSize) % poolSize
  return cyclePermutation(sortedPool, cycleIndex)[positionInCycle]
}

/** 데일리 모드가 있는 게임 slug(registry 순서). */
export function dailyGameSlugs(): string[] {
  return gamePages.map((page) => page.slug).filter((slug) => gameMeta[slug]?.daily === true)
}

export function spotlightFor(date: string): string | null {
  return pickSpotlight(date, dailyGameSlugs())
}
