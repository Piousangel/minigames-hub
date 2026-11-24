import { expect, test, type Page } from '@playwright/test'

/**
 * 모바일 가로 넘침(오너 11-22 실기기 제보: 뿅 착지 결과 시트를 열면 상단 헤더가 화면 오른쪽 끝까지 안 닿고 ~7% 짧게 끝남).
 * 원인: 게임 위 한 줄(Score·Best + daily/practice + 소리 + 다시 하기)이 360~399px 폭에서 컨테이너보다 넓어 문서 폭이 뷰포트를 넘었다.
 * 모바일 Chromium(삼성 인터넷·크롬)은 그만큼 레이아웃 뷰포트를 넓혀 축소해 보여 주므로, 문서 흐름 안의 sticky 헤더(ICB 폭)는 짧고
 * fixed인 시트(레이아웃 뷰포트 폭)는 꽉 차서 둘의 폭이 어긋나 보인다.
 * 그래서 데스크톱 뷰포트가 아니라 isMobile 에뮬(레이아웃 뷰포트가 넓어지는 동작 포함)로 잰다.
 */

const WIDTHS = [360, 390] as const
/** 결과 시트 검사는 320도(줄이 두 줄로 바뀌는 폭 — 그래도 넘치지 않아야 한다). */
const SHEET_WIDTHS = [320, 360, 390] as const

/**
 * 가장 넓은 줄이 나오는 '다시 온 사람' 상태로 연다: 뿅 착지는 첫 방문이면 daily/practice 묶음이 없고,
 * Best 칸은 기록 자릿수만큼 넓어진다(오너 캡처는 31점 — 390·412에서도 넘칠 수 있었다) → 네 자리 최고 기록을 심는다.
 */
async function returning(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('plop:played', '1')
      for (const slug of ['plop-landing', 'acorn-hop']) if (!localStorage.getItem(`best:${slug}`)) localStorage.setItem(`best:${slug}`, '9999')
    } catch {
      /* 저장소 막힘 */
    }
  })
}

async function settle(page: Page) {
  await page.waitForLoadState('load')
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForTimeout(300)
}

/** 문서 폭·레이아웃 뷰포트 폭·헤더/시트 오른쪽 끝. 넘치면 오른쪽 끝이 화면 밖인 요소 몇 개를 같이 돌려준다(원인 찾기용). */
async function widthState(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement
    const cw = html.clientWidth
    const right = (s: string) => {
      const el = document.querySelector(s)
      return el ? Math.round(el.getBoundingClientRect().right) : null
    }
    const offenders: string[] = []
    if (html.scrollWidth > cw || window.innerWidth !== cw) {
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.right > cw + 0.5 && offenders.length < 5) offenders.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').slice(0, 50)} →${Math.round(r.right)}`)
      }
    }
    return { scrollWidth: html.scrollWidth, clientWidth: cw, innerWidth: window.innerWidth, header: right('body header'), sheet: right('[role="dialog"][aria-modal="true"]'), offenders }
  })
}

function expectFits(s: Awaited<ReturnType<typeof widthState>>, w: number) {
  expect(s.scrollWidth, s.offenders.join(' | ')).toBeLessThanOrEqual(w)
  expect(s.innerWidth, '레이아웃 뷰포트가 넓어졌다(모바일이 축소 표시)').toBe(w)
  expect(s.header, '헤더 오른쪽 끝 = 뷰포트 폭').toBe(w)
}

/** 사이트맵의 모든 페이지(허브·게임·가이드 등, noindex라 빠진 얇은 목록 페이지 제외). 새 게임이 생기면 저절로 검사에 들어온다. */
async function sitemapPaths(page: Page) {
  const res = await page.request.get('/sitemap.xml')
  const xml = await res.text()
  return [...xml.matchAll(/<loc>https?:\/\/[^/<]+([^<]*)<\/loc>/g)].map((m) => m[1] || '/')
}

const CHUNKS = 4

for (const w of SHEET_WIDTHS) {
  test.describe(`${w}px 모바일: 가로 넘침 0`, () => {
    test.use({ viewport: { width: w, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })

    if ((WIDTHS as readonly number[]).includes(w)) for (let c = 0; c < CHUNKS; c++) {
      test(`사이트맵 페이지 ${c + 1}/${CHUNKS}: 문서 폭 = 뷰포트, 헤더 끝 = 뷰포트`, async ({ page }) => {
        test.setTimeout(300_000)
        await returning(page)
        const paths = (await sitemapPaths(page)).filter((_, i) => i % CHUNKS === c)
        expect(paths.length).toBeGreaterThan(10)
        const bad: string[] = []
        for (const p of paths) {
          await page.goto(p)
          await settle(page)
          const s = await widthState(page)
          if (s.scrollWidth > w || s.innerWidth !== w || s.header !== w) bad.push(`${p} doc=${s.scrollWidth} vp=${s.innerWidth} header=${s.header} ${s.offenders.join(' | ')}`)
        }
        expect(bad).toEqual([])
      })
    }

    test('도토리: 결과 시트 열림 — 시트·헤더 모두 화면 폭', async ({ page }) => {
      await returning(page)
      await page.goto('/acorn-hop')
      const board = page.getByTestId('acornhop-board')
      await expect(board).toBeVisible()
      await board.click({ position: { x: 150, y: 200 } })
      const sheet = page.getByTestId('daily-result-sheet')
      await expect(sheet).toBeVisible({ timeout: 30_000 })
      await settle(page)
      const s = await widthState(page)
      expectFits(s, w)
      expect(s.sheet).toBe(w)
    })

    test('뿅 착지(다시 온 사람): 결과 시트 열림 — 시트·헤더 모두 화면 폭', async ({ page }) => {
      test.setTimeout(120_000)
      await returning(page)
      await page.goto('/plop-landing')
      const board = page.getByTestId('plop-board')
      await expect(board).toBeVisible()
      await expect(page.getByRole('button', { name: 'daily', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('plop-landed')).toBeVisible()
      await settle(page)
      expectFits(await widthState(page), w) // 시트 전(오너 캡처의 원인 줄이 여기서 이미 넘친다)
      // result-sheet.spec과 같은 방법: 세게 뛰고, 다섯 번째 섬부터는 기다려 가라앉게 한다
      const box = (await board.boundingBox())!
      const sheet = page.getByTestId('daily-result-sheet')
      for (let i = 0; i < 20 && !(await sheet.isVisible()); i++) {
        const landed = Number((await page.getByTestId('plop-landed').innerText()).replace(/\D/g, ''))
        if (landed >= 4) {
          await page.waitForTimeout(6000)
          continue
        }
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.waitForTimeout(1250)
        await page.mouse.up()
        await page.waitForTimeout(1800)
      }
      await expect(sheet).toBeVisible({ timeout: 15_000 })
      await settle(page)
      const s = await widthState(page)
      expectFits(s, w)
      expect(s.sheet).toBe(w)
    })
  })
}
