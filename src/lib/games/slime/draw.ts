import { starPath } from './fx'
import type { Pt, Seg } from './types'

/** 말랑 미끄럼길 그리기 함수(분필·돌·나무·풀·둥지·밤·밤송이). 화면 전용. 좌표는 논리 390×560 보드. */

/** 뿅 착지의 노을 하늘·구름 바다 배경을 보드에 꽉 차게(비율 유지, 수평선이 보이도록 아래쪽 기준으로 자름). 로딩 전엔 밤하늘 폴백. */
export function drawSky(g: CanvasRenderingContext2D, bg: HTMLImageElement | null | undefined, t: number, W: number, H: number): void {
  if (bg?.complete && bg.naturalWidth) {
    const sh = (bg.naturalWidth * H) / W
    g.drawImage(bg, 0, Math.max(0, bg.naturalHeight - sh), bg.naturalWidth, Math.min(sh, bg.naturalHeight), 0, 0, W, H)
    return
  }
  drawBackground(g, t, W, H)
}

export function drawBackground(g: CanvasRenderingContext2D, t: number, W: number, H: number): void {
  const grd = g.createLinearGradient(0, 0, 0, H)
  grd.addColorStop(0, '#241c4a')
  grd.addColorStop(0.55, '#3d3170')
  grd.addColorStop(1, '#5a4690')
  g.fillStyle = grd
  g.fillRect(0, 0, W, H)
  // 은은하게 반짝이는 별(위치는 인덱스로 고정)
  for (let i = 0; i < 26; i++) {
    const x = (i * 97 + 31) % W
    const y = (i * 53 + 17) % (H * 0.7)
    const tw = 0.35 + 0.35 * Math.sin(t / 700 + i * 1.3)
    g.fillStyle = `rgba(255,255,255,${tw * 0.6})`
    g.beginPath()
    g.arc(x, y, 1 + (i % 3) * 0.5, 0, Math.PI * 2)
    g.fill()
  }
}

const isFlat = (s: Seg) => Math.abs(s.b.y - s.a.y) < Math.abs(s.b.x - s.a.x) * 0.3

/** 수평 지형 = 뿅 착지의 풀 덮인 떠다니는 섬. 섬 윗면이 물리 선분(말랑이가 서는 높이)에 오도록 맞춘다(그림은 시각용, 물리는 선분). */
export function drawIslandFloors(g: CanvasRenderingContext2D, island: HTMLImageElement | null | undefined, terrain: Seg[], bouncy: number[] = []): boolean {
  if (!island?.complete || !island.naturalWidth) return false
  for (let i = 0; i < terrain.length; i++) {
    const s = terrain[i]
    if (!isFlat(s) || bouncy.includes(i)) continue
    const x0 = Math.min(s.a.x, s.b.x)
    const x1 = Math.max(s.a.x, s.b.x)
    const w = x1 - x0 + 70 // 양끝으로 조금 더 나와 둥근 섬 모서리가 보인다
    const h = (island.naturalHeight / island.naturalWidth) * w
    const surface = h * 0.27 // 이미지에서 풀 윗면(말랑이가 서는 면)의 높이 비율 — 0.16은 말랑이가 18px 떠 보였다(디자이너 검수)
    g.drawImage(island, (x0 + x1) / 2 - w / 2, (s.a.y + s.b.y) / 2 - surface, w, h)
  }
  return true
}

/** 뿅 착지의 꽃을 목표(둥지) 자리에 세운다. 발끝이 바닥 선분에 닿는다. */
export function drawFlowerGoal(g: CanvasRenderingContext2D, flower: HTMLImageElement | null | undefined, p: Pt, t: number, glow: number): boolean {
  if (!flower?.complete || !flower.naturalWidth) return false
  const hgt = 74
  const wid = (flower.naturalWidth / flower.naturalHeight) * hgt
  const sway = Math.sin(t / 700) * 0.04 * (1 + glow * 2)
  g.save()
  g.translate(p.x, p.y + 20) // 발끝(바닥 윗면)
  g.rotate(sway)
  g.drawImage(flower, -wid / 2, -hgt, wid, hgt)
  g.restore()
  return true
}

