# 리더보드 v1 라운드1 — 허브 팀(그로스/게임 디자인) 보고

작성: 2026-11-18 / 저장소 수정 없음. 근거 없는 추정은 [추정].

## 1. 현황 감사 (코드 사실)

### 1-1. 데이터·서버
- 저장: Cloudflare D1 `scores(id, game, week, name, score, created_at)` + 인덱스 `(game, week, score DESC)` — db/schema.sql:2-10. 한 번 제출 = 한 행 INSERT (worker/index.ts:135-139). **사용자 식별자 컬럼이 없다**(계정·기기 ID·IP 저장 없음).
- 신원: 계정 없음. 닉네임은 localStorage `lb:name`(src/lib/leaderboard.ts:141-157), 서버는 `cleanName`(제어문자 제거, 16자, 빈 값이면 `Anon`; :160-164)만 한다. 같은 이름 사칭·중복 가능.
- 검증: 서버가 하는 것은 (a) 게임 화이트리스트(worker/index.ts:249), (b) `cleanScore` 정수·0..1억 범위(leaderboard.ts:119,167-171), (c) IP+게임당 10초 쿨다운(leaderboard.ts:122-126, worker/index.ts:253-257; comment_rate_limits 테이블 재사용). **점수가 실제 플레이에서 나왔는지는 검증하지 않는다.** 점수 원천은 클라이언트 `localStorage best:<slug>`(Leaderboard.tsx:62, OverlayScoreSubmit.tsx:16-24) — 콘솔에서 바꾸면 그대로 제출된다. 주석도 "캐주얼 위조 방어"라고 명시(leaderboard.ts:118).
- 같은 사람이 여러 번 제출하면 여러 행이 쌓여 톱10에 한 사람이 여러 칸을 차지할 수 있다(사용자별 최고 1행으로 합치는 로직 없음: worker/index.ts:141-148 `top()` 쿼리).
- 리더보드 게임 수: `LEADERBOARD_GAMES` 84~85개(leaderboard.ts:4-89). 대부분 "Score"이고 단위만 다른 것(Charge, Height, WPM, Level, Round, Wins 등). chess·gomoku·pong은 `Wins`(:84-86) — 파밍 우려 주석(:95-97)과 모순되는 등록이라 점검 필요 [추정: 의도된 등록일 수 있음].
- 정렬: `score DESC, created_at ASC`(동점이면 먼저 낸 사람 우선; worker/index.ts:143). 모든 게임이 "높을수록 좋음" 고정(leaderboard.ts:3). 낮을수록 좋은 기록(시간) 게임은 구조적으로 불가.
- 갱신 주기: ISO 주 단위(`isoWeek`, leaderboard.ts:131-138), 월요일(UTC 기준) 리셋. 별도 크론 없이 `week` 문자열이 바뀌면 자동 신규 보드. 응답은 `cache-control: no-store`(worker/index.ts:4) — 매 조회 D1 직접 조회.
- 허브 API `/api/leaderboards`(worker/index.ts:229-243): **이번 주 모든 행을 읽어와 JS에서 게임당 3개만 자른다**(LIMIT 없음). 점수 수가 늘면 비용·지연이 선형 증가. 현재 주간 행 수가 수십 건이라 문제는 아직 없음.
- 내 순위 API 없음. 응답에 `submitted:{name,score}`는 있으나 순위/백분위는 없음(worker/index.ts:140).

### 1-2. 화면
- /leaderboards (src/app/leaderboards/page.tsx:14-93 → LeaderboardsHub.tsx):
  - 순서: `Object.keys(LEADERBOARD_GAMES)` = 선언 순서(LeaderboardsHub.tsx:30,48). 2048부터 시작, **최신 게임 순이 아님**. 최신순 로직은 이미 있음(src/lib/newGames.ts:29-38 `latestSlugs`, gameMeta의 `addedDate`). 다만 리더보드 대상 중 addedDate가 있는 것은 약 51/84(스크립트 집계, 오래된 33개는 없음) → 날짜 없는 게임은 선언 순서 폴백 필요.
  - 내용: 게임별 카드 1개씩, 톱3(이름·점수), 아이콘·제목 링크(:53-90). 헤더 `WEEK 2026-Wxx`(:42-46). 3열 격자.
  - 빈 보드도 전부 "No scores yet — be the first!"로 노출(:70-72). 2026-11-16 스펙(docs/team/specs/2026-11-16-leaderboard-engagement.md) 완료조건 ②(빈 보드에 지난주·역대 최고) ③(빈 보드 접기)는 **코드에 아직 없다**. ①(오버레이 1클릭 제출)만 구현됨.
  - 내 기록·내 순위·점수 단위(`SCORE_SCALE`, Charge/WPM 라벨) 없음: 허브는 `r.score.toLocaleString()`만 표시(:82) — aim-trainer는 10배 정수로 저장되므로 **허브에 10배 값이 그대로 노출되는 버그 가능성**(Leaderboard.tsx:27은 나눠서 표시, 허브는 안 나눔). 확인 필요.
  - 메타: `thinPageRobots`(page.tsx:11) — 색인 제한.
