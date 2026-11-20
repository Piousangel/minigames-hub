-- 오늘 방문자 수(2026-11-20, 오너 "today 방문자"). 추가 전용·멱등(IF NOT EXISTS) — 기존 표·행을 건드리지 않는다.
-- visit_days: UTC 날짜별 고유 방문자 숫자 + 그날의 무작위 솔트(날이 지나면 NULL로 지운다 → 숫자만 남는다).
-- visit_seen: 그날 본 방문자의 HMAC 해시(IP 원문 아님). 다음 날 첫 방문 때 지난 날 행을 지운다.
-- 적용: deploy.yml이 배포 전에 원격 D1에 실행한다(실패해도 배포는 진행, 워커는 표가 없으면 세지 않고 줄을 숨긴다).
-- 되돌리기: DROP TABLE visit_seen; DROP TABLE visit_days; (다른 표와 관계 없음)
CREATE TABLE IF NOT EXISTS visit_days (
  day TEXT PRIMARY KEY,
  visitors INTEGER NOT NULL DEFAULT 0,
  salt TEXT
);
CREATE TABLE IF NOT EXISTS visit_seen (
  day TEXT NOT NULL,
  h TEXT NOT NULL,
  PRIMARY KEY (day, h)
);
