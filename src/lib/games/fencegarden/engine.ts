/**
 * 꽃담 정원(가칭 Fence Garden) — 순수 규칙 엔진 (G1 터치 프로토용 최소판).
 * DOM·시계·Math.random 없음. 좌표는 "칸 단위"(칸 한 변 = 1, 판 왼쪽 위 = 0,0).
 *
 * 울타리(edge)는 이웃한 두 칸 사이의 안쪽 선만 가리킨다. 판 테두리는 늘 막혀 있다고 본다.
 *  - 가로 울타리 H(r,c): (r,c)와 (r+1,c) 사이, r ∈ [0,n-2], c ∈ [0,n-1] → id = r*n + c
 *  - 세로 울타리 V(r,c): (r,c)와 (r,c+1) 사이, r ∈ [0,n-1], c ∈ [0,n-2] → id = n*(n-1) + r*(n-1) + c
 */

export type EdgeId = number
export type Cell = number // r*n + c

export function edgeCount(n: number): number {
  return 2 * n * (n - 1)
}

export function hEdge(n: number, r: number, c: number): EdgeId {
  return r * n + c
}
export function vEdge(n: number, r: number, c: number): EdgeId {
  return n * (n - 1) + r * (n - 1) + c
}

/** 울타리의 두 끝점(격자점 좌표, 칸 단위). 그리기·거리 계산용. */
export function edgeSegment(n: number, e: EdgeId): { x1: number; y1: number; x2: number; y2: number } {
  const hCount = n * (n - 1)
  if (e < hCount) {
    const r = Math.floor(e / n)
    const c = e % n
    return { x1: c, y1: r + 1, x2: c + 1, y2: r + 1 }
  }
  const k = e - hCount
  const r = Math.floor(k / (n - 1))
  const c = k % (n - 1)
  return { x1: c + 1, y1: r, x2: c + 1, y2: r + 1 }
}

/** 울타리가 가르는 두 칸. */
export function edgeCells(n: number, e: EdgeId): [Cell, Cell] {
  const hCount = n * (n - 1)
  if (e < hCount) {
    const r = Math.floor(e / n)
    const c = e % n
    return [r * n + c, (r + 1) * n + c]
  }
  const k = e - hCount
  const r = Math.floor(k / (n - 1))
  const c = k % (n - 1)
  return [r * n + c, r * n + c + 1]
}

/** 칸마다 영역 번호(0부터). 울타리로 막히지 않은 상하좌우 이웃끼리 같은 영역. */
export function regions(n: number, fences: ReadonlySet<EdgeId>): Int32Array {
  const out = new Int32Array(n * n).fill(-1)
  const stack: number[] = []
  let id = 0
  for (let s = 0; s < n * n; s++) {
    if (out[s] !== -1) continue
    out[s] = id
    stack.push(s)
    while (stack.length) {
      const cell = stack.pop()!
      const r = Math.floor(cell / n)
      const c = cell % n
      // 위·아래·왼·오른
      if (r > 0 && !fences.has(hEdge(n, r - 1, c)) && out[cell - n] === -1) {
        out[cell - n] = id
        stack.push(cell - n)
      }
      if (r < n - 1 && !fences.has(hEdge(n, r, c)) && out[cell + n] === -1) {
        out[cell + n] = id
        stack.push(cell + n)
      }
      if (c > 0 && !fences.has(vEdge(n, r, c - 1)) && out[cell - 1] === -1) {
        out[cell - 1] = id
        stack.push(cell - 1)
      }
      if (c < n - 1 && !fences.has(vEdge(n, r, c)) && out[cell + 1] === -1) {
        out[cell + 1] = id
        stack.push(cell + 1)
      }
    }
    id++
  }
  return out
}

// ---------------------------------------------------------------------------
// 터치 판정 — 손가락이 닿은 점(칸 단위)을 어느 울타리로 볼 것인가.
// ---------------------------------------------------------------------------

export type HitMode =
  /** 격자선에서 tol(칸 비율) 안쪽일 때만 그 선. 점·모서리 근처는 가까운 쪽. 그 밖은 null(헛탭). dots-and-boxes 방식. */
  | { kind: 'strip'; tol: number }
  /** 칸을 대각선 4삼각형으로 나눠 가장 가까운 변. 판 테두리 변이면 그다음 가까운 안쪽 변. 빈 탭이 없다. */
  | { kind: 'nearest' }

/** 점에서 울타리 선분까지의 거리(칸 단위). */
export function distToEdge(n: number, e: EdgeId, x: number, y: number): number {
  const s = edgeSegment(n, e)
  if (s.y1 === s.y2) {
    const dx = x < s.x1 ? s.x1 - x : x > s.x2 ? x - s.x2 : 0
    return Math.hypot(dx, y - s.y1)
  }
  const dy = y < s.y1 ? s.y1 - y : y > s.y2 ? y - s.y2 : 0
  return Math.hypot(x - s.x1, dy)
}