- 게임 페이지(Leaderboard.tsx, GamePageLayout.tsx:82): "Weekly Top 10"(:126-128), 톱10 목록 `01..10 이름 점수`(:133-154), 마운트 시 1회 로드(:39-51, 갱신 폴링 없음), 이름 입력+제출(:156-174), 공유 버튼(:188-197; 공유 URL은 `/${slug}` 단순 링크 — `?vs=` 도전 링크가 아님 :101). **내 순위·내 점수 위치 표시 없음**, 톱10 밖이면 제출해도 어디인지 모름. 제출 후 문구 "Submitted! Beat your best to climb higher."(:181).
- 게임오버 오버레이(GameOverlay.tsx:95 → OverlayScoreSubmit.tsx): 신기록일 때만 노출(:56-58), 이름 저장돼 있으면 1클릭 "🏆 Submit N as 이름"(:147), 없으면 입력창(:99-135). 성공 시 `lb_submit` + `lb_submit_overlay` 전송(:81-82), 완료 문구 "✓ Submitted to this week's board"(:59-64) — **순위·톱10 진입 여부를 알려주지 않는다.** 서버가 top 목록을 돌려주지만 버려진다.
- 도전 링크: src/lib/challenge.ts. `/<slug>?vs=<seed>-<score>-<chk>&n=<name>&ref=share`. 서버 불필요, 체크섬은 오타 방지용(서명 아님; :9-11). 시드 기반 게임(Lagline, Recoil, Slosh, Siteswap, Shadowfit, Polarity, Hunch 등 grep 확인)에서 사용. 리더보드와 연결되어 있지 않다(점수 제출 ↔ 도전 링크 별개).

### 1-3. 지표(docs/daily/metrics)
- 파일명과 수집 시각이 어긋난다: `2026-11-19.md` 안에 "수집 2026-11-18 06:02 KST"(= 11-17 21:02 UTC). 이게 최신.
- 최신(11-19.md): 점수 등록 24h 13건 / 7일 13건(둘 다 13 → 7일 이전 기록이 사실상 없음), 등록 게임 9개(plop-landing 4, beatline 2, 나머지 1). AE 이벤트 7일: `lb_submit=13`, `lb_submit_overlay=10`(오버레이 경유 77%), pageview=189, view=98. 게임별 이벤트에서 `leaderboards=18`(허브 조회), 유입경로 `/leaderboards`=28.
- 직전(11-18.md): lb_submit=1, lb_submit_overlay=1 (오버레이 배포 직후 한 단위). 11-15.md는 점수 지표 수집 실패(wrangler 오류).
- 해석: 오버레이 도입 후 제출이 1 → 13으로 늘었지만 규모가 매우 작다(존 고유 방문자 일 200~470, 같은 파일의 존 트래픽 표). 허브 조회 18은 **일일이 아니라 7일 AE 이벤트** 수치. 허브에서 게임 페이지로 가는 클릭, 리더보드 노출/조회(게임 페이지 보드 impression)는 이벤트가 없어 측정 불가. 역대 점수 2건 상태였다는 11-16 진단(docs/daily/backlog.md:16)과 합쳐 보면 **병목은 제출 마찰이 아니라 "보드가 비어 있음 + 순위 피드백 없음"일 가능성** [추정].

## 2. 레퍼런스 조사 ([확인]=원문 직접 읽음, [요약]=검색 결과 요약만 봄)

