// 리디자인 v2 R7 정원 틀: 진행 중에만 생기는 덮개(승패 모달 GameOverlay) 위 글자 대비를 실제 판을 끝까지 두어 잰다.
// 게이트(e2e/garden-frame.spec.ts)는 로드 직후 화면만 보므로 덮개는 이 스크립트로 확인한다(R7c는 손으로, R7d에서 스크립트로 승격).
//
//   node scripts/garden-overlay-contrast.mjs --url http://localhost:3741 --slugs dots-and-boxes,tripeaks,golf-solitaire \
//        [--out docs/design/redesign-v2/r7d/overlay-contrast.json]
//
// 게임마다 아래 RECIPES에 '덮개가 뜰 때까지 두는 법'을 적는다(새 배치에서 대표 게임을 바꾸면 여기에 추가).
// 출력: 덮개 안 보이는 글자 전부의 대비(통과한 것도 기록)와 기준(4.5, 큰 글자 3) 미달 수. 미달이 있거나 잰 글자가 0개면 exit 1.
// 한계: 레시피가 띄우는 결과 한 종류만 잰다(지금은 전부 패배·막힘 쪽 — 승리 Confetti·무승부 변형은 안 잼),
// 배경은 조상만 합성한다(덮개 뒤 형제 카드는 무시 — 패널 bg-bg-2/85라 지금 여유 안에서는 무해).
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const url = opt('url')
const slugs = (opt('slugs') ?? '').split(',').filter(Boolean)
const out = opt('out')
const width = Number(opt('width', 390))

/** 덮개를 띄우는 법: page → 덮개 locator. 무작위 판이라 '끝날 때까지 반복' 형태로 쓴다. */
const RECIPES = {
  // 비어 있는 선 아무거나 그으며 CPU와 끝까지 — 결과(승·패·무) 덮개
  'dots-and-boxes': async (page) => {
    const result = page.locator('[data-testid^="dab-result-"]')
    for (let i = 0; i < 200 && !(await result.first().isVisible()); i++) {
      const edge = page.locator('[data-testid="dab-board"] button:not([disabled])').first()
      if (await edge.count()) await edge.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(250)
    }
    return result.first()
  },
  // 낼 수 있는 판 카드(data-playable)를 먼저 내고, 없으면 덱을 넘긴다 — 막힐 때까지('No moves left' 또는 승리)
  tripeaks: (page) => playUntilOver(page, '[data-testid="tableau-card"][data-playable="true"]'),
  'golf-solitaire': (page) => playUntilOver(page, '[data-testid="exposed-card"][data-playable="true"]'),
}

async function playUntilOver(page, playable) {
  const over = page.getByTestId('game-over')
  for (let i = 0; i < 200 && !(await over.isVisible()); i++) {
    const card = page.locator(playable).first()
    const target = (await card.count()) ? card : page.locator('[data-testid="stock"]:not([disabled])')
    // 카드가 서로 겹쳐 좌표 클릭은 다른 카드에 맞는다 → 요소에 직접 click
    if (await target.count()) await target.evaluate((el) => el.click()).catch(() => {})
    await page.waitForTimeout(80)
  }
  return over
}

/** 덮개 안 글자 요소 대비(e2e/garden-frame.spec.ts contrastFailures와 같은 계산, 범위만 덮개). */
async function measure(overlay) {
  return overlay.evaluate((root) => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    const toRGBA = (css) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2], d[3] / 255]
    }
    const over = (t, u) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3])).concat(1)
    const lum = (c) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
    const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
    const backgrounds = (el) => {
      const layers = []
      let base = [toRGBA(getComputedStyle(document.body).backgroundColor)]
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (cs.backgroundImage && cs.backgroundImage !== 'none') {
          if (cs.backgroundImage.includes('url(')) return null
          const stops = cs.backgroundImage.match(/(rgba?|oklab|oklch|color)\([^)]*\)/g)
          if (stops && stops.length) {
            const cols = stops.map(toRGBA).filter((c) => c[3] > 0)
            if (cols.length && cols.every((c) => c[3] === 1)) {
              base = cols
              break
            }
          }
        }
        const bg = toRGBA(cs.backgroundColor)
        if (bg[3] >= 1) {
          base = [bg]
          break
        }
        if (bg[3] > 0) layers.push(bg)
        if (n === document.body) break
      }
      return base.map((b) => layers.reduceRight((acc, l) => over(l, acc), b))
    }
    const rows = []
    for (const el of [root, ...root.querySelectorAll('*')]) {
      const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent ?? '').join('').trim()
      if (!/[\p{L}\p{N}]/u.test(own)) continue
      if (el.closest('svg, canvas, [disabled], [aria-disabled="true"]')) continue // 비활성 컨트롤은 WCAG 예외(게이트와 같음)
      const r = el.getBoundingClientRect()
      if (r.width <= 1 || r.height <= 1) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden') continue
      let op = 1
      for (let n = el; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity)
      if (op === 0) continue
      const bgs = backgrounds(el)
      if (!bgs) continue
      const size = parseFloat(cs.fontSize)
      const need = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5
      const fgRaw = toRGBA(cs.color)
      let worst = Infinity
      let worstBg = bgs[0]
      for (const bg of bgs) {
        const cr = ratio(over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * op], bg), bg)
        if (cr < worst) [worst, worstBg] = [cr, bg]
      }
      rows.push({ text: own.slice(0, 40), fg: cs.color, bg: hex(worstBg), ratio: Math.round(worst * 100) / 100, need })
    }
    return rows
  })
}

if (!url || slugs.length === 0) {
  console.error('usage: node scripts/garden-overlay-contrast.mjs --url URL --slugs a,b [--out path] [--width 390]')
  process.exit(1)
}
const browser = await chromium.launch()
const report = {}
let bad = 0
for (const slug of slugs) {
  const recipe = RECIPES[slug]
  if (!recipe) throw new Error(`RECIPES에 ${slug} 없음`)
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.route('**/api/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto(`${url}/${slug}`)
  await page.locator('[data-garden-board]').waitFor()
  const overlay = await recipe(page)
  if (!(await overlay.isVisible())) {
    const shot = join(tmpdir(), `garden-overlay-${slug}-fail.png`) // 저장소에 섞이지 않게
    await page.screenshot({ path: shot })
    throw new Error(`${slug}: 덮개가 뜨지 않음(덮개 ${await overlay.count()}개, 화면 ${shot})`)
  }
  await page.waitForTimeout(500) // 덮개 등장 애니메이션
  const rows = await measure(overlay)
  if (rows.length === 0) throw new Error(`${slug}: 덮개 안에서 잰 글자가 0개 — 측정이 빈 통과가 되지 않게 실패`)
  const fails = rows.filter((r) => r.ratio < r.need)
  bad += fails.length
  const min = Math.min(...rows.map((r) => r.ratio))
  report[`${slug}-${width}`] = { checked: rows.length, min, fails: fails.length, rows }
  console.log(`${slug} ${width}: 글자 ${rows.length}개 · 최저 ${min}:1 · 미달 ${fails.length}`)
  await ctx.close()
}
await browser.close()
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
process.exit(bad ? 1 : 0)
