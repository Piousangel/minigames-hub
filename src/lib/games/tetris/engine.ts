// Tetris 순수 엔진 — 결정론적(rng 주입), 테스트 가능.
// board[row][col]: 0 = 빈 칸, 1..7 = 조각 종류 id (색상 매핑용).

export const WIDTH = 10
export const HEIGHT = 20

export type Rng = () => number
export type Cell = number // 0 = 빈 칸, 1..7 = 조각 id
export type Board = Cell[][] // [row][col]

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

/** 조각 종류별 색상 id (board 셀에 채워지는 값). */
export const PIECE_ID: Record<PieceType, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
}

/** 7-bag 순서(스폰 회전 상태의 모양). 채워진 값 = 조각 id. */
export const TETROMINOES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [2, 2],
    [2, 2],
  ],
  T: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  S: [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ],
  Z: [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ],
  J: [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ],
}

const ORDER: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** 라인 수별 기본 점수(레벨 배수 적용 전). */
const LINE_SCORES = [0, 40, 100, 300, 1200]

export interface Piece {
  type: PieceType
  matrix: number[][] // 현재 회전 상태
  row: number // 보드상 좌상단 행
  col: number // 보드상 좌상단 열
}

export interface TetrisState {
  board: Board
  active: Piece | null
  next: PieceType // 미리보기
  bag: PieceType[] // 남은 7-bag 큐
  score: number
  lines: number
  level: number
  over: boolean
  // --- 연출용(순수 데이터, 매 스텝 갱신) ---
  lastLockedCells: Array<{ r: number; c: number }> // 방금 고정된 조각 셀(락 플래시)
  lastClearedCount: number // 방금 지운 라인 수(라인 클리어 연출)
}

// ---------- 순수 유틸 ----------

export function emptyBoard(): Board {
  return Array.from({ length: HEIGHT }, () => Array<Cell>(WIDTH).fill(0))
}

/** 행렬을 시계 방향 90도 회전. */
export function rotateCW(m: number[][]): number[][] {
  const rows = m.length
  const cols = m[0].length
  const out = Array.from({ length: cols }, () => Array<number>(rows).fill(0))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[c][rows - 1 - r] = m[r][c]
    }
  }
  return out
}

/** 조각이 보드/다른 블록과 충돌하는지(상단 밖 row<0 은 허용). */
export function collides(board: Board, piece: Piece): boolean {
  const { matrix, row, col } = piece
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c] === 0) continue
      const br = row + r
      const bc = col + c
      if (bc < 0 || bc >= WIDTH) return true
      if (br >= HEIGHT) return true
      if (br >= 0 && board[br][bc] !== 0) return true
    }
  }
  return false
}

function spawnPiece(type: PieceType): Piece {
  const matrix = TETROMINOES[type].map((row) => [...row])
  const col = Math.floor((WIDTH - matrix[0].length) / 2)
  return { type, matrix, row: 0, col }
}

