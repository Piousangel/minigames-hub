import { iconImage } from '../_logo'

// PWA 설치 아이콘 512×512 PNG(정적 export). manifest가 any/maskable로 참조.
export const dynamic = 'force-static'

export function GET() {
  return iconImage(512)
}
