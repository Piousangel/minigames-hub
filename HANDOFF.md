# 인계: 게임 100종 달성(Bearing) + 홈페이지 마일스톤 공지 — 세션 마무리

> 갱신: 2026-08-11 · 브랜치: `main` · 커밋 상태: **committed & pushed (직접 main)** · **배포 완료·검증됨** (quickminigames.site, 게임 **100종**)

## ▶ 다음 세션 시작 가이드 (여기부터 읽을 것)

**직전 배포는 정상.** `pnpm run deploy` 성공 로그 확인 + `curl`로 라이브 200
재확인까지 마쳤다(홈 `/`, `/bearing`, 홈페이지 마일스톤 공지 텍스트 전부).
git 작업 트리는 깨끗하고(uncommitted 없음), origin과 동기화됨. **바로 새 작업을
시작해도 안전한 상태.**

**우선순위 1 — TODOS.md의 "라운드15 UI/UX 감사" 항목부터.** 사용자가 100종
달성 후 쉬자고 해서 이번 세션엔 미착수. 구현 계획까지 다 적어놨으니 그대로
따라가면 됨:
1. Beatline/Gridlock 힌트 문구가 탭 조작을 안 알려줌 — 3줄짜리 텍스트 수정,
   무위험.
2. Simon이 오답 시 시각 피드백(`anim-shake`)이 없는 유일한 게임 — 단일 파일,
   상태 하나 추가.
3~5순위는 라운드15 워크플로(`wf_813db7ff-ccc`, 완료된 세션 로그에 전문 있음)의
   UI/UX synthesis 참고 — 12건 원본 중 상위 5건 + "하지 말 것" 분류가 있음.

**우선순위 2 — 신규 게임 라운드16.** `minigames-round.js`는 다시 3종 뽑는
기본값으로 원복돼 있음(라운드15에서 1종만 뽑으려고 임시로 1로 바꿨다가 원복
완료 — 지금 열어보면 `if (winners.length === 3) break`가 맞다). `EXISTING`
목록도 100종 전부 반영된 최신 상태. 바로 `Workflow({ scriptPath:
'.claude/workflows/minigames-round.js' })`로 돌리면 됨.

**우선순위 3 — 누적 커스텀 SVG 아이콘 (7종 밀림).** Gravwell/Loopgrid/Bisect
(라운드13) + Slotter/Carousel/Gridlock(라운드14) + Bearing(라운드15) 전부
이모지만 있음. 2026-08-05 "아이콘 갭 11종" 세션과 동일 패턴으로 한 배치 처리
가능 — TODOS.md 참고.

**주의할 함정:**
- `Workflow({name:...})`로 `.claude/workflows/*.js`를 수정한 직후 같은 턴에
  호출하면 옛 사본이 실행될 수 있음([[workflow-name-invocation-staleness]]) —
  `scriptPath`로 직접 호출하는 게 안전.
- 워크플로의 build 에이전트가 "Connection closed mid-response"로 실패 처리돼도
  실제 파일은 이미 완성돼 있을 수 있음([[workflow-build-agent-connection-drop-check-files-first]])
  — 재실행 전에 `git status`/`pnpm vitest run <경로>`로 먼저 확인할 것.
- 배포 직후 신규 라우트가 일시적으로 404 나는 건 Cloudflare 엣지캐시 지연,
  ~10초 내 자연 해소되는 정상 패턴(회귀 아님) — 매 라운드 반복 관측됨.

---

## 2026-08-11 세션(2) — 게임 라운드15: 100종 달성(Bearing) + 홈페이지 마일스톤 공지

사용자가 "100개까지 만들고 좀 쉬자"고 명시적으로 요청 — 이번 라운드는 신규 게임
**1종만** 만들어 정확히 100종에서 멈추고, UI/UX 감사는 구현 없이 TODOS.md에만
기록한 뒤 세션을 마무리했다. 이어서 사용자가 "100개 게임 런칭했다고 홈페이지에
알리는 것까지 하자"고 추가 요청해 마일스톤 공지 배너까지 배포하고 마무리.

**게임 99 → 100종.** `minigames-round.js`의 승선 로직(`if (winners.length === 3)
break`)을 이번 실행 한정으로 `1`로 임시 수정해 `Workflow({scriptPath:...})`로
실행, 완료 직후 3으로 원복(다음 라운드부터 다시 3종 — **원복 확인 완료**, 위
가이드 참고). 이 편집이 실행 중이던 백그라운드 잡에 영향을 주지 않는지는
[[workflow-name-invocation-staleness]] 메모리의 반대 방향 우려였는데, 실제로
문제없이 1종만 정확히 나왔다.
- **Bearing**(🧭 Puzzle, daily) — 부호만 알려주는 나침반 추리 보물찾기. 매 삽질이
  거리 없이 방향(N/S/E/W/대각선)만 반환 — `atan2`/거리 계산 없이 순수 부호 비교로
  구현된 결정론적 엔진, 한 번의 삽질이 셀 하나가 아니라 영역 전체를 배제시킴.

배선 6곳 + e2e 스모크(Daily 필터 기대 타이틀에 Bearing 추가 포함) 전부
오케스트레이터가 직접. 검증: `pnpm typecheck && pnpm lint`(0 errors) ·
`pnpm vitest run`(118 files / 3218 tests) · `pnpm build` · `pnpm exec
playwright test`(119, 전부 GREEN). 커밋 3개 → push → `pnpm run deploy` →
quickminigames.site `/`·`/bearing` curl 200 즉시 확인.

**UI/UX 감사 12건은 의도적으로 미착수.** 상위 5건(구현 계획 포함)과 "하지 말 것"
분류를 TODOS.md에 그대로 옮겨 다음 세션이 바로 착수할 수 있게 해뒀다 — 1순위는
Beatline/Gridlock 힌트 문구가 탭 조작을 안 알려주는 저위험 3줄 수정, 2순위는
Simon의 오답 시 시각 피드백 부재(`anim-shake` 미적용, 유일한 예외 게임).

**✅ 홈페이지 100종 마일스톤 공지 추가·배포.** `src/app/page.tsx` 히어로 섹션에
lime 계열 필(pill) 배지 추가 — "🎉 100 free games and counting — newest:
Bearing", `/bearing`로 링크(최신작 유입 CTA 겸 공지). 기존 `NewBadge.tsx`가 쓰는
lime 컨벤션(`border-neon-lime/40 bg-neon-lime/10 text-neon-lime`)을 그대로 재사용.
서버 컴포넌트라 정적 HTML에 텍스트가 직접 박힘(`out/index.html`에서 grep으로
확인) — 클라이언트 하이드레이션 의존 없음. `Marquee.tsx`의 티커도
`${gamePages.length} GAMES`로 게임 수를 동적으로 읽어오므로 "100 GAMES"가
자동으로 이미 반영돼 있었음(별도 수정 불필요, 확인만 함). 검증: typecheck/
eslint 클린 · `pnpm build` 후 정적 HTML에 문구 존재 확인 · 관련 e2e 2건(홈
카드 이동, Daily 필터) GREEN · 전체 vitest(3218)/e2e(119) 재확인 GREEN. 배포 후
엣지캐시 지연으로 최초 curl엔 문구가 안 잡혔다가 ~8초 뒤 재확인 시 정상 노출
(반복 관측된 패턴, 회귀 아님).

**메모리 기록:** [[workflow-build-agent-connection-drop-check-files-first]](라운드14에서
새로 배움)를 재확인할 기회는 없었지만, 워크플로 스크립트를 임시로 고쳐서 1개만
뽑는 패턴 자체는 향후 "몇 개만 더 만들고 끝내자" 같은 요청에 재사용 가능한 접근으로
남겨둔다(별도 메모리화는 아직 안 함 — 1회성 이벤트라 재발 시 기록 고려).

## 2026-08-11 세션 — 게임 라운드14(Slotter/Carousel/Gridlock) + Word Guess Daily 이식 + UI/UX 감사 대응

**게임 96 → 99종.** `Workflow({ scriptPath: '.claude/workflows/minigames-round.js' })`로
신규 3종 기획→구현 시도. **이번 라운드는 20개 에이전트 중 2개(carousel/gridlock의
build 단계)가 "Connection closed mid-response" API 오류로 실패 처리됐지만, 실제로는
작업 대부분이 이미 완료된 상태였다** — 파일을 직접 확인해보니 carousel은 엔진+테스트
+컴포넌트까지 전부 완성(typecheck/vitest 클린), gridlock은 엔진+테스트(29개 통과)는
완성됐고 컴포넌트만 빠져 있었다. 전체 파이프라인을 재실행하는 대신, gridlock 컴포넌트만
별도 `Agent` 호출로 기존 엔진을 건드리지 않고 완성시켜 3종 모두 살렸다.
- **Slotter**(🎰 Skill) — 정렬된 줄에 마감 전 정확한 틈을 클릭해 카드를 끼워 넣는
  압박 게임. 오답이나 타임아웃이면 줄이 깨짐, 정답마다 다음 카드가 조금씩 빨라짐.
- **Carousel**(🎠 Puzzle) — 마블을 로더에 놓을 때마다 링 전체가 스스로 고정폭만큼
  회전. 플레이어가 회전을 직접 조작하지 않고 "한 수 앞의 위치"를 예측해 계획해야 함.
- **Gridlock**(🚦 Arcade) — 사거리 하나를 4방향 교통이 공유. 한 번에 한 레인에만
  통행권을 줌 — 점유 중 전환하면 크래시, 너무 오래 방치하면 타임아웃. 엔드리스 생존.

배선 6곳 + e2e 스모크 전부 오케스트레이터가 직접. 세 게임 모두 데일리 모드 없음
(순수 엔드리스/1회성 세션).

**⚠️ 이번 세션 중 Chrome MCP 브라우저 탭 세션이 반복적으로 깨져서(frame removed,
tab group 소실) 사용자가 "로컬로띄우지마"라고 지시 — 이후 code-only 검증
([[prefer-code-only-verification-when-busy]] 패턴)으로 전환. typecheck/lint/
vitest(3185)/build/e2e(118) 전부 GREEN 확인 후 배포, 라이브 curl 200 확인으로
마무리(Gravwell/Loopgrid/Bisect 3종은 이전 세션에 이미 브라우저 실플레이 검증
완료됨 — round14 신규 3종만 code-only로 검증).

**UI/UX 감사 5건 전부 구현 — 1순위가 드디어 Word Guess Daily 이식이었다:**
1. **Word Guess에 Daily 모드/스트릭 인프라 이식(라운드12·13에서 2번 연속 최우선
   보류됐던 항목, 이번에 착수).** `wordguess/engine.ts`에 quadle과 바이트 동일한
   `mulberry32`/`dailySeed` 추가(+결정론 테스트). `GameWordGuess.tsx`에 quadle의
   Daily/Practice 토글·`DailyShareButton`·스트릭 배선을 이식하되, **기존
   `readStats(storageKey)`의 `{wins,streak}` JSON은 손대지 않고 신규
   `${storageKey}:streak`를 별도 키로 얹었다** — 두 라운드 전부터 감사가 반복
   경고한 리스크(기존 로컬 기록 오염)를 실제로 피함. 신규 데일리 스트릭 배지는
   기존 stats 패널의 "Streak"(연승 스트릭)과 이름이 겹칠 뻔해서 "Day Streak"로
   구분해 라벨 충돌을 피함(Quarry 등이 이미 쓰던 라벨 재사용).
2. Hangman/WordGuess의 Wins/Streak stat에 `float: true` 누락 → 4곳 추가.
3. `GameCard.tsx`의 "PLAY ►" 라벨이 호버 전용(`opacity-0 group-hover:opacity-100`)
   이라 터치 기기에선 절대 안 보임 → `opacity-60 sm:opacity-0 sm:group-hover:...`로
   모바일엔 옅게 상시 노출.
4. `gameMeta.ts`의 deepdive/handful `controls: ['arrows']`가 실제 탭 우선 조작과
   달라 첫 화면 글리프가 틀린 조작법을 안내 → `['tap', 'arrows']`로 정정 + registry
   카피 2곳·GameHandful 힌트 문구 동반 수정.
5. Mahjong 타일 선택 시 리프트가 순간이동처럼 스냅됨(transition 없음) → 1단계만
   구현(transition 추가), 2단계(매치 제거 fade)는 free-tile 판정 회귀 위험 때문에
   TODOS.md에 회귀 테스트 선행 조건과 함께 이월.

**검증(전부 실행함):** `pnpm typecheck && pnpm lint`(0 errors, 기존 경고 15개만) ·
`pnpm vitest run`(117 files / 3185 tests, word-guess 결정론 테스트 4건 추가) ·
`pnpm build`(신규 3라우트 포함) · `pnpm exec playwright test`(118, Daily 필터
테스트에 Word Guess 추가 확인 포함). main 직접 커밋 7개 → push → `pnpm run deploy`
→ quickminigames.site 5개 라우트 curl 200(엣지캐시 지연 없이 즉시 200).

**다음 세션 후보(TODOS.md 참고):** 6종 누적 커스텀 SVG 아이콘(라운드13+14) ·
Mahjong 매치 제거 애니메이션 2단계(회귀 테스트 선행) · 감사가 "하지 말 것"으로
확정한 3건(난이도 라벨 통일/vs-CPU stats 통일/testid 리네임 — 재발견돼도 반려할 것,
이유는 TODOS.md 참고).

## 2026-08-10 세션(3) — 게임 라운드13(Gravwell/Loopgrid/Bisect) + UI/UX 감사 대응

**게임 93 → 96종.** `Workflow({ scriptPath: '.claude/workflows/minigames-round.js' })`로
신규 3종 기획→구현. 이번엔 이름 대신 `scriptPath`로 직접 호출해 [[workflow-name-invocation-staleness]]
캐싱 함정을 우회함(라운드12 직후 `EXISTING`을 93종으로 갱신·커밋해뒀는데, 같은 턴에
이름으로 호출하면 반영이 안 될 수 있어서 예방적으로 우회).
- **Gravwell**(🪐 Puzzle, daily) — 원샷 중력 슬링샷 퍼즐. 발사 각도·속도만 입력하고
  나머지는 역제곱 중력이 궤적을 통째로 휘게 둔다. 정수 고정소수점(mu, SCALE=1000)
  물리 엔진, semi-implicit Euler 적분.
- **Loopgrid**(🔁 Puzzle, daily) — 빈칸 없는 순환 그리드 컬러 정렬. 행/열 전체를
  한 방향으로 순환시키면 끝 칸이 반대편으로 넘어옴(뫼비우스 그리드).
- **Bisect**(✂️ Skill) — 카운트다운도 진행바도 없는 순수 시간감각 서바이벌. 시작
  신호와 끝 신호 사이 정중앙을 짚어야 함. 데일리 없음(엔드리스, 라이프 3개).

배선 6곳(registry/GameRenderer/gameMeta/leaderboard/objectives/e2e 스모크) +
Daily 필터 e2e 기대 타이틀 목록(Gravwell/Loopgrid 추가) 전부 오케스트레이터가 직접.
브라우저(Chrome MCP)로 3종 모두 실플레이 검증 — Gravwell 궤적이 행성 중력에 실제로
휘어지는 것, 그레이즈 보너스 획득 확인 / Loopgrid 순환이 끝 칸→반대편 wraparound로
정확히 동작 확인 / Bisect의 armed 화면이 스펙대로 완전히 비어있고(카운트다운 없음),
타임아웃 시 라이프가 정확히 깎이는 것 확인.

**UI/UX 감사 5건 중 4건 구현, 1건 보류:**
1. 카드게임 3종(Solitaire/Yukon/Freecell) 더블탭→파운데이션 이동이 iOS Safari에서
   시스템 확대 제스처로 가로채임 → 해당 버튼에 `touch-manipulation` 추가(4개 지점).
2. **재차 반려** — Maze/Sliding/WordSearch에 `recordResult()` 추가 제안. 라운드12와
   동일한 사유(낮을수록 좋은 시간 기록이라 트로피 패널의 "높을수록 좋음" 표시와 충돌)로
   반려. 신선한 컨텍스트의 감사가 매번 재발견하지 않도록 `GameStats.tsx`의 게이팅
   줄 위에 이유를 코드 주석으로 남겨둠.
3. **보류(TODOS.md에 감사의 구현 계획 그대로 기록)** — word-guess에 Daily 모드/스트릭
   인프라 이식(quadle 패턴 복제). 5건 중 스코프가 가장 크고(엔진+컴포넌트 대폭 수정),
   감사 스스로 "기본 모드 전환으로 기존 e2e가 깨질 수 있다"고 경고한 리스크가 있어
   이번 라운드 나머지 작업과 섞지 않고 다음 라운드에 전담 검증과 함께 진행하기로 함.
