import { survival } from './bots'
import { simulate } from './engine'
import { solve } from './solver'
import type { Pt, Stage } from './types'

/** 도토리 자리표시(화면 밖). 솔버가 도토리와 무관하게 해를 찾게 할 때 쓴다. */
export const FAR: [Pt, Pt, Pt] = [{ x: -90, y: -90 }, { x: -90, y: -90 }, { x: -90, y: -90 }]

/**
 * 도토리를 가장 강건한 해의 궤적 위(25/55/85%)에 놓는다 → "도토리 3개를 먹는 강건한 해"가 최소 하나 존재.
 * 해가 없으면 null(스테이지 설계 불가).
 */
export function placeAcorns(base: Stage, seed: number): Stage | null {
  const st: Stage = { ...base, acorns: FAR }
  const { solutions } = solve(st, seed, { pop: 300, rounds: 5, robustTrials: 4, robustSigma: 9 })
  if (!solutions.length) return null
  const cand = solutions.slice(0, 120).map((s) => ({ s, v: survival(st, s, 12, 24, seed + 5) }))
  cand.sort((a, b) => b.v - a.v)
  const tr: Pt[] = []
  simulate(st, [cand[0].s.line], undefined, tr)
  if (tr.length < 8) return null
  const at = (f: number) => {
    const p = tr[Math.min(tr.length - 1, Math.floor(tr.length * f))]
    return { x: Math.round(p.x), y: Math.round(p.y) }
  }
  return { ...st, acorns: [at(0.25), at(0.55), at(0.85)] }
}
