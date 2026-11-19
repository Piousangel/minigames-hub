# 말랑 미끄럼길 엔진 현황 조사 (R1, 2026-11-19, HEAD 7b6356f)

경로는 모두 `src/lib/games/slime/` 기준이다. 저장소 파일은 하나도 고치지 않았다.

## 1. 엔진이 지금 지원하는 것

| 기능 | 상태 | 근거 |
|---|---|---|
| 지형 `Seg[]` 충돌 | 있음. 두께 0 선분과 반지름 D0=16 원의 거리로 판정하고, 한 스텝에 2회 반복한다. 끝점은 반지름 0 캡이다. 위치를 보정한 뒤 법선 성분을 반사(e=0.1)하고 쿨롱 마찰(μ=0.08)을 준다 | engine.ts:55-111 |
| AABB 조기 탈출 (PR-4) | 들어가 있음. 결과는 비트 단위로 같다 | engine.ts:17-27, 58 |
| 독꽃 `spikes` | 원 판정(SPIKE_R 26), 닿으면 즉시 `spiked` | engine.ts:128-132, types.ts:66 |
| 튕김 `bouncy` | terrain 인덱스 목록. 반발 1.85, 마찰 0 | engine.ts:29, 96-104; types.ts:22, 72 |
| `banZones` | 엔진은 읽지 않는다. 입력 단계(multiline)와 서버 검증에서만 쓴다 | types.ts:23-31 |
| 바람, 스위치, 문, 움직이는 부품 | 없음. 코드에 `zones`, `wind`, `door`, `switch`, `events` 어느 것도 없다. 스펙에서도 PR-12c(바람, 엔진 +12줄)와 12d(스위치·문, +30줄)로 미뤄 둔 상태 | 스펙 E:288-289 |
| 판정 순서 | 도토리 → 독꽃 → 둥지 → 추락(y>600, x<−40, x>430) → 멈춤(속도 <6이 120스텝 이어짐) → timeout(1440스텝) | engine.ts:114-146 |

**terrainRender.ts**
- `chainsOf`(19-46)는 끝점이 0.5px 안에서 겹치는 선분을 한 줄로 잇는다. 체인 양 끝에만 붙이므로 T자 분기는 별도 체인이 된다. bouncy 선분은 빠진다.
- `landformsOf`(49-58)는 체인의 bbox가 `w >= 0.8h`이면 `ridge`, 아니면 `slab`이다.
  - **ridge**: 윗면 폴리라인을 따라 그린 뒤, 양 끝에서 **보드 바닥(BOARD_H+30)까지 수직으로 닫아** 채운다(90, 117-123). 이어서 지층 3줄, 얼룩, 균열을 넣고, 경사 50° 이하 구간에만 풀을 그린다(185-215).
  - **slab**: 폴리라인을 16px 두께 막대로 긋고 머리에 풀 모자를 씌운다(138-144, 217-231).
- **곡선 언덕을 지금 그릴 수 있나:** 바닥에 붙은 언덕이나 능선이면 된다. 폴리라인 체인을 그대로 채우므로, 사인 언덕 8, 30, 60, 150분할을 각각 체인 하나의 ridge로 묶는 것까지 확인했다(아래 3절). 안 되는 것은 세 가지다.
  - 떠 있는 섬, blob, 구름: 아래가 바닥까지 칠해진다.
  - 닫힌 고리: 시작점과 끝점이 겹쳐 수직으로 닫는다.
  - 처마나 오버행: 채움이 아래 공간을 덮는다.
- 스펙의 `landforms`(terrain 인덱스 구간)와 `closeTo`(under, side)는 **구현되지 않았다**. 지금은 모양에서 종류를 추측한다.
- **스플라인이나 blob 빌더는 없다.** `stageBuilder.ts`는 27줄이고 `placeAcorns`(9-27)뿐이다. `Shape` 타입(poly/arc/spline/blob)과 validate는 스펙 부록(350-362)에만 있다. 이것이 PR-7 범위다.

## 2. 설계 제약 (코드 값과 스펙 규칙)

