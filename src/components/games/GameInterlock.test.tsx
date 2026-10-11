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
