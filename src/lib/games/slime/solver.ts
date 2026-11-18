import { simulate } from './engine'
import { mulberry32, gauss, perturb } from './rng'
import { polyLength, processStroke } from './strokePipeline'
import { BOARD_H, BOARD_W, CONST, DEFAULT_PHYSICS, type Physics, type Pt, type SimResult, type Stage } from './types'

/** 웨이포인트(굵은 점) → 시뮬용 선. 점 사이를 6px 간격으로 채워 손으로 그은 선처럼 만든 뒤 파이프라인을 통과시킨다. */
export function waypointsToRaw(wp: Pt[]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i + 1 < wp.length; i++) {
    const a = wp[i]
    const b = wp[i + 1]
    const n = Math.max(1, Math.round(Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) / 6))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  out.push(wp[wp.length - 1])
  return out
}

export function runLine(stage: Stage, raw: Pt[], phys: Physics = DEFAULT_PHYSICS): { res: SimResult; line: Pt[] } | null {
  const line = processStroke(raw, stage.ink)
  if (!line) return null
  // 스폰 금지 반경: 그리는 순간 거부되는 입력이므로 시험에서도 무효 처리
  for (const p of line) if (Math.hypot(p.x - stage.spawn.x, p.y - stage.spawn.y) < CONST.SPAWN_BAN_R) return null
  return { res: simulate(stage, [line], phys), line }
}

export interface Solution {
  waypoints: Pt[]
  line: Pt[]
  res: SimResult
  inkUsed: number
}

const clampPt = (p: Pt): Pt => ({ x: Math.max(8, Math.min(BOARD_W - 8, p.x)), y: Math.max(40, Math.min(BOARD_H - 20, p.y)) })

/** 적합도: 도착이면 크게(+도토리, −잉크), 아니면 둥지 근접도와 도토리. */
function fitness(stage: Stage, r: SimResult | null, inkUsed: number): number {
  if (!r) return -1e6
  if (r.outcome === 'nest') return 10000 + r.acorns * 300 - inkUsed
  return -r.minNest + r.acorns * 60 - (r.outcome === 'spiked' ? 40 : 0)
}

/**
 * 솔버: 웨이포인트 k개(3~5) 폴리라인을 CEM(교차엔트로피)으로 탐색. 시드 고정 → 결정적.
 * 반환: 도착한 해들(중복 포함, 호출 측이 클러스터링).
 */
export function solve(stage: Stage, seed: number, opts: { pop?: number; rounds?: number; ks?: number[]; robustTrials?: number; robustSigma?: number } = {}): { solutions: Solution[]; tried: number } {
  const rng = mulberry32(seed)
  const pop = opts.pop ?? 600
  const rounds = opts.rounds ?? 6
  const ks = opts.ks ?? [3, 4, 5]
  const trials = opts.robustTrials ?? 0
  const rsig = opts.robustSigma ?? 9
  const solutions: Solution[] = []
  let tried = 0
  for (const k of ks) {
    // 첫 웨이포인트는 스폰 아래쪽 근방에서 시작하도록 초기 평균을 스폰→둥지 직선 위에 둔다
    const mean: Pt[] = []
    const std: number[] = []
    for (let i = 0; i < k; i++) {
      const t = (i + 0.5) / k
      mean.push({ x: stage.spawn.x + (stage.nest.x - stage.spawn.x) * t, y: stage.spawn.y + 50 + (stage.nest.y - stage.spawn.y - 50) * t })
      std.push(110)
    }
    for (let round = 0; round < rounds; round++) {
      const cands: { wp: Pt[]; f: number }[] = []
      for (let s = 0; s < pop; s++) {
        const wp = mean.map((m, i) => clampPt({ x: m.x + gauss(rng) * std[i], y: m.y + gauss(rng) * std[i] }))
        // 시작점은 스폰 근처 위쪽에서 받도록 첫 점을 스폰 아래 50~90px 지점으로 보정
        const raw = waypointsToRaw(wp)
        const r = runLine(stage, raw)
        tried++
        const inkUsed = r ? polyLength(r.line) : 0
        let f = fitness(stage, r?.res ?? null, inkUsed)
        if (trials > 0) {
          // 강건 적합도: 흔들어서 여러 번 시뮬한 평균(오차를 견디는 해를 선호)
          let acc = 0
          for (let tr = 0; tr < trials; tr++) {
            const rr = runLine(stage, perturb(raw, rsig, 1.5, rng))
            acc += fitness(stage, rr?.res ?? null, rr ? polyLength(rr.line) : 0)
          }
          f = 0.3 * f + (0.7 * acc) / trials
        }
        cands.push({ wp, f })
        if (r && r.res.outcome === 'nest') solutions.push({ waypoints: wp, line: r.line, res: r.res, inkUsed })
      }
      cands.sort((a, b) => b.f - a.f)
      const elite = cands.slice(0, Math.max(8, Math.floor(pop * 0.1)))
      for (let i = 0; i < k; i++) {
        const mx = elite.reduce((s, c) => s + c.wp[i].x, 0) / elite.length
        const my = elite.reduce((s, c) => s + c.wp[i].y, 0) / elite.length
        const vx = elite.reduce((s, c) => s + (c.wp[i].x - mx) ** 2, 0) / elite.length
        const vy = elite.reduce((s, c) => s + (c.wp[i].y - my) ** 2, 0) / elite.length
        mean[i] = { x: mx, y: my }
        std[i] = Math.max(14, Math.sqrt((vx + vy) / 2))
      }
    }
  }
  return { solutions, tried }
}
