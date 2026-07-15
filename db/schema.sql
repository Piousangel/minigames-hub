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