4. 카드게임 8종 + Clusters/Quadle, Score가 실시간 증가하는데 `float: true` 누락 →
   10개 파일에 각 1줄 추가(펄스 시 "+N" 팝업 활성화).
5. Breakout/Pong 힌트 문구가 "mouse"만 언급 — 실제론 터치 드래그를 이미 완전
   지원하는데 모바일 방문자가 오인할 수 있음 → 문구에 터치 언급 추가(2곳).

**검증(전부 실행함):** `pnpm typecheck && pnpm lint`(0 errors, 기존 경고 15개만) ·
`pnpm vitest run`(114 files / 3085 tests) · `pnpm build`(신규 3라우트 포함) ·
`pnpm exec playwright test`(115, 전부 GREEN). main 직접 커밋 7개 → push →
`pnpm run deploy` → quickminigames.site 7개 라우트 curl 200 확인(`/gravwell`,
`/bisect`는 배포 직후 404 → ~8초 내 자연 해소, 계속 반복되는 패턴).

**다음 세션 후보(TODOS.md 참고):** word-guess Daily 모드 이식(P2, 구현 계획 완료
대기) · Gravwell/Loopgrid/Bisect 커스텀 SVG 아이콘 · Offbeat/Hogline/Prismbox
커스텀 SVG 아이콘(라운드12부터 이월) · New Game 확인-탭 인프라 · GameButton 44px
터치 타겟 캐스케이드-안전 재시도.

## 2026-08-10 세션(2) — 게임 라운드12(Offbeat/Hogline/Prismbox) + UI/UX 감사 대응

**게임 90 → 93종.** `Workflow({ name: "minigames-round" })`로 신규 3종 기획→구현
(Track A: 5개 앵글 아이디어→3렌즈 심사→상위 3종 스펙→빌드, Track B: 5차원 UI/UX
감사→테크리드 종합, 병렬):
- **Offbeat**(🔇 Skill) — 역발상 리듬 서바이벌. 박자에 맞춰 누르는 게 아니라 박자
  "사이 무음 구간"을 탭. 데일리 없이 순수 엔드리스 생존(재시작마다 `freshSeed()`).
- **Hogline**(🥌 Puzzle, daily) — 컬링 모멘텀 퍼즐. 돌을 던져 하우스를 장악.
- **Prismbox**(🌈 Puzzle, daily) — 빛 광선 발사로 숨은 원자 찾기(블랙박스류 추론).

배선 6곳(registry/GameRenderer/gameMeta/leaderboard/objectives/e2e 스모크)
전부 오케스트레이터가 직접. e2e "Daily 필터" 테스트의 하드코딩된 기대 타이틀
배열이 신규 데일리 게임 2종 누락으로 깨진 걸 잡아 수정. 브라우저(Chrome MCP)로
3종 모두 실플레이 검증 완료.

**⚠️ 운영상 함정 발견(메모리 기록 예정):** `.claude/workflows/minigames-round.js`의
`EXISTING`(게임 목록, 컨셉 중복 방지용) 상수를 직접 수정한 뒤 `Workflow({name:...})`로
호출해도 라이브 수정이 반영 안 됨 — 실제 실행된 스크립트는 세션 스코프 경로에
캐시된 예전 사본(83종 목록)을 그대로 썼다(`grep -c` 대조로 확인). 비싼 20-agent
파이프라인 재실행 대신, 신규 3종과 목록에서 빠졌던 6종 간 기계적 중복이 없음을
수동 대조로 확인하고 진행. 수정한 `EXISTING`(89종 반영)은 다음 라운드부터는
정상 반영될 것으로 기대.

**UI/UX 감사 5건 처리(전부 근거 남기며 판단):**
1. Countcircle 게임오버 오버레이가 신기록을 세워도 항상 "Eliminated"만 표시 →
   Flywheel과 동일하게 `variant={newBest ? 'win' : 'lose'}`로 수정.
2. **의도적으로 스킵** — Maze/Sliding/WordSearch에 `recordResult()` 추가 제안.
   이번 세션 이전에 이미 의도적으로 뺀 게임들(낮을수록 좋은 "Best"라 GameStats의
   단순 "높을수록 좋음" 표시가 오도함) — 세션 내 과거 결정과 충돌해 반려.
3. **경험적으로 검증 후 되돌림** — GameButton 기본 터치 타겟을 44px로 키우는 안.
   감사가 "Tailwind 클래스 충돌 가능성"만 막연히 언급했는데, 실제로 빌드된 CSS의
   바이트 오프셋을 대조해보니 새 기본값(`py-2.5`)이 사이트 전역 92곳의 기존
   `className="px-4 py-2"` 오버라이드를 캐스케이드 순서상 실제로 이겨버리는 걸
   확인 — 의도와 반대로 깨질 확률이 높아 `git checkout --`로 되돌림.
4. New Game 확인-탭 인프라(오조작 방지) — 낮은 리스크지만 특정 게임이 옵트인해야
   가치가 생기는 순수 인프라라 이번 라운드에서는 보류, TODOS.md에 기록.
5. Mahjong/Overload/Yahtzee가 직접 만든 `headerExtra` span(Left/Moves/Time,
   Taps/Round, Turn)을 쓰고 있어 GameShell 표준 stats 배열의 펄스/플로트 연출을
   못 받던 문제 → 마이그레이션. `StatSpec.value`를 `number | string`으로 확장
   (Mahjong의 mm:ss, Yahtzee의 N/13처럼 포맷 문자열 표시용, `float`은 숫자 전용
   가드 추가). 브라우저로 3종 다 렌더 확인, 시각적 회귀 없음.

**검증(전부 실행함):** `pnpm typecheck && pnpm lint`(0 errors, 기존 경고 15개만) ·
`pnpm vitest run`(111 files / 2973 tests) · `pnpm build`(신규 3라우트 포함) ·
`pnpm exec playwright test`(112, 전부 GREEN). main 직접 커밋 4개 + 배송 1개(총 5개)
→ push → `pnpm run deploy` → quickminigames.site 8개 라우트 curl 200 확인
(`/offbeat`, `/prismbox`는 배포 직후 404 → ~8초 내 자연 해소, 기존 반복 패턴 재확인).

**다음 세션 후보:** Offbeat/Hogline/Prismbox 커스텀 SVG 아이콘(현재 이모지만,
2026-08-05 "아이콘 갭 11종" 세션과 동일 패턴으로 후속 배치 가능) · New Game
확인-탭 인프라 구현 여부 결정 · GameButton 44px 터치 타겟을 캐스케이드-안전한
방식(기존 `px-4 py-2` 컨벤션 유지 + 충돌 없는 `min-h-11` 플로어 추가)으로
재시도할지 검토.

## 2026-08-10 세션 — 게임 라운드11(Stakehouse/Grasp/Countcircle) + UI/UX 감사 5건 + jsdom/RTL 도입 + ⚠️ 트래픽 신호 갱신

**게임 87 → 90종.** `Workflow({ name: "minigames-round" })`로 신규 3종 기획→구현:
- **Stakehouse**(🏺 Arcade) — 4개 항아리 push-your-luck 베팅. 배당 실시간 공개, 12라운드 생존.
- **Grasp**(🤏 Skill, daily) — 카드 쥐기/흘리기, 조급 게이지가 차면 라운드 강제 종료(단, 마지막 카드를
  쥐는 순간이면 클리어로 역전).
- **Countcircle**(💺 Arcade) — 조세푸스 서바이벌. 카운트가 도달하기 전 옆자리로 피함. 엔드리스.

배선 6곳(registry/GameRenderer/gameMeta/GameIcon/leaderboard/objectives) + e2e 스모크
전부 오케스트레이터가 직접. 브라우저(Chrome MCP)로 Stakehouse/Grasp 실플레이 검증(베팅
배당 실시간 반영, 게이지 캡→오버레이 정상 확인) — 세션 도중 사용자가 "크롬띄우지말고
작업해" 지시해 이후엔 코드 기반 검증(typecheck/lint/vitest/build/e2e)으로 전환
([[prefer-code-only-verification-when-busy]] 메모리 참고, 국지적 지시로 해석함).

**UI/UX 감사 상위 5건 전부 구현:**
1. Ricochet 데일리 힌트에 조작법 누락 → 추가.
2. Breakout/BubbleShooter/Sonar 신기록 축하 오버레이 부재 → 추가(`src/lib/bestScore.ts`로
   판정 로직 공용화).
3. AimTrainer/Pong/Reaction의 `recordResult()` 미배선(GameStats 트로피 패널 죽어있었음) → 배선.
4. 11개 게임 데일리 리셋 버튼 라벨 3중 분열("Reset"/"Replay"/"Replay Daily") → "Replay Daily"로 통일.
5. Aim Trainer가 유효한 점수를 갖고도 `LEADERBOARD_GAMES` 누락 → 등록 + 배포 후 실제
   제출(POST /api/score) 200 확인 완료.

**⚠️ jsdom + React Testing Library 이번 세션에 정식 도입** (TODOS.md P2, 2026-08-04부터
대기 중이던 결정 — `/ship` 커버리지 감사가 76%를 보고하며 사용자에게 확인 후 진행).
`vitest.config.ts`를 `test.projects`로 분리(`engine`: node/`*.test.ts` 기존 그대로,
`component`: jsdom/`*.test.tsx` 신규). GameAimTrainer/GameReaction에 실제 클릭·타이머
조작 컴포넌트 테스트 파일럿(6건). canvas+rAF 게임(Breakout/BubbleShooter/Pong)과
그리드 게임(Sonar)은 다음 라운드 후보로 TODOS.md에 남김.

**`/ship` 리뷰가 실제 버그 2건을 잡았다(둘 다 이번 세션에 내가 직접 만든 버그):**
- `GameGrasp.tsx`(신규 파일)가 "Replay Daily" 통일 스윕 대상(기존 11개 파일)에서
  빠져 옛 라벨 "Reset"이 남아있었음 — 커버리지 감사가 발견.
- `GameBubbleShooter.tsx`의 신기록 플래그가 `setIsBest(beat)`(그 틱만 판정)로,
  `GameBreakout.tsx`의 `setIsBest(v => v || beat)`(누적) 패턴과 달라 — 중간 라운드에
  신기록을 세우고 마지막이 무득점 샷으로 끝나면 축하 UI가 조용히 안 뜨는 버그였음
  (레드팀 리뷰가 발견, CRITICAL). 두 파일 패턴 통일로 수정.
- 적대적 리뷰가 추가로 `src/lib/bestScore.ts`의 `localStorage.setItem`에 try/catch가
  없어 rAF 루프 도중 예외가 터지면 게임이 영구 멈출 수 있는 버그도 잡아 즉시 수정.

**보류(사람 판단 필요, TODOS.md에 상세 기록):** Stakehouse의 "Best"가 완주 시에만
기록되고 버스트 시 중도 피크는 안 잡히는 문제(설계 의도일 수도), Stakehouse 12라운드째
뱅크롤 정확히 0으로 완주 시 Busted로 뜨는 엣지케이스, Aim Trainer 리더보드가 소수점
tps를 정수로 잘라 변별력이 낮은 문제(제출 경로 자체는 배포 후 확인 완료, 스케일링만 남음).

**검증(전부 실행함):** `pnpm typecheck && pnpm lint`(0 errors, 기존 경고 15개만) ·
`pnpm vitest run`(101 files / 2832 tests) · `pnpm build`(216 라우트) ·
`pnpm exec playwright test`(106). `/ship`(5개 스페셜리스트 + 레드팀 + 적대적 리뷰) →
PR #2 → `/land-and-deploy`(squash merge, 수동 `pnpm run deploy`, quickminigames.site
+ 신규 3라우트 + 리더보드 API 실검증). 배포 직후 `/stakehouse` 엣지캐시 stale 404 →
~10초 내 자연 해소(기존에도 반복된 패턴, 회귀 아님).

### ⚠️ 중요 — 트래픽 신호 진단 (2026-08-10, 2단계 — 사용자 요청으로 계속 파고듦)

사용자가 Cloudflare 대시보드 스크린샷(순방문자 3.04k/30일)을 공유하며 "후원이 한
건도 없어서 수익이 안 난다"고 우려 표명 → 진단 착수, 사용자가 "쉬지 말고 계속
연구하라"고 해서 2단계까지 깊이 팠다.

**1단계(자체 beacon 분석):** `mg_events` 기록상 실제 게임 페이지 참여가 2026-08-05
03:19(KST) 이후 5일간 0건. 파이프라인 자체는 정상(curl 테스트 확인).

**2단계(Cloudflare 존 요청 로그 직접 조회, GraphQL Analytics API) — 결정적 증거를
잡았다:** 8/9 트래픽 스파이크(pageViews 794)의 정체는 프랑스발 `curl/8.7.1` 취약점
스캐너 하나가 `/wp-admin/`·`/phpinfo.php`·`/.hg/store`·`/jolokia/read` 등 존재하지
않는 경로 수백 개를 훑은 것이었다. 8/6·8/8 두 날을 더 조회하니 **매일 가장 큰 단일
트래픽원이 봇이었다** — 정확히 같은 UA(`iPhone OS 13_2_3`)가 미국·중국·브라질·독일·
싱가포르·일본·한국 등 서로 다른 국가에서 홈("/")만 반복 요청. Cloudflare의 "고유
방문자"는 IP+UA 기준이라 이게 나라별로 각각 "1명"씩 잡힌다. 그 외 워드프레스 설치
경로 스캔, CensysInspect(보안 리서치 스캐너), ClaudeBot/Amazonbot/AhrefsBot/
Google-Display-Ads-Bot(정상 크롤러, 인간 아님)도 상시 존재. 진짜 사람으로 보이는
트래픽(실제 브라우저가 `_next/static/chunks/*.js` 자산을 정상적으로 받아가는 패턴)도
분명 있지만 규모가 훨씬 작다.

**결론: "3.04k 순방문자"의 상당 부분은 실제 사람이 아니다.** 진짜 인간 도달 규모는
대시보드 숫자보다 훨씬 작고 자체 계측(누적 44 vid)에 더 가깝다. "3천 명 왔는데 전환
0건"이라는 원래 위기감은 재조정해야 한다 — 표본이 그보다 훨씬 작으면 0건이 통계적으로
그리 이상하지 않다. **단, UX를 안 고쳐도 된다는 뜻은 아니다** — 표본이 작을수록 그
소수의 경험을 잘 만드는 게 더 중요해진다.

- **후원(Ko-fi) 링크는 이미 있었다** — footer(라이브 확인) → 이번 세션에 GameOverlay
  RUN 마일스톤 조건으로 추가 배포함(아래).
- **AdSense는 2026-07-23 거절 이후 새 메일 없음.** 대시보드는 사용자가 직접 확인 필요.

자세한 조회 방법(SQL·GraphQL 쿼리, 토큰/zone_id 위치 등 재현 가능한 형태로)은 메모리
[[data-signals-premature]] 참고.

**✅ 후원 링크 노출 개선은 같은 세션에 바로 처리·배포했다.** 사용자에게 빈도/조건을
물어(RUN 마일스톤 추천 선택받음) `GameOverlay.tsx`(전 90종 게임의 승/패 화면 공용
컴포넌트)에 "☕ On a roll — support the site?" 링크를 `runMilestone`(세션 3/5/10/20판째
등) 조건에만 추가. 매 게임오버마다 뜨지 않아 재방문율을 해치지 않으면서 가장 몰입한
순간에만 노출. 컴포넌트 테스트 3건(`GameOverlay.test.tsx`) + 전체 검증(typecheck/
lint/vitest 2835/build/e2e 106) 전부 GREEN 확인 후 main 직접 커밋·배포·빌드 산출물에
문자열 포함 확인까지 마침.

**다음 세션은 게임 라운드12를 바로 돌리지 말고:** (1) Analytics Engine에 실이벤트가
다시 쌓이는지 재조회, (2) Cloudflare "고유 방문자" 숫자를 그대로 신뢰하지 말고 자체
계측(vid) 기준으로 진짜 인간 도달을 계속 추적, (3) AdSense 상태 재확인 요청 순으로
진행할 것. Bot Fight Mode 활성화는 SEO 크롤러를 실수로 막을 리스크가 있어 사용자
확인 없이 건드리지 않았다 — 옵션으로만 남겨둠.

