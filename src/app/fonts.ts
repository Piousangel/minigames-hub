import localFont from 'next/font/local'

// 픽셀 아케이드 폰트(Press Start 2P, OFL). self-host → 정적 export/CSP 안전, 외부 요청 없음.
// 로고·제목·짧은 라벨에만 사용(본문은 가독성 위해 시스템 산세리프 유지).
export const pixelFont = localFont({
  src: './fonts/PressStart2P.woff2',
  display: 'swap',
  variable: '--font-pixel',
  weight: '400',
})

// 둥근 캐주얼 폰트(Fredoka, OFL, 라틴 서브셋 가변 600–700). Acorn Hop처럼 '동화풍' 게임의 HUD·결과창 전용.
export const roundFont = localFont({
  src: './fonts/Fredoka.woff2',
  display: 'swap',
  variable: '--font-round',
  weight: '300 700',
})
