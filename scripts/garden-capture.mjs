// 리디자인 v2 R7 「정원 틀」 배치 캡처·비교 (계획서 3장 R7a~f 검증).
//
// 두 정적 빌드를 띄워 놓고(예: main = 3301, 브랜치 = 3302) 실행한다:
//   node scripts/garden-capture.mjs capture --base http://localhost:3301 --head http://localhost:3302 \
//        --out docs/design/redesign-v2/r7a --slugs 2048,snake,...
//     → <slug>-<폭>-before.jpg / -after.jpg (390·1440, 위에서 게임판 아래 + 360px까지 자른 화면)
//   node scripts/garden-capture.mjs diff --base ... --head ... --slugs tic-tac-toe,... [--out report.json]
//     → 배치 밖 게임: 두 빌드의 전체 페이지 픽셀 차이(0이어야 한다). 같은 빌드끼리 한 번 더 찍어 흔들림도 잰다.
//
// 공통: 모션 줄이기 + 애니메이션·트랜지션 끔, /api/reactions 흉내(리액션이 보이게), 오늘 날짜 고정 없음
// (데일리 문구가 바뀌는 게임은 같은 시각에 두 빌드를 찍으므로 같다).
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const mode = args[0]
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const base = opt('base')
const head = opt('head')
const slugs = (opt('slugs') ?? '').split(',').filter(Boolean)
const out = opt('out')
const WIDTHS = [390, 1440]

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`

async function open(browser, url, width) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  })
  // 흔들림 제거: 시계 고정(카운트다운·데일리 날짜) + Math.random 시드 고정(무작위 판) — 두 빌드가 같은 판을 그린다
  await ctx.addInitScript(() => {
    let s = 42
    Math.random = () => {
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }
  })
  const page = await ctx.newPage()
  await page.clock.setFixedTime(new Date('2026-11-20T03:00:00Z'))
  await page.route('**/api/reactions**', (r) => r.fulfill({ json: { counts: { '🔥': 12, '😂': 3, '😭': 1, '💀': 0 } } }))
  await page.route('**/api/**', (r) => (r.request().url().includes('/api/reactions') ? r.fallback() : r.fulfill({ status: 404, body: '' })))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: FREEZE })
  await page.waitForFunction(() => !document.querySelector('main .animate-pulse'), null, { timeout: 15000 }).catch(() => {})
  // Reveal(스크롤 등장)을 다 보이게
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 30))
    }
    scrollTo(0, 0)
  })
  await page.waitForTimeout(500)
  return { ctx, page }
}

/** 위에서 게임판(또는 main의 첫 게임 블록) 아랫변 + 360px까지 */
async function clipHeight(page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-garden-board]') ?? document.querySelector('[data-testid="reactions"]')?.previousElementSibling
    const bottom = board ? board.getBoundingClientRect().bottom + scrollY : innerHeight
    return Math.min(Math.ceil(bottom + 360), 2600)
  })
}

async function capture() {
  mkdirSync(out, { recursive: true })
  const browser = await chromium.launch()
  for (const slug of slugs) {
    for (const width of WIDTHS) {
      const shots = {}
      for (const [tag, root] of [['after', head], ['before', base]]) {
        const { ctx, page } = await open(browser, `${root}/${slug}`, width)
        const h = tag === 'after' ? await clipHeight(page) : shots.h
        shots.h = h
        await page.screenshot({ path: join(out, `${slug}-${width}-${tag}.jpg`), type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width, height: h }, fullPage: true })
        await ctx.close()
      }
      console.log(`${slug} ${width} ✓ (${shots.h}px)`)
    }
  }
  await browser.close()
}

/** 두 PNG의 다른 픽셀 수(브라우저 캔버스로 디코드). 크기가 다르면 -1 */
async function pixelDiff(browser, a, b) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const n = await page.evaluate(
    async ([a64, b64]) => {
      const load = (s) =>
        new Promise((res) => {
          const img = new Image()
          img.onload = () => res(img)
          img.src = `data:image/png;base64,${s}`
        })
      const [ia, ib] = await Promise.all([load(a64), load(b64)])
      if (ia.width !== ib.width || ia.height !== ib.height) return -1
      const read = (img) => {
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const x = c.getContext('2d')
        x.drawImage(img, 0, 0)
        return x.getImageData(0, 0, img.width, img.height).data
      }
      const da = read(ia)
      const db = read(ib)
      let diff = 0
      for (let i = 0; i < da.length; i += 4) {
        if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) diff++
      }
      return diff
    },
    [a.toString('base64'), b.toString('base64')],
  )
  await ctx.close()
  return n
}

async function diff() {
  const browser = await chromium.launch()
  const rows = []
  for (const slug of slugs) {
    for (const width of WIDTHS) {
      const shot = async (root) => {
        const { ctx, page } = await open(browser, `${root}/${slug}`, width)
        // 캔버스(rAF로 계속 움직이는 게임 화면)는 같은 색 상자로 가린다 — 틀·글자·레이아웃 차이만 본다
        const buf = await page.screenshot({ fullPage: true, mask: [page.locator('canvas')], maskColor: '#ff00ff' })
        await ctx.close()
        return buf
      }
      const b1 = await shot(base)
      const h1 = await shot(head)
      const b2 = await shot(base)
      const pixels = await pixelDiff(browser, b1, h1)
      const noise = await pixelDiff(browser, b1, b2)
      rows.push({ slug, width, pixels, noise })
      console.log(`${slug} ${width}: main↔branch ${pixels}px · main↔main ${noise}px`)
    }
  }
  await browser.close()
  if (out) writeFileSync(out, JSON.stringify(rows, null, 2) + '\n')
}

if (!base || !head || slugs.length === 0) {
  console.error('usage: node scripts/garden-capture.mjs <capture|diff> --base URL --head URL --slugs a,b [--out path]')
  process.exit(1)
}
if (mode === 'capture') await capture()
else if (mode === 'diff') await diff()
else {
  console.error(`unknown mode ${mode}`)
  process.exit(1)
}
