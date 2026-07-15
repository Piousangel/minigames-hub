// Pong(퐁) 순수 물리 엔진.
// 렌더러와 무관한 고정 논리 좌표계(FIELD_W × FIELD_H) 위에서 계산하고,
// 컴포넌트가 캔버스 크기에 맞춰 스케일한다. 순수/결정적: step·cpuTrack에는 난수를 쓰지 않으며,
// 최초 서브 방향에만 RNG를 주입한다(득점 후 서브는 실점 측을 향해 결정적으로 재설정).
//
// 배치: 플레이어 패들 = 왼쪽, CPU 패들 = 오른쪽. 볼은 수평으로 오간다.
// 벽(위/아래)에서 vy 반사, 패들에서 vx 반사(맞은 위치로 각도 결정 + 약간 가속).
// 볼이 좌/우 경계를 넘으면 반대편이 득점하고, 먼저 WIN_SCORE점에 도달하면 승리.

export type Rng = () => number
export type Difficulty = 'easy' | 'hard'
export type Side = 'player' | 'cpu'

/** 논리 필드 크기(정사각). 컴포넌트가 컨테이너 크기로 스케일한다. */
export const FIELD_W = 480
export const FIELD_H = 480

export const BALL_R = 7

/** 패들 세로 길이/두께. */
export const PADDLE_LEN = 84
export const PADDLE_THICK = 12
/** 좌/우 패들의 바깥쪽(벽에 가까운) 가장자리 x. */
export const PLAYER_X = 22

export const START_SPEED = 6
export const MAX_SPEED = 11
const SPEEDUP = 1.04
const SERVE_MAX_ANGLE = (Math.PI / 180) * 35
const MAX_BOUNCE_ANGLE = (Math.PI / 180) * 55

export const WIN_SCORE = 7

const CPU_SPEED_EASY = 3.4
const CPU_SPEED_HARD = 5.6

/** 패들 중심 y가 움직일 수 있는 범위. */
export const PADDLE_MIN_Y = PADDLE_LEN / 2
export const PADDLE_MAX_Y = FIELD_H - PADDLE_LEN / 2

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
}

/** step이 이번 프레임에 발생시킨 이벤트(주스/사운드용, 매 프레임 새로 계산됨). */
export interface FrameEvents {
  paddleHit: boolean
  wallHit: boolean
  /** 이번 프레임에 득점한 측(없으면 null). */
  scored: Side | null
}

export interface PongState {
  ball: Ball
  /** 왼쪽(플레이어) 패들 중심 y. */
  playerY: number
  /** 오른쪽(CPU) 패들 중심 y. */
  cpuY: number
  playerScore: number
  cpuScore: number
  over: boolean
  winner: Side | null
  events: FrameEvents
}

const NO_EVENTS: FrameEvents = { paddleHit: false, wallHit: false, scored: null }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** 패들 중심 y를 필드 안으로 제한. */
export function clampPaddle(y: number): number {
  return clamp(y, PADDLE_MIN_Y, PADDLE_MAX_Y)
}

const HALF_LEN = PADDLE_LEN / 2

/** 플레이어 패들 앞면(볼이 부딪히는 면) x. */
const PLAYER_FRONT = PLAYER_X + PADDLE_THICK
/** CPU 패들 앞면 x. */
const CPU_FRONT = FIELD_W - PLAYER_X - PADDLE_THICK
const CPU_BACK = FIELD_W - PLAYER_X

/** 볼이 패들의 세로 범위 안에 있는지(반지름 포함). */
function withinPaddle(ballY: number, paddleY: number): boolean {
  return ballY + BALL_R >= paddleY - HALF_LEN && ballY - BALL_R <= paddleY + HALF_LEN
}

/** 중앙에서 서브: dirX(-1=플레이어 쪽, +1=CPU 쪽), vertFrac(-1..1)로 각도 결정. */
function serveFromCenter(dirX: 1 | -1, vertFrac: number): Ball {
  const angle = clamp(vertFrac, -1, 1) * SERVE_MAX_ANGLE
  return {
    x: FIELD_W / 2,
    y: FIELD_H / 2,
    vx: dirX * START_SPEED * Math.cos(angle),
    vy: START_SPEED * Math.sin(angle),
  }
}

/** 새 게임. 최초 서브 방향/각도에만 RNG를 사용한다. */
export function newGame(rng: Rng = Math.random): PongState {
  const dirX: 1 | -1 = rng() < 0.5 ? -1 : 1
  const vertFrac = rng() * 2 - 1
  return {
    ball: serveFromCenter(dirX, vertFrac),
    playerY: FIELD_H / 2,
    cpuY: FIELD_H / 2,
    playerScore: 0,
    cpuScore: 0,
    over: false,
    winner: null,
    events: NO_EVENTS,
  }
}

