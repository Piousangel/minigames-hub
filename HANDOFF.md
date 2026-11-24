# HANDOFF — 미니게임허브 (현재분 ≤10KB · 줄 ≤150. 이력은 docs/archive/handoff-2026-*.md, 규칙은 docs/team/SHIFT.md)
갱신: 2026-11-24 · 북극성 측정 없음(주간 재방문 vid 미집계) · 방문자(UTC) 하루 약 5

## 지금 상태
- 리디자인 v2 정원 틀 완료: 게임 113 전부(R7a~f, #223), 게임 밖 허브 페이지 네온 0(R9, #225). 브랜드 최종판·OG 리브랜드(#227·#228).
- 11-21 이후 main 머지 0(지표 커밋만) — 루틴 한도·운영안 v2 재편 중.
- PR CI 초록 = 머지 조건, 만성 실패 0(chore/ci-test-debt). check-seo·og-compress가 CI·deploy에 있음(#224).
- AdSense: 11-16 재검토 제출, 결과 대기. `adsenseEnabled` 꺼짐, 슬롯 ID만 연결(AD_SLOTS).
- 말랑 미끄럼길: 공개 중, 홍보 보류(오너). 점수는 서버 재생 검증(`/api/slime/submit`, D1 `slime_daily`).
- 열려 있는 실험: E1 홈 PLAY NOW(판정 11-24, n<30이면 보류·상한 12-01), E2 다음 게임 레일(판정 11-25).

## 진행 중·열린 PR
- #230 `chore/redesign-r8-cleanup` R8 옛 네온 코드 정리 — 다른 세션 진행 중.
- `fix/mobile-width-sheet` 모바일 가로폭·시트 — 다른 세션 진행 중(PR 번호 확인).
- #44 `feat/toss-recoil` 오래됨·미접촉(닫을지 오너).

## 다음 할 일 (우선순위)
1. [H0] 북극성 측정 PR: `daily-metrics.mjs`에 주간 재방문 vid(AE blob4, anon 제외)·오늘 호 완료 고유 vid(`result_sheet`)·검색 유입 분리 줄. 기한 11-27 → 기준값 12-04(NORTH-STAR 2장).
2. [H0] 말랑 서버 제출 라이브 확인: deploy 로그 'D1 additive migrations' 성공 여부, AE `sl_submit_verified` 1건, Workers CPU p99(11-19 22시 인계, `shift/22-replay-verify`).
3. [H0] 실험 판정 기록: E1(11-24)·E2(11-25), 12-04 `?ref=threads·bluesky` 유입 전후(n<30 보류).
4. [H3] 말랑: bugs.md Q1[중] 꽃(도착점)이 폰 첫 화면 밖 — 디자인 결정(보드 top 실측 / 게임 페이지 2행 내비 / scrollIntoView) → PR-6 다중 선 UI(`/tools/slime-proto`) → PR-7 빌더·validator·2선 솔버·CB-3~5. 풀 교체 CUTOVER(c-meadow → c-meadow-2)는 리드 결정. `slimeSubmitBody`를 `lines`로(4~8단계 전).
5. [H1] 리뉴얼: R1 `useGameGate` 재사용 P1 나머지(beatline·offbeat·gridlock·zero-hour·whack-a-mole·morse-relay) → 축 C R2(solitaire 계열 점수·표시 정직화). 장부 'UX 친화성' 표(chess 토글 28px·beatline 탭·unblock select 14px·slime 소리 토글·solitaire).
6. [H1] 오너 결정 대기(장부): memory-game 판 크기·시간 모드, snake 속도 곡선.
7. [H2] 꽃담 정원(가칭) G2: 사람 손 탭 JSON → 생성기 200개 분포(최소 턴 ≥3·집합 ≤3·봇 <20%), 미달이면 지형 추가 → 그래도 미달이면 보류. B 관문 전 비공개.
8. [H4] 대표 클래식 10개 스크린샷 카드, 트래픽 상위 20게임 공략, 마케팅 큐(말랑 제외).
9. 성능: registry 전문 청크(모든 페이지 77.5KB gzip) → 클라이언트 경량 인덱스 분리.
10. R8 뒤: 전역 `colorScheme: 'dark'`·`statusBarStyle` 정리, 정원 토큰 :root 승격 검토. e2e 대비 검사 함수 공용화.
11. QA: iOS Safari 실기기 시트 끌기·키보드, `/acorn-hop` 로드 중 CLS 0.05+(share-buttons·next-rail·daily-dock).
12. hook 오탐(고위험, 기록만): `stop-unsaved-work`가 루틴 클론의 낡은 로컬 `main`을 '원격에 없는 커밋'으로 셈 → `main`·`master` 제외 제안.
13. [운영] 운영안 v2 마무리: ① 루틴 26개 재편 — 오너가 루틴 계정 로그인 + Slack 커넥터 연결 후 메인 세션이 `docs/team/routines/` 초안으로 생성(그 전엔 루틴 생성·수정 금지) ② 공통 문서 동기화 Action(허브 SHIFT·OPS 공통부 → 샌드랩 사본 PR) ③ 하트비트 누락 감지 Actions cron(카드 `ready` 복귀) ④ 로그 절삭 PreToolUse hook(`| tail -n 80`, 고위험·리뷰 2회) ⑤ `stop-unsaved-work` 안내의 브랜치 이름 `shift/` → `card/`(고위험) ⑥ 말랑 옛 저장 데이터 골든 테스트(H3).
- 오너 할 일: main 필수 체크 지정(`pr-guard / high-risk` 포함)은 Actions가 main에 직접 커밋하는 워크플로 4개(metrics·marketing-post·marketing-blog·gen-assets)를 PR 방식으로 바꾼 뒤. Search Console·Bing 접근 방법.
- 오너 선택: `OG_VERSION` g1→g2, 헤더 28~36px 링 강조판, manifest 크림↔노을 색, R9 소개 접기·새 머리글 문구, 카톡 URL 캐시·Search Console 재색인, main 브랜치 보호 필수 체크.

## 현재 유효한 함정
- `best:<slug>` 저장 키엔 숫자만. slug·공유 URL·저장 키·점수 체계 변경 금지.
- 에이전트의 "GREEN 보고"는 플레이 가능을 뜻하지 않는다 — 직접 해 보거나 e2e로.
- `generateImageMetadata`는 `output: 'export'`와 충돌(빌드 깨짐) — OG alt는 정적 문구.
- `git checkout .`을 stash 복원과 같이 쓰지 말 것(스테이징 안 된 파일 손실).
- 말랑 일일은 매일 `SLIME_STAGES` 전체를 연다 — 풀 칸을 바꾸면 오늘 `slime:daily2` 시도가 새 판에 붙어 서버 재생 400. `BAN_SLACK`(verify) = `ZONE_SLACK`(multiline).
- deploy.yml D1 마이그레이션은 `continue-on-error` — 실패해도 초록, 로그 단계를 직접 볼 것.
- Satori는 webp·woff2·가변 축 불가(`src/lib/og/assets/`). 페이지 `openGraph`/`twitter` 객체는 layout 것을 통째로 덮는다(check-seo가 잡음). 브랜드 원판 변경 → `python3 scripts/brand-icons.py`(OG 사본도).
- 광고 자리 `<AdSlot>`을 옮기면 `[data-ad-after]` 표시도 같이(광고 꺼진 동안 거짓 통과). 마스코트는 `Mascot` 컴포넌트로(D6 400px·뷰포트당 1 검사가 `img[data-mascot]`을 셈).
- 대비 검사는 조상 배경·로드 직후 화면만 본다 — 형제 덮개·진행 중 덮개는 손으로. 그라데이션 바탕은 `backgroundColor`도 줄 것. 캔버스 스크립트는 fillText만.
- 결과 시트는 열 때 `history.pushState` — 다른 곳에서 pushState를 끼우면 닫기가 어긋남. 시트 애니메이션 `backwards` 유지, body `position:fixed` 잠금 금지(sticky 헤더 CLS).
- Continue 칸·리더보드 li key는 위치(index) — slug로 바꾸면 CLS가 돌아온다.
- 히어로는 크롬 높이만큼 위로 당김(`--chrome-h`) — 헤더 높이 바꾸면 같이. 키아트를 바꾸면 0.6185·0.069·섹션 그라데이션 색 재측정.
- 정적 serve엔 `/api`가 없다(리더보드는 늘 실패 카드 — e2e는 흉내).
- 클라우드 세션은 quickminigames.site가 프록시 403 → 같은 커밋 로컬 빌드로 점검. Playwright는 `-c` 임시 설정 + `executablePath:/opt/pw-browsers/chromium`(커밋 금지). `prettier --write` 쓰지 말 것(설정 없음).
- 새 핵심 화면 e2e는 ci.yml 스모크 `--grep`에 추가. CI에서 15초 가까운 테스트는 한도 대신 구조를 고칠 것. 로컬 과부하 `Timeout calling "onTaskUpdate"`는 재실행.
- 픽셀 비교는 `node scripts/garden-capture.mjs diff --base <main 빌드> --head <브랜치 빌드>`(시계·랜덤 고정). SEO 비교 `node scripts/seo-head-diff.mjs`.

## 검증 상태
- main(#229, 11-21) 기준 PR CI 초록: typecheck · lint · 전체 vitest · build · check-routes · check-seo · e2e 스모크. 전체 e2e(게임별 smoke)는 로컬·루틴 몫.
- 낡은 말랑 e2e 2건은 11-20 00시 QA가 갱신함. 기준선이 흔들리면 main 빌드에서 먼저 재현.