| # | 출처 | 상태 | 핵심 | 가져올 것 | 가져오지 않을 것 |
|---|---|---|---|---|---|
| 1 | Wordle 공유 그리드 — BuzzFeed News https://www.buzzfeednews.com/article/stefficao/how-wordle-went-viral-strategy, Smithsonian https://www.smithsonianmag.com/smart-news/heres-why-the-word-game-wordle-went-viral-180979439/ | [요약] | 스포일러 없는 이모지 결과 그리드를 공유 버튼으로 제공(2021-12), 하루 1판, 무가입·무광고 | 리더보드 제출 직후 "내 순위" 한 줄을 그대로 복사하는 텍스트 카드(이모지+순위+도전 링크) | 하루 1판 제한(우리는 무한 플레이 게임 다수) |
| 2 | CrazyGames 리더보드 SDK/API 문서 https://docs.crazygames.com/sdk/leaderboards/ | [요약] | 클라이언트 SDK 또는 백엔드 API로 점수 제출, 포털에 "weekly leaderboard" 노출(MVP 문서). 다중 보드는 예정 | 포털식 "주간" 단일 기준 + 서버 제출 경로 분리 아이디어 | 개발자 키·초대제 구조(우리는 자체 게임) |
| 3 | Poki SDK https://sdk.poki.com/sdk-documentation | [요약] | 검색 결과에서 리더보드 기능은 확인 못 함(이벤트 지표 SDK만). "Poki 리더보드 없음"은 미확정 | 없음(근거 부족) | Poki 사례를 근거로 쓰지 않는다 |
| 4 | Kongregate | 미확인 | 검색에서 자료를 찾지 못함. 내 기억에 업적·일일 챌린지가 있었으나 근거 없음 [추정] | 없음 | 인용하지 않는다 |
| 5 | Duolingo Leagues 공식 블로그 https://blog.duolingo.com/duolingo-leagues-leaderboards/ | [확인] | 주 단위 리그, 일요일 리셋(현지 시간), 비슷한 학습 습관·시간대끼리 매칭, 10개 티어 + 승급, 2018 테스트에서 "약간의 경쟁"이 동기부여 | **주간 리셋 + "이번 주 승급/방어" 프레임**, 비슷한 레벨끼리 비교 | 10티어·30명 코호트 매칭(트래픽이 없어 불가, 일 200~400 방문) |
| 6 | Duolingo 리그 효과 수치 — strivecloud 등 https://www.strivecloud.io/blog/blog-gamification-examples-boost-user-retention-duolingo | [요약] | "리그 가입자 +20% 사용시간" 등은 2차 블로그 수치, 1차 출처 미확인 | 방향성만 | 수치를 우리 KPI 근거로 쓰지 않는다 |
| 7 | Yu-kai Chou "why most leaderboards fail" https://yukaichou.com/gamification-study/why-most-leaderboards-fail-and-how-to-fix-yours-in-5-steps/ | [확인] | 내 주변 5~15명 + 다음 순위 목표, 큰 보드는 백분위로, 주/월/시즌 리셋("영구 올타임 보드는 무덤"), 코호트 | **내 순위 ±2 + 한 단계 위 목표 + 백분위**, 주간 리셋 유지 | 코호트 분할(표본 부족) |
| 8 | 같은 저자 Part 3 https://yukaichou.com/behavioral-design/points-badges-leaderboards-part-3-of-3/ | [요약] | 톱10 + 내 위치 + 바로 위 사람 표시, 하위는 숨김, 변화량(델타)이 "판정이 아니라 여정" | "지난 제출 대비 +N계단" 델타 | 하위 순위 숨김은 보드가 작아(행 수십 건) 불필요 |
| 9 | 시즌 리셋 — bugnet "seasonal resets without backlash" https://bugnet.io/blog/how-to-handle-seasonal-resets-without-player-backlash, blask https://blask.com/knowledge/leaderboard/ | [요약] | 리셋 전 과거 시즌 기록 보관·명확한 공지, 복귀 계기, 리셋이 신규 진입장벽을 낮춤 | 주간 리셋은 유지하되 **지난주 챔피언/내 지난주 최고를 보존해 노출**(11-16 스펙 ②와 일치) | 보상 아이템·랭크 티어(보상 경제가 없다) |
| 10 | 부정행위 — itch.io 사례 https://itch.io/post/15202845, bugnet leaderboard cheating https://bugnet.io/blog/how-to-fix-leaderboard-cheating-and-fake-scores, 서버 검증 글 https://crux.supercraft.host/blog/leaderboard-cheating-public-leaderboard-server-validation-2026/ | [요약] | 클라이언트 검증은 무력(음수 시간으로 1위 사례), 서버 범위 검증은 기본, 이상치는 사람이 최종 판단, 완전 서버 권위는 인프라 비용 큼, 대부분 인디는 휴리스틱 | 게임별 "물리적으로 가능한 상한" 컷, 이상치 플래그 + 수동 삭제 쿼리, 제출 시 서명 토큰(진입 장벽만) | 서버 권위 리플레이 검증(전 84개 게임에 불가), 계정 필수 |
| 11 | 친구/라이벌 — 우리 `?vs=` (src/lib/challenge.ts) | [확인](코드) | 시드+점수+이름 링크, 서버 불필요 | 제출 후 "친구에게 도전" 링크를 공유 버튼 기본값으로 | 위조 방지 서명(키를 숨길 곳 없음, 피해 범위 작음) |
| 12 | 순위 변동 알림·스트릭 — Duolingo 스트릭 Sensor Tower https://sensortower.com/blog/duolingo-streak-feature-app-engagement-growth | [요약] | 스트릭이 참여도에 큰 영향이라는 분석(리그 단독 효과는 아님) | 푸시 없이 **재방문 시 보이는** "지난번보다 N계단 하락"(localStorage 비교) | 푸시/이메일 알림(계정·채널 없음), 연속일 스트릭은 별개 기능 |

