# 백로그

아침 회의에서 고르지 못한 좋은 아이디어는 여기 쌓는다. 위가 우선.

## 최우선
0. **리더보드 참여 0 → 보이는 참여로** (사용자 지적, 11-13 진단)
   - 진단: API·D1·화면 모두 정상(실사이트 2048에서 제출 → 보드·/leaderboards 반영 확인, 테스트 행 삭제). 역대 점수 2건(W29, W41)이라 83개 보드가 전부 "No scores yet" → 사용자에겐 고장처럼 보임.
   - 원인: 제출이 페이지 하단 수동 폼에서만 가능. 게임오버 오버레이엔 스크롤 링크만 있음(`GameOverlay.tsx`).
   - 후보: ① 게임오버 오버레이에서 신기록이면 바로 제출(이름 저장돼 있으면 한 번 클릭) ② 빈 주간 보드에 지난주·역대 최고 표시 ③ /leaderboards에서 빈 보드는 접고 활성 보드 먼저 ④ 제출 수를 AE 이벤트로 측정
   - 11-16 `lb_submit` 이벤트 계측 추가(참여 기준선). 큰 기능 스펙: docs/team/specs/2026-11-16-*.md
   - 11-17 ① 오버레이 1클릭 제출 반영(이름 저장된 사용자만). 남은 것: 이름 없는 첫 사용자용 경로, ②③(11-24 큰 기능)
   - ~~새로고침 후 같은 최고기록 재제출~~ 11-15 해결(`submitted:<slug>` 저장)

## 큰 기능 (화·목 슬롯, 월요일에 2개 골라 스펙)
1. 리더보드 참여(backlog 0번 본체): 게임오버 오버레이에서 신기록 즉시 제출 + 빈 주간 보드에 지난주·역대 최고 표시 + 제출 이벤트 계측
2. 첫 화면 개편(실험 1): 히어로 축소, 오늘의 데일리·스포트라이트·인기 게임 카드 6장, 카드 클릭 계측
3. Solitaire 공략(승률 시뮬레이션): 트래픽 1위
4. Chess 공략: 트래픽 2위

## 품질 (감사 보고서 docs/audits/2026-10-10-quality-audit.md 2~5장)
1. 공통 기반: 데일리 `dailyResult`(하루 첫 완료만 기록), 결과 오버레이 지연, 시작 대기·탭 전환 일시정지 공용 훅, 포커스 강탈 9종, New best 판정 헬퍼
2. 무승부 기록을 tic-tac-toe·connect-four·reversi로 확산
3. 하위 게임 재설계(depth/curve): Overfold·Beatline·Strata·Stakehouse
4. 도전 링크 확산(91종 가능, 데일리·퍼즐 우선)

## 콘텐츠·유입 (AdSense·SEO)
5. /guides 확대: 공략 16·기사 6 → 다음은 solitaire·chess(트래픽 상위, 공략 없음; 승률 시뮬 설계 필요) 등 인기 게임별 공략
6. 게임 페이지 고유 설명(규칙·전략·FAQ) 얇은 곳 보강

## 운영
7. 전체 vitest 기존 실패 ~34건(5초 타임아웃 등) 정리 → 배포 게이트에 테스트 복귀
8. Vercel 연결 해제(실사이트는 Cloudflare, push마다 불필요 빌드)
9. `CF_ANALYTICS_TOKEN` Worker 시크릿 빈 값 → 재등록(홈 인기순 레일)
10. 지표 수집 D1 실패: 원인은 토큰에 D1 권한 없음(확인). 사용자가 토큰 Account 정책에 D1 Edit 추가 예정
11. ~~매니페스트 icon.svg 404~~ 11-14 해결
12. ~~홈 배지 숫자 불일치~~ 11-14 해결(레지스트리 계산)

## 소형 (11-16 마케팅 점검에서 발견)
- **공략·레벨(게임) 페이지에 og:image가 없다**(/guides/*). SNS·카톡 공유 미리보기가 비고, Bluesky 카드는 사이트 대표 이미지로 대신 나간다. 페이지별 OG 이미지(제목+스크린샷)를 정적 생성한다. 공유 클릭률과 SEO에 영향이 있다.

## SEO (11-16 조사: sandlab 대비 검색 성과가 약한 이유)
원인 요약: ① 경쟁 검색어(2048·chess 등)에서 Poki·CrazyGames와 정면 승부 ② 직접 만든 게임 약 60개는 검색 수요 없음 ③ 110개 게임 페이지가 같은 틀(JSON-LD·제목 패턴 반복) ④ 허브 페이지 전부 noindex라 카테고리 검색어를 받을 곳이 없음 ⑤ 홈 제목이 브랜드명뿐, JSON-LD 없음, HTML 334KB.
1. **데이터 공략을 늘린다**(sandlab식, 이미 검증된 형식): /guides/2048(8,200판 시뮬)처럼 직접 만든 게임·상위 트래픽 게임에 '이 사이트만 쓸 수 있는' 공략. 게임 페이지 위쪽에 공략 링크
2. **홈 정비**: title을 설명형으로("Quick MiniGames — 110 free browser games, daily puzzles & tested strategy guides"), WebSite·Organization JSON-LD, 전체 게임 목록은 카테고리로 옮겨 HTML 100KB 이하(첫 화면 실험과 함께)
3. **주제 허브 1~2개만 색인 허용**: 예) '매일 퍼즐', '타이밍 게임'. 설명문을 넣고 noindex를 풀어 내부 링크 축을 만든다(`siteConfig.thinPagesNoindex`를 페이지별로). /unblocked는 계속 noindex
4. ~~얇은 게임 페이지 정리~~ 11-16 하위 5개 보강(rps·number-memory·aim-trainer·hangman·pong → 462~522단어). 다음 하위: word-search 356 · maze 362 · whack-a-mole 364 · tower-stack 368 · connect-four 369 (docs/adsense/2026-11-16-readiness.md)
5. **제목·설명 반복 패턴 제거**: "Free, No Download"·"Free vs Computer" 꼬리를 걷고, 그 게임만의 특징을 앞에 둔다
6. Search Console 색인 보고서(미색인 사유)는 오너가 캡처해 주면 2·4번 우선순위를 정한다
