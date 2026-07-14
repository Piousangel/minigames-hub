import { describe, expect, it } from 'vitest'
import {
  collides,
  emptyBoard,
  ghostPiece,
  gravityMs,
  hardDrop,
  HEIGHT,
  lockPiece,
  moveHorizontal,
  newGame,
  rotate,
  rotateCW,
  softDrop,
  TETROMINOES,
  tick,
  WIDTH,
  type Board,
  type Piece,
  type PieceType,
  type TetrisState,
} from './engine'

const R0 = () => 0 // 결정론적 rng

const piece = (type: PieceType, row: number, col: number, matrix?: number[][]): Piece => ({
  type,
  matrix: matrix ?? TETROMINOES[type].map((r) => [...r]),
  row,
  col,
})

const makeState = (partial: Partial<TetrisState> = {}): TetrisState => ({
  board: emptyBoard(),
  active: null,
  next: 'I',
  bag: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'],
  score: 0,
  lines: 0,
  level: 1,
  over: false,
  lastLockedCells: [],
  lastClearedCount: 0,
  ...partial,
})

/** row 를 col 목록만 남기고(=비움) 나머지는 채운 보드 행. */
const filledRowExcept = (empties: number[]): number[] =>
  Array.from({ length: WIDTH }, (_, c) => (empties.includes(c) ? 0 : 8))

describe('newGame', () => {
  it('빈 20x10 보드 + 활성 조각으로 시작한다', () => {
    const s = newGame(R0)
    expect(s.board.length).toBe(HEIGHT)
    expect(s.board[0].length).toBe(WIDTH)
    expect(s.board.flat().every((v) => v === 0)).toBe(true)
    expect(s.active).not.toBeNull()
    expect(s.score).toBe(0)
    expect(s.level).toBe(1)
    expect(s.over).toBe(false)
  })
})

describe('collides', () => {
  it('벽 밖으로 나가면 충돌', () => {
    const board = emptyBoard()
    expect(collides(board, piece('O', 0, -1))).toBe(true) // 왼쪽 벽
    expect(collides(board, piece('O', 0, WIDTH - 1))).toBe(true) // 오른쪽 벽
    expect(collides(board, piece('O', 0, 4))).toBe(false) // 안쪽은 OK
  })
  it('바닥 아래로 내려가면 충돌', () => {
    expect(collides(emptyBoard(), piece('O', HEIGHT - 1, 4))).toBe(true) // O 는 2행이라 넘침
  })
  it('기존 블록과 겹치면 충돌', () => {
    const board = emptyBoard()
    board[5][4] = 3
    expect(collides(board, piece('O', 4, 4))).toBe(true) // O(4..5,4..5) 가 (5,4) 와 겹침
  })
})

describe('rotateCW', () => {
  it('행렬을 시계방향 90도 회전한다', () => {
    expect(rotateCW([[1, 2], [3, 4]])).toEqual([[3, 1], [4, 2]])
  })
})

describe('moveHorizontal', () => {
  it('좌우로 이동한다', () => {
    const s = makeState({ active: piece('T', 0, 4) })
    expect(moveHorizontal(s, 1).active!.col).toBe(5)
    expect(moveHorizontal(s, -1).active!.col).toBe(3)
  })
  it('벽에 막히면 이동하지 않는다', () => {
    const s = makeState({ active: piece('I', 0, 0) }) // I 가로: 채워진 셀 col0..3
    expect(moveHorizontal(s, -1).active!.col).toBe(0) // 왼쪽 벽에 막힘
  })
})

describe('rotate (월킥 포함)', () => {
  it('조각을 회전시켜 행렬이 바뀐다', () => {
    const s = makeState({ active: piece('T', 2, 4) })
    const r = rotate(s)
    expect(r.active!.matrix).toEqual(rotateCW(TETROMINOES.T))
  })
  it('오른쪽 벽에서 회전 시 킥으로 안쪽으로 밀린다', () => {
    const vertI = rotateCW(TETROMINOES.I) // 세로 I (채워진 셀 = 행렬 col2)
    const s = makeState({ active: piece('I', 0, 7, vertI) }) // board col = 7+2 = 9 (오른쪽 끝)
    const r = rotate(s) // 가로로 펴지면 col10 침범 → 왼쪽으로 킥
    expect(r.active!.col).toBe(6)
    expect(collides(r.board, r.active!)).toBe(false)
  })
})

describe('softDrop', () => {
  it('한 칸 내려가고 1점 얻는다', () => {
    const s = makeState({ active: piece('O', 0, 4), score: 10 })
    const d = softDrop(s, R0)
    expect(d.active!.row).toBe(1)
    expect(d.score).toBe(11)
  })
  it('바닥에 닿으면 조각이 고정된다', () => {
    const s = makeState({ active: piece('O', HEIGHT - 2, 4) }) // 바닥에 딱 붙음
    const d = softDrop(s, R0)
    // 고정되면 board 최하단에 블록이 남고 새 조각이 스폰된다
    expect(d.board[HEIGHT - 1][4]).not.toBe(0)
    expect(d.active!.type).not.toBe('O') // bag 의 다음 조각 = 'I'
  })
})

