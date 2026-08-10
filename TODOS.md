# TODOS

## Games

### GameStats 트로피 패널 확산 — 남은 20종

**What:** DOMAIN.md P1의 유일한 잔여 항목("나머지 승/패 게임들도 recordResult 붙이면
패널이 그 게임에도 뜬다"). 이번 세션에 29종 처리 완료(TicTacToe/DotsAndBoxes/
NumberMemory/Typing/ZeroHour/WhackAMole/GemMatch/Rps/Simon/SpaceShooter/Flappy/
TowerStack/Stackpot/Ticker/Breakout/BubbleShooter/Sonar/Ricochet/Countcircle/
Grasp/Stakehouse/2048/Snake/Tetris/Decant/Interlock/Deepdive/Handful/Backspace).
남은 20종:

```
Beatline, Cleave, Duplex, Flapjack, Flywheel, Fuse, Latch, Overdub,
Overfold, Overload, Pinwheel, Polytap, Prospector, Quarry, Reactor,
Ripple, Skew, Splice, Turntile, Umbra
```

**⚠️ 의도적 제외 3종 — 여기 포함하지 말 것:** `Sliding`/`Maze`/`WordSearch`는
라운드10 UI/UX 감사에서 이미 명시적으로 제외 결정됨 — best가 "낮을수록 좋음"
(시간·이동수)이라 `GameStats.tsx`의 단순 `won:true` 표시가 의미상 반대로 보일 수
있음. 붙이려면 GameStats 쪽에 "낮을수록 좋음" 배지 로직이 먼저 필요(별도 작업).

**Why:** Wordle류 스탯모달의 84% 익일복귀 효과를 벤치마크로 삼은 기능
([[retention-is-the-northstar]]). 패턴은 이미 정립됨 — 다음 세션이 참고할 것:
1. `state.over`/`phase==='over'` 단일 발화 지점(주로 `useEffect([state, ...])`나
   `dispatch` 콜백 내부의 `prevOver.current` 가드)을 찾는다.
2. **rAF 루프가 게임오버 후에도 매 프레임 도는 게임(Breakout류)은 별도
   `recordedRef` 게이팅이 필수** — 안 하면 오버레이가 떠 있는 동안 초당 60회
   `recordResult`가 불려 `stats.plays`가 폭증한다(이번 세션에 Breakout에서
   실제로 이 케이스를 만나 고침). `shoot()`/`land()`처럼 발사당 1회만 불리는
   구조(BubbleShooter류)나 `phase !== 'playing'`이면 즉시 return하는 tick 루프
   (Countcircle류)는 자연히 1회만 발화하니 추가 게이팅 불필요 — 게임마다 루프
   구조를 먼저 확인할 것.
3. `won` 값은 게임의 실제 승패 정의를 따른다(단순 "완료=true"가 아님) — 2인
   대전/CPU전(2048 없음, 이 목록엔 대전 게임 없음)은 실제 승자, 점수 어택은
   "완료=true"(승패 개념 없음), push-your-luck류는 "성공적으로 완주/탈출했는가"
   (Ticker의 `green`, Grasp의 `cleared`, Stakehouse의 `phase==='complete'`가 예시).

**Effort:** M (20종, 게임마다 개별 검증 필요)
**Priority:** P2
**Depends on:** None

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

## Leaderboard

### Aim Trainer 리더보드가 소수점 tps를 정수로 잘라 변별력을 죽임

**What:** `Leaderboard.tsx`(공용 컴포넌트, 이번 라운드에 안 건드림)가
`best:<slug>`를 `Math.floor()`로 읽어 표시·제출한다. Aim Trainer의 `best`는
targets-per-second 소수(예: 4.9)라, 4.1~4.9는 전부 "4"로 뭉개져서 제출된다.
크래시는 아니고 랭킹 순서 자체는 유지되지만(내림은 단조), 같은 정수 구간 내
동점자가 과도하게 많아진다.

**Why:** 이번 라운드 UI/UX 감사(§ 재방문 동기)와 `/ship` 적대적 리뷰가
독립적으로 같은 지점을 지적했다 — 두 번 나온 신호라 우선순위를 올렸다.
고치려면 제출 값만 10배 스케일(반올림 정수)하고 `Leaderboard.tsx`에
`aim-trainer` 한정 `/10` 표시 분기를 추가해야 한다. 이건 공용 컴포넌트에
게임별 예외를 심는 일이다.

