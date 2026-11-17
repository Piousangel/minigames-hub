# 모바일 스크롤 차단(touch-none) 36개 게임 분류

기준: 390px 뷰포트. GameShell 기본 `max-w-100`(400px)·페이지 `px-4` 때문에 정사각 보드는 약 **358px** 정사각이다. 코드로 확정한 값은 그대로 쓰고, 추정은 '추정'이라 적었다. 실기기 측정은 하지 않았다. 저장소는 수정하지 않았다.

## 0. 먼저 알아둘 점 (A 분류의 함정)

`touch-action`을 `manipulation`/`pan-y`로 풀면 세로 스크롤 제스처가 시작될 때 브라우저가 `pointercancel`을 보낸다. 문제는 **그 전에 이미 `pointerdown`이 발화했다**는 것이다. 그래서 "pointerdown에서 바로 동작하는" 탭 게임은 스크롤하려고 손가락을 대는 순간 게임 동작(점프, 발사, 두더지 때리기)이 한 번 들어간다. touch-action만 풀면 스크롤은 되지만 오입력이 생긴다.

- A-click: `onClick`(pointerup 기반)으로 동작한다. touch-action만 풀면 안전하다.
- A-down: `pointerdown`에서 동작한다. 풀면 스크롤은 되지만 스크롤 시작 시 오입력이 생긴다. 보드를 작게 쓰거나 스크롤 띠(zone)를 같이 둔다. 지연이 중요한 게임이라 pointerup으로 옮기는 것은 비권장이다.
- A-hold: 누르고 있는 동안이 입력이다. 스크롤이 시작되면 pointercancel로 홀드가 풀린다. 작은 버튼은 그대로 두는 게 낫다(스크롤할 면적이 아님).

## 1. 요약 표

