/** 말랑 미끄럼길 일일 구조(순수 로직). 하루 1스테이지, 시도 3회, 최고점 제출, 결과 공유 문구. */
import type { Outcome } from './types'

export const DAILY_ATTEMPTS = 3
/** 일일 #1 = 출시일(UTC). 뿅 착지와 같은 방식으로 번호를 센다. */
export const DAILY_EPOCH = Date.UTC(2026, 10, 20)

export const dailyNumber = (iso: string): number => Math.max(1, Math.floor((Date.parse(iso + 'T00:00:00Z') - DAILY_EPOCH) / 86_400_000) + 1)

/** 오늘의 스테이지 인덱스. 풀이 N개면 N일 주기로 돈다(스테이지가 늘면 같은 날짜의 결과가 바뀌므로 추가는 풀 끝에만 한다). */
export const stageIndexForDay = (iso: string, poolSize: number): number => (dailyNumber(iso) - 1) % Math.max(1, poolSize)

export interface Attempt {
  outcome: Outcome
  stars: number // 0~3
  score: number // 도착이 아니면 0
  hint: boolean // 추천 길을 본 뒤의 시도인가(공유·순위에서 구분)
}

/** 점수 = 별 × 100 + 남긴 잉크 %(0~100). 도착하지 못하면 0. */
export function scoreOf(outcome: Outcome, stars: number, inkUsed: number, inkMax: number): number {
  if (outcome !== 'nest') return 0
  return stars * 100 + Math.max(0, Math.min(100, Math.round((100 * (inkMax - inkUsed)) / inkMax)))
}

export const bestOf = (attempts: Attempt[]): Attempt | null => attempts.reduce<Attempt | null>((b, a) => (a.score > (b?.score ?? -1) ? a : b), null)

export const attemptsLeft = (attempts: Attempt[]): number => Math.max(0, DAILY_ATTEMPTS - attempts.length)

/** 오늘 끝났는가: 3번 썼거나, 별 3개로 도착했다(더 올릴 여지가 잉크뿐이라도 3회까지 계속할 수 있게 하려면 false로 둔다). */
export const dailyDone = (attempts: Attempt[]): boolean => attempts.length >= DAILY_ATTEMPTS

const MARK = (a: Attempt): string => (a.outcome === 'nest' ? (a.stars === 3 ? '🌟' : a.stars > 0 ? '⭐' : '🌼') : '💥')

/** 스포일러 없는 공유 문구(경로는 담지 않는다). 힌트를 봤으면 표시. */
export function shareText(iso: string, attempts: Attempt[], url: string): string {
  const best = bestOf(attempts)
  const head = `Slime Slide #${dailyNumber(iso)}`
  const marks = attempts.map(MARK).join('')
  const hinted = attempts.some((a) => a.hint) ? ' (used a hint)' : ''
  const tail = best && best.score > 0 ? `${'⭐'.repeat(best.stars)}${'☆'.repeat(3 - best.stars)} ${best.score} pts` : 'No landing yet'
  return [`${head} ${tail}${hinted}`, `${marks} ${attempts.length}/${DAILY_ATTEMPTS}`, url].filter(Boolean).join('\n')
}
