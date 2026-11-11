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
- Deploy trigger: main 머지 시 GitHub Actions(`.github/workflows/deploy.yml`)가 `pnpm run deploy`. 수동 배포도 가능
- Health check: 위 curl, 또는 /snake /2048 /typing-test 등 개별 라우트 200 확인

### 배포 메모
- Cloudflare 무료 플랜은 상업적 이용(AdSense) 허용 → 수익화해도 이전 불필요.
- 정적 내보내기 제약: `robots.ts` / `sitemap.ts` / `opengraph-image.tsx`에 `export const dynamic = 'force-static'` 필수.
- 커스텀 도메인 구매 시 변경 지점: `src/lib/siteConfig.ts`의 `url` 한 줄 + Cloudflare 대시보드에서 도메인 라우트 연결.
- 홈 Featured 레일 인기순(`/api/popular`)은 `pnpm exec wrangler secret put CF_ANALYTICS_TOKEN`(Account Analytics:Read 토큰)을 1회 설정해야 동작 — 없으면 레일은 큐레이션 순서 그대로.

## 매일 아침 팀 운영
06:00 KST 클라우드 루틴이 회의(docs/team/meetings) → 리뷰 → 반영(PR·머지) → 메일 보고. 05:30 Actions가 지표를 docs/daily/metrics에 커밋. 결정은 DECISIONS.md, 백로그 docs/daily/backlog.md, 운영 방식은 sandlab 저장소 docs/ops/playbook.md.

## Testing

- `pnpm vitest run` — 유닛/컴포넌트 테스트. `vitest.config.ts`가 `test.projects`로 둘로 나뉨:
  - `engine`(node): `src/**/*.test.ts` — 게임 순수 로직(`engine.ts`). 신규 게임은 항상 여기.
  - `component`(jsdom): `src/**/*.test.tsx` — 복잡한 상태 로직이 있는 `Game*.tsx`에 한해 선택적으로.
    canvas+rAF 게임은 jsdom이 2D context를 지원하지 않아(콘솔 경고만, 안 죽음) 실제 드로잉은
    검증 불가 — 상태 전이·localStorage 영속처럼 canvas 밖 로직만 테스트할 것.
- `pnpm exec playwright test` — e2e 스모크(로드+보드 표시 위주). 신규 게임은 항상 여기도 추가.
- 컨벤션: 100% 커버리지가 목표가 아니라, 회귀가 조용히 들어오는 지점(신기록 판정, 저장 로직,
  daily/streak 배선)을 우선 테스트한다. TODOS.md에 남은 파일럿 확장 후보 있음.

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