| 게임 | 분류 | 보드 점유 높이(390px) | 권장 수정 | 위험 |
|---|---|---|---|---|
| Sliding | A-click | 358 (aspect-square) | L144 `touch-none` 제거 | L |
| Flappy | A-down | 358 | L331(div)·L338(canvas) `manipulation` + 중앙 zone | M |
| Flywheel | A-down | 358 | L488·L495 동일 | M |
| Offbeat | A-down | 최대 RING 정사각(≤358) | L297 `touch-none` → `touch-manipulation` | L |
| WhackAMole | A-down | 3x3 정사각 358 | L236 → `touch-manipulation` | M |
| ZeroHour | A-down | 5x5 정사각 358 | L413 → `touch-manipulation` | M |
| TowerStack | A-down | 320xVIEW_H 비율, 추정 약 500~540 (VIEW_H 불명확) | L370·L378 `manipulation`. 키가 크므로 zone 권장 | M |
| AcornHop | A-down | 320x480 → 537 | L583 `manipulation` + 위·아래 스크롤 띠 | M |
| Polarity | A-down | 320x480 → 358x537 (max-w-100) | L682 보드 `manipulation`. L937 플립 버튼은 유지 | M |
| BubbleShooter | A-down (탭=조준+발사) | 358 | L379·L387 `manipulation` | M |
| FizzBeat | A-down (좌우 패드 버튼) | 패드 영역(작음) | L547 패드 버튼: 유지 또는 `manipulation` | L |
| Latch | A-hold (보드 전체 홀드) | 358 | L511·L520·L521: 보드는 zone, 홀드는 중앙에서만 | M |
| MorseRelay | A-hold (h-24 전신 키) | 96 버튼 | 변경 불필요(버튼) | L |
| Slosh | A-hold (GAS/BRAKE h-16) | 64 버튼 | 변경 불필요(버튼) | L |
| Tetris | A-hold (보드 아님, 버튼 L347) | 보드는 touch-none 없음 | 변경 불필요. 보드는 이미 스크롤 가능 | L |
| Breakout | B (가로 포인터 추종 + 탭 발사) | 358 | L359 div·L367 canvas `pan-y` | M |
| SpaceShooter | B (가로 드래그 + 홀드 자동발사) | 358 | L419·L429 `pan-y` | M |
| 2048 | C 스와이프(터치이벤트) | 358 | L275 → zone. 중앙만 `none` | M |
| Duplex | C 스와이프 | 정사각 추정 약 358 | L456 → zone | M |
| Maze | C 스와이프 | 358 | L248 → zone | M |
| Sokoban | C 스와이프 | 정사각 아님, 추정 약 358 이하 | L263 → zone | M |
| Snake | C 스와이프(touchmove) | 358 | L158 → zone | M |
| GemMatch | C 스와이프, 탭 폴백 있음 | 358 | L291·L296: 중앙 zone. 탭 선택 후 인접 탭이 가능 | M |
| Lagline | C 4방향 스와이프 | 필드 288(9x32) + 큐·패딩, 추정 약 400 | L527 보드 → 필드만 `none`, 큐·패딩은 스크롤. L855 버튼은 유지 | M |
| Flow | C 자유 드래그(경로 그리기) | 358 (max-w 26rem) | L418 → zone | H |
| Nonogram | C 자유 드래그(셀 칠하기) | 정사각 358 + 단서 영역 | L413 → zone. 칠하기 영역만 `none` | H |
| WordSearch | C 자유 드래그(단어 선택) | 정사각 358 | L315 → zone | H |
| Pong | C 세로 드래그(패들 Y 추적) | 358 | L316·L323: 좌우 스크롤 띠 | H |
| Ripple | C 자유 드래그(조준 후 놓기) | 358 | L561·L572 → zone | H |
| Recoil | C 자유 드래그(조준 후 발사) | 320x224 → 약 251 | L823 svg. zone 또는 조준 핸들 방식 | H |
| Unblock | C 블록별 축 고정 드래그 | 358 | L453·L454 보드는 `touch-action:auto`. 블록 L537·L545는 가로 블록 `pan-y`, 세로 블록 `pan-x` | M |
| Shadowfit | C 4방향 스와이프(작은 패널) | 패널 h-44 = 176 | L744 패널(176px)만 해당. 현상 유지 가능 | L |
| Bankshot | C-핸들 (공 주변 원 드래그) | 400x240 → 약 215 | L510 svg 의 `touch-none` 제거. L617 핸들만 유지 | L |
| Gravwell | C-핸들 | 100x60 → 약 215 | L486 svg 제거. L578 패드만 유지 | L |
| Hogline | C-핸들 | svg max-w-70(280px), 높이 불명확 | **이미 핸들(L559)만 `none`**. 수정 불필요 | L |
| Backspace | D (탭 좌우 + 두 손가락 되감기 + 홀드 버튼) | 5/7 → 약 501 | 멀티터치라 보드는 `none` 유지가 필요. 중앙 zone만 `none`, 상하 띠에서는 탭 무시 | H |

분류별 개수(합 36):

- A-click: 1 (Sliding)
- A-down: 10 (Flappy, Flywheel, Offbeat, WhackAMole, ZeroHour, TowerStack, AcornHop, Polarity, BubbleShooter, FizzBeat)
- A-hold: 4 (Latch, MorseRelay, Slosh, Tetris)
- B: 2 (Breakout, SpaceShooter)
- C: 18
  - 스와이프(터치이벤트): 5 (2048, Duplex, Maze, Sokoban, Snake)
  - 포인터 드래그: 9 (GemMatch, Lagline, Flow, Nonogram, WordSearch, Pong, Ripple, Recoil, Unblock)
  - 핸들 방식: 3 (Bankshot, Gravwell, Hogline)
  - 작은 패널: 1 (Shadowfit)
- D: 1 (Backspace)

### 보드 밖 스크롤 영역 (추정)

보드 정사각 358px이면 헤더·힌트·컨트롤을 합쳐도 보드가 뷰포트의 약 45~60%를 차지한다. 세로가 큰 보드(AcornHop 537, Polarity 537, Backspace 501, Tower 추정 500 이상)는 보드 하나가 사실상 화면 대부분이다. 이 보드들은 손으로 짚으면 스크롤할 곳이 거의 없다. 정확한 수치는 불명확하다(헤더·광고 슬롯 높이를 측정하지 않았다).

## 2. 게임별 입력 방식과 touch-none 위치

(파일은 모두 `src/components/games/`. 줄 번호는 `Game*.tsx` 기준.)

**A-click**
- Sliding: 타일 `onClick`(L172)만 있다. 보드 div L144에 `touch-none`이 걸려 있다. 가장 안전한 첫 수정 대상이다.

