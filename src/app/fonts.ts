import localFont from 'next/font/local'

// 픽셀 아케이드 폰트(Press Start 2P, OFL). self-host → 정적 export/CSP 안전, 외부 요청 없음.
// 로고·제목·짧은 라벨에만 사용(본문은 가독성 위해 시스템 산세리프 유지).
export const pixelFont = localFont({
  src: './fonts/PressStart2P.woff2',
  display: 'swap',
  variable: '--font-pixel',
  weight: '400',
})

// 둥근 캐주얼 폰트(Fredoka)는 ./roundFont.ts — 여기 두면 레이아웃이 이 파일을 import해서 홈·허브 전 페이지가
// Fredoka(30KB)를 preload했다(R3에서 분리, 쓰는 게임 페이지에서만 preload).


// ───── 허브 리디자인 v2 「노을 정원」 폰트 (계획서 D9, R1에서는 변수만 노출 — 적용은 R2·R3) ─────
// 원본: Google Fonts 공식 소스(google/fonts ofl/*), OFL 1.1 → ./fonts/OFL.txt.
// Fraunces는 가변 축 전체를 싣지 않고 fontTools로 정적 인스턴스 2개만 만들었다
// (wght 600 · SOFT 100 · opsz 72 · WONK 0, 라틴 서브셋). 다른 굵기·축이 필요하면 인스턴스를 새로 만든다.

// Display(로고·H1·섹션·게임 제목): Fraunces 600 roman. R3: 홈 H1·헤더 wordmark가 첫 화면에서 쓰므로 preload.
// roman·italic을 한 localFont에 넣으면 preload가 둘 다 걸려 'preload 1개'(콘셉트 3-2)를 넘는다 → 두 객체로 나눴다.
export const displayFont = localFont({
  src: './fonts/Fraunces-600.woff2',
  weight: '600',
  style: 'normal',
  display: 'swap',
  variable: '--font-display',
  preload: true,
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
})

// Display italic(H1 둘째 구절 'that blooms daily.' 등): preload 안 함 — swap으로 늦게 들어와도
// 줄 높이가 고정(leading 고정값)이라 CLS가 없다. 쓰는 곳은 `font-display-italic` 클래스(globals.css).
export const displayItalicFont = localFont({
  src: './fonts/Fraunces-600-Italic.woff2',
  weight: '600',
  style: 'italic',
  display: 'swap',
  variable: '--font-display-italic',
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
