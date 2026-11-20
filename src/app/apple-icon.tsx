import { brandPng } from './icons/_logo'

export const dynamic = 'force-static'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// iOS "홈 화면에 추가" 아이콘 — 노을 바탕 + 금빛 링 엠블럼(불투명 정사각, iOS가 둥근 사각으로 자른다).
export default function AppleIcon() {
  return brandPng('apple-180.png')
}
