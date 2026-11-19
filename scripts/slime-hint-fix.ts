// 추천 길의 시작점을 그리기 구역(x 22 이상) 안으로 옮기면서 도착·별3·강건성이 유지되는 값을 찾는다.
import { runLine, waypointsToRaw } from '../src/lib/games/slime/solver'
import { survival } from '../src/lib/games/slime/bots'
import { SLIME_STAGES, STAGE_HINTS } from '../src/lib/games/slime/stages'
for (const st of SLIME_STAGES.filter((s) => !s.id.endsWith('-m') && (process.env.ONLY ? s.id === process.env.ONLY : true))) {
  const base = STAGE_HINTS[st.id]
  let best: { wp: typeof base; sv: number } | null = null
  for (const x of [22, 26, 30, 36, 44, 56, 70]) for (const dy of [-50, -36, -24, -12, -6, 0, 6, 12, 24, 36, 50]) for (const mid of [-30, -15, 0, 15, 30]) {
    const wp = base.map((p, i) => (i === 0 ? { x, y: p.y + dy } : i === 1 ? { x: p.x + mid, y: Math.min(p.y, 515) } : p))
    const r = runLine(st, waypointsToRaw(wp))
    if (r?.res.outcome !== 'nest' || r.res.acorns !== 3) continue
    const sv = survival(st, { waypoints: wp, line: r.line, res: r.res, inkUsed: 0 }, 10.3, 60, 99)
    if (!best || sv > best.sv) best = { wp, sv }
  }
  console.log(st.id, best ? `sv ${best.sv.toFixed(2)} ${JSON.stringify(best.wp.map((p) => [Math.round(p.x), Math.round(p.y)]))}` : 'NONE')
}
