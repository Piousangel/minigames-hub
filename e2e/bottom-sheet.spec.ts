import { expect, test, type Page } from '@playwright/test'

/**
 * 공통 하단 시트(src/components/sheet/BottomSheet.tsx) — 오너 11-20 "손잡이를 잡고 당길 수 있게".
 * 도토리 Daily를 한 판 끝내 결과 시트를 띄운 뒤, 터치 에뮬(CDP Input.dispatchTouchEvent = 실제 터치 → Pointer Events)로 끈다.
 * 오답을 떨어뜨리는 검사: '손잡이가 그려져 있지만 끌어도 안 닫힘'·'스크롤하다 시트가 닫힘'·'닫혔는데 배경이 스크롤돼 있음'.
 */

async function finishAcorn(page: Page) {
  await page.goto('/acorn-hop')
  const board = page.getByTestId('acornhop-board')
  await expect(board).toBeVisible()
  await board.click({ position: { x: 240, y: 300 } })
  await expect(page.getByTestId('daily-result-sheet')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(400) // 올라오는 모션(280ms) 끝
}

/** 터치 끌기. stepMs = 움직임 사이 간격(0이면 '튕기기'). */
async function touchDrag(page: Page, x: number, y0: number, y1: number, { steps = 12, stepMs = 30 } = {}) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] })
    if (stepMs) await page.waitForTimeout(stepMs)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

