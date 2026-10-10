import { describe, it, expect, vi, beforeEach } from 'vitest'
import { goalState, GOALS, nearestGoalHint, totalWins, type Goal } from './achievements'

const g: Goal = { id: 't', label: 't', icon: '⭐', tiers: [5, 15, 30], value: () => 0 }

describe('goalState (누진 티어)', () => {
  it('0이면 첫 티어가 목표', () => {
    expect(goalState(g, 0)).toEqual({ value: 0, target: 5, prev: 0, tierIndex: 0, complete: false })
  })
  it('첫 티어 달성 시 다음 티어로', () => {
    expect(goalState(g, 5)).toMatchObject({ target: 15, prev: 5, tierIndex: 1, complete: false })
  })
  it('중간 값은 현재 티어 구간', () => {
    expect(goalState(g, 20)).toMatchObject({ target: 30, prev: 15, tierIndex: 2, complete: false })
  })
  it('마지막 티어 달성 시 complete', () => {
    // complete면 위젯이 100%로 그리므로 prev/target 세부는 표시에 영향 없음.
    expect(goalState(g, 30)).toMatchObject({ target: 30, tierIndex: 3, complete: true })
    expect(goalState(g, 999).complete).toBe(true)
  })
  it('단일 티어 목표도 처리', () => {
    const single: Goal = { ...g, tiers: [3] }
    expect(goalState(single, 2)).toMatchObject({ target: 3, complete: false })
    expect(goalState(single, 3).complete).toBe(true)
  })
})

describe('GOALS 정의', () => {
  it('목표가 하나 이상, 티어는 오름차순', () => {
    expect(GOALS.length).toBeGreaterThan(0)
    for (const goal of GOALS) {
      expect(goal.tiers.length).toBeGreaterThan(0)
      for (let i = 1; i < goal.tiers.length; i++) expect(goal.tiers[i]).toBeGreaterThan(goal.tiers[i - 1])
      expect(goal.label.length).toBeGreaterThan(0)
    }
  })
  it('goal id 고유', () => {
    expect(new Set(GOALS.map((x) => x.id)).size).toBe(GOALS.length)
  })
})

describe('nearestGoalHint (게임오버 넛지)', () => {
  function mockStore(entries: Record<string, string>) {
    const keys = Object.keys(entries)
    const store = {
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => entries[k] ?? null,
      setItem: () => {},
      removeItem: () => {},
    }
    vi.stubGlobal('localStorage', store)
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {} })
  }
  beforeEach(() => vi.unstubAllGlobals())

  it('승수가 다음 티어에 1개 모자라면 Champion 넛지', () => {
    mockStore({ 'stats:x': JSON.stringify({ plays: 20, wins: 9 }) }) // champion tier1=10 → 1 남음
    const h = nearestGoalHint()
    expect(h?.text).toBe('1 more win for Champion')
    expect(h?.icon).toBe('🏆')
  })
  it('maxAway 밖이면 null (전부 0, maxAway 2)', () => {
    mockStore({}) // 전부 0 → 가장 가까운 게 daily-three(3 남음). maxAway 2면 제외 → null.
    expect(nearestGoalHint(2)).toBeNull()
  })
})

describe('totalWins (Champion)', () => {
  function mockStore(entries: Record<string, string>) {
    const keys = Object.keys(entries)
    vi.stubGlobal('localStorage', {
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => entries[k] ?? null,
    })
  }
  beforeEach(() => vi.unstubAllGlobals())

  it('회귀: 레거시 승수(예전 endless won:true 관례)도 합산 — 이미 달성한 Champion 단계를 되돌리지 않는다', () => {
    mockStore({
      'stats:minesweeper': JSON.stringify({ plays: 10, wins: 4 }),
      'stats:chess': JSON.stringify({ plays: 3, wins: 2 }),
      'stats:snake': JSON.stringify({ plays: 50, wins: 50 }), // 예전 won:true 관례로 부푼 값
      'stats:reaction-time': JSON.stringify({ plays: 7, wins: 7 }),
      'best:minesweeper': '123', // stats: 접두사 아님 → 무시
    })
    expect(totalWins()).toBe(63)
  })

  it('Champion 목표 값이 totalWins다', () => {
    mockStore({ 'stats:snake': JSON.stringify({ plays: 9, wins: 9 }) })
    expect(GOALS.find((g) => g.id === 'champion')?.value()).toBe(9)
  })
})

describe('nearestGoalHint excludeUnits', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('endless 게임 오버레이용: 1승 남은 Champion도 win 단위를 빼면 넛지되지 않는다', () => {
    const entries: Record<string, string> = { 'stats:chess': JSON.stringify({ plays: 9, wins: 9 }) }
    const keys = Object.keys(entries)
    vi.stubGlobal('localStorage', {
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => entries[k] ?? null,
    })
    expect(nearestGoalHint(1)?.text).toBe('1 more win for Champion')
    expect(nearestGoalHint(1, { excludeUnits: ['win'] })?.text ?? '').not.toMatch(/win/)
  })
})
