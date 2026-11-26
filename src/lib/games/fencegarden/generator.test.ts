import { describe, expect, it } from 'vitest'
import { HOP_PROTO_PUZZLES, applyMove, hopGoal, initialState, legalMoves, solveHop, type HopPuzzle } from './engine'
import { GATE, generateHop, gradeHop, passesGate, summarize } from './generator'

describe('꽃담 G2 생성기', () => {
  it('같은 시드 2회 → 같은 판, 다른 시드 → 대체로 다른 판', () => {
    for (const seed of [1, 7, 42, 2026]) expect(generateHop(seed)).toEqual(generateHop(seed))
    const keys = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify({ ...generateHop(i), id: '' })))
    expect(keys.size).toBeGreaterThan(25)
  })

  it('만든 판은 규칙에 맞다: 칸이 겹치지 않고, 시작부터 목표가 아니고, 고정 울타리는 판 안', () => {
    for (let seed = 0; seed < 40; seed++) {
      const p = generateHop(seed)
      const cells = [p.start, ...p.flowers, ...p.weeds]
      expect(new Set(cells).size, `seed ${seed}`).toBe(cells.length)
      expect(p.weeds.length).toBeGreaterThan(0)
      expect(p.flowers.length).toBeGreaterThan(0)
      for (const c of cells) expect(c >= 0 && c < p.n * p.n).toBe(true)
      for (const e of p.fixed) expect(e >= 0 && e < 2 * p.n * (p.n - 1)).toBe(true)
      expect(hopGoal(p, initialState(p)), `seed ${seed}`).toBe(false)
    }
  })

  it('손으로 푼 고정 판 3개: gradeHop의 최소 턴·울타리 집합이 손 풀이와 같다', () => {
    // p1 1턴(빈 칸 하나 메우기) · p2 3턴(모서리 두 변 + 거리) · p3 3턴(순서 퍼즐, 집합 1)
    const hand: Record<string, [number, number]> = { 'p1-split': [1, 1], 'p2-corner': [3, 12], 'p3-order': [3, 1] }
    for (const p of HOP_PROTO_PUZZLES) {
      const g = gradeHop(p, { botTrials: 50, botSeed: 3 })
      expect([g.min, g.fenceSetsAtMin], p.id).toEqual(hand[p.id])
    }
  })

  it('gradeHop은 턴 한도를 최소 + 2로 다시 매긴 판을 돌려주고, 그 판의 해 수순이 실제로 통한다', () => {
    for (let seed = 0; seed < 8; seed++) {
      const g = gradeHop(generateHop(seed), { botTrials: 30, botSeed: 1 })
      if (g.min === null) continue
      expect(g.puzzle.turns).toBe(g.min + 2)
      let s = initialState(g.puzzle)
      for (const m of g.line!) {
        expect(legalMoves(g.puzzle, s)).toContainEqual(m)
        s = applyMove(s, m)
      }
      expect(hopGoal(g.puzzle, s)).toBe(true)
    }
  })

  it('봇 해결률은 고정 시드에서 재현된다(1,000회 기준과 같은 경로)', () => {
    const p = generateHop(5)
    const a = gradeHop(p, { botTrials: 1000, botSeed: 9 })
    const b = gradeHop(p, { botTrials: 1000, botSeed: 9 })
    expect(a.bot).toBe(b.bot)
  })

  it('합격선: 최소 턴 ≥3 · 집합 ≤3 · 봇 <20% — 경계값', () => {
    expect(GATE).toEqual({ minTurns: 3, maxSets: 3, maxBot: 0.2, passRatio: 0.1 })
    const base = { min: 3, fenceSetsAtMin: 3, bot: 0.199 }
    expect(passesGate(base)).toBe(true)
    expect(passesGate({ ...base, min: 2 })).toBe(false)
    expect(passesGate({ ...base, min: null })).toBe(false)
    expect(passesGate({ ...base, fenceSetsAtMin: 4 })).toBe(false)
    expect(passesGate({ ...base, bot: 0.2 })).toBe(false)
    // 순서 퍼즐 p3도 봇이 절반 넘게 풀어 탈락해야 한다(리뷰 11-20 지적 11)
    const p3 = HOP_PROTO_PUZZLES[2]
    expect(passesGate(gradeHop(p3, { botTrials: 400, botSeed: 11 }))).toBe(false)
  })

  it('합격 판은 렌더 없이 데이터만으로 최소 턴을 싣는다(프로토의 동기 솔버 제거 근거)', () => {
    for (const p of HOP_PROTO_PUZZLES) expect(p.min, p.id).toBe(solveHop(p).min)
    const g = gradeHop(generateHop(3), { botTrials: 10, botSeed: 1 })
    const p: HopPuzzle = g.puzzle
    expect(p.min ?? null).toBe(g.min)
  })

  it('분포 요약은 합격 비율과 판정을 낸다', () => {
    const rows = [
      { min: 3, fenceSetsAtMin: 1, bot: 0.05 },
      { min: 1, fenceSetsAtMin: 1, bot: 0.9 },
      { min: null, fenceSetsAtMin: 0, bot: 0 },
      { min: 4, fenceSetsAtMin: 2, bot: 0.1 },
    ]
    const s = summarize(rows)
    expect(s.total).toBe(4)
    expect(s.passed).toBe(2)
    expect(s.ratio).toBe(0.5)
    expect(s.verdict).toBe('G3')
    expect(s.minHist).toEqual({ '1': 1, '3': 1, '4': 1, 'none': 1 })
    expect(summarize([rows[1]]).verdict).toBe('below')
  })
})
