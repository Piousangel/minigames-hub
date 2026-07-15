import type { NeonAccent } from './gameMeta'

// OG 이미지(ImageResponse/Satori)는 CSS 변수를 못 읽으므로 리터럴 hex 필요.
// globals.css의 --neon-* 값과 일치.
export const ACCENT_HEX: Record<NeonAccent, string> = {
  cyan: '#22d3ee',
  magenta: '#ff3d9a',
  lime: '#a3e635',
  amber: '#fbbf24',
  purple: '#b06bff',
  blue: '#4d7cff',
  red: '#ff4d6d',
  green: '#34e39b',
}

export const OG_BG = '#08080f'
