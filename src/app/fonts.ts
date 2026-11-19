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

// ───── 허브 리디자인 v2 「노을 정원」 폰트 (계획서 D9, R1에서는 변수만 노출 — 적용은 R2·R3) ─────
// 원본: Google Fonts 공식 소스(google/fonts ofl/*), OFL 1.1 → ./fonts/OFL.txt.
// Fraunces는 가변 축 전체를 싣지 않고 fontTools로 정적 인스턴스 2개만 만들었다
// (wght 600 · SOFT 100 · opsz 72 · WONK 0, 라틴 서브셋). 다른 굵기·축이 필요하면 인스턴스를 새로 만든다.

// Display(로고·H1·섹션·게임 제목): Fraunces 600 roman + italic.
export const displayFont = localFont({
  src: [
    { path: './fonts/Fraunces-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/Fraunces-600-Italic.woff2', weight: '600', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-display',
  // R2부터 헤더 wordmark(roman)가 쓴다. preload는 아직 끔 — 이 옵션은 roman·italic 둘 다 preload해서
  // 'preload 1개'(콘셉트 3-2)를 넘는다. R3에서 H1에 적용할 때 roman만 따로 preload하도록 나눈다.
  // 그동안 wordmark는 swap(+adjustFontFallback)으로 그려지고 헤더 높이는 고정이라 CLS는 없다.
  preload: false,
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
})

// UI·본문: Figtree variable(wght 300–900, 라틴 서브셋).
export const uiFont = localFont({
  src: './fonts/Figtree-Variable.woff2',
  display: 'swap',
  variable: '--font-ui',
  // R2: 헤더·푸터(모든 페이지 첫 화면)에 쓰므로 preload. 가변 1파일이라 preload도 1개.
  preload: true,
  weight: '300 900',
  adjustFontFallback: 'Arial',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Arial', 'sans-serif'],
})
