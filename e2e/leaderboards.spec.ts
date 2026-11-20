import { expect, test, type Page, type Route } from '@playwright/test'
import { orderBoards } from '../src/lib/leaderboardOrder'
import { gameMeta } from '../src/lib/games/gameMeta'
import { LEADERBOARD_GAMES } from '../src/lib/leaderboard'

/**
 * /leaderboards 정원 틀(리디자인 v2, R6 이월 — 머리 보미).
 * 정적 서버엔 /api가 없어(예전엔 늘 'temporarily unavailable') 응답을 흉내 낸다. 시계는 2026-11-20(금) UTC로 고정 → 주 2026-W47.
 * ① 로드·주 라벨(사람 말)·메달 SVG(이모지 0)·tabular-nums ② 빈 주·로딩·API 실패 상태
 * ③ D6: 마스코트 1마리(보미 deliver), 광고 자리 없음 ④ 390·1440 가로 스크롤 0, 터치 44px ⑤ 자동 대비 검사 실패 0
 */

const NOW = '2026-11-20T03:00:00Z'
const WEEK = '2026-W47'
const BOARDS = {
  snake: [
    { name: 'Mina', score: 48 },
    { name: 'Joon', score: 41 },
    { name: 'Ari', score: 33 },
  ],
  '2048': [{ name: 'Seo', score: 20480 }],
  tetris: [
    { name: 'Kai', score: 1200 },
    { name: 'Lu', score: 900 },
  ],
}

