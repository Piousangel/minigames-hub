import { backingSize } from './canvasLayer'
import { BOARD_H, type Pt, type Seg, type Stage } from './types'

/**
 * 지형 렌더러 v2(오너 11-19: 단순 막대기로 구성하지 않는다). 충돌 선분 체인을 채워진 암석 덩어리로 그린다.
 * 정적이라 오프스크린 캔버스에 한 번만 그려 두고 프레임마다 drawImage 1회로 복사한다(스펙 PR-1).
 * 충돌은 그대로 선분이다: 윗면 폴리라인이 곧 충돌선이고, 그림은 그 선 아래(또는 양옆)를 채운다.
 */
export type LandformKind = 'ridge' | 'slab'
export interface Landform {
  kind: LandformKind
  /** 윗면(충돌) 폴리라인 */
  chain: Pt[]
}

const same = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5

/** 이어진 선분(끝점이 겹침)을 하나의 체인으로 묶는다. 튕기는 벽(bouncy)은 제외(별도 오브젝트). */
export function chainsOf(terrain: Seg[], skip: number[] = []): Pt[][] {
  const used = new Set<number>(skip)
  const out: Pt[][] = []
  for (let i = 0; i < terrain.length; i++) {
    if (used.has(i)) continue
    used.add(i)
    const chain: Pt[] = [terrain[i].a, terrain[i].b]
    let grew = true
    while (grew) {
      grew = false
      for (let j = 0; j < terrain.length; j++) {
        if (used.has(j)) continue
        const s = terrain[j]
        const end = chain[chain.length - 1]
        const start = chain[0]
        if (same(end, s.a)) chain.push(s.b)
        else if (same(end, s.b)) chain.push(s.a)
        else if (same(start, s.b)) chain.unshift(s.a)
        else if (same(start, s.a)) chain.unshift(s.b)
        else continue
        used.add(j)
        grew = true
      }
    }
    out.push(chain)
  }
  return out
}

/** 체인 모양으로 종류를 정한다: 가로로 긴 윗면 = ridge(능선·섬), 세로로 선 것 = slab(바위 기둥). */
export function landformsOf(stage: Stage): Landform[] {
  return chainsOf(stage.terrain, stage.bouncy ?? []).map((chain) => {
    const xs = chain.map((p) => p.x)
    const ys = chain.map((p) => p.y)
    const w = Math.max(...xs) - Math.min(...xs)
    const h = Math.max(...ys) - Math.min(...ys)
    return { kind: w >= h * 0.8 ? 'ridge' : 'slab', chain } as Landform
  })
}

// 스테이지 id로 정하는 결정적 난수(질감 얼룩·균열 위치)
function rng(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9), ((h ^ (h >>> 13)) >>> 0) / 4294967296)
}

const INK = '#5b3a1e'
const ROCK = ['#c79a66', '#a97a4a', '#6b4526']
const GRASS = '#5fbf4a'
const GRASS_HI = '#9be57e'

function trace(g: CanvasRenderingContext2D, pts: Pt[]) {
  g.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
}

