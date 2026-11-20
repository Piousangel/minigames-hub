/**
 * 공유 카드 PNG(리디자인 v2 R5) — 키아트 크롭 + "No. N" + 하늘 8칸 띠(사이트 시그니처, 공유 카드에서만) + 꽃 3칸.
 * 브라우저 전용(canvas). 개인 정보는 그리지 않는다(이름·기기 id 없음 — 게임 이름·호수·정원 칸·점수만).
 * 크기 예산 ≤ 250KB: 먼저 640px로 그리고, 넘으면 더 작게 다시 그린다.
 */

export const SHARE_CARD_MAX_BYTES = 250 * 1024
export const SHARE_CARD_SIZES = [640, 540, 440] as const

/** 시안 하늘 다이얼 8칸(새벽 → 별밤). 결과 시트 미리보기와 같은 값. */
export const SKY_BANDS = ['#f2b8c6', '#ffe3b8', '#8fd3ff', '#ffc07a', '#ff9d7a', '#c86a8a', '#3d3170', '#241c4a'] as const
/** 노을 칸(사이트 홈은 노을 고정 — 계획서 0장). 띠의 '지금' 표시 자리. */
export const SKY_NOW = 4

export type ShareCardInput = {
  editionNo: number
  gameTitle: string
  /** 둘째 줄: 예) "Slime Slide · garden 2/3" */
  line: string
  bloomed: boolean[] // 3칸
  displayFont: string // font-family(Fraunces)
  uiFont: string // font-family(Figtree)
}

const INK = '#5b3a1e'
const SOFT = '#7a5636'
const PAPER = '#fffaf0'
// 4친구판(오너 11-20): 해씨 잎(x 525)부터 보미 날개(x 1330)·발(y 580)까지 넷이 다 드는 오른쪽 구역. 칸 비율 584:330에 맞춤
const ART = { src: '/art/hub-hero-desktop-4f-d3.webp', sx: 440, sy: 70, sw: 936, sh: 529 }

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image()
    im.decoding = 'async'
    im.onload = () => resolve(im)
    im.onerror = () => resolve(null)
    im.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 시안 #flower(24 격자)를 (cx, cy) 중심, 지름 d로. */
