import { describe, expect, it } from 'vitest'
import {
  chord,
  flagCount,
  MS_MINES,
  MS_SIZE,
  newMinesweeper,
  reveal,
  safeLeft,
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

describe('exploded — 밟은 지뢰 칸', () => {
  it('패배 state에 밟은 칸 좌표가 남고, 진행 중·승리에는 없다', () => {
    const first = reveal(newMinesweeper(), 0, 0, () => 0)
    expect(first.exploded).toBeUndefined()
    expect(reveal(first, 1, 1, () => 0).exploded).toEqual([1, 1])
    expect(reveal(newMinesweeper(), 0, 0, () => 0.999999).exploded).toBeUndefined()
  })
})

describe('chord', () => {
  // rng()=>0: 지뢰 = (1..8,0),(0,1),(1,1). (0,0)=3.  (2,1)의 이웃 지뢰 = (1,0),(2,0),(3,0),(1,1) → 4
  const base = () => reveal(newMinesweeper(), 0, 0, () => 0)

  it('깃발 수 = 숫자이면 깃발 없는 닫힌 이웃을 연다(이웃을 하나씩 연 것과 같은 결과)', () => {
    let s = reveal(base(), 2, 1, () => 0)
    expect(s.grid[1][2].adjacent).toBe(4)
    for (const [fx, fy] of [
      [1, 0],
      [2, 0],
      [3, 0],
      [1, 1],
    ] as const)
      s = toggleFlag(s, fx, fy)
    const c = chord(s, 2, 1)
    expect(c).not.toBe(s)
    // (3,2)가 0이라 flood가 나머지 안전 칸을 다 연다 → 이 판은 코드 한 번으로 승리
    expect(c.won).toBe(true)
    expect(c.exploded).toBeUndefined()
    for (const [ox, oy] of [
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
    ] as const)
      expect(c.grid[oy][ox].revealed).toBe(true)
    let manual = s
    for (const [ox, oy] of [
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
    ] as const)
      manual = reveal(manual, ox, oy, () => 0)
    expect(c.grid).toEqual(manual.grid)
    expect(safeLeft(c)).toBe(safeLeft(manual))
  })

  it('깃발 수가 모자라거나 숫자가 아닌 칸·닫힌 칸·종료 후에는 같은 state', () => {
    const s = reveal(base(), 2, 1, () => 0)
    expect(chord(s, 2, 1)).toBe(s) // 깃발 0개
    expect(chord(s, 5, 5)).toBe(s) // 닫힌 칸
    const won = reveal(newMinesweeper(), 0, 0, () => 0.999999)
    expect(chord(won, 0, 0)).toBe(won) // 종료
  })

  it('깃발이 틀렸으면 이웃 지뢰를 밟아 진다(exploded = 밟은 칸)', () => {
    let s = reveal(base(), 2, 1, () => 0)
    // 진짜 지뢰 (1,1) 대신 안전한 (2,2)에 깃발 → (1,1)이 열려 패배
    for (const [fx, fy] of [
      [1, 0],
      [2, 0],
      [3, 0],
      [2, 2],
    ] as const)
      s = toggleFlag(s, fx, fy)
    const c = chord(s, 2, 1)
    expect(c.over).toBe(true)
    expect(c.won).toBe(false)
    expect(c.exploded).toEqual([1, 1])
  })
})

describe('safeLeft', () => {
  it('처음은 81-10=71, 승리하면 0', () => {
    expect(safeLeft(newMinesweeper())).toBe(MS_SIZE * MS_SIZE)
    expect(safeLeft(reveal(newMinesweeper(), 0, 0, () => 0))).toBe(MS_SIZE * MS_SIZE - MS_MINES - 1)
    expect(safeLeft(reveal(newMinesweeper(), 0, 0, () => 0.999999))).toBe(0)
  })
})
