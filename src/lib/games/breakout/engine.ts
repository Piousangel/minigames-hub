// Breakout(벽돌깨기) 순수 물리 엔진.
// 렌더러와 무관한 고정 논리 좌표계(FIELD_W × FIELD_H) 위에서 계산하고,
// 컴포넌트가 캔버스 크기에 맞춰 스케일한다. 순수/결정적: step에는 난수를 쓰지 않으며,
// 초기 발사 각도에만 RNG를 주입한다.

export type Rng = () => number

/** 논리 필드 크기(정사각). 컴포넌트가 컨테이너 크기로 스케일한다. */
export const FIELD_W = 480
export const FIELD_H = 480

export const COLS = 8
export const ROWS = 6
const BRICK_GAP = 4
const SIDE_PAD = 16
const TOP_PAD = 52
export const BRICK_H = 20
export const BRICK_W = (FIELD_W - 2 * SIDE_PAD - (COLS - 1) * BRICK_GAP) / COLS

export const PADDLE_W = 84
export const PADDLE_H = 12
/** 패들 윗면 y. */
export const PADDLE_Y = FIELD_H - 36
export const PADDLE_SPEED = 8 // 화살표 한 프레임당 이동량(논리 단위)

export const BALL_R = 6
export const BALL_SPEED = 5.2
const MAX_BOUNCE_ANGLE = (Math.PI / 180) * 60 // 패들 가장자리에서의 최대 반사각(수직 기준)

export const START_LIVES = 3

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
}

export interface Brick {
  x: number
  y: number
  row: number
  col: number
  alive: boolean
}

/** step이 이번 프레임에 발생시킨 이벤트(주스/사운드용, 매 프레임 새로 계산됨). */
export interface FrameEvents {
  brokeBrick: { x: number; y: number; row: number } | null
  paddleHit: boolean
  wallHit: boolean
  lostLife: boolean
  won: boolean
}

export interface BreakoutState {
  ball: Ball
  paddleX: number // 패들 중심 x
  bricks: Brick[]
  score: number
  lives: number
  launched: boolean // 발사 전에는 볼이 패들에 붙어 있다
  won: boolean
  over: boolean
  events: FrameEvents
}

const NO_EVENTS: FrameEvents = {
  brokeBrick: null,
  paddleHit: false,
  wallHit: false,
  lostLife: false,
  won: false,
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** 행별 점수: 위쪽(어려운) 행일수록 높다. */
export function brickPoints(row: number): number {
  return (ROWS - row) * 10
}

function buildBricks(): Brick[] {
  const bricks: Brick[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      bricks.push({
        x: SIDE_PAD + col * (BRICK_W + BRICK_GAP),
        y: TOP_PAD + row * (BRICK_H + BRICK_GAP),
        row,
        col,
        alive: true,
      })
    }
  }
  return bricks
}

/** 패들 위 정지 상태의 볼. */
function ballOnPaddle(paddleX: number): Ball {
  return { x: paddleX, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 }
}

export function newGame(): BreakoutState {
  const paddleX = FIELD_W / 2
  return {
    ball: ballOnPaddle(paddleX),
    paddleX,
    bricks: buildBricks(),
    score: 0,
    lives: START_LIVES,
    launched: false,
    won: false,
    over: false,
    events: NO_EVENTS,
  }
}

const HALF_PADDLE = PADDLE_W / 2

/** 패들 중심을 절대 x로 이동(클램프). 발사 전이면 볼도 함께 따라온다. */
export function movePaddleTo(state: BreakoutState, x: number): BreakoutState {
  if (state.over || state.won) return state
  const paddleX = clamp(x, HALF_PADDLE, FIELD_W - HALF_PADDLE)
  if (paddleX === state.paddleX) return state
  const ball = state.launched ? state.ball : ballOnPaddle(paddleX)
  return { ...state, paddleX, ball }
}

/** 패들을 상대적으로 이동(화살표 키용). */
export function movePaddleBy(state: BreakoutState, dx: number): BreakoutState {
  return movePaddleTo(state, state.paddleX + dx)
}