/** 정적 지형 레이어(튕기는 벽·움직이는 것 제외). dpr 배율로 선명하게. canvas 생성이 안 되는 환경이면 null. */
export function renderTerrainLayer(stage: Stage, width: number, dpr: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const { bw, bh, k: scale } = backingSize(width, dpr) // 메인 캔버스와 같은 식(크기가 정확히 같아야 1:1 복사)
  const cv = document.createElement('canvas')
  cv.width = bw
  cv.height = bh
  const g = cv.getContext('2d')
  if (!g) return null
  g.scale(scale, scale)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  const rand = rng(stage.id)
  const forms = landformsOf(stage)
  const CLOSE = BOARD_H + 30

  // ① 전체 그림자(덩어리마다 그리면 이웃의 면을 덮는다)
  g.fillStyle = 'rgba(58,36,16,0.22)'
  g.strokeStyle = 'rgba(58,36,16,0.22)'
  for (const f of forms) {
    g.save()
    g.translate(4, 6)
    g.beginPath()
    if (f.kind === 'ridge') {
      trace(g, f.chain)
      g.lineTo(f.chain[f.chain.length - 1].x, CLOSE)
      g.lineTo(f.chain[0].x, CLOSE)
      g.closePath()
      g.fill()
    } else {
      trace(g, f.chain)
      g.lineWidth = 16
      g.stroke()
    }
    g.restore()
  }

  for (const f of forms) {
    const top = f.chain
    const yTop = Math.min(...top.map((p) => p.y))
    // 면 경로
    g.beginPath()
    if (f.kind === 'ridge') {
      trace(g, top)
      g.lineTo(top[top.length - 1].x, CLOSE)
      g.lineTo(top[0].x, CLOSE)
      g.closePath()
    } else {
      trace(g, top)
    }
    // ② 윤곽 → ③ 면
    const grad = g.createLinearGradient(0, yTop, 0, yTop + 120)
    grad.addColorStop(0, ROCK[0])
    grad.addColorStop(0.35, ROCK[1])
    grad.addColorStop(1, ROCK[2])
    if (f.kind === 'ridge') {
      g.lineWidth = 4
      g.strokeStyle = INK
      g.stroke()
      g.fillStyle = grad
      g.fill()
    } else {
      g.lineWidth = 16
      g.strokeStyle = INK
      g.stroke()
      g.lineWidth = 11
      g.strokeStyle = grad
      g.stroke()
    }
    // ④ 질감(클립 안, 윗면 14px 이내는 비워 충돌면이 잘 읽히게)
    g.save()
    g.beginPath()
    if (f.kind === 'ridge') {
      trace(g, top)
      g.lineTo(top[top.length - 1].x, CLOSE)
      g.lineTo(top[0].x, CLOSE)
      g.closePath()
      g.clip()
      g.lineWidth = 2
      ;[18, 40, 72].forEach((d, k) => {
        g.strokeStyle = k % 2 ? 'rgba(236,208,162,0.14)' : 'rgba(91,58,30,0.14)'
        g.beginPath()
        trace(g, top.map((p) => ({ x: p.x, y: p.y + d })))
        g.stroke()
      })
      const xs = top.map((p) => p.x)
      const x0 = Math.min(...xs)
      const x1 = Math.max(...xs)
      for (let k = 0; k < 18; k++) {
        const x = x0 + rand() * (x1 - x0)
        const y = yTop + 22 + rand() * 90
        g.fillStyle = 'rgba(91,58,30,0.16)'
        g.beginPath()
        g.ellipse(x, y, 3 + rand() * 4, 2 + rand() * 3, rand() * 3, 0, Math.PI * 2)
        g.fill()
      }
      g.strokeStyle = 'rgba(91,58,30,0.28)'
      g.lineWidth = 1.4
      for (let k = 0; k < 4; k++) {
        const x = x0 + rand() * (x1 - x0)
        const y = yTop + 20 + rand() * 10
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + (rand() - 0.5) * 8, y + 10 + rand() * 12)
        g.stroke()
      }
    }
    g.restore()
    // ⑤ 윗면 풀: 경사가 완만한 구간만(풀 = 설 수 있는 면, 맨 바위 = 가파른 면)
    if (f.kind === 'ridge') {
      for (let i = 0; i + 1 < top.length; i++) {
        const dx = top[i + 1].x - top[i].x
        const dy = top[i + 1].y - top[i].y
        const steep = Math.abs(dy) > Math.abs(dx) * 1.2 // ≈ 50°
        if (steep) continue
        g.lineWidth = 9
        g.strokeStyle = GRASS
        g.beginPath()
        g.moveTo(top[i].x, top[i].y + 1)
        g.lineTo(top[i + 1].x, top[i + 1].y + 1)
        g.stroke()
        g.lineWidth = 1.6
        g.strokeStyle = GRASS_HI
        g.beginPath()
        g.moveTo(top[i].x, top[i].y - 2)
        g.lineTo(top[i + 1].x, top[i + 1].y - 2)
        g.stroke()
        // 풀잎 술
        const len = Math.hypot(dx, dy) || 1
        g.strokeStyle = GRASS
        g.lineWidth = 2
        for (let d = 6; d < len - 4; d += 11) {
          const px = top[i].x + (dx * d) / len
          const py = top[i].y + (dy * d) / len
          g.beginPath()
          g.moveTo(px, py - 3)
          g.lineTo(px + (rand() - 0.5) * 3, py - 7 - rand() * 3)
          g.stroke()
        }
      }
    } else {
      // 기둥 윗머리에 풀 모자 + 왼쪽 하이라이트
      const t0 = top[0].y <= top[top.length - 1].y ? top[0] : top[top.length - 1]
      g.fillStyle = GRASS
      g.strokeStyle = INK
      g.lineWidth = 2.5
      g.beginPath()
      g.ellipse(t0.x, t0.y - 3, 10, 5.5, 0, 0, Math.PI * 2)
      g.fill()
      g.stroke()
      g.strokeStyle = 'rgba(255,243,220,0.55)'
      g.lineWidth = 2.2
      g.beginPath()
      trace(g, top.map((p) => ({ x: p.x - 3.4, y: p.y + 6 })))
      g.stroke()
    }
  }
  return cv
}
