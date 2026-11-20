import { brandPng } from '../_logo'

// PWA 설치 아이콘 192×192 PNG(정적 export, purpose any). manifest가 참조 → Android 설치 기준 충족.
export const dynamic = 'force-static'

export function GET() {
  return brandPng('pwa-192.png')
}
