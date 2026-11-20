// 리디자인 v2 R7f 정원 틀: 캔버스 게임의 '판 안 글자' 대비를 실제로 몇 초 플레이하며 잰다.
// DOM 게이트(e2e/garden-frame.spec.ts)는 `svg, canvas`를 건너뛴다 — 캔버스 안 점수·안내 글자는 이 스크립트가 본다.
//
//   node scripts/garden-canvas-contrast.mjs --url http://localhost:3881 \
//        [--slugs breakout,pong,...] [--seconds 4] [--out docs/design/redesign-v2/r7f/canvas-contrast.json] \
//        [--shots docs/design/redesign-v2/r7f]
//
// 방법: 페이지 스크립트보다 먼저 CanvasRenderingContext2D.fillText를 감싼다. 글자를 그리기 **직전**에 그 글자 상자
// (measureText의 actualBoundingBox × 현재 변환)의 캔버스 픽셀을 getImageData로 읽는다 = 그 글자 바로 뒤에 이미 그려진 것.
// 투명 픽셀은 캔버스 요소 뒤 CSS 바탕(가장 가까운 불투명 조상 배경, 판이면 surface 남보라)과 합성한다.
// 글자색 = fillStyle(문자열일 때만 — 그라데이션·패턴은 건너뛰고 개수만 보고) × globalAlpha.
// 판정: 상자 픽셀별 대비의 **중앙값**(= 글자 뒤 주된 바탕)이 기준 이상(4.5, 큰 글자 24px+ 또는 굵은 18.66px+ 는 3).
// 하위 10% 값(벽돌·공 등 지나가는 그림 위)도 기록하지만 판정에는 쓰지 않는다 — 움직이는 그림 위 순간 겹침은 캡처로 본다.
// 글자 크기는 CSS px(캔버스 내부 해상도 ÷ 화면 크기 × 변환 배율)로 환산한다.
// 같은 (글자 모양, 색, 글꼴) 묶음은 0.4초에 한 번, 최대 12번만 잰다(매 프레임 getImageData는 느림).
// 한계: strokeText(외곽선 글자)·그림자·DOM 위 덮개는 재지 않는다(DOM 쪽은 게이트가 본다). 레시피가 닿지 않은 상태의 글자는 안 잼.
// 미달이 있거나, 캔버스 게임인데 잰 글자가 0개이고 '글자 없음'으로 적어 두지 않은 게임이면 exit 1.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const DEFAULT = 'breakout,pong,bubble-shooter,flappy,space-shooter,tower-stack,flywheel,ripple,latch,backspace'
const url = opt('url')
const slugs = opt('slugs', DEFAULT).split(',').filter(Boolean)
const seconds = Number(opt('seconds', 4))
const out = opt('out')
const shots = opt('shots')
const WIDTHS = (opt('widths', '390,1440')).split(',').map(Number)

/** 게임판 캔버스(덮개 Confetti 캔버스는 role=alertdialog 안이라 첫 번째가 아님) */
const BOARD_CANVAS = 'main[data-game-page] canvas:not([role="alertdialog"] canvas)'

/** 캔버스에 글자를 아예 쓰지 않는 게임(소스에 fillText 0 — 점수·안내는 전부 DOM HUD, 게이트가 봄): 0개여도 통과. */
const NO_CANVAS_TEXT = new Set(['breakout', 'pong', 'bubble-shooter', 'flappy', 'space-shooter', 'latch'])
/** 캔버스 글자가 조건부라 몇 초 막 누르기로는 안 뜰 수 있는 게임: 0개면 통과가 아니라 '미측정'으로 따로 보고(손 확인 대상).
 * tower-stack = 연속 완벽 쌓기 때만 뜨는 'PERFECT ×N'. */
const CONDITIONAL_TEXT = new Set(['tower-stack'])

/** 몇 초 플레이: 판 가운데를 누르고(시작), 좌우·스페이스·위를 번갈아, 판 여기저기를 누른다. 규칙과 무관한 '사람 손' 흉내. */
async function play(page, ms) {
  const board = page.locator(BOARD_CANVAS).first()
  const box = await board.boundingBox({ timeout: 3000 }).catch(() => null)
  if (!box) return
  // 판이 끝나 덮개가 뜨면 누르지 않는다(덮개의 'Next: …' 링크를 눌러 다른 게임으로 가 버리지 않게) — 키만 계속
  const overlayUp = () => page.locator('[role="alertdialog"]').count().then((n) => n > 0)
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy]
  if (!(await overlayUp())) await page.mouse.click(...at(0.5, 0.6))
  await page.keyboard.press('Space')
  const keys = ['ArrowLeft', 'ArrowRight', 'Space', 'ArrowUp', 'ArrowRight', 'ArrowLeft']
  const spots = [[0.3, 0.7], [0.7, 0.7], [0.5, 0.5], [0.2, 0.4], [0.8, 0.4]]
  const end = Date.now() + ms
  for (let i = 0; Date.now() < end; i++) {
    await page.keyboard.press(keys[i % keys.length])
    if (i % 2 === 0 && !(await overlayUp())) {
      const [x, y] = at(...spots[i % spots.length])
      await page.mouse.move(x, y, { steps: 3 })
      await page.mouse.click(x, y)
    }
    await page.waitForTimeout(180)
  }
}

