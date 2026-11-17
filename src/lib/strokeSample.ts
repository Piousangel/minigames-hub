/**
 * 사람 손 선 샘플 수집용(말랑 미끄럼길 Day 1 게이트). 정해진 경로를 손가락으로 따라 그리게 해서
 * "목표 경로에서 얼마나 벗어나는가(σ)·떨림·속도·시작/끝 오차"를 잰다. 좌표는 캔버스 폭 = 1 로 정규화.
 */
export type Pt = { x: number; y: number }
export type Sample = { x: number; y: number; t: number }
export type Target = { id: string; label: string; pts: Pt[] }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function sample(n: number, f: (t: number) => Pt): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => f(i / n))
}

/** 20개 결정적 목표 경로: 직선 5 · 호 5 · S/물결 5 · 경사+턱 5. 캔버스 폭 1, 높이 1.25 기준, 가장자리 0.08 여백. */
export function buildTargets(): Target[] {
  const out: Target[] = []
  const line = (id: string, label: string, a: Pt, b: Pt) =>
    out.push({ id, label, pts: sample(24, (t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) })) })
  line('line-h', '가로 직선', { x: 0.1, y: 0.6 }, { x: 0.9, y: 0.6 })
  line('line-v', '세로 직선', { x: 0.5, y: 0.1 }, { x: 0.5, y: 1.15 })
  line('line-d1', '완만한 내리막', { x: 0.1, y: 0.3 }, { x: 0.9, y: 0.7 })
  line('line-d2', '가파른 내리막', { x: 0.2, y: 0.15 }, { x: 0.8, y: 1.1 })
  line('line-short', '짧은 직선', { x: 0.35, y: 0.5 }, { x: 0.65, y: 0.7 })
  const arc = (id: string, label: string, cx: number, cy: number, r: number, a0: number, a1: number) =>
    out.push({ id, label, pts: sample(40, (t) => ({ x: cx + r * Math.cos(lerp(a0, a1, t)), y: cy + r * Math.sin(lerp(a0, a1, t)) })) })
  arc('arc-1', '아래로 볼록한 호', 0.5, 0.35, 0.4, 0.15 * Math.PI, 0.85 * Math.PI)
  arc('arc-2', '위로 볼록한 호', 0.5, 0.95, 0.4, 1.15 * Math.PI, 1.85 * Math.PI)
  arc('arc-3', '큰 반원', 0.5, 0.6, 0.38, 0, Math.PI)
  arc('arc-4', '작은 호', 0.5, 0.5, 0.22, 0.2 * Math.PI, 1.2 * Math.PI)
  arc('arc-5', '오른쪽 휘는 호', 0.2, 0.6, 0.45, -0.45 * Math.PI, 0.45 * Math.PI)
  const wave = (id: string, label: string, amp: number, cycles: number, y0: number, x0 = 0.1, x1 = 0.9) =>
    out.push({ id, label, pts: sample(60, (t) => ({ x: lerp(x0, x1, t), y: y0 + amp * Math.sin(t * cycles * 2 * Math.PI) })) })
  wave('wave-1', '부드러운 S', 0.18, 1, 0.6)
  wave('wave-2', '두 번 물결', 0.14, 2, 0.6)
  wave('wave-3', '작은 물결 세 번', 0.08, 3, 0.6)
  wave('wave-4', '큰 S', 0.3, 1, 0.65)
  wave('wave-5', '짧은 물결', 0.12, 1.5, 0.6, 0.2, 0.8)
  const ramp = (id: string, label: string, bump: number, slope: number) =>
    out.push({ id, label, pts: sample(50, (t) => ({ x: lerp(0.1, 0.9, t), y: 0.22 + slope * t + bump * Math.exp(-(((t - 0.5) / 0.12) ** 2)) * -1 })) })
  ramp('ramp-1', '경사 + 작은 턱', 0.1, 0.7)
  ramp('ramp-2', '경사 + 큰 턱', 0.2, 0.7)
  ramp('ramp-3', '가파른 경사 + 턱', 0.15, 0.95)
  ramp('ramp-4', '완만한 경사 + 턱', 0.12, 0.4)
  ramp('ramp-5', '평평 + 턱', 0.18, 0.05)
  return out
}

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
/** 점에서 목표 폴리라인까지의 최소 거리(정규화 단위). */
export function distToPath(p: Pt, path: Pt[]): number {
  let best = Infinity
  for (let i = 0; i + 1 < path.length; i++) best = Math.min(best, distToSeg(p, path[i], path[i + 1]))
  return best
}

export type StrokeStats = { n: number; rms: number; median: number; p90: number; startErr: number; endErr: number; meanSpeed: number }
/** 한 획의 통계. 거리 단위는 `scale`(보통 캔버스 폭 px)을 곱해 px로 돌려준다. */
export function strokeStats(samples: Sample[], target: Pt[], scale: number): StrokeStats {
  if (samples.length < 2) return { n: samples.length, rms: 0, median: 0, p90: 0, startErr: 0, endErr: 0, meanSpeed: 0 }
  const d = samples.map((s) => distToPath(s, target) * scale).sort((a, b) => a - b)
  const rms = Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length)
  const q = (f: number) => d[Math.min(d.length - 1, Math.floor(f * d.length))]
  const a = target[0]
  const b = target[target.length - 1]
  const s0 = samples[0]
  const s1 = samples[samples.length - 1]
  let len = 0
  for (let i = 1; i < samples.length; i++) len += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y)
  const dt = (s1.t - s0.t) / 1000
  return {
    n: samples.length,
    rms,
    median: q(0.5),
    p90: q(0.9),
    startErr: Math.hypot(s0.x - a.x, s0.y - a.y) * scale,
    endErr: Math.hypot(s1.x - b.x, s1.y - b.y) * scale,
    meanSpeed: dt > 0 ? (len * scale) / dt : 0,
  }
}
