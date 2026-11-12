# 백로그

아침 회의에서 고르지 못한 좋은 아이디어는 여기 쌓는다. 위가 우선.

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
10. 지표 수집(daily-metrics) D1 쿼리 실패 원인 조사 — 11-12 파일에서 점수·댓글·게임별 전부 실패(토큰/권한 추정)