/** 페이지보다 먼저: fillText 감싸기 + 결과를 window.__gardenCanvasText에 모은다. */
function instrument() {
  const records = new Map()
  window.__gardenCanvasText = records
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  let pctx = null
  const toRGBA = (css) => {
    pctx ??= probe.getContext('2d', { willReadFrequently: true })
    pctx.clearRect(0, 0, 1, 1)
    pctx.fillStyle = '#000'
    pctx.fillStyle = css
    pctx.fillRect(0, 0, 1, 1)
    const d = pctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }
  const over = (t, u) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3])).concat(1)
  const lum = (c) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  /** 캔버스 요소 뒤 CSS 바탕: 가장 가까운 불투명 배경색(그라데이션이면 첫 색). */
  const backdropOf = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      const bg = toRGBA(cs.backgroundColor)
      if (bg[3] >= 1) return bg
      const stop = cs.backgroundImage !== 'none' && cs.backgroundImage.match(/(rgba?|oklab|oklch|color)\([^)]*\)/)
      if (stop) {
        const c = toRGBA(stop[0])
        if (c[3] >= 1) return c
      }
    }
    return toRGBA(getComputedStyle(document.body).backgroundColor)
  }
  const orig = CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
    try {
      const canvas = this.canvas
      // Confetti 등 덮개 캔버스는 판 그림이 아니다 — 게임 페이지 main 안의 게임 캔버스만(정원 틀 전 빌드와 비교할 수 있게 판 표시는 안 따짐)
      if (canvas && canvas.isConnected && canvas.closest('main[data-game-page]') && !canvas.closest('[role="alertdialog"]')) {
        const str = String(text)
        const shape = str.replace(/\d/g, '0')
        const fill = typeof this.fillStyle === 'string' ? this.fillStyle : null
        const key = `${shape}|${fill ?? 'gradient'}|${this.font}`
        let rec = records.get(key)
        const now = performance.now()
        if (!rec) {
          rec = { text: str, font: this.font, fill: fill ?? '(gradient/pattern)', samples: 0, last: -1e9, medians: [], p10s: [], bgs: [], cssPx: 0 }
          records.set(key, rec)
        }
        if (fill && rec.samples < 12 && now - rec.last > 400) {
          rec.last = now
          const m = this.measureText(str)
          const t = this.getTransform()
          const x0 = x - m.actualBoundingBoxLeft
          const x1 = x + m.actualBoundingBoxRight
          const y0 = y - m.actualBoundingBoxAscent
          const y1 = y + m.actualBoundingBoxDescent
          const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([px, py]) => [t.a * px + t.c * py + t.e, t.b * px + t.d * py + t.f])
          const bx0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))))
          const by0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))))
          const bx1 = Math.min(canvas.width, Math.ceil(Math.max(...pts.map((p) => p[0]))))
          const by1 = Math.min(canvas.height, Math.ceil(Math.max(...pts.map((p) => p[1]))))
          const rect = canvas.getBoundingClientRect()
          if (bx1 > bx0 && by1 > by0 && rect.width > 0) {
            const data = this.getImageData(bx0, by0, bx1 - bx0, by1 - by0).data
            const back = backdropOf(canvas)
            const fgRaw = toRGBA(fill)
            fgRaw[3] *= this.globalAlpha
            const rs = []
            const step = Math.max(1, Math.floor(data.length / 4 / 4000)) * 4 // 큰 글자는 표본 4,000점
            const bgCount = new Map()
            for (let i = 0; i < data.length; i += step) {
              const bg = over([data[i], data[i + 1], data[i + 2], data[i + 3] / 255], back)
              rs.push(ratio(over(fgRaw, bg), bg))
              const h = hex(bg)
              bgCount.set(h, (bgCount.get(h) ?? 0) + 1)
            }
            rs.sort((a, b) => a - b)
            rec.medians.push(rs[Math.floor(rs.length / 2)])
            rec.p10s.push(rs[Math.floor(rs.length * 0.1)])
            rec.bgs.push([...bgCount].sort((a, b) => b[1] - a[1])[0][0])
            const px = parseFloat((this.font.match(/([\d.]+)px/) ?? [0, 0])[1])
            const scale = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)) * (rect.width / canvas.width)
            rec.cssPx = Math.round(px * scale * 10) / 10
            rec.bold = /\b(bold|[6-9]00)\b/.test(this.font)
            rec.samples++
          }
        }
      }
    } catch {
      // 측정 실패가 게임을 깨면 안 된다
    }
    return orig.call(this, text, x, y, maxWidth)
  }
}

