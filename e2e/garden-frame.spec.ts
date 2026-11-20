import { expect, test, type Page } from '@playwright/test'
import { GARDEN_BATCHES, GARDEN_ORIGINALS } from '../src/lib/games/gardenRollout'

/**
 * 리디자인 v2 R7 「정원 틀」 배치 게이트(계획서 3장 R7a~f).
 * 배치 게임마다: ① main[data-world="garden"] + 밤 정원 게임판 ② 로드 + 첫 입력(페이지 오류 0)
 * ③ 자동 대비 검사 — main 안의 보이는 글자 요소 전부, 글자색/뒤 배경 대비 ≥ 4.5(큰 글자 3.0), 실패 0
 * ④ D11 게임판 ↔ 게임 페이지 광고 ≥ 150px.
 *    광고가 꺼져 있으면(지금) AdSlot은 DOM이 없다 → 광고 바로 앞 표시 `[data-ad-after="game-incontent"]`(높이 0)의
 *    아랫변 + 40px(광고의 mt-10)을 광고 윗변으로 잰다. 켜진 빌드에선 실제 `ins.adsbygoogle` 상자를 잰다.
 * 새 배치는 gardenRollout.ts에 키만 늘리면 이 파일이 자동으로 검사한다.
 */

const AD_GAP = 150
const AD_MARGIN_TOP = 40

type ContrastFail = { text: string; fg: string; bg: string; ratio: number; need: number }

/** 페이지 안에서 실행: main 안 보이는 글자 요소의 대비를 잰다. */
async function contrastFailures(page: Page): Promise<{ checked: number; skipped: number; fails: ContrastFail[] }> {
  return page.evaluate(() => {
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
    const over = (top: RGBA, under: RGBA): RGBA => {
      const a = top[3]
      return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]
    }
    const lum = (c: RGBA) => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const ratio = (a: RGBA, b: RGBA) => {
      const x = lum(a)
      const y = lum(b)
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
    const hex = (c: RGBA) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

    /** 뒤 배경 후보(그라데이션은 색 멈춤마다 하나 — 가장 나쁜 것으로 판정). null = 그림 위(판정 불가 → 건너뜀) */
    const backgrounds = (el: Element): RGBA[] | null => {
      const layers: RGBA[] = []
      let base: RGBA[] = [toRGBA(getComputedStyle(document.body).backgroundColor)]
      for (let n: Element | null = el; n; n = n.parentElement) {
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

    const main = document.querySelector('main[data-game-page]')!
    const fails: ContrastFail[] = []
    let checked = 0
    let skipped = 0 // 그림(url) 배경 위 글자 — 판정 불가, 개수를 보고한다
    for (const el of main.querySelectorAll<HTMLElement>('*')) {
      const own = [...el.childNodes]
        .filter((c) => c.nodeType === Node.TEXT_NODE)
        .map((c) => c.textContent ?? '')
        .join('')
        .trim()
      if (!/[\p{L}\p{N}]/u.test(own)) continue // 글자·숫자 없는 것(이모지·기호만)은 대비 대상 아님
      if (el.closest('svg, canvas, [disabled], [aria-disabled="true"]')) continue // 비활성 컨트롤은 WCAG 예외
      const r = el.getBoundingClientRect()
      if (r.width <= 1 || r.height <= 1) continue // sr-only
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden') continue
      let op = 1
      for (let n: HTMLElement | null = el; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity)
      if (op === 0) continue
      const bgs = backgrounds(el)
      if (!bgs) {
        skipped++
        continue
      }
      checked++
      const size = parseFloat(cs.fontSize)
      const bold = Number(cs.fontWeight) >= 700
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
      const fgRaw = toRGBA(cs.color)
      let worst = Infinity
      let worstBg = bgs[0]
      for (const bg of bgs) {
        const fg = over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * op], bg)
        const cr = ratio(fg, bg)
        if (cr < worst) {
          worst = cr
          worstBg = bg
        }
      }
      if (worst < need) {
        fails.push({ text: own.slice(0, 40), fg: cs.color, bg: hex(worstBg), ratio: Math.round(worst * 100) / 100, need })
      }
    }
    return { checked, skipped, fails }
  })
}

