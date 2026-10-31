# MiniGames Hub

Free online mini games. Next.js static export (`output: 'export'`) on Cloudflare Workers.

## Commands
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm test` — 엔진 단위 테스트 (Vitest)
- `pnpm e2e` — 스모크 E2E (Playwright)

## E2E 매트릭스
| 게임 | 스모크 E2E |
|---|---|
| 2048 (classic) | ✅ e2e/smoke.spec.ts |
| 2048 Animals | ✅ 홈 내비 테스트로 커버 |
| Snake | ✅ e2e/smoke.spec.ts (벽 충돌 게임오버) |
| Minesweeper | ✅ e2e/smoke.spec.ts (첫 클릭 안전 공개) |
| Memory Game | ✅ e2e/smoke.spec.ts (두 장 뒤집기 moves) |
| Typing Test | ✅ e2e/smoke.spec.ts (타이머·WPM) |

## 배포
`pnpm run deploy` (= `next build && wrangler deploy`) — Cloudflare Workers, 수동 트리거(CI 미연결).
라이브: https://quickminigames.site. 자세한 배포 설정은 CLAUDE.md 참고.

## 이번 과제 범위: 내일의 스포트라이트 예고 + 캘린더 알림

> 채용 과제(웹 프론트엔드 · AI 활용)용으로 기존 프로젝트에 **새로 만든 부분**만 정리한 절입니다.
> 설계: `docs/superpowers/specs/2026-10-31-tomorrow-spotlight-design.md` · 구현 계획: `docs/superpowers/plans/2026-10-31-tomorrow-spotlight.md`

### 사용자와 목적
계정 없이 짧은 게임을 즐기는 방문자는 "내일 다시 올 이유"가 약합니다. 사이트에는 스트릭·일일 퀘스트가 있지만 사이트가 사용자를 **먼저 불러오는 수단**이 없습니다.

### 핵심 동작 (사용 흐름 하나)
1. 게임 페이지 하단 `DailyDock`에 "TOMORROW'S SPOTLIGHT" 카드가 보입니다(게임 이름은 숨기고 카테고리와 열리기까지 남은 시간만).
2. "Remind me" → 매일 00:00 UTC(한국 09:00)에 반복되는 `.ics` 파일이 내려받아지고, 사용자의 캘린더 앱이 알려 줍니다. 사이트는 알림 권한을 요청하지 않습니다.
3. 다음 날 홈 상단에 어제 예고된 게임이 "TODAY'S SPOTLIGHT"로 공개됩니다(어제 예고를 봤으면 "Teased yesterday", 오늘 열어 봤으면 "Opened today ✓").

### 이번 범위와 이유
- 서버·권한·계정 없이 가능한 가장 작은 "불러오기" 수단이 `.ics`라서 골랐고, 푸시·PWA·이메일은 범위 밖입니다.
- 스포트라이트 게임에는 새 점수·보상을 주지 않습니다(기존 데일리 스트릭만 그대로 오름).
- 이 기능은 "재방문이 늘 것"이라는 **가설**입니다. 하루 방문자가 1~3명 수준이라 이 과제 안에서 효과를 측정할 수 없습니다.

### 새로 만든 것 / 기존 것
| 구분 | 파일 |
|---|---|
| 선정(순수 함수) | `src/lib/spotlight.ts` — 데일리 게임 28종을 N일 주기로 돌림(주기 안에서 모두 한 번씩, 주기 경계에서 전날과 연속 방지) |
| `.ics` 생성(순수 함수) | `src/lib/dailyIcs.ts` — RFC 5545, 이스케이프·75옥텟 접기·UTC 자정·VALARM |
| 보조 | `src/lib/downloadFile.ts`, `src/lib/spotlightSeen.ts`, `nextDayUTC`(`dailyStreak.ts`), `hashSeed`/`mulberry32` export(`today.ts`) |
| 화면 | `src/components/SpotlightTeaser.tsx`(`DailyDock`에 연결), `SpotlightReveal.tsx`(`TodayBoard`에 연결) |
| 테스트 | 각 파일의 `*.test.ts(x)`, `e2e/smoke.spec.ts`의 스포트라이트 2건 |

기존(이번에 만들지 않은 것): 게임 110종, 데일리 모드·스트릭, 일일 퀘스트, 공유 카드, 품질 감사 보고서.

### AI 활용
- 설계: 처음에 "주간 미션 + 점수"를 구상했지만 전문가 에이전트 리뷰(UX·구조·근거 조사)에서 코드 가정 오류(완료 지점이 단일하지 않음, 주 정의 불일치)와 범위 과대가 드러나 접었고, 재방문 트리거를 다시 탐색해 이 기능으로 바꿨습니다.
- 구현: TDD(실패하는 테스트 → 최소 구현), 계획의 task 단위 커밋.
- 사람이 검토한 판단: 예고 대상을 전체 110종이 아닌 데일리 28종으로 한정, 알림 시각을 00:00 UTC로 고정, 카드 위치를 게임오버 오버레이가 아닌 `DailyDock`으로 변경(아래).

### 확인한 것
- 순수 함수 단위 테스트: 같은 날짜 → 같은 결과, 한 주기 안 중복 없음, 주기 경계 연속 없음, 빈 풀·잘못된 날짜, `.ics` 필드·CRLF·이스케이프·75옥텟·멀티바이트.
- 컴포넌트: 예고 단계에 게임 이름·링크가 DOM에 없음, 자정을 넘기면 "내일"이 갱신됨, 저장소 불가·다운로드 불가에서도 예외 없음.
- e2e(Chromium): 게임 종료 후 예고 카드 표시 → 버튼 클릭 → `quickminigames-daily.ics` 실제 다운로드(내용에 `RRULE:FREQ=DAILY`), 홈에서 공개 카드 표시.
- 화면: 게임오버 오버레이에 넣으면 모바일(390px)에서 보드 높이를 넘어 상단 버튼을 가려 `DailyDock`으로 옮겼습니다(오버레이는 109개 게임이 각자 다른 내용을 넣는 공용 컴포넌트라 높이가 불안정).

### 확인하지 못한 것 / 남은 일
- 실제 재방문율 변화(측정 기간·트래픽 부족), 사용자의 알림 수락률.
- 각 캘린더 앱(Google/Apple/Outlook)에서 `.ics`를 가져와 반복 알림이 뜨는지는 확인하지 못했습니다(헤드리스 환경, 사용자 캘린더를 건드리지 않기 위해). 파일 형식은 단위 테스트로만 검증했습니다.
- iOS Safari의 파일 다운로드 동작.
- 데일리 게임이 추가돼 풀 크기가 바뀌면 그날부터 순열이 달라져 "어제 예고한 게임"과 오늘 공개가 어긋날 수 있습니다(알려진 한계).
- 저장소 전체 테스트에는 이 작업과 무관한 기존 실패(5초 시간 초과 등)가 있습니다. 이 브랜치에서 만든 파일은 모두 통과합니다.
