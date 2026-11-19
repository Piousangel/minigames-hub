# 말랑 미끄럼길(Slime Slide) 정식 출시 계획 (11-19)

오너 결정: 스테이지 4개로 먼저 출시하고 매일 1개씩 추가. 시험판(/tools/slime-proto)은 계속 두고, 정식은 `/slime-slide`.

## 범위(출시 최소)
1. **일일**: 하루 1스테이지(풀 N개 순환), 시도 3회, 최고점이 그날 점수. 연습 모드는 4스테이지 자유 선택. (`daily.ts` 구현·테스트 완료)
2. **공유**: 스포일러 없는 문구(경로 미포함, 힌트 사용 표기) + 기존 ShareButtons(Threads·Facebook·KakaoTalk·복사).
3. **리더보드**: `LEADERBOARD_GAMES['slime-slide']`, 하루 최고점 제출(OverlayScoreSubmit). 힌트를 본 판은 제출 가능하되 표시한다(S0 정책 후속).
4. **화면 문구는 영어**(사이트가 영어 전용, AdSense·검색). 시험판은 한글 유지. 문구 테이블로 분리해 한국어를 나중에 얹는다(i18n 메모).
5. **허브 등록**: registry(영문 SEO 본문: howToPlay·strategy·faq), GameRenderer, gameMeta(addedDate·cover 16:9 ≤100KB), gameIntros, nextGame, HeroPlayButton, GameIcon, leaderboard.
6. **측정**: sl_* 이벤트를 slug `slime-slide`로(시험판은 `slime-proto` 유지).

## 하지 않는 것
tier3 스테이지, 서버 재검증, 실루엣 이미지 공유, BGM(출시 후), 스테이지 선택 잠금.

## 공개 전 관문(오너 확인 필수)
- G4: 390px 혹평 ≥6.5, 독립 리뷰의 '가장 멍청한 사용 방식' 결함 반영
- 실기기(iOS Safari·카카오톡 인앱) 스크롤·그리기 확인
- 커버 이미지(Gemini, 비용 규칙 준수) → **registry 등록 PR 머지 = 공개이므로 오너 승인 후**

## 단계
A. 일일 로직(완료) → B. 영문 문구 테이블+`GameSlimeSlide`(일일/연습·시도·공유·점수 제출) → C. 허브 등록 PR(공개 전 승인) → D. G4·실기기 → E. 공개