- **보드**: 390×560이고 원점은 왼쪽 위, y는 아래로 증가한다(types.ts:7-8). 그리기 금지 띠는 위·아래 8%, 좌우 5%다(스펙 C-3). 솔버 웨이포인트는 x 8~382, y 40~540으로 잘린다(solver.ts:34).
- **말랑이**: R=14, 충돌 거리 D0=16, 최고 속도 V_MAX=800이다. 한 스텝에 최대 6.7px 움직이므로 D0보다 작아 터널링은 없다(types.ts:56-60).
- **시간**: DT=1/120. START_DELAY는 60스텝(0.5초)이고 그동안 중력이 없다(engine.ts:43). MAX_STEPS 1440(12초)를 넘으면 `timeout`. STALL은 120스텝(types.ts:56-69).
- **판정 반경**: ACORN_R 24, NEST_R 22, SPIKE_R 26(types.ts:61-63).
- **선**:
  - MIN_LINE은 40px다(processStroke, strokePipeline.ts:109-115).
  - 스폰 금지 반경 SPAWN_BAN_R은 34이고 선분 단위로 판정한다(strokePipeline.ts:123-131).
  - 파이프라인은 dropClose → capInk → RDP 1.5 → Chaikin → 8px 재표본 → 0.5 격자 순서다.
- **잉크 실제 값**: g-slide 520, c-meadow 520, g-wall 560, s-wall-b 540, s-bounce 521, g-gap 440, s-spike 460(stages.ts).
- **스펙 B-2 규칙**(98, 32-33, 64):
  - 서로 다른 지형 사이 통과 폭은 80px 이상이다.
  - 스폰과 지형의 거리는 50px 이상이다.
  - 둥지는 평지에서 38px 이상, 그릇 모양이면 폭 80px 이상 안에 둔다.
  - 직선 구간은 60px 이하로 한다(수평 평지는 예외).
  - 오목 꺾임은 12° 이하, 선분 길이는 10~40px다. 그래서 오목 곡률 반경은 60px 이상이어야 한다. 계단은 `corner:true`일 때만 직각을 허용하고 한 단은 60px 이상이다.
  - 6~32px 틈은 오류다. 기존 22px 틈은 `legacy`로 면제된다.
  - 문은 폭 80px 이상이다.
  - 칠한 영역에서 말랑이가 닿을 수 있는 경계는 모두 충돌선이어야 한다(충돌-채움 폐쇄).
- **id**: 한 번 출시한 스테이지는 불변이다. 새 스테이지는 `v3-*`로 짓고 **풀 끝에만** 붙인다(stages.ts:165-170, 스펙 B-1).

## 3. 측정 실행법 (실제로 돌려 봄)

- 이 컨테이너에는 **`node_modules`가 없다**(pnpm 스토어도 없음). 그래서 vitest와 vite-node는 `pnpm install` 없이 쓸 수 없다. `npx --yes`는 분류기가 막는다(HANDOFF:62).
- 대신 **Node 22.23 내장 타입 제거 + 확장자 해석 훅 12줄**로 의존성 없이 돌아간다. `scripts/slime-chain-a2.ts`와 `a3.ts`는 **수정 없이** 실행됐다(a3 5.0초, a2 3.9초).
- 훅 파일 두 개는 `exp/ts-resolve.mjs`(확장자 없는 상대 import에 `.ts`를 붙임)와 `exp/register.mjs`(`module.register`)다.

```bash
cd /tmp/claude-0/-home-user-minigames-hub/37d3f6f1-7218-597a-b9f0-c6c79d9b47df/scratchpad/exp
node --no-warnings --import ./register.mjs /home/user/minigames-hub/scripts/slime-chain-a3.ts
node --no-warnings --import ./register.mjs ./bench.ts      # 스크래치 측정
```

**실측값** (4코어, 부하 0.4)

| 측정 | 결과 |
|---|---|
| `solve(st, 2026, {pop:80})` 기본값(6라운드, ks[3,4,5], 1440판) | g-slide 175ms(해 807), c-meadow 170ms(563), s-bounce 226ms(175) |
| 같은 조건에 `robustTrials:4` 추가 | 약 0.9~1.1초 |
| 곡선 언덕 합성(g-slide 기반, 지형 선분 10/32/62/152개) solve pop80 | 194/205/236/343ms |
| 같은 지형에서 simulate 1판(211스텝) | 78/86/107/161µs |
| `gateStage` 전체(runs 1000, pop 400) | 스테이지당 8.3초 |

## 4. 다중 선

