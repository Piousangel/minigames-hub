import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameSonar } from './GameSonar'
import { statsKey } from '@/lib/gameStats'
import { todayUTC } from '@/lib/dailyDate'
import { DAILY_CONFIG, createGame, dailySeed } from '@/lib/games/sonar/engine'

const STORAGE_KEY = 'best:sonar'

// 데일리 시드는 오늘 날짜의 순수 함수라 컴포넌트가 만드는 보드를 테스트에서도 그대로
// 재현할 수 있다 — 타겟 위치를 미리 알아내서 정확히 그 칸만 Mark로 클릭하면(핑 없이도
// claim이 바로 캡처함, engine.ts의 claim() 참고) 오탐(라이프 소모) 없이 승리를 만든다.
function dailyTargets() {
  const seed = dailySeed(todayUTC())
  return createGame(DAILY_CONFIG, seed).targets
}

function cell(row: number, col: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-testid="cell"][data-row="${row}"][data-col="${col}"]`)
  if (!el) throw new Error(`cell ${row},${col} not found`)
  return el
}

function winDailyBoard() {
  fireEvent.click(screen.getByRole('button', { name: 'Mark' }))
  for (const t of dailyTargets()) {
    fireEvent.click(cell(t.row, t.col))
  }
}

describe('GameSonar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the "New best score!" badge on the first-ever win', async () => {
    render(<GameSonar storageKey={STORAGE_KEY} />)
    await screen.findByTestId('sonar-board')
    winDailyBoard()

    const overlay = await screen.findByTestId('you-win')
    expect(overlay).toHaveTextContent('New best score!')

    const stats = JSON.parse(localStorage.getItem(statsKey('sonar')) ?? '{}')
    expect(stats).toEqual({ plays: 1, wins: 1 })
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBeGreaterThan(0)
  })

  it('does not show the badge when the win does not beat an existing best', async () => {
    localStorage.setItem(STORAGE_KEY, '999999') // unbeatable score
    render(<GameSonar storageKey={STORAGE_KEY} />)
    await screen.findByTestId('sonar-board')
    winDailyBoard()

    const overlay = await screen.findByTestId('you-win')
    expect(overlay).not.toHaveTextContent('New best score!')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('999999')

    const stats = JSON.parse(localStorage.getItem(statsKey('sonar')) ?? '{}')
    expect(stats).toEqual({ plays: 1, wins: 1 })
  })
})