**✅ 스테이징 확인 완료(2026-08-10, 배포 직후):** `curl -X POST /api/score
{"game":"aim-trainer","name":"shiptest","score":1}` → 200, `GET
/api/leaderboard?game=aim-trainer`에 즉시 반영 확인. 제출 경로 자체는
정상 동작한다 — 남은 건 순수 정밀도 문제(스케일링)뿐이라 다음 우선순위
그대로 진행 가능. (`shiptest`/1점 테스트 제출은 그대로 둠 — snake/FIRST/42와
같은 컨벤션, 실 유저 점수가 들어오면 자연히 밀려남.)

**Effort:** M
**Priority:** P3
**Depends on:** None

## Testing

### jsdom + RTL 파일럿 확장 — 남은 canvas/grid 게임

**What:** jsdom + @testing-library/react는 이번(라운드11) 도입됐고 GameReaction/
GameAimTrainer(둘 다 순수 DOM)에서 파일럿으로 실동작 확인까지 마쳤다. 남은 건
GameSonar(그리드 퍼즐, 데일리 시드가 결정적이라 이론상 가능)와 GameBreakout/
GameBubbleShooter/GamePong(canvas+requestAnimationFrame 루프)에 같은 수준의
컴포넌트 테스트를 확장할지 결정.

**Why:** 라운드11 커버리지 감사(AI 추정 76%)가 Breakout/BubbleShooter/Sonar의
신기록 축하 로직(isBest)과 AimTrainer/Pong/Reaction의 recordResult() 배선에
직접 테스트가 없다고 지적했다. Breakout/BubbleShooter는 핵심 판정 로직을
`src/lib/bestScore.ts`(순수 함수)로 뽑아 유닛테스트 5건으로 커버해 실질적으로
해소했다. 남은 갭은 (1) Sonar의 "New best score!" 배지 표시 자체(로직은 이미
engine.ts로 잘 테스트됨, UI 렌더링 조건만 미검증), (2) GamePong의 recordResult()
호출부(손으로 추적해 중복 호출 없음은 확인했으나 직접 테스트는 없음). 둘 다
canvas/grid+rAF라 실제 라운드를 끝까지 재현하는 테스트가 비용 대비 가치가
낮다고 판단해 이번엔 스코프에서 뺐다.

**Context:** jsdom+RTL 설정은 완료됨(`vitest.config.ts`가 `test.projects`로
`engine`(node, `*.test.ts`)과 `component`(jsdom, `*.test.tsx`) 분리, `vitest.setup.ts`에
matchMedia 폴리필 + RTL auto-cleanup). 새 컴포넌트 테스트를 추가하려면 `*.test.tsx`
파일만 만들면 된다. canvas 게임은 jsdom이 2D context를 지원 안 해 `getContext()`
호출부에서 콘솔 경고만 나고 죽지는 않는다(무해, 이미 확인됨) — 그리기 로직 자체를
검증하려면 별도 mock이 필요하다.

**⚠️ 실제 사례:** `/ship` 레드팀 리뷰가 이 정확한 클래스의 버그를 하나 실제로 잡았다 —
`GameBubbleShooter.tsx`가 신기록 갱신 여부를 `setIsBest(beat)`(그 틱만 판정)로 썼는데,
`over`는 득점과 무관하게(`!cleared && gridHasDeath(grid)`) 발동할 수 있어서 "중간 샷에서
신기록 세우고, 마지막 무득점 샷에서 게임 종료" 시나리오면 `beat`가 false라 축하 오버레이가
안 뜬다(로컬스토리지 best는 정확히 저장됨 — 화면 표시만 조용히 실패). `GameBreakout.tsx`는
같은 순간 `setIsBest((v) => v || beat)`(누적) 패턴을 이미 썼어서 안전했다 — **같은 세션에서
같은 패턴을 두 파일에 다르게 짠 게 원인.** `setIsBest(beat)` → `setIsBest((v) => v || beat)`로
고쳐 해소함(2026-08-10). 컴포넌트 테스트가 있었다면 커밋 시점에 잡혔을 버그라 canvas 게임
파일럿의 우선순위를 올릴 근거가 된다.

**Effort:** M
**Priority:** P3
**Depends on:** None

## Completed

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
