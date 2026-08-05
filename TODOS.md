# TODOS

## Testing

### jsdom + React Testing Library 도입 검토

**What:** 컴포넌트 레벨 테스트 인프라(jsdom + @testing-library/react)를 이 레포에 도입할지 결정.

**Why:** `vitest.config.ts`가 `src/**/*.ts`만 포함해 `.tsx` 컴포넌트는 한 번도 유닛/통합
테스트를 받은 적이 없다 — 전부 순수 엔진(`engine.ts`) 유닛테스트 + Playwright e2e
스모크(로드+보드 표시)로만 커버된다. 게임 라운드10(2026-08-04) 커버리지 감사에서
7개 기존 게임에 새 UI 동작을 이식했는데(day-streak 3종, "No moves left"→lose 오버레이
4종, Mahjong 반응형 스케일링) 전부 컴포넌트 레벨 테스트가 0건 — AI 추정 커버리지 68%
(최소 60%는 넘지만 목표 80% 미달)로 이 구조적 한계가 원인이었다.

**Context:** e2e 스모크(103개)는 "로드되고 보드가 보이는가"만 확인하고 상호작용은
검증하지 않는다. day-streak 저장/표시, lose 오버레이 트리거, 반응형 스케일 계산 같은
로직은 지금 브라우저 실검증(Chrome MCP)으로만 확인됐다 — 회귀가 조용히 들어와도
CI가 못 잡는다. 도입한다면: (1) jsdom + @testing-library/react 설치, (2) 기존
83+3종 게임 중 상태 로직이 복잡한 것부터(day-streak 3종이 좋은 시작점) 파일럿,
(3) 컨벤션(어떤 걸 테스트하고 어떤 건 e2e에 맡길지) 문서화. 전면 도입은 스코프가
크므로 먼저 파일럿으로 가치를 검증할 것.

**Effort:** L
**Priority:** P2
**Depends on:** None

## Completed

### 게임 카드 커스텀 SVG 아이콘 누락 11종 채움

**What:** `src/components/icons/GameIcon.tsx`의 `glyphs` 맵에 battleship/beatline/flow/
kakuro/mancala/pyramid/skew/tripeaks/turntile/unblock/yahtzee 11종 추가.

**Why:** 원래 스코프는 beatline/skew/turntile 3종이었으나, 실제 슬러그 대조 결과
flow/unblock/yahtzee/mancala/battleship/kakuro/pyramid/tripeaks도 이전 세션부터
이미 누락돼 있었다(레포 전체 86종 중 22종만 커버 → 실제로는 11종만 진짜 갭이었고
나머지는 원래부터 의도적 폴백 대상). 같은 파일·같은 패턴이라 한 번에 전부 처리.

**Completed:** 2026-08-05. 브라우저(Chrome MCP)로 11개 전부 홈 카드에서 렌더 확인,
`pnpm typecheck && pnpm test && pnpm build` 통과.