- **multiline.ts가 이미 제공하는 것**
  - `maxLinesOf`, `minLinesOf`, `manualStartOf`(43-45)
  - `segmentHitsRect`(Liang–Barsky), `shrinkRect`, `segmentBanned`, `serverZone`(ZONE_SLACK 6), `lineBanned`(49-107)
  - `inkCap`: `ink − 이미 쓴 합 − 40×max(0, minLines−k)`(117-120)
  - `lineSetHash`(FNV)
  - `DrawState` 리듀서 `step`(230-309): down, move, up, undo, remove, clear, restore, start, finish를 처리한다. 평활한 선이 서버 구역에 닿으면 그 앞에서 자른다.
  - `startBlock`: running, attempts, day, drawing, lines, settle(400ms), same(174-185)
  - `canonLines` 정렬(canon.ts:36). 엔진은 선분 순서에 따라 결과가 달라질 수 있어서 반드시 정렬한 뒤 넣는다.
  - 서버 `verify.ts:107-127`은 이미 다중 선을 받는다(선 수 범위, 잉크 합, canon 후 simulate).
- **솔버와 봇은 2선 해를 찾지 못한다.**
  - `runLine`이 `simulate(stage, [line])` 하나만 돌린다. **banZones도 검사하지 않고** 스폰 금지만 본다(solver.ts:19-25).
  - `solve`는 웨이포인트 k개 하나짜리 폴리라인만 탐색한다(47-100). `survival`, `playBot`, `randomDensity`, `doodlePath`(bots.ts), `clusterOf`, `gateStage`, `determinism`(gate.ts:12-85)도 모두 선 1개다.
  - `checksFor`에는 tier1~3 항목만 있다(gate.ts:100-140).
- **2선 탐색에 빠진 것**
  1. 해 표현을 `waypoints[][]`로 바꾸고 선별 k를 정해야 한다.
  2. `runLines`가 필요하다. 선마다 `processStroke(raw, inkCap(...))`, `lineBanned`, `segmentInServerZone` 절단을 거친 뒤 `canonLines` → `simulate`. 입력·서버와 같은 함수를 써야 한다.
  3. CEM 차원이 두 배가 되므로 스펙 추정으로 pop 1500, 10라운드가 필요하다.
  4. "1선 제한 해 0"과 "1선 해 존재"를 판정하는 모드.
  5. 2선 봇의 흔들림과 선 순서 정책, 클러스터 서명.
  6. 스펙 B-2에 있는 5단계, 8단계 게이트 항목.

  이 모두가 PR-7 범위다(스펙 E:281).

## 5. 일일 저장과 고스트, c-meadow 검증

- **선은 저장된다. 단 1개만.**
  - `Attempt.line?: number[][]`(×2 정수, daily.ts:15-22). 저장 키는 `slime:daily2:<iso>`이고 `localStorage`를 쓴다(GameSlimeSlide.tsx:40-57).
  - 기록은 손을 놓는 순간 한다(SlimeProto.tsx:640, `l.map(×2)`).
- **"지난 스테이지 고스트"는 이미 출시됐다.**
  - `clearedLine`은 바로 앞 스테이지에서 깬 시도 중 최고점의 선을 고른다(GameSlimeSlide.tsx:71-74).
  - 이것을 `memoryLine`으로 넘긴다(:229, daily이고 view>0일 때만).
  - 받는 쪽은 앞 선 위에서 처음 독꽃에 닿는 지점을 ✕로 표시하고(SlimeProto.tsx:203-218), 그림은 371에서 그린다.
- **고스트의 한계**
  - N−1만 지원한다. A5(A1 고스트)나 A8(1~7 겹침)은 안 된다.
  - 다중 선 시도를 담을 `lines` 필드가 없다. `slimeSubmitBody`는 `{lines:[a.line]}`로 감싼다(daily.ts:121).
  - ✕ 판정은 독꽃만 한다. 벽, 강, 문에 막히는 지점은 표시하지 않는다.
- **c-meadow 검증**
  - 테스트는 engine.test.ts:191-209 세 건이다: 지형·스폰·둥지가 g-slide와 같다, 대각선 (50,150)→(315,488)은 A1에서 nest이고 A2에서 spiked다, 추천 길은 별 3개다.
  - **golden.test.ts는 c-meadow와 s-bounce를 고정하지 않는다.** `KNOWN_LEGACY_STAGES`는 BASE 4개와 반전본뿐이다(stages.ts:161-163).
  - 이번에 직접 측정한 값

