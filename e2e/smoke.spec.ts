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

test('ripple: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/ripple')
  await expect(page.getByTestId('ripple-board')).toBeVisible()
})

test('ticker: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/ticker')
  await expect(page.getByTestId('ticker-board')).toBeVisible()
})

test('overfold: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/overfold')
  await expect(page.getByTestId('overfold-board')).toBeVisible({ timeout: 10_000 })
})

test('splice: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/splice')
  await expect(page.getByTestId('splice-board')).toBeVisible({ timeout: 10_000 })
})

test('quarry: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/quarry')
  await expect(page.getByTestId('quarry-board')).toBeVisible()
})

test('latch: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/latch')
  await expect(page.getByTestId('latch-board')).toBeVisible()
})

test('decant: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/decant')
  await expect(page.getByTestId('decant-board')).toBeVisible()
})

test('backspace: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/backspace')
  await expect(page.getByTestId('backspace-board')).toBeVisible()
})

test('duplex: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/duplex')
  await expect(page.getByTestId('duplex-board')).toBeVisible()
})

// 로컬 정적 서버(serve out)에는 Worker의 /api/leaderboard가 없다. 응답이 없으면
// 컴포넌트가 스스로를 숨기므로(available=false), 보드를 렌더시키려면 API를 목킹한다.
async function mockLeaderboardApi(page: import('@playwright/test').Page) {
  await page.route('**/api/leaderboard**', (route) =>
    route.fulfill({ json: { week: '2026-W29', top: [] } }),
  )
}

test('decant: 리더보드가 best 점수를 읽는다 (레거시 JSON 저장분 포함)', async ({ page }) => {
  // decant는 한때 best:decant에 {score, daily} JSON을 넣었다. 리더보드는 그 키를
  // Number()로 읽으므로 마이그레이션이 없으면 점수가 0이 되어 제출이 막힌다.
  await mockLeaderboardApi(page)
  await page.addInitScript(() => {
    localStorage.setItem(
      'best:decant',
      JSON.stringify({ score: 1234, daily: { lastDate: '2026-07-15', streak: 3 } }),
    )
  })
  await page.goto('/decant')
  await expect(page.getByTestId('decant-board')).toBeVisible()
  await expect(page.getByRole('button', { name: /Submit Score 1,234/ })).toBeVisible()
  // 연속 기록은 전용 키로 옮겨가고 best는 숫자로 정규화된다.
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('best:decant')))
    .toBe('1234')
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('decant:daily')))
    .toContain('"streak":3')
})

test('ticker: 리더보드가 살아 있다 (레거시 blob 저장분 포함)', async ({ page }) => {
  // ticker/zero-hour는 best:<slug>에 통계 blob을 통째로 넣어 리더보드가 Number()→NaN이
  // 되면서 제출 버튼이 영구히 뜨지 않았다. 28개 보드 중 2개가 영원히 빈 보드였다.
  await mockLeaderboardApi(page)
  await page.addInitScript(() => {
    localStorage.setItem('best:ticker', JSON.stringify({ bestW: 4200, bestStreak: 5, streak: 2 }))
  })
  await page.goto('/ticker')
  await expect(page.getByRole('button', { name: /Submit Worth 4,200/ })).toBeVisible()
  // 기록은 숫자로 정규화되고 통계는 전용 키로 옮겨간다.
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('best:ticker'))).toBe('4200')
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('best:ticker:stats')))
    .toContain('"bestStreak":5')
})

test('zero-hour: 리더보드가 살아 있다 (레거시 blob 저장분 포함)', async ({ page }) => {
  await mockLeaderboardApi(page)
  await page.addInitScript(() => {
    localStorage.setItem('best:zero-hour', JSON.stringify({ score: 3300, chain: 7 }))
  })
  await page.goto('/zero-hour')
  await expect(page.getByRole('button', { name: /Submit Score 3,300/ })).toBeVisible()
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('best:zero-hour')))
    .toBe('3300')
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('best:zero-hour:stats')))
    .toContain('"chain":7')
})

