// 리디자인 v2 R9 「게임 밖 정원 페이지」 전후 캡처(390·1440).
//   node scripts/hub-capture.mjs --base http://localhost:3992 --head http://localhost:3991 --out docs/design/redesign-v2/r9 \
//        --routes /about,/category/puzzle,... [--max 3600]
//   → <이름>-<폭>-before.jpg / -after.jpg (위에서 --max px까지, 기본 3000). 이름 = 경로의 / → _ (예: category_puzzle).
// garden-capture.mjs와 같은 고정: 모션 줄이기·애니메이션 끔·시계 2026-11-20T03:00Z·Math.random 시드·/api 404.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const base = opt('base')
const head = opt('head')
const out = opt('out')
const routes = (opt('routes') ?? '').split(',').filter(Boolean)
const MAX = Number(opt('max', 3000))
const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`

const nameOf = (r) => r.replace(/^\//, '').replace(/\//g, '_') || 'home'

mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
for (const route of routes) {
  for (const width of [390, 1440]) {
    for (const [tag, root] of [['before', base], ['after', head]]) {
      const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
      await ctx.addInitScript(() => {
        let s = 42
        Math.random = () => {
          s = (s * 16807) % 2147483647
          return (s - 1) / 2147483646
        }
      })
      const page = await ctx.newPage()
      await page.clock.setFixedTime(new Date('2026-11-20T03:00:00Z'))
      await page.route('**/api/**', (r) => r.fulfill({ status: 404, body: '' }))
      await page.goto(root + route, { waitUntil: 'networkidle' })
      await page.addStyleTag({ content: FREEZE })
      await page.waitForTimeout(400)
      const h = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.screenshot({ path: join(out, `${nameOf(route)}-${width}-${tag}.jpg`), type: 'jpeg', quality: 60, fullPage: true, clip: { x: 0, y: 0, width, height: Math.min(h, MAX) } })
      await ctx.close()
    }
    console.log(`${route} ${width} ✓`)
  }
}
await browser.close()