function shuffle(arr: PieceType[], rng: Rng): PieceType[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 큐가 비었으면 새 7-bag 로 채운다. */
function ensureBag(bag: PieceType[], rng: Rng): PieceType[] {
  return bag.length > 0 ? bag : shuffle(ORDER, rng)
}

function levelForLines(lines: number): number {
  return 1 + Math.floor(lines / 10)
}

/** 큐에서 다음 조각을 뽑아 스폰. 스폰 즉시 충돌하면 over. */
function spawnNext(
  board: Board,
  bag: PieceType[],
  rng: Rng,
): { active: Piece; next: PieceType; bag: PieceType[]; over: boolean } {
  let b = ensureBag(bag, rng)
  const type = b[0]
  b = ensureBag(b.slice(1), rng)
  const active = spawnPiece(type)
  const over = collides(board, active)
  return { active, next: b[0], bag: b, over }
}

/** 조각을 보드에 병합하고 꽉 찬 라인을 제거. */
function mergeAndClear(
  board: Board,
  piece: Piece,
): { board: Board; cleared: number; cells: Array<{ r: number; c: number }> } {
  const next = board.map((row) => [...row])
  const cells: Array<{ r: number; c: number }> = []
  for (let r = 0; r < piece.matrix.length; r++) {
    for (let c = 0; c < piece.matrix[r].length; c++) {
      if (piece.matrix[r][c] === 0) continue
      const br = piece.row + r
      const bc = piece.col + c
      if (br >= 0 && br < HEIGHT && bc >= 0 && bc < WIDTH) {
        next[br][bc] = PIECE_ID[piece.type]
        cells.push({ r: br, c: bc })
      }
    }
  }
  const kept = next.filter((row) => row.some((v) => v === 0))
  const cleared = HEIGHT - kept.length
  const rebuilt: Board = []
  for (let i = 0; i < cleared; i++) rebuilt.push(Array<Cell>(WIDTH).fill(0))
  return { board: [...rebuilt, ...kept], cleared, cells }
}

/** 현재 조각을 고정: 병합 → 라인 클리어 → 점수 → 다음 조각 스폰. */
export function lockPiece(state: TetrisState, rng: Rng): TetrisState {
  if (!state.active || state.over) return state
  const { board, cleared, cells } = mergeAndClear(state.board, state.active)
  const lines = state.lines + cleared
  const level = levelForLines(lines)
  const gained = LINE_SCORES[cleared] * state.level
  const spawned = spawnNext(board, state.bag, rng)
  return {
    board,
    active: spawned.over ? null : spawned.active,
    next: spawned.next,
    bag: spawned.bag,
    score: state.score + gained,
    lines,
    level,
    over: spawned.over,
    lastLockedCells: cells,
    lastClearedCount: cleared,
  }
}

// ---------- 공개 액션 ----------

export function newGame(rng: Rng): TetrisState {
  const board = emptyBoard()
  const spawned = spawnNext(board, [], rng)
  return {
    board,
    active: spawned.active,
    next: spawned.next,
    bag: spawned.bag,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    lastLockedCells: [],
    lastClearedCount: 0,
  }
}

const clearFx = (state: TetrisState): TetrisState =>
  state.lastLockedCells.length || state.lastClearedCount
    ? { ...state, lastLockedCells: [], lastClearedCount: 0 }
    : state

/** 좌우 이동(dx = -1 왼쪽, +1 오른쪽). 충돌하면 무시. */
export function moveHorizontal(state: TetrisState, dx: number): TetrisState {
  if (!state.active || state.over) return state
  const cand: Piece = { ...state.active, col: state.active.col + dx }
  if (collides(state.board, cand)) return clearFx(state)
  return { ...clearFx(state), active: cand }
}

/** 시계 방향 회전 + 간이 월킥(좌우로 최대 2칸 밀어보기). */
export function rotate(state: TetrisState, dir: 1 | -1 = 1): TetrisState {
  if (!state.active || state.over) return state
  let matrix = rotateCW(state.active.matrix)
  if (dir === -1) matrix = rotateCW(rotateCW(rotateCW(state.active.matrix)))
  const kicks = [0, -1, 1, -2, 2]
  for (const dx of kicks) {
    const cand: Piece = { ...state.active, matrix, col: state.active.col + dx }
    if (!collides(state.board, cand)) return { ...clearFx(state), active: cand }
  }
  return clearFx(state) // 회전 불가
}

/** 소프트 드롭: 한 칸 하강(+1점). 더 못 내려가면 고정. */
export function softDrop(state: TetrisState, rng: Rng): TetrisState {
  if (!state.active || state.over) return state
  const cand: Piece = { ...state.active, row: state.active.row + 1 }
  if (collides(state.board, cand)) return lockPiece(state, rng)
  return { ...clearFx(state), active: cand, score: state.score + 1 }
}

/** 하드 드롭: 바닥까지 즉시 낙하(+2점/칸) 후 고정. */
export function hardDrop(state: TetrisState, rng: Rng): TetrisState {
  if (!state.active || state.over) return state
  let piece = state.active
  while (!collides(state.board, { ...piece, row: piece.row + 1 })) {
    piece = { ...piece, row: piece.row + 1 }
  }
  const dist = piece.row - state.active.row
  return lockPiece({ ...state, active: piece, score: state.score + dist * 2 }, rng)
}

/** 중력 1스텝(자동 하강). 못 내려가면 고정. */
export function tick(state: TetrisState, rng: Rng): TetrisState {
  if (!state.active || state.over) return state
  const cand: Piece = { ...state.active, row: state.active.row + 1 }
  if (collides(state.board, cand)) return lockPiece(state, rng)
  return { ...clearFx(state), active: cand }
}

/** 고스트(하드 드롭 착지 위치) 조각. 렌더 전용. */
export function ghostPiece(state: TetrisState): Piece | null {
  if (!state.active || state.over) return null
  let piece = state.active
  while (!collides(state.board, { ...piece, row: piece.row + 1 })) {
    piece = { ...piece, row: piece.row + 1 }
  }
  return piece
}

/** 레벨별 중력 간격(ms). 레벨이 오를수록 빨라진다. */
export function gravityMs(level: number): number {
  return Math.max(80, 800 - (level - 1) * 65)
}
