import { expect, test } from '@playwright/test'

// 폰(390×844)에서 조작 버튼 전부가 첫 화면 안에 있어야 한다 — 스크롤하면 판이 가려진다.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test('tetris 390: 터치 조작 버튼 5개가 스크롤 없이 한 화면 안, 44px 이상', async ({ page }) => {
  await page.goto('/tetris')
  await expect(page.getByTestId('tetris-board')).toBeVisible()
  const labels = ['Move left', 'Rotate', 'Move right', 'Soft drop', 'Hard drop']
  for (const label of labels) {
    const box = await page.getByRole('button', { name: label, exact: true }).boundingBox()
    expect(box, label).not.toBeNull()
    expect(box!.y + box!.height, `${label} 하단이 뷰포트(844) 안`).toBeLessThanOrEqual(844)
    expect(box!.width, `${label} 너비`).toBeGreaterThanOrEqual(44)
    expect(box!.height, `${label} 높이`).toBeGreaterThanOrEqual(44)
  }
})
