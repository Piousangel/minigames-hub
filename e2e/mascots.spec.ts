import { expect, test, type Page } from '@playwright/test'

/**
 * 리디자인 v2 R6 마스코트 배치 — D6 체크리스트 자동 검사.
 * ① 한 뷰포트에 마스코트 1마리 이하(히어로 키아트 제외 — 키아트는 data-mascot이 아니다).
 *    스크롤 위치를 뷰포트 높이 간격으로 옮기며 보이는 `img[data-mascot]`을 센다. `[data-mascot-group]`(선반 disc 4장)은 1로 센다.
 * ② 광고 띠와 마스코트 그림 사이 세로 거리 ≥ 400px.
 *    광고가 꺼져 있으면(지금) HomeAdBand는 DOM이 없다 → 광고 바로 앞 블록 `[data-ad-after]`의 아랫변을 선으로 잰다.
 *    광고가 켜지면 띠 윗변 = 이 선 + 48px(mt-12), 아래 내용은 띠 높이 + 48px만큼 밀린다 → 아래 마스코트까지의 실제 거리는
 *    이 선 기준 거리와 같고, 위 마스코트까지는 48px 더 멀다. 즉 이 선 기준 거리는 실제 거리의 하한(보수적).
 *    광고가 켜진 빌드에선 실제 `[data-testid="home-ad"]` 상자를 잰다.
 * ③ 결과 시트 마스코트 1개(보미 countdown) — result-sheet.spec.ts.
 */

const AD_GAP = 400

type Unit = { name: string; top: number; bottom: number }

async function mascotUnits(page: Page): Promise<Unit[]> {
  return page.evaluate(() => {
    const units = new Map<Element, { name: string; top: number; bottom: number }>()
    for (const img of document.querySelectorAll<HTMLImageElement>('img[data-mascot]')) {
      const r = img.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(img).visibility === 'hidden') continue // 숨은 것
      const key = img.closest('[data-mascot-group]') ?? img
      const name = key === img ? img.dataset.mascot! : `group:${(key as HTMLElement).dataset.mascotGroup}`
      const top = r.top + scrollY
      const bottom = r.bottom + scrollY
      const u = units.get(key)
      units.set(key, u ? { name, top: Math.min(u.top, top), bottom: Math.max(u.bottom, bottom) } : { name, top, bottom })
    }
    return [...units.values()].sort((a, b) => a.top - b.top)
  })
}

async function adBands(page: Page): Promise<{ name: string; top: number; bottom: number }[]> {
  return page.evaluate(() => {
    const real = [...document.querySelectorAll<HTMLElement>('[data-testid="home-ad"]')]
    if (real.length > 0) {
      return real.map((el, i) => {
        const r = el.getBoundingClientRect()
        return { name: `ad${i + 1}`, top: r.top + scrollY, bottom: r.bottom + scrollY }
      })
    }
    return [...document.querySelectorAll<HTMLElement>('[data-ad-after]')].map((el) => {
      const line = el.getBoundingClientRect().bottom + scrollY
      return { name: `after:${el.dataset.adAfter}`, top: line, bottom: line }
    })
  })
}

async function checkD6(page: Page) {
  const vh = page.viewportSize()!.height
  const units = await mascotUnits(page)
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  // ① 뷰포트 높이 간격 스크롤 위치마다 보이는 마스코트 단위 수
  for (let y = 0; y < height; y += vh) {
    const seen = units.filter((u) => u.bottom > y && u.top < y + vh)
    expect(seen.length, `scrollY ${y}: ${seen.map((u) => u.name).join(', ')}`).toBeLessThanOrEqual(1)
  }
  // ② 광고 띠 ↔ 마스코트 세로 거리
  const ads = await adBands(page)
  expect(ads.length, '홈 광고 자리 2곳').toBe(2)
  for (const ad of ads) {
    for (const u of units) {
      const gap = u.top >= ad.bottom ? u.top - ad.bottom : ad.top - u.bottom
      expect(gap, `${ad.name} ↔ ${u.name}`).toBeGreaterThanOrEqual(AD_GAP)
    }
  }
  return units
}

/** lazy 그림까지 실제 크기로 잡히게 끝까지 한 번 내렸다가 올린다(자리는 width/height로 이미 잡혀 있다). */
async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 50))
    }
    scrollTo(0, 0)
  })
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`D6 마스코트 배치 ${viewport.width}`, () => {
    test.use({ viewport })

    test('홈: 한 뷰포트 1마리·광고 400px·선반 disc 4장·About 해씨', async ({ page }) => {
      await page.goto('/')
      await settle(page)
      const units = await checkD6(page)
      expect(units.map((u) => u.name)).toEqual(['group:shelf', 'haessi-guide'])
      // 선반 disc: 말랑 Puzzle · 토리 Arcade · 해씨 Classic(하늘색 바탕) · 보미 Skill
      const discs = page.locator('[data-mascot-group="shelf"] img[data-mascot]')
      await expect(discs).toHaveCount(4)
      expect(await discs.evaluateAll((els) => els.map((e) => e.getAttribute('data-mascot')))).toEqual([
        'mallang-idle',
        'tori-idle',
        'haessi-idle',
        'bomi-idle',
      ])
      const haessiDisc = page.getByTestId('shelf-classic').locator('span').first()
      expect(await haessiDisc.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(191, 230, 255)')
      // 모든 마스코트: lazy·크기 지정·장식 alt
      const attrs = await page.locator('img[data-mascot]').evaluateAll((els) =>
        els.map((e) => ({ loading: e.getAttribute('loading'), w: e.getAttribute('width'), h: e.getAttribute('height'), alt: e.getAttribute('alt') })),
      )
      for (const a of attrs) expect(a).toEqual({ loading: 'lazy', w: expect.any(String), h: expect.any(String), alt: '' })
    })

    test('홈 빈 상태: 검색 0 → 해씨 think 1마리(다른 마스코트는 접힘), D6 유지', async ({ page }) => {
      await page.goto('/')
      const search = page.getByRole('searchbox').first()
      await search.fill('zzqqxx')
      const empty = page.getByTestId('browse-empty')
      await expect(empty).toBeVisible()
      await expect(empty.locator('img[data-mascot="haessi-think"]')).toHaveCount(1)
      // 검색을 지우면 선반 disc·About 해씨가 돌아온다
      const restore = async () => {
        await search.fill('')
        await expect(page.locator('[data-mascot-group="shelf"] img').first()).toHaveCSS('visibility', 'visible')
        await expect(page.locator('img[data-mascot="haessi-guide"]')).toHaveCSS('visibility', 'visible')
        await search.fill('zzqqxx')
        await expect(empty).toBeVisible()
      }
      await restore()
      await settle(page)
      const units = await checkD6(page)
      expect(units.map((u) => u.name)).toEqual(['haessi-think']) // 선반 disc·About 해씨는 그동안 접힌다(visibility)
    })

    test('404: 정원 카드 + 말랑 dizzy 1마리', async ({ page }) => {
      const res = await page.goto('/no-such-page-r6')
      expect(res?.status()).toBe(404)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('in the garden')
      await expect(page.locator('img[data-mascot]')).toHaveCount(1)
      await expect(page.locator('img[data-mascot="mallang-dizzy"]')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Back to the garden' })).toHaveAttribute('href', '/')
    })
  })
}
