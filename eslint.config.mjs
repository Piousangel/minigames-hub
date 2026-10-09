import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const eslintConfig = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts', '.claude/**'] }, // out/**: 정적 export 산출물(압축 벤더 JS) · next-env.d.ts: Next 자동 생성 파일 · .claude/**: 에이전트 git worktree(레포 사본)
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]

export default eslintConfig
