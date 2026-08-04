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
