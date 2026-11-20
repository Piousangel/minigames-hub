# 밖에서 보이는 정원 — 공유 카드·검색 제목·사이트 이름·아이콘 (2026-11-20 16시, 축 B)

라운드: **리서치 1 ✅ · 기획 v1 ✅ · 리서치 2(반증) ✅ · 기획 v2 ✅ · 구현 ✅ · 독립 리뷰 ✅(응답 6장)**.
배정 변경: 06시 회의가 16시에 준 R6 마스코트는 07시 교대가 이미 머지(#191)했다 → 16시는 ROADMAP '사이트 성장 축'에서 SEO·첫 인상을 골랐다(팀 결정, 오너에게 묻지 않음).

## 0. 왜 이것인가 (발견)
빌드 산출물 전수 감사(`out/` 167쪽, 색인 대상 142쪽)와 390px 걷기에서:
1. **공유 미리보기(OG)가 전부 옛 네온 카드** — 홈 + 113게임. 사이트는 11-19~20 리디자인으로 크림 정원인데, Threads·Bluesky·카톡에서 링크를 처음 보는 사람(유입 1위 경로 `?ref=threads`)은 검은 네온 카드를 본다. 들어오기 전과 후가 다른 사이트.
2. **28쪽이 og:image 자체가 없음** — 가이드 22편·daily·about·contact·privacy·terms·guides 목록. 페이지가 `metadata.openGraph`를 직접 주면 Next가 루트 `opengraph-image`를 물려주지 않는다. about 등은 `og:site_name`도 빠짐.
3. **홈 `<title>` = "Quick MiniGames"(브랜드만)** — 이력 내내. 홈 JSON-LD 0개.
4. **about·contact·privacy·terms·홈 5쪽이 같은 description**(siteConfig 기본값).
5. 파비콘·PWA·애플 아이콘·`theme-color`·manifest 색이 네온(#08080f) — 검색 결과 사이트 이름 옆 아이콘과 모바일 주소창이 네온.

## 1. 리서치 1 (서브에이전트, WebSearch — developers.google.com·poki.com 등 WebFetch 접근 불가, 스니펫 기준)
- title link: Google은 `<title>`·h1 등을 섞어 고른다. 재작성 비율 Google 발표 13%(2021-09) vs 실측 33~76%(Ahrefs 2021, Zyppy 2022–23, SEL 2025). 2026-03 AI 제목 재작성 소규모 테스트(9to5Google 2026-03-21). 길이 제한은 없고 폭에서 잘림.
- 사이트 이름: 홈에만 WebSite(name·url·alternateName). og:site_name·title·헤더와 같은 이름이어야. 사이트링크 검색창은 2024-11-21 폐지 → SearchAction 넣지 않음.
- 경쟁 홈 제목(대부분 추정): CrazyGames "Free Online Games on CrazyGames | Play Now!"(스니펫), Poki·Y8·Coolmath는 "브랜드 + Free Online Games".
- Organization logo: 작은 사이트엔 효과 낮음(Search Central 2023-11-29) → 이번엔 안 함.
- 중복 description: 순위 페널티 근거 없음, 스니펫 60~70% 재작성(Ahrefs 2020·Portent). 그래도 쪽마다 고유 권장.

## 2. 기획 v1
P1 OG 정원 카드(홈 = 키아트 + 왼쪽 문구, 게임 = 크림 종이 + 왼쪽 꽃색 아이콘 칸 + 제목 + 설명 한 줄 + 마스코트, 표지 있는 6종 = 표지 + 크림 띠) · P2 홈 title 브랜드 앞 + WebSite JSON-LD · P3 theme-color·manifest 크림 · P4 정책 4쪽 고유 description · P5 CI SEO 게이트.

## 3. 리서치 2 (반증, 서브에이전트) — 바뀐 것
| 반증 | 근거 | v2 |
|---|---|---|
| 작은 썸네일(Threads·iMessage·Slack)은 가운데 정사각으로 자르고 작은 글씨는 안 읽힌다 | wisechecker(추정), X 카드 가운데 크롭(dev.twitter.com) | 게임 카드 **가운데 정렬**(아이콘·제목이 가운데 630px 안), **설명 한 줄 삭제**, 제목 최소 72px |
| 일러스트 깐 PNG는 수백 KB~1MB, Bluesky 썸네일 blob 약 1MB(추정) | atproto #1740 | 빌드 뒤 **팔레트 PNG 압축**(`scripts/og-compress.mjs`): 114장 12.0MB → 3.0MB, 최대 188KB(홈). 400KB 넘으면 빌드 실패 |
| 브랜드 검색이 없는 새 사이트는 키워드 먼저가 낫다, Google은 브랜드를 가장 자주 떼어 낸다 | SEJ(재작성 63%가 브랜드 제거) | 홈 title **키워드 먼저**: "Free Online Mini Games — 100+ Games, No Download \| Quick MiniGames"(게임 페이지 템플릿과 같은 순서). 잘려도 사이트 이름 줄이 따로 보인다 |
| openGraph를 덮는 쪽은 og:image가 없을 수 있다 | 리서치 2 추정 → **실측 28쪽 확인** | `ogImage()` 헬퍼로 명시, 가이드는 다루는 게임 카드 |
| iOS 26 Safari는 theme-color를 무시하고 배경색을 쓴다 | Apple 포럼 801239, WebKit 301756 | theme-color는 Android Chrome·PWA 몫으로만 기대. body 배경 크림화는 범위 밖(R7f 열린 PR과 겹침) |
| 이미 올린 Bluesky·Threads 게시물 썸네일은 안 바뀐다, 카톡은 서버 캐시 | Bluesky 레코드 구조(추정), Kakao FAQ | 새 게시물부터 효과. **카톡 캐시 초기화는 오너 몫**(개발자 콘솔, 아래 7장) |
| 일러스트 OG가 CTR을 올린다는 근거 없음 | 엄밀한 연구 없음 | 효과 주장 안 함 — **일관성(밖과 안이 같은 사이트)** 이 목적. 판정은 7장 측정 |

## 4. 기획 v2 = 구현
- `src/lib/og/gardenCard.tsx`: HomeCard(키아트 `hub-og-bg` + "Free online / mini games" + "A small garden that blooms daily." + `N games · no download · no sign-up`), GameCard(노을 띠 → 크림 종이, 카테고리 꽃색 아이콘 칸 216px, 카테고리 줄, Fraunces 제목, 바닥 크림 띠 + 헤더 로고 마크, 카테고리 마스코트 1마리 — D5·D6), 표지 6종 CoverGameCard. 색은 globals.css 토큰 리터럴(테스트가 대조).
- Satori 제약: webp 불가(실측 "u2 is not iterable"), woff2·가변 축 불가 → `src/lib/og/assets/`에 JPEG·PNG·정적 TTF 사본(합계 약 440KB, 빌드 전용, README에 재생성법).
- `scripts/og-compress.mjs`(build에 연결, sharp devDependency 0.34.5 — 이미 lockfile에 있던 버전).
- 홈: title·og/twitter title·og:site_name·WebSite JSON-LD(name, alternateName "QuickMiniGames", url, description, inLanguage).
- about·contact·privacy·terms 고유 description + og:site_name + 카드. daily·guides·guides/*·category·collection(s)·unblocked·leaderboards 카드 명시.
- 아이콘: `GardenLogoMark`(헤더 로고)로 favicon(96, 86% 채움)·apple(180)·PWA(192/512, maskable 64%)·favicon.ico(16/32/48). theme-color·manifest `#fff3dc`.
- `scripts/check-seo.mjs` + ci.yml: 색인 대상 쪽마다 title(브랜드만·중복 금지)·description(중복 금지)·canonical(자기 경로)·h1 1개·JSON-LD 파싱·og:image·og:site_name, 홈 WebSite 1개. **수정 전 빌드에 돌리면 28+α건 실패**(오답을 떨어뜨리는 검사).

## 5. 사용자 질문
1. **처음 온 사람**: Threads에서 링크를 보면 이제 사이트와 같은 크림·마스코트 카드 → 눌러 들어왔을 때 "같은 곳"이라 3초 안에 안심. 근거: 전후 캡처(`docs/design/share-preview/`).
2. **왜 계속 하나**: 이 출시는 재방문 이유가 아니다. 다만 홈 화면에 추가한 사람의 아이콘이 사이트와 같아져 다시 찾기 쉬움(PWA 아이콘).
3. **왜 못 하나**: 해당 없음(게임 화면 무변경).
4. **어떻게 쓰나**: 작은 썸네일 — 제목 ≥72px, 가운데 정렬, 작은 글씨 제거. 16px 파비콘 — 로고 86% 채움. 광고 위치 무변경.
5. **왜 공유하나**: 공유하는 사람의 타임라인에 네온 대신 정원 카드가 붙는다 — 공유가 "부끄럽지 않은" 모양. 효과 수치는 없음(리서치 2).
6. **우리 사이트에서 왜**: 포털 카드는 대개 게임 스크린샷. 우리는 카테고리 마스코트 + 꽃색으로 113개가 한 세계로 보인다(Chrome Music Lab식 같은 언어, 개념서 19번).
7. **오너가 볼 때**: 예상 지적 "아이콘 칸이 단조롭다(113개가 아이콘만 다름)" → 맞다. 게임별 그림은 그림 예산 문제라 다음 단계(대표 클래식 10개 스크린샷 카드 후보, 7장).

## 6. 독립 리뷰 응답
독립 리뷰(서브에이전트, diff·out/ 실측) **7/10**. 지적 전부 응답:
| # | 지적 | 응답 |
|---|---|---|
| must 1 | 홈만 `twitter:card=summary`(페이지 twitter 객체가 card를 덮음) → X에서 작은 정사각 | **수용**: `card: 'summary_large_image'` |
| should 2 | check-seo가 1번·없는 카드 파일을 못 잡음 | **수용**: twitter:card 큰 카드, og:image 파일 존재(쿼리 제거) 검사 추가 |
| should 3 | deploy에 check-seo 없음(CI 빨강이 main에 들어오면 그대로 배포) | **수용**: `pnpm build && check-routes && check-seo && wrangler deploy` |
| should 4 | 표지 6종·홈이 정사각 크롭에서 잘림("Hop", "Qui") | **표지 수용**: 띠를 가운데(270~930px)로, 브랜드는 왼쪽 위 pill(잘려도 되는 장식). **홈은 거부(기록)**: 키아트 구도가 오른쪽 섬 + 왼쪽 문구라 가운데로 옮기면 그림을 가린다. 홈 링크 공유는 게임 링크보다 적다(유입 상위가 게임 경로) |
| should 5 | 21자 이상 제목이 크롭 밖·3줄 | **수용**: 21자+는 62px, 테스트가 72px 하한을 걸어 그런 제목이 생기면 실패 → 그때 카드를 다시 본다 |
| nit | ogImage URL에 버전 없음·alt가 홈 문구 | **수용**: `?v=g1`, 게임 제목 alt |
| nit | 아케이드에 "new puzzle daily" | **수용**: "daily challenge" |
| nit | themeColor 크림인데 `colorScheme: 'dark'`·`black-translucent` | **보류(기록)**: color-scheme은 전역(아직 네온인 R7f 12게임·폼 컨트롤)에 걸려 R7f 머지 뒤 한 번에. iOS 26은 theme-color를 안 씀 |
| nit | h1=1 규칙 오탐 가능 | **유지**: 지금 142쪽 모두 1개. 생기면 그 쪽만 예외 목록 |

**검사 증거**: 수정 전 main(63fa1be) 빌드에 `check-seo` → **36건 실패**(가이드 22편 og:image 없음, 정책 4쪽 og:image·site_name, 5쪽 description 중복, 홈 브랜드만 title·WebSite 0). 수정 후 0건. vitest 253파일 5,107 통과, lint error 0, e2e smoke+mascots 통과.

## 7. 남은 것·측정
- **오너 몫(사람 손)**: 카카오 개발자 콘솔 [도구 > 카카오톡 URL 메타데이터 관리]에서 홈·상위 게임 캐시 초기화(선택). Search Console에서 홈 URL 검사 → 색인 재요청(선택).
- 측정: Search Console 홈 노출·클릭(접근 가능 시), `?ref=threads`·`bluesky` 유입 view 2주 전후(11-20 기준 7일 threads 26·bluesky 6). n<30이면 판정 보류.
- 다음 후보: 대표 클래식 10개는 실제 판 스크린샷 카드, 가이드 전용 카드, Organization 마크업(효과 낮음), iOS 26 대응 body 배경(R7f 뒤).
