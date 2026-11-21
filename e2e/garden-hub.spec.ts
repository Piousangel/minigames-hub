import { expect, test, type Page } from '@playwright/test'
import { COLLECTION_SLUGS } from '../src/lib/games/collections'
import { allContent } from '../src/content'
import { NEON_PATTERN } from '../src/components/garden-hub/neonClasses'

/**
 * 리디자인 v2 R9 — 게임 밖 정원 페이지 렌더 게이트(garden-hub). 소스 쪽 전수·네온 0은 src/components/garden-hub/gardenHub.test.ts.
 * 페이지마다(390·1440): ① main[data-world="garden-hub"] ② main 안 네온 클래스 0(NEON_PATTERN) ③ 가로 스크롤 0
 * ④ 글자 대비 실패 0(leaderboards.spec과 같은 계산) ⑤ main 안 누르는 것 44px(본문 속 인라인 링크 제외, elementFromPoint)
 * ⑥ 광고 0(이 페이지들은 광고 자리가 없다) ⑦ 한 뷰포트 마스코트 ≤1(D6).
 */

const ROUTES = [
  ...['puzzle', 'arcade', 'classic', 'skill'].map((c) => `/category/${c}`),
  '/collections',
  ...COLLECTION_SLUGS.map((s) => `/collection/${s}`),
  '/guides',
  ...allContent().map((c) => `/guides/${c.entry.slug}`),
  '/daily',
  '/about',
  '/privacy',
  '/terms',
  '/unblocked',
  '/contact',
  '/no-such-page-r9',
]

async function audit(page: Page) {
  return page.evaluate((neonSrc) => {
    const neon = new RegExp(neonSrc, 'g')
    const main = document.querySelector('main')!
    // ② 네온 클래스
    const neonHits = new Set<string>()
    for (const el of [main, ...main.querySelectorAll('*')]) {
      const cls = el.getAttribute('class') ?? ''
      for (const m of cls.matchAll(neon)) neonHits.add(m[1])
    }
    // ④ 대비
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    type RGBA = [number, number, number, number]
    const toRGBA = (css: string): RGBA => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2], d[3] / 255]
    }
    const over = (t: RGBA, u: RGBA): RGBA => [t[0] * t[3] + u[0] * (1 - t[3]), t[1] * t[3] + u[1] * (1 - t[3]), t[2] * t[3] + u[2] * (1 - t[3]), 1]
    const lum = (c: RGBA) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const ratio = (a: RGBA, b: RGBA) => {
      const [x, y] = [lum(a), lum(b)]
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
    const bgOf = (el: Element): RGBA => {
      const layers: RGBA[] = []
      let base = toRGBA(getComputedStyle(document.body).backgroundColor)
      for (let n: Element | null = el; n; n = n.parentElement) {
        const bg = toRGBA(getComputedStyle(n).backgroundColor)
        if (bg[3] >= 1) {
          base = bg
          break
        }
        if (bg[3] > 0) layers.push(bg)
      }
      return layers.reduceRight((acc, l) => over(l, acc), base)
    }
    const lowContrast: { text: string; ratio: number }[] = []
    let checked = 0
    for (const el of main.querySelectorAll<HTMLElement>('*')) {
      const own = [...el.childNodes].filter((c) => c.nodeType === Node.TEXT_NODE).map((c) => c.textContent ?? '').join('').trim()
      if (!/[\p{L}\p{N}]/u.test(own) || el.closest('svg')) continue
      const r = el.getBoundingClientRect()
      if (r.width <= 1 || r.height <= 1) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden') continue
      let op = 1
      for (let n: HTMLElement | null = el; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity)
      if (op === 0) continue
      checked++
      const size = parseFloat(cs.fontSize)
      const need = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5
      const c = toRGBA(cs.color)
      const bg = bgOf(el)
      const cr = ratio(over([c[0], c[1], c[2], c[3] * op], bg), bg)
      if (cr < need) lowContrast.push({ text: own.slice(0, 40), ratio: Math.round(cr * 100) / 100 })
    }
    return {
      world: main.getAttribute('data-world'),
      neon: [...neonHits],
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      checked,
      lowContrast,
      ads: document.querySelectorAll('ins.adsbygoogle, [data-testid="home-ad"], [data-ad-slot], [data-ad-after]').length,
    }
  }, NEON_PATTERN.source)
}

