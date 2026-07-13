import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] }, // next-env.d.ts: Next가 자동 생성/관리하는 파일
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]

export default eslintConfig
