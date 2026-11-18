import { makePolicy, playBot, randomDensity, survival, type BotId, type RobustSolution } from './bots'
import { simulate } from './engine'
import { solve, waypointsToRaw, runLine } from './solver'
import { DEFAULT_PHYSICS, type Physics, type Stage } from './types'
import { mulberry32 } from './rng'
import type { Pt } from './types'

/**
 * 해 클러스터 = 도토리 조합 + 경로 서명(궤적의 33%·66% 지점이 속한 100px 칸). 같은 도토리를 먹어도
 * 다른 경로(벽 위로 vs 아래로)면 다른 클러스터로 센다(리뷰 지적: 조합만으로는 경로 차이를 못 잡는다).
 */
function clusterOf(stage: Stage, sol: { line: Pt[]; res: { acornMask: number } }): number {
  const tr: Pt[] = []
  simulate(stage, [sol.line], DEFAULT_PHYSICS, tr)
  const at = (f: number) => tr[Math.min(tr.length - 1, Math.floor(tr.length * f))] ?? { x: 0, y: 0 }
  const cell = (p: Pt) => Math.floor(p.x / 100) * 10 + Math.floor(p.y / 100)
  return sol.res.acornMask * 10000 + cell(at(0.33)) * 100 + cell(at(0.66))
}

export interface StageGate {
  id: string
  tier: number
  solutions: number
  robust: number
  clusters: number
  density: number
  bots: Record<string, { first: number; within3: number; full3: number; reasons: Record<string, number>; meanSecs: number }>
}

export function gateStage(stage: Stage, opts: { runs?: number; densityN?: number; seed?: number; phys?: Physics; pop?: number } = {}): StageGate {
  const runs = opts.runs ?? 1000
  const phys = opts.phys ?? DEFAULT_PHYSICS
  const seed = opts.seed ?? 20261118
  const { solutions } = solve(stage, seed, { pop: opts.pop ?? 400, rounds: 6, robustTrials: 4, robustSigma: 9 })
  // 강건성: σ12(폭의 3.1%) 생존율 ≥ 50%. 해가 많으면 도토리 조합별로 대표만 평가(비용 제한)
  const rng = mulberry32(seed + 1)
  // 해가 많으면 중복 없이(비복원) 400개만 평가한다 — 복원 추출은 같은 해를 여러 번 세어 강건 개수를 부풀린다
  const pool = [...solutions]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const sample = pool.slice(0, 400)
  const robust: RobustSolution[] = []
  for (const s of sample) {
    const sv = survival(stage, s, 12, 60, seed + 7, phys)
    if (sv >= 0.5) robust.push({ ...s, survival: sv, cluster: clusterOf(stage, s), orig: s })
  }
  const clusters = new Set(robust.map((r) => r.cluster)).size
  const density = randomDensity(stage, opts.densityN ?? 6000, seed + 3)
  const bots: StageGate['bots'] = {}
  for (const id of ['c3', 'c6', 'c12', 'c20', 'doodle'] as BotId[]) {
    const policy = makePolicy(id, robust, solutions)
    let first = 0
    let within3 = 0
    let full3 = 0
    let steps = 0
    let wins = 0
    const reasons: Record<string, number> = {}
    for (let i = 0; i < runs; i++) {
      const r = playBot(stage, id, policy, seed + 100 + i * 13, phys)
      if (r.successAttempt === 1) first++
      if (r.successAttempt > 0) {
        within3++
        steps += r.steps
        wins++
      }
      if (r.successAttempt > 0 && r.acorns === 3) full3++
      reasons[r.firstOutcome] = (reasons[r.firstOutcome] ?? 0) + 1
    }
    bots[id] = { first: first / runs, within3: within3 / runs, full3: full3 / runs, reasons, meanSecs: wins ? steps / wins / 120 : 0 }
  }
  return { id: stage.id, tier: stage.tier, solutions: solutions.length, robust: robust.length, clusters, density, bots }
}

/** 같은 입력 1,000회 → 결과 동일(결정성). */
export function determinism(stage: Stage, wp: Pt[], n = 1000): boolean {
  const r = runLine(stage, waypointsToRaw(wp))
  if (!r) throw new Error('determinism: 선이 유효하지 않아 아무것도 검증하지 못했다(웨이포인트를 고쳐라)')
  const first = JSON.stringify(r.res)
  for (let i = 0; i < n; i++) if (JSON.stringify(simulate(stage, [r.line])) !== first) return false
  return true
}

export interface Check {
  item: string
  pass: boolean
  value: string
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const inR = (x: number, lo: number, hi: number) => x >= lo && x <= hi

/** 브리프 4-10 합격선(v3: 상관 모델은 G2 결과로 확정하므로 일일 항목은 제외, 스테이지 단위 항목만). */
export function checksFor(g: StageGate): Check[] {
  const c12 = g.bots.c12
  const c20 = g.bots.c20
  const c6 = g.bots.c6
  const c3 = g.bots.c3
  const doodle = g.bots.doodle
  const out: Check[] = []
  const add = (item: string, pass: boolean, value: string) => out.push({ item, pass, value })
  add('강건한 해 ≥ 1', g.robust >= 1, `${g.robust}개(해 ${g.solutions})`)
  if (g.tier >= 2) add('해 클러스터 ≥ 2', g.clusters >= 2, `${g.clusters}`)
  add(`해 밀도 ≤ ${g.tier === 1 ? 8 : 3}%`, g.density <= (g.tier === 1 ? 0.08 : 0.03), pct(g.density))
  const dl = g.tier === 1 ? [0.8, 1] : g.tier === 2 ? [0, 0.15] : [0, 0.05]
  add(`낙서 1회차 ${g.tier === 1 ? '≥80%' : g.tier === 2 ? '≤15%' : '≤5%'}`, inR(doodle.first, dl[0], dl[1]), pct(doodle.first))
  const b1 = g.tier === 1 ? [0.65, 0.85] : g.tier === 2 ? [0.35, 0.55] : [0.12, 0.3]
  add(`c12 1회차 ${pct(b1[0])}~${pct(b1[1])}`, inR(c12.first, b1[0], b1[1]), pct(c12.first))
  const w3 = g.tier === 1 ? [0.95, 1] : g.tier === 2 ? [0.75, 1] : [0.4, 0.65]
  add(`c12 3시도 ${pct(w3[0])}~${pct(w3[1])}`, inR(c12.within3, w3[0], w3[1]), pct(c12.within3))
  const c20min = g.tier === 1 ? 0.5 : g.tier === 2 ? 0.2 : 0.05
  add(`c20 1회차 ≥ ${pct(c20min)}`, c20.first >= c20min, pct(c20.first))
  if (g.tier >= 2) {
    const c6min = g.tier === 2 ? 0.6 : 0.4
    add(`c6 1회차 ≥ ${pct(c6min)}`, c6.first >= c6min, pct(c6.first))
  }
  if (g.tier === 3) add('c3 3시도 만점 30~60%', inR(c3.full3, 0.3, 0.6), pct(c3.full3))
  const total = Object.values(c12.reasons).reduce((a, b) => a + b, 0) || 1
  const reasonsNoWin = Object.entries(c12.reasons).filter(([k]) => k !== 'nest')
  const maxFail = reasonsNoWin.length ? Math.max(...reasonsNoWin.map(([, v]) => v)) / total : 0
  add('실패 원인 한 가지 ≤ 40%', maxFail <= 0.4, pct(maxFail))
  add('도착까지 평균 ≤ 8초', c12.meanSecs <= 8, `${c12.meanSecs.toFixed(1)}s`)
  return out
}
