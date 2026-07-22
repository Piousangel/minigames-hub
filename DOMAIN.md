# DOMAIN.md — "무료 브라우저 미니게임 허브"에서 최고 사이트가 되는 조건

> 도메인 리서치 팀(웹 벤치마크)이 축적한 지식 레퍼런스. 경쟁사가 실제로 검증한 패턴 +
> 우리 제약(정적 export·무계정·엄격 CSP·무료 티어) 하에서의 번역. **다음 세션은 이걸 먼저
> 읽고 재조사 생략.** 갱신: 2026-07-18.

## 0. 북극성 등식
**광고 수익 = 트래픽 × 세션 체류(=방문당 플레이 수) × 재방문.** 모든 판단은 이 세 항 중
무엇을 올리는지로 정당화한다.

## 1. 트래픽(SEO) — 경쟁사가 검증한 것
- **장르/의도 허브 랜딩이 트래픽 엔진.** Poki `/popular` `/new`, coolmathgames "All Categories",
  "unblocked games 66/76/77"는 전부 개별 URL로 각각 랭크된다. 롱테일("free puzzle games online",
  "unblocked games at school")은 전체 검색 ~70%·경쟁 낮음·전환 2.5배. **개별 게임 페이지만 있고
  장르 색인 페이지가 없으면 이 트래픽을 통째로 못 먹는다.**
- 각 허브 = 고유 title/H1/meta + 200~300단어 인트로 + 게임 그리드(내부링크) + FAQPage 스키마.
- **게임마다 고유 OG 이미지**(브랜드 카드)가 SERP·SNS CTR을 만든다.
- 구조화 데이터: 개별 페이지 `VideoGame`(+`FAQPage`+`Breadcrumb`), 허브 `ItemList`/`CollectionPage`.
  `AggregateRating`은 **실제·노출 평점만**(조작 시 구글 수동 페널티). 값 없으면 스키마 생략.
- **얇은 콘텐츠는 승인·랭킹 둘 다 죽인다.** 게임마다 howToPlay·strategy·FAQ 프로즈 필수(신규도 예외 없이).

## 2. 세션 체류(방문당 플레이 수) — 코어 루프
- **이탈 최고 의도 시점 = 게임오버/승리 오버레이. 여기에 '다음 게임'을 꽂아 세션을 이어붙인다.**
  다음 게임 추천은 '홈'이 아니라 **'지금 보고 있는 화면 안'**에 붙는다. (Poki 'Recently Played'
  영구 레일, CrazyGames 개인화 추천) → ✅ **게임오버 오버레이에 '▶ Next: {게임}' 버튼(2026-07-22,
  GameNav context로 공유 GameOverlay에 주입 — 75/75 게임 무수정)** + NextUp(보드 아래) + TodayBoard.
  GameNav가 다음게임 픽+RUN을 단일 소스로 공급(NextUp/오버레이 공유, RUN 이중증가 없음).
- NYT 포스트게임 스택: 결과카드 → 스트릭/스탯 → 시도 분포 히스토그램 → **게임 크로스셀(항상 마지막).**
- **원탭 즉시 재시작**(스페이스/탭)이 하이퍼캐주얼 리텐션 룰. 강한 하이퍼캐주얼 D1 10~15%, 세션 10분+.
- 광고는 **자연 끊김(death/summary/레벨 전환)에서만**, 플레이 도중 절대 금지.

## 3. 재방문(Retention) — 데일리 게임의 진짜 KPI
- **스트릭(손실회피)이 복귀 엔진.** NYT "스티키니스가 넘버원 KPI." Duolingo 7일+ 스트릭 = 2.4배 리텐션.
- **스트릭엔 '자비 인프라'(프리즈/리페어) 필수.** 하루 놓쳐 0 리셋되면 그 유저 영영 이탈.
  Duolingo가 프리즈 1→2~3으로 올리자 DAU·복귀율 상승. **프리즈 없는 스트릭은 이탈 장치.**
