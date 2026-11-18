import { FAR, placeAcorns } from '../src/lib/games/slime/stageBuilder'
import { checksFor, gateStage } from '../src/lib/games/slime/gate'
import type { Pt, Stage } from '../src/lib/games/slime/types'

const t = (id: string, tier: 1 | 2 | 3, terrain: Stage['terrain'], spawn: Pt, nest: Pt, spikes: Pt[], ink: number): Stage => ({ id, tier, terrain, spawn, acorns: FAR, nest, spikes, ink })
const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })

const cands: Stage[] = []
for (const top of [260, 310]) for (const spike of [false, true]) for (const ink of [480, 600])
  cands.push(t(`wall-top${top}-${spike ? 'spk' : 'no'}-ink${ink}`, 2, [seg(200, top, 200, 560), seg(222, 500, 390, 500)], { x: 70, y: 80 }, { x: 330, y: 484 }, spike ? [{ x: 275, y: 400 }] : [], ink))
for (const gapX of [250, 270]) for (const spk of [false, true]) for (const ink of [560, 680])
  cands.push(t(`gap-x${gapX}-${spk ? 'spk' : 'no'}-ink${ink}`, 3, [seg(0, 220, 170, 220), seg(gapX, 330, gapX, 560), seg(gapX + 30, 500, 390, 500)], { x: 60, y: 90 }, { x: 345, y: 484 }, spk ? [{ x: 205, y: 430 }] : [], ink))

const runs = Number(process.env.RUNS ?? 120)
for (const c of cands) {
  const st = placeAcorns(c, 777)
  if (!st) { console.log(`${c.id}: 해 없음`); continue }
  const g = gateStage(st, { runs, densityN: 1500, pop: 250 })
  const ch = checksFor(g)
  const fails = ch.filter((x) => !x.pass).map((x) => x.item.split(' ')[0] + '=' + x.value)
  console.log(`${c.id.padEnd(26)} 강건 ${String(g.robust).padStart(3)} 클러스터 ${g.clusters} 밀도 ${(g.density * 100).toFixed(1)}%  c6 ${(g.bots.c6.first * 100).toFixed(0)}/c12 ${(g.bots.c12.first * 100).toFixed(0)}→${(g.bots.c12.within3 * 100).toFixed(0)}/c20 ${(g.bots.c20.first * 100).toFixed(0)}/낙서 ${(g.bots.doodle.first * 100).toFixed(0)}  FAIL ${fails.length}: ${fails.join(' ')}`)
}
