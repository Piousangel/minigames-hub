import { describe, expect, it } from 'vitest'
import {
  BALL_R,
  BALL_SPEED,
  brickPoints,
  COLS,
  FIELD_H,
  FIELD_W,
  launch,
  movePaddleBy,
  movePaddleTo,
  newGame,
  PADDLE_Y,
  ROWS,
  step,
  START_LIVES,
  type Ball,
  type BreakoutState,
} from './engine'

const HALF = FIELD_W / 2

// 살아있는 벽돌이 하나뿐인, 통제된 상태를 만든다(전멸 판정 테스트 오염 방지).
function withSingleBrick(ball: Ball, partial: Partial<BreakoutState> = {}): BreakoutState {
  const base = newGame()
  return {
    ...base,
    ball,
    launched: true,
    bricks: base.bricks.map((b, i) => ({ ...b, alive: i === 0 })),
    ...partial,
  }
}

describe('newGame', () => {
  it('벽돌 ROWS*COLS개, 생명 3, 미발사, 진행 중으로 시작한다', () => {
    const s = newGame()
    expect(s.bricks.length).toBe(ROWS * COLS)
    expect(s.bricks.every((b) => b.alive)).toBe(true)
    expect(s.lives).toBe(START_LIVES)
    expect(s.launched).toBe(false)
    expect(s.over).toBe(false)
    expect(s.won).toBe(false)
    expect(s.paddleX).toBe(FIELD_W / 2)
  })
})

describe('brickPoints', () => {
  it('위쪽 행일수록 점수가 높다', () => {
    expect(brickPoints(0)).toBeGreaterThan(brickPoints(ROWS - 1))
  })
})

describe('launch', () => {
  it('발사하면 위로 향하는 속도를 갖는다', () => {
    const s = launch(newGame(), () => 0.5) // 정중앙 → 수직 상승
    expect(s.launched).toBe(true)
    expect(s.ball.vy).toBeLessThan(0)
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeCloseTo(BALL_SPEED, 5)
  })
  it('이미 발사했으면 무시한다', () => {
    const s = launch(newGame(), () => 0.5)
    expect(launch(s, () => 0.1)).toBe(s)
  })
})

describe('movePaddle', () => {
  it('필드 밖으로 나가지 않게 클램프한다', () => {
    const s = newGame()
    expect(movePaddleTo(s, -999).paddleX).toBe(PADDLE_W_HALF())
  })
  it('발사 전에는 볼이 패들을 따라온다', () => {
    const moved = movePaddleTo(newGame(), 120)
    expect(moved.ball.x).toBe(moved.paddleX)
  })
  it('상대 이동도 클램프된다', () => {
    const s = movePaddleBy(newGame(), 999)
    expect(s.paddleX).toBe(FIELD_W - PADDLE_W_HALF())
  })
})

// 패들 반너비(테스트 가독용 헬퍼)
function PADDLE_W_HALF() {
  return 84 / 2
}

describe('step: 발사 전', () => {
  it('볼이 패들 위에 정지해 있고 움직이지 않는다', () => {
    const s = newGame()
    const next = step(s)
    expect(next.ball.vx).toBe(0)
    expect(next.ball.vy).toBe(0)
    expect(next.ball.y).toBe(PADDLE_Y - BALL_R)
  })
})

describe('step: 벽 반사', () => {
  it('오른쪽 벽에 닿으면 vx가 반전된다', () => {
    const ball: Ball = { x: FIELD_W - BALL_R - 1, y: 200, vx: 5, vy: -1 }
    const next = step(withSingleBrick(ball))
    expect(next.ball.vx).toBeLessThan(0)
    expect(next.events.wallHit).toBe(true)
    expect(next.ball.x + BALL_R).toBeLessThanOrEqual(FIELD_W)
  })
  it('왼쪽 벽에 닿으면 vx가 양수로 반전된다', () => {
    const ball: Ball = { x: BALL_R + 1, y: 200, vx: -5, vy: -1 }
    const next = step(withSingleBrick(ball))
    expect(next.ball.vx).toBeGreaterThan(0)
  })
  it('천장에 닿으면 vy가 아래로 반전된다', () => {
    const ball: Ball = { x: 240, y: BALL_R + 1, vx: 0, vy: -5 }
    const next = step(withSingleBrick(ball))
    expect(next.ball.vy).toBeGreaterThan(0)
  })
})