**✅ 이어서 사용자가 "쉬지 말고 계속 연구하라"고 해서 DOMAIN.md P1의 마지막 잔여
항목(GameStats 트로피 패널 확산)에 착수·완료했다.** 승/패가 있는데 `recordResult()`를
안 부르던 게임 52종 중 21종(TicTacToe/DotsAndBoxes/NumberMemory/Typing/ZeroHour/
WhackAMole/GemMatch/Rps/Simon/SpaceShooter/Flappy/TowerStack/Stackpot/Ticker/
Breakout/BubbleShooter/Sonar/Ricochet/Countcircle/Grasp/Stakehouse — 이번 세션에
만든 신규 3종도 빠져 있었다)에 배선. 각 게임의 실제 승패 정의를 따랐다(단순
"완료=true"가 아니라 push-your-luck류는 성공적 탈출 여부 등). **Breakout에서 실제
버그를 하나 새로 만들 뻔했다** — rAF 루프가 게임오버 후에도 매 프레임 돌아서 순진하게
넣으면 오버레이 떠 있는 동안 `recordResult`가 초당 60회 불려 `stats.plays`가 폭증;
`recordedRef` 단일발화 게이팅으로 해결(TODOS.md에 이 함정 기록해둠). 전체 검증
(typecheck/lint/vitest 2835/build/e2e 106) GREEN 확인 후 배포·라이브 확인 완료.

**✅ 사용자가 계속 "쉬지 말고 연구/작업하라"고 해서 남은 게임까지 마저 끝냈다.**
2개 배치 더 진행해 **49종 전부 완료**(3개 배치 합계) — DOMAIN.md P1이 이걸로 완전히
닫혔다. 각 배치마다 typecheck/lint/vitest/build/e2e 전부 재검증·배포·라이브 확인.
안전성 패턴(rAF 루프가 게임오버 후에도 도는데 안전한 경우 vs `recordedRef` 게이팅이
필요한 경우 구분법)과 `won` 판정 컨벤션(대전/점수어택/push-your-luck별)은 TODOS.md
Completed 섹션에 상세 기록해뒀다 — 다음에 신규 게임을 만들 때도 참고할 것. 의도적
제외 3종(Sliding/Maze/WordSearch, "낮을수록 좋음" best)만 남음, 별도 배지 로직
없이는 손대지 말 것.

**사용자가 "커뮤니티도 만들어볼까"라고 물어서 짧게 답함(구현 안 함, 논의만):** 지금
당장은 보류 추천 — 커뮤니티는 부트스트랩할 기존 유저층이 필요한데(닭과 달걀 문제),
실제 인간 트래픽 자체가 아직 얇다는 걸 방금 확인했다. 체류·전환이 먼저 개선된 뒤
소규모로(Discord 채널 2~3개, 리더보드/데일리 챌린지 연동) 시작하는 걸 권함. 커뮤니티
게시·운영은 어차피 사용자 몫([[autonomous-continuous-dev]]).

**✅ 이어서 사용자가 "배치 문제도 더 파보고, 계속해서 페이지를 디벨롭하라"고 지시 —
리더보드 배치(discoverability) 문제를 팠다.** `GamePageLayout.tsx`를 다시 보니
`<Leaderboard>`는 `NextUp`/`GameSwitcher`/`GameStats`/`DailyDock`(전부
`GameNavProvider` 안, 게임 바로 아래)을 지나고서야 나온다 — 즉 리더보드가 있는 게임
64종에서도 실제로는 스크롤을 상당히 내려야만 보인다. 페이지 순서를 바꾸는 안은
일부러 피했다: `NextUp`(다음 게임 카드)을 리더보드보다 위로 올리면 세션 연장이라는
핵심 체류 장치의 위치가 흔들릴 위험이 있어서다. 대신 **게임오버 오버레이(가장
이탈률 높은 지점, 전 게임 공용)에 `#leaderboard`로 점프하는 넛지를 추가**하는
쪽으로 갔다 — 페이지 구조는 그대로 두고 발견 경로만 새로 뚫은 것.

구현: `GameNav` 컨텍스트(`src/components/GameNav.tsx`)가 지금까지 `nextSlug`/
`nextTitle`/`runCount`만 들고 있었는데, `GameOverlay`가 `hasLeaderboard()` 판정을
하려면 현재 게임의 `slug`가 필요해서 인터페이스에 `slug` 필드를 추가(초기 상태값 +
`useEffect`의 `setNav(...)` 양쪽 다 갱신). `GameOverlay.tsx`에 `hasLeaderboard(nav.slug)`
조건으로 "🏆 See this week's leaderboard" 텍스트 링크 추가 — `#leaderboard`로
`scrollIntoView({behavior:'smooth'})`. 후원 링크와 달리 `runMilestone` 게이팅을
안 걸었다(반복 요청이 아니라 기능 발견이라 매번 떠도 괜찮다는 판단). 리더보드가
없는 게임(26종)에서는 안 뜬다.

`GameOverlay.test.tsx`에 2건 추가(리더보드 있는 게임=snake에서 첫 판에도 뜨는지,
없는 슬러그에서 안 뜨는지). 전체 검증: typecheck 클린 / lint 0 errors(기존 경고
15개만) / vitest 102 files · **2837 tests** 전부 GREEN / build 성공 / e2e **106**
전부 GREEN. main 직접 커밋·push·`pnpm run deploy` → quickminigames.site 200 확인,
배포된 청크(`4815.*.js`)에 `overlay-leaderboard`/`See this week` 문자열 포함까지
curl로 직접 확인.

**다음 세션 후보(강제 아님, 우선순위 판단은 트래픽 신호 재확인 후):** 이 넛지가
실제로 리더보드 제출 건수를 늘리는지는 `mg_events`/D1 재조회로 며칠 뒤 확인해볼
가치가 있다(현재는 배선만 확인, 효과는 미측정). 그 외엔 위 "다음 세션은 라운드12
바로 돌리지 말고" 순서(신호 재확인 → AdSense 재확인)를 그대로 따를 것.

### ✅ 같은 세션 이어서 — 사이트 내장 커뮤니티 v1(게임별 이모지 리액션) 기획·출시

사용자가 "그래 얼른 커뮤니티 작업하자" → 처음엔 Discord/서브레딧을 제안했으나 사용자가
"우리 홈페이지 자체 커뮤니티를 만들어야해"로 명확히 정정(외부 플랫폼 아님). "완전
진지하다 내 인생 걸었어 여기에"라는 발언에 맞춰 `/office-hours`(YC 오피스아워 스타일
진단)를 Startup 모드로 제대로 돌렸다 — 사용자가 "제대로 밟아보기"를 명시적으로 선택.

**진단에서 나온 핵심(느낌이 아니라 숫자로 확인):** `mg_events`를 직접 쿼리해 지난 30일
실제 방문자(vid) **44명** 중 다른 날 재방문한 사람은 **단 2명(4.5%)** 뿐임을 확인 — 기존
재방문 장치(리더보드·RUN넛지·DailyDock)가 있는데도 참여가 거의 0이라는 게 문제였다.
전역 포럼을 먼저 고르려던 사용자에게 "글 1개로도 페이지가 사는 게임별 댓글 vs 글 없으면
죽은 게시판으로 보이는 전역 포럼" 콜드스타트 리스크를 구체적으로 짚자 바로 정정("다시
생각해보면 게임별 댓글이 맞다"). 최종 3안 비교(A=즉시공개 댓글, B=승인대기열, C=이모지
리액션만)에서 **AdSense 재심사 대기 중이라 모더레이션 없는 자유텍스트 UGC(A)는 지금
감수할 리스크가 아니다**는 근거로 C를 이번 주 먼저 출시하고 반응 보면 A로 확장하는
순서로 합의.

