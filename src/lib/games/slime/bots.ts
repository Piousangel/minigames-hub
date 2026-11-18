import { mulberry32 } from './rng'
import { runLine, waypointsToRaw, type Solution } from './solver'
import { BOARD_H, BOARD_W, DEFAULT_PHYSICS, type Outcome, type Physics, type Pt, type Stage } from './types'

export { perturb } from './rng'
import { perturb } from './rng'

export type BotId = 'c3' | 'c6' | 'c12' | 'c20' | 'doodle' | 'straight'
/** σ는 390px 보드 기준 px. c12 = 손가락 실측(폭의 2.3~3.1%) 중앙. */
export const BOT_SIGMA: Record<BotId, number> = { c3: 3, c6: 6, c12: 10.3, c20: 20, doodle: 10.3, straight: 10.3 }
const BOT_TREMOR: Record<BotId, number> = { c3: 1.5, c6: 1.5, c12: 1.5, c20: 2, doodle: 1.5, straight: 1.5 }
const ATTEMPT_LEARN = [1, 0.85, 0.72]

export interface RobustSolution extends Solution {
  survival: number // σ12에서 생존율
  cluster: number
  /** 원본 해 객체(참조 비교용: 스프레드 복사본은 === 로 비교되지 않는다). */
  orig: Solution
}

/** 해의 강건성: σ에서 n회 시뮬 후 도착 비율. */
export function survival(stage: Stage, sol: Solution, sigma: number, n: number, seed: number, phys: Physics = DEFAULT_PHYSICS): number {
  const rng = mulberry32(seed)
  const dense = waypointsToRaw(sol.waypoints)
  let ok = 0
  for (let i = 0; i < n; i++) {
    const r = runLine(stage, perturb(dense, sigma, 1.5, rng), phys)
    if (r && r.res.outcome === 'nest') ok++
  }
  return ok / n
}

export function doodlePath(stage: Stage, kind: number, rng: () => number): Pt[] {
  // 스폰 금지 반경(34px) 밖에서 시작
  // 낙하하는 말랑이 바로 아래(스폰 금지 반경 34px 바깥)에서 시작한다 — 사람은 말랑이 아래에 선을 긋는다
  const start: Pt = { x: stage.spawn.x - 4, y: stage.spawn.y + 40 }
  const end: Pt = { ...stage.nest, y: stage.nest.y + 6 }
  if (kind === 0) return waypointsToRaw([start, end]) // 직선
  if (kind === 1) {
    // 중간점을 위쪽·바깥으로 휜 곡선
    const mid: Pt = { x: (start.x + end.x) / 2 + (rng() - 0.3) * 80, y: (start.y + end.y) / 2 - 40 - rng() * 60 }
    return waypointsToRaw([start, mid, end])
  }
  // 둥지 근처로 가는 곡선(무작위 경유점)
  const m1: Pt = { x: start.x + rng() * 120, y: start.y + 40 + rng() * 120 }
  const m2: Pt = { x: end.x - 60 + rng() * 40, y: end.y - 120 + rng() * 80 }
  return waypointsToRaw([start, m1, m2, end])
}

export interface BotRun {
  successAttempt: number // 1~3, 0 = 실패
  acorns: number // 성공 시 먹은 도토리
  firstOutcome: Outcome | 'invalid'
  steps: number // 성공 시 스텝
}

export interface BotPolicy {
  /** 해 중에서 이번 판에 시도할 것을 고른다(없으면 null = 낙서). */
  pick(attempt: number, prevCluster: number | null, rng: () => number): RobustSolution | null
}