/** 튕기는 벽 = 말랑한 산호색 젤리 쿠션(바위 기둥과 한눈에 구분). 살짝 숨 쉬듯 굵기가 변한다. */
function drawBouncePad(g: CanvasRenderingContext2D, s: Seg, t: number): void {
  const dx = s.b.x - s.a.x
  const dy = s.b.y - s.a.y
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy))
  const breathe = 1 + 0.06 * Math.sin(t / 260)
  const stroke = (w: number, col: string, ox = 0, oy = 0) => {
    g.strokeStyle = col
    g.lineWidth = w
    g.beginPath()
    g.moveTo(s.a.x + ox, s.a.y + oy)
    g.lineTo(s.b.x + ox, s.b.y + oy)
    g.stroke()
  }
  g.lineCap = 'round'
  stroke(18 * breathe, 'rgba(60,35,20,0.22)', 3, 4)
  stroke(18 * breathe, '#5b3a1e')
  stroke(13 * breathe, '#ff7f6b')
  stroke(4, '#ffc1b3', -dy / len * 3, dx / len * 3)
  // 쿠션 점무늬
  g.fillStyle = '#ffe3da'
  for (let d = 10; d < len - 6; d += 16) {
    g.beginPath()
    g.arc(s.a.x + (dx * d) / len, s.a.y + (dy * d) / len, 1.8, 0, Math.PI * 2)
    g.fill()
  }
}

export function drawTerrain(g: CanvasRenderingContext2D, terrain: Seg[], skipFlat = false, bouncy: number[] = [], t = 0): void {
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (let ti = 0; ti < terrain.length; ti++) {
    const s = terrain[ti]
    if (bouncy.includes(ti)) {
      drawBouncePad(g, s, t)
      continue
    }
    if (skipFlat && isFlat(s)) continue
    const dx = s.b.x - s.a.x
    const dy = s.b.y - s.a.y
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    let nx = -dy / len
    let ny = dx / len
    // 빛이 위·왼쪽에서 온다: 하이라이트 쪽 법선
    const up = Math.abs(ny) > Math.abs(nx) ? (ny < 0 ? 1 : -1) : nx < 0 ? 1 : -1
    nx *= up
    ny *= up
    const line = (ox: number, oy: number, w: number, col: string) => {
      g.strokeStyle = col
      g.lineWidth = w
      g.beginPath()
      g.moveTo(s.a.x + ox, s.a.y + oy)
      g.lineTo(s.b.x + ox, s.b.y + oy)
      g.stroke()
    }
    line(3, 4, 14, 'rgba(60,35,20,0.22)') // 그림자
    line(0, 0, 14, '#5b3a1e') // 윤곽(뿅 착지 UI와 같은 갈색)
    line(0, 0, 10, '#b98f5e') // 몸통(바위)
    line(nx * 2.4, ny * 2.4, 2.4, '#ecd0a2') // 하이라이트
    // 결(나이테 같은 짧은 선)
    g.strokeStyle = 'rgba(70,40,18,0.55)'
    g.lineWidth = 1.2
    for (let d = 8; d < len - 6; d += 13) {
      const h = Math.sin(d * 12.9898) * 43758.5453
      const f = h - Math.floor(h)
      const cx = s.a.x + (dx * d) / len
      const cy = s.a.y + (dy * d) / len
      const ox = -ny * (1 + f * 2)
      const oy = nx * (1 + f * 2)
      g.beginPath()
      g.moveTo(cx - ox, cy - oy)
      g.lineTo(cx + ox, cy + oy)
      g.stroke()
    }
    // 거의 수평인 지형은 위에 풀을 얹는다
    if (Math.abs(dy) < Math.abs(dx) * 0.3 && ny < 0) {
      line(nx * 4, ny * 4, 4.5, '#5fbf4a')
      line(nx * 5.5, ny * 5.5, 1.6, '#9be57e')
      g.strokeStyle = '#5fbf4a'
      g.lineWidth = 2
      for (let d = 6; d < len - 4; d += 11) {
        const h = Math.sin(d * 78.233) * 12345.6789
        const f = h - Math.floor(h)
        const cx = s.a.x + (dx * d) / len + nx * 6
        const cy = s.a.y + (dy * d) / len + ny * 6
        g.beginPath()
        g.moveTo(cx, cy)
        g.lineTo(cx + (f - 0.5) * 3, cy + ny * (3 + f * 4))
        g.stroke()
      }
    }
  }
}

/** 목표 주변의 따뜻한 빛만(꽃·둥지 공용). 둥지 그림은 그리지 않아 꽃과 겹치지 않는다. */
export function drawGoalGlow(g: CanvasRenderingContext2D, p: Pt, t: number, glow: number): void {
  const cx = p.x
  const cy = p.y + 8
  const gl = g.createRadialGradient(cx, cy, 4, cx, cy, 44 + glow * 20)
  gl.addColorStop(0, `rgba(255,220,120,${0.1 + glow * 0.5 + 0.04 * Math.sin(t / 500)})`)
  gl.addColorStop(1, 'rgba(255,220,120,0)')
  g.fillStyle = gl
  g.beginPath()
  g.arc(cx, cy, 64, 0, Math.PI * 2)
  g.fill()
}

