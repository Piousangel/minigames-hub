import { describe, it, expect } from 'vitest'
import { goalState, GOALS, type Goal } from './achievements'

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
