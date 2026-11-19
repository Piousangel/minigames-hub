import localFont from 'next/font/local'

// 둥근 캐주얼 폰트(Fredoka, OFL, 라틴 서브셋 가변 600–700). Acorn Hop처럼 '동화풍' 게임의 HUD·결과창 전용.
// fonts.ts와 따로 둔다: 레이아웃이 fonts.ts를 import하므로 거기 있으면 모든 페이지가 preload한다(R3).
export const roundFont = localFont({
  src: './fonts/Fredoka.woff2',
  display: 'swap',
  variable: '--font-round',
  weight: '300 700',
})