test('backspace: 리더보드 제출 UI가 붙어 있다', async ({ page }) => {
  await mockLeaderboardApi(page)
  await page.addInitScript(() => localStorage.setItem('best:backspace', '567'))
  await page.goto('/backspace')
  await expect(page.getByRole('button', { name: /Submit Score 567/ })).toBeVisible()
})

test('2048-animals: 리더보드 제출 UI가 붙어 있다', async ({ page }) => {
  await mockLeaderboardApi(page)
  await page.addInitScript(() => localStorage.setItem('best:2048-animals', '890'))
  await page.goto('/2048-animals')
  await expect(page.getByRole('button', { name: /Submit Score 890/ })).toBeVisible()
})

test('overdub: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/overdub')
  await expect(page.getByTestId('overdub-board')).toBeVisible()
})

test('cleave: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/cleave')
  await expect(page.getByTestId('cleave-board')).toBeVisible()
})

test('umbra: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/umbra')
  await expect(page.getByTestId('umbra-board')).toBeVisible()
})

test('fuse: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/fuse')
  await expect(page.getByTestId('fuse-board')).toBeVisible()
})

test('polytap: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/polytap')
  await expect(page.getByTestId('polytap-board')).toBeVisible()
})

test('polytap: 키 입력 경로가 크래시 없이 돈다', async ({ page }) => {
  // 빌드 에이전트가 브라우저 확인을 못 했다고 명시적으로 보고했다. 입력 경로
  // (Space 시작 → F/J 탭)가 렌더 중에 죽지 않는지만이라도 e2e로 고정한다.
  await page.goto('/polytap')
  await expect(page.getByTestId('polytap-board')).toBeVisible()
  await page.getByTestId('polytap-board').press('Space')
  await page.keyboard.press('f')
  await page.keyboard.press('j')
  await expect(page.getByTestId('polytap-board')).toBeVisible()
})

test('deepdive: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/deepdive')
  await expect(page.getByTestId('deepdive-board')).toBeVisible()
})

test('sonar: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/sonar')
  await expect(page.getByTestId('sonar-board')).toBeVisible()
})

test('handful: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/handful')
  await expect(page.getByTestId('handful-board')).toBeVisible()
})

test('flapjack: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/flapjack')
  await expect(page.getByTestId('flapjack-board')).toBeVisible()
})

test('interlock: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/interlock')
  await expect(page.getByTestId('interlock-board')).toBeVisible()
})

test('clusters: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/clusters')
  await expect(page.getByTestId('clusters-board')).toBeVisible()
})

test('quadle: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/quadle')
  await expect(page.getByTestId('quadle-board')).toBeVisible()
})

test('equate: 로드 → 보드 표시', async ({ page }) => {
  await page.goto('/equate')
  await expect(page.getByTestId('equate-board')).toBeVisible()
})

test('게임 페이지: 목표 한 줄이 보드 위에 노출된다', async ({ page }) => {
  await page.goto('/clusters')
  await expect(page.getByTestId('objective')).toBeVisible()
})

test('pinwheel: 마우스 클릭으로 핀이 꽂힌다', async ({ page }) => {
  // 셀의 onFocus가 핀을 꽂고 onClick 토글이 곧바로 해제해 마우스로는 플레이가
  // 불가능했다. 실제 마우스 클릭은 포커스를 유발하므로 이 경로를 고정한다.
  await page.goto('/pinwheel')
  await expect(page.getByTestId('pinwheel-board')).toBeVisible()
  const before = await page.getByTestId('pinwheel-board').innerHTML()
  await page.getByTestId('cell').nth(24).click()
  const spin = page.getByRole('button', { name: /Spin CW/ })
  await expect(spin).toBeEnabled()
  await spin.click()
  await expect(page.getByTestId('moves')).toHaveText('1')
  expect(before).not.toBe(await page.getByTestId('pinwheel-board').innerHTML())
})