async function handleCenter(page: Page) {
  const b = (await page.getByTestId('sheet-handle').boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

const transformOf = (page: Page) => page.getByTestId('daily-result-sheet').evaluate((el) => getComputedStyle(el).transform)

test.describe('하단 시트 390 터치', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('손잡이: 짧게 끌면 따라오다 제자리로, 길게 끌면 닫힘, 빠르게 튕기면 닫힘', async ({ page }) => {
    await finishAcorn(page)
    const sheet = page.getByTestId('daily-result-sheet')
    const h = await handleCenter(page)
    const height = (await sheet.boundingBox())!.height

    // ① 짧게(60px, 천천히) → 끄는 동안은 손가락을 따라오고, 놓으면 복귀
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: h.x, y: h.y }] })
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: h.x, y: h.y + i * 10 }] })
      await page.waitForTimeout(40)
    }
    const mid = await transformOf(page)
    expect(mid).toMatch(/matrix\(1, 0, 0, 1, 0, (4\d|5\d)(\.\d+)?\)/) // 60px − 판정 거리 6px ≈ 54
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
    await page.waitForTimeout(450)
    await expect(sheet).toBeVisible()
    expect(await transformOf(page)).toBe('none')

    // ② 길게(높이의 40%, 천천히) → 닫힘, URL 그대로(history 칸만 빠짐)
    await touchDrag(page, h.x, h.y, h.y + height * 0.4, { steps: 30, stepMs: 35 })
    await expect(sheet).toHaveCount(0)
    await expect(page).toHaveURL(/\/acorn-hop$/)
    // 시트가 넣은 history 칸이 빠졌다(남으면 '뒤로 가기 한 번이 먹지 않는' 칸이 생긴다)
    expect(await page.evaluate(() => !!(history.state as Record<string, unknown> | null)?.__dailySheet)).toBe(false)

    // ③ 다시 열고 빠르게 튕기기(90px/48ms — 높이 25% 미만) → 닫힘
    await page.getByTestId('open-result-sheet').click()
    await expect(sheet).toBeVisible()
    await page.waitForTimeout(400)
    const h2 = await handleCenter(page)
    // 튕김은 시간이 생명이라 CDP 왕복(부하 때 100ms+)이 아니라 페이지 안에서 8ms 간격 포인터 이벤트로(실제 손가락 ~120Hz)
    await page.getByTestId('sheet-handle').evaluate((el, { x, y }) => {
      const panel = el.closest('[role="dialog"]')!
      const fire = (type: string, cy: number) => (type === 'pointerdown' ? el : panel).dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: cy, bubbles: true, cancelable: true }))
      const wait = (ms: number) => {
        const t = performance.now()
        while (performance.now() - t < ms) {
          /* 8ms 간격 */
        }
      }
      fire('pointerdown', y)
      for (let i = 1; i <= 6; i++) {
        wait(8)
        fire('pointermove', y + i * 15)
      }
      wait(8)
      fire('pointerup', y + 90)
    }, h2)
    await expect(sheet).toHaveCount(0)
  })

  test('내용 영역: 맨 위에서 아래로 끌면 닫힘, 위로 밀면 스크롤만(시트는 그대로)', async ({ page }) => {
    await finishAcorn(page)
    const sheet = page.getByTestId('daily-result-sheet')
    const title = (await sheet.getByRole('heading', { level: 2 }).boundingBox())!
    const x = title.x + 40
    // 위로 밀기: 시트 안 스크롤(문서는 그대로), 시트 위치 그대로
    const scrollY = await page.evaluate(() => window.scrollY)
    await touchDrag(page, x, title.y + 200, title.y + 20, { steps: 10, stepMs: 20 })
    await page.waitForTimeout(300)
    await expect(sheet).toBeVisible()
    expect(await transformOf(page)).toBe('none')
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)
    // 맨 위로 돌려 두고 내용(제목)을 잡고 길게 끌기 → 닫힘
    await sheet.evaluate((el) => el.scrollTo(0, 0))
    const t2 = (await sheet.getByRole('heading', { level: 2 }).boundingBox())!
    await touchDrag(page, x, t2.y + 10, t2.y + 10 + 360, { steps: 30, stepMs: 30 })
    await expect(sheet).toHaveCount(0)
  })

  test('안쪽이 스크롤된 상태에서 아래로 끌면 스크롤만 — 시트는 닫히지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 }) // 시트 안쪽이 스크롤되는 높이
    await finishAcorn(page)
    const sheet = page.getByTestId('daily-result-sheet')
    const max = await sheet.evaluate((el) => el.scrollHeight - el.clientHeight)
    expect(max).toBeGreaterThan(40)
    await sheet.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    const before = await sheet.evaluate((el) => el.scrollTop)
    const box = (await sheet.boundingBox())!
    await touchDrag(page, box.x + 60, box.y + 120, box.y + 120 + 200, { steps: 20, stepMs: 30 })
    await page.waitForTimeout(400)
    await expect(sheet).toBeVisible()
    expect(await transformOf(page)).toBe('none')
    expect(await sheet.evaluate((el) => el.scrollTop)).toBeLessThan(before) // 스크롤로 소비됐다
  })

  test('배경 탭·Esc·뒤로 가기로 닫히고, 닫히면 연 버튼으로 포커스가 돌아온다', async ({ page }) => {
    await finishAcorn(page)
    const sheet = page.getByTestId('daily-result-sheet')
    const reopen = page.getByTestId('open-result-sheet')
    // 배경 탭(시트 위쪽 어둠)
    await page.getByTestId('sheet-dim').click({ position: { x: 195, y: 40 } })
    await expect(sheet).toHaveCount(0)
    await expect(page).toHaveURL(/\/acorn-hop$/)
    // 버튼으로 열기 → Esc → 포커스 복귀
    await reopen.focus()
    await page.keyboard.press('Enter')
    await expect(sheet).toBeVisible()
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(reopen).toBeFocused()
    // 뒤로 가기
    await reopen.click()
    await expect(sheet).toBeVisible()
    await page.goBack()
    await expect(sheet).toHaveCount(0)
    await expect(page).toHaveURL(/\/acorn-hop$/)
    // 손잡이 = 키보드로 누를 수 있는 Close 버튼
    await reopen.click()
    await expect(sheet).toBeVisible()
    const handle = page.getByTestId('sheet-handle')
    await expect(handle).toHaveAccessibleName('Close')
    await handle.focus()
    await page.keyboard.press(' ')
    await expect(sheet).toHaveCount(0)
  })

  test('배경 스크롤 잠금: 휠·배경 터치 스와이프에 문서가 움직이지 않고, 닫히면 원래 자리', async ({ page }) => {
    await page.goto('/acorn-hop')
    await page.evaluate(() => window.scrollTo(0, 120))
    const board = page.getByTestId('acornhop-board')
    await board.click({ position: { x: 240, y: 200 } })
    const sheet = page.getByTestId('daily-result-sheet')
    await expect(sheet).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(400)
    const y0 = await page.evaluate(() => window.scrollY)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden')
    await page.mouse.move(195, 40)
    await page.mouse.wheel(0, 600)
    await touchDrag(page, 195, 90, 10, { steps: 8, stepMs: 20 }) // 어둠 위에서 위로 스와이프
    await touchDrag(page, 195, 20, 100, { steps: 8, stepMs: 20 }) // 아래로(당겨서 새로고침·고무줄)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.scrollY)).toBe(y0)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    expect(await page.evaluate(() => window.scrollY)).toBe(y0)
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('')
  })

  test('시트 안 누를 것은 모두 44px 이상, 입력칸 글자 16px 이상(iOS 확대 방지) — 공유 채널 줄을 펼친 뒤까지', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) }, configurable: true }))
    await finishAcorn(page)
    await page.evaluate(() => {
      // 데스크톱 경로(복사)로: 터치 기기의 시스템 공유창 대신 채널 줄이 펼쳐지게
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    })
    await page.getByTestId('sheet-share').click()
    await expect(page.getByTestId('daily-result-sheet').getByTestId('share-buttons')).toBeVisible()
    const small = await page.getByTestId('daily-result-sheet').evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')]
        .filter((el) => el.checkVisibility())
        .map((el) => {
          const r = el.getBoundingClientRect()
          const fs = parseFloat(getComputedStyle(el).fontSize)
          return { id: el.dataset.testid ?? el.textContent?.trim().slice(0, 30), h: r.height, w: r.width, input: el.matches('input, select, textarea'), fs }
        })
        .filter((m) => m.h < 44 || m.w < 44 || (m.input && m.fs < 16)),
    )
    expect(small).toEqual([])
  })

  test('모션 줄이기: 열기·닫기 애니메이션 없이 즉시', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await finishAcorn(page)
    const sheet = page.getByTestId('daily-result-sheet')
    const m = await sheet.evaluate((el) => ({ anim: getComputedStyle(el).animationName, running: el.getAnimations().length }))
    expect(m).toEqual({ anim: 'none', running: 0 })
    // 페이지 안에서 Esc → 시트가 DOM에서 빠지기까지 잰다(Playwright 왕복 지연과 무관). 기본은 240ms 퇴장 모션
    const took = page.evaluate(
      () =>
        new Promise<number>((res) => {
          const t0 = performance.now()
          new MutationObserver((_, mo) => {
            if (!document.querySelector('[data-testid="daily-result-sheet"]')) {
              mo.disconnect()
              res(performance.now() - t0)
            }
          }).observe(document.body, { childList: true, subtree: true })
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        }),
    )
    expect(await took).toBeLessThan(150)
  })
})

