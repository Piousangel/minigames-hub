import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameInterlock } from './GameInterlock'

const STORAGE_KEY = 'best:interlock'

/**
 * 보드 aria-label의 링 요약은 RING_A/RING_B 순서(슬롯 0..9)로 색 이름을 나열한다.
 * 화면 기하(GameInterlock POS): 오른쪽 링은 슬롯 0=상단 공유점 → 1=오른쪽 위(10) →
 * … → 5=하단 공유점 순서라, 슬롯 i의 구슬이 i+1로 가면 화면상 시계 방향이다.
 * 왼쪽 링은 슬롯 0=상단 공유점 → 1=왼쪽 위(2)라, i→i+1이 반시계 방향이다.
 */
function ring(label: 'Left' | 'Right'): string[] {
  const aria = screen.getByTestId('interlock-board').getAttribute('aria-label') ?? ''
  const m = new RegExp(`${label} ring: ([^.]+)\\.`).exec(aria)
  if (!m) throw new Error(`no ${label} ring summary in "${aria}"`)
  return m[1].split(', ')
}

/** 슬롯 i의 구슬이 i+1로 이동(= 배열을 한 칸 오른쪽으로 순환)한 결과. */
function shiftForward(xs: string[]): string[] {
  return xs.map((_, i) => xs[(i - 1 + xs.length) % xs.length])
}
function shiftBackward(xs: string[]): string[] {
  return xs.map((_, i) => xs[(i + 1) % xs.length])
}

describe('GameInterlock rotate controls match on-screen direction', () => {
  beforeEach(() => localStorage.clear())

  it('right ring "clockwise" button moves the top bead to the upper-right slot', async () => {
    render(<GameInterlock storageKey={STORAGE_KEY} />)
    await screen.findByRole('button', { name: 'Rotate right ring clockwise' })
    const before = ring('Right')
    fireEvent.click(screen.getByRole('button', { name: 'Rotate right ring clockwise' }))
    expect(ring('Right')).toEqual(shiftForward(before))
  })

  it('right ring "counter-clockwise" button moves beads the other way', async () => {
    render(<GameInterlock storageKey={STORAGE_KEY} />)
    await screen.findByRole('button', { name: 'Rotate right ring counter-clockwise' })
    const before = ring('Right')
    fireEvent.click(screen.getByRole('button', { name: 'Rotate right ring counter-clockwise' }))
    expect(ring('Right')).toEqual(shiftBackward(before))
  })

  it('left ring "counter-clockwise" button moves the top bead to the upper-left slot', async () => {
    render(<GameInterlock storageKey={STORAGE_KEY} />)
    await screen.findByRole('button', { name: 'Rotate left ring counter-clockwise' })
    const before = ring('Left')
    fireEvent.click(screen.getByRole('button', { name: 'Rotate left ring counter-clockwise' }))
    expect(ring('Left')).toEqual(shiftForward(before))
  })

  it('keyboard: J = right ring counter-clockwise, L = right ring clockwise (mirrors A/D)', async () => {
    render(<GameInterlock storageKey={STORAGE_KEY} />)
    const board = await screen.findByTestId('interlock-board')
    const b0 = ring('Right')
    fireEvent.keyDown(board, { key: 'l' })
    expect(ring('Right')).toEqual(shiftForward(b0))
    const b1 = ring('Right')
    fireEvent.keyDown(board, { key: 'j' })
    expect(ring('Right')).toEqual(shiftBackward(b1))
  })
})

// 2026-10-10 감사 후속: 스크램블 깊이를 12/20/30 → 4/10/16으로 낮추면서 깊이 보너스
// (scramble × DEPTH_UNIT)도 줄었다. 새 식의 최고점(Hard 16수 최적해 ≈ 1820)으로는 옛
// Normal/Hard 기록(≈1900~2100)을 영영 못 넘기므로, 버전 표시가 없는 옛 best는 폐기한다.
describe('GameInterlock best-score migration after the scramble-depth rebalance', () => {
  const VERSION_KEY = 'interlock:scoreVersion'
  beforeEach(() => localStorage.clear())

  it('discards a legacy (pre-rebalance) best but keeps the daily streak', async () => {
    localStorage.setItem(STORAGE_KEY, '2050')
    localStorage.setItem('interlock:daily', JSON.stringify({ lastDate: '2026-10-09', streak: 4 }))
    render(<GameInterlock storageKey={STORAGE_KEY} />)
    await screen.findByTestId('interlock-board')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(VERSION_KEY)).toBe('2')
    expect(JSON.parse(localStorage.getItem('interlock:daily') ?? '{}').streak).toBe(4)
  })

  it('keeps the streak of a legacy JSON save (daily embedded in the best key)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ score: 2050, daily: { lastDate: '2026-10-09', streak: 6 } }))
    render(<GameInterlock storageKey={STORAGE_KEY} />)
    await screen.findByTestId('interlock-board')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem('interlock:daily') ?? '{}').streak).toBe(6)
  })

  it('keeps a best recorded under the current score version', async () => {
    localStorage.setItem(STORAGE_KEY, '1700')
    localStorage.setItem(VERSION_KEY, '2')
    render(<GameInterlock storageKey={STORAGE_KEY} />)
    await screen.findByTestId('interlock-board')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1700')
  })
})
