// 그리기 구역(x 22~368, y 45~515) 안에서만 움직이는 추천 길 중 별3·σ12 생존율 최고를 뽑는다.
import { solve, runLine, waypointsToRaw } from '../src/lib/games/slime/solver'
import { survival } from '../src/lib/games/slime/bots'
import { SLIME_STAGES } from '../src/lib/games/slime/stages'
const only = process.env.ONLY ?? 's-spike'
const inZone = (p: { x: number; y: number }) => p.x >= 22 && p.x <= 368 && p.y >= 45 && p.y <= 515
for (const st of SLIME_STAGES.filter((s) => s.id === only)) {
  for (const seed of [2026, 7, 99]) {
    const { solutions } = solve(st, seed, { pop: 240 })
    const pool = solutions.filter((s) => s.res.outcome === 'nest' && s.res.acorns === 3 && s.waypoints.every(inZone))
    let best = null as null | { wp: { x: number; y: number }[]; sv: number }
    for (const s of pool.slice(0, 15)) {
      const sv = survival(st, s, 10.3, 60, 99)
      if (!best || sv > best.sv) best = { wp: s.waypoints, sv }
    }
    console.log(st.id, 'seed', seed, 'pool', pool.length, best ? `sv ${best.sv.toFixed(2)} ${JSON.stringify(best.wp.map((p) => [Math.round(p.x), Math.round(p.y)]))}` : 'NONE')
    if (best) break
  }
}
