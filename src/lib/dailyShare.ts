import { siteConfig } from './siteConfig'

/**
 * Daily/결과 공유 카드. 정적 export라 전부 클라이언트 캔버스로 그린다(서버 없음).
 *
 * 두 채널을 동시에 노린다:
 *  - **이미지**(navigator.share files) — Reddit/Discord 같은 시각 플랫폼용, 네온 브랜드.
 *  - **텍스트 스니펫**(클립보드) — Wordle의 바이럴 엔진은 이미지가 아니라 링크 없이도
 *    인라인으로 퍼지는 텍스트였다. 그래서 항상 텍스트도 복사한다.
 *
 * 디자인: RANK 등급 씰(S/A/B/C/D)을 히어로로, 그 밑에 "내 판의 지문" 글리프 스트립
 * (채운/빈 셀 + par 틱). 스캔라인 + ▶PLAY FREE 칩으로 아케이드 포스터 느낌. 8종이
 * 프레임/폰트/글로우/스캔라인은 공유(한 가족), 등급 색·글리프 패턴이 개성.
 */

const FONT_URL = '/fonts/PressStart2P.woff2'
const FONT_FAMILY = 'PressStartCanvas'
let fontPromise: Promise<void> | null = null

function ensureFont(): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve()
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const face = new FontFace(FONT_FAMILY, `url(${FONT_URL})`)
        await face.load()
        document.fonts.add(face)
      } catch {
        // 폴백: monospace
      }
    })()
  }
  return fontPromise
}

// 런치 기준 데일리 시리얼 번호. 실제 첫 데일리 날짜를 모르면 이 값이어도 무해(그냥 큰 수).
const LAUNCH_ISO = '2026-01-01'

/** dateISO('YYYY-MM-DD')의 데일리 시리얼(#199 같은). */
export function dailySerial(dateISO: string): number {
  const d = Date.parse(`${dateISO}T00:00:00Z`)
  const l = Date.parse(`${LAUNCH_ISO}T00:00:00Z`)
  if (Number.isNaN(d) || Number.isNaN(l)) return 0
  return Math.floor((d - l) / 86_400_000) + 1
}

