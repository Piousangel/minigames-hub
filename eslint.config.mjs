import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import reactPlugin from 'eslint-plugin-react'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'error',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
)

