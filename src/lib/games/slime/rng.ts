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
 * 사람형 봇(브리프 4-10 + 11-18 손가락 데이터 보정). 오차는 거리·길이에 비례하지 않는 px 단위 상수이고 **매끄럽다**:
 * 전체 이동 벡터 하나(저주파) + 천천히 변하는 편차(상관 길이 ≈60px, 크기 0.6배) + 작은 떨림(상관 길이 ≈6px).
 * **점당 총 rms가 σ가 되도록 보정**한다(프로토타입은 ×0.5 버그로 σ가 0.78배였다 — 리뷰 지적 수정).
 * 11-18 밤: 점마다 독립 잡음(6px 간격에 최대 5px)을 쓰면 선이 톱니가 돼 말랑이가 요철에 끼어 멈추는 인위적 실패가 σ0에서도 38%였다 →
 * 상관 있는(AR(1)) 잡음으로 교체. 실제 손으로 그은 선은 매끄러운 편차다(오너 선 샘플 3회).
 */
export function perturb(dense: Pt[], sigma: number, tremor: number, rng: () => number): Pt[] {
  const so = sigma / Math.sqrt(1 + 0.36) // sqrt(so² + (0.6 so)²) = σ
  const ox = gauss(rng) * so
  const oy = gauss(rng) * so
  const rhoLow = 0.905 // exp(-6/60)
  const rhoT = 0.37 // exp(-6/6)
  let lx = gauss(rng) * so * 0.6
  let ly = gauss(rng) * so * 0.6
  let tx = gauss(rng) * tremor
  let ty = gauss(rng) * tremor
  const kLow = Math.sqrt(1 - rhoLow * rhoLow)
  const kT = Math.sqrt(1 - rhoT * rhoT)
  return dense.map((p) => {
    lx = rhoLow * lx + kLow * gauss(rng) * so * 0.6
    ly = rhoLow * ly + kLow * gauss(rng) * so * 0.6
    tx = rhoT * tx + kT * gauss(rng) * tremor
    ty = rhoT * ty + kT * gauss(rng) * tremor
    return { x: p.x + ox + lx + tx, y: p.y + oy + ly + ty }
  })
}
