# Quick MiniGames

브라우저에서 바로 하는 무료 미니게임 사이트. 설치·가입 없이 열자마자 한 판.

**라이브:** https://quickminigames.site

## 무엇이 있나

- **게임 110종** — 퍼즐·아케이드·단어·카드·리듬 등. 고전(2048, Snake, Minesweeper, Typing Test)부터 직접 설계한 오리지널(Recoil, Lagline, Hunch, FizzBeat, Unblock 등)까지.
- **데일리** — 모두가 같은 판을 받는 하루 한 판, 연속 기록(스트릭), 일일 퀘스트, 결과 공유 카드.
- **오늘의 스포트라이트** — 매일 한 게임을 예고하고 다음 날 공개. 캘린더(.ics)로 알림 받기.
- **리더보드·도전 링크** — 점수 등록, 친구에게 같은 판 도전 보내기.
- **가이드** — 게임 공략과 읽을거리(`/guides`).
- **컬렉션·카테고리** — 비슷한 게임끼리 묶어 보기, 즐겨찾기, 업적.

계정은 없습니다. 기록·스트릭·즐겨찾기는 브라우저(localStorage)에 저장됩니다.

## 기술 구성

| 영역 | 사용 |
|---|---|
| 프론트 | Next.js 15 정적 export(`output: 'export'`), React 19, Tailwind CSS 4 |
| 호스팅 | Cloudflare Workers 정적 에셋 + 커스텀 도메인 |
| API | 같은 Worker(`worker/index.ts`): 리더보드·점수, 인기 게임, 반응, 방문 집계 |
| 데이터 | Cloudflare D1(리더보드 등), Analytics Engine(`mg_events`) |
| 테스트 | Vitest(엔진: node / 컴포넌트: jsdom), Playwright e2e 스모크 |

```
src/app/            라우트 ([slug] 게임 페이지, daily, guides, leaderboards, collections ...)
src/lib/games/      게임별 엔진(순수 로직)·화면과 레지스트리
src/lib/            데일리·스트릭·스포트라이트·리더보드 등 공용 로직
src/content/        가이드·기사 본문
worker/             Cloudflare Worker (API + 정적 에셋)
db/                 D1 스키마
docs/               설계·감사·출시 문서
```

## 개발

요구: Node 22, pnpm(`corepack enable`). `.env` 없이 동작합니다.

```bash
pnpm install
pnpm dev            # http://localhost:3000 (API 없이 화면만)
pnpm typecheck
pnpm test           # Vitest
pnpm e2e            # Playwright 스모크 (정적 빌드 후 서빙)
```

새 게임을 추가할 때는 엔진 단위 테스트(`src/**/*.test.ts`)와 e2e 스모크를 함께 추가합니다. 테스트 컨벤션은 [CLAUDE.md](./CLAUDE.md#testing).

## 배포

```bash
pnpm run deploy     # next build → scripts/check-routes.mjs → wrangler deploy
```

Cloudflare Workers 전용. `run`을 빼면 pnpm 내장 명령과 충돌합니다. 배포 후 `/`와 게임 몇 개(`/snake`, `/2048`)가 200인지 확인하고, 문제가 있으면 `wrangler rollback`.

## 운영 문서

- [HANDOFF.md](./HANDOFF.md) — 현재 상태, 다음 할 일, 함정
- [TODOS.md](./TODOS.md) — 백로그
- [docs/audits/](./docs/audits/) — 게임 품질 감사(6축 채점)
- [docs/features/tomorrow-spotlight.md](./docs/features/tomorrow-spotlight.md) — 스포트라이트 기능 설계·검증 기록
- [DOMAIN.md](./DOMAIN.md) — 도메인 설정
