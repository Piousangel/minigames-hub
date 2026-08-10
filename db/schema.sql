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

-- 게임별 익명 댓글(Approach A, 2026-08-10) — UGC라 모더레이션 큐 없이 즉시공개하는 대신
-- 여러 방어선(허니팟·링크차단·길이제한·IP 레이트리밋)을 겹친다(src/lib/comments.ts 참고).
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments (slug, created_at DESC);

-- IP당 마지막 댓글 시각 — 짧은 시간 내 재작성을 막는 최소 레이트리밋(comments.ts의
-- COMMENT_RATE_LIMIT_MS). 기존 코드베이스엔 IP 기반 방어가 전혀 없었어서 신규.
CREATE TABLE IF NOT EXISTS comment_rate_limits (
  ip TEXT PRIMARY KEY,
  last_at INTEGER NOT NULL
);
