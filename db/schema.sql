-- 주간 글로벌 리더보드. week = ISO 주 문자열(예: 2026-W29). game별·주별 톱N 조회.
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  week TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_board ON scores (game, week, score DESC);

-- 게임별 이모지 리액션(무계정, UGC 없음) — 방문자당 게임당 이모지당 1클릭만 반영되도록
-- 클라이언트(localStorage)에서 dedup, 서버는 카운터만 증가(src/lib/reactions.ts 참고).
CREATE TABLE IF NOT EXISTS reactions (
  slug TEXT NOT NULL,
  emoji TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, emoji)
);
