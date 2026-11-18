import { GATE_STAGES } from '../src/lib/games/slime/stages'
import { gateStage } from '../src/lib/games/slime/gate'

// 물리 계수 9조합(g × μ): 각 스테이지에서 (1) 강건한 해가 존재하는가 (2) c12 1회차가 기본값 대비 ±15%p 이내인가.
const runs = Number(process.env.RUNS ?? 100)
const base: Record<string, number> = {}
const worst: Record<string, number> = {}
const minRobust: Record<string, number> = {}
for (const g of [900, 700, 1100]) {
  for (const mu of [0.08, 0.04, 0.12]) {
    const row: string[] = []
    for (const st of GATE_STAGES) {
      const r = gateStage(st, { runs, densityN: 600, pop: 200, phys: { g, e: 0.1, mu } })
      const v = r.bots.c12.first
      if (g === 900 && mu === 0.08) base[st.id] = v
      const d = Math.abs(v - (base[st.id] ?? v)) * 100
      worst[st.id] = Math.max(worst[st.id] ?? 0, d)
      minRobust[st.id] = Math.min(minRobust[st.id] ?? 1e9, r.robust)
      row.push(`${st.id} 강건${String(r.robust).padStart(3)} c12 ${(v * 100).toFixed(0).padStart(3)}%(${((v - (base[st.id] ?? v)) * 100).toFixed(0)}p)`)
    }
    console.log(`g=${g} mu=${mu}: ${row.join(' | ')}`)
  }
}
let ok = true
for (const st of GATE_STAGES) {
  const pass = worst[st.id] <= 15 && minRobust[st.id] >= 1
  if (!pass) ok = false
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${st.id}: c12 1회차 최대 변동 ${worst[st.id].toFixed(0)}%p (≤15), 최소 강건한 해 ${minRobust[st.id]}개 (≥1)`)
}
console.log(`PHYSICS9 ALL PASS: ${ok}`)
if (!ok) process.exitCode = 1
