> **한계(작성자 명시): 코드 읽기와 git diff로 판정했고 게임을 실제로 실행해 플레이하지는 않았다.** 메인 세션이 표본 확인(Bankshot 보호 코드·Beatline 시작 단계 존재, 공용 훅 부재)을 마쳤다. 배치를 착수할 때 해당 게임을 모바일 390px에서 직접 확인한다. 하위 15 순위는 감사 점수가 10-10 배치 1 이전 값이라 재감사 전까지 낡았다.

# 리뉴얼 큐 (QA·리뉴얼 담당) — 2026-11-17 기준 main

작성 근거: `docs/audits/2026-10-10-quality-audit.md`(109개 게임, 6축 30점), `docs/daily/backlog.md`·`log.md`, `docs/daily/metrics/2026-11-12~18.md`, `git log --since=2026-10-10`, 현재 main 코드를 직접 읽은 결과. 저장소는 수정하지 않았다(테스트 실행만).


## 0-0. ✅ 완료(11-17, 실기기 확인만 남음): 게임 보드 안에서 페이지 스크롤이 안 된다
- **증상**: 보드를 손으로 짚고 세로로 밀어도 페이지가 스크롤되지 않는다. 보드가 화면의 60~70%를 차지해서 보드 밖에서 스크롤할 영역이 거의 없다. 한 번 진입하면 페이지 아래(가이드·리더보드·댓글)로 내려가기가 불편하다.
- **원인(코드)**: `touch-none`/`touch-action: none`을 쓰는 컴포넌트가 **37개**(tetris·flappy·snake·breakout·pong·space-shooter·bubble-shooter·sokoban·2048·nonogram 등). 조작을 위해 보드 전체에서 터치 스크롤을 막았다. 뿅 착지는 11-17에 수정했고(확인: 가운데 스와이프 0px, 위 띠 +65px·아래 띠 +112px, 가운데·아래 띠 누르기 점프 정상) 나머지 36개가 남았다.
- **수정 방식(검증된 패턴, `GamePlopLanding.tsx` 참고)**: `touch-action`은 조상과의 **교집합**이라 자식이 부모의 `none`을 풀 수 없다. 그래서 컨테이너는 제한하지 않고, **가운데 조작 구역에만 `touch-action: none`** 을 주고 위·아래 가장자리(약 14%/16%)는 `pan-y`로 둔다. 가만히 누르는 입력은 가장자리에서도 게임이 받고, 세로로 밀면 브라우저가 스크롤하며 `pointercancel`을 보낸다(게임은 이를 취소로 처리). 보드가 매우 크면 `max-height: 80svh`로 줄여 보드 밖 영역도 남긴다.
- **진행 상황(11-17 메인 세션, 스크롤 갇힘 수정 — 전체 완료)**: 공통 `src/components/game-shell/PlayZone.tsx`(+`hitCell.ts`)로 **35개 게임 적용·측정·라이브 확인**(뿅 착지 #75, 1차 9개 #79, 2차-A 11개 #83, 2차-B 10개 #84). 측정(CDP 터치): 조작 구역 0px, 가장자리 약 +75~128px, 조작 유지 확인(2048 이동·Flappy 시작·Breakout 패들·AcornHop 띠 탭 무시/가운데 탭 발사·GemMatch 칸 스와이프). 변경 안 한 것: Shadowfit(176px 패널이라 나머지 UI에서 스크롤 가능), Hogline(이미 핸들만 none), FizzBeat·MorseRelay·Slosh·Tetris(버튼형, 변경 불필요). **알려진 한계**: ① WordSearch·GemMatch·Nonogram은 끝 줄(위·아래)에서 시작하는 세로·대각선 드래그가 스크롤로 넘어가 취소된다(다른 끝에서 시작하거나 탭-탭 폴백) ② Polarity '탭하여 시작' 카드는 띠에서 누르면 시작되지 않음 ③ BubbleShooter 마우스 조준선은 위·아래 12% 띠에서 갱신 안 됨 ④ **카카오톡 인앱 브라우저(11-18 오너 확인)**: 사파리·크롬에서는 문제없지만 카카오톡에서 연 페이지는 보드에서 세로로 끌 때 화면이 움직이고 위쪽 인앱 툴바가 같이 접혔다 펴진다(수집 도구 `/tools/stroke-sample`에서 확인, 스크롤 잠금·touchmove 취소로 완화 시도 #96, 효과는 실기기 재확인 전). 카카오 공유(PR #92)로 들어온 사람은 전부 이 환경이므로 **게임 보드 PlayZone 패턴도 카카오 인앱에서 확인**해야 한다. 측정·수집용 데이터는 **사파리·크롬 등 일반 브라우저로** 받는다. ⑤ **iOS Safari·Android 실기기 확인 필요**(Unblock 가로 `pan-y`·세로 `pan-x` 블록, Backspace 두 손가락 되감기가 띠에 걸칠 때). 새 보드를 만들 때는 touch-none을 쓰지 말고 PlayZone 패턴을 따른다(분류·레시피: docs/ops/scroll-classify-2026-11-17.md).
- **게임별 점검**: 방향·스와이프 조작 게임(snake·2048·tetris·sokoban·flow·maze 등)은 가장자리 스와이프가 스크롤과 충돌하므로 **조작 구역을 더 넓게/스크롤 띠를 얇게**, 또는 보드 바로 아래에 "↓ 가이드" 스크롤 안내를 둔다. 공통 래퍼(`ScrollSafeBoard`)로 만들어 한 번에 적용하는 것을 우선 검토한다(공통 기반 먼저).
- **검증**: Playwright CDP 터치 스와이프(`Input.dispatchTouchEvent`)로 가운데·위 띠·아래 띠를 각각 밀어 scrollY 변화를 측정하고, 누르기·끌기 조작이 그대로 되는지 게임별로 확인한다. iOS Safari·Android Chrome 실기기 확인은 오너/실기기 가능한 세션이 한다.
- **뒤로가기(오너 11-17 확인 요청)**: 홈에서 스크롤 → 게임 → 뒤로 시 **스크롤 위치 복원됨**, 게임→게임→뒤로 순서대로 돌아옴(Chromium 모바일·데스크톱 에뮬레이션 확인). 사이트는 `history`를 직접 다루지 않는다(`challenge.ts`의 URL 정리용 `replaceState`뿐). 실제 iOS 스와이프 뒤로·Android 시스템 뒤로는 실기기에서 한 번 더 확인한다(bfcache로 캔버스 게임이 이어지는지 포함).

## 0. 요약

| 항목 | 값 |
|---|---|
| 감사의 `bug` 태그 | 42건 → **수정됨 42 / 남음 0 / 불명확 0** |
| 감사의 `major` 태그 | 133건 → **수정됨 24 / 남음 102 / 불명확 7** |
| bug+major 합계 175건 | 수정됨 66 · 남음 102 · 불명확 7 |
| 감사 1장 A(크래시·플레이 불가) 표 27행 | 27행 모두 수정됨 |
| 감사 1장 B(승리 익스플로잇) 5건 | 5 모두 코드상 수정됨. 단 stakehouse·grasp·handful의 밸런스는 테스트 통과만 확인했고 승률 시뮬을 새로 돌리지는 않았다 |
| 감사 1장 C(기록 무결성) 8건 | 8 모두 수정됨 |
| 감사 2장 공통 기반(P1~P16) | **하나도 만들어지지 않음.** `useGameLoop`·`useRovingFocus`·`useGameKeys`·`dailyResult`·`evaluateBest`·`safeStorage`는 코드베이스에 없다(grep 0건). `GameOverlay`에 `draw` variant와 `cozy` tone만 추가됨 |

핵심 해석: 10-12 PR #13(`674fa78`, "버그 배치 1: 36개 게임 66항목")이 감사의 `bug` 전부와 `major/S` 일부를 처리했다. 그 뒤 게임 컴포넌트·엔진은 Yahtzee 문구 외에는 **바뀐 적이 없다**(registry·gameIntros는 문구·신작 등록 변경)(10-12 이후 커밋은 신작 Acorn Hop·뿅 착지, 홈, 리더보드, 마케팅, 문서뿐). 그래서 "남음" 102건은 대부분 `파일 미변경`이라는 확정 근거가 있다. 배치 1이 손대지 않은 게임(tetris·space-shooter·pong·flappy·snake·minesweeper·sliding-puzzle·solitaire 계열 등)의 major/S가 통째로 남았다.

**가장 먼저 할 5개**
1. **시작 게이트 + 탭 전환 일시정지 공용 훅(`useGameLoop`) 만들고 tetris·space-shooter·pong·flappy에 적용** (batch R1). 로드 즉시 게임이 시작해 첫 판에 죽는 고전 게임 4개. 사이트에서 가장 기대 방문이 많은 장르라 첫인상 손실이 크다(트래픽 추정).
2. **solitaire 계열(solitaire·yukon·golf·freecell·spider) 점수·표시 정직화** (R2). solitaire는 AE 7일 이벤트 상위 1위(실측, 12~26건). 승리 점수가 7200 고정이라 Best가 무의미하고, draw-3인데 waste 1장만 보인다.
3. **무승부 기록·오버레이 지연(connect-four, tic-tac-toe, reversi, checkers)** (R3). 고전 보드게임 4개, 결과가 보드를 가림. GameOverlay 한 곳 수정이 핵심.
4. **지배 전략 게임 3종: strata(전 층 조회로 무조건 승리), ticker(탐욕 99.5% 승), ripple(링 하나로 전 화면 소거)** (R6, R7). 10-10 감사 수치가 그대로 남아 있다(파일 미변경).
5. **포커스 강탈 7종(slotter·turntile·carousel·prismbox·sonar·decant·bearing) `useRovingFocus`** (R4). bearing은 AE 상위 게임(7일 8건, 실측).

**신작과의 관계:** 오너 결정(백로그 11-17)은 신작 A→B 우선이다. 이 큐는 신작 사이클 사이 하루 단위로 끼워 넣는 용도로 짰다. 리뉴얼 배치는 R1·R2·R4를 신작 2일 사이클의 "사이트 성장 축" 날에 배치하는 것을 권한다.

## 1. 확인 방법과 한계 (먼저 읽을 것)

- **게임을 직접 실행해서 플레이하지 못했다.** 브라우저 구동·Playwright 플레이는 하지 않았다. 판정은 전부 코드 읽기와 `git diff d11f63d HEAD -- <파일>`이다.
- `수정됨` = 감사가 지적한 줄/동작을 고치는 코드를 파일:줄로 직접 읽었음. 근거는 부록 표에 있다. "수정이 감사 의도대로 모바일 390px에서 보이는가"는 확인하지 못했다.
- `남음` = (a) 해당 파일이 10-10 이후 바뀐 적이 없음(확정), 또는 (b) 바뀌었지만 감사 지적 부분을 고친 코드가 없음(10건, 근거 적음). 감사 이후 공용 컴포넌트(`GameShell`·`GameOverlay`)가 바뀌었으므로 (a)에서 오버레이·헤더 관련 항목(예: sokoban 535, mastermind 951, tic-tac-toe 413, connect-four 1198, minesweeper 402)은 공용 쪽 수정으로 해소됐을 가능성을 완전히 배제하지는 못했다. 다만 `GameOverlay` diff를 읽었을 때 overflow·revealDelay 관련 변경은 없었다.
- `불명확` 7건 = 코드에서 해당 연출·표시를 찾지 못했지만, 시각 요소라 화면 없이는 단정할 수 없는 것.
- 실행한 것: 관련 엔진 테스트 12개 파일 `npx vitest run`(overfold·hogline·bankshot·stakehouse·handful·grasp·nonogram·countcircle·whackamole·clusters·overload·tripeaks) → **454 tests passed**. 타입체크·lint·전체 테스트는 돌리지 않았다(HANDOFF 기준 전체 vitest에는 기존 실패 약 34건).
- 트래픽 자료: `docs/daily/metrics`에는 **게임별 상위 10개 AE 이벤트 수(7일)** 뿐이다. 11-17자 기준 `2048=19 · unblock=19 · acorn-hop=13 · solitaire=12 · chess=12 · mahjong=9 · bearing=8 · 2048-animals=7`, 11-12~16자에는 `solitaire 16~26 · chess 12~21 · battleship 5~15 · quarry 9 · bearing 8~12 · flow 8 · hogline 6 · mancala 4`. 존 전체 방문자는 하루 약 200~270(봇 포함)이다. 즉 **게임별 트래픽은 표본이 극히 작다.** 그래서 우선순위의 영향도는 "실측(●)=AE 상위에 나타난 게임", "추정(◐)=고전·검색 수요 있는 장르(추정)", "추정(○)=오리지널·저수요(추정)"로 구분해 표시한다.
- 감사 점수는 10-10 시점이고 배치 1 이전이다. 하위 15 순위는 이미 오래됐다. 재감사 없이는 현재 점수를 알 수 없다.

## 2. 우선순위 큐 (남은 항목, 심각도 × 영향)

심각도: **S1** 플레이 즉사·조작 불가 > **S2** 승리 불가/지배 전략/기록이 무의미 > **S3** 사용성·표시. 영향: ●실측 상위 게임, ◐추정(고전·수요 있음), ○추정(저수요). 번호는 부록 표의 감사 원문 줄 번호.

| 순위 | 게임 | 결함(요약) | 심각도 | 영향 | 노력 | 근거 |
|---|---|---|---|---|---|---|
| 1 | tetris | 로드 즉시 낙하, 일시정지 버튼 없음, 탭 숨김 뒤 아무 키나 재개 (924) | S1 | ◐ | S(훅 있으면) | GameTetris.tsx:119 `setRunning(true)`, 파일 미변경 |
| 2 | space-shooter | 시작 화면 없음 + 피격 무적 시간 없음으로 몇 초 만에 3목숨 소실 (553, 555) | S1 | ◐ | S | 파일 미변경 |
| 3 | flappy | 천장 즉사, 첫 파이프까지 1.7초로 첫 판이 첫 파이프 전에 죽음, 난이도 고정 (775, 773) | S1 | ◐ | S | flappy/engine.ts:54,134 미변경 |
| 4 | pong | 마운트 즉시 서브, 득점 직후 재서브, 패들 순간이동 vs CPU 속도 제한 (515, 517) | S1/S2 | ◐ | S+M | 파일 미변경 |
| 5 | solitaire | draw-3인데 waste 1장만 표시 (875), "빨리 끝내면 점수↑" 문구 거짓 (877) | S3 | ● solitaire 12~26건 | S | GameSolitaire.tsx, registry.ts:1979 |
| 6 | yukon·golf·freecell·spider | 승리 점수 상수(7200/4500/10000)라 Best 무의미, freecell 문구 거짓 (893, 1065, 1156, 1040) | S2 | ◐ | S(winScore 헬퍼) | 각 engine score() 미변경 |
| 7 | minesweeper | 첫 클릭 안전 칸이 1칸뿐, 390px에서 헤더 3줄, 깃발은 모드 토글뿐 (400, 402, 404) | S3 | ◐ | S+S+M | 파일 미변경 |
| 8 | sliding-puzzle | `touch-none`인데 스와이프 핸들러 없음, 모바일에서 페이지만 안 내려감 (933) | S3(모바일 사실상 S1) | ◐ | S | GameSliding.tsx:143 |
| 9 | connect-four | 결과 오버레이가 4목 하이라이트를 덮음 (1198), 무승부 기록은 이미 별도 확인 필요 | S3 | ◐ | S | GameConnectFour.tsx 미변경 |
| 10 | tic-tac-toe | Hard가 항상 같은 수(411), 오버레이가 승리 라인을 덮음 (413) | S3 | ◐ | S | tictactoe/engine.ts 미변경 |
| 11 | bearing | 기계적 이분탐색이 항상 최적, 단순 봇이 par 안에 클리어 (668) | S2 | ● bearing 8~12건 | M | bearing/engine.ts 미변경(데일리 기록 조작만 수정됨) |
| 12 | strata | 모든 난이도에서 querySlices ≥ size라 전 층 조회 후 칠하기만 하면 100% 클리어 (254), 3D 프리뷰 없음 (256) | S2 | ○ | M+L | strata/engine.ts:109-110 `size:4 querySlices:6`, `size:5 querySlices:8` |
| 13 | ticker | warming 구간이 무위험 양수라 탐욕이 99.5% 승 (466) | S2 | ○ | M | ticker/engine.ts 미변경 |
| 14 | ripple | RING_MAX_R=566 > 필드 대각선이라 링 하나가 전 화면을 터뜨림, 첫 탭 뒤 필드가 빔 (455, 457) | S2 | ○ | S+S | ripple/engine.ts:85 |
| 15 | zero-hour | 기다릴 이유 없음(값이 줄기만 함), 즉시 리스폰 (448) | S2 | ○ | M | zerohour/engine.ts 미변경(버그 2건은 수정됨) |
| 16 | bubble-shooter | 천장 하강 없음, 그리디 봇 100판 중 53판 교착 (524), pointerdown 즉시 발사 (526) | S2 | ◐ | M+S | 파일 미변경 |
| 17 | 포커스 강탈 7종 | slotter·turntile·carousel·prismbox·sonar·decant·bearing이 state 변경마다 `focus()` (657, 484, 1072, 635, —, —, —) | S3 | ●(bearing)/◐ | S×7 → 훅 1개 M | 예: GameSlotter.tsx:214, GameTurntile.tsx:271, GameCarousel.tsx:249, GamePrismbox.tsx:269, GameSonar.tsx:231, GameDecant.tsx:268, GameBearing.tsx:262. 7건 중 sonar·decant·bearing은 감사에 major로 안 올라와 있어 부록 표에는 없고, 이 줄은 내가 코드에서 추가 확인한 것 |
| 18 | gravwell | 조준 패드 10px로 터치 불가(644), reduced-motion이면 궤적 미리보기 사라짐(646) | S1(모바일)/S3 | ○ | S+S | GameGravwell.tsx 미변경 |
| 19 | slotter | 갭 버튼 16×44px, 오답 1회 즉사 (655) | S3 | ○ | S | GameSlotter.tsx 미변경 |
| 20 | mahjong | 보드 scale min(1) 상한으로 데스크톱 타일 28×36px (886) | S3 | ● mahjong 9건 | M | GameMahjong.tsx 미변경 |
| 21 | hogline | 보드가 첫 화면 밖(245), 기본 샷으로 점수 (본 감사 minor) | S3 | ● hogline 6건 | M | GameHogline.tsx:489-490 |
| 22 | flow | Best가 "깬 레벨 번호 최댓값"이라 26번 하나만 깨도 26 (1243) | S2 | ● flow 8건 | S | GameFlow.tsx:62 미변경 |
| 23 | quarry | 낡은 탐침 거리가 현재 정보처럼 보임 (993) | S3 | ● quarry 9건 | M | GameQuarry.tsx:45 미변경 |
| 24 | reaction-time·aim-trainer·lights-out | 22ms 같은 불가능 기록이 Best로 저장(717), onClick 측정(719), 정확도 미반영(735), 판마다 다른 보드끼리 Best 비교(753) | S2 | ◐ | S×4 | 파일 미변경 |
| 25 | dots-and-boxes·siteswap·gomoku | 터치 타깃 14px(762)·30px(679)·22px(908) | S3 | ◐/○ | S/M | 파일 미변경(gomoku는 Undo·2P만 수정) |
| 26 | tripeaks | 맨 아래 10장이 50% 겹침, 탭 영역 26px (278) | S3 | ○ | M | GameTripeaks.tsx 미변경 |
| 27 | sokoban·mastermind·ttt | 승리 오버레이가 보드 밖으로 넘침(535, 951) | S3 | ◐ | S(공용) | GameOverlay에 max-h/overflow 없음 |
| 28 | decant·splice·bearing·shadowfit·prismbox·overdub·ricochet | 무작위/단순 전략으로 클리어되는 지배 전략 (817, 475, 668, 1094, 633, 837, 797) | S2 | ○ | M~L | 각 엔진 미변경 |
| 29 | skew | 키 입력이 보드 포커스 필요 (620), 깊이 부족 (624) | S3 | ○ | S/L | GameSkew.tsx 미변경 |
| 30 | snake·breakout·memory-game·tetris·typing-test·flappy | 난이도 곡선 없음(690·692·708·915·922·699·773) | S3(curve 축) | ◐ | S~M | 미변경 |
| 31 | jigsaw | 정답 칸을 보여 줘 판단할 게 없음(367), 조각 틈(369), 점수 상수(371) | S2 | ○ | M×3 | 미변경 |
| 32 | sokoban | 레벨 8개 모두 튜토리얼 수준 (533) | S3 | ◐ | L | 라이선스 허용 레벨셋 필요 |
| 33 | nonogram·clusters | 그림이 무작위 노이즈(426), 뱅크가 사전형 범주(861) | S3 | ◐ | L | 콘텐츠 제작 |
| 34 | overfold | 터치 미리보기·2단계 탭 없음 (210) | S3 | ○ | M | GameOverfold.tsx:661-666 |
| 35 | bankshot | 궤적 예측선 없음 (234, 불명확) | S3 | ○ | M | |
| 36 | beatline | 음악/마디 패턴 없음 (223) | S3 | ○ | L | |
| 37 | handful | 데일리 재플레이로 streak 반복 (351) | S2 | ○ | S | GameHandful.tsx:186 |
| 38 | 나머지 | 부록 표의 `남음` 전체 | | | | |

참고: 감사에서 `bug`로 분류된 것은 모두 고쳐졌으므로 **"지금 당장 크래시"는 감사 기준으로 0건**이다. 단 감사는 109개 중 일부를 8회 시험 정도로만 재현했고(bankshot은 8회 중 1회), 수정 뒤 재감사를 하지 않았다.

## 3. 리뉴얼 사이클 배치 (하루 단위 14개)

노력 S/M/L은 추정(S=반나절, M=하루, L=2일 이상). 모든 배치는 공통으로 `pnpm typecheck`·`lint`·해당 게임 vitest·`pnpm build`·`check-routes`를 통과시키고(`log.md`의 기존 검증 관행), 모바일은 **Playwright 390×844 뷰포트에서 첫 화면에 보드·조작부가 모두 보이는지, 가로 스크롤이 없는지**를 확인한다. 게임을 열어 실제 한 판은 수동으로 확인한다.

| 배치 | 내용(3~5개) | 노력 | 검증 | 위험 |
|---|---|---|---|---|
| **R0 (먼저)** 공통 기반 | ① `useGameLoop` 훅(ready/countdown/running/paused/over + visibilitychange + 60Hz 누산기) ② `GameOverlay`에 `revealDelayMs`·`max-h-full overflow-y-auto` ③ `useRovingFocus` ④ `useGameKeys` ⑤ `evaluateBest` | L(2일) | 훅 단위 테스트(탭 숨김 mock, 카운트다운), 기존 적용 게임(beatline·offbeat·gridlock·zero-hour)이 회귀 없는지 | 중. 이미 각 게임이 개별 구현을 갖고 있어 한 번에 갈아끼우면 회귀. 신규 적용만 하고 기존은 나중에 이관 |
| **R1** 즉시 시작 고전 4종 | tetris(924)·space-shooter(553, 피격 무적 555)·pong(515)·flappy(775, 773) 시작 게이트·일시정지 | M | 각 게임 "로드 후 5초 입력 없음 → 게임오버 없음" 테스트, Playwright로 탭 hidden/visible, 390px 터치 시작 | 낮음. 단 기록(Best)이 달라지는 게임이므로 난이도 변경은 이번에는 넣지 않음 |
| **R2** solitaire 계열 정직화 | solitaire waste 3장 표시(875)·registry 문구(877) / yukon·golf·freecell·spider 공통 `winScore({base,sec,moves})`(893,1065,1156,1040) | M | 엔진 테스트에 "빠른 승리 > 느린 승리"; 점수 키 규약 `best:<slug>:<suit>`(spider) 마이그레이션 | 중. 기존 Best(7200 고정)가 새 점수식보다 낮아져 신기록이 아닌 것처럼 보일 수 있음 → 키를 새로 만들 것. 백로그의 solitaire 공략과 같은 주에 처리하면 시뮬 재사용 |
| **R3** 보드게임 결과·무승부 | connect-four(1198)·tic-tac-toe(411 동점 수 무작위, 413)·reversi·checkers(1127 무승부 규칙)에 draw 기록 + 결과 지연 700ms | M | 엔진 테스트(무승부 케이스), 오버레이 뒤로 승리 라인 보이는 Playwright 스크린샷, `recordResult` outcome 'draw' | 낮음. GameOverlay 공용 변경이라 이미 draw를 쓰는 dominoes·mancala·gomoku가 같이 깨지지 않는지 |
| **R4** 포커스 강탈 7종 | slotter(657)·turntile(484)·carousel(1072)·prismbox(635)·sonar·decant·bearing, 키보드 이동 때만 `focus()` | M | 각 게임 "로드 직후 `document.activeElement`가 body", 헤더 버튼 클릭 뒤 포커스가 보드로 안 돌아감 테스트(stakehouse 수정분 테스트를 템플릿으로) | 낮음. 키보드 사용자 내비게이션 회귀만 주의 |
| **R5** 기록·Best 신뢰 복구 | reaction-time 100ms 미만 제외(717)·onPointerDown(719) / aim-trainer 정확도 반영(735) / lights-out par 표시·Best 기준(753) / flow Best=클리어 수(1243) / handful 데일리 재플레이(351) | M | Best 키 로직 단위 테스트, 리더보드 제출 경로(`OverlayScoreSubmit`) 영향 확인 | 중. 이전 Best 값과 단위가 달라지므로 키 버전 올림 필요 |
| **R6** 지배 전략 A (캐주얼 퍼즐) | ripple(RING_MAX_R 140~180, 연속 스폰 455·457) / zero-hour(숙성 곡선 448) / ticker(warming 음수 꼬리 466 + 탐욕 승률 상한 테스트) | M | 감사 수치(ticker 탐욕 99.5%, ripple 중앙만 탭해 10분)를 상한 단언으로 테스트화(`simulate(policy, seeds)` 하네스를 이날 같이 만듦) | 중. 난이도가 오르면 신규 사용자 이탈. 하네스에 "인간 평균 플레이" 정책을 두고 승률 하한도 걸 것 |
| **R7** 지배 전략 B (추론 퍼즐) | strata(querySlices ≤ size−2, 슬라이스를 실루엣으로, 254) / bearing(668 이분탐색 방지, 예산 축소) / jigsaw(정답 칸 힌트 횟수제 367) | M~L | 위 하네스로 봇 승률, 데일리 par 확인 | 중. strata는 감사 점수 최하위권(12점)이라 재평가 가치가 가장 큼 |
| **R8** 모바일 터치 타깃 | gravwell(644,646)·dots-and-boxes(762)·siteswap(679)·slotter 갭(655)·sliding-puzzle 스와이프(933) 공용 `<HitArea>` | M | 390px에서 getBoundingClientRect ≥44px 단언(Playwright), 실기기 한 번 | 낮음. 시각 크기 유지하고 히트만 확대 |
| **R9** 모바일 레이아웃 | minesweeper 헤더 1줄(402)·깃발 길게 누르기(404)·첫 클릭 8칸 안전(400) / gomoku 22px(908) / tripeaks(278) | M | 390px 스크린샷 비교, 첫 클릭 확률 테스트(8칸 모두 0) | 중. 첫 클릭 안전 영역 확장은 승률 변화 → Beginner 지뢰 수 점검 |
| **R10** 오버레이 오버플로 | sokoban(535)·mastermind(951)·ttt·connect-four 공용 GameOverlay `max-h-full overflow-y-auto` | S | 각 게임 낮은 보드 상태에서 승리 뒤 오버레이가 보드 안에 들어오는지 Playwright | 낮음 (R3과 합칠 수 있음) |
| **R11** Hogline·Bankshot·Overfold 마무리 | hogline viewBox 크롭·Throw 버튼 첫 화면(245) / bankshot 점선 예측선(234) / overfold 터치 2단계 탭 + 동점 크리스 토글(210) | M~L | 390px에서 하우스와 조작부 동시 노출, 터치 시나리오 | 중. 세 게임 모두 감사 점수 최하위권(11~12점)이라 재감사 대상 |
| **R12** 입문 난이도 곡선 | snake 속도 증가·입력 큐(690,692) / breakout 단계(708) / memory-game 난이도(915) / typing-test 단어 풀(699) | M | 시간 경과별 속도 곡선 테스트, 30초 생존 비율 봇 | 낮음~중. Best 단위 변경 없음 |
| **R13** 리듬 3종 | beatline 음악·마디 패턴(223, L) / offbeat 아크 시작 각도 무작위(391) / polytap 메트로놈(591) | L(2일) | 오디오 지터 측정, 120Hz 기기에서 판정창 | 높음. 오디오 합성은 브라우저 자동재생 정책·모바일 지연 이슈 |
| **R14** 콘텐츠 중심 게임 | sokoban 레벨 30개+(533) / nonogram 픽셀아트 세트(426) / clusters 뱅크 확대(861) | L(3일) | 레벨 솔버 검증, 유일해 검증 | 중. 라이선스(레벨셋), 저작권 있는 그림 금지 |

배치 순서 제안: **R0 → R1 → R2 → R3(+R10) → R4 → R5 → R6 → R7 → R8 → R9 → R11 → R12 → R13 → R14**. R1·R2는 트래픽(추정)과 첫인상 영향 때문에 R0 훅 일부(시작 게이트)만 먼저 만들고 곧바로 적용해도 된다.

## 4. 공통 기반을 먼저 하라 (감사 2~3장 기준, 아직 전부 미구현)

| 공통 기반 | 한 번에 없애는 남은 항목 수(감사 원문 기준) | 근거 |
|---|---|---|
| **P1 `useGameLoop`** (시작 게이트·카운트인·탭 전환 일시정지·60Hz 누산기) | tetris 924, space-shooter 553, pong 515, flappy 775, 그리고 offbeat·beatline·gridlock·zero-hour가 각자 중복 구현한 것을 이관 가능 | beatline·offbeat·gridlock·zero-hour는 개별 수정됨, 나머지는 미수정 |
| **P2 `useRovingFocus`** | 7개 게임(slotter 657, turntile 484, carousel 1072, prismbox 635, sonar, decant, bearing) | 위 표 17번 |
| **P4/P5 `GameOverlay` 개선** (reveal 지연, overflow) | connect-four 1198, ttt 413, sokoban 535, mastermind 951, hogline류 마지막 투구 | `GameOverlay.tsx`에 해당 prop 없음 |
| **P7 `draw`** | connect-four·tic-tac-toe·reversi·checkers (이미 dominoes·mancala·gomoku는 사용) | `GameOverlay variant='draw'` 있음 |
| **P8 `dailyResult`** | handful 351 남음. word-guess·strata·bearing은 각자 개별 수정됨(키가 3종 다름: `DailyRecord`, `strata:daily-done`, 플래그) → 공통화하면 중복 제거 | 부록 근거 |
| **P10 `winScore`** | solitaire·yukon·golf·freecell·spider·jigsaw·lights-out (893, 1065, 1156, 1040, 371, 753) | 점수 상수 |
| **P11 `simulate(policy, seeds)` 하네스** | ticker·ripple·strata·bearing·decant·splice·shadowfit·bubble-shooter·overdub·aim-trainer·siteswap (지배 전략 11종) | 감사 수치가 곧 기준값 |
| P12 `<HitArea>` | gravwell·slotter·dots-and-boxes·siteswap·gomoku·hogline | R8 |
| P15 `safeStorage` | maze·tic-tac-toe·pong·sokoban 등. 감사는 try/catch 없음으로 지적했으나 이번에 코드로 재확인하지 못함 → **불명확** | `localStorage` 직접 호출 grep만 확인 |

## 5. 저퀄리티 게임 후보: 감사 총점 하위 15 (+동점)

감사 6장 하위 15는 overfold 11, beatline 11, bankshot 11, hogline 12, strata 12, dominoes 13, tripeaks 14, stakehouse 14, countcircle 14, bisect 14, gridlock 14, maze 15, flywheel 15, handful 15, interlock 15이다(jigsaw·grasp·offbeat도 15 동점). **모두 10-10 시점 점수이고 bug는 모두 고쳐졌다.** 사이트 전체가 AdSense 재검토 중이고(11-16 제출) 게임 110개 모두 고유 본문 300단어 이상이다(`docs/adsense/2026-11-16-readiness.md`)이므로, **지금 단계에서 게임을 내리는 것은 권하지 않는다.** 내리면 색인 페이지 수와 "게임 110종" 문구, 내부 링크가 같이 줄어든다. 내리기보다 `noindex` 후보로 먼저 격하하는 순서가 안전하다.

| 게임(점수) | 현재 남은 문제 | 제안 | 근거 |
|---|---|---|---|
| overfold (11) | 터치 2단계 없음(210). jam 승리 익스플로잇·핍 모양은 수정됨 | **고치기** → 재감사. 접기 콘셉트가 독창적이라 유지 | 감사 평: "접기 아이디어는 독창적". 오리지널 정체성 방향(owner-direction)과 맞음 |
| beatline (11) | 음악 없음(223 L). 시작 게이트·판정 오프셋은 수정됨 | **대폭 리뉴얼(L)** 후보. 우선순위는 낮음 | 리듬 장르는 오디오가 핵심. 수정 전 감사 평은 "반응 테스트에 가깝다" |
| bankshot (11) | 예측선 없음(234). 크래시·조준·샷 상한 수정됨 | **고치기(M)** | 핵심 결함이 해소돼 점수 상승 여지 큼 |
| hogline (12) | 모바일 첫 화면 밖(245). 즉시 승리 익스플로잇 수정됨 | **고치기(M)**, 실측 AE 6건/주로 하위권 중 유일하게 트래픽 있음 | metrics 11-14 `hogline=6` |
| strata (12) | 전 층 조회로 승리 가능(254), 3D 없음(256) | **대폭 리뉴얼**. 콘셉트(3D 복셀 추론)는 좋으나 규칙·시각화가 문제 | 감사 평: "조회 후 칠하면 무조건 이김" |
| dominoes (13) | 데일리 문구 일치·열린 끝 배지 등 minor. 타일 렌더·무승부 수정됨 | **유지(고치기 마감)** | 고전 게임, 검색 수요 추정 |
| tripeaks (14) | 겹침·탭 영역(278 M) | **고치기(M)** | 솔리테어 계열은 solitaire 트래픽과 같이 묶어 R2에서 |
| stakehouse (14) | 밸런스 재설계 완료(150칩 목표). 토큰 연출(289 불명확) | **재감사 후 결정**. 승률 시뮬 재실행 필요 | 엔진 테스트 47개 통과, 시뮬 미재실행 |
| countcircle (14) | 거의 해소(엔진 이동 수정, 키 입력, 히트 영역) | **재감사 후 결정** | 근거: 엔진 :258-271, GameCountcircle.tsx:363-370 |
| bisect (14) | 규칙이 정보 없는 추측(305 L), 결과 피드백 없음(307 S). 미수정 | **대폭 리뉴얼(L) 또는 "조건부 내림"**. 먼저 307(S)부터 | 하위 15 중 유일하게 규칙 자체가 문제. 4주 뒤 지표가 없으면 noindex로 격하 후보 |
| gridlock (14) | 키·셀 크기·visibility 모두 수정됨 | **재감사 후 결정** | 근거 GameGridlock.tsx:244,320,419 |
| maze (15) | 플레이어/출구 색 같음(325 S), 한 칸씩 이동(327 M) | **고치기(S+M)** | 미변경, 로컬 저장소 try/catch 불명확 |
| flywheel (15) | 판정 창·표시·peak 모두 수정됨 | **재감사 후 결정** | |
| handful (15) | 밸런스 수정 완료(균형 테스트 통과), 데일리 재플레이(351) | **고치기(S)** 후 유지 | |
| interlock (15) | 스크램블 4/10/16 수정됨, 홈 아크 표시 불명확(360) | **고치기(M)** | |

내리기를 정당화할 만한 후보는 **현재 없다.** 굳이 꼽으면 bisect(규칙이 성립하지 않음)·beatline(음악 없는 리듬 게임) 두 개만 "리뉴얼 시도 후 4주 지표가 없으면 noindex 전환" 대상이다. 삭제가 아니라 noindex로 하는 이유는 사이트 게임 수 표시와 AdSense 콘텐츠 풍부함을 지키기 위해서다. 판단 근거는 트래픽이 아니라 감사 점수이므로 오너와 합의가 필요하다.

## 6. 새로 발견한 것·주의

- **장점:** 배치 1이 엔진 테스트(총 454건 중 일부 확인)를 같이 넣어 회귀 방지 장치가 있다. 남은 지배 전략 게임도 테스트화하기 쉽다.
- **배치 1 이후 게임 코드가 멈춰 있다.** 신작 팀 사이클에 밀려 리뉴얼이 5주 동안 0건. 오너 목표 ②에 해당하는 일을 하루 단위로 시작할 수 있는 상태다.
- **감사 문서의 3장·4장(배치 계획·도전 링크)은 아직 구현 안 됨.** 4장 도전 링크 확산 대상 91종은 선행 조건이 `dailyResult`이므로 R0·R5 이후에 가능.
- 백로그에 있는 **solitaire·chess 공략**은 트래픽 1·2위(실측 7일 이벤트)지만 chess는 감사 major가 1건(1058 마지막 수 표시)뿐이고 이미 수정됐다. 즉 chess는 리뉴얼보다 공략·AI 강도 같은 콘텐츠 쪽이 맞다. solitaire만 R2가 직접 해당한다.
- 감사에 없는 게임(acorn-hop, plop 등 11월 신작)은 이 큐에서 제외했다.

---

# 부록. 감사 bug·major 175건 전수 판정

열: 감사 원문 줄 번호 | 게임(감사 총점) | 심각도/노력 | 위치 | 판정 | 근거 | 감사 원문 요약(앞 60자)

| 줄 | 게임(점) | 심각도 | 위치 | 판정 | 근거 | 요약 |
|---|---|---|---|---|---|---|
| 206 | overfold(11) | bug/M | L/overfold/engine.ts:118 | 수정됨 | engine.ts:127-129 isWon = pipCount===0 && !hasJam | isWon이 '핍 0개'만 검사하는데, 서로 다른 색이 겹쳐 생긴 JAM도 핍을 없앤다. 그래서 아무렇게나  |
| 208 | overfold(11) | major/S | C/GameOverfold.tsx:587 | 수정됨 | GameOverfold.tsx:613 aspect-square | 핍이 h-3/5 w-3/5 rounded-full이라 셀 비율을 그대로 따른다. 4x2 보드에서는 핍이 세로 |
| 210 | overfold(11) | major/M | C/GameOverfold.tsx:633 | 남음 | GameOverfold.tsx:661-666 onClick이 곧바로 확정, 터치 2단계 없음 | 미리보기(seal/jam 하이라이트)가 onMouseEnter에서만 갱신된다. 터치에서는 탭이 곧바로 확정이 |
| 219 | beatline(11) | bug/M | C/GameBeatline.tsx:231 | 수정됨 | GameBeatline.tsx:62,142-181,538-553 ready+카운트다운, engine.ts LEAD_IN_TICKS=150 | 시작 게이트 없이 마운트 직후 rAF가 틱을 진행해 노트가 바로 떨어진다. 실측: 로드 후 약 1.8초 만에 |
| 221 | beatline(11) | major/S | C/GameBeatline.tsx:400 | 수정됨 | GameBeatline.tsx:59 NOTE_HEIGHT/2 보정 | 노트의 top이 판정선에 닿는 순간이 정타(remaining=0)라 노트 본체(26px)가 선 아래에 있다. |
| 223 | beatline(11) | major/L | L/beatline/engine.ts:155 | 남음 | beatline/engine.ts diff는 LEAD_IN_TICKS뿐. 음악·마디 패턴 없음 | 음악/메트로놈이 없고 노트가 density 확률로 랜덤 슬롯에 배치돼 '리듬'이 아니라 반응 테스트에 가깝다 |
| 230 | bankshot(11) | bug/S | C/GameBankshot.tsx:252 | 수정됨 | GameBankshot.tsx:280 p를 0~1로 클램프, :116-117 pathIdx 클램프 | Fire 후 rAF 콜백의 타임스탬프 t가 effect에서 잡은 t0=performance.now()보다 이 |
| 232 | bankshot(11) | bug/S | C/GameBankshot.tsx:570 | 수정됨 | GameBankshot.tsx:594-616 공 pointerEvents none + 투명 히트 원 최상단 | 드래그 조준 핸들(launch-point, r=1.6)이 그보다 큰 공(r=6, 나중에 그려짐) 아래에 완전 |
| 234 | bankshot(11) | major/M | C/GameBankshot.tsx:539 | 불명확 | 예측선 코드를 찾지 못함(GameBankshot.tsx:236 주석만). 조준선 굵기는 직접 확인 못함 | 조준선 길이가 4+power*0.12 world unit으로 짧고 얇아(0.4) 모바일에서 거의 안 보임.  |
| 236 | bankshot(11) | major/S | L/bankshot/engine.ts:126 | 수정됨 | bankshot/engine.ts:128-133,491 SHOT_SLACK=3 상한, UI :734 안내 | 샷 제한이나 실패 조건이 없어(FAQ도 'no shot limit'이라고 명시) 무한 재시도로 언젠가 반드시 |
| 241 | hogline(12) | bug/S | L/hogline/engine.ts:519 | 수정됨 | hogline/engine.ts:505-510 승리 판정에서 보너스 제외 | bank는 남은 샷×15점을 더하는데 목표 점수는 40~52다. 시작하자마자 Bank Score를 누르면 6 |
| 243 | hogline(12) | major/S | C/GameHogline.tsx:602 | 수정됨 | GameHogline.tsx:159-172,407 throwSettled 후 오버레이 | 마지막 샷을 릴리스하면 reduce가 바로 finished=true가 되어 오버레이가 즉시 뜬다. 그래서 마 |
| 245 | hogline(12) | major/M | C/GameHogline.tsx:465 | 남음 | GameHogline.tsx:489-490 viewBox 전체 + max-w-70 그대로 | 시트(100×220)를 최대 280px 폭으로 그려 보드 높이가 약 616px다. 1200×900 데스크톱과 |
| 247 | hogline(12) | major/S | C/GameHogline.tsx:519 | 수정됨 | GameHogline.tsx:553-556 HACK_HIT_R 투명 히트 영역 | 드래그로 조준하는 핵 원이 화면에서 약 21×21px라 터치 타깃으로 너무 작다. |
| 254 | strata(12) | major/M | L/strata/engine.ts:109 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/strata/engine.ts:109 | 모든 난이도에서 querySlices >= size(easy 6≥4, normal 8≥5, hard 10≥6 |
| 256 | strata(12) | major/L | C/GameStrata.tsx:495 | 남음 | GameStrata.tsx 3D 프리뷰 코드 없음(diff는 데일리 기록뿐) | '3D 복셀 퍼즐'인데 3D 미리보기가 전혀 없고 X/Y/Z 축·층 번호의 방향 관계 설명도 없어 첫 30초 |
| 258 | strata(12) | bug/S | C/GameStrata.tsx:189 | 수정됨 | GameStrata.tsx:67-72,214-218 strata:daily-done로 재도전은 기록 제외 | 데일리 패배 시 AnswerPreview로 정답 전체를 공개한 뒤 Replay Daily가 같은 시드로 re |
| 265 | dominoes(13) | bug/S | C/GameDominoes.tsx:72 | 수정됨 | GameDominoes.tsx:573 h-8 w-16 래퍼 + DominoTile h-full w-full | 바닥에 깔린 타일 줄이 렌더링되지 않음. 실측하면 줄의 타일이 3x2px로 찌그러져 점선처럼 보인다(데스크톱 |
| 267 | dominoes(13) | bug/S | C/GameDominoes.tsx:153 | 수정됨 | GameDominoes.tsx:169-170,512,695 draw outcome + draw 오버레이 | 블록 무승부(winner===null)를 패배로 처리함. humanWon=false라 bumpRecord(' |
| 276 | tripeaks(14) | bug/S | L/registry.ts:2066 | 수정됨 | tripeaks/engine.ts:164-173,299 CHAIN_STEP 보너스를 점수에 반영(문구에 맞춤) | 팁과 FAQ(2066, 2074)는 'longer chains score much higher'라고 약속하지 |
| 278 | tripeaks(14) | major/M | C/GameTripeaks.tsx:285 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameTripeaks.tsx:285 | COL_UNIT=26, CARD_PX=52라 맨 아래 10장이 50%씩 겹치고 수트가 가려진다. 탭 영역도  |
| 285 | stakehouse(14) | bug/M | L/stakehouse/engine.ts:141 | 수정됨 | stakehouse/engine.ts:38,296 TARGET_BANKROLL 150 이상만 승리 + floor 토큰 정보. 엔진 테스트 47개 통과. 실제 승률 시뮬은 재실행 안 함 | 배당 = 1+(t/g-1)*0.9 이라 칩당 기대값 = 0.9+0.1·g/t ≤ 1 — 모든 베팅이 음의 기 |
| 287 | stakehouse(14) | major/S | C/GameStakehouse.tsx:375 | 수정됨 | GameStakehouse.tsx:355-359 키보드 이동 때만 focus | state 변경마다 cardRefs[focus].focus()를 호출해 로드 직후 Pot1이 포커스됨(실측  |
| 289 | stakehouse(14) | major/M | C/GameStakehouse.tsx:210 | 불명확 | 토큰 뽑기 연출 코드 못 찾음(:120,463 lastResult 표시만). 시각 확인 불가 | 라운드 결과 연출이 카드 하단 작은 '+N/−N' 텍스트와 항아리 높이 변화뿐 — 어떤 토큰(보석/꽝)이 나 |
| 296 | countcircle(14) | bug/M | L/countcircle/engine.ts:262 | 수정됨 | countcircle/engine.ts:258-271 playerIdx만 이동(배열 재정렬 제거) | move가 survivors 배열에서 좌석 id를 맞바꾸고 렌더는 좌석 id 고정 각도로 그리므로, 이동해도 |
| 298 | countcircle(14) | major/S | C/GameCountcircle.tsx:278 | 불명확 | 히트 영역 44px(:363-370)는 확인. 좌석 아이콘 구분은 코드로 판단 불가 | 좌석이 모두 동일한 빈 원이라 내가 누구인지/이웃 버튼이 무엇인지 구분이 약하고, 이동 버튼만 44px로 커 |
| 305 | bisect(14) | major/L | L/bisect/engine.ts:95 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/bisect/engine.ts:95 | 구간 길이가 30~180틱(0.5~3초)에서 매 라운드 무작위로 정해지고, 끝 신호보다 먼저 탭해야 한다.  |
| 307 | bisect(14) | major/S | C/GameBisect.tsx:299 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameBisect.tsx:299 | 탭하면 라운드가 즉시 끝나고 실제 끝 시점은 끝내 보여주지 않는다. 결과로 ±ms만 나와서 구간이 얼마였는지 |
| 314 | gridlock(14) | bug/S | C/GameGridlock.tsx:218 | 수정됨 | GameGridlock.tsx:244 visibilitychange 핸들러 정리, 테스트 추가 | visibilitychange 핸들러가 deps [] 로 등록되어 첫 렌더의 state(null)를 클로저로 |
| 316 | gridlock(14) | major/S | C/GameGridlock.tsx:337 | 수정됨 | GameGridlock.tsx:320 window keydown | 키 입력이 tabIndex=0 그룹의 onKeyDown에만 걸려 있어 페이지 로드 직후(포커스=BODY) 화 |
| 318 | gridlock(14) | major/S | C/GameGridlock.tsx:147 | 수정됨 | GameGridlock.tsx:419 clamp() 셀 크기 | 390px에서 W/E 트랙(36px 셀×5+라벨)이 3열 그리드 w-fit으로 붙어 보드 폭을 넘어감. sc |
| 325 | maze(15) | major/S | C/GameMaze.tsx:303 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameMaze.tsx:303 | 플레이어는 bg-accent인데 이 페이지의 accent가 녹색이라 출구(bg-neon-green, 290행 |
| 327 | maze(15) | major/M | C/GameMaze.tsx:184 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameMaze.tsx:184 | 스와이프와 D-pad가 한 번에 한 칸만 움직인다. Hard(16x16)를 모바일로 풀면 수십~수백 번 탭해 |
| 336 | flywheel(15) | major/S | L/flywheel/engine.ts:58 | 수정됨 | flywheel/engine.ts:62-63 PERFECT 0.15, GOOD 0.35 | 판정 창이 지나치게 좁다. 40rpm에서 perfect 창은 ±0.012회전으로 약 ±18ms, good 창 |
| 338 | flywheel(15) | major/S | C/GameFlywheel.tsx:229 | 수정됨 | GameFlywheel.tsx:30-36 EARLY/LATE 텍스트 | 탭 판정 결과(PERFECT, GOOD, EARLY, LATE)를 텍스트나 시각으로 보여 주지 않는다. pe |
| 340 | flywheel(15) | bug/S | C/GameFlywheel.tsx:447 | 수정됨 | GameFlywheel.tsx:517 runPeak 표시 | 게임오버 오버레이가 'Peak RPM: {best}'로 이번 런 peak가 아니라 역대 Best를 표시한다. |
| 347 | handful(15) | bug/M | L/handful/engine.ts:217 | 수정됨 | handful/engine.ts:103-112 g^2 + 콤보 제한, engine.test.ts:486 균형 테스트(고정 크기 지배 전략 없음) 통과 | 점수 설계가 게임 콘셉트와 반대로 작동한다. 콤보 보너스 5*(combo-1)이 손 크기 보상 g(g+1)/ |
| 349 | handful(15) | major/S | L/handful/engine.ts:183 | 수정됨 | handful/engine.ts:33 START_SIZE=3 | 시작 크기가 maxGrab(8)이라 GRAB만 누르면 30개가 8개씩 4번에 끝난다. 실제로 데일리 한 판이 |
| 351 | handful(15) | major/M | C/GameHandful.tsx:236 | 남음 | GameHandful.tsx:179-190 데일리 승리마다 bumpStreak, 재플레이 가드 없음 | Daily 'Replay Daily'가 같은 seed로 reset하는데, 뽑는 순서까지 같다. 한 번 해 본 |
| 358 | interlock(15) | bug/S | C/GameInterlock.tsx:489 | 수정됨 | GameInterlock.tsx:518-519 B 링 라벨/dir 교정 | 오른쪽 링 버튼의 방향 라벨과 아이콘이 반대다. RING_B 순서(0→10→11→12→13→1…)에서 dir |
| 360 | interlock(15) | major/M | C/GameInterlock.tsx:438 | 불명확 | 홈 아크 표시 코드 못 찾음. 문구만 있음(:371). 시각 확인 불가 | 각 색의 '홈 아크'가 어디인지 화면에 표시가 없다. 구슬 숫자만 있어서, 바깥 왼쪽 호=1, 안쪽 호=2/ |
| 362 | interlock(15) | major/S | L/interlock/engine.ts:52 | 수정됨 | interlock/engine.ts:62-64 스크램블 4/10/16 | Easy가 12수, Daily/Normal이 20수 무작위 스크램블이라 사실상 완전히 섞인 헝가리안 링이 된 |
| 367 | jigsaw(15) | major/M | C/GameJigsaw.tsx:412 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameJigsaw.tsx:412 | 조각을 고르면 정답 칸이 앰버색으로 바로 표시되고(501·523행), 정답 칸에만 놓을 수 있다. 판단할 게 |
| 369 | jigsaw(15) | major/M | C/GameJigsaw.tsx:186 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameJigsaw.tsx:186 | PieceArt viewBox에 MARGIN(28)을 더해서 놓인 조각 몸통이 칸의 약 64%만 차지한다.  |
| 371 | jigsaw(15) | major/M | L/jigsaw/engine.ts:437 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/jigsaw/engine.ts:437 | 점수가 placedCount*100 + n²*50으로 크기별 상수다. 틀린 시도는 move로 세지 않아서 m |
| 378 | grasp(15) | bug/S | L/grasp/engine.ts:173 | 수정됨 | grasp/engine.ts:164-190 마진 보너스를 클리어 시에만 지급(MARGIN_BONUS_MAX 15), 테스트 29개 통과 | 그랩 1회의 마진 보너스 손실(Normal 13, Easy 17, Hard 10)이 카드 최대값(6/5/7) |
| 380 | grasp(15) | major/M | C/GameGrasp.tsx:367 | 불명확 | 카드 이동 연출 코드 확인 못 함 | 카드 공개가 숫자 박스 0.16s 슬라이드뿐이고 잡기/놓기에 카드가 어디로 가는지(손패/버림) 피드백이 없어 |
| 387 | offbeat(15) | bug/S | C/GameOffbeat.tsx:172 | 수정됨 | GameOffbeat.tsx:36,189-214 phase 'ready' + 첫 탭 시작, :161 60Hz 누산기 | 마운트하자마자 startGame()으로 rAF 루프가 돌고, 탭하지 않은 박자마다 step()이 'miss' |
| 389 | offbeat(15) | major/S | C/GameOffbeat.tsx:148 | 수정됨 | GameOffbeat.tsx:161 60Hz 누산기 | step()을 rAF 프레임마다 정확히 1번 호출해서 박자 간격(START_GAP 48→MIN_GAP 14) |
| 391 | offbeat(15) | major/M | C/GameOffbeat.tsx:279 | 불명확 | 아크 시작 각도 무작위화 여부 코드로 판단 못 함 | 진행 아크와 라임 목표점이 늘 6시 방향(0.5)이라 리듬 게임이 아니라 '아크가 점에 닿으면 탭'하는 시각 |
| 400 | minesweeper(16) | major/S | L/minesweeper/engine.ts:47 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/minesweeper/engine.ts:47 | 첫 클릭은 클릭한 칸 하나만 지뢰에서 제외한다. 실제 플레이(데스크톱·모바일 각 1회)에서 첫 클릭에 숫자  |
| 402 | minesweeper(16) | major/S | C/GameMinesweeper.tsx:159 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameMinesweeper.tsx:159 | 390px에서 Mines 스탯 + Time/Best/Flag 칩 + 음소거 + New Game이 한 헤더에  |
| 404 | minesweeper(16) | major/M | C/GameMinesweeper.tsx:243 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameMinesweeper.tsx:243 | 모바일에서 깃발을 꽂으려면 상단 Flag 모드를 켰다 꺼야 한다. 길게 누르기도 없고, 숫자 칸 코드(주변  |
| 411 | tic-tac-toe(16) | major/S | L/tictactoe/engine.ts:109 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/tictactoe/engine.ts:109 | Hard AI(bestMove)가 점수가 같으면 항상 가장 낮은 인덱스를 고른다. 그래서 같은 수를 두면 매 |
| 413 | tic-tac-toe(16) | major/S | C/GameTicTacToe.tsx:256 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameTicTacToe.tsx:256 | 모바일 플레이 스크린샷에서 확인함. 게임이 끝나는 즉시 GameOverlay가 보드 전체를 덮어서, 컴퓨터가 |
| 422 | nonogram(16) | bug/M | L/nonogram/engine.ts:123 | 수정됨 | nonogram/engine.ts:239-243 isSolved=단서 일치, :160-202 isLineSolvable로 유일해 생성 | isSolved가 단서 충족이 아니라 숨겨진 solution 일치로 판정한다. 그런데 newGame(87-9 |
| 424 | nonogram(16) | major/S | C/GameNonogram.tsx:222 | 수정됨 | GameNonogram.tsx:233 Check 버튼 방식 | Mistakes 카운터가 칠할 때마다 숨겨진 정답과 실시간 비교된 값으로 갱신된다(292행). 칸을 하나 칠 |
| 426 | nonogram(16) | major/L | L/nonogram/engine.ts:75 | 남음 | nonogram/engine.ts 무작위 노이즈 + 유일해 검증만, 픽셀아트 세트 없음 | 그림이 밀도 0.5의 무작위 노이즈인데 레지스트리는 '숨은 그림을 드러낸다'고 약속한다(registry.ts |
| 433 | number-memory(16) | bug/S | C/GameNumberMemory.tsx:143 | 수정됨 | GameNumberMemory.tsx:143-146 feedback='correct'로 덮음 | 정답을 내면 commit(next)이 phase:'show'에 이전 숫자를 그대로 둔 채 300ms 동안 렌 |
| 435 | number-memory(16) | major/S | C/GameNumberMemory.tsx:229 | 수정됨 | GameNumberMemory.tsx:233 over 상태 min-h-[26rem] | 보드가 aspect-[4/3] 고정이라 390px에서 게임오버 오버레이(제목, 버튼, Daily 안내, 리더 |
| 444 | zero-hour(16) | bug/S | C/GameZeroHour.tsx:210 | 수정됨 | GameZeroHour.tsx:122-199 paused 상태 + 남은 시간 복원 | 탭이 숨겨지면 setRunning(false)만 하고 재개 경로가 없다. 탭 숨김과 복귀를 재현하자 헤더 버 |
| 446 | zero-hour(16) | bug/S | C/GameZeroHour.tsx:443 | 수정됨 | GameZeroHour.tsx:95-151 crackSeq 이벤트로 빈칸에서 재생 | 크랙 연출이 엉뚱한 곳에 나온다. tick()이 크랙된 칸을 null로 비우므로(engine.ts:186)  |
| 448 | zero-hour(16) | major/M | L/zerohour/engine.ts:183 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/zerohour/engine.ts:183 | 값은 시간이 갈수록 줄기만 하므로 기다려서 얻는 이득이 없다. 항상 즉시 수확하는 것이 최선이라 '가치 대  |
| 455 | ripple(16) | major/S | L/ripple/engine.ts:85 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/ripple/engine.ts:85 | RING_MAX_R(566)가 필드 대각선보다 커서 링 하나가 필드 전체를 쓸고, 결국 화면에 있는 모든 부 |
| 457 | ripple(16) | major/S | L/ripple/engine.ts:137 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/ripple/engine.ts:137 | 레벨 0에서는 스웰(5초)마다 부표가 1개만 생긴다. 첫 탭에 초기 부표 3개가 모두 터진 뒤에는 필드가 몇 |
| 464 | ticker(16) | bug/S | C/GameTicker.tsx:276 | 수정됨 | GameTicker.tsx:268-280 hadRecord 조건 | 첫 판은 best.bestW가 0이라 isNewHigh가 항상 true다. 실제 플레이에서 최종 Worth  |
| 466 | ticker(16) | major/M | L/ticker/engine.ts:61 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/ticker/engine.ts:61 | warming 구간은 수익률이 +2~8%이고 스냅 확률이 0이라 무위험 양수다. 2000개 시드로 시뮬레이션 |
| 468 | ticker(16) | major/S | C/GameTicker.tsx:448 | 수정됨 | GameTicker.tsx:454 onClick | 선택 버튼이 onPointerDown에서 바로 commit한다. 모바일에서 페이지를 스크롤하려고 버튼 위에  |
| 475 | splice(16) | major/M | L/splice/engine.ts:583 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/splice/engine.ts:583 | 생성되는 그래프가 거의 트리다(간선 수 ≈ 노드 수 - 1). par는 레벨 1~10 내내 평균 3.9로 고 |
| 484 | turntile(16) | major/S | C/GameTurntile.tsx:269 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameTurntile.tsx:269 | state가 바뀔 때마다 pivotRefs[focus].focus()를 호출해 로드 직후 첫 pivot이 포 |
| 486 | turntile(16) | major/M | C/GameTurntile.tsx:420 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameTurntile.tsx:420 | 44px pivot 원이 52px 타일 위를 대부분 덮어 보드가 원 격자처럼 보이고 타일 색 경계가 가려짐( |
| 493 | loopgrid(16) | major/M | C/GameLoopgrid.tsx:391 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameLoopgrid.tsx:391 | 행·열을 순환하면 색이 즉시 바뀌고 0.15초짜리 scale 펄스만 있다. 타일이 미끄러지는 애니메이션이 없 |
| 495 | loopgrid(16) | major/M | L/loopgrid/engine.ts:91 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/loopgrid/engine.ts:91 | Loopover류 퍼즐을 무작위 22~32수로 섞는다. 마지막 행·열을 맞추려면 커뮤테이터를 알아야 해서 캐 |
| 504 | whack-a-mole(17) | bug/S | C/GameWhackAMole.tsx:73 | 수정됨 | GameWhackAMole.tsx:75-90 진행 중 Restart도 newGame | Playwright로 재현함. 판 도중의 'Restart' 버튼(300)이 start()를 부르는데, sta |
| 506 | whack-a-mole(17) | bug/S | C/GameWhackAMole.tsx:81 | 수정됨 | GameWhackAMole.tsx:80-90 기존 두더지 deadline 재부여 | Playwright로 재현함. start()가 deadlines를 모두 0으로 초기화하지만 이미 올라와 있던 |
| 508 | whack-a-mole(17) | major/S | L/whackamole/engine.ts:86 | 수정됨 | whackamole/engine.ts:99-113 빈 구멍 패널티 | 빈 구멍을 치면 misses만 늘고 점수나 시간 패널티가 없으며 misses는 UI 어디에도 표시되지 않는다 |
| 515 | pong(17) | major/S | C/GamePong.tsx:221 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GamePong.tsx:221 | 마운트 즉시 공이 움직이고, 득점 후에도 바로 재서브된다(engine.ts:196,212). 서브 대기나 일 |
| 517 | pong(17) | major/M | L/pong/engine.ts:148 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/pong/engine.ts:148 | 플레이어 패들은 포인터 위치로 순간이동하는데(clampPaddle(input.playerPaddleY), G |
| 524 | bubble-shooter(17) | major/M | L/bubbleshooter/engine.ts:301 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/bubbleshooter/engine.ts:301 | 천장 하강이나 N발마다 새 줄 추가 같은 압박 메커니즘이 없다. 엔진을 직접 돌린 그리디 봇 시뮬레이션(10 |
| 526 | bubble-shooter(17) | major/S | C/GameBubbleShooter.tsx:337 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameBubbleShooter.tsx:337 | onPointerDown에서 조준과 동시에 즉시 발사한다. 터치에서는 손가락을 대는 순간 쏘기 때문에 가이드 |
| 533 | sokoban(17) | major/L | L/sokoban/engine.ts:59 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/sokoban/engine.ts:59 | 레벨이 8개뿐이고 모두 빈 방에 박스가 목표 바로 옆에 놓인 튜토리얼 수준이다(Level 8 실측 스크린샷: |
| 535 | sokoban(17) | major/S | C/GameSokoban.tsx:262 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSokoban.tsx:262 | Level 1~2처럼 보드가 3~5줄로 낮으면 승리 오버레이가 보드 밖으로 넘친다. 390px 실측에서 Be |
| 542 | word-search(17) | major/S | C/GameWordSearch.tsx:135 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameWordSearch.tsx:135 | 드래그 끝점이 정확히 직선이나 45° 대각선 위가 아니면 lineBetween이 null을 반환하고, 선택이 |
| 553 | space-shooter(17) | major/S | C/GameSpaceShooter.tsx:335 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSpaceShooter.tsx:335 | 마운트 즉시 rAF 루프가 돌아 시작 화면 없이 적이 움직이고 사격한다. 로드 0.8초 뒤 스크린샷에 이미  |
| 555 | space-shooter(17) | major/S | L/spaceshooter/engine.ts:258 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/spaceshooter/engine.ts:258 | 피격 뒤 무적 시간이 없다. 프레임당 1회만 피격으로 막을 뿐이라 탄이 몰리면 연속 프레임에서 목숨이 줄줄이 |
| 562 | backspace(17) | major/S | C/GameBackspace.tsx:541 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameBackspace.tsx:541 | BACKSPACE 버튼(absolute bottom-3, 중앙)이 마커 충돌 밴드(MARKER_CY=500/ |
| 571 | umbra(17) | bug/S | C/GameUmbra.tsx:376 | 수정됨 | GameUmbra.tsx:363 trackCss로 마커=판정점 매핑(주석), umbra/layout.ts 추가 | 눈에 보이는 도착 마커(cyan 세로선)는 w-9 박스의 border-l, 즉 레인 오른쪽 끝에서 36px  |
| 573 | umbra(17) | bug/S | C/GameUmbra.tsx:484 | 수정됨 | GameUmbra.tsx:291 window keydown | 마우스로 Start를 누르면 버튼이 언마운트되면서 포커스가 BODY로 빠진다. 그 뒤 1/2/3 키가 전혀  |
| 580 | fuse(17) | major/S | L/fuse/engine.ts:102 | 수정됨 | fuse/engine.ts:102-103,241 GAP_START 14/GAP_MIN 7 | 스폰 간격이 GAP_START 26틱에서 12개마다 1틱씩만 줄어든다(26→9까지 204개). 초기 퓨즈 길 |
| 582 | fuse(17) | bug/S | C/GameFuse.tsx:226 | 수정됨 | GameFuse.tsx:195-201 효과 제거, 방향키 때만 focus | useEffect가 [focus, state]에 의존해 매 틱(90ms)마다 cellRefs[focus].f |
| 591 | polytap(17) | major/M | C/GamePolytap.tsx:97 | 불명확 | 비트 메트로놈 호출 코드 못 찾음(grep). 오디오 모듈 별도 확인 필요 | 폴리리듬 게임인데 박자 클릭/메트로놈 사운드가 없다. play()는 hit/confluence/stray/m |
| 593 | polytap(17) | bug/S | C/GamePolytap.tsx:390 | 수정됨 | GamePolytap.tsx:388-402 오버레이를 overflow-hidden 밖으로 이동 | 보드 컨테이너가 overflow-hidden에 높이가 레인 2개(약 270px)뿐이다. 그래서 게임오버 오버 |
| 602 | equate(17) | bug/S | C/GameEquate.tsx:501 | 수정됨 | GameEquate.tsx:54 디지트 5+5 두 줄 | 숫자 키 10개가 각각 min-w-11(44px)이고 gap-1이라 최소 폭이 476px이다. 390px에서 |
| 609 | mancala(17) | bug/S | C/GameMancala.tsx:591 | 수정됨 | GameMancala.tsx:612 relative 래퍼 | 오버레이를 감싸는 div에 relative가 없어서 GameOverlay(absolute inset-0)의  |
| 611 | mancala(17) | major/S | C/GameMancala.tsx:84 | 수정됨 | GameMancala.tsx:84-100 돌 수가 많으면 숫자 표시 | 모바일(390px)에서 구멍 지름이 30px인데 7px 돌을 최대 8개 그려서, 5~6개만 돼도 돌이 구멍  |
| 620 | skew(17) | major/S | C/GameSkew.tsx:264 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSkew.tsx:264 | ←/→ 키 핸들러가 보드 div의 onKeyDown에만 있어, 보드를 먼저 포커스하지 않으면 키 입력이 무시 |
| 622 | skew(17) | major/M | C/GameSkew.tsx:153 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSkew.tsx:153 | 캐스케이드 연출이 첫 웨이브 pop과 마지막 웨이브 spawn만 보여주고 중간 웨이브·중력 낙하는 즉시 점프 |
| 624 | skew(17) | major/L | L/skew/engine.ts:92 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/skew/engine.ts:92 | 선택지가 매 턴 좌/우 2개뿐이고 좌→우는 서로 상쇄되는 순환 이동이라 계획 여지가 거의 없고 결과가 사실상 |
| 633 | prismbox(17) | major/L | L/prismbox/engine.ts:303 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/prismbox/engine.ts:303 | 원자는 정면 히트로만 '발견'되고 위치 추측(guess) 입력이 없다. 32개 포트를 전부 쏘면 무조건 이기 |
| 635 | prismbox(17) | major/S | C/GamePrismbox.tsx:267 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GamePrismbox.tsx:267 | [focus, state]가 바뀔 때마다 portRefs[focus].focus()를 호출해서, 로드 직후  |
| 644 | gravwell(17) | major/S | C/GameGravwell.tsx:572 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameGravwell.tsx:572 | 드래그 조준 패드가 r=1.4 월드 단위라 모바일 390px에서 약 10×10px(데스크톱 18px)이다.  |
| 646 | gravwell(17) | major/S | C/GameGravwell.tsx:393 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameGravwell.tsx:393 | reduced motion이면 preview를 null로 만들어 점선 궤적 미리보기가 사라진다. 모션 감소는 |
| 655 | slotter(17) | major/S | C/GameSlotter.tsx:307 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSlotter.tsx:307 | 정답 입력 수단인 갭 버튼이 w-4(16×44px)다. 모바일에서 바로 옆 카드나 이웃 갭을 잘못 누르기 쉬 |
| 657 | slotter(17) | major/S | C/GameSlotter.tsx:212 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSlotter.tsx:212 | [focus, state]에 걸린 effect가 매 tick(80ms)마다 gapRefs[focus].foc |
| 668 | bearing(17) | major/M | L/bearing/engine.ts:110 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/bearing/engine.ts:110 | 나침반 8방향 결과로 남은 영역이 사분면/반평면으로 줄어드는 구조라, 남은 영역 중앙을 파는 기계적 이분탐색 |
| 670 | bearing(17) | bug/S | C/GameBearing.tsx:210 | 수정됨 | GameBearing.tsx:34,175,194,312 이미 끝낸 데일리 재도전은 연습 처리 | 데일리에서 지면 오버레이가 보물 좌표를 공개(436행)하는데, Retry(onNewGame)가 같은 데일리  |
| 679 | siteswap(17) | major/M | C/GameSiteswap.tsx:736 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSiteswap.tsx:736 | 390px에서 토스 버튼 1~5가 각각 폭 30px이고 버튼 간격은 약 2.6px이다(실측: toss-1 x |
| 690 | snake(18) | major/S | C/GameSnake.tsx:17 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSnake.tsx:17 | TICK_MS=130 고정이라 점수가 올라도 속도가 전혀 변하지 않는다. 초반이 끝나면 긴장감이 오르지 않고 |
| 692 | snake(18) | major/S | L/snake/engine.ts:40 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/snake/engine.ts:40 | changeDir가 pendingDir 한 칸만 덮어쓰고 반대 방향 판정은 state.dir 기준이다. 한  |
| 699 | typing-test(18) | major/M | L/typing/engine.ts:1 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/typing/engine.ts:1 | 단어 풀이 3~5글자 영어 100개뿐이고 구두점·대문자가 없다. 금방 외워져 WPM이 부풀고 반복 플레이 가 |
| 708 | breakout(18) | major/M | L/breakout/engine.ts:104 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/breakout/engine.ts:104 | 6x8 벽돌 한 판이 전부이고 볼 속도는 BALL_SPEED로 끝까지 일정하다(200행에서 속도 유지). 클 |
| 717 | reaction-time(18) | major/S | C/GameReaction.tsx:96 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameReaction.tsx:96 | 반응 시간에 하한 검증이 없다. Playwright로 22ms, 53ms가 그대로 기록됐다. 사람이라면 10 |
| 719 | reaction-time(18) | major/S | C/GameReaction.tsx:209 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameReaction.tsx:209 | 측정을 onClick(마우스를 뗄 때 발생)으로 해서 누르고 떼는 시간(수십 ms)이 매번 반응 시간에 더해 |
| 726 | hangman(18) | bug/S | C/GameHangman.tsx:193 | 수정됨 | GameHangman.tsx:54-64 key 리마운트 대신 classList 재생 | 오답이 나올 때마다 흔들림을 다시 재생하려고 보드 래퍼의 key를 `board-${shakeKey}`로 바꿔 |
| 735 | aim-trainer(18) | major/S | C/GameAimTrainer.tsx:144 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameAimTrainer.tsx:144 | Best를 targets/sec 하나로만 판정해서 정확도가 기록에 전혀 반영되지 않는다. 마구 클릭해도 손해 |
| 744 | rock-paper-scissors(18) | major/M | C/GameRps.tsx:97 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameRps.tsx:97 | 컴퓨터 수가 매 라운드 Math.random 균등 추첨이라 실력이 개입할 여지가 0이다. 그런데 레지스트리  |
| 753 | lights-out(18) | major/S | C/GameLightsOut.tsx:64 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameLightsOut.tsx:64 | Best(최소 이동수)를 매번 다른 무작위 판끼리 비교한다. 운 좋게 쉬운 판이 나오면 Best가 갱신되는  |
| 762 | dots-and-boxes(18) | major/S | C/GameDotsAndBoxes.tsx:278 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameDotsAndBoxes.tsx:278 | 점 열이 14px 고정 트랙이라 세로선 버튼의 너비와 가로선 버튼의 높이가 14px밖에 안 된다. 390px |
| 773 | flappy(18) | major/S | L/flappy/engine.ts:54 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/flappy/engine.ts:54 | PIPE_SPEED, GAP, PIPE_SPACING이 상수라 난이도가 끝까지 변하지 않는다(FAQ도 인정한 |
| 775 | flappy(18) | major/S | L/flappy/engine.ts:136 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/flappy/engine.ts:136 | 천장에 닿아도 즉사한다. 310ms 간격으로 탭했더니 1.8초 만에 첫 파이프도 오기 전에 천장에서 죽었다( |
| 786 | overload(18) | major/S | L/overload/engine.ts:121 | 수정됨 | overload/engine.ts:141-142 puzzleDensity 감소 | 난이도가 거꾸로 간다. puzzleDensity가 레벨마다 올라 보드가 점점 임계에 가까워진다. 시뮬레이션에 |
| 788 | overload(18) | bug/S | C/GameOverload.tsx:301 | 수정됨 | GameOverload.tsx:310-321 retryBoardState(s) | 'Retry board'가 startRun(mode, s.seed)을 호출하고, newGame은 항상 레벨  |
| 797 | ricochet(18) | major/M | L/ricochet/engine.ts:327 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/ricochet/engine.ts:327 | 데일리 par(8~14)가 보드와 무관하게 seed % 7로 정해진다. 시뮬레이션에서 매 탭 최장 체인을 고 |
| 808 | latch(18) | major/M | C/GameLatch.tsx:210 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameLatch.tsx:210 | 첫 페그를 잡으려면 놓은 뒤 다시 '누르고 있어야' 한다. 그런데 비행 중 가이드는 다음 페그로 향하는 점선 |
| 817 | decant(18) | major/M | L/decant/engine.ts:101 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/decant/engine.ts:101 | 밀도 자동 정렬 때문에 보드가 저절로 정리되는 성질이 강하다. 무작위로 따르기만 해도 easy/normal  |
| 824 | duplex(18) | bug/S | C/GameDuplex.tsx:307 | 수정됨 | GameDuplex.tsx:12 isPackUnlocked 검사 | ◀/▶ 레벨 이동(gotoLevel)이 팩 잠금(isPackUnlocked)을 검사하지 않고 모듈로 랩한다. |
| 826 | duplex(18) | major/M | L/duplex/engine.ts:328 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/duplex/engine.ts:328 | 17개 레벨 중 대부분이 par 1~3이고 마지막 레벨(Counter-Diagonal)이 par 1이다. 보 |
| 835 | overdub(18) | bug/S | C/GameOverdub.tsx:313 | 수정됨 | GameOverdub.tsx:285 window keydown | 키보드 핸들러가 보드 div의 onKeyDown에만 붙어 있다. 페이지를 막 연 상태(보드에 포커스 없음)에 |
| 837 | overdub(18) | major/M | L/overdub/engine.ts:184 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/overdub/engine.ts:184 | 기다리면 절대 죽지 않고 빈 칸이 항상 있으므로, 최적 전략은 원하는 빈 칸이 올 때까지 기다렸다 한 번 탭 |
| 846 | cleave(18) | bug/S | C/GameCleave.tsx:400 | 수정됨 | GameCleave.tsx:405 half를 A='right-1/2' 로 교정 | 마진 미터 방향이 반대다. side A 막대가 'left-1/2'(중앙에서 오른쪽)에, B가 'right-1 |
| 848 | cleave(18) | major/S | L/cleave/engine.ts:113 | 수정됨 | cleave/engine.ts:114 QUOTA_RATIO 0.8 | QUOTA_RATIO = 0.5라서 '안전 최적값'의 절반만 남기면 목숨을 지킨다. 화면에 Safe opti |
| 857 | clusters(18) | bug/S | C/GameClusters.tsx:268 | 수정됨 | GameClusters.tsx:46-48,234-237 패배 시 정답 공개 연출 | 패배 시 hint에 'the groups are revealed below'라고 나오지만, 미해결 그룹을 렌 |
| 859 | clusters(18) | major/S | L/clusters/engine.ts:296 | 수정됨 | clusters/engine.ts:304 오답 시 선택 유지 | 오답 제출 시 selected를 []로 비운다. 'One away'라면 3개는 맞으니 하나만 바꾸라는 안내( |
| 861 | clusters(18) | major/L | L/clusters/engine.ts:60 | 남음 | clusters 뱅크는 diff에 없음(엔진 diff는 오답 처리 부분) | 뱅크의 카테고리가 서로 겹치지 않는 사전형 범주(카드 무늬, 계절 등)이고 레드헤링이 거의 없다. 실제 데일 |
| 866 | quadle(18) | major/M | C/GameQuadle.tsx:302 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameQuadle.tsx:302 | 모바일(<sm)에서 grid-cols-1이라 9줄짜리 보드 4개가 세로로 쌓인다. 390px 풀페이지 스크린 |
| 875 | solitaire(18) | major/S | C/GameSolitaire.tsx:446 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSolitaire.tsx:446 | Draw-3 규칙(engine.ts:205, n=min(3,...))인데 waste에는 맨 위 1장만 렌더된 |
| 877 | solitaire(18) | major/S | L/registry.ts:1958 | 남음 | registry.ts:1979 문구 그대로, solitaire/engine.ts:351-354 점수식 불변 | 팁에는 'finish quickly ... for a higher score'라고 적혀 있지만 score() |
| 886 | mahjong(18) | major/M | C/GameMahjong.tsx:147 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameMahjong.tsx:147 | scale을 min(1, ...)으로 제한해 보드가 BOARD_W(약 429px) 이상으로 커지지 않는다.  |
| 893 | yukon-solitaire(18) | major/S | L/yukon/engine.ts:284 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/yukon/engine.ts:284 | 점수가 파운데이션 장수*100 + 승리 2000이고, persistWin은 승리할 때만 저장한다. 그래서 승 |
| 904 | gomoku(18) | bug/S | C/GameGomoku.tsx:184 | 수정됨 | GameGomoku.tsx:172-176,482 종료 후 Undo 차단+disabled | 게임이 끝난 뒤에도 Undo 버튼이 오버레이 밖에서 활성 상태이고, undo가 recordedRef를 fal |
| 906 | gomoku(18) | bug/S | C/GameGomoku.tsx:88 | 수정됨 | GameGomoku.tsx:85-89 2P는 기록 제외 | 2 Player 모드의 승리도 humanWon=true로 처리되어 bumpWins와 best:gomoku(리 |
| 908 | gomoku(18) | major/M | C/GameGomoku.tsx:363 | 남음 | GameGomoku.tsx 확인 단계·셀 확대 없음(diff는 Undo/2P 기록) | 15x15 보드가 390px에서 칸당 22px라 터치 오조작 위험이 크다(실측 22.1px). 확인 단계 없 |
| 915 | memory-game(19) | major/M | L/memory/engine.ts:1 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/memory/engine.ts:1 | 4x4 8쌍 고정에 타이머·난이도·콤보가 없다. 기록은 최소 수(Best)뿐이라 두세 판이면 더 할 동기가  |
| 922 | tetris(19) | major/M | L/tetris/engine.ts:274 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/tetris/engine.ts:274 | tick이 더 내려갈 수 없으면 즉시 lockPiece한다. 락 딜레이가 없어 바닥에 닿는 순간 고정되므로  |
| 924 | tetris(19) | major/S | C/GameTetris.tsx:119 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameTetris.tsx:119 | restart가 setRunning(true)를 호출해 페이지 로드 즉시 조각이 떨어진다. 일시정지 버튼도  |
| 933 | sliding-puzzle(19) | major/S | C/GameSliding.tsx:143 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSliding.tsx:143 | 보드에 touch-none이 걸려 있지만 터치·스와이프 핸들러가 없다. 모바일에서 스와이프는 아무 동작도 하 |
| 940 | simon(19) | major/S | C/GameSimon.tsx:284 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSimon.tsx:284 | 패드 입력을 onClick으로 처리해서 소리와 불빛이 손가락을 뗄 때 나온다. 터치에서 누르는 순간 반응하지 |
| 951 | mastermind(19) | major/S | C/GameMastermind.tsx:219 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameMastermind.tsx:219 | 추측 수가 적을 때 보드가 낮은 상태로 승리하면 GameOverlay(absolute inset-0) 내용이 |
| 960 | gem-match(19) | major/M | C/GameGemMatch.tsx:330 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameGemMatch.tsx:330 | 모든 젬 span의 key가 dropKey라서 캐스케이드 단계마다 64개 젬이 전부 리마운트되고 gm-dro |
| 962 | gem-match(19) | major/L | L/gemmatch/engine.ts:185 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/gemmatch/engine.ts:185 | 4매치·5매치가 점수만 조금 더 줄 뿐 특수 젬(라인, 폭탄)이 없다. 30수 동안 선택의 깊이가 '가장 큰 |
| 982 | prospector(19) | major/S | C/GameProspector.tsx:342 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameProspector.tsx:342 | howToPlay(registry.ts:1133)는 'known, face-up deck'이라 하고 stra |
| 984 | prospector(19) | major/S | C/GameProspector.tsx:552 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameProspector.tsx:552 | 뱅크 판정 verdict('Disciplined bank'와 'banked early')는 New-best  |
| 993 | quarry(19) | major/M | C/GameQuarry.tsx:45 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameQuarry.tsx:45 | 보드에 과거 탐침의 '그 시점 거리'가 그대로 남는다. 타깃은 탐침할 때마다 이동하므로, 이전 숫자는 현재  |
| 1002 | deepdive(19) | major/S | C/GameDeepdive.tsx:347 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameDeepdive.tsx:347 | 스탯이 Air/Haul/Depth/Best뿐이라 이번 판에 예치한 점수(banked)가 어디에도 표시되지 않 |
| 1004 | deepdive(19) | major/M | C/GameDeepdive.tsx:285 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameDeepdive.tsx:285 | 핵심 긴장인 '돌아갈 숨이 남았나'를 계산해 주는 UI가 없다(귀환 최소 비용 표시 없음, 경고는 air ≤ |
| 1013 | sonar(19) | major/S | C/GameSonar.tsx:426 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameSonar.tsx:426 | Ping으로 '제거된(cleared)' 칸은 bg-white/[0.015], 미확인 칸은 bg-white/[ |
| 1024 | flapjack(19) | major/M | C/GameFlapjack.tsx:367 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameFlapjack.tsx:367 | 팬케이크 key가 인덱스(i)라서 뒤집을 때 요소가 이동하지 않는다. 각 줄의 너비와 색만 바뀌고 rotat |
| 1033 | reactor(19) | major/M | L/reactor/engine.ts:50 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/reactor/engine.ts:50 | Reboot는 모든 모듈을 리셋하는 대가로 생산량을 겨우 +10%(선형) 올려 준다. 그래서 게임플레이상으로 |
| 1040 | spider(19) | major/M | L/spider/engine.ts:312 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/spider/engine.ts:312 | score = 완성 세트×1000 + 승리 2000이라 1·2·4 suit 모두 승리하면 똑같이 10000점 |
| 1056 | chess(19) | bug/S | C/GameChess.tsx:36 | 수정됨 | GameChess.tsx:33-36 폰만 SVG, 나머지 U+FE0E | 폰 글리프 '♟'(U+265F)가 컬러 이모지 폰트로 렌더되어 CSS color를 무시한다. 스크린샷에서 백 |
| 1058 | chess(19) | major/S | C/GameChess.tsx:486 | 수정됨 | GameChess.tsx:381,520 마지막 수 from/to 표시 | 마지막 수(from/to) 하이라이트가 없다. CPU가 380ms 뒤에 두는 수가 보드에 아무 표시 없이 반 |
| 1065 | golf-solitaire(19) | major/S | L/golf/engine.ts:228 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/golf/engine.ts:228 | score = 클리어×100 + 승리 1000이다. 클래식 Golf의 핵심 보상인 남은 스톡 카드 보너스가  |
| 1072 | carousel(19) | major/S | C/GameCarousel.tsx:247 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameCarousel.tsx:247 | [focus, state]가 바뀔 때마다 handRefs[focus].focus()를 호출해서, 로드 직후와 |
| 1083 | morse-relay(19) | major/S | C/GameMorseRelay.tsx:286 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameMorseRelay.tsx:286 | 키를 누르고 있는 동안 송신음(사이드톤)이 없고 손을 뗀 뒤에만 'flip' 효과음이 남. 모스 게임의 핵심 |
| 1085 | morse-relay(19) | major/S | L/morse-relay/engine.ts:129 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/morse-relay/engine.ts:129 | 단어 풀이 4버킷×6단어=24개뿐이고 레벨 4 이상은 같은 6개 구문이 반복됨. 숙련 천장이 낮아 몇 판이면 |
| 1094 | shadowfit(19) | major/S | L/shadowfit/engine.ts:62 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/shadowfit/engine.ts:62 | 벽에 칸별 실시간 판정(fit/collide)과 FITS 배지가 뜨고 회전 횟수 제한도 없다. 그래서 무작위 |
| 1114 | word-guess(20) | bug/M | C/GameWordGuess.tsx:140 | 수정됨 | GameWordGuess.tsx:55-66 DailyRecord로 데일리 1회만 기록 | Daily 모드에서 지고 나면 오버레이에 정답이 표시되는데(476), 'Replay Daily'(restar |
| 1116 | word-guess(20) | major/M | C/GameWordGuess.tsx:153 | 수정됨 | GameWordGuess.tsx:55-66 데일리 진행 저장·복원 | daily 진행 상황을 저장하지 않는다. 새로고침하거나 Practice로 갔다 돌아오면(switchMode  |
| 1127 | checkers(20) | major/M | L/checkers/engine.ts:228 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/checkers/engine.ts:228 | winner()에는 말 0개, 둘 수 없음의 두 경우만 있고 무승부 규칙(무포획 N수, 반복)이 없다. 킹끼 |
| 1147 | pinwheel(20) | major/S | C/GamePinwheel.tsx:326 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GamePinwheel.tsx:326 | 보드가 산산조각 나면(dead) Undo가 비활성화된다(undoDisabled에 dead 포함, 엔진 und |
| 1156 | freecell(20) | major/S | L/registry.ts:1986 | 남음 | registry.ts:2007 문구 그대로, freecell/engine.ts:343-346 점수식 불변 | 팁에는 'a solve in fewer moves scores higher'라고 적혀 있지만 score()( |
| 1165 | yahtzee(20) | major/M | L/yahtzee/engine.ts:263 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/lib/games/yahtzee/engine.ts:263 | 앰버로 강조되는 'best' 칸(bestCategory)이 즉시 점수가 가장 큰 칸을 고르는 탐욕 방식이라, |
| 1187 | polarity(20) | bug/S | C/GamePolarity.tsx:439 | 수정됨 | GamePolarity.tsx:439-446 running이 아닐 때만 R | 'r' 키가 status 확인 없이 startNew()를 부른다. 그래서 진행 중인 판이 즉시 초기화된다.  |
| 1198 | connect-four(21) | major/S | C/GameConnectFour.tsx:335 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameConnectFour.tsx:335 | 게임이 끝나면 오버레이(absolute inset-0, bg-bg/75)가 곧바로 보드를 덮어서, 네 개 연 |
| 1243 | flow(22) | major/S | C/GameFlow.tsx:62 | 남음 | 파일 미변경(git diff d11f63d..HEAD에 없음): src/components/games/GameFlow.tsx:62 | Best가 '깬 레벨 번호의 최댓값'인데 Next/Prev로 아무 레벨이나 바로 열 수 있다. 26번 하나만 |
