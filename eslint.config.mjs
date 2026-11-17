import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const eslintConfig = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts', '.claude/**', 'toss/dist/**'] }, // toss/dist: Toss 앱 빌드 산출물(CI 린트가 이걸 읽어 배포가 막힌 적 있음) · out/**: 정적 export 산출물(압축 벤더 JS) · next-env.d.ts: Next 자동 생성 파일 · .claude/**: 에이전트 git worktree(레포 사본)
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]

export default eslintConfig
