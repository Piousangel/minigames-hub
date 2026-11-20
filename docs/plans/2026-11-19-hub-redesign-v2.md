# 허브 리디자인 v2 「오늘 호 표지」 구현 계획 (2026-11-19)

오너 확정(11-19): 방향 = v2 「오늘 호 표지」, 마스코트 4마리, 113개 게임 전체를 세계관 틀로. "기획·계획 꼼꼼하게", "쉬지 말고 계속 발전".
시안: `docs/design/redesign-v2/hub-v2.html` + 캡처. 근거: `docs/team/research/2026-11-19/hub-redesign-concept.md`(디자인 시스템 3장), `docs/design/world/world-bible.md`.
독립 전문가 리뷰(11-19, 6.0/10)의 차단 9건·권고를 전부 이 계획에 반영했다. 리뷰 원문 요지는 부록 A.

---

## 0. 목표 · 하지 않을 것 · 완료 기준

**목표**: 홈과 113개 게임 화면이 하나의 '노을 정원' 세계로 보이고, 처음 온 사람이 3초 안에 "무료 미니게임 사이트, 오늘의 퍼즐부터"를 알며, 단골은 지금보다 빨리 자기 게임에 닿는다.

**하지 않을 것**
- slug·공유 URL 변경, 게임 규칙·점수 체계 변경, 게임 화면 안 광고, AdSense 재심사 신청.
- 홈 '살아 있는 하늘'(시간대별 하늘): 세계관("해는 늘 지평선에 붙잡혀 있다 = 언제나 노을")과 충돌 → **홈은 노을 고정**. 시간대는 게임별 '방'(Plop 새벽, Slime 노을, Acorn 밤)에만. 밤 정원·다크모드는 8단계(보류).
- "sets 5:21 pm" 같은 위치 의존 문구, 하늘 다이얼 8칸(공유 카드 시그니처로만 남김), "No. 37" 반복(마스트헤드·공유 카드 2곳만).
- 런타임 JS로 그리는 장식(티켓·스캘럽) — 정적 인라인 SVG/CSS mask만.

**완료 기준(전체)**
- 홈 390 Lighthouse 모바일: LCP < 2.5s, CLS < 0.05, 접근성 ≥ 95. 폰트 합계 ≤ 130KB(실측).
- 홈 내부 링크 수가 지금보다 줄지 않는다(전후 비교 스크립트).
- 113개 게임 모두 정원 틀로 렌더되고, 배치마다 Playwright 전후 캡처 + 게임별 e2e 스모크 초록.
- 광고 off(`adsenseEnabled: false`)일 때 빈 광고 박스 0, on일 때 CLS 0.

---

## 1. 확정 결정 (리뷰 반영)

