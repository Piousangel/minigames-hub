# 게임 사이클 진행 상태

세션(06·13·20시)은 시작할 때 이 파일부터 읽고, 끝날 때 갱신한다. 규칙: [OPERATING 3-1](./OPERATING.md), 관문: [DESIGN-PROCESS](./DESIGN-PROCESS.md).

## 진행 중
- **게임**: 뿅 착지 (`plop-landing`), 브랜치 `game/plop-landing`
- **시작**: 2026-11-17 (1일차)
- **통과한 관문**: **G1 통과(v2)**, **G2 통과(2026-11-17, 엔진·봇 시뮬, 테스트 33건)** — `src/lib/games/plop/{engine,sim}.ts`, 결과 `docs/design/plop-landing/G2-SIM.md`
- **진행 중(중복 작업 금지)**: 메인 세션이 **G3(시안·사운드)와 화면 구현**을 `game/plop-ui` 브랜치에서 진행 중이다. 13시·20시 세션은 이 브랜치와 열린 PR을 먼저 확인하고 **이어받아** 작업한다(새로 시작하지 않는다).
- **다음 할 일**
  1. G3: 새 팔레트 목표 시안(Gemini, 노을 기본, Acorn Hop과 나란히 비교) → 배경·섬·꽃 표적·바람 깃발 에셋 생성 → 오디오(효과음 8종 + 절차적 BGM, 담당 PM·디자이너, 브리프 12장)
  2. 화면 `GamePlopLanding.tsx`(주인공 말랑, 연습 모드, 점선 40%, 가라앉는 링, 사망 고스트, 리드 룩 카메라) → 등록(registry·gameMeta·GameRenderer·GameIcon·gameIntros·e2e) → 일일·D1 보드·공유
  3. G4: 혹평 6.5 이상, iOS 실기기 길게 누르기(오너), 연타·중간 이탈·소리 끔·음소거 저장·느린 기기·BGM 반복 피로 시험 → 커버 16:9 → 머지 → 홍보 큐 3종
- **열린 PR**: (없음)
- **막힌 것**: 말랑 스프라이트 5포즈는 `origin/feat/toss-recoil`의 `toss/public/chars/mallang-*.webp`에서 가져온다(`git checkout origin/feat/toss-recoil -- toss/public/chars/mallang-idle.webp` 등 후 `public/art/`로 이동). iOS 26 실기기 확인은 사람(오너) 도움이 필요할 수 있다.

## 대기 중인 제안
- **뿅 착지 v1.1 요소 다양화 제안** `docs/team/specs/2026-11-17-plop-variety.md`: 추천 ①진주(위험-보상) ②스프링 꽃 ③오늘의 변이. 독립 리뷰 응답과 오너 확인 뒤 사이클로 착수(한 사이클에 요소 1개, 합쳐서 내지 않는다).

## 완료
- 2026-11-17 Acorn Hop 출시(PR #46), 홈 최신 출시 3개 레이아웃(#56·#58)

## 다음 순서
1. 뿅 착지(A) → 2. 말랑 미끄럼길(B, 손으로 만든 30스테이지로 범위 축소) — 오너 결정 11-17.
