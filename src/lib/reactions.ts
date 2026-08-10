// 게임 공용 리액션(무계정, 자유텍스트 없음) — D1 reactions 테이블과 Worker(/api/reaction)가
// 공유. UGC가 없어 스팸/모더레이션 리스크가 없다(design doc Approach C 참고).

export const REACTIONS = ['🔥', '😂', '😭', '💀'] as const
export type Reaction = (typeof REACTIONS)[number]

export type ReactionCounts = Record<Reaction, number>

export function emptyReactionCounts(): ReactionCounts {
  return { '🔥': 0, '😂': 0, '😭': 0, '💀': 0 }
}

export function isValidReaction(emoji: string): emoji is Reaction {
  return (REACTIONS as readonly string[]).includes(emoji)
}

// 리더보드처럼 전체 슬러그 목록을 대조하지 않는다 — 리액션은 리더보드 유무와 무관하게
// 전 게임에서 쓰이므로(design doc: 사이트 전체 리텐션 장치), 기존 /api/hit의 slug 검증
// 수준(느슨한 형식 체크)에 맞춘다. 잘못된 슬러그가 들어와도 화면에 절대 노출 안 됨(항상
// 실제 페이지의 slug로만 조회하므로) — 위험은 낮다.
const SLUG_RE = /^[a-z0-9-]{1,40}$/
export function isValidReactionSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}

// 클라이언트 dedup: 방문자당 게임당 이모지당 1클릭만 반영(서버 사이드 방지는 v1에서
// 의도적으로 생략 — design doc Approach C 참고). localStorage 실패(프라이빗 모드 등)해도
// UX를 막지 않는다.
function reactedKey(slug: string, emoji: string): string {
  return `reacted:${slug}:${emoji}`
}

export function hasReacted(slug: string, emoji: string): boolean {
  try {
    return localStorage.getItem(reactedKey(slug, emoji)) === '1'
  } catch {
    return false
  }
}

export function markReacted(slug: string, emoji: string): void {
  try {
    localStorage.setItem(reactedKey(slug, emoji), '1')
  } catch {
    // 무시 — 저장 실패해도 이번 클릭 자체는 이미 서버에 반영됨
  }
}