**A-down**
- Flappy: canvas `onPointerDown`(L302, preventDefault + 점프). div L331, canvas style L338 두 곳에 걸림.
- Flywheel: `onPointerDown`(L442). div L488, canvas style L495.
- Offbeat: 링 버튼 `onPointerDown`(L292). 버튼 L297.
- WhackAMole: 구멍 버튼 `onPointerDown`(L249). 그리드 L236.
- ZeroHour: 타일 `onPointerDown`(L469). 그리드 L413. 키보드(L325)도 있다.
- TowerStack: canvas `onPointerDown`(L343). div L370, canvas style L378.
- AcornHop: 래퍼 `onPointerDown`(L578). `touch-none`은 래퍼 L583. 좌우 반쪽 탭(`sideFromEvent`).
- Polarity: 보드 `onPointerDown`(L680)로 플립. 보드 L682(style), 플립 버튼 L937.
- BubbleShooter: pointermove 조준(L333) + pointerdown 조준·발사(L337). 드래그 없이 탭 한 번으로 완결되므로 A-down. div L379, canvas style L387.
- FizzBeat: L/R 패드 버튼 `onPointerDown`(L736). 패드 style L547. 키보드도 지원.

**A-hold**
- Latch: canvas `onPointerDown`/`Up`/`Cancel`/`Leave`(L474, L516~519). 홀드 입력. div L511, canvas L520(클래스)·L521(style). 보드 전체가 홀드 면이다.
- MorseRelay: 키 버튼 down/up/cancel/leave(L450~453). L456.
- Slosh: GAS/BRAKE 버튼 down/up/cancel/leave/lostcapture(L959~963). L967. 보드 자체(L597)에는 touch-none이 없다.
- Tetris: 좌/우/하강 반복 버튼(L347, L384~387). 보드(L269)에는 touch-none이 없다.

**B**
- Breakout: canvas `onPointerMove`로 패들 X 이동(L303), `onPointerDown`으로 발사(L312). 가로 추종이므로 `pan-y`가 맞다. 단, 세로로 문지르면 브라우저가 스크롤을 잡아 패들이 멈춘다. div L359, canvas style L367.
- SpaceShooter: pointerdown으로 X 설정 + 자동발사 시작, pointermove X 추종, setPointerCapture 사용(L354~365). cancel/up은 `endPointer`로 해제한다. div L419, canvas L429.

**C 스와이프(터치이벤트, 부모 div에 onTouchStart/End)**
- 2048: `onTouchStart`/`End`(L220~229), 24px 임계값, 4방향. L275. 모바일 D-pad가 없어서 스와이프가 유일한 입력이다.
- Duplex: L353~362, 보드 L456. D-pad 버튼이 있다(L755).
- Maze: L175~184, 보드 L248. D-pad 있음.
- Sokoban: L193~202, 보드 L263. D-pad 있음(L428).
- Snake: `onTouchStart`/`Move`(L105~117). touchmove에서 24px 넘으면 즉시 조향. 보드 L158. D-pad 있음.
- 이들은 `touchend`/`touchmove`에 의존한다. 스크롤이 시작되면 `touchcancel`이 오고 `touchend`는 오지 않으므로, 스크롤 제스처에서는 이동이 들어가지 않는다. 이 점은 안전하다.

