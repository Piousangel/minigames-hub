import { expect, test, type Page } from '@playwright/test'

/**
 * 리디자인 v2 R5 데일리 결과 시트(오리지널 3종). 세 게임 모두 실제로 한 판을 끝내 시트를 띄운다.
 * - 도토리: Daily가 기본, 한 번 탭하고 손을 놓으면 떨어져 끝난다.
 * - 뿅 착지: 첫 방문은 연습이라 plop:played=1로 Daily를 연다. 판이 끝날 때까지 뛴다.
 * - 말랑: 오늘(현지 날짜) 앞 스테이지를 모두 지나고 마지막 스테이지에 시도 2개를 쓴 기록을 심은 뒤, 마지막 시도 1번을 실제로 긋는다.
 */

/** 시트 안 '행동 색 sun' 면(bg-garden-sun 클래스). */
async function sunCount(page: Page) {
  return page.getByTestId('daily-result-sheet').evaluate((el) => [...el.querySelectorAll('*')].filter((n) => /(^|\s)bg-garden-sun(\s|$)/.test(n.getAttribute('class') ?? '')).length)
}

async function finishAcorn(page: Page) {
  await page.goto('/acorn-hop')
  const board = page.getByTestId('acornhop-board')
  await expect(board).toBeVisible()
  await board.click({ position: { x: 240, y: 300 } })
  await expect(page.getByTestId('daily-result-sheet')).toBeVisible({ timeout: 30_000 })
}

test.describe('결과 시트(R5)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('도토리: 한 판 끝 → 시트, Share 1개·노란색 1개, 광고 0, Next game 이동', async ({ page }) => {
    await finishAcorn(page)
    const sheet = page.getByTestId('daily-result-sheet')
    await expect(sheet).toHaveAttribute('role', 'dialog')
    await expect(sheet.getByRole('heading', { level: 2 })).toContainText('Today’s garden')
    await expect(sheet.getByTestId('sheet-share')).toHaveCount(1)
    await expect(sheet.getByRole('button', { name: /Share/ })).toHaveCount(1)
    expect(await sunCount(page)).toBe(1)
    await expect(sheet.locator('ins.adsbygoogle, [data-ad-slot]')).toHaveCount(0)
    await expect(page.getByTestId('game-over')).toHaveCount(0) // 예전 오버레이는 연습 판에만
    await expect(sheet.getByTestId('sheet-countdown')).toHaveText(/Next edition in \d\d:\d\d:\d\d/)
    await expect(sheet.getByTestId('sheet-streak')).toHaveText('1')
    const next = sheet.getByTestId('sheet-next-game')
    await expect(next).toBeVisible()
    await next.click()
    await expect(page).toHaveURL(/\?ref=next$/)
    // 시트 history 칸을 바꿔 끼웠다: 뒤로 가기 한 번이면 도토리로(두 번 눌러야 하는 빈 칸 없음)
    await page.goBack()
    await expect(page).toHaveURL(/\/acorn-hop$/)
    await page.goBack()
    await expect(page).not.toHaveURL(/\/acorn-hop$/)
  })

  test('뿅 착지: Daily 한 판 끝 → 시트, Esc·뒤로 가기로 닫히고 다시 열린다', async ({ page }) => {
    test.setTimeout(120_000)
    await page.addInitScript(() => localStorage.setItem('plop:played', '1'))
    await page.goto('/plop-landing')
    const board = page.getByTestId('plop-board')
    await expect(board).toBeVisible()
    await expect(page.getByRole('button', { name: 'daily', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('plop-landed')).toBeVisible() // 그림 로드 전(Loading 칸)엔 입력을 받지 않는다
    // 오늘 시드의 섬 배치는 날마다 달라 '한 번에 첨벙'을 보장할 수 없다: 판이 끝날 때까지 세게(1.25초) 뛰고,
    // 다섯 번째 섬부터는 누르지 않고 기다리면 섬이 가라앉아 끝난다(SINK_FROM).
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
    await expect(sheet.getByTestId('sheet-stats')).toContainText('islands')
    expect(await sunCount(page)).toBe(1)
    // 포커스는 시트 안
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(page).toHaveURL(/\/plop-landing$/)
    await page.getByTestId('open-result-sheet').click()
    await expect(sheet).toBeVisible()
    await page.goBack()
    await expect(sheet).toHaveCount(0)
    await expect(page).toHaveURL(/\/plop-landing$/)
    await expect(board).toBeVisible()
  })

  test('말랑: 마지막 시도로 하루를 끝내면 시트 + 리더보드 제출은 시트 안', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', '1')
      const d = new Date()
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const win = { outcome: 'nest', stars: 2, score: 250, hint: false }
      const miss = { outcome: 'fell', stars: 0, score: 0, hint: false }
      const progress = [...Array.from({ length: 4 }, () => [win]), [miss, miss]] // SLIME_STAGES 5개(stages.ts)
      localStorage.setItem(`slime:daily2:${day}`, JSON.stringify(progress))
    })
    await page.goto('/slime-slide')
    await expect(page.getByText(/1 try left/)).toBeVisible()
    const zone = page.getByTestId('slime-zone')
    await expect(zone).toBeVisible()
    const z = (await zone.boundingBox())!
    // 아래쪽에서 옆으로 천천히 긋는다(스폰 금지 반경·스크롤 손짓 판정을 피해서)
    await page.mouse.move(z.x + z.width * 0.15, z.y + z.height * 0.72)
    await page.mouse.down()
    for (let i = 1; i <= 24; i++) await page.mouse.move(z.x + z.width * (0.15 + 0.03 * i), z.y + z.height * 0.72, { steps: 2 })
    await page.mouse.up()
    const sheet = page.getByTestId('daily-result-sheet')
    await expect(sheet).toBeVisible({ timeout: 45_000 })
    await expect(sheet.getByTestId('sheet-stats')).toContainText('stages')
    await expect(sheet.getByTestId('sheet-stats')).toContainText(/[45]\/5/)
    expect(await sunCount(page)).toBe(1)
    // 진행 중 칸(공유 줄·제출)은 시트로 옮겨 가고, 보드 아래엔 다시 여는 버튼만
    await sheet.getByTestId('sheet-close').click()
    await expect(sheet).toHaveCount(0)
    await expect(page.getByTestId('open-result-sheet')).toBeVisible()
  })

  test('홈 히어로 카드·목차가 완료 기록으로 Bloomed로 바뀐다', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('toc-status-acorn-hop')).toHaveText('Unplayed')
    await finishAcorn(page)
    await page.goto('/')
    await expect(page.getByTestId('toc-status-acorn-hop')).toHaveText('Bloomed')
    await expect(page.getByTestId('today-card')).toHaveAttribute('data-state', 'in-progress')
    await expect(page.getByTestId('today-pill')).toContainText('1/3')
  })

  test('페이지를 열기만 해서는 Bloomed가 되지 않는다(R3 약한 신호 폐기)', async ({ page }) => {
    await page.goto('/plop-landing')
    await expect(page.getByTestId('plop-board')).toBeVisible()
    await page.goto('/')
    await expect(page.getByTestId('toc-status-plop-landing')).toHaveText('Unplayed')
  })
})

