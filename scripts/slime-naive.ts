// 시험판 PM 지적 대응: '경로를 모르는' 사람이 그을 법한 선(시작=말랑이 아래 근처, 끝=꽃 방향, 좌우 휨 무작위)의 성공률.
import { runLine } from '../src/lib/games/slime/solver'
import { SLIME_STAGES } from '../src/lib/games/slime/stages'
import { mulberry32 } from '../src/lib/games/slime/rng'
import type { Pt } from '../src/lib/games/slime/types'

const N = Number(process.env.N ?? 600)
for (const st of SLIME_STAGES) {
  const rng = mulberry32(4242)
  const out: Record<string, number> = {}
  let ok = 0, stars3 = 0, valid = 0
  for (let k = 0; k < N; k++) {
    const sx = st.spawn.x + (rng() - 0.5) * 60
    const sy = st.spawn.y + 50 + rng() * 40
    const ex = st.nest.x + (rng() - 0.5) * 120
    const ey = st.nest.y + (rng() - 0.3) * 40
    const bulge = (rng() - 0.5) * 140
    const pts: Pt[] = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const nx = -(ey - sy), ny = ex - sx
      const nl = Math.hypot(nx, ny) || 1
      const off = bulge * Math.sin(Math.PI * t)
      pts.push({ x: sx + (ex - sx) * t + (nx / nl) * off, y: sy + (ey - sy) * t + (ny / nl) * off })
    }
    const r = runLine(st, pts)
    if (!r) continue
    valid++
    out[r.res.outcome] = (out[r.res.outcome] ?? 0) + 1
    if (r.res.outcome === 'nest') { ok++; if (r.res.acorns === 3) stars3++ }
  }
  console.log(st.id.padEnd(10), `유효 ${valid}`, `도착 ${((ok / valid) * 100).toFixed(0)}%`, `별3 ${((stars3 / valid) * 100).toFixed(0)}%`, JSON.stringify(out))
}