- **데일리 아카이브(지난 판 재생)가 back-catalog 트래픽.** 날짜 시드 결정론이라 지난 날짜도 순수 재생 가능.
- **마일스톤(7/30/100/365일) 축하 + 공유 카드**로 손실회피 루프 유지.
- **'다음 데일리까지 HH:MM:SS' 카운트다운**이 재방문 약속(appointment) = Wordle의 '아침 의식'.
- **개인 스탯 화면(승률·플레이 수·시도 분포·최고 스트릭)이 재방문 '트로피 케이스'.** Wordle 스탯
  모달이 84% 익일 복귀 근거. → ✅ GameStats 패널 + **Goals 시스템(2026-07-22, 홈 위젯)**: Explorer/
  Streak/Marathon/Champion/DailyThree 5개 누진 목표를 기존 localStorage 신호로 계산, 다음 티어를
  주어 계속 플레이/재방문 유도(신규 방문자엔 숨김). "다음에 이룰 것" = 체류·재방문 엔진.
- **즐겨찾기/Recently Played**로 '다시 찾는 마찰' 제거. coolmath는 로그인 뒤 감췄지만 **우리는
  무계정 localStorage로 즉시 제공 = 차별점.**
- **홈을 '매번 달라 보이게'**(NEW 뱃지·회전 통계·신작 행) — 복귀 유저에게 죽은 격자로 안 보이게.

## 4. 성장(바이럴)
- **Wordle식 노스포일러 공유가 유일한 무료 성장 엔진**(90→2M/주, 마케팅 0). 정답 노출 없이 색
  그리드로 텍스트 인라인 확산. → 공유를 데일리뿐 아니라 **엔들리스 신기록/게임오버의 1차 CTA로
  승격**하고 `?from=share` 딥링크로 '친구 도전' 재방문 루프. (우리 공유 카드 RANK+글리프가 이 방향.)

## 5. 온보딩(글로벌·모바일 낯선 유저)
- CrazyGames 심사 필수: **"유저가 즉시 무엇을 하는 게임인지·어떻게 조작하는지 이해."** visuals 우선,
  text 최소, 키보드/제스처 오버레이로 조작 표시, 온보딩 스킵 가능.
- **승리 조건(objective)이 above-the-fold 한 줄로.** 우리 흔한 실수 = 힌트가 조작만 말하고 목표 누락.
- **조작 단서는 언어 독립 아이콘**(방향키·스와이프·탭 글리프). 영어 문장 힌트만으론 글로벌 유저에 부족.
- 첫 세션 빠른 성취 보상(sparkle/sound/streak 시작)이 반복 행동 유발.

## 6. 수익화(AdSense 승인 후)
- **우리에 맞는 광고 = 배너가 아니라 H5 Games Ads adBreak API 인터스티셜 + 리워드 비디오.**
  "리워드가 eCPM 최고." H5 Games Ads는 서버 없이 클라이언트 JS(`adBreak()`/`adConfig()`)만 →
  정적·무계정과 충돌 없음(단 googlesyndication을 CSP script-src allowlist).
- **리워드는 자발적 opt-in만**(수락 명시 + skip 가능). 자연 지점: 엔드리스 '광고 보고 이어하기',
  데일리 '광고 보고 힌트', '광고 보고 부활'. 쿨다운은 localStorage 타임스탬프.
- **인터스티셜 ~3분당 1회 상한 + 자연 브레이크만.** AdSense 정책: 게임 인터페이스 위 광고 금지,
  게임에서 150px 이상. **auto-ads 전면 자동배치는 끈다**(게임 화면 위 삽입 위험) — 수동 슬롯만.

## 7. 분석(무계정·정적에서 측정)
- **Cloudflare Web Analytics**(무료·쿠키/핑거프린팅 없음): PV/톱페이지/리퍼러/국가/CWV. 이미 CF
  Workers 위라 최적. **엄격 CSP 유지하려면 beacon.min.js 자체 호스팅.**
