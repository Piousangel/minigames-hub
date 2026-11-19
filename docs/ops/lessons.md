# 운영 노하우

- 2026-11-13: 클라우드 루틴 샌드박스는 quickminigames.site에 프록시 403으로 접근 불가 → 라이브 QA는 `pnpm build && node scripts/check-routes.mjs`로 대체. 지표 파일의 D1 쿼리가 실패하면(11-12 파일) 회의에서 "지표 없음"으로 처리하고 사람에게 알린다.
- 2026-11-14: 화면에 박힌 숫자·"최신작" 문구는 하드코딩하면 금방 낡는다(100 vs 110). 레지스트리에서 계산한다.
- 2026-11-17: sendHit이 fetch 폴백을 쓰므로 fetch 모킹 테스트는 /api/score 호출만 필터해 센다.

- 2026-11-17: **`git add -A`가 빌드 산출물(`toss/dist`)을 커밋해 CI `pnpm lint`가 깨졌고 배포가 8번 연속 실패했다**(약 1시간, 마지막 성공 12:19 KST → 복구 PR #66). 원인은 PR 전에 `git status`를 보지 않은 것. 규칙: PR 전에 `git status --short`로 추적 대상이 의도한 파일뿐인지 본다. 머지 후에는 **deploy 워크플로 결과(`gh run list --workflow deploy.yml`)와 라이브 URL**을 확인한다(Vercel 미리보기 통과만으로 안심하지 않는다). 빌드 산출물은 .gitignore와 ESLint ignores에 넣는다.

- 2026-11-17 16시: 서브에이전트 리서치는 포털 도메인(poki·crazygames·itch·nytimes)이 세션 네트워크에서 막힌다. 근거 없음을 스펙에 그대로 적고 계측 실험으로 판정한다. 실험은 코호트 태그(`?ref=`)를 처음부터 심어야 판정 가능하다(리뷰가 지적).

- 2026-11-18 16시: 레포 pin 버전 playwright가 설치된 /opt/pw-browsers와 리비전이 달라 e2e가 안 뜬다 → 레포를 바꾸지 말고 스크래치패드에 `executablePath: '/opt/pw-browsers/chromium'` 임시 config로 실행한다.

- 2026-11-19 22시: 서버 검증의 허용 오차(잉크·점 간격·스폰 금지)는 추측하지 말고 **클라 규칙을 흉내 낸 퍼즈로 실측**해 테스트로 고정한다(정직한 선 오탐 0이 1순위). D1 표 추가는 IF NOT EXISTS 마이그레이션 + 표가 없을 때의 워커 폴백을 함께 내야 배포 순서에 안 묶인다.
