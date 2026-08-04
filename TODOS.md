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

### Beatline/Skew/Turntile용 커스텀 SVG 아이콘 제작

**What:** `src/components/icons/GameIcon.tsx`의 `glyphs` 맵(22개 게임 전용 네온 라인 아이콘)에
beatline/skew/turntile 3종 추가.

**Why:** `GameCard.tsx`가 이모지(`gameMeta.icon`)가 아니라 이 SVG 아이콘 세트를 카드에
렌더한다. 목록에 없는 slug는 전부 제네릭 조이스틱(`__default`)으로 폴백 — 회귀는
아니다(86종 중 22종만 커버하는 게 기존 상태이고, 나머지 60여 종도 이미 이 폴백을
쓴다), 다만 신규 3종도 지금은 이 다수 폴백군에 합류한 상태.

**Context:** 아이콘 패밀리 규칙(GameIcon.tsx 상단 주석 참고): viewBox 24×24,
stroke-width 1.75, `soft`/`softer`/`solid` 저투명 fill 프리셋, 2px 그리드 정렬. 각
게임의 핵심 동사를 라인아트로 표현할 것(예: Beatline=4레인 노트, Skew=기울어진
그리드, Turntile=2×2 플립 화살표). 급하지 않음 — 폴백이 깨진 게 아니라 그냥 덜
폴리시된 상태.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Completed
