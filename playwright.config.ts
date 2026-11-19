import { defineConfig } from '@playwright/test'

// PW_PORT: 이 컴퓨터는 다른 세션의 serve가 3100을 잡고 있을 때가 있다(reuseExistingServer가 엉뚱한 빌드를 테스트함).
// 그때 `PW_PORT=3201 pnpm exec playwright test`로 다른 포트를 쓴다(HANDOFF R4 함정).
const port = Number(process.env.PW_PORT ?? 3100)

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    // 정적 export(output: 'export')는 next start로 서빙 불가 → out/ 을 정적 서버로 제공
    command: process.env.PW_SKIP_BUILD ? `npx serve out -l ${port}` : `pnpm build && npx serve out -l ${port}`,
    url: `http://localhost:${port}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
})