조사 한계: Poki·Kongregate 리더보드 사례는 확인하지 못했고 "백분위·시즌 보상·친구 순위"의 효과 수치는 대부분 벤더 블로그다. 경쟁 효과 크기를 우리 사이트에 외삽하지 말 것 [추정].

## 3. 제안

### 3-1. 리더보드 페이지 v1 정보구조 (텍스트 와이어)

```
HIGH SCORES            WEEK 2026-W47   (리셋까지 3일 14시간)  ← 카운트다운(클라이언트 계산)
[ 내 기록 요약 바 ]  이번 주 제출 N회 · 최고 순위 #3 (plop-landing)   (localStorage에 있을 때만)

탭: [ 최신 게임 ] [ 인기 ] [ 접전 ] [ 전체 A-Z ]      기본 = 최신 게임

섹션 A "이번 주 신작 보드" (addedDate 내림차순 상위 12, 날짜 없는 게임은 후순위)
 ┌ 🎮 Plop Landing  NEW · 등록 4명 ───────────────┐
 │ 1 PIXEL    12,400  👑                          │
 │ 2 mj       10,100                              │
 │ 3 cat       9,800                              │
 │ 나: #7 (상위 30%) · 1위까지 -5,200  [도전하기]   │ ← 내 제출 기록이 있을 때만
 └────────────────────────────────────────────────┘
섹션 B "활발한 보드" — 이번 주 등록 ≥1인 보드(톱3)
섹션 C "빈 보드" — 접힘(`<details>`), "첫 제출자가 1위" + 지난주 챔피언 1줄
```
- 카드 요소: NEW 배지·등록 인원 수·1위 왕관·내 순위/백분위·"도전" 버튼(= `?vs=` 링크 복사).
- 정렬 규칙: 최신 게임 = `latestSlugs` 방식(newGames.ts:29-38). 활성 보드 우선 → 그 안에서 최신순.
- 게임 페이지: 톱10 + 하단에 "내 순위 ±2" 줄(톱10 밖이어도) + 백분위. 제출 직후 오버레이에 "#N / M명 (상위 P%)" 즉시 표시.

### 3-2. 경쟁 심리 장치 후보 8개 (영향·비용·위험)

