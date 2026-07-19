/**
 * 즐겨찾기('My Games') — 무계정 localStorage로 '다시 찾는 마찰'을 제거하는 재방문 훅.
 * 대형 포털은 로그인 뒤에 숨기지만 우리는 즉시 제공 = 차별점(DOMAIN §3).
 *
 * 저장: 문자열 slug 배열. 최신 즐겨찾기가 앞(맨 앞 추가)이라 홈 레일이 최근 관심 순.
 * 컴포넌트 간 동기화: 토글 시 window에 커스텀 이벤트를 쏴서 하트/레일이 함께 갱신된다
 * (native 'storage' 이벤트는 다른 탭에서만 발생하므로 같은 탭 동기화엔 커스텀 이벤트 필요).
 */
export const FAVORITES_KEY = 'favorites'
export const FAVORITES_EVENT = 'favorites-changed'

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

function save(slugs: string[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(slugs))
    window.dispatchEvent(new CustomEvent(FAVORITES_EVENT))
  } catch {
    // 저장 실패(용량/사파리 프라이빗) → 조용히 무시
  }
}

export function isFavorite(slug: string): boolean {
  return loadFavorites().includes(slug)
}

/** 토글 후 새 상태(즐겨찾기면 true) 반환. 추가 시 맨 앞에 넣어 '최근 관심' 순 유지. */
export function toggleFavorite(slug: string): boolean {
  const cur = loadFavorites()
  if (cur.includes(slug)) {
    save(cur.filter((s) => s !== slug))
    return false
  }
  save([slug, ...cur])
  return true
}