async function mockBoards(page: Page, body: unknown, opts: { status?: number; delayMs?: number } = {}) {
  await page.route('**/api/leaderboards', async (route: Route) => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
    await route.fulfill({ status: opts.status ?? 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.route('**/api/hit**', (route) => route.fulfill({ status: 204, body: '' }))
}

/** main 안 보이는 글자 요소의 글자색/뒤 배경 대비(조상 배경 알파 합성). garden-frame.spec.ts와 같은 방식, 범위만 main 전체. */
async function contrastFailures(page: Page) {
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
    const fails: { text: string; ratio: number }[] = []
    let checked = 0
    for (const el of document.querySelectorAll<HTMLElement>('main *')) {
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
      if (cr < need) fails.push({ text: own.slice(0, 40), ratio: Math.round(cr * 100) / 100 })
    }
    return { checked, fails }
  })
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`leaderboards 정원 틀 ${viewport.width}`, () => {
    test.use({ viewport })
    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(new Date(NOW))
    })

    test('로드: 보미 머리·주 라벨·메달 SVG·이모지 0·가로 스크롤 0·44px·대비', async ({ page }) => {
      await mockBoards(page, { week: WEEK, boards: BOARDS })
      await page.goto('/leaderboards')
      await expect(page.getByRole('heading', { name: 'Leaderboards', level: 1 })).toBeVisible()
      // 주 라벨 = 사람 말(UTC 월~일), ISO 표기·픽셀 폰트 없음
      await expect(page.getByTestId('lb-week')).toContainText('This week · Nov 16–22')
      await expect(page.locator('main')).not.toContainText('2026-W47')
      await expect(page.locator('main .font-pixel')).toHaveCount(0)

      // 점수 있는 보드 3개만 카드로, 순서 = orderBoards(예전 정렬 그대로), 나머지는 접힌 목록
      const cards = page.getByTestId('lb-board')
      await expect(cards).toHaveCount(3)
      const expected = orderBoards(Object.keys(LEADERBOARD_GAMES), BOARDS, gameMeta).active
      expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-slug')))).toEqual(expected)
      await expect(cards.first().getByRole('heading', { level: 2 })).toBeVisible()
      const snake = page.locator('[data-testid="lb-board"][data-slug="snake"]')
      await expect(snake.locator('svg[data-medal]')).toHaveCount(3)
      await expect(snake.getByRole('img', { name: '1st place' })).toBeVisible()
      await expect(snake.locator('li').first()).toContainText('Mina')
      // 한 명뿐인 보드: 메달 3칸(2·3위는 Open spot), 카드 높이는 꽉 찬 보드와 같다
      const solo = page.locator('[data-testid="lb-board"][data-slug="2048"]')
      await expect(solo.getByText('Open spot')).toHaveCount(2)
      expect((await solo.boundingBox())!.height).toBe((await snake.boundingBox())!.height)
      // 점수 숫자 tabular-nums
      const scoreCell = snake.locator('li').first().locator('span').last()
      expect(await scoreCell.evaluate((el) => getComputedStyle(el).fontVariantNumeric)).toContain('tabular-nums')
      await expect(page.getByTestId('lb-empty')).toBeVisible()

      // 이모지 0(메달은 SVG)
      const text = await page.locator('main').innerText()
      expect(text.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([])

      // D6: 마스코트 1마리(보미 deliver 96px), 광고 자리 없음
      const mascots = page.locator('img[data-mascot]')
      await expect(mascots).toHaveCount(1)
      await expect(page.locator('img[data-mascot="bomi-deliver"]')).toBeVisible()
      const m = (await page.locator('img[data-mascot="bomi-deliver"]').boundingBox())!
      expect(Math.round(m.width)).toBe(96)
      const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!
      expect(m.y + m.height).toBeLessThanOrEqual(h1.y)
      await expect(page.locator('ins.adsbygoogle, [data-ad-after], [data-testid="home-ad"]')).toHaveCount(0)

      // 가로 스크롤 0
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      // 터치 44px: main 안 링크·요약(문장 속 링크 없음)
      await page.getByTestId('lb-empty').locator('summary').click()
      const small = await page.locator('main a:visible, main summary:visible').evaluateAll((els) =>
        els.map((e) => ({ t: (e.textContent ?? '').trim().slice(0, 30), h: e.getBoundingClientRect().height })).filter((x) => x.h < 44),
      )
      expect(small).toEqual([])
      // 대비
      const { checked, fails } = await contrastFailures(page)
      expect(checked).toBeGreaterThan(20)
      expect(fails).toEqual([])
    })

    test('빈 주: 기록 0 → 주 라벨 아래 안내 + 카드 없이 펼친 전체 목록(44px 링크)', async ({ page }) => {
      await mockBoards(page, { week: WEEK, boards: {} })
      await page.goto('/leaderboards')
      await expect(page.getByTestId('lb-empty-week')).toBeVisible()
      await expect(page.getByTestId('lb-boards')).toHaveAttribute('aria-busy', 'false')
      await expect(page.getByTestId('lb-board')).toHaveCount(0)
      const list = page.getByTestId('lb-empty')
      await expect(list).toHaveAttribute('open', '')
      await expect(list.locator('summary')).toContainText(`All ${Object.keys(LEADERBOARD_GAMES).length} boards are open`)
      await expect(list.getByRole('link')).toHaveCount(Object.keys(LEADERBOARD_GAMES).length)
      await expect(page.locator('img[data-mascot]')).toHaveCount(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      expect((await contrastFailures(page)).fails).toEqual([])
    })

    test('로딩: 모든 보드 카드가 같은 높이 막대로 먼저 서고(링크는 정적), 데이터가 오면 바뀐다', async ({ page }) => {
      await mockBoards(page, { week: WEEK, boards: BOARDS }, { delayMs: 1500 })
      await page.goto('/leaderboards')
      const list = page.getByTestId('lb-boards')
      await expect(list).toHaveAttribute('aria-busy', 'true')
      const n = await page.getByTestId('lb-board').count()
      expect(n).toBeGreaterThan(10)
      await expect(page.getByRole('status')).toHaveText('Loading scores…')
      await expect(list).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 })
      await expect(page.getByTestId('lb-board')).toHaveCount(3)
    })

    test('API 실패: 정원 안내 카드', async ({ page }) => {
      await mockBoards(page, { error: 'x' }, { status: 500, delayMs: 300 })
      await page.goto('/leaderboards')
      await expect(page.getByTestId('lb-unavailable')).toBeVisible()
      await expect(page.getByTestId('lb-unavailable').getByRole('link', { name: 'Browse all games' })).toHaveAttribute('href', '/#all-games')
    })

    test('CLS: 로딩 → 데이터 / 빈 주 / 실패 모두 ≤ 0.05 (예전 0.53~0.65)', async ({ page }) => {
      await page.addInitScript(() => {
        ;(window as unknown as { __cls: number }).__cls = 0
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
            if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
        }).observe({ type: 'layout-shift', buffered: true })
      })
      const few = { snake: BOARDS.snake }
      for (const [body, status] of [
        [{ week: WEEK, boards: BOARDS }, 200],
        [{ week: WEEK, boards: few }, 200],
        [{ week: WEEK, boards: {} }, 200],
        [{ error: 'x' }, 500],
      ] as const) {
        await page.unrouteAll()
        await mockBoards(page, body, { status, delayMs: 400 })
        await page.goto('/leaderboards')
        await expect(page.getByTestId('lb-boards').or(page.getByTestId('lb-unavailable')).first()).toBeVisible()
        await page.waitForTimeout(900)
        const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
        expect(cls, JSON.stringify(body).slice(0, 40)).toBeLessThanOrEqual(0.05)
      }
    })
  })
}