/** 볼 발사. 발사 전 상태에서만 동작하며 초기 각도에 RNG를 사용한다. */
export function launch(state: BreakoutState, rng: Rng): BreakoutState {
  if (state.launched || state.over || state.won) return state
  const angle = (rng() * 2 - 1) * (Math.PI / 4) // 수직 기준 -45°..45°
  return {
    ...state,
    launched: true,
    ball: {
      x: state.paddleX,
      y: PADDLE_Y - BALL_R,
      vx: BALL_SPEED * Math.sin(angle),
      vy: -BALL_SPEED * Math.cos(angle),
    },
    events: NO_EVENTS,
  }
}

export interface StepInput {
  /** 프레임 배수(1 = 60fps 한 틱). 기본 1. */
  dt?: number
}

/**
 * 물리 한 프레임 전진: 볼 이동, 벽/패들/벽돌 충돌·반사, 벽돌 제거·점수,
 * 낙하 시 생명 감소, 전멸 시 승리. 순수 함수 — 입력만으로 결정적.
 */
export function step(state: BreakoutState, input: StepInput = {}): BreakoutState {
  if (state.over || state.won) return state
  // 발사 전에는 볼이 패들 위에 붙어 있다.
  if (!state.launched) {
    return { ...state, ball: ballOnPaddle(state.paddleX), events: NO_EVENTS }
  }

  const dt = input.dt ?? 1
  const events: FrameEvents = { ...NO_EVENTS }
  const r = BALL_R
  let { x, y, vx, vy } = state.ball

  x += vx * dt
  y += vy * dt

  // 좌우 벽
  if (x - r < 0) {
    x = r
    vx = Math.abs(vx)
    events.wallHit = true
  } else if (x + r > FIELD_W) {
    x = FIELD_W - r
    vx = -Math.abs(vx)
    events.wallHit = true
  }
  // 천장
  if (y - r < 0) {
    y = r
    vy = Math.abs(vy)
    events.wallHit = true
  }

  // 패들 충돌(하강 중, 볼 밑면이 패들 윗면을 지날 때)
  const left = state.paddleX - HALF_PADDLE
  const right = state.paddleX + HALF_PADDLE
  if (vy > 0 && y + r >= PADDLE_Y && y - r <= PADDLE_Y + PADDLE_H && x >= left - r && x <= right + r) {
    y = PADDLE_Y - r
    const rel = clamp((x - state.paddleX) / HALF_PADDLE, -1, 1) // -1..1
    const angle = rel * MAX_BOUNCE_ANGLE
    const speed = Math.hypot(vx, vy) || BALL_SPEED
    vx = speed * Math.sin(angle)
    vy = -speed * Math.cos(angle)
    events.paddleHit = true
  }

  // 벽돌 충돌: 한 프레임에 하나만 처리(가장 가까운 겹침).
  let bricks = state.bricks
  let score = state.score
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i]
    if (!b.alive) continue
    const nx = clamp(x, b.x, b.x + BRICK_W)
    const ny = clamp(y, b.y, b.y + BRICK_H)
    const dx = x - nx
    const dy = y - ny
    if (dx * dx + dy * dy > r * r) continue

    // 반사 축: 벽돌 중심 대비 상대 위치로 수평/수직 판정
    const cx = b.x + BRICK_W / 2
    const cy = b.y + BRICK_H / 2
    const relX = (x - cx) / (BRICK_W / 2)
    const relY = (y - cy) / (BRICK_H / 2)
    if (Math.abs(relX) > Math.abs(relY)) vx = -vx
    else vy = -vy

    bricks = bricks.slice()
    bricks[i] = { ...b, alive: false }
    score += brickPoints(b.row)
    events.brokeBrick = { x: cx, y: cy, row: b.row }
    break
  }

  // 낙하 → 생명 감소
  if (y - r > FIELD_H) {
    const lives = state.lives - 1
    events.lostLife = true
    if (lives <= 0) {
      return { ...state, ball: { x, y, vx, vy }, bricks, score, lives: 0, launched: true, over: true, events }
    }
    return {
      ...state,
      ball: ballOnPaddle(state.paddleX),
      bricks,
      score,
      lives,
      launched: false,
      events,
    }
  }

  // 전멸 → 승리
  const won = !bricks.some((b) => b.alive)
  if (won) events.won = true

  return { ...state, ball: { x, y, vx, vy }, bricks, score, won, events }
}
