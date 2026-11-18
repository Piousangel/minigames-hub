import { CONST, type Pt } from './types'

/**
 * 손을 뗄 때 1회 적용하는 선 처리(브리프 4-2): 3px 미만 점 버림 → RDP 1.5px → Chaikin 1회 → 8px 재샘플 → 0.5px 격자 반올림.
 * 프리뷰는 Chaikin(3번)까지 같은 함수를 쓰고, 시뮬은 전체를 쓴다.
 */
export function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function dropClose(pts: Pt[], minDist = 3): Pt[] {
  const out: Pt[] = []
  for (const p of pts) if (out.length === 0 || dist(out[out.length - 1], p) >= minDist) out.push(p)
  return out
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

export function rdp(pts: Pt[], eps = 1.5): Pt[] {
  if (pts.length < 3) return pts.slice()
  let maxD = 0
  let idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1])
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]]
  const left = rdp(pts.slice(0, idx + 1), eps)
  const right = rdp(pts.slice(idx), eps)
  return left.slice(0, -1).concat(right)
}

export function chaikin(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts.slice()
  const out: Pt[] = [pts[0]]
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
    out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
  }
  out.push(pts[pts.length - 1])
  return out
}

export function resample(pts: Pt[], step = 8): Pt[] {
  if (pts.length < 2) return pts.slice()
  const out: Pt[] = [pts[0]]
  let carry = 0
  for (let i = 0; i + 1 < pts.length; i++) {
    let a = pts[i]
    const b = pts[i + 1]
    let segLen = dist(a, b)
    while (carry + segLen >= step) {
      const t = (step - carry) / segLen
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      out.push(a)
      segLen = dist(a, b)
      carry = 0
    }
    carry += segLen
  }
  const last = pts[pts.length - 1]
  if (dist(out[out.length - 1], last) > 0.5) out.push(last)
  return out
}

export const snapHalf = (p: Pt): Pt => ({ x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 })

export function polyLength(pts: Pt[]): number {
  let l = 0
  for (let i = 0; i + 1 < pts.length; i++) l += dist(pts[i], pts[i + 1])
  return l
}

/** 잉크 한도에서 선을 자른다(넘는 점은 무시). */
export function capInk(pts: Pt[], ink: number): Pt[] {
  const out: Pt[] = []
  let used = 0
  for (const p of pts) {
    if (out.length > 0) {
      const d = dist(out[out.length - 1], p)
      if (used + d > ink) {
        const t = (ink - used) / d
        const last = out[out.length - 1]
        out.push({ x: last.x + (p.x - last.x) * t, y: last.y + (p.y - last.y) * t })
        return out
      }
      used += d
    }
    out.push(p)
  }
  return out
}

/** 손으로 그은 원점 → 시뮬용 선. 40px 미만이면 null(시작 안 함). 스폰 금지 반경 안의 점은 입력 단계에서 거부된다고 가정. */
export function processStroke(raw: Pt[], ink: number): Pt[] | null {
  const capped = capInk(dropClose(raw), ink)
  const smooth = chaikin(rdp(capped, 1.5))
  const out = resample(smooth, 8).map(snapHalf)
  if (polyLength(out) < CONST.MIN_LINE) return null
  return out
}

/** 점이 스폰 금지 반경 안에 있는가. */
export function inSpawnBan(p: Pt, spawn: Pt): boolean {
  return dist(p, spawn) < CONST.SPAWN_BAN_R
}

/** 선분 a→b가 스폰 금지 원을 지나는가(점 사이를 건너뛰는 빠른 선도 잡는다). 입력·시험 판정의 단일 기준. */
export function segmentHitsSpawnBan(a: Pt, b: Pt, spawn: Pt): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((spawn.x - a.x) * dx + (spawn.y - a.y) * dy) / len2))
  return Math.hypot(a.x + t * dx - spawn.x, a.y + t * dy - spawn.y) < CONST.SPAWN_BAN_R
}

export function lineHitsSpawnBan(pts: Pt[], spawn: Pt): boolean {
  if (pts.length === 1) return inSpawnBan(pts[0], spawn)
  for (let i = 1; i < pts.length; i++) if (segmentHitsSpawnBan(pts[i - 1], pts[i], spawn)) return true
  return false
}
