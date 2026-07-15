// 순수·결정론적 미로 엔진. Math.random 미사용 — rng를 주입한다.
// 생성: 재귀 백트래커(DFS carving). 각 셀은 4방향 벽 비트마스크를 가진다.
// 시작(좌상단) → 출구(우하단)까지 항상 연결된 완전 미로(perfect maze).

export type Rng = () => number
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Difficulty = 'easy' | 'medium' | 'hard'

// 벽 비트마스크: 해당 방향에 벽이 있으면 비트가 켜짐.
export const WALL_UP = 1
export const WALL_RIGHT = 2
export const WALL_DOWN = 4
export const WALL_LEFT = 8
export const ALL_WALLS = WALL_UP | WALL_RIGHT | WALL_DOWN | WALL_LEFT // 15

export const SIZES: Record<Difficulty, number> = { easy: 8, medium: 12, hard: 16 }

export interface Pos {
  row: number
  col: number
}

export interface MazeState {
  size: number
  /** size*size 길이. 각 셀의 벽 비트마스크(WALL_* OR). */
  walls: number[]
  player: Pos
  start: Pos
  exit: Pos
  moves: number
  /** size*size 길이. 플레이어가 방문한 셀(트레일). */
  visited: boolean[]
  solved: boolean
}

interface DirInfo {
  dr: number
  dc: number
  wall: number
  opposite: number
}

export const DIRS: Record<Direction, DirInfo> = {
  up: { dr: -1, dc: 0, wall: WALL_UP, opposite: WALL_DOWN },
  right: { dr: 0, dc: 1, wall: WALL_RIGHT, opposite: WALL_LEFT },
  down: { dr: 1, dc: 0, wall: WALL_DOWN, opposite: WALL_UP },
  left: { dr: 0, dc: -1, wall: WALL_LEFT, opposite: WALL_RIGHT },
}

const DIR_LIST: Direction[] = ['up', 'right', 'down', 'left']

export const idx = (size: number, row: number, col: number): number => row * size + col

const inBounds = (size: number, row: number, col: number): boolean =>
  row >= 0 && row < size && col >= 0 && col < size

/** (row,col) 셀의 dir 방향에 벽이 있으면 true. */
export function hasWall(state: MazeState, row: number, col: number, dir: Direction): boolean {
  return (state.walls[idx(state.size, row, col)] & DIRS[dir].wall) !== 0
}

/**
 * 재귀 백트래커로 완전 미로를 만든다. 모든 셀이 정확히 하나의 경로로 연결되므로
 * 시작에서 출구까지 항상 해가 존재한다.
 */
function carve(size: number, rng: Rng): number[] {
  const walls = new Array<number>(size * size).fill(ALL_WALLS)
  const visited = new Array<boolean>(size * size).fill(false)
  const stack: Pos[] = [{ row: 0, col: 0 }]
  visited[0] = true

  while (stack.length > 0) {
    const cur = stack[stack.length - 1]
    // 미방문 이웃 수집
    const options: { dir: Direction; row: number; col: number }[] = []
    for (const dir of DIR_LIST) {
      const { dr, dc } = DIRS[dir]
      const nr = cur.row + dr
      const nc = cur.col + dc
      if (inBounds(size, nr, nc) && !visited[idx(size, nr, nc)]) {
        options.push({ dir, row: nr, col: nc })
      }
    }
    if (options.length === 0) {
      stack.pop()
      continue
    }
    const pick = options[Math.floor(rng() * options.length) % options.length]
    const info = DIRS[pick.dir]
    // 현재 셀과 이웃 셀 사이의 벽 제거(양방향)
    walls[idx(size, cur.row, cur.col)] &= ~info.wall
    walls[idx(size, pick.row, pick.col)] &= ~info.opposite
    visited[idx(size, pick.row, pick.col)] = true
    stack.push({ row: pick.row, col: pick.col })
  }
  return walls
}

export function newGame(rng: Rng, size: number = SIZES.easy): MazeState {
  const walls = carve(size, rng)
  const start: Pos = { row: 0, col: 0 }
  const exit: Pos = { row: size - 1, col: size - 1 }
  const visited = new Array<boolean>(size * size).fill(false)
  visited[idx(size, start.row, start.col)] = true
  return {
    size,
    walls,
    player: { ...start },
    start,
    exit,
    moves: 0,
    visited,
    solved: false,
  }
}

/** dir 방향으로 이동 가능하면(경계 안 + 벽 없음) true. */
export function canMove(state: MazeState, dir: Direction): boolean {
  const { player, size } = state
  const { dr, dc } = DIRS[dir]
  const nr = player.row + dr
  const nc = player.col + dc
  if (!inBounds(size, nr, nc)) return false
  return !hasWall(state, player.row, player.col, dir)
}

/**
 * 플레이어를 한 칸 이동한다. 벽에 막히거나 이미 풀린 상태면 원본 state를 그대로
 * 반환한다(카운터 증가 없음). 실제 이동 시에만 moves가 +1 된다.
 */
export function move(state: MazeState, dir: Direction): MazeState {
  if (state.solved) return state
  if (!canMove(state, dir)) return state
  const { dr, dc } = DIRS[dir]
  const player: Pos = { row: state.player.row + dr, col: state.player.col + dc }
  const visited = state.visited.slice()
  visited[idx(state.size, player.row, player.col)] = true
  const solved = player.row === state.exit.row && player.col === state.exit.col
  return { ...state, player, visited, moves: state.moves + 1, solved }
}

export function isSolved(state: MazeState): boolean {
  return state.player.row === state.exit.row && state.player.col === state.exit.col
}
