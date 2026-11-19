import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { GameSnake, DEATH_REVEAL_MS } from './GameSnake'
import { loadStats } from '@/lib/gameStats'

const TICK_MS = 130

// 시작 (10,10) 오른쪽 진행. ArrowUp으로 시작하면 (10,0)까지 10틱, 11번째 틱에 위쪽 벽 충돌.
// Math.random 고정 → 먹이는 첫 빈 칸 (0,0)이라 경로에 없다.
function crashIntoWall() {
  fireEvent.keyDown(window, { key: 'ArrowUp' })
  act(() => {
    vi.advanceTimersByTime(TICK_MS * 11)
  })
}

describe('GameSnake 게임오버', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('충돌 칸을 먼저 보여 주고 오버레이는 늦게 뜬다; 기록 저장은 즉시', () => {
    render(<GameSnake storageKey="best:snake" />)
    crashIntoWall()
    expect(loadStats('snake').plays).toBe(1) // recordFinish 타이밍은 그대로(즉시)
    expect(screen.queryByTestId('game-over')).toBeNull()
    expect(screen.getByTestId('snake-head').className).toContain('anim-snake-blink')
    act(() => {
      vi.advanceTimersByTime(DEATH_REVEAL_MS)
    })
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus()
  })

  it('결과가 떠 있을 때만 Enter로 재시작, 입력 필드 포커스 중엔 무시', () => {
    localStorage.setItem('best:snake', '7')
    render(<GameSnake storageKey="best:snake" />)
    crashIntoWall()
    fireEvent.keyDown(document.body, { key: 'Enter' }) // 지연 중 — 무시
    act(() => {
      vi.advanceTimersByTime(DEATH_REVEAL_MS)
    })
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    expect(screen.getByTestId('snake-short-of-best')).toHaveTextContent('7 short of your best')

    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'Enter' }) // 리더보드 이름 입력 등 — 무시
    expect(screen.getByTestId('game-over')).toBeInTheDocument()
    input.remove()

    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(screen.queryByTestId('game-over')).toBeNull()
    expect(screen.getByTestId('score')).toHaveTextContent('0')
    expect(screen.getByTestId('snake-head')).toHaveAttribute('data-dir', 'right')
  })
})
