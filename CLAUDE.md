# minigames-hub

무료 미니게임 허브. Next.js 15 정적 사이트(`output: 'export'`)를 Cloudflare Workers 정적 에셋으로 배포. 수익 모델은 AdSense.

## 세션 시작 시 먼저 읽을 것

**[HANDOFF.md](./HANDOFF.md)** — 다음 할 일, 멈춘 지점, 함정, 검증 상태. 작업 전에 읽는다.
세션을 끝낼 때는 같은 파일을 갱신한다(브랜치당 1개, 덮어쓰기 — 히스토리는 git이 관리).

## Deploy Configuration (configured by /setup-deploy)
- Platform: Cloudflare Workers (static assets)
- Production URL: https://minigames-hub.piousangel.workers.dev
- Deploy trigger: `pnpm run deploy` (= `next build && wrangler deploy`)
- Deploy status: `wrangler deployments list`
- Merge method: squash
- Project type: static web app (SSG, no server runtime)
- Post-deploy health check: `curl -sf https://minigames-hub.piousangel.workers.dev/ -o /dev/null -w "%{http_code}"` → 200

### Custom deploy hooks
- Pre-merge: `pnpm test && pnpm typecheck`
- Deploy trigger: `pnpm run deploy` (수동 — CI 미연결)
- Health check: 위 curl, 또는 /snake /2048 /typing-test 등 개별 라우트 200 확인

### 배포 메모
- Cloudflare 무료 플랜은 상업적 이용(AdSense) 허용 → 수익화해도 이전 불필요.
- 정적 내보내기 제약: `robots.ts` / `sitemap.ts` / `opengraph-image.tsx`에 `export const dynamic = 'force-static'` 필수.
- 커스텀 도메인 구매 시 변경 지점: `src/lib/siteConfig.ts`의 `url` 한 줄 + Cloudflare 대시보드에서 도메인 라우트 연결.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
