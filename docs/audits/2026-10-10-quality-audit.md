# 품질 감사 2026-10-10 (109개 게임, 코드+실제 플레이)

# minigames-hub 개선 계획 (감사관 14명, 109개 게임, 6축×5점=30점 만점)

## 1. 실제 버그 목록 (severity=bug 전부, 먼저 고칠 것)

`bug` 태그는 35개 게임에 41건이 있다. 영향이 큰 순서로 묶었다. 이 중 일부(⚖ 표시)는 코드 결함이 아니라 밸런스 결함이며 공수가 M이다.

### A. 크래시 또는 플레이 불가 (최우선, 대부분 S)
| 게임 | 위치 | 결함 | 수정 |
|---|---|---|---|
| bankshot | GameBankshot.tsx:252 | rAF 타임스탬프가 t0보다 이르면 p가 음수가 되고 `displayPath[-1]`에서 TypeError가 난다. 페이지 전체가 Application error로 죽는다(8회 중 1회 재현). | p를 `Math.max(0, Math.min(1, …))`로 클램프하고 pathIdx도 `Math.max(0, …)`로 막는다. |
| bankshot | GameBankshot.tsx:570 | 조준 핸들(r=1.6)이 공(r=6)에 완전히 가려져 드래그 조준이 동작하지 않는다. | 공에 pointer-events:none을 주고 r≈12 투명 히트 영역을 맨 위에 둔다. |
| dominoes | GameDominoes.tsx:72 | 바닥에 놓인 타일이 3×2px로 찌그러져 열린 끝 숫자를 읽을 수 없다. | orient='h'일 때 바깥 div에 h-full을 주거나 래퍼를 `h-8 w-16`으로 고정한다. |
| beatline | GameBeatline.tsx:231 | 시작 게이트가 없어 로드 후 3초 안에 입력 없이 게임오버가 된다. | phase 'ready'와 3-2-1 카운트인을 넣고 첫 노트 리드타임을 TRAVEL_TICKS 이상으로 보장한다. |
| offbeat | GameOffbeat.tsx:172 | 자동 시작해서 입력 없이 3.5초 만에 게임오버가 되고, 그 판이 Daily Three 진행에 집계된다. | phase 'ready'를 추가하고 Play again도 ready로 돌아가게 한다. |
| countcircle | engine.ts:262 | 이동해도 플레이어 링은 그대로이고 타깃과 이웃 버튼이 엉뚱한 좌석으로 간다. | 좌석을 survivors 인덱스 기준으로 렌더한다(M). |
| gridlock | GameGridlock.tsx:218 | visibilitychange 클로저가 낡아서 탭을 전환하면 게임이 영구 정지한다. | stateRef를 쓰고 'Paused' 표시를 추가한다. |
| zero-hour | GameZeroHour.tsx:210 | 탭을 숨겼다 돌아오면 재개할 수 없고 Start가 판을 초기화한다. | paused 상태와 Resume을 두고 tick/spawn 시각을 다시 잡는다. |
| zero-hour | GameZeroHour.tsx:443 | 크랙 연출이 이후 새로 스폰된 타일에서 재생된다. | 빈칸에서 {index, seq} 이벤트로 재생하고 restart에서 초기화한다. |
| whack-a-mole | GameWhackAMole.tsx:73 / :81 | 진행 중 Restart가 판을 초기화하지 않는다. 이미 올라와 있던 두더지가 영구히 고정된다. | 항상 newGame을 만들고, 올라와 있는 두더지는 마감 시간을 다시 주거나 내린다. |
| umbra | GameUmbra.tsx:376 | 도착 마커가 판정점보다 36px 앞에 있다. 모바일에서는 이 차이만으로 blown(목숨 감소)이 된다. | 마커를 레인 끝으로 옮기거나 트랙 매핑을 보정한다. |
| umbra | GameUmbra.tsx:484 | Start를 누른 뒤 포커스가 BODY로 빠져 키 입력이 판정되지 않는다. | beginRun 뒤 보드에 focus를 주거나 window 리스너로 옮긴다. |
| interlock | GameInterlock.tsx:489 | 오른쪽 링의 방향 라벨과 아이콘이 반대다. | Ring B의 dir와 J/L 매핑을 서로 바꾼다. |
| cleave | GameCleave.tsx:400 | 마진 미터가 좌우 반대로 그려진다. | A/B의 half와 transformOrigin을 서로 바꾼다. |
| chess | GameChess.tsx:36 | 백 폰이 검은 컬러 이모지로 렌더된다. | U+FE0E 선택자를 붙이거나 SVG 기물 세트로 바꾼다. |
| equate | GameEquate.tsx:501 | 390px에서 키패드가 476px로 넘쳐 0과 9 키가 잘린다. | flex-1 min-w-0으로 바꾸거나 숫자를 5+5 두 줄로 나눈다. |
| mancala | GameMancala.tsx:591 | 래퍼에 relative가 없어 데스크톱에서는 오버레이가 뷰포트 전체를 덮고, 모바일에서는 넘친다. | 래퍼에 `relative`를 추가한다. |
| polytap | GamePolytap.tsx:390 | 보드의 overflow-hidden 때문에 게임오버 오버레이가 잘린다. | 오버레이를 보드 밖 래퍼로 옮긴다. |
| hangman | GameHangman.tsx:193 | 오답마다 보드를 key로 리마운트해서 그림과 글자 애니메이션이 전부 다시 재생된다. | 흔들림만 Element.animate()로 재생한다. |
| number-memory | GameNumberMemory.tsx:143 | 정답 직후 방금 맞힌 숫자가 'Remember this'로 다시 표시된다. | 'correct' phase를 따로 두고 reveal할 때 처음으로 show로 전환한다. |
| clusters | GameClusters.tsx:268 | 패배 시 정답을 공개한다고 안내하지만 공개하는 코드가 없다. | lost 상태에서 못 푼 그룹을 차례로 공개한다. |
| nonogram | engine.ts:123 | 해가 여러 개인 판(5x5의 17%, 10x10의 41.5%)에서는 단서를 다 맞춰도 승리가 되지 않는다. | 단서 충족으로 판정하고, 생성 시 유일해를 검증한다(M). |
| fuse | GameFuse.tsx:226 | 90ms마다 focus()를 호출해 포커스를 빼앗는다. 보드 밖으로 나갈 수 없다. | 의존성을 [focus]로 줄이고, 보드 안에 포커스가 있을 때만 옮긴다. |
| overload | GameOverload.tsx:301 | Retry board가 레벨 1 밀도로 다른 보드를 만든다. | `retryBoard(state)` 엔진 함수를 추가한다. |
| polarity | GamePolarity.tsx:439 | 진행 중에 R을 누르면(F 바로 옆 키) 판이 초기화된다. | status가 running이 아닐 때만 R이 동작하게 한다. |
| duplex | GameDuplex.tsx:307 | ◀/▶로 잠긴 팩에 바로 들어갈 수 있다. | isPackUnlocked로 막고 랩어라운드를 없앤다. |
| tripeaks | registry.ts:2066 | 문구는 체인이 점수를 올린다고 약속하지만 엔진은 체인을 점수에서 뺐다. | 체인 보너스를 확정 점수에 더하거나 문구를 고친다. |

### B. 승리 조건 익스플로잇과 지배 전략 (게임이 성립하지 않음)
| 게임 | 위치 | 결함 | 수정 |
|---|---|---|---|
| overfold | engine.ts:118 | jam으로 핍을 지워도 승리라서 무작위 접기 승률이 99.75~100%다. | 승리 조건을 jam 0개로 바꾸고, streak는 jam 없는 클리어에서만 올린다(M). |
| hogline | engine.ts:519 | 시작하자마자 Bank를 누르면 90점 ≥ 목표 44로 즉시 승리하고 streak도 오른다. | bank 보너스를 houseScore>0일 때만 주거나 비례로 제한한다(S). |
| stakehouse ⚖ | engine.ts:141 | 모든 베팅이 음의 기대값이라 0칩으로 12라운드를 버티면 승리다. | 정보 우위, 최소 베팅, 목표 금액 클리어 조건 가운데 하나로 재설계한다(M). |
| grasp ⚖ | engine.ts:173 | 아무것도 안 잡는 것이 만점(300)이다. | 마진 보너스를 카드값보다 작게 조정한다(S). |
| handful ⚖ | engine.ts:217 | '항상 1개씩' 집기가 평균 368점이고 8개씩은 18.6점이다. | 콤보 보너스를 손 크기에 비례하게 하고 시뮬레이션으로 재검증한다(M). |

### C. 기록과 데일리 무결성
| 게임 | 위치 | 결함 |
|---|---|---|
| word-guess | GameWordGuess.tsx:140 | 데일리에서 진 뒤 정답이 공개되는데, Replay Daily로 다시 이기면 streak와 Wins가 오른다(M). |
| strata | GameStrata.tsx:189 | 패배 시 정답을 공개한 뒤 재도전 결과가 streak와 best에 반영된다. |
| bearing | GameBearing.tsx:210 | 패배 시 보물 좌표를 공개한 뒤 Retry로 한 번 파서 이기면 streak가 오른다. |
| gomoku | GameGomoku.tsx:184 | 종료 후 Undo로 Wins를 무한히 올릴 수 있다(0→1→2 실측). |
| gomoku | GameGomoku.tsx:88 | 2P 모드의 승리가 vs CPU Wins와 리더보드에 반영된다. |
| dominoes | GameDominoes.tsx:153 | 블록 무승부를 패배로 기록한다. |
| ticker | GameTicker.tsx:276 | 손실로 끝난 첫 판에도 'New best!' 승리 오버레이가 뜬다. |
| flywheel | GameFlywheel.tsx:447 | 게임오버의 Peak RPM에 이번 판 peak가 아니라 역대 Best가 표시된다. |

C 그룹은 모두 S다. 다만 데일리 3건은 2장의 공통 `dailyResult` 저장소로 한 번에 해결하는 편이 낫다.

---

## 2. 공통 결함 패턴과 셸·라이브러리 수준 해결책

축별 평균(n=109): clarity 3.50 · mobile 3.34 · feel 2.98 · polish 2.84 · **curve 2.61 · depth 2.46**. depth가 2점 이하인 게임이 57개이고 그중 1점이 11개다. curve가 2점 이하인 게임은 44개다. 사이트 전체에서 가장 약한 곳은 깊이와 난이도 곡선이다.

| # | 패턴 | 해당 게임(데이터 기준) | 공통 해결책 |
|---|---|---|---|
| P1 | **시작 게이트 없음 / 탭 전환 일시정지 없음** | beatline, offbeat, pong, space-shooter, tetris, gridlock (자동 시작). gridlock, zero-hour, whack-a-mole, morse-relay (visibility 처리 버그 또는 누락). flappy, zero-hour (시작 안내 부재) | `useGameLoop({ phase: 'ready'\|'countdown'\|'running'\|'paused'\|'over' })` 훅. 첫 입력 전 대기, 3-2-1 카운트인, visibilitychange 자동 일시정지와 Resume 오버레이, 60Hz 고정 누산기(offbeat의 프레임 의존 문제도 같이 해결)를 기본으로 제공한다. |
| P2 | **포커스 강탈** (state가 바뀔 때마다 focus()) | stakehouse, turntile, fuse, slotter, prismbox, bearing, decant, carousel, sonar (9개) | `useRovingFocus`: 키보드 내비게이션 플래그가 있을 때만 DOM focus를 옮기고, 마운트 시에는 호출하지 않는다. |
| P3 | **키 핸들러가 보드 onKeyDown에만 있음** | countcircle, gridlock, umbra, skew, overdub (mastermind는 키 입력 자체가 없음) | `useGameKeys(map)`: isTypingTarget 가드를 둔 window keydown 리스너. e.repeat를 거르는 옵션도 넣는다(tower-stack). |
| P4 | **결과 오버레이가 결과를 가림** | tic-tac-toe, connect-four, gomoku, hangman, jigsaw, overdub, simon, hogline(마지막 투구) | `GameOverlay`에 `revealDelayMs`(기본 700ms)를 넣어 승리 라인, 정답, fatal 셀을 먼저 보여 준다. |
| P5 | **오버레이가 보드 밖으로 넘침** | number-memory, mancala, sokoban, mastermind, polytap, offbeat, cleave, lagline | `GameOverlay`에 `max-h-full overflow-y-auto`를 넣고, 보드 래퍼에 공통 `min-h`를 둔다. |
| P6 | **첫 판·동점·패배에 'New best'** | ticker, flywheel, ripple, backspace, latch, yahtzee (동점). shadowfit, polarity (variant 색 불일치) | `evaluateBest(prev, score, { hadRecord, minScore, won })` 헬퍼를 두고 제목과 variant 결정을 한 곳에서 한다. |
| P7 | **무승부를 패배로 기록** | dominoes, tic-tac-toe, connect-four, reversi (checkers는 무승부 규칙 자체가 없음) | `recordResult`에 `outcome: 'draw'`를 추가하고, GameOverlay에 중립 `draw` variant를 둔다. |
| P8 | **데일리 재도전으로 기록 조작** | word-guess, strata, bearing, handful, sonar, flapjack, stackpot. streak 조건이 느슨한 게임: splice, overfold | `dailyResult` 저장소: dateISO 키로 첫 완료만 streak와 best에 반영하고, 재플레이는 practice로 표시한다. 진행 상황을 복원한다. |
| P9 | **모드/난이도 혼합 기록, 판 도중 난이도 변경** | pong, connect-four, dots-and-boxes, battleship, golf (wrap), spider (suit), ricochet (endless/daily), solitaire (Undo 후 중복 승리), flow (레벨 건너뛰기) | storageKey 규약 `best:<slug>:<mode>`를 둔다. 난이도를 바꾸면 restart하거나 다음 판부터 적용한다. 딜 단위 `winRecordedRef`를 둔다. |
| P10 | **승리 점수가 상수라 Best가 무의미** | solitaire, freecell, yukon, golf, spider (모두 7200/4500/10000 고정), jigsaw, lights-out, tripeaks | 공통 `winScore({ base, sec, moves, par, multiplier })`. 시간·이동 보너스를 넣고 문구와 맞춘다. |
| P11 | **지배 전략 / 무작위 플레이로 클리어** | overfold, hogline, stakehouse, grasp, handful, ripple, strata, bankshot, ticker, bubble-shooter (교착 53%), overload, decant, splice, shadowfit, bearing, zero-hour, whack-a-mole, aim-trainer, siteswap, overdub | 엔진 테스트용 `simulate(policy, seeds)` 하네스를 만든다. 무작위·탐욕 봇의 승률 상한을 단언으로 넣는다. 감사 결과의 수치(99.75%, 98%, 99.5% 등)가 바로 테스트 기준값이 된다. |
| P12 | **모바일 터치 타깃 과소** | bankshot, hogline, gravwell, slotter, siteswap, dots-and-boxes, gomoku, mahjong, nonogram, mancala, flow, sokoban, spider, kakuro, turntile, overfold | `<HitArea>` 투명 확장 컴포넌트(시각 크기와 히트 크기 분리, 최소 44px). |
| P13 | **390px 가로 넘침 / 헤더 줄바꿈** | 가로 넘침: gridlock, equate, loopgrid, prismbox. 헤더 줄바꿈: minesweeper, rock-paper-scissors, breakout, overfold. 첫 화면 밖으로 밀림: word-guess, tetris, hogline | `cellPx = clamp()` 유틸을 둔다. GameShell 버튼에 whitespace-nowrap을 주고 stat은 최대 3개로 제한한다. |
| P14 | **입력 이벤트 선택 오류** | 지연 반응(onClick): reaction-time, aim-trainer, simon. 되돌릴 수 없는 즉시 확정(pointerdown): ticker, bubble-shooter. 확인 없는 단일 탭 확정: overfold, gomoku, yahtzee | 정책을 정한다. 타이밍 게임은 pointerdown으로 받는다. 되돌릴 수 없는 결정은 pointerup에 이동량 임계를 두거나 두 번 탭해 확정한다. |
| P15 | **잡다한 코드 위생** | localStorage에 try/catch 없음: maze, tic-tac-toe, pong, sokoban, skew, rock-paper-scissors, flappy, simon, kakuro. setState 업데이터 안의 부수효과: ticker, whack-a-mole, mastermind, gem-match, quarry, tic-tac-toe, pong. recordFinish 누락: maze, word-search, sliding-puzzle | `safeStorage` 일괄 치환, lint 규칙, gameStats 호출 누락 테스트. |
| P16 | **registry 문구와 실제 동작 불일치** | tripeaks, grasp, solitaire, freecell, tower-stack, whack-a-mole, rock-paper-scissors, word-guess, deepdive, pinwheel, overload, dots-and-boxes, aim-trainer | 수정 PR마다 registry를 함께 갱신한다. 핵심 약속(점수식, 패널티)은 엔진 테스트에 문구 근거 주석을 단다. |

---

## 3. 개선 배치 계획

### 배치 0 — 버그 일괄 수정과 공통 셸 (최우선)
- **0-a 크래시·플레이 불가**: 1장의 A표 전부. 대부분 S이고, countcircle과 nonogram만 M이다.
- **0-b 익스플로잇**: overfold, hogline(S), grasp(S). stakehouse와 handful은 밸런스 재설계가 필요해 배치 1·2로 넘긴다.
- **0-c 기록 무결성**: C표 전부. 데일리 3건(word-guess, strata, bearing)은 `dailyResult`를 먼저 만들고 그 위에 올린다.
- **0-d 공통 셸**: P1 `useGameLoop`, P2 `useRovingFocus`, P3 `useGameKeys`, P4/P5 `GameOverlay`(revealDelay, overflow, draw variant), P6 `evaluateBest`, P8 `dailyResult`, P15 `safeStorage`. 각각 S~M이고, 이 셸이 2장 표의 게임 60여 개에 그대로 적용된다.

### 배치 1 — 최하위 8개 (11~14점)
| 게임 | 핵심 수정 |
|---|---|
| overfold (11) | ① GameOverfold.tsx:633 터치에서 2단계 탭(선택+미리보기 → 확정)과 동점 크리스 방향 토글 (M) ② :587 핍에 aspect-square (S) ③ :441 헤더 칩 정리 (S) ④ :611 크리스 교차 히트박스 분리 (S) |
| beatline (11) | ① :400 노트 y에서 NOTE_HEIGHT/2 보정 (S) ② engine.ts:155 bpm 킥/하이햇 루프와 마디 패턴 기반 차트 (L) ③ :168 같은 프레임의 miss 전부에 팝업 (S) |
| bankshot (11) | ① :539 첫 쿠션까지 점선 예측선, 조준선 확대 (M) ② engine.ts:126 샷 상한 par+3 또는 별점 (S) |
| hogline (12) | ① :602 마지막 투구 재생이 끝난 뒤 오버레이 (S) ② :465 viewBox를 하우스 주변으로 크롭하고 높이를 vh 기준으로 제한 (M) ③ :519 히트 영역 r≥8 (S) ④ engine.ts:427 기본 파워 0.3 또는 가드 스톤 (S) |
| strata (12) | ① engine.ts:109 querySlices ≤ size-2, 슬라이스를 실루엣(투영)으로 바꾸고 조회 결과는 별도 패널에 표시 (M) ② :495 아이소메트릭 3D 프리뷰 (L) ③ :243 전역 단축키를 보드 범위로 한정 (S) |
| dominoes (13) | ① :540 열린 끝 숫자 고정 배지와 scrollIntoView (M) ② :178 시드 rng를 aiMove에 주입 (S) |
| tripeaks (14) | ① :285 컨테이너 폭에 맞춘 scale, 맨 아래 행 겹침 제거 (M) ② :372 세로형 카드 비율 (S) |
| stakehouse (14) | ① engine.ts:141 EV 재설계(토큰 일부 사전 공개 + 최소 베팅 + 목표 금액) (M) ② :210 토큰 뽑기 애니메이션 (M) ③ :283 마지막 라운드 잭팟 배지 (S) |

### 배치 2 — 하위 9~16위 (14~15점)
| 게임 | 핵심 수정 |
|---|---|
| countcircle (14) | ① :278 플레이어 좌석 아이콘, ←/→ 표기, 투명 히트 패딩 (S) ② :254 window 키 리스너 (P3) |
| bisect (14) | ① engine.ts:95 규칙 재설계: 구간 길이를 먼저 들려주거나 회상 방식 (L) ② :299 결과 타임라인 바 (S) ③ :339 제목을 'Out of lives'로 (S) |
| gridlock (14) | ① :337 window 키와 'Press arrow to start' 대기 (S, P1/P3) ② :147 셀 크기 min(9vw, 2.25rem) (S) ③ :77 차량 회전과 이동 transition (M) |
| maze (15) | ① :303 플레이어 고정 대비색, 출구 형태 구분 (S) ② :184 갈림길까지 미끄러지는 스와이프, 벽 충돌 피드백 (M) ③ :145 recordFinish (S) |
| flywheel (15) | ① engine.ts:58 PERFECT_FRAC≈0.15, GOOD_FRAC≈0.35, early/late 패널티 완화 (S) ② :229 판정 텍스트와 오프셋 틱 (S) ③ :262 newBest 조건 (P6) |
| handful (15) | ① engine.ts:217 점수식 재설계 후 시뮬레이션 검증 (M) ② engine.ts:183 시작 크기 2~3 (S) ③ :236 데일리 재플레이 처리 (P8) |
| interlock (15) | ① :438 홈 아크 목표 색 띠 (M) ② engine.ts:52 Easy 3~5수, daily 8~12수 (S) |
| jigsaw (15) | ① :412 정답 칸 하이라이트를 횟수 제한 Hint로 옮기고 오답 피드백 (M) ② :186 조각을 칸에 꽉 차게 배치 (M) ③ engine.ts:437 시간·오답·힌트를 점수에 반영 (M) |

### 배치 3 — 하위 17~24위 (15~16점)
| 게임 | 핵심 수정 |
|---|---|
| grasp (15) | ① 0-b 밸런스 수정 뒤 :367 손패·버림 애니메이션 (M) ② registry.ts:2575 문구 갱신 (S) |
| offbeat (15) | ① :148 60Hz 고정 누산기 (S, P1) ② :279 일정 사이클 뒤 아크 페이드아웃, MIN_GAP 이후에도 싱코페이션 증가 (M) ③ :130 콤보 배지 1개만 유지 (S) |
| minesweeper (16) | ① engine.ts:47 첫 클릭 칸과 이웃 8칸을 지뢰 후보에서 제외 (S) ② :243 길게 누르기 깃발과 코드 동작 (M) ③ :159 헤더 한 줄 유지 (S) ④ engine.ts:1 Intermediate 난이도 (M) |
| tic-tac-toe (16) | ① engine.ts:109 동점 수 무작위 선택, Normal 난이도를 기본값으로 (S) ② P4·P7 셸 적용 |
| nonogram (16) | ① :222 실시간 Mistakes 제거 또는 Check 버튼 (S) ② engine.ts:75 픽셀아트 30종 이상 큐레이션 (L) ③ :294 모바일 행·열 잠금 드래그 (M) |
| number-memory (16) | ① :229 오버레이 넘침 (P5) ② :329 칩과 제목의 레벨 표기 통일, 입력값과 정답 diff 표시 (S) ③ engine.ts:45 시작 레벨 3 (S) |
| zero-hour (16) | ① engine.ts:183 숙성 곡선(값이 올랐다가 감소) 또는 리스폰 제거 (M) ② :240 'Tap to start' (P1) |
| ripple (16) | ① engine.ts:85 RING_MAX_R를 140~180으로 줄이고 쿨다운 (S) ② engine.ts:137 연속 스폰 1~1.5초 간격 (S) ③ :357 첫 판 'New best' (P6) |

### 배치 4 — 16~17점 대역 중 영향이 큰 8개
| 게임 | 핵심 수정 |
|---|---|
| ticker | engine.ts:61 warming 구간에 음수 꼬리를 넣고 탐욕 전략 승률 상한 테스트 (M). :448 onClick 확정 (S) |
| splice | engine.ts:583 사이클 간선 추가, 레벨에 따라 par 증가 (M). :637 포커스 링 제거 (S). :320 'Daily' 라벨, par 이내 클리어에서만 streak (S) |
| turntile | :420 pivot을 14px 점으로(히트 영역 44px), 뒷면 표시 (M). engine.ts:98 Daily를 easy 설정으로 (S) |
| loopgrid | :391 슬라이드 애니메이션 (M). engine.ts:91 Easy 스크램블 6~8수와 힌트 (M). :317 6×6 모바일 넘침 (S) |
| whack-a-mole | engine.ts:86 헛스윙 패널티와 적중률 표시 (S) |
| pong | :221 서브 대기와 득점 후 정지 (P1). engine.ts:148 플레이어 패들 속도 제한, Hard CPU 예측과 오차 (M) |
| bubble-shooter | engine.ts:301 5발마다 천장 하강 (M). :337 pointerup에서 발사 (S) |
| sokoban | engine.ts:59 허용 라이선스 레벨셋 30~60개 (L). :262 오버레이 넘침 (P5) |

배치 0-d의 공통 셸이 들어가면 17~19점 대역의 마이너 이슈(포커스, 오버레이, New best, 무승부, 저장소)는 대부분 게임별 1~3줄짜리 적용 작업이 된다. 그래서 별도 배치를 잡지 않고 셸 적용 PR로 처리한다.

---

## 4. 도전 링크 확산 대상 (has_challenge=false, challenge_feasible=true)

**해당 게임은 90개다.** 이미 링크가 있는 게임(T/T, 9개): siteswap, morse-relay, shadowfit, slosh, polarity, fizzbeat, hunch, lagline, recoil. 도입이 불가능하다고 표시된 게임(F/F, 10개): tic-tac-toe, space-shooter, dots-and-boxes, reactor, chess, checkers, connect-four, sudoku, reversi, kakuro.

데이터에서 보이는 불일치 3건:
- sudoku는 F/F로 표시됐지만 감사관이 "엔진이 rng 주입을 지원한다"며 ?seed= 링크를 권했다. chess(:170)도 시드 rng 주입을 권했다. feasibility 플래그를 다시 확인할 필요가 있다.
- ricochet은 `?seed=` 공유가 이미 있다고 적혀 있지만 has_challenge=false로 표시됐다.

**선행 조건**: 배치 0-c의 `dailyResult`가 먼저 들어가야 한다. 데일리 재도전 조작이 남아 있는 상태에서 링크를 퍼뜨리면 링크 점수의 신뢰도가 없다. 지배 전략이 남아 있는 게임(overfold, hogline, stakehouse, grasp, handful, ripple, strata, bankshot)은 밸런스를 고친 뒤에 넣는다.

**P1 — 데일리·퍼즐형, 시드로 판 전체가 결정됨 (먼저 도입)**
2048 (Game2048.tsx:92 구체안 있음), word-guess, quadle, clusters, equate, flow, unblock, nonogram, minesweeper, lights-out (par와 함께), sliding-puzzle, sokoban, freecell, spider, pyramid, golf-solitaire, solitaire, yukon-solitaire, tripeaks, mahjong, loopgrid, duplex, pinwheel, ricochet (기존 seed 정리), sonar, quarry, deepdive, flapjack, prismbox, bearing, turntile, interlock, decant, splice, carousel, stackpot, prospector, cleave

**P2 — 시드 rng로 재현 가능한 점수 경쟁형**
tetris, gem-match, bubble-shooter, snake, flappy, breakout, tower-stack, memory-game (엔진이 rng를 받음, 구체안 있음), battleship (구체안 있음), yahtzee, mastermind, hangman, word-search, typing-test, dominoes (:178 rng 주입이 선행), mancala, gomoku, gravwell, overload, overdub, umbra, fuse, slotter, polytap, skew, latch, backspace, cleave, number-memory, simon, whack-a-mole, pong, gridlock, countcircle, offbeat, beatline, zero-hour, flywheel, ticker

**P3 — 밸런스 수정 후 도입하거나 효용이 낮음**
overfold, hogline, stakehouse, grasp, handful, ripple, strata, bankshot, bisect, jigsaw (지배 전략 해소 후). reaction-time, aim-trainer (시드 효용 낮음). rock-paper-scissors (Smart CPU가 생기기 전에는 의미 없음).

---

## 5. 상위 게임 — 건드리지 말 것

21점이 4개 동점이라 11개를 적는다.

| 게임 | 점수 | 유지 이유(감사 근거) | 허용하는 손질 |
|---|---|---|---|
| recoil | 25 | 반동 이동, 고스트 궤적, 마우스와 터치 조준 모두 정상, 콘솔 에러 없음 | 'Shots N / par N' 라벨 통합 |
| lagline | 25 | 지연 큐와 사망 원인 표시로 규칙이 화면에서 바로 읽힘, feel 5점 | 모바일 오버레이 넘침(P5 셸로 해결), ▼ 대신 Stay 글리프 |
| hunch | 24 | 6축 모두 4점, 테스트·예측·판정 루프가 명확함 | 거절 카드 겹침과 배지 위치 |
| unblock | 23 | 드래그·탭 이동, 축 잠금, par 비교가 갖춰짐, 최적해 클리어 확인 | 전체 클리어 연출, par 별 표시, BFS 힌트 |
| fizzbeat | 23 | 룰 칩, 미리보기, 판정·사운드가 촘촘함, depth 4점 | 0번 페이즈를 시드로 변주, 모바일 Pause 버튼 |
| 2048 | 22 | 슬라이드, 병합, 스와이프가 모두 안정적임 | 도전 링크(P1), 입력 큐 |
| flow | 22 | 경로 보정, 되감기, 터치 정상 | **Best 지표 버그(major/S)는 고쳐야 함**: 클리어한 레벨 수로 바꾼다 |
| connect-four | 21 | 그룹 내 손맛 최상(디스크 낙하 바운스) | P4 오버레이 지연, P7 무승부, 난이도 변경 시 restart |
| sudoku | 21 | 유일해 보장, 메모, 충돌 하이라이트 | peer 메모 자동 정리, Undo, 시드 |
| reversi | 21 | 코너 가중 alpha-beta AI, 리플 뒤집기 | 앞·뒷면 두 장으로 색 전환 연출, 무승부 기록 |
| kakuro | 21 | 런 하이라이트와 콤보 도우미, polish와 depth 4점 | 모바일 maxWidth, 자동 다음 칸 이동 |

원칙: 이 게임들의 코어 루프와 밸런스는 바꾸지 않는다. 공통 셸 적용과 위 표의 S급 손질만 한다.

---

## 6. 점수 분포 요약
- **평균 17.72 / 30** (축당 2.95/5), **중앙값 18**, 최저 11, 최고 25.
- 분포: 11~14점 11개 · 15~16점 17개 · 17~18점 41개 · 19~20점 29개 · 21점 이상 11개.
- 축 평균: clarity 3.50 > mobile 3.34 > feel 2.98 > polish 2.84 > curve 2.61 > **depth 2.46**.
- **하위 15개**: overfold 11, beatline 11, bankshot 11, hogline 12, strata 12, dominoes 13, tripeaks 14, stakehouse 14, countcircle 14, bisect 14, gridlock 14, maze 15, flywheel 15, handful 15, interlock 15. jigsaw, grasp, offbeat도 15점 동점이다.
- 하위 15개 중 12개에 bug 태그가 있고, 하위 5개는 모두 승리 조건 익스플로잇, 크래시, 즉사 시작 가운데 하나를 갖고 있다. 점수가 낮은 주원인은 콘셉트보다 버그와 밸런스 결함이다. 배치 0만 해도 하위권 점수가 오를 여지가 크다고 본다(추정이며 재감사로 확인이 필요하다).

---

## 원자료(낮은 점수 순)

