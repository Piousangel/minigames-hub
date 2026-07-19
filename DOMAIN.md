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
  영구 레일, CrazyGames 개인화 추천) → ✅ 우리 NextUp(게임 직후) + TodayBoard로 착수함.
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
  모달이 84% 익일 복귀 근거.
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

- **P1 게임오버 오버레이 개편** 🟡 — 다음게임(✅ NextUp)·streak(✅ TodayBoard/공유카드)·마일스톤·
  **내 기록 미니패널(`stats:<slug>` 신설: plays/wins/maxStreak/시도분포)**·데일리 카운트다운·
  AdSense 자리표시자 남음. 한 번의 GameShell/GameOverlay 작업으로 61종 파급.
- **P2 장르/의도 허브 랜딩** ✅ 완료 — `/category/[puzzle|arcade|classic|skill]` SSG + JSON-LD
  (CollectionPage/ItemList/FAQPage) + sitemap + 푸터 내부링크. `/popular`·`/new`·`/unblocked`는 남음.
- **P3 온보딩 Start 카드** ⬜ — gameMeta에 `objective`/`controls` 추가, 최초 플레이 시 board 위 Start
  카드(objective + 언어독립 조작 글리프), `seen:<slug>` 게이팅.
- **P4 스트릭 프리즈** ✅ 완료 — dailyStreak.ts freeze(gap 2+잔량>0이면 프리즈 소모, 5일마다 +1, 최대 2),
  TodayBoard ❄️ 표시. ⚠️ loadStreak가 freezes 떨구던 버그 브라우저 검증으로 잡음. **데일리 아카이브(`/daily`
  지난 날짜 결정론 재생)는 남음.**
- **P5 게임별 브랜드 OG 이미지** ⬜ — `[slug]/opengraph-image.tsx`(force-static)로 61종 네온 OG PNG
  빌드타임 생성. dailyShare renderCard 미학 재사용. ⚠️ generateImageMetadata는 output:export와 충돌
  이력 있음(HANDOFF 6.1) — 단일 정적 OG로.
- **P6 분석 계측** ⬜ — Cloudflare Web Analytics(beacon 자체호스팅) + Analytics Engine `/api/hit`
  비콘(RecordPlay에서 game/event/dwell). PII 없는 코스 신호만.
- **P7 홈 신선함 + 인기 레일** ⬜ — 인기는 Worker read 엔드포인트(임계값 게이팅, 초기 에디토리얼 폴백),
  gameMeta `addedDate` → NEW 뱃지 + 'New games' 행.
- **P8 즐겨찾기 'My Games'** ✅ 완료 — 카드 코너 하트 → localStorage `favorites`, 홈 레일(무계정 차별점),
  커스텀 이벤트로 하트/레일 동기화.

### 신규 게임 파이프라인 (병행)
- ① **Connections식 4×4 그룹핑 데일리** ✅ 완료 — 'Clusters'(62종째). 16타일→숨은 4그룹, 4목숨,
  데일리+연습, 노스포일러 이모지 그리드 공유, 승리 시 streak.
- ② **네온 idle/클리커**(high — 무계정·무서버 궁합, 오프라인 수익 팝업 = 재방문 보상).
- ③ **Quordle식 멀티보드**(medium — word-guess 상태 배열화 리믹스 + SEO 랜딩 2개).

### 서버/승인 게이트 (지금 X, 조건 충족 시)
- H5 Games Ads 인터스티셜/리워드 → **AdSense 승인 후**(P1에서 자리표시자만).
- AggregateRating 별점 → Worker 투표 엔드포인트 + 실제 데이터 후(가짜 금지).
- 플레이수 소셜프루프 → P6 데이터 임계값(100회+) 넘긴 게임만.

### 하지 말 것 (대형 포털은 하지만 우리에겐 안 맞음)
- auto-ads 전면 자동배치 금지(게임 캔버스 위/주변 배너 = 정책위반+UX파괴). 수동 인콘텐츠 슬롯만.
- 계정/로그인 기반 기능 금지 — 전부 localStorage가 차별점. 크로스디바이스 동기화용 계정 = 제약 위반.
- 저트래픽 상태에서 플레이수·리뷰수 노출 금지(낮은 숫자 = 역소셜프루프). 임계값 게이팅 전엔 숨김.
- 승인 전 광고 SDK 로드 금지. 가짜 평점/리치데이터 금지. 서드파티 호스팅 분석/폰트/스크립트 금지.
