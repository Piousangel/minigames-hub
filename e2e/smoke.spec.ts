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

test('tetris: 로드 → 조작 → 점수판 표시', async ({ page }) => {
  await page.goto('/tetris')
  await expect(page.getByTestId('tetris-board')).toBeVisible()
  await page.keyboard.press('Space') // 하드 드롭
  await expect(page.getByTestId('score')).toBeVisible()
})

test('sliding: 로드 → 타일 15개', async ({ page }) => {
  await page.goto('/sliding-puzzle')
  await expect(page.getByTestId('sliding-board')).toBeVisible()
  await expect(page.locator('[data-testid="sliding-board"] button')).toHaveCount(15)
})

test('breakout: 로드 → 캔버스 + 점수판', async ({ page }) => {
  await page.goto('/breakout')
  await expect(page.getByTestId('breakout-board')).toBeVisible()
  await expect(page.getByTestId('score')).toBeVisible()
})

test('word-guess: 로드 → 보드 + 입력 반영', async ({ page }) => {
  await page.goto('/word-guess')
  await expect(page.getByTestId('wordguess-board')).toBeVisible()
  await page.keyboard.type('crane')
  // 첫 행에 입력한 글자가 나타난다
  await expect(page.getByTestId('wordguess-board')).toContainText('C')
})

test('tic-tac-toe: 로드 → 칸 클릭 → 마크 배치', async ({ page }) => {
  await page.goto('/tic-tac-toe')
  await expect(page.getByTestId('ttt-board')).toBeVisible()
  await page.getByTestId('ttt-cell').first().click()
  await expect(page.getByTestId('ttt-board')).toContainText('X')
})

test('reaction-time: 로드 → 패드 표시', async ({ page }) => {
  await page.goto('/reaction-time')
  await expect(page.getByTestId('reaction-pad')).toBeVisible()
})

test('connect-four: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/connect-four')
  await expect(page.getByTestId('c4-board')).toBeVisible()
})

test('hangman: 로드 → 보드 + 글자 추측', async ({ page }) => {
  await page.goto('/hangman')
  await expect(page.getByTestId('hangman-board')).toBeVisible()
  await page.keyboard.press('e')
  await expect(page.getByTestId('hangman-board')).toBeVisible()
})

test('simon: 로드 → 보드 + 4패드', async ({ page }) => {
  await page.goto('/simon')
  await expect(page.getByTestId('simon-board')).toBeVisible()
  await expect(page.getByTestId('simon-pad')).toHaveCount(4)
})

test('whack-a-mole: 로드 → 보드 + 9홀', async ({ page }) => {
  await page.goto('/whack-a-mole')
  await expect(page.getByTestId('whack-board')).toBeVisible()
  await expect(page.getByTestId('whack-hole')).toHaveCount(9)
})

test('aim-trainer: 로드 → 플레이 영역', async ({ page }) => {
  await page.goto('/aim-trainer')
  await expect(page.getByTestId('aim-area')).toBeVisible()
})

test('sudoku: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/sudoku')
  await expect(page.getByTestId('sudoku-board')).toBeVisible({ timeout: 10_000 })
})

test('rock-paper-scissors: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/rock-paper-scissors')
  await expect(page.getByTestId('rps-board')).toBeVisible()
})

test('pong: 로드 → 캔버스 표시', async ({ page }) => {
  await page.goto('/pong')
  await expect(page.getByTestId('pong-board')).toBeVisible()
})

test('lights-out: 로드 → 25칸', async ({ page }) => {
  await page.goto('/lights-out')
  await expect(page.getByTestId('lightsout-board')).toBeVisible()
  await expect(page.getByTestId('lightsout-cell')).toHaveCount(25)
})

test('mastermind: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/mastermind')
  await expect(page.getByTestId('mastermind-board')).toBeVisible()
})

test('bubble-shooter: 로드 → 캔버스 표시', async ({ page }) => {
  await page.goto('/bubble-shooter')
  await expect(page.getByTestId('bubble-board')).toBeVisible()
})

test('nonogram: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/nonogram')
  await expect(page.getByTestId('nonogram-board')).toBeVisible({ timeout: 10_000 })
})

test('sokoban: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/sokoban')
  await expect(page.getByTestId('sokoban-board')).toBeVisible()
})

test('dots-and-boxes: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/dots-and-boxes')
  await expect(page.getByTestId('dab-board')).toBeVisible()
})

test('flappy: 로드 → 캔버스 표시', async ({ page }) => {
  await page.goto('/flappy')
  await expect(page.getByTestId('flappy-board')).toBeVisible()
})

test('checkers: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/checkers')
  await expect(page.getByTestId('checkers-board')).toBeVisible()
})

test('maze: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/maze')
  await expect(page.getByTestId('maze-board')).toBeVisible({ timeout: 10_000 })
})

test('number-memory: 로드 → 영역 표시', async ({ page }) => {
  await page.goto('/number-memory')
  await expect(page.getByTestId('numbermemory-board')).toBeVisible()
})

test('word-search: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/word-search')
  await expect(page.getByTestId('wordsearch-board')).toBeVisible({ timeout: 10_000 })
})

test('reversi: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/reversi')
  await expect(page.getByTestId('reversi-board')).toBeVisible()
})

test('gem-match: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/gem-match')
  await expect(page.getByTestId('gemmatch-board')).toBeVisible({ timeout: 10_000 })
})

test('space-shooter: 로드 → 캔버스 표시', async ({ page }) => {
  await page.goto('/space-shooter')
  await expect(page.getByTestId('space-board')).toBeVisible()
})

test('tower-stack: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/tower-stack')
  await expect(page.getByTestId('stack-board')).toBeVisible()
})

test('prospector: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/prospector')
  await expect(page.getByTestId('prospector-board')).toBeVisible()
})

test('zero-hour: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/zero-hour')
  await expect(page.getByTestId('zero-hour-board')).toBeVisible()
})

test('overload: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/overload')
  await expect(page.getByTestId('overload-board')).toBeVisible()
})

test('ricochet: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/ricochet')
  await expect(page.getByTestId('ricochet-board')).toBeVisible()
})

test('stackpot: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/stackpot')
  await expect(page.getByTestId('stackpot-board')).toBeVisible()
})

test('flywheel: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/flywheel')
  await expect(page.getByTestId('flywheel-board')).toBeVisible()
})
