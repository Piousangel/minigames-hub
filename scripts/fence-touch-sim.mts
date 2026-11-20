/**
 * 꽃담 정원 G1: 합성 손가락(등방 가우스 σpx)으로 울타리 탭 판정 방식별 적중률을 잰다.
 * 실행: node --experimental-strip-types scripts/fence-touch-sim.mts
 * 판 폭 340px(390 화면 − 여백), σ는 화면 CSS px. iPhone 390pt 폭 ≈ 64mm → 1px ≈ 0.165mm.
 */
import { hitStats, mulberry32, syntheticTaps, type HitMode } from '../src/lib/games/fencegarden/engine.ts'

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

// 규칙 v2의 울타리 방향 고르기(상하좌우 쐐기, 말랑이 중심 0.25칸 안은 판정 안 함).
// 리뷰(11-20): 조준점 0.8칸만 재면 낙관적 — 사람은 점선(변, 0.5칸)을 노릴 수 있다. 조준 0.5·0.8 × 아래쪽 치우침 0·8px.
// 방향은 위·오른·아래·왼 네 개를 고르게(치우침이 위/아래 방향에서 다르게 작용).
console.log('\nv2 방향 고르기(쐐기) — 맞음 % (네 방향 평균)')
console.log('n | 조준 | 치우침 | σ8 | σ12 | σ15 | σ20')
for (const n of [5, 7]) {
  const cellPx = board / n
  for (const aim of [0.5, 0.8]) {
    for (const bias of [0, 8]) {
      const cols: string[] = []
      for (const sigma of [8, 12, 15, 20]) {
        const rnd = mulberry32(7000 + n * 13 + sigma + Math.round(aim * 10) + bias)
        let ok = 0
        const N = 20000
        for (let i = 0; i < N; i++) {
          const u = Math.max(rnd(), 1e-12)
          const v = rnd()
          const g1 = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
          const g2 = Math.sqrt(-2 * Math.log(u)) * Math.sin(2 * Math.PI * v)
          const side = i % 4 // 0 위 1 오른 2 아래 3 왼
          const ax = side === 1 ? aim : side === 3 ? -aim : 0
          const ay = side === 2 ? aim : side === 0 ? -aim : 0
          const dx = ax + (g1 * sigma) / cellPx
          const dy = ay + (g2 * sigma + bias) / cellPx
          if (Math.hypot(dx, dy) < 0.25) continue
          const got = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0
          if (got === side) ok++
        }
        cols.push(((100 * ok) / N).toFixed(1))
      }
      console.log([`${n}×${n}`, aim, `${bias}px`, ...cols].join(' | '))
    }
  }
}