**C 포인터 드래그**
- GemMatch: 셀 `onPointerDown`(L322)에서 시작점 기록, 보드 `onPointerUp`(L295)에서 4방향 스왑 판정. 탭은 `onClick`(L323)이 처리한다. 선택 후 인접 셀 탭으로도 스왑이 되므로 스와이프가 필수는 아니다. `touch-none`이 보드 div L291과 grid L296 두 곳에 있다. pointercancel 핸들러는 없다.
- Lagline: 보드 `onPointerDown`/`Up`(L520~521)에서 4방향 스와이프(좌우 이동, 위=점프, 아래=정지). `onPointerCancel`은 `pointerRef=null`로 정리한다. 보드(큐 스트립 + 필드 + 패딩)가 통째로 `touch-none`(L527). 하단 컨트롤 버튼 L855도 `touch-none`이지만 작은 버튼이라 그대로 둔다.
- Flow: 자유 드래그로 경로를 그린다. pointerdown에서 setPointerCapture(L142), pointermove로 셀 추적. `onPointerCancel={endStroke}`(L415)는 기록만 정리한다. 보드 style L418.
- Nonogram: 셀 pointerdown(L481) + 보드 pointermove(L409)로 드래그 칠하기. `endDrag`는 cancel에서도 호출되는데 상태 정리만 한다. 보드 L413.
- WordSearch: 셀 pointerdown(L348) + 보드 pointermove로 직선 선택. `endDrag`가 cancel에서도 불리고 `checkSelection`까지 실행한다(L179~192). 스크롤 취소 시 현재까지의 선택이 정답 검사에 들어간다. 대부분 오답이면 'error' 사운드만 난다. 보드 L315.
- Pong: canvas `onPointerMove`로 패들 Y를 추적(L240). 세로 드래그가 핵심이다. div L316, canvas L323. cancel 핸들러는 없다.
- Ripple: pointerdown(L471)에서 프리뷰 시작, pointermove(L483)로 위치 조정, pointerup(L491)에서 놓기. `onPointerCancel`은 놓지 않고 취소만 한다(L500). 설계상 안전하다. div L561, canvas L572.
- Recoil: svg 전체가 조준 면이다. pointerdown(L508)에서 setPointerCapture, pointermove 조준, pointerup에서 발사(L528), `onPointerCancel`은 `pressed=false`로 발사 없이 종료(L533). 취소 처리가 안전하다. svg style L823. 아레나 비율이 320x224라 높이는 약 251px이다.
- Unblock: 보드 L453·L454와 블록 L537·L545에 각각 `touch-none`. 블록별 `onPointerDown`(L233)이 setPointerCapture를 쓰고, 축(h/v)에 고정해서 드래그한다. `endDrag`가 cancel에서도 불리고 `moved`이면 `applySlide`한다(L255~269). 가로 블록에 `pan-y`를 쓰면 스크롤 시작 시 dx가 거의 0이라 cells=0, 즉 이동 없음이다. 세로 블록에 `pan-x`를 쓰면 가로로만 스크롤을 잡는데 페이지에는 가로 스크롤이 없으므로 실질적으로 안전하다.
- Shadowfit: 패널(h-44, 176px)에서만 pointerdown/up으로 4방향 스와이프 회전. 패널 L744. 나머지 UI는 스크롤 가능하다.

**C 핸들(드래그 시작이 작은 원)**
- Bankshot: svg L510에 `touch-none`, 핸들 원 L617에도 `touch-none`. 입력은 핸들 원의 pointerdown/move/up/cancel(L618~621)뿐이다. **svg 쪽 `touch-none`은 필요 없다**(핸들의 touch-action이 핸들 영역을 결정한다).
- Gravwell: svg L486, 패드 L578. 위와 동일 구조.
- Hogline: 핸들 원 L559만 걸려 있고 svg·보드에는 없다. 수정 불필요.

**D**
- Backspace: canvas `onPointerDown`(L468, 좌우 반쪽 탭으로 레인 이동). 손가락이 2개 이상이면 되감기 스크럽(`boardPointersRef`로 멀티터치 수를 센다). 아래에 홀드 버튼(L536~542). 보드 div L521, canvas style L531, 버튼 L541·L542. 2손가락 제스처는 `touch-action: none`이 아니면 핀치줌이 가로채므로 보드 쪽 `none`을 지키는 편이 낫다. 보드 비율 5/7로 약 501px이다. 상하 12% 정도의 탭 무시 띠를 두는 방식이 현실적이다.

## 3. 안전한 수정 레시피

Plop 참고 구현을 일반화한 규칙이다.

1. **A-click**: `touch-none` 클래스와 `touchAction:'none'` 스타일을 제거한다. 끝.
2. **A-down**: 보드와 캔버스에서 `touch-none` → `touch-manipulation`(= `manipulation`). 이후 두 가지 중에서 선택한다.
   - 가벼운 처리: 그대로 둔다. 스크롤 시작 시 오입력이 1회 생길 수 있음을 수용한다.
   - 정석: 아래 `ScrollSafeBoard`로 중앙 zone을 만들고, 위·아래 띠에서는 입력을 무시한다. 키가 큰 보드(AcornHop 537, Polarity 537, TowerStack)를 우선 적용한다.
