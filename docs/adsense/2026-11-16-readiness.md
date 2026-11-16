> **2026-11-16 오너가 AdSense 검토 요청을 제출했다.** 결과(승인/반려 사유)가 오면 아래에 추가한다. 보통 며칠에서 2~4주가 걸린다.

# AdSense 재검토 준비 점검 — quickminigames.site (2026-11-16)

## 지난 반려 사유
- **2026-09-13 '주의 필요' — 가치가 별로 없는 콘텐츠**(Low value content). 출처: 오너 AdSense 화면 캡처(11-16).
- 같은 화면에 ads.txt '찾을 수 없음'으로 나왔지만 9월 기준 정보다. 11-16 실측으로는 정상이다(아래 2번).

## 최종 판정: **지금 신청 가능**
- 정책·기술 항목(필수 페이지, ads.txt, 소유권 메타, 404·깨진 링크, 모바일 첫 화면, 광고 위치)은 전부 통과했다.
- 반려 사유인 콘텐츠 가치: 9월 반려 뒤 공략·기사 22편이 생겼다. 게임 110개 모두 고유 본문이 300단어 이상이다(최소 356, 중앙값 439). 가장 얇았던 5개는 오늘 엔진 사실로 보강했다.
- 남은 위험: 게임 페이지가 모두 같은 틀(소개 → 방법 → 전략 → FAQ)이다. 직접 만든 게임 약 60개는 검색 수요가 적다. 다시 반려될 가능성은 남아 있다. 그래도 더 기다린다고 줄어드는 위험이 아니라서 지금 신청한다. 반려되면 '데이터 공략 확대'(backlog SEO 1번)로 대응한다.
- 신청 절차(오너): AdSense → 사이트 → quickminigames.site → '검토 요청'.

## 항목별 결과

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | About | 통과 | /about 581단어(렌더 기준). 1인 개발, 제작 방식, 데이터 처리. 게임 수는 레지스트리에서 계산(`src/app/about/page.tsx`) |
| 1 | Privacy Policy | 통과 | /privacy. 쿠키·Google AdSense·맞춤 광고 해제 링크(adssettings.google.com), Google 파트너 사이트 정책 링크, EU/EEA/UK 동의 고지가 있다. 오늘 댓글 관리 안내 링크 추가, 날짜 11-16 |
| 1 | Contact | 통과 | /contact. 실제 이메일 주소(mailto)가 있다 |
| 1 | Terms | 통과(보완) | /terms. 오늘 '댓글 관리 방식', '광고 위치 원칙', '상표·권리 침해 신고' 문단 추가 |
| 1 | 푸터·사이트맵 연결 | 통과 | 푸터 `src/app/layout.tsx:108-111`(About·Privacy·Terms·Contact). sitemap에 4개 모두 포함(`src/app/sitemap.ts`) |
| 2 | ads.txt | 통과 | https://quickminigames.site/ads.txt → `google.com, pub-9363381710674627, DIRECT, f08c47fec0942fa0` |
| 2 | 소유권 확인 | 통과 | `google-adsense-account` 메타가 빌드된 전 페이지에 있다. 광고 스크립트(pagead2)는 `adsenseEnabled: false`라 로드하지 않는다(메타 태그 방식으로 사이트 연결 가능) |
| 3 | 색인 대상 페이지 | 통과 | sitemap 139개 = 홈·/daily·/guides 3 + 공략 16·기사 6 + 게임 110 + 정책 4. 얇은 허브(category·collection·leaderboards·unblocked)는 noindex·sitemap 제외(`siteConfig.thinPagesNoindex: true`) |
| 3 | 게임 페이지 고유 본문 | 통과 | 고유 본문 = 소개(gameIntros) + 방법 + 전략 + FAQ. 110개 기준 최소 356 · 25% 406 · 중앙값 439 · 75% 493 · 최대 708단어. **300단어 미만 0개**, 400단어 미만 24개(보강 전 29개) |
| 3 | 얇은 페이지 처리 | 보강(오늘) | 보강 전 하위 5개를 엔진 코드 사실로 보강했다. noindex는 하지 않았다(아래 '고친 것') |
| 3 | 공략·기사 | 통과 | /guides 22편(공략 16 + 기사 6). 직접 돌린 시뮬 수치가 들어 있다 |
| 4 | 깨진 링크·404 | 통과 | 실사이트 sitemap 139개 curl 결과 **139개 모두 200**. 없는 경로는 404. 빌드 HTML 160개의 내부 링크 5,141개를 out/와 대조한 결과 깨진 링크 0 |
| 4 | 모바일 첫 화면(390×844) | 통과 | 실사이트 Chrome. 홈: H1 'Free Online Mini Games', PLAY NOW, Daily·Collections, 카테고리 4, Featured. /2048: H1과 New Game, 리액션. /rock-paper-scissors: 모드 버튼과 보드, 선택 버튼 3. 3개 페이지 모두 가로 스크롤 없음(scrollWidth 390) |
| 4 | 로딩 | 통과 | load 이벤트 기준 홈 0.55초, /2048 0.78초, /rock-paper-scissors 0.36초(1회 측정). 홈 HTML 334KB는 큰 편이다(backlog SEO 2번) |
| 5 | 광고 위치 | 통과 | AdSlot은 2곳뿐이다. 홈 하단(`src/app/page.tsx:125`), 게임 페이지 FAQ·컬렉션 링크 아래(`GamePageLayout.tsx` game-incontent). 게임 보드·캔버스 안에는 없다. 정책 문구는 Terms에 명시했다 |
| 5 | 사용자 생성 콘텐츠(댓글) | 통과(보완) | 즉시 공개, 사전 승인 없음. 자동 방어: 240자 제한, 링크 차단(이름·본문), IP당 30초 쿨다운, 허니팟(`src/lib/comments.ts`, `worker/index.ts`). 신고·삭제 절차를 Terms에 명시했다. 실사이트 댓글은 2건이고 문제가 없다("that's soso", "good") |
| 5 | 성인·폭력 | 통과 | 해당 콘텐츠 없음(퍼즐·카드·아케이드) |
| 5 | 상표·저작권 | 보완(오늘) + 오너 결정 | 아래 표 |

