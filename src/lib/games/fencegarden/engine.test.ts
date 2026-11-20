import { describe, expect, it } from 'vitest'
import {
  distToEdge,
  edgeCells,
  edgeCount,
  edgeSegment,
  evaluate,
  hEdge,
  hitEdge,
  hitStats,
  regions,
  solve,
  syntheticTaps,
  vEdge,
  type Puzzle,
  HOP_PROTO_PUZZLES,
  applyMove,
  cellSides,
  hopGoal,
  initialState,
  legalMoves,
  reachable,
  solveHop,
  type HopPuzzle,
} from './engine'

describe('울타리 번호', () => {
  it('5×5 안쪽 울타리는 40개이고 id가 겹치지 않는다', () => {
    const n = 5
    expect(edgeCount(n)).toBe(40)
    const ids = new Set<number>()
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) ids.add(hEdge(n, r, c))
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) ids.add(vEdge(n, r, c))
    expect(ids.size).toBe(40)
    expect(Math.max(...ids)).toBe(39)
  })
  it('선분과 가르는 칸이 서로 맞다', () => {
    const n = 5
    for (let e = 0; e < edgeCount(n); e++) {
      const s = edgeSegment(n, e)
      const [a, b] = edgeCells(n, e)
      const mid = { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 }
      const ca = { x: (a % n) + 0.5, y: Math.floor(a / n) + 0.5 }
      const cb = { x: (b % n) + 0.5, y: Math.floor(b / n) + 0.5 }
      // 선분 가운데는 두 칸 중심의 가운데
      expect((ca.x + cb.x) / 2).toBeCloseTo(mid.x)
      expect((ca.y + cb.y) / 2).toBeCloseTo(mid.y)
    }
  })
})

describe('영역', () => {
  it('울타리가 없으면 한 영역', () => {
    const reg = regions(5, new Set())
    expect(new Set(reg).size).toBe(1)
  })
  it('가로 한 줄을 다 막으면 두 영역(위 10칸·아래 15칸)', () => {
    const n = 5
    const f = new Set(Array.from({ length: n }, (_, c) => hEdge(n, 1, c)))
    const reg = regions(n, f)
    expect(new Set(reg).size).toBe(2)
    expect(reg.filter((x) => x === reg[0]).length).toBe(10)
  })
  it('모서리 칸은 울타리 2개로 갇힌다', () => {
    const n = 5
    const reg = regions(n, new Set([hEdge(n, 0, 0), vEdge(n, 0, 0)]))
    expect(reg.filter((x) => x === reg[0]).length).toBe(1)
  })
})

describe('터치 판정', () => {
  const n = 5
  it('선 위를 정확히 누르면 두 방식 모두 그 울타리', () => {
    for (let e = 0; e < edgeCount(n); e++) {
      const s = edgeSegment(n, e)
      const x = (s.x1 + s.x2) / 2
      const y = (s.y1 + s.y2) / 2
      expect(hitEdge(n, x, y, { kind: 'nearest' })).toBe(e)
      expect(hitEdge(n, x, y, { kind: 'strip', tol: 0.15 })).toBe(e)
    }
  })
  it('칸 한가운데는 strip이면 헛탭, nearest면 안쪽 울타리 하나', () => {
    expect(hitEdge(n, 2.5, 2.5, { kind: 'strip', tol: 0.3 })).toBeNull()
    expect(hitEdge(n, 2.5, 2.5, { kind: 'nearest' })).not.toBeNull()
  })
  it('칸 오른쪽 가장자리 근처는 nearest가 오른쪽 세로 울타리', () => {
    expect(hitEdge(n, 1.8, 0.5, { kind: 'nearest' })).toBe(vEdge(n, 0, 1))
  })
  it('판 테두리 근처는 테두리가 아니라 가장 가까운 안쪽 울타리(판 밖 반 칸까지)', () => {
    // 왼쪽 위 칸의 왼쪽 테두리 근처 → 안쪽 후보는 (0,0)의 오른쪽·아래
    const e = hitEdge(n, 0.05, 0.4, { kind: 'nearest' })
    expect([vEdge(n, 0, 0), hEdge(n, 0, 0)]).toContain(e)
    expect(hitEdge(n, -0.3, 1.0, { kind: 'nearest' })).toBe(hEdge(n, 0, 0))
    expect(hitEdge(n, -0.8, 1.0, { kind: 'nearest' })).toBeNull()
  })
  it('같은 거리(격자점)는 결정적으로 작은 id', () => {
    const a = hitEdge(n, 2, 2, { kind: 'nearest' })
    const b = hitEdge(n, 2, 2, { kind: 'nearest' })
    expect(a).toBe(b)
    expect(distToEdge(n, a!, 2, 2)).toBe(0)
  })
})

