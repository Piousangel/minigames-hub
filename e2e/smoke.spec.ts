import { expect, test } from '@playwright/test'

test('홈에서 게임 카드로 이동할 수 있다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Free Online Mini Games')
  await page.getByRole('link', { name: /2048 Animals/ }).click()
  await expect(page).toHaveURL(/\/2048-animals/)
})

test('2048: 로드 → 조작 → 상태 변화', async ({ page }) => {
  await page.goto('/2048')
  await expect(page.getByTestId('board')).toBeVisible()
  await expect(page.getByTestId('tile')).toHaveCount(2) // 초기 타일 2개

  // 방향 4개를 눌러 최소 1회 이동을 보장 → 스폰으로 타일 3개 이상
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
    await page.keyboard.press(key)
  }
  await expect
    .poll(async () => page.getByTestId('tile').count())
    .toBeGreaterThanOrEqual(3)
})

test('게임 페이지에 SEO 텍스트 섹션이 있다', async ({ page }) => {
  await page.goto('/2048')
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Strategy/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'FAQ' })).toBeVisible()
})
