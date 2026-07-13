import { describe, expect, it } from 'vitest'
import { changeDir, newSnakeGame, placeFood, tick, type SnakeState } from './engine'

const S = (partial: Partial<SnakeState>): SnakeState => ({
  snake: [{ x: 5, y: 5 }],
  dir: 'right',
  pendingDir: 'right',
  food: { x: 0, y: 0 },
  score: 0,
  over: false,
  ...partial,
})

describe('newSnakeGame', () => {
  it('중앙에서 길이 3, 오른쪽 방향으로 시작한다', () => {
    const s = newSnakeGame(() => 0)
    expect(s.snake).toEqual([{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }])
    expect(s.dir).toBe('right')
    expect(s.score).toBe(0)
    expect(s.over).toBe(false)
  })
})

describe('placeFood', () => {
  it('뱀 위에는 음식이 놓이지 않는다', () => {
    const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }]
    expect(placeFood(snake, () => 0)).toEqual({ x: 2, y: 0 }) // (0,0)(1,0) 제외한 첫 빈 칸
  })
})

describe('changeDir', () => {
  it('정반대 방향은 무시한다', () => {
    const s = S({ dir: 'right', pendingDir: 'right' })
    expect(changeDir(s, 'left')).toBe(s)
  })
  it('직각 방향은 pendingDir만 바꾼다 (dir는 tick에서 반영)', () => {
    const s = S({ dir: 'right', pendingDir: 'right' })
    const next = changeDir(s, 'up')
    expect(next.pendingDir).toBe('up')
    expect(next.dir).toBe('right')
  })
  it('한 틱 안에 두 번 꺾어도 180도 반전은 불가하다', () => {
    const s = changeDir(S({ dir: 'right', pendingDir: 'right' }), 'up')
    expect(changeDir(s, 'left').pendingDir).toBe('up') // dir가 아직 right이므로 left 거부
  })
})

describe('tick', () => {
  it('머리가 전진하고 꼬리가 줄어든다', () => {
    const s = S({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], food: { x: 0, y: 0 } })
    const next = tick(s, () => 0)
    expect(next.snake).toEqual([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }])
    expect(next.score).toBe(0)
  })
  it('pendingDir가 반영되고 dir가 갱신된다', () => {
    const s = S({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }], dir: 'right', pendingDir: 'up', food: { x: 0, y: 0 } })
    const next = tick(s, () => 0)
    expect(next.snake[0]).toEqual({ x: 5, y: 4 })
    expect(next.dir).toBe('up')
  })
  it('음식을 먹으면 성장하고 score+1, 새 음식이 놓인다', () => {
    const s = S({ snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }], food: { x: 6, y: 5 } })
    const next = tick(s, () => 0)
    expect(next.snake).toEqual([{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }])
    expect(next.score).toBe(1)
    expect(next.food).toEqual({ x: 0, y: 0 }) // 첫 빈 칸
  })
  it('벽에 부딪히면 over', () => {
    const s = S({ snake: [{ x: 19, y: 10 }], dir: 'right', pendingDir: 'right' })
    expect(tick(s, () => 0).over).toBe(true)
  })
  it('자기 몸에 부딪히면 over', () => {
    const s = S({
      snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
      dir: 'right',
      pendingDir: 'right',
    })
    expect(tick(s, () => 0).over).toBe(true) // (6,5)는 꼬리가 아닌 몸통
  })
  it('꼬리가 비켜주는 칸으로는 이동할 수 있다', () => {
    const s = S({
      snake: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }],
      dir: 'down',
      pendingDir: 'down',
      food: { x: 0, y: 0 },
    })
    const next = tick(s, () => 0)
    expect(next.over).toBe(false)
    expect(next.snake[0]).toEqual({ x: 5, y: 6 })
  })
  it('over 상태에서는 그대로 반환한다', () => {
    const s = S({ over: true })
    expect(tick(s, () => 0)).toBe(s)
  })
})
