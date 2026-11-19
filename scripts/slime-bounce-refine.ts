// 후보 9 주변을 다듬는다: 튕기는 판 위치·기울기를 조금씩 바꿔 '튕김 필요 + 손떨림 강건' 최고를 찾는다.
import { solve, runLine, waypointsToRaw } from '../src/lib/games/slime/solver'
import { simulate } from '../src/lib/games/slime/engine'
import { survival } from '../src/lib/games/slime/bots'
import { mulberry32 } from '../src/lib/games/slime/rng'
import { placeAcorns, FAR } from '../src/lib/games/slime/stageBuilder'
import type { Pt, Stage } from '../src/lib/games/slime/types'

const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
const mk = (wx: number, wt: number, b: [number, number, number, number], ink: number): Stage => ({
  id: 's-bounce', tier: 2,
  terrain: [seg(wx + 22, 500, 390, 500), seg(350, 380, 350, 500), seg(wx, wt, wx, 560), seg(...b)],
  spawn: { x: 60, y: 90 }, acorns: FAR, nest: { x: 325, y: 484 }, spikes: [], ink, bouncy: [3],
})
const cands: { name: string; st: Stage }[] = []
const rng = mulberry32(3)
for (let i = 0; i < Number(process.env.N ?? 8); i++) {
  const dx = Math.round((rng() - 0.5) * 30), dy = Math.round((rng() - 0.5) * 30), da = Math.round((rng() - 0.5) * 30)
  const b: [number, number, number, number] = [151 + dx, 296 + dy, 269 + dx, 284 + dy + da]
  cands.push({ name: `r${i} d(${dx},${dy},${da})`, st: mk(228 + Math.round((rng() - 0.5) * 16), 302 + Math.round((rng() - 0.5) * 16), b, 520 + Math.round(rng() * 80)) })
}
cands.unshift({ name: 'base9', st: mk(228, 302, [151, 296, 269, 284], 520) })
for (const { name, st } of cands) {
  const placed = placeAcorns(st, 777)
  if (!placed) { console.log(name, '별 실패'); continue }
  const s2 = { ...placed, bouncy: [3] }
  const { solutions } = solve(s2, 2026, { pop: 120 })
  const noB: Stage = { ...s2, bouncy: undefined }
  const needs = solutions.filter((s) => s.res.outcome === 'nest' && s.res.acorns === 3 && simulate(noB, [s.line]).outcome !== 'nest')
  let best: { sv: number; wp: Pt[] } | null = null
  for (const s of needs) {
    const sv = survival(s2, s, 10.3, 40, 5)
    if (!best || sv > best.sv) best = { sv, wp: s.waypoints }
  }
  // 길 모르는 사람의 무작위 선 성공률
  const nr = mulberry32(9); let ok = 0, tot = 0
  for (let k = 0; k < 300; k++) {
    const sx = 60 + (nr() - 0.5) * 60, sy = 140 + nr() * 40, ex = 325 + (nr() - 0.5) * 120, ey = 480 + (nr() - 0.3) * 40, bu = (nr() - 0.5) * 140
    const pts: Pt[] = []
    for (let i = 0; i <= 30; i++) { const t = i / 30; const nx = -(ey - sy), ny = ex - sx, nl = Math.hypot(nx, ny) || 1, off = bu * Math.sin(Math.PI * t); pts.push({ x: sx + (ex - sx) * t + (nx / nl) * off, y: sy + (ey - sy) * t + (ny / nl) * off }) }
    const r = runLine(s2, pts); if (!r) continue; tot++; if (r.res.outcome === 'nest') ok++
  }
  console.log(`${name.padEnd(18)} wall(${s2.terrain[2].a.x},${s2.terrain[2].a.y}) pad ${JSON.stringify([s2.terrain[3].a, s2.terrain[3].b].map((p) => [p.x, p.y]))} ink ${s2.ink} 해 ${solutions.length} 튕김필요 ${needs.length} ${best ? `sv ${best.sv.toFixed(2)} ${JSON.stringify(best.wp.map((p) => [Math.round(p.x), Math.round(p.y)]))}` : ''} naive ${tot ? Math.round((100 * ok) / tot) : 0}% acorns ${JSON.stringify(s2.acorns.map((a) => [a.x, a.y]))}`)
}