3. **B**: `pan-y`. 단 가로 이동 중에 손가락이 조금이라도 세로로 흔들리면 스크롤이 시작되어 패들이 멈출 수 있다. 가로 `touch-action: pan-y`는 브라우저가 판단하는 초기 이동 방향이 세로일 때만 스크롤하므로 실제 영향은 작지만 실기기 확인이 필요하다.
4. **C 스와이프(터치이벤트)**: 부모 div의 `touch-none`을 제거하고, 부모에 `ScrollSafeBoard`를 씌워 중앙 zone(내부 div)만 `touch-action: none`으로 한다. 기존 `onTouchStart/End`는 부모에 둔 채로 두면 띠에서 가로 스와이프도 동작한다(띠에서 세로 움직임은 스크롤로 넘어가 취소된다).
5. **C 포인터 드래그**: 위와 같은 zone. 중앙 구역에서 pointerdown이 시작된 제스처만 게임으로 간주한다. 띠에서 시작한 제스처는 게임 입력으로 쓰지 않는다. Unblock만은 블록 단위 touch-action으로 해결한다(위 표).
6. **C 핸들**: Bankshot·Gravwell은 svg의 `touch-none`을 제거한다. 가장 싸고 효과가 큰 수정이다.
7. **A-hold(버튼)**: 변경하지 않는다.

회귀 위험:

- **pointercancel**: Ripple·Recoil·Lagline·Shadowfit·Flow·Nonogram·Backspace·Latch·Morse·Slosh·SpaceShooter는 cancel에서 정리만 한다(커밋하지 않는다). 안전하다. 주의할 곳은 **WordSearch**(cancel에서 `checkSelection`까지 실행)와 **Unblock**(cancel에서 `applySlide`)이다. cancel 전용 핸들러를 따로 만들어 커밋하지 않도록 바꾸는 것이 좋다. GemMatch·BubbleShooter·Breakout·Pong은 pointercancel 핸들러가 없다. 상태가 남는 곳은 GemMatch의 `dragRef`뿐인데 다음 pointerdown이 덮어쓰므로 L.
- **Pointer capture**: Flow·SpaceShooter·Unblock·Latch·Recoil·Shadowfit이 capture를 건다. 스크롤이 시작되어 cancel이 오면 capture도 풀린다. 문제 없음.
- **터치 이벤트 게임**(2048·Duplex·Maze·Sokoban·Snake): zone 방식에서 띠에서 가로로 스와이프하면 이동이 걸린다. 이를 막고 싶으면 중앙 zone의 ref 안에서 시작된 터치만 인정한다.
- **iOS Safari**: `touch-action: none`/`pan-y`는 iOS 13+에서 동작한다. 오래된 iOS 확인은 불명확.
- **preventDefault 호출**: `onPointerDown`에서 `e.preventDefault()`를 쓰는 곳(Flappy·Flywheel·Offbeat·Whack·ZeroHour·Tower·Latch·Morse·Ripple·Backspace)은 포인터 이벤트의 preventDefault가 스크롤을 막지 않는다는 점을 알아야 한다(스크롤은 touch-action이 결정한다). 합성 mouse 이벤트 방지 용도이므로 그대로 둔다.

테스트 방법:

1. Chrome DevTools 모바일 에뮬레이션(390x844, touch)에서 보드 위에서 세로 스와이프. 페이지가 스크롤되는가, 그리고 게임 상태가 바뀌지 않는가를 확인한다(A-down은 첫 터치에서 동작이 1회 들어가는 것이 정상 범위인지 판단).
2. Playwright의 `hasTouch: true` + CDP `Input.dispatchTouchEvent`로 touchStart → touchMove(세로 80px) → touchEnd를 보내고 `scrollY` 변화와 게임 상태를 단언한다. 중앙 zone에서는 `scrollY === 0`, 띠에서는 `scrollY > 0`이어야 한다.
3. 실제 iPhone Safari와 Android Chrome에서 대표 5개를 확인한다(2048, Flow, Pong, AcornHop, Unblock).
4. 기존 단위 테스트는 렌더 위주일 가능성이 높다(`touch-none` 문자열 단언이 있는지는 확인하지 못했다). 수정 전에 `grep -rn "touch-none" src --include="*.test.*"`로 확인한다.

