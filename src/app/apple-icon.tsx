import { iconImage } from './icons/_logo'

export const dynamic = 'force-static'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS "홈 화면에 추가" 아이콘 — 브랜드 네온 아케이드 로고(favicon·PWA 192/512와 동일 모티프).
export default function AppleIcon() {
  return iconImage(180)
}
