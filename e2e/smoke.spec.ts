import { expect, test } from '@playwright/test'

test('홈에서 게임 카드로 이동할 수 있다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Free Online Mini Games')
  await page.getByRole('link', { name: /2048 Animals/ }).click()
  await expect(page).toHaveURL(/\/2048-animals/)
  await expect(page.getByTestId('board')).toBeVisible()
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

test('snake: 시작 → 자동 전진 → 벽 충돌 게임오버', async ({ page }) => {
  await page.goto('/snake')
  await expect(page.getByTestId('snake-board')).toBeVisible()
  await page.keyboard.press('ArrowRight') // 시작: 중앙(10,10)에서 오른쪽으로
  // 10칸 × 130ms ≈ 1.3초 뒤 벽 충돌이 결정론적으로 발생
  await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('score')).toBeVisible()
})

test('minesweeper: 첫 클릭 → 안전 공개', async ({ page }) => {
  await page.goto('/minesweeper')
  await expect(page.getByTestId('ms-board')).toBeVisible()
  await page.getByTestId('ms-cell').first().click()
  // 첫 클릭은 항상 안전 → 최소 1칸 공개, 게임오버 아님
  await expect.poll(async () => page.locator('[data-revealed="true"]').count()).toBeGreaterThanOrEqual(1)
  await expect(page.getByTestId('game-over')).not.toBeVisible()
})

test('memory: 두 장 뒤집기 → moves 1', async ({ page }) => {
  await page.goto('/memory-game')
  await expect(page.getByTestId('memory-board')).toBeVisible()
  const cards = page.getByTestId('memory-card')
  await cards.nth(0).click()
  await cards.nth(1).click()
  await expect(page.getByTestId('moves')).toHaveText('1')
})

test('typing: 입력 시작 → 타이머 동작 + WPM 표시', async ({ page }) => {
  await page.goto('/typing-test')
  const input = page.getByTestId('typing-input')
  await expect(input).toBeVisible()
  await input.fill('hello ')
  await expect.poll(async () => page.getByTestId('typing-timer').textContent(), { timeout: 5_000 }).not.toBe('60')
  await expect(page.getByTestId('wpm')).toBeVisible()
})
