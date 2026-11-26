/**
 * 꽃담 정원(가칭) G2 — 결정적 퍼즐 생성기 + 채점(#255).
 * 시드 → 판(같은 시드는 언제나 같은 판). 채점 = 최소 턴(솔버, 미리 계산) · 최소 해의 서로 다른 울타리 집합 수 · 계획 없는 봇 해결률.
 * 합격선(G1 브리프 10장): 최소 턴 ≥ 3 · 집합 ≤ 3 · 봇 < 20%. 200개 중 합격 비율 ≥ 10%면 G3.
 * DOM·시계·Math.random 없음.
 */
import { edgeCount, initialState, hopGoal, mulberry32, planlessBotRate, solveHop, type Cell, type EdgeId, type HopMove, type HopPuzzle } from './engine'

export const GATE = { minTurns: 3, maxSets: 3, maxBot: 0.2, passRatio: 0.1 } as const

/** 솔버 상한 턴. 5×5·5턴은 상태 150만·14초(G1 7장) — 생성기는 4턴까지만 본다. 그 위는 '최소 턴 없음'(탈락). */
export const SOLVE_CAP = 4

export type GenOpts = {
  n?: number
  /** 잡초 수 [최소, 최대] */
  weeds?: [number, number]
  /** 꽃 수 [최소, 최대] */
  flowers?: [number, number]
  /** 고정 울타리 수 [최소, 최대] */
  fixed?: [number, number]
}

const DEFAULT: Required<GenOpts> = { n: 5, weeds: [1, 3], flowers: [1, 3], fixed: [0, 4] }

/** 시드 → 판. 시작 칸·꽃·잡초는 서로 다른 칸, 고정 울타리는 서로 다른 안쪽 변. 시작부터 목표인 판은 다음 후보로 넘긴다(결정적). */
export function generateHop(seed: number, opts: GenOpts = {}): HopPuzzle {
  const o = { ...DEFAULT, ...opts }
  const rnd = mulberry32(seed * 2654435761 + 1)
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
  for (let attempt = 0; ; attempt++) {
    const cells = Array.from({ length: o.n * o.n }, (_, i) => i)
    // 피셔-예이츠 앞부분만
    const pick = (k: number): Cell[] => {
      const out: Cell[] = []
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rnd() * (cells.length - i))
        ;[cells[i], cells[j]] = [cells[j], cells[i]]
        out.push(cells[i])
      }
      cells.splice(0, k)
      return out
    }
    const [start] = pick(1)
    const weeds = pick(int(o.weeds[0], o.weeds[1])).sort((a, b) => a - b)
    const flowers = pick(int(o.flowers[0], o.flowers[1])).sort((a, b) => a - b)
    const edges = Array.from({ length: edgeCount(o.n) }, (_, i) => i)
    const nf = int(o.fixed[0], o.fixed[1])
    const fixed: EdgeId[] = []
    for (let i = 0; i < nf; i++) {
      const j = i + Math.floor(rnd() * (edges.length - i))
      ;[edges[i], edges[j]] = [edges[j], edges[i]]
      fixed.push(edges[i])
    }
    fixed.sort((a, b) => a - b)
    const p: HopPuzzle = { id: `g-${seed}`, n: o.n, start, flowers, weeds, fixed, turns: SOLVE_CAP }
    if (!hopGoal(p, initialState(p)) || attempt > 50) return p
  }
}

export type Grade = {
  puzzle: HopPuzzle
  min: number | null
  fenceSetsAtMin: number
  bot: number
  states: number
  line: HopMove[] | null
}

/** 채점. 턴 한도를 최소 + 2로 다시 매기고(별 ★1~3이 모두 가능) 그 한도로 봇을 돌린다. 풀 수 없으면 봇 0. */
export function gradeHop(p: HopPuzzle, opts: { botTrials: number; botSeed: number; cap?: number }): Grade {
  const sol = solveHop(p, opts.cap ?? SOLVE_CAP)
  if (sol.min === null) return { puzzle: p, min: null, fenceSetsAtMin: 0, bot: 0, states: sol.states, line: null }
  const puzzle: HopPuzzle = { ...p, turns: sol.min + 2, min: sol.min }
  const bot = planlessBotRate(puzzle, opts.botTrials, opts.botSeed)
  return { puzzle, min: sol.min, fenceSetsAtMin: sol.fenceSetsAtMin, bot, states: sol.states, line: sol.line }
}

export type GateInput = { min: number | null; fenceSetsAtMin: number; bot: number }

export function passesGate(g: GateInput): boolean {
  return g.min !== null && g.min >= GATE.minTurns && g.fenceSetsAtMin <= GATE.maxSets && g.bot < GATE.maxBot
}

export type Summary = {
  total: number
  passed: number
  ratio: number
  verdict: 'G3' | 'below'
  minHist: Record<string, number>
  setsHist: Record<string, number>
  botHist: Record<string, number>
}

const inc = (h: Record<string, number>, k: string) => {
  h[k] = (h[k] ?? 0) + 1
}

/** 분포표. 봇 구간은 10%p 단위(0~9% → '0', 90~100% → '90'). 집합 수는 1·2·3·4-9·10+. */
export function summarize(rows: GateInput[]): Summary {
  const minHist: Record<string, number> = {}
  const setsHist: Record<string, number> = {}
  const botHist: Record<string, number> = {}
  let passed = 0
  for (const r of rows) {
    if (passesGate(r)) passed++
    inc(minHist, r.min === null ? 'none' : String(r.min))
    if (r.min === null) continue
    inc(setsHist, r.fenceSetsAtMin <= 3 ? String(r.fenceSetsAtMin) : r.fenceSetsAtMin < 10 ? '4-9' : '10+')
    inc(botHist, String(Math.min(90, Math.floor((r.bot * 100) / 10) * 10)))
  }
  const ratio = rows.length ? passed / rows.length : 0
  return { total: rows.length, passed, ratio, verdict: ratio >= GATE.passRatio ? 'G3' : 'below', minHist, setsHist, botHist }
}
