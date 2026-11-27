# HANDOFF — 미니게임허브 (현재분 ≤10KB · 줄 ≤150. 이력은 docs/archive/handoff-2026-*.md, 규칙은 docs/team/SHIFT.md)
갱신: 2026-11-28 05시(계획 루틴) · 북극성 측정 없음(주간 재방문 vid 미집계)

## 지금 상태
- 리디자인 v2 정원 틀 완료: 게임 113 전부(R7a~f, #223), 게임 밖 허브 페이지 네온 0(R9, #225), 옛 네온 갈래·GameCard·SpotlightCard 삭제 + 관련 게임 정원 카드(R8, #230 — 오리지널 3종 하단만 의도된 변화). 브랜드 최종판·OG 리브랜드(#227·#228).
- PR CI 초록 = 머지 조건, 만성 실패 0(chore/ci-test-debt). check-seo·og-compress가 CI·deploy에 있음(#224).
- AdSense: 11-16 재검토 제출, 결과 대기. `adsenseEnabled` 꺼짐, 슬롯 ID만 연결(AD_SLOTS).
- 말랑 미끄럼길: 공개 중, 홍보 보류(오너). 점수는 서버 재생 검증(`/api/slime/submit`, D1 `slime_daily`).
- 열려 있는 실험: E1 홈 PLAY NOW(판정 11-24, n<30이면 보류·상한 12-01), E2 다음 게임 레일(판정 11-25).

## 진행 중·열린 PR
- #260 draft(#237 말랑 Q1 꽃 스크롤) — 토 13:07 H3가 이어받음. #44 `feat/toss-recoil` 오래됨·미접촉(닫을지 오너).

## 오늘 카드 (11-28 토 계획 루틴)
- 어제 머지: #267 꽃담 G3-1(비공개) · #268 2048 Animals 리마스터(출시, 장부 18→20) · #269 title 26쪽 · #271 노을 새총 G1 브리프(4.5/10 미통과).
- #272 [H1] Snake 리마스터(정원 지도·연속 먹기 음·390 한 화면, 장부 19→21+) — 11:07, **오늘 머지·라이브**(토 출시분).
- #273 [H2] 꽃담 G3-2 시안 + 혹평 채점(트랙 A 07:07) · #274 [H2] 노을 새총 G1-2 규칙 v2(트랙 B 17:07). 둘 다 prepro·비공개라 월(11-30) H2 출시는 없음 — 관문 ① 전.
- #237 [H3] 토 13:07 draft #260 이어받기.
- **#236 [H0] 기한(11-27) 넘김**: H0 전용 슬롯이 없어 11:07 H1 카드에 밀림 → 11:07 run이 #272 PR 뒤 시간이 남으면 #236을 집는다(작업 루틴 '팀이 둘이면 앞 팀부터'). #248·#250도 ready.
- 하트비트 누락·거절 추정·열린 결정·#team-requests 새 부탁 없음.

## 다음 할 일 (우선순위)
1. [H0] 북극성 측정 PR: `daily-metrics.mjs`에 주간 재방문 vid(AE blob4, anon 제외)·오늘 호 완료 고유 vid(`result_sheet`)·검색 유입 분리 줄. 기한 11-27 → 기준값 12-04(NORTH-STAR 2장).
2. [H0] 말랑 서버 제출 라이브 확인: deploy 로그 'D1 additive migrations' 성공 여부, AE `sl_submit_verified` 1건, Workers CPU p99(11-19 22시 인계, `shift/22-replay-verify`).
3. [H0] 실험 판정 기록: E1(11-24)·E2(11-25), 12-04 `?ref=threads·bluesky` 유입 전후(n<30 보류).
4. [H3] 말랑: bugs.md Q1[중] 꽃(도착점)이 폰 첫 화면 밖 — 디자인 결정(보드 top 실측 / 게임 페이지 2행 내비 / scrollIntoView) → PR-6 다중 선 UI(`/tools/slime-proto`) → PR-7 빌더·validator·2선 솔버·CB-3~5. 풀 교체 CUTOVER(c-meadow → c-meadow-2)는 리드 결정. `slimeSubmitBody`를 `lines`로(4~8단계 전).
5. [H1] #263 다음: 테트리스 390 결과 시트가 판보다 넓어 Best·Lines 칸 일부를 덮음(QA-1 11-26) → R1 `useGameGate` 재사용 P1 나머지(beatline·offbeat·gridlock·zero-hour·whack-a-mole·morse-relay) → 축 C R2(solitaire 계열 점수·표시 정직화). 장부 'UX 친화성' 표(chess 토글 28px·beatline 탭·unblock select 14px·slime 소리 토글·solitaire).
6. [H1] 오너 결정 대기(장부): memory-game 판 크기·시간 모드, snake 속도 곡선, minesweeper 첫 클릭 3×3 빈 터 보장. 뿅 착지 v1.1 요소 다양화(`specs/2026-11-17-plop-variety.md`, 독립 리뷰 후 수정본) 오너 확인 대기.
6-1. [H0] 리더보드 S0~S3(`specs/2026-11-18-leaderboard-direction.md`, `specs/2026-11-19-leaderboard-s2.md`): S0 남은 것(이름 링크·욕설 필터, 게임별 점수 상한, SCORE_SCALE chess/go), S2c 착수 전 독립 리뷰 + 보드 노출 측정.
7. [H2] 2트랙은 게임을 나눈다: 07:07 트랙 A = 꽃담(#267 머지 → G3-2 시안 혹평 채점 카드), 17:07 트랙 B = 노을 새총(#270 머지 뒤 **G1-2 규칙 v2 + 탑 1 손 계산** 카드, 수락 기준은 `docs/team/specs/2026-11-27-dusk-sling-g1.md` 10장 ①~⑧, stage:prepro·코드 0). 둘 다 B 관문 전 비공개. (신작 후보 1위 Secret Rule은 `hunch`로 이미 있음.)
8. [H4] (#249 머지) 후속: `siteDescription` 손 분기 데이터화, description 길이 88쪽 문구 카드(title 26쪽은 #265 PR), CWV·JSON-LD 샘플 5쪽 라이브 측정, AI 노출 기준선 측정. 대표 클래식 10개 스크린샷 카드, 트래픽 상위 20게임 공략, 마케팅 큐(말랑 제외).
9. 성능: registry 전문 청크(모든 페이지 77.5KB gzip) → 클라이언트 경량 인덱스 분리.
10. 토큰 전역화(R8 제안, 순서 고정): (a) garden-room·/tools에 현재 토큰 스코프 고정 → (b) 홈 `<main>` data-world 표시 → (c) `:root` 승격 + `color-scheme` light(statusBarStyle·manifest는 OG 담당과) → (d) 위젯 정원 덮어쓰기를 소스로 옮기고 스코프 규칙 삭제. 단계마다 게임 113·허브·홈 × 390·1440 픽셀 diff. 남은 네온 목록·위험 6개는 archive 핸드오프 R8 블록. e2e 대비 검사 함수 공용화.
11. QA: iOS Safari 실기기 시트 끌기·키보드, `/acorn-hop` 로드 중 CLS 0.05+(share-buttons·next-rail·daily-dock).
12. hook 오탐(고위험, 기록만): `stop-unsaved-work`가 루틴 클론의 낡은 로컬 `main`을 '원격에 없는 커밋'으로 셈 → `main`·`master` 제외 제안.
13. [운영] 운영안 v2 마무리: ① 루틴 26개 재편 — 오너가 루틴 계정 로그인 + Slack 커넥터 연결 후 메인 세션이 `docs/team/routines/` 초안으로 생성(그 전엔 루틴 생성·수정 금지) ② 공통 문서 동기화 Action(허브 SHIFT·OPS 공통부 → 샌드랩 사본 PR) ③ 하트비트 누락 감지 Actions cron(카드 `ready` 복귀 — GitHub cron은 3~5시간 늦을 수 있다, archive playbook '배운 점') ④ 로그 절삭 PreToolUse hook(`| tail -n 80`, 고위험·리뷰 2회) ⑤ `stop-unsaved-work` 안내의 브랜치 이름 `shift/` → `card/`(고위험) ⑥ 말랑 옛 저장 데이터 골든 테스트(H3) ⑦ `parseOwnerReply` 테스트에 앱 전송 푸터 글 거르기(QA-1 11-25 제안)
- 오너 할 일: Slack 이름표에 H0(재방문·측정) 이름 추가 확인(전까지 `허브 · 운영 리드`). main 필수 체크 지정(`pr-guard / high-risk` 포함)은 Actions가 main에 직접 커밋하는 워크플로 4개(metrics·marketing-post·marketing-blog·gen-assets)를 PR 방식으로 바꾼 뒤. Search Console·Bing 접근 방법.
- 오너 선택: `OG_VERSION` g1→g2, 헤더 28~36px 링 강조판, manifest 크림↔노을 색, R9 소개 접기·새 머리글 문구, 카톡 URL 캐시·Search Console 재색인, main 브랜치 보호 필수 체크.

## 현재 유효한 함정
- 정본은 [docs/team/PITFALLS.md](docs/team/PITFALLS.md) — 카드 영역의 줄만 읽는다. 새 함정은 그 파일에.

## 검증 상태
- main(#229, 11-21) 기준 PR CI 초록: typecheck · lint · 전체 vitest · build · check-routes · check-seo · e2e 스모크. 전체 e2e(게임별 smoke)는 로컬·루틴 몫.
- 낡은 말랑 e2e 2건은 11-20 00시 QA가 갱신함. 기준선이 흔들리면 main 빌드에서 먼저 재현.
