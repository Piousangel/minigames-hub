import { defineConfig } from 'vitest/config'
import path from 'node:path'

const alias = { '@': path.resolve(__dirname, 'src') }
const esbuild = { jsx: 'automatic' as const }

// 만성 실패 정리(11-20, 오너 승인 제안 C):
// - testTimeout: 기본 5초는 1,000시드 퍼징·BFS 레벨 검증·가짜 타이머로 한 판을 끝까지 돌리는 컴포넌트 테스트에 짧다.
//   부하(로컬 load 40+, CI 러너 2~4코어)에서 27건이 5초에 끊겼고, 시간만 늘리면 전부 통과했다(검증 범위는 그대로).
//   멈춘(무한 루프) 테스트는 여전히 60초에 실패한다.
// - --no-experimental-webstorage: Node 25+는 전역 localStorage를 기본으로 켜서 jsdom의 localStorage를 가린다
//   (로컬 Node 26에서 localStorage.clear가 undefined → 340건 넘게 실패). Node 22(CI)에서는 아무 일도 하지 않는다.
const testTimeout = 60_000
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
    ],
  },
})
