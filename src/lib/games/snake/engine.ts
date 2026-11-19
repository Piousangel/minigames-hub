export const GRID = 20

export type Point = { x: number; y: number }
export type Dir = 'up' | 'down' | 'left' | 'right'
export type Rng = () => number

export interface SnakeState {
  snake: Point[] // 머리가 index 0
  dir: Dir // 마지막으로 실제 이동한 방향
  pendingDir: Dir // 다음 틱에 적용될 방향 (= queue[0] ?? dir, 하위 호환용)
  /** 아직 적용 안 된 방향 입력(최대 QUEUE_MAX). 한 틱에 하나씩 소비 — 한 틱 안 '위→왼' 같은 빠른 2입력을 살린다.
   *  없으면(예전 형태 상태) pendingDir≠dir일 때 [pendingDir]로 본다. */
  queue?: Dir[]
  food: Point
  score: number
  over: boolean
}

export const QUEUE_MAX = 2

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
  return { snake, dir: 'right', pendingDir: 'right', queue: [], food: placeFood(snake, rng), score: 0, over: false }
}

function queueOf(state: SnakeState): Dir[] {
  if (state.queue) return state.queue
  return state.pendingDir !== state.dir ? [state.pendingDir] : []
}

/** 방향 입력을 큐에 넣는다. 반대·중복 판정은 큐 마지막(없으면 실제 진행 방향) 기준 — 같은 틱 안
 *  right 진행 중 up→left가 둘 다 살고, 180도 반전(right→left)은 여전히 불가. 꽉 차면 버린다. */
export function changeDir(state: SnakeState, dir: Dir): SnakeState {
  const queue = queueOf(state)
  const last = queue.length ? queue[queue.length - 1] : state.dir
  if (dir === last || dir === OPPOSITE[last] || queue.length >= QUEUE_MAX) return state
  const next = [...queue, dir]
  return { ...state, queue: next, pendingDir: next[0] }
}

export function tick(state: SnakeState, rng: Rng): SnakeState {
  if (state.over) return state
  const queue = queueOf(state)
  const dir = queue.length ? queue[0] : state.pendingDir
  const rest = queue.slice(1)
  const head = state.snake[0]
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y }
  if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID) {
    return { ...state, dir, pendingDir: dir, queue: [], over: true }
  }
  const eats = next.x === state.food.x && next.y === state.food.y
  const body = eats ? state.snake : state.snake.slice(0, -1) // 안 먹으면 꼬리가 비켜준다
  if (body.some((p) => p.x === next.x && p.y === next.y)) {
    return { ...state, dir, pendingDir: dir, queue: [], over: true }
  }
  const snake = [next, ...body]
  return {
    snake,
    dir,
    pendingDir: rest[0] ?? dir,
    queue: rest,
    food: eats ? placeFood(snake, rng) : state.food,
    score: eats ? state.score + 1 : state.score,
    over: false,
  }
}
