// A2 'Poison Meadow' = 1단계 언덕(g-slide 지형) + 독꽃 2개(120,200),(190,320). 별 배치·해·힌트·콜백 성질(1단계 해가 막히는 비율) 측정.
import { solve, runLine, waypointsToRaw } from '../src/lib/games/slime/solver'
import { survival } from '../src/lib/games/slime/bots'
import { placeAcorns, FAR } from '../src/lib/games/slime/stageBuilder'
import { simulate } from '../src/lib/games/slime/engine'
import { mulberry32 } from '../src/lib/games/slime/rng'
import { SLIME_STAGES, STAGE_HINTS } from '../src/lib/games/slime/stages'
import type { Pt, Stage } from '../src/lib/games/slime/types'

const a1 = SLIME_STAGES[0]
const spikes: Pt[] = [{ x: 120, y: 200 }, { x: 190, y: 320 }]
const base: Stage = { ...a1, id: 'c-meadow', acorns: FAR, spikes, ink: 520 }
const placed = placeAcorns(base, 777)
if (!placed) throw new Error('별 배치 실패')
const st: Stage = { ...placed, spikes }
console.log('acorns', JSON.stringify(st.acorns.map((a) => [a.x, a.y])))
// 콜백 성질: A1의 추천 길(해)이 A2에서 살아남는가
const a1line = runLine(a1, waypointsToRaw(STAGE_HINTS[a1.id]))!.line
console.log('A1 추천 길 → A2 결과:', simulate(st, [a1line]).outcome)
const { solutions } = solve(st, 2026, { pop: 160 })
const good = solutions.filter((s) => s.res.outcome === 'nest' && s.res.acorns === 3 && s.waypoints[0].x >= 22 && s.waypoints.every((p) => p.x >= 22 && p.x <= 368 && p.y >= 45 && p.y <= 540))
let best: { sv: number; wp: Pt[]; ink: number } | null = null
for (const s of good.slice(0, 30)) { const sv = survival(st, s, 10.3, 50, 5); if (!best || sv > best.sv) best = { sv, wp: s.waypoints, ink: s.inkUsed } }
console.log('해', solutions.length, '별3·구역내', good.length, best ? `sv ${best.sv.toFixed(2)} ink ${Math.round(best.ink)}/${st.ink} ${JSON.stringify(best.wp.map((p) => [Math.round(p.x), Math.round(p.y)]))}` : 'NONE')
// 길 모르는 무작위 선 성공률 + A1 해 통과율(해 클러스터 기준)
const nr = mulberry32(9); let ok = 0, tot = 0
for (let k = 0; k < 400; k++) {
  const sx = 70 + (nr() - 0.5) * 60, sy = 140 + nr() * 40, ex = 320 + (nr() - 0.5) * 120, ey = 480 + (nr() - 0.3) * 40, bu = (nr() - 0.5) * 140
  const pts: Pt[] = []
  for (let i = 0; i <= 30; i++) { const t = i / 30; const nx = -(ey - sy), ny = ex - sx, nl = Math.hypot(nx, ny) || 1, off = bu * Math.sin(Math.PI * t); pts.push({ x: sx + (ex - sx) * t + (nx / nl) * off, y: sy + (ey - sy) * t + (ny / nl) * off }) }
  const r = runLine(st, pts); if (!r) continue; tot++; if (r.res.outcome === 'nest') ok++
}
console.log('무작위 선 성공률', Math.round((100 * ok) / tot) + '%')
const a1sol = solve(a1, 2026, { pop: 80 }).solutions.filter((s) => s.res.outcome === 'nest').slice(0, 40)
const pass = a1sol.filter((s) => simulate(st, [s.line]).outcome === 'nest').length
console.log('A1 해 통과율(A2에서 여전히 도착)', pass, '/', a1sol.length)
