/**
 * 꽃담 정원 G1: 합성 손가락(등방 가우스 σpx)으로 울타리 탭 판정 방식별 적중률을 잰다.
 * 실행: node --experimental-strip-types scripts/fence-touch-sim.mts
 * 판 폭 340px(390 화면 − 여백), σ는 화면 CSS px. iPhone 390pt 폭 ≈ 64mm → 1px ≈ 0.165mm.
 */
import { hitStats, syntheticTaps, type HitMode } from '../src/lib/games/fencegarden/engine.ts'

const modes: [string, HitMode][] = [
  ['strip .15', { kind: 'strip', tol: 0.15 }],
  ['strip .25', { kind: 'strip', tol: 0.25 }],
  ['nearest', { kind: 'nearest' }],
]
const board = Number(process.argv[2] ?? 340)
console.log(`board ${board}px`)
console.log(['n', 'cell', 'σpx', 'σmm', ...modes.map(([k]) => `${k} hit/miss/wrong`)].join(' | '))
for (const n of [5, 6, 7]) {
  for (const sigma of [4, 6, 8, 10, 12, 15]) {
    const taps = syntheticTaps(n, board, sigma, 200, 1000 + n * 31 + sigma)
    const cols = modes.map(([, m]) => {
      const s = hitStats(taps, m)
      const pct = (x: number) => ((100 * x) / s.taps).toFixed(1)
      return `${pct(s.hit)}/${pct(s.miss)}/${pct(s.wrong)}`
    })
    console.log([n, (board / n).toFixed(0), sigma, (sigma * 0.165).toFixed(1), ...cols].join(' | '))
  }
}

// 규칙 v2의 울타리 방향 고르기: 말랑이 칸 중심에서 0.8칸 떨어진 곳을 노려 누른다(상하좌우 큰 영역, 중심 0.25칸 안은 판정 안 함).
console.log('\nv2 방향 고르기(상하좌우 쐐기) — 맞음/무시/틀림 %')
for (const n of [5, 7]) {
  for (const sigma of [8, 12, 15, 20]) {
    const cellPx = board / n
    let ok = 0
    let none = 0
    let bad = 0
    const N = 20000
    let seed = 99 + sigma
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    for (let i = 0; i < N; i++) {
      const u = Math.max(rnd(), 1e-12)
      const v = rnd()
      const g1 = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      const g2 = Math.sqrt(-2 * Math.log(u)) * Math.sin(2 * Math.PI * v)
      const dx = 0.8 + (g1 * sigma) / cellPx
      const dy = (g2 * sigma) / cellPx
      if (Math.hypot(dx, dy) < 0.25) none++
      else if (Math.abs(dx) > Math.abs(dy) && dx > 0) ok++
      else bad++
    }
    console.log(`${n}×${n} σ${sigma}px: ${((100 * ok) / N).toFixed(1)} / ${((100 * none) / N).toFixed(1)} / ${((100 * bad) / N).toFixed(1)}`)
  }
}