| 측정 | c-meadow | g-slide (비교) |
|---|---|---|
| gateStage tier1 전 항목 | 모두 PASS | 모두 PASS |
| 해 수 | 3130 | 3938 |
| 강건 해 | 347 | 360 |
| 클러스터 | 19 | 36 |
| 무작위 밀도 | 1.3% | 2.8% |
| 직선 1회차 | 0.8% | 84% |
| c12 1회차, 3시도 | 96%, 100% | 96%, 100% |
| c12 만점 | 77% | 18% |
| c20 1회차 | 74% | 79% |
| doodle 1회차 | 7% | 74% |
| 도착까지 평균 | 1.9초 | 1.9초 |

  - `slime-chain-a2.ts` 결과: 별 3 해 453개, 추천 길 σ12 생존 1.00, 잉크 375/520, 무작위 곡선 6%.
  - 주의할 점이 둘 있다.
    - 콜백 성질이 생각보다 약하다. **A1 추천 길이 A2에서도 nest**이고, A1 솔버 해 40개 중 24개(60%)가 A2에서 도착한다. 문서값 37%와 다르다.
    - stages.ts:170 주석의 "독꽃 13%"는 c-meadow 실측 6%와 맞지 않는다.
  - a3 측정: A2 해 0/40이 A3를 통과했고, A3 무작위 성공률은 1%, 최고 sv는 0.64였다.

## 6. "N+1 = N의 지형 + 1변경" 곡선 체인의 공학 위험 Top 5

1. **렌더와 충돌이 어긋남.**
   - ridge는 끝점에서 보드 바닥까지 칠하고, 체인은 끝점 접합으로 추측한다. 그래서 패치로 선분을 하나 더하면 체인이 합쳐지거나 갈라져 그림이 크게 바뀔 수 있다. 섬, blob, 오버행은 채움이 틀린다.
   - 칠한 곳을 통과하는 문제도 있다(스펙 A-1 12번). 스펙의 `landforms` 인덱스 구간과 `closeTo`, 충돌-채움 폐쇄 검사는 아직 없다.
2. **기반 지형을 바꾸면 이전 날짜 결과가 무너짐.**
   - base 스테이지를 다듬으면 파생 전부와 이미 출시된 결과가 바뀐다.
   - `base+patch`와 `resolveStage`는 코드에 없다(검색 0건). golden은 파생 스테이지(c-meadow, s-bounce)를 지금도 고정하지 않는다.
   - 따라서 빌더 출력(결정적 JSON과 해시)을 박제하고, 파생판마다 golden 항목을 넣어야 한다.
3. **곡선 폴리라인 근사가 물리에 주는 부작용.**
   - 오목 접합에서 두 선분이 번갈아 밀어내 끼이거나 멈출 수 있고, 볼록 접합의 0반지름 캡에서 미세하게 튄다.
   - 분할 수가 바뀌면 같은 "곡선"이라도 궤적이 비트 단위로 달라진다. 근사 해상도는 빌더 상수로 고정해야 한다.
   - 물리 9조합 변동, 12° 규칙, R≥60은 아직 처음 실측도 하지 않았다(PR-8).
   - 비용: 선분 150개면 simulate가 약 2배(161µs/211스텝)다. timeout 판(1440스텝) 3시도는 서버 한도에 다가간다.
4. **콜백 강도를 측정할 도구가 없음.**
   - "이전 해 통과율 ≤40%"(진행 문서 6장)가 게이트 기준인데 `gateStage`에는 그 항목이 없다. 지금은 일회성 스크립트(a2, a3)뿐이다.
   - c-meadow가 이미 60%로 기준을 넘는다.
   - 패치를 하나 줄 때마다 별을 다시 놓아야 하고(acorns 명시), 이전 고스트를 따라 그리는 '이어 그리기' 문제도 있다. 이것도 자동 검사가 없다.
5. **다중 선과 기믹 경로가 비어 있음.**
   - A5, A7, A8은 2선 솔버·봇·게이트가 필요하다(4절). 바람과 스위치·문은 엔진에 없다.
   - 고스트는 N−1과 선 1개로만 저장된다. 여러 장 고스트와 `lines` 저장은 형식 변경(`daily3`)을 요구한다.
   - 각 엔진 변경은 golden 비트 동일을 지켜야 하는데, 그 golden 범위 자체가 좁다.
