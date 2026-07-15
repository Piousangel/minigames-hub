import { describe, expect, it } from 'vitest'
import {
  ALL_WALLS,
  canMove,
  DIRS,
  hasWall,
  idx,
  isSolved,
  move,
  newGame,
  SIZES,
  WALL_RIGHT,
  type Direction,
  type MazeState,
} from './engine'

// 결정론적 시드 rng (mulberry32).
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// BFS로 시작에서 도달 가능한 셀 수를 센다(벽을 통과하지 않음).
function reachableCount(state: MazeState): number {
  const { size, start } = state
  const seen = new Array<boolean>(size * size).fill(false)
  const queue: Array<{ row: number; col: number }> = [start]
  seen[idx(size, start.row, start.col)] = true
  let count = 0
  while (queue.length > 0) {
    const cur = queue.shift()!
    count++
    for (const dir of ['up', 'right', 'down', 'left'] as Direction[]) {
      if (hasWall(state, cur.row, cur.col, dir)) continue
      const nr = cur.row + DIRS[dir].dr
      const nc = cur.col + DIRS[dir].dc
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
      const ni = idx(size, nr, nc)
      if (!seen[ni]) {
        seen[ni] = true
        queue.push({ row: nr, col: nc })
      }
    }
  }
  return count
}

describe('newGame / 미로 생성', () => {
  it('시작(좌상단)과 출구(우하단)가 서로 다르다', () => {
    const s = newGame(seeded(1), SIZES.easy)
    expect(s.start).toEqual({ row: 0, col: 0 })
    expect(s.exit).toEqual({ row: SIZES.easy - 1, col: SIZES.easy - 1 })
    expect(s.start).not.toEqual(s.exit)
  })

  it('미로 크기가 요청한 size와 일치한다 (셀 = size*size)', () => {
    for (const size of [SIZES.easy, SIZES.medium, SIZES.hard]) {
      const s = newGame(seeded(size), size)
      expect(s.size).toBe(size)
      expect(s.walls).toHaveLength(size * size)
      expect(s.visited).toHaveLength(size * size)
    }
  })

  it('완전 미로다: 모든 셀이 시작에서 도달 가능(연결)하며 출구도 포함', () => {
    for (const seed of [1, 7, 42, 99, 2026]) {
      const s = newGame(seeded(seed), SIZES.medium)
      const total = s.size * s.size
      expect(reachableCount(s)).toBe(total) // 완전 연결
    }
  })

  it('시작에서 출구까지 항상 해가 존재한다 (BFS 도달)', () => {
    for (const seed of [3, 11, 500]) {
      const s = newGame(seeded(seed), SIZES.hard)
      const { size, exit } = s
      // BFS 경로 추적
      const seen = new Array<boolean>(size * size).fill(false)
      const queue = [s.start]
      seen[idx(size, s.start.row, s.start.col)] = true
      let found = false
      while (queue.length > 0) {
        const cur = queue.shift()!
        if (cur.row === exit.row && cur.col === exit.col) {
          found = true
          break
        }
        for (const dir of ['up', 'right', 'down', 'left'] as Direction[]) {
          if (hasWall(s, cur.row, cur.col, dir)) continue
          const nr = cur.row + DIRS[dir].dr
          const nc = cur.col + DIRS[dir].dc
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
          const ni = idx(size, nr, nc)
          if (!seen[ni]) {
            seen[ni] = true
            queue.push({ row: nr, col: nc })
          }
        }
      }
      expect(found).toBe(true)
    }
  })

  it('같은 시드는 동일한 미로를 생성한다 (결정론)', () => {
    const a = newGame(seeded(12345), SIZES.medium)
    const b = newGame(seeded(12345), SIZES.medium)
    expect(a.walls).toEqual(b.walls)
    // 다른 시드는 (거의 확실히) 다른 미로
    const c = newGame(seeded(67890), SIZES.medium)
    expect(c.walls).not.toEqual(a.walls)
  })
})

