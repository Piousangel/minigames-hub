/** 뿅 착지 봇 시뮬레이터(G2). 홀드 시간에 비례 노이즈를 주는 봇으로 난이도·실패 원인 분포를 본다. */
import { type EndReason, type Phase, type PlopState, mulberry32, newGame, ensureIslands, press, release, tick, rangeMax, pingOf } from './engine'

export interface BotCfg {
  /** 홀드 시간의 상대 표준편차(0.08=8%). sigmaMs가 있으면 무시 */
  sigma: number
  /** 상수 오차(ms): 게이지를 눈으로 보고 누르는 사람의 지터는 홀드 길이와 무관하게 거의 일정하다(독립 리뷰 지적) */
  sigmaMs?: number
  thinkMinMs: number
  thinkMaxMs: number
}

export type WindBucket = 'none' | 'light' | 'strong'
export const bucketOf = (w: number): WindBucket => (w === 0 ? 'none' : Math.abs(w) < 0.1 ? 'light' : 'strong')
const phaseOf = (st: PlopState): Phase => st.phase

export interface RunResult {
  /** 바람 구간별 [점프 수, 사망 수] */
  buckets: Record<WindBucket, [number, number]>
  landed: number
  perfects: number
  score: number
  reason: EndReason
  jumps: number
  /** 시뮬 시간(ms, 비행·대기 포함) */
  ms: number
}

function gauss(rnd: () => number): number {
  const u = Math.max(1e-9, rnd())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
}

export function playBot(seed: number, cfg: BotCfg, noiseSeed: number, maxLanded = 80): RunResult {
  const rnd = mulberry32(noiseSeed)
  const st = newGame(seed)
  let jumps = 0
  const buckets: Record<WindBucket, [number, number]> = { none: [0, 0], light: [0, 0], strong: [0, 0] }
  while (st.phase !== 'over' && st.landed < maxLanded && jumps < 400) {
    if (phaseOf(st) !== 'ready') break
    const think = cfg.thinkMinMs + rnd() * (cfg.thinkMaxMs - cfg.thinkMinMs)
    tick(st, think)
    if (phaseOf(st) === 'over') break
    ensureIslands(st, st.cur + 4)
    const from = st.islands[st.cur]
    const target = st.islands[st.cur + 1]
    const pStar = Math.min(1, (target.cx - from.cx) / rangeMax(target.wind))
    const tStar = pStar * pingOf(st.cur + 1)
    const hold = Math.max(1, cfg.sigmaMs !== undefined ? tStar + cfg.sigmaMs * gauss(rnd) : tStar * (1 + cfg.sigma * gauss(rnd)))
    press(st, st.clock)
    const b = bucketOf(target.wind)
    if (release(st, st.clock + hold)) {
      jumps += 1
      tick(st, st.flight!.durMs)
      // 바람 공정성은 같은 구간(섬 6~24)끼리만 비교한다(후반 점프는 섬 크기 때문에 원래 더 위험)
      if (st.cur + 1 >= 6 && st.cur + 1 <= 24) {
        buckets[b][0] += 1
        if (phaseOf(st) === 'over') buckets[b][1] += 1
      }
    }
  }
  return { buckets, landed: st.landed, perfects: st.perfects, score: st.score, reason: st.endReason, jumps, ms: st.clock }
}

export interface Report {
  n: number
  medianLanded: number
  p10: number
  p90: number
  perfectRatio: number
  first5: number
  reasons: Record<string, number>
  medianSec: number
  /** 바람 구간별 점프당 사망률 */
  deathRate: Record<WindBucket, number>
  /** 센 바람 사망률 ÷ 약한 바람 사망률(같은 단계 비교, 1에 가까울수록 바람이 공정. 무풍 구간은 안전 섬이라 기준으로 못 씀) */
  windRatio: number
}

export function simulate(cfg: BotCfg, n = 1000, seedBase = 1000, maxLanded = 80): Report {
  const res: RunResult[] = []
  for (let k = 0; k < n; k++) res.push(playBot(seedBase + k * 7919, cfg, 0xbeef + k, maxLanded))
  const sorted = res.map((r) => r.landed).sort((a, b) => a - b)
  const q = (f: number) => sorted[Math.min(n - 1, Math.floor(f * n))]
  const landed = res.reduce((s, r) => s + r.landed, 0)
  const perf = res.reduce((s, r) => s + r.perfects, 0)
  const reasons: Record<string, number> = {}
  for (const r of res) reasons[r.reason ?? 'cap'] = (reasons[r.reason ?? 'cap'] ?? 0) + 1 / n
  const agg: Record<WindBucket, [number, number]> = { none: [0, 0], light: [0, 0], strong: [0, 0] }
  for (const r of res) for (const k of ['none', 'light', 'strong'] as const) { agg[k][0] += r.buckets[k][0]; agg[k][1] += r.buckets[k][1] }
  const rate = (k: WindBucket) => (agg[k][0] ? agg[k][1] / agg[k][0] : 0)
  const secs = res.map((r) => r.ms / 1000).sort((a, b) => a - b)
  return {
    n,
    medianLanded: q(0.5),
    p10: q(0.1),
    p90: q(0.9),
    perfectRatio: landed ? perf / landed : 0,
    first5: res.filter((r) => r.landed >= 5).length / n,
    reasons,
    medianSec: secs[Math.floor(n / 2)],
    deathRate: { none: rate('none'), light: rate('light'), strong: rate('strong') },
    windRatio: rate('light') > 0 ? rate('strong') / rate('light') : 0,
  }
}

export const BOTS = {
  s8: { sigma: 0.08, thinkMinMs: 400, thinkMaxMs: 1500 },
  s12: { sigma: 0.12, thinkMinMs: 400, thinkMaxMs: 1500 },
  s18: { sigma: 0.18, thinkMinMs: 400, thinkMaxMs: 1500 },
  /** 느리게 읽는 플레이어: 사고 0.8~3.0초. 가라앉는 섬 규칙이 얼마나 무는지 본다 */
  /** 상수 오차 봇(사람형): 20ms=매우 숙련, 30ms=숙련, 40ms=보통 */
  c20: { sigma: 0, sigmaMs: 20, thinkMinMs: 400, thinkMaxMs: 1500 },
  c30: { sigma: 0, sigmaMs: 30, thinkMinMs: 400, thinkMaxMs: 1500 },
  c40: { sigma: 0, sigmaMs: 40, thinkMinMs: 400, thinkMaxMs: 1500 },
  /** 캐주얼(60·80ms): 너무 어려워지지 않았는지 확인 */
  c60: { sigma: 0, sigmaMs: 60, thinkMinMs: 400, thinkMaxMs: 1500 },
  c80: { sigma: 0, sigmaMs: 80, thinkMinMs: 400, thinkMaxMs: 1500 },
  slow: { sigma: 0.12, thinkMinMs: 800, thinkMaxMs: 3000 },
} satisfies Record<string, BotCfg>