| # | 결정 | 이유 |
|---|---|---|
| D1 | **H1 = "Free online mini games" 키워드 + 세계관 문장 2단 조판**(둘 다 `<h1>` 안: 윗줄 Figtree 600 18px, 아랫줄 Fraunces "a small garden that blooms daily.") | 리뷰 B4. 지금 H1 키워드 유지(SEO) + 시안 표정 유지 |
| D2 | **정적 HTML 기본 상태 = 첫 방문(first)**. 진행·완료 상태는 클라이언트에서 localStorage로 바꾸되 같은 높이를 예약 | 리뷰 B3. 하이드레이션 불일치·깜빡임 방지 |
| D3 | 날짜·호수(No. N)는 **기존 데일리 리셋 기준(UTC 자정, `src/lib/dailyDate.ts` todayUTC)** 으로 클라이언트 계산, 고정 높이 + tabular-nums | 리뷰 B9. 빌드 시각 고정 방지. 말랑 미끄럼길만 로컬 자정(todayLocal) — 홈 카드의 '오늘 호'는 UTC로 통일하고 말랑 카드 상태는 그 게임 키를 읽는다 |
| D4 | **카테고리 수·전체 게임 수는 항상 계산**(`gamePages`·`gameMeta`), 하드코딩 금지 + 집계 단위 테스트 | 리뷰 B1. 실제 Puzzle 49 / Arcade 21 / Classic 19 / Skill 25 |
| D5 | **마스코트 ↔ 카테고리 1:1**: 말랑이 = Puzzle, 토리 = Arcade, 해씨 = Classic(+오늘의 정원·안내), **보미 = Skill(정밀 비행·타이밍) + 소식(데일리 배달·리더보드·공유)** | 리뷰가 Skill 담당 공백 지적. 4마리 ↔ 4카테고리로 정리(팀 결정, 오너에게 보고) |
| D6 | **마스코트 배치 규칙**: 한 뷰포트에 1마리(히어로 키아트 제외), 광고 띠 400px 안에는 두지 않음, 한 마리 = 한 기능 | 리뷰 마스코트 배치안 |
| D7 | 세계관 틀 적용은 **`data-world="garden"` 스코프 안에서만** `--neon-*` 재매핑, 20개씩 배치. 전역 `html { color-scheme: dark }`(globals.css)는 건드리지 않는다 | 리뷰 9. 113개 동시 회귀 위험 |
| D8 | 게임판은 1차에 **'밤 정원' 짙은 남보라 바탕 유지**(네온 글자 대비 안전), 바깥 틀만 크림. 게임판 크림화는 퀄리티팀이 게임별로 | 대비 회귀 방지 |
| D9 | 폰트: Fraunces **정적 인스턴스 2개**(roman 600, italic 600, SOFT 100 고정, opsz 72 고정, WONK 없음, 라틴 서브셋) + Figtree variable, `next/font/local` self-host, `display: swap` + `adjustFontFallback`. 픽셀 폰트는 은퇴(콘솔 이스터에그만) | 리뷰 B7 |
| D10 | 키아트는 `<img fetchpriority="high">` + srcset, **모바일 전용 크롭(780w ≤ 60KB)·데스크톱 1920w(≤ 150KB)** 별도 생성. 썸네일은 전용 정사각(128/256) | 리뷰 B8 |
| D11 | 광고: 고정 크기 슬롯 + `min-height` 예약, 비활성이면 DOM 미렌더(지금 AdSlot 동작 유지), 1440 첫 화면 광고 없음, 게임 페이지 광고는 보드에서 150px 이상 | 리뷰 B6 |
| D12 | nav 라벨: **Originals · All games (113) · Leaderboards**, 13px 이상 + 헤더 검색 아이콘 44px | 리뷰 B2·권고 2 |

---

## 2. 데이터 모양 (먼저 정한다)

```ts
// src/lib/home/edition.ts — 오늘 호(UTC 자정 기준)
export type Edition = { no: number; dateUTC: string /* YYYY-MM-DD */; label: string /* "Thu, Nov 19" */ }
export function editionFor(d: Date): Edition            // No.1 = 사이트 데일리 시작일(상수, DECISIONS 기록)

// 오늘의 정원 상태 — 오리지널 3종의 오늘 결과에서 계산
export type GardenState = 'first' | 'in-progress' | 'complete'
export type GardenSlot = { slug: 'slime-slide' | 'plop-landing' | 'acorn-hop'; status: 'unplayed' | 'bloomed' }
export function readGarden(storage: Pick<Storage,'getItem'>, today: Edition): { state: GardenState; slots: GardenSlot[] }

// 카테고리 선반 — 계산값만
export type Shelf = { category: 'Puzzle'|'Arcade'|'Classic'|'Skill'; count: number; host: 'mallang'|'tori'|'haessi'|'bomi'; icon: 'bell'|'star'|'clover'|'sun' }
export function shelves(pages: GamePage[], meta: typeof gameMeta): Shelf[]

// 결과 시트 공통 스키마(오리지널 3종)
export type DailyResult = { slug: string; primary: { label: string; value: number }; secondary?: { label: string; value: string }; streak: number; bloomed: boolean }
```
테스트(vitest engine): `editionFor` 경계(UTC 23:59/00:00), `readGarden` 3상태·손상된 저장값, `shelves` 합계 = gamePages.length.

---

## 3. PR 순서 (위험 낮고 효과 큰 것부터)

각 PR: 브랜치 `shift/<시각>-redesign-<n>`, M 이하, `pnpm test && pnpm typecheck` + 해당 e2e 초록, **고친 사람 ≠ 리뷰어**(독립 서브에이전트 리뷰), 전후 캡처를 PR 본문에. 머지 후 라이브 확인(URL 200 + 실제 화면).

