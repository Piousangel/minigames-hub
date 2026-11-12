# 운영 노하우

- 2026-11-13: 클라우드 루틴 샌드박스는 quickminigames.site에 프록시 403으로 접근 불가 → 라이브 QA는 `pnpm build && node scripts/check-routes.mjs`로 대체. 지표 파일의 D1 쿼리가 실패하면(11-12 파일) 회의에서 "지표 없음"으로 처리하고 사람에게 알린다.
