import { describe, expect, it } from 'vitest'
import {
  flagCount,
  MS_MINES,
  MS_SIZE,
  newMinesweeper,
  reveal,
  toggleFlag,
  type MsState,
} from './engine'

const countRevealed = (s: MsState) => s.grid.flat().filter((c) => c.revealed).length
const countMines = (s: MsState) => s.grid.flat().filter((c) => c.mine).length

describe('newMinesweeper', () => {
  it('9x9 빈 그리드, 지뢰 미배치로 시작한다', () => {
    const s = newMinesweeper()
    expect(s.grid).toHaveLength(MS_SIZE)
    expect(s.grid[0]).toHaveLength(MS_SIZE)
    expect(countMines(s)).toBe(0)
    expect(s.minesPlaced).toBe(false)
  })
})

describe('reveal — 첫 클릭', () => {
  it('첫 reveal에서 지뢰 10개가 배치되고 클릭 칸은 항상 안전하다', () => {
    // rng()=>0: 후보 리스트(클릭 칸 제외, y바깥 x안쪽 순서)의 맨 앞을 10번 뽑는다
    const s = reveal(newMinesweeper(), 0, 0, () => 0)
    expect(countMines(s)).toBe(MS_MINES)
    expect(s.grid[0][0].mine).toBe(false)
    expect(s.grid[0][0].revealed).toBe(true)
    expect(s.minesPlaced).toBe(true)
    expect(s.over).toBe(false)
  })
  it('rng()=>0이면 지뢰는 (1,0)..(8,0),(0,1),(1,1)이고 (0,0)의 adjacent는 3이다', () => {
    const s = reveal(newMinesweeper(), 0, 0, () => 0)
    expect(s.grid[0][1].mine).toBe(true) // (1,0)
    expect(s.grid[1][0].mine).toBe(true) // (0,1)
    expect(s.grid[1][1].mine).toBe(true) // (1,1)
    expect(s.grid[0][0].adjacent).toBe(3)
    expect(countRevealed(s)).toBe(1) // adjacent>0 이므로 flood 없음
  })
})

describe('reveal — flood fill과 승리', () => {
  it('지뢰가 전부 아래쪽에 몰리면 (0,0) 한 번으로 전 안전칸이 열리고 승리한다', () => {
    // rng()=>0.999999: 후보 리스트의 맨 뒤를 10번 뽑는다 → 지뢰 = 8행 전체(9개) + (8,7)
    const s = reveal(newMinesweeper(), 0, 0, () => 0.999999)
    expect(s.grid[8].every((c) => c.mine)).toBe(true)
    expect(s.grid[7][8].mine).toBe(true)
    expect(s.won).toBe(true)
    expect(s.over).toBe(true)
    expect(countRevealed(s)).toBe(MS_SIZE * MS_SIZE - MS_MINES)
  })
})

describe('reveal — 지뢰와 no-op', () => {
  it('지뢰를 밟으면 over, 모든 지뢰가 공개된다', () => {
    const first = reveal(newMinesweeper(), 0, 0, () => 0) // (1,0)은 지뢰
    const s = reveal(first, 1, 0, () => 0)
    expect(s.over).toBe(true)
    expect(s.won).toBe(false)
    expect(s.grid.flat().filter((c) => c.mine && c.revealed)).toHaveLength(MS_MINES)
  })
  it('깃발 꽂힌 칸과 이미 공개된 칸, 종료 후에는 no-op', () => {
    const first = reveal(newMinesweeper(), 0, 0, () => 0)
    const flagged = toggleFlag(first, 5, 5)
    expect(reveal(flagged, 5, 5, () => 0)).toBe(flagged)
    expect(reveal(first, 0, 0, () => 0)).toBe(first)
    const dead = reveal(first, 1, 0, () => 0)
    expect(reveal(dead, 5, 5, () => 0)).toBe(dead)
  })
})

describe('toggleFlag / flagCount', () => {
  it('깃발 토글이 반영되고 공개 칸에는 못 꽂는다', () => {
    const first = reveal(newMinesweeper(), 0, 0, () => 0)
    const f1 = toggleFlag(first, 5, 5)
    expect(f1.grid[5][5].flagged).toBe(true)
    expect(flagCount(f1)).toBe(1)
    expect(flagCount(toggleFlag(f1, 5, 5))).toBe(0)
    expect(toggleFlag(first, 0, 0)).toBe(first) // (0,0)은 공개됨
  })
})
