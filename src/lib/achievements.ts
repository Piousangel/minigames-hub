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
  /** 게임오버 넛지용 단위(예: 'win'). 지금 바로 늘릴 수 있는 목표만 지정(streak 제외 = undefined). */
  unit?: string
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
  { id: 'explorer', label: 'Explorer — play different games', icon: '🧭', tiers: [5, 15, 30], value: distinctPlayed, unit: 'game' },
  {
    id: 'streak',
    label: 'Streak — days in a row',
    icon: '🔥',
    tiers: [3, 7, 30],
    value: () => currentStreak(loadStreak('site:streak')),
    // streak은 지금 당장 늘릴 수 없음(다음 날) → 게임오버 넛지에서 제외.
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
    unit: 'game',
  },
  { id: 'champion', label: 'Champion — games won', icon: '🏆', tiers: [10, 50, 150], value: totalWins, unit: 'win' },
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
    unit: 'game',
  },
]

/**
 * 게임오버 넛지: 지금 바로 늘릴 수 있는 목표 중, 다음 티어까지 1~maxAway개 남은 가장 가까운 것을
 * "N more win(s) for Champion" 식으로. 없으면 null. (streak처럼 unit 없는 목표는 제외.)
 */
export function nearestGoalHint(maxAway = 3): { text: string; icon: string } | null {
  let best: { remaining: number; text: string; icon: string } | null = null
  for (const g of GOALS) {
    if (!g.unit) continue
    const st = goalState(g, g.value())
    if (st.complete) continue
    const remaining = st.target - st.value
    if (remaining <= 0 || remaining > maxAway) continue
    if (!best || remaining < best.remaining) {
      const [name] = g.label.split(' — ')
      const unit = remaining === 1 ? g.unit : `${g.unit}s`
      best = { remaining, text: `${remaining} more ${unit} for ${name}`, icon: g.icon }
    }
  }
  return best ? { text: best.text, icon: best.icon } : null
}

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
