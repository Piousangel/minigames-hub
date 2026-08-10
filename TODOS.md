# TODOS

## Community

### 게임별 리액션 → 댓글(Approach A) 확장 여부 판단

**What:** 2026-08-10에 배포한 게임별 이모지 리액션(design doc:
`~/.gstack/projects/Piousangel-minigames-hub/hyunseok-main-design-20260810-154432.md`)
이 실제로 재방문 신호를 만드는지 데이터로 확인해야 한다. `mg_events`에서
`event='reaction'` 건수와, 리액션을 클릭한 vid의 재방문율(다른 날 재방문 비율)을
클릭 안 한 vid와 비교.

**Why:** 설계 문서의 성공 기준. 반응이 있으면(리액션 사용량 > 0, 재방문율 유의미하게
상승) Approach A(게임별 자유 텍스트 댓글, 스팸 필터 포함)로 확장 — 없으면 커뮤니티
기능보다 다른 재방문 레버(콘텐츠, 알림 등)를 재검토해야 한다. AdSense 재심사 대기
중이라 모더레이션 없는 자유 텍스트 UGC는 가설 검증 전엔 리스크만 더한다고 판단해
지금은 리액션까지만 냄.

**Effort:** 확인은 XS(쿼리만), 확장 결정되면 A는 M.
**Priority:** P2 — 1~2주 뒤(데이터가 쌓인 후) 재확인.
**Depends on:** 배포 후 최소 1주 데이터 축적.

## Games

### Stakehouse "Best"가 중도 피크가 아니라 완주 시점 뱅크롤만 기록

**What:** `GameStakehouse.tsx`의 `persistBest`는 `phase`가 `'betting'`을 벗어나는
순간(=런 종료: busted 또는 complete) 딱 한 번만 호출된다. 그런데 busted면
`bankroll`이 정의상 정확히 0이라 `updateBestScore`의 `score > 0` 가드에 걸려
아무것도 저장되지 않는다 — 즉 **12라운드 중 8라운드까지 뱅크롤 800을 찍고도
버스트하면 리더보드/Best엔 아무 흔적도 안 남는다.** complete(끝까지 생존)한
런의 최종 뱅크롤만 Best 후보가 된다.

**Why:** `/ship` 적대적 리뷰(레드팀과 별개, Claude adversarial subagent)가
발견. 다른 모든 "Best" 게임(Breakout/BubbleShooter는 매 프레임, Countcircle은
매 라운드)은 진행 중 피크를 잡는데 Stakehouse만 완주 여부로 전부-아니면-전무다.
Stakehouse엔 "중간에 캐시아웃" 옵션이 없어서(끝까지 하거나 버스트하거나 둘 뿐)
의도된 "완주해야 카운트" 설계일 수도 있고, 그냥 놓친 케이스일 수도 있다 —
**사람 판단이 필요해 자율로 바꾸지 않았다.** 바꾸려면 `persistBest(next)`를
`'betting'`을 벗어나는 시점이 아니라 매 `'commit'` 후 무조건 호출하면 된다
(`updateBestScore`의 `score > bestRef.current` 가드가 이미 감소하는 뱅크롤에
안전하므로 사이드이펙트 없음).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Stakehouse 12라운드째 정확히 뱅크롤 0으로 완주하면 "Busted"로 표시됨

**What:** `reduce()`가 `bankrollAfter === 0`을 `round === ROUNDS` 체크보다 먼저
검사해서, 12라운드를 전부 살아남았지만 마지막 라운드 결과가 정확히 0이면
"House Closed"(승리 UI)가 아니라 "Busted"(패배 UI)로 뜬다. 승패 어느 쪽이
맞는지는 게임 밸런스 판단이라 보류.

**Effort:** XS
**Priority:** P4
**Depends on:** None

## Testing

### jsdom + RTL 파일럿 확장 — 남은 canvas 게임(Breakout/BubbleShooter/Pong)

