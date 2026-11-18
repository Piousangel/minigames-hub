import { GATE_STAGES } from '../src/lib/games/slime/stages'
import { gateStage } from '../src/lib/games/slime/gate'

// 물리 계수 9조합(g × μ)에서 각 스테이지가 풀리는지, c12 1회차가 기본값 대비 얼마나 변하는지.
const runs = Number(process.env.RUNS ?? 100)
const base: Record<string, number> = {}
for (const g of [900, 700, 1100]) {
  for (const mu of [0.08, 0.04, 0.12]) {
    const row: string[] = []
    for (const st of GATE_STAGES) {
      const r = gateStage(st, { runs, densityN: 600, pop: 200, phys: { g, e: 0.1, mu } })
      const v = r.bots.c12.first
      if (g === 900 && mu === 0.08) base[st.id] = v
      row.push(`${st.id} 강건${String(r.robust).padStart(3)} c12 ${(v * 100).toFixed(0).padStart(3)}%(${((v - (base[st.id] ?? v)) * 100).toFixed(0)}p) c20 ${(r.bots.c20.first * 100).toFixed(0)}%`)
    }
    console.log(`g=${g} mu=${mu}: ${row.join(' | ')}`)
  }
}
