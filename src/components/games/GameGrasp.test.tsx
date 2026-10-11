import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameGrasp } from './GameGrasp'
import { todayUTC } from '@/lib/dailyDate'

const STORAGE_KEY = 'best:grasp'
const VERSION_KEY = 'grasp:scoreVersion'

// 2026-10-10 감사: 옛 점수식에서는 "전부 놓기"가 300점 만점이었다. 점수식을 고친 뒤
// 새 식의 최고점(Hard ≈ 262)으로는 옛 300점을 영영 못 넘기 때문에, 버전 표시가 없는
// 옛 best는 폐기한다.
describe('GameGrasp best-score migration after the margin-bonus rebalance', () => {
  beforeEach(() => localStorage.clear())

  it('discards a legacy (pre-rebalance) best score', async () => {
    localStorage.setItem(STORAGE_KEY, '300')
    localStorage.setItem('grasp:daily', JSON.stringify({ lastDate: todayUTC(), streak: 3 }))
    const first = render(<GameGrasp storageKey={STORAGE_KEY} />)
    await screen.findByRole('button', { name: /grasp/i })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(VERSION_KEY)).toBe('2')
    // daily streak is untouched by the migration — and still shown after a reload,
    // when the best key is now absent.
    expect(JSON.parse(localStorage.getItem('grasp:daily') ?? '{}').streak).toBe(3)
    first.unmount()
    render(<GameGrasp storageKey={STORAGE_KEY} />)
    expect(await screen.findByText(/Streak/)).toHaveTextContent('3')
  })

  it('keeps a best score recorded under the current score version', async () => {
    localStorage.setItem(STORAGE_KEY, '240')
    localStorage.setItem(VERSION_KEY, '2')
    render(<GameGrasp storageKey={STORAGE_KEY} />)
    await screen.findByRole('button', { name: /grasp/i })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('240')
  })
})
