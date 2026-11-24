# minigames-hub

무료 미니게임 허브(quickminigames.site). Next.js 15 정적 사이트(`output: 'export'`)를 Cloudflare Workers 정적 에셋으로 배포. 수익 모델은 AdSense.

## 세션 시작 시 읽을 것 (필독 세트 — CI가 크기를 센다)
1. 이 파일 2. [docs/team/SHIFT.md](./docs/team/SHIFT.md) — 교대 규칙 정본(카드·리뷰·기록·Slack·금지) 3. [docs/team/NORTH-STAR.md](./docs/team/NORTH-STAR.md) — 방향·지표 4. [HANDOFF.md](./HANDOFF.md) — 현재 상태·다음 할 일(덮어쓰기, ≤10KB).
보고·회고·마케팅은 [docs/team/OPS.md](./docs/team/OPS.md). 사이드 스튜디오 Slack(공용 채널·고정 이름표·팀 간 부탁·지시의 출처, 오너 11-24)은 SHIFT 8장. 옛 문서(OPERATING·SESSION-GUIDE·ROTA·cycle·direction)는 `docs/archive/`에 보관됐다 — 규칙으로 읽지 않는다.

## 절대 규칙
- 배포는 **main 머지 시 GitHub Actions(`deploy.yml`)만**. 세션에서 `pnpm run deploy`·`wrangler deploy`는 `.claude/settings.json` deny·hook이 막는다(오너 터미널만 예외). Vercel 체크는 이 저장소와 무관.
- 브랜치 → PR → CI 초록 → squash 머지. main 직접 푸시·force push·`--admin` 금지.
- 시크릿은 읽지도 설정하지도 않는다. 설정이 필요하면 오너에게 명령을 넘긴다(예: 홈 '인기 4' 순서용 `wrangler secret put CF_ANALYTICS_TOKEN` — 오너 터미널).
- slug·공유 URL·저장 키·점수 체계 변경, 게임·캔버스 화면 안 광고 금지. 고위험 경로는 SHIFT 4장.
- 정적 내보내기: `robots.ts`·`sitemap.ts`·`opengraph-image.tsx`에 `export const dynamic = 'force-static'` 필수.

## 검증 (머지 전 하나)
```bash
pnpm verify 2>&1 | tail -n 80   # typecheck · lint · test · build · check-routes · check-seo
```
- e2e: `pnpm exec playwright test` (CI는 스모크만 돈다). 신규 게임은 e2e 스모크도 추가.
- vitest 프로젝트: `engine`(node, `src/**/*.test.ts` — 게임 순수 로직, 신규 게임은 항상), `component`(jsdom, `src/**/*.test.tsx` — canvas 밖 상태 로직만), `hooks`·`checks`(scripts). 회귀가 조용히 들어오는 곳(신기록 판정·저장·daily/streak)을 먼저 테스트한다.

## Deploy Configuration (configured by /setup-deploy)
- Platform: Cloudflare Workers (static assets)
- Production URL: https://quickminigames.site
- Deploy trigger: main 머지 → `.github/workflows/deploy.yml`(Actions가 `pnpm run deploy`)
- Deploy status: `gh run list --workflow deploy.yml --limit 3`
- Merge method: squash
- Project type: static web app (SSG, no server runtime)
- Post-deploy health check: `curl -sf https://quickminigames.site/ -o /dev/null -w "%{http_code}"` → 200 (또는 /snake /2048 개별 라우트)
- 메모: Cloudflare 무료 플랜은 AdSense 상업 이용 허용. 예전 workers.dev 주소는 404. 도메인을 바꾸면 `src/lib/siteConfig.ts`의 `url` + Cloudflare 라우트. 지표는 Actions(`metrics.yml`)가 `docs/daily/metrics/`에 커밋.

## Skill routing
요청이 스킬과 맞으면 Skill 도구로 부른다: 아이디어 /office-hours · 전략 /plan-ceo-review · 아키텍처 /plan-eng-review · 버그 /investigate · QA /qa·/qa-only · 리뷰 /review · 시각 /design-review · PR /ship.
