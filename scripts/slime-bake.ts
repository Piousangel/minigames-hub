import { FAR, placeAcorns } from '../src/lib/games/slime/stageBuilder'
import { checksFor, gateStage } from '../src/lib/games/slime/gate'
import type { Pt, Stage } from '../src/lib/games/slime/types'
const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
const st = (id: string, tier: 2 | 3, terrain: Stage['terrain'], spawn: Pt, nest: Pt, spikes: Pt[], ink: number): Stage => ({ id, tier, terrain, spawn, acorns: FAR, nest, spikes, ink })
const which = process.argv[2]
if (which !== 'wall' && which !== 'gap') {
  console.error('사용법: npx tsx scripts/slime-bake.ts <wall|gap>  (출력된 acorns를 stages.ts에 직접 반영)')
  process.exit(2)
}
const cands: Stage[] =
  which === 'wall'
    ? [st('g-wall', 2, [seg(200, 260, 200, 560), seg(222, 500, 390, 500)], { x: 70, y: 80 }, { x: 330, y: 484 }, [], 520)]
    : [st('g-gap-a', 3, [seg(0, 220, 170, 220), seg(250, 330, 250, 560), seg(280, 500, 390, 500)], { x: 60, y: 90 }, { x: 345, y: 484 }, [], 680),
       st('g-gap-b', 3, [seg(0, 220, 170, 220), seg(270, 330, 270, 560), seg(300, 500, 390, 500)], { x: 60, y: 90 }, { x: 345, y: 484 }, [], 680),
       st('g-gap-c', 3, [seg(0, 250, 190, 250), seg(260, 300, 260, 560), seg(290, 500, 390, 500)], { x: 60, y: 90 }, { x: 345, y: 484 }, [], 720)]
for (const c of cands) {
  const b = placeAcorns(c, 777)
  if (!b) { console.log(c.id, '해 없음'); continue }
  const g = gateStage(b, { runs: Number(process.env.RUNS ?? 200), densityN: 3000, pop: 300 })
  const ch = checksFor(g)
  console.log(`\n=== ${b.id} tier${b.tier} acorns ${JSON.stringify(b.acorns)} ink ${b.ink}`)
  console.log(`강건 ${g.robust} 클러스터 ${g.clusters} 밀도 ${(g.density * 100).toFixed(2)}%`)
  for (const id of ['c3', 'c6', 'c12', 'c20', 'doodle'] as const) { const x = g.bots[id]; console.log(`  ${id.padEnd(6)} 1회차 ${(x.first * 100).toFixed(0)}% 3시도 ${(x.within3 * 100).toFixed(0)}% 만점 ${(x.full3 * 100).toFixed(0)}% ${JSON.stringify(x.reasons)}`) }
  for (const x of ch) console.log(`  ${x.pass ? 'PASS' : 'FAIL'}  ${x.item} → ${x.value}`)
}
