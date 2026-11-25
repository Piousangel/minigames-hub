# HANDOFF — 미니게임허브 (현재분 ≤10KB · 줄 ≤150. 이력은 docs/archive/handoff-2026-*.md, 규칙은 docs/team/SHIFT.md)
갱신: 2026-11-25 05시(계획 루틴) · 북극성 측정 없음(주간 재방문 vid 미집계) · 방문자(UTC) 하루 약 5

## 지금 상태
- 리디자인 v2 정원 틀 완료: 게임 113 전부(R7a~f, #223), 게임 밖 허브 페이지 네온 0(R9, #225), 옛 네온 갈래·GameCard·SpotlightCard 삭제 + 관련 게임 정원 카드(R8, #230 — 오리지널 3종 하단만 의도된 변화). 브랜드 최종판·OG 리브랜드(#227·#228).
- 11-21 이후 머지: #230 R8, #231 사이드 스튜디오 Slack 규칙(→ SHIFT 8장) — 루틴 한도·운영안 v2 재편 중.
- PR CI 초록 = 머지 조건, 만성 실패 0(chore/ci-test-debt). check-seo·og-compress가 CI·deploy에 있음(#224).
- AdSense: 11-16 재검토 제출, 결과 대기. `adsenseEnabled` 꺼짐, 슬롯 ID만 연결(AD_SLOTS).
- 말랑 미끄럼길: 공개 중, 홍보 보류(오너). 점수는 서버 재생 검증(`/api/slime/submit`, D1 `slime_daily`).
- 열려 있는 실험: E1 홈 PLAY NOW(판정 11-24, n<30이면 보류·상한 12-01), E2 다음 게임 레일(판정 11-25).

## 진행 중·열린 PR
- #239 e2e 스모크 모바일 가로 넘침 검사 — CI 초록, 리뷰 대기. (#233 모바일 가로폭·시트는 11-24 머지)
- [H1] #241 tetris 퀄리티: `card/241-tetris-quality` PR 리뷰 대기(조작 버튼 한 줄). 남은 고칠 것은 장부 tetris 행.
- #44 `feat/toss-recoil` 오래됨·미접촉(닫을지 오너).

## 오늘 카드 (11-25 계획 루틴)
- ready: #236 [H0] 북극성 주간 재방문 측정(P1) · #241 [H1] tetris 첫 퀄리티 점검(P1) · #237 [H3] 말랑 점검·Q1 · #238 [H4] SEO·GEO.
- 한도 거절 추정(03:07 품질 흔적 0, 오너 Slack 'Actions 한도' 글) → 11-26 03시까지 P2(#237·#238)는 작업 루틴이 건너뜀(SHIFT 7장).

## 다음 할 일 (우선순위)
1. [H0] 북극성 측정 PR: `daily-metrics.mjs`에 주간 재방문 vid(AE blob4, anon 제외)·오늘 호 완료 고유 vid(`result_sheet`)·검색 유입 분리 줄. 기한 11-27 → 기준값 12-04(NORTH-STAR 2장).
2. [H0] 말랑 서버 제출 라이브 확인: deploy 로그 'D1 additive migrations' 성공 여부, AE `sl_submit_verified` 1건, Workers CPU p99(11-19 22시 인계, `shift/22-replay-verify`).
3. [H0] 실험 판정 기록: E1(11-24)·E2(11-25), 12-04 `?ref=threads·bluesky` 유입 전후(n<30 보류).
4. [H3] 말랑: bugs.md Q1[중] 꽃(도착점)이 폰 첫 화면 밖 — 디자인 결정(보드 top 실측 / 게임 페이지 2행 내비 / scrollIntoView) → PR-6 다중 선 UI(`/tools/slime-proto`) → PR-7 빌더·validator·2선 솔버·CB-3~5. 풀 교체 CUTOVER(c-meadow → c-meadow-2)는 리드 결정. `slimeSubmitBody`를 `lines`로(4~8단계 전).
5. [H1] 리뉴얼: R1 `useGameGate` 재사용 P1 나머지(beatline·offbeat·gridlock·zero-hour·whack-a-mole·morse-relay) → 축 C R2(solitaire 계열 점수·표시 정직화). 장부 'UX 친화성' 표(chess 토글 28px·beatline 탭·unblock select 14px·slime 소리 토글·solitaire).
6. [H1] 오너 결정 대기(장부): memory-game 판 크기·시간 모드, snake 속도 곡선, minesweeper 첫 클릭 3×3 빈 터 보장. 뿅 착지 v1.1 요소 다양화(`specs/2026-11-17-plop-variety.md`, 독립 리뷰 후 수정본) 오너 확인 대기.
6-1. [H0] 리더보드 S0~S3(`specs/2026-11-18-leaderboard-direction.md`, `specs/2026-11-19-leaderboard-s2.md`): S0 남은 것(이름 링크·욕설 필터, 게임별 점수 상한, SCORE_SCALE chess/go), S2c 착수 전 독립 리뷰 + 보드 노출 측정.
7. [H2] 꽃담 정원(가칭) G2: 사람 손 탭 JSON → 생성기 200개 분포(최소 턴 ≥3·집합 ≤3·봇 <20%), 미달이면 지형 추가 → 그래도 미달이면 보류. B 관문 전 비공개.
8. [H4] (#238 PR 리뷰 대기: llms.txt·robots AI 봇·감사 보고) 후속: title 65자 초과 26쪽·description 길이 88쪽 문구 카드, CWV·JSON-LD 샘플 5쪽 라이브 측정, AI 노출 기준선 측정. 대표 클래식 10개 스크린샷 카드, 트래픽 상위 20게임 공략, 마케팅 큐(말랑 제외).
9. 성능: registry 전문 청크(모든 페이지 77.5KB gzip) → 클라이언트 경량 인덱스 분리.
10. 토큰 전역화(R8 제안, 순서 고정): (a) garden-room·/tools에 현재 토큰 스코프 고정 → (b) 홈 `<main>` data-world 표시 → (c) `:root` 승격 + `color-scheme` light(statusBarStyle·manifest는 OG 담당과) → (d) 위젯 정원 덮어쓰기를 소스로 옮기고 스코프 규칙 삭제. 단계마다 게임 113·허브·홈 × 390·1440 픽셀 diff. 남은 네온 목록·위험 6개는 archive 핸드오프 R8 블록. e2e 대비 검사 함수 공용화.
11. QA: iOS Safari 실기기 시트 끌기·키보드, `/acorn-hop` 로드 중 CLS 0.05+(share-buttons·next-rail·daily-dock).
12. hook 오탐(고위험, 기록만): `stop-unsaved-work`가 루틴 클론의 낡은 로컬 `main`을 '원격에 없는 커밋'으로 셈 → `main`·`master` 제외 제안.
13. [운영] 운영안 v2 마무리: ① 루틴 26개 재편 — 오너가 루틴 계정 로그인 + Slack 커넥터 연결 후 메인 세션이 `docs/team/routines/` 초안으로 생성(그 전엔 루틴 생성·수정 금지) ② 공통 문서 동기화 Action(허브 SHIFT·OPS 공통부 → 샌드랩 사본 PR) ③ 하트비트 누락 감지 Actions cron(카드 `ready` 복귀 — GitHub cron은 3~5시간 늦을 수 있다, archive playbook '배운 점') ④ 로그 절삭 PreToolUse hook(`| tail -n 80`, 고위험·리뷰 2회) ⑤ `stop-unsaved-work` 안내의 브랜치 이름 `shift/` → `card/`(고위험) ⑥ 말랑 옛 저장 데이터 골든 테스트(H3).
- 오너 할 일: Slack 이름표에 H0(재방문·측정) 이름 추가 확인(전까지 `허브 · 운영 리드`). main 필수 체크 지정(`pr-guard / high-risk` 포함)은 Actions가 main에 직접 커밋하는 워크플로 4개(metrics·marketing-post·marketing-blog·gen-assets)를 PR 방식으로 바꾼 뒤. Search Console·Bing 접근 방법.
- 오너 선택: `OG_VERSION` g1→g2, 헤더 28~36px 링 강조판, manifest 크림↔노을 색, R9 소개 접기·새 머리글 문구, 카톡 URL 캐시·Search Console 재색인, main 브랜치 보호 필수 체크.

## 현재 유효한 함정
- 정본은 [docs/team/PITFALLS.md](docs/team/PITFALLS.md) — 카드 영역의 줄만 읽는다. 새 함정은 그 파일에.

## 검증 상태
- main(#229, 11-21) 기준 PR CI 초록: typecheck · lint · 전체 vitest · build · check-routes · check-seo · e2e 스모크. 전체 e2e(게임별 smoke)는 로컬·루틴 몫.
- 낡은 말랑 e2e 2건은 11-20 00시 QA가 갱신함. 기준선이 흔들리면 main 빌드에서 먼저 재현.
