import { currentStreak, loadStreak } from './dailyStreak'
import { todayUTC } from './dailyDate'
import { loadPlayedToday } from './today'

/**
 * 목표(Goals) — "다음에 이룰 것"을 주어 계속 플레이하게 만드는 체류/재방문 장치(DOMAIN §2·§3).
 * 전부 기존 localStorage 신호에서 계산(신규 추적은 played:all 하나뿐). 무계정.
 * 각 목표는 누진 티어(예: 5→15→30)라 하나 달성하면 다음 티어가 새 목표가 된다.
 */
export interface Goal {
  id: string
  label: string
  icon: string
  tiers: number[]
  /** 현재 값(클라이언트에서 localStorage 읽어 계산). */
  value: () => number
}

function num(raw: string | null): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function distinctPlayed(): number {
  try {
    const arr = JSON.parse(localStorage.getItem('played:all') || '[]') as unknown
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

function totalWins(): number {
  let wins = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('stats:')) {
        const o = JSON.parse(localStorage.getItem(k) || '{}') as { wins?: number }
        if (typeof o.wins === 'number') wins += o.wins
      }
    }
  } catch {
    /* ignore */
  }
  return wins
}

export const GOALS: Goal[] = [
  { id: 'explorer', label: 'Explorer — play different games', icon: '🧭', tiers: [5, 15, 30], value: distinctPlayed },
  {
    id: 'streak',
    label: 'Streak — days in a row',
    icon: '🔥',
    tiers: [3, 7, 30],
    value: () => currentStreak(loadStreak('site:streak')),
  },
  {
    id: 'marathon',
    label: 'Marathon — games in one session',
    icon: '⚡',
    tiers: [5, 10, 20],
    value: () => {
      try {
        return num(sessionStorage.getItem('run:count'))
      } catch {
        return 0
      }
    },
  },
  { id: 'champion', label: 'Champion — games won', icon: '🏆', tiers: [10, 50, 150], value: totalWins },
  {
    id: 'daily-three',
    label: "Daily Three — different games today",
    icon: '🗓️',
    tiers: [3],
    value: () => {
      try {
        return loadPlayedToday(todayUTC()).length
      } catch {
        return 0
      }
    },
  },
]

export interface GoalState {
  value: number
  target: number // 다음 미달성 티어(전부 달성이면 마지막 티어)
  prev: number // 직전 티어(진척 바 시작점)
  tierIndex: number // 현재 달성한 티어 수
  complete: boolean // 모든 티어 달성
}

export function goalState(goal: Goal, value: number): GoalState {
  const tiers = goal.tiers
  let tierIndex = 0
  while (tierIndex < tiers.length && value >= tiers[tierIndex]) tierIndex++
  const complete = tierIndex >= tiers.length
  const target = complete ? tiers[tiers.length - 1] : tiers[tierIndex]
  const prev = tierIndex === 0 ? 0 : tiers[tierIndex - 1]
  return { value, target, prev, tierIndex, complete }
}
