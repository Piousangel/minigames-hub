import { siteConfig } from './siteConfig'

/**
 * Daily 결과 공유 카드. 정적 export라 전부 클라이언트 캔버스로 그린다(서버 없음).
 *
 * 두 채널을 동시에 노린다:
 *  - **이미지**(navigator.share files) — Reddit/Discord 같은 시각 플랫폼용, 네온 브랜드.
 *  - **텍스트 스니펫**(클립보드) — Wordle의 바이럴 엔진은 이미지가 아니라 링크 없이도
 *    인라인으로 퍼지는 텍스트였다. 그래서 항상 텍스트도 복사한다.
 *
 * 두 채널 모두 카드/스니펫에 사이트 URL을 박아 유입으로 되돌린다.
 */

const FONT_URL = '/fonts/PressStart2P.woff2'
const FONT_FAMILY = 'PressStartCanvas'
let fontPromise: Promise<void> | null = null

/** 픽셀 폰트를 캔버스에서 쓰려면 FontFace로 미리 로드해야 한다(1회). 실패해도 monospace 폴백. */
function ensureFont(): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve()
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const face = new FontFace(FONT_FAMILY, `url(${FONT_URL})`)
        await face.load()
        document.fonts.add(face)
      } catch {
        // 폴백: monospace로 그린다(브랜드감만 약간 손해)
      }
    })()
  }
  return fontPromise
}

export interface DailySharePayload {
  gameName: string
  dateISO: string
  accent: string // hex (네온 컬러)
  lines: { label: string; value: string }[] // 결과 통계 (예: Score / Longest chain)
  streak?: number
  url: string // 공유에 박을 사이트 링크(가능하면 ?seed= 포함)
  /** 링크 없이도 퍼지는 한 줄 텍스트 (예: "Ricochet Daily 2026-07-18 — 9-chain (par 7)") */
  textSnippet: string
  /** 게임명 아래 부제. 생략하면 `DAILY · {dateISO}`. 엔들리스 게임은 `HIGH SCORE` 등으로 넘긴다. */
  subtitle?: string
}

/** 폭에 맞을 때까지 폰트 크기를 줄인다(긴 게임명 대비). */
function fitFont(ctx: CanvasRenderingContext2D, text: string, max: number, maxWidth: number): number {
  let size = max
  ctx.font = `${size}px "${FONT_FAMILY}", monospace`
  while (size > 18 && ctx.measureText(text).width > maxWidth) {
    size -= 2
    ctx.font = `${size}px "${FONT_FAMILY}", monospace`
  }
  return size
}

async function renderCard(p: DailySharePayload): Promise<Blob | null> {
  await ensureFont()
  const S = 1080
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#08080f'
  ctx.fillRect(0, 0, S, S)

  // accent 방사형 글로우(은은하게)
  const glow = ctx.createRadialGradient(S / 2, S / 2, 80, S / 2, S / 2, S / 1.3)
  glow.addColorStop(0, `${p.accent}22`)
  glow.addColorStop(1, '#08080f00')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, S, S)

  // 네온 테두리
  ctx.strokeStyle = p.accent
  ctx.lineWidth = 8
  ctx.shadowColor = p.accent
  ctx.shadowBlur = 36
  ctx.strokeRect(44, 44, S - 88, S - 88)
  ctx.shadowBlur = 0

  ctx.textAlign = 'center'
  const px = (n: number) => `${n}px "${FONT_FAMILY}", monospace`

  // 헤더
  ctx.fillStyle = p.accent
  ctx.font = px(26)
  ctx.fillText('QUICK MINIGAMES', S / 2, 150)

  // 게임명(자동 축소)
  const nameSize = fitFont(ctx, p.gameName.toUpperCase(), 72, S - 200)
  ctx.fillStyle = '#ffffff'
  ctx.font = px(nameSize)
  ctx.fillText(p.gameName.toUpperCase(), S / 2, 290)

  // 부제(데일리는 'DAILY · 날짜', 엔들리스는 커스텀)
  ctx.fillStyle = '#8b93a7'
  ctx.font = px(20)
  ctx.fillText(p.subtitle ?? `DAILY · ${p.dateISO}`, S / 2, 350)

  // 결과 통계
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

  // streak
  if (p.streak && p.streak > 0) {
    ctx.font = px(34)
    ctx.fillStyle = '#fbbf24'
    ctx.fillText(`\u{1F525} ${p.streak} DAY STREAK`, S / 2, Math.min(y, S - 170))
  }

  // URL 푸터
  ctx.fillStyle = '#667085'
  ctx.font = px(24)
  ctx.fillText(siteConfig.url.replace(/^https?:\/\//, ''), S / 2, S - 90)

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

export interface ShareResult {
  method: 'share' | 'download' | 'text-only'
}

/**
 * 이미지 카드를 만들어 공유한다. 텍스트 스니펫은 항상 클립보드에 복사.
 * - navigator.share(files) 지원 → 이미지+텍스트+URL 공유 시트
 * - 미지원 → PNG 다운로드
 * - 캔버스 실패 → 텍스트만 복사
 */
export async function shareDaily(p: DailySharePayload): Promise<ShareResult> {
  // 텍스트는 항상 먼저 복사(가장 마찰 없는 채널)
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

  const file = new File([blob], `${p.gameName.toLowerCase().replace(/\s+/g, '-')}-daily.png`, {
    type: 'image/png',
  })

  // 이미지 파일 공유 지원 시
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: p.textSnippet, url: p.url })
      return { method: 'share' }
    } catch {
      // 사용자가 취소했거나 실패 → 다운로드 폴백
    }
  }

  // 다운로드 폴백
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