**설계 문서**(`/office-hours` 산출물, 적대적 리뷰 2라운드 거쳐 9/10 통과):
`~/.gstack/projects/Piousangel-minigames-hub/hyunseok-main-design-20260810-154432.md`.
리뷰가 실제로 잡은 문제: Approach C에 D1 스키마가 없었음, 리액션 클릭 어뷰징 방지 규칙이
없었음, 성공 기준(재방문율 비교)에 필요한 vid 귀속 경로가 안 정의됨, 그리고 존재하지
않는 서버 사이드 IP 레이트리미트를 "기존 패턴 재사용"이라고 잘못 주장한 것(코드 확인
결과 `worker/index.ts`엔 IP 캡처 자체가 없었다 — 정직하게 "v1은 클라이언트 dedup만,
서버 방지는 의도적으로 생략"으로 재작성).

**구현(승인 즉시 바로 진행):**
- D1 `reactions` 테이블(slug, emoji, count) — `db/schema.sql`에 추가, `wrangler d1
  execute --remote`로 프로덕션에 직접 적용(기존 `scores` 테이블 무관, idempotent).
- Worker `GET /api/reactions` / `POST /api/reaction` — 리더보드 API와 같은 패턴
  (`worker/index.ts`). 이모지는 서버 사이드 허용목록으로 검증, 슬러그는 `/api/hit`과
  같은 수준의 느슨한 형식 체크(전체 게임 레지스트리를 워커 번들에 안 실음).
- `src/lib/reactions.ts` — 순수 함수(허용 이모지·슬러그 형식 검증) + localStorage
  기반 클라이언트 dedup(`reacted:<slug>:<emoji>`).
- `src/components/Reactions.tsx` — 리더보드 유무와 무관하게 **전 게임 90종 공용**으로
  `GamePageLayout.tsx`에 배선. 클릭 시 낙관적 카운트 증가 + `sendHit(slug, 'reaction')`로
  vid 귀속(나중에 리액션 클릭한 vid vs 안 한 vid 재방문율 비교용) + 서버 반영.
- 계정·로그인 불필요, 자유 텍스트 없음 — UGC 자체가 없어 스팸·모더레이션 리스크 없음.

**검증:** typecheck 클린 / lint 0 errors(기존 경고만) / vitest 103 files · **2848
tests**(신규 8건) GREEN / build 성공 / e2e **107**(신규 1건: 리액션 클릭→카운트 증가→
재클릭 막힘) GREEN. D1 마이그레이션 적용 확인(`sqlite_master`에 `reactions` 테이블
존재) → `pnpm run deploy` → 프로덕션 API 실제 라운드트립 curl 확인(GET→POST→GET,
카운트 1→2로 정상 증가) → 배포된 페이지 청크에 `data-testid="reactions"` / `React
with` 문자열 포함 확인.

**다음 세션 후보(아래 Approach A 조기 출시로 일부 무효화됨, 참고만):** ~~1~2주 후
`mg_events` 재조회로 리액션 클릭 수 > 0인지, 반응 있으면 Approach A로 확장~~ — 사용자가
같은 세션에 바로 Approach A를 요청해 검증 기간을 기다리지 않고 진행함(아래 참고).

### ✅ 같은 세션 이어서 — Approach A(익명 댓글) 검증 기간 없이 바로 출시 + 리액션 재배치

사용자가 "익명으로 댓글정도는 달게 작업하자. 우리는 그 댓글 보고 추후 뭘 도모하던지하지"
지시 — 원래 계획(리액션 반응 보고 댓글 확장 여부 판단)을 뒤집고 바로 진행. 이유:
재방문율 수치 개선이 아니라 **댓글 내용 자체가 정성적 신호**라는 가치축은 원래 성공
기준이 안 담고 있었던 관점 — 그 가치는 데이터 검증을 기다릴 필요가 없다. AdSense
리스크는 같은 세션에서 이미 논의·인지된 상태에서 사용자가 감수하기로 한 결정.

**구현:** D1 `comments`(id, slug, name, text, created_at) + `comment_rate_limits`(ip,
last_at, 신규 — 기존 코드베이스엔 IP 캡처가 아예 없었음) 2개 테이블. 방어선 4개:
허니팟(채워지면 저장 안 하고 성공한 척 응답) · 링크 차단(`http(s)://`/`www.`) · 길이
제한(240자) · IP당 30초 쿨다운. 모더레이션 큐 없이 즉시공개(사용자가 이 트레이드오프를
직접 선택). `GET /api/comments`를 `game` 파라미터 없이 부르면 전 게임 최신 100건 반환 —
관리자 UI는 안 만들고 curl/wrangler d1 직접 조회를 기본 모니터링 방식으로 삼음.

**⚠️ 실제 인코딩 버그 발견:** 제어문자 정규식(0-31, 127 범위 이스케이프)을 파일에
쓰려다가, 툴 호출이 JSON으로 인코딩되는 과정에서 이스케이프가 실제 제어문자 바이트로
조기 디코딩돼 소스에 눈에 안 보이는 원본 바이트가 그대로 박히는 사고가 있었다(`grep`으로
찾아도 안 걸림, `Read`로만 보임). 코드포인트 순회 필터로 재작성해 해소, `Edit`의
old_string도 같은 문제로 매칭이 안 돼 파일 전체를 `Write`로 재작성해야 했다. **교훈: 앞
으로 소스에 `\u00XX`류 제어문자 이스케이프를 쓸 일이 있으면 반드시 직후 `Read`로 실제
바이트를 확인할 것 — 정규식 문자 클래스보다 코드포인트 필터 루프가 이 클래스의 사고를
원천 차단한다.** 커밋 메시지에도 같은 사고가 재발해(bash 명령이 "제어문자 포함" 에러로
거부됨) 프로즈로 풀어 다시 씀.

**리액션 재배치:** 사용자가 "이거 보고 잘 눌를것같지 않은데"라고 지적 — 회색 pill이
NextUp/GameStats/DailyDock 뒤에 묻혀 있었음. 게임 바로 아래(스크롤 없이 보이는 위치)로
옮기고, 네온시안 강조 스타일 + "How was it?" 레이블로 시인성 개선.

**검증:** typecheck 클린 / lint 0 errors(기존 경고만) / vitest 106 files · **2860
tests**(comments.ts 7건 + Comments.tsx 3건 신규) GREEN / build 성공 / e2e **108**(신규
1건) GREEN. D1 마이그레이션 적용 확인(`comments`/`comment_rate_limits` 테이블 존재) →
`pnpm run deploy` → 프로덕션에서 4개 방어선 전부 curl로 실검증(정상 게시 → GET 반영,
동일 IP 즉시 재작성 → 429, 링크 포함 → 400 거부, 허니팟 채움 → 저장 안 되고 성공
응답만), 전 게임 글로벌 피드(`/api/comments`, game 파라미터 없이)도 확인. 테스트용
댓글(name=shiptest)은 D1에서 직접 삭제해 라이브 정리 완료 — 리더보드 테스트 점수와
달리 댓글엔 자연 순환(주간 리셋 등)이 없어서 그대로 두면 안 됐음.

설계 문서 addendum:
`~/.gstack/projects/Piousangel-minigames-hub/hyunseok-main-design-20260810-154432.md`

**다음 세션 후보:** 실제로 댓글이 달리기 시작하는지 며칠~1-2주 지켜볼 것(현재는 배선만
확인). 스팸이 뚫리는 패턴이 보이면 방어선 강화(금칙어 목록, Cloudflare Bot Fight Mode
등) 검토. 설계 문서의 "The Assignment"(실제 사람 관찰)는 여전히 유효.

### ✅ 같은 세션 이어서 — 사용자가 "리뷰돌려봐라" 요청 → `/review`가 실버그 2건 잡음

이 레포는 PR 없이 `main`에 직접 커밋하는 구조라, `/review`가 표준으로 하는
base-branch diff(`origin/main` vs `HEAD`)는 항상 비어 있다(이미 다 push했으므로).
그래서 이번 세션의 실제 작업 범위(`dd5d364`, 지난 세션 종료 커밋, ~HEAD, 21개
파일·1132줄)를 기준선으로 잡고 리뷰했다 — 스킬을 문자 그대로 안 따르고 의도에
맞게 조정한 것, 다음에 `/review`를 쓸 때도 이 패턴을 참고할 것.

**Testing·Maintainability·Security·API Contract 4개 스페셜리스트 + Claude 적대적
리뷰 1개, 병렬 디스패치(Codex는 이 환경에 미설치라 스킵).** 실제로 잡은 것:

1. **[실버그, 지금 라이브로 뚫려 있었음] 링크 차단이 댓글 본문만 검사하고 이름
   필드는 검사 안 함** — 이름 필드 최대 16자면 짧은 링크 하나 넣기 충분해서,
   `{"name":"http://spam.co","text":"..."}`로 스팸 방어 전체가 통째로 우회됐다.
   Claude 적대적 리뷰가 발견(스페셜리스트들은 못 잡음) — 즉시 수정해 name·text
   둘 다 검사하게 고침.
2. **[실버그] 레이트리밋이 SELECT-then-INSERT라 경쟁 상태(TOCTOU)** — Testing
   스페셜리스트와 Claude 적대적 리뷰 둘 다 독립적으로 발견(MULTI-SPECIALIST
   CONFIRMED). 같은 IP에서 동시에 두 요청이 오면 둘 다 같은 stale `last_at`을
   읽고 둘 다 통과할 수 있었음. `INSERT ... ON CONFLICT DO UPDATE ... WHERE
   excluded.last_at - last_at >= ?` 원자적 UPSERT 하나로 교체(D1 SELECT 왕복
   자체를 없앰) — **코드에 넣기 전에 실제 프로덕션 D1에 직접 3연속 호출(성공→
   차단→통과)로 동작을 검증**하고서야 배포함(1000ms/6000ms/36000ms 타임스탬프로
   changes=1/0/1 확인).
3. **[실버그, 검증됨] `cleanCommentText`가 UTF-16 code unit 단위로 잘라서, 이모지가
   240자 경계에 딱 걸리면 서로게이트 페어가 반토막나 깨진 문자가 저장될 수 있었음**
   — Testing 스페셜리스트가 실제로 함수를 돌려서 재현·검증. 코드포인트 단위 슬라이스로
   수정.
4. **부수적으로 발견: Aim Trainer `SCORE_SCALE` 변경(이전 세션)에 백필이 없어서,
   그 전에 제출된 점수는 이제 10으로 나눠져 잘못 표시됨.** D1 직접 조회로 실제로
   `shiptest` 테스트 점수(score=1) 하나가 이 상태였음을 확인 → 삭제(실 유저 영향
   없음, 리더보드 자체가 이번 세션에 처음 등록됐으므로 그 전 실유저 데이터가
   있을 수 없었음).
5. **마이너 정리 5건**(전부 기계적, 자율로 고침): worker의 POST 핸들러 3곳에
   중복돼 있던 JSON 파싱 try/catch를 `parseJsonBody` 헬퍼로 통일 · `/api/reactions`·
   `/api/reaction`이 `isValidReactionSlug`(별칭)를, `/api/comments`가
   `isValidGameSlug`(원본)를 따로 써서 같은 검증을 다른 이름으로 부르던 것 통일 ·
   `Comments.tsx`가 `Reactions.tsx`엔 있던 stale-response race 가드(`cancelled`
   플래그)가 빠져 있던 것 추가 · 댓글 API 응답이 game 파라미터 유무에 따라
   `slug` 필드 있고 없고가 갈렸던 것 통일(항상 포함) · 허니팟 판정을 워커 인라인
   로직에서 순수 함수로 분리해 테스트 가능하게 함 · `src/lib/slug.ts`(리액션·댓글이
   공유하는 슬러그 검증기)에 전용 테스트 파일이 없던 것 추가.

**사용자에게 물어보고 그대로 두기로 한 것 2건**(design/product 판단, 자율로 안 바꿈):
링크 차단 정규식이 `http(s)://`/`www.`만 잡고 맨도메인(`bit.ly/x` 등)은 못 잡는 것,
리액션 엔드포인트에 서버 사이드 레이트리밋이 전혀 없는 것(D1 일일 쓰기 할당량
공유라는 새 리스크 각도를 적대적 리뷰가 짚었지만, 하루 5~10명 트래픽에선 아직
이론적). 둘 다 TODOS.md에 P3로 기록, 스팸이 실제로 뚫리면 재검토.

**검증:** typecheck 클린 / lint 0 errors(기존 경고만) / vitest 107 files ·
**2866 tests**(신규 10건: comments.ts 서로게이트 경계·honeypot 케이스, slug.ts
전용 테스트, Comments.tsx 링크 에러 메시지) GREEN / build 성공 / e2e 108 GREEN.
`pnpm run deploy` → 프로덕션에서 두 실버그 수정 모두 curl로 재현·확인(이름 필드
링크 차단 확인, 레이트리밋 429 확인 — 첫 시도는 배포 직후 엣지 전파 지연으로
구버전이 응답해 재현 실패했다가 재시도로 확인, 기존에 반복 관찰된 패턴).

### ⚠️ 같은 세션 이어서 — AdSense "찾을 수 없음"(2026-07-24) 스크린샷 확인 → 지금은 재현 안 됨

사용자가 애드센스 대시보드 "사이트" 페이지 스크린샷을 공유 — quickminigames.site 행이
상태 "준비 중" / "찾을 수 없음", 날짜 2026-07-24 오전 9:30 KST로 떠 있었다(그동안
"07-23 거절 메일, 세부 사유는 대시보드에서만 확인 가능·에이전트 접근 불가"로만 알고
있던 것의 실제 사유가 처음 드러남).

**즉시 라이브 진단(전부 지금 통과):**
- `robots.txt` — 전체 허용(`Allow: /`), sitemap 정상.
- `ads.txt` — `google.com, pub-9363381710674627, DIRECT, f08c47fec0942fa0`, 퍼블리셔 ID
  정확히 일치.
- 홈페이지 `curl -A "Mediapartners-Google"`·`curl -A "Googlebot"` 둘 다 200, 차단·챌린지
  없음(Cloudflare Bot Fight Mode는 애초에 켠 적 없음 — 이게 원인도 아님).
- 2026-08-05에 발견된 Vercel 레거시 연동 문제(같은 GitHub repo에 남아있던 Vercel
  프로젝트가 push마다 빌드 실패)는 실배포(Cloudflare Workers 커스텀 도메인)와
  무관하다고 그때 이미 결론 남 — 이것도 원인 아님.

**결론: "찾을 수 없음"은 7/24 그 시점의 스냅샷이고, 지금 다시 크롤링하면 통과할
상태다.** 정확한 원인(그 시점에 커스텀 도메인 DNS가 아직 전파 중이었는지, 일시적
Workers 배포 공백이 있었는지)은 로그가 없어 특정 불가 — 다만 지금 재현이 전혀 안 되는
건 명확히 확인했다.

**다음 액션은 사용자 몫:** 애드센스는 "찾을 수 없음"으로 한 번 찍힌 사이트를 자동
재크롤링하지 않는다 — 대시보드에서 직접 재확인/재제출해야 한다(에이전트는 대시보드
로그인 필요한 계정 액션이라 접근 불가). 재제출 시점 이후 다시 거절 메일이 오면 그때
세부 사유를 다시 확인할 것.

### ✅ 같은 세션 이어서 — "다음작업 고고고고고" 지시 → DOMAIN.md P3(온보딩) 잔여 항목 종결

TODOS.md의 남은 항목이 전부 사람 판단·시간 대기 필요라 자율로 더 못 미는 상태였음 →
DOMAIN.md 로드맵에서 다음으로 안전하게 진행 가능한 항목을 찾았다: **P3 온보딩의
잔여 조작 글리프**(방향키·탭 등 언어독립 아이콘). 겸사겸사 P6(분석 계측) 메모가
"play/finish 이벤트 게임별 배선 필요"라고 낡게 남아있던 것도 발견해 정정(이번
세션 초반 GameStats 롤아웃으로 이미 끝나 있었음, `recordResult()`가 `sendHit`도
같이 부름).

**구현:** `registry.ts`의 89종 `howToPlay` 원문(이미 정확한 게임별 조작 설명)을
근거로 `ControlScheme`(arrows/tap/type/drag/point) 분류 — 애매했던 카드류(솔리테어/
프리셀/스파이더/피라미드/트라이피크스/골프/유콘/마작)는 실제 컴포넌트에
`onDragStart`가 없고 전부 `onClick`인 걸 grep으로 확인해 drag가 아니라 tap으로
정정. `gameMeta.ts`에 89종 전부 배선.

**원래 DOMAIN.md 구상("seen:<slug> 게이팅 Start 카드")은 스코프를 줄여서
대체함** — 89개 게임 컴포넌트 전부가 지금 마운트 즉시 보드를 그리는데, 그 앞에
블로킹 카드를 끼워 넣으려면 컴포넌트마다 리팩터가 필요하고 `page.goto()` 직후
보드 visible을 기대하는 기존 e2e 테스트 다수가 깨질 위험이 컸다. 대신 이미 검증된
패턴(ObjectiveBanner, 상시 노출·비블로킹)에 같은 줄로 글리프를 얹는 저위험 방식으로
갔다 — 별도 localStorage 상태도 불필요해짐.

**⚠️ 브라우저 스크린샷 검증에서 실제 렌더링 버그 발견:** 로컬 정적 서버(`serve
out`)를 띄우고 Chrome으로 직접 스크린샷 찍어 확인하는 중, `point` 스킴에 쓰려던
🖱️(마우스 이모지)가 이 환경 폰트에서 빈 흰 상자로 깨지는 걸 발견(Breakout/Pong/
BubbleShooter 등 마우스 추적형 게임에 쓰던 아이콘). 급하게 로컬 HTML로 이모지
후보 여러 개를 렌더 테스트했는데 처음엔 전부 깨진 것처럼 보여서 당황했다가,
원인이 테스트 페이지 자체에 `<meta charset="utf-8">`이 없어서 브라우저가
잘못 디코딩한 것뿐이었음을 파악(파일의 실제 바이트는 올바른 UTF-8이었음, Python
`http.server`가 charset 없는 Content-Type을 보낸 탓) — 메타 태그 추가 후 재검증하니
🖱️만 진짜로 깨지고 나머지(👆·✋·⌨️)는 멀쩡했다. `point`는 기존 화살표 글리프와
같은 계열의 플레인 유니코드 `↔`로 교체해 폰트 의존성을 없앴다. **교훈: 이모지
렌더링을 스크래치 HTML로 검증할 땐 charset 메타 태그부터 넣을 것 — 안 그러면
가짜 "다 깨짐" 신호에 낚인다.**

**검증:** typecheck 클린 / lint 0 errors(기존 경고만) / vitest 108 files ·
**2869 tests**(신규 3건: ObjectiveBanner 컴포넌트 테스트) GREEN / build 성공 /
e2e 109 GREEN. `pnpm run deploy` → 프로덕션에서 Snake(arrows만)·Breakout(point+arrows
조합)·Typing Test(type)·Word Search(drag) 4개 슬러그 curl로 직접 확인, `↔` 글리프
정상 렌더 확인. 배포 직후 `/snake` 첫 조회가 엣지 캐시 스테일로 글리프 없이
응답했다가 재시도로 확인 — 이번 세션에 계속 나온 패턴 그대로.

## 2026-08-05 세션 — 아이콘 갭 11종 정리 + Vercel 레거시 연동 발견

"계속진행"(방향 안 묻고 백로그에서 자율로 다음 작업 진행하라는 스탠딩 지시) → TODOS.md P3 항목(Beatline/
Skew/Turntile 아이콘) 착수. 실제 슬러그 대조해보니 스코프가 3종이 아니라 **11종**이었다
(flow/unblock/yahtzee/mancala/battleship/kakuro/pyramid/tripeaks도 이전 세션부터
`GameIcon.tsx`에 없어 제네릭 조이스틱 폴백 중이었음 — 회귀는 아니고 그냥 안 채워져 있던
갭). 같은 파일·같은 패턴이라 한 번에 11개 다 그림(24×24 line-art, soft/softer/solid
fill 프리셋 기존 컨벤션 준수). 브라우저(Chrome MCP)로 홈 카드 11개 전부 줌인 확인 →
typecheck/test/build 통과 → 커밋·push·`pnpm run deploy`. 결과적으로 **87종 전체가 커스텀
아이콘을 갖게 됨**(레포 슬러그 수와 아이콘 수가 정확히 일치 — `GameIcon.tsx` 상단 주석의
"22개 게임" 문구는 이제 낡았으니 다음에 만지는 사람이 갱신할 것).

**⚠️ Vercel 레거시 연동 발견(라운드10 `/land-and-deploy` 중):** 이 GitHub repo에 Vercel
프로젝트가 여전히 연결돼 있어 `main` push마다 자동 빌드를 시도하다 실패한다(사용자가
스크린샷으로 알려줌). 클린 클론에서 동일 커밋을 재빌드하면 성공 — 즉 코드 문제가 아니라
Vercel 환경에만 특유한 문제(README.md에 남아있던 "Next.js SSG + Vercel"이 원인 —
마이그레이션 전 잔재, CLAUDE.md엔 Vercel 언급 자체가 없음). **실제 배포(Cloudflare
Workers)와 무관, 무해함.** README.md는 정정함(Cloudflare Workers로). Vercel 프로젝트
자체 연동 해제는 사용자가 대시보드에서 직접 해야 함(계정 접근 필요) — 아직 안 했다면
이후 세션에서도 push마다 실패 알림이 계속 뜰 수 있으나 **완전히 무시해도 된다.**

## 2026-08-04 세션 — 게임 라운드10 (Beatline·Skew·Turntile) + UI/UX 감사 상위 5건

사용자가 "팀 회의 거쳐서 신규 게임 개발" 요청 → `minigames-round` 워크플로우 실행(20 에이전트).
**돌리기 전 `EXISTING` 상수를 최근 6종(flow/unblock/yahtzee/mancala/battleship/kakuro) 반영해
갱신함** — 이전 세션까지 누락돼 있었다(재탕 방지). `/ship`으로 13개 커밋 + PR #1 생성 → 리뷰에서
실버그 5건 추가 발견·수정(아래) → `/land-and-deploy`로 머지.

⚠️ **머지 중 발견: 로컬 `main`이 2026-07-23부터 24개 커밋을 GitHub에 push 안 하고 있었다**(이번
세션 이전부터 있던 상황 — 과거 세션들이 로컬 커밋만 하고 push를 빠뜨려 온 것으로 보임). GitHub의
`main`은 그만큼 오래된 지점에 머물러 있었고, PR #1은 그 오래된 지점 위에 squash됐다. 배포는
git과 무관하게 로컬에서 직접 하는 구조(`pnpm run deploy`)라 실서비스엔 문제없었지만, 저장소
자체가 크게 뒤처져 있었다. `git merge origin/main`으로 두 이력을 합치며 6개 파일 충돌(전부
"같은 게임을 다른 경로로 이미 추가함" 유형 — 실제 로직 충돌 아님) 해결 후 push.
**교훈: 세션 끝에 `git push`를 빠뜨리지 않았는지 확인할 것 — `git status`가 clean이어도 로컬이
origin보다 앞서 있을 수 있다.**

**신규 게임 3종 — 전부 배선·검증 완료(로컬):**
- **Beatline**(🎧 Skill, featured) — 4레인 리듬게임. D/F/J/K로 판정선 노트를 침, Perfect/Good
  판정, 5스테이지, 라이프. 엔진 33 테스트.
- **Skew**(📐 Puzzle) — 스와이프 대신 보드 전체를 좌/우로 "기울여서"(shear) 대각선 매치.
  6×8, 5색, 무효수 없음(매 tilt가 항상 보드를 바꿈), 30틸트 예산. 엔진 31 테스트.
- **Turntile**(🔄 Puzzle) — 2×2 블록을 뒤집으면 점대칭 재배치+뒷면 공개, 4칸 같은 무늬면 잠김.
  뒤집기가 자기 역원(=언두 불필요). 엔진 25 테스트.
- 게임 **83 → 86종**. 배선 6곳(registry/GameRenderer/gameMeta/e2e/leaderboard/objectives) 전부
  오케스트레이터가 직접(에이전트는 자기 파일 3개만). `pnpm build`(210 라우트) + 유닛 2717 +
  e2e 103 전부 GREEN.

**빌드 에이전트 산출물에서 실버그 2건 발견·수정(브라우저 실검증으로만 잡힘 — testid만 봤으면 놓쳤다):**
1. **Beatline 한국어 UI 문자열** — 빌드 에이전트가 hint 3개 + GameOverlay title 2개를 한국어로
   작성(`'완주! 오늘의 곡 클리어'` 등). 사이트는 전역 영어(글로벌 검색 트래픽 모델) — 스크린샷으로
   실제 렌더링을 봐서야 발견. 6곳 전부 영어로 교체. **교훈: 신규 게임 컴포넌트는 브라우저로 열어
   텍스트를 직접 읽을 것 — grep이나 testid 통과로는 안 잡힌다.**
2. **Mahjong 반응형 스케일링(감사 #5) 첫 구현이 동작 안 함** — `useLayoutEffect(..., [])`로
   ResizeObserver를 붙였는데, 마운트 첫 렌더는 로딩 스켈레톤(다른 DOM, ref 없음)이라 `el`이
   `null`이라 옵저버가 아예 안 붙음. Game2048의 검증된 패턴(`[state !== null]` 의존성)으로 고침.
   **추가로 패딩 버그도 발견**: `el.clientWidth`가 `p-2`(16px) 패딩을 포함해서 스케일이
   16px만큼 과대산정 → 가로 오버플로 발생. `(el.clientWidth - 16) / BOARD_W`로 수정.
   ⚠️ **자동화 브라우저 탭은 backgrounded 상태면 `ResizeObserver`가 paint-throttle로 안 돈다**
   (`document.hidden===true`). 검증하려면 스크린샷(강제 paint) 이후 DOM을 다시 읽을 것.

**UI/UX 감사(5차원, 11건 → 상위 5건) — 전부 구현·로컬 검증 완료:**
- **#1 Flow 리더보드 미등록** — `leaderboard.ts`에 `flow: { label: 'Level' }` 1줄 추가.
- **#2 objectives.ts 6종 누락**(flow/unblock/yahtzee/mancala/battleship/kakuro, registry엔
  있으나 목표 배너가 안 뜸) — 6줄 추가. 신규 3종도 같이 추가.
- **#3 Ricochet/Stackpot/Quarry에 day-streak 신설** — `dailyStreak.ts` 헬퍼 재사용(Overfold
  패턴). ⚠️ **Quarry엔 이미 `streak`(런 내 콤보, `data-testid="streak"`)가 있어 이름 충돌** —
  새 변수는 `dayStreak`/`data-testid="day-streak"`로 분리. 완료 시점: Quarry는 `status==='lost'`
  (데일리 런 종료), Ricochet은 `outcome.state.over`, Stackpot은 `state.over` 이펙트.
