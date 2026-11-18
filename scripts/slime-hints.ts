// 스테이지별 '추천 길'(힌트)을 뽑는다: 강건 해 중 별 3개를 모두 먹고 σ12 생존율이 가장 높은 것.
import { solve, runLine, waypointsToRaw } from '../src/lib/games/slime/solver'
import { survival } from '../src/lib/games/slime/bots'
import { SLIME_STAGES } from '../src/lib/games/slime/stages'

for (const st of SLIME_STAGES) {
  const { solutions } = solve(st, 2026, { pop: 240 })
  const three = solutions.filter((s) => s.res.outcome === 'nest' && s.res.acorns === 3)
  const pool = (three.length ? three : solutions.filter((s) => s.res.outcome === 'nest')).slice(0, 12)
  let best = null as null | { wp: { x: number; y: number }[]; sv: number; ink: number }
  for (const s of pool) {
    const sv = survival(st, s, 10.3, 60, 99)
    if (!best || sv > best.sv) best = { wp: s.waypoints, sv, ink: s.inkUsed }
  }
  if (!best) { console.log(st.id, 'NONE'); continue }
  const chk = runLine(st, waypointsToRaw(best.wp))
  console.log(st.id, 'sv', best.sv.toFixed(2), 'ink', Math.round(best.ink), '/', st.ink, chk?.res.outcome, chk?.res.acorns)
  console.log(JSON.stringify(best.wp.map((p) => [Math.round(p.x), Math.round(p.y)])))
}