### overfold — 11/30 {"clarity": 2, "feel": 3, "mobile": 2, "curve": 1, "depth": 1, "polish": 2} challenge=False/True
접기라는 아이디어는 독창적이다. 하지만 jam으로 핍을 지워도 승리로 쳐서 무작위로 접어도 거의 100% 클리어되고, 핍이 알약 모양으로 찌그러지며, 모바일에서는 미리보기를 볼 수 없어 현재 상태로는 퍼즐로 성립하지 않는다.
- [bug/M] `src/lib/games/overfold/engine.ts:118` — isWon이 '핍 0개'만 검사하는데, 서로 다른 색이 겹쳐 생긴 JAM도 핍을 없앤다. 그래서 아무렇게나 접어도 이긴다. 실제 플레이에서 첫 크리스만 반복 탭했더니 Score 0인데 'Sealed!'가 뜨고 데일리 streak도 1 올랐다(overfold-m-2). 무작위 접기 시뮬레이션 승률은 레벨 1~10 모두 99.75~100%였고, 60~82%는 par 이하였다.
  - 수정: 승리 조건을 '모든 쌍이 seal됨'(jam 0개)으로 바꾸고, jam이 생기면 패배 처리하거나 큰 감점과 별점 박탈을 준다. 데일리 streak는 jam 없는 클리어에서만 올린다.
- [major/S] `src/components/games/GameOverfold.tsx:587` — 핍이 h-3/5 w-3/5 rounded-full이라 셀 비율을 그대로 따른다. 4x2 보드에서는 핍이 세로로 늘어난 알약 모양으로 그려진다(overfold-m-0).
  - 수정: aspect-square로 크기를 고정한다(예: h-auto w-3/5 aspect-square, 또는 min(셀 너비, 셀 높이) 기준).
- [major/M] `src/components/games/GameOverfold.tsx:633` — 미리보기(seal/jam 하이라이트)가 onMouseEnter에서만 갱신된다. 터치에서는 탭이 곧바로 확정이라, 핵심 계획 도구인 고스트 미리보기를 모바일에서 볼 수 없다. 동점 크리스에서 'high' 방향을 고르는 방법도 Shift+Enter뿐이다(setPrefer는 'low' 리셋에서만 호출됨).
  - 수정: 터치에서는 첫 탭에 선택과 미리보기를 보여 주고 같은 크리스를 다시 탭하면 접히게(2단계) 바꾼다. 동점 크리스에는 방향 토글 버튼을 둔다.
- [minor/S] `src/components/games/GameOverfold.tsx:441` — 헤더에 'Unfolds 3' 칩과 'Unfold (3)' 버튼이 중복된다. 390px 폭에서는 보드 위에 칩·버튼이 4줄로 쌓여 보드가 첫 화면 아래로 밀린다.
  - 수정: Unfolds 칩을 없애고 버튼 라벨만 남긴다. Folds와 Daily도 한 줄로 합친다.
- [minor/S] `src/components/games/GameOverfold.tsx:611` — 세로와 가로 크리스 히트박스(24px)가 교차점에서 겹치고, 나중에 렌더된 가로 크리스가 클릭을 가로챈다(Playwright가 'intercepts pointer events'로 확인). 중앙 부근을 탭하면 의도하지 않은 축으로 접힐 수 있다.
  - 수정: 교차 영역을 피해 크리스 핸들을 셀 경계 중간에만 두거나, 선택 중인 크리스의 z-index를 올린다.

### beatline — 11/30 {"clarity": 2, "feel": 2, "mobile": 3, "curve": 1, "depth": 2, "polish": 1} challenge=False/True
로드 즉시 노트가 떨어져 사용자가 규칙을 읽는 사이 목숨을 잃고 3초 내 게임오버가 나는 치명적 흐름 결함이 실제로 재현됐다. 음악 없는 랜덤 배치와 판정선-노트 오프셋 때문에 리듬게임 손맛도 약하다.
- [bug/M] `src/components/games/GameBeatline.tsx:231` — 시작 게이트 없이 마운트 직후 rAF가 틱을 진행해 노트가 바로 떨어진다. 실측: 로드 후 약 1.8초 만에 입력 없이 목숨 4개 중 2개 소실, 3초 내 Run over(데스크톱·모바일 모두). 스테이지1 첫 노트가 tick 31(310ms)에 판정선 도달 가능.
  - 수정: phase 'ready' 추가: 첫 입력/Start 버튼 후 틱 시작 + 3-2-1 카운트인, 첫 노트 최소 리드타임(TRAVEL_TICKS 이상) 보장
- [major/S] `src/components/games/GameBeatline.tsx:400` — 노트의 top이 판정선에 닿는 순간이 정타(remaining=0)라 노트 본체(26px)가 선 아래에 있다. 노트 중심이 선에 겹칠 때 누르면 약 54ms 일찍 눌러 Perfect(±50ms) 창을 벗어난다.
  - 수정: y 계산에서 NOTE_HEIGHT/2를 빼 노트 중심이 판정선과 일치하도록 보정
- [major/L] `src/lib/games/beatline/engine.ts:155` — 음악/메트로놈이 없고 노트가 density 확률로 랜덤 슬롯에 배치돼 '리듬'이 아니라 반응 테스트에 가깝다. 히트음만 재생.
  - 수정: bpm 박자에 맞춘 킥/하이햇 synth 루프를 재생하고, 차트를 마디 패턴 기반으로 생성
- [minor/S] `src/components/games/GameBeatline.tsx:168` — advanceTick에서 같은 프레임에 여러 노트가 miss돼도 마지막 하나만 팝업/플래시 됨.
  - 수정: tick 결과에서 새로 missed된 노트 전체에 대해 팝업 생성

### bankshot — 11/30 {"clarity": 3, "feel": 2, "mobile": 1, "curve": 2, "depth": 2, "polish": 1} challenge=False/True
발사할 때마다 확률적으로 페이지 전체가 크래시하고, 핵심 조작인 드래그 조준이 공에 가려 아예 동작하지 않는다. 플레이 가능한 상태로 보기 어렵다.
- [bug/S] `src/components/games/GameBankshot.tsx:252` — Fire 후 rAF 콜백의 타임스탬프 t가 effect에서 잡은 t0=performance.now()보다 이를 수 있어 p=(t-t0)/1300이 음수가 됨 → 404행 pathIdx=floor(음수)=-1 → displayPath[-1] undefined → wuPt(undefined).x에서 TypeError. 페이지 전체가 'Application error' 화면으로 죽음. Playwright로 재현: 첫 실행 데스크톱·모바일 모두 크래시, 반복 시험 8회 중 1회 크래시(스택: wuPt=D 'reading x')
  - 수정: p = Math.max(0, Math.min(1, (t - t0)/ANIM_DURATION_MS)) 로 클램프하고, pathIdx도 Math.max(0, …)로 이중 방어
- [bug/S] `src/components/games/GameBankshot.tsx:570` — 드래그 조준 핸들(launch-point, r=1.6)이 그보다 큰 공(r=6, 나중에 그려짐) 아래에 완전히 가려짐. elementFromPoint 결과가 'circle ball'이고 드래그 후 각도/파워 불변(330°/50) 확인. 힌트와 howToPlay가 안내하는 '공에서 드래그'가 동작하지 않음. 핸들 자체도 화면상 5px(모바일 3px)
  - 수정: 공 circle에 pointer-events:none을 주고 투명한 큰 히트 영역(r≈12)을 맨 위에 그리거나, SVG 전체에서 pointerdown을 받아 발사점 기준으로 조준
- [major/M] `src/components/games/GameBankshot.tsx:539` — 조준선 길이가 4+power*0.12 world unit으로 짧고 얇아(0.4) 모바일에서 거의 안 보임. 궤적 예측도 없어 각도 스테퍼 ±1/±10 탭과 감에 의존하게 됨(시작 스크린샷)
  - 수정: 첫 쿠션까지의 점선 예측선(엔진 simulateShot 앞부분 재사용) 표시, 선 굵기·길이 확대
- [major/S] `src/lib/games/bankshot/engine.ts:126` — 샷 제한이나 실패 조건이 없어(FAQ도 'no shot limit'이라고 명시) 무한 재시도로 언젠가 반드시 이김. 난이도는 par 숫자뿐이라 긴장감이 없음
  - 수정: 샷 상한(par+3)을 넘기면 패배 처리하거나 star rating(≤par 3★) 도입

### hogline — 12/30 {"clarity": 3, "feel": 2, "mobile": 2, "curve": 1, "depth": 2, "polish": 2} challenge=False/True
컬링 물리와 하우스 연출은 괜찮다. 그러나 Bank를 누르면 무조건 이기는 치명적 익스플로잇이 있고, 기본값 직선 샷만으로도 점수가 나와 퍼즐로서의 긴장이 없다. 세로로 긴 보드 때문에 모바일 조작성도 떨어진다.
- [bug/S] `src/lib/games/hogline/engine.ts:519` — bank는 남은 샷×15점을 더하는데 목표 점수는 40~52다. 시작하자마자 Bank Score를 누르면 6×15=90 ≥ 44로 즉시 승리한다. 실제로 'Target cleared! Score 90 / Target 44, Shots used 0, Streak 1'이 나왔고, 데일리 스트릭과 승리 기록까지 올라갔다.
  - 수정: bank 보너스를 houseScore>0일 때만 주거나 houseScore×SCORE_SCALE 비율로 제한한다. 아니면 승리 조건을 houseScore 기반으로 따로 판정한다.
- [major/S] `src/components/games/GameHogline.tsx:602` — 마지막 샷을 릴리스하면 reduce가 바로 finished=true가 되어 오버레이가 즉시 뜬다. 그래서 마지막 투구 애니메이션(rAF 재생)이 오버레이에 가려지고, 충돌·종료 사운드도 투구 시작 시점에 재생된다.
  - 수정: displayPositions 재생이 끝난 뒤(advance가 끝날 때) 오버레이와 결과 사운드를 내보내도록 표시용 finished를 지연시킨다.
- [major/M] `src/components/games/GameHogline.tsx:465` — 시트(100×220)를 최대 280px 폭으로 그려 보드 높이가 약 616px다. 1200×900 데스크톱과 390×844 모바일 모두에서 Throw 버튼이 첫 화면 밖에 있다(throwInViewport=false). 하우스와 조작부를 함께 볼 수 없다.
  - 수정: viewBox를 하우스와 핵 주변으로 크롭하거나 높이를 vh 기준으로 제한한다. 모바일에서는 조작부를 보드 위에 겹쳐 고정한다.
- [major/S] `src/components/games/GameHogline.tsx:519` — 드래그로 조준하는 핵 원이 화면에서 약 21×21px라 터치 타깃으로 너무 작다.
  - 수정: 투명한 큰 히트 영역(r≈8 이상)을 따로 겹치거나, 보드 하단 전체에서 드래그를 받게 한다.
- [minor/S] `src/lib/games/hogline/engine.ts:427` — 기본 파워 50%·각도 0°로 그냥 Throw만 눌러도 하우스 중앙 근처에 멈춘다. 3투에 House 7점이 나와 조준 고민이 거의 필요 없다.
  - 수정: 기본 파워를 0.3 정도로 낮추거나, 시드마다 하우스 앞에 가드 스톤을 배치해 직선 샷을 막는다.

### strata — 12/30 {"clarity": 2, "feel": 2, "mobile": 3, "curve": 1, "depth": 1, "polish": 3} challenge=False/True
슬라이스 예산이 한 변 길이보다 커서 Z층을 다 조회하고 오버레이를 따라 칠하면 무조건 이기는 퍼즐이다. 3D 시각화도 없어서 '3D 추론'이라는 콘셉트가 화면에서 드러나지 않는다.
- [major/M] `src/lib/games/strata/engine.ts:109` — 모든 난이도에서 querySlices >= size(easy 6≥4, normal 8≥5, hard 10≥6)라 Z 슬라이스를 전부 조회하면 정답 전체가 공개됨. 게다가 조회한 층의 정답이 guess 그리드에 앰버 오버레이로 그대로 겹쳐 보여 '추론' 없이 따라 칠하기만 하면 됨. 봇이 Z 0~4 조회 후 오버레이 칸 20개를 탭해 첫 제출에 125/125(IoU 1.00) 클리어(데스크톱·모바일)
  - 수정: querySlices를 size-2 이하로 줄이고 슬라이스를 실루엣(투영: 해당 축으로 하나라도 차 있으면 표시)으로 바꾸거나, 조회 결과를 guess 레이어에 직접 겹치지 말고 별도 패널에 표시
- [major/L] `src/components/games/GameStrata.tsx:495` — '3D 복셀 퍼즐'인데 3D 미리보기가 전혀 없고 X/Y/Z 축·층 번호의 방향 관계 설명도 없어 첫 30초에 무엇을 하는지 이해하기 어려움(시작 스크린샷: 숫자 버튼 15개와 빈 5x5 격자만)
  - 수정: 현재 guess를 아이소메트릭으로 그리는 작은 3D 프리뷰(SVG) 추가, 선택한 축/층을 프리뷰에 하이라이트
- [bug/S] `src/components/games/GameStrata.tsx:189` — 데일리 패배 시 AnswerPreview로 정답 전체를 공개한 뒤 Replay Daily가 같은 시드로 reset되고, 다시 맞히면 bumpStreak·best가 반영됨
  - 수정: 데일리 결과는 하루 한 번만 기록(패배 후 재도전은 기록 제외)
- [minor/S] `src/components/games/GameStrata.tsx:243` — window 전역 keydown에서 s=제출, r=리셋, g=조회, 1/2/3=축 변경을 가로채 확인 없이 실행. 페이지 아무 곳에서 's'를 누르면 제출 횟수가 소모됨
  - 수정: 보드 포커스 범위로 한정하거나 제출/리셋에 확인 단계

### dominoes — 13/30 {"clarity": 3, "feel": 2, "mobile": 2, "curve": 3, "depth": 2, "polish": 1} challenge=False/True
레이아웃 줄 타일이 3px로 찌그러져 보드 상태를 전혀 읽을 수 없는 치명적인 렌더링 버그가 있다. 무승부도 패배로 기록된다. 로직은 돌아가지만 지금 상태로는 게임이라 부르기 어렵다.
- [bug/S] `src/components/games/GameDominoes.tsx:72` — 바닥에 깔린 타일 줄이 렌더링되지 않음. 실측하면 줄의 타일이 3x2px로 찌그러져 점선처럼 보인다(데스크톱·모바일 스크린샷 모두 같음). 원인은 orient='h' DominoTile 바깥 div에 높이가 없어서 안쪽 h-full + aspect-ratio가 0으로 계산되는 것. 열린 끝 숫자를 볼 수 없어 사실상 플레이가 안 된다.
  - 수정: DominoTile 바깥 div에 orient==='h'일 때 h-full을 주거나(className에 `${orient==='h'?'h-full':'w-full'}` 추가), 559행 래퍼를 `h-8 w-16`으로 고정 크기로 바꾼다. 더블 타일은 세로로 놓는 처리도 고려한다.
- [bug/S] `src/components/games/GameDominoes.tsx:153` — 블록 무승부(winner===null)를 패배로 처리함. humanWon=false라 bumpRecord('l')·sfx('lose')가 실행되고, 499행 humanResult도 'lose'가 되어 빨간 lose 오버레이에 'It's a draw' 제목이 함께 뜬다.
  - 수정: resolve에서 s.winner===null을 따로 분기해 무승부 카운트(d)를 두거나 기록을 남기지 않고, 오버레이 variant도 중립(또는 win 스타일 + 'Draw')으로 분리한다.
- [minor/S] `src/components/games/GameDominoes.tsx:178` — CPU 수 선택에 Math.random을 직접 주입해서, deal은 시드로 결정되지만 판 전체를 재현할 수 없다(도전 링크·리플레이 불가).
  - 수정: deal 시드에서 파생한 mulberry32 rng를 ref로 보관해 aiMove에 넘긴다.
- [minor/M] `src/components/games/GameDominoes.tsx:540` — 줄이 길어지면 overflow-x-auto 한 줄에 왼쪽부터 쌓이기만 하고, 오른쪽 끝으로 자동 스크롤되거나 줄이 꺾이지 않는다. 모바일에서 새로 둔 타일과 열린 끝을 놓치기 쉽다.
  - 수정: 열린 끝 두 숫자를 줄 밖 고정 배지로 크게 표시하고, 수를 둘 때마다 해당 끝으로 scrollIntoView 한다.

### tripeaks — 14/30 {"clarity": 3, "feel": 2, "mobile": 2, "curve": 3, "depth": 2, "polish": 2} challenge=False/True
플레이 가능한 카드 강조와 탭 플레이는 동작한다(6장 클리어 확인). 하지만 보드가 작고 겹침이 심하며, 핵심 재미인 체인이 점수에 반영되지 않아 문구와 실제 동작이 어긋난다.
- [bug/S] `src/lib/games/registry.ts:2066` — 팁과 FAQ(2066, 2074)는 'longer chains score much higher'라고 약속하지만 engine.ts:316-322는 체인을 점수에서 의도적으로 뺐다(클리어×100+500). 체인 카운터가 화면에 보이는데 점수에는 아무 영향이 없다.
  - 수정: 승리/종료 시 체인 보너스를 확정 점수에 더하거나(단조성 유지 가능) 문구에서 점수 약속을 삭제한다.
- [major/M] `src/components/games/GameTripeaks.tsx:285` — COL_UNIT=26, CARD_PX=52라 맨 아래 10장이 50%씩 겹치고 수트가 가려진다. 탭 영역도 26px다. 주석에는 'scaled up on sm via transform'이라고 적혀 있지만 그런 transform이 없어서 데스크톱 560px 컨테이너 안에서도 보드가 286px로 작게 나온다(스크린샷 확인).
  - 수정: 컨테이너 폭을 측정해 scale을 적용하고(Mahjong 방식), 맨 아래 행은 겹치지 않게 COL_UNIT과 카드 폭을 같게 맞춘다.
- [minor/S] `src/components/games/GameTripeaks.tsx:372` — 카드 높이를 44px로 고정해 가로가 더 긴(52x44) 카드가 된다. 다른 카드 게임과 비율이 맞지 않는다.
  - 수정: 세로형 비율(약 1:1.4)로 바꾸고 행 간격을 조정한다.

### stakehouse — 14/30 {"clarity": 3, "feel": 2, "mobile": 3, "curve": 2, "depth": 1, "polish": 3} challenge=False/True
확률이 완전히 공개되는 컨셉은 좋으나 모든 베팅이 음의 기대값이라 '아무것도 안 하기'가 최적이자 승리 조건이 되는 설계 결함을 실제로 확인했다. 드로우 연출도 빈약하다.
- [bug/M] `src/lib/games/stakehouse/engine.ts:141` — 배당 = 1+(t/g-1)*0.9 이라 칩당 기대값 = 0.9+0.1·g/t ≤ 1 — 모든 베팅이 음의 기대값이고 최적 전략은 12라운드 내내 베팅 안 하기. 실측: 0칩으로 12번 Commit하면 'House closed!' 승리(Bankroll 100).
  - 수정: 정보 우위가 생기도록 설계 변경: 예) 몇몇 토큰을 미리 공개하거나 HOUSE_EDGE>1인 보너스 항아리, 혹은 라운드마다 최소 베팅 강제 + 목표 금액 클리어 조건
- [major/S] `src/components/games/GameStakehouse.tsx:375` — state 변경마다 cardRefs[focus].focus()를 호출해 로드 직후 Pot1이 포커스됨(실측 activeElement=stakehouse-pot)이고, +/Commit 버튼 클릭 후에도 포커스가 카드로 튐.
  - 수정: 키보드 내비게이션으로 focus가 바뀐 경우에만 focus() 호출
- [major/M] `src/components/games/GameStakehouse.tsx:210` — 라운드 결과 연출이 카드 하단 작은 '+N/−N' 텍스트와 항아리 높이 변화뿐 — 어떤 토큰(보석/꽝)이 나왔는지 시각적 드로우 연출이 없어 손맛이 약함.
  - 수정: 항아리별 토큰 뽑기 애니메이션(보석/꽝 아이콘 팝업)과 순차 공개
- [minor/S] `src/components/games/GameStakehouse.tsx:283` — 마지막(12) 라운드는 lastEvent가 'complete'로 덮여 그 라운드의 잭팟 배지가 표시되지 않음.
  - 수정: 잭팟 판정을 lastEvent와 별개로 history 마지막 항목에서 계산

### countcircle — 14/30 {"clarity": 2, "feel": 2, "mobile": 3, "curve": 3, "depth": 2, "polish": 2} challenge=False/True
조세푸스 회피라는 아이디어는 흥미롭지만 이동해도 플레이어 링이 움직이지 않고 타깃·버튼이 엉뚱한 자리로 이동하는 시각 모델 버그가 확인돼 무엇을 하고 있는지 이해하기 어렵다.
- [bug/M] `src/lib/games/countcircle/engine.ts:262` — move가 survivors 배열에서 좌석 id를 맞바꾸고 렌더는 좌석 id 고정 각도로 그리므로, 이동해도 플레이어 링(cyan)은 같은 자리에 그대로 있고 대신 타깃 링/이웃 버튼이 엉뚱한 좌석으로 이동한다. 실측: ArrowRight 2회 후 플레이어 링 transform 불변(50cqw,88cqw). 이후 '왼쪽 이동' 버튼이 물리적으로 인접하지 않은 좌석에 표시됨.
  - 수정: 좌석 위치를 배열 인덱스(survivors 순서) 기준으로 렌더하거나, 이동 시 좌석 id 대신 플레이어 위치만 바꾸도록 엔진 모델 변경
- [major/S] `src/components/games/GameCountcircle.tsx:278` — 좌석이 모두 동일한 빈 원이라 내가 누구인지/이웃 버튼이 무엇인지 구분이 약하고, 이동 버튼만 44px로 커져 원 배치가 비대칭으로 보임(모바일 스크린샷).
  - 수정: 플레이어 좌석을 채운 아이콘으로, 이동 가능한 이웃에 ←/→ 화살표 표기, 히트영역은 투명 패딩으로 확보
- [minor/S] `src/components/games/GameCountcircle.tsx:254` — 키보드 핸들러가 보드 group의 onKeyDown에만 있어 보드에 포커스가 없으면 ←/→가 동작하지 않음(hint는 ←/→ 안내).
  - 수정: window keydown 리스너로 전환

### bisect — 14/30 {"clarity": 3, "feel": 2, "mobile": 4, "curve": 1, "depth": 1, "polish": 3} challenge=False/True
미니멀한 연출과 모바일 탭 조작은 무난하다. 하지만 구간 길이를 모른 채 중점을 맞혀야 해서 결과가 대부분 운이고, 실제 구간도 보여주지 않아 실력이 늘 여지가 거의 없다.
- [major/L] `src/lib/games/bisect/engine.ts:95` — 구간 길이가 30~180틱(0.5~3초)에서 매 라운드 무작위로 정해지고, 끝 신호보다 먼저 탭해야 한다. 플레이어가 중점을 예측할 정보가 전혀 없다. 0.7초 고정 지연으로 친 결과도 PERFECT·MISS가 운으로 갈렸다(데스크톱 MISS -758ms, MISS +267ms / 모바일 PERFECT, PERFECT, OK, MISS).
  - 수정: 구간 길이를 미리 알려주는 방식(예: 첫 라운드에 전체 구간을 한 번 들려주고 다음 라운드에 같은 길이를 반으로 나누기)으로 바꾸거나, 끝 신호를 보고 직전 구간의 중점을 회상해 탭하는 방식으로 규칙을 재설계한다.
- [major/S] `src/components/games/GameBisect.tsx:299` — 탭하면 라운드가 즉시 끝나고 실제 끝 시점은 끝내 보여주지 않는다. 결과로 ±ms만 나와서 구간이 얼마였는지 학습할 피드백이 없다.
  - 수정: resolved 화면에 시작–탭–실제 중점–끝을 보여주는 타임라인 바를 그린다.
- [minor/S] `src/components/games/GameBisect.tsx:339` — 생존 게임인데 게임오버 제목이 "Time's up"이라 실제 종료 이유(목숨 소진)와 맞지 않는다.
  - 수정: 'Out of lives'로 바꾼다.

### gridlock — 14/30 {"clarity": 3, "feel": 2, "mobile": 2, "curve": 3, "depth": 2, "polish": 2} challenge=False/True
규칙은 단순하지만 탭 전환 후 영구 정지 버그, 포커스 없이 키가 안 먹는 문제, 모바일 가로 넘침이 겹쳐 완성도가 낮다. 연출도 이모지 점프 수준이라 손맛이 부족하다.
- [bug/S] `src/components/games/GameGridlock.tsx:218` — visibilitychange 핸들러가 deps [] 로 등록되어 첫 렌더의 state(null)를 클로저로 잡음. 탭을 숨겼다 돌아오면 `state && !state.gameOver`가 항상 false라 running이 false로 남고 게임이 영구 정지됨(Playwright로 hidden→visible 토글 후 4초간 차량 위치 불변, 게임오버 오버레이 없음 확인)
  - 수정: stateRef를 두고 핸들러에서 stateRef.current를 읽거나, deps에 state.gameOver를 넣어 재등록. 정지 중엔 'Paused' 표시 추가
- [major/S] `src/components/games/GameGridlock.tsx:337` — 키 입력이 tabIndex=0 그룹의 onKeyDown에만 걸려 있어 페이지 로드 직후(포커스=BODY) 화살표/WASD가 전혀 동작하지 않음(ArrowRight 후 active lane 불변 확인). 힌트는 'Arrows/WASD pick the green lane'이라 안내와 실제가 다르고, 로드 즉시 게임이 시작돼 클릭해 포커스 주는 사이 시간이 흐름
  - 수정: window keydown 리스너(isTypingTarget 가드)로 옮기거나 마운트 시 그리드에 focus(). 첫 입력 전까지 tick을 멈추는 'Press any arrow to start' 대기 상태 추가
- [major/S] `src/components/games/GameGridlock.tsx:147` — 390px에서 W/E 트랙(36px 셀×5+라벨)이 3열 그리드 w-fit으로 붙어 보드 폭을 넘어감. scrollWidth 417px로 가로 스크롤 발생, E 라벨이 화면 밖으로 잘림(스크린샷 확인)
  - 수정: 모바일에서 셀 크기를 h-7 w-7로 줄이거나 laneLength 표시를 clamp(), 또는 그리드를 max-w-full + 셀을 min(9vw,2.25rem)로
- [minor/M] `src/components/games/GameGridlock.tsx:77` — 차량이 방향과 무관하게 같은 🚗 이모지이고 셀 간 이동이 tween 없이 점프해 흐름이 안 읽힘. 교차로 통과도 중앙 셀이 깜빡일 뿐이라 손맛이 약함
  - 수정: 차선별 회전(transform rotate)과 transform transition으로 셀 이동 보간, 통과 시 +1 팝 연출

