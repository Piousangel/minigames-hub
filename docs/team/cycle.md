# 게임 사이클 진행 상태

세션(06·13·20시)은 시작할 때 이 파일부터 읽고, 끝날 때 갱신한다. 규칙: [OPERATING 3-1](./OPERATING.md), 관문: [DESIGN-PROCESS](./DESIGN-PROCESS.md).

## 진행 중
- **게임**: 뿅 착지 (`plop-landing`), 브랜치 `game/plop-landing`
- **시작**: 2026-11-17 (1일차)
- **통과한 관문**: **G1 통과(v2, 조건부)** — 브리프 `docs/team/specs/2026-11-17-plop-landing-brief.md`, 레퍼런스 `docs/design/plop-landing/REFERENCES.md`, 독립 리뷰 `docs/design/plop-landing/REVIEW-G1.md`(4.5/10 → 지적 수용해 v2). 조건: G2 시뮬 합격선(브리프 8-1장)
- **다음 할 일**
  1. (완료) 리뷰 응답과 v2 반영.
  2. G2: `src/lib/games/plop/engine.ts`(순수 해석식, 시드 `mulberry32`, 사거리 R=Rmax·p 선형, 가라앉는 섬 규칙) + `engine.test.ts` + 봇 시뮬 스크립트(홀드 시간 비례 노이즈 σ=8/12/18%, 1,000판, 해석적 도달 가능성 검사). 브리프 8장 합격선을 통과해야 한다.
  3. 2일차: G3 목표 시안(Gemini, 새 팔레트·수평 구도, Acorn Hop과 나란히 비교) → **오디오(효과음 8종 + 절차적 BGM, 담당 PM·디자이너, 브리프 12장)** → 화면 구현(`GamePlopLanding.tsx`, 주인공 말랑) → G4(혹평 6.5 이상, iOS 실기기 길게 누르기 확인, 연타·중간 이탈·소리 끔·느린 기기 시험) → 커버 16:9 → 머지 → 홍보 큐 3종.
- **열린 PR**: (없음)
- **막힌 것**: 말랑 스프라이트 5포즈는 `origin/feat/toss-recoil`의 `toss/public/chars/mallang-*.webp`에서 가져온다(`git checkout origin/feat/toss-recoil -- toss/public/chars/mallang-idle.webp` 등 후 `public/art/`로 이동). iOS 26 실기기 확인은 사람(오너) 도움이 필요할 수 있다.

## 완료
- 2026-11-17 Acorn Hop 출시(PR #46), 홈 최신 출시 3개 레이아웃(#56·#58)

## 다음 순서
1. 뿅 착지(A) → 2. 말랑 미끄럼길(B, 손으로 만든 30스테이지로 범위 축소) — 오너 결정 11-17.
