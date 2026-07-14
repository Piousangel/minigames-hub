# Game UX Template — Design Handoff Brief

## 1. 배경 (Context)

**제품:** minigames-hub — 무료 미니게임 허브. 광고(AdSense)로 월 5~10만원 수익이 목표.
글로벌 영어 검색 트래픽 대상. 라이브: https://minigames-hub.piousangel.workers.dev

**수익 논리:** 트래픽 × 참여도. 게임이 "진짜 게임"처럼 느껴질수록 체류 시간·재방문·공유가 늘고,
그게 곧 구글 랭킹 신호(engagement)와 광고 수익으로 이어진다. 지금 게임들은 **작동은 완벽하지만
비주얼이 밋밋**하다. 이 문서의 목표는 그 격차를 없애는 것.

**기술 스택 / 제약 (반드시 준수):**
- Next.js 15 App Router, **정적 내보내기(`output: 'export'`)** — 서버 런타임 없음. 전부 클라이언트.
- Tailwind v4 (`@import 'tailwindcss'`) + CSS 변수 디자인 토큰 (`src/app/globals.css`).
- **외부 런타임 의존성 금지**: CDN 스크립트/폰트/이미지 로드 지양. 사운드는 파일이 아니라
  **Web Audio API로 합성**(no assets). 애니메이션은 CSS/JS만. 번들 가볍게 유지.
- **`prefers-reduced-motion` 지원 필수** — 접근성 + Core Web Vitals(CLS) 보호.
- 기존 **a11y 라벨(aria-label) 유지**, 기존 **`data-testid` 유지**(e2e가 의존).
- 게임 아래 **SEO 콘텐츠 섹션(How to play / Strategy / FAQ) 구조 유지**.
- **유닛 테스트 53개 GREEN 유지** — 게임 엔진(`src/lib/games/*/engine.ts`)은 UI와 분리돼 있으니
  엔진 로직은 건드리지 말 것. UI 애니메이션은 컴포넌트 레이어에서만.

## 2. 현재 상태 (Baseline)

- 디자인 토큰: `--bg:#0f1115`, `--surface:#1a1d24`, `--fg:#e8eaed`, `--fg-muted:#9aa0a8`,
  `--accent:#f59e0b`(amber). 커스텀 폰트 없음(시스템 스택).
- 레이아웃: `src/app/layout.tsx`(헤더/푸터), `src/components/GamePageLayout.tsx`(게임+콘텐츠 배치).
- **2048 (`src/components/games/Game2048.tsx`)**: 매 이동마다 `state.board`를 통째로 다시 렌더 →
  타일이 **애니메이션 없이 스냅**. 슬라이드/머지 팝/스폰 인/점수 플로트가 전무. 오버레이(win/over)는
  단색 반투명 배경에 텍스트만. 사운드 없음. 이게 "밋밋함"의 정체.

## 3. 목표 — "게임 juice"

플래그십 게임을 **손맛 있는 진짜 게임**으로. 아래는 2048 기준 필수 juice 목록:

1. **타일 슬라이드 애니메이션** — 타일이 이동 방향으로 부드럽게 미끄러진다(120~160ms, ease-out).
   ⚠️ **아키텍처 노트:** 현재 엔진은 타일에 ID가 없어(보드는 숫자 배열) 개별 타일 이동을 추적할 수 없다.
   슬라이드를 구현하려면 **컴포넌트 레이어에서 타일 아이덴티티(id, 이전/현재 위치)를 추적**해야 한다.
   엔진(`engine.ts`)은 수정 금지 — 컴포넌트에서 이전 보드와 새 보드를 비교해 타일 트랜지션을 유도하거나,
   `applyMove` 결과를 감싸는 UI 전용 어댑터를 컴포넌트 안에 둔다.
