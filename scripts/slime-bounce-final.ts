// 3단계 확정: r3 지형에서 '튕김 필요 + 그리기 구역(x 22~368, y 45~515) 안 + 별3' 해 중 σ12 생존율 최고.
import { solve } from '../src/lib/games/slime/solver'
import { simulate } from '../src/lib/games/slime/engine'
import { survival } from '../src/lib/games/slime/bots'
import { placeAcorns, FAR } from '../src/lib/games/slime/stageBuilder'
import type { Stage } from '../src/lib/games/slime/types'
const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
const base: Stage = {
  id: 's-bounce', tier: 2,
  terrain: [seg(255, 500, 390, 500), seg(350, 380, 350, 500), seg(233, 303, 233, 560), seg(145, 301, 263, 290)],
  spawn: { x: 60, y: 90 }, acorns: FAR, nest: { x: 325, y: 484 }, spikes: [], ink: 521, bouncy: [3],
}
const placed = placeAcorns(base, 777)
if (!placed) throw new Error('별 배치 실패')
const st: Stage = { ...placed, bouncy: [3] }
console.log('acorns', JSON.stringify(st.acorns.map((a) => [a.x, a.y])))
const inZone = (p: { x: number; y: number }) => p.x >= 22 && p.x <= 368 && p.y >= 45 && p.y <= 515
const noB: Stage = { ...st, bouncy: undefined }
for (const seed of [2026, 5, 77]) {
  const { solutions } = solve(st, seed, { pop: 160 })
  const pool = solutions.filter((s) => s.res.outcome === 'nest' && s.res.acorns === 3 && s.waypoints[0].x >= 22 && s.waypoints.every((p) => p.x >= 22 && p.x <= 368 && p.y >= 45 && p.y <= 540) && simulate(noB, [s.line]).outcome !== 'nest')
  let best: { sv: number; wp: { x: number; y: number }[]; ink: number } | null = null
  for (const s of pool.slice(0, 40)) {
    const sv = survival(st, s, 10.3, 50, 5)
    if (!best || sv > best.sv) best = { sv, wp: s.waypoints, ink: s.inkUsed }
  }
  console.log('seed', seed, '해', solutions.length, 'zone+튕김', pool.length, best ? `sv ${best.sv.toFixed(2)} ink ${Math.round(best.ink)}/${st.ink} ${JSON.stringify(best.wp.map((p) => [Math.round(p.x), Math.round(p.y)]))}` : 'NONE')
  void inZone
}