describe('퍼즐 v0 평가·전수 탐색', () => {
  const n = 5
  // 말랑이 왼쪽 위, 잡초 (0,2). 세로 울타리 V(0,1) 하나면 잡초를 떼어 낼 수 없다(아래로 돌아감).
  const p: Puzzle = { id: 't1', n, pet: 0, weeds: [2], fixed: [], k: 2 }
  it('울타리 없으면 잡초와 같은 영역 → 안전하지 않음', () => {
    expect(evaluate(p, [])).toEqual({ safe: false, area: 25 })
  })
  it('잡초 칸을 울타리 3개로 가두면 말랑이 영역 24칸', () => {
    const ev = evaluate({ ...p, k: 3 }, [vEdge(n, 0, 1), vEdge(n, 0, 2), hEdge(n, 0, 2)])
    expect(ev).toEqual({ safe: true, area: 24 })
  })
  it('k=2면 모서리가 아닌 잡초를 가둘 수 없어 최선은 말랑이 쪽을 2칸 이하로 막는 것', () => {
    const sol = solve(p)
    expect(sol.solvable).toBe(true)
    // 울타리 2개로 닫히는 영역은 모서리 1칸뿐이고, 잡초는 위 테두리 가운데라 가두려면 3개가 필요하다
    // → 최선은 말랑이 자신을 모서리 1칸에 가두는 것.
    expect(sol.best).toBe(1)
  })
  it('k=3이면 잡초만 가둬 24칸이 최선', () => {
    const sol = solve({ ...p, k: 3 })
    expect(sol.best).toBe(24)
    expect(sol.bestCount).toBeGreaterThanOrEqual(1)
  })
  it('고정 울타리는 다시 고를 수 없고 평가에 들어간다', () => {
    const q: Puzzle = { ...p, fixed: [vEdge(n, 0, 1), vEdge(n, 0, 2)], k: 1 }
    expect(solve(q).best).toBe(24)
  })
})

describe('합성 손가락', () => {
  it('결정적이다(같은 시드 → 같은 탭)', () => {
    expect(syntheticTaps(5, 340, 6, 3, 7)).toEqual(syntheticTaps(5, 340, 6, 3, 7))
  })
  it('σ가 커질수록 적중률이 떨어지고, nearest가 strip보다 헛탭이 적다', () => {
    const lo = hitStats(syntheticTaps(5, 340, 4, 30, 1), { kind: 'nearest' })
    const hi = hitStats(syntheticTaps(5, 340, 14, 30, 1), { kind: 'nearest' })
    expect(lo.rate).toBeGreaterThan(hi.rate)
    const strip = hitStats(syntheticTaps(5, 340, 10, 30, 2), { kind: 'strip', tol: 0.15 })
    const near = hitStats(syntheticTaps(5, 340, 10, 30, 2), { kind: 'nearest' })
    expect(near.miss).toBe(0)
    expect(strip.miss).toBeGreaterThan(0)
  })
})

describe('규칙 v2 뛰고 담 치기', () => {
  const n = 5
  const base: HopPuzzle = { id: 't', n, start: 12, flowers: [], weeds: [], fixed: [], turns: 3 }
  it('빈 판 가운데에서 0~2칸 = 13칸', () => {
    expect(reachable(base, initialState(base))).toHaveLength(13)
  })
  it('울타리와 잡초 칸은 지나갈 수 없다', () => {
    const p = { ...base, weeds: [13] }
    const s = { pos: 12, fences: new Set([cellSides(n, 12)[0]!]) } // 위 막힘, 오른쪽 잡초
    const r = reachable(p, s)
    expect(r).not.toContain(7)
    expect(r).not.toContain(13)
    expect(r).not.toContain(14) // 잡초 너머
    expect(r).not.toContain(2) // 위 두 칸(2)은 돌아가면 3칸이라 못 간다
    expect(r).toEqual([6, 10, 11, 12, 16, 17, 18, 22])
  })
  it('울타리는 도착한 칸의 네 변 중 하나만', () => {
    for (const m of legalMoves(base, initialState(base))) {
      expect(cellSides(n, m.to)).toContain(m.fence)
    }
  })
  it('applyMove는 원래 상태를 바꾸지 않는다', () => {
    const s = initialState(base)
    const m = legalMoves(base, s)[0]
    const s2 = applyMove(s, m)
    expect(s.fences.size).toBe(0)
    expect(s2.fences.has(m.fence)).toBe(true)
    expect(s2.pos).toBe(m.to)
  })
  it('목표: 꽃 전부 + 잡초 0', () => {
    const p = { ...base, flowers: [0], weeds: [24] }
    expect(hopGoal(p, initialState(p))).toBe(false)
    const sealed = { pos: 12, fences: new Set([cellSides(n, 24)[0]!, cellSides(n, 24)[3]!]) }
    expect(hopGoal(p, sealed)).toBe(true)
  })
  it('시험 퍼즐 3개: 최소 턴이 한도 안이고 한 턴 적으면 못 푼다(별 기준 고정)', () => {
    const expected: Record<string, [number, number]> = {
      'p1-split': [1, 1],
      'p2-corner': [3, 20],
      'p3-order': [3, 2],
    }
    for (const p of HOP_PROTO_PUZZLES) {
      const sol = solveHop(p)
      expect([sol.min, sol.solutionsAtMin], p.id).toEqual(expected[p.id])
      expect(sol.min!).toBeLessThanOrEqual(p.turns)
      expect(solveHop(p, sol.min! - 1).min, p.id).toBeNull()
      // 찾은 해를 다시 적용하면 목표 달성
      let s = initialState(p)
      for (const m of sol.line!) {
        expect(legalMoves(p, s)).toContainEqual(m)
        s = applyMove(s, m)
      }
      expect(hopGoal(p, s)).toBe(true)
    }
  })
})
