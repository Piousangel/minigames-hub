import { GATE_STAGES } from '../src/lib/games/slime/stages'
import { checksFor, determinism, gateStage } from '../src/lib/games/slime/gate'
import { DEFAULT_PHYSICS } from '../src/lib/games/slime/types'

const runs = Number(process.env.RUNS ?? 400)
let allPass = true
for (const st of GATE_STAGES) {
  const t0 = Date.now()
  const g = gateStage(st, { runs, densityN: 4000 })
  const checks = checksFor(g)
  console.log(`\n=== ${st.id} (tier${st.tier}) — 해 ${g.solutions}, 강건 ${g.robust}, 클러스터 ${g.clusters}, 밀도 ${(g.density * 100).toFixed(2)}% (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  for (const id of ['c3', 'c6', 'c12', 'c20', 'doodle'] as const) {
    const b = g.bots[id]
    console.log(`  ${id.padEnd(6)} 1회차 ${(b.first * 100).toFixed(0).padStart(3)}%  3시도 ${(b.within3 * 100).toFixed(0).padStart(3)}%  만점 ${(b.full3 * 100).toFixed(0).padStart(3)}%  원인 ${JSON.stringify(b.reasons)}`)
  }
  for (const c of checks) {
    if (!c.pass) allPass = false
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.item}  →  ${c.value}`)
  }
}
console.log(`\nphysics default g=${DEFAULT_PHYSICS.g} e=${DEFAULT_PHYSICS.e} mu=${DEFAULT_PHYSICS.mu}`)
console.log(`determinism (g-slide straight-ish, 1000x): ${determinism(GATE_STAGES[0], [{ x: 62, y: 140 }, { x: 150, y: 300 }, { x: 240, y: 470 }])}`)
console.log(`\nALL PASS: ${allPass}`)
if (!allPass) process.exitCode = 1
