import { FAR, placeAcorns } from '../src/lib/games/slime/stageBuilder'
import { checksFor, gateStage } from '../src/lib/games/slime/gate'
import type { Pt, Stage } from '../src/lib/games/slime/types'

const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
const mk = (id: string, tier: 1 | 2 | 3, terrain: Stage['terrain'], spawn: Pt, nest: Pt, spikes: Pt[], ink: number): Stage => ({ id, tier, terrain, spawn, acorns: FAR, nest, spikes, ink })

const group = process.argv[2]
const cands: Stage[] = []
if (group === 'tier1') {
  // 낙서(직선)가 풀려야 한다: 둥지 오른쪽에 완충벽, 경사를 완만하게
  for (const wall of [true]) for (const floorY of [470, 500]) for (const x0 of [200, 230])
    cands.push(mk(`t1-floor${floorY}-x${x0}`, 1, [seg(x0, floorY, 390, floorY), seg(386, floorY - 120, 386, floorY)], { x: 70, y: 100 }, { x: 320, y: floorY - 16 }, [], 520))
  void 0
} else {
  // tier3를 더 어렵게: 틈 벽 255, 밤송이, 잉크 축소
  for (const gx of [255, 258]) for (const spk of [0, 1]) for (const ink of [420, 520])
    cands.push(mk(`t3-x${gx}-${spk ? 'spk' : 'no'}-ink${ink}`, 3, [seg(0, 220, 170, 220), seg(gx, 330, gx, 560), seg(gx + 30, 500, 390, 500)], { x: 60, y: 90 }, { x: 345, y: 484 }, spk ? [{ x: 215, y: 330 }] : [], ink))
}
const runs = Number(process.env.RUNS ?? 150)
for (const c of cands) {
  const b = placeAcorns(c, 777)
  if (!b) { console.log(c.id, '해 없음'); continue }
  const g = gateStage(b, { runs, densityN: 2500, pop: 260 })
  const ch = checksFor(g)
  const f = ch.filter((x) => !x.pass).map((x) => x.item.split(' ')[0] + x.item.split(' ')[1] + '=' + x.value)
  console.log(`${c.id.padEnd(22)} 강건 ${String(g.robust).padStart(3)} 클 ${g.clusters} | c3 ${(g.bots.c3.full3 * 100).toFixed(0)} c6 ${(g.bots.c6.first * 100).toFixed(0)} c12 ${(g.bots.c12.first * 100).toFixed(0)}→${(g.bots.c12.within3 * 100).toFixed(0)} c20 ${(g.bots.c20.first * 100).toFixed(0)} 낙서 ${(g.bots.doodle.first * 100).toFixed(0)} | FAIL ${f.length}: ${f.join(' ')} | acorns ${JSON.stringify(b.acorns)}`)
}