- **#4 패션스 4종(Spider/FreeCell/Yukon/Solitaire) 수동 "No moves left" 버튼** — 자동 막힘
  감지는 오탐 위험 커서 배제(감사가 명시적으로 금지), 대신 버튼 클릭 시
  `GameOverlay variant="lose"` 발동 → 사이트 핵심 리텐션 넛지("Next: {game}")가 처음으로
  이 4종에서도 발동. `recordResult(slug,{won:false})`로 첫 패배 기록도 남김.
- **#5 Mahjong 모바일 반응형** — `ResizeObserver` + `transform:scale()`로 보드 전체 축소
  (좌표계·클릭핸들러 불변, Game2048 패턴). 버그 2건은 위 참고.
- **하지 말 것 목록(감사가 명시, 착수 안 함)**: daily 모드 토글 라벨 15종 전면 통일, 카드류
  8종 FLIP 애니메이션, Score float 8종 일괄추가(polish, 가치 낮음), Reversi/Mancala
  Losses 노출 + Chess Losses 신설(범위 혼재), 자동 막힘감지(오탐 위험).

**검증(전부 로컬 실행, 라이브 미배포):**
```
pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build && pnpm e2e
```
typecheck 클린 / lint 0 에러(경고 15개 전부 기존) / 유닛 2717 통과(gameStats.test.ts의
`ERR_INVALID_URL /api/hit` 4건은 기존 jsdom 이슈, 회귀 아님 — §"기존 테스트 인프라 이슈" 참고) /
build 210라우트 성공 / e2e 103 통과. 브라우저(Chrome MCP)로 Beatline/Skew/Turntile 렌더,
Spider "No moves left"→lose 오버레이→"Next" 넛지, Mahjong 375px/300px 스케일+탭 히트테스트
전부 직접 확인.

**`/ship` 프리랜딩 리뷰에서 추가로 실버그 5건 더 발견·수정**(체크리스트+4 스페셜리스트+레드팀):
Beatline/Turntile이 `daily:true` 누락으로 `/daily`·홈 필터에서 안 보였음(daily 노출 경로 회귀
클래스, 기존 e2e 테스트가 정확히 이 케이스를 잡아냄), "No moves left"→Undo→재클릭으로 패배
기록 중복 가능(일반 플레이로도 도달 가능), Turntile 보드가 좁은 화면에서 오버플로(폴백 없음),
Turntile 터치타깃 36→44px, `beatline`의 `featured:true`가 홈 고정 리스트(`FeaturedGames.tsx`)에
누락(과거 동일 버그 재발). 전부 커밋·검증 완료. `TODOS.md` 신설(jsdom+RTL 검토 P2, 커스텀
아이콘 3종 P3). 최종 13개 커밋 → PR #1 → `/land-and-deploy`로 머지.

## 2026-07-23 세션 — 품질 우선 전환 + Jigsaw 정비 + 신규 2종 (Flow·Unblock)
전부 커밋·배포·**브라우저 실플레이 검증**됨. 게임 **79종**(라이브 `/flow` `/unblock` 200).

**🔑 새 표준(CEO 지시, 메모리 [[quality-first-playtest-critique]]):** 게임은 "테스트 통과"가
아니라 **"실제로 플레이해서 재밌는가"**로 출시 판단. 빌드 에이전트 스펙에 **셀프 플레이테스트+
UX 크리틱** 단계를 필수로 넣고, 오케스트레이터가 **브라우저에서 직접 플레이**해 검증한다.
testid만 보고 통과 처리 금지. 이번 세션 3건 모두 이 방식으로 스크린샷 검증까지 마침.

- **Jigsaw 전면 정비**(사용자가 "이 퀄리티면 누가 와도 안 한다"고 지목): `artworkFor`를
  랜덤 blob → **알아볼 수 있는 네온 씬 6종**(sunset/mountains/orbit/city/bokeh/burst)으로
  재작성 + **그림 가이드 항상 표시**(조각이 그림을 채워가는 "맞는 느낌") + 홈 셀 앰버 발광 +
  놓을 때 스냅 펄스 + 유리타일 엣지 + 헷갈리던 Score/Best → **Solved/Best**. 엔진 37 통과.
- **Flow**(🔗 Puzzle, Flow Free식): 같은 색 점을 파이프로 잇고 격자를 꽉 채움. 손가락 추종
  드래그(탭이 파이프 안 자름·스냅백 리트랙트), 항상 보이는 엔드포인트, 커버리지%, 지우개.
  **엄선 레벨 26종**(5×5~7×7, 전부 solver로 solvable 증명). 엔진 35 통과. `flow/`.
- **Unblock**(🚗 Puzzle, Rush Hour식): 블록을 축 방향으로 밀어 빨간 블록을 우측 출구로.
  출구 레인+화살표로 목표 명확, par 달성 시 "Optimal!" 인식. **BFS 검증 레벨 27종**(par 2→25).
  엔진 47 통과. `unblock/`.
- 배선: registry(유니온+SEO)·GameRenderer(dynamic+switch)·gameMeta·**FeaturedGames 레일**에
  flow/unblock 추가(featured). 둘 다 `best:<slug>`에 숫자 저장(리더보드 안전).

**전 게임(79종) 시각 품질 감사 + Sokoban 네온 정비:** 팀 판단으로 "저품질 게임 찾아 고치기"
라운드를 돌림. `out/`를 serve 후 79종 초기화면을 스크린샷 → 컨택트 시트로 전수 스캔.
- **결론: Jigsaw급 결함은 더 없다.** 클래식·카드 7종·워드·신규 전부 폴리시 양호.
- ⚠️ **감사 자체 함정 기록:** 스크린샷을 높이 클립(y 90~560)하니 추상 게임(quarry/sonar/fuse)이
  "빈 화면"처럼 보였는데, **전체 높이로 다시 찍으니 보드 아래 how-to 힌트가 멀쩡히 있었다**.
  DO-5의 "빈 캔버스=고장" 오판을 반복할 뻔함 → **가짜 수정 금지, 없는 문제 만들지 말 것.**
- **진짜 갭 1건만 수정:** Sokoban이 이모지(🧱🙂📦🎯)로 렌더돼 유일하게 off-brand·placeholder
  느낌. **네온 타일로 교체**(발광 시안 오브=플레이어, 앰버 네온 크레이트, 타깃 앰버 링,
  베벨 네온 월; 타깃 안착 시 녹색 잠금+pop). 엔진 무변경(순수 로직), 렌더층만. 라이브 검증됨.

**전환 레인 착수 — 히어로 "▶ PLAY NOW" CTA:** 신규 방문자 관점(빈 localStorage)으로 홈을
캡처해 보니, **모바일 히어로가 첫 화면을 꽉 채우고 첫 플레이 게임(Featured)이 fold 아래**라
"PLAY INSTANTLY"를 내걸면서 즉시 플레이 버튼이 없었다. → 히어로에 1차 CTA 추가
(`HeroPlayButton.tsx`, 클라이언트). 클릭 시 엄선(graspable) 10종 중 랜덤 진입(활성화 최대화),
JS 없으면 href=solitaire로 동작(점진적 향상). Math.random은 클릭 핸들러에서만. 라이브 검증됨.
- **다음 전환/체류 후보**: (a) 데스크톱 히어로도 게임을 fold 위로, (b) 홈 빈 섹션(신규 유저에
  MyGames/Recent/Goals 비어있음) 자리에 "이런 걸 해보세요" 유도, (c) 첫 게임 진입 시 30초
  온보딩 카드(objective+조작 글리프, 도메인 P3), (d) Featured 순서 A/B(데이터 붙으면).

## 2026-08-03 세션 — 재심사 계속 대기(quickminigames 무소식·미결) → 내부링크 SEO
- **AdSense 재심사 여전히 미결**: Gmail 기준 quickminigames.site 앞 새 메일 없음(7/24 재신청 후
  10일째). 최근 AdSense 메일은 fibercalc.site 건(별도 프로젝트, 8/2 저품질 거부). 계속 대기.
- **고아 게임 33종 컬렉션 편입(내부링크 SEO, 리뷰-안전)**: 어느 컬렉션에도 없던 게임들을 홈 처리.
  신규 컬렉션 `original-games`(오리지널 네온 27종, 홈 차별점과 일치, 고유 intro+FAQ) + 클래식 6종을
  기존 컬렉션에 배치. 고아 0, 컬렉션 14종. 전 게임이 게임페이지 "ALSO IN" 백링크 보유.

## 2026-07-29 세션 — 재심사 대기 중 안전·고확신 개선 (breadth 포화 → 품질·리텐션)
- **신규 게임 Kakuro(➕)** — 크로스섬 로직. solver로 16 퍼즐 유니크 해 증명(121 테스트), SVG 분할
  클루 셀, run 하이라이트·콤보 보조·사용숫자 딤. best:<slug>=풀이수(plain number), 시간은 별도 키.
  logic-games/brain-games 편입. 게임 **83종**. 리뷰-안전 검색 랜딩.
- **PWA 아이콘 세트 통일**: apple-icon도 🕹️ → 공유 네온 로고. favicon·PWA 192/512·apple 전부 동일.
- **AdSense 재심사 진행 중** — 대시보드 "준비 중"(저품질 플래그 걷힘), Gmail에 7/24 이후 새 거부
  메일 없음. 미결·대기. 새 거부 오면 대응.
- **건강 스윕**: 유닛 2501 통과·타입체크·프로덕션 200, 7종 추가 회귀 없음.
- **lint 정상화**: `eslint.config.mjs` ignores에 `out/**` 추가 — `pnpm lint`가 export 산출물
  스캔해 12에러+4992경고로 항상 실패하던 것 해소(이제 소스만, 에러 0). pre-merge 훅 복구.
- **Featured 레일 수정**: yahtzee·mancala·battleship이 gameMeta엔 featured였으나 FeaturedGames
  고정 리스트에 빠져 홈 첫인상에 안 떴음 → 추가.
- **PWA 설치 아이콘**: manifest에 192·512 PNG(any+maskable) 추가(`src/app/icons/pwa-192|512/route.tsx`
  + `_logo.tsx`, force-static ImageResponse) + _headers image/png → Android/Chrome "홈 화면에 추가"
  기준 충족(재방문 레버). ⚠️ Satori는 CSS-보더 삼각형을 사각형으로 렌더 → 재생 아이콘은 **SVG
  polygon** 써야 함(pwa 아이콘·favicon 둘 다 교정). ⚠️ 신규 /icons 경로는 배포 직후 엣지캐시 404,
  캐시버스터로 확인.

**신규 게임 Battleship(🚢, 실제 hunt/target AI):** 재심사 대기 중 리뷰-안전한 가족친화 검색
랜딩. "battleship online" 대량 검색, 없던 추격/추론 장르. 확률밀도 hunt/target AI 3단(easy 96.7
vs hard 43.6 shots로 추격 입증), 자동배치 기본. 순수 엔진 44 테스트, 브라우저 실플레이 검증.
고유 intro + family-games 편입. W/L 저장, featured·Classic. 게임 82종.

**🔴 AdSense "가치가 별로 없는 콘텐츠"(low value content) 거부 대응 (2026-07-24):**
AdSense가 사이트를 검토 후 거부(사유: 가치 낮은 콘텐츠). ads.txt는 승인됨. 신생·무트래픽
미니게임 허브의 흔한 거부 — 콘텐츠만으로 100% 해결 안 됨(연령·트래픽도 반영), 재심사 여러 번
가능. **사용자 결정: 지금 재심사 + 병행 콘텐츠 강화.** 재심사 클릭은 사용자 몫(대시보드→사이트).
- ✅ **홈 편집 콘텐츠**(`HomeAbout.tsx`, ~450단어 + 카테고리 내부링크) — 심사자 착지 페이지에
  실질 콘텐츠가 사실상 0이었던 걸 메움. 차별점=직접 만든 오리지널 게임.
- ✅ **Contact 보강**(89→실질).
- ✅ **전 게임(81종) "About this game" 고유 intro 완성**(`gameIntros.ts` 맵 + GamePageLayout 렌더).
  각 게임에 실제 규칙·전략·역사 기반 ≈150~220단어 고유 산문(템플릿/필러 아님). 3 병렬 에이전트
  초안 → 리뷰·병합. 이제 색인 페이지가 board+템플릿 위에 편집 가치를 갖는다.
- ✅ **leaderboards 허브**도 실질 콘텐츠(작동 설명 2문단 + FAQ 4항목) 보강. daily/unblocked·
  category·collections는 이미 intro/FAQ 보유. 이제 모든 색인 페이지 유형이 실질 콘텐츠 갖춤.
- ⏳ **재심사 신청 완료(2026-07-24), 결과 최소 이틀.** 통과면 광고 켜기(§7.2 순서: 슬롯 ID 교체
  먼저 → adsenseEnabled true). 재거부면 사유 확인 후 콘텐츠 더 깊이거나 트래픽(커뮤니티 게시=
  사용자 몫) 붙은 뒤 재도전 — 신생 사이트는 후자가 결정적일 때 많음.

**전환 funnel 실측 + SEO 컬렉션:** 전환 레인을 더 팠는데, 실측 결과 funnel은 이미 건강했다.
- 데스크톱 히어로: PLAY NOW CTA가 fold 중앙에 있어 OK(재구조 불필요).
- 게임 페이지 board 아래 "거대한 공백"으로 보였던 건 **또 fullPage 스크린샷 아티팩트** —
  SEO 섹션이 `<Reveal>`(스크롤 인터섹션)로 감싸여 스크롤 전엔 opacity:0. 실제 스크롤하면
  How to play/Strategy/FAQ 정상 표시(opacity 1). **세 번째 같은 교훈 — 정적 스샷 불신, 상호작용 검증.**
- 전환이 solid하니 실제 병목(트래픽)에서 움직일 수 있는 SEO 레버로: **신규 Flow·Unblock이
  어느 컬렉션에도 없어 내부링크 고아**였고, 대용량 검색어 "brain games" 미커버였다.
  → (a) logic-games에 flow·unblock 추가, (b) **신규 컬렉션 `brain-games`**(고유 intro 200+단어
  + FAQ, 멤버 8종, flow·unblock 포함). 이제 두 신규 게임이 게임페이지 "ALSO IN"으로 역링크됨.
  컬렉션 12종, 게임페이지 192개. collections.test 70 통과. 라이브 검증됨.

**신규 게임 Yahtzee(🎲) — 검색 트래픽 겨냥한 랜딩:** 기술/온페이지 SEO가 이미 성숙
(게임페이지 VideoGame/FAQPage/Breadcrumb, 컬렉션 스키마 완비)이라, 트래픽 레버 중 남은 건
"랭크 못 하는 고검색어에 랜딩 만들기". **주사위 게임이 전무**했고 "yahtzee online free"는
대량 검색·즉시친숙·무에셋·가족친화(AdSense 안전). 품질 우선 프로세스로 빌드(에이전트
셀프 플레이테스트 + **잠재점수 프리뷰** 필수) → 배선 → **브라우저 실플레이 검증**
(굴림·홀드 라임 배지·리롤·프리뷰 갱신·13턴). 엔진 60 테스트, 게임 80종.
- best:<slug>에 총점 plain number 저장 → **리더보드 편입**(주간 경쟁=재방문). featured·Classic.
- ⚠️ 배포 직후 /yahtzee가 status 200인데 title이 404였음 = **엣지 캐시 stale 404**(알려진 현상,
  §4). out/yahtzee.html·sitemap 정상이면 배포는 옳은 것 — 캐시버스터 쿼리로 fresh 확인하고 폴링.

