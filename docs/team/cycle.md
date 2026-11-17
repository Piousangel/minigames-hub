# 게임 사이클 진행 상태

세션(06·13·20시)은 시작할 때 이 파일부터 읽고, 끝날 때 갱신한다. 규칙: [OPERATING 3-1](./OPERATING.md), 관문: [DESIGN-PROCESS](./DESIGN-PROCESS.md).

## 진행 중
- **게임**: 뿅 착지 (`plop-landing`), 브랜치 `game/plop-landing`
- **시작**: 2026-11-17 (1일차)
- **통과한 관문**: G1 진행 중 — 브리프 `docs/team/specs/2026-11-17-plop-landing-brief.md`, 레퍼런스 `docs/design/plop-landing/REFERENCES.md` 작성 완료, 독립 리뷰어 혹평 반영 대기
- **다음 할 일**
  1. 리뷰 지적을 브리프 11장에 응답으로 기록하고 숫자·규칙을 고친다(G1 마감).
  2. G2: `src/lib/games/plop/engine.ts`(순수 해석식, 시드 `mulberry32`) + `engine.test.ts` + 봇 시뮬 스크립트(σ_hold 40/80/150ms, 1,000판). 브리프 8장 합격선을 통과해야 한다.
  3. 2일차: G3 목표 시안(Gemini, 새 팔레트·수평 구도, Acorn Hop과 나란히 비교) → 화면 구현(`GamePlopLanding.tsx`) → G4(혹평 6.5 이상, iOS 실기기 길게 누르기 확인, 연타·중간 이탈·소리 끔·느린 기기 시험) → 커버 16:9 → 머지 → 홍보 큐 3종.
- **열린 PR**: (없음)
- **막힌 것**: 토리 외 4종 스프라이트는 `origin/feat/toss-recoil`의 `toss/public/chars/*.webp`에서 가져와야 한다(`git checkout origin/feat/toss-recoil -- toss/public/chars/<파일>` 후 `public/art/`로 이동). iOS 26 실기기 확인은 사람(오너) 도움이 필요할 수 있다.

## 완료
- 2026-11-17 Acorn Hop 출시(PR #46), 홈 최신 출시 3개 레이아웃(#56·#58)

## 다음 순서
1. 뿅 착지(A) → 2. 말랑 미끄럼길(B, 손으로 만든 30스테이지로 범위 축소) — 오너 결정 11-17.
