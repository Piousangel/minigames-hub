import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  GEM_SCORE,
  EMPTY,
  MOVES_START,
  SIZE,
  applyGravity,
  areAdjacent,
  findMatches,
  hasPossibleMove,
  newGame,
  refill,
  resolveBoard,
  resolveSteps,
  swap,
  swapCells,
  type GameState,
  type Grid,
} from './engine'

/** 문자열 행 배열 → 격자. '.'는 EMPTY, 그 외 문자는 자기 문자 코드를 색으로 쓴다. */
function toGrid(rows: string[]): Grid {
  return rows.map((row) => [...row].map((ch) => (ch === '.' ? EMPTY : ch.charCodeAt(0))))
}

/** 순환 결정적 rng(테스트용). 값은 [0,1) 범위여야 한다. */
function seq(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

function makeState(rows: string[], moves = MOVES_START): GameState {
  return { grid: toGrid(rows), score: 0, movesLeft: moves, over: false }
}

describe('newGame', () => {
  it('시작 보드에는 즉시 매치가 없다', () => {
    for (let s = 0; s < 8; s++) {
      const rng = seq([0.11 + 0.07 * s, 0.37, 0.59, 0.73, 0.91, 0.05, 0.44, 0.81, 0.23, 0.67])
      const g = newGame(rng)
      expect(findMatches(g.grid)).toHaveLength(0)
    }
  })

  it('SIZE×SIZE, 이동 가능, 초기 점수/이동값', () => {
    const g = newGame(seq([0.13, 0.47, 0.71, 0.29, 0.83, 0.05, 0.61, 0.9]))
    expect(g.grid).toHaveLength(SIZE)
    for (const row of g.grid) expect(row).toHaveLength(SIZE)
    expect(g.score).toBe(0)
    expect(g.movesLeft).toBe(MOVES_START)
    expect(g.over).toBe(false)
    expect(hasPossibleMove(g.grid)).toBe(true)
  })
})

describe('findMatches — 가로/세로/길이', () => {
  it('가로 3연속을 찾는다', () => {
    const m = findMatches(toGrid(['AAAB', 'CDEF', 'GHIJ', 'KLMN']))
    expect(m).toHaveLength(3)
    expect(m.every((c) => c.row === 0)).toBe(true)
  })

  it('세로 3연속을 찾는다', () => {
    const m = findMatches(toGrid(['ABCD', 'AEFG', 'AHIJ', 'KLMN']))
    expect(m).toHaveLength(3)
    expect(m.every((c) => c.col === 0)).toBe(true)
  })

  it('4연속과 5연속을 감지한다', () => {
    expect(findMatches(toGrid(['AAAAB']))).toHaveLength(4)
    expect(findMatches(toGrid(['AAAAA']))).toHaveLength(5)
  })

  it('EMPTY 칸은 매치로 세지 않는다', () => {
    expect(findMatches(toGrid(['...X']))).toHaveLength(0)
  })
})

describe('swap', () => {
  it('3-런을 만드는 스왑은 유효하고 이동이 감소하며, 이어 resolveBoard가 제거한다', () => {
    // (0,3)의 A와 (1,3)의 X를 스왑 → 0행 AAAA(가로 매치).
    const state = makeState(['AAAX', 'BCDA', 'EFGH', 'IJKL'])
    const res = swap(state, { row: 0, col: 3 }, { row: 1, col: 3 })
    expect(res.valid).toBe(true)
    expect(res.state.movesLeft).toBe(MOVES_START - 1)
    expect(findMatches(res.state.grid).length).toBeGreaterThanOrEqual(3)

    // resolveBoard가 실제로 매치를 제거하고 점수를 준다.
    const resolved = resolveBoard(res.state, seq([0, 0.2, 0.4, 0.6, 0.8]))
    expect(findMatches(resolved.grid)).toHaveLength(0)
    expect(resolved.score).toBeGreaterThan(0)
  })

  it('아무 매치도 못 만드는 스왑은 되돌려지고(무효) 상태가 불변이다', () => {
    const state = makeState(['ABAB', 'BABA', 'ABAB', 'BABA'])
    const res = swap(state, { row: 0, col: 0 }, { row: 0, col: 1 })
    expect(res.valid).toBe(false)
    expect(res.state).toBe(state)
    expect(res.state.movesLeft).toBe(MOVES_START)
  })

  it('인접하지 않은 스왑은 무효다', () => {
    const state = makeState(['AAAX', 'BCDA', 'EFGH', 'IJKL'])
    const res = swap(state, { row: 0, col: 0 }, { row: 2, col: 2 })
    expect(res.valid).toBe(false)
  })
})

describe('areAdjacent', () => {
  it('상하좌우만 인접', () => {
    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true)
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 0 })).toBe(true)
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false)
    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 0 })).toBe(false)
  })
})

