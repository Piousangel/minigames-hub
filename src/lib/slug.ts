// 슬러그 형식 검증 — 전체 게임 레지스트리를 불러오지 않고(워커 번들 최소화) 느슨한
// 형식만 체크한다(기존 /api/hit과 같은 수준). 리액션·댓글이 공유하는 단일 소스.
const SLUG_RE = /^[a-z0-9-]{1,40}$/

export function isValidGameSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}
