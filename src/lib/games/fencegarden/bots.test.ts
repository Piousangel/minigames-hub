import { describe, expect, it } from 'vitest'
import { HOP_PROTO_PUZZLES, applyMove, hopGoal, initialState, legalMoves, mulberry32 } from './engine'
import { botRate, runBot, weedPressure, type BotKind } from './bots'
import { FENCE_SET_SEEDS, SET_SIZE, difficultyOrder, generateHop, gradeHop, orderIssues, passesGate, pickSet, type SetRow } from './generator'

const KINDS: BotKind[] = ['random', 'greedy']

describe('꽃담 G3-1 봇', () => {
  it('오답 검사: 최소 턴을 아는 손 풀이 판 3개에서 어느 봇도 최소 턴보다 적은 턴에 풀지 못하고, 수는 모두 합법', () => {
    for (const p of HOP_PROTO_PUZZLES) {
      for (const kind of KINDS) {
        const rnd = mulberry32(5)
        for (let i = 0; i < 300; i++) {
          const run = runBot(p, kind, rnd)
          let s = initialState(p)
          for (const m of run.line) {
            expect(legalMoves(p, s), `${p.id} ${kind}`).toContainEqual(m)
            s = applyMove(s, m)
          }
          expect(hopGoal(p, s), `${p.id} ${kind}`).toBe(run.won)
          expect(run.turns).toBeLessThanOrEqual(p.turns)
          if (run.won) expect(run.turns, `${p.id} ${kind}`).toBeGreaterThanOrEqual(p.min!)
        }
      }
    }
  })

  it('오답 검사: 같은 시드 두 번 → 같은 성공률(두 봇 모두)', () => {
    for (const p of HOP_PROTO_PUZZLES) {
      for (const kind of KINDS) expect(botRate(p, kind, 200, 7)).toBe(botRate(p, kind, 200, 7))
    }
  })

  it('한 수 앞 봇은 1턴 판(p1)을 늘 1턴에 푼다 — 끝내는 수를 놓치지 않는다', () => {
    const p1 = HOP_PROTO_PUZZLES[0]
    expect(botRate(p1, 'greedy', 50, 1)).toBe(1)
    const rnd = mulberry32(2)
    for (let i = 0; i < 20; i++) expect(runBot(p1, 'greedy', rnd).turns).toBe(1)
  })

  it('weedPressure: 시작 상태는 양수, 목표 상태는 0', () => {
    for (const p of HOP_PROTO_PUZZLES) {
      expect(weedPressure(p, initialState(p))).toBeGreaterThan(0)
      const run = runBot(p, 'greedy', mulberry32(3))
      if (run.won) {
        let s = initialState(p)
        for (const m of run.line) s = applyMove(s, m)
        expect(weedPressure(p, s)).toBe(0)
      }
    }
  })
})

describe('꽃담 G3-1 12판 세트', () => {
  const row = (seed: number, min: number, greedy: number, sets = 1): SetRow => ({ seed, min, sets, planless: 0, random: 0, greedy })

  it('오답 검사: 최소 턴이 앞 판보다 2 이상 줄면 순서 역전으로 잡는다', () => {
    expect(orderIssues([{ min: 3 }, { min: 4 }, { min: 4 }, { min: 3 }])).toEqual([])
    expect(orderIssues([{ min: 3 }, { min: 5 }, { min: 3 }])).toEqual(['2→3'])
  })

  it('pickSet: 12판, 쉬움 → 어려움 순서가 difficultyOrder와 같고 역전 없음', () => {
    const rows = Array.from({ length: 29 }, (_, i) => row(i + 1, 3 + (i % 2), ((i * 37) % 25) / 100, 1 + (i % 3)))
    const set = pickSet(rows)
    expect(set).toHaveLength(SET_SIZE)
    expect(new Set(set.map((r) => r.seed)).size).toBe(SET_SIZE)
    expect([...set].sort(difficultyOrder)).toEqual(set)
    expect(orderIssues(set)).toEqual([])
  })

  it('저장된 세트는 시드 12개뿐이고, 각 시드는 지금 생성기로도 G2 관문을 통과하며 최소 턴 순서에 역전이 없다', () => {
    expect(FENCE_SET_SEEDS).toHaveLength(SET_SIZE)
    expect(new Set(FENCE_SET_SEEDS).size).toBe(SET_SIZE)
    const mins: { min: number }[] = []
    for (const seed of FENCE_SET_SEEDS) {
      // 관문의 최소 턴·집합은 솔버(결정적). 봇 값은 시드 7·1,000회 측정값과 같은 경로라 시도 수를 줄이지 않는다.
      const g = gradeHop(generateHop(seed), { botTrials: 1000, botSeed: 7 })
      expect(passesGate(g), `seed ${seed}`).toBe(true)
      mins.push({ min: g.min! })
    }
    expect(orderIssues(mins)).toEqual([])
  }, 60_000)
})

describe('꽃담 G3-1 pickSet 규칙', () => {
  const row = (seed: number, min: number, greedy: number): SetRow => ({ seed, min, sets: 1, planless: 0, random: 0, greedy })

  it('한 수 앞 봇 25% 이상인 판은 빼고, 단계가 모자라면 남은 몫을 뒤 단계가 받는다', () => {
    const rows = [row(1, 3, 0.9), row(2, 3, 0.1), row(3, 3, 0.05), ...Array.from({ length: 20 }, (_, i) => row(10 + i, 4, i / 100))]
    const set = pickSet(rows)
    expect(set.map((r) => r.seed)).not.toContain(1)
    expect(set).toHaveLength(SET_SIZE)
    expect(set.filter((r) => r.min === 3).map((r) => r.seed)).toEqual([2, 3])
    expect(set.filter((r) => r.min === 4)).toHaveLength(10)
  })
})
