import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    // 정적 export(output: 'export')는 next start로 서빙 불가 → out/ 을 정적 서버로 제공
    command: 'pnpm build && npx serve out -l 3100',
    url: 'http://localhost:3100',
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
})
