# 인계: AdSense 승인받아 광고를 켜고, 게임 라운드를 계속 돌린다

> 갱신: 2026-07-23 · 브랜치: `main` · 커밋 상태: **committed** · 전부 배포됨

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

**막힌 코드 없음.** 이번 세션 작업은 전부 커밋·배포·라이브 검증까지 끝났다.
대기 항목은 **우리 손 밖**이다 — AdSense. 단 "그냥 심사 기다리는 중"이 아니다:
**사용자가 AdSense 프로필(수취인 주소 + 전화 인증)을 마쳐야 한다.** 근거는 §7.2.

## 다음 단계 (순서대로)

1. **AdSense — 사용자에게 "프로필 작성(주소·전화 인증) 하셨나요?"부터 묻는다.**
   "승인 났나요?"가 아니다. 2026-07-16 기준 그 앞 단계에서 멈춰 있었다(§7.2).
   - 코드로는 승인 여부를 알 수 없다. **Gmail 검색이 먹힌다**(Gmail MCP 연결됨):
     `from:adsense-noreply@google.com` — 2026-07-16 확인 시 환영 메일 1통뿐, 승인 메일 없었다.
   - **승인 났으면** → §7.2의 3단계를 그 순서대로. ⚠️ 슬롯 ID 교체를 건너뛰고 `adsenseEnabled`만
     켜면 잘못된 슬롯으로 요청이 나가 콘솔 에러만 남는다.
   - **아직이면** → 3번으로. 코드는 지금 상태(`false` + 플레이스홀더 슬롯)가 정확히 맞다.
2. **Search Console 색인 진행 확인** (사용자에게 요청 — 에이전트는 접근 불가):
   실적 메뉴의 검색어(Queries)·총 노출수·페이지 탭. 검색어가 잡히기 시작하면
   그게 다음 게임의 힌트다. ⚠️ **아래 "데이터 신호는 아직 이르다" 참고.**
3. **게임 라운드8** — 워크플로우가 레포에 저장돼 있다.
   **사용자가 명시적으로 요청했을 때만** 돌린다(20 에이전트 / ~1.2M 토큰 / ~28분):
   ```
   Workflow({ name: "minigames-round" })
   ```
   - 스크립트: `.claude/workflows/minigames-round.js` (커밋됨). **개수 하드코딩 제거됨** —
     `GAME_COUNT`가 `EXISTING`에서 자동 계산된다(2026-07-16).
   - **`EXISTING` 상수는 라운드7 3종까지 반영돼 56종 기준이다**(2026-07-16). 라운드8에서
     새 게임을 배포한 뒤에는 다시 추가할 것. 안 갱신하면 이미 있는 게임을 다시 제안한다
   - 에이전트는 자기 파일 3개(engine/engine.test/Game*.tsx)만 쓴다. **배선 6곳은 내가 직접**
   - ⚠️ **에이전트의 "테스트 통과"는 게임이 돌아간다는 뜻이 아니다** — §7.6 교훈.
     반드시 실제 마우스·키보드로 몰아볼 것
4. **(선택) Daily streak** — §7.5 "다음 사이클". UTC/로컬 날짜 통일이 선행.

## ⚠️ 데이터 신호는 아직 이르다 (2026-07-16 실측)

"게임이 쌓이면 리더보드·검색어 데이터로 다음 게임을 정하자"는 방향은 맞다. **단 지금은
데이터가 없다.** 성급히 뽑으러 가지 말 것 — 다음이 실측 결과다:

- **리더보드(D1) 제출 = 총 1건.** 그것도 `snake / FIRST / 42`, 명백한 본인 테스트 제출.
  실제 유저 데이터 0. 계기판(34개 리더보드)은 깔렸으나 아직 잴 게 안 들어왔다.
  조회법: `npx wrangler d1 execute minigames-leaderboard --remote --json --command "SELECT game, COUNT(*) n FROM scores GROUP BY game ORDER BY n DESC"`
- **Search Console 검색어 = 에이전트 접근 불가.** MCP에 Gmail/Drive는 있어도 Search Console은
  없다. 사용자가 직접 실적 메뉴를 봐야 한다.

**결론**: 병목은 게임 품질이 아니라 트래픽(아직 아무도 안 온다)이다. 트래픽은 색인+시간+광고의
함수. **라운드8도 데이터가 아니라 감(각도별 오리지널)으로 돌리는 게 맞다.** 몇 주 뒤 트래픽이
붙으면 그때 리더보드 제출·검색어가 진짜 신호가 되고, 그때 심의 입력으로 넣으면 된다.

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
- **게임 수**: 56종 (registry 기준). 상당수 오리지널 창작 게임 + 클래식.
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