- **Workers Analytics Engine `writeDataPoint()`**: 리더보드 Worker에 붙이면 1st-party 게임별 이벤트
  분석이 공짜. 논블로킹·무한 카디널리티(slug=blob)·SQL 조회. JS 비콘이 놓치는 분량까지 잡음.
- **인기 랭킹 = 소셜프루프.** 단 유저 0 초기엔 '3 plays' 노출이 역효과 → **임계값(100회+) 게이팅 필수.**

## 7.5 성능/CWV (SEO 랭킹 직결)
- ✅ **게임별 코드 스플리팅(2026-07-21):** GameRenderer가 75게임을 static import 하던 걸 'use client'
  + 게임별 `next/dynamic(ssr:false)`로 전환 → 게임 페이지 First Load JS **401kB→165kB**([slug] 청크
  844KB→32KB, 청크 10→108). 트래픽 착지 페이지 LCP/TBT 대폭 개선. 보드는 원래 클라 전용이라 SSR
  손실 0, 프로즈는 서버 렌더 유지. ⚠️ next/dynamic 옵션은 **인라인 객체 리터럴 필수**(공유 변수 불가).
- **교훈: 게임/컴포넌트가 늘면 배럴 import 번들 비대 주기적 점검**(`grep [slug] 빌드로그`로 First Load JS).

## 8. 우리 절대 제약 (권고가 이걸 어기면 무가치)
- 정적 Next export, 서버는 리더보드용 Cloudflare Worker+D1 하나뿐.
- 계정/로그인 없음. 진행상태 전부 localStorage("이 브라우저에서의 나").
- 엄격 CSP: 외부 요청·스크립트·폰트 금지, 전부 자체호스팅. 무료 티어.
- **함의:** ① 개인화·진행·스탯·즐겨찾기·프리즈는 전부 localStorage로 흉내(무계정이 오히려 차별점).
  ② 데일리/아카이브는 날짜 시드 결정론으로 서버 없이 재생. ③ 새 게임은 idle/데일리 장르가 궁합 최상.
  ④ 외부 SDK(광고·분석)는 자체호스팅하거나 CSP allowlist 최소화.

---

## 우선순위 로드맵 (2026-07-18 도메인 리서치, impact × 실현성)

착수 상태: ✅ 완료 · 🟡 부분 · ⬜ 미착수

- **P1 게임오버 오버레이 개편** 🟡 — 다음게임(✅ NextUp)·streak(✅ TodayBoard/공유카드)·
  마일스톤 축하(✅ 7/30/100/365)·데일리 카운트다운(✅ HH:MM:SS)·개인 스탯 패널(✅ GameStats
  `stats:<slug>` Played/Win%/Streak/MaxStreak/Best, GamePageLayout 삽입)·maxStreak(✅ dailyStreak).
  **남은 것: AdSense 자리표시자(승인 후)만.** 스탯은 게임이 recordResult를 호출해야 채워짐 —
  Clusters 채택 완료, **나머지 승/패 게임들도 recordResult 붙이면 패널이 그 게임에도 뜬다(확산 작업).**
- **P2 장르/의도 허브 랜딩** ✅ 완료 — `/category/[puzzle|arcade|classic|skill]` + `/daily` + `/collections`
  (10종) + `/unblocked`(대형 검색 의도) 전부 SSG + JSON-LD + sitemap + 내부링크. `/popular`는 트래픽/데이터
  필요(저트래픽 노출=역소셜프루프)라 보류. `/new`는 NewGames 홈 레일로 대체(전용 랜딩은 저ROI, 선택).
- **P3 온보딩** 🟡 — 목표 한 줄 above-the-fold(✅ objectives.ts 62종 + ObjectiveBanner, 보드 위 상시).
  **남은 것: 언어독립 조작 글리프(방향키·스와이프·탭)** — 게임별 `controls` 메타 + 최초 플레이 시
  `seen:<slug>` 게이팅 Start 카드. 목표(가장 큰 갭)는 상시 노출로 해결했으니 글리프는 후속.