**What:** GameSonar는 **완료**(2026-08-10) — 데일리 시드가 순수 함수라 컴포넌트
바깥에서 `createGame(DAILY_CONFIG, dailySeed(todayUTC()))`로 타겟 위치를 미리
계산하고 정확히 그 칸만 Mark로 클릭해 오탐 없이 승리를 재현할 수 있었다
(`GameSonar.test.tsx`, 2건 — "New best score!" 배지가 첫 승리엔 뜨고 기존 베스트를
못 넘으면 안 뜨는지 실제 클릭으로 검증).

남은 GameBreakout/GameBubbleShooter/GamePong(canvas+requestAnimationFrame 루프)은
**같은 접근이 안 통한다** — 시도해보니 이유가 명확해졌다: Sonar는 컴포넌트 밖에서
동일한 순수 엔진 함수를 호출해 "정확히 이 액션 시퀀스면 이긴다"를 미리 계산할 수
있지만, Pong류는 게임 상태(`gameRef`)가 컴포넌트 내부 ref에 갇혀 있고 실제 물리
시뮬레이션(공 속도·CPU AI)이 실시간 `requestAnimationFrame` 타임스탬프에 의존해서,
외부에서 "정확히 몇 프레임 후 승리"를 결정론적으로 예측할 방법이 없다. 테스트
가능하게 하려면 컴포넌트에 시드/초기상태를 주입하는 테스트 전용 prop을 추가하는
리팩터가 먼저 필요한데, 그건 "테스트 추가"가 아니라 "테스트 가능하도록 컴포넌트
구조를 바꾸는" 별개 스코프다 — 사람 판단 없이 자율로 진행하지 않음.

**Why:** 라운드11 커버리지 감사가 지적한 갭. GamePong의 `recordResult()` 단일발화
안전성은 코드 리딩으로 확인됨(`syncHud`가 `frame()`의 `if (!g.over)` 블록 안에서만
불리고, `gameRef.current`가 갱신된 다음 프레임엔 `g.over`가 true라 재호출 안 됨) —
다만 이건 직접 테스트가 아니라 수동 추적이라는 한계는 남아있음.

**Effort:** 테스트 가능한 시드 주입 리팩터까지 하면 M, 안 하면 이 항목은 사실상 닫힘.
**Priority:** P4(리팩터 없이는 더 진행 불가 — 사람이 "리팩터할 가치 있는지" 판단 필요).
**Depends on:** 컴포넌트 테스트 시드 주입 리팩터(별도 결정 필요).

## Completed

### 리더보드 발견 넛지 + Aim Trainer 소수점 정밀도 (2026-08-10)

**What:** 두 건.
1. 리더보드가 페이지 하단(NextUp/GameStats/DailyDock 다음)에 묻혀 있어 발견률이
   낮은 문제 — 페이지 순서는 그대로 두고(NextUp 위치를 건드리면 세션연장 장치가
   흔들릴 위험), `GameOverlay.tsx`(게임오버 = 최대 이탈 지점, 전 게임 공용)에
   `hasLeaderboard(slug)` 조건으로 `#leaderboard`로 스크롤하는 텍스트 링크를 추가.
   `GameNav` 컨텍스트에 `slug` 필드를 새로 실어 `GameOverlay`가 프롭 드릴링 없이
   현재 게임을 알 수 있게 함.
2. Aim Trainer 리더보드가 targets/sec 소수(예: 4.9)를 `Math.floor()`로 정수
   절삭해 변별력을 죽이던 문제 — `leaderboard.ts`에 `SCORE_SCALE`(슬러그별 배율,
   현재 `aim-trainer: 10`만) 추가, `Leaderboard.tsx`의 읽기/제출/표시 3곳에서만
   적용(localStorage 원본과 GameStats 표시는 그대로 소수 유지, D1엔 여전히
   정수만 저장 — score × scale).

**Why:** 사용자가 "배치 문제도 더 파보고, 페이지를 계속 디벨롭하라"고 지시 —
리더보드 배치를 조사하다 GamePageLayout.tsx 순서 문제를 확인했고, TODOS.md에
남아있던 P3 Aim Trainer 정밀도 항목도 같은 세션에 마저 처리.

