import { defineConfig } from 'vitest/config'
import path from 'node:path'

const alias = { '@': path.resolve(__dirname, 'src') }
const esbuild = { jsx: 'automatic' as const }

// 만성 실패 정리(11-20, 오너 승인 제안 C):
// - testTimeout: 기본 5초는 1,000시드 퍼징·BFS 레벨 검증·가짜 타이머로 한 판을 끝까지 돌리는 컴포넌트 테스트에 짧다.
//   로컬 부하(load 40+)에서 27건이 5초에 끊겼고(가장 느린 것 약 29초), 시간만 늘리면 전부 통과했다(검증 범위는 그대로).
//   CI(조용한 4코어 러너)에서는 가장 느린 테스트가 약 3초라 15초(5배)로 둔다 — 느려짐 퇴행·가짜 타이머 무한 대기는 CI에서 잡힌다.
//   로컬은 다른 세션이 머신을 나눠 쓰므로 60초.
// - --no-experimental-webstorage: Node 25+는 전역 localStorage를 기본으로 켜서 jsdom의 localStorage를 가린다
//   (로컬 Node 26에서 localStorage.clear가 undefined → 340건 넘게 실패). Node 22(CI)에서는 아무 일도 하지 않는다.
const testTimeout = process.env.CI ? 15_000 : 60_000
const execArgv = ['--no-experimental-webstorage']

export default defineConfig({
  resolve: { alias },
  esbuild,
  test: {
    // 풀 프로세스 옵션은 루트에서만 정할 수 있다(프로젝트별 poolOptions는 isolate 등만 허용).
    poolOptions: { forks: { execArgv }, threads: { execArgv } },
    projects: [
      {
        resolve: { alias },
        esbuild,
        test: { name: 'engine', include: ['src/**/*.test.ts'], environment: 'node', testTimeout, hookTimeout: testTimeout },
      },
      {
        resolve: { alias },
        esbuild,
        test: {
          name: 'component',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
          testTimeout,
          hookTimeout: testTimeout,
        },
      },
      // Claude Code hook 스크립트(.claude/settings.json → scripts/hooks/). 샌드랩과 같은 파일·테스트.
      { test: { name: 'hooks', include: ['scripts/hooks/**/*.test.mjs'], environment: 'node', testTimeout, hookTimeout: testTimeout } },
    ],
  },
})
