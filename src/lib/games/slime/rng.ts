import type { Pt } from './types'
/** 시뮬·솔버용 시드 난수(엔진은 쓰지 않는다). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 표준정규(Box–Muller). */
export function gauss(rng: () => number): number {
  let u = 0
  while (u === 0) u = rng()
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/**
 * 사람형 봇(브리프 4-10 + 11-18 손가락 데이터 보정). 오차는 거리·길이에 비례하지 않는 px 단위 상수:
 * 전체 이동 벡터 하나(저주파) + 점마다 독립 편차(0.6배) + 떨림. **점당 총 rms가 σ가 되도록 보정**한다
 * (프로토타입은 ×0.5 버그로 σ가 0.78배였다 — 리뷰 지적 수정).
 */
export function perturb(dense: Pt[], sigma: number, tremor: number, rng: () => number): Pt[] {
  const so = sigma / Math.sqrt(1 + 0.36) // sqrt(so² + (0.6 so)²) = σ
  const ox = gauss(rng) * so
  const oy = gauss(rng) * so
  return dense.map((p) => ({
    x: p.x + ox + gauss(rng) * so * 0.6 + gauss(rng) * tremor,
    y: p.y + oy + gauss(rng) * so * 0.6 + gauss(rng) * tremor,
  }))
}