**검증:** typecheck 클린 / lint 0 errors(기존 경고만) / vitest 102 files ·
2840 tests GREEN / build 성공 / e2e 106 GREEN. main 직접 커밋(2건) · push ·
`pnpm run deploy` · 배포된 번들에서 `SCORE_SCALE`(`"aim-trainer":10`)과
`overlay-leaderboard` 문자열 둘 다 curl로 라이브 확인. 상세는 HANDOFF.md
2026-08-10 세션 참고.

**효과 측정은 아직:** 넛지가 실제로 리더보드 제출을 늘리는지는 며칠 뒤
`mg_events`/D1 재조회로 확인 필요(배선만 확인된 상태).

### GameStats 트로피 패널 확산 — 49종 전부 완료 (DOMAIN.md P1 종결)

**What:** 승/패가 있는데 `recordResult()`를 안 부르던 게임 49종 전부에 배선 완료
(2026-08-10, 한 세션에 3개 배치로 나눠 진행). TicTacToe/DotsAndBoxes/NumberMemory/
Typing/ZeroHour/WhackAMole/GemMatch/Rps/Simon/SpaceShooter/Flappy/TowerStack/
Stackpot/Ticker/Breakout/BubbleShooter/Sonar/Ricochet/Countcircle/Grasp/
Stakehouse/2048/Snake/Tetris/Decant/Interlock/Deepdive/Handful/Backspace/
Beatline/Cleave/Duplex/Flapjack/Flywheel/Fuse/Latch/Overdub/Overfold/Overload/
Pinwheel/Polytap/Prospector/Quarry/Reactor/Ripple/Skew/Splice/Turntile/Umbra.
**의도적 제외 3종**: Sliding/Maze/WordSearch(best가 "낮을수록 좋음"이라 GameStats의
단순 표시가 반대로 보임 — 별도 배지 로직 필요, 라운드10 감사에서 이미 결정).

**Why:** DOMAIN.md P1의 마지막 잔여 항목. Wordle류 스탯모달의 84% 익일복귀 효과를
벤치마크로 삼은 재방문 기능([[retention-is-the-northstar]]).

**패턴(다음에 유사 작업 시 참고):**
1. `state.over`/`phase==='over'` 단일 발화 지점(`useEffect([state,...])`나 `dispatch`
   콜백의 `prevOver.current`/`prevWon.current` 가드, 혹은 진입점 자체가
   `if (s.over) return`으로 재진입을 막는 구조)을 찾는다.
2. **rAF/tick 루프가 게임오버 후에도 계속 도는 게임은 안전성을 개별 확인해야 한다.**
   안전한 유형: (a) 바깥쪽에 `phase !== 'playing'`이면 즉시 return하는 가드가 있는
   루프(Countcircle/Flywheel/Fuse/Latch/Ripple류 — phase가 이 블록 안에서
   'over'로 바뀌므로 다음 프레임엔 진입 자체가 막힘), (b) 발사/탭당 1회만 불리는
   구조(BubbleShooter/Ricochet류), (c) 게임오버 후 엔진이 이벤트를 매 틱 리셋하는
   구조(Umbra — `step()`이 `phase!=='running'`이면 `events`를 빈 값으로 반환).
   **위험한 유형**: 외곽 가드 없이 매 프레임 무조건 실행되는 루프(Breakout이
   실제 사례) — `recordedRef` 같은 전용 단일발화 ref가 반드시 필요, 안 하면
   오버레이가 떠 있는 동안 초당 60회 `recordResult`가 불려 `stats.plays`가 폭증.
3. `persistBest`/`persistX` 같은 헬퍼가 "라이브 베스트 갱신"과 "런 종료" 둘 다에서
   호출되는 경우(Deepdive) `recordResult`를 헬퍼 안에 넣지 말고 호출부에서
   종료 조건에만 게이팅할 것 — 안 그러면 라이브 갱신마다 중복 카운트된다.