/** main 안 누르는 것 중 44×44를 못 채우는 것(본문 문장 속 인라인 링크는 WCAG 2.5.8 예외) */
async function smallTargets(page: Page) {
  const els = page.locator('main a[href], main button, main [tabindex="0"]')
  const n = await els.count()
  const bad: string[] = []
  for (let i = 0; i < n; i++) {
    const el = els.nth(i)
    if (!(await el.isVisible())) continue
    const r = await el.evaluate((node) => {
      const inline = node.tagName === 'A' && getComputedStyle(node).display === 'inline' && /^(P|LI|SPAN|TD|FIGCAPTION)$/.test(node.parentElement?.tagName ?? '')
      if (inline || node.getAttribute('role') === 'region') return null
      node.scrollIntoView({ block: 'center' })
      const b = node.getBoundingClientRect()
      const cx = b.left + b.width / 2
      const cy = b.top + b.height / 2
      const ok = [[cx, cy - 21], [cx, cy + 21], [cx - 21, cy], [cx + 21, cy]].every(([x, y]) => {
        const h = document.elementFromPoint(x, y)
        return !!h && (h === node || node.contains(h))
      })
      return ok ? null : `${(node.textContent ?? node.getAttribute('aria-label') ?? '').trim().slice(0, 30)} ${Math.round(b.width)}x${Math.round(b.height)}`
    })
    if (r) bad.push(r)
  }
  return bad
}

/** 한 뷰포트 높이씩 내려가며 보이는 마스코트 수의 최댓값 */
async function maxMascotsPerViewport(page: Page) {
  return page.evaluate(() => {
    const tops = [...document.querySelectorAll<HTMLImageElement>('main img[data-mascot]')].map((i) => {
      const r = i.getBoundingClientRect()
      return [r.top + scrollY, r.bottom + scrollY]
    })
    let max = 0
    for (let y = 0; y < document.documentElement.scrollHeight; y += 50) {
      max = Math.max(max, tops.filter(([t, b]) => b > y && t < y + innerHeight).length)
    }
    return max
  })
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`garden-hub ${viewport.width}`, () => {
    test.use({ viewport })
    for (const route of ROUTES) {
      test(`garden-hub ${route}: 정원 틀·네온 0·대비·44px·가로 스크롤 0·광고 0·마스코트 ≤1`, async ({ page }) => {
        await page.route('**/api/**', (r) => r.fulfill({ status: 204, body: '' }))
        const res = await page.goto(route)
        expect(res?.status(), route).toBe(route === '/no-such-page-r9' ? 404 : 200)
        await expect(page.locator('h1')).toBeVisible()
        const a = await audit(page)
        expect(a.world).toBe('garden-hub')
        expect(a.neon).toEqual([])
        expect(a.overflowX).toBeLessThanOrEqual(0)
        expect(a.checked).toBeGreaterThan(3)
        expect(a.lowContrast).toEqual([])
        expect(a.ads).toBe(0)
        expect(await maxMascotsPerViewport(page)).toBeLessThanOrEqual(1)
        if (viewport.width === 390) expect(await smallTargets(page)).toEqual([])
      })
    }
  })
}

test('garden-hub /daily: 카운트다운 밤 정원 판이 하이드레이션 전에도 자리를 잡는다(CLS 0)', async ({ page }) => {
  await page.goto('/daily')
  const board = page.getByTestId('daily-hub-countdown-board')
  await expect(page.getByTestId('daily-hub-countdown')).toHaveText(/^\d\d:\d\d:\d\d$/)
  expect((await board.boundingBox())!.height).toBe(48)
  const cls = await page.evaluate(
    () =>
      new Promise<number>((res) => {
        let v = 0
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) v += e.value
        }).observe({ type: 'layout-shift', buffered: true })
        setTimeout(() => res(v), 1200)
      }),
  )
  expect(cls).toBeLessThanOrEqual(0.02)
})