## 상표 위험 이름 (slug·URL은 바꾸지 않았다)

| 위험 | 게임(slug) | 문제 | 처리 |
|---|---|---|---|
| 높음 | tetris | 'Tetris'(The Tetris Company 등록상표, 적극적으로 권리를 행사함)를 제목·H1·공략 제목·4줄 클리어 용어로 썼다 | **표기를 'Falling Blocks'로 변경**. 4줄 클리어는 'Quad'. 레지스트리·소개·공략 제목·홈·카테고리·unblocked 문구 반영 |
| 높음 | yahtzee | 'Yahtzee'(Hasbro 등록상표)를 제목·H1·게임 안 칸 이름·데이터 기사에 썼다 | **표기를 'Yacht Dice'로 변경**(Yacht는 퍼블릭 도메인 원형 게임 이름). 게임 안 칸 'YACHT', 기사 제목·본문 반영 |
| 중간 | flow | 제목에 'Flow Free'(Big Duck Games 제품명) | 제목에서 제거('Play Flow Online — Free Connect the Dots Pipe Puzzle') |
| 중간 | unblock | 제목에 '(Rush Hour)'(ThinkFun 상표) | 제목에서 제거. 소개의 "you may know it as Rush Hour"는 설명 목적의 지칭이라 유지 |
| 중간 | nonogram | 제목·메타에 'Picross'(Nintendo 상표) | 제목·메타에서 제거. 소개·FAQ의 별칭 언급은 유지 |
| 중간 | reversi | 제목·메타에 '(Othello)' | 제목·메타에서 제거. FAQ "Is Reversi the same as Othello?"는 유지 |
| 중간(오너 결정) | connect-four, battleship, mastermind, simon | Hasbro 계열 등록상표를 게임 이름으로 쓴다. 다만 대형 게임 포털에서도 흔히 쓰는 이름이다 | 미변경. 바꾼다면: Four in a Row / Sea Battle / Code Breaker / Color Sequence. 검색 유입이 줄어드는 대가가 있다 |
| 중간(오너 결정) | breakout, pong | Atari 상표 | 미변경. 바꾼다면: Brick Breaker / Paddle Ball |
| 낮음 | sokoban, lights-out, whack-a-mole, flappy, quadle(Quordle 유사) | 일반명사화됐거나 원작과 이름이 다르다 | 미변경, 기록만 |

판단: Tetris와 Yahtzee는 특정 상품 이름이고 권리 행사 사례가 많아 오늘 바꿨다. 둘 다 지난 7일 게임별 이벤트 상위 10위 밖이라 유입 손실이 작다(docs/daily/metrics/2026-11-17.md). 리더보드·저장 키는 slug라서 영향이 없다.

## 이번에 고친 것
1. **얇은 게임 5개 보강**: 엔진 코드에서 확인한 사실만 썼다. 단어 수는 보강 전 → 후.
   - rock-paper-scissors 338 → 518: 컴퓨터가 균등 무작위라 패턴 공략이 통하지 않는다는 점, 연승 확률 1/27·1/243, 기록 저장 방식. 기존 전략 문구 중 "패턴을 노려라"가 이 엔진과 맞지 않아 바로잡았다
   - number-memory 340 → 500: 표시 시간 1초 + 자리당 0.3초, 최대 6초. 첫 자리는 0이 아니다
   - aim-trainer 354 → 495: 가장자리 8%에는 표적이 나오지 않는다. 최고 기록은 초당 표적 수. 표적 크기 2.5~3.5rem
   - hangman 354 → 462: 단어 288개·11개 범주. 이 단어 목록 기준 글자 빈도(E 60%, A 52%, R 49%, O 40%)
   - pong 365 → 522: 타구마다 속도 4% 증가(약 16타에 상한). 반사각 최대 55°. Hard는 Easy보다 추적 속도가 약 65% 빠르다
   - noindex 대신 보강을 고른 이유: 이 5개는 검색 수요가 있는 고전 게임이다. 보강 후 하위권을 벗어났고 300단어 미만이 0개다.
2. **상표 표기 변경**: 위 표의 높음 2개와 제목 4개. slug·URL·저장 키는 그대로다.
3. **정책 페이지**: Terms에 댓글 관리 방식, 광고 위치 원칙, 권리 침해 신고 경로를 추가했다. Privacy에서 Terms 링크를 연결했다. 두 페이지 날짜를 2026-11-16으로 바꿨다.

## 오너가 신청 전에 할 일
- 없음(필수). 선택: Search Console에서 /guides 색인 수를 확인하고, 중간 위험 이름 6개(Hasbro·Atari)를 바꿀지 정한다.
- 승인 후: `adsenseEnabled: true`로 바꾸고, 실제 광고 단위 ID로 교체하고, EU용 CMP를 설정한다. `thinPagesNoindex: false`로 되돌린다(`src/lib/siteConfig.ts`).