test.describe('360×640', () => {
  test.use({ viewport: { width: 360, height: 640 } })

  test('시트는 85dvh 안, 안쪽 스크롤로 끝까지 닿고 잘림·가로 스크롤 0', async ({ page }) => {
    await finishAcorn(page)
    const sheet = page.getByTestId('daily-result-sheet')
    await page.waitForTimeout(500) // 올라오는 모션 끝
    const m = await sheet.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height, sw: el.scrollWidth, cw: el.clientWidth }
    })
    expect(m.h).toBeLessThanOrEqual(640 * 0.85 + 1)
    expect(m.top).toBeGreaterThanOrEqual(0)
    expect(m.bottom).toBeLessThanOrEqual(640 + 1)
    expect(m.sw).toBeLessThanOrEqual(m.cw)
    // 시트 자체가 화면 폭 안(문서 폭은 보지 않는다: 도토리 헤더 버튼 줄이 360에서 23px 넘치는 건 main에서도 그렇다 — docs/team/bugs.md Q6)
    expect(m.left).toBeGreaterThanOrEqual(0)
    expect(m.right).toBeLessThanOrEqual(360)
    // 맨 아래(카운트다운)까지 시트 안 스크롤로 닿는다
    await sheet.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect(sheet.getByTestId('sheet-countdown')).toBeInViewport()
    await expect(sheet.getByTestId('sheet-share')).toHaveCount(1)
  })
})

test.describe('1440 히어로 티켓 줄', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('티켓 3장(Plop · Acorn · 세 번째), 첫 장이 노란 Play와 겹치지 않음', async ({ page }) => {
    await page.goto('/')
    const tickets = page.getByTestId('hero-tickets')
    await expect(tickets).toBeVisible()
    await expect(tickets.getByRole('link')).toHaveCount(3)
    await expect(page.getByTestId('hero-ticket-0')).toHaveAttribute('data-slug', 'plop-landing')
    await expect(page.getByTestId('hero-ticket-1')).toHaveAttribute('data-slug', 'acorn-hop')
    await expect(page.getByTestId('today-play')).toHaveAttribute('href', /\/slime-slide/)
    const [card, rail] = await Promise.all([page.getByTestId('today-card').boundingBox(), tickets.boundingBox()])
    expect(rail!.y).toBeGreaterThan(card!.y + card!.height) // 카드와 겹치지 않는다
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
