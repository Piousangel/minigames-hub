import localFont from 'next/font/local'

// 픽셀 아케이드 폰트(Press Start 2P, OFL). self-host → 정적 export/CSP 안전, 외부 요청 없음.
// 로고·제목·짧은 라벨에만 사용(본문은 가독성 위해 시스템 산세리프 유지).
export const pixelFont = localFont({
  src: './fonts/PressStart2P.woff2',
  display: 'swap',
  variable: '--font-pixel',
  weight: '400',
})
