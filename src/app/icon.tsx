import { iconImage } from './icons/_logo'

export const dynamic = 'force-static'
// 구글 검색 파비콘은 48px의 배수(≥48)를 권장 → 96×96 PNG로 생성(래스터라 구글이 확실히 집는다).
export const size = { width: 96, height: 96 }
export const contentType = 'image/png'

// 브랜드 로고: 헤더와 같은 정원 로고 마크(해 + 떠 있는 섬) — PWA·애플 아이콘과 같은 렌더러.
export default function Icon() {
  return iconImage(96, 0.86)
}