export function drawNest(g: CanvasRenderingContext2D, p: Pt, t: number, glow: number): void {
  const cx = p.x
  const cy = p.y + 8
  // 도착하면 따뜻하게 빛난다
  const gl = g.createRadialGradient(cx, cy, 4, cx, cy, 44 + glow * 20)
  gl.addColorStop(0, `rgba(255,220,120,${0.16 + glow * 0.5 + 0.05 * Math.sin(t / 500)})`)
  gl.addColorStop(1, 'rgba(255,220,120,0)')
  g.fillStyle = gl
  g.beginPath()
  g.arc(cx, cy, 64, 0, Math.PI * 2)
  g.fill()
  // 둥지 바닥·잔가지
  g.fillStyle = '#5b3a1f'
  g.beginPath()
  g.ellipse(cx, cy, 26, 14, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#a9794a'
  g.lineWidth = 2
  g.lineCap = 'round'
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 6)
    g.lineTo(cx + Math.cos(a + 0.6) * 27, cy + Math.sin(a + 0.6) * 14.5)
    g.stroke()
  }
  g.fillStyle = '#35200f'
  g.beginPath()
  g.ellipse(cx, cy - 2, 17, 8, 0, 0, Math.PI * 2)
  g.fill()
  // 알 두 개
  g.fillStyle = '#fff3d1'
  for (const [ox, oy] of [[-6, -3], [6, -2]] as const) {
    g.beginPath()
    g.ellipse(cx + ox, cy + oy, 5.5, 6.5, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.beginPath()
  g.ellipse(cx - 8, cy - 5, 1.6, 2.4, 0, 0, Math.PI * 2)
  g.fill()
}

/** 별 수집물(뿅 착지의 star.webp). 둥실 떠 있다 반짝이고, 먹으면 커지며 사라진다. 그림 로딩 전엔 직접 그린 별. */
export function drawStar(g: CanvasRenderingContext2D, img: HTMLImageElement | null | undefined, p: Pt, t: number, i: number, scale = 1, alpha = 1): void {
  const bob = Math.sin(t / 420 + i * 1.7) * 2.2
  const pulse = 1 + 0.06 * Math.sin(t / 300 + i)
  const sz = 34 * scale * pulse
  g.save()
  g.globalAlpha = alpha
  g.translate(p.x, p.y + bob)
  g.rotate(Math.sin(t / 700 + i) * 0.12)
  if (img?.complete && img.naturalWidth) {
    g.shadowColor = 'rgba(255,200,60,0.9)'
    g.shadowBlur = 12
    g.drawImage(img, -sz / 2, -sz / 2, sz, sz)
  } else {
    g.fillStyle = '#ffd23a'
    g.strokeStyle = '#8a5a12'
    g.lineWidth = 2
    g.beginPath()
    for (let k = 0; k < 10; k++) {
      const r = (k % 2 ? 0.42 : 1) * sz * 0.5
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
    g.stroke()
  }
  g.restore()
}

export function drawAcorn(g: CanvasRenderingContext2D, p: Pt, t: number, i: number, scale = 1, alpha = 1): void {
  const bob = Math.sin(t / 420 + i * 1.7) * 1.6
  const cx = p.x
  const cy = p.y + bob
  g.save()
  g.globalAlpha = alpha
  g.translate(cx, cy)
  g.scale(scale, scale)
  const body = g.createRadialGradient(-3, -3, 1, 0, 0, 12)
  body.addColorStop(0, '#c07a3e')
  body.addColorStop(1, '#5a2c12')
  g.fillStyle = body
  g.beginPath()
  g.ellipse(0, 1, 9.5, 10.5, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#3a1b0a'
  g.lineWidth = 1.5
  g.stroke()
  // 윗부분(껍질 끝)
  g.fillStyle = '#e0b068'
  g.beginPath()
  g.moveTo(-5, -8)
  g.lineTo(0, -13)
  g.lineTo(5, -8)
  g.closePath()
  g.fill()
  // 반짝임
  g.fillStyle = 'rgba(255,255,255,0.55)'
  g.beginPath()
  g.ellipse(-3.5, -3, 2.4, 3.6, -0.5, 0, Math.PI * 2)
  g.fill()
  const tw = Math.sin(t / 260 + i * 2.1)
  if (tw > 0.85) {
    g.fillStyle = 'rgba(255,255,255,0.9)'
    starPath(g, 6, -8, 3.2 * (tw - 0.8) * 5, 0)
    g.fill()
  }
  g.restore()
}

let poisonCache: { src: HTMLImageElement; cv: HTMLCanvasElement } | null = null
/** 독꽃: 목표 꽃과 같은 그림에 보라·어두운 색을 입힌 것(ctx.filter 미지원 브라우저 대비 오프스크린 합성). 노란 꽃=목표, 보라 꽃=위험. */
function poisonFlower(img: HTMLImageElement): HTMLCanvasElement | null {
  if (poisonCache?.src === img) return poisonCache.cv
  if (typeof document === 'undefined') return null
  const cv = document.createElement('canvas')
  cv.width = img.naturalWidth
  cv.height = img.naturalHeight
  const c = cv.getContext('2d')
  if (!c) return null
  c.drawImage(img, 0, 0)
  c.globalCompositeOperation = 'source-atop'
  c.fillStyle = 'rgba(110,40,150,0.72)'
  c.fillRect(0, 0, cv.width, cv.height)
  poisonCache = { src: img, cv }
  return cv
}

/** 위험 요소 = 보라 독꽃(밤송이 대체). 접촉 반경은 엔진 그대로(spike r26). 그림 로딩 전엔 기존 밤송이로 폴백. */
export function drawPoisonFlower(g: CanvasRenderingContext2D, img: HTMLImageElement | null | undefined, p: Pt, t: number, i: number, alarm = 0): void {
  const cv = img?.complete && img.naturalWidth ? poisonFlower(img) : null
  if (!cv) return drawBurr(g, p, t, i, alarm)
  const h = 62
  const w = (cv.width / cv.height) * h
  g.save()
  if (alarm > 0) {
    g.strokeStyle = `rgba(255,90,90,${0.7 * alarm})`
    g.lineWidth = 3
    g.beginPath()
    g.arc(p.x, p.y, 30 + 10 * alarm, 0, Math.PI * 2)
    g.stroke()
  }
  g.translate(p.x, p.y + 22)
  g.rotate(Math.sin(t / 520 + i * 2) * 0.07)
  g.drawImage(cv, -w / 2, -h, w, h)
  g.restore()
}

export function drawBurr(g: CanvasRenderingContext2D, p: Pt, t: number, i: number, alarm = 0): void {
  g.save()
  g.translate(p.x, p.y)
  if (alarm > 0) {
    g.strokeStyle = `rgba(255,90,90,${0.7 * alarm})`
    g.lineWidth = 3
    g.beginPath()
    g.arc(0, 0, 24 + 4 * alarm, 0, Math.PI * 2)
    g.stroke()
  }
  g.strokeStyle = '#2f3a10'
  g.lineWidth = 2.6
  g.lineCap = 'round'
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + Math.sin(t / 900 + i) * 0.05
    const r0 = 10
    const r1 = 18 + (k % 2) * 3 + Math.sin(t / 260 + k) * 0.8
    g.beginPath()
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
    g.stroke()
  }
  const body = g.createRadialGradient(-4, -4, 1, 0, 0, 14)
  body.addColorStop(0, '#b4c24a')
  body.addColorStop(1, '#4f6119')
  g.fillStyle = body
  g.beginPath()
  g.arc(0, 0, 13, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#2f3a10'
  g.lineWidth = 1.5
  g.stroke()
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.beginPath()
  g.ellipse(-4, -5, 3, 2, -0.5, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** 실패한 자리에 크게 표시하는 ✕(갈색 윤곽 + 붉은 심). */
export function drawFailMark(g: CanvasRenderingContext2D, p: Pt, age: number): void {
  const k = Math.min(1, age / 0.18)
  const r = 13 * (0.6 + 0.4 * k)
  g.save()
  g.globalAlpha = Math.max(0, Math.min(1, 2.4 - age))
  g.lineCap = 'round'
  for (const [w, c] of [[9, '#5b3a1e'], [5, '#ff4b4b']] as const) {
    g.strokeStyle = c
    g.lineWidth = w
    g.beginPath()
    g.moveTo(p.x - r, p.y - r)
    g.lineTo(p.x + r, p.y + r)
    g.moveTo(p.x + r, p.y - r)
    g.lineTo(p.x - r, p.y + r)
    g.stroke()
  }
  g.restore()
}

/** 크림색 말풍선(뿅 착지 UI와 같은 갈색 윤곽). */
export function drawBubble(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW = 300): void {
  g.save()
  g.font = '700 15px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const w = Math.min(maxW, g.measureText(text).width + 28)
  const h = 32
  const x = cx - w / 2
  const y = cy - h / 2
  g.beginPath()
  g.moveTo(x + 12, y)
  g.arcTo(x + w, y, x + w, y + h, 12)
  g.arcTo(x + w, y + h, x, y + h, 12)
  g.arcTo(x, y + h, x, y, 12)
  g.arcTo(x, y, x + w, y, 12)
  g.closePath()
  g.fillStyle = '#fff3dc'
  g.fill()
  g.lineWidth = 3
  g.strokeStyle = '#5b3a1e'
  g.stroke()
  g.fillStyle = '#5b3a1e'
  g.fillText(text, cx, cy + 1, maxW - 20)
  g.restore()
}
