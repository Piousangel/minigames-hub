> **상태: 진단·제안(독립 리뷰 전).** 오너 11-17 "연결고리·구성이 너무 약하다". 요약·로드맵은 본문 참고. 팀 세션(06·10·13·16·20시)이 이어받아 한 번에 하나씩 출시한다.

# quickminigames.site 연결고리 진단 (2026-11-17)

작성: 그로스/PM 관점 점검. 저장소는 수정하지 않았고 코드를 읽어 확인했다. 실제 사이트를 브라우저로 플레이하지는 않았다(코드·문서·지표 기준). 숫자는 `docs/daily/metrics/2026-11-18.md`(수집 11-17 11:26 KST)와 `docs/team/strategy-2026-11.md`에서 가져왔다. 확인 못 한 것은 '추정'으로 적었다. 테스트·타입체크는 이번 문서 작업에서 실행하지 않았다.

---

## 0. 결론 (오너 질문에 대한 직답)

1. **"연결고리가 약하다"는 맞다. 다만 병목이 연결 이전에 유입이다.** 7일 AE: pageview 89(그중 home 70) · view(게임 진입) 26 · win 10 · finish 5 · lose 4 · lb_submit 1. 외부 유입 경로는 ninehire 19(오너 지원 플랫폼으로 추정, 실사용자 아님)와 `?ref=bluesky` 4가 거의 전부다. 내부 referrer(`/`=66, `/leaderboards`=22, `/unblock`=18)는 사이트 내 이동이거나 크롤러·오너 테스트일 가능성이 높다(추정). 즉 **낯선 실사용자는 주 한 자릿수~십수 명**이다. 이 표본으로는 연결 개선 효과를 퍼센트로 판정할 수 없다. 그래서 (a) 이벤트를 먼저 심고, (b) 코드로 확인되는 끊긴 곳을 고치며, (c) 유입 늘리기와 병행한다.
2. **연결의 뼈대는 이미 많다.** 게임오버 '다음 게임' 버튼, NextUp, 최근 플레이 스위처, 일일 3판 퀘스트·스트릭, 즐겨찾기, 업적, 도전 링크, 일일 공유, 리더보드, 컬렉션, 공략. 문제는 (1) 측정이 거의 0이라 무엇이 되는지 모른다, (2) 재방문 장치가 홈 중간 이후라 첫 화면에서 안 보인다, (3) 연결의 내용이 약하다(추천에 이유·썸네일 없음, 오리지널을 밀지 않음, 스트릭 정의 어긋남), (4) 로그인·기기 간 동기화·알림·이메일이 전무하다.
3. **코드로 확인한 모순 3개 (오너가 짚을 것)**
   - 오너 방향은 "오리지널이 정체성"인데 홈 PLAY NOW는 고정 10개(`HeroPlayButton.tsx` PICKS: solitaire·2048·flow·unblock·minesweeper·snake·tetris·mahjong·clusters·chess) 중 랜덤이다. 오리지널은 없다. 경쟁 포털이 차지한 클래식으로 첫 클릭을 보낸다.
   - 스트릭과 오늘 3판 퀘스트는 **게임 페이지를 열면 바로 올라간다**(`RecordPlay.tsx`가 마운트 시 `markPlayed`+`bumpStreak`). 한 판을 끝낸 것이 아니다. 그런데 `/daily` FAQ는 "Every daily solve extends your day streak"라고 쓴다. 실제는 '방문 스트릭'이다.
   - 게임 페이지의 "Go deeper"(공략 링크)는 리더보드·댓글·소개문 **뒤**에 있다(`GamePageLayout.tsx`). 공략은 유일한 차별 콘텐츠인데 게임→공략 길이 가장 깊다.

---

## 1. 연결고리 지도 (사용자 여정별)

'측정'은 AE로 진입 수를 읽을 수 있는가. 코드상 측정 가능한 이벤트는 `view·dwell·pageview·win·lose·draw·finish·reaction·lb_submit·lb_submit_overlay·spotlight_ics_click`뿐이다(`sendHit` 호출 전수 확인). 이벤트 이름은 Worker가 `slice(0,20)`만 하고 허용 목록이 없어(`worker/index.ts:352`) **새 이벤트는 서버 수정 없이 추가된다.**

### 1-1. 유입 → 첫 화면
| 연결 | 현재(코드 근거) | 상태 | 측정 |
|---|---|---|---|
| 검색 → 게임 페이지 | 게임 110개+JSON-LD+FAQ. SEO 조사상 경쟁어는 Poki·CrazyGames 우위, 오리지널 약 60개는 검색 수요 없음(backlog SEO) | 약함 | view, referrer |
| 검색 → 공략 | /guides 공략 16+기사 6, sitemap 포함. 공략 페이지 OG 이미지 없음(`guides/[slug]`에 opengraph-image 없음, backlog 소형) | 약함 | pageview |
| SNS → 랜딩 | Bluesky만 게시. Threads·X는 자격증명 없어 skipped(지표 파일). `?ref=`는 hit이 별도 필드로 기록 | 약함 | `?ref=bluesky`=4 |
| 공유·도전 링크 → 랜딩 | `/<slug>?vs=..&ref=share`. 도전 파서 9개 게임, 일일 공유 30개 게임 파일. 정적 export라 점수별 OG 불가 | 있음, 범위 좁음 | 도착은 ref=share로 가능, **공유 클릭(발신)은 미측정** |
| 허브(카테고리·컬렉션·리더보드) → 게임 | `thinPagesNoindex:true`라 noindex+sitemap 제외. 내부 링크 전용 | 검색 유입 0 | pageview |

