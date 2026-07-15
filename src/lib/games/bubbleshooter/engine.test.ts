import { describe, expect, it } from 'vitest'
import {
  DEATH_ROW,
  DROP_SCORE,
  MIN_MATCH,
  NUM_COLORS,
  POP_SCORE,
  emptyGrid,
  isCleared,
  isOver,
  newGame,
  sameColorCluster,
  shoot,
  stateFromGrid,
  traceShot,
  type BubbleState,
} from './engine'

/** 점유 칸 수. */
function count(state: BubbleState): number {
  let n = 0
  for (const row of state.grid) for (const c of row) if (c !== null) n++
  return n
}

describe('newGame', () => {
  it('시작 시 상단 행을 채우고 유효한 current/next 색을 가진다', () => {
    const s = newGame(() => 0)
    expect(count(s)).toBeGreaterThan(0)
    expect(s.score).toBe(0)
    expect(s.over).toBe(false)
    expect(s.cleared).toBe(false)
    expect(s.current).toBeGreaterThanOrEqual(0)
    expect(s.current).toBeLessThan(NUM_COLORS)
    expect(s.next).toBeGreaterThanOrEqual(0)
    expect(s.next).toBeLessThan(NUM_COLORS)
  })
})

describe('shoot — 스냅', () => {
  it('곧게 쏘면 버블 하나가 그리드에 붙는다', () => {
    const grid = emptyGrid()
    grid[0][7] = 1 // 경로 밖 앵커(빈 그리드는 cleared로 취급되므로)
    const s = stateFromGrid(grid, 0, 1)
    const next = shoot(s, 0, () => 0)
    expect(count(next)).toBe(2) // 앵커 + 새로 붙은 1개(단일 → 팝 없음)
    expect(next.events.landed).not.toBeNull()
    expect(next.events.popped.length).toBe(0)
    expect(next.score).toBe(0)
    // 붙은 칸은 실제로 색이 채워진다
    const { row, col } = next.events.landed as { row: number; col: number }
    expect(next.grid[row][col]).toBe(0)
  })
})

describe('shoot — 클러스터 팝', () => {
  it('같은 색 3개가 뭉치면 모두 터지고 버블당 점수가 오른다', () => {
    const grid = emptyGrid()
    grid[0][3] = 0
    grid[0][4] = 0
    const s = stateFromGrid(grid, 0, 2) // 색 0을 곧게 발사 → (1,3)에 붙어 3개 완성
    const next = shoot(s, 0, () => 0)
    expect(next.events.popped.length).toBe(3)
    expect(count(next)).toBe(0) // 3개 전부 제거
    expect(next.score).toBe(3 * POP_SCORE)
    expect(next.cleared).toBe(true)
  })

  it('같은 색 2개(3 미만)는 터지지 않는다', () => {
    const grid = emptyGrid()
    grid[0][3] = 0
    const s = stateFromGrid(grid, 0, 2)
    const next = shoot(s, 0, () => 0)
    expect(next.events.popped.length).toBe(0)
    expect(count(next)).toBe(2) // 기존 1 + 새로 붙은 1
    expect(next.score).toBe(0)
  })
})

describe('shoot — 낙하', () => {
  it('클러스터가 터지면 천장과 끊긴 버블이 떨어진다', () => {
    const grid = emptyGrid()
    grid[0][0] = 2 // 남아 있을 천장 앵커
    grid[0][3] = 0
    grid[0][4] = 0
    grid[1][4] = 1 // (0,4)로만 천장에 매달림
    const s = stateFromGrid(grid, 0, 3)
    const next = shoot(s, 0, () => 0) // (1,3)에 붙어 {(1,3),(0,3),(0,4)} 팝 → (1,4) 고립

    expect(next.events.popped.length).toBe(3)
    expect(next.events.dropped.length).toBe(1)
    expect(next.events.dropped[0]).toMatchObject({ row: 1, col: 4, color: 1 })
    expect(next.grid[1][4]).toBeNull() // 떨어짐
    expect(next.grid[0][0]).toBe(2) // 앵커는 유지
    expect(next.cleared).toBe(false)
    expect(next.score).toBe(3 * POP_SCORE + 1 * DROP_SCORE)
  })
})

describe('shoot — 색 교체(rng)', () => {
  it('발사 후 next가 current가 되고 새 next는 rng로 정해진다', () => {
    const grid = emptyGrid()
    grid[0][7] = 0 // 경로 밖 앵커(색 0)
    const s = stateFromGrid(grid, 0, 3)
    const next = shoot(s, 0, () => 0) // 팝 없음 → 남은 색 [0], pool[0] = 0
    expect(next.current).toBe(3) // 이전 next가 승계
    expect(next.next).toBe(0)
  })
})

describe('clear / game-over 판정', () => {
  it('그리드가 비면 cleared, isCleared true', () => {
    const empty = stateFromGrid(emptyGrid(), 0, 1)
    expect(isCleared(empty)).toBe(true)
  })

  it('갓 시작한 게임은 cleared/over가 아니다', () => {
    const s = newGame(() => 0.5)
    expect(isCleared(s)).toBe(false)
    expect(isOver(s)).toBe(false)
    expect(s.over).toBe(false)
  })

  it('버블이 바닥선(DEATH_ROW)에 닿으면 game-over', () => {
    const grid = emptyGrid()
    grid[0][0] = 0
    grid[DEATH_ROW][0] = 1 // 바닥선 도달
    const s = stateFromGrid(grid, 0, 1)
    expect(isOver(s)).toBe(true)
    expect(s.over).toBe(true)
  })
})

describe('sameColorCluster / traceShot', () => {
  it('sameColorCluster는 같은 색 연결만 모은다', () => {
    const grid = emptyGrid()
    grid[0][2] = 1
    grid[0][3] = 1
    grid[0][4] = 2 // 다른 색 → 제외
    const cluster = sameColorCluster(grid, 0, 2)
    expect(cluster.length).toBe(2)
    expect(cluster.length).toBeLessThan(MIN_MATCH)
  })

  it('traceShot는 경로와 그리드 안의 스냅 칸을 돌려준다', () => {
    const s = newGame(() => 0.4)
    const trace = traceShot(s, 0)
    expect(trace.path.length).toBeGreaterThan(1)
    expect(trace.cell).not.toBeNull()
    const cell = trace.cell as { row: number; col: number }
    expect(cell.row).toBeGreaterThanOrEqual(0)
    expect(cell.row).toBeLessThan(9)
  })
})