describe('applyGravity / refill', () => {
  it('중력은 젬을 빈 칸 아래로 떨어뜨린다', () => {
    const dropped = applyGravity(toGrid(['A', '.', 'B', '.']))
    expect(dropped[3][0]).toBe('B'.charCodeAt(0))
    expect(dropped[2][0]).toBe('A'.charCodeAt(0))
    expect(dropped[0][0]).toBe(EMPTY)
    expect(dropped[1][0]).toBe(EMPTY)
  })

  it('리필은 위쪽 빈 칸을 채우고 새 셀 목록을 반환한다', () => {
    const { grid: filled, spawned } = refill(toGrid(['..', 'AB']), seq([0, 0.5]))
    expect(filled.flat().every((v) => v !== EMPTY)).toBe(true)
    expect(spawned).toHaveLength(2)
    expect(spawned).toEqual(
      expect.arrayContaining([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ]),
    )
  })
})

describe('resolveSteps — 제거/중력/리필/캐스케이드', () => {
  it('매치를 제거하고 점수를 누적하며 안정 상태로 만든다', () => {
    const res = resolveSteps(toGrid(['AAAB', 'CDCD', 'DCDC', 'CDCD']), seq([0, 0.2, 0.4]))
    expect(res.steps).toHaveLength(1)
    expect(res.steps[0].matches).toHaveLength(3)
    expect(res.steps[0].multiplier).toBe(1)
    expect(res.gained).toBe(3 * GEM_SCORE)
    expect(res.grid.flat().every((v) => v !== EMPTY)).toBe(true)
    expect(findMatches(res.grid)).toHaveLength(0)
  })

  it('드롭으로 새 매치가 생기는 캐스케이드는 배수로 다시 점수를 준다', () => {
    // r2의 MMM 제거 → col0에서 Z가 떨어져 세로 ZZZ 형성(2단계 캐스케이드).
    const board = toGrid([
      'ZPQR',
      'ZUVS',
      'MMMN',
      'ZWXT',
    ])
    const res = resolveSteps(board, seq([0, 0.34, 0.67]))
    expect(res.steps.length).toBeGreaterThanOrEqual(2)
    expect(res.steps[0].multiplier).toBe(1)
    expect(res.steps[0].matches).toHaveLength(3) // MMM
    expect(res.steps[1].multiplier).toBe(2)
    expect(res.steps[1].matches.length).toBeGreaterThanOrEqual(3) // ZZZ
    expect(res.steps[1].gained).toBe(res.steps[1].matches.length * GEM_SCORE * 2)
    // 2단계 총점 = 3*10*1 + N*10*2 이므로 단일 단계보다 크다.
    expect(res.gained).toBeGreaterThan(3 * GEM_SCORE)
    expect(findMatches(res.grid)).toHaveLength(0)
  })
})

describe('resolveBoard — 상태 전이', () => {
  it('점수를 더하고 movesLeft를 유지한다', () => {
    const state: GameState = { grid: toGrid(['AAAB', 'CDCD', 'DCDC', 'CDCD']), score: 100, movesLeft: 5, over: false }
    const next = resolveBoard(state, seq([0, 0.2, 0.4]))
    expect(next.score).toBe(100 + 3 * GEM_SCORE)
    expect(next.movesLeft).toBe(5)
    expect(next.over).toBe(false)
    expect(findMatches(next.grid)).toHaveLength(0)
  })

  it('movesLeft가 0 이하이면 over=true', () => {
    const state: GameState = { grid: toGrid(['AAAB', 'CDCD', 'DCDC', 'CDCD']), score: 0, movesLeft: 0, over: false }
    const next = resolveBoard(state, seq([0, 0.2, 0.4]))
    expect(next.over).toBe(true)
  })
})

describe('hasPossibleMove', () => {
  it('한 수로 매치가 나는 배치는 true', () => {
    // (0,2)의 X와 (1,2)의 A를 스왑하면 0행 AAA.
    expect(hasPossibleMove(toGrid(['AAX', 'BCA', 'DEF']))).toBe(true)
  })

  it('어떤 인접 스왑으로도 매치가 안 나는 라틴방진 배치는 false', () => {
    expect(hasPossibleMove(toGrid(['ABC', 'CAB', 'BCA']))).toBe(false)
  })
})

describe('swapCells', () => {
  it('두 칸 색을 맞바꾸고 원본은 불변', () => {
    const g = toGrid(['AB', 'CD'])
    const s = swapCells(g, { row: 0, col: 0 }, { row: 0, col: 1 })
    expect(s[0][0]).toBe('B'.charCodeAt(0))
    expect(s[0][1]).toBe('A'.charCodeAt(0))
    expect(g[0][0]).toBe('A'.charCodeAt(0))
  })
})

describe('순수성', () => {
  it('엔진 소스에 Math.random 이 없다', () => {
    const src = readFileSync(fileURLToPath(new URL('./engine.ts', import.meta.url)), 'utf8')
    expect(src.includes('Math.random')).toBe(false)
  })
})
