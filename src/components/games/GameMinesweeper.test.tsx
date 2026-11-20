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
    // Android는 길게 누르기에 contextmenu도 쏜다 — 깃발이 다시 뽑히면 안 된다
    fireEvent.contextMenu(cell)
    expect(cell.textContent).toContain('🚩')
    expect(cell.getAttribute('data-revealed')).toBe('false')
    expect(cell.getAttribute('aria-label')).toBe('cell 5, 5: flagged')
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

  it('패배 뒤 결과 창이 뜨기 전에 새 판을 시작하면 늦은 덮개가 새 판을 덮지 않는다', async () => {
    vi.useFakeTimers()
    render(<GameMinesweeper />)
    await act(async () => {})
    fireEvent.click(cellAt(0, 0))
    fireEvent.click(cellAt(1, 1))
    fireEvent.click(screen.getByRole('button', { name: 'New Game' })) // 종료 후라 확인 없이 바로
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId('game-over')).toBeNull()
    expect(cellAt(0, 0).getAttribute('data-revealed')).toBe('false')
  })

  it('패배: 밟은 칸 💥이 먼저 보이고 결과 창은 늦게(연 칸/남은 칸)', async () => {
    vi.useFakeTimers()
    render(<GameMinesweeper />)
    await act(async () => {})
    fireEvent.click(cellAt(0, 0))
    expect(cellAt(0, 0).getAttribute('aria-label')).toBe('cell 1, 1: 3')
    expect(cellAt(4, 4).getAttribute('aria-label')).toBe('cell 5, 5: hidden')
    fireEvent.click(cellAt(1, 1))
    expect(cellAt(1, 1).textContent).toContain('💥')
    expect(cellAt(1, 1).getAttribute('aria-label')).toBe('cell 2, 2: mine')
    // 패배 직후엔 덮개가 판을 가리지 않는다
    expect(screen.queryByTestId('game-over')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(screen.getByTestId('game-over')).toBeTruthy()
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
    // 승리는 결과 창 즉시, Mines는 0(판에 지뢰 자리 깃발이 다 보인다)
    expect(screen.getByTestId('game-over')).toBeTruthy()
    expect(screen.getByTestId('mines-left').textContent).toBe('0')
    expect(screen.getByTestId('ms-result').textContent).toMatch(/Cleared in 00:00 · First clear!/)
    await waitFor(() => expect(localStorage.getItem('best:minesweeper:time')).toBe('0'))
    expect(loadStats('minesweeper')).toMatchObject({ plays: 1, wins: 1 })
  })
})