/** Reveal(스크롤 등장)까지 다 보이게 끝까지 한 번 내렸다가 올린다. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
    scrollTo(0, 0)
  })
  await page.waitForTimeout(400)
}

async function adGap(page: Page): Promise<number> {
  return page.evaluate((margin) => {
    const board = document.querySelector('[data-garden-board]')!.getBoundingClientRect().bottom + scrollY
    const real = document.querySelector('ins.adsbygoogle')
    const adTop = real
      ? real.getBoundingClientRect().top + scrollY
      : document.querySelector('[data-ad-after="game-incontent"]')!.getBoundingClientRect().bottom + scrollY + margin
    return adTop - board
  }, AD_MARGIN_TOP)
}

const batchSlugs = Object.entries(GARDEN_BATCHES).flatMap(([batch, slugs]) => slugs.map((slug) => ({ batch, slug })))

test.describe('정원 틀 배치(R7)', () => {
  test.describe.configure({ timeout: 60_000 })

  for (const { batch, slug } of batchSlugs) {
    test(`[${batch}] ${slug}: 로드·첫 입력·대비·광고 150px (390·1440)`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      // 리액션은 /api 가 없는 정적 서버에선 숨는다 → 정원 스타일까지 검사하려고 응답을 흉내 낸다
      await page.route('**/api/reactions**', (route) =>
        route.fulfill({ json: { counts: { '🔥': 12, '😂': 3, '😭': 1, '💀': 0 } } }),
      )
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
        await page.goto(`/${slug}`)
        const main = page.locator('main[data-game-page]')
        await expect(main).toHaveAttribute('data-world', 'garden')
        const board = page.locator('[data-garden-board]')
        await expect(board).toBeVisible()
        // 게임 청크가 들어와 판이 그려졌다(로딩 자리 420px 펄스가 아닌 실제 게임)
        await expect(board.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
        await expect(page.getByTestId('reactions')).toBeVisible()
        // 가로 스크롤 없음
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} 가로 스크롤`).toBe(true)

        await settle(page)
        const { checked, skipped, fails } = await contrastFailures(page)
        test.info().annotations.push({ type: 'contrast', description: `${slug} ${width}: 검사 ${checked} · 그림 위 건너뜀 ${skipped}` })
        expect(checked, '검사한 글자 요소 수').toBeGreaterThan(20)
        expect(fails, `${slug} ${width} 대비 실패`).toEqual([])

        expect(await adGap(page), `${slug} ${width} 게임판 ↔ 광고`).toBeGreaterThanOrEqual(AD_GAP)
      }

      // 첫 입력: 게임판 가운데(대부분 보드 칸·시작 버튼 자리 — 맨 앞 버튼은 흔히 🔊 음소거라 쓰지 않는다)를 누르고
      // 방향키·스페이스 — 페이지 오류 없이 판이 살아 있다. 게임별 상태 변화는 smoke.spec.ts의 개별 테스트가 본다.
      const boardEl = page.locator('[data-garden-board]')
      const box = (await boardEl.boundingBox())!
      // force: 판 자식(칸·버튼)이 클릭을 받는 것이 정상이라 가로채기 검사를 끈다(스크롤은 Playwright가 맞춘다)
      await boardEl.click({ position: { x: box.width / 2, y: box.height / 2 }, force: true })
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Space')
      await page.waitForTimeout(300)
      await expect(page.locator('[data-garden-board]')).toBeVisible()
      expect(errors, `${slug} 페이지 오류`).toEqual([])
    })
  }

  test('배치 밖 게임은 예전 그대로(스코프 없음, 어두운 바탕)', async ({ page }) => {
    await page.goto('/kakuro')
    const main = page.locator('main[data-game-page]')
    await expect(main).not.toHaveAttribute('data-world', /.+/)
    await expect(page.locator('[data-garden-board]')).toHaveCount(0)
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(8, 8, 15)')
    // 전역 토큰은 그대로(D7)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--neon-cyan').trim())).toBe('#22d3ee')
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark')
  })

  test('오리지널 3종은 자기 방(정원 틀 매핑 없음)', async ({ page }) => {
    for (const slug of GARDEN_ORIGINALS) {
      await page.goto(`/${slug}`)
      await expect(page.locator('main[data-game-page]')).toHaveAttribute('data-world', 'garden-room')
      await expect(page.locator('[data-garden-board]')).toHaveCount(0)
    }
  })
})