4. `won` 값은 게임의 실제 승패 정의를 따른다(단순 "완료=true"가 아님) — 대전류는
   실제 승자, 순수 점수 어택은 "완료=true"(승패 개념 자체가 없음), push-your-luck류는
   "성공적으로 완주/탈출했는가"(Ticker의 `green`, Grasp의 `cleared`, Stakehouse의
   `phase==='complete'`, Prospector의 은행 성공 vs `'collapsed'` 붕괴).

**Completed:** 2026-08-10. `pnpm typecheck && pnpm lint`(0 errors) · `pnpm vitest run`
(102 files / 2835 tests) · `pnpm build`(216 라우트) · `pnpm exec playwright test`(106)
전부 GREEN. 3개 배치로 나눠 각각 검증 후 배포·라이브 확인 완료.

### jsdom + React Testing Library 도입 (파일럿: GameReaction·GameAimTrainer)

**What:** `@testing-library/react`/`jest-dom`/`user-event` + `jsdom` 설치, `vitest.config.ts`를
`test.projects`(engine: node / component: jsdom)로 분리, `vitest.setup.ts`에 matchMedia
폴리필 + RTL auto-cleanup 추가. `GameReaction.test.tsx`(3건)·`GameAimTrainer.test.tsx`(3건)
작성 — 실제 클릭/타이머 조작으로 새 기록 갱신·`recordResult()`(`stats:<slug>`)·
로컬스토리지 영속을 직접 검증. `GameBreakout`/`GameBubbleShooter`의 신기록 판정 로직은
`src/lib/bestScore.ts`(순수 함수, `updateBestScore`)로 추출해 두 컴포넌트에서 재사용하고
`bestScore.test.ts`(5건)로 커버.

**Why:** 라운드11 `/ship` 커버리지 감사(AI 추정 76%, 최소 60%는 넘되 목표 80% 미달)가
신규 게임 3종(Stakehouse/Grasp/Countcircle) 배선 자체는 컨벤션과 일치해 문제없다고
확인했지만, 같은 라운드에서 손댄 기존 게임(Breakout/BubbleShooter/Sonar의 신기록 축하,
AimTrainer/Pong/Reaction의 GameStats 배선)에 대한 직접 테스트가 0건이라고 지적했다.
전면 도입이 아니라 이 감사가 실제로 지목한 파일들부터 좁게 파일럿하는 게
원래 이 항목의 의도(§ 아래 "canvas/grid 게임" 항목)였다.

**Completed:** 2026-08-10. `pnpm vitest run`(101 files / 2831 tests) · `pnpm typecheck` ·
`pnpm lint`(0 errors, 기존 경고 15개만) · `pnpm build`(216 라우트) · `pnpm exec playwright test`(106)
전부 GREEN. 남은 canvas/grid 게임 확장은 위 신규 P3 항목 참고.

### 게임 카드 커스텀 SVG 아이콘 누락 11종 채움

**What:** `src/components/icons/GameIcon.tsx`의 `glyphs` 맵에 battleship/beatline/flow/
kakuro/mancala/pyramid/skew/tripeaks/turntile/unblock/yahtzee 11종 추가.

**Why:** 원래 스코프는 beatline/skew/turntile 3종이었으나, 실제 슬러그 대조 결과
flow/unblock/yahtzee/mancala/battleship/kakuro/pyramid/tripeaks도 이전 세션부터
이미 누락돼 있었다 — 파일 상단 주석은 "22개 게임"이라 적혀 있었지만 실측 커버리지는
76종이었고, 진짜 갭은 이 11종뿐이었다. 같은 파일·같은 패턴이라 한 번에 전부 처리.

**Completed:** 2026-08-05. 브라우저(Chrome MCP)로 11개 전부 홈 카드에서 렌더 확인,
`pnpm typecheck && pnpm test && pnpm build` 통과. 결과: 레포 87종 = 커스텀 아이콘 87종
(전체 커버, 조이스틱 폴백 완전 소진). 파일 상단 주석도 이 사실 반영해 갱신함.