/** 판 밖 반 칸까지는 받아 준다(테두리 근처 울타리를 노린 손가락이 판 밖에 떨어지는 경우). 그 밖은 null. */
export const OUTSIDE_MARGIN = 0.5

export function hitEdge(n: number, x: number, y: number, mode: HitMode): EdgeId | null {
  const m = OUTSIDE_MARGIN
  if (!(x >= -m && y >= -m && x <= n + m && y <= n + m)) return null
  // 후보 = 점이 든 칸(경계면 안쪽으로 당김)의 네 변 중 안쪽 변 + 이웃 칸까지 포함한 근방 선분.
  const c = Math.min(n - 1, Math.max(0, Math.floor(x)))
  const r = Math.min(n - 1, Math.max(0, Math.floor(y)))
  let best: EdgeId | null = null
  let bestD = Infinity
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr
      const cc = c + dc
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue
      const cand: EdgeId[] = []
      if (rr < n - 1) cand.push(hEdge(n, rr, cc))
      if (cc < n - 1) cand.push(vEdge(n, rr, cc))
      for (const e of cand) {
        const d = distToEdge(n, e, x, y)
        // 같은 거리(격자점)면 작은 id — 결정적.
        if (d < bestD - 1e-12 || (Math.abs(d - bestD) <= 1e-12 && best !== null && e < best)) {
          bestD = d
          best = e
        }
      }
    }
  }
  if (best === null) return null
  if (mode.kind === 'strip' && bestD > mode.tol) return null
  return best
}

// ---------------------------------------------------------------------------
// 퍼즐 v0 — "울타리 K개로, 말랑이가 있는 영역에 잡초가 없게 하되 가장 넓게". (G1에서 규칙 확정 전 시험용)
// ---------------------------------------------------------------------------

export type Puzzle = {
  id: string
  n: number
  pet: Cell
  weeds: Cell[]
  /** 처음부터 있는 울타리(바꿀 수 없음). */
  fixed: EdgeId[]
  /** 놓을 수 있는 울타리 수. */
  k: number
}

export type Eval = { safe: boolean; area: number }

export function evaluate(p: Puzzle, placed: Iterable<EdgeId>): Eval {
  const all = new Set<EdgeId>(p.fixed)
  for (const e of placed) all.add(e)
  const reg = regions(p.n, all)
  const mine = reg[p.pet]
  let area = 0
  for (let i = 0; i < reg.length; i++) if (reg[i] === mine) area++
  const safe = !p.weeds.some((w) => reg[w] === mine)
  return { safe, area }
}

export type Solution = { best: number; bestCount: number; solvable: boolean; checked: number }

/** 울타리 0~k개 조합 전수 탐색. 5×5·k≤3이면 ~1만 조합(밀리초 단위). */
export function solve(p: Puzzle): Solution {
  const fixed = new Set(p.fixed)
  const free: EdgeId[] = []
  for (let e = 0; e < edgeCount(p.n); e++) if (!fixed.has(e)) free.push(e)
  let best = 0
  let bestCount = 0
  let checked = 0
  const chosen: EdgeId[] = []
  const visit = () => {
    checked++
    const ev = evaluate(p, chosen)
    if (!ev.safe) return
    if (ev.area > best) {
      best = ev.area
      bestCount = 1
    } else if (ev.area === best) bestCount++
  }
  const rec = (start: number) => {
    visit()
    if (chosen.length === p.k) return
    for (let i = start; i < free.length; i++) {
      chosen.push(free[i])
      rec(i + 1)
      chosen.pop()
    }
  }
  rec(0)
  return { best, bestCount, solvable: best > 0, checked }
}

// ---------------------------------------------------------------------------
// 터치 정확도 계산 — 프로토에서 모은 탭과 합성(가우스) 손가락 시뮬 공용.
// ---------------------------------------------------------------------------

export type Tap = { n: number; target: EdgeId; x: number; y: number; ms: number }

export type HitStats = { taps: number; hit: number; miss: number; wrong: number; rate: number }

export function hitStats(taps: Tap[], mode: HitMode): HitStats {
  let hit = 0
  let miss = 0
  let wrong = 0
  for (const t of taps) {
    const e = hitEdge(t.n, t.x, t.y, mode)
    if (e === null) miss++
    else if (e === t.target) hit++
    else wrong++
  }
  return { taps: taps.length, hit, miss, wrong, rate: taps.length ? hit / taps.length : 0 }
}

