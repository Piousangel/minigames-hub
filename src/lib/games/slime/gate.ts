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
  /** 밤송이가 있는 스테이지(직선을 막으려는 설계)인가 */
  blocksStraight: boolean
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
  for (const id of ['c3', 'c6', 'c12', 'c20', 'doodle', 'straight'] as BotId[]) {
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
  return { id: stage.id, tier: stage.tier, blocksStraight: stage.spikes.length > 0, solutions: solutions.length, robust: robust.length, clusters, density, bots }
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

/**
 * 합격선 v4(11-18 밤, DECISIONS.md). v3의 'c12 1회차 12~30%(tier3)'는 '강건한 해 ≥50%@σ12'와 구조적으로 모순이라 폐기하고 실측 기반으로 재정의:
 * 난이도 = 해의 취약도(보통 봇 1회차) + 3시도 + 숙련 만점률, tier 간 단조(tier3 ≤ tier2 ≤ tier1). 물리 9조합 변동은 slime-physics 스크립트가 판정한다.
 */
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
  if (g.tier === 1) {
    // 직선 기준: 밤송이가 없는 입문 스테이지는 직선이 풀려야 하고(≥80%), 밤송이로 직선을 막은 스테이지는 막혀야 한다(≤50%, 브리프 4-10)
    if (g.blocksStraight) add('직선 1회차 ≤50% (직선을 막는 스테이지)', g.bots.straight.first <= 0.5, pct(g.bots.straight.first))
    else add('직선 1회차 ≥80% (입문 스테이지)', g.bots.straight.first >= 0.8, pct(g.bots.straight.first))
    add('c12 1회차 ≥85% (입문)', c12.first >= 0.85, pct(c12.first))
    add('c12 3시도 ≥95%', c12.within3 >= 0.95, pct(c12.within3))
    add('c20 1회차 ≥50%', c20.first >= 0.5, pct(c20.first))
  } else if (g.tier === 2) {
    // v4.1: 15→20%. 쉬워진 tier2(벽이 낮음)에서는 직선 계열 낙서가 17% 정도 풀리는 것이 정상(우월 전략 감시 지표, 50%를 넘어야 문제)
    add('낙서 1회차 ≤20%', doodle.first <= 0.2, pct(doodle.first))
    // v4.1(11-19 아침): 오너가 실제로 해보고 '3스테이지가 어렵다'(시뮬 보통 52%) → 시뮬은 '어디에 그을지 판단하는 오류'를 못 넣어 낙관적. 35~55→55~80
    add('c12 1회차 55~80%', inR(c12.first, 0.55, 0.8), pct(c12.first))
    add('c12 3시도 ≥75%', c12.within3 >= 0.75, pct(c12.within3))
    add('c20 1회차 ≥30%', c20.first >= 0.3, pct(c20.first))
    add('c6 1회차 ≥50%', c6.first >= 0.5, pct(c6.first))
  } else {
    add('낙서 1회차 ≤30%', doodle.first <= 0.3, pct(doodle.first))
    add('c12 1회차 30~55%', inR(c12.first, 0.3, 0.55), pct(c12.first))
    add('c12 3시도 65~90%', inR(c12.within3, 0.65, 0.9), pct(c12.within3))
    add('c20 1회차 ≥8%', c20.first >= 0.08, pct(c20.first))
    add('c6 1회차 ≥40%', c6.first >= 0.4, pct(c6.first))
    add('c3 3시도 만점 30~60%', inR(c3.full3, 0.3, 0.6), pct(c3.full3))
  }
  const total = Object.values(c12.reasons).reduce((a, b) => a + b, 0) || 1
  const reasonsNoWin = Object.entries(c12.reasons).filter(([k]) => k !== 'nest')
  const maxFail = reasonsNoWin.length ? Math.max(...reasonsNoWin.map(([, v]) => v)) / total : 0
  add('실패 원인 한 가지 ≤ 40%(전체 시도 중)', maxFail <= 0.4, pct(maxFail))
  add('도착까지 평균 ≤ 8초', c12.meanSecs <= 8, `${c12.meanSecs.toFixed(1)}s`)
  return out
}