### 1-2. 첫 화면 → 게임 선택 (홈, `page.tsx` 순서)
히어로(거의 한 화면, 게임 썸네일 0) → LatestRelease → 마퀴 → 탐색 칩 → Featured → TodayBoard → Achievements → MyGames → NewGames → RecentlyPlayed → GameBrowser → HomeAbout.
| 연결 | 현재 | 상태 | 측정 |
|---|---|---|---|
| 히어로 → 게임 | PLAY NOW = 고정 10개 랜덤(오리지널 없음) | 약함·방향 어긋남 | 없음 |
| 신작 → 홈 | LatestRelease: 커버 있는 최신 3개(커버 보유 게임은 gameMeta에서 5개뿐) | 있음, 좋음 | 없음 |
| 홈 → 데일리 | 탐색 칩 하나와 TodayBoard(스크롤 아래). 헤더 nav에는 Daily가 없고(Leaderboards·Guides·About) 푸터에만 있음 | 약함 | 없음 |
| 재방문자 이어하기 | RecentlyPlayed·MyGames·스트릭·퀘스트가 모두 Featured 아래. 첫 화면 개인화 0 | 약함 | 없음 |
| 검색·필터·랜덤 | GameBrowser, 페이지 맨 아래 | 있음, 깊음 | 없음 |
| 컬렉션·카테고리 | 칩, 푸터, 게임 페이지 CollectionLinks | 있음 | 없음 |
| 카드 클릭 | GameCard에 이벤트 없음 | 없음 | 홈→게임 전환은 pageview(home 70)→view(26)로 거칠게만(직접 유입 섞임, 추정) |

### 1-3. 게임 → 한 판 → 결과
| 연결 | 현재 | 상태 | 측정 |
|---|---|---|---|
| 목표 이해 | ObjectiveBanner 1줄 | 있음 | 없음 |
| 승·패 이유 | 게임별 상이. 공통 기반(`dailyResult`·`evaluateBest` 등)은 만들어지지 않음(renewal-queue 0) | 들쭉날쭉 | win/lose/finish |
| 신기록 제출 | 오버레이 1클릭/이름 입력(`OverlayScoreSubmit`), 리더보드 84개 게임 | 있음(11-17) | lb_submit_overlay=1 |
| 모바일 스크롤 | 37개 게임이 보드 안 터치 스크롤 불가(renewal-queue 0-0) | **끊김** | 없음 |

### 1-4. 결과 → 다음 행동 (가장 중요한 이탈 지점)
| 연결 | 현재(코드 근거) | 상태 | 측정 |
|---|---|---|---|
| 게임오버 '다음 게임' | `GameNav.tsx`: 오늘·최근 8개 제외 → 같은 카테고리 featured 우선 → 없으면 전체 featured(18개) → `run % pool.length` 회전. 제목 텍스트만, 이유·썸네일 없음, 오리지널·신작 가중 없음 | 있으나 약함 | **클릭 이벤트 없음** |
| NextUp 카드 | 같은 픽을 보드 아래 카드로(스크롤 필요) | 있음 | 없음 |
| 같은 장르 추천 | RelatedGames(카테고리 4개 안 목록순 6개), CollectionLinks. 카테고리가 Puzzle·Arcade·Classic·Skill 4개뿐이라 '같은 장르'가 넓다. 메커닉 태그 없음 | 약함 | 없음 |
| 일일 3판 진행도 | DailyDock(보드 아래). 게임오버 오버레이 안에는 없음(goal hint만) | 위치 약함 | 없음 |
| 리더보드 → 게임 | LeaderboardsHub가 게임으로 링크. 주간 보드 대부분 비어 있음(역대 2건) | 있으나 빈 보드 | pageview |
| 공유 | 일일 결과(30개 파일)·도전(9개). 2048·solitaire 같은 인기 게임은 공유 없음(추정, 공유 코드 미사용 확인) | 일부 | 없음 |
| 공략 → 게임 | 공략 하단 relatedGames 링크 | 있음 | pageview |
| 게임 → 공략 | "Go deeper"(하단 깊음, 공략 연결 게임 약 22개) | 약함 | 없음 |

### 1-5. 재방문
| 연결 | 현재 | 상태 |
|---|---|---|
| 스트릭·프리즈 | `site:streak` localStorage, 프리즈 최대 2 | 있음(정의 이슈) |
| 오늘의 픽·스포트라이트 | 날짜 시드, 예고+ICS(spotlight_ics_click 3) | 있음 |
| 업적 | 누진 티어, 게임오버 넛지. 진척 없으면 안 보임 | 있음, 신규에겐 안 보임 |
| PWA 설치 | manifest standalone만. 설치 안내·서비스 워커 없음 | 약함 |
| 알림·이메일·RSS | 코드에 serviceWorker·Notification·뉴스레터 없음 | **없음** |
| 로그인·프로필·동기화 | 없음. 익명 `vid`(localStorage UUID)만 있음(hit.ts) | **없음** |
| 기록 소실 | 전부 localStorage. 브라우저 변경·삭제 시 스트릭·최고기록 소실 | 위험 |