2. **머지 팝** — 병합된 타일이 순간 scale 1.0→1.2→1.0 바운스.
3. **스폰 인** — 새 타일이 scale 0→1 로 팝인.
4. **점수 플로트** — 점수 획득 시 Score 근처에 `+4` 가 위로 떠오르며 페이드아웃.
5. **깊이감** — 타일 색 램프(2~2048)와 그림자/라운드 정돈. 큰 숫자일수록 강조.
6. **오버레이 폴리시** — win/game-over 시 backdrop blur + 등장 애니메이션. **승리 시 컨피티**
   (canvas 기반, 에셋 없이 그린다). "You win / Game over" 타이포·버튼 마이크로 인터랙션.
7. **사운드(합성, 뮤트 토글)** — 이동 시 짧은 클릭, 머지 시 팝, 승리 시 차임. Web Audio로 합성.
   뮤트 상태 `localStorage` 저장. 기본값은 음소거 해제하되 첫 사용자 상호작용 후에만 오디오 시작
   (브라우저 autoplay 정책).
8. **보드 등장** — 페이지 로드 시 보드/타일이 가볍게 stagger 등장.
9. **버튼 마이크로 인터랙션** — hover/press scale, accent 버튼 눌림 피드백.
10. **Score/Best 변화 강조** — 값이 바뀔 때 살짝 펄스.
11. **`prefers-reduced-motion: reduce`** — 위 모든 모션을 즉시 전환(no transform anim)으로 대체하되
    상태 변화는 그대로 보이게.

## 4. 재사용 템플릿 추출 (핵심 산출물)

2048 폴리시를 **일회성으로 끝내지 말 것.** 다른 5개 게임(snake, minesweeper, memory, typing,
2048-animals)이 그대로 채택할 **공통 게임 셸/유틸**로 뽑아낸다:

- **`GameShell` 컴포넌트(또는 유사)** — Score/Best 헤더, New Game 버튼, 사운드 뮤트 토글,
  오버레이 슬롯을 표준화. 각 게임은 보드만 채워 넣는다.
- **사운드 매니저 훅** (`useGameSound` 등) — 합성 사운드 + 뮤트 토글 + localStorage. 게임 간 공유.
- **모션 토큰** — globals.css에 duration/easing CSS 변수, reduced-motion 처리 유틸.
- **오버레이/컨피티 컴포넌트** — win/lose 공용.

목표: 이 템플릿이 확정되면 이후 신규 게임은 "엔진 + 보드 렌더"만 작성하면 juice가 자동 상속되도록.

## 5. 수용 기준 (Acceptance)

- [ ] 2048에서 타일 슬라이드·머지 팝·스폰 인·점수 플로트가 실제로 보인다.
- [ ] 승리 시 컨피티, 오버레이 blur/등장 애니메이션.
- [ ] 사운드 합성 + 뮤트 토글(localStorage 저장) 동작.
- [ ] `prefers-reduced-motion`에서 모션이 비활성화되지만 게임은 정상 플레이.
- [ ] 재사용 가능한 `GameShell`/사운드 훅/모션 토큰이 추출돼 있고, 최소 1개 다른 게임(추천: snake 또는
      minesweeper)에 시범 적용해 템플릿이 실제로 재사용됨을 증명.
- [ ] `pnpm test`(53) GREEN, `pnpm typecheck` 통과, `pnpm build` 성공(정적 export).
- [ ] 기존 aria-label / data-testid 유지, SEO 섹션 유지.
- [ ] 60fps 근처, 번들 크게 늘지 않음(외부 의존성 추가 없음).

## 6. 참고 파일

- `src/components/games/Game2048.tsx` (플래그십 대상)
- `src/lib/games/g2048/engine.ts` (수정 금지, 읽기용)
- `src/app/globals.css` (디자인 토큰)
- `src/components/GamePageLayout.tsx`, `src/components/GameRenderer.tsx` (배치)
- `e2e/smoke.spec.ts` (깨지면 안 되는 셀렉터 확인)