describe('step: 패들 반사', () => {
  it('하강 중 패들에 닿으면 위로 튕긴다', () => {
    const ball: Ball = { x: HALF, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 4 }
    const next = step(withSingleBrick(ball, { paddleX: HALF }))
    expect(next.ball.vy).toBeLessThan(0)
    expect(next.events.paddleHit).toBe(true)
  })
  it('패들 왼쪽에 맞으면 왼쪽으로 반사된다', () => {
    const paddleX = HALF
    const ball: Ball = { x: paddleX - 30, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 4 }
    const next = step(withSingleBrick(ball, { paddleX }))
    expect(next.ball.vx).toBeLessThan(0)
    expect(next.ball.vy).toBeLessThan(0)
  })
})

describe('step: 벽돌 충돌', () => {
  it('벽돌을 제거하고 점수를 올리며 반사한다', () => {
    const brickGame = newGame()
    const target = brickGame.bricks[0]
    // 대상 벽돌 바로 아래에서 위로 향하는 볼
    const ball: Ball = { x: target.x + 5, y: target.y + 20 + BALL_R - 1, vx: 0, vy: -4 }
    const next = step({
      ...brickGame,
      launched: true,
      ball,
      bricks: brickGame.bricks.map((b, i) => ({ ...b, alive: i === 0 })),
    })
    expect(next.bricks[0].alive).toBe(false)
    expect(next.score).toBe(brickPoints(target.row))
    expect(next.events.brokeBrick).not.toBeNull()
    expect(next.ball.vy).toBeGreaterThan(0) // 아래로 반사
  })
})

describe('step: 생명/승패', () => {
  it('볼이 바닥 아래로 떨어지면 생명이 줄고 볼이 패들로 복귀한다', () => {
    const ball: Ball = { x: 100, y: FIELD_H + BALL_R, vx: 2, vy: 6 }
    const next = step(withSingleBrick(ball, { lives: 3 }))
    expect(next.lives).toBe(2)
    expect(next.launched).toBe(false)
    expect(next.over).toBe(false)
    expect(next.events.lostLife).toBe(true)
    expect(next.ball.y).toBe(PADDLE_Y - BALL_R)
  })
  it('마지막 생명에서 떨어지면 게임 오버', () => {
    const ball: Ball = { x: 100, y: FIELD_H + BALL_R, vx: 2, vy: 6 }
    const next = step(withSingleBrick(ball, { lives: 1 }))
    expect(next.lives).toBe(0)
    expect(next.over).toBe(true)
  })
  it('마지막 벽돌을 깨면 승리한다', () => {
    const brickGame = newGame()
    const target = brickGame.bricks[0]
    const ball: Ball = { x: target.x + 5, y: target.y + 20 + BALL_R - 1, vx: 0, vy: -4 }
    const next = step({
      ...brickGame,
      launched: true,
      ball,
      bricks: brickGame.bricks.map((b, i) => ({ ...b, alive: i === 0 })),
    })
    expect(next.won).toBe(true)
    expect(next.events.won).toBe(true)
  })
  it('over/won 상태에서는 그대로 반환한다', () => {
    const over = withSingleBrick({ x: 1, y: 1, vx: 1, vy: 1 }, { over: true })
    expect(step(over)).toBe(over)
    const won = withSingleBrick({ x: 1, y: 1, vx: 1, vy: 1 }, { won: true })
    expect(step(won)).toBe(won)
  })
})

describe('step: 진행', () => {
  it('충돌이 없으면 속도만큼 전진한다', () => {
    const ball: Ball = { x: 240, y: 240, vx: 3, vy: -2 }
    const next = step(withSingleBrick(ball))
    expect(next.ball.x).toBe(243)
    expect(next.ball.y).toBe(238)
    expect(COLS).toBeGreaterThan(0) // 상수 노출 확인
  })
})