**신규 게임 Mancala(🪙) + family-games 컬렉션:** 검색 랜딩 레버 계속 — "mancala online"은
견실한 검색, 우리 검증된 "보드게임 vs CPU" 패턴(chess/checkers/reversi)에 그대로 맞고
데이터·에셋 의존 없음. 품질 우선 빌드(에이전트 셀프 플레이테스트 + **실제 alpha-beta 미니맥스
AI** 2/5/8 plies)로 Kalah 규칙 구현. 배선 → **브라우저 실플레이 검증**(씨뿌리기·추가턴 발동
·소유/방향 명확·AI 응답). 엔진 47 테스트. 게임 81종.
- W/L/D 기록 저장(체커/리버시 패턴, 리더보드 아님). featured·Classic. "You's turn"→"Your turn" 폴리시.
- **컬렉션 정비**: mancala를 two-player-games에 편입 + 신규 **family-games**(yahtzee+mancala+
  dominoes+connect-four+checkers+chess+gomoku, "family games online" 타깃) → 지금까지 고아였던
  Yahtzee·Mancala가 게임페이지 "ALSO IN" 역링크 획득. 컬렉션 13종, collections.test 76 통과.

### ⚠️ 기존 테스트 인프라 이슈 (내 변경과 무관, 클린 main에도 존재)
`pnpm test`가 유닛 **2338개 전부 통과**하지만 **4개 unhandled error**로 종료코드 비0:
`ERR_INVALID_URL: /api/hit`. `src/lib/hit.ts`의 분석 비콘이 **jsdom에서 상대 URL**을 못 풀어
나는 것(실 브라우저는 정상). 스태시로 확인 — 내 3건 추가 전 main에서도 동일 4에러 발생.
**회귀 아님.** 고치려면 hit.ts 비콘을 테스트 env에서 no-op 하거나 절대 URL 가드(별건 작업).



## 2026-07-18~19 자율 마라톤 세션 요약 ("묻지 말고 계속 디벨롭" + "팀으로 도메인 최고 사이트")
전부 커밋·배포·검증됨. 게임 **61종**. **먼저 [DOMAIN.md](./DOMAIN.md) 읽을 것** — 도메인
지식 + P1~P8 로드맵(경쟁사 벤치마크). 다음 세션은 이 로드맵을 이어간다.

**게임 (56→61):** 라운드8 3종(Deepdive/Sonar/Handful), 라운드9 2종(Flapjack/Interlock).
Tumble은 라운드9에서 spec API 에러로 미빌드(재생성 가능). ⚠️ **에이전트 "typecheck 통과"가
lint는 못 잡는다** — prefer-const 에러가 정적 빌드를 막아 라우트 미생성(2회 겪음).
**라운드 배선 후 반드시 `rm -rf .next out && pnpm build`로 라우트 생성 확인.**

**공유 카드 "Proof-of-flex" 개편** — RANK 등급 씰(S/A/B/C/D) + 글리프 지문 + 스캔라인 +
PLAY FREE 칩. 8종 적용. dailyShare.ts 헬퍼(gradeFewer/gradeMore/gradeRatio/barGlyph). §7.11.

**체류·재방문 구조(리텐션 팀 로드맵):**
- **Phase 1 TODAY 보드**(홈): 사이트 전역 day-streak(`site:streak`) + 오늘 3게임 퀘스트
  (`quest:<date>`) + 오늘의 픽. `today.ts`/`TodayBoard.tsx`, RecordPlay 3줄이 전 게임 파급.
- **Phase 2 NEXT UP 레일**(게임 직후): 다음 게임 원탭 유도 + 세션 RUN×N 카운터. `NextUp.tsx`.

**SEO/트래픽(도메인 P2):** 장르 허브 4종 `/category/[puzzle|arcade|classic|skill]` — SSG,
JSON-LD(CollectionPage/ItemList/FAQPage), sitemap + 푸터 내부링크. 롱테일 검색 잡기.

**라운드8 감사 배치:** Minesweeper 타이머+베스트, Sudoku/Hangman 탭타깃, 온보딩 카피,
Tetris 모바일 DAS, 통산전적 라벨 의미 명확화(#6), Reset→Restart. (라운드9 감사는 API 에러로 실패.)

### ⬜ 다음 (DOMAIN.md 로드맵 — impact×실현성 순)
- **P1 게임오버 오버레이 나머지**: `stats:<slug>` 개인기록 미니패널(승률·시도분포), 마일스톤
  (7/30/100일) 축하, 데일리 카운트다운. (다음게임=NextUp ✅ 부분 완료)
- **P4 스트릭 프리즈**(⚠️ 도메인 리서치가 CRITICAL로 지목 — "프리즈 없는 스트릭은 이탈 장치"):
  dailyStreak.ts에 freeze 필드(gap 1일+잔량>0이면 리셋 대신 프리즈 소모). + 데일리 아카이브.
- **P3 온보딩 Start 카드**(objective + 언어독립 조작 글리프), **P5 게임별 OG 이미지**,
  **P6 분석 계측**(Cloudflare Web Analytics 자체호스팅 + Analytics Engine), **P8 즐겨찾기**.
- **신규 게임 최고 ROI**: Connections식 4×4 그룹핑 데일리(데일리+공유+streak 인프라 재사용).

### ⬜ 홀드한 감사 ★2 (per-game streak) — DOMAIN 재검토 필요
Ricochet/Stackpot/Quarry per-game streak은 **사이트 전역 site:streak(TodayBoard)이 상위 개념**이라
이제 우선순위 낮음. 하려면 Quarry의 in-run 'streak'을 'Chain'으로 개명(단어 충돌).

## 멈춘 지점

**막힌 코드 없음.** 라운드11(신규 게임 3종 + UI/UX 감사 5건 + jsdom/RTL 도입) 전부
커밋·PR #2 머지·배포·라이브 검증 끝났다(2026-08-10). **막힌 지점은 코드가 아니라 방향
전환이다** — 세션 중반에 사용자가 트래픽 애널리틱스(3.04k 순방문/30일)를 공유하며
"후원이 한 건도 없어 수익이 안 난다"고 우려를 표했다. 다음 세션의 첫 행동은 게임을
더 찍어내는 게 아니라 **전환 진단**이어야 한다 — 아래 "다음 단계" 1번 참고.

## 다음 단계 (순서대로)

1. **⚠️ 전환 진단부터(게임 라운드12보다 우선)** — 자세한 배경은 메모리
   [[data-signals-premature]] 참고. 순서:
   - D1/Analytics Engine에서 재방문율·vid별 세션수 실측(3k명이 서로 다른 사람인지,
     소수의 반복 방문인지 구분).
   - 브라우저로 직접 리더보드 제출 퍼널을 걸어보고 어디서 마찰이 있는지 확인(제출
     폼 위치, 이름 입력 요구 등) — 실유저 제출이 아직 0건인 이유를 가설이 아니라
     직접 확인할 것.
   - 후원(도네이션) 도입 여부 확인. 없다면 가장 마찰 적은 옵션(예: Buy Me a Coffee
     링크 하나)부터 검토 — AdSense 미승인 상태에서 가장 빠른 수익화 레버일 수 있음.
   - AdSense 상태 재확인(마지막 확인이 오래됐다, 2026-07-16) — `from:adsense-noreply@google.com`
     Gmail 재검색. 승인 났으면 §7.2의 3단계 순서(슬롯 ID 교체 → `adsenseEnabled: true`) 그대로.
2. **게임 라운드12**(전환 진단 이후, 필요하다고 판단되면):
   ```
   Workflow({ name: "minigames-round" })
   ```
   - `EXISTING` 상수는 **90종 기준으로 갱신돼 있다**(라운드11까지 반영, 2026-08-10 확인).
     라운드12에서 새 게임을 배포한 뒤에는 다시 갱신할 것.
   - 에이전트는 자기 파일 3개(engine/engine.test/Game*.tsx)만 쓴다. **배선 6곳은 오케스트레이터가 직접**.
   - ⚠️ 신규 게임은 반드시 브라우저 실플레이로 검증할 것(라운드10·11 둘 다 이 방식으로
     실버그를 잡았다). 세션 중 "크롬 띄우지 말고"류 지시가 오면 국지적 지시로 해석해
     코드 기반 검증으로 전환하되, 그 세션 한정으로 그친다([[prefer-code-only-verification-when-busy]]).
   - ⚠️ **`/ship`·`/land-and-deploy`의 프리랜딩·적대적 리뷰도 생략하지 말 것** — 라운드10·11
     둘 다 체크리스트+스페셜리스트+레드팀+적대적 리뷰가 CRITICAL 버그를 잡았다(라운드11:
     BubbleShooter 신기록 플래그 버그, bestScore.ts 미보호 localStorage 예외). "빌드
     에이전트가 테스트 통과라고 했다"는 안전 근거가 안 된다.
3. **TODOS.md** — 라운드11이 남긴 4개 후속 항목 참고(Stakehouse Best 시맨틱스,
   Stakehouse 0-뱅크롤 엣지케이스, Aim Trainer 리더보드 정밀도 스케일링, canvas/grid
   게임 jsdom+RTL 파일럿 확장).
4. **Vercel 레거시 연동** — GitHub push마다 자동 빌드 시도하던 게 최근엔 정상 통과한다
   (README.md 정정 이후). 여전히 무해하니 무시해도 되나, 원한다면 사용자가 대시보드에서
   직접 Disconnect(Project Settings → Git → Disconnect)할 수 있다.

## 검증 상태 (2026-07-16 기준, 전부 실행함)

- typecheck: **통과** / unit: **통과 (54 files, 1059 tests)** / e2e: **통과 (65)** / build: **통과**
- Lighthouse: home **100** / game **100** / a11y·bp·seo **100** / CLS **0** / TBT **0ms**
- 재현 명령:
  ```bash
  pnpm typecheck && pnpm test && pnpm exec playwright test && pnpm build
  ```
- ⚠️ **로컬 Lighthouse로 게임 페이지를 재면 best-practices가 96으로 나온다** — 정적 서버엔
  Worker API가 없어 `/api/leaderboard` 404가 콘솔 에러로 잡히는 **측정 아티팩트다. 회귀가 아니다.**
  기준선은 라이브 URL로 잴 것.
- e2e 플레이키 1건: `2048: 로드 → 조작 → 상태 변화`가 ~25회 중 1회 실패(빌드 직후 콜드스타트로 추정,
  이후 20회 재현 안 됨). 내가 만든 회귀 아님. 다시 보이면 키 입력 사이에 대기를 넣을 것.

---

## 0. 30초 요약

- **무엇**: 무료 브라우저 미니게임 사이트. 광고(AdSense)로 월 5~10만원 수익 목표.
- **지금 상태**: **라이브** — https://quickminigames.site (커스텀 도메인 + SSL 정상, Cloudflare Workers 배포).
- **게임 수**: 90종 (registry 기준, 2026-08-10 라운드11까지 반영). 상당수 오리지널 창작 게임 + 클래식.
  이 §0 섹션 나머지는 2026-07-16 기준 스냅샷이라 낡았다 — 최신 상태는 이 파일 맨 위 갱신일자와
  2026-08-10 세션 섹션을 볼 것. AdSense 상태·리더보드 게임 수 등은 재확인 필요.
- **리더보드**: 34개 게임에 주간 Top10 온라인 리더보드 (Cloudflare D1).
  나머지 22개는 **의도적으로 없다** — 리더보드는 "높을수록 좋음" 점수가 필요한데
  소도쿠·미로·행맨은 완주형, 틱택토·체커·리버시는 AI 대전, reaction-time·aim-trainer와
  duplex는 낮을수록 좋다. 신규 게임을 붙일 때 이 기준으로 판단할 것.
- **⚠️ 반복되는 함정 — `best:<slug>`에는 숫자만 넣을 것**: 리더보드(`Leaderboard.tsx:41`)는
  그 키를 `Number()`로 읽는다. JSON을 넣으면 NaN → 제출 버튼이 영구히 안 뜬다.
  이 버그를 이번 세션에만 **3번**(decant, ticker, zero-hour) 만났다. 통계 blob이 필요하면
  `<storageKey>:stats`로 분리하고 레거시는 로드 시 마이그레이션할 것.
  현재 `best:<slug>`에 JSON을 넣는 게임이 12개 더 있으나 전부 리더보드 미등록이라 무해하다
  — **그 12개 중 하나를 리더보드에 올리려면 반드시 먼저 저장 형식을 고칠 것.**
- **광고**: 아직 **OFF**. pub-id는 발급받아 채웠고(`ca-pub-9363381710674627` — 구글 메일의
  `pub-9363381710674627`과 일치 확인), 게재는 `siteConfig.adsenseEnabled: false`로 잠가 둔 상태.
  **승인은 안 났고, 그 전에 프로필(주소·전화)이 미완성이다** — 자세한 건 7.2.
- **바로 다음 할 일**: (1) 사용자가 AdSense 프로필 완료 → 승인 → 광고 켜기(7.2),
  (2) Daily streak(7.5 다음 사이클), (3) 게임 계속 찍어내기.
- **SEO 인프라**: Search Console 도메인 속성 등록 + sitemap.xml 제출 완료(2026-07-16, DNS 인증).
  `www.quickminigames.site` → apex 301 리다이렉트도 Cloudflare Page Rule로 걸었다(경로 보존).

---

## 1. 프로젝트 목표 & 수익 모델

- 사용자(Pious Angel, yyh7654@gmail.com)의 목표: 광고로 **월 5~10만원(~$35-70)** 벌기.
- 전략: (a) 게임을 대량 생산해 페이지 수·색인 늘리기, (b) UI/UX를 계속 고도화, (c) 리더보드로 재방문·체류시간↑(경쟁심리), (d) AdSense 광고 게재.
- **디자인 방향**: RETRO NEON(신스웨이브) 미학. Press Start 2P 픽셀 폰트, 네온 컬러 팔레트, 스캔라인. 이모지 기본값 대신 커스텀 SVG 아이콘 사용.
- **게임 철학**: 단순 클론이 아니라 **창의적이고 중독성 있는 오리지널 게임**을 멀티 에이전트 심의(Workflow)로 계속 발명. 라운드1~6 진행됨(§7.3).

---

## 2. 라이브 현황

| 항목 | 값 |
|---|---|
| 도메인 | `quickminigames.site` (라이브, SSL OK) |
| 호스팅 | Cloudflare Workers + Static Assets |
| Worker 이름 | `minigames-hub` |
| DB | Cloudflare D1 `minigames-leaderboard` (id `c99eaae9-e197-4020-b718-a3d599949f70`) |
| 게임 수 | 53 (`registry.ts`) |
| 리더보드 게임 | 31 (`leaderboard.ts` LEADERBOARD_GAMES) |
| 광고 | OFF (승인 전) |
| Node / pnpm | v22.22.3 / 9.15.0 |

**API 엔드포인트** (worker/index.ts):
- `GET /api/leaderboard?game=X` → 해당 게임 주간 Top10
- `POST /api/score` → 점수 제출(검증·상한·insert)
- `GET /api/leaderboards` → 게임별 Top3 한 방에(리더보드 허브용)
- 그 외 경로 → `env.ASSETS.fetch` (정적 파일)

---

## 3. 기술 스택 & 아키텍처

- **Next.js 15 App Router**, `output: 'export'` **정적 익스포트**. → 서버 런타임 없음. route handler는 `export const dynamic = 'force-static'` 필요.
- **Cloudflare Workers**: `worker/index.ts`가 API를 직접 처리하고 나머지는 정적 에셋 바인딩(ASSETS)으로 서빙. `tsconfig.json`은 `"worker"`를 exclude(별도 타입).
- **D1(SQLite)**: 리더보드 저장. worker는 `../src/lib/leaderboard`를 **상대경로**로 import(@/ 별칭 안 씀).
- **폰트**: Press Start 2P 셀프호스팅 — `src/app/fonts.ts` + `src/app/fonts/PressStart2P.woff2` (next/font/local).
- **디자인 시스템**: `src/app/globals.css`에 `--neon-cyan/magenta/lime/amber/purple/blue/red/green`, 유틸 `.neon-text/.neon-box/.font-pixel/.scanlines`.
- **브랜드**: `src/lib/siteConfig.ts` (name/url/description/adsenseClientId/adsenseEnabled). name 바꾸면 헤더/푸터/타이틀/OG/manifest 전파.
- **로고**: `src/components/Logo.tsx` (네온 아케이드 캐비닛 + 플레이 삼각형 SVG, currentColor). 파비콘 `src/app/icon.svg`와 통일.

### 게임 공통 규칙 (GameShell 템플릿)
- **엔진(engine.ts)은 순수·결정론적**: rng 주입, `Math.random`/`Date.now`/`performance.now` 절대 금지. vitest 유닛테스트.
- **컴포넌트**: GameShell/GameOverlay/GameButton, `useGameSound`, `useReducedMotion`, `isTypingTarget` 가드, SSR 안전(상태는 effect에서 init), 보드에 `data-testid`, `@keyframes`는 컴포넌트 스코프.
- **사운드 이름은 이것만**: `move|merge|win|lose|eat|flag|error|flip|match|mismatch`.

### 새 게임 와이어링에 손대는 공유 파일 (6곳) — 경로는 2026-07-16 실측
1. `src/lib/games/registry.ts` — union variant + gamePages 엔트리(slug/title/h1/metaDescription/shortDescription/howToPlay≥3/strategy≥3/faq≥3)
2. `src/components/GameRenderer.tsx` — import(알파벳 순) + switch case (`storageKey={`best:${page.slug}`}`)
3. `src/lib/games/gameMeta.ts` — icon/accent/category
4. `src/components/icons/GameIcon.tsx` — 커스텀 SVG glyph(없으면 joystick fallback)
5. `e2e/smoke.spec.ts` — load + board-visible 테스트
6. `src/lib/leaderboard.ts` LEADERBOARD_GAMES — (점수형 게임이면) label 추가

> ⚠️ 이전 핸드오프는 2·4번 경로를 `src/lib/games/GameRenderer.tsx`,
> `src/components/GameIcon.tsx`로 적었으나 **둘 다 틀렸다**. 실제 위치는 위와 같다.

---

## 4. 배포 파이프라인

```bash
pnpm run deploy      # = next build && wrangler deploy
```

**배포 전 항상 검증**:
```bash
pnpm typecheck && pnpm test && pnpm exec playwright test && pnpm build
```
CLAUDE.md의 pre-merge 훅은 `pnpm test && pnpm typecheck`뿐이라 **e2e는 자동으로 안 돈다** — 직접 돌릴 것.

**검증 팁**:
- 빌드 출력은 `out/contact.html` 형태(트레일링 슬래시 auto). 라이브에서 `/contact` = 200, `/contact/` = 307 리다이렉트(정상).
- 배포 후 `curl`로 확인. **엣지 캐시가 새 경로에 잠깐 stale 404를 줄 수 있음** — 보통 15초 내 해소.
  이번 세션에도 신규 3종이 배포 직후 404였다가 15초 뒤 200이 됐다. 성급히 디버깅하지 말고 폴링할 것.
- **포트 3100에 이전 세션 서버가 남아 e2e가 240초 타임아웃**나는 일이 잦다: `lsof -ti:3100 | xargs -r kill -9`
- wrangler는 **OAuth 토큰**(`wrangler login`)으로 인증됨 — Workers 권한 있음.

---

## 5. 도메인 (완료됨 — 참고용)

- `quickminigames.site` Gabia에서 구매 → Cloudflare로 존 이전 완료(네임서버 변경, gabia NS 전부 제거해야 active됨).
- Worker 커스텀 도메인 연결: `wrangler.jsonc`의 `"routes": [{ "pattern": "quickminigames.site", "custom_domain": true }]` + `wrangler deploy`로 붙임.
- **주의**: Cloudflare API 토큰(cfut_...)은 **zone 권한만** 있고 Workers 권한 없음. Worker 관련은 wrangler OAuth로, zone 생성/DNS는 API 토큰으로 분리했음.

---

## 6. 이번 세션(2026-07-16)에 한 일 — 커밋 17개, 전부 배포됨

게임 **48 → 53종**, 리더보드 **25 → 31종**, Lighthouse **97/99 → 100/100**.

**수익 인프라**
- AdSense pub-id 등록 + 메타 태그 소유권 확인 + ads.txt → 검토 요청(3449bcb)
  — ⚠️ 이 "검토 요청 완료"는 **재확인 결과 의심스럽다. §7.2 참고**(프로필 미완성 상태였다)
- Search Console 도메인 속성 등록(Cloudflare DNS 자동 인증) + sitemap 59 URL 제출
- `www` → apex **301** 리다이렉트(Cloudflare Page Rule, 경로 보존). 그전엔 www가 DNS부터 없었다
- Google CMP 3버튼 + IAB 목적 설정

**게임**
- 라운드5 배선: Decant / Backspace / Duplex(51d87f8) — 엔진·컴포넌트·테스트가 **이미 있었고** 배선만 없었다
- 라운드6 생성: Overdub / Pinwheel / Cleave(75f2e95) — 20 에이전트, 1.1M 토큰, 24분

**버그 (전부 실제로 재현·수정·회귀 테스트 고정)**
- **헤더 리더보드 링크에 접근 가능한 이름이 없었다**(f247496) — 640px 미만에서 라벨은
  `display:none`, 이모지는 `aria-hidden` → 스크린리더가 "링크"로만 읽음. WCAG 2.4.4/4.1.2 위반
- **죽은 리더보드 2개**(42b930e) — ticker/zero-hour가 `best:<slug>`에 JSON을 넣어 제출이 영구 불가
- **Pinwheel이 마우스로 플레이 불가**(75f2e95) — 셀 `onFocus`가 핀을 꽂고 `onClick` 토글이 즉시 해제.
  키보드로는 격자 진입조차 안 됐다(핀 없으면 전 셀 `tabIndex: -1`)
- **엔드리스 7종이 신기록을 축하 안 함**(dca02d2) + 사운드 스팸 2건(backspace 60fps, flappy)

**UI/UX**
- 이모지 → 커스텀 네온 SVG(TrophyIcon, DiceIcon). AdSense 미리보기가 🏆를 `??`로 렌더한 게 증거
- og:url 6곳 + og:image:alt 전체(e1bca0f)
- 홈 Daily 필터(77ffb15), 자체 창작 3종 hint에 목표 추가(0c99372)

## 6.1 함정 · 결정사항 (모르면 사고 나는 것만)

- **`best:<slug>`엔 숫자만** — 이번 세션에만 3번 밟았다. §0 요약 참고
- **에이전트의 "GREEN 보고"는 플레이 가능을 뜻하지 않는다** — §7.6 참고
- **`git checkout .`을 stash 복원과 같이 쓰지 말 것** — 이번 세션에 스테이징 안 된 파일 2개를
  날려 다시 작성했다. 파일 단위로 지정하거나 `/tmp`에 사본을 떠 둘 것
- **Next.js `generateImageMetadata`는 `output: 'export'`와 충돌** — `[__metadata_id__]` 동적
  세그먼트를 만들어 빌드가 깨진다. 그래서 게임별 og:image:alt를 포기하고 정적 문구로 갔다
  (`src/app/[slug]/opengraph-image.tsx` 주석에 사유 있음)
- **워크플로우 진행 중 배포 금지** — 미완성 파일이 빌드에 섞인다
- **임시 우회책 없음** — 이번 세션에 남긴 TODO나 하드코딩된 임시 코드는 없다

---

## 7. 다음 세션 할 일 (우선순위 순)

### 7.1 ✅ 라운드5 게임 3종 — 2026-07-16 배포 완료
Decant / Backspace / Duplex 라이브(`/decant` `/backspace` `/duplex`). 게임 **50종**.

> 이전 핸드오프가 "엔진만 있고 컴포넌트·테스트 없음"이라고 적었으나 **사실과 달랐다**.
> 컴포넌트(460/567/772줄)와 엔진 테스트(92개)가 이미 있었고 배선 5곳만 빠져 있었다.
> 교훈: 핸드오프의 미완성 주장은 그대로 믿지 말고 `ls`/테스트 실행으로 먼저 확인할 것.

### 7.2 🔴 AdSense — 승인 안 남. **사용자가 프로필을 마쳐야 함** (2026-07-16 메일 확인)

**⚠️ 이전 핸드오프는 "심사 대기 중(검토 요청 완료)"이라고 적었다. 그대로 믿지 말 것.**
2026-07-16 Gmail을 실제로 검색해 보니 그림이 달랐다.

- **확인한 사실** (`from:adsense-noreply@google.com` 검색 결과, 구글발 메일은 총 1통):
  - **승인 메일은 없다.**
  - 유일한 메일은 2026-07-16 02:37 UTC **가입 환영 메일**: "사이트를 추가하셨으니 이제
    **프로필을 작성하여** 애드센스에서 수익을 창출하세요 — 유효한 수취인 주소를 입력하세요 /
    전화번호를 인증하세요."
  - 그 메일이 안내하는 온보딩 순서: **1) 결제 정보를 제공하고 사이트 승인을 받습니다**
    → 2) 온보딩(광고 설정) → 3) 지급. 즉 **주소·전화가 사이트 승인보다 앞이다.**
  - 메일의 게시자 ID `pub-9363381710674627` = 코드의 `adsenseClientId`와 **일치**(오타 아님).
