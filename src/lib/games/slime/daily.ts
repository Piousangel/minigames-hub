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
  /** 그은 선(좌표×2 정수 [x2,y2][]). 다음 스테이지의 고스트와 서버 재생 입력에 쓴다. 구 데이터에는 없다. */
  line?: number[][]
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

// ───────── 순차 해금 일일(오너 11-19): 1스테이지를 깨야 2스테이지가 열린다 ─────────
/** 하루 진행: 스테이지 순서대로의 시도 기록. progress[i] = i번째 스테이지의 시도들(최대 DAILY_ATTEMPTS). */
export type DailyProgress = Attempt[][]
export type StageState = 'locked' | 'open' | 'cleared' | 'failed'

export const emptyProgress = (total: number): DailyProgress => Array.from({ length: total }, () => [])

const clearedAt = (p: DailyProgress, i: number): boolean => (p[i] ?? []).some((a) => a.outcome === 'nest')
/** 시도 3번을 다 쓰고도 못 깼다 = 0점으로 지나간다(다음 스테이지는 열린다. 팀 종합 11-19: 막히면 이탈이 몰린다). */
const exhaustedAt = (p: DailyProgress, i: number): boolean => !clearedAt(p, i) && (p[i] ?? []).length >= DAILY_ATTEMPTS
const passedAt = (p: DailyProgress, i: number): boolean => clearedAt(p, i) || exhaustedAt(p, i)

/**
 * 스테이지 상태. 앞 스테이지를 지나가야 열린다(깼거나, 3번 다 쓰고 0점으로 포기). 3번 다 실패한 스테이지는 'failed'.
 */
export function stageState(p: DailyProgress, i: number): StageState {
  for (let k = 0; k < i; k++) if (!passedAt(p, k)) return 'locked'
  if (clearedAt(p, i)) return 'cleared'
  return (p[i] ?? []).length >= DAILY_ATTEMPTS ? 'failed' : 'open'
}

/** 지금 플레이할 스테이지 인덱스. 하루가 끝났으면(모든 스테이지를 지나갔으면) null. */
export function currentStage(p: DailyProgress): number | null {
  for (let i = 0; i < p.length; i++) if (stageState(p, i) === 'open') return i
  return null
}

/** 시도를 기록한다(불변). 열려 있지 않은 스테이지·이미 깬 스테이지·시도 소진 후의 기록은 무시한다. */
export function recordAttempt(p: DailyProgress, i: number, a: Attempt): DailyProgress {
  if (stageState(p, i) !== 'open') return p
  return p.map((list, k) => (k === i ? [...list, a] : list))
}

/** 하루 점수 = 스테이지별 최고점의 합. */
export const dailyTotal = (p: DailyProgress): number => p.reduce((sum, list) => sum + (bestOf(list)?.score ?? 0), 0)
export const clearedCount = (p: DailyProgress): number => p.filter((_, i) => clearedAt(p, i)).length
export const dailyOver = (p: DailyProgress): boolean => currentStage(p) === null
export const usedHint = (p: DailyProgress): boolean => p.some((l) => l.some((a) => a.hint))

/** 스포일러 없는 하루 공유 문구: 스테이지별 한 칸(🌟 별3 / ⭐ 도착 / 💥 막힘 / ⬜ 못 감). 경로는 담지 않는다. */
export function progressShareText(iso: string, p: DailyProgress, url = ''): string {
  const marks = p
    .map((list, i) => {
      const s = stageState(p, i)
      if (s === 'locked') return '⬜'
      const best = bestOf(list.filter((a) => a.outcome === 'nest'))
      if (!best) return list.length > 0 ? '💥' : '⬜' // 시도했지만 못 깼으면 💥, 열렸지만 아직 안 해 봤으면 ⬜
      return best.stars === 3 ? '🌟' : '⭐'
    })
    .join('')
  const head = `Slime Slide #${dailyNumber(iso)} · ${clearedCount(p)}/${p.length} stages · ${dailyTotal(p)} pts${usedHint(p) ? ' (used a hint)' : ''}`
  return [head, marks, url].filter(Boolean).join('\n')
}
