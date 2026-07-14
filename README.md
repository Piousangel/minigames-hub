# MiniGames Hub

Free online mini games. Next.js SSG + Vercel.

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

## 배포 (수동 — 사용자가 직접)
1. 도메인 구매 후 `src/lib/siteConfig.ts`의 `url`·브랜드명, `src/app/contact/page.tsx`의 이메일 변경
2. Vercel 프로젝트 연결 (GitHub repo import), 도메인 연결
3. Google Search Console 등록 → sitemap.xml 제출
4. GA4 프로퍼티 생성 → 측정 ID를 layout에 추가 (M1-b에서)
