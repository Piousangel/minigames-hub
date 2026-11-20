import { brandPng } from './icons/_logo'

export const dynamic = 'force-static'
// 구글 검색 파비콘은 48px의 배수(≥48)를 권장 → 96×96 PNG(래스터라 구글이 확실히 집는다).
export const size = { width: 96, height: 96 }
export const contentType = 'image/png'

// 브랜드 마크(금빛 원판 + 말랑이, 바깥 투명) — 헤더 마크와 같은 그림. 탭 16·32·48은 favicon.ico.
export default function Icon() {
  return brandPng('icon-96.png')
}
