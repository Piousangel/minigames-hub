export const GRID = 20

export type Point = { x: number; y: number }
export type Dir = 'up' | 'down' | 'left' | 'right'
export type Rng = () => number

export interface SnakeState {
  snake: Point[] // 머리가 index 0
  dir: Dir // 마지막으로 실제 이동한 방향
  pendingDir: Dir // 다음 틱에 적용될 방향
  food: Point
  score: number
  over: boolean
}

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export function placeFood(snake: Point[], rng: Rng): Point {
  const free: Point[] = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!snake.some((p) => p.x === x && p.y === y)) free.push({ x, y })
    }
  }
  return free[Math.floor(rng() * free.length)]
}

export function newSnakeGame(rng: Rng): SnakeState {
  const mid = Math.floor(GRID / 2)
  const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }]
  return { snake, dir: 'right', pendingDir: 'right', food: placeFood(snake, rng), score: 0, over: false }
}

export function changeDir(state: SnakeState, dir: Dir): SnakeState {
  if (dir === OPPOSITE[state.dir]) return state
  return { ...state, pendingDir: dir }
}

export function tick(state: SnakeState, rng: Rng): SnakeState {
  if (state.over) return state
  const dir = state.pendingDir
  const head = state.snake[0]
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y }
  if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
    return { ...state, dir, over: true }
  }
  const eats = next.x === state.food.x && next.y === state.food.y
  const body = eats ? state.snake : state.snake.slice(0, -1) // 안 먹으면 꼬리가 비켜준다
  if (body.some((p) => p.x === next.x && p.y === next.y)) {
    return { ...state, dir, over: true }
  }
  const snake = [next, ...body]
  return {
    snake,
    dir,
    pendingDir: dir,
    food: eats ? placeFood(snake, rng) : state.food,
    score: eats ? state.score + 1 : state.score,
    over: false,
  }
}
