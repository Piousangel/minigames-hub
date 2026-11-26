import { expect, test, type Page } from '@playwright/test'

// 폰에서 조작 버튼 전부가 첫 화면 안에 있어야 한다 — 스크롤하면 판이 가려진다.
// 390×844(#245)에 더해 작은 폰 360×740·320×568(#253). 320×568은 높이가 판 하나로 꽉 차서 '첫 화면 안'은 보지 않고 크기만 본다.
const LABELS = ['Move left', 'Rotate', 'Move right', 'Soft drop', 'Hard drop']
const PHONES = [
  { width: 390, height: 844, foldCheck: true },
  { width: 360, height: 740, foldCheck: true },
  { width: 320, height: 568, foldCheck: false },
]

for (const vp of PHONES) {
  test.describe(`tetris ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true })

    test(`터치 조작 버튼 5개가 44px 이상${vp.foldCheck ? ', 스크롤 없이 한 화면 안' : ''}`, async ({ page }) => {
      await page.goto('/tetris')
      await expect(page.getByTestId('tetris-board')).toBeVisible()
      for (const label of LABELS) {
        const box = await page.getByRole('button', { name: label, exact: true }).boundingBox()
        expect(box, label).not.toBeNull()
        if (vp.foldCheck) {
          expect(box!.y + box!.height, `${label} 하단이 뷰포트(${vp.height}) 안`).toBeLessThanOrEqual(vp.height)
        }
        expect(box!.width, `${label} 너비`).toBeGreaterThanOrEqual(44)
        expect(box!.height, `${label} 높이`).toBeGreaterThanOrEqual(44)
      }
    })
  })
}

async function boardBox(page: Page) {
  // 등장 애니메이션(anim-board-in, scale)이 끝난 뒤 잰다 — 도중이면 소수점 차이로 흔들린다.
  await page.getByTestId('tetris-board').evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  const box = await page.getByTestId('tetris-board').boundingBox()
  expect(box).not.toBeNull()
  return box!
}

test.describe('tetris 점수 칸 폭', () => {
  for (const width of [320, 390]) {
    test(`${width}: 숫자 칸 전부 0 → 99999에서 판 위치가 그대로`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/tetris')
      await expect(page.getByTestId('tetris-board')).toBeVisible()
      const before = await boardBox(page)
      // 점수 자릿수만 늘린다(규칙·저장은 건드리지 않음): 화면의 숫자 칸 글자를 바꿔 레이아웃 반응만 잰다.
      // 헤더 칸(Score 등)과 옆 칸(data-tetris-stat: Best·Lines·Level) 모두 다섯 자리로.
      await page.evaluate(() => {
        document
          .querySelectorAll('[data-testid="game-shell-stats"] span.font-bold, [data-tetris-stat]')
          .forEach((el) => {
            el.textContent = '99999'
          })
      })
      const after = await boardBox(page)
      expect(after.x, '판 x').toBe(before.x)
      expect(after.y, '판 y(헤더가 접혀 판이 내려가면 실패)').toBe(before.y)
    })
  }
})

for (const vp of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`tetris ${vp.width}: 게임 오버 결과 시트가 판 위쪽(마지막 쌓인 모습)을 덮지 않는다`, async ({ page }) => {
    await page.setViewportSize(vp)
    await page.goto('/tetris')
    const board = page.getByTestId('tetris-board')
    await expect(board).toBeVisible()
    await page.locator('body').click({ position: { x: 2, y: 2 } })
    await page.keyboard.press('Space') // 시작
    const over = page.getByTestId('game-over')
    for (let i = 0; i < 80 && !(await over.isVisible()); i++) await page.keyboard.press('Space')
    await expect(over).toBeVisible()
    const b = await boardBox(page)
    const o = (await over.boundingBox())!
    // 판 위쪽 35%는 덮개 밖이어야 한다(꼭대기까지 쌓인 블록이 보이게).
    expect(o.y, '결과 시트 위끝').toBeGreaterThanOrEqual(b.y + b.height * 0.35)
    await expect(page.getByRole('button', { name: 'Play again' })).toBeInViewport()
  })
}
