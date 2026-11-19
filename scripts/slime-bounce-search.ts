// 3단계 '튕기는 벽' 후보 탐색: 튕김을 써야만 풀리는(튕김 제거 시 같은 선이 실패) 스테이지만 남긴다.
import { solve, runLine, waypointsToRaw } from '../src/lib/games/slime/solver'
import { simulate } from '../src/lib/games/slime/engine'
import { survival } from '../src/lib/games/slime/bots'
import { mulberry32 } from '../src/lib/games/slime/rng'
import { placeAcorns, FAR } from '../src/lib/games/slime/stageBuilder'
import type { Pt, Stage } from '../src/lib/games/slime/types'

const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
const rng = mulberry32(Number(process.env.SEED ?? 11))
const N = Number(process.env.CANDS ?? 10)
const out: string[] = []
for (let c = 0; c < N; c++) {
  const wallX = 190 + Math.floor(rng() * 60)
  const wallTop = 300 + Math.floor(rng() * 60)
  // 튕기는 판: 왼쪽 위~가운데, 기울기 무작위
  const bx = 80 + Math.floor(rng() * 160)
  const by = 220 + Math.floor(rng() * 120)
  const len = 70 + Math.floor(rng() * 50)
  const ang = (rng() - 0.5) * 1.4
  const bouncy = seg(bx, by, bx + Math.round(len * Math.cos(ang)), by + Math.round(len * Math.sin(ang)))
  const terrain = [seg(wallX + 22, 500, 390, 500), seg(350, 380, 350, 500), seg(wallX, wallTop, wallX, 560), bouncy]
  const base: Stage = { id: `bn${c}`, tier: 2, terrain, spawn: { x: 60, y: 90 }, acorns: FAR, nest: { x: 325, y: 484 }, spikes: [], ink: 520, bouncy: [3] }
  const placed = placeAcorns(base, 777)
  if (!placed) { out.push(`${c} 별 배치 실패`); continue }
  const st = { ...placed, bouncy: [3] }
  const { solutions } = solve(st, 2026, { pop: 100 })
  const good = solutions.filter((s) => s.res.outcome === 'nest' && s.res.acorns === 3)
  // 튕김을 써야만 풀리는가: 튕김을 뺀 스테이지에서 같은 선이 실패
  const noB: Stage = { ...st, bouncy: undefined }
  const needs = good.filter((s) => simulate(noB, [s.line]).outcome !== 'nest')
  let best: { sv: number; wp: Pt[] } | null = null
  for (const s of needs.slice(0, 8)) {
    const sv = survival(st, s, 10.3, 40, 5)
    if (!best || sv > best.sv) best = { sv, wp: s.waypoints }
  }
  out.push(`${c} wall(${wallX},${wallTop}) bounce(${bouncy.a.x},${bouncy.a.y})-(${bouncy.b.x},${bouncy.b.y}) 해 ${good.length} 튕김필요 ${needs.length} ${best ? `sv ${best.sv.toFixed(2)} ${JSON.stringify(best.wp.map((p) => [Math.round(p.x), Math.round(p.y)]))}` : ''}`)
  console.log(out[out.length - 1])
}