- **추론(미확인 — 대시보드로 확인할 것)**: 프로필이 비어 있어 심사가 시작조차 안 됐을 가능성이 높다.
  다만 "사이트 검토 요청"과 "프로필 작성"이 별개 트랙일 수도 있다. **대시보드를 봐야 확정된다.**
- **그래서 다음 행동은 코드가 아니다**: 사용자가 AdSense에서 수취인 주소 입력 + 전화 인증을
  마쳐야 한다. 에이전트가 대신 할 수 없다. 그전엔 슬롯 ID도 발급되지 않으므로 켤 것도 없다.
- **현재 상태**: `siteConfig.adsenseClientId`는 채워져 있고(메타 태그·ads.txt가 사용),
  게재는 `siteConfig.adsenseEnabled: false`로 **잠가 둠**. 승인돼도 자동으로 켜지지 않는다.
  **지금 코드 상태가 정확히 맞다 — 건드리지 말 것.**
- **승인되면 할 일** (이 순서를 지킬 것):
  1. AdSense에서 광고 단위 2개 생성 → **숫자 슬롯 ID** 발급받기.
  2. `AdSlot`을 쓰는 두 곳의 플레이스홀더 slot 문자열을 실제 숫자 ID로 교체:
     `src/app/page.tsx`(`"home-footer"`), `src/components/GamePageLayout.tsx`(`"game-incontent"`).
  3. `siteConfig.adsenseEnabled: true` → 배포.
  - ⚠️ 2번을 건너뛰고 3번만 하면 잘못된 슬롯으로 요청이 나가 콘솔 에러만 남는다.
- **EU 동의(CMP)**: Google CMP **3버튼**(동의 / 동의하지 않음 / 옵션 관리)으로 설정 완료(2026-07-16).
  사이트 코드와 무관하게 AdSense 대시보드에서만 동작한다.
  - IAB 데이터 사용 목적: 광고 관련(기기 정보 저장/제한적 데이터 광고 선택/개인화 프로필 생성·선택/
    광고 성과 측정/오디언스 통계) = **동의**, Develop and improve services = **적법한 이익**,
    content 개인화 계열 = **사용되지 않음**(우리는 콘텐츠를 개인화하지 않으므로 받을 이유가 없다).
  - 2버튼 버전은 고르지 말 것 — GDPR상 "거부가 동의만큼 쉬워야" 요건에 걸린다(CNIL 제재 선례).
  - ⚠️ 사용자 보고 기준이며 대시보드 재확인은 안 했다. 광고 켤 때 배너가 실제로 뜨는지 확인할 것.

### 7.3 🟡 게임 계속 찍어내기 (Workflow 파이프라인)

**스크립트가 레포에 있다: `.claude/workflows/minigames-round.js`** → `Workflow({ name: "minigames-round" })`
라운드6에서 이걸로 Overdub/Pinwheel/Cleave를 만들었다. 실측: **20 에이전트 / 1.1M 토큰 / 24분**.

- 구조: **Ideate**(5개 각도, 각도별 "겹치지 말 것" 목록 명시) → **Judge**(독창성/중독성/실현성/매력
  3인 심사, 실현성<5.5 또는 독창성<5.5 하드컷) → **Spec→Build** 파이프라인 + 병렬 **Audit**(5차원 읽기전용) → **Synthesize**
- **돌리기 전 `EXISTING` 상수 갱신 필수** — 현재 53종 기준. 안 하면 재탕이 나온다
- 에이전트는 자기 파일 3개만 쓴다(engine.ts / engine.test.ts / Game*.tsx).
  **공유 파일 6곳 배선은 오케스트레이터가 직접** — 병렬 에이전트에게 맡기면 충돌한다
- UI/UX 트랙은 **읽기 전용**으로 설계했다(제안만 하고 구현은 오케스트레이터가). 같은 이유
- **함정**: 워크플로우 진행 중 배포하면 미완성 파일이 빌드에 섞인다. **완료 후 배포**
- 라운드6 실적: 아이디어 20개 → 심의 통과 10개 → 승선 3개. 매력 점수는 5.3~6.3으로 낮았다
  (심사관에게 후하게 주지 말라고 지시함). Cleave는 셋 중 가장 약해 관찰 대상 — 아무도 안 하면 뺄 것

### 7.8 ✅ 라운드7 UI/UX 감사 처리 — 5건 전부 완료·배포 (2026-07-16)

라운드7 워크플로우의 UI/UX 감사 19건 → 상위 5건. 값/위험 순. **5건 전부 배포됨.**

- ✅ **#1 리더보드 stale best** — 첫 방문자가 리로드 없이 신기록 제출 가능
  (`Leaderboard.tsx` 1초 폴링 + 동등성 가드 + submittedRef 재제출 방지). **31게임 전부.**
  ⚠️ 정적 serve는 API 404라 리더보드가 숨겨져 검증 불가 → **wrangler dev로 검증**했다.
- ✅ **#2 Snake 모바일** — touchend→touchmove(손 떼기 전 반응, null 리셋을 임계 통과
  분기 안으로) + 모바일 D-pad(Maze 패턴) + 상태 인식 hint. Pixel 5 뷰포트로 검증.
- ✅ **#3 신기록 축하 없음**(2048/Cleave/Overdub). 감사 계획이 Cleave 사운드 경로를
  틀리게 봤던 것(맵 우회 X)을 코드 확인으로 바로잡음. 2048은 이펙트 순서 함정이 있어
  이동 핸들러에서 동기 latch. ⚠️ 2048은 무작위 자동플레이로 자연 게임오버가 잘 안 나
  컨피티 직접 관찰은 못 함 — 로직은 코드검증 + backspace e2e(동일 패턴)로 확인.
- ✅ **#4 Daily 모드 미기억**(Overfold/Quarry/Ricochet/Stackpot). `${storageKey}:mode`
  규약, 기본 daily, 토글 시 저장. Ricochet 우선순위 `?seed= > 저장모드 > daily`를
  aria-pressed로 검증(공유 링크 회귀 방지 확인).
- ✅ **#5 Reversi/DaB hint 목표 없음** — registry 문장을 hint로 당겨옴(4줄).
- **하지 말 것 8건**(감사가 명시, 착수 금지): tabular-nums 52게임 전역변경, GameShell
  prop 확장, Pong tint, 무승부 문구 통일, 필터칩 44px 데스크톱 확대, Minesweeper best
  JSON, streak을 #4 전에, Tetris 38vh 무조건. 근거는 synthesis 원문 §5 참고.

> **다음 사이클 후보**: 이제 #4(Daily 모드 기억)가 됐으니 감사가 막아둔 **day streak**을
> 붙일 수 있다(새 키 `daily-streak:${slug}`, `best:${slug}`에 JSON 금지). §7.5 "다음 사이클"도 참고.

### 7.9 ✅ 파비콘 — Google 검색 지구본 → 브랜드 아이콘 (2026-07-16 배포)
검색 결과에 사이트 아이콘 대신 기본 지구본이 떴다. 원인: 루트 **`/favicon.ico`가 404**.
Google 파비콘 페처는 정규 경로로 루트 ico를 먼저 찾는다. 브랜드 SVG를 16/32/48 멀티
사이즈 ICO로 렌더해 `src/app/favicon.ico` 추가 → Next가 `/favicon.ico`로 서빙. 라이브 200 확인.
⚠️ **즉시 안 바뀐다**: Google이 홈을 재크롤해야 반영(며칠~몇 주). Search Console에서
홈 URL 검사 → 색인 요청으로 앞당길 수 있다(사용자 액션).