### maze — 15/30 {"clarity": 3, "feel": 2, "mobile": 3, "curve": 3, "depth": 2, "polish": 2} challenge=False/True
미로 생성과 타이머 기본기는 있다. 하지만 플레이어와 출구가 같은 색이라 첫 화면부터 헷갈리고, 한 칸씩만 움직이는 입력이라 모바일 Hard는 지루하다.
- [major/S] `src/components/games/GameMaze.tsx:303` — 플레이어는 bg-accent인데 이 페이지의 accent가 녹색이라 출구(bg-neon-green, 290행)와 색이 거의 같다. 스크린샷에서 좌상단 플레이어와 우하단 출구가 같은 초록 원으로 보여 어느 쪽이 나인지 구분이 안 된다.
  - 수정: 플레이어를 고정 대비색(예: amber #fbbf24, 화살촉/얼굴 글리프)으로 바꾸고, 출구는 깃발 또는 링 모양으로 형태를 다르게 한다.
- [major/M] `src/components/games/GameMaze.tsx:184` — 스와이프와 D-pad가 한 번에 한 칸만 움직인다. Hard(16x16)를 모바일로 풀면 수십~수백 번 탭해야 하고, 막힌 방향은 조용히 무시된다(139행 return, 피드백 없음).
  - 수정: 스와이프하면 갈림길이나 막다른 곳까지 미끄러지게 한다(canMove 루프에서 분기 수가 2를 넘으면 정지). 벽에 부딪히면 짧은 흔들림과 'error' 사운드를 낸다.
- [minor/S] `src/components/games/GameMaze.tsx:145` — 클리어해도 recordFinish/recordResult를 호출하지 않는다(gameStats import 없음). 다른 게임과 달리 개인 스탯 패널과 Daily 진행에 집계되지 않는다.
  - 수정: next.solved 분기에서 recordFinish(storageKey.replace(/^best:/, ''))를 호출한다.
- [minor/S] `src/components/games/GameMaze.tsx:150` — localStorage get/setItem(104, 150, 152행)이 try/catch 없이 호출된다. 저장소가 차단되면 클리어 순간 예외가 난다.
  - 수정: try/catch로 감싼다.

### flywheel — 15/30 {"clarity": 2, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 2} challenge=False/True
휠 색이 RPM에 따라 달아오르는 연출과 고스트 마커 아이디어는 좋다. 그러나 perfect 창이 ±18ms 수준이고 판정 피드백이 없어 대부분 RPM이 떨어지기만 한다. 핵심 '가속' 루프가 체감되지 않는다.
- [major/S] `src/lib/games/flywheel/engine.ts:58` — 판정 창이 지나치게 좁다. 40rpm에서 perfect 창은 ±0.012회전으로 약 ±18ms, good 창은 약 ±54ms다. 나머지 존 내 탭은 모두 early/late로 -3rpm이 된다. 실제 플레이에서도 RPM이 40에서 42를 찍은 뒤 33까지 떨어졌다. 대부분의 플레이어는 속도가 오르기는커녕 MIN_RPM 30으로 수렴해, '잘할수록 빨라진다'는 핵심 루프가 작동하지 않는다.
  - 수정: PERFECT_FRAC을 약 0.15, GOOD_FRAC을 약 0.35로 넓히고, early/late를 -1 정도로 완화한다. 또는 good도 +1을 줘 상승 경로를 만든다.
- [major/S] `src/components/games/GameFlywheel.tsx:229` — 탭 판정 결과(PERFECT, GOOD, EARLY, LATE)를 텍스트나 시각으로 보여 주지 않는다. perfect 링 외에는 사운드뿐이라 음소거 상태에서는 빨랐는지 늦었는지 알 수 없어 타이밍을 교정할 수 없다.
  - 수정: 존 위에 등급 텍스트를 띄워 페이드시키고, 탭 순간 마커 위치에 오프셋 틱(early는 왼쪽, late는 오른쪽)을 남긴다.
- [bug/S] `src/components/games/GameFlywheel.tsx:447` — 게임오버 오버레이가 'Peak RPM: {best}'로 이번 런 peak가 아니라 역대 Best를 표시한다. 기록을 못 깬 런에서도 과거 최고치가 보인다.
  - 수정: 종료 시 gameRef.current.peakRpm을 state에 저장해 표시하고, Best는 별도 줄로 보여 준다.
- [minor/S] `src/components/games/GameFlywheel.tsx:262` — 첫 플레이에서는 bestRef가 0이라 시작 RPM 40이 곧바로 peak가 되어, 한 번도 맞히지 못하고 끝나도 'New best! 40'이 뜬다(모바일 런에서 Best 40, 히트 0 확인).
  - 수정: newBest 판정을 peakRpm > max(bestRef, START_RPM)으로 하거나, 최소 1회 hit을 조건으로 둔다.

### handful — 15/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 2, "depth": 1, "polish": 2} challenge=False/True
모든 정보를 공개하는 push-your-luck이라는 발상은 좋지만, 점수식 때문에 '항상 1개씩'이 압도적인 최적해라서 의사결정의 깊이가 사라진다. 기본값 8개 때문에 첫 판이 10초 만에 끝나는 것도 문제다.
- [bug/M] `src/lib/games/handful/engine.ts:217` — 점수 설계가 게임 콘셉트와 반대로 작동한다. 콤보 보너스 5*(combo-1)이 손 크기 보상 g(g+1)/2를 압도해서, 2만 판 시뮬레이션 평균이 '항상 1개씩'은 368점, 2개씩은 84점, 8개씩은 18.6점이었다. 'Bigger handfuls score more'라는 push-your-luck 판단이 사라지고 최적해가 '항상 1개'로 고정된다.
  - 수정: 콤보 보너스를 손 크기에 비례하게 하거나(예: g*(combo-1)) 상한을 두고, 핸드 가치를 초선형(g^2 등)으로 키운다. 그런 다음 시뮬레이션으로 최적 g가 남은 확률에 따라 달라지는지 확인한다.
- [major/S] `src/lib/games/handful/engine.ts:183` — 시작 크기가 maxGrab(8)이라 GRAB만 누르면 30개가 8개씩 4번에 끝난다. 실제로 데일리 한 판이 10초 안에 'Basket cleared! Score 21'로 끝났다(Clean 1·Spoiled 3). 첫인상에서 가장 나쁜 전략으로 유도된다.
  - 수정: 시작 크기를 2~3으로 두거나 확률이 50% 이상인 가장 큰 크기로 설정하고, 첫 판에 크기 조절을 유도하는 코치마크를 넣는다.
- [major/M] `src/components/games/GameHandful.tsx:236` — Daily 'Replay Daily'가 같은 seed로 reset하는데, 뽑는 순서까지 같다. 한 번 해 본 뒤에는 순서를 외워 운 요소 없이 완벽하게 플레이할 수 있고, 그 점수가 best와 리더보드에 들어간다.
  - 수정: daily는 1회만 기록하거나, 재플레이 때는 순서를 다시 섞고 기록하지 않는다.
- [minor/S] `src/components/games/GameHandful.tsx:89` — 마지막 grab의 lastEvent는 썩은 것을 집었는지와 상관없이 'over'라서 'win' 효과음이 난다. 콤보 배지도 마지막 grab에서는 나오지 않는다.
  - 수정: 마지막 grab 결과(clean/spoiled)에 맞는 효과음을 먼저 재생하고 그다음 종료음을 낸다.

### interlock — 15/30 {"clarity": 2, "feel": 3, "mobile": 3, "curve": 2, "depth": 3, "polish": 2} challenge=False/True
헝가리안 링을 웹으로 구현한 시도는 흥미롭고 회전 애니메이션도 있다. 하지만 오른쪽 링 방향 라벨이 반대이고, 목표 상태가 표시되지 않으며, 난이도가 첫 판부터 벽이라 진입 장벽이 크다.
- [bug/S] `src/components/games/GameInterlock.tsx:489` — 오른쪽 링 버튼의 방향 라벨과 아이콘이 반대다. RING_B 순서(0→10→11→12→13→1…)에서 dir=+1은 화면상 시계 방향인데, 버튼은 '↺ Rotate right ring counter-clockwise'로 표시된다. 실제로 클릭했더니 상단 공유 구슬(4)이 오른쪽 위(10)로 이동했다. 즉 시계 방향이다.
  - 수정: Ring B 버튼의 dir를 서로 바꾼다(↺→dir -1, ↻→dir +1). 키보드 J/L 매핑(287-292)도 같이 바꾼다.
- [major/M] `src/components/games/GameInterlock.tsx:438` — 각 색의 '홈 아크'가 어디인지 화면에 표시가 없다. 구슬 숫자만 있어서, 바깥 왼쪽 호=1, 안쪽 호=2/4 같은 목표 상태를 사용자가 알 수 없다. 렌즈 안쪽 8개 구슬이 두 대각선처럼 보여 어느 링에 속하는지도 읽기 어렵다.
  - 수정: 각 홈 아크 트랙에 목표 색 띠(옅은 arc stroke)를 그리고, 링마다 트랙 색을 다르게 하거나 hover 시 해당 링 구슬을 하이라이트한다.
- [major/S] `src/lib/games/interlock/engine.ts:52` — Easy가 12수, Daily/Normal이 20수 무작위 스크램블이라 사실상 완전히 섞인 헝가리안 링이 된다. 인간이 풀기 매우 어렵고, Par=스크램블 수는 상한일 뿐이다. 튜토리얼 단계도 없어서 첫 판에서 바로 벽에 부딪힌다.
  - 수정: Easy를 3~5수로 하고 daily는 8~12수로 낮추거나, 단계별 스크램블(1→2→3…) 연습 모드를 추가한다.

### jigsaw — 15/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 2, "depth": 1, "polish": 2} challenge=False/True
그림 생성과 조각 모양은 예쁘지만, 정답 칸을 알려주는 방식이라 퍼즐 요소가 없다. 놓인 조각이 칸보다 작아 완성 그림도 이어지지 않는다. 점수는 상수다.
- [major/M] `src/components/games/GameJigsaw.tsx:412` — 조각을 고르면 정답 칸이 앰버색으로 바로 표시되고(501·523행), 정답 칸에만 놓을 수 있다. 판단할 게 하나도 없는 탭-탭 작업이 된다. 실제로 3x3을 9번 탭, 2초 만에 풀었다.
  - 수정: 정답 칸 하이라이트는 'Hint' 버튼(횟수 제한, 점수 차감)으로 옮기고, 기본은 아무 칸에나 시도하게 한다. 틀린 칸이면 moves를 늘리고 흔들림 피드백을 준다.
- [major/M] `src/components/games/GameJigsaw.tsx:186` — PieceArt viewBox에 MARGIN(28)을 더해서 놓인 조각 몸통이 칸의 약 64%만 차지한다. 놓인 조각끼리 맞물리지 않고 큰 틈을 두고 떠 있어서, 완성해도 그림이 이어지지 않는다(모바일 스크린샷에서 확인).
  - 수정: 보드의 조각은 칸 크기 기준으로 -MARGIN/L만큼 확장해 배치한다(absolute, inset: -28%). 이렇게 하면 몸통이 칸에 꽉 차고 탭은 이웃 칸으로 넘어간다.
- [major/M] `src/lib/games/jigsaw/engine.ts:437` — 점수가 placedCount*100 + n²*50으로 크기별 상수다. 틀린 시도는 move로 세지 않아서 moves도 항상 n²이다. Best와 리더보드에 의미가 없다(3x3은 항상 1350).
  - 수정: 경과 시간, 틀린 시도 수, 힌트 사용을 점수에 반영하고 크기별 best를 따로 저장한다.
- [minor/S] `src/components/games/GameJigsaw.tsx:604` — 마지막 조각을 놓는 즉시 오버레이가 보드 전체를 블러로 덮어서, 완성된 그림을 감상할 순간이 없다(데스크톱 end 스크린샷).
  - 수정: 승리 후 1~1.5초 동안 완성 그림을 밝게 보여주는 리빌 애니메이션을 넣고 그다음 오버레이를 띄운다.

### grasp — 15/30 {"clarity": 3, "feel": 2, "mobile": 4, "curve": 2, "depth": 1, "polish": 3} challenge=False/True
푸시유어럭 구조지만 수식상 카드를 하나도 안 잡는 것이 만점(300)이라는 지배 전략이 실제 플레이로 확인돼 게임이 성립하지 않는다. 모바일 버튼 배치는 무난하다.
- [bug/S] `src/lib/games/grasp/engine.ts:173` — 그랩 1회의 마진 보너스 손실(Normal 13, Easy 17, Hard 10)이 카드 최대값(6/5/7)보다 커서 어떤 카드를 잡아도 점수가 줄어든다. 실측: 전부 RELEASE = 300점(만점), 5·6만 7장 잡기 = 249점. 최적 전략이 '아무것도 안 잡기'.
  - 수정: 마진 보너스를 카드값보다 작게(예: MARGIN_BONUS_MAX 30) 하거나 클리어 보너스를 잡은 카드 합에 배수로 연동해 잡기에 인센티브 부여
- [major/M] `src/components/games/GameGrasp.tsx:367` — 카드 공개가 숫자 박스 0.16s 슬라이드뿐이고 잡기/놓기에 카드가 어디로 가는지(손패/버림) 피드백이 없어 손맛이 약함.
  - 수정: 잡은 카드를 하단 손패 줄로 날아가게, 놓은 카드는 옆으로 버리는 애니메이션 + 점수 플로팅
- [minor/S] `src/lib/games/registry.ts:2575` — strategy 문구 'weigh each card’s value against the margin it will cost you'가 실제로는 항상 마진이 이기는 수식이라 오해를 유도.
  - 수정: 밸런스 수정 후 문구 갱신

### offbeat — 15/30 {"clarity": 3, "feel": 3, "mobile": 3, "curve": 2, "depth": 2, "polish": 2} challenge=False/True
반전 리듬이라는 아이디어는 좋다. 하지만 로드 즉시 자동 시작돼 아무것도 안 해도 죽고, 프레임레이트에 따라 속도가 달라지며, 진행 아크를 보고 반응만 하면 사실상 무한히 버틸 수 있어 리듬 게임의 손맛과 깊이가 약하다.
- [bug/S] `src/components/games/GameOffbeat.tsx:172` — 마운트하자마자 startGame()으로 rAF 루프가 돌고, 탭하지 않은 박자마다 step()이 'miss'로 목숨을 깎는다(engine.ts:186). 데스크톱·모바일 모두 입력 없이 3.5초 만에 'Offbeat!' 게임오버가 됐고(♡♡♡), recordFinish 때문에 Daily Three 진행이 1/3로 올라갔다.
  - 수정: phase에 'ready'를 추가해 첫 탭(또는 'Tap to start' 버튼)이 들어와야 루프를 시작하게 한다. 게임오버 뒤 Play again도 같은 ready 상태로 돌아가게 한다.
- [major/S] `src/components/games/GameOffbeat.tsx:148` — step()을 rAF 프레임마다 정확히 1번 호출해서 박자 간격(START_GAP 48→MIN_GAP 14)이 프레임 단위다. 120Hz 기기에서는 게임이 2배 빨라지고 판정창도 ms 기준으로 절반이 된다.
  - 수정: Bisect처럼 performance.now() 기반 고정 60Hz 누산기로 tick을 진행한다(dt 누적 후 floor).
- [major/M] `src/components/games/GameOffbeat.tsx:279` — 진행 아크와 라임 목표점이 늘 6시 방향(0.5)이라 리듬 게임이 아니라 '아크가 점에 닿으면 탭'하는 시각 반응 게임이 된다. 아크를 읽어 0.48에서 탭하는 봇이 40초 동안 콤보 306에 14264점을 냈고, 34사이클 이후로는 난이도도 더 오르지 않는다.
  - 수정: 일정 사이클이 지나면 아크·마커를 서서히 페이드아웃해 청각/리듬에 의존하게 하거나, 마커 위치를 박자마다 흔든다. MIN_GAP에 도달한 뒤에도 싱코페이션 빈도를 계속 올린다.
- [minor/S] `src/components/games/GameOffbeat.tsx:130` — 콤보 5 이상이면 히트마다 0.9초짜리 'Combo ×N' 배지를 새로 쌓는다. 빠른 템포(약 4히트/초)에서는 배지가 3~4겹 겹쳐 글자가 뭉개진다(스크린샷 확인).
  - 수정: 배지를 1개만 두고 key만 바꿔 재생하거나, 5·10·25처럼 마일스톤에서만 띄운다.
- [minor/S] `src/components/games/GameOffbeat.tsx:323` — 게임오버 오버레이가 보드(링)보다 커서 아래 힌트 문장 위로 넘쳐 겹친다(데스크톱·모바일 스크린샷).
  - 수정: 보드에 min-height를 주거나 오버레이 내용을 줄인다.

### minesweeper — 16/30 {"clarity": 4, "feel": 3, "mobile": 2, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
룰과 연출은 무난하지만 첫 클릭 안전지대가 없어 시작부터 운에 맡겨야 한다. 모바일 헤더가 깨지고 길게 누르기·코드가 없어 조작성과 깊이가 모두 낮다.
- [major/S] `src/lib/games/minesweeper/engine.ts:47` — 첫 클릭은 클릭한 칸 하나만 지뢰에서 제외한다. 실제 플레이(데스크톱·모바일 각 1회)에서 첫 클릭에 숫자 칸 1개만 열려(revealed=1, '2') 곧바로 찍기를 해야 했다.
  - 수정: placeMines에서 클릭한 칸과 그 8개 이웃을 모두 후보에서 제외해 첫 클릭이 항상 0칸(플러드 오픈)이 되게 한다.
- [major/S] `src/components/games/GameMinesweeper.tsx:159` — 390px에서 Mines 스탯 + Time/Best/Flag 칩 + 음소거 + New Game이 한 헤더에 몰려 3줄로 줄바꿈되고, New Game 버튼 글자가 두 줄로 깨진다(스크린샷으로 확인).
  - 수정: Time/Best를 보드 위 별도 줄로 빼거나, Flag 토글을 보드 아래 큰 토글로 옮겨 헤더를 한 줄로 유지한다.
- [major/M] `src/components/games/GameMinesweeper.tsx:243` — 모바일에서 깃발을 꽂으려면 상단 Flag 모드를 켰다 꺼야 한다. 길게 누르기도 없고, 숫자 칸 코드(주변 일괄 열기)도 없어 9x9에서도 조작이 번거롭다.
  - 수정: pointerdown 타이머로 400ms 길게 누르기를 깃발로 처리하고, 열린 숫자 칸을 탭했을 때 주변 깃발 수가 같으면 이웃을 일괄로 여는 코드 동작을 엔진에 추가한다.
- [minor/M] `src/lib/games/minesweeper/engine.ts:1` — MS_SIZE=9, MS_MINES=10 초급 하나뿐이라 숙련 천장이 낮다.
  - 수정: Beginner/Intermediate(16x16, 지뢰 40개) 난이도 선택을 추가하고 난이도별로 베스트 타임 키를 나눈다.

### tic-tac-toe — 16/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 2, "depth": 1, "polish": 3} challenge=False/False
기본은 깔끔하지만 기본 난이도가 결정적인 무패 AI라 반복할 동기가 거의 없다. 게임이 끝나면 오버레이가 곧바로 보드를 가려 결과를 확인할 수 없다.
- [major/S] `src/lib/games/tictactoe/engine.ts:109` — Hard AI(bestMove)가 점수가 같으면 항상 가장 낮은 인덱스를 고른다. 그래서 같은 수를 두면 매번 똑같은 판이 나오고, 기본 난이도가 Hard(GameTicTacToe.tsx:48)라 최선이 무승부인 고정 패턴이 반복된다
  - 수정: 동점 수 가운데 rng로 무작위 선택한다. 난이도를 Normal(예: 70% 최적)로 하나 더 두고 기본값을 Normal로 바꾼다
- [major/S] `src/components/games/GameTicTacToe.tsx:256` — 모바일 플레이 스크린샷에서 확인함. 게임이 끝나는 즉시 GameOverlay가 보드 전체를 덮어서, 컴퓨터가 어떻게 이겼는지(승리 라인 하이라이트)를 볼 수 없다
  - 수정: 승리 라인 펄스를 600~900ms 보여준 뒤 오버레이를 띄우거나, 결과를 보드 아래 배너로 표시한다
- [minor/S] `src/components/games/GameTicTacToe.tsx:170` — 무승부를 variant 'lose'(빨간 네온)로 표시한다. Hard에서는 무승부가 최선의 결과인데 패배처럼 보인다
  - 수정: draw용 중립 variant를 추가하거나 Hard 무승부를 'win' 톤으로 처리한다
- [minor/S] `src/components/games/GameTicTacToe.tsx:81` — localStorage.setItem이 try/catch 없이 setState updater 안에서 호출된다. 저장소가 막힌 환경에서는 예외가 렌더를 깨뜨린다
  - 수정: 다른 게임처럼 try/catch로 감싼다

### nonogram — 16/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 2, "depth": 2, "polish": 2} challenge=False/True
드래그 칠하기와 단서 디밍 같은 조작감은 괜찮다. 그러나 비유일해 판에서 정답을 맞혀도 승리가 안 되는 실제 버그가 있고, 실시간 Mistakes가 정답 오라클 역할을 하며, 그림도 무작위 노이즈라 퍼즐로서의 핵심 가치가 훼손돼 있다.
- [bug/M] `src/lib/games/nonogram/engine.ts:123` — isSolved가 단서 충족이 아니라 숨겨진 solution 일치로 판정한다. 그런데 newGame(87-99행)은 무작위 그림을 만들 뿐 유일해를 검사하지 않는다. 엔진과 같은 생성법으로 시뮬레이션하니 5x5는 341/2000(17%), 10x10은 83/200(41.5%)의 판에 해가 2개 이상이었다. 모든 단서를 맞게 채워도 '정답과 다르다'며 승리가 되지 않는 판이 흔하다.
  - 수정: isSolved를 '모든 행·열 rowFilledClue/colFilledClue가 단서와 일치'로 바꾼다. 아울러 생성 시 라인 솔버로 유일해를 확인하고 아니면 재생성한다.
- [major/S] `src/components/games/GameNonogram.tsx:222` — Mistakes 카운터가 칠할 때마다 숨겨진 정답과 실시간 비교된 값으로 갱신된다(292행). 칸을 하나 칠해 숫자가 오르는지만 보면 답이 새어 나가므로 추론 퍼즐이 아니게 된다(실측: 칠하자마자 Mistakes 1→3).
  - 수정: 실시간 오답 표시를 없애고 'Check' 버튼을 누르거나 풀이가 끝난 뒤에만 보여준다. 아니면 오답 시 즉시 X 표시와 함께 목숨을 차감하는 피크로스 방식으로 명시한다.
- [major/L] `src/lib/games/nonogram/engine.ts:75` — 그림이 밀도 0.5의 무작위 노이즈인데 레지스트리는 '숨은 그림을 드러낸다'고 약속한다(registry.ts:806,812,822). 다 풀어도 의미 있는 그림이 나오지 않아 보상감이 없다.
  - 수정: 5x5와 10x10 픽셀아트(하트, 고양이, 집 등) 30종 이상을 큐레이션하고 유일해를 검증한 세트로 교체한다. 무작위 모드는 별도로 둔다.
- [minor/M] `src/components/games/GameNonogram.tsx:294` — 390px 모바일에서 Hard 10x10 칸이 27.8px로 측정됐다. 44px 터치 권장치에 크게 못 미쳐 오탭이 쉽다.
  - 수정: 모바일에서는 단서 거터 폭을 줄이고 핀치 줌이나 확대 모드를 제공하거나, 드래그 시 정확도를 위해 행·열 잠금 드래그를 도입한다.

### number-memory — 16/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 2, "depth": 2, "polish": 2} challenge=False/True
넘버패드와 키보드 입력, 카운트다운 바는 깔끔하다. 그러나 정답 직후 이전 숫자가 다시 번쩍이는 버그와 모바일 오버레이 넘침이 실제로 보인다.
- [bug/S] `src/components/games/GameNumberMemory.tsx:143` — 정답을 내면 commit(next)이 phase:'show'에 이전 숫자를 그대로 둔 채 300ms 동안 렌더된다. 실플레이에서 '2' 정답 120ms 뒤 화면에 다시 '2'가 'Remember this'로 표시됐고, 67과 669도 같았다. 방금 맞힌 숫자가 새 문제처럼 번쩍 보인다.
  - 수정: 정답 직후에는 별도 phase('correct')나 input phase를 유지하며 플래시만 보여주고, 300ms 뒤 reveal(nextNumber(...))에서 처음으로 show로 전환한다.
- [major/S] `src/components/games/GameNumberMemory.tsx:229` — 보드가 aspect-[4/3] 고정이라 390px에서 게임오버 오버레이(제목, 버튼, Daily 안내, 리더보드 링크)가 보드 밖으로 넘친다. 스크린샷에서 오버레이가 위쪽 스탯과 New Game 버튼까지 덮었다.
  - 수정: aspect-[4/3]를 min-h로 바꾸거나 over 단계에서 aspect를 해제한다. 아니면 GameOverlay에 overflow-auto와 max-h를 준다.
- [minor/S] `src/components/games/GameNumberMemory.tsx:329` — 실패하면 상단 칩은 'Level 4'인데 오버레이 제목은 'New best! Level 3'이다(reached와 level이 섞여 있다). 사용자가 입력한 오답도 보여주지 않아 어디서 틀렸는지 비교할 수 없다(333행).
  - 수정: over 상태의 칩은 reached를 표시하고, 오버레이에 'You typed 0 / Answer 4148'을 자리별 diff 하이라이트로 보여준다.
- [minor/S] `src/lib/games/numbermemory/engine.ts:45` — 1자리부터 시작하고 노출 시간이 1000+300·level ms라 레벨 1~4가 너무 쉽다. 의미 있는 구간(7자리 이상)까지 매 판 1분 가까이 지루하게 반복해야 한다.
  - 수정: 시작 레벨을 3으로 하거나 '최고기록-2부터 시작' 옵션을 둔다.

### zero-hour — 16/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 2} challenge=False/True
'숫자가 곧 퓨즈'라는 콘셉트와 색상 단계 표시는 직관적이다. 하지만 기다릴 이유가 없어 탭 속도 게임으로 수렴하고, 탭만 바꿔도 런이 날아가는 버그와 크랙 연출 위치 버그가 있다.
- [bug/S] `src/components/games/GameZeroHour.tsx:210` — 탭이 숨겨지면 setRunning(false)만 하고 재개 경로가 없다. 탭 숨김과 복귀를 재현하자 헤더 버튼이 'Start'로 바뀌고 타일 탭이 무시되며(score 45 유지), Start를 누르면 start()가 새 보드를 만들어 점수가 0으로 초기화됐다. 탭만 바꿔도 진행 중인 런이 사라진다.
  - 수정: paused 상태를 따로 두고 복귀 시 'Resume' 오버레이를 띄운다. 재개할 때 nextTickAt과 nextSpawnAt을 now 기준으로 다시 잡고, start()는 진짜 새 게임에만 쓴다.
- [bug/S] `src/components/games/GameZeroHour.tsx:443` — 크랙 연출이 엉뚱한 곳에 나온다. tick()이 크랙된 칸을 null로 비우므로(engine.ts:186) 빈칸 div에는 crack span이 없다. 대신 crackKeys[i]>0이 계속 남아 이후 그 칸에 새로 스폰된 타일이 마운트될 때 빨간 흔들림 애니메이션을 재생한다. restart에서 crackKeys도 초기화하지 않는다.
  - 수정: crack 오버레이를 빈칸 렌더(381행)에도 그리고 일정 시간 뒤 제거한다. 또는 crack 이벤트를 {index, seq} 배열로 관리해 빈칸에서만 재생하고, restart 때 초기화한다.
- [major/M] `src/lib/games/zerohour/engine.ts:183` — 값은 시간이 갈수록 줄기만 하므로 기다려서 얻는 이득이 없다. 항상 즉시 수확하는 것이 최선이라 '가치 대 생존 트레이드오프'라는 설계 의도가 성립하지 않는다. 수확해도 즉시 리스폰되어 보드가 줄지 않으므로 순수 탭 속도 게임이 된다. 실제로 탭 8회 뒤 6초를 쉬자 3스트라이크로 종료됐다.
  - 수정: 기다리는 이유를 만든다. 예를 들어 타일이 일정 틱 동안 '숙성'되며 값이 오르다가 정점 이후 감소하게 하거나, 수확 시 리스폰을 없애 보드 정리 자체에 의미를 준다.
- [minor/S] `src/components/games/GameZeroHour.tsx:240` — Start 전에도 실제 타일이 보드에 그려져 있지만 탭하면 아무 반응이 없다(!running이면 return). 첫 방문자가 타일을 눌러도 무반응이라 고장으로 오해할 수 있다.
  - 수정: 시작 전 보드를 흐리게 하고 중앙에 'Tap to start' 오버레이를 두거나, 첫 타일 탭으로 바로 start()한다.

### ripple — 16/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 1, "depth": 2, "polish": 3} challenge=False/True
연출(링 글로우, 파티클, 블룸)은 괜찮지만, 링이 필드 전체를 덮기 때문에 아무 데나 탭만 해도 영원히 살아남는다. 게임성이 사실상 없고, 부표 스폰도 너무 드물어서 빈 화면을 보는 시간이 길다.
- [major/S] `src/lib/games/ripple/engine.ts:85` — RING_MAX_R(566)가 필드 대각선보다 커서 링 하나가 필드 전체를 쓸고, 결국 화면에 있는 모든 부표를 터뜨린다. 엔진 시뮬레이션(시드 1~5)에서 80프레임마다 중앙만 탭해도 10분 동안 익사 0, 게임오버 0이었다. 지는 게 불가능하고 '공간이 아니라 시간을 조준한다'는 핵심이 무의미해진다.
  - 수정: RING_MAX_R를 140~180 정도로 크게 줄여 링 사거리를 제한하고 링 쿨다운이나 링당 비용을 둔다. 대안으로 부표가 스웰 1회만 버티게 하고 레벨에 따라 스폰 수를 늘린다.
- [major/S] `src/lib/games/ripple/engine.ts:137` — 레벨 0에서는 스웰(5초)마다 부표가 1개만 생긴다. 첫 탭에 초기 부표 3개가 모두 터진 뒤에는 필드가 몇 초씩 비어 있었다(모바일 스크린샷 ripple-m-2, 데스크톱 ripple-d-3). 15초를 플레이한 점수가 50이었다.
  - 수정: 스폰을 스웰과 분리해 연속 스폰(1~1.5초 간격)으로 바꾸고 초기 밀도를 높인다.
- [minor/S] `src/components/games/GameRipple.tsx:357` — bestRef가 0에서 시작하므로 첫 판은 점수가 아무리 낮아도 항상 'New best!' 승리 오버레이가 뜬다.
  - 수정: 기존 기록이 0이면 'New best' 대신 일반 결과 타이틀을 쓰거나, 최소 점수 임계를 둔다.

### ticker — 16/30 {"clarity": 3, "feel": 3, "mobile": 3, "curve": 3, "depth": 2, "polish": 2} challenge=False/True
카드 UI, 텐션 링, 스파크라인 덕분에 읽기 쉽고 Replay seed도 좋다. 다만 무위험인 warming 때문에 단순 탐욕 전략으로 거의 항상 이기고, 손실로 끝난 첫 판에도 'New best!'가 뜨는 판정 버그가 있다.
- [bug/S] `src/components/games/GameTicker.tsx:276` — 첫 판은 best.bestW가 0이라 isNewHigh가 항상 true다. 실제 플레이에서 최종 Worth 42(시작 100에서 손실)로 끝났는데도 초록색 'New best!' 승리 오버레이와 win 사운드가 나왔다(ticker-m-2).
  - 수정: win 판정을 green && (isNewHigh || !hadRecord)로 바꾸고, 손실로 끝난 판은 'New best' 문구를 쓰지 않는다.
- [major/M] `src/lib/games/ticker/engine.ts:61` — warming 구간은 수익률이 +2~8%이고 스냅 확률이 0이라 무위험 양수다. 2000개 시드로 시뮬레이션한 결과, 기대값이 가장 높은 자산을 고르는 탐욕 전략이 99.5%의 판에서 100 이상으로 끝났고(중앙값 401), CASH는 판당 0.2회만 선택했다. 'CASH stays live'라는 설계 의도가 깨져 있다.
  - 수정: warming에도 소액 음수 꼬리(예: 10% 확률로 -4%)를 넣고, cold의 반등 기대값을 키워 CASH와 cold가 실제 선택지가 되도록 RET 테이블을 재조정한다. 엔진 테스트에 탐욕 전략의 승률 상한을 단언으로 추가한다.
- [major/S] `src/components/games/GameTicker.tsx:448` — 선택 버튼이 onPointerDown에서 바로 commit한다. 모바일에서 페이지를 스크롤하려고 버튼 위에 엄지를 올리기만 해도 되돌릴 수 없는 올인 베팅이 확정된다.
  - 수정: onClick(pointerup 이후 확정)으로 바꾸거나, pointerdown과 pointerup 사이의 이동량이 작을 때만 commit한다.
- [minor/S] `src/components/games/GameTicker.tsx:205` — setState 업데이터 안에서 play() 부수효과를 호출한다. StrictMode나 동시성 렌더에서 사운드가 두 번 날 수 있다.
  - 수정: commit 결과를 먼저 계산하고 setState(next)를 한 뒤, 사운드는 업데이터 밖에서 재생한다.

### splice — 16/30 {"clarity": 3, "feel": 3, "mobile": 3, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
색상 글리프, 양쪽 그룹 미리보기, 캐스케이드 배너 등 정보 설계는 괜찮다. 다만 보드가 거의 트리라서 쉽고 레벨이 올라도 par가 변하지 않으며, 클릭한 간선에 포커스 링이 남는 시각 결함이 있다.
- [major/M] `src/lib/games/splice/engine.ts:583` — 생성되는 그래프가 거의 트리다(간선 수 ≈ 노드 수 - 1). par는 레벨 1~10 내내 평균 3.9로 고정이다. 무작위로 끊어도 레벨 1에서 98% 클리어되고, 실제 데일리는 노드 7개짜리 일자 경로였다(splice-m-1). 계획할 거리가 적다.
  - 수정: 사이클 간선을 추가해 '한 번 끊어서는 분리되지 않는' 구간을 만든다. 레벨에 따라 노드와 색 수, 사이클 수를 늘리고 par도 함께 늘린다.
- [minor/S] `src/components/games/GameSplice.tsx:637` — 히트박스 <line>에 tabIndex={-1}이 있어 클릭하면 포커스를 받는다. 브라우저 기본 포커스 링이 그 라인의 바운딩 박스로 그려져, 노드 위에 주황색 사각형이 남는다(splice-m-1 우상단).
  - 수정: 히트박스 라인에 style outline:none을 주거나 tabIndex를 제거한다. 키보드 포커스는 SVG 루트의 커서로만 처리한다.
- [minor/S] `src/components/games/GameSplice.tsx:320` — 모드 토글 라벨이 'Puzzle'인데 실제로는 오늘의 데일리 시드다. 게다가 par보다 1 많은 클리어에도 Streak가 올랐다(Cleared 6/5에서 Streak 1). 데일리라는 정체성과 '최소 컷' 목표가 흐려진다.
  - 수정: 라벨을 'Daily'로 바꾸고, streak는 par 이내 클리어에서만 올리거나 별 등급을 함께 표기한다.

### turntile — 16/30 {"clarity": 2, "feel": 3, "mobile": 3, "curve": 2, "depth": 3, "polish": 3} challenge=False/True
독창적인 2x2 회전 퍼즐이지만 숨겨진 면 정보가 없어 추측 의존도가 높고, pivot 원이 보드를 덮어 가독성이 떨어진다. 로드 시 포커스 강탈 버그도 확인했다.
- [major/S] `src/components/games/GameTurntile.tsx:269` — state가 바뀔 때마다 pivotRefs[focus].focus()를 호출해 로드 직후 첫 pivot이 포커스를 가져간다(실측 activeElement=pivot). 클릭 후에도 포커스 링이 강제 이동하고 스크린리더/키보드 사용자는 헤더를 건너뜀.
  - 수정: 키보드 화살표로 focus가 바뀐 경우에만 focus() 호출(플래그 ref), 초기 마운트에서는 호출 안 함
- [major/M] `src/components/games/GameTurntile.tsx:420` — 44px pivot 원이 52px 타일 위를 대부분 덮어 보드가 원 격자처럼 보이고 타일 색 경계가 가려짐(모바일 스크린샷). 숨겨진 뒷면은 전혀 표시되지 않아 par 18 퍼즐을 기억/추측에 의존.
  - 수정: pivot을 작은 점(시각 14px, 히트영역 44px 투명)으로 바꾸고, 공개된 적 있는 뒷면을 타일 모서리에 작게 표시
- [minor/S] `src/lib/games/turntile/engine.ts:98` — Daily(normal)는 18회 무작위 스크램블인데 뒷면이 보이지 않아 실질적으로 시행착오 게임이 됨 — 첫 판 난이도 곡선이 가파름.
  - 수정: Daily를 easy 설정으로 낮추거나 튜토리얼 3수 퍼즐 제공

### loopgrid — 16/30 {"clarity": 3, "feel": 2, "mobile": 3, "curve": 2, "depth": 3, "polish": 3} challenge=False/True
색상과 숫자를 함께 써서 판이 읽기 좋고 Undo와 데일리도 갖췄다. 다만 이동 애니메이션이 없어 손맛이 약하고, Loopover 특유의 마지막 행 벽을 넘을 도움 장치가 없어 이탈하기 쉽다.
- [major/M] `src/components/games/GameLoopgrid.tsx:391` — 행·열을 순환하면 색이 즉시 바뀌고 0.15초짜리 scale 펄스만 있다. 타일이 미끄러지는 애니메이션이 없어 무엇이 어디로 갔는지 추적하기 어렵다. 같은 행을 연달아 누르면 style이 같아 펄스도 다시 재생되지 않는다.
  - 수정: 이동한 줄의 셀에 translateX/Y(±cellPx)에서 0으로 가는 transition을 주고, 끝에서 넘어오는 타일은 반대편에서 들어오게 한다. key에 pulse.seq를 넣어 매번 재생되게 한다.
- [major/M] `src/lib/games/loopgrid/engine.ts:91` — Loopover류 퍼즐을 무작위 22~32수로 섞는다. 마지막 행·열을 맞추려면 커뮤테이터를 알아야 해서 캐주얼 유저에게는 벽이 생긴다. 힌트도 없고, 이동 후 안내는 'Now tap any arrow to keep going.'뿐이다.
  - 수정: Easy는 scrambleMoves를 6~8로 줄이고, 막혔을 때 쓰는 hint(역스크램블 1수 제시)나 단계형 튜토리얼 보드를 추가한다.
- [minor/S] `src/components/games/GameLoopgrid.tsx:317` — Hard(6×6)는 셀 40px+화살표 36px×2로 보드가 372px라 390px 모바일에서 372/358px로 넘친다. 오른쪽 화살표 열이 잘린다(스크린샷 확인).
  - 수정: n=6일 때 cellPx를 36으로, arrowPx를 30으로 줄이거나 vw 기반으로 계산한다.
- [minor/S] `src/lib/games/games/registry.ts` — 엔진은 'row r은 숫자 r+1 색'이어야 승리인데, howToPlay와 힌트는 'its own single color'라고만 해서 행마다 정해진 목표 색이 있다는 점이 드러나지 않는다.
  - 수정: 각 행 왼쪽에 목표 색 칩을 표시하고, 문구를 'Row 1 = all 1s'처럼 명시한다.

### whack-a-mole — 17/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 2, "polish": 2} challenge=False/True
터치는 pointerdown으로 즉시 반응해서 모바일 조작은 좋다. 하지만 Restart가 판을 초기화하지 않고 두더지가 고정되는 실제 버그가 있고, 헛스윙 패널티가 없어 연타가 최선의 전략이 된다.
- [bug/S] `src/components/games/GameWhackAMole.tsx:73` — Playwright로 재현함. 판 도중의 'Restart' 버튼(300)이 start()를 부르는데, start는 s.over일 때만 newGame()을 만든다. 그래서 점수와 시간이 그대로 이어진다(재시작 전 Score 4/Time 27 → 후 Score 4/Time 26)
  - 수정: running일 때의 Restart는 restart()를 부른 뒤 start()를 호출하거나, start에서 항상 newGame()을 만든다
- [bug/S] `src/components/games/GameWhackAMole.tsx:81` — Playwright로 재현함. start()가 deadlines를 모두 0으로 초기화하지만 이미 올라와 있던 두더지는 그대로 남는다. 숨김 조건(104)이 `deadlines[h] &&`라서 그 두더지는 영원히 내려가지 않는다(재시작할 때 올라와 있던 3번 구멍이 4초 뒤에도 그대로). 탭을 전환해 일시정지한 뒤 재개할 때도 같은 경로를 탄다
  - 수정: start/resume 때 올라와 있는 두더지에 now+moleLife로 마감 시간을 다시 부여하거나 모두 내린다
- [major/S] `src/lib/games/whackamole/engine.ts:86` — 빈 구멍을 치면 misses만 늘고 점수나 시간 패널티가 없으며 misses는 UI 어디에도 표시되지 않는다. 9개 구멍을 연타하는 전략이 지배적이다. registry.ts:600의 'misses cost you time' 설명과도 맞지 않는다
  - 수정: 헛스윙에 -1점 또는 -0.5초를 주거나 정확도 보너스를 넣고, 결과 화면에 적중률을 표시한다
- [minor/S] `src/components/games/GameWhackAMole.tsx:161` — setState updater 안에서 play(), setWhackKeys, setFloats 같은 부수효과를 실행한다. StrictMode나 동시성 렌더에서는 소리가 두 번 날 수 있다
  - 수정: whack 결과를 ref 상태로 계산한 뒤 updater 밖에서 부수효과를 실행한다

### pong — 17/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
네온 트레일과 글로우 연출은 괜찮지만 서브 대기 없이 바로 시작돼 모바일에서는 손대기 전에 지는 경우가 실제로 확인됐다. 패들이 순간이동해 난이도 곡선과 숙련 깊이도 얕다.
- [major/S] `src/components/games/GamePong.tsx:221` — 마운트 즉시 공이 움직이고, 득점 후에도 바로 재서브된다(engine.ts:196,212). 서브 대기나 일시정지가 없다. 실측 결과 데스크톱에서 방치 시 8.5초 만에 CPU 7-0 승리가 났고, 모바일에서는 보드까지 스크롤하는 사이 1-7로 끝나 있었다.
  - 수정: 'Tap / Space to serve' 대기 단계를 추가하고, 득점 후 0.8~1초 정지와 카운트다운을 둔다. 탭이 숨겨지면(visibilitychange) 자동 일시정지한다.
- [major/M] `src/lib/games/pong/engine.ts:148` — 플레이어 패들은 포인터 위치로 순간이동하는데(clampPaddle(input.playerPaddleY), GamePong.tsx:240-246), CPU는 프레임당 3.4/5.6으로 속도가 제한된다. Easy는 거의 지지 않고 Hard도 각도 공략만으로 쉽게 이겨 숙련 천장이 낮다.
  - 수정: 플레이어 패들에도 최대 속도(예: 9~10/frame)를 적용한다. Hard CPU는 볼 도착 지점을 예측하되 반응 지연과 오차를 주고, 랠리가 길어질수록 가속을 강화한다.
- [minor/S] `src/components/games/GamePong.tsx:268` — 경기 중에 난이도를 바꿔도 재시작되지 않는다. Wins 카운터(63-67행)도 난이도 구분 없이 합산되어 Easy 승리로 기록을 쌓을 수 있다. 또 localStorage.setItem이 setState 업데이터 안에서 예외 처리 없이 호출된다.
  - 수정: 난이도를 바꾸면 restart를 호출한다. Wins는 난이도별 키로 분리하고, 저장은 try/catch로 감싸 업데이터 밖으로 뺀다.

### bubble-shooter — 17/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
버블 팝 파티클과 반사 가이드는 보기 좋다. 하지만 압박 메커니즘이 없어 판이 늘어지거나 교착되고, 모바일은 탭하는 즉시 발사돼 조준 미리보기가 불가능하다.
- [major/M] `src/lib/games/bubbleshooter/engine.ts:301` — 천장 하강이나 N발마다 새 줄 추가 같은 압박 메커니즘이 없다. 엔진을 직접 돌린 그리디 봇 시뮬레이션(100판)에서 53판이 300발을 쏴도 클리어도 패배도 아닌 교착 상태로 남았다. 긴장감과 난이도 곡선이 거의 없다.
  - 수정: 매칭에 실패한 발 수를 세어 5발마다 천장을 한 줄 내리거나 상단에 새 줄을 추가한다. 레벨이 오를수록 주기를 짧게 하고 색 수를 늘린다.
- [major/S] `src/components/games/GameBubbleShooter.tsx:337` — onPointerDown에서 조준과 동시에 즉시 발사한다. 터치에서는 손가락을 대는 순간 쏘기 때문에 가이드 라인을 보고 조정한 뒤 쏘는 게 불가능하다. 레지스트리의 '가이드 라인이 경로를 보여준다'는 안내가 모바일에서는 무의미하다.
  - 수정: pointerdown과 pointermove에서는 조준만 하고 pointerup에서 발사한다. 발사대보다 아래로 드래그하면 취소한다. 마우스는 지금처럼 클릭 시 발사를 유지해도 된다.
- [minor/S] `src/components/games/GameBubbleShooter.tsx:128` — 위험선이 cellY(DEATH_ROW=8)≈446에 그려져 발사대(y=450)와 겹친다. 스크린샷에서 선이 발사대를 관통해 경고 역할을 못 하고, 실제 패배 조건은 버블이 발사대 줄에 붙는 순간이다.
  - 수정: DEATH_ROW를 7로 올리거나 선을 cellY(DEATH_ROW)-ROW_H/2에 그린다. 위험선에 근접하면 붉은 펄스 경고를 띄운다.

### sokoban — 17/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 1, "polish": 3} challenge=False/True
네온 크레이트와 링 연출, Undo, 스와이프, D-pad까지 조작 기반은 잘 갖췄다. 하지만 레벨 8개가 모두 튜토리얼급이라 깊이가 거의 없고, 짧은 보드에서는 승리 오버레이가 UI를 덮는다.
- [major/L] `src/lib/games/sokoban/engine.ts:59` — 레벨이 8개뿐이고 모두 빈 방에 박스가 목표 바로 옆에 놓인 튜토리얼 수준이다(Level 8 실측 스크린샷: 열린 방에 박스 4개가 각자 목표 옆에 있다). 데드락을 계획할 일이 없어 소코반 본연의 깊이가 없고, 몇 분이면 'All levels cleared'에 도달한다.
  - 수정: 자유 라이선스 레벨셋(예: Microban, 허용 라이선스 확인)이나 자체 설계 레벨 30~60개를 추가하고 단계별로 데드락 개념을 도입한다. 레벨 선택 화면에는 클리어 표시를 한다.
- [major/S] `src/components/games/GameSokoban.tsx:262` — Level 1~2처럼 보드가 3~5줄로 낮으면 승리 오버레이가 보드 밖으로 넘친다. 390px 실측에서 Best와 'Go Level' 셀렉트, Undo, D-pad 상단을 덮었다.
  - 수정: 보드 래퍼에 min-h(예: min-h-[20rem])를 주고 보드를 세로 중앙에 배치한다. 또는 공용 GameOverlay가 부모보다 클 때 오버레이 영역을 확장하도록 처리한다.
- [minor/S] `src/components/games/GameSokoban.tsx:429` — D-pad 버튼이 40x40px(h-10 w-10)로 실측돼 터치 권장 크기 44px보다 작다. 레벨 시작 시 localStorage 읽기(39행)와 쓰기(129행)도 try/catch가 없어 저장소가 차단되면 예외가 난다. 승리 문구는 'Solved in 1 moves'처럼 단복수가 틀린다.
  - 수정: 버튼을 h-12 w-12로 키운다. 저장소 접근은 try/catch로 감싼다. moves===1이면 단수형 'move'로 표시한다.

### word-search — 17/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
색 구분된 발견 하이라이트와 취소선 연출이 좋다. 다만 대각선 드래그가 조금만 비껴가도 선택이 무너져 모바일 손맛이 크게 깎이고, 난이도 변화도 없다.
- [major/S] `src/components/games/GameWordSearch.tsx:135` — 드래그 끝점이 정확히 직선이나 45° 대각선 위가 아니면 lineBetween이 null을 반환하고, 선택이 시작 칸 하나로 줄어든다. 실측: 1행을 따라 끌다가 한 칸 아래로 비껴가자 선택 크기가 1이 됐다(데스크톱과 모바일 모두). 손가락 대각선 드래그는 거의 항상 비껴간다.
  - 수정: 앵커에서 끝점까지의 각도를 8방향 중 가장 가까운 쪽으로 스냅하고, 길이는 max(|dr|,|dc|)로 투영한다.
- [minor/S] `src/components/games/GameWordSearch.tsx:198` — 완료해도 recordFinish/recordResult를 호출하지 않는다(gameStats 미사용). 개인 스탯과 Daily 집계에서 빠진다.
  - 수정: isComplete 분기에서 recordFinish(storageKey.replace(/^best:/, ''))를 호출한다.
- [minor/S] `src/lib/games/wordsearch/engine.ts:124` — 정답 판정이 '배치된 칸'과의 일치라서, 무작위 채움이 CAT, FOX, RED 같은 3글자 단어를 우연히 다른 곳에 만들면 그 위치를 정확히 드래그해도 error가 난다.
  - 수정: checkSelection을 readLetters(cells)가 미발견 단어(정방향 또는 역방향)와 같은지로 판정하고, 발견 칸을 실제 선택 칸으로 갱신한다.
- [minor/M] `src/components/games/GameWordSearch.tsx:96` — 타이머가 보드 생성 시점부터 돈다. 단어 목록을 읽는 시간도 기록에 포함되고, 난이도나 크기 선택이 없어 판마다 경험이 같다(11x11, 7단어 고정).
  - 수정: 첫 pointerdown에서 타이머를 시작하고, Easy(9x9 정방향만)/Hard(13x13 8방향 10단어) 토글을 추가한다.

### space-shooter — 17/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 2, "depth": 2, "polish": 3} challenge=False/False
클래식 인베이더 연출(글로우, 파티클, 셰이크)은 깔끔하지만, 로드 즉시 게임이 시작되고 피격 무적이 없어 모바일에서는 몇 초 만에 끝나 버린다. 웨이브 변주가 없어 리플레이 동기가 약하다.
- [major/S] `src/components/games/GameSpaceShooter.tsx:335` — 마운트 즉시 rAF 루프가 돌아 시작 화면 없이 적이 움직이고 사격한다. 로드 0.8초 뒤 스크린샷에 이미 적탄 5발이 날아오고 있었고, 모바일 플레이에서는 드래그 몇 초 만에 목숨 3개를 모두 잃었다(Score 180, Wave 1에서 종료).
  - 수정: phase에 'idle'을 추가하고 첫 탭이나 키 입력 전까지 step()을 돌리지 않는다(Flywheel의 idle 패턴 재사용). 탭이 숨겨지면 visibilitychange로 일시정지한다.
- [major/S] `src/lib/games/spaceshooter/engine.ts:258` — 피격 뒤 무적 시간이 없다. 프레임당 1회만 피격으로 막을 뿐이라 탄이 몰리면 연속 프레임에서 목숨이 줄줄이 깎인다. 피격 연출도 셰이크뿐이라(컴포넌트 250-253행) 무엇에 맞았는지 알기 어렵다.
  - 수정: SpaceState에 invuln 프레임(예: 90)을 추가해 그동안 충돌을 무시하고, 함선을 깜빡이게 하며 화면 근처의 적탄을 제거한다.
- [minor/M] `src/lib/games/spaceshooter/engine.ts:312` — 웨이브가 바뀌어도 같은 7x4 포메이션을 다시 만들고 속도만 28%씩 올린다. 적 종류, 패턴, 보너스(UFO), 방어막이 없어 1~2웨이브 뒤에는 새로운 것이 없다.
  - 수정: 웨이브마다 포메이션 모양, 적 발사 확률, 내구도 2인 적 같은 변주를 추가하거나 가끔 보너스 UFO를 넣는다.

### backspace — 17/30 {"clarity": 3, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 2} challenge=False/True
되감기라는 고유 메커닉과 미터, 고스트 트레일 연출이 좋다. 그러나 되감기 버튼이 바로 그 자리의 플레이어 마커를 가리고, 점수 플로팅이 매 틱 쌓이는 시각 결함이 있다.
- [major/S] `src/components/games/GameBackspace.tsx:541` — BACKSPACE 버튼(absolute bottom-3, 중앙)이 마커 충돌 밴드(MARKER_CY=500/560, engine.ts:88)와 같은 높이에 있어 중앙 레인의 플레이어 마커를 가린다(backspace-d-2에서 마커가 대부분 가려짐, 모바일에서도 겹침). 회피 게임에서 자기 위치가 안 보이는 셈이다.
  - 수정: 버튼을 캔버스 아래 별도 행으로 빼거나, 캔버스 위쪽 미터 바 옆으로 옮긴다. 아니면 MARKER_CY를 위로 올리고 하단 여백을 확보한다.
- [minor/S] `src/components/games/GameBackspace.tsx:509` — 점수가 매 틱(60Hz) 오르는데 Score 스탯에 float:true가 걸려 있어, '+1' 플로팅 텍스트가 겹겹이 쌓여 글자가 뭉개진다(backspace-m-1의 Score 칩 위).
  - 수정: Score에서 float를 끄거나, 마일스톤/클러치 보너스 때만 플로팅을 띄운다.
- [minor/S] `src/components/games/GameBackspace.tsx:307` — 첫 판은 bestRef가 0이라 어떤 점수로 끝나도 'New best!'가 뜬다.
  - 수정: 기존 기록이 없으면 일반 결과 타이틀을 쓴다.

### umbra — 17/30 {"clarity": 3, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 2} challenge=False/True
보이지 않는 구간을 외삽해 타이밍을 맞추는 콘셉트는 신선하다. 하지만 화면의 도착 마커가 실제 판정 지점보다 36px 앞에 있어(모바일에선 blown 수준) 정직하게 플레이할수록 손해를 보고, Start 후 키보드가 먹지 않는다.
- [bug/S] `src/components/games/GameUmbra.tsx:376` — 눈에 보이는 도착 마커(cyan 세로선)는 w-9 박스의 border-l, 즉 레인 오른쪽 끝에서 36px 안쪽에 있다. 그런데 엔진의 도착(exitTick)은 x=TRACK, 렌더상 100cqw(레인 맨 끝)이다(343행). 마커선에 맞춰 탭하면 체계적으로 일찍 친다. 데스크톱 vx=8에서는 약 5~6틱, 390px 모바일에서는 약 10틱(blown, 목숨 감소)이다. PERFECT 창은 ±2틱이다.
  - 수정: marble x를 (100cqw - 36px) 트랙에 매핑하거나, 마커선을 레인 맨 오른쪽 끝(right-0의 border-r)으로 옮겨 도착 지점과 일치시킨다.
- [bug/S] `src/components/games/GameUmbra.tsx:484` — 마우스로 Start를 누르면 버튼이 언마운트되면서 포커스가 BODY로 빠진다. 그 뒤 1/2/3 키가 전혀 판정되지 않는다(Playwright: Start 클릭 후 키 입력 시 judgement 0개, 보드를 focus한 뒤에는 1개). 키 핸들러가 보드 div onKeyDown에만 있기 때문이다.
  - 수정: beginRun 후 보드에 focus({preventScroll:true})를 주거나 키 리스너를 window로 옮긴다.
- [minor/M] `src/components/games/GameUmbra.tsx:290` — rAF마다 setState(gameRef.current)로 60Hz 전체 리렌더가 일어난다. 저사양 모바일에서 프레임 지터가 생기면 ±33ms 판정의 시각 단서가 흔들린다.
  - 수정: marble 위치는 ref로 transform을 직접 갱신하고(Overdub 방식), React 상태는 이벤트(스폰/판정)에서만 갱신한다.

### fuse — 17/30 {"clarity": 3, "feel": 2, "mobile": 4, "curve": 2, "depth": 3, "polish": 3} challenge=False/True
한 손 라우팅이라는 설계 의도는 좋고 모바일 터치도 문제없다. 다만 난이도 램프가 너무 느려 초반 수 분이 '퓨즈 하나 눌러 끄기'의 반복이고, 매 틱 포커스를 빼앗는 접근성 버그가 있다.
- [major/S] `src/lib/games/fuse/engine.ts:102` — 스폰 간격이 GAP_START 26틱에서 12개마다 1틱씩만 줄어든다(26→9까지 204개). 초기 퓨즈 길이는 24~40틱이다. 그래서 처음 수 분 동안 보드에 퓨즈가 거의 항상 1개뿐이고, 게임의 핵심인 '방문 순서 라우팅'이 늦게 등장한다. 봇으로 10초 플레이했을 때 동시 퓨즈는 1개, 점수는 4~6이었다.
  - 수정: GAP_RAMP를 3~4로 줄이거나, 시작부터 동시 퓨즈 2개를 보장하는 스케줄(초기 GAP_START≈14)로 바꿔 30초 안에 선택이 생기게 한다.
- [bug/S] `src/components/games/GameFuse.tsx:226` — useEffect가 [focus, state]에 의존해 매 틱(90ms)마다 cellRefs[focus].focus()를 호출한다. 플레이 중 New Game이나 음소거 버튼으로 포커스를 옮겨도 즉시 보드 셀로 되돌아온다(Playwright 확인: New Game focus 후 activeElement가 'Cell 1,1'). 키보드/스크린리더 사용자가 보드 밖으로 나갈 수 없다.
  - 수정: focus 상태가 바뀔 때만 포커스를 옮기도록 의존성을 [focus]로 줄이고, 보드 안에 이미 포커스가 있을 때만 이동한다.
- [minor/S] `src/components/games/GameFuse.tsx:28` — 퓨즈 색(lime=safe, amber=tight, red=doomed)의 의미가 화면 어디에도 범례로 없다. 남은 시간도 막대 높이로만 보여서 '모든 셀이 도달 가능 여부를 알려 준다'는 약속을 처음 30초 안에 읽어 내기 어렵다.
  - 수정: 보드 아래에 3색 범례를 두고, tight/doomed 전환 순간에 짧은 텍스트 배지를 띄운다.
- [minor/S] `src/lib/games/fuse/engine.ts:369` — 해체 1회 점수가 1+tier(최대 4)라 점수 피드백이 아주 작고, 해체 팝 외에는 점수 플로터나 체인 연출이 거의 없다.
  - 수정: 점수 단위를 키우고(예: 10×tier), 해체 셀 위에 +N 플로터와 체인 티어업 배지를 띄운다.

### polytap — 17/30 {"clarity": 3, "feel": 2, "mobile": 4, "curve": 3, "depth": 3, "polish": 2} challenge=False/True
두 시계와 충돌 비트라는 목표는 레인 UI로 잘 보이고 모바일 패드도 동작한다. 하지만 리듬 게임인데 비트 사운드가 없어 손맛이 약하고, 게임오버 오버레이가 잘리고 워밍업 표기가 깨져 보인다.
- [major/M] `src/components/games/GamePolytap.tsx:97` — 폴리리듬 게임인데 박자 클릭/메트로놈 사운드가 없다. play()는 hit/confluence/stray/miss/stage 이벤트에서만 호출되고, 비트마다 울리는 소리가 없다. 플레이어는 시각 스크롤만 보고 박을 세야 해서 'feel it coming'이 불가능하다.
  - 수정: advance()로 정수 tick이 비트 경계를 넘을 때 약한 클릭을, 각 시계 주기 비트에 해당 레인 음색을 재생한다(음소거 시 no-op).
- [bug/S] `src/components/games/GamePolytap.tsx:390` — 보드 컨테이너가 overflow-hidden에 높이가 레인 2개(약 270px)뿐이다. 그래서 게임오버 오버레이의 'New best!' 제목 위쪽과 리더보드 링크 아래쪽이 잘린다(1200px 스크린샷 확인).
  - 수정: 오버레이를 보드 밖(보드+패드 전체를 감싸는 래퍼)에 두거나, 보드에 min-height를 주고 overflow-hidden은 레인에만 적용한다.
- [minor/S] `src/components/games/GamePolytap.tsx:532` — 워밍업 동안 F 패드와 레인, 상단 비율 칩에 '×— beats', 'F —', '— : 4'처럼 대시가 그대로 노출되어 깨진 UI처럼 보인다.
  - 수정: 워밍업 중에는 F 패드에 'joins soon'을 표시하고, 비율 칩은 숨긴다.
- [minor/S] `src/components/games/GamePolytap.tsx:301` — 워밍업에서는 탭하지 않으면 주기가 끝나지 않아 'Cycle 1 / 4 · next collision in 4 beats'에 무한히 머문다(12초 관찰). 워밍업에는 collision이 없는데도 'next collision' 문구가 나온다.
  - 수정: 워밍업은 탭과 무관하게 N주기 후 자동 진행하고, 문구를 'F joins in N beats'로 바꾼다.

### equate — 17/30 {"clarity": 4, "feel": 3, "mobile": 2, "curve": 3, "depth": 2, "polish": 3} challenge=False/True
Nerdle 규칙과 순서 공개 애니메이션, 오류 메시지는 잘 갖췄다. 하지만 모바일에서 숫자 키패드가 화면 밖으로 넘치고, 정답 뱅크가 작아 반복된다.
- [bug/S] `src/components/games/GameEquate.tsx:501` — 숫자 키 10개가 각각 min-w-11(44px)이고 gap-1이라 최소 폭이 476px이다. 390px에서 레이아웃이 433px로 넓어졌고(scrollWidth=innerWidth=433), 스크린샷에서 '0'과 '9' 키가 화면 밖으로 잘렸다.
  - 수정: 모바일에서는 min-w를 제거하고 flex-1+min-w-0으로 하거나 숫자를 2줄(5+5)로 나눈다.
- [minor/M] `src/lib/games/equate/engine.ts:241` — 정답 뱅크가 78개뿐이고 '='은 대부분 6번째 칸에 있다. 연습 모드에서 금방 반복되고 daily도 수개월 안에 중복이 생긴다. 구조가 몇 가지 패턴(XX+XX=XX 등)으로 고정돼 있어 깊이가 얕다.
  - 수정: 검증기 isValidEquation을 이용해 8자 등식을 자동 생성(전수 열거 후 필터)해 뱅크를 수천 개로 늘린다.

### mancala — 17/30 {"clarity": 4, "feel": 3, "mobile": 2, "curve": 3, "depth": 3, "polish": 2} challenge=False/True
씨 뿌리기 애니메이션, 캡처·추가 턴 연출, 방향 안내는 좋다. 하지만 결과 오버레이 위치 버그(데스크톱은 전체 화면, 모바일은 넘침)와 모바일 구멍 밖으로 돌이 넘치는 문제 때문에 마감이 아쉽다.
- [bug/S] `src/components/games/GameMancala.tsx:591` — 오버레이를 감싸는 div에 relative가 없어서 GameOverlay(absolute inset-0)의 기준이 어긋난다. 데스크톱에서는 오버레이가 뷰포트 전체(1200x900)를 덮어 페이지 전체가 블러되고, 모바일에서는 높이 125px 보드에 맞춰져 카드가 위(난이도 버튼)와 아래(스트릭 카드)로 넘친다(실측·스크린샷).
  - 수정: 591행 래퍼에 `relative`를 추가한다(다른 게임처럼 `anim-board-in relative select-none`).
- [major/S] `src/components/games/GameMancala.tsx:84` — 모바일(390px)에서 구멍 지름이 30px인데 7px 돌을 최대 8개 그려서, 5~6개만 돼도 돌이 구멍 원 밖으로 넘친다(sowing 스크린샷). 30px 구멍은 탭 타깃으로도 작다.
  - 수정: 모바일에서는 숫자로 바꾸는 임계값을 4~5로 낮추고, 돌 크기를 구멍 폭 비율로 정한다. 스토어 폭을 줄여 구멍을 키운다.
- [minor/S] `src/components/games/GameMancala.tsx:611` — vs CPU에서 youName이 'You'라 하단 문구가 'You sows this way ▸'로 나와 문법이 틀렸다.
  - 수정: mode==='cpu'면 'You sow this way', 2P면 'Player 1 sows this way'로 분기한다.
- [minor/M] `src/components/games/GameMancala.tsx:310` — Undo가 없고, 난이도를 바꾸면 진행 중인 판에 즉시 적용된다. 엔진이 결정적인데도 수순 복기나 되돌리기를 지원하지 않는다.
  - 수정: 사람 턴 스냅샷 기반 Undo를 추가하고(vs CPU), 난이도 변경은 새 게임부터 적용한다.

### skew — 17/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
모바일 버튼 조작은 편하지만 키보드 입력이 포커스 없이는 동작하지 않고, 결과가 순간이동해 매치 인과가 읽히지 않는다. 좌우 2택 구조라 전략 깊이도 얕다.
- [major/S] `src/components/games/GameSkew.tsx:264` — ←/→ 키 핸들러가 보드 div의 onKeyDown에만 있어, 보드를 먼저 포커스하지 않으면 키 입력이 무시됨(실측: 로드 직후 ArrowLeft → Moves 30 그대로). howToPlay는 '(or press ←/→)'라고 안내.
  - 수정: window keydown 리스너로 전환(isTypingTarget 가드 유지)
- [major/M] `src/components/games/GameSkew.tsx:153` — 캐스케이드 연출이 첫 웨이브 pop과 마지막 웨이브 spawn만 보여주고 중간 웨이브·중력 낙하는 즉시 점프한다. 기울이기도 4° skewX 130ms 후 결과로 순간이동해 무엇이 왜 맞춰졌는지 읽히지 않음.
  - 수정: resolveSteps의 각 wave(clearedGrid→droppedGrid→filledGrid)를 순차 렌더하고, shear는 행별 translateX로 실제 이동 애니메이션
- [major/L] `src/lib/games/skew/engine.ts:92` — 선택지가 매 턴 좌/우 2개뿐이고 좌→우는 서로 상쇄되는 순환 이동이라 계획 여지가 거의 없고 결과가 사실상 운에 좌우됨(깊이 부족).
  - 수정: 특정 행 범위만 기울이는 선택(위/아래 절반) 또는 기울기 강도 선택 추가
- [minor/S] `src/lib/games/skew/engine.ts:253` — 엔진 tilt()/resolveBoard는 마지막 이동(over=true)에서 매치 해소를 건너뜀 — 컴포넌트는 resolveSteps를 직접 써서 우회하지만 엔진 API가 불일치.
  - 수정: resolveBoard의 over 조기반환 제거(shear가 over를 세팅하므로)
- [minor/S] `src/components/games/GameSkew.tsx:115` — localStorage get/set이 try/catch 없이 호출됨(103,115행) — 저장소 차단 환경에서 예외.
  - 수정: try/catch로 감싸기

### prismbox — 17/30 {"clarity": 3, "feel": 3, "mobile": 3, "curve": 3, "depth": 2, "polish": 3} challenge=False/True
빔 경로 시각화와 데일리 구조는 깔끔하다. 다만 원자를 정면으로 맞혀야만 찾을 수 있어 추론보다 포트 소거에 가깝고, 출구와 입구를 짝지어 주지 않아 단서를 정리하기도 어렵다.
- [major/L] `src/lib/games/prismbox/engine.ts:303` — 원자는 정면 히트로만 '발견'되고 위치 추측(guess) 입력이 없다. 32개 포트를 전부 쏘면 무조건 이기므로 추론 퍼즐이 아니라 포트를 고르는 확률 게임이 된다. 원자가 항상 테두리 한 칸 안쪽(1..size-2)에만 놓이는 점도 탐색 공간을 줄인다.
  - 수정: 셀을 탭해 원자 위치를 표시·제출하는 guess 모드를 넣고(오답 시 패널티), 히트 이벤트는 위치를 직접 드러내지 않게 한다.
- [major/S] `src/components/games/GamePrismbox.tsx:267` — [focus, state]가 바뀔 때마다 portRefs[focus].focus()를 호출해서, 로드 직후 activeElement가 'North port, lane 1'로 잡힌다. 이후 발사할 때마다 포커스를 다시 가져가 다른 UI의 포커스를 빼앗는다(보드가 화면 밖이면 스크롤 점프 위험).
  - 수정: 키보드 화살표 입력이 있었을 때만 focus()를 호출한다(플래그로 구분).
- [minor/S] `src/components/games/GamePrismbox.tsx:387` — 셀을 32px로 고정해서 Hard(9×9+포트=352px+패딩)는 390px 모바일에서 보드가 384/358px로 넘쳐 가로 스크롤이 생긴다.
  - 수정: CELL을 min(32px, (100vw-48px)/(size+2))로 계산한다.
- [minor/M] `src/components/games/GamePrismbox.tsx:422` — through/refract 샷의 출구 포트를 따로 강조하지 않고, 이전 샷 경로는 모두 opacity-20 같은 색으로 겹쳐 어느 입구가 어느 출구로 나갔는지 구분할 수 없다.
  - 수정: 샷마다 입·출구 포트에 같은 번호나 색 라벨을 붙인다(Black Box식 짝 표시).

### gravwell — 17/30 {"clarity": 3, "feel": 3, "mobile": 2, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
우주 배경과 궤적 연출이 보기 좋고 원샷 물리 퍼즐로서 명확하다. 다만 드래그 패드가 너무 작아 모바일에서는 스테퍼만 쓰게 되고, 긴 정확한 미리보기 탓에 고민할 거리가 적다.
- [major/S] `src/components/games/GameGravwell.tsx:572` — 드래그 조준 패드가 r=1.4 월드 단위라 모바일 390px에서 약 10×10px(데스크톱 18px)이다. 사실상 터치할 수 없어 스테퍼에만 의존하게 된다.
  - 수정: 패드 위에 투명한 큰 히트 원(r≈5)을 겹치거나, SVG 아무 곳에서나 pointerdown을 받아 패드 기준으로 조준한다.
- [major/S] `src/components/games/GameGravwell.tsx:393` — reduced motion이면 preview를 null로 만들어 점선 궤적 미리보기가 사라진다. 모션 감소는 애니메이션 선호일 뿐인데 핵심 조준 정보가 빠져 해당 사용자에게 난이도가 크게 오른다.
  - 수정: 정적 polyline인 preview는 reduced와 관계없이 항상 렌더한다.
- [minor/S] `src/components/games/GameGravwell.tsx:105` — preview가 260틱 동안 정확한 궤적을 보여줘서(스크린샷에서 화면 끝까지 그려짐) 대부분의 보드가 미리보기를 맞춰 보는 것만으로 풀린다. 그레이즈 링 외에는 숙련의 여지가 작다.
  - 수정: Hard에서는 preview 길이를 60~100틱으로 줄이거나 앞부분만 보여준다.
- [minor/S] `src/components/games/GameGravwell.tsx:625` — 그레이즈 배지 문구에 '+20'을 하드코딩해서 엔진의 GRAZE_BONUS와 따로 논다.
  - 수정: GRAZE_BONUS를 import해서 쓴다.

### slotter — 17/30 {"clarity": 4, "feel": 3, "mobile": 2, "curve": 3, "depth": 2, "polish": 3} challenge=False/True
규칙이 즉시 이해되고 긴장감 있는 정렬 삽입 게임이다. 하지만 정답 버튼인 갭이 16px로 너무 좁아 모바일에서 오조작이 곧 사망으로 이어지고, 매 틱 포커스를 빼앗는 버그가 있다.
- [major/S] `src/components/games/GameSlotter.tsx:307` — 정답 입력 수단인 갭 버튼이 w-4(16×44px)다. 모바일에서 바로 옆 카드나 이웃 갭을 잘못 누르기 쉬운데, 오답 한 번이면 즉시 게임오버다.
  - 수정: 갭 버튼을 최소 32~44px 폭으로 키우거나, 카드 사이 영역 전체(앞뒤 카드의 절반씩)를 해당 갭의 히트 영역으로 삼는다.
- [major/S] `src/components/games/GameSlotter.tsx:212` — [focus, state]에 걸린 effect가 매 tick(80ms)마다 gapRefs[focus].focus()를 호출해 페이지 포커스를 계속 빼앗는다. 플레이 중에는 헤더 버튼이나 다른 입력에 키보드 포커스를 둘 수 없다.
  - 수정: focus 인덱스가 키보드 입력으로 바뀔 때만 DOM focus를 옮긴다.
- [minor/M] `src/components/games/GameSlotter.tsx:291` — 행이 10장까지 늘면 모바일에서 flex-wrap으로 3줄이 되고, 줄 끝 갭과 다음 줄 첫 카드 사이 관계가 시각적으로 모호해진다(스크린샷 확인).
  - 수정: 모바일에서는 카드 폭을 줄여 1~2줄을 유지하거나 가로 스크롤 한 줄로 보여주고, 정렬 화살표 같은 연속성 표시를 넣는다.
- [minor/S] `src/components/games/GameSlotter.tsx:327` — 방금 들어간 카드가 아니라 항상 행의 마지막 카드(gap===row.length-1)에 sl-drop 애니메이션을 준다. 중간에 삽입하면 엉뚱한 카드가 강조된다.
  - 수정: lastEvent.type==='insert'일 때 그 index에 애니메이션을 주고, key에 card id를 넣는다.
- [minor/S] `src/components/games/GameSlotter.tsx:285` — '30 ticks left'처럼 내부 단위(ticks)가 그대로 노출된다.
  - 수정: 초 단위나 막대 게이지로 표시한다.

### bearing — 17/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 1, "polish": 3} challenge=False/True
조작과 규칙은 명확하지만 중앙 이분탐색이 정답인 퍼즐이라 3수 만에 끝나고 반복 동기가 없다. 데일리 패배 후 정답 공개, 재도전 시 스트릭이 오르는 구멍도 있다.
- [major/M] `src/lib/games/bearing/engine.ts:110` — 나침반 8방향 결과로 남은 영역이 사분면/반평면으로 줄어드는 구조라, 남은 영역 중앙을 파는 기계적 이분탐색이 항상 최적. 단순 봇이 데일리(9x9, par 5, budget 9)를 3번 파서 클리어(데스크톱·모바일 모두). 예산 par+4는 사실상 질 수 없음
  - 수정: 방향 정보에 노이즈/거짓 나침반 칸, 또는 이동하는 보물·다중 보물 등 판단 요소 추가. 예산을 par+1~2로 줄이고 par보다 적게 판 경우만 높은 등급
- [bug/S] `src/components/games/GameBearing.tsx:210` — 데일리에서 지면 오버레이가 보물 좌표를 공개(436행)하는데, Retry(onNewGame)가 같은 데일리 시드로 reset → 1회 파기로 승리하면 persistOver(137행)가 스트릭과 Best를 그대로 올림
  - 수정: 데일리 패배 후 재도전은 practice 취급(스트릭/베스트 미반영)하거나 todayUTC 기준 데일리 결과를 한 번만 기록
- [minor/S] `src/components/games/GameBearing.tsx:203` — state가 바뀔 때마다 커서 셀에 focus()를 호출해 로드 직후에도 보드 셀이 포커스를 가져감(로드 직후 activeElement='Row 5, Col 5' 확인). 페이지가 길면 스크롤 점프 유발
  - 수정: 키보드 이동(move 액션) 때만 focus 이동, 초기 마운트에선 생략
- [minor/S] `src/components/games/GameBearing.tsx:335` — 제외 영역(bg-white/0.015)과 미확인 영역(0.04)의 대비가 매우 낮아 몇 번 판 뒤엔 보드가 거의 빈 사각형으로 보임(모바일 mid 스크린샷)
  - 수정: 제외 칸에 사선 패턴/X 표시, 남은 영역 외곽선 강조

### siteswap — 17/30 {"clarity": 3, "feel": 3, "mobile": 2, "curve": 3, "depth": 3, "polish": 3} challenge=True/True
저글링 표기법을 게임으로 만든 아이디어가 독특하고, 슬롯 행으로 미래를 읽는 구조는 깔끔하다. 하지만 모바일 토스 버튼이 30px로 붙어 있어 치명적이고, 점수가 생존 시간에만 비례해서 깊이가 얕다.
- [major/M] `src/components/games/GameSiteswap.tsx:736` — 390px에서 토스 버튼 1~5가 각각 폭 30px이고 버튼 간격은 약 2.6px이다(실측: toss-1 x=82.2 w=30, toss-2 x=114.8). 높이를 잘못 누르면 바로 즉사하는 리듬 게임인데 오탭 위험이 크다.
  - 수정: 모바일에서는 슬롯 열 정렬을 포기하고 5칸 grid(각 60px 이상)로 바꾼다. 열과의 대응은 슬롯 아래 숫자 라벨로 표시한다. 아니면 버튼 폭을 COL_W로 넓히고 보드 폭 전체를 쓴다.
- [minor/M] `src/components/games/GameSiteswap.tsx:636` — 공중에 뜬 공이 전부 같은 x(HAND_X) 위에서 세로로만 움직인다. 그래서 높이가 비슷한 두 공이 겹쳐 보인다(데스크톱 스크린샷에서 두 공이 겹침). 어느 공이 언제 떨어지는지는 아래 슬롯 행으로만 읽을 수 있다.
  - 수정: 공을 arc 경로 위에 (now-from)/h 비율로 배치하거나, 착지 박자에 따라 x를 조금씩 어긋나게 둔다.
- [minor/M] `src/lib/games/siteswap/engine.ts:286` — 점수가 박자 수×공 수뿐이라 패턴 선택에 대한 보상이 없다. 엔진으로 300개 시드를 돌렸을 때, 비어 있는 높이를 무작위로 고르는 봇이 400비트 동안 한 번도 막히지 않았다. 숙련 천장이 반응 속도에만 걸려 있다.
  - 수정: 높이를 바꿔 새가 있는 박자를 피해 가거나, 4·5 높이 투척, 같은 패턴 반복(예: 441, 531 완성) 등에 보너스 점수를 준다.
- [minor/S] `src/components/games/GameSiteswap.tsx:320` — 빈손일 때 누른 입력(engine 'empty-press')에 아무 피드백이 없다. 플레이어는 입력이 씹혔는지 알 수 없다.
  - 수정: lastEvent==='empty-press'일 때 손 아이콘을 약하게 흔들거나 작은 사운드를 낸다.

### snake — 18/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
D-pad·스와이프·화살표 키 모두 동작하고 규칙도 즉시 이해된다. 하지만 속도 상승이 없고 입력 버퍼링이 약해 숙련도를 쌓을 여지가 적다.
- [major/S] `src/components/games/GameSnake.tsx:17` — TICK_MS=130 고정이라 점수가 올라도 속도가 전혀 변하지 않는다. 초반이 끝나면 긴장감이 오르지 않고 평탄하다.
  - 수정: 점수 구간마다 tick 간격을 줄인다(예: max(70, 130 - score*2)). setInterval 의존성에 속도를 넣거나 rAF 누적 방식으로 바꾼다.
- [major/S] `src/lib/games/snake/engine.ts:40` — changeDir가 pendingDir 한 칸만 덮어쓰고 반대 방향 판정은 state.dir 기준이다. 한 틱 안에 '위→왼쪽'처럼 빠른 U턴을 입력하면 두 번째 입력이 버려지거나 첫 입력을 덮어써서 조작이 씹힌 것처럼 느껴진다.
  - 수정: 방향 입력 큐(최대 2개)를 두고 틱마다 하나씩 소비한다. 반대 방향 검사는 큐의 마지막 방향을 기준으로 한다.
- [minor/M] `src/components/games/GameSnake.tsx:164` — 20x20=400개 div를 매 틱(130ms) 다시 렌더하는 DOM 그리드다. 이동 보간이 없어 칸 단위로 뚝뚝 끊기고, 먹을 때 피드백도 사운드와 먹이 pop뿐이다.
  - 수정: 캔버스로 옮겨 머리 위치를 보간하고, 먹을 때 파티클이나 몸통 펄스를 넣는다.

### typing-test — 18/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 3, "depth": 2, "polish": 3} challenge=False/True
실시간 문자 피드백과 캐럿 표시는 좋고, Restart 후 입력 포커스 복귀도 실제로 확인했다. 다만 단어 풀이 작고 모드가 하나뿐이라 타자 테스트로서의 깊이가 부족하다.
- [major/M] `src/lib/games/typing/engine.ts:1` — 단어 풀이 3~5글자 영어 100개뿐이고 구두점·대문자가 없다. 금방 외워져 WPM이 부풀고 반복 플레이 가치가 낮다.
  - 수정: 1000단어 풀과 문장 모드(구두점·대문자 포함), 15/30/60초 선택을 추가한다.
- [minor/S] `src/components/games/GameTyping.tsx:81` — 경과 시간을 secondsLeft(초 단위 올림)로 계산해 첫 1초 동안 WPM이 0으로 고정되고, 이후 1초 단위로 크게 튄다. 200단어를 60초 전에 다 치면 종료 시에도 TEST_SECONDS로 나눠 WPM이 과소 집계된다(82행).
  - 수정: elapsedMs를 Date.now() - startAt으로 직접 계산하고, 종료 시에도 실제 경과 시간을 쓴다.
- [minor/S] `src/components/games/GameTyping.tsx:117` — 오타가 한 글자만 있어도 단어 전체를 0점 처리해 정확도가 단어 단위로만 계산된다. 결과 화면에 오타 위치나 문자 단위 통계가 없다.
  - 수정: 문자 단위 correct/incorrect를 집계하고, 결과에 raw WPM과 문자 정확도, 틀린 단어 목록을 보여 준다.

### breakout — 18/30 {"clarity": 4, "feel": 4, "mobile": 3, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
파티클·트레일·패들 플래시 등 캔버스 연출은 이 그룹에서 좋은 편이다. 하지만 한 판짜리에 속도도 일정해 난이도 곡선과 반복 동기가 약하다.
- [major/M] `src/lib/games/breakout/engine.ts:104` — 6x8 벽돌 한 판이 전부이고 볼 속도는 BALL_SPEED로 끝까지 일정하다(200행에서 속도 유지). 클리어하면 'New Game'뿐이라 다음 단계나 난이도 상승이 없다.
  - 수정: 클리어하면 다음 레벨(새 벽돌 배치, 볼 속도 +8%, 단단한 벽돌)로 넘어가고, 점수와 목숨은 이어 가게 한다.
- [minor/S] `src/components/games/GameBreakout.tsx:303` — 패들이 포인터 x 좌표로 즉시 순간이동한다(movePaddleTo). 모바일에서 손가락이 패들 바로 위 보드 하단을 가려 볼 착지 지점이 잘 보이지 않는다.
  - 수정: 터치 시 상대 드래그(델타 이동)로 바꿔 보드 아래 여백 어디서든 조작하게 하고, 캔버스 아래에 터치 전용 드래그 존을 둔다.
- [minor/S] `src/components/games/GameBreakout.tsx:345` — 스탯이 3개라 1200px 데스크톱에서도 New Game 버튼 글자가 두 줄로 깨지고 Lives 칩이 따로 한 줄을 차지한다(스크린샷 확인).
  - 수정: Lives를 캔버스 안 하트 아이콘 HUD로 옮기거나, GameShell 버튼에 whitespace-nowrap을 적용한다.

### reaction-time — 18/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
규칙이 단순하고 즉시 이해되며 모바일 터치도 쉽다. 하지만 클릭 기준 측정과 하한 검증 부재 때문에 기록의 신뢰도가 낮고 깊이도 얕다.
- [major/S] `src/components/games/GameReaction.tsx:96` — 반응 시간에 하한 검증이 없다. Playwright로 22ms, 53ms가 그대로 기록됐다. 사람이라면 100ms 미만은 찍기인데도 Best로 영구 저장돼서 기록의 의미가 사라진다
  - 수정: 100ms 미만은 'Too soon(anticipated)'로 처리하고 best/평균에서 뺀다
- [major/S] `src/components/games/GameReaction.tsx:209` — 측정을 onClick(마우스를 뗄 때 발생)으로 해서 누르고 떼는 시간(수십 ms)이 매번 반응 시간에 더해진다. greenAt도 setTimeout 콜백 안에서 렌더/페인트 전에 찍힌다(82)
  - 수정: onPointerDown으로 측정하고, greenAt은 commit 뒤 requestAnimationFrame 두 번째 프레임에서 기록한다
- [minor/M] `src/lib/games/reaction/engine.ts:26` — 대기 시간이 1~3초로 짧고 범위가 좁아서 리듬으로 예측하기 쉽다. 5회 평균 외에는 세션 구조(시도 횟수나 결과 요약)가 없다
  - 수정: 대기를 1.5~5초로 넓히고, 5회 세트가 끝나면 평균과 백분위 요약 카드를 보여준다

### hangman — 18/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 2, "polish": 2} challenge=False/True
클래식 행맨을 명확하게 구현했다. 하지만 오답 때마다 보드 전체가 다시 마운트되면서 그림과 글자 애니메이션이 모두 재생되는 눈에 띄는 연출 버그가 있다.
- [bug/S] `src/components/games/GameHangman.tsx:193` — 오답이 나올 때마다 흔들림을 다시 재생하려고 보드 래퍼의 key를 `board-${shakeKey}`로 바꿔 통째로 다시 마운트한다. 그 결과 이미 그려진 신체 부위(hm-part, 420ms 스트로크 드로우)와 이미 맞힌 글자(hm-slot-reveal)까지 오답마다 전부 처음부터 다시 애니메이션된다
  - 수정: key 리마운트 대신 래퍼에만 animationend로 클래스를 토글하거나, Element.animate()로 흔들림만 재생한다. 새로 추가된 부위에만 hm-part를 적용한다
- [minor/S] `src/components/games/GameHangman.tsx:261` — 게임이 끝나면 오버레이가 보드를 가려서, 진 경우 빨간색으로 공개한 못 맞힌 글자(missReveal, 213)를 볼 수 없다. 모바일 스크린샷에서 확인함
  - 수정: 오버레이를 짧게 늦춰 띄우거나 보드 아래 결과 배너로 바꾼다
- [minor/M] `src/lib/games/hangman/engine.ts:345` — 단어 선택이 Math.random 한 번이라 최근에 나온 단어가 바로 다시 나올 수 있고, 카테고리나 난이도를 고를 수 없다
  - 수정: 최근 N개를 제외하는 셔플 덱을 쓰고, 단어 길이로 난이도를 고르게 한다

### aim-trainer — 18/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
시작부터 결과까지 흐름이 명확하고 모바일 터치도 무난하다. 다만 정확도가 기록에 반영되지 않고 난이도 변화가 없어 반복해서 할 동기가 약하다.
- [major/S] `src/components/games/GameAimTrainer.tsx:144` — Best를 targets/sec 하나로만 판정해서 정확도가 기록에 전혀 반영되지 않는다. 마구 클릭해도 손해가 없어 'Accuracy matters'(registry 전략)라는 설명과 맞지 않는다
  - 수정: 점수를 tps × accuracy^2 같은 복합 점수로 정의해 best로 저장하거나, 정확도 90% 미만이면 신기록을 인정하지 않는다
- [minor/S] `src/components/games/GameAimTrainer.tsx:248` — 타깃 적중을 onClick(뗄 때 발생)으로 처리해서 누르는 순간 반응하지 않는다. 시간 측정에도 누르고 떼는 시간이 들어간다
  - 수정: 타깃과 빈 공간 모두 onPointerDown으로 처리한다
- [minor/S] `src/lib/games/aim/engine.ts:48` — nextTarget이 직전 위치를 무시해서 같은 자리 근처에 연속으로 나올 수 있고, 타깃 크기와 거리 변화가 없어 30개 내내 난이도가 똑같다
  - 수정: 직전 타깃과의 최소 거리를 강제하고, 진행에 따라 타깃을 줄이는 모드를 추가한다

### rock-paper-scissors — 18/30 {"clarity": 5, "feel": 3, "mobile": 4, "curve": 2, "depth": 1, "polish": 3} challenge=False/True
규칙은 즉시 이해되고 서스펜스 셰이크와 팝 연출도 무난하다. 그러나 상대가 완전 무작위라 깊이가 사실상 없고, 패턴을 공략하라는 가이드 문구와도 맞지 않는다.
- [major/M] `src/components/games/GameRps.tsx:97` — 컴퓨터 수가 매 라운드 Math.random 균등 추첨이라 실력이 개입할 여지가 0이다. 그런데 레지스트리 전략 문구(registry.ts:681)는 패턴을 읽어 공략하라고 안내해 실제 동작과 모순된다.
  - 수정: 플레이어의 최근 수를 기반으로 빈도·마르코프 예측을 하는 'Smart CPU' 모드를 추가해 읽고 읽히는 심리전을 만든다. 아니면 전략 문구를 무작위 상대에 맞게 수정한다.
- [minor/S] `src/components/games/GameRps.tsx:103` — localStorage.setItem이 try/catch 없이 호출된다. 저장소가 차단된 환경에서는 resolve 도중 예외가 나서 라운드 처리(사운드, recordResult, 매치 점수)가 중단된다.
  - 수정: 다른 게임처럼 try/catch로 감싼다.
- [minor/S] `src/components/games/GameRps.tsx:205` — 스탯 라벨이 'Wins/Losses' 옆에 단수형 'Draw'로 표시되고, 모바일에서는 스탯과 매치 토글이 3줄로 접혀 헤더가 보드보다 길어진다(390px 스크린샷).
  - 수정: 라벨을 'Draws'로 바꾼다. 매치 길이 토글은 보드 상단으로 옮기거나 3/5/∞ 축약 라벨을 쓴다.

### lights-out — 18/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
5x5 토글 퍼즐 자체와 리플 애니메이션은 깔끔하다. 다만 난이도 선택, Undo, par 개념이 없어 반복 플레이 동기가 약하고 Best 기록도 무의미하다.
- [major/S] `src/components/games/GameLightsOut.tsx:64` — Best(최소 이동수)를 매번 다른 무작위 판끼리 비교한다. 운 좋게 쉬운 판이 나오면 Best가 갱신되는 구조라 기록에 의미가 없다. 판별 최적 수(par)도 표시되지 않는다.
  - 수정: 스크램블 누른 칸 집합의 XOR 결과(중복 제거)를 par로 보여주고 '+N over par'로 평가한다. 또는 시드 기반 일일 판으로 같은 판끼리 경쟁하게 한다.
- [minor/M] `src/lib/games/lightsout/engine.ts:4` — 스크램블이 항상 8회 고정이고 난이도 선택이 없다. Undo도 없어 실수하면 이동수가 그대로 쌓인다. 처음 하는 사람에게는 '체이스 더 라이트' 같은 해법 안내가 화면에 없어 막막하다.
  - 수정: Easy(4)/Normal(8)/Hard(완전 무작위 풀이가능 판) 난이도와 Undo를 추가한다. 막힐 때는 '다음 수 힌트(한 칸 하이라이트)'를 제공한다.
- [minor/S] `src/components/games/GameLightsOut.tsx:107` — 한 번도 풀지 않은 상태에서 Best가 '0'으로 표시돼 0수 기록처럼 읽힌다(모바일 스크린샷 'Best 0').
  - 수정: best===0이면 '—'로 표시한다.

### dots-and-boxes — 18/30 {"clarity": 4, "feel": 3, "mobile": 2, "curve": 3, "depth": 3, "polish": 3} challenge=False/False
규칙이 표준이고 연출(선 드로우, 박스 팝)도 깔끔하지만, 모바일에서 선의 터치 영역이 14px로 너무 좁다. Hard AI는 후반 체인 운영을 하지 못한다.
- [major/S] `src/components/games/GameDotsAndBoxes.tsx:278` — 점 열이 14px 고정 트랙이라 세로선 버튼의 너비와 가로선 버튼의 높이가 14px밖에 안 된다. 390px에서 실측한 가로선 버튼은 66x14px이었다. 터치 대상이 44px 권장치의 1/3 수준이라 오탭이 나기 쉽다.
  - 수정: 버튼의 실제 히트 영역을 넓힌다. 버튼에 음수 margin 또는 ::before 가상요소(inset:-12px)를 두고, 점 트랙을 모바일에서 22~28px로 키운다.
- [minor/M] `src/lib/games/dotsandboxes/engine.ts:250` — Hard AI는 안전한 수가 떨어지면 아무 선이나 무작위로 고른다. 가장 짧은 체인을 내주는 판단도 더블크로스도 없어서, strategy 문구('set traps')와 달리 후반이 너무 쉽다.
  - 수정: 안전한 수가 없을 때는 상대에게 내주는 상자 수가 가장 적은 수를 고른다. 각 후보마다 상대가 연쇄로 먹을 상자 수를 시뮬레이션하면 된다. 상대 체인이 길면 마지막 2칸을 남기는 더블크로스도 넣는다.
- [minor/S] `src/components/games/GameDotsAndBoxes.tsx:292` — 그어진 선이 누가 그렸든 indigo 한 색이다. CPU가 연속으로 여러 수를 두면 어떤 선이 방금 그어졌는지 220ms 애니메이션이 끝난 뒤에는 알 수 없다.
  - 수정: CPU가 이번 턴에 그은 선들을 lastCpuEdges에 담아 CPU 색 glow로 잠깐(다음 내 입력 전까지) 표시한다.
- [minor/S] `src/components/games/GameDotsAndBoxes.tsx:245` — 게임 도중 난이도를 바꾸면 difficultyRef가 바로 바뀌어 같은 판의 남은 수에 적용된다. 판 시작 때 정한 난이도가 아니라서 W/L 기록의 의미가 흐려진다.
  - 수정: 난이도를 바꾸면 restart()를 호출하거나, 다음 판부터 적용된다고 표시한다.

### flappy — 18/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
물리와 네온 연출은 무난하다. 하지만 난이도 상승이 전혀 없고, 천장 즉사와 늦은 첫 파이프 때문에 첫 판 경험과 한 판 더 동기가 약하다.
- [major/S] `src/lib/games/flappy/engine.ts:54` — PIPE_SPEED, GAP, PIPE_SPACING이 상수라 난이도가 끝까지 변하지 않는다(FAQ도 인정한다). 첫 10파이프를 넘기면 긴장감이 오르지 않아 숙련의 천장이 낮다.
  - 수정: score에 따라 PIPE_SPEED를 2.6→3.4로 완만히 올리고, GAP을 130→110으로 줄이고, 갭 높이 변화폭을 키운다. 엔진 step이 score를 알고 있으니 순수 함수로 넣을 수 있다.
- [major/S] `src/lib/games/flappy/engine.ts:136` — 천장에 닿아도 즉사한다. 310ms 간격으로 탭했더니 1.8초 만에 첫 파이프도 오기 전에 천장에서 죽었다(실플레이로 재현). 첫 파이프가 x=400에서 출발해 1.7초가 지나야 도착해서, 첫 판이 '아무것도 없이 죽는' 경험이 되기 쉽다.
  - 수정: 천장은 위치 클램프(y=BIRD_R, vy=0)로 처리하고, 첫 파이프는 FIELD_W*0.75 지점에서 스폰한다.
- [minor/S] `src/components/games/GameFlappy.tsx:246` — 게임오버 뒤 Space나 탭을 해도 아무 반응이 없고 New Game 버튼만 동작한다. 원탭 아케이드인데 재시작이 마우스 이동을 요구한다.
  - 수정: over 상태에서 짧은 쿨다운(400ms) 뒤 Space/탭이 오면 restart()를 호출한다.
- [minor/S] `src/components/games/GameFlappy.tsx:199` — localStorage.setItem과 getItem(273)이 try/catch 없이 호출된다. 저장소가 막힌 환경에서는 점수를 얻는 순간 rAF 루프에서 예외가 난다.
  - 수정: try/catch로 감싸거나 공용 bestScore 헬퍼를 쓴다.
- [minor/S] `src/components/games/GameFlappy.tsx:183` — idle 상태에서는 새가 정지해 있고 캔버스 안에 'Tap to start' 안내가 없다. 안내는 보드 아래 hint에만 있다. 스크린샷에서도 빈 그리드에 새 하나뿐이었다.
  - 수정: idle 중에는 새를 사인파로 bob시키고, 캔버스 중앙에 'Tap / Space'를 펄스 텍스트로 그린다.

### overload — 18/30 {"clarity": 3, "feel": 4, "mobile": 3, "curve": 2, "depth": 3, "polish": 3} challenge=False/True
웨이브 단위 캐스케이드 리플레이(플래시, 셰이크, 크레센도)는 손맛이 좋다. 그러나 레벨이 오를수록 쉬워지는 역난이도 때문에 퍼즐 모드가 거의 첫 탭에 풀리고, 'Retry board' 버그로 재도전도 성립하지 않는다.
- [major/S] `src/lib/games/overload/engine.ts:121` — 난이도가 거꾸로 간다. puzzleDensity가 레벨마다 올라 보드가 점점 임계에 가까워진다. 시뮬레이션에서 임의 임계 칸 한 번 탭으로 Perfect Storm이 나는 확률은 L1 36%, L3 63%, L6 87%, L9 98%였다. 최적 첫 탭의 체인 중앙값은 40으로 이미 36 이상이라, 탐욕 전략이면 퍼즐의 96%가 첫 탭에 클리어된다.
  - 수정: 레벨이 오를수록 밀도를 낮추거나 CLEAR_TARGET을 높이고(예: 36×(1+0.25·(level-1))), 탭 예산을 줄인다.
- [bug/S] `src/components/games/GameOverload.tsx:301` — 'Retry board'가 startRun(mode, s.seed)을 호출하고, newGame은 항상 레벨 1 밀도로 보드를 만든다(engine.ts:273). 레벨 2 이상에서 진 보드를 재시도하면 같은 시드로 전혀 다른 보드가 나오고 점수와 레벨도 리셋된다. 보드별 기록 키도 엉뚱하게 갱신된다.
  - 수정: retry 때는 seedBoard(mulberry32(seed), puzzleDensity(s.level))로 같은 레벨 보드를 재생성하는 retryBoard(state) 엔진 함수를 추가한다.
- [minor/S] `src/components/games/GameOverload.tsx:142` — persistBoard가 모드와 무관하게 tapsUsed = TAP_BUDGET - tapsLeft로 계산한다. 엔들리스에서는 tapsLeft가 이월과 리필로 12를 넘을 수 있어 fewestTaps가 음수나 엉터리 값으로 저장된다.
  - 수정: 보드 시작 시점의 tapsLeft를 state에 저장하고 그 차이로 tapsUsed를 계산하거나, 엔들리스에서는 fewestTaps 기록을 생략한다.
- [minor/S] `src/components/games/GameOverload.tsx:426` — Perfect Storm 조건은 '한 탭에 36회 이상 오버로드'인데, 힌트(325행)와 registry(1196행)는 '보드 전체를 쓸어라'고만 해 조건이 불명확하다. 'combo ×N'은 배수가 아니라 오버로드 개수인데 ×로 표기해, 실제 점수 배수(웨이브 번호)와 혼동된다.
  - 수정: 'chain 24/36' 진행 막대로 Storm 목표를 명시하고, combo 표기를 'overloads N'으로 바꾼다.

### ricochet — 18/30 {"clarity": 3, "feel": 4, "mobile": 3, "curve": 2, "depth": 3, "polish": 3} challenge=False/True
볼트가 홉을 따라 튀는 애니메이션과 중앙 콤보 카운터는 이 사이트 상위권 연출이고, ?seed= 공유도 이미 있다. 다만 데일리 par가 보드와 무관해 대부분 달성 불가이고, 핵심 정보인 화살표가 너무 작다.
- [major/M] `src/lib/games/ricochet/engine.ts:327` — 데일리 par(8~14)가 보드와 무관하게 seed % 7로 정해진다. 시뮬레이션에서 매 탭 최장 체인을 고르는 탐욕 플레이로도 par 달성률은 15%, longestChain 중앙값은 7이었다. 프리뷰가 2홉뿐인 사람에게는 대부분의 날이 사실상 달성 불가다(첫 방문 기본 모드가 daily, 컴포넌트 203행).
  - 수정: par를 시드 보드에서 탐욕 솔버로 계산한 최장 체인의 약 70~80%로 정하거나, 고정 상수 대신 보드 기반 계산으로 바꾼다.
- [minor/S] `src/components/games/GameRicochet.tsx:539` — 게임의 핵심 정보인 방향 화살표가 text-[10px] text-fg-muted로 숫자보다 훨씬 작고 흐리다. 390px 스크린샷에서 화살표 식별이 어렵다.
  - 수정: 화살표를 숫자와 같은 색으로 키우거나(text-sm 이상), 셀 배경에 방향 쐐기를 그린다.
- [minor/S] `src/components/games/GameRicochet.tsx:316` — 데스크톱에서 타일에 mouseenter할 때마다 showPreview가 play('flip')를 호출해, 마우스로 보드를 훑기만 해도 효과음이 연속으로 난다.
  - 수정: 프리뷰 사운드를 제거하거나, 같은 셀 재진입이나 짧은 간격일 때는 스로틀한다.
- [minor/S] `src/components/games/GameRicochet.tsx:229` — Best와 Longest 기록이 endless와 daily에서 같은 키를 쓴다. 탭 무제한인 endless 점수가 daily Best를 덮어 데일리 비교 의미가 사라진다.
  - 수정: 모드별 키(`${storageKey}:daily`)로 분리해 저장하고 표시한다.

### latch — 18/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 2, "depth": 3, "polish": 3} challenge=False/True
원버튼 진자 물리 자체는 손맛이 있다. 다만 놓은 뒤 다시 누르라는 신호가 없어 첫 판에서 바로 죽기 쉽고, 첫 사망에도 'New best!'가 뜨는 등 온보딩이 약하다.
- [major/M] `src/components/games/GameLatch.tsx:210` — 첫 페그를 잡으려면 놓은 뒤 다시 '누르고 있어야' 한다. 그런데 비행 중 가이드는 다음 페그로 향하는 점선 한 줄뿐이고, 재홀드를 알려 주는 단서가 없다. 실제로 650ms 홀드 후 놓았더니 2초 안에 Pegs 0으로 사망했다. 엔진 탐색 결과 첫 페그를 잡을 수 있는 릴리스 창은 약 0.4~0.5초였다.
  - 수정: reachablePeg가 있을 때 'HOLD' 펄스 링을 표시한다. 첫 판 1~2개 페그는 REACH를 키우거나 슬로모션 튜토리얼 구간을 둔다.
- [minor/S] `src/components/games/GameLatch.tsx:324` — 첫 판은 bestRef가 0이라 점수 3, 페그 0개로 바로 죽어도 'New best!' 승리 오버레이와 콘페티가 나온다(latch-m-1).
  - 수정: pegsChained가 0이거나 기존 기록이 없으면 일반 'Dropped' 결과를 보여 준다.
- [minor/S] `src/components/games/GameLatch.tsx:156` — 글린트를 '4-point star'로 그리려 했지만 꼭짓점 4개를 직선으로 이어 45° 회전시켜 그냥 노란 사각형으로 보인다(latch-m-0).
  - 수정: 외곽점과 내곽점을 교차하는 8개 정점으로 별을 그린다.

### decant — 18/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
숫자와 색을 함께 쓰는 밴드, 무거운 색이 가라앉는 규칙이 명확하고 모바일 레이아웃도 무난하다. 하지만 밀도 정렬이 퍼즐을 대신 풀어 줘서 무작위 플레이로도 거의 항상 클리어된다.
- [major/M] `src/lib/games/decant/engine.ts:101` — 밀도 자동 정렬 때문에 보드가 저절로 정리되는 성질이 강하다. 무작위로 따르기만 해도 easy/normal 100%, hard 95% 클리어였고 교착은 0%였다. par 이하로 깨는 비율도 각각 30%, 22%, 18%로, 퍼즐의 긴장감이 par에만 걸려 있다.
  - 수정: 어려움이 올라갈수록 빈 튜브를 1개로 줄이거나 용량을 5로 늘린다. 비정렬 '봉인 밴드' 같은 추가 제약을 넣고, 생성기는 무작위 플레이 승률이 일정 이하인 시드만 채택한다.
- [minor/S] `src/components/games/GameDecant.tsx:268` — [focus, state] 의존성 effect가 상태가 바뀔 때마다 튜브에 focus()를 건다. Undo 버튼을 클릭한 뒤 activeElement가 tube로 바뀌는 것을 확인했고, 마운트할 때도 보드가 페이지 포커스를 가져간다.
  - 수정: focus 인덱스가 키보드로 바뀔 때만 focus()를 호출하도록 플래그를 두고, state 의존성은 제거한다.

### duplex — 18/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
거울 축 개념과 고스트 미리보기 덕분에 규칙은 금방 이해되고 스와이프/D패드도 잘 동작한다. 다만 레벨이 너무 작고 짧아(대부분 par 1~3, 마지막 레벨도 par 1) 깊이가 얕고, ◀/▶로 잠긴 팩에 바로 들어갈 수 있어 진행 구조가 무의미하다.
- [bug/S] `src/components/games/GameDuplex.tsx:307` — ◀/▶ 레벨 이동(gotoLevel)이 팩 잠금(isPackUnlocked)을 검사하지 않고 모듈로 랩한다. Level 1에서 ◀를 누르면 잠긴 Anti-Diagonal 팩의 Level 17로 바로 이동한다(Playwright 확인: 칩은 '🔒 Anti-Diagonal'인데 플레이 가능). 팩 잠금은 장식일 뿐이다.
  - 수정: gotoLevel에서 대상 인덱스의 팩이 isPackUnlocked(solvedSet)가 아니면 이동을 막거나 마지막 해금 레벨로 클램프한다. 랩어라운드는 없애고, 잠긴 방향의 ▶ 버튼은 disabled로 둔다.
- [major/M] `src/lib/games/duplex/engine.ts:328` — 17개 레벨 중 대부분이 par 1~3이고 마지막 레벨(Counter-Diagonal)이 par 1이다. 보드가 3x7, 4x4 수준이라 퍼즐 공간이 거의 없어 곡선이 평평하고 클라이맥스 없이 끝난다. 데일리도 par 2였다.
  - 수정: 팩마다 par 6~12짜리 마무리 레벨을 1~2개 추가하고, 얼음/화살표 타일(엔진에 이미 있음)을 후반 팩에 실제로 배치한다. 데일리 생성기에는 최소 par 하한(예: ≥5)을 둔다.
- [minor/S] `src/components/games/GameDuplex.tsx:392` — 기록이 없을 때 Best가 0으로 표시된다(`best ?? 0`). 처음 들어온 플레이어는 '0수로 클리어한 기록'처럼 읽는다.
  - 수정: best가 null이면 '—'를 표시한다.
- [minor/S] `src/components/games/GameDuplex.tsx:538` — You 토큰에는 nudgeAnim 스텝 애니메이션이 붙지만 Echo 토큰에는 붙지 않아 Echo는 순간이동한다. 이 게임의 핵심인 '거울 반대로 움직임'의 손맛이 약하다.
  - 수정: Echo span에도 mirror(dir, mode)로 구한 방향의 nudgeAnim을 적용한다.

### overdub — 18/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 2, "polish": 3} challenge=False/True
원형 루프와 플레이헤드 연출은 깔끔하고 모바일 탭도 잘 된다. 하지만 기다림에 비용이 없어 전략이 단조롭고, 보드 포커스가 없으면 Space가 페이지 스크롤로 새는 입력 버그가 있다.
- [bug/S] `src/components/games/GameOverdub.tsx:313` — 키보드 핸들러가 보드 div의 onKeyDown에만 붙어 있다. 페이지를 막 연 상태(보드에 포커스 없음)에서 Space를 누르면 노트가 찍히지 않고 페이지만 860px 스크롤된다(Playwright 확인). registry howToPlay에는 '(or press Space)'라고 안내되어 있다.
  - 수정: window keydown 리스너로 옮기고 isTypingTarget으로 거르거나, 마운트 시 boardRef.focus({preventScroll:true})를 호출한다.
- [major/M] `src/lib/games/overdub/engine.ts:184` — 기다리면 절대 죽지 않고 빈 칸이 항상 있으므로, 최적 전략은 원하는 빈 칸이 올 때까지 기다렸다 한 번 탭하는 것뿐이다. 시간 압박이나 기회비용이 없어 결정이 '타이밍 정확도' 하나로 줄어들고 깊이가 얕다.
  - 수정: 랩당 노트 할당량 또는 한 바퀴 동안 탭이 없으면 체인/배수가 감소하는 장치를 넣어 기다림에 비용을 매긴다. 비용이 작아도 리스크-리워드 선택이 생긴다.
- [minor/S] `src/components/games/GameOverdub.tsx:392` — 빠르게 연속 탭하면 '+145 ×2', '+70', '+185' 플로터가 중앙 점수 숫자 위에 겹쳐 읽을 수 없다(스크린샷 확인).
  - 수정: 플로터를 점수 위쪽 오프셋 스택(seq별 y 오프셋)으로 띄우거나 직전 플로터를 즉시 교체한다.
- [minor/S] `src/components/games/GameOverdub.tsx:403` — 게임오버 오버레이가 보드 전체를 즉시 덮어, 어떤 노트를 밟아 죽었는지(빨간 fatal 표시)를 볼 수 없다. 버튼 라벨이 'Play again'으로 바뀌면서 헤더 줄바꿈이 생겨 레이아웃도 튄다.
  - 수정: 오버레이를 600ms 지연시키거나 반투명 하단 배치로 바꿔 fatal 셀을 보여 준다. New Loop/Play again 버튼은 고정 폭으로 둔다.

### cleave — 18/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 2} challenge=False/True
I-cut-you-choose를 cyan/magenta 두 값과 봉인 범위로 풀어낸 설계는 흥미롭지만, 핵심 보조 UI인 마진 미터가 좌우 반대로 그려져 오히려 판단을 방해한다. 할당량도 50%라 긴장감이 약하다.
- [bug/S] `src/components/games/GameCleave.tsx:400` — 마진 미터 방향이 반대다. side A 막대가 'left-1/2'(중앙에서 오른쪽)에, B가 'right-1/2'(왼쪽)에 그려진다. 그런데 Pile A는 왼쪽 열, B는 오른쪽 열이다. Playwright에서 'Rival leans B'일 때 막대가 왼쪽(Pile A 쪽)으로 자랐다.
  - 수정: half를 side === 'A' ? 'right-1/2' : 'left-1/2'로 바꾸고 transformOrigin도 그에 맞게 'right center'/'left center'로 바꾼다.
- [major/S] `src/lib/games/cleave/engine.ts:113` — QUOTA_RATIO = 0.5라서 '안전 최적값'의 절반만 남기면 목숨을 지킨다. 화면에 Safe optimum까지 보여 주니 실패 압박이 거의 없고, 점수 외에는 숙련 동기가 약하다.
  - 수정: 라운드에 따라 비율을 올린다(예: 0.5→0.85). 'perfect'(hindsight 최적) 연속에는 배수를 줘서 상위 플레이에 보상한다.
- [minor/S] `src/components/games/GameCleave.tsx:428` — magenta가 동점이면 미터에 'Piles look even to the rival'이라고 나오지만, 실제로 rival은 cyan 타이브레이크로 정해진 한 더미를 가져간다. 동점에서 무엇을 가져갈지 알 수 없다.
  - 수정: lead === 0이면 타이브레이크 결과(더 큰 cyan 더미, 그다음 B)를 계산해 'Tie — rival takes X (cyan tiebreak)'로 표시한다.
- [minor/S] `src/components/games/GameCleave.tsx:470` — 모바일에서 게임오버 오버레이가 보드 높이를 넘어 헤더 스탯(Best, 하트)을 덮고, 뒤의 'Out of lives.' 힌트가 비쳐 보인다(390px 스크린샷 확인).
  - 수정: 보드 컨테이너에 최소 높이를 주거나 오버레이를 스크롤 가능한 내부 박스로 제한한다.

### clusters — 18/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 3} challenge=False/True
Connections 형식을 깔끔하게 옮겼고 모바일 4열 그리드도 잘 맞는다. 다만 패배 시 정답 공개가 빠져 있고, 오답 때 선택이 초기화되며, 범주가 너무 쉬워서 퍼즐의 긴장감이 약하다.
- [bug/S] `src/components/games/GameClusters.tsx:268` — 패배 시 hint에 'the groups are revealed below'라고 나오지만, 미해결 그룹을 렌더하는 코드가 없다. 화면에는 state.solved만 표시되고 남은 타일은 disabled 상태로 남는다. 정답을 끝내 볼 수 없다.
  - 수정: status==='lost'면 state.groups 중 풀지 못한 그룹을 tier 색 행으로 차례로 공개한다.
- [major/S] `src/lib/games/clusters/engine.ts:296` — 오답 제출 시 selected를 []로 비운다. 'One away'라면 3개는 맞으니 하나만 바꾸라는 안내(registry strategy)와 맞지 않게, 4개를 처음부터 다시 골라야 한다. 같은 조합을 다시 제출해도 막지 않아 목숨이 또 깎인다.
  - 수정: 오답 뒤에도 선택을 유지하고, 이미 제출한 조합은 'Already guessed'로 거부한다(목숨 차감 없음).
- [major/L] `src/lib/games/clusters/engine.ts:60` — 뱅크의 카테고리가 서로 겹치지 않는 사전형 범주(카드 무늬, 계절 등)이고 레드헤링이 거의 없다. 실제 데일리 보드(체스 챔피언/파스타/구기 종목/체스 말)는 몇 초 만에 풀린다. 뱅크가 44개라 반복도 빠르다.
  - 수정: 그룹마다 다른 그룹과 겹칠 수 있는 미끼 단어를 의도적으로 설계하고(예: 'Mercury' 행성/원소), 뱅크를 크게 늘린다.

### quadle — 18/30 {"clarity": 4, "feel": 3, "mobile": 2, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
Quordle 규칙을 정확히 구현했고 데스크톱에서는 무난하다. 하지만 모바일에서 보드 4개가 세로로 길게 쌓여 키보드와 동시에 볼 수 없는 것이 치명적이다.
- [major/M] `src/components/games/GameQuadle.tsx:302` — 모바일(<sm)에서 grid-cols-1이라 9줄짜리 보드 4개가 세로로 쌓인다. 390px 풀페이지 스크린샷 기준으로 보드 영역만 화면 몇 개 분량이고 키보드는 그 아래에 있다. 입력하면서 다른 보드의 결과를 볼 수 없다.
  - 수정: 모바일에서도 2x2 그리드를 쓰고 타일을 작게(약 30px) 하며, 키보드는 하단에 sticky로 고정한다.
- [minor/S] `src/components/games/GameQuadle.tsx:158` — 사전에 없는 단어는 흔들림과 에러음만 나고 메시지가 없다('xxxxx' 입력 시 확인). Equate는 'Not a valid equation' 메시지를 보여 주는 것과 대조된다.
  - 수정: 'Not in word list' 토스트를 aria-live로 표시한다.
- [minor/M] `src/lib/games/quadle/engine.ts:166` — boardRows가 모든 guess를 채점하므로, 이미 풀린 보드에도 이후 추측 줄이 계속 채워진다. 키보드 힌트도 'absent everywhere'만 표시해 보드별 정보가 없다.
  - 수정: solvedAt 이후 줄은 렌더하지 않고, 키에 보드별 4분할 색 표시를 추가한다.

### solitaire — 18/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 2} challenge=False/True
클론다이크 규칙과 탭→탭 이동, 더블탭으로 파운데이션 보내기는 모바일에서도 정상 동작했다. 다만 Draw-3인데 waste가 1장만 보이고, 점수가 승리 시 항상 고정값이라 '한 판 더' 동기가 약하다.
- [major/S] `src/components/games/GameSolitaire.tsx:446` — Draw-3 규칙(engine.ts:205, n=min(3,...))인데 waste에는 맨 위 1장만 렌더된다. 방금 뽑은 3장 중 아래 2장이 안 보여서 다음 사이클을 계획할 수 없다. 플레이 스크린샷에서도 waste에 카드 1장만 확인됨.
  - 수정: waste의 마지막 3장을 가로로 12~16px씩 겹쳐 펼쳐 그리고, 맨 위 카드만 클릭되게 한다.
- [major/S] `src/lib/games/registry.ts:1958` — 팁에는 'finish quickly ... for a higher score'라고 적혀 있지만 score()(solitaire/engine.ts:351)는 '파운데이션 카드×100 + 승리 2000'뿐이다. 시간·이동 수가 반영되지 않아 승리하면 항상 7200점이고, Best는 첫 승리 뒤로 더 오를 수 없다.
  - 수정: 시간/이동 보너스를 넣거나(예: 승리 시 max(0, 3000 - 초×2)) 팁 문구를 사실대로 고친다.
- [minor/S] `src/components/games/GameSolitaire.tsx:138` — 'No moves left'로 끝내도 status가 'playing' 그대로라서 타이머 interval이 계속 돈다. 오버레이의 Time 값이 계속 올라간다.
  - 수정: 타이머 effect 조건에 manuallyEnded를 추가한다.
- [minor/S] `src/components/games/GameSolitaire.tsx:221` — 승리 후 Undo하면 prevOverRef가 false로 돌아가서, 다시 승리할 때 persistWin→recordResult({won:true})가 또 기록된다. 승리 통계를 부풀릴 수 있다.
  - 수정: 딜 단위 winRecordedRef를 두어 승리 기록을 한 번만 남긴다.

### mahjong — 18/30 {"clarity": 4, "feel": 3, "mobile": 2, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
항상 풀 수 있는 딜 생성, 무제한 Undo, Hint, 3회 Shuffle로 시스템은 탄탄하다. 다만 타일이 작아 모바일 터치가 빡빡하고 층 구분이 약하다.
- [major/M] `src/components/games/GameMahjong.tsx:147` — scale을 min(1, ...)으로 제한해 보드가 BOARD_W(약 429px) 이상으로 커지지 않는다. 데스크톱에서는 타일이 28x36px로 작다. 모바일에서는 약 0.76배로 줄어 타일이 약 21x27px라 탭 타겟이 권장 크기보다 훨씬 작다(스크린샷 확인).
  - 수정: 데스크톱은 상한을 1.4 정도로 풀고, 모바일은 선택한 타일 확대나 탭 판정 여유를 둔다(가까운 free 타일로 스냅).
- [minor/L] `src/lib/games/mahjong/engine.ts:37` — 레이아웃이 14x6, 10x4, 6x2, 4x2 직사각 슬랩 4층이다. 위층은 3-4px만 어긋나 보여서 층 구분이 약하고 클래식 터틀 형태의 인지성이 없다.
  - 수정: LIFT를 키우고 층별 그림자/테두리를 강화하거나 터틀형 레이아웃을 추가한다.

### yukon-solitaire — 18/30 {"clarity": 3, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
규칙 구현과 카드 가독성은 무난하다. 다만 이동 대상 표시가 없어 손맛이 평범하고, 승리 점수가 항상 같아 Best가 의미 없다.
- [major/S] `src/lib/games/yukon/engine.ts:284` — 점수가 파운데이션 장수*100 + 승리 2000이고, persistWin은 승리할 때만 저장한다. 그래서 승리 점수는 항상 7200으로 Best가 변별력이 없다. moves와 time은 화면에만 나오고 점수에 반영되지 않는다.
  - 수정: 승리 시 시간·이동 수 보너스(예: max(0, 3000 - sec*2 - moves*5))를 더하거나, 리더보드 지표를 최단 시간으로 바꾼다.
- [minor/M] `src/components/games/GameYukon.tsx:250` — 카드를 들어 올려도 놓을 수 있는 열이 표시되지 않고, 드래그도 지원하지 않는다. 9장 넘게 쌓인 겹친 카드를 탭할 때 대상이 명확하지 않다.
  - 수정: sel이 있을 때 movePile이 합법인 열 상단에 하이라이트를 주고, 포인터 드래그를 추가한다.
- [minor/S] `src/components/games/GameYukon.tsx:127` — 타이머가 페이지 로드나 새 딜 시점부터 돌아서, 첫 수를 두기 전 시간까지 기록된다. 'No moves left'로 끝낸 뒤에도 status가 playing이라 타이머가 계속 돈다.
  - 수정: 첫 apply에서 startRef를 설정하고, manuallyEnded일 때 interval을 멈춘다.
- [minor/M] `src/components/games/GameYukon.tsx:235` — 파운데이션에서 테이블로 카드를 되돌릴 수 없어서 표준 Yukon보다 전략 폭이 좁다. 막혔는지도 플레이어가 직접 'No moves left'를 눌러 판단해야 한다.
  - 수정: 엔진에 foundationToTableau와 hasAnyMove를 추가하고, 막혔을 때 자동으로 안내한다.

### gomoku — 18/30 {"clarity": 4, "feel": 3, "mobile": 2, "curve": 3, "depth": 4, "polish": 2} challenge=False/True
AI 난이도와 규칙은 탄탄하지만, Undo와 2P 승리로 Wins를 마음대로 부풀릴 수 있는 기록 버그가 두 개 있다. 모바일 22px 칸은 오터치 위험이 크다.
- [bug/S] `src/components/games/GameGomoku.tsx:184` — 게임이 끝난 뒤에도 Undo 버튼이 오버레이 밖에서 활성 상태이고, undo가 recordedRef를 false로 되돌린다. 승리 → Undo → 같은 수 반복으로 Wins가 무한히 오른다. Playwright 실측에서 0→1→2를 확인했다. recordResult(plays)도 중복 기록된다.
  - 수정: status!=='playing'이면 undo를 막거나, 이미 기록한 판은 recordedRef를 유지한다(게임 id 기준).
- [bug/S] `src/components/games/GameGomoku.tsx:88` — 2 Player 모드의 승리도 humanWon=true로 처리되어 bumpWins와 best:gomoku(리더보드)에 반영된다. 혼자 양쪽을 두면 vs CPU Wins를 부풀릴 수 있다(실측에서 2P 승리로 Wins +1).
  - 수정: bumpWins와 recordResult({won})는 mode==='cpu'일 때만 호출한다.
- [major/M] `src/components/games/GameGomoku.tsx:363` — 15x15 보드가 390px에서 칸당 22px라 터치 오조작 위험이 크다(실측 22.1px). 확인 단계 없이 즉시 착수된다.
  - 수정: 모바일에서는 첫 탭에 고스트 돌을 미리 보여주고 같은 칸을 두 번째 탭할 때 착수하게 하거나, 핀치 줌을 지원한다.
- [minor/S] `src/components/games/GameGomoku.tsx:452` — 승/패 오버레이가 보드를 즉시 블러로 덮어서, winLine 펄스 하이라이트가 보이지 않는다. 왜 졌는지 확인할 수 없다.
  - 수정: 승부 후 1초쯤 승리 라인을 보여준 뒤 오버레이를 띄우거나, 오버레이를 보드 아래 배너로 바꾼다.

### memory-game — 19/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 2, "depth": 2, "polish": 4} challenge=False/True
카드 플립·미스매치 흔들림·매치 글로우가 깔끔하고 모바일 탭도 편하다. 하지만 한 가지 판 크기에 타이머도 없어 깊이가 얕다.
- [major/M] `src/lib/games/memory/engine.ts:1` — 4x4 8쌍 고정에 타이머·난이도·콤보가 없다. 기록은 최소 수(Best)뿐이라 두세 판이면 더 할 동기가 사라진다.
  - 수정: 4x4/6x6 난이도와 경과 시간, 연속 매치 콤보 점수를 추가한다. 엔진이 rng를 받으니 시드 기반 도전 링크로 같은 배치를 겨루게 한다.
- [minor/S] `src/components/games/GameMemory.tsx:94` — Best가 '최소 moves'인데 UI에는 'Best —'로만 표시돼 낮을수록 좋은 기록인지 알 수 없다.
  - 수정: 'Best (fewest moves)'로 표기하거나 툴팁을 단다. 승리 오버레이에 이전 베스트와 비교를 보여 준다.

### tetris — 19/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
7-bag·고스트·월킥·레벨 가속·DAS 터치 버튼 등 기본기는 갖췄다. 하지만 락 딜레이·홀드·일시정지가 없어 손맛과 숙련 천장이 표준 테트리스보다 낮다.
- [major/M] `src/lib/games/tetris/engine.ts:274` — tick이 더 내려갈 수 없으면 즉시 lockPiece한다. 락 딜레이가 없어 바닥에 닿는 순간 고정되므로 바닥에서 밀어 넣기·T스핀이 불가능하고, 레벨이 오르면 조작이 억울하게 느껴진다.
  - 수정: 착지 후 500ms 락 타이머를 두고 이동·회전 시 리셋(최대 15회)하는 lock delay를 엔진 상태에 추가한다.
- [major/S] `src/components/games/GameTetris.tsx:119` — restart가 setRunning(true)를 호출해 페이지 로드 즉시 조각이 떨어진다. 일시정지 버튼도 없고, 탭이 숨겨졌을 때만 멈춘 뒤 '일시정지' 표시 없이 아무 키에나 재개된다.
  - 수정: 첫 입력 전에는 'Press any key / tap to start' 대기 상태로 두고, P키와 일시정지 버튼, 일시정지 오버레이를 추가한다.
- [minor/M] `src/components/games/GameTetris.tsx:305` — Hold 기능이 없고 Next 미리보기도 1개뿐이라 현대 테트리스 기준으로 전략 깊이가 얕다.
  - 수정: 엔진에 hold(라운드당 1회)와 next 큐 3개를 추가하고 사이드바에 표시한다.
- [minor/S] `src/components/games/GameTetris.tsx:321` — 390px에서 보드와 터치 버튼을 합치면 뷰포트 높이를 넘겨 하드드롭 줄이 화면 아래 끝에 걸친다(스크린샷 확인). 플레이 중에 스크롤이 필요할 수 있다.
  - 수정: 모바일에서는 보드 폭을 min(60vw, 260px)이 아니라 뷰포트 높이 기준으로 제한하거나, 스탯을 한 줄로 압축한다.

### sliding-puzzle — 19/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 3, "depth": 2, "polish": 4} challenge=False/True
제자리 타일 하이라이트와 슬라이드 애니메이션이 깔끔하고 퍼즐은 항상 풀 수 있게 생성된다. 하지만 모바일 스와이프가 없고 크기·시간 모드가 없어 단조롭다.
- [major/S] `src/components/games/GameSliding.tsx:143` — 보드에 touch-none이 걸려 있지만 터치·스와이프 핸들러가 없다. 모바일에서 스와이프는 아무 동작도 하지 않고 보드 위에서 페이지 스크롤만 막는다. 탭으로 인접 타일 하나씩만 옮길 수 있다.
  - 수정: 2048과 같은 onTouchStart/onTouchEnd 스와이프 → doMove(dir)을 추가한다. 같은 행·열의 먼 타일을 탭하면 여러 칸을 한 번에 미는 기능도 넣는다.
- [minor/S] `src/components/games/GameSliding.tsx:61` — 타이머가 없고 기록은 최소 이동 수뿐이다. 다른 게임과 달리 recordResult/recordFinish를 호출하지 않아 개인 스탯 패널에 판수가 쌓이지 않는다(gameStats import 없음).
  - 수정: 경과 시간과 3x3/4x4/5x5 크기 선택을 추가하고, 풀었을 때 recordResult('sliding-puzzle', {won:true})를 호출한다.

### simon — 19/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
패드별 음정과 점점 빨라지는 재생 등 원작의 핵심은 잘 살렸다. 다만 손을 뗄 때 반응하는 입력과 실패 피드백 부재 때문에 손맛과 학습성이 아쉽다.
- [major/S] `src/components/games/GameSimon.tsx:284` — 패드 입력을 onClick으로 처리해서 소리와 불빛이 손가락을 뗄 때 나온다. 터치에서 누르는 순간 반응하지 않아 리듬 게임 손맛이 떨어진다
  - 수정: onPointerDown(+preventDefault)으로 lightPad/pressPad를 처리하고, touch-action: manipulation을 지정한다
- [minor/S] `src/components/games/GameSimon.tsx:215` — 틀린 패드를 눌러도 정답 패드를 알려주지 않고 바로 Game over 오버레이가 패드를 덮는다. 무엇을 틀렸는지 배울 수 없다
  - 수정: 실패할 때 정답 패드를 2~3회 깜빡여 보여준 뒤 오버레이를 띄운다
- [minor/S] `src/components/games/GameSimon.tsx:255` — Round(시퀀스 길이)와 Score(완료한 라운드)를 동시에 보여줘서 1라운드에 지면 'Round 1 · Score 0'처럼 헷갈리게 나온다
  - 수정: stat을 하나(Score 또는 Length)로 줄인다
- [minor/S] `src/components/games/GameSimon.tsx:228` — localStorage.setItem이 try/catch 없이 호출되고, best를 판 도중에 실시간으로 덮어쓴다
  - 수정: try/catch로 감싸고, 게임이 끝날 때 한 번만 저장한다

### mastermind — 19/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
표준 피드백 알고리즘과 색맹 대응 라벨까지 갖춘 정석 구현이다. 다만 조기 승리 시 오버레이가 헤더를 덮는 시각 결함이 실제로 확인됐고, 키보드 조작과 난이도 선택이 없다.
- [major/S] `src/components/games/GameMastermind.tsx:219` — 추측 수가 적을 때 보드가 낮은 상태로 승리하면 GameOverlay(absolute inset-0) 내용이 보드보다 커서 위아래로 넘친다. 390px 실측에서 1회 만에 풀었을 때 오버레이가 Wins/New Game 헤더와 힌트 문구를 덮었다.
  - 수정: 오버레이를 감싸는 relative 래퍼에 min-h(예: min-h-[22rem])를 주거나, 게임이 끝나면 보드 높이를 고정한다. 공용 GameOverlay에 overflow 처리(max-h + 스크롤)를 추가하는 방법도 있다.
- [minor/S] `src/components/games/GameMastermind.tsx:126` — 키보드 입력(1-6 색 선택, Backspace, Enter 제출)이 전혀 없다. 컴포넌트에 keydown 리스너가 없어 데스크톱에서도 마우스로만 조작해야 한다.
  - 수정: isTypingTarget 가드를 둔 keydown 핸들러로 1-6은 addPeg, Backspace는 마지막 페그 제거, Enter는 handleSubmit에 연결한다.
- [minor/S] `src/components/games/GameMastermind.tsx:130` — play('flip') 사운드를 setDraft 업데이터 안에서 호출하는 부수효과가 있어 StrictMode에서 이중 재생된다. 또 6색·4칸·10회는 관대한 설정인데 난이도 선택이 없어 숙련자 천장이 낮다.
  - 수정: 사운드는 업데이터 밖에서 길이를 확인한 뒤 재생한다. Hard 모드(8색 또는 5칸, 8회)를 추가한다.

### gem-match — 19/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 2, "polish": 3} challenge=False/True
탭과 드래그 스왑, 콤보 팝업, 글리프 병기(색맹 대응)는 좋다. 하지만 캐스케이드마다 판 전체가 다시 떨어지는 연출 결함이 있고, 특수 젬이 없어 깊이가 얕다.
- [major/M] `src/components/games/GameGemMatch.tsx:330` — 모든 젬 span의 key가 dropKey라서 캐스케이드 단계마다 64개 젬이 전부 리마운트되고 gm-drop(316행)이 다시 재생된다. 새로 생긴 젬만 떨어져야 하는데 판 전체가 출렁인다. 엔진이 돌려주는 step.spawned도 쓰지 않는다.
  - 수정: step.spawned(와 낙하한 셀)만 Set으로 들고 그 셀에만 gm-drop과 key 변경을 적용한다. 낙하 거리에 비례한 translateY를 쓰면 더 좋다.
- [major/L] `src/lib/games/gemmatch/engine.ts:185` — 4매치·5매치가 점수만 조금 더 줄 뿐 특수 젬(라인, 폭탄)이 없다. 30수 동안 선택의 깊이가 '가장 큰 매치 찾기'에 그쳐 한 판 더 동기가 약하다.
  - 수정: 4매치는 라인 클리어 젬, L/T나 5매치는 폭탄 또는 컬러 젬을 생성하는 규칙을 엔진에 추가한다.
- [minor/S] `src/components/games/GameGemMatch.tsx:217` — handleTap이 setSelected 업데이터 함수 안에서 attemptSwap(비동기 부수효과)을 호출한다. React StrictMode나 동시성 재실행에서는 스왑이 두 번 실행될 수 있는 안티패턴이다.
  - 수정: selected를 ref로도 들고, 업데이터 밖에서 인접 여부를 판단해 attemptSwap을 호출한다.
- [minor/S] `src/components/games/GameGemMatch.tsx:195` — 가능한 수가 없으면 보드를 조용히 셔플한다. 안내 없이 판이 통째로 바뀌어 버그처럼 보인다. 오래 머물러도 힌트가 없다.
  - 수정: 셔플 시 'No moves — shuffling' 배너를 띄우고, 5초 이상 입력이 없으면 가능한 수 하나를 깜빡여 보여준다.

### tower-stack — 19/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 2, "polish": 3} challenge=False/True
원탭 스태킹이라 규칙은 즉시 이해되고 슬라이스 낙하와 퍼펙트 플래시도 갖췄다. 다만 매 판이 완전히 같고 FAQ가 약속한 콤보 보너스가 없어 깊이가 얕다.
- [minor/S] `src/lib/games/registry.ts:1120` — FAQ는 퍼펙트 드롭에 'plus a combo bonus'가 붙는다고 하지만, 엔진은 성공 드롭마다 점수를 무조건 +1만 준다(engine.ts:168). 콤보는 'PERFECT ×N' 텍스트로만 보이고 점수에는 영향이 없다.
  - 수정: 콤보 보너스를 실제로 구현하거나(예: 콤보 3 이상이면 +1) FAQ와 strategy 문구에서 콤보 보너스 언급을 뺀다.
- [minor/S] `src/components/games/GameTowerStack.tsx:334` — keydown에서 e.repeat를 거르지 않아 Space나 Enter를 누르고 있으면 키 반복 속도로 drop()이 연달아 호출되고, 탑이 즉시 무너져 게임이 끝난다.
  - 수정: if (e.repeat) return을 추가한다.
- [minor/M] `src/lib/games/towerstack/engine.ts:72` — 랜덤 요소가 전혀 없어(스폰 위치와 방향이 score로만 결정) 매 판이 완전히 같다. 속도는 30층 이후 7로 고정되고 변주가 없어 숙련 천장이 낮다.
  - 수정: 블록 진입 속도에 시드 기반 약간의 변동을 주거나 10층마다 이벤트(좁은 블록, 역방향)를 넣는다.
- [minor/S] `src/components/games/GameTowerStack.tsx:21` — ANCHOR_Y=30%라 초반에는 탑이 보드 상단 1/3에 떠 있고 하단 60%가 텅 빈다. 바닥이나 받침 묘사가 없어 블록이 허공에 떠 보인다(모바일 스크린샷에서 확인).
  - 수정: 초반에는 카메라가 base를 하단 근처에 두다가 높이가 오르면 ANCHOR로 이동시키고, 바닥 라인을 그린다.

### prospector — 19/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
푸시 유어 럭 루프와 서스펜스 연출(먼지, 어두워짐, 사후 피크)은 좋다. 그러나 '덱이 공개되어 있다'는 핵심 전제가 UI에 없고, EV 판정 피드백이 대부분 숨겨져 의도한 확률 게임이 성립하지 않는다.
- [major/S] `src/components/games/GameProspector.tsx:342` — howToPlay(registry.ts:1133)는 'known, face-up deck'이라 하고 strategy는 남은 타일을 세어 확률을 계산하라고 하지만, UI는 덱 구성(가스 6, 다이너마이트 2, 보석 22)을 어디에도 보여 주지 않는다. Next fatal도 가스 2개 전까지 'Safe so far'만 표시해 계산 근거가 없다.
  - 수정: 오즈 패널에 'Gas left 5/6 · Dynamite 2 · Gems 20' 같은 남은 덱 구성을 표시한다(gasRemaining 등 엔진 헬퍼가 이미 있음).
- [major/S] `src/components/games/GameProspector.tsx:552` — 뱅크 판정 verdict('Disciplined bank'와 'banked early')는 New-best 오버레이 안에서만 렌더된다. 최고 기록이 아닌 대다수 뱅크에서는 계산해 두고도 전혀 보이지 않아 학습 피드백이 사라진다.
  - 수정: banked 상태의 shaft 영역(442-464행)에 verdict를 peekLine과 함께 항상 표시한다.
- [minor/S] `src/components/games/GameProspector.tsx:371` — shaft div가 role=button, tabIndex=0, aria-label 'Flip the top tile'인데 onKeyDown이 없다. 포커스한 채 Enter를 누르면 전역 핸들러가 받아 Flip이 아니라 Bank가 실행된다.
  - 수정: shaft의 role과 tabIndex를 제거하거나(아래 FLIP 버튼이 있으므로) Enter와 Space 처리를 명시한다.
- [minor/S] `src/components/games/GameProspector.tsx:486` — 'Bank the pot' 바와 BANK 버튼이 같은 동작을 중복해서 수직 공간을 차지한다. 모바일에서 보드 높이가 늘어 FLIP 버튼이 화면 하단으로 밀린다.
  - 수정: Bank 바를 BANK 버튼에 통합해 '+9'를 버튼 라벨로 표시한다.

### quarry — 19/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
규칙이 단순하면서도 '탐침 = 이동'이라는 추론 재미가 있고, 모바일 그리드도 쾌적하다. 다만 낡은 판독값이 그대로 남아 헷갈리고, 초반 예산이 너무 넉넉하다.
- [major/M] `src/components/games/GameQuarry.tsx:45` — 보드에 과거 탐침의 '그 시점 거리'가 그대로 남는다. 타깃은 탐침할 때마다 이동하므로, 이전 숫자는 현재 위치와 맞지 않는 낡은 정보인데 현재 정보처럼 보인다. 이동 궤적이나 '가능한 칸' 표시도 없어 초보자가 추론을 따라가기 어렵다.
  - 수정: 오래된 판독값은 흐리게 하고 순번을 붙인다(예: 작은 #1, #2). 선택 옵션으로 '가능한 위치' 하이라이트 보조를 둔다.
- [minor/S] `src/lib/games/quarry/engine.ts:76` — 5x5에서 최적으로 추론하면 최악의 경우에도 4번이면 잡힌다(minimax로 확인). 그런데 예산은 8, par는 5라서 레벨 1~2가 느슨하다.
  - 수정: 5x5 예산을 6으로, par를 4로 낮추거나 레벨 2부터 7x7로 전환한다.
- [minor/S] `src/components/games/GameQuarry.tsx:226` — Enter/Space 처리에서 setCursor 업데이터 안에서 handleProbe를 호출한다(부수효과). StrictMode에서는 탐침이 두 번 소비된다.
  - 수정: cursor를 ref로 들고 있다가 업데이터 밖에서 handleProbe(cursorRef.current)를 호출한다.

### deepdive — 19/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
깊이별 색 그라디언트와 보물/비용 표기로 판을 한눈에 읽을 수 있고, 데일리와 연습 모드 구성도 좋다. 다만 예치 점수와 귀환 비용이 보이지 않아 핵심 판단을 머릿속으로 해야 하고, 실제로는 운이 없는 경로 최적화 퍼즐이다.
- [major/S] `src/components/games/GameDeepdive.tsx:347` — 스탯이 Air/Haul/Depth/Best뿐이라 이번 판에 예치한 점수(banked)가 어디에도 표시되지 않는다. 수면에서 예치하면 Haul이 0이 되고 Best만 올라서, 이전 Best가 더 높으면 현재 점수를 볼 수 없다. 'Depth'도 현재 깊이가 아니라 최대 도달 깊이(deepest)라 수면에 있어도 'Depth 3'으로 나온다(모바일 스크린샷 확인).
  - 수정: {label:'Banked', value: state.banked}를 추가하고, Depth는 현재 pos.row를 보여 주거나 'Deepest'로 이름을 바꾼다.
- [major/M] `src/components/games/GameDeepdive.tsx:285` — 핵심 긴장인 '돌아갈 숨이 남았나'를 계산해 주는 UI가 없다(귀환 최소 비용 표시 없음, 경고는 air ≤ 25%일 때 빨간 테두리뿐). Playwright로 Haul 253, Air 11, 깊이 7에 갇혔는데 경고 시점이 이미 늦었다.
  - 수정: 현재 위치에서 수면까지의 최소 비용(다익스트라)을 'Return N' 스탯으로 표시하고, 다음 이동으로 air < return이 되는 셀은 붉게 표시한다.
- [minor/S] `src/lib/games/registry.ts:1694` — 모든 셀의 보물값과 비용이 처음부터 공개된 결정론적 경로 최적화인데, 제목과 설명이 'Push-Your-Luck'이다. 운 요소가 전혀 없어 기대와 실제 장르가 다르다.
  - 수정: 깊은 셀의 보물을 범위로만 보여 주는 등 불확실성을 추가하거나, 문구를 'route-planning'으로 정정한다.
- [minor/S] `src/components/games/GameDeepdive.tsx:330` — 수면 아래에서는 Retire가 비활성화된다. 귀환이 불가능해진 걸 알아도 포기 수단이 없어, 익사할 때까지 남은 칸을 계속 밟아야 한다.
  - 수정: 수면 아래에서는 'Give up(haul 포기)' 버튼을 활성화하거나, 귀환 불가가 확정되면 바로 익사 처리한다.

### sonar — 19/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
맨해튼 거리 삼각측량이라는 발상은 좋고 Ping/Mark 분리와 시드 기반 엔진도 탄탄하다. 다만 핵심 정보인 '배제된 칸'이 시각적으로 거의 안 보여서 추론의 재미가 크게 깎인다.
- [major/S] `src/components/games/GameSonar.tsx:426` — Ping으로 '제거된(cleared)' 칸은 bg-white/[0.015], 미확인 칸은 bg-white/[0.04]라 대비가 너무 작다. 데스크톱 스크린샷에서 ping 5번 뒤 어느 칸이 이미 배제됐는지 거의 구분되지 않는데, 이 게임의 핵심 정보가 바로 그것이다.
  - 수정: cleared 칸에 사선 해치나 점 패턴을 넣거나 opacity를 확실히 낮추고, 미확인 칸에는 옅은 테두리를 주어 '아직 모름'이 눈에 띄게 한다.
- [minor/S] `src/components/games/GameSonar.tsx:260` — 셀 클릭(onCellClick)이 cursor를 갱신하지 않는다. 그런데 state가 바뀔 때마다 실행되는 effect(228-232)가 cursor 셀로 focus()를 옮겨서, 탭한 셀과 하이라이트(ring) 셀이 서로 다르다. 로드 직후에도 중앙 셀에 focus가 잡혀 있었다.
  - 수정: onCellClick에서 먼저 dispatch({type:'cursor', at})를 하거나, focus 동기화를 키보드 입력 때만 하도록 제한한다.
- [minor/M] `src/components/games/GameSonar.tsx:235` — Daily의 'Replay Daily'가 같은 seed를 reset하므로, 답을 외운 뒤 다시 하면 이론상 최대 점수가 나온다. 그 점수가 best:<slug>(리더보드)에 그대로 기록된다.
  - 수정: daily는 첫 완료 점수만 best와 리더보드에 반영하고, 재플레이는 연습 기록으로만 처리한다.
- [minor/S] `src/lib/games/sonar/engine.ts:263` — 예전 ping 숫자는 '당시 남아 있던 가장 가까운 목표'까지의 거리다. 그 목표를 잡은 뒤에도 숫자가 그대로 남아 현재 정보처럼 보인다(스크린샷에서 포획 뒤에도 4/5/5 표시가 유지됨).
  - 수정: 포획 뒤에는 이전 ping 숫자를 흐리게(stale) 표시하거나, 툴팁으로 시점을 알려 준다.

### flapjack — 19/30 {"clarity": 4, "feel": 2, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
규칙이 직관적이고 크기별 색상과 스패출러 밴드 표시로 이해하기 쉽다. 하지만 핵심 동작인 '뒤집기'에 실제 이동 애니메이션이 없어 손맛이 약하다.
- [major/M] `src/components/games/GameFlapjack.tsx:367` — 팬케이크 key가 인덱스(i)라서 뒤집을 때 요소가 이동하지 않는다. 각 줄의 너비와 색만 바뀌고 rotateX(-14deg) 흔들림만 보여서, '뒤집힌다'는 손맛이 거의 없다.
  - 수정: key를 rank로 바꾸고 FLIP 레이아웃 애니메이션(뒤집힌 구간이 스패출러 축을 중심으로 180° 회전하며 순서가 반전)을 구현한다.
- [minor/S] `src/components/games/GameFlapjack.tsx:377` — 터치 기기에서는 onMouseEnter가 탭할 때 발생해 hoverBand가 남는다. 그 뒤 키보드 focus 밴드와 하이라이트가 어긋난다. 맨 위 팬케이크를 누르면(k=1) 아무 피드백 없이 무시된다.
  - 수정: pointerType이 touch면 hover를 무시하고, k=1 탭에는 가벼운 흔들림 피드백을 준다.
- [minor/M] `src/components/games/GameFlapjack.tsx:250` — Daily 'Replay Daily'로 같은 스택을 무한히 다시 할 수 있어서 daily best와 리더보드 점수를 쉽게 최대로 만들 수 있다.
  - 수정: daily는 첫 완료만 기록한다.

### reactor — 19/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 2, "polish": 3} challenge=False/False
방치형 기본 루프(탭→모듈→오프라인 보상)는 안정적으로 동작하고, 시뮬레이션상 1M까지 약 40분이라 페이싱도 무난하다. 다만 프레스티지가 손해에 가까워 후반 깊이가 없다.
- [major/M] `src/lib/games/reactor/engine.ts:50` — Reboot는 모든 모듈을 리셋하는 대가로 생산량을 겨우 +10%(선형) 올려 준다. 그래서 게임플레이상으로는 손해이고, 실제 이득은 score에 붙는 +1M(184행)뿐이다. 프레스티지 결정이 의미 있는 선택이 아니다.
  - 수정: 배율을 lifetime 기반(예: sqrt(lifetime/1M))으로 하거나 리셋 뒤 초기 가속(시작 charge, 비용 할인)을 주어, 리셋이 실제로 더 빠른 성장으로 이어지게 한다.
- [minor/S] `src/components/games/GameReactor.tsx:228` — 주석에는 'Space/Enter taps'라고 되어 있지만 키 핸들러는 1-6만 처리한다. 셸의 New Game 버튼은 'Tap ⚡'로 바뀌어 코어와 중복되고, 진행을 초기화할 방법도 없다.
  - 수정: Space 탭을 구현하거나 주석을 고치고, 셸 버튼은 설정/리셋(확인 포함)에 쓴다.

### spider — 19/30 {"clarity": 3, "feel": 3, "mobile": 3, "curve": 4, "depth": 3, "polish": 3} challenge=False/True
10열 104장 스파이더가 390px에 넘침 없이 들어가고 1/2/4 suit 선택으로 난이도 곡선도 좋다. 점수와 Best가 난이도를 구분하지 않아 숙련 동기가 약하다.
- [major/M] `src/lib/games/spider/engine.ts:312` — score = 완성 세트×1000 + 승리 2000이라 1·2·4 suit 모두 승리하면 똑같이 10000점이다. Best와 리더보드 키도 하나를 같이 쓴다(GameSpider.tsx persistWin). 가장 쉬운 1-suit 승리가 4-suit 승리와 같은 값이 된다.
  - 수정: suit 수에 따른 배율(1/2/4 → ×1/×2/×4)과 시간/이동 보너스를 넣거나, 난이도별로 storageKey를 나눈다.
- [minor/S] `src/components/games/GameSpider.tsx:397` — 난이도 버튼을 누르면 확인 없이 바로 startDeal로 새 판을 시작한다. 이미 선택된 난이도를 눌러도 진행 중인 판이 사라진다.
  - 수정: 같은 난이도면 무시하고, 진행 중(moves>0)이면 confirm을 띄우거나 다음 딜부터 적용한다.
- [minor/M] `src/components/games/GameSpider.tsx:91` — 모바일 카드 폭이 1.85rem(약 30px)이고 face-up 간격이 15px(452행)다. 열이 길어지면 탭 타겟이 15px 띠가 되어 잘못 집기 쉽다.
  - 수정: 열 길이에 따라 간격을 늘리거나 줄이고, 선택한 런의 시작 카드에 확대 피드백을 준다.

### pyramid — 19/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
규칙이 단순하고 첫 30초 안에 이해된다. 모바일에서도 7장 행이 잘 맞는다. 다만 연출이 정적이고 막힌 카드가 반투명이라 화면이 지저분하며 힌트가 없다.
- [minor/S] `src/components/games/GamePyramid.tsx:63` — 막힌 카드에 opacity 0.55를 줘서 아래 카드의 수트 기호가 위 카드 위로 비친다. 스크린샷에서 '4♥' 위에 다른 ♥/♣이 겹쳐 보이는 시각 노이즈가 확인됐다.
  - 수정: opacity 대신 불투명 회색 배경(#c7c9d6)과 텍스트 색 감쇠만 사용한다.
- [minor/S] `src/components/games/GamePyramid.tsx:448` — Draw 버튼이 스톡 카드 탭과 같은 동작인데 항상 accent 강조로 표시된다. 보드에 13 쌍(예: 6♣+7♠)이 있는데도 Draw가 가장 눈에 띄어 스톡을 먼저 쓰도록 유도한다.
  - 수정: Draw는 ghost로 바꾸고, 가능한 쌍이 없을 때만 강조한다(hasAnyMove/쌍 존재 여부로 판단).

### chess — 19/30 {"clarity": 3, "feel": 2, "mobile": 4, "curve": 4, "depth": 4, "polish": 2} challenge=False/False
합법 수 표시, 프로모션 선택, 3단계 난이도, 2인 모드까지 기능이 충실하다. 하지만 백 폰이 검은 이모지로 렌더되는 결함과 마지막 수 하이라이트 부재로 가독성이 크게 떨어진다.
- [bug/S] `src/components/games/GameChess.tsx:36` — 폰 글리프 '♟'(U+265F)가 컬러 이모지 폰트로 렌더되어 CSS color를 무시한다. 스크린샷에서 백 폰(2랭크)이 흑 폰과 똑같은 검은 이모지로 나오고, e4에 둔 백 폰도 검게 보인다. 흑 뒷줄 기물은 흰 외곽선 글리프로 보여서 양 진영 구분이 헷갈린다.
  - 수정: 각 글리프 뒤에 텍스트 표현 선택자 '︎'를 붙이고 font-family를 심볼 폰트로 지정한다. 더 좋은 방법은 인라인 SVG 기물 세트로 바꾸는 것이다.
- [major/S] `src/components/games/GameChess.tsx:486` — 마지막 수(from/to) 하이라이트가 없다. CPU가 380ms 뒤에 두는 수가 보드에 아무 표시 없이 반영되어 무엇이 움직였는지 알기 어렵다(Nf6 응수 후 스크린샷에 표시 없음).
  - 수정: stack.moves의 마지막 move에서 from/to 칸에 반투명 노란 배경을 칠한다.
- [minor/S] `src/components/games/GameChess.tsx:170` — CPU 수 선택에 Math.random을 직접 넣어서, 같은 진행이라도 재현할 수 없다. 기보/도전 링크를 만들 수 없다.
  - 수정: 게임 시작 시 시드를 정하고 mulberry32(seed)를 bestMove에 주입한다.

### golf-solitaire — 19/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 2, "polish": 3} challenge=False/True
7열 golf가 모바일 390px에 넉넉하게 들어가고 하이라이트와 힌트 문구가 명확하다. 점수 구조상 승리 후 개선 여지가 없어 깊이가 얕다.
- [major/S] `src/lib/games/golf/engine.ts:228` — score = 클리어×100 + 승리 1000이다. 클래식 Golf의 핵심 보상인 남은 스톡 카드 보너스가 없어서, 승리하면 항상 4500점이다. Best가 첫 승리 뒤로 더 오를 수 없다.
  - 수정: 승리 시 남은 stock 1장당 보너스(예: +200)를 더한다.
- [minor/S] `src/components/games/GameGolf.tsx:189` — Wrap 토글이 확인 없이 startDeal을 호출해 진행 중인 판을 날린다. 더 쉬운 Wrap On과 Off가 같은 Best 키를 공유한다.
  - 수정: 진행 중이면 다음 딜부터 적용하고, wrap 모드별로 storageKey를 나누거나 Wrap On 점수에 배율을 낮춘다.

### carousel — 19/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
자동으로 회전하는 링이라는 핵심 트위스트가 명확하고 회전 애니메이션도 부드럽다. 다만 포커스 탈취, 로더를 가리는 포인터, 손패 색 편중 같은 다듬을 점이 남아 있다.
- [major/S] `src/components/games/GameCarousel.tsx:247` — [focus, state]가 바뀔 때마다 handRefs[focus].focus()를 호출해서, 로드 직후와 매 배치 후에 손패 버튼이 포커스를 빼앗는다.
  - 수정: 키보드 화살표·숫자 입력이 있었을 때만 focus()를 호출한다.
- [minor/S] `src/components/games/GameCarousel.tsx:323` — 12시 방향 로더 포인터 ▼가 로더 슬롯 바로 위에 겹쳐 그려져서, 로더 칸에 무엇이 있는지(비었는지) 가린다(모바일 스크린샷).
  - 수정: 포인터를 링 바깥(top: -16px)으로 빼거나 슬롯 테두리 강조만 쓴다.
- [minor/S] `src/components/games/GameCarousel.tsx:368` — car-pop 애니메이션의 transform: scale이 마블의 역회전 transform(rotate(-wrapperDeg))을 덮어써서, 배치 순간 숫자가 기울어져 보인다. 같은 요소에 inline animation이 걸리면 car-loader-pulse 글로우도 끊긴다.
  - 수정: pop 애니메이션을 내부 래퍼 요소에 따로 적용한다.
- [minor/M] `src/components/games/GameCarousel.tsx:405` — 8수 플레이 중 손패가 4·4·4로 같은 색만 나와 선택지가 없는 턴이 생겼다(스크린샷 확인). 다음에 올 마블 미리보기도 없어 계획 깊이가 얕다.
  - 수정: 손패에 같은 색이 최대 2개까지만 나오게 리롤하고, next 마블 1개를 미리 보여준다.

### morse-relay — 19/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 2, "polish": 4} challenge=True/True
첫 입력으로 속도를 보정하는 설계가 좋고 모바일 홀드 키도 잘 동작한다. 다만 송신음이 없어 손맛이 약하고, 단어 24개가 반복돼 금방 질린다.
- [major/S] `src/components/games/GameMorseRelay.tsx:286` — 키를 누르고 있는 동안 송신음(사이드톤)이 없고 손을 뗀 뒤에만 'flip' 효과음이 남. 모스 게임의 핵심 피드백인 '삐—' 길이감이 없어서 점/선 구분을 화면 막대로만 판단해야 함
  - 수정: onDown에서 WebAudio 오실레이터(~600Hz)를 시작하고 onUp에서 정지(muted 존중)
- [major/S] `src/lib/games/morse-relay/engine.ts:129` — 단어 풀이 4버킷×6단어=24개뿐이고 레벨 4 이상은 같은 6개 구문이 반복됨. 숙련 천장이 낮아 몇 판이면 단어를 다 봄
  - 수정: 버킷별 단어 수를 30개 이상으로 늘리고 레벨 5+에 숫자·구두점 또는 Q코드 추가
- [minor/S] `src/components/games/GameMorseRelay.tsx:435` — 각 글자의 정답 패턴이 10px 모노 글꼴(• —)로 매우 작아 모바일에서 판독이 어렵고, 입력 중인 패턴(text-sm)과 크기 대비가 뒤집혀 있음(데스크톱 스크린샷)
  - 수정: 정답 패턴을 text-xs~sm로 키우고 이미 입력한 심볼은 패턴 위에서 하이라이트
- [minor/S] `src/lib/games/morse-relay/engine.ts:483` — 글자 중간에 3초(ABANDON_MS) 손을 떼면 강제 판정돼 생명을 잃는데, 탭 전환/일시정지 처리가 없음(visibilitychange 리스너 없음). 돌아오면 첫 tick에서 바로 감점됨
  - 수정: visibilitychange 시 lastUpT를 보정하거나 일시정지 상태 추가

### shadowfit — 19/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 2, "polish": 3} challenge=True/True
벽에 실시간 그림자가 표시되고 3D 회전 트윈이 있어서 규칙을 빨리 이해할 수 있고 모바일 패드도 넉넉하다. 하지만 바로 그 실시간 판정 때문에 연타가 통해서 퍼즐의 깊이가 약하고, 신기록 화면이 빨간색으로 나오는 연출 결함이 있다.
- [major/S] `src/lib/games/shadowfit/engine.ts:62` — 벽에 칸별 실시간 판정(fit/collide)과 FITS 배지가 뜨고 회전 횟수 제한도 없다. 그래서 무작위로 연타해도 풀린다. 모바일에서 무작위 회전만 하는 봇이 벽 4개를 통과해 2105점을 냈다. Par 보너스는 50점뿐이라 생각하고 푸는 것보다 연타가 낫다.
  - 수정: Par를 넘긴 회전마다 early 보너스를 깎거나(예: 초과 1회당 -20%), PERFECT_BONUS를 크게 올린다(예: 150). 또는 고난도 벽에서 red 칸 미리보기를 숨긴다.
- [minor/S] `src/components/games/GameShadowfit.tsx:835` — 챌린지가 아닌 판에서는 overlay variant가 항상 'lose'라서, 신기록 판의 'New best!' 제목이 빨간 패배 스타일로 나온다(모바일 게임오버 스크린샷에서 확인).
  - 수정: variant를 outcome?.kind==='win' || (!challenge && newBest) ? 'win' : 'lose'로 바꾼다.
- [minor/S] `src/components/games/GameShadowfit.tsx:41` — resolve 간격(6틱) 동안 누른 회전은 'blocked'로 버려지는데 사운드와 시각 피드백이 모두 없다. 그래서 입력이 씹힌 것처럼 느껴진다.
  - 수정: blocked 이벤트에 약한 사운드를 붙이거나 패드를 흔든다. 아니면 다음 벽 회전용으로 입력을 1개 버퍼한다.

### slosh — 19/30 {"clarity": 3, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 4} challenge=True/True
고정소수점 물리로 출렁임을 표현하고, 게이지와 Calm 램프, 물방울 연출로 무엇을 할지 보여 주는 점은 좋다. 그러나 판마다 난이도가 같아 반복감이 있고, 모바일에서 장면이 작아 손맛이 줄어든다.
- [minor/M] `src/lib/games/slosh/engine.ts:126` — generateTrack에 난이도 축이 없다. 정거장은 매 판 3~4개이고 구간 길이, 경사, 시간 한도의 분포가 항상 같다. 판 안에서도 판 사이에서도 진행감이 없어서 몇 판 하고 나면 같은 과제가 반복된다.
  - 수정: 정거장 순번에 따라 ZONE을 좁히거나, 경사 확률을 올리거나, 시간 여유(LEG_SLACK)를 줄인다. 아니면 점수 기반 'Level N' 레일 모드를 추가한다.
- [minor/S] `src/components/games/GameSlosh.tsx:650` — 390px에서 scene SVG(viewBox 400×180)가 약 150px 높이로 줄어서 잔이 약 37px밖에 안 된다. ready 카드가 scene 전체를 덮어 첫 정거장도 보이지 않는다(모바일 ready 스크린샷).
  - 수정: 모바일에서는 viewBox를 세로로 늘리거나(예: 400×220) 카트 쪽을 확대한다. ready 안내는 scene 위나 아래의 별도 줄로 옮긴다.
- [minor/S] `src/components/games/GameSlosh.tsx:458` — pressPointer의 setPointerCapture가 try로 감싸여 있지 않다. 합성 포인터 이벤트로 테스트했을 때 'No active pointer' 예외가 9번 났고, 그때마다 ptrRef가 설정되지 않아 GAS가 들어가지 않았다. 실제 CDP 터치 홀드에서는 정상이었다. Shadowfit은 같은 호출을 try/catch로 감싸 둔 것과 대비된다.
  - 수정: Shadowfit처럼 try { setPointerCapture } catch {}로 감싸서, 예외가 나도 throttle 설정이 계속 진행되게 한다.
- [minor/S] `src/components/games/GameSlosh.tsx:128` — hint가 6줄 분량이다. 핵심 피드백 루프(게이지 화살표 방향과 반대로 브레이크)가 문단 속에 묻혀 첫 30초 안에 파악하기 어렵다.
  - 수정: hint는 'GAS/BRAKE를 누르고 유지 · 게이지가 뒤로 쏠릴 때 브레이크 · 1m 안에 정지'처럼 짧게 줄이고 나머지는 howToPlay로 옮긴다.

### word-guess — 20/30 {"clarity": 4, "feel": 4, "mobile": 3, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
플립 애니메이션, 흔들림, 키보드 색 반영까지 Wordle 문법은 잘 갖췄다. 다만 daily 결과를 저장하지 않아서 새로고침이나 Replay Daily로 스트릭을 조작할 수 있는 무결성 문제가 크다.
- [bug/M] `src/components/games/GameWordGuess.tsx:140` — Daily 모드에서 지고 나면 오버레이에 정답이 표시되는데(476), 'Replay Daily'(restart → 같은 daily seed)로 같은 단어를 다시 풀어 이기면 recordEnd(true)가 bumpStreak(174-178)와 Wins/Streak를 올린다. 데일리 스트릭과 공유 카드 등급을 그대로 조작할 수 있음
  - 수정: daily 결과(날짜·status·guesses)를 localStorage에 저장하고, 오늘 이미 끝난 daily면 보드를 끝난 상태로 복원한다. Replay Daily를 막거나 연습 모드로 처리하고 스트릭/승수에 반영하지 않는다
- [major/M] `src/components/games/GameWordGuess.tsx:153` — daily 진행 상황을 저장하지 않는다. 새로고침하거나 Practice로 갔다 돌아오면(switchMode → startBoard) 오늘 판이 빈 보드로 초기화돼서, 사실상 무제한으로 다시 시도할 수 있다
  - 수정: guesses를 dateISO 키로 저장하고 마운트할 때와 daily 모드로 돌아올 때 복원한다
- [minor/S] `src/components/games/GameWordGuess.tsx:66` — 플레이 스크린샷에서 확인함. absent 키(bg-stone-800 text-fg-muted)가 아직 안 쓴 키(bg-white/10)와 거의 구분되지 않아 R/T/S/L/C/N이 회색 처리된 게 잘 안 보인다
  - 수정: absent 키를 opacity-40이나 bg-black/60 + line-through 같은 확실히 어두운 톤으로 바꾼다
- [minor/S] `src/lib/games/registry.ts:435` — howToPlay/FAQ에는 'A new word is picked every game'이라고 되어 있지만 기본 모드는 하루에 단어가 하나로 고정된 Daily다
  - 수정: Daily/Practice 두 모드를 설명하도록 문구를 고친다
- [minor/S] `src/components/games/GameWordGuess.tsx:396` — 390x844 화면에서 보드 아래 키보드 마지막 줄(Enter/⌫)이 첫 화면 밖으로 밀려 있어, 스크롤해야 입력할 수 있다
  - 수정: 모바일에서 타일 크기를 줄이거나 상단 stat/모드 줄을 압축해서 보드와 키보드가 한 화면에 들어가게 한다

### checkers — 20/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/False
강제 포획과 단계별 연속 점프 입력이 잘 구현돼 있고 모바일 보드도 넉넉하다. 무승부 규칙이 없어 킹 종반이 끝나지 않는 구조적 결함이 있다.
- [major/M] `src/lib/games/checkers/engine.ts:228` — winner()에는 말 0개, 둘 수 없음의 두 경우만 있고 무승부 규칙(무포획 N수, 반복)이 없다. 킹끼리 남는 종반은 영원히 끝나지 않아, New Game을 누르는 것 말고는 판을 끝낼 방법이 없고 결과도 기록되지 않는다.
  - 수정: GameState에 sinceCapture 카운터를 두고 40수(양측 합 80 플라이) 동안 포획이나 일반말 전진이 없으면 'draw'를 반환한다. UI에 무승부 오버레이와 D 기록을 추가한다.
- [minor/M] `src/components/games/GameCheckers.tsx:167` — CPU의 연속 점프(playFull)가 출발점에서 최종 도착점까지 한 번의 직선 슬라이드로 표현되고, 잡힌 말들은 동시에 사라진다. 꺾이는 경로나 몇 개를 잡혔는지 읽기 어렵다.
  - 수정: move.path를 hop 단위로 순회하며 220ms 간격으로 setLand와 중간 보드 commit을 반복한다. 플레이어 측 stepPlayer와 같은 방식이다.
- [minor/M] `src/lib/games/checkers/engine.ts:242` — Hard가 깊이 4의 재료 평가(MAN 100/KING 175)뿐이라 위치 개념(중앙, 뒷줄 수비)이 없다. 숙련자에게 천장이 낮다.
  - 수정: 평가에 전진도, 뒷줄 보존, 중앙 점유 가중치를 더하고 깊이를 6으로 올린다(반복 심화와 시간 상한).

### stackpot — 20/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
레인 위험도 색상, 'fits!' 표시, Next 칩 미리보기로 정보 설계가 명확하고 모바일 조작도 편하다. 다만 버스트 연출이 실제로 보이지 않고 연속 이벤트 애니메이션이 재생되지 않아 손맛이 반감된다.
- [minor/S] `src/components/games/GameStackpot.tsx:329` — 버스트 연출 sp-anim-drain이 보이지 않는다. 엔진이 버스트 시 lane.total을 0으로 만든 상태로 커밋하므로(engine.ts:184) fill 높이가 이미 0%이고, 0 높이 요소에 scaleY 애니메이션을 걸게 된다. 레인 단위 버스트 피드백이 사실상 없다.
  - 수정: 버스트 직전 total(lane.total + chip, target 초과분)을 이벤트에 실어 잠시 빨간 오버플로 막대로 그린 뒤 비운다.
- [minor/S] `src/components/games/GameStackpot.tsx:248` — 보드 셰이크와 레인 lockpulse가 key 없이 클래스 토글에만 의존한다. 연속 버스트나 같은 레인 연속 락에서는 클래스가 그대로라 애니메이션이 다시 재생되지 않는다.
  - 수정: 셰이크 래퍼와 레인 애니메이션 span에 key={fxKey}를 붙여 매 이벤트마다 재마운트한다.
- [minor/S] `src/components/games/GameStackpot.tsx:186` — 힌트는 'D or the tray tosses it'이라 하지만 트레이 칩(265행)에는 onClick이 없다. 실제로는 오른쪽 Toss 버튼만 동작한다.
  - 수정: 트레이 칩을 버튼으로 만들어 doToss를 연결하거나, 힌트를 'D or the Toss button'으로 고친다.
- [minor/S] `src/components/games/GameStackpot.tsx:134` — 데일리 모드에서 New Game을 누르면 같은 칩 시퀀스로 무제한 재도전할 수 있고, 게임오버마다 bumpStreak가 호출된다. 시퀀스를 외워 데일리 점수를 올릴 수 있다.
  - 수정: 데일리 첫 판 점수만 'Daily score'로 따로 기록하고, 재도전은 연습으로 표시한다.

### pinwheel — 20/30 {"clarity": 3, "feel": 3, "mobile": 4, "curve": 3, "depth": 4, "polish": 3} challenge=False/True
피벗을 정하고 보드 전체를 돌리는 아이디어가 독창적이고, par와 미리보기 배지(+N pin/Crash) 덕분에 숙련 천장도 있다. 고스트 색이 헷갈리고, 크래시 후 Undo가 막혀 안내 문구와 어긋난다.
- [major/S] `src/components/games/GamePinwheel.tsx:326` — 보드가 산산조각 나면(dead) Undo가 비활성화된다(undoDisabled에 dead 포함, 엔진 undo도 dead면 거부). Playwright에서 Undo(3)가 남아 있는데도 disabled였다. registry FAQ는 'Preview the spin before committing, or undo'라고 안내한다(registry.ts:1579).
  - 수정: crash 직전 스냅샷을 undoStack에 넣고 dead 상태에서도 undo를 허용한다(undosLeft를 소모). 이게 의도가 아니라면 FAQ 문구를 고친다.
- [minor/S] `src/components/games/GamePinwheel.tsx:347` — dead 상태의 힌트가 'Press R to retry'인데, 모바일에는 키보드가 없다.
  - 수정: 터치 환경에서는 'Tap Retry'로 바꾸거나 키 안내를 빼고 오버레이 버튼만 안내한다.
- [minor/S] `src/components/games/GamePinwheel.tsx:372` — 피벗을 꽂으면 CCW/CW 두 방향의 고스트가 다른 색(채움/점선)으로 겹쳐 그려져, 어떤 고스트가 어느 버튼 결과인지 구분하기 어렵다(스크린샷 확인).
  - 수정: Spin 버튼에 hover/focus했을 때만 해당 방향 고스트를 보여 주거나, 버튼 테두리 색과 고스트 색을 일치시키고 범례를 붙인다.

### freecell — 20/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 4, "depth": 3, "polish": 3} challenge=False/True
8열이 390px에 문제없이 들어가고 런 자동 클램프 이동도 잘 동작하는 탄탄한 프리셀이다. 점수가 이동 수를 반영하지 않아 문구와 어긋나고 숙련 보상이 없다.
- [major/S] `src/lib/games/registry.ts:1986` — 팁에는 'a solve in fewer moves scores higher'라고 적혀 있지만 score()(freecell/engine.ts:343)는 '파운데이션×100 + 2000'이라 이동 수가 반영되지 않는다. 모든 승리가 7200점으로 같다.
  - 수정: 이동 수/시간에 따른 보너스를 score에 넣거나 문구를 고친다.
- [minor/M] `src/components/games/GameFreecell.tsx:390` — 힌트에는 'Auto-finish sweeps safe cards'라고 적혀 있지만 autoToFoundations(engine.ts:314)는 올라갈 수 있는 카드를 안전 여부와 상관없이 전부 올린다. 아직 필요한 낮은 카드까지 빼서 판을 망칠 수 있다.
  - 수정: 안전 규칙(반대색 rank-1 두 장이 이미 파운데이션에 있을 때만)을 적용하거나 문구를 'all playable cards'로 바꾼다.
- [minor/S] `src/components/games/GameFreecell.tsx:129` — 'No moves left'로 끝낸 뒤에도 타이머가 계속 흐른다(status가 playing 유지). Solitaire와 같은 문제다.
  - 수정: 타이머 조건에 manuallyEnded를 추가한다.

### yahtzee — 20/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/True
점수 미리보기와 상단 보너스 트래커 덕분에 이해하기 쉽고 모바일 2열 카드도 잘 맞는다. 다만 탐욕적인 '최적 칸' 강조가 오히려 나쁜 플레이를 유도하고, 오탭을 되돌릴 방법이 없다.
- [major/M] `src/lib/games/yahtzee/engine.ts:263` — 앰버로 강조되는 'best' 칸(bestCategory)이 즉시 점수가 가장 큰 칸을 고르는 탐욕 방식이라, 3 of a Kind나 Chance를 일찍 소모하게 유도한다. 강조된 칸만 따라 친 봇은 130점과 94점으로 매우 낮았다.
  - 수정: 강조를 없애거나, 기대값 기반(상단 보너스 진척, 0점 위험 고려) 추천으로 바꾸고 '추천' 라벨을 붙인다.
- [minor/S] `src/components/games/GameYahtzee.tsx:169` — 점수 칸을 한 번 탭하면 확인 없이 바로 확정된다. 2열 카드가 촘촘한 모바일에서 잘못 누르면 칸 하나를 영구히 잃고, 되돌리기도 없다.
  - 수정: 첫 탭은 선택(미리보기 강조), 같은 칸 두 번째 탭이나 'Score' 버튼으로 확정한다. 또는 턴 단위 Undo를 둔다.
- [minor/S] `src/components/games/GameYahtzee.tsx:582` — '★ New best!' 조건이 total>=best_라서 이전 최고와 동점일 때도 신기록으로 표시된다.
  - 수정: persistFinal 전의 이전 best를 ref로 보관하고 total>prevBest일 때만 표시한다.
- [minor/S] `src/components/games/GameYahtzee.tsx:108` — HOLD한 주사위는 어두운 녹색 바탕에 라임색 눈이라 대비가 떨어지고, '꺼진' 것처럼 보인다(모바일 스크린샷에서 1 눈이 흐림).
  - 수정: 홀드 상태에서도 흰 바탕을 유지하고 라임색 테두리와 HELD 배지로만 구분한다.

### battleship — 20/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 3, "depth": 3, "polish": 4} challenge=False/True
자동 배치→전투 흐름이 매끄럽고 콘솔 에러 없이 정상 동작한다. 연출은 무난하나 명중 피드백이 작고 모바일에서 두 격자가 세로로 길어 클래식 이상의 매력은 부족하다.
- [minor/S] `src/components/games/GameBattleship.tsx:333` — 난이도 토글이 전투 중에도 활성이며 difficultyRef만 바꿔 AI가 판 도중 바로 바뀜(재시작·안내 없음). 승패 기록 W/L도 난이도 구분 없이 합산된다.
  - 수정: phase==='play'에서는 토글을 disabled 처리하거나 '다음 판부터 적용' 표시, 기록을 난이도별로 분리
- [minor/S] `src/components/games/GameBattleship.tsx:585` — 명중/격침 표시가 0.7rem 이모지(🔥/💥)뿐이라 390px에서 셀(약 34px) 안에서 작게 보임. 스크린샷상 적 격자에서 명중 셀이 잘 안 띈다.
  - 수정: 명중 셀에 배경 대비를 높이고(neon-red/40) 마크 크기를 셀 대비 60%로 키우기
- [minor/M] `src/components/games/GameBattleship.tsx:411` — 모바일에서 적 격자와 내 함대 격자가 세로로 쌓여 전투 중 CPU 반격(내 격자 흔들림)을 보려면 스크롤해야 함. 1200px에서도 max-w-md 단일 열이다.
  - 수정: sm 이상에서 두 격자 2열 배치, 모바일에서는 내 함대를 축소 미니맵으로 표시
- [minor/M] `src/components/games/GameBattleship.tsx:47` — 배치·AI tie-break가 Math.random 시드로 매번 새로 생성돼 도전 링크/일일 판이 없다(엔진은 rng 주입으로 결정적).
  - 수정: seed를 parseChallenge로 받아 CPU 함대·AI rng를 결정적으로 생성하는 도전 링크 추가

### polarity — 20/30 {"clarity": 3, "feel": 4, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=True/True
원버튼 극성 전환이라는 단순한 조작에 필드 링 애니메이션, 트레일, 콤보 배너가 붙어 손맛이 괜찮다. 다만 진행 중 R 키로 판이 초기화되는 실제 버그가 있고, 미리보기 선이 너무 짧고 흐리며, 초반 도입부가 비어 있다.
- [bug/S] `src/components/games/GamePolarity.tsx:439` — 'r' 키가 status 확인 없이 startNew()를 부른다. 그래서 진행 중인 판이 즉시 초기화된다. 브라우저에서 5m 진행 중 R을 누르면 ready 카드로 돌아가는 것을 확인했다. R은 플립 키 F 바로 옆이라 오타 한 번에 판이 날아간다. 다른 게임들은 'a stray R must not wipe a run' 가드를 두고 있다.
  - 수정: case 'r': if (s.status !== 'running') { e.preventDefault(); startNew() } 로 가드를 추가한다.
- [minor/S] `src/components/games/GamePolarity.tsx:602` — newBest이면 overlay variant가 'win'이 되어, 'Left Behind'/'Spiked!' 같은 사망 제목이 초록 승리 스타일로 나온다(모바일 게임오버 스크린샷). 메시지와 색이 서로 맞지 않는다.
  - 수정: 신기록일 때는 제목을 'New best!'로 바꾸고 사망 원인은 부제로 내린다. 아니면 variant는 lose로 두고 New best 줄만 강조한다.
- [minor/S] `src/components/games/GamePolarity.tsx:45` — 플립 미리보기가 20틱(1/3초)에 opacity .35라서, 플레이 스크린샷에서 공 아래 짧은 점선 조각으로밖에 보이지 않는다. 전략 문구가 '미리보기를 보라'고 강조하는 것에 비해 정보량이 부족하다.
  - 수정: PREVIEW_TICKS를 45~60으로 늘리고 opacity를 .55~.6으로 올린다. 가시 패스 끝에 작은 점을 찍어도 좋다.
- [minor/S] `src/lib/games/polarity/engine.ts:179` — 첫 게이트가 y=620(공 시작 y=120)에 있고 chunk 0은 자석 1개뿐이다. 시작 후 몇 초 동안 할 일이 거의 없다(2.5초 스크린샷에 자석 1개만 보임). 그런데 입력 없이 두면 9.3초 만에 'Left Behind'로 죽어서, 첫 판 학습 경험이 점수 없이 끝나기 쉽다.
  - 수정: CHUNK0_Y를 당겨 첫 게이트가 2초 안에 오게 하고, chunk 0 자석 위치를 첫 게이트 쪽으로 유도하도록 고정 배치한다.

### connect-four — 21/30 {"clarity": 4, "feel": 4, "mobile": 4, "curve": 3, "depth": 3, "polish": 3} challenge=False/False
디스크 낙하 바운스와 사운드 등 손맛이 이 그룹에서 가장 좋다. 다만 결과 오버레이가 승리 라인을 가리고, 판 중간에 난이도를 바꿀 수 있는 허점이 있다.
- [major/S] `src/components/games/GameConnectFour.tsx:335` — 게임이 끝나면 오버레이(absolute inset-0, bg-bg/75)가 곧바로 보드를 덮어서, 네 개 연결 하이라이트(anim-pulse, ring)를 제대로 볼 수 없다
  - 수정: 승리 라인 연출을 700ms쯤 보여준 뒤 오버레이를 띄우거나, 오버레이를 보드 아래로 옮긴다
- [minor/S] `src/components/games/GameConnectFour.tsx:218` — 판 중간에 Easy/Hard를 바꾸면 재시작 없이 AI 강도만 바뀐다. 불리할 때 Easy로 바꿔 이겨도 승수에 그대로 집계되고, TicTacToe(changeDifficulty → restart)와 동작도 다르다
  - 수정: 난이도를 바꾸면 restart()를 호출하고, 기록을 난이도별로 나누어 저장한다
- [minor/S] `src/components/games/GameConnectFour.tsx:115` — 무승부를 recordResult에서 패배(won:false)로 집계하고, 오버레이도 'lose' variant다
  - 수정: 무승부를 별도 bucket으로 집계하고 중립 톤으로 표시한다

### sudoku — 21/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 3, "polish": 4} challenge=False/True
유일해 보장, 메모, 충돌 하이라이트, 숫자패드까지 갖춘 견실한 스도쿠다. 데스크톱과 모바일 모두 콘솔 에러 없이 동작했다. 다만 Undo·peer 메모 자동정리 같은 편의 기능과 기록 경쟁 요소가 빠져 있어 동종 사이트 대비 평균 수준이다.
- [minor/S] `src/components/games/GameSudoku.tsx:206` — 숫자를 확정해도 지워지는 메모는 그 칸의 메모뿐이다(207-211행). 같은 행·열·박스에 남은 같은 후보 메모는 그대로 남아 수동으로 정리해야 한다. 되돌리기(Undo)도 없다.
  - 수정: 정답을 넣을 때 행·열·박스(peer)의 메모에서 그 숫자를 자동으로 제거한다. grid와 notes 스냅샷을 쌓는 Undo 버튼(단축키 Z)을 추가한다.
- [minor/S] `src/components/games/GameSudoku.tsx:215` — 오답을 넣으면 Mistakes만 늘고 페널티나 제한이 없다. 무한히 대입해도 Best 시간이 기록되므로 기록의 의미가 약하다.
  - 수정: 오답 3회 시 패배하는 옵션을 두거나, 오답 1회당 +30초 시간 페널티를 주고 Best는 페널티를 반영한 시간으로 저장한다.
- [minor/M] `src/components/games/GameSudoku.tsx:129` — newGame(difficulty, Math.random)으로 생성해 같은 판을 공유하거나 일일 판을 만들 수 없다. 엔진은 rng 주입을 이미 지원한다.
  - 수정: 시드 rng(mulberry32 등)와 parseChallenge를 연결해 ?seed= 도전 링크와 일일 스도쿠를 제공한다.

### reversi — 21/30 {"clarity": 4, "feel": 3, "mobile": 4, "curve": 3, "depth": 4, "polish": 3} challenge=False/False
코너 가중 alpha-beta AI, 합법수 점과 리플 뒤집기 연출까지 갖춘 담당 중 가장 탄탄한 게임이다. 다만 뒤집기 애니메이션이 색 전환을 보여주지 못한다.
- [minor/S] `src/components/games/GameReversi.tsx:409` — 뒤집기 애니메이션이 이미 새 색(discClass(cell))으로 렌더된 디스크를 rotateY로 돌리기만 한다. 주석('OLD 색에서 시작')과 달리 색은 즉시 바뀌고 디스크가 헛돈다. FlipInfo.color(157행)는 계산만 하고 쓰지 않는다. 스크린샷에서도 회전 중인 디스크가 이미 새 색이었다.
  - 수정: 앞면과 뒷면 두 span(backface-visibility:hidden)을 두고, 앞면은 이전 색, 뒷면은 새 색으로 그려 180° 회전시킨다.
- [minor/S] `src/components/games/GameReversi.tsx:143` — 무승부가 recordResult에 won:false로 들어가 개인 스탯의 패배로 집계된다. 화면의 W/L/D 기록과 스탯 패널이 서로 다르다.
  - 수정: recordResult가 draw를 지원하면 넘기고, 아니면 무승부일 때는 호출하지 않는다.
- [minor/S] `src/components/games/GameReversi.tsx:175` — 패스 안내(passNote)가 다음 플레이어 클릭 전까지 남고, CPU 패스 때는 지연 없이 바로 넘어가서 메시지를 놓치기 쉽다. 오버레이나 토스트 없이 hint 한 줄뿐이다.
  - 수정: 패스 시 보드 위에 1초짜리 배너('CPU passes')를 띄우고 사운드를 낸다.

### kakuro — 21/30 {"clarity": 4, "feel": 3, "mobile": 3, "curve": 3, "depth": 4, "polish": 4} challenge=False/False
런 하이라이트·콤보 도우미·중복 숫자 비활성 등 학습 장치가 좋고 정상 동작한다. 다만 모바일에서 보드가 작고 퍼즐 수가 16개로 적다.
- [minor/S] `src/components/games/GameKakuro.tsx:471` — 보드 maxWidth가 cols*12%로 제한돼 390px에서 이지 퍼즐이 화면 폭의 약 55%만 차지(스크린샷 확인) — 셀이 작아 탭 정확도가 떨어지고 좌우 여백이 낭비됨.
  - 수정: 모바일에서는 maxWidth를 100%로, 셀 최소 44px 기준으로 계산
- [minor/S] `src/components/games/GameKakuro.tsx:190` — 숫자 입력 후 선택이 다음 빈 칸으로 이동하지 않아 매 칸마다 탭이 필요함(키보드/모바일 모두).
  - 수정: fill 성공 시 같은 across 런의 다음 빈 흰 칸으로 commitSel 자동 이동(옵션)
- [minor/S] `src/components/games/GameKakuro.tsx:356` — Solved 카운트를 렌더 중 localStorage에서 직접 읽어 상태와 분리됨 — 렌더마다 storage 접근, try/catch 없음.
  - 수정: 마운트·풀이 시 state로 보관
- [minor/L] `src/lib/games/kakuro/engine.ts:414` — 퍼즐이 16개 고정 뱅크(난이도당 4개)라 금방 소진되고 Next Puzzle은 순환함 — 재플레이 가치 제한.
  - 수정: 뱅크 확장 또는 오프라인 생성기+유일해 검증으로 시드 퍼즐 추가

### 2048 — 22/30 {"clarity": 4, "feel": 4, "mobile": 4, "curve": 3, "depth": 3, "polish": 4} challenge=False/True
슬라이드·병합 팝·점수 플로트·스와이프가 모두 잘 동작하는 이 그룹에서 가장 완성도 높은 게임이다. 다만 되돌리기·모드·도전 링크가 없어 클래식 2048 이상의 깊이는 없다.
- [minor/M] `src/components/games/Game2048.tsx:92` — 엔진이 newGame(rng)/move(s,dir,rng)로 rng를 주입받아 시드로 판 전체를 결정할 수 있는데, 컴포넌트가 Math.random만 쓰고 parseChallenge(도전 링크)가 없다. 이 사이트에서 가장 유명한 게임인데 친구와 같은 판으로 겨룰 수 없다.
  - 수정: 시드 PRNG(mulberry32 등)를 restart와 performMove에 넘기고, parseChallenge로 seed와 목표 점수를 받아 결과 오버레이에 도전 링크 버튼을 붙인다.
- [minor/S] `src/components/games/Game2048.tsx:199` — 애니메이션 중 입력은 queuedRef 한 칸에만 쌓이고 덮어써진다. 130ms 안에 빠르게 연속 입력하면(데스크톱에서 60ms 간격 40회로 확인) 중간 방향이 조용히 사라진다.
  - 수정: 길이 2~3짜리 FIFO 큐로 바꾸거나, 새 입력이 들어오면 진행 중인 슬라이드를 즉시 끝내고(finish) 바로 다음 이동을 처리한다.

### flow — 22/30 {"clarity": 4, "feel": 4, "mobile": 4, "curve": 3, "depth": 3, "polish": 4} challenge=False/True
드래그 경로 보정, 되감기, 연결 피드백이 잘 되어 있어 손맛이 좋다. 1레벨을 실제로 풀었고 모바일 터치도 정상이었다. 다만 레벨을 건너뛸 수 있어 Best가 무의미하다.
- [major/S] `src/components/games/GameFlow.tsx:62` — Best가 '깬 레벨 번호의 최댓값'인데 Next/Prev로 아무 레벨이나 바로 열 수 있다. 26번 하나만 깨도 Best 26이 되어 리더보드 지표로 의미가 없다. 레벨별 클리어 표시도 없다.
  - 수정: 레벨별 solved 집합을 저장하고 Best를 클리어한 레벨 수로 바꾼다. Next는 다음 미클리어 레벨로 보내고 레벨 목록에 체크를 표시한다.
- [minor/S] `src/components/games/GameFlow.tsx:542` — 색상별 지우기 버튼이 20x20px(실측 20)이라 모바일 탭 타깃으로 너무 작다.
  - 수정: h-9 w-9 이상의 히트 영역에 시각 크기 20px 원을 넣는다.
- [minor/S] `src/components/games/GameFlow.tsx:396` — 헤더의 'Restart' 버튼과 하단 'Clear'가 같은 동작(clearAll)을 하는 중복 버튼이다. 엔진의 moves는 화면에 나오지 않아 '더 적은 획으로 풀기' 같은 숙련 목표가 없다.
  - 수정: 하단 Clear를 없애고, moves(획 수)와 레벨별 최소 획 기록을 표시한다.

### unblock — 23/30 {"clarity": 4, "feel": 4, "mobile": 4, "curve": 4, "depth": 3, "polish": 4} challenge=False/True
드래그와 탭 이동, 축 잠금, 탈출 애니메이션, par 비교까지 완성도가 높다. 1레벨을 드래그(데스크톱)와 탭 이동(모바일)으로 각각 최적해로 풀었다. 남은 건 소소한 진행감 보강 정도다.
- [minor/S] `src/components/games/GameUnblock.tsx:136` — 마지막 27레벨에서 Next를 누르면 조용히 1레벨로 돌아간다. 전체 클리어를 축하하는 연출이나 안내가 없다.
  - 수정: 마지막 레벨 클리어 시 'All levels cleared' 오버레이와 par 달성 수 요약을 보여주고, 순환 대신 미클리어 레벨로 보낸다.
- [minor/S] `src/components/games/GameUnblock.tsx:405` — 레벨 셀렉트에 ✓(클리어)만 있고 par 달성(최적해) 여부가 구분되지 않는다. 숙련 목표인 'par 맞추기'가 목록에서 보이지 않는다.
  - 수정: best<=par면 ★, 클리어만 했으면 ✓로 구분 표시한다.
- [minor/M] `src/components/games/GameUnblock.tsx:391` — 힌트 문장이 3줄로 길고, 막혔을 때 쓸 힌트(다음 최적 수)가 없다. 엔진에 BFS가 있는데도 쓰지 않는다.
  - 수정: solveBFS를 확장해 다음 최적 수를 반환하고, 'Hint' 버튼으로 해당 블록을 하이라이트한다.

### fizzbeat — 23/30 {"clarity": 4, "feel": 4, "mobile": 4, "curve": 3, "depth": 4, "polish": 4} challenge=True/True
룰 칩, 다음 숫자 미리보기, 판정 문구, 패드 플래시와 사운드가 촘촘하게 붙어 있어서 이 묶음에서 가장 완성도가 높다. 다만 첫 페이즈가 매 판 같아서 초반이 단조롭고, 모바일에는 일시정지 버튼이 없다.
- [minor/S] `src/lib/games/fizzbeat/engine.ts:174` — 0번 페이즈가 시드와 무관하게 항상 (3,5,+1, 91BPM)으로 고정이다. 매 판 처음 30비트(약 20초 이상, 카운트인 포함)가 똑같아서 재도전할 때 지루하다. 봇 플레이로 확인한 결과 34비트째에야 Phase 2로 넘어갔다.
  - 수정: 0번 페이즈는 쉬운 쌍 풀([3,5],[2,5],[3,4])에서 시드로 고르거나, 0번 페이즈만 PHASE_BEATS를 20으로 줄인다.
- [minor/S] `src/components/games/GameFizzBeat.tsx:401` — 일시정지 입력이 P/Esc 키와 탭 전환뿐이다. 터치 기기에서는 플레이 중에 직접 멈출 수단이 없다(390px 스크린샷에서 확인).
  - 수정: 보드 헤더에 running 상태에서만 보이는 Pause 버튼을 추가하고 pause()를 연결한다.
- [minor/S] `src/components/games/GameFizzBeat.tsx:577` — hint 문단이 6줄 이상이다. 모바일에서 보드 아래 화면을 대부분 차지하고, 핵심 규칙(배수→LEFT/RIGHT, 아니면 침묵)이 긴 문장 속에 묻힌다.
  - 수정: hint는 '÷a → LEFT · ÷b → RIGHT · both → both · else silence' 한 줄로 줄이고, 일시정지 판정 같은 세부 규칙은 howToPlay로 옮긴다.

### hunch — 24/30 {"clarity": 4, "feel": 4, "mobile": 4, "curve": 4, "depth": 4, "polish": 4} challenge=True/True
테스트, 예측, 5연속 판정 루프가 명확하고 카드 연출과 단축키 안내도 좋다. 겹친 거절 카드의 가독성만 아쉽다.
- [minor/S] `src/components/games/GameHunch.tsx:758` — 거절 카드가 marginTop -28px로 겹쳐 쌓여 두 장만 돼도 아래 카드의 숫자·무늬가 대부분 가려짐(10♦가 5♣ 밑에 거의 묻힘, 모바일 스크린샷). 추론 게임에서 거절 이력을 읽기 어려움
  - 수정: 겹침을 -16px 정도로 줄이거나 좌상단 랭크/무늬만 보이도록 카드 상단 띠를 확보, 탭하면 펼치기
- [minor/S] `src/components/games/GameHunch.tsx:800` — 판정 배지(ACCEPTED/REJECTED)가 absolute right-2 top-2로 메인 라인 마지막 카드의 랭크 위에 표시돼, 애니메이션 동안 방금 놓은 카드를 가림(모바일 스크린샷에서 9♠ 랭크가 가려짐)
  - 수정: 배지를 라인 영역 바깥(상단 헤더 줄)이나 방금 놓은 카드 아래쪽에 표시

### lagline — 25/30 {"clarity": 4, "feel": 5, "mobile": 4, "curve": 4, "depth": 4, "polish": 4} challenge=True/True
지연 큐, 고스트 링, 사망 원인 표시('queued 3 beats ago')까지 규칙이 화면에서 바로 읽히는 사이트 최상위권 게임이다. 모바일 오버레이 넘침 정도만 다듬으면 된다.
- [minor/S] `src/components/games/GameLagline.tsx:764` — 모바일 게임오버 오버레이(공유 이름 입력, Daily Three, Next, 리더보드 링크) 높이가 보드보다 커서 inset-0 오버레이가 보드 위아래로 넘침. 상단 통계(BPM/Lag) 위를 덮고 하단 조작 버튼 줄과 겹치며, 포커스된 ▼ 버튼이 오버레이 위로 비쳐 보임(390px 스크린샷)
  - 수정: 오버레이 콘텐츠를 overflow-y-auto + max-h-full로 제한하거나, 사망 시 조작 버튼 줄을 숨기고 보조 링크는 보드 아래로 이동
- [minor/S] `src/components/games/GameLagline.tsx:845` — 'stay' 명령이 ▼ 아이콘이라 '아래로 이동/숙이기'로 오해하기 쉬움(5레인 횡이동 게임이라 아래 방향 이동은 없음)
  - 수정: ▼ 대신 '·' 또는 '⏸' 글리프와 'Stay' 텍스트 라벨 사용(큐 슬롯의 '·' 표기와 통일)

### recoil — 25/30 {"clarity": 4, "feel": 5, "mobile": 4, "curve": 4, "depth": 4, "polish": 4} challenge=True/True
반동 이동, 고스트 궤적, 무마찰 바운스가 직관적으로 연출되고 마우스와 터치 드래그 조준이 모두 잘 동작했다. 콘솔 에러도 없어 완성도가 높다.
- [minor/S] `src/components/games/GameRecoil.tsx:800` — 아레나 상단 우측 '6 / par 6' 표시에 라벨이 없어 발사 수인지 남은 탄인지 알기 어렵고, 바로 옆 탄약 핍 바·헤더의 'Ammo' 통계와 정보가 세 군데에 중복됨(스크린샷)
  - 수정: 'Shots 6 / par 6'로 라벨링하고 헤더 Ammo 통계나 핍 바 중 하나로 통합
