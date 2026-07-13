export const SIZE = 4

export type Board = number[][] // [row][col], 0 = 빈 칸

export type Direction = 'left' | 'right' | 'up' | 'down'
export type Rng = () => number

export interface GameState {
  board: Board
  score: number
  over: boolean
  won: boolean
}

export function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter((v) => v !== 0)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2)
      gained += tiles[i] * 2
      i++ // 병합된 쌍의 두 번째 타일 소비 — 연쇄 병합 방지
    } else {
      out.push(tiles[i])
    }
  }
  while (out.length < row.length) out.push(0)
  return { row: out, gained }
}

const transpose = (b: Board): Board => b[0].map((_, c) => b.map((r) => r[c]))
const flipRows = (b: Board): Board => b.map((r) => [...r].reverse())

export function applyMove(board: Board, dir: Direction): { board: Board; gained: number; moved: boolean } {
  // 모든 방향을 '왼쪽 슬라이드'로 정규화: 변환 → slide → 역변환
  const to = dir === 'up' || dir === 'down' ? transpose(board) : board
  const oriented = dir === 'right' || dir === 'down' ? flipRows(to) : to
  let gained = 0
  const slid = oriented.map((row) => {
    const r = slideRowLeft(row)
    gained += r.gained
    return r.row
  })
  const back = dir === 'right' || dir === 'down' ? flipRows(slid) : slid
  const result = dir === 'up' || dir === 'down' ? transpose(back) : back
  const moved = result.some((row, i) => row.some((v, j) => v !== board[i][j]))
  return { board: result, gained, moved }
}

export function spawnTile(board: Board, rng: Rng): Board {
  const empty: Array<[number, number]> = []
  board.forEach((row, i) => row.forEach((v, j) => { if (v === 0) empty.push([i, j]) }))
  if (empty.length === 0) return board
  const [i, j] = empty[Math.floor(rng() * empty.length)]
  const next = board.map((r) => [...r])
  next[i][j] = rng() < 0.9 ? 2 : 4
  return next
}

export function canMove(board: Board): boolean {
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board.length; j++) {
      if (board[i][j] === 0) return true
      if (j + 1 < board.length && board[i][j] === board[i][j + 1]) return true
      if (i + 1 < board.length && board[i][j] === board[i + 1][j]) return true
    }
  }
  return false
}

export function newGame(rng: Rng): GameState {
  let board: Board = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))
  board = spawnTile(spawnTile(board, rng), rng)
  return { board, score: 0, over: false, won: false }
}

export function move(state: GameState, dir: Direction, rng: Rng): GameState {
  const { board, gained, moved } = applyMove(state.board, dir)
  if (!moved) return state
  const withSpawn = spawnTile(board, rng)
  return {
    board: withSpawn,
    score: state.score + gained,
    won: state.won || withSpawn.flat().some((v) => v >= 2048),
    over: !canMove(withSpawn),
  }
}
