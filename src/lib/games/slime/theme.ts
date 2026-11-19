/** 스테이지 시간대(시각 전용, 엔진·골든 무관). 하늘은 기존 노을 에셋 위에 색 막을 얹어 만든다(신규 일러스트 0장). */
export type Theme = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'sunset' | 'dusk' | 'night' | 'starry'

export interface SkyStyle {
  top: string
  bottom: string
  /** 에셋 위에 얹는 색 막의 불투명도(0이면 에셋 그대로) */
  veil: number
  sea: string
  /** 해(밝은 원) 또는 달 */
  orb: { x: number; y: number; r: number; color: string; alpha: number } | null
  stars: number
}

export const SKY: Record<Theme, SkyStyle> = {
  dawn: { top: '#f6b6c8', bottom: '#ffe3b8', veil: 0.55, sea: '#c9a8e0', orb: { x: 0.5, y: 0.6, r: 46, color: '#ffd9a0', alpha: 0.85 }, stars: 0 },
  morning: { top: '#ffe3b8', bottom: '#bfe6ff', veil: 0.6, sea: '#b7c8ee', orb: { x: 0.22, y: 0.18, r: 34, color: '#fff0b8', alpha: 0.9 }, stars: 0 },
  noon: { top: '#8fd3ff', bottom: '#e9f8ff', veil: 0.7, sea: '#9fb8f0', orb: { x: 0.5, y: 0.1, r: 30, color: '#fffbe0', alpha: 0.6 }, stars: 0 },
  afternoon: { top: '#ffd27a', bottom: '#fff0c8', veil: 0.6, sea: '#e0b8d8', orb: { x: 0.78, y: 0.2, r: 36, color: '#fff3c0', alpha: 0.85 }, stars: 0 },
  sunset: { top: '#ff9d7a', bottom: '#ffd9b0', veil: 0, sea: '#b79ad9', orb: null, stars: 0 },
  dusk: { top: '#8a4f9e', bottom: '#ffb07a', veil: 0.62, sea: '#7a5aa8', orb: null, stars: 6 },
  night: { top: '#3d3170', bottom: '#5a4690', veil: 0.8, sea: '#3a2f70', orb: { x: 0.74, y: 0.2, r: 22, color: '#fff3dc', alpha: 1 }, stars: 24 },
  starry: { top: '#1b1740', bottom: '#4a3a8a', veil: 0.88, sea: '#2b2260', orb: { x: 0.28, y: 0.22, r: 30, color: '#fff3dc', alpha: 1 }, stars: 48 },
}

/** 현재 스테이지 → 시간대. 새 스테이지(v3-*)는 여기에 한 줄 추가한다. 없으면 노을(현행). */
export const THEME_BY_STAGE: Record<string, Theme> = {
  'g-slide': 'dawn',
  's-spike': 'afternoon',
  'c-meadow': 'morning',
  'g-wall': 'noon',
  's-wall-b': 'sunset',
  's-bounce': 'dusk',
  // 반전본(풀 제외, 골든 전용)
  'g-slide-m': 'morning',
  's-spike-m': 'afternoon',
  'g-wall-m': 'sunset',
  's-wall-b-m': 'starry',
}
export const themeOf = (stageId: string): Theme => THEME_BY_STAGE[stageId] ?? 'sunset'

function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** 에셋 하늘 위에 시간대 색 막·해/달·별을 얹는다. W×H는 논리 보드 크기. */
export function paintSkyTheme(g: CanvasRenderingContext2D, theme: Theme, W: number, H: number, t: number, calm: boolean): void {
  paintSkyVeil(g, theme, W, H)
  paintSkyStars(g, theme, W, H, t, calm)
}

/** 별이 프레임마다 반짝이는가(아니면 하늘 전체가 정적이라 오프스크린 캐시에 같이 넣을 수 있다). */
export const skyStarsAnimated = (theme: Theme, calm: boolean): boolean => !calm && SKY[theme].stars > 0

/** 시간대의 정적 부분: 색 막·바다 띠·해/달(시간 무관 → 오프스크린 캐시 대상). */
export function paintSkyVeil(g: CanvasRenderingContext2D, theme: Theme, W: number, H: number): void {
  const s = SKY[theme]
  if (s.veil > 0) {
    const grad = g.createLinearGradient(0, 0, 0, H * 0.62)
    grad.addColorStop(0, s.top)
    grad.addColorStop(1, s.bottom)
    g.save()
    g.globalAlpha = s.veil
    g.fillStyle = grad
    g.fillRect(0, 0, W, H * 0.62)
    // 구름 아래 바다 띠
    g.fillStyle = s.sea
    g.globalAlpha = s.veil * 0.55
    g.fillRect(0, H * 0.62, W, H * 0.38)
    g.restore()
  }
  if (s.orb) {
    const o = s.orb
    const gl = g.createRadialGradient(W * o.x, H * o.y, 2, W * o.x, H * o.y, o.r * 2.4)
    gl.addColorStop(0, o.color)
    gl.addColorStop(1, 'rgba(255,255,255,0)')
    g.save()
    g.globalAlpha = o.alpha * 0.45
    g.fillStyle = gl
    g.beginPath()
    g.arc(W * o.x, H * o.y, o.r * 2.4, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = o.alpha
    g.fillStyle = o.color
    g.beginPath()
    g.arc(W * o.x, H * o.y, o.r, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
}

/** 시간대의 별(움직임 줄이기면 고정 밝기). 색 막·해/달 위에 그린다. */
export function paintSkyStars(g: CanvasRenderingContext2D, theme: Theme, W: number, H: number, t: number, calm: boolean): void {
  const s = SKY[theme]
  for (let i = 0; i < s.stars; i++) {
    const x = hash(i) * W
    const y = hash(i + 91) * H * 0.55
    const tw = calm ? 0.8 : 0.55 + 0.45 * Math.sin(t / 500 + i * 2.1)
    g.fillStyle = `rgba(255,243,220,${tw})`
    g.fillRect(x, y, 2 + (i % 3 === 0 ? 1 : 0), 2 + (i % 3 === 0 ? 1 : 0))
  }
}

/** 일일 8칸의 타이틀 카드·공유 이름(슬롯 번호 기준, 확정 스펙 B장). 슬롯의 지형이 바뀌어도 이름은 슬롯에 붙는다. */
export const SLOT_NAMES = ['First Light', 'Morning Meadow', 'Stone Steps', 'Twin Hills', 'Two Banks', 'Jelly Hollow', 'Windy Ridge', 'Lantern Gate']
export const slotName = (i: number): string => SLOT_NAMES[i] ?? `Stage ${i + 1}`