export function makePolicy(id: BotId, robust: RobustSolution[], all: Solution[]): BotPolicy {
  const robustOrig = new Set<Solution>(robust.map((r) => r.orig))
  const byCluster = new Map<number, RobustSolution[]>()
  for (const s of robust) byCluster.set(s.cluster, [...(byCluster.get(s.cluster) ?? []), s])
  // 쉬운 클러스터 = 평균 생존율이 가장 높은 클러스터
  let easy = -1
  let best = -1
  for (const [c, list] of byCluster) {
    const m = list.reduce((s, x) => s + x.survival, 0) / list.length
    if (m > best) {
      best = m
      easy = c
    }
  }
  const sortedRobust = [...robust].sort((a, b) => b.survival - a.survival)
  const randOf = <T,>(xs: T[], rng: () => number): T => xs[Math.floor(rng() * xs.length)]
  return {
    pick(attempt, prevCluster, rng) {
      if (id === 'doodle' || id === 'straight') return null
      if (robust.length === 0) return null
      if (id === 'c3') return randOf(sortedRobust.slice(0, Math.max(1, Math.ceil(sortedRobust.length * 0.2))), rng)
      if (id === 'c6') return randOf(robust, rng)
      if (id === 'c20' && rng() < 0.2 && all.length) {
        // 해를 잘못 고른다: 강건하지 않은 해(원본 참조로 비교, 클러스터·생존율을 채워 넣는다)
        const weak = all.filter((s) => !robustOrig.has(s))
        if (weak.length) {
          const w = randOf(weak, rng)
          return { ...w, survival: 0, cluster: -1, orig: w }
        }
      }
      // c12/c20: 쉬운 클러스터 70% / 임의 30%, 재시도엔 15% 확률로 다른 클러스터
      let pool = rng() < 0.7 && byCluster.has(easy) ? (byCluster.get(easy) as RobustSolution[]) : robust
      if (attempt > 1 && prevCluster != null && rng() < 0.15) {
        const others = robust.filter((s) => s.cluster !== prevCluster)
        if (others.length) pool = others
      }
      return randOf(pool, rng)
    },
  }
}

export function playBot(stage: Stage, id: BotId, policy: BotPolicy, seed: number, phys: Physics = DEFAULT_PHYSICS): BotRun {
  const rng = mulberry32(seed)
  const sigma = BOT_SIGMA[id]
  const tremor = BOT_TREMOR[id]
  let firstOutcome: BotRun['firstOutcome'] = 'invalid'
  let prevCluster: number | null = null
  for (let a = 1; a <= 3; a++) {
    const sig = sigma * ATTEMPT_LEARN[a - 1]
    const sol = policy.pick(a, prevCluster, rng)
    let dense: Pt[]
    if (sol) {
      dense = waypointsToRaw(sol.waypoints)
      prevCluster = sol.cluster
    } else {
      dense = doodlePath(stage, id === 'doodle' ? Math.floor(rng() * 3) : 0, rng)
    }
    // 실제 게임은 스폰 금지 반경·40px 미만 입력을 그리는 순간 거부하고 다시 그리게 한다(시도 소모 없음).
    // 같은 의도로 최대 4번까지 다시 그리고, 그래도 안 되면 그 시도는 실패로 센다.
    let r: ReturnType<typeof runLine> = null
    for (let redraw = 0; redraw < 4 && !r; redraw++) r = runLine(stage, perturb(dense, sig, tremor, rng), phys)
    if (a === 1) firstOutcome = r ? r.res.outcome : 'invalid'
    if (r && r.res.outcome === 'nest') return { successAttempt: a, acorns: r.res.acorns, firstOutcome, steps: r.res.steps }
  }
  return { successAttempt: 0, acorns: 0, firstOutcome, steps: 0 }
}

/** 방향 편향 없는 해 밀도: 무작위 웨이포인트 3~5개를 보드 전체에서 균일 추출. */
export function randomDensity(stage: Stage, n: number, seed: number): number {
  const rng = mulberry32(seed)
  let ok = 0
  for (let i = 0; i < n; i++) {
    const k = 3 + Math.floor(rng() * 3)
    const wp: Pt[] = Array.from({ length: k }, () => ({ x: 8 + rng() * (BOARD_W - 16), y: 40 + rng() * (BOARD_H - 60) }))
    const r = runLine(stage, waypointsToRaw(wp))
    if (r && r.res.outcome === 'nest') ok++
  }
  return ok / n
}