function drawFlower(ctx: CanvasRenderingContext2D, cx: number, cy: number, d: number) {
  const k = d / 24
  ctx.save()
  ctx.translate(cx - 12 * k, cy - 12 * k)
  ctx.lineWidth = 1.6 * k
  ctx.strokeStyle = INK
  ctx.fillStyle = '#ffd966'
  for (const [x, y] of [
    [12, 5.5],
    [18.2, 10],
    [15.8, 17.3],
    [8.2, 17.3],
    [5.8, 10],
  ]) {
    ctx.beginPath()
    ctx.arc(x * k, y * k, 3.6 * k, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.fillStyle = '#8a5a2b'
  ctx.beginPath()
  ctx.arc(12 * k, 12 * k, 3.4 * k, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** 시안 #bud: 점선 원 + 새싹. */
function drawBud(ctx: CanvasRenderingContext2D, cx: number, cy: number, d: number) {
  const k = d / 24
  ctx.save()
  ctx.translate(cx - 12 * k, cy - 12 * k)
  ctx.strokeStyle = SOFT
  ctx.lineWidth = 1.6 * k
  ctx.setLineDash([2.6 * k, 2.6 * k])
  ctx.beginPath()
  ctx.arc(12 * k, 12 * k, 9 * k, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = '#4f8a3c'
  ctx.lineWidth = 1.8 * k
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(12 * k, 16.5 * k)
  ctx.lineTo(12 * k, 11.5 * k)
  ctx.stroke()
  ctx.fillStyle = '#7cc26a'
  ctx.beginPath()
  ctx.ellipse(10 * k, 10.5 * k, 2 * k, 1.2 * k, -0.6, 0, Math.PI * 2)
  ctx.ellipse(14 * k, 10 * k, 1.9 * k, 1.1 * k, 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function draw(ctx: CanvasRenderingContext2D, size: number, art: HTMLImageElement | null, c: ShareCardInput) {
  const s = size / 640 // 640 기준 좌표를 비율로
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, size, size)
  // 바깥 윤곽
  ctx.lineWidth = 8 * s
  ctx.strokeStyle = INK
  roundRect(ctx, 4 * s, 4 * s, size - 8 * s, size - 8 * s, 36 * s)
  ctx.stroke()

  // 키아트 크롭(없으면 노을 그라데이션)
  const ax = 28 * s
  const ay = 28 * s
  const aw = size - 56 * s
  const ah = 330 * s
  ctx.save()
  roundRect(ctx, ax, ay, aw, ah, 24 * s)
  ctx.clip()
  if (art) {
    ctx.drawImage(art, ART.sx, ART.sy, ART.sw, ART.sh, ax, ay, aw, ah)
  } else {
    const g = ctx.createLinearGradient(0, ay, 0, ay + ah)
    g.addColorStop(0, '#ff9d7a')
    g.addColorStop(0.6, '#ffc6a0')
    g.addColorStop(1, '#b79ad9')
    ctx.fillStyle = g
    ctx.fillRect(ax, ay, aw, ah)
  }
  ctx.restore()
  ctx.lineWidth = 4 * s
  roundRect(ctx, ax, ay, aw, ah, 24 * s)
  ctx.stroke()

  // 글자
  ctx.fillStyle = INK
  ctx.textBaseline = 'alphabetic'
  ctx.font = `600 ${40 * s}px ${c.displayFont}`
  ctx.fillText(`Quick MiniGames · No. ${c.editionNo}`, 36 * s, 420 * s, size - 72 * s)
  ctx.fillStyle = SOFT
  ctx.font = `500 ${24 * s}px ${c.uiFont}`
  ctx.fillText(c.line, 36 * s, 458 * s, size - 72 * s)

  // 하늘 8칸 띠 + 지금(노을) 표시
  const bx = 36 * s
  const by = 486 * s
  const bw = 352 * s
  const bh = 18 * s
  ctx.save()
  roundRect(ctx, bx, by, bw, bh, bh / 2)
  ctx.clip()
  SKY_BANDS.forEach((col, i) => {
    ctx.fillStyle = col
    ctx.fillRect(bx + (i * bw) / 8, by, bw / 8 + 1, bh)
  })
  ctx.restore()
  ctx.lineWidth = 3 * s
  ctx.strokeStyle = INK
  roundRect(ctx, bx, by, bw, bh, bh / 2)
  ctx.stroke()
  const mx = bx + ((SKY_NOW + 0.5) * bw) / 8
  ctx.fillStyle = '#fff3dc'
  ctx.beginPath()
  ctx.arc(mx, by + bh / 2, 15 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 주소(하늘 띠 오른쪽) — 이미지만 따로 돌아다녀도 어디서 왔는지 보이게
  ctx.fillStyle = SOFT
  ctx.font = `600 ${18 * s}px ${c.uiFont}`
  ctx.textAlign = 'right'
  ctx.fillText('quickminigames.site', size - 36 * s, by + bh / 2 + 6 * s)
  ctx.textAlign = 'left'

  // 꽃 3칸(점선 궤적으로 잇는다)
  const fy = 572 * s
  const fd = 44 * s
  const xs = [58, 150, 242].map((x) => x * s)
  ctx.fillStyle = SOFT
  for (let i = 0; i < 2; i++) {
    for (let j = 1; j <= 4; j++) {
      ctx.beginPath()
      ctx.arc(xs[i] + fd / 2 + ((xs[i + 1] - xs[i] - fd) * j) / 5, fy - Math.sin((j / 5) * Math.PI) * 6 * s, 2.4 * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  c.bloomed.slice(0, 3).forEach((b, i) => (b ? drawFlower : drawBud)(ctx, xs[i], fy, fd))
  ctx.fillStyle = INK
  ctx.font = `600 ${24 * s}px ${c.uiFont}`
  ctx.fillText(`${c.bloomed.filter(Boolean).length} of 3 bloomed`, 300 * s, fy + 9 * s)
}

function toBlob(cv: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      cv.toBlob((b) => resolve(b), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

/** PNG 공유 카드. 만들 수 없으면(캔버스 없음) null. */
export async function makeShareCard(c: ShareCardInput): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  const art = await loadImage(ART.src)
  try {
    await Promise.all([document.fonts?.load(`600 40px ${c.displayFont}`), document.fonts?.load(`500 24px ${c.uiFont}`)])
  } catch {
    /* 폰트를 못 받아도 대체 글꼴로 그린다 */
  }
  let last: Blob | null = null
  for (const size of SHARE_CARD_SIZES) {
    const cv = document.createElement('canvas')
    cv.width = size
    cv.height = size
    const ctx = cv.getContext('2d')
    if (!ctx) return null
    draw(ctx, size, art, c)
    last = await toBlob(cv)
    if (last && last.size <= SHARE_CARD_MAX_BYTES) return last
  }
  return last && last.size <= SHARE_CARD_MAX_BYTES ? last : null
}