if (!url) {
  console.error('usage: node scripts/garden-canvas-contrast.mjs --url URL [--slugs a,b] [--seconds 4] [--out path] [--shots dir]')
  process.exit(1)
}
if (shots) mkdirSync(shots, { recursive: true })
const browser = await chromium.launch()
const report = {}
let bad = 0
for (const slug of slugs) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } })
    await ctx.addInitScript(instrument)
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/api/**', (r) => r.fulfill({ status: 404, body: '' }))
    await page.goto(`${url}/${slug}`)
    await page.locator(BOARD_CANVAS).first().waitFor()
    await page.waitForTimeout(600)
    // 판(정원 틀이면 data-garden-board, 예전 빌드면 캔버스를 품은 게임 셸)을 화면에 두고 찍는다
    const board = (await page.locator('[data-garden-board]').count()) ? page.locator('[data-garden-board]') : page.locator(BOARD_CANVAS).first().locator('xpath=../..')
    await board.scrollIntoViewIfNeeded()
    if (shots) await board.screenshot({ path: join(shots, `canvas-${slug}-${width}-ready.jpg`), type: 'jpeg', quality: 72 })
    await play(page, seconds * 1000 * 0.6)
    if (shots) await board.screenshot({ path: join(shots, `canvas-${slug}-${width}-play.jpg`), type: 'jpeg', quality: 72 })
    await play(page, seconds * 1000 * 0.4)
    const rows = await page.evaluate(() =>
      [...window.__gardenCanvasText.values()].map((r) => {
        const med = r.medians.length ? Math.min(...r.medians) : null
        const need = r.cssPx >= 24 || (r.cssPx >= 18.66 && r.bold) ? 3 : 4.5
        return {
          text: r.text.slice(0, 40),
          fill: r.fill,
          font: r.font,
          cssPx: r.cssPx,
          samples: r.samples,
          // 여러 번 잰 것 중 가장 나쁜 중앙값(= 글자 뒤 주된 바탕)과 그때까지의 하위 10%
          ratio: med === null ? null : Math.round(med * 100) / 100,
          p10: r.p10s.length ? Math.round(Math.min(...r.p10s) * 100) / 100 : null,
          bg: r.bgs[r.medians.indexOf(med)] ?? null,
          need,
        }
      }),
    )
    const measured = rows.filter((r) => r.ratio !== null)
    const fails = measured.filter((r) => r.ratio < r.need)
    const unmeasured = measured.length === 0 && CONDITIONAL_TEXT.has(slug)
    const empty = measured.length === 0 && !NO_CANVAS_TEXT.has(slug) && !unmeasured
    bad += fails.length + (empty ? 1 : 0) + errors.length
    const min = measured.length ? Math.min(...measured.map((r) => r.ratio)) : null
    report[`${slug}-${width}`] = { status: unmeasured ? 'unmeasured-conditional' : NO_CANVAS_TEXT.has(slug) ? 'no-canvas-text' : 'measured', measured: measured.length, skipped: rows.length - measured.length, min, fails: fails.length, errors, rows }
    console.log(
      `${slug} ${width}: 캔버스 글자 ${measured.length}종${rows.length - measured.length ? ` (그라데이션 등 건너뜀 ${rows.length - measured.length})` : ''}` +
        ` · 최저 ${min ?? '-'}:1 · 미달 ${fails.length}${empty ? ' · 잰 글자 0(목록 밖) ✗' : ''}${unmeasured ? ' · 미측정(조건부 글자 — 손 확인)' : ''}${errors.length ? ` · 페이지 오류 ${errors.length}` : ''}`,
    )
    for (const f of fails) console.log(`   ✗ '${f.text}' ${f.fill} on ${f.bg} = ${f.ratio} < ${f.need} (${f.cssPx}px)`)
    await ctx.close()
  }
}
await browser.close()
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
process.exit(bad ? 1 : 0)