test.describe('공통 컴포넌트 누르는 영역 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  /** 보이는 크기가 아니라 실제로 눌리는 범위: 가운데에서 위·아래·좌·우 21px 지점이 모두 그 요소에 닿는가(44px 지름). */
  async function tooSmall(page: Page, selector: string) {
    return page.evaluate((sel) => {
      const bad: string[] = []
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (!el.checkVisibility()) continue
        el.scrollIntoView({ block: 'center', inline: 'center' })
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const ok = [
          [cx, cy - 21],
          [cx, cy + 21],
          [cx - 21, cy],
          [cx + 21, cy],
        ].every(([x, y]) => {
          const hit = document.elementFromPoint(x, y)
          return !!hit && (hit === el || el.contains(hit))
        })
        if (!ok) bad.push(`${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
      return bad
    }, selector)
  }

  test('게임 페이지: GameButton·다른 게임 아이콘·모음 칩', async ({ page }) => {
    await page.goto('/chess')
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
    // GameButton(btn-press hit-44) · GameSwitcher(neon-icon) · CollectionLinks 칩
    expect(await tooSmall(page, 'main button.hit-44, main a.neon-icon, main a[href^="/collection/"].min-h-11')).toEqual([])
  })

  test('/daily: 카드 하트·카테고리 칩·빵 부스러기 Home', async ({ page }) => {
    await page.goto('/daily')
    expect(await tooSmall(page, 'main [aria-label$="to My Games"], main a[href^="/category/"], main a.hit-44')).toEqual([])
  })
})

test.describe('하단 시트 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('데스크톱은 가운데 카드: 손잡이 숨김, 마우스로 끌어도 움직이지 않음, 배경 클릭으로 닫힘', async ({ page }) => {
    await finishAcorn(page)
    const sheet = page.getByTestId('daily-result-sheet')
    const box = (await sheet.boundingBox())!
    expect(Math.abs(box.y + box.height / 2 - 450)).toBeLessThan(40) // 세로 가운데
    await expect(page.getByTestId('sheet-handle')).toBeHidden()
    await page.mouse.move(box.x + 100, box.y + 30)
    await page.mouse.down()
    await page.mouse.move(box.x + 100, box.y + 330, { steps: 10 })
    await page.mouse.up()
    expect(await transformOf(page)).toBe('none')
    await expect(sheet).toBeVisible()
    await page.mouse.click(60, 60)
    await expect(sheet).toHaveCount(0)
  })
})