| # | PR | 범위 | 검증 | 되돌리기 |
|---|---|---|---|---|
| R1 | **토큰·폰트 기반** | `--garden-*` 토큰(콘셉트 3장) 추가, Fraunces 2인스턴스·Figtree self-host(`src/app/fonts.ts`), 아직 화면 변화 없음(neon 미변경) | 폰트 합계 ≤130KB 실측표, CLS 측정, typecheck·vitest·playwright 스모크 | 파일 추가만 → revert 1커밋 |
| R2 | **크롬: 헤더·푸터** | 크림 헤더(로고 마크·wordmark·nav 3·검색 아이콘·오늘 pill=`/daily` 링크), 푸터 '정원 안내판'(Daily·Collections·Guides·카테고리 4·About·Privacy·Terms·Contact) | 홈·게임 페이지 내부 링크 수 전후(감소 0), axe 심각 0, 390/1440 캡처 | 헤더/푸터 컴포넌트 교체만 |
| R3 | **홈 히어로** | 노을 고정 하늘, D1 H1, 키아트 `<img>`(모바일 크롭·데스크톱 자산), 오늘 호 카드(first 기본, D2·D3), 마스트헤드 1줄("No. 37 · Thu, Nov 19") | Lighthouse LCP<2.5s·CLS<0.05, first/in-progress/complete 3상태 캡처, edition·garden 단위 테스트 | page.tsx 히어로 블록만 |
| R4 | **홈 본문** | Continue 줄(RecentlyPlayed 재사용, 없으면 인기 4), Originals 목차(Plop·Acorn + Soon은 출시 1주 전만), 4선반(D4·D5, 해씨 안내), All games 목록(접힘 + HTML 링크 전부), About 편집 블록 120~200단어 + From the guides 3링크, 광고 고정 슬롯(D11) | shelves 단위 테스트, e2e "검색 → 2048 진입", 광고 off 빈 박스 0, 홈 높이 390 ≤ 2,600px | 섹션 단위 |
| R5 | **데일리 결과 시트**(오리지널 3종) | DailyResult 스키마, Share(노란색 하나), Next game 보조 버튼(NextRail 재사용), 카운트다운(UTC), 공유 카드(하늘 띠 시그니처), 85dvh + 내부 스크롤, 결과 숫자 coralT | 컴포넌트 테스트(streak·bloomed), 360×640 캡처, 시트 안 광고 0 | 시트 컴포넌트만 |
| R6 | **마스코트 배치** | 해씨(선반 Classic·About·빈 상태), 보미(결과 시트 카운트다운 32px·리더보드 머리·Skill 선반), 말랑이·토리(각 선반), 404 말랑 dizzy. lazy, 각 ≤40KB, 해씨 뒤 하늘색 disc | D6 체크리스트, 캡처 | 이미지 추가만 |
| R7a~f | **113개 게임 정원 틀 배치 적용**(20개씩 6배치) | `GARDEN_GAMES` → `data-world="garden"` 스코프로 일반화, 스코프 안 `--neon-*` → 정원 팔레트 매핑, 게임판 밤 정원(D8), `neon-text` 글로우 제거, 게임 페이지 광고 150px | 배치마다 Playwright 390·1440 전후 스크린샷 diff(사람 눈 확인 목록), 게임별 e2e 스모크 전부, 대비 자동 검사 | 배치 목록에서 slug 제거 1줄 |
| R8 | (보류) 밤 정원·다크모드 | 밤 전용 키아트 생성 후 | 밤 대비 AA, reduced-motion | — |

**모션 줄이기**(전 PR 공통): 젤리 프레스·꽃 피기는 `prefers-reduced-motion`에서 즉시 상태로. globals.css 580행 블록에 합친다.

---

## 4. 필요한 그림 (Gemini 2차, gen-assets 워크플로)

