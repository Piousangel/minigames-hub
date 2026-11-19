/**
 * 홈 Continue 줄의 '인기 4' 후보 — 예전 홈 Featured 레일(FeaturedGames)의 큐레이션 순서 그대로(범용 매력 우선).
 * /api/popular가 있으면 이 집합 안에서만 재정렬한다(src/lib/popular.ts rankFeatured — 가짜 vid로 임의 게임을 못 올리게).
 */
export const POPULAR_CURATED = [
  'solitaire', 'chess', '2048', 'flow', 'unblock', 'mahjong', 'yahtzee', 'mancala', 'battleship',
  'beatline', 'clusters', 'minesweeper', 'snake', 'tetris', 'quadle', 'equate', 'jigsaw', 'reactor',
] as const