## 4. 적용 순서 제안

1. **1차 일괄(저위험)**: Sliding(제거), Bankshot·Gravwell(svg 제거), Hogline(수정 없음 확인), Offbeat·WhackAMole·ZeroHour(`touch-manipulation`). 약 7개 파일, 한 줄씩.
2. **2차 일괄**: B(Breakout, SpaceShooter `pan-y`)와 A-down의 나머지(Flappy, Flywheel, TowerStack, AcornHop, Polarity, BubbleShooter)를 `manipulation`으로 바꾸고 `ScrollSafeBoard`를 넣을지 정한다. 큰 보드(AcornHop·Polarity·Tower)는 zone 권장.
3. **3차 게임별(C)**: 스와이프 5개(2048·Duplex·Maze·Sokoban·Snake)는 같은 패턴이므로 래퍼 도입 후 묶어서 처리한다. 이후 Unblock(블록별 touch-action), Lagline, GemMatch, Pong(좌우 띠), Flow·Nonogram·WordSearch·Ripple·Recoil을 하나씩 처리하고 실기기 확인한다. WordSearch·Unblock은 cancel 처리를 함께 수정한다.
4. **보류**: Backspace(멀티터치), Latch(홀드 보드), A-hold 버튼 계열(MorseRelay·Slosh·Tetris·FizzBeat 패드), Shadowfit, Lagline의 컨트롤 버튼.

## 5. 공통 래퍼 초안

```tsx
// src/components/game-shell/ScrollSafeBoard.tsx
type Zones = { top?: number; bottom?: number; left?: number; right?: number } // 각 변의 스크롤 띠, 비율(0~1)

interface ScrollSafeBoardProps {
  children: React.ReactNode          // 입력을 받는 보드(캔버스 등)
  zones?: Zones                      // 기본 { top: 0.14, bottom: 0.16 } (Plop과 동일). Pong은 { left: 0.12, right: 0.2 }
  axis?: 'none' | 'pan-y' | 'pan-x'  // 가운데 구역의 touch-action. 기본 'none'. 가로 게임은 'pan-y'
  className?: string                 // 외곽 컨테이너(aspect 등)
  onZoneStart?: (zone: 'center' | 'edge') => void  // 필요하면 게임 쪽에서 띠 입력 무시 판단용
}
```

구현 요점:

- 외곽 div에는 touch-action 제한을 주지 않는다(조상의 `none`이 자식을 막기 때문).
- 가운데 구역은 `position:absolute`로 `inset: top% right% bottom% left%`에 두고 `touch-action`을 `axis` 값으로 준다.
- 띠 구역은 `pointer-events` 처리: 눈에 보이는 캔버스는 `inset:0`, 그 위에서 띠 면적만 입력 영역 밖으로 둔다. 캔버스가 띠를 통과해 그려지는 것은 그대로, 입력 구역만 중앙으로 줄이는 방식이다. 캔버스를 래퍼의 자식으로 두면서 이벤트 핸들러를 가운데 구역 div에 다는 형태가 단순하다.
- 터치이벤트 게임(2048 등)은 부모에 `onTouchStart/End`를 그대로 두고, 가운데 div만 `none`으로 한다.
- Hit-testing 좌표는 기존 `getBoundingClientRect()`가 캔버스 기준이어야 한다. 가운데 div가 캔버스보다 작으므로 좌표 계산은 반드시 캔버스 rect를 유지한다(이 부분에서 회귀가 생기기 쉽다).

## 6. 불명확한 사항

- TowerStack의 VIEW_H, Hogline svg 비율, Sokoban/Duplex/Maze의 정확한 높이(코드상 `aspect-square`는 Maze뿐이며 Duplex·Sokoban은 셀 수에 따라 달라진다).
- 헤더·힌트·광고 슬롯 높이가 필요한 '보드 밖 스크롤 영역' 정확값. 실기기/Playwright 측정이 필요하다.
- 단위/E2E 테스트가 `touch-none` 문자열이나 touch-action 계산 스타일을 단언하는지 확인하지 못했다.
- iOS Safari 실기에서 `pan-y` 포인터 추종(Breakout)이 어떻게 느껴지는지.
