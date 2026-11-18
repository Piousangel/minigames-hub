import { FAR, placeAcorns } from '../src/lib/games/slime/stageBuilder'
import { checksFor, gateStage } from '../src/lib/games/slime/gate'
import type { Pt, Stage } from '../src/lib/games/slime/types'

const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
const mk = (id: string, tier: 1 | 2, terrain: Stage['terrain'], spawn: Pt, nest: Pt, spikes: Pt[], ink: number): Stage => ({ id, tier, terrain, spawn, acorns: FAR, nest, spikes, ink })
const group = process.argv[2]
const cands: Stage[] = []
if (group === 'tier1') {
  // tier1 스테이지 2: 직선을 막는 밤송이 1개(곡선으로 피해야 함), 같은 완충 구조
  const base = [seg(230, 500, 390, 500), seg(350, 380, 350, 500)]
  for (const [sx, sy] of [[150, 270], [170, 300], [120, 230]] as const) for (const ink of [460, 520])
    cands.push(mk(`t1b-spk${sx}x${sy}-ink${ink}`, 1, base, { x: 70, y: 100 }, { x: 320, y: 484 }, [{ x: sx, y: sy }], ink))
} else {
  // 오너 피드백: 두 번째 tier2(s-wall-b, 벽 x=230)도 같은 방향으로 쉽게(보통 55~80, 캐주얼 ≥30)
  for (const top of [292, 298]) for (const ink of [540, 600])
    cands.push(mk(`t2h-wall230-top${top}-ink${ink}`, 2, [seg(230, top, 230, 560), seg(252, 500, 390, 500), seg(350, 400, 350, 500)], { x: 60, y: 90 }, { x: 325, y: 484 }, [], ink))
}
const runs = Number(process.env.RUNS ?? 120)
for (const c of cands) {
  const b = placeAcorns(c, 777)
  if (!b) { console.log(c.id, '해 없음'); continue }
  const g = gateStage(b, { runs, densityN: 2000, pop: 240 })
  const ch = checksFor(g)
  const fails = ch.filter((x) => !x.pass)
  console.log(`${c.id.padEnd(28)} 통과 ${ch.length - fails.length}/${ch.length} 강건 ${g.robust} 클 ${g.clusters} | c6 ${(g.bots.c6.first * 100).toFixed(0)} c12 ${(g.bots.c12.first * 100).toFixed(0)}→${(g.bots.c12.within3 * 100).toFixed(0)} c20 ${(g.bots.c20.first * 100).toFixed(0)} 낙서 ${(g.bots.doodle.first * 100).toFixed(0)} 직선 ${(g.bots.straight.first * 100).toFixed(0)} | FAIL: ${fails.map((x) => x.item.split(' ').slice(0, 2).join('') + '=' + x.value).join(' ')} | ${JSON.stringify(b.acorns)}`)
}
