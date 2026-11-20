import { expect, test, type Page } from '@playwright/test'

// 꽃담 정원 터치 시험판(/tools/fence-proto, noindex) — "그럴듯하지만 틀린 결과"를 떨어뜨리는 검사:
// 판은 그려지는데 뛰기·울타리 입력이 안 먹어 퍼즐을 못 푸는 경우. 엔진 최소 해(p3-order: 1→7→3)를 손가락 탭으로 그대로 둔다.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

/** 칸 단위 좌표(판 왼쪽 위 0,0, viewBox 여백 0.5칸)를 화면 좌표로. */
async function at(page: Page, label: string, n: number, x: number, y: number) {
  const box = (await page.getByRole('img', { name: label }).boundingBox())!
  const span = n + 1
  return { x: box.x + ((x + 0.5) / span) * box.width, y: box.y + ((y + 0.5) / span) * box.height }
}
async function press(page: Page, p: { x: number; y: number }) {
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.mouse.up()
}

test.describe('fence-proto', () => {
test('퍼즐 3(순서 퍼즐)을 최소 3턴에 풀면 별 3개', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/tools/fence-proto/')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  await page.getByRole('button', { name: '3', exact: true }).click()
  const L = '뛰고 담 치기 판'
  const n = 5
  // 시작 7(1행 2열). 해: (1로 뛰고 오른쪽 변) → (7로 뛰고 위 변) → (3으로 뛰고 왼쪽 변)
  const steps: [number, number, number, number][] = [
    // [뛸 칸 c, r, 방향 dx, dy]
    [1, 0, 1, 0],
    [2, 1, 0, -1],
    [3, 0, -1, 0],
  ]
  for (const [c, r, dx, dy] of steps) {
    await press(page, await at(page, L, n, c + 0.5, r + 0.5))
    await expect(page.getByText(/화살표 쪽으로/)).toBeVisible()
    await press(page, await at(page, L, n, c + 0.5 + dx * 0.8, r + 0.5 + dy * 0.8))
  }
  await expect(page.getByText(/정원 완성! ★★★ \(3턴 · 최소 3턴\)/)).toBeVisible()
  // 390에서 가로 스크롤 없음
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  expect(errors).toEqual([])
})

test('탭 시험: 20번 누르면 요약 표에 한 줄', async ({ page }) => {
  await page.goto('/tools/fence-proto/')
  await page.getByRole('tab', { name: '탭 정확도 시험' }).click()
  const L = '5×5 정원 판'
  for (let i = 0; i < 20; i++) await press(page, await at(page, L, 5, 2.5, 2.5))
  await expect(page.getByText('이 판 끝!')).toBeVisible()
  await expect(page.getByRole('cell', { name: '5×5 press' })).toBeVisible()
})

// 리뷰(11-20) 재현 버그 회귀: 판 밖에서 떼면 취소 · 되돌리기 후 재완료해도 기록 1줄 · 최소+1턴이면 ★2
test('판 밖에서 떼면 울타리가 서지 않고, 되돌리고 다시 풀어도 기록은 한 줄', async ({ page }) => {
  await page.goto('/tools/fence-proto/')
  const L = '뛰고 담 치기 판'
  const n = 5
  // 퍼즐 1: 시작 12(가운데). 제자리 뛰기 → 오른쪽 변(V(2,2))이 정답.
  await press(page, await at(page, L, n, 2.5, 2.5))
  await expect(page.getByText(/화살표 쪽으로/)).toBeVisible()
  // 오른쪽으로 누르고 판 밖까지 끌어서 뗀다 → 취소
  const a = await at(page, L, n, 3.4, 2.5)
  const out = await at(page, L, n, 5.3, 2.5)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await expect(page.getByText('오른쪽 변', { exact: true })).toBeVisible()
  await page.mouse.move(out.x, out.y)
  await page.mouse.up()
  await expect(page.getByText(/화살표 쪽으로/)).toBeVisible() // 아직 울타리 단계
  // 이번엔 확정 → 1턴 완료
  await press(page, a)
  await expect(page.getByText(/정원 완성! ★★★ \(1턴/)).toBeVisible()
  await expect(page.getByRole('button', { name: '기록 복사 (1)' })).toBeVisible()
  // 되돌리고 다시 같은 수 → 여전히 1줄
  await page.getByRole('button', { name: '되돌리기' }).click()
  await press(page, await at(page, L, n, 2.5, 2.5))
  await press(page, a)
  await expect(page.getByText(/정원 완성!/)).toBeVisible()
  await expect(page.getByRole('button', { name: '기록 복사 (1)' })).toBeVisible()
})

test('최소 + 1턴이면 별 2개', async ({ page }) => {
  await page.goto('/tools/fence-proto/')
  const L = '뛰고 담 치기 판'
  const n = 5
  // 퍼즐 1에서 첫 턴을 쓸모없는 울타리(왼쪽 변)로 쓰고, 둘째 턴에 정답
  await press(page, await at(page, L, n, 2.5, 2.5))
  await press(page, await at(page, L, n, 1.6, 2.5))
  await expect(page.getByText(/턴 2\/3/)).toBeVisible()
  await press(page, await at(page, L, n, 2.5, 2.5))
  await press(page, await at(page, L, n, 3.4, 2.5))
  await expect(page.getByText(/정원 완성! ★★☆ \(2턴 · 최소 1턴\)/)).toBeVisible()
})
})