| # | 장치 | 영향 | 비용 | 위험 | 서버 개발 필요 |
|---|---|---|---|---|---|
| 1 | 제출 직후 **내 순위·백분위·1위까지 차이** 표시(오버레이·게임 페이지) | 높음 | 낮음(0.5~1일) | 낮음 | 응답에 rank/total 추가(SQL COUNT 1개) |
| 2 | 보드 **최신 게임 순 + 활성 보드 우선 + 빈 보드 접기** | 중 | 낮음(0.5일) | 낮음 | 없음(프런트) |
| 3 | **내 순위 ±2 + 한 단계 위 목표** | 중~높음 | 중(1일) | 낮음 | `/api/rank?game&score` 읽기 API |
| 4 | **일간 보드(오늘 UTC) 추가**로 빈 보드 해소·매일 재방문 | 중~높음 | 중(1~2일) | 중(행 적으면 일간은 더 빈다) | `day` 컬럼 마이그레이션 또는 created_at 범위 쿼리(마이그레이션 불필요) |
| 5 | **도전 링크 연동**: 제출 후 "내 점수 넘어봐" 링크 공유(`?vs=`) + 도전 성공 시 보드 제출 유도 | 중~높음(유입) | 낮음~중 | 낮음 | 없음 |
| 6 | **지난주 챔피언/내 지난주 기록 보존**("방어하세요") | 중 | 중 | 낮음 | 이전 week 조회 쿼리 |
| 7 | **재방문 델타 배너**: 마지막 방문 이후 내가 N계단 하락/상승 | 중 | 중(1일) | 중(localStorage 사라지면 무의미) | rank API(#3) 재사용 |
| 8 | **사용자별 최고 1행 + 기기 토큰으로 이름 잠금**(사칭·도배 억제) + 상한 컷 + 이상치 플래그 | 중(신뢰) | 중~높음(2일+) | 중(개인정보·이름 충돌 UX) | 토큰 컬럼 마이그레이션, 게임별 상한 테이블 |

[추정] 영향 등급은 근거 있는 수치가 없는 설계자 판단이다. 현재 제출량(7일 13건)에서는 4·6·7번처럼 데이터가 필요한 장치의 효과가 보이지 않을 가능성이 크다.

### 3-3. 이번 주(1~2일) 최소 안 추천: **"제출 직후 내 순위 + 보드 최신 게임 순/빈 보드 접기"**

- 범위:
  1. `/api/score` 응답에 `rank`, `total`(같은 game·week에서 `score > ?` COUNT + 1, 전체 COUNT) 추가 — worker/index.ts:140 근처. 스키마 변경 없음, 기존 인덱스(game, week, score DESC)를 탄다.
  2. OverlayScoreSubmit 완료 문구(:59-64)와 Leaderboard 완료 문구(:180-181)를 "#N / M · 상위 P% · 1위까지 -X"로 교체, 톱10 진입 시 강조.
  3. LeaderboardsHub 정렬을 `latestSlugs`식 최신순 + 점수 있는 보드 먼저 + 빈 보드는 `<details>`로 접기(11-16 스펙 ③). aim-trainer 등 `SCORE_SCALE` 표시 보정도 같이.
  4. 허브 쿼리에 `LIMIT`가 필요하면 게임당 톱3 윈도 쿼리로 교체(선택).
- 이유: 비용 최소·서버 스키마 변경 없음·"제출해도 어디인지 모른다"는 피드백 공백 해소, ①②요구(최신순·순위 노출)를 모두 충족. 경쟁심 자체의 효과는 [추정]이므로 일간 보드·델타 배너는 이 지표가 오른 뒤 2라운드로.
- 하지 않을 것: 계정/로그인, 푸시, 서버 권위 검증, 시즌 보상.

### 3-4. 측정 지표(이벤트명 제안, `sendHit(slug, event)` 형식 재사용)
- `lb_hub_view`(허브 노출; 현재는 game=`leaderboards` pageview로 간접 측정) / `lb_hub_card_click`(허브→게임 클릭, slug 포함)
- `lb_board_view`(게임 페이지 보드 노출) → `lb_submit`(기존) 전환율 = lb_submit / lb_board_view
- `lb_rank_shown`(제출 후 순위 표시), 톱10 진입 시 `lb_top10`
- `lb_resubmit`(같은 주 2회 이상 제출 = 신기록 재도전), `lb_challenge_copy`(도전 링크 복사), `lb_challenge_open`(`?vs=` 진입 + ref=share)
- 성공 기준 [추정 제안]: 변경 후 7일 `lb_submit` ≥ 30건(현재 13), 재제출 비율 ≥ 15%, 허브→게임 클릭률 ≥ 20%. 베이스라인이 작아 노이즈가 크므로 7일 단위로만 비교.
- 사전 조건: 11-15 지표 수집 실패 사례처럼 wrangler 수집이 깨지지 않는지 확인, `lb_board_view`가 없으면 분모가 없다.

## 부록: 팀 내 확인 필요 사항
1. 허브가 `SCORE_SCALE`(aim-trainer ×10)을 반영하지 않는 것으로 보임 — 실사이트에서 확인.
2. chess·gomoku·pong이 `Wins` 리더보드로 등록됨(leaderboard.ts:84-86) — 파밍 우려(:95-97)와 일관성 검토.
3. metrics 파일명 날짜 ≠ 수집일(11-19.md = 11-18 수집). 집계 시 혼동 주의.
4. 같은 사람이 톱10을 여러 칸 차지 가능 — 사용자별 1행 정리는 v2.
