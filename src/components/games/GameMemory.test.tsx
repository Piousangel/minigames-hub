import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameMemory } from './GameMemory'
import { newMemoryGame } from '@/lib/games/memory/engine'

const STORAGE_KEY = 'best:memory-game'
const TEST_TIMEOUT_MS = 20_000

// Math.random = 0 → 컴포넌트와 같은 배치를 여기서도 만들어 쌍 위치를 안다.
function pairs(): [number, number][] {
  const { cards } = newMemoryGame(() => 0)
  const seen = new Map<string, number>()
  const out: [number, number][] = []
  cards.forEach((c, i) => {
    const j = seen.get(c.emoji)
    if (j === undefined) seen.set(c.emoji, i)
    else out.push([j, i])
  })
  return out
}

const cards = () => screen.getAllByTestId('memory-card')
const tap = (i: number) => fireEvent.click(cards()[i])

function wrongPair(): [number, number] {
  const [[a], [b]] = pairs()
  return [a, b]
}

function solveAll() {
  for (const [a, b] of pairs()) {
    tap(a)
    tap(b)
  }
}

describe('GameMemory', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it(
    '첫 클리어: 결과에 첫 기록 + 완벽 문구, Best 저장',
    () => {
      render(<GameMemory storageKey={STORAGE_KEY} />)
      solveAll()
      expect(screen.getByTestId('game-over')).toBeInTheDocument()
      expect(screen.getByTestId('memory-result')).toHaveTextContent('8 moves — your first best!')
      expect(screen.getByTestId('memory-result')).toHaveTextContent('Perfect')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('8')
      expect(screen.getByTestId('best')).toHaveTextContent('8')
    },
    TEST_TIMEOUT_MS,
  )

  it(
    '이전 최고보다 적으면 New best! + 줄인 수, 더 많으면 차이와 목표',
    () => {
      localStorage.setItem(STORAGE_KEY, '20')
      const { unmount } = render(<GameMemory storageKey={STORAGE_KEY} />)
      solveAll()
      expect(screen.getByRole('alertdialog', { name: 'New best!' })).toBeInTheDocument()
      expect(screen.getByTestId('memory-result')).toHaveTextContent('8 moves — 12 fewer than 20')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('8')
      unmount()

      // 이번엔 한 번 틀리고 다 맞힘 → 9 moves, 최고 8은 그대로
      render(<GameMemory storageKey={STORAGE_KEY} />)
      const [a, b] = wrongPair()
      tap(a)
      tap(b)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      solveAll()
      expect(screen.getByRole('alertdialog', { name: 'You win!' })).toBeInTheDocument()
      expect(screen.getByTestId('memory-result')).toHaveTextContent('9 moves · Best 8')
      expect(screen.getByTestId('memory-result')).toHaveTextContent('1 more than your best. Beat 8?')
      expect(localStorage.getItem(STORAGE_KEY)).toBe('8')
    },
    TEST_TIMEOUT_MS,
  )

  it(
    '판 중간 New Game은 Undo로 되돌릴 수 있고, 시간이 지나면 Undo가 사라진다',
    () => {
      render(<GameMemory storageKey={STORAGE_KEY} />)
      const [[a, b]] = pairs()
      tap(a)
      tap(b) // 한 쌍 맞힘, moves 1
      expect(screen.getByTestId('moves')).toHaveTextContent('1')

      fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
      expect(screen.getByTestId('moves')).toHaveTextContent('0')
      fireEvent.click(screen.getByTestId('memory-undo'))
      expect(screen.getByTestId('moves')).toHaveTextContent('1')
      expect(cards()[a]).toHaveAttribute('data-matched', 'true')
      expect(screen.queryByTestId('memory-undo')).not.toBeInTheDocument()

      // 다시 New Game → 6초 뒤 Undo 사라짐
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
      expect(screen.getByTestId('memory-undo')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(6100)
      })
      expect(screen.queryByTestId('memory-undo')).not.toBeInTheDocument()
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'Undo 뒤 포커스는 판으로 가고(body로 새지 않음), 알림은 live region으로 읽힌다',
    () => {
      render(<GameMemory storageKey={STORAGE_KEY} />)
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Flip two cards')
      const [[a, b]] = pairs()
      tap(a)
      tap(b)
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
      expect(screen.getByRole('status')).toBe(status) // 같은 요소에서 문구만 바뀐다
      expect(status).toHaveTextContent('New board dealt.')
      const undo = screen.getByTestId('memory-undo')
      undo.focus()
      fireEvent.click(undo)
      act(() => {
        vi.advanceTimersByTime(50) // requestAnimationFrame
      })
      expect(document.activeElement).toBe(screen.getByTestId('memory-board'))
      expect(status).toHaveTextContent('Flip two cards')
    },
    TEST_TIMEOUT_MS,
  )

  it(
    '맞히면 진동하고, 음소거면 진동하지 않는다',
    () => {
      const vib = vi.fn(() => true)
      Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true, writable: true })
      try {
        const [[a, b]] = pairs()
        const first = render(<GameMemory storageKey={STORAGE_KEY} />)
        tap(a)
        tap(b)
        expect(vib).toHaveBeenCalledWith(12)
        first.unmount()

        vib.mockClear()
        localStorage.setItem('minigames:muted', '1')
        render(<GameMemory storageKey={STORAGE_KEY} />)
        expect(screen.getByRole('button', { name: 'Unmute sound' })).toBeInTheDocument()
        tap(a)
        tap(b)
        expect(screen.getByTestId('moves')).toHaveTextContent('1')
        expect(vib).not.toHaveBeenCalled()
      } finally {
        delete (navigator as { vibrate?: unknown }).vibrate
      }
    },
    TEST_TIMEOUT_MS,
  )

  it(
    '아직 한 수도 안 둔 판의 New Game과 새 판 첫 탭 뒤에는 Undo가 없다',
    () => {
      render(<GameMemory storageKey={STORAGE_KEY} />)
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
      expect(screen.queryByTestId('memory-undo')).not.toBeInTheDocument()

      const [[a, b]] = pairs()
      tap(a)
      tap(b)
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
      expect(screen.getByTestId('memory-undo')).toBeInTheDocument()
      tap(0) // 새 판을 실제로 시작
      expect(screen.queryByTestId('memory-undo')).not.toBeInTheDocument()
    },
    TEST_TIMEOUT_MS,
  )
})
