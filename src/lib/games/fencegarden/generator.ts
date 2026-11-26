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

// ---------------------------------------------------------------------------
// G3-1(#264): 합격 판에서 12판 세트 고르기 — 판 내용이 아니라 생성기 시드만 저장한다.
// ---------------------------------------------------------------------------

/** 한 판의 측정값. planless = G2 잡초 우선 봇, random = 무작위 봇, greedy = 한 수 앞 봇(bots.ts). 모두 1,000회·봇 시드 7. */
export type SetRow = { seed: number; min: number; sets: number; planless: number; random: number; greedy: number }

export const SET_SIZE = 12

/** 쉬움 → 어려움: 최소 턴 오름차순, 같은 턴이면 한 수 앞 봇 성공률 내림차순, 그다음 집합 수 내림차순, 시드. */
export function difficultyOrder(a: SetRow, b: SetRow): number {
  return a.min - b.min || b.greedy - a.greedy || b.sets - a.sets || a.seed - b.seed
}

/** 선정 세트(시드 목록, 쉬움 → 어려움). scripts/fence-g3-bots.mts 출력과 같아야 한다 — 테스트가 지킨다. */
export const FENCE_SET_SEEDS: number[] = [141, 88, 55, 66, 122, 145, 152, 91, 164, 155, 52, 144]

/** 한 수 앞 봇이 이만큼 이상 풀면 '계획 없이도 풀린다' → 아하가 없어 세트에서 뺀다. */
export const MAX_GREEDY = 0.25

/**
 * 세트 고르기: ① 한 수 앞 봇 < MAX_GREEDY만 ② 최소 턴 단계(3·4…)마다 SET_SIZE를 고르게 나눠(앞 단계가 나머지를 받음)
 * ③ 단계 안에서는 difficultyOrder로 줄 세운 뒤 양 끝을 포함해 같은 간격으로 뽑는다(쉬운 판·가장 어려운 판이 둘 다 들어가게).
 * 단계 판이 모자라면 남는 몫은 뒤 단계가 받는다(몫을 남은 자리 ÷ 남은 단계로 매번 다시 잼). 결과는 difficultyOrder 순.
 */
export function pickSet(rows: SetRow[]): SetRow[] {
  const ok = rows.filter((r) => r.greedy < MAX_GREEDY).sort(difficultyOrder)
  const tiers = [...new Set(ok.map((r) => r.min))].sort((a, b) => a - b)
  const out: SetRow[] = []
  tiers.forEach((min, t) => {
    const tier = ok.filter((r) => r.min === min)
    const left = SET_SIZE - out.length
    const share = Math.ceil(left / (tiers.length - t))
    const k = Math.min(tier.length, share)
    if (k === 1) out.push(tier[0])
    else for (let i = 0; i < k; i++) out.push(tier[Math.round((i * (tier.length - 1)) / (k - 1))])
  })
  return out.sort(difficultyOrder)
}

/** 순서 검사: 앞 판보다 최소 턴이 2 이상 줄어드는 자리('i→i+1', 1부터). 이유 없이 있으면 실패(카드 오답 검사). */
export function orderIssues(set: Pick<SetRow, 'min'>[]): string[] {
  const out: string[] = []
  for (let i = 1; i < set.length; i++) if (set[i - 1].min - set[i].min >= 2) out.push(`${i}→${i + 1}`)
  return out
}