export interface StepInput {
  /** 프레임 배수(1 = 60fps 한 틱). 기본 1. */
  dt?: number
  /** 플레이어 패들 중심 y의 목표값(마우스/키보드). 없으면 유지. */
  playerPaddleY?: number
}

/**
 * CPU 패들을 볼 쪽으로 한 프레임 이동. 순수/결정적(난수 없음).
 * difficulty에 따라 추적 속도가 다르다. 데드존으로 미세 진동을 억제.
 */
export function cpuTrack(state: PongState, dt: number, difficulty: Difficulty): PongState {
  if (state.over) return state
  const speed = difficulty === 'hard' ? CPU_SPEED_HARD : CPU_SPEED_EASY
  const diff = state.ball.y - state.cpuY
  const dead = 5
  if (Math.abs(diff) <= dead) return state
  const move = clamp(diff, -speed * dt, speed * dt)
  const cpuY = clampPaddle(state.cpuY + move)
  return cpuY === state.cpuY ? state : { ...state, cpuY }
}

/**
 * 물리 한 프레임 전진: 플레이어 패들 반영 → 볼 이동 → 벽/패들 반사 →
 * 경계 통과 시 득점·서브 재설정 → 승리 판정. 순수 함수 — 입력만으로 결정적.
 */
export function step(state: PongState, input: StepInput = {}): PongState {
  if (state.over) return state

  const dt = input.dt ?? 1
  const playerY = input.playerPaddleY !== undefined ? clampPaddle(input.playerPaddleY) : state.playerY
  const events: FrameEvents = { paddleHit: false, wallHit: false, scored: null }
  const r = BALL_R

  let { x, y, vx, vy } = state.ball
  x += vx * dt
  y += vy * dt

  // 위/아래 벽 반사
  if (y - r < 0) {
    y = r
    vy = Math.abs(vy)
    events.wallHit = true
  } else if (y + r > FIELD_H) {
    y = FIELD_H - r
    vy = -Math.abs(vy)
    events.wallHit = true
  }

  // 플레이어(왼쪽) 패들 충돌 — 볼이 왼쪽으로 이동 중일 때만
  if (vx < 0 && x - r <= PLAYER_FRONT && x - r >= PLAYER_X - PADDLE_THICK && withinPaddle(y, playerY)) {
    x = PLAYER_FRONT + r
    const rel = clamp((y - playerY) / HALF_LEN, -1, 1)
    const angle = rel * MAX_BOUNCE_ANGLE
    const speed = Math.min((Math.hypot(vx, vy) || START_SPEED) * SPEEDUP, MAX_SPEED)
    vx = speed * Math.cos(angle) // 양수 → 오른쪽으로 반사
    vy = speed * Math.sin(angle)
    events.paddleHit = true
  }
  // CPU(오른쪽) 패들 충돌 — 볼이 오른쪽으로 이동 중일 때만
  else if (vx > 0 && x + r >= CPU_FRONT && x + r <= CPU_BACK + PADDLE_THICK && withinPaddle(y, state.cpuY)) {
    x = CPU_FRONT - r
    const rel = clamp((y - state.cpuY) / HALF_LEN, -1, 1)
    const angle = rel * MAX_BOUNCE_ANGLE
    const speed = Math.min((Math.hypot(vx, vy) || START_SPEED) * SPEEDUP, MAX_SPEED)
    vx = -speed * Math.cos(angle) // 음수 → 왼쪽으로 반사
    vy = speed * Math.sin(angle)
    events.paddleHit = true
  }

  // 왼쪽 경계 통과 → CPU 득점
  if (x < 0) {
    const cpuScore = state.cpuScore + 1
    events.scored = 'cpu'
    const over = cpuScore >= WIN_SCORE
    const total = state.playerScore + cpuScore
    return {
      ...state,
      ball: over ? { x, y, vx, vy } : serveFromCenter(-1, total % 2 === 0 ? 0.4 : -0.4),
      playerY,
      cpuScore,
      over,
      winner: over ? 'cpu' : null,
      events,
    }
  }
  // 오른쪽 경계 통과 → 플레이어 득점
  if (x > FIELD_W) {
    const playerScore = state.playerScore + 1
    events.scored = 'player'
    const over = playerScore >= WIN_SCORE
    const total = playerScore + state.cpuScore
    return {
      ...state,
      ball: over ? { x, y, vx, vy } : serveFromCenter(1, total % 2 === 0 ? 0.4 : -0.4),
      playerY,
      playerScore,
      over,
      winner: over ? 'player' : null,
      events,
    }
  }

  return { ...state, ball: { x, y, vx, vy }, playerY, events }
}
