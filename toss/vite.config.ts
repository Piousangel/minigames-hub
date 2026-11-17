import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 게임 엔진은 웹 포털(../src/lib/games)과 같은 코드를 쓴다. 화면만 토스용으로 따로 둔다.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  build: { outDir: 'dist', target: 'es2020', assetsInlineLimit: 0 },
})