- **P4 스트릭 프리즈** ✅ 완료 — dailyStreak.ts freeze(gap 2+잔량>0이면 프리즈 소모, 5일마다 +1, 최대 2),
  TodayBoard ❄️ 표시. ⚠️ loadStreak가 freezes 떨구던 버그 브라우저 검증으로 잡음. **데일리 아카이브(`/daily`
  지난 날짜 결정론 재생)는 남음.**
- **P5 게임별 브랜드 OG 이미지** ✅ 완료 — `[slug]/opengraph-image.tsx`(force-static)가 전 게임 네온
  OG PNG(아이콘+이름+액센트) 빌드타임 생성 + og:image 메타 출력. ⚠️ **핵심 함정 발견/수정:** 확장자
  없는 `opengraph-image` 파일을 CF assets가 Content-Type 없이 서빙 → 크롤러가 미리보기 안 띄움.
  `public/_headers`로 `/opengraph-image`·`/*/opengraph-image`에 `Content-Type: image/png` 강제(라이브 검증).
- **P6 분석 계측** ✅ 활성 — Analytics Engine mg_events 데이터셋 대시보드 활성화 완료(2026-07-20) +
  바인딩 배포 → `/api/hit` 비콘이 실기록 중(view+dwell+country+ref+**vid**, 1st-party·PII 없음).
  vid(익명 방문자 id)로 북극성 3요소 계산 가능: view=트래픽, dwell=체류, same-vid distinct-day=재방문,
  세션당 view=방문당 플레이. 조회는 AE SQL API(CF 토큰) 후속. **다음: play/finish 이벤트(승/패 퍼널)는
  게임별 배선 필요 — 커뮤니티 게시 직전 승격.**
- **P7 홈 신선함 + 인기 레일** 🟡 — 신선함(✅ gameMeta addedDate + NewBadge + 'New games' 행,
  클라이언트 now로 21일 자동 만료). **인기 레일은 보류** — Worker read 엔드포인트 + 임계값(100회+)
  게이팅 필요한데 트래픽 전이라 시기상조(저트래픽 플레이수 노출 = 역소셜프루프). P6 분석 데이터 후.
- **P8 즐겨찾기 'My Games'** ✅ 완료 — 카드 코너 하트 → localStorage `favorites`, 홈 레일(무계정 차별점),
  커스텀 이벤트로 하트/레일 동기화.

### 팀 회의 실행 로그 (2026-07-20) — "게임 착지 페이지 = 성장 엔진"
방향: 유입(SEO·커뮤니티)은 홈이 아니라 개별 게임 페이지에 착지하는데 그 페이지엔 리턴 훅이 없어
'새는 양동이'였다 → 같은 표면에 트래픽(SEO 롱테일 컬렉션)+리턴(DailyDock·스탯 확산)을 심음.
- ✅ ① DailyDock — 66종 게임 페이지에 site streak+오늘 퀘스트+카운트다운 리턴 훅(보드 아래).
- ✅ ② 배포 라우트 회귀 게이트(scripts/check-routes.mjs) — 린트가 라우트 떨구면 배포 하드 실패.
- 🟡 ③ best: NaN 가드 — 배선 게임 중 리더보드+JSON저장 충돌 없음 확인 → 마이그레이션 불필요(GameStats는
  이미 Number 가드). Leaderboard.tsx Number() 미가드는 잠재적, 해당 게임 리더보드 없어 비활성.
- ✅ ④ recordResult ×11(minesweeper/sudoku/hangman/mastermind/lights-out/nonogram/sokoban/memory/
  word-guess/connect-four/checkers/reversi) → 스탯 패널 점등. simon/tic-tac-toe는 승률 오해로 스킵.