/** 텍스트 스니펫용 유니코드 블록 행(모노크롬 → 클립보드/레딧 안전). par 있으면 그 뒤에 │. */
export function glyphBlocks(cells: number[], par?: number): string {
  let out = ''
  cells.forEach((v, i) => {
    if (par && i === par) out += '│'
    out += v >= 0.5 ? '▰' : '▱'
  })
  return out
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

/** par 데일리(적을수록 좋음): delta = used - par. */
export function gradeFewer(used: number, par: number): Grade {
  const d = used - par
  return d < 0 ? 'S' : d === 0 ? 'A' : d === 1 ? 'B' : d === 2 ? 'C' : 'D'
}

/** par 대비 많을수록 좋음(Ricochet chain): delta = val - par. */
export function gradeMore(val: number, par: number): Grade {
  const d = val - par
  return d >= 3 ? 'S' : d === 2 ? 'A' : d === 1 ? 'B' : d === 0 ? 'C' : 'D'
}

/** 엔들리스(PB 대비): 신기록이면 S, best 0이면 S, 아니면 score/best 비율. */
export function gradeRatio(score: number, best: number, isNewBest: boolean): Grade {
  if (isNewBest || best <= 0) return 'S'
  const r = score / best
  return r >= 0.85 ? 'A' : r >= 0.6 ? 'B' : r >= 0.35 ? 'C' : 'D'
}

/** 글리프 스트립 데이터. filled 채우고 나머지 비움. par 있으면 틱. n = min(10, max(filled, par||1)). */
export function barGlyph(
  filled: number,
  par: number | undefined,
  caption: string,
): { cells: number[]; par?: number; caption: string } {
  const n = Math.min(10, Math.max(filled, par ?? 1))
  const cells = Array.from({ length: n }, (_, i) => (i < filled ? 1 : 0.15))
  return { cells, par: par != null ? Math.min(par, 10) : undefined, caption }
}

/** 공유 텍스트 스니펫(3줄). url은 shareDaily가 붙이므로 여기 넣지 않는다. */
export function resultSnippet(
  gameName: string,
  dateISO: string,
  isDaily: boolean,
  grade: Grade,
  cells: number[],
  par: number | undefined,
  resultLine: string,
): string {
  const serial = isDaily ? ` #${dailySerial(dateISO)}` : ''
  const parTail = par != null ? `   par ${par}` : ''
  return `${gameName}${serial}  ·  RANK ${grade}\n${glyphBlocks(cells, par)}${parTail}\n${resultLine}. Your turn ↓`
}

export interface DailySharePayload {
  gameName: string
  dateISO: string
  accent: string // hex #rrggbb (네온 컬러)
  lines: { label: string; value: string }[] // grade 없을 때 폴백 스택
  streak?: number
  url: string
  /** 링크 없이도 퍼지는 텍스트. url은 shareDaily가 붙이므로 여기 넣지 말 것. */
  textSnippet: string
  subtitle?: string
  // ── 신규(전부 옵셔널 → 하위호환) ──
  isDaily?: boolean // true면 subtitle을 'DAILY · #{serial}'로 자동 생성
  grade?: 'S' | 'A' | 'B' | 'C' | 'D' // 있으면 등급-히어로, 없으면 lines 폴백
  scoreLine?: string // 등급 밑 강등된 한 줄 (예: '1240 PTS')
  glyph?: {
    cells: number[] // 6~10개, 0..1 강도
    par?: number // 1-based par 개수(있으면 par번째 셀 뒤에 흰 틱). 엔들리스는 생략
    caption?: string // 스트립 아래 muted 한 줄
  }
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, max: number, maxWidth: number): number {
  let size = max
  ctx.font = `${size}px "${FONT_FAMILY}", monospace`
  while (size > 18 && ctx.measureText(text).width > maxWidth) {
    size -= 2
    ctx.font = `${size}px "${FONT_FAMILY}", monospace`
  }
  return size
}

/** roundRect 폴백(구형 대비). path만 만든다 — 호출부에서 fill/stroke. */
function roundPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const GRADE_STYLE: Record<string, { fill: (a: string) => string; blur: number }> = {
  S: { fill: () => '#ffffff', blur: 48 },
  A: { fill: (a) => a, blur: 38 },
  B: { fill: (a) => a, blur: 24 },
  C: { fill: (a) => `${a}aa`, blur: 14 },
  D: { fill: (a) => `${a}66`, blur: 8 },
}

async function renderCard(p: DailySharePayload): Promise<Blob | null> {
  await ensureFont()
  const S = 1080
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const px = (n: number) => `${n}px "${FONT_FAMILY}", monospace`

  // ── 3-A. 배경 / 글로우 / 프레임 / 스캔라인 ──
  ctx.fillStyle = '#08080f'
  ctx.fillRect(0, 0, S, S)
  const glow = ctx.createRadialGradient(S / 2, S / 2, 80, S / 2, S / 2, S / 1.3)
  glow.addColorStop(0, `${p.accent}22`)
  glow.addColorStop(1, '#08080f00')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, S, S)

  ctx.strokeStyle = p.accent
  ctx.lineWidth = 8
  ctx.shadowColor = p.accent
  ctx.shadowBlur = 36
  ctx.strokeRect(44, 44, S - 88, S - 88)
  ctx.shadowBlur = 0

  ctx.globalAlpha = 0.03
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1
  for (let y = 46; y < 1034; y += 6) {
    ctx.beginPath()
    ctx.moveTo(46, y)
    ctx.lineTo(1034, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  ctx.textAlign = 'center'

  // ── 3-B. 마스트헤드 ──
  ctx.fillStyle = p.accent
  ctx.font = px(26)
  ctx.fillText('QUICK MINIGAMES', S / 2, 132)

  const nameSize = fitFont(ctx, p.gameName.toUpperCase(), 76, S - 200)
  ctx.fillStyle = '#ffffff'
  ctx.font = px(nameSize)
  ctx.fillText(p.gameName.toUpperCase(), S / 2, 235)

  ctx.fillStyle = '#8b93a7'
  ctx.font = px(20)
  const subtitle = p.isDaily
    ? `DAILY · #${dailySerial(p.dateISO)}`
    : (p.subtitle ?? `DAILY · ${p.dateISO}`)
  ctx.fillText(subtitle, S / 2, 295)

  if (p.grade) {
    // ── 3-C. RANK 씰 히어로 ──
    const cx = S / 2
    const cy = 540
    ctx.fillStyle = p.accent
    ctx.font = px(22)
    ctx.fillText('RANK', cx, 372)

    ctx.beginPath()
    ctx.arc(cx, cy, 140, 0, Math.PI * 2)
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 5
    ctx.shadowColor = p.accent
    ctx.shadowBlur = p.grade === 'S' ? 40 : 24
    ctx.stroke()
    ctx.shadowBlur = 0

    const gs = GRADE_STYLE[p.grade]
    ctx.textBaseline = 'middle'
    ctx.font = px(170)
    ctx.fillStyle = gs.fill(p.accent)
    ctx.shadowColor = p.accent
    ctx.shadowBlur = gs.blur
    ctx.fillText(p.grade, cx, cy + 6)
    ctx.shadowBlur = 0
    ctx.textBaseline = 'alphabetic'

    // 강등 스코어 라인
    ctx.fillStyle = '#8b93a7'
    ctx.font = px(24)
    const sl = p.scoreLine ?? `${p.lines[0]?.value ?? ''} ${p.lines[0]?.label.toUpperCase() ?? ''}`.trim()
    if (sl) ctx.fillText(sl, S / 2, 735)

    // ── 3-D. 글리프 스트립 ──
    if (p.glyph && p.glyph.cells.length > 0) {
      const cells = p.glyph.cells
      const n = cells.length
      const CELL = 56
      const GAP = 14
      const total = n * CELL + (n - 1) * GAP
      const startX = (S - total) / 2
      const topY = 775
      for (let i = 0; i < n; i++) {
        const x = startX + i * (CELL + GAP)
        const v = cells[i]
        roundPath(ctx, x, topY, CELL, CELL, 10)
        if (v <= 0.05) {
          ctx.strokeStyle = `${p.accent}40`
          ctx.lineWidth = 3
          ctx.stroke()
        } else {
          ctx.fillStyle = v >= 0.99 ? '#ffffff' : p.accent
          ctx.globalAlpha = 0.4 + 0.6 * v
          ctx.shadowColor = p.accent
          ctx.shadowBlur = 16 * v
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.globalAlpha = 1
        }
      }
      if (p.glyph.par && p.glyph.par < n) {
        const tx = startX + p.glyph.par * (CELL + GAP) - GAP / 2
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.moveTo(tx - 10, topY - 16)
        ctx.lineTo(tx + 10, topY - 16)
        ctx.lineTo(tx, topY - 2)
        ctx.closePath()
        ctx.fill()
      }
      if (p.glyph.caption) {
        ctx.fillStyle = '#8b93a7'
        ctx.font = px(18)
        ctx.fillText(p.glyph.caption, S / 2, 872)
      }
    }
  } else {
    // ── 4-B. grade 폴백: 기존 lines 스택 ──
    let y = 480
    for (const line of p.lines) {
      ctx.fillStyle = '#8b93a7'
      ctx.font = px(22)
      ctx.fillText(line.label.toUpperCase(), S / 2, y)
      const vSize = fitFont(ctx, line.value, 60, S - 240)
      ctx.fillStyle = p.accent
      ctx.font = px(vSize)
      ctx.fillText(line.value, S / 2, y + 72)
      y += 170
    }
  }

  // ── 3-E. 스트릭 ──
  if (p.streak && p.streak > 0) {
    ctx.font = px(30)
    ctx.fillStyle = '#fbbf24'
    ctx.fillText(`\u{1F525} ${p.streak} DAY STREAK`, S / 2, 928)
  }

  // ── 3-F. ▶PLAY FREE 칩 + URL ──
  ctx.font = px(20)
  const chipText = '▶ PLAY FREE'
  const cw = ctx.measureText(chipText).width + 48
  roundPath(ctx, (S - cw) / 2, 948, cw, 48, 24)
  ctx.fillStyle = p.accent
  ctx.globalAlpha = 0.14
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = p.accent
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = p.accent
  ctx.textBaseline = 'middle'
  ctx.fillText(chipText, S / 2, 973)
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = '#667085'
  ctx.font = px(22)
  ctx.fillText(siteConfig.url.replace(/^https?:\/\//, ''), S / 2, 1018)

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

/** 검증용: 카드를 dataURL로. (dev 페이지/테스트에서만 사용, 트리셰이킹됨) */
export async function renderCardDataURL(p: DailySharePayload): Promise<string> {
  const blob = await renderCard(p)
  if (!blob) return ''
  return await new Promise<string>((resolve) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.readAsDataURL(blob)
  })
}

export interface ShareResult {
  method: 'share' | 'download' | 'text-only'
}

export async function shareDaily(p: DailySharePayload): Promise<ShareResult> {
  try {
    await navigator.clipboard?.writeText(`${p.textSnippet}\n${p.url}`)
  } catch {
    // 클립보드 불가 무시
  }

  let blob: Blob | null = null
  try {
    blob = await renderCard(p)
  } catch {
    blob = null
  }
  if (!blob) return { method: 'text-only' }

  const file = new File([blob], `${p.gameName.toLowerCase().replace(/\s+/g, '-')}-result.png`, {
    type: 'image/png',
  })

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: p.textSnippet, url: p.url })
      return { method: 'share' }
    } catch {
      // 취소/실패 → 다운로드 폴백
    }
  }

  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
  return { method: 'download' }
}