| id | 자리 | 규격 | 비고 |
|---|---|---|---|
| hub-hero-mobile | R3 모바일 히어로 | 9:10 마스터 1200×1320 → 780w webp ≤60KB | 위 40% 빈 노을 하늘(제목 자리), 아래 섬·말랑이·토리, 바닥 25% 평평한 라벤더 구름(#a88ecc, 카드 자리) |
| hub-hero-desktop | R3 데스크톱 | 16:9 마스터 2400×1350 → 1920w ≤150KB | 왼쪽 40% 빈 하늘, 나무 섬 x 85% 안, 섬 밑동 y 75% 위에서 끝 |
| thumb-{slime,plop,acorn} | 목차·티켓 | 1:1 512 → 128/256 | 주인공·고유 소품 가운데, 48px 판독 |
| haessi-guide, bomi-countdown | R6 | 1:1 512 마젠타 키 | 해씨 등불 안내 포즈, 보미 '내일 호' 들고 날기 |
| bomi-sheet v2 | 문서 | 16:9 | 표정 6개 모두 우체부 모자(1차에 4개 누락) |

---

## 5. 교대 배정 (ROTA 연결)

- **16시 사이트 개발** → R1 → R2 → R3 → R4 순서(앞 PR 머지 후 다음).
- **18시 저녁 개발** → R5 → R6. (11-20: R1~R4가 끝나 16시가 R6를 당겨 맡음 — 06시 회의 결정. 18시는 bugs Q1·R7 스코프 준비)
- **22시 야간 개발 B** → 4장 그림 요청 PR(gen-assets) + R7 배치 준비(스코프 일반화·캡처 비교 스크립트).
- **02시 야간 개발 A** → R7 배치 a~f(하루 1~2배치).
- **00시 심야 QA** → 전날 머지된 R-PR 라이브 전수 점검(390 터치·Lighthouse·내부 링크 수).
- **03·15시 퀄리티 전담팀** → R7 배치를 지난 게임부터 게임판 안쪽 정원화·결 다듬기(QUALITY.md 8항목 '세계관').
- 각 교대는 이 문서 3장 표의 다음 미완료 PR을 고르고, 시작 시 `gh pr list`로 겹침을 피한다. 완료하면 아래 진행표를 같은 PR에서 갱신한다.

## 6. 진행표
| PR | 상태 | PR 번호 | 메모 |
|---|---|---|---|
| R1 | 머지 | #178 | 토큰 `--garden-*`·`--color-garden-*`·`--shadow-garden-*`, 폰트 `--font-display`·`--font-ui`(preload 끔, 아직 미적용). 새 폰트 62.5KB. 화면 픽셀 diff 0 |
| R2 | 머지 | #179 | 크림 헤더(lg 64px 1줄 / 그 아래 56px sticky + 2행 내비 44px)·푸터 정원 안내판, `src/components/site-chrome/`. 검색=홈 GameBrowser `/#search`, Originals=`/collection/original-games`. 내부 링크 감소 0(+3), 크롬 axe 심각 0, 헤더 기인 CLS 0. Figtree preload. R3 몫: pill 진행 상태(`TODAY_PILL`, 높이 유지), Fraunces roman preload 분리, aria-current |
| R3 | 머지 | #181 | 노을 하늘(헤더 뒤까지)·H1 2단·마스트헤드 No.N(기준일 07-18)·키아트 <picture>·오늘 호 카드 3상태·pill 진행 상태·게임 페이지 모바일 2행 숨김·Fraunces roman만 preload. 링크 168/127 = 전과 같음, CLS 0. LH 모바일 LCP: devtools 스로틀 1.9~2.3s, simulate 3.8s(전 3.6s, JS 번들 몫). R4 몫: 히어로 아래 섹션·티켓 줄(데스크톱 라벤더 띠, 히어로 높이 다시 늘림)·정원 판정을 R5 완료 기록으로 |
| R4 | 머지 | #182 | 히어로 아래 paper+구름 경계, Continue(최근/인기 4, 칸 위치 key로 CLS 0), Originals 목차(Plop·Acorn, readGarden), 4선반(shelves() 계산·합계 테스트), 씨앗 도서관(113 링크 전부 HTML·기본 24·카테고리 번갈아·My games 필터=즐겨찾기 흡수·하트/칩 44px), About 약 150단어+가이드 3, 정원 안내판, 광고 고정 100px 슬롯 2곳. 링크 168/127 → 170/134(감소 0). CLS ≤0.0013(CPU 4배), axe 위반 0, 320·360 가로 스크롤 0. **390 높이 5,012px — 2,600 기준은 R4 면제·오너 결정 대기(DECISIONS R4 구간표)**. R5로 이월: 데스크톱 티켓 줄(히어로 라벤더 띠), 정원 판정을 완료 기록으로 |
| R5 | 머지 | #184 | `DailyResult`·완료 키 `garden:done:<게임의 일일 날짜>:<slug>`(말랑 현지·나머지 UTC)·게임별 streak(`src/lib/daily/result.ts`), `readGarden` = 완료 키만(R3 약한 신호 폐기), 공통 결과 시트 `src/components/daily/DailyResultSheet.tsx`(85dvh·Share 노란 1·Next game 크림·UTC 카운트다운·보미 32px 자리·포커스 가둠·Esc·뒤로 가기·모션 줄이기), 공유 카드 PNG 440~640px ≤250KB(실측 188KB), 세 게임 Daily 종료 화면 교체(연습은 예전 오버레이), 리더보드 제출 시트 안(`tone=garden`), 1280+ 히어로 티켓 3장. axe 위반 0, CLS ≤0.0005. 캡처 `docs/design/redesign-v2/r5-sheet/` |
| R6 | 머지 | #191 | 선반 disc 4장(말랑·토리·해씨 하늘색·보미 idle, 묶음 = 1마리), About 머리 해씨 guide 96px(About 1024+ 한 단), 빈 상태(검색 0·My games 0) 해씨 think 80px(그동안 다른 그림 visibility 접기), 시트 보미 countdown 32px만(말랑 걸터앉기 안 함), 404 신설(말랑 dizzy). **광고 1 선반 아래 → About 아래**(`home-about`). 사본 `public/art/mascots/` 합계 29KB. D6 e2e(`mascots.spec.ts`) 390·1440 통과, CLS 0, axe 0. 리더보드 머리 보미 deliver는 R7 배치로. 캡처 `docs/design/redesign-v2/r6-mascots/` |
| R7a | 머지 | #199 | 스코프 일반화: `src/lib/games/gardenRollout.ts`(배치 배열, 되돌리기 = slug 1줄 삭제) → `main[data-world="garden"]` + 게임판 `[data-garden-board]`(밤 정원 #2e2342→#241c4a, 모바일은 main 여백까지 넓혀 게임 폭 그대로). 스코프 안에서만 `--neon-*`·`--fg`·`--surface`·`--accent` 재매핑(바깥 = 크림 위 짙은 꽃색 ≥4.8:1, 판 = 밝은 꽃색 ≥6.3:1), `neon-text` 글로우 제거, 바깥 픽셀 폰트 → Figtree, 리액션·Play next·공유·목표 = ink 윤곽 + 판 그림자, 제목·섹션 머리 Fraunces. 오리지널 3종은 `data-world="garden-room"`(예전 화면 그대로). **배치 a 20개**: 2048·2048-animals·snake·solitaire·battleship·polarity·beatline·quarry·bearing·hogline·countcircle·mancala·typing-test·aim-trainer·minesweeper·sokoban·word-guess·sudoku·flow·clusters. chess·mahjong은 게임 안 기존 대비 결함으로 보류. 게이트 `e2e/garden-frame.spec.ts`(로드·첫 입력·대비 실패 0·광고 ≥150px·가로 스크롤 0), 배치 밖 18곳 픽셀 diff 0(`scripts/garden-capture.mjs diff`), 캡처 `docs/design/redesign-v2/r7a/` |
| R7b | 머지 | #201 | **배치 b 20개**: chess·mahjong(대비 수정 뒤)·memory-game·tetris·tic-tac-toe·connect-four·yahtzee·freecell·spider·jigsaw·sliding-puzzle·reaction-time·hangman·simon·whack-a-mole·rock-paper-scissors·lights-out·nonogram·checkers·reversi. 게임 안 대비 수정 3건(색·크기만): 체스 좌표 8px muted/70 → 10px fg, 마작 패 글자 짙은 단계·막힌 패 불투명, 슬라이딩 타일 sky-500 → sky-600. 게이트 42/42(배치 b 대비 실패 0·광고 ≥150px·가로 스크롤 0), 배치 밖 21곳(R7a 10곳 포함) × 390·1440 픽셀 diff 0, 캡처 `docs/design/redesign-v2/r7b/` |
| R7c | 머지 | #207 | **배치 c 20개**: mastermind·maze·number-memory·word-search·gem-match·prospector·zero-hour·overload·ricochet·stackpot·overfold·splice·duplex·overdub·pinwheel·cleave·umbra·fuse·polytap·deepdive. 게임 안 수정(색·클립만): sudoku(R7a) 다 쓴 숫자 패드 opacity-50 → 75·nonogram(R7b) 끝난 줄 단서 muted/45 → /75(둘 다 무작위 판 운으로 로드 직후 걸리던 결함, → 5.4), duplex 잠긴 팩 글자 muted/50 → muted(3.24 → 8.41)·뒤집기 등장의 순간 가로 넘침 `overflow-x-clip`, polytap 패드 `×N beats` opacity-80 제거(4.43 → 5.96). dots-and-boxes(차례 표시 opacity 0.4)·decant(밴드 숫자 2.4:1)는 수정이 게임 표현을 바꿔 R7d로 미루고 polytap·deepdive로 채움. 게이트 배치 c 대비 실패 0·광고 ≥150px·가로 스크롤 0, 배치 밖 26곳(R7a 5·R7b 6·미적용 15) × 390·1440 픽셀 diff 0, 승패 모달 3게임 실측 최저 7.52:1, 캡처 `docs/design/redesign-v2/r7c/` |
| R7d | 머지 | #216 | **배치 d 20개**: dots-and-boxes·decant·sonar·handful·flapjack·interlock·quadle·equate·reactor·pyramid·tripeaks·golf-solitaire·dominoes·yukon-solitaire·gomoku·kakuro·skew·turntile·stakehouse·grasp(남은 DOM 레지스트리 순, ticker·unblock·캔버스 제외). 게임 안 수정(색만): dots-and-boxes 쉬는 쪽 차례 글자 opacity 0.4 → muted 색(2.1 → 8.4, 점은 그대로 0.4), 색 밴드 숫자 공용 `src/lib/games/bandInk.ts`(원래 짙은 글자가 4.5 미만인 밴드만 흰 → 더 짙은 → 검정, 0~360° 전부 ≥4.5 테스트, 8비트 반올림 판정) — decant(2.4 → ≥4.8)·interlock(3.2 →)·turntile(2.4 →)·flapjack(2.7 →), tripeaks 못 내는 카드 회색 면 위 빨강 #d81f3a → #a50f2a(3.05 → 4.72). 게이트 배치 d 대비 실패 0(3회 반복 60/60)·광고 ≥150px·가로 스크롤 0, 배치 밖 26곳 × 390·1440 픽셀 diff 0, 승패 모달 3게임 `scripts/garden-overlay-contrast.mjs`(신설) 최저 7.52:1, 캡처 `docs/design/redesign-v2/r7d/`. e2e '배치 밖' 기준 kakuro → slosh |
| R7e~f | 대기 | | 다음 배치 규칙: HANDOFF 'R7e가 알아야 할 것' |
| R6 이월 · /leaderboards | 머지 | #203 | 정원 틀(`data-world="garden-hub"`): 연감 카드(카테고리 꽃색 4종)·벡터 메달 `RankMedal`·"This week · Nov 16–22"(`leaderboardWeek.ts`)·픽셀 폰트 0·이모지 0, 머리 보미 deliver 96px(`bomi-deliver-192.webp` 9.2KB) + lines #41, 로딩·빈 주·실패 상태 정원화, CLS 0.65 → 0.00x. e2e `e2e/leaderboards.spec.ts`. 캡처 `docs/design/redesign-v2/leaderboards/` |

---

## 부록 A. 독립 리뷰(11-19) 요지
- 총평 6.0/10: 그림·색·판 그림자는 지금보다 훨씬 좋고 독창성 기준은 넘음. "신문 호" 장치 과다(No.·edition·다이얼·pill·카운트다운), H1에서 games 키워드 빠짐.
- 차단: B1 카테고리 숫자 하드코딩, B2 검색·단골 동선 소실, B3 첫 방문 상태 부재, B4 H1·내부 링크 퇴행, B5 AdSense 고유 콘텐츠 0, B6 광고 자리 규칙 부재, B7 폰트 전 축 로딩(FOIT), B8 키아트 CSS 배경(LCP)·업스케일, B9 날짜 문구 정적 export에서 틀어짐.
- 권고: 크롬 5겹 → 1줄로(약 60px), nav 13px+·"All games", pill 동작 정의, 결과 시트에 Next game, 공통 스탯 스키마, coral 대비, 모션 줄이기 명세, 홈 노을 고정(세계관), `data-world` 스코프 배치 적용, 1440 하단 설계.
- 뺄 것: No. 반복, Sunset edition·다이얼·일몰 시각, 잠긴 Soon 줄(출시 1주 전만), 1440 상태 칩 중복, JS 장식, WONK 축.
