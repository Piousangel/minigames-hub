import { FAR, placeAcorns } from '../src/lib/games/slime/stageBuilder'
import { checksFor, gateStage } from '../src/lib/games/slime/gate'
import type { Pt, Stage } from '../src/lib/games/slime/types'

// 9번 후보: 독꽃 2개(좌우로 갈린 두 길 중 하나를 막는 배치) + tier2 벽 구조. 11-19 13시.
const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
const cands: Stage[] = []
const mkTerr = (top: number) => [seg(230, top, 230, 560), seg(252, 500, 390, 500), seg(350, 400, 350, 500)]
const sets: Pt[][] = [
  [{ x: 190, y: 240 }, { x: 160, y: 380 }],
  [{ x: 185, y: 235 }, { x: 150, y: 370 }],
]
sets.forEach((sp, i) => { for (const top of [310, 325]) for (const ink of [600]) cands.push({ id: `s9-${i}-top${top}-ink${ink}`, tier: 2, terrain: mkTerr(top), spawn: { x: 60, y: 90 }, acorns: FAR, nest: { x: 325, y: 484 }, spikes: sp, ink }) })
const runs = Number(process.env.RUNS ?? 100)
for (const c of cands) {
  const b = placeAcorns(c, 777)
  if (!b) { console.log(c.id, '해 없음'); continue }
  const g = gateStage(b, { runs, densityN: 2000, pop: 240 })
  const ch = checksFor(g)
  const fails = ch.filter((x) => !x.pass)
  console.log(`${c.id.padEnd(16)} 통과 ${ch.length - fails.length}/${ch.length} 강건 ${g.robust} 클 ${g.clusters} | c6 ${(g.bots.c6.first*100).toFixed(0)} c12 ${(g.bots.c12.first*100).toFixed(0)}→${(g.bots.c12.within3*100).toFixed(0)} c20 ${(g.bots.c20.first*100).toFixed(0)} 낙서 ${(g.bots.doodle.first*100).toFixed(0)} | FAIL: ${fails.map((x) => x.item.split(' ').slice(0,2).join('')+'='+x.value).join(' ')} | ${JSON.stringify(b.acorns)}`)
}