/** 결정적 의사난수(mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 합성 손가락: 목표 울타리 가운데를 노리고 등방 가우스 오차 σpx(화면 px)로 찍는다.
 * boardPx = 판 한 변의 화면 폭. 반환: 칸 단위 탭 목록(목표는 모든 안쪽 울타리를 고르게).
 */
export function syntheticTaps(n: number, boardPx: number, sigmaPx: number, perEdge: number, seed: number): Tap[] {
  const rnd = mulberry32(seed)
  const gauss = () => {
    const u = Math.max(rnd(), 1e-12)
    const v = rnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const cellPx = boardPx / n
  const out: Tap[] = []
  for (let e = 0; e < edgeCount(n); e++) {
    const s = edgeSegment(n, e)
    const cx = (s.x1 + s.x2) / 2
    const cy = (s.y1 + s.y2) / 2
    for (let i = 0; i < perEdge; i++) {
      out.push({ n, target: e, x: cx + (gauss() * sigmaPx) / cellPx, y: cy + (gauss() * sigmaPx) / cellPx, ms: 0 })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// 규칙 v2 「뛰고 담 치기」(리서치 2 반증 뒤 — 정적 '가두기·최대 면적'은 enclose.horse와 같아 버림)
// 한 턴 = 말랑이가 0~2칸 뛰고(울타리·잡초 칸은 못 지남) → 지금 선 칸의 네 변 중 하나에 반드시 울타리 1개.
// 목표: 말랑이가 있는 영역에 꽃이 전부 있고 잡초가 하나도 없다. 별 = 최소 턴과 비교.
// ---------------------------------------------------------------------------

export type HopPuzzle = {
  id: string
  n: number
  start: Cell
  flowers: Cell[]
  weeds: Cell[]
  fixed: EdgeId[]
  /** 턴 한도. */
  turns: number
}

export type HopState = { pos: Cell; fences: ReadonlySet<EdgeId> }

export const HOP_MAX = 2

/** 칸의 네 변(안쪽 변만). 순서: 위·오른·아래·왼(없는 변은 null). */
export function cellSides(n: number, cell: Cell): [EdgeId | null, EdgeId | null, EdgeId | null, EdgeId | null] {
  const r = Math.floor(cell / n)
  const c = cell % n
  return [
    r > 0 ? hEdge(n, r - 1, c) : null,
    c < n - 1 ? vEdge(n, r, c) : null,
    r < n - 1 ? hEdge(n, r, c) : null,
    c > 0 ? vEdge(n, r, c - 1) : null,
  ]
}

/** 지금 자리에서 0~HOP_MAX칸 안에 갈 수 있는 칸(울타리·잡초를 지나지 않는 최단 경로 기준). 자기 칸 포함. */
export function reachable(p: HopPuzzle, s: HopState): Cell[] {
  const n = p.n
  const weeds = new Set(p.weeds)
  const dist = new Map<Cell, number>([[s.pos, 0]])
  let frontier = [s.pos]
  for (let step = 1; step <= HOP_MAX; step++) {
    const next: Cell[] = []
    for (const cell of frontier) {
      const [up, right, down, left] = cellSides(n, cell)
      const nb: [EdgeId | null, Cell][] = [
        [up, cell - n],
        [right, cell + 1],
        [down, cell + n],
        [left, cell - 1],
      ]
      for (const [e, to] of nb) {
        if (e === null || s.fences.has(e) || weeds.has(to) || dist.has(to)) continue
        dist.set(to, step)
        next.push(to)
      }
    }
    frontier = next
  }
  return [...dist.keys()].sort((a, b) => a - b)
}

export function hopGoal(p: HopPuzzle, s: HopState): boolean {
  const reg = regions(p.n, s.fences)
  const mine = reg[s.pos]
  return p.flowers.every((f) => reg[f] === mine) && !p.weeds.some((w) => reg[w] === mine)
}

export type HopMove = { to: Cell; fence: EdgeId }

export function legalMoves(p: HopPuzzle, s: HopState): HopMove[] {
  const out: HopMove[] = []
  for (const to of reachable(p, s)) {
    for (const e of cellSides(p.n, to)) if (e !== null && !s.fences.has(e)) out.push({ to, fence: e })
  }
  return out
}

export function applyMove(s: HopState, m: HopMove): HopState {
  const f = new Set(s.fences)
  f.add(m.fence)
  return { pos: m.to, fences: f }
}

export function initialState(p: HopPuzzle): HopState {
  return { pos: p.start, fences: new Set(p.fixed) }
}

/**
 * fenceSetsAtMin: 최소 턴 해의 **서로 다른 최종 울타리 집합** 수(같은 울타리를 다른 순서로 놓은 해·대칭 순서는 1개로 센다).
 * 리뷰(11-20): 예전 값은 '중복 제거된 직전 상태 × 수' 쌍이라 해 개수로 쓰면 부풀었다(퍼즐2 20 → 실제 집합 12).
 */
export type HopSolution = { min: number | null; fenceSetsAtMin: number; states: number; line: HopMove[] | null }

const fenceKey = (f: ReadonlySet<EdgeId>) => [...f].sort((a, b) => a - b).join(',')

/** 너비 우선 전수 탐색(상태 = 위치 + 울타리 집합, 중복 제거). */
export function solveHop(p: HopPuzzle, maxTurns = p.turns): HopSolution {
  const key = (s: HopState) => `${s.pos}|${fenceKey(s.fences)}`
  const start = initialState(p)
  if (hopGoal(p, start)) return { min: 0, fenceSetsAtMin: 1, states: 1, line: [] }
  type Node = { s: HopState; line: HopMove[] }
  let layer: Node[] = [{ s: start, line: [] }]
  const seen = new Set([key(start)])
  let states = 1
  for (let t = 1; t <= maxTurns; t++) {
    const next: Node[] = []
    let found: HopMove[] | null = null
    const goalSets = new Set<string>()
    for (const node of layer) {
      for (const m of legalMoves(p, node.s)) {
        const s2 = applyMove(node.s, m)
        if (hopGoal(p, s2)) {
          goalSets.add(fenceKey(s2.fences))
          if (!found) found = [...node.line, m]
          continue
        }
        const k = key(s2)
        if (seen.has(k)) continue
        seen.add(k)
        states++
        next.push({ s: s2, line: [...node.line, m] })
      }
    }
    if (found) return { min: t, fenceSetsAtMin: goalSets.size, states, line: found }
    layer = next
  }
  return { min: null, fenceSetsAtMin: 0, states, line: null }
}

/**
 * 계획 없는 봇(리뷰 11-20 깊이 지표): 매 턴 합법 수 중 '꽃을 말랑이 영역에서 떼어 내지 않는 수'를 고르게 무작위로,
 * 그중 잡초 칸에 붙은 변이 있으면 그것만. 턴 한도 안에 목표에 닿는 비율. G2 생성기 합격 기준 후보: < 20%.
 */
export function planlessBotRate(p: HopPuzzle, trials: number, seed: number): number {
  const rnd = mulberry32(seed)
  const weeds = new Set(p.weeds)
  let win = 0
  for (let i = 0; i < trials; i++) {
    let s = initialState(p)
    for (let t = 0; t < p.turns; t++) {
      let ms = legalMoves(p, s).filter((m) => {
        const reg = regions(p.n, applyMove(s, m).fences)
        return p.flowers.every((f) => reg[f] === reg[m.to])
      })
      const touching = ms.filter((m) => edgeCells(p.n, m.fence).some((c) => weeds.has(c)))
      if (touching.length) ms = touching
      if (!ms.length) break
      s = applyMove(s, ms[Math.floor(rnd() * ms.length)])
      if (hopGoal(p, s)) {
        win++
        break
      }
    }
  }
  return win / trials
}

/** 프로토 시험 퍼즐 3개(손으로 만든 뒤 solveHop으로 최소 턴 확인 — 테스트가 고정). 턴 한도 = 최소 + 2(별 ★1~3이 모두 가능). */
export const HOP_PROTO_PUZZLES: HopPuzzle[] = [
  // 1) 튜토리얼: 가운데 세로 담의 빈 한 칸을 메운다(1턴).
  {
    id: 'p1-split',
    n: 5,
    start: 12,
    flowers: [0, 10, 20],
    weeds: [4, 14, 24],
    fixed: [vEdge(5, 0, 2), vEdge(5, 1, 2), vEdge(5, 3, 2), vEdge(5, 4, 2)],
    turns: 3,
  },
  // 2) 오른쪽 위 모서리 잡초 — 두 변을 막아야 하는데 가운데에서 출발해 뛰는 거리가 모자란다.
  { id: 'p2-corner', n: 5, start: 12, flowers: [0, 20, 24], weeds: [4], fixed: [], turns: 5 },
  // 3) 위 테두리 가운데 잡초 — 세 변. 바로 위 변부터 막으면 돌아가는 길이 길어진다(순서가 답).
  { id: 'p3-order', n: 5, start: 7, flowers: [0, 4, 20, 24], weeds: [2], fixed: [], turns: 5 },
]

/** 별: 최소 턴 ★3, 최소+1 ★2, 그 밖(한도 안) ★1. */
export function hopStars(turnsUsed: number, min: number): 1 | 2 | 3 {
  return turnsUsed <= min ? 3 : turnsUsed === min + 1 ? 2 : 1
}