### 7.10 ✅ Day streak — UTC 통일 + 4종 확장 완료·배포 (2026-07-18)
✅ **선행: "오늘" 판정 UTC 통일**(#22). `src/lib/dailyDate.ts`의 `todayUTC()`가 단일 소스.
daily 7종 전부 통일. 예전엔 UTC/로컬 혼재라 게임마다 데일리가 다른 시각에 갱신됐다.

✅ **기능(#23): day-streak 확장.** 재사용 헬퍼 `src/lib/dailyStreak.ts`
(bumpStreak/currentStreak, UTC, 유닛 12개). 저장은 전용 키 `<storageKey>:streak`(JSON).
**적용 4종**: Decant(인라인→헬퍼로 정리, 죽은-streak 표시 버그 수정) / Splice / Overfold / Duplex.
각 게임 데일리 완료(승리·solve) 시 bump, 데일리 모드에서만 "Streak N" 스탯.

- **Quarry 제외(의도적)**: 이미 `nextStreak`(런 내 연속 언더파, "🔥 N")가 있어 cross-day
  streak을 넣으면 "streak" 개념이 둘이 돼 혼란. 넣으려면 기존 것 리네이밍 선행.
- **Stackpot/Ricochet 제외**: 완료 정의가 애매(Stackpot 엔들리스 bust, Ricochet 탭 한도).
  넣으려면 "오늘 데일리 완료"를 게임별로 먼저 정의할 것.
- ⚠️ **승리→bump는 퍼즐 풀이가 필요해 자동 관찰 못 함** — bumpStreak 유닛 + win 핸들러
  호출 지점 코드검증으로 커버. 표시(로드→currentStreak→스탯)는 브라우저 검증됨.
- **다음 후보**: streak이 특정 일수(7·30) 도달 시 축하/뱃지, 홈 카드에 streak 표시.

### 7.11 ✅ 바이럴 후크 + 배포 전략 — 데일리 공유 카드 5종 배포 (2026-07-18)
**오피스아워 결론**(사용자와 상의): 유저를 데려온 유일 검증 채널은 **커뮤니티 배포**
(r/WebGames 100뷰/일). SEO는 아직, 광고는 트래픽 대기. 그래서 **배포 × 품질(리텐션)**이
곱셈 관계 — 둘 다. 게임·SEO·바이럴은 에이전트가 자율로, **커뮤니티 게시는 사용자만 가능**
(봇 게시는 밴 → 채널 죽음). 에이전트는 사용자 몫을 5분짜리로 깔아준다.

✅ **데일리 결과 공유 카드**(`src/lib/dailyShare.ts` + `DailyShareButton.tsx`):
- 클라이언트 캔버스로 네온 브랜드 PNG(게임명·날짜·결과·streak·사이트 URL) 1080² 생성.
  픽셀 폰트는 `public/fonts/PressStart2P.woff2`를 FontFace로 로드(정적 export 안전).
- `navigator.share(files)`로 이미지 공유(미지원 시 다운로드) + Wordle식 텍스트 스니펫
  클립보드 복사(텍스트가 링크 없이 퍼짐). 둘 다 URL 박아 유입 회수.
- **적용 5종**: Ricochet(cyan) / Splice(cyan) / Overfold(purple) / Decant(magenta) /
  Duplex(blue). 데일리 완료 오버레이에만 "📣 Share result" 버튼. accent만 바꿔 재사용.
- ⚠️ 카드 렌더는 브라우저 시각 검증(5 accent), Share 버튼 노출은 코드검증(퍼즐 풀이가
  필요해 오버레이 자동 도달 불가).

✅ **공유 카드 개편 "Proof-of-flex"**(디자인 팀 9에이전트 스펙, 2026-07-18 배포):
밋밋하던 카드를 **RANK 등급 씰(S/A/B/C/D)** 히어로 + **글리프 지문 스트립**(채운/빈 셀 +
par 틱) + 스캔라인 + ▶PLAY FREE 칩으로 개편. 애니메이션은 심사에서 배제(비용>가치).
- `dailyShare.ts` 헬퍼(순수, 유닛 22개): gradeFewer/gradeMore/gradeRatio/barGlyph/
  resultSnippet/dailySerial. payload에 isDaily/grade/scoreLine/glyph 옵셔널 필드.
- 등급 산출: par 데일리 delta(적을수록), Ricochet chain−par(많을수록), 엔들리스 PB 비율.
- grade 없으면 기존 lines 스택 폴백(하위호환). 검증은 8종 샘플 브라우저 그리드 렌더.
- ⚠️ 실제 게임오버→카드는 자동 도달 불가라 샘플 렌더+grade 유닛+typecheck로 검증(직접 관찰 X).

🟡 **커뮤니티 게시글 초안**(사용자 액션 대기): `scratch-community-posts.md`(gitignore).
서브에이전트가 규칙 리서치 + 게임별 맞춤 초안 작성. 게시 가능 4곳(r/WebGames·r/playmygame·
r/IndieDev·r/IndieGaming) + itch.io(저신뢰). **금지: r/Games·r/coolgithubprojects(레포 필요)·
r/incremental_games(장르 불일치)·r/gamedev**. 
- **순서**: Day0 r/WebGames 재등판(Ricochet 단일 게임 각도, "56종" 재탕 금지) → +4~5일
  r/playmygame(Umbra) → +3~4일 r/IndieDev(Fuse 메이킹) → +5~7일 r/IndieGaming(Splice+GIF).
- **핵심 규칙**: 같은 날 여러 서브에 같은 링크 금지, 게시 전 며칠 댓글로 활동(레딧은
  "누가 올리나"를 봄), 링크만 던지지 말 것. **게시는 사용자만 — 에이전트가 대신 못 함.**

### 7.4 🟡 UI/UX 고도화 (지속)
- 트렌디한 애니메이션/인터랙션, 최신 사이트 참고. 스스로 판단해서 계속 개선.
- **Lighthouse 기준선 갱신(회귀 금지)**: home **100**, game **100**, a11y/bp/seo 100, CLS 0, TBT 0ms.
  (2026-07-16 측정 — 기존 97/99에서 올랐다.)
- ⚠️ **로컬에서 Lighthouse를 돌리면 게임 페이지 best-practices가 96으로 나온다** — 정적 서버엔
  Worker API가 없어 `/api/leaderboard` 404가 콘솔 에러로 잡히기 때문이다. **회귀가 아니다.**
  기준선은 라이브 URL로 잴 것(라이브 /snake는 100 확인).
- 2026-07-16 디자인 감사 결과: **Design A− / AI Slop A**. 슬롭 블랙리스트 11개 패턴 전부 해당 없음.
  리포트: `~/.gstack/projects/Piousangel-minigames-hub/designs/design-audit-20260716/`

### 7.5 ✅ UI/UX 감사 상위 5건 — 2026-07-16 처리 완료
5명 감사관이 25건 → 종합 상위 5건. **4건 처리, 1건은 검증 후 기각.**

- ✅ **DO-1 죽은 리더보드**(ticker/zero-hour) — 배포됨
- ✅ **DO-2 엔드리스 7종 신기록 축하** — 배포됨. 사운드 스팸 2건(backspace 60fps, flappy)도 같이 잡음
- ✅ **DO-3 Daily 필터** — 배포됨. 홈에서 Daily 7종을 찾을 수 있다
- ✅ **DO-4 목표 없는 hint**(duplex/decant/quarry) — 배포됨
- ❌ **DO-5 idle 캔버스 단서 — 기각**. 감사관이 `fillText` 0건만 보고 "빈 캔버스=고장"이라
  했으나 **실제 화면을 찍어보니 사실이 아니었다**: flappy는 새, latch는 펙·글린트,
  ripple은 부표 3개가 발광하고, 안내 문구도 데스크톱·모바일(375×812, top 526~564 < 812)
  모두 화면 안에 있다. 없는 문제였다.

**다음 사이클 후보**: Daily streak(감사 #22 UTC/로컬 통일 → #23 streak). 반드시 #22 먼저.

**하지 말 것** (감사에서 제안됐으나 손해):
- 라벨 통일(You/CPU 등) — 5파일 고쳐도 수익 기여 0
- GameShell `items-center` → `items-start` — 다중행 게임 3개는 나아지나 단일행 47개가 어긋난다
- 필터 칩 히트 영역 44px 확장 — gap이 8px라 줄바꿈된 칩끼리 겹쳐 오탭이 난다(AA 24px는 이미 통과)

### 7.7 ✅ 라운드7 게임 3종 — 2026-07-16 배포 완료
Umbra / Fuse / Polytap 라이브(`/umbra` `/fuse` `/polytap`, 전부 200 확인).
게임 **56종**, 리더보드 **34종**. 셋 다 `best:<slug>`에 숫자만 저장 확인(리더보드 안전).
배선 6곳 + e2e 5개 추가, 전체 e2e 69개 통과. **Polytap 워밍업 무적화도 함께 배포**(아래).

> **이번에도 §7.6 교훈이 그대로 적중했다 — 단, 반대 방향으로.**
> 브라우저 플레이테스트에서 Fuse·Polytap이 처음엔 "안 돈다"고 나왔으나 **둘 다 내
> 테스트 오류였다**: Fuse는 손의 시작 위치(중앙 셀 12)를 클릭해 이동이 0이었고,
> Polytap은 워밍업에 아직 안 붙은 pad-f(정상적으로 disabled)를 검사했다. 실제로는
> 셋 다 정상 작동한다(구슬 비행·심지 연소·클럭 진행 전부 육안 확인).
> 교훈의 확장: **빨간 결과를 봐도 게임을 의심하기 전에 내 테스트를 의심하라.**
> 지난번(Pinwheel)은 게임이 틀렸고 이번엔 테스트가 틀렸다 — 매번 실제 화면을 봐야 갈린다.

- **Umbra**(Skill, 타이밍): 구슬이 어둠에 사라진 뒤 도착 순간을 외삽해 1/2/3로 친다.
- **Fuse**(Puzzle, 스케줄링): 5×5에서 심지 여러 개가 탄다. 손 하나, 이동에 틱이 든다.
  idle로 부팅 → 첫 탭이 시작. 손 시작 위치는 중앙(12).
- **Polytap**(Skill, 폴리리듬): F 3박 / J 4박. Space나 Start로 시작.
  ✅ **워밍업 무적화 완료(2026-07-16 배포)**: 예전엔 워밍업에서 J를 3번 놓치면
  폴리리듬(F 합류)을 보기도 전에 죽었다. 이제 stage 0에서는 미스·스트레이가 라이프를
  깎지 않는다(무적 샌드박스). 카운터·피드백은 유지, F 합류 스킬 게이트(J 4회 성공)도 유지.
  stage 1+ 이후는 원래 난이도 그대로. 엔진 `src/lib/games/polytap/engine.ts`의 miss(353행
  부근)·stray(421행 부근)에 `stage >= 1` 가드. 브라우저에서 6초 무입력 생존 확인.

### 7.6 ✅ 라운드6 게임 3종 — 2026-07-16 배포 완료
Overdub / Pinwheel / Cleave 라이브. 게임 **53종**, 리더보드 **31종**.
20 에이전트(발상5 → 심의3 → 명세·구현6 + 감사5 + 종합1), 1.1M 토큰, 24분.

> **교훈: 에이전트의 "테스트 통과" 보고는 참이어도 게임이 돌아간다는 뜻이 아니다.**
> Pinwheel은 유닛 31개·typecheck 전부 GREEN이었으나 **마우스로 플레이가 불가능**했다
> (셀 onFocus가 핀을 꽂고 onClick 토글이 즉시 해제 — 실제 클릭은 포커스를 유발하므로).
> 키보드로는 격자 진입조차 안 됐다(핀 없으면 전 셀 tabIndex -1). 엔진 유닛 테스트는
> 이런 걸 못 잡는다. **신규 게임은 반드시 실제 마우스/키보드로 몰아볼 것.**
> 이때 `page.click()`이 실패하면 셀렉터를 의심하기 전에 게임을 의심할 것 — 이번엔 게임이 틀렸다.

---

## 8. 광고 수익 → 통장 입금 흐름 (사용자 질문 답변)

**AdSense 정산 구조 (한국 기준)**:
1. **AdSense 계정 생성** + 사이트 등록 + 심사 통과.
2. 광고 노출/클릭으로 수익이 **매일 누적** → 매월 초 전월 확정 수익 마감.
3. **지급 요건 3가지**를 채워야 실제 입금됨:
   - **주소 확인(PIN)**: 누적 $10 도달 시 구글이 우편으로 PIN 발송 → 입력.
   - **세금 정보**: AdSense에서 세금 양식 제출(한국 개인은 보통 간단).
   - **결제 수단(수취 은행 계좌)** 등록 — 한국은 **전신환(은행 송금)** 방식으로 원화 입금.
4. **지급 기준액 $100** (약 13~14만원). 월말 누적이 $100을 넘으면 **다음 달 21~26일경 등록한 계좌로 자동 입금**. $100 미만이면 다음 달로 이월.
5. 즉, 월 5~10만원 목표라면 **한 달에 바로 입금되진 않고**, 누적이 $100 넘는 시점(약 1.5~2개월치)에 처음 입금되고 이후로는 매월 입금됨.

요약: **AdSense 계정 → 사이트 승인 → 은행계좌·세금·PIN 등록 → $100 넘으면 매달 계좌로 자동 송금.**

---

## 9. 핵심 주의사항 / 함정 (과거에 겪은 것들)

- **정적 익스포트라 `next start` 안 됨** → playwright는 `pnpm build && npx serve out -l 3100`. 게임 늘면 빌드 오래 걸려 타임아웃 상향(현재 240s).
- **엔진에 Math.random 금지** — 순수성 깨지면 골든테스트/되감기 붕괴.
- **worker는 @/ 별칭 못 씀** → `../src/lib/leaderboard` 상대경로.
- **per-game OG 이미지**(ImageResponse): `background` 축약 금지(→ backgroundColor/backgroundImage 분리), div에 자식 2+면 `display:flex` 필요, 텍스트는 단일 노드.
- **leaderboard.ts 제어문자 정규식**은 `/[\u0000-\u001f\u007f]/g` (리터럴 제어문자 붙여넣기 금지 — 유니코드 이스케이프로 작성).
- **엣지 캐시**: 새 경로 배포 직후 잠깐 stale 404 가능(수초 해소). 배포 검증은 여유 두고.
- **Browse/스크린샷**: 클라이언트 하이드레이션 전 스냅샷이라 흰 화면 나올 수 있음 → settle 후 별도 호출로 재확인.
- **워크플로우 opt-in**: Workflow 툴은 사용자가 명시적으로 원할 때만. 이 프로젝트는 사용자가 "너네끼리 회의해서 디벨롭" 하라고 반복 요청함 = 게임 발명에 Workflow 사용 승인됨.

---

## 10. 계정 & 크레덴셜

- **이메일**: yyh7654@gmail.com
- **브랜드명**: Quick MiniGames
- **제작자 핸들**: Pious Angel
- **도메인**: quickminigames.site (Gabia 구매 → Cloudflare 존)
- **Cloudflare**: wrangler OAuth 로그인됨(`wrangler login`). API 토큰(zone 전용)은 존/DNS용.
- **git**: main 브랜치가 배포 소스. 기능은 `feature/*` 브랜치 → `--no-ff` 머지 → main.
- **커밋 규칙**: 메시지 한국어, 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## 11. 다음 세션 시작 시 첫 명령 추천

```bash
# 1) 상태 확인
git log --oneline -5
git status --short
curl -s -o /dev/null -w "%{http_code}" https://quickminigames.site/   # 200 확인

# 2) AdSense 상태 확인 — 코드가 아니라 메일함이 답을 준다 (Gmail MCP 연결됨)
#    from:adsense-noreply@google.com  → 승인 메일이 왔는가?
grep -n "adsense" src/lib/siteConfig.ts
```

**AdSense는 "승인 났나요?"가 아니라 "프로필(주소·전화 인증) 하셨나요?"부터 묻는다**(7.2).
2026-07-16 기준 그 앞 단계에서 멈춰 있었다. 아직이면 게임 생산(7.3)·UI/UX(7.4)를 이어간다.
