// 엔진 속도: 합성 150선분 지형(곡선 스테이지 가정)에서 simulate 평균 시간.
import { simulate } from '../src/lib/games/slime/engine'
import { SLIME_STAGES } from '../src/lib/games/slime/stages'
import type { Stage } from '../src/lib/games/slime/types'
const base = SLIME_STAGES[0]
const terrain = [...base.terrain]
for (let i = 0; i < 150; i++) { const x = 20 + (i % 30) * 12, y = 300 + Math.floor(i / 30) * 40; terrain.push({ a: { x, y }, b: { x: x + 10, y: y + 3 } }) }
const st: Stage = { ...base, id: 'bench', terrain }
const line = [{ x: 50, y: 150 }, { x: 315, y: 488 }]
for (const [name, s] of [['기본 4선분', base], ['합성 150선분', st]] as const) {
  const N = 300; const t0 = performance.now()
  for (let i = 0; i < N; i++) simulate(s, [line])
  console.log(name, ((performance.now() - t0) / N).toFixed(3), 'ms/판')
}