describe('move / 이동 규칙', () => {
  it('통로(벽 없음)로는 이동하고 moves가 증가한다', () => {
    const s = newGame(seeded(1), SIZES.easy)
    // 시작 셀에서 열려 있는 방향을 하나 찾는다
    const open = (['up', 'right', 'down', 'left'] as Direction[]).find((d) => canMove(s, d))!
    const next = move(s, open)
    expect(next.moves).toBe(1)
    expect(next.player).not.toEqual(s.player)
    expect(next.visited[idx(next.size, next.player.row, next.player.col)]).toBe(true)
  })

  it('벽을 통과할 수 없다 (막힌 방향 이동 시 카운터 증가 없이 그대로)', () => {
    // 시작 셀에 인위적으로 오른쪽 벽을 세운 상태를 만든다
    const s = newGame(seeded(1), SIZES.easy)
    const walls = s.walls.slice()
    walls[idx(s.size, 0, 0)] |= WALL_RIGHT
    const blocked: MazeState = { ...s, walls }
    expect(canMove(blocked, 'right')).toBe(false)
    const next = move(blocked, 'right')
    expect(next).toBe(blocked) // 동일 참조 반환
    expect(next.moves).toBe(0)
  })

  it('경계 밖(왼쪽/위)으로는 이동할 수 없다', () => {
    const s = newGame(seeded(2), SIZES.easy)
    expect(canMove(s, 'up')).toBe(false)
    expect(canMove(s, 'left')).toBe(false)
    expect(move(s, 'up').moves).toBe(0)
  })

  it('moves는 실제 이동에서만 증가한다 (막힌 이동은 무시)', () => {
    let s = newGame(seeded(1), SIZES.easy)
    let realMoves = 0
    for (const dir of ['right', 'down', 'left', 'up', 'right', 'down'] as Direction[]) {
      const before = s.moves
      s = move(s, dir)
      if (s.moves !== before) realMoves++
      expect(s.moves).toBe(realMoves)
    }
  })

  it('벽 비트마스크 초기값은 모두 채워질 수 있고, 통로는 반대편 벽도 함께 열린다', () => {
    const s = newGame(seeded(4), SIZES.easy)
    // 초기 carve 결과라도 어떤 셀도 ALL_WALLS(고립)일 수는 없다(완전 미로)
    expect(s.walls.every((w) => w !== ALL_WALLS)).toBe(true)
    // 열린 통로는 양방향 대칭: (0,0)이 오른쪽으로 열려 있으면 (0,1)은 왼쪽으로 열려 있다
    const openRight = (['right', 'down'] as Direction[]).find((d) => canMove(s, d))
    if (openRight === 'right') {
      expect(hasWall(s, 0, 1, 'left')).toBe(false)
    }
  })
})

describe('isSolved', () => {
  it('플레이어가 출구에 도달하면 solved=true, isSolved=true', () => {
    // 출구 바로 옆에서 시작하도록 상태를 합성한다
    const base = newGame(seeded(1), SIZES.easy)
    const exit = base.exit
    const staged: MazeState = {
      ...base,
      player: { row: exit.row - 1, col: exit.col },
      // 위쪽 셀 → 아래(down)로 출구에 진입 가능하도록 벽 제거(양방향)
      walls: (() => {
        const w = base.walls.slice()
        w[idx(base.size, exit.row - 1, exit.col)] &= ~DIRS.down.wall
        w[idx(base.size, exit.row, exit.col)] &= ~DIRS.up.wall
        return w
      })(),
    }
    expect(isSolved(staged)).toBe(false)
    const solvedState = move(staged, 'down')
    expect(solvedState.player).toEqual(exit)
    expect(solvedState.solved).toBe(true)
    expect(isSolved(solvedState)).toBe(true)
  })

  it('풀린 뒤 추가 이동은 무시된다', () => {
    const base = newGame(seeded(1), SIZES.easy)
    const solved: MazeState = { ...base, solved: true }
    expect(move(solved, 'right')).toBe(solved)
  })
})
