// A3 'Stone Wall' = 언덕 + 독꽃 1개 + 벽(233,303)-(233,560), 바닥 시작 x=255. A4(s-bounce)는 여기에 쿠션을 더하고 독꽃을 뺀 판.
import { solve, runLine } from '../src/lib/games/slime/solver'
import { survival } from '../src/lib/games/slime/bots'
import { placeAcorns, FAR } from '../src/lib/games/slime/stageBuilder'
import { simulate } from '../src/lib/games/slime/engine'
import { mulberry32 } from '../src/lib/games/slime/rng'
import { SLIME_STAGES } from '../src/lib/games/slime/stages'
import type { Pt, Stage } from '../src/lib/games/slime/types'
const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
const terrain = [seg(255, 500, 390, 500), seg(350, 380, 350, 500), seg(233, 303, 233, 560)]
const SP = process.env.SPIKE ? (JSON.parse(process.env.SPIKE) as Pt[]) : [{ x: 120, y: 200 }]
const base: Stage = { id: 'c-wall', tier: 2, terrain, spawn: { x: 70, y: 100 }, acorns: FAR, nest: { x: 320, y: 484 }, spikes: SP, ink: 540 }
const placed = placeAcorns(base, 777)
if (!placed) throw new Error('별 배치 실패')
const st: Stage = { ...placed, spikes: SP }
console.log('spikes', JSON.stringify(SP.map((p) => [p.x, p.y])), 'acorns', JSON.stringify(st.acorns.map((a) => [a.x, a.y])))
const a2 = SLIME_STAGES.find((s) => s.id === 'c-meadow')!
const a2sol = solve(a2, 2026, { pop: 80 }).solutions.filter((s) => s.res.outcome === 'nest').slice(0, 40)
console.log('A2 해 중 A3에서 도착', a2sol.filter((s) => simulate(st, [s.line]).outcome === 'nest').length, '/', a2sol.length)
const { solutions } = solve(st, 2026, { pop: 160 })
const good = solutions.filter((s) => s.res.outcome === 'nest' && s.res.acorns === 3 && s.waypoints[0].x >= 22 && s.waypoints.every((p) => p.x >= 22 && p.x <= 368 && p.y >= 45 && p.y <= 540))
let best: { sv: number; wp: Pt[]; ink: number } | null = null
for (const s of good.slice(0, 40)) { const sv = survival(st, s, 10.3, 50, 5); if (!best || sv > best.sv) best = { sv, wp: s.waypoints, ink: s.inkUsed } }
console.log('해', solutions.length, '별3·구역내', good.length, best ? `sv ${best.sv.toFixed(2)} ink ${Math.round(best.ink)}/${st.ink} ${JSON.stringify(best.wp.map((p) => [Math.round(p.x), Math.round(p.y)]))}` : 'NONE')
const nr = mulberry32(9); let ok = 0, tot = 0
for (let k = 0; k < 400; k++) {
  const sx = 70 + (nr() - 0.5) * 60, sy = 140 + nr() * 40, ex = 320 + (nr() - 0.5) * 120, ey = 480 + (nr() - 0.3) * 40, bu = (nr() - 0.5) * 140
  const pts: Pt[] = []
  for (let i = 0; i <= 30; i++) { const t = i / 30; const nx = -(ey - sy), ny = ex - sx, nl = Math.hypot(nx, ny) || 1, off = bu * Math.sin(Math.PI * t); pts.push({ x: sx + (ex - sx) * t + (nx / nl) * off, y: sy + (ey - sy) * t + (ny / nl) * off }) }
  const r = runLine(st, pts); if (!r) continue; tot++; if (r.res.outcome === 'nest') ok++
}
console.log('무작위 선 성공률', Math.round((100 * ok) / tot) + '%')