test('pinwheel: 키보드만으로 격자에 진입할 수 있다', async ({ page }) => {
  // 핀이 없으면 모든 셀이 tabIndex -1이라 키보드 사용자는 진입조차 못 했다.
  await page.goto('/pinwheel')
  await expect(page.getByTestId('pinwheel-board')).toBeVisible()
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab')
    if (await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'cell')) break
  }
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('cell')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', { name: /Spin CW/ })).toBeEnabled()
})

// 엔드리스 게임은 신기록이 유일한 보상 순간인데 7종이 패배 오버레이만 띄우고 있었다.
// 함정: 죽는 시점엔 best가 이미 갱신돼 score와 같으므로 비교로는 판정할 수 없다 —
// 경신 지점에서 세운 ref 플래그로 판정한다. 아래 두 테스트가 양성/오탐을 함께 고정한다.
test('backspace: 신기록으로 끝나면 New best 축하', async ({ page }) => {
  await page.goto('/backspace')
  await expect(page.getByTestId('backspace-board')).toBeVisible()
  await page.getByTestId('backspace-board').click()
  await page.keyboard.down('Space') // 되감기 미터를 비워 다음 충돌이 치명타가 되게
  await page.waitForTimeout(4000)
  await page.keyboard.up('Space')
  await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('game-over')).toContainText('New best!')
})

test('backspace: 기록을 못 넘으면 Game over (ref 플래그 오탐 방지)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('best:backspace', '999999'))
  await page.goto('/backspace')
  await expect(page.getByTestId('backspace-board')).toBeVisible()
  await page.getByTestId('backspace-board').click()
  await page.keyboard.down('Space')
  await page.waitForTimeout(4000)
  await page.keyboard.up('Space')
  await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('game-over')).toContainText('Game over')
  await expect(page.getByTestId('game-over')).not.toContainText('New best')
})

test('snake: 기록을 못 넘으면 Game over + Best 표시', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('best:snake', '999'))
  await page.goto('/snake')
  await expect(page.getByTestId('snake-board')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('game-over')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('game-over')).toContainText('Game over')
  await expect(page.getByTestId('game-over')).toContainText('Best: 999')
})

test('홈: Daily 필터가 Daily 모드 게임만 보여준다', async ({ page }) => {
  // Daily는 재방문 훅인데 그전엔 홈에서 찾을 경로가 0개였다.
  // gameMeta의 daily 표시와 실제 게임의 Daily 모드 구현이 어긋나면 여기서 깨진다.
  await page.goto('/')
  await page.getByRole('button', { name: 'Daily', exact: true }).click()
  // TodayBoard/RecentlyPlayed도 게임 카드를 그리므로 브라우저 결과 그리드로 좁힌다.
  const titles = await page.getByTestId('browse-results').locator('a:has(h3) h3').allInnerTexts()
  expect(titles.sort()).toEqual(
    ['Clusters', 'Decant', 'Deepdive', 'Duplex', 'Equate', 'Flapjack', 'Handful', 'Interlock', 'Overfold', 'Quadle', 'Quarry', 'Ricochet', 'Sonar', 'Splice', 'Stackpot'].sort(),
  )
})

test('leaderboards: 허브 페이지 로드', async ({ page }) => {
  await page.goto('/leaderboards')
  await expect(page.getByRole('heading', { name: 'Leaderboards', level: 1 })).toBeVisible()
})

test('daily 허브: 로드 + 데일리 게임 그리드', async ({ page }) => {
  await page.goto('/daily')
  await expect(page.getByRole('heading', { name: 'Free Daily Puzzle Games', level: 1 })).toBeVisible()
  // 데일리 게임 카드가 여러 개(Clusters/Quadle 등)
  await expect(page.locator('main a[href^="/"]:has(h3)').first()).toBeVisible()
})
