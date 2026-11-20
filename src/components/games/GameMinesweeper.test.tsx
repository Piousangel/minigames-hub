import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { GameMinesweeper } from './GameMinesweeper'
import { loadStats } from '@/lib/gameStats'

// Math.random()=>0 이면 (0,0) 첫 클릭 때 지뢰 = (1..8,0),(0,1),(1,1) (engine.test.ts와 같은 배치).
// (2,1)=4, (3,2)=0 → (2,1) 주변 깃발 4개 + 코드면 나머지가 flood로 다 열려 승리한다.
const cellAt = (x: number, y: number) => screen.getAllByTestId('ms-cell')[y * 9 + x]

async function mount() {
  render(<GameMinesweeper />)
  await screen.findByTestId('ms-board')
}

describe('GameMinesweeper', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('터치 길게 누르기 → 깃발, 뒤따르는 click은 칸을 열지 않는다', async () => {
    vi.useFakeTimers()
    render(<GameMinesweeper />)
    await act(async () => {})
    const cell = cellAt(4, 4)
    fireEvent.pointerDown(cell, {
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    })
    act(() => {
      vi.advanceTimersByTime(400)
    })
    fireEvent.pointerUp(cell, { pointerType: 'touch' })
    fireEvent.click(cell)
    expect(cell.textContent).toContain('🚩')
    expect(cell.getAttribute('data-revealed')).toBe('false')
    expect(screen.getByTestId('mines-left').textContent).toBe('9')
  })

  it('짧은 탭·손가락이 움직인 길게 누르기는 깃발이 아니다', async () => {
    vi.useFakeTimers()
    render(<GameMinesweeper />)
    await act(async () => {})
    const cell = cellAt(4, 4)
    fireEvent.pointerDown(cell, {
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
    })
    fireEvent.pointerMove(cell, {
      pointerType: 'touch',
      clientX: 10,
      clientY: 40,
    }) // 스크롤
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(cell.textContent).not.toContain('🚩')
  })

  it('진행 중 New Game은 두 번 눌러야 판을 버린다(Restart?), 시작 전에는 바로', async () => {
    await mount()
    fireEvent.click(cellAt(0, 0))
    expect(cellAt(0, 0).getAttribute('data-revealed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
    // 한 번 누르면 판은 그대로, 버튼이 확인 문구로 바뀐다
    expect(cellAt(0, 0).getAttribute('data-revealed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Restart?' }))
    expect(cellAt(0, 0).getAttribute('data-revealed')).toBe('false')
    expect(screen.getByRole('button', { name: 'New Game' })).toBeTruthy()
  })

  it('패배: 밟은 칸 💥, 결과에 연 칸/남은 칸', async () => {
    await mount()
    fireEvent.click(cellAt(0, 0))
    fireEvent.click(cellAt(1, 1))
    await screen.findByTestId('game-over')
    expect(cellAt(1, 1).textContent).toContain('💥')
    expect(screen.getByTestId('ms-result').textContent).toMatch(/1\/71 safe squares cleared · 70 to go/)
    expect(loadStats('minesweeper')).toMatchObject({ plays: 1, wins: 0 })
  })

  it('오른쪽 클릭 깃발 + 숫자 칸 코드로 승리, 첫 승리는 First clear!·최고 기록 저장', async () => {
    await mount()
    fireEvent.click(cellAt(0, 0))
    fireEvent.click(cellAt(2, 1))
    for (const [fx, fy] of [
      [1, 0],
      [2, 0],
      [3, 0],
      [1, 1],
    ])
      fireEvent.contextMenu(cellAt(fx, fy))
    expect(screen.getByTestId('mines-left').textContent).toBe('6')
    fireEvent.click(cellAt(2, 1)) // 코드
    await screen.findByTestId('game-over')
    expect(screen.getByTestId('ms-result').textContent).toMatch(/Cleared in 00:00 · First clear!/)
    await waitFor(() => expect(localStorage.getItem('best:minesweeper:time')).toBe('0'))
    expect(loadStats('minesweeper')).toMatchObject({ plays: 1, wins: 1 })
  })
})
