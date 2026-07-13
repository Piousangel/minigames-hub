import { describe, expect, it } from 'vitest'
import { slideRowLeft, applyMove, canMove, move, newGame, spawnTile, type Board } from './engine'

const B = (rows: number[][]): Board => rows.map((r) => [...r])

describe('slideRowLeft', () => {
  it('빈 칸을 건너 왼쪽으로 민다', () => {
    expect(slideRowLeft([0, 2, 0, 4]).row).toEqual([2, 4, 0, 0])
  })
  it('같은 값 쌍을 병합하고 점수를 얻는다', () => {
    expect(slideRowLeft([2, 2, 0, 0])).toEqual({ row: [4, 0, 0, 0], gained: 4 })
  })
  it('네 개 같은 값은 두 쌍으로 병합된다', () => {
    expect(slideRowLeft([2, 2, 2, 2])).toEqual({ row: [4, 4, 0, 0], gained: 8 })
  })
  it('한 턴에 연쇄 병합은 없다 (4,2,2 → 4,4, 8 아님)', () => {
    expect(slideRowLeft([4, 2, 2, 0]).row).toEqual([4, 4, 0, 0])
  })
  it('이동 불가면 그대로', () => {
    expect(slideRowLeft([2, 4, 8, 16]).row).toEqual([2, 4, 8, 16])
  })
})

describe('applyMove', () => {
  it('right는 각 행을 오른쪽으로 민다', () => {
    const { board, gained, moved } = applyMove(
      B([[2, 2, 0, 0], [0, 0, 0, 4], [0, 0, 0, 0], [0, 0, 0, 0]]),
      'right',
    )
    expect(board[0]).toEqual([0, 0, 0, 4])
    expect(board[1]).toEqual([0, 0, 0, 4])
    expect(gained).toBe(4)
    expect(moved).toBe(true)
  })
  it('up은 각 열을 위로 민다', () => {
    const { board } = applyMove(
      B([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0]]),
      'up',
    )
    expect(board.map((r) => r[0])).toEqual([4, 4, 0, 0])
  })
  it('이동이 없으면 moved=false', () => {
    const full = B([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])
    expect(applyMove(full, 'left').moved).toBe(false)
  })
  it('down은 각 열을 아래로 민다', () => {
    const { board, gained } = applyMove(
      B([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0]]),
      'down',
    )
    expect(board.map((r) => r[0])).toEqual([0, 0, 4, 4])
    expect(gained).toBe(4)
  })
})

describe('spawnTile', () => {
  it('rng<0.9면 2를, 아니면 4를 빈 칸에 놓는다', () => {
    const nearFull = B([[2, 4, 8, 16], [16, 8, 4, 2], [2, 4, 8, 16], [16, 8, 4, 0]])
    expect(spawnTile(nearFull, () => 0)[3][3]).toBe(2)
    expect(spawnTile(nearFull, () => 0.95)[3][3]).toBe(4)
  })
})

describe('canMove / move', () => {
  it('병합 가능 칸이 없고 꽉 차면 false', () => {
    expect(canMove(B([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]))).toBe(false)
    expect(canMove(B([[2, 2, 4, 8], [4, 8, 16, 2], [2, 4, 8, 16], [16, 2, 4, 8]]))).toBe(true)
  })
  it('newGame은 타일 2개로 시작한다', () => {
    const s = newGame(() => 0)
    expect(s.board.flat().filter((v) => v > 0)).toHaveLength(2)
    expect(s.score).toBe(0)
  })
  it('move는 이동 발생 시 타일을 스폰하고 점수를 더한다', () => {
    const s = { board: B([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), score: 0, over: false, won: false }
    const next = move(s, 'left', () => 0)
    expect(next.board.flat().filter((v) => v > 0)).toHaveLength(2) // 병합 결과 4 + 스폰 2
    expect(next.score).toBe(4)
  })
  it('이동 불가 방향이면 상태 그대로 (스폰 없음)', () => {
    const s = { board: B([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), score: 0, over: false, won: false }
    expect(move(s, 'left', () => 0)).toBe(s)
  })
  it('2048 도달 시 won=true', () => {
    const s = { board: B([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), score: 0, over: false, won: false }
    expect(move(s, 'left', () => 0).won).toBe(true)
  })
  it('이동+스폰 후 더 이상 이동 불가하면 over=true', () => {
    // 한 칸(0,1)만 비어 있는 체커보드 배치. 'left'로 row0의 빈칸이 끝으로 밀리고,
    // 상수 rng(항상 0)가 그 칸에 2를 스폰해 인접 병합 없는 꽉 찬 보드가 된다.
    const s = {
      board: B([
        [4, 0, 2, 4],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
      ]),
      score: 0,
      over: false,
      won: false,
    }
    const next = move(s, 'left', () => 0)
    expect(next.board).toEqual(
      B([
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
      ]),
    )
    expect(next.over).toBe(true)
  })
})