describe('hardDrop', () => {
  it('바닥까지 낙하해 고정하고 거리*2 점수를 준다', () => {
    const s = makeState({ active: piece('O', 0, 4) })
    const d = hardDrop(s, R0)
    // O 는 rows 18,19 col 4,5 에 고정
    expect(d.board[19][4]).not.toBe(0)
    expect(d.board[19][5]).not.toBe(0)
    expect(d.board[18][4]).not.toBe(0)
    expect(d.score).toBe(18 * 2) // 0→18 낙하
    expect(d.lastLockedCells.length).toBe(4)
  })
})

describe('lockPiece + 라인 클리어 + 점수', () => {
  it('한 줄을 완성하면 지우고 40*level 점을 준다', () => {
    const board: Board = emptyBoard()
    board[HEIGHT - 1] = filledRowExcept([4, 5]) // 마지막 줄에 4,5 만 빈 칸
    const s = makeState({ board, active: piece('O', 0, 4), level: 1 })
    const d = hardDrop(s, R0) // O 가 4,5 를 채워 마지막 줄 완성
    expect(d.lastClearedCount).toBe(1)
    expect(d.lines).toBe(1)
    // 점수 = 하드드롭(18*2=36) + 라인(40*1=40)
    expect(d.score).toBe(36 + 40)
    // 지워진 뒤 최하단엔 O 의 잔여 2칸만 남는다
    expect(d.board[HEIGHT - 1].filter((v) => v !== 0).length).toBe(2)
  })

  it('4줄 동시(테트리스)에 1200*level 점을 준다', () => {
    const board: Board = emptyBoard()
    for (let r = HEIGHT - 4; r < HEIGHT; r++) board[r] = filledRowExcept([9]) // 우측 한 칸씩 비움
    const vertI = rotateCW(TETROMINOES.I) // 세로 I, board col = col+2
    const s = makeState({ board, active: piece('I', 0, 7, vertI), level: 1 }) // col 9 열
    const d = hardDrop(s, R0)
    expect(d.lastClearedCount).toBe(4)
    expect(d.lines).toBe(4)
    // 점수 = 하드드롭(16*2=32) + 테트리스(1200)
    expect(d.score).toBe(32 + 1200)
    expect(d.board.flat().every((v) => v === 0)).toBe(true) // 전부 비워짐
  })

  it('라인 클리어가 없으면 조각만 병합된다', () => {
    const s = makeState({ active: piece('O', HEIGHT - 2, 4) })
    const d = lockPiece(s, R0)
    expect(d.lastClearedCount).toBe(0)
    expect(d.lines).toBe(0)
    expect(d.board[HEIGHT - 1][4]).not.toBe(0)
  })
})

describe('게임 오버', () => {
  it('스폰 위치가 막혀 있으면 over 가 되고 active 는 null', () => {
    const board: Board = emptyBoard()
    // 상단을 막되 '꽉 참'은 아니게(라인 클리어로 사라지지 않도록) 한 칸 비운다.
    board[1] = filledRowExcept([0])
    const s = makeState({ board, active: piece('O', HEIGHT - 2, 4), bag: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] })
    const d = lockPiece(s, R0) // O 고정 후 다음 'I'(col3~6) 스폰이 막힌 상단과 충돌
    expect(d.over).toBe(true)
    expect(d.active).toBeNull()
  })
  it('over 상태에서는 액션이 상태를 바꾸지 않는다', () => {
    const s = makeState({ over: true, active: piece('O', 5, 4) })
    expect(tick(s, R0)).toBe(s)
    expect(moveHorizontal(s, 1)).toBe(s)
    expect(rotate(s)).toBe(s)
    expect(hardDrop(s, R0)).toBe(s)
  })
})

describe('tick (중력)', () => {
  it('한 칸 자동 하강한다', () => {
    const s = makeState({ active: piece('O', 3, 4) })
    expect(tick(s, R0).active!.row).toBe(4)
  })
  it('더 못 내려가면 고정 + 다음 조각 스폰', () => {
    const s = makeState({ active: piece('O', HEIGHT - 2, 4) })
    const d = tick(s, R0)
    expect(d.board[HEIGHT - 1][4]).not.toBe(0)
    expect(d.active!.row).toBe(0) // 새 조각은 최상단
  })
})

describe('ghostPiece', () => {
  it('하드드롭 착지 위치를 반환한다', () => {
    const s = makeState({ active: piece('O', 0, 4) })
    expect(ghostPiece(s)!.row).toBe(HEIGHT - 2) // O 는 18행에 착지
  })
})

describe('gravityMs', () => {
  it('레벨이 오를수록 간격이 짧아지고 하한이 있다', () => {
    expect(gravityMs(1)).toBe(800)
    expect(gravityMs(2)).toBeLessThan(gravityMs(1))
    expect(gravityMs(50)).toBe(80) // 하한
  })
})