---

## 2. 레퍼런스 조사 (조사일 2026-11-17)

접근 못 한 곳: NYT Games 페이지 직접 접속(WebFetch 차단), IndieHackers 글(403). (공식)=운영사 문서, (2차)=기사·블로그·자가보고.

| # | 레퍼런스(종류) | 발견→플레이→재방문 설계 | 근거·사용자 반응 | 가져올 원리 | 베끼지 않을 것 |
|---|---|---|---|---|---|
| 1 | **Poki**(포털) | 신작은 출시 후 2~3주 카테고리·관련 게임·홈에 집중 노출, 이후 참여시간·플레이 전환이 좋은 게임이 추가 승격. 출시 뒤 콘텐츠 추가·버그 수정·썸네일·온보딩 개선이 승격 조건 ([post-release-updates](https://developers.poki.com/guide/post-release-updates), (공식)) | 개인화·다음 게임 추천 방식은 공개 자료 없음(확인 못 함) | 출시 후 2~3주 집중 노출 + 지표로 승격/강등 → 5장의 뼈대 | 외부 개발자 제출·수익 분배 |
| 2 | **CrazyGames**(포털) | 베이직 런치에서 플레이타임·D1 리텐션·전환·CTR로 풀 런치 결정. 강한 게임 벤치마크: 세션 10분+, D1 10~15%, 플레이 전환 80%+, 로딩 10초 이내 ([docs](https://docs.crazygames.com/resources/basic-launch-metrics/), (공식)) | 한 개발자 인터뷰는 "지표 미달이면 노출 없다"고 말함(2차, 비공식) | 게임별 승격 문턱을 숫자로. D1 10%가 현실 목표선 | 입점 심사 구조 |
| 3 | **itch.io**(인디 마켓) | 태그·잼·신작 목록(Most Recent→New & Popular)·직원 큐레이션. 한 개발자는 출시 순간 지인들에게 배너 클릭을 부탁해 New & Popular에 진입, 배너·썸네일·태그를 다듬고 대형 잼 기간을 피함. 한 달 노출은 대부분 직원 피처링 ([80.lv](https://80.lv/articles/how-this-indie-dev-kept-their-game-on-the-front-page-of-itch-for-an-entire-month), (2차)) | 한 개발자 사례, 일반화 금지. 같은 글에서 itch 세션은 1시간 이상, CrazyGames는 몇 분이라고 비교 | 출시 첫 24~48시간에 홍보·지인 푸시를 몰아넣기 | 직원 피처링 의존, 잼 마케팅 |
| 4 | **Wordle**(생태계) | 하루 한 판+이모지 격자 공유(스포일러 없음)+연속 기록. 공유가 성장 엔진이라는 분석 다수(2차). 정확한 사용자 수는 확인 못 함 | 도메인 이전 때 스트릭 초기화로 사용자 반발이 보도됨(Byteside·Gamesradar, 2차) | **기록은 사용자 자산.** 우리도 localStorage 소실 위험 → 기록 이전 수단(#9) | 모든 게임에 하루 한 판 제한 |
| 5 | **NYT Games**(사업화) | Wordle은 무료로 두고 유료 게임(Spelling Bee 등)으로 유도, 월 $5/연 $40. NYT는 "수천만 신규 사용자"와 게임 구독 순증 최고 분기를 보고(정확 수치 없음) ([TechCrunch 2022-05-04](https://techcrunch.com/2022/05/04/wordle-new-york-times-user-growth)) | 구독 전환 수치 글에 없음 | 무료 일일 게임이 상위 깔때기 → 우리 /daily | 유료 벽(ROADMAP: 경쟁 영향 판매 금지) |
| 6 | **GeoGuessr**(구독) | 2024-02-01부터 무료 상시 플레이를 닫고 Pro 유도(공식 FAQ). 일일 챌린지(같은 5라운드, 전역 순위)가 Wordle식 리텐션 장치라는 분석, 스트리머가 대중화(2차) ([FAQ](https://geoguessr.com/go-pro-to-continue-playing-geoguessr)) | 무료 종료에 대한 반응 수치는 확인 못 함 | 같은 시드 일일 챌린지+순위, 친구 파티 | 무료 기능 회수 |
| 7 | **Kongregate**(포털) | 2007 출시 때부터 사이트 공통 업적·배지, 레벨, 채팅, 랭킹, 댓글을 한 계정에 묶음 ([Engadget 2007](https://www.engadget.com/2007/06/29/kongregate-rolls-out-achievements-for-flash-games/), (2차)). UW 연구: 주 목표를 강화하는 보조 목표는 숙련자 장기 리텐션을 높임 | 소규모 사이트에서 채팅은 모더레이션 부담 | 사이트 전역 업적·배지가 게임 간 연결고리. 우리 Goals가 같은 방향이나 노출 약함 | 채팅·구독 |
| 8 | **개인 웹게임 사이트 포스트모템**(소규모) | 5개 언어를 동시에 출시했더니 스페인어권에서 먼저 성장, 최고 130K MAU → 안정 약 90K. canonical 오류 수정, 영문 홈 메타·카피 개선. AdSense는 실수 클릭으로 두 번 제한(CTR 2% 안전, 주말 3% 초과) ([dev.to](https://dev.to/yitao/post-mortem-how-my-web-game-hit-130k-mau-with-0-marketing-and-survived-an-adsense-ban-883), 자가 보고) | 교사·HR이 팀빌딩용으로 사용 | 언어 확장이 유입 레버가 될 수 있음(우리는 영어 단일), 광고는 조작 영역과 분리 | 무검증 대량 생성 |
| 9 | **Roblox 발견**(다른 장르, 참고) | 추천 신호를 7일에서 28일 리텐션 기반으로 확장 ([Roblox 2026-06](https://about.roblox.com/newsroom/2026/06/optimizing-discovery-great-games-reach-millions-players-roblox)) | 웹 미니게임과 직접 비교는 부적절 | 초기 트래픽이 아니라 재방문을 보상 | - |

**소규모 사이트 성장 요약(근거 한계):** (a) 경쟁어 대신 직접 만든 데이터·공략(우리 backlog와 일치), (b) 첫 24~48시간 몰아넣기(#3), (c) 틈새 언어·지역(#8), (d) 하루 한 번 돌아올 이유+공유 결과(#4), (e) 노출은 지표로 승격/강등(#1·#2). 어느 것도 "연결고리만 고치면 트래픽이 생긴다"는 근거는 아니다.

---

## 3. 7가지 사용자 질문 (사이트 레벨)

1. **처음 온 사람이 이해하나?** 반쯤. 히어로는 "INSERT COIN / FREE ONLINE MINI GAMES / PLAY INSTANTLY FREE"로 '무료 게임 모음'만 전한다. 썸네일 0개, 이 사이트만의 이유 없음(11-13 실사이트 확인, above-the-fold.md). 게임 페이지는 목표 1줄로 잘 이해된다.
2. **왜 계속 하나?** 약하다. 스트릭·퀘스트·업적·RUN 카운터는 있으나 localStorage이고 눈에 띄는 위치가 아니다. 신규는 스트릭 0, 업적은 '진척 없으면 안 보임'이라 첫 방문엔 보상이 안 보인다. 점수 등록 7일 1건이 증거.
3. **왜 졌나?** 게임마다 다르다. 공통 기반이 없어 패배 이유 표시가 들쭉날쭉하다. 사이트 레벨에서는 오버레이에 "다음 게임"은 있으나 이유 문구가 없다.
4. **어떻게 쓰나?** 목표 배너+howToPlay(하단). 모바일에서 37개 게임이 보드 안에서 페이지 스크롤이 안 되는 문제가 사이트 레벨의 가장 큰 사용성 결함이다(공략·리더보드·댓글로 내려갈 수가 없어 모든 연결이 끊긴다).
5. **왜 공유하나?** 공유 대상 게임이 일부(일일 30·도전 9)뿐이고 공유는 이모지 텍스트다. 링크 미리보기는 공통 OG다. 사이트 전체가 '내 결과 한 장'을 못 준다.
6. **왜 우리 사이트?** 지금은 답이 없다. 클래식은 포털이 더 빠르다. 이유는 오리지널+데이터 공략인데 홈 첫 화면과 PLAY NOW가 그것을 말하지 않는다.
7. **오너가 지적할 것(예상):** (a) PLAY NOW가 클래식으로 간다 (b) 스트릭이 방문 기준이다 (c) Threads·X skipped (d) 리더보드가 비어 고장처럼 보인다 (e) 연결 개선이 측정 없이 진행될 위험(7일 view 26으로는 판정 불가).

---

## 4. 개선안 로드맵 (약한 연결 상위 10개, 영향×비용 순)

일정은 모두 [추정]. 영향 H/M, 비용 S(≤0.5일)/M(1일)/L(2일).

| 순위 | 영향×비용 | 항목 |
|---|---|---|
| 1 | H×S | 연결 이벤트 계측 |
| 2 | H×S | PLAY NOW·첫 클릭을 오리지널/오늘 데일리로 + 계측 |
| 3 | H×M | 게임오버 '다음 게임' 개선 |
| 4 | H×M | 개인 기록 패널 + 스트릭 정의 정리 |
| 5 | M×S | 공략 링크 상향 + 공략→게임 CTA + 공략 OG |
| 6 | M×M | /daily 허브 강화 |
| 7 | M×M | 신작·리뉴얼 알림 띠 + 업데이트 배지 |
| 8 | M×S | RSS 피드 + PWA 설치 안내 |
| 9 | M×M | 기록 이전 코드 + 익명 ID 동기화 설계 |
| 10 | M×L | 공유 결과 이미지(Canvas)와 공유 확대 |

### #1 연결 이벤트 계측
- 무엇을: `next_click`(오버레이 버튼)·`nextup_click`·`card_latest`/`card_feat`/`card_today`/`card_recent`(홈 카드, slug=게임)·`hero_play`·`daily_chip`·`guide_click`·`coll_click`·`share_click`·`random_click`·`search_use`. 도착은 기존 `ref=share`·`?ref=` 활용. 이름 20자 이내.
- 왜: 지금은 연결 대부분이 측정 0이다. 계측 없는 실험은 판정 불가(OPERATING 3장).
- 코드: `GameOverlay.tsx`(nextSlug 링크), `NextUp.tsx`, `GameCard.tsx`(위치 prop), `HeroPlayButton.tsx`, `page.tsx` 칩, `GamePageLayout.tsx` 공략 링크. `lib/hit.ts`는 변경 불필요. 지표 수집 스크립트가 새 이벤트를 자동 나열하는지 확인 필요(추정: 자동).
- 일정: 0.5일. 위험: 이름 잘림, 카드 시그니처 변경에 따른 테스트 수정.

### #2 PLAY NOW와 첫 클릭 방향 교정
- 무엇을: PICKS를 '오리지널 대표(임시 선정)+오늘의 데일리'로 교체, 기본 `href`도 같은 곳, 라벨 구체화. 대표 3종은 11-24 회고 확정 전에는 품질 6축 상위 오리지널로 임시.
- 왜: 오너 방향 5장(오리지널 정체성)과 현 코드 모순.
- 코드: `HeroPlayButton.tsx`, 감사 문서·renewal-queue.
- 이벤트: `hero_play`.
- 일정: 0.5일. 위험: 11-19 첫 화면 실험과 겹침(한 번에 실험 1개) → 같은 PR로 병합하거나 그 이후.

### #3 게임오버 '다음 게임' 개선
- 무엇을: (a) 버튼에 아이콘/썸네일+한 줄 이유 (b) 선택지 2개: '같은 장르' 1·'색다른 것' 1(오리지널 우선) (c) 추천 풀 가중치: 오리지널·신작·완주율 높은 게임↑, 클래식↓ (d) NextUp과 중복 정리. 이유 문구는 gameMeta에 `blurb`/`like:[slug]` 필드로 큐레이션(대표 오리지널 3종부터).
- 왜: 게임오버는 사용자가 멈추는 유일한 지점. 현재는 featured 18개 안 회전뿐이고 이유가 없다.
- 코드: `GameNav.tsx`, `GameOverlay.tsx`, `NextUp.tsx`, `gameMeta.ts`, `GameOverlay.test.tsx`.
- 이벤트: `next_a`·`next_b`, 같은 방문 2판 이상 비율은 vid로 계산.
- 일정: 1일. 위험: 큐레이션 노력(110개), 모바일 390px에서 오버레이가 커져 보드를 가림(캡처 확인).

### #4 개인 기록 패널 + 스트릭 정의 정리
- 무엇을: 재방문자(localStorage 기록 있음)에게만 홈 최상단 1줄: "🔥 N일 · 오늘 k/3 · 이어하기: 최근 게임". 스트릭·퀘스트 증가 시점을 페이지 열기에서 **첫 완료**로 변경(또는 문구를 '방문 스트릭'으로 수정, 0.5일 대안). 권장은 완료 기준.
- 왜: 정의 불일치(0장). 방문만으로 오르는 스트릭은 보상이 아니라 장식이다. 완료 기준이면 첫 판 이탈 지표와 연결된다.
- 코드: `RecordPlay.tsx`(markPlayed/bumpStreak 이동), `gameStats.ts`(82·92행 완료 훅), `TodayBoard.tsx`, `DailyDock.tsx`, `today.ts`, `/daily` FAQ, `dailyStreak.test.ts`·`DailyDock.test.tsx`.
- 이벤트: `streak_s3`·`streak_s7`, `resume_click`.
- 일정: 1~2일. 위험: 기존 연속 기록이 끊길 수 있음(전환일 면제), 완료 이벤트를 안 내는 게임 점검(recordFinish류 사용 파일 109/111, 2개 미확인).

### #5 공략 링크 상향 + 양방향 + 공략 OG
- 무엇을: (a) "Go deeper"를 GameStats 아래(NextUp 앞)로, 공략 있는 게임은 보드 아래 한 줄 칩 (b) 공략 상단 "Play it now" (c) 공략 22개 정적 OG(`[slug]/opengraph-image.tsx` 패턴).
- 왜: 공략은 데이터 콘텐츠이자 검색 축인데 연결이 묻혀 있고 공유 미리보기가 비어 있다.
- 코드: `GamePageLayout.tsx`, `guides/[slug]/page.tsx`, 새 `guides/[slug]/opengraph-image.tsx`.
- 이벤트: `guide_click`, `guide_play`.
- 일정: 1일. 위험: AdSense 심사 중 구조 변경(필수 페이지·푸터 제외), 빌드 시간.

### #6 /daily 허브 강화
- 무엇을: 카드에 "오늘 완료 ✓", 상단에 오늘 k/3·스트릭, '아직 안 한 것으로 바로 시작' 버튼, 헤더 nav에 Daily 링크. 현재는 카운트다운+정적 카드(`daily/page.tsx`)뿐이다.
- 왜: 홈에 데일리 진입이 약해 허브가 유일한 일일 진입인데 상태를 모른다. 이 페이지는 sitemap 포함 색인 대상이기도 하다.
- 코드: `daily/page.tsx`(클라이언트 아일랜드), 새 `DailyHubProgress.tsx`, `today.ts`·`dailyStreak.ts`, `layout.tsx` 헤더.
- 이벤트: `daily_enter`.
- 일정: 1일. 위험: 완료 기준은 #4에 의존.

### #7 신작·리뉴얼 알림 띠 + 업데이트 배지
- 무엇을: gameMeta에 `updated:{date,note}` → 게임 페이지 보드 위 얇은 띠(14일), 홈 LatestRelease 아래 '최근 리뉴얼' 1줄, `/whats-new` 변경 이력 페이지(편집 콘텐츠로 색인 허용).
- 왜: 오너가 "출시한 게임도 계속 리뉴얼"을 요구하는데 리뉴얼을 사용자에게 알릴 경로가 없다. NewGames는 21일 신작 윈도우(`newGames.ts`)라 리뉴얼이 안 걸린다.
- 코드: `gameMeta.ts`, `GamePageLayout.tsx`, `LatestRelease.tsx` 인접, 새 `app/whats-new/page.tsx`, sitemap.
- 이벤트: `upd_click`.
- 일정: 1일. 위험: 거짓 리뉴얼 표시 방지(PR 연결 항목만).

### #8 RSS 피드 + PWA 설치 안내
- 무엇을: 정적 `/feed.xml`(신작·공략·리뉴얼), 게임 3판 완료 사용자에게 `beforeinstallprompt` 배너 1회(닫으면 14일 숨김).
- 왜: 이메일·로그인 없이 재방문 채널을 여는 가장 싸고 법적 부담 없는 방법.
- 코드: `output:'export'` 호환 정적 라우트(`force-static`), `layout.tsx` head, 새 `InstallHint.tsx`.
- 이벤트: `install_prompt`, `install_ok`.
- 일정: 0.5~1일. 위험: iOS Safari는 `beforeinstallprompt` 미지원, 효과 미미할 수 있음(저비용 시도).

### #9 기록 이전 코드 + 익명 ID 동기화 설계
- 무엇을: (1단계) "내 기록 내보내기/가져오기": `best:*`·`stats:*`·`site:streak`·`played:all` 등을 문자열 코드로 복사. (2단계, 설계만) ROADMAP 단계 2 조건(주간 활성 300 또는 제출 주 50) 충족 시를 위한 D1 `profile(vid, blob, updated_at)`·API 경계·장애 시 로컬 폴백 설계와 DECISIONS 기록. 개인정보 처리방침에 익명 ID 항목 갱신 필요(법 검토 미확인).
- 왜: Wordle 스트릭 소실 반발(#4)과 같은 위험. 계정 도입 전 신뢰 확보, ROADMAP 단계 2·3 준비.
- 코드: 새 `lib/profileExport.ts`, 설정 UI(위치 결정 필요), `db/schema.sql`(설계만).
- 이벤트: `export_code`, `import_code`.
- 일정: 1단계 1일, 설계 0.5일. 위험: 키가 게임마다 흩어져 누락(키 전수 점검 테스트), 코드 길이.

### #10 공유 결과 이미지 + 공유 확대
- 무엇을: 정적 사이트라 점수별 OG는 불가(`output:'export'`, `[slug]/opengraph-image.tsx` 주석)이므로 **클라이언트 Canvas로 결과 카드 PNG 생성** → Web Share(파일)/다운로드. 대상은 대표 오리지널과 2048 등 인기 게임. 공유 URL 형식(`?ref=share`)은 변경 금지 규칙에 맞춰 유지.
- 왜: 공유 가능 게임이 일부뿐이고 대표 게임이 빠졌다. Wordle 사례에서 공유가 성장 엔진.
- 코드: `lib/dailyShare.ts`·`DailyShareButton.tsx` 확장, 새 `lib/shareCard.ts`, 대표 게임 컴포넌트.
- 이벤트: `share_click`, 도착은 `ref=share` view.
- 일정: 2일. 위험: 모바일 Web Share 파일 지원 차이, 모바일 스크롤 수정 작업(renewal-queue 0-0)과 파일 충돌.

### 보류: 뉴스레터/이메일 구독
지금은 하지 않는다. 개인정보 처리방침·이용약관 갱신, 수신 동의(한국 정보통신망법·GDPR 해당 여부는 확인 못 함, 법률 검토 필요), 이중 확인 메일 인프라가 필요한데 현재 규모(7일 view 26)에서는 구독자가 사실상 0이다. 조건: D1 재방문 ≥ 10% 또는 주간 view ≥ 300. 그 전엔 RSS(#8)로 대신한다.

### 유입 병행 과제 (연결이 아니지만 선결)
- Threads·X 게시 skipped(자격증명): 오너 할 일. 풀리지 않으면 개선의 효과를 볼 사람이 없다.
- 신작 공개일에 Bluesky·Threads·지인 푸시를 같은 날 몰아넣기(레퍼런스 #3).
- 다국어 가능성(레퍼런스 #8, 근거 약함): 시간과 AdSense 영향 확인 후 판단.

---

## 5. 출시한 게임의 성장 체계

### 5-1. 체크리스트 (신작 출시일 D0 기준)
| 시점 | 업그레이드 | 담당 | 증거 |
|---|---|---|---|
| D0 | 커버·공략 1편·공유 카드·도전/일일 연결 여부·홍보 큐(Bluesky·Threads)·`finish` 이벤트 확인 | 게임 디자이너+개발+마케터 | 머지, 홈 LatestRelease 노출, 큐 |
| D1~D2 | 첫 24~48시간 몰아넣기(홍보·지인), 첫 판 이탈률·완주율 첫 확인 | 마케터+그로스 | 지표 파일 `finish`·`view` |
| D7 | 1차 판정(5-2). 첫 판 이탈 구간 수정(온보딩·난이도), 첫 업데이트: 난이도 곡선·튜토리얼 문구·버그 | 게임 디자이너+플레이테스터 | PR+회귀 테스트, 업데이트 띠(#7) |
| D14 | 요소 추가 1개(모드·스테이지·꾸미기 해금 화면 계측 겸용), 리더보드·도전 링크 확인, 공략 2번째 글 또는 제작기, 2차 홍보 | 게임 디자이너+개발+마케터 | PR, 홍보 큐 |
| D30 | 키울지/리뉴얼/격하 최종 판정. 승격이면 홈 Featured·PLAY NOW 후보, 데이터 공략(시뮬) 추가 | 그로스+오너 확인 | 회고, DECISIONS |

Poki 사례(#1)의 '출시 후 2~3주 집중 노출'에 맞춰 D0~D21은 홈 노출을 유지한다(`NEW_WINDOW_DAYS=21`, 이미 구현).

### 5-2. 판정 지표와 기준 (제안, [추정])
CrazyGames 벤치마크(공식: D1 10~15%, 전환 80%+)를 참고했다. 우리 표본이 작으므로 **게임당 view 30 이상일 때만 숫자로 판정**하고 미만이면 '유입 부족'으로 기록해 홍보를 먼저 늘린다.
| 지표 | 읽는 곳 | 좋음 | 나쁨 |
|---|---|---|---|
| 완주율 = (win+lose+draw+finish)/view | AE | ≥ 60% | < 30% |
| 재방문 D1 | vid distinct day (지표 스크립트에 계산 추가 필요) | ≥ 10% | < 3% |
| 같은 방문 두 번째 판 전환 | vid 세션 | ≥ 35% | < 15% |
| 판당 체류 | dwell | 목표 설정 필요(추정: 90초+) | < 20초 |
| 리더보드·공유 참여 | lb_submit·share_click | 게임당 주 3건 | 0건 |
판정:
- **키운다**: 완주율 ≥ 60% 그리고 (D1 ≥ 10% 또는 두 번째 판 전환 ≥ 35%). 홈 Featured·PLAY NOW 후보, 공략·제작기 추가.
- **리뉴얼**: 완주율 또는 D1이 낮고 이탈 구간이 코드·플레이테스트로 특정될 때. renewal-queue에 올려 1~2일 사이클 1회. 두 번째 판정에서도 미달이면 격하.
- **격하**: 리뉴얼 1회 후에도 미달, 또는 유입이 있는데 완주율 < 30%. 홈 노출 제거·추천 풀 제외, sitemap은 유지. **내리기(URL 삭제·비공개)는 오너 확인 후**(OPERATING 3-1 축 C).
- 판정 시점은 D7(진단)·D30(최종). D7에 '유입 부족'으로 판정 불가인 것은 정상 결과로 인정한다.

### 5-3. 담당 규칙
- 그로스: 월요일 회고에서 게임별 지표 표 갱신, 판정 후보 제시.
- 게임 디자이너: D7 수정안, D14 요소 추가안.
- 플레이테스터: D7 전에 첫 판 이탈 가설을 시뮬·직접 플레이로 검증.
- 마케터: D0~D2 홍보, D14 2차 홍보.
- 리뷰어(작성자≠검토자): 키움·격하 근거 숫자 확인.
- 결과는 `docs/team/direction.md`에 한 줄, 격하·내리기는 DECISIONS.md.

---

## 6. 오늘 당장 할 수 있는 작은 연결 개선 3개

별개 PR로 낼 수 있고 파일 충돌이 거의 없다. 검증은 typecheck·lint·관련 vitest·build·check-routes를 돌려 결과를 PR에 붙인다(여기서는 실행하지 않았다).

### A. 다음 게임·카드 클릭 계측 (#1 일부)
- 파일: `src/components/game-shell/GameOverlay.tsx`(`overlay-next-game` Link에 `onClick={() => sendHit(nav.slug,'next_click')}`), `src/components/NextUp.tsx`(`nextup_click`), `src/components/HeroPlayButton.tsx`(`hero_play`), `src/app/page.tsx` 칩(서버 컴포넌트라 클라이언트용 `TrackedLink` 작은 컴포넌트 신설).
- 변경: `sendHit` import, `TrackedLink`(onClick에서 sendHit, 새 탭·보조 클릭 기본 동작 유지).
- 검증: `GameOverlay.test.tsx`에서 `sendHit` 목으로 클릭 시 호출 확인(`OverlayScoreSubmit.test.tsx` 방식 참고), 이벤트 이름 20자 이하 테스트.
- 기대: 다음 날 지표 파일에서 `next_click`·`hero_play`를 읽을 수 있다. 목적은 숫자 변화가 아니라 측정 장치 확보.

### B. PLAY NOW를 오리지널로 (#2 일부)
- 파일: `src/components/HeroPlayButton.tsx`.
- 변경: PICKS를 오리지널 상위 3~5개로(오너 방향 5장 목록 Recoil·Lagline·Hunch·FizzBeat·Unblock·Umbra·Bisect 중 감사 점수 확인 후 확정 필요), 기본 `href` 동일, 클릭 시 `sendHit(slug,'hero_play')`.
- 검증: PICKS의 모든 slug이 레지스트리에 있는지 단위 테스트 1개, `e2e/`에 관련 스펙이 있는지 확인 후 갱신.
- 주의: 11-19 첫 화면 개편 실험과 같은 영역. 그 전에 하지 않거나 같은 실험 일부로 병합(OPERATING 3장).

### C. 'Go deeper' 위치 상향 + 헤더 Daily 링크
- 파일: `src/components/GamePageLayout.tsx`(섹션을 GameStats 아래·NextUp 앞으로, 공략이 있을 때만), `src/app/layout.tsx`(헤더 nav에 `/daily`).
- 변경: JSX 블록 이동, 링크 1개, `data-testid="game-guides"` 유지(e2e 보호), 클릭에 `guide_click`.
- 검증: 390px 캡처로 헤더 줄바꿈·보드 위 영역 변화 없음 확인, 관련 테스트·`check-routes`, 필수 페이지·푸터 미변경을 diff로 확인.
- 기대: 공략 pageview·`guide_click` 증가(추정).

---

## 7. 팀 세션(06·10·13·16·20시)의 담당 제안

OPERATING 3-1의 축 B(사이트 성장)를 '연결 개선 #1~#10'으로 구체화한다. 각 세션의 현재 구성(SESSION-GUIDE.md)은 읽지 않았으므로 기존 배정과 충돌하면 조정이 필요하다.

| 시각 | 역할 | 연결 개선 담당 |
|---|---|---|
| 06시 회의 | PM·그로스·QA | 어제 연결 이벤트(`next_click`·`hero_play`·`guide_click`·`daily_enter`)를 지표에서 읽고 깔때기 한 줄을 회의록 맨 위에. 오늘 축 B 소형 1개를 순위대로 지정. 표본 부족이면 '유입 부족'으로 기록하고 마케팅 항목 추가 |
| 10시 | 개발 | 축 B 항목 구현+회귀 테스트, 계측은 같은 PR에 |
| 13시 | QA·플레이테스터 | 모바일 390px에서 연결 경로(게임오버→다음→홈→데일리) 직접 클릭 점검, 끊김은 백로그로 |
| 16시 | 리뷰어(작성자≠검토자) | 놓침·부족·과함 검토, 스트릭·추천처럼 숫자가 걸린 항목은 근거 재확인 |
| 20시 | 마케터·그로스 | 신작·리뉴얼·공략을 SNS 큐에(`?ref=` 채널별 태그로 도착 측정), 다음 06시용 한 줄 메모 |

- 월요일 회고: 5-2 표로 게임 판정, 효과 없는 연결 개선은 버린다(GROWTH 실험 규칙).
- 주간 목표 숫자 후보(OPERATING 0-1): `next_click` 수 또는 '같은 방문 2판 이상 비율'. 유입이 0에 가까운 동안은 `?ref=` 유입 수를 병행.
- 11-19(목) 큰 기능은 첫 화면 개편(실험 1)에 #2·#4·#6의 홈 부분을 한 실험으로 묶는 것을 제안(한 번에 실험 1개 규칙 때문에 따로 하면 7일씩 밀린다).
- 의존 순서: #1 → #2 → #3 → #4 → #6(#4 의존) → #5 → #7 → #8 → #9 → #10.

---

## 8. 한계와 확인 필요

- 사이트를 실제로 열어 플레이하지 않았다. 코드·문서·지표 파일에 근거한 진단이다.
- 지표(7일 view 26 등)에는 봇·오너 테스트가 섞였을 수 있다.
- Wordle 성장 요인, GeoGuessr 스트리머 효과, itch.io 피처링은 2차 자료이며 수치 검증이 안 됐다. NYT Games 사이트와 IndieHackers 글은 접근하지 못했다.
- 법적 사항(뉴스레터 동의, 익명 ID 보관)은 검토하지 않았다.
- 모든 일정은 추정이다. 공유 코드 유무(2048 등 인기 게임)와 완료 이벤트 미사용 2개 게임은 코드로 끝까지 확인하지 못했다.