- ✅ ⑤ 롱테일 컬렉션 9종(games-like-wordle/connections/2048/snake/nerdle + word/two-player/logic/
  quick-games) + /collections 인덱스 + doorway 가드 test. 신작을 경쟁사 대안 검색으로 직격.
- ✅ ⑥ CollectionLinks — 66 게임 페이지→컬렉션 역링크(내부링크 권위).
보류(팀): Daily Mix(L급 위험), D1 계측(커뮤니티게시 직전 승격), 수익화(AdSense 후), 인기레일.
✅ 정정(팀 오판): privacy/page.tsx의 "EEA 동의 선택" 약속은 실결함 아님 — 동의는 **Google AdSense
CMP(대시보드 '유럽 규정 GDPR 메시지' 활성)**가 담당, adsbygoogle.js가 광고 켜질 때 자동 표시.
커스텀 ConsentBanner 만들면 Google CMP와 충돌하므로 만들지 말 것. 수익화 켤 때 실제 표시만 확인.

### 신규 게임 파이프라인 (병행)
- ⑤ **Klondike Solitaire** ✅ 완료 — 'solitaire'(66종째). **카드 게임 0→1**. "solitaire/klondike"는
  브라우저 최대 에버그린 검색어 + 체류 긴 장르라 데일리 변형보다 큰 실질 SEO 갭. draw-3, 순수 엔진.
  **통찰: 검색량 큰 '장르 갭'(카드/보드 변형)이 데일리 추측 변형보다 트래픽 ROI 높음** — 다음 라운드 우선.
- ⑥⑦⑧⑨ **카드 게임 클러스터 ✅ 완성** — solitaire(66,Klondike)·freecell(67)·spider(68)·pyramid(69)·
  tripeaks(70), 5종 전부 순수 엔진·recordResult·모바일 탭이동. + `/collection/solitaire-games`(5종 묶음)
  으로 "free solitaire / solitaire games" 검색 클러스터 확보. 카드=브라우저 최대 에버그린 트래픽 장르.
  (⚠️ 카드 이모지는 표준 이모지만 — 플레잉카드 유니코드 🂡류는 OG ImageResponse 폰트 미지원 400.)
- ⑩ **Mahjong Solitaire** ✅ 완료 — 'mahjong'(71종째). 타일 매칭 장르 갭. 144타일 4레이어, 풀 수 있는
  딜 보장(역-peel). ⚠️ 타일 면은 마작 유니코드 블록(🀇) 대신 라벨+색으로. **교훈: 여러 vitest 동시
  실행(에이전트+로컬)은 경합으로 행처럼 보임 — 에이전트 완료 후 단독 실행으로 성능 확인할 것.**
- ⑪ **Chess** ✅ 완료 — 'chess'(72종째). **최대 단일 검색어 갭.** 전체 규칙 perft 검증(startpos
  20/400/8902/197281, Kiwipete 48/2039/97862 정확 일치) + negamax 알파베타 AI(depth1/2/3). two-player-games
  컬렉션에 추가. **교훈: 복잡 규칙 게임은 perft/골든 같은 결정적 정확성 게이트를 스펙에 필수화하면
  에이전트 빌드도 안전.**
- ⑫ **Golf Solitaire** ✅ 완료 — 'golf-solitaire'(73종). 솔리테어 클러스터 6종(solitaire-games 컬렉션).
  **판단: 대형 장르 갭(솔리테어·마작·체스) 소진 → 신규 게임 breadth 한계효용 급감. 다음은 데이터/트래픽
  유입 후 결정하거나, 좁은 변형(Yukon/Anagram)·폴리시로.** 남은 후보: Crossword(콘텐츠 무거움)·match-3(gem-match 有).
- ⑬ **Dominoes** ✅ 완료 — 'dominoes'(74종). 더블식스, vs컴퓨터/2P. two-player-games 컬렉션 7종.
  best=WinRecord(JSON) → 리더보드 미등록(체스와 동일 패턴).
