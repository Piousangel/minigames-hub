-- 말랑 미끄럼길 하루 제출(서버 재생 검증, 2026-11-19). 추가 전용·멱등(IF NOT EXISTS) — 기존 표·행을 건드리지 않는다.
-- (day, player)당 1행: 같은 사람이 하루에 여러 번 제출해도 scores에는 한 행만 남기고 점수가 오를 때만 갱신한다.
-- player = 'v:'+익명 방문자 id 해시(없으면 'ip:'+IP 해시). 원본 vid·IP는 저장하지 않는다.
-- 적용: deploy.yml이 배포 전에 원격 D1에 실행한다(실패해도 배포는 진행, 워커는 표가 없으면 scores 추가로 폴백).
CREATE TABLE IF NOT EXISTS slime_daily (
  day TEXT NOT NULL,
  player TEXT NOT NULL,
  total INTEGER NOT NULL,
  cleared INTEGER NOT NULL,
  hints INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  score_id INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (day, player)
);
