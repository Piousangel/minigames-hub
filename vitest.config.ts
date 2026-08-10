import { defineConfig } from 'vitest/config'
import path from 'node:path'

const alias = { '@': path.resolve(__dirname, 'src') }
const esbuild = { jsx: 'automatic' as const }

export default defineConfig({
  resolve: { alias },
  esbuild,
  test: {
    projects: [
      {
        resolve: { alias },
        esbuild,
        test: { name: 'engine', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      {
        resolve: { alias },
        esbuild,
        test: {
          name: 'component',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
})
