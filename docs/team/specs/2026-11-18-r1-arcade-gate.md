# R1 아케이드 시작 게이트 + 탭 일시정지 공용 훅 (tetris·space-shooter·pong·flappy)

작성: 2026-11-17 (파일명은 18일 배치 기준). 라운드: **리서치 1 + 기획 v1**. 다음: 리서치 2(반증) → 기획 v2 → 독립 리뷰 → 구현.
근거 문서: SESSION-GUIDE 0.2·사용자 관점 질문 7개, renewal-queue R1, audits/2026-10-10-quality-audit.md(P1, 네 게임 항목). 코드 기준은 현재 main(10-12 이후 네 게임은 모바일 스크롤 PR #79·#84만 건드림, `git log` 확인).

## 1. 현재 코드 실측 (감사 재검증)

검증 방법: 코드 읽기(파일:줄). `pnpm install --frozen-lockfile` 성공, 네 엔진 테스트 69개 통과(`pnpm vitest run src/lib/games/{tetris,pong,flappy,spaceshooter}`)까지는 확인했다. 컴포넌트 동작(탭 hidden 등)은 **Playwright 브라우저가 이 환경에 없고(`~/.cache/ms-playwright` 없음) 네 게임에 컴포넌트 테스트도 없어** 실행 검증을 못 했다 — 아래 표는 **코드 근거만**이다. e2e 스모크(`e2e/smoke.spec.ts:70,148,184,219`)는 로드+보드 표시만 본다.

| 게임 | (a) 로드 즉시 시작? | (b) 탭 숨김 시 멈춤? | (c) 일시정지 UI | (d) 오버레이 지연 |
|---|---|---|---|---|
| tetris | **예(미수정)**. 마운트 effect가 `restart()` 호출(GameTetris.tsx:124-125), restart가 `setRunning(true)`(:119) → setInterval 중력(:134-138) | **부분**. `visibilitychange`에서 `setRunning(false)`(:141-147)로 멈춤. 복귀 시 **표시 없이** 아무 키·버튼(`act`가 `setRunning(true)`, :181)에 재개되고 그 입력이 그대로 조각을 움직임 | **없음**(Pause 키·버튼·패널 grep 0건) | 게임오버 오버레이는 `state.over` 즉시(:289), CSS 입장 애니 320ms(`--dur-slow`, globals.css:30,219)뿐. 인위적 지연 없음. 별건: **락 딜레이 없음** — `tick`이 못 내려가면 즉시 `lockPiece`(engine.ts:277), softDrop도 동일(:258) |
| space-shooter | **예(미수정)**. `phase` 초기값 `'playing'`(GameSpaceShooter.tsx:52), 마운트 effect가 rAF 루프 시작(:336), 입력 전에도 `step()` 실행 | **명시 처리 없음**(visibilitychange grep 0건). 브라우저가 hidden 탭 rAF를 중단해 사실상 멈추나 복귀 즉시 재개, dt 상한 2.5(:207)로 얼버무림. 숨긴 사이 놓친 keyup으로 `keysRef`에 방향키가 남을 수 있음(추정, 미재현) | **없음** | 오버레이 즉시(`setPhase('over')` :81), 애니 320ms. 별건: 피격 무적 없음(engine.ts:258-270) |
| pong | **예(미수정)**. 마운트 effect가 `newGame` 후 rAF(GamePong.tsx:226-229), 공이 즉시 움직임. 득점 후에도 `serveFromCenter`로 대기 없이 재서브(engine.ts:196,212) | **명시 처리 없음**(grep 0건). rAF 중단 의존, 복귀 즉시 재개. 키 stuck 가능성 동일(추정) | **없음** | `GameOverlay` 즉시(:330-345), 애니 320ms |
| flappy | **수정됨(게이트 있음)**. `phase` 초기 `'idle'`(GameFlappy.tsx:29,38), 루프는 `phaseRef==='playing'`일 때만 `step`(:184), 첫 탭/Space가 `doFlap`에서 시작(:247-251) | **명시 처리 없음**(grep 0건). 플레이 중 hidden→복귀 시 경고 없이 이어짐(rAF 중단 의존, dt 상한 :182) | **없음** | 오버레이 즉시(:211,345), 애니 320ms |

감사 대비 정리
- **수정됨(범위 제외)**: flappy의 *즉시 시작*(idle 게이트 존재). 단 감사의 *캔버스 안 'Tap to start' 안내 없음*은 힌트 문장(:314-316)뿐이라 **남음**(작은 일).
- **부분 수정**: tetris 숨김 정지는 이미 있다. 남은 것은 복귀 표시·재개 방식.
- **그대로 남음**: tetris·space-shooter·pong 즉시 시작, 네 게임 일시정지 UI 없음, space-shooter·pong·flappy 숨김 처리 없음.
- **오버레이 지연(d)**: 네 게임 모두 인위적 지연 없음(애니 320ms만) → 이 항목은 **문제 아님, 범위 제외**.
- **R1 범위 밖(별건)**: tetris 락 딜레이, space-shooter 피격 무적, pong 난이도 혼합 기록·패들 속도, flappy 난이도·천장 즉사·게임오버 후 탭 재시작. renewal-queue R1 위험 칸이 "난이도 변경은 이번에 넣지 않음"으로 명시.

## 2. 리서치 1

제약: 이 세션은 **WebSearch만 쓸 수 있고 WebFetch는 도메인 차단**(sdk.poki.com·harddrop.com 해석 실패, reddit.com 차단 → 모두 **접근 불가**, 우회 안 함). 아래는 검색 결과 요약문 기준이며 원문 직접 확인이 아니다. 조사일 2026-11-17.

| # | 출처 종류 | 내용 | 시사점 |
|---|---|---|---|
| 1 | Poki 개발자 요구사항(sdk.poki.com/new-requirements, 검색 요약, 원문 접근 불가) | `gameplayStart`는 **로드가 아니라 플레이어 첫 입력**에 호출, `gameplayStop`은 일시정지·메뉴·레벨 종료 등 중단마다 호출. 키보드 게임은 **ESC 또는 Space로 일시정지/재개** 요구 | 포털 표준은 "첫 입력 시작 + 키 하나로 일시정지" |
| 2 | 포털 정책 Yandex Games·Arkadium(검색 요약, 원문 접근 불가) | 포커스 상실에 반응(Yandex), 포커스 잃으면 오디오 음소거(Arkadium). CrazyGames의 탭 숨김 규칙은 **확인 못 함(추정)** | 포털 심사에서 탭 숨김 대응은 흔한 요구 |
| 3 | W3C WCAG 2.2 SC 2.2.2 Pause, Stop, Hide(Understanding 문서, 검색 요약) | 자동 시작 움직임이 5초 초과면 일시정지/정지 수단 필요(Level A). 움직임이 활동에 **필수**면 예외, 실시간 게임은 예외 논쟁(법적 적용 여부는 추정). 권고: 기본 정지 상태로 시작 | 필수 여부와 무관하게 접근성 모범은 "정지 상태 시작 + 일시정지 수단" |
| 4 | 테트리스 위키(Hard Drop/Tetris Wiki, 검색 요약) | 가이드라인 계열은 락 딜레이 + 이동 리셋(보통 **15회 상한**). "0.5초" 락 딜레이는 **단일 출처 언급, 불확실(추정)** | 락 딜레이는 별건 R의 근거. 수치 확정 전엔 구현 금지 |
| 5 | 사용자 불만: itch.io 테트리스 클론 댓글(Apotris), 공식 Tetris 앱 App Store 리뷰(검색 요약) | "조각이 너무 빨리 고정"(개발자가 락 딜레이 1.7.0 추가). 앱 리뷰: 일시정지 해제 후 **약 5프레임 입력 불가**, "웹사이트처럼 **카운트다운**을 왜 안 넣나" | 복귀 카운트다운 요구가 실제로 있으나, 해제 직후 입력 불가는 불만 → 길이·입력 허용이 쟁점 |
| 6 | 개발자 포럼(itch.io 댓글, html5gamedevs·PlayCanvas, 검색 요약) | "계속 도는 것 같더니 탭 복귀하니 죽어 있다"(itch.io 댓글). 브라우저가 hidden 탭 rAF·타이머를 스로틀/중단하므로 게임이 명시 처리해야 함 | 우리 (b)와 일치: rAF 중단에 우연히 의존, 복귀 UX 없음 |
| 7 | 접근 불가 | Reddit 직접 열람, jstris·tetris.com의 카운트다운 동작(검색에서 자료 못 얻음) | 리서치 2에서 재시도 또는 '확인 못 함' 유지 |

요약: (1) 첫 입력 시작은 포털 표준, (2) 일시정지는 키 하나, (3) 복귀 카운트다운은 사용자 요구가 있으나 해제 직후 입력 불가는 불만, (4) 탭 숨김은 개발자가 명시 처리해야 한다. 상용 사이트의 이탈률·재방문 수치는 **확인 못 함**.

## 3. 기획 v1

### 3.1 무엇이 왜 나쁜가
- **로드 즉시 시작(tetris·space-shooter·pong)**: 페이지에 들어오자마자 첫 판이 진행된다. 감사 pong 실측: 데스크톱 방치 8.5초 만에 CPU 7-0, 모바일은 보드까지 스크롤하는 사이 1-7. space-shooter는 로드 0.8초에 적탄 5발. 첫 판 "내 탓 아닌 죽음"이 Best·재도전 동기를 오염시키고 이탈로 이어진다.
- **일시정지 UI 전무**: 알림·전화 때 멈출 방법이 없다. tetris는 숨김 정지는 되나 복귀가 무표시라 아무 키에 재개와 동시에 조각이 움직인다.
- **숨김 처리 없음(space-shooter·pong·flappy)**: 브라우저 rAF 중단에 우연히 의존.
- 첫 판 이탈률은 **측정된 적 없음(추정)**. 계측 필요(3.7).

### 3.2 고칠 범위
포함
1. 공용 `useGameLoop` + `usePauseOnHidden` + 얇은 `GatePanel` UI(3.4).
2. tetris·space-shooter·pong: 시작 게이트(`ready`) + Pause UI(Esc/P, 버튼). flappy: 훅 phase에 맞춘 리팩터 + 숨김 정지 + 캔버스/패널 내 시작 안내(게이트 자체는 수정됨).
3. 4종 모두: 탭 숨김 → `paused`, 복귀 시 Resume 패널(자동 재개 안 함).
4. 숨김/일시정지 진입 시 입력 상태 초기화(`keysRef`·포인터·`autoFireRef`).
5. pong: 득점 후 재서브 짧은 대기(0.8초 안팎, 값은 시뮬로 확정) — 훅의 `countdown` 재사용.

제외(별건)
- tetris 락 딜레이·Hold·Next, space-shooter 피격 무적, pong 패들 속도·난이도 기록 혼합, flappy 난이도·천장·게임오버 후 탭 재시작, tetris 390px 레이아웃 재설계(확인만). 난이도·Best 단위가 바뀌는 변경이라 R1 위험 칸이 금지.

### 3.3 대안 3개와 선택
| 안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| A. 게임별 개별 수정 | 각 컴포넌트에 phase·visibility를 따로 | 설계 부담 없음 | 4곳 중복. 이미 제각각 구현이 다수(Polytap·Gridlock·ZeroHour 등 visibilitychange 사용처 10여 곳) → 감사 P1이 "visibility 처리 버그 또는 누락" 지적 |
| B. **공용 훅 + 얇은 UI(선택)** | `useGameLoop`가 phase 상태기계·숨김 정지·rAF 구동, `GatePanel`이 Ready/Paused/Countdown UI | 후속 R(beatline·offbeat·gridlock 등 P1 대상)에 재사용, 테스트가 한 곳 | 루프 구조가 달라(rAF 3 + setInterval 1) 어댑터 필요, M |
| C. GameShell 전역 일시정지 | Shell이 자식 게임을 멈춤 | 게임 수정 최소 | Shell은 canvas rAF를 외부에서 멈출 수 없음 |

선택 **B**. 감사 P1이 6+4개 게임에서 같은 결함을 보고했고 큐도 "공용 훅 먼저"를 정했다. 단 훅은 작게: 1차는 phase 상태기계 + 숨김 정지 + 프레임 구동까지. 60Hz 고정 누산기(offbeat)는 후속.

### 3.4 공용 훅 API 초안
위치: `src/lib/useGameLoop.ts` (+ `useGameLoop.test.tsx`, component 프로젝트). 기존 `src/lib/useReducedMotion.ts`와 같은 위치·스타일. UI는 `src/components/game-shell/GatePanel.tsx`를 추가하고 `index.ts`에서 export(`GameOverlay`는 win/lose/draw 전용이라 재사용 불가).

```ts
export type GamePhase = 'ready' | 'countdown' | 'running' | 'paused' | 'over'

export interface UseGameLoopOptions {
  countdownMs?: number    // 기본 0. 복귀·재서브에 1000~1500 후보(리서치 2에서 확정)
  /** running 동안 매 프레임. dt는 60fps 배율, 상한 2.5(기존 컨벤션 유지). rAF 소유는 훅. */
  onFrame?: (dt: number, ts: number) => void
  /** 숨김·일시정지 진입 시 게임이 정리할 것(키·포인터 초기화, 사운드). */
  onPause?: (reason: 'hidden' | 'manual') => void
  pauseOnHidden?: boolean // 기본 true
}

export interface GameLoopApi {
  phase: GamePhase
  phaseRef: React.RefObject<GamePhase> // rAF·이벤트 핸들러에서 stale 없이 읽기(flappy의 phaseRef 패턴)
  start(): void   // ready → countdown(0이면 running)
  pause(): void   // running → paused('manual')
  resume(): void  // paused → countdown → running
  finish(): void  // → over
  reset(): void   // → ready
  acceptsInput: boolean // running일 때만 true
}
export function useGameLoop(opts?: UseGameLoopOptions): GameLoopApi

/** 숨김만 필요한 곳(기존 tetris 인라인 effect :141-147 대체). */
export function usePauseOnHidden(onHidden: () => void): void
```

설계 결정
- **`lastTs`는 running 진입·resume마다 0으로 리셋**해 복귀 첫 프레임 점프를 원천 차단(현재는 dt 상한 2.5로 얼버무림). tetris의 setInterval 중력은 구조가 달라 1차는 `phase==='running'` 조건만 훅에서 가져가는 어댑터.
- `visibilitychange`는 기존 방식(`document.addEventListener`, tetris :141-147)과 동일. 복귀 시 **자동 재개 금지**(`paused` 유지).
- 입력 규약: `ready`의 첫 입력은 `start()`만 하고 게임 입력으로는 적용하지 않는다(시작 탭이 조각 이동·발사가 되는 것 방지). 단 공식 앱 "해제 후 입력 불가" 불만의 반대편이라 리서치 2에서 최적값 확인.
- Pause 단축키: Esc 또는 P. **Space 불가**(tetris 하드드롭·space-shooter 발사와 충돌).
- "Play again"은 `ready`를 거치지 않고 `reset()`+`start()`(짧은 카운트다운): 한 판 더 마찰 방지(리서치 2 가정 1).
- `GatePanel`: `variant: 'ready'|'paused'|'countdown'`, `title`, `hint`(조작 1줄), `onPrimary`. `role="dialog"`, 포커스 이동, 카운트다운은 숫자 텍스트(색 의존 없음), `useReducedMotion` 시 애니 생략. Best·기록과 무관.

### 3.5 회귀 테스트 목록
엔진 로직 변경이 없어 엔진 테스트 추가는 불필요. 아래는 컴포넌트(jsdom, canvas 드로잉 제외하고 phase·상태 전이만)와 e2e.

훅/컴포넌트(`*.test.tsx`)
1. `useGameLoop`: 마운트 직후 `ready`, fake rAF로 5초 진행해도 `onFrame` 0회.
2. `start()` 후에만 `onFrame` 호출, `countdownMs>0`이면 그동안 0회.
3. `document.hidden=true` + `visibilitychange` → `paused`, `onPause('hidden')` 1회, 가시 복귀해도 `paused` 유지(자동 재개 없음).
4. resume 후 첫 `onFrame` dt ≤ 2.5이고 숨김 시간(타임스탬프 10초 점프 주입)이 반영되지 않음.
5. tetris: 로드 후 5초 입력 없음 → 조각 위치 불변·게임오버 아님(renewal-queue R1 항목 그대로).
6. space-shooter(lives 3 유지, 적탄 0)·pong(0-0, 공 위치 불변) 동일 5초 무입력 테스트.
7. tetris: 숨김→복귀 후 키 한 번이 재개와 조각 이동을 동시에 하지 않음(현재 결함 :181).
8. space-shooter/pong: 숨김 직전 ArrowLeft 눌림 → 복귀 후 키 상태 초기화. **추정 결함이므로 먼저 실제 재현 여부를 확인한 뒤 고정**.
9. pong: 득점 직후 N ms 동안 공 위치 불변(재서브 대기).
10. flappy: idle에서 5초 경과해도 `step` 0회(이미 동작하는 것의 회귀 방지), 시작 안내 문구 표시.
11. 기록 불변: 게이트·일시정지가 `recordFinish`·Best 저장을 호출하지 않음, `storageKey` 동일.

Playwright(스모크 확장, 4게임 공통 헬퍼)
12. 로드 → Ready 패널·`*-board` 보임, 3초 뒤 점수 0 유지.
13. `visibilitychange` 디스패치(`document.hidden` 오버라이드) → Paused 패널, Resume 클릭 → 진행.
14. 390px 터치: 탭 한 번으로 시작, 시작 후 조작 버튼 노출.

### 3.6 모바일 390px 확인 항목
- 보드와 Ready/Paused 패널이 첫 화면에 겹침 없이 들어오는가(패널은 보드 위 `absolute inset-0`).
- 시작 버튼이 엄지 영역이고 터치 타깃 44px 이상인가. #79·#84의 보드 안 스크롤 방지(touch-action)가 패널 밖 스크롤을 막지 않는가.
- tetris: 보드+터치 버튼이 뷰포트를 넘는 기존 이슈(감사 :321) — R1에서 고치지 않되 Pause 버튼이 하드드롭 줄과 겹치지 않는지 확인.
- 소리 끔·`prefers-reduced-motion`에서 카운트다운이 숫자만으로 동작.
- 포인터를 누른 채 숨김·복귀(space-shooter `autoFireRef` 리셋).

### 3.7 계측 필요 여부
**필요, 최소**. 첫 판 이탈이 문제라는 근거가 현재 **추정**뿐이다. 구현 때 기존 `recordFinish`(gameStats)·`RecordPlay` 구조를 읽고 (1) 게이트 노출→첫 입력까지 시간 (2) 게이트 노출 대비 start 비율 두 개만 기존 이벤트 채널로. 맞지 않으면 AE 7일 플레이 수 전후 비교로 대체(가능 여부는 리서치 2에서 확인).

### 3.8 연결 구조
- **유입**: 홈·검색 유입은 그대로. 비용은 "첫 화면 Start 1탭". 완화: 보드 위 한 겹, 입력 한 번으로 시작, 조작 안내 1줄을 같은 패널에 넣는다.
- **다음 행동**: 게임오버는 기존 `GameOverlay`(다음 게임 넛지·RUN 마일스톤)를 건드리지 않고 그대로 쓴다. Play again은 게이트를 건너뛴다.
- **재방문**: R1은 새 재방문 장치를 넣지 않는다(솔직한 한계). 대신 리뉴얼 홍보 큐 한 문장을 준비: "열자마자 죽지 않는 테트리스·퐁·슈터, 탭을 떠나도 멈춥니다" + 전후 비교 캡처(5초 무입력 상태). 20시 세션이 큐에 넣는다.
- 후속 연결: 훅을 P1 나머지(beatline·offbeat·gridlock·zero-hour·whack-a-mole·morse-relay)에 재사용하도록 renewal-queue에 연결.

### 3.9 사용자 질문 7개 답
1. **처음 온 사람**: 현재 tetris·space-shooter·pong은 설명 전에 시작해 3초 안에 파악 불가, 첫 10초는 혼란(근거: GameTetris:124, SpaceShooter:336, Pong:226, 감사 pong 실측 모바일 1-7). 게이트에 조작 1줄 + "탭하여 시작". flappy는 게이트는 있으나 캔버스 안내 없음(:314-316).
2. **왜 계속 하나**: 이번 변경은 동기를 새로 만들지 않는다. 첫 판 억울한 죽음을 없애 Best가 의미를 갖게 하는 데까지. 내일 올 이유는 **근거 없음/범위 밖**. Play again 마찰은 늘리지 않는다.
3. **왜 졌나**: 로드 즉시 시작 때문의 패배는 명백히 억울 → 제거. 락 딜레이·무적 프레임 억울함은 별건(감사 근거). 난이도 구간 수치는 이번에 **측정하지 않음**(난이도 변경 제외, 사람형 시뮬 미실시).
4. **어떻게 쓰나**: 숨김·복귀, 한 손·390px, 시작 입력 연타, 키 stuck을 테스트 7·8·14와 3.6에 반영. 실제 브라우저 검증은 이 세션에서 **못 함**(브라우저 없음) → 구현 단계 필수. 카운트다운은 숫자 텍스트, 다이얼로그 role.
5. **왜 공유하나**: 이번 변경에 공유 순간 없음(범위 밖). 리뉴얼 홍보 문안만 준비.
6. **우리 사이트에서 왜**: Poki는 첫 입력 시작·일시정지 키를 요구(검색 요약, 원문 접근 불가), 공식 Tetris 앱도 카운트다운 부재 불만 리뷰(검색 요약). 우리는 이 기본 위생에서 뒤처져 있어 **차별화가 아니라 최소 기준 맞추기**다.
7. **오너가 볼 때(먼저 혹평)**: (a) "시작 한 번 더 눌러야 해서 귀찮다" → 1탭·조작 안내 동봉, 계측으로 확인; (b) "카운트다운이 느리다" → 첫 시작은 카운트 없이 즉시, 복귀·재서브만 짧게; (c) "일시정지 화면이 밋밋하다" → 기존 neon 톤 재사용, 시각 리뉴얼은 범위 밖; (d) "테트리스가 여전히 억울하다" → 락 딜레이는 별건으로 남김, 이유 명시.

## 4. 반증 리서치 2에서 확인할 가정 3개
1. **"게이트 1탭 마찰이 이득보다 작다"** — Poki·CrazyGames류 포털과 상용 아케이드가 첫 판을 어떻게 시작시키는지(Start 버튼/첫 입력/카운트), 게이트가 이탈을 늘렸다는 사례(없으면 '확인 못 함')를 찾는다. "Play again은 게이트 건너뛰기"가 맞는지 포함.
2. **"복귀 시 자동 재개 금지 + 1~1.5초 카운트다운이 최선"** — 공식 Tetris 앱의 해제 후 입력 불가 불만이 카운트다운과 충돌하지 않는지, jstris·tetris.com·모바일 아케이드의 복귀 방식과 평가를 반증 방향으로 조사하고 카운트 길이 근거를 확보.
3. **"rAF/setInterval 중단에만 의존하면 키 stuck·복귀 첫 프레임 점프가 실제로 생긴다"** — 이 가정 자체가 추정이다. 현재 코드를 실제 브라우저(Playwright)에서 숨김·복귀시켜 재현되는지 먼저 확인하고, 재현 안 되면 범위와 테스트 7·8에서 뺀다.