- **수익화 보조:** Ko-fi 후원 링크(siteConfig.kofiUrl) 푸터 단순 링크. AdSense 승인 전에도 소액 후원 경로.
- ⑭ **Jigsaw** ✅ 완료 — 'jigsaw'(75종). 대형 검색 갭 + 긴 체류. 외부 이미지 0(네온 생성 아트),
  strict-correct 배치로 항상 풀림. 3×3/4×4/6×6.
- ⑮ **Yukon Solitaire** ✅ 완료 — 'yukon-solitaire'(76종). 스톡 없는 Klondike 사촌, 임의 페이스업
  더미 이동. **솔리테어 클러스터 7종**(solitaire-games 컬렉션). ⚠️ 새 게임은 GameRenderer의
  dynamic 코드스플리팅 목록에도 추가할 것(static import 하면 번들 비대 재발).
- ⑯ **Gomoku** ✅ 완료 — 'gomoku'(77종). Five in a Row, 15×15, vs컴퓨터/2P, 휴리스틱 AI(포 블록).
  two-player-games 컬렉션 8종.
- ⚠️ **갬블링 금지(AdSense 승인 리스크):** 블랙잭/포커/룰렛 등 카지노류는 승인 전 절대 추가 금지.
- **판단(재확인):** 게임 74종·SEO 랜딩 다수·리텐션·분석 완비 = 공급 충실. 병목은 수요(트래픽) =
  커뮤니티 게시(사람)·색인 시간·AdSense 승인. 팀은 supply-side 롱테일 게임/SEO를 계속하되, 실데이터
  유입 후 폴리시·인기레일·전환으로 전환. 다음 게임 후보(non-gambling): Yukon·Anagram·Jigsaw(자체생성)·Dominoes변형.
- ④ **Nerdle식 수식 데일리** ✅ 완료 — 'Equate'(64종째). 8칸 수식 6추측, 안전 평가기, 수학 검색
  표면 신규(단어 게임과 다른 키워드). 데일리+연습+streak+스탯+공유.
- ① **Connections식 4×4 그룹핑 데일리** ✅ 완료 — 'Clusters'(62종째). 16타일→숨은 4그룹, 4목숨,
  데일리+연습, 노스포일러 이모지 그리드 공유, 승리 시 streak.
- ② **네온 idle/클리커** ✅ 완료 — 'Reactor'(65종째). 첫 인크리멘탈. 탭+6티어 자동생성(×1.15),
  오프라인 수익 8h 캡 + 복귀 팝업, 프레스티지 리부트(+10%/회). 순수 엔진(elapsedMs 주입).
- ③ **Quordle식 멀티보드** ✅ 완료 — 'Quadle'(63종째). 4보드 동시, 9추측, wordguess 엔진
  (ANSWERS/scoreGuess) 재사용, 데일리+연습+streak+스탯+노스포일러 공유.

### 서버/승인 게이트 (지금 X, 조건 충족 시)
- H5 Games Ads 인터스티셜/리워드 → **AdSense 승인 후**(P1에서 자리표시자만).
- AggregateRating 별점 → Worker 투표 엔드포인트 + 실제 데이터 후(가짜 금지).
- 플레이수 소셜프루프 → P6 데이터 임계값(100회+) 넘긴 게임만.

### 하지 말 것 (대형 포털은 하지만 우리에겐 안 맞음)
- auto-ads 전면 자동배치 금지(게임 캔버스 위/주변 배너 = 정책위반+UX파괴). 수동 인콘텐츠 슬롯만.
- 계정/로그인 기반 기능 금지 — 전부 localStorage가 차별점. 크로스디바이스 동기화용 계정 = 제약 위반.
- 저트래픽 상태에서 플레이수·리뷰수 노출 금지(낮은 숫자 = 역소셜프루프). 임계값 게이팅 전엔 숨김.
- 승인 전 광고 SDK 로드 금지. 가짜 평점/리치데이터 금지. 서드파티 호스팅 분석/폰트/스크립트 금지.
