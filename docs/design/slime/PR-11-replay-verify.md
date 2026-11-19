# 말랑 미끄럼길 PR-11: 서버 재생 검증 (22시 야간 개발 B, 2026-11-19)

스펙: `docs/team/specs/2026-11-19-slime-v2-final-spec.md` D-17~D-21, E장 PR-11. 엔지니어 보고 1-6(L1).
현행 구조(5스테이지·선 1개·순차 해금·스테이지당 3회)에 맞춘 버전이다. v3(다중 선·슬롯제)가 오면 `planForDay`와 선 개수 검사만 바꾼다.

## 무엇이 바뀌었나
| 항목 | 내용 | 파일 |
|---|---|---|
| 정준형 | `encodeLine`/`decodeLine`(보드 ×2 정수, 손실 없음), `canonLines`(첫 점 x→y→점 수→좌표 사전식) | `src/lib/games/slime/canon.ts` |
| 검증 | `verifyDay(day, stages)`: 스테이지 순서(앞을 지나야 열림)·시도 ≤3·클리어 뒤 시도 금지·선 모양(첫 점 보드 안, 인접 간격 ≤8.75, 길이 ≥39.5, 잉크 ≤ink+2, 스폰 금지 원 R−6)·`simulate` 재계산. **클라의 score·stars·hint는 쓰지 않는다**(hint는 앞 2시도 연속 실패로 서버가 계산) | `verify.ts` |
| 날짜 | `dayAcceptable`: UTC−12~+14 어딘가의 오늘 + 30분 유예(나라별 현지 자정 결정 11-19 반영) | `verify.ts` |
| 힌트 별 상한 | 오너 승인 ④ 구현: 힌트가 보인 시도는 점수 계산에서 별 min(별,2). 표시 별은 실제, 결과 문구의 점수 분해도 상한 반영 | `daily.ts attemptScore`, `SlimeProto.tsx` |
| 서버 | `POST /api/slime/submit`(≤32KB). 주 보드 = **day의 ISO 주**. (day, player)당 1행: 점수가 오를 때만 기존 scores 행 UPDATE. player = vid 해시(없으면 IP 해시), 원본 저장 안 함. IP 10초 쿨다운 공유. AE 이벤트 `sl_submit_verified` | `worker/index.ts` |
| 옛 경로 닫음 | `/api/score`는 `slime-slide`를 400으로 거부(숫자 curl 1위 방지) | `worker/index.ts` |
| D1 | `slime_daily` 추가 전용·멱등 마이그레이션. deploy.yml이 배포 전 원격 실행(`continue-on-error`). 표가 없으면 워커가 검증 점수를 scores에 추가하는 폴백 | `db/migrations/0001_slime_daily.sql`, `db/schema.sql`, `.github/workflows/deploy.yml` |
| 클라 | 일일 결과의 제출 버튼이 선 증거를 보낸다(`slimeSubmitBody`), 오늘 합계·날짜별 중복 키 `submitted:slime-slide:<day>`, 서버 재계산 점수를 저장 | `GameSlimeSlide.tsx`, `OverlayScoreSubmit.tsx`(선택 prop `verified`, 다른 게임 무변경) |

## 실측 (이 컨테이너, Node 22, 4코어)
- **정직한 선 오탐 0**: 사람형 무작위 획 7,290개(5스테이지)를 클라 규칙대로 그려 파이프라인 통과 → 전부 통과. 실측 최대: 잉크 초과 **0.022px**(허용 2), 인접 간격 **8.60**(허용 8.75), 스폰 중심 최근접 **33.24**(원 34, 허용 28). 테스트 `verify.test.ts`가 매번 다시 잰다.
- **CPU**: 최악 제출(5스테이지×3시도, 실패 선) 검증 1.58ms/요청, **0.11ms/판**(엔지니어 실측 0.11ms와 일치). 스펙 예산 판당 ≤1ms 충족. Workers 실CPU는 대시보드에서만 보인다 — 배포 후 Workers 지표 `CPU time` p99 확인(무료 플랜 10ms 한도 대비).
- **워커 번들**: 20.25KiB(gzip 6.16) → 39.73KiB(gzip 12.42). 엔진·스테이지가 들어감.

## 한계
- 솔버로 만든 '유효한 선'은 못 막는다(막지 않기로 함, 엔지니어 1-6). 힌트 별 상한이 봇 이득을 줄인다.
- 시도 3회 제한은 기기 단위(저장소를 지우면 다시 가능). 보드에는 (day, player)당 1행만 남는다.
- 브라우저(JSC·SpiderMonkey)와 V8 결과 일치는 엔진 설계(+−×÷sqrt만)에 기대고 있다. **Playwright WebKit·Firefox 픽스처 확인은 아직**(다음 교대).
- 11-19 이전 시도처럼 선(`line`)이 없는 기록은 증거를 못 만들어 제출이 실패한다(그날 하루만 해당).

## 다음
1. 배포 후: deploy.yml 'D1 additive migrations' 단계 성공 여부, 라이브 제출 1건(`sl_submit_verified`), Workers CPU p99.
2. 클라-서버 동일 결과 픽스처를 Playwright Chromium·WebKit·Firefox로(스펙 PR-11 DoD).
3. 보드 문구 "best day of the week"(D-19) 표기.
