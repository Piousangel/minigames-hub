import { brandPng } from '../_logo'

// PWA maskable 512 PNG — 엠블럼(링 바깥 지름)을 타일의 66%로 줄여 원형·스퀴클 크롭(안전 영역 지름 80%) 안에 둔다.
export const dynamic = 'force-static'

export function GET() {
  return brandPng('pwa-maskable-512.png')
}
