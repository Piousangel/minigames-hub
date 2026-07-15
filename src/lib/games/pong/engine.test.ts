import { describe, expect, it } from 'vitest'
import {
  BALL_R,
  cpuTrack,
  FIELD_H,
  FIELD_W,
  newGame,
  PLAYER_X,
  PADDLE_THICK,
  step,
  WIN_SCORE,
  type PongState,
} from './engine'

// 통제된 상태를 만든다(테스트가 물리 한 조각만 검증하도록).
function makeState(partial: Partial<PongState> = {}): PongState {
  return {
    ball: { x: FIELD_W / 2, y: FIELD_H / 2, vx: 6, vy: 0 },
    playerY: FIELD_H / 2,
    cpuY: FIELD_H / 2,
    playerScore: 0,
    cpuScore: 0,
    over: false,
    winner: null,
    events: { paddleHit: false, wallHit: false, scored: null },
    ...partial,
  }
}

describe('newGame', () => {
  it('점수 0, 미종료, 볼은 중앙에서 속도를 가진 채 시작한다', () => {
    const s = newGame(() => 0.5)
    expect(s.playerScore).toBe(0)
    expect(s.cpuScore).toBe(0)
    expect(s.over).toBe(false)
    expect(s.winner).toBeNull()
    expect(s.ball.x).toBe(FIELD_W / 2)
    expect(s.ball.y).toBe(FIELD_H / 2)
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeGreaterThan(0)
  })

  it('주입한 rng로 서브 방향이 결정된다(결정적)', () => {
    const left = newGame(() => 0.2) // < 0.5 → 왼쪽
    const right = newGame(() => 0.8) // >= 0.5 → 오른쪽
    expect(left.ball.vx).toBeLessThan(0)
    expect(right.ball.vx).toBeGreaterThan(0)
  })
})

describe('step: 볼 전진', () => {
  it('속도만큼 위치가 전진한다', () => {
    const s = makeState({ ball: { x: 200, y: 240, vx: 6, vy: 3 } })
    const n = step(s, { dt: 1 })
    expect(n.ball.x).toBeCloseTo(206, 5)
    expect(n.ball.y).toBeCloseTo(243, 5)
  })

  it('dt에 비례해 더 멀리 전진한다', () => {
    const s = makeState({ ball: { x: 200, y: 240, vx: 6, vy: 0 } })
    const n = step(s, { dt: 2 })
    expect(n.ball.x).toBeCloseTo(212, 5)
  })
})

describe('step: 벽 반사', () => {
  it('위쪽 벽에 닿으면 vy가 양수로 반사된다', () => {
    const s = makeState({ ball: { x: 240, y: BALL_R + 1, vx: 0, vy: -6 } })
    const n = step(s, { dt: 1 })
    expect(n.ball.vy).toBeGreaterThan(0)
    expect(n.events.wallHit).toBe(true)
  })

  it('아래쪽 벽에 닿으면 vy가 음수로 반사된다', () => {
    const s = makeState({ ball: { x: 240, y: FIELD_H - BALL_R - 1, vx: 0, vy: 6 } })
    const n = step(s, { dt: 1 })
    expect(n.ball.vy).toBeLessThan(0)
    expect(n.events.wallHit).toBe(true)
  })
})

describe('step: 패들 반사', () => {
  it('플레이어 패들에 맞으면 vx가 오른쪽(양수)으로 반사된다', () => {
    const front = PLAYER_X + PADDLE_THICK
    const s = makeState({
      ball: { x: front + BALL_R + 3, y: 240, vx: -6, vy: 0 },
      playerY: 240,
    })
    const n = step(s, { dt: 1 })
    expect(n.ball.vx).toBeGreaterThan(0)
    expect(n.events.paddleHit).toBe(true)
  })

  it('CPU 패들에 맞으면 vx가 왼쪽(음수)으로 반사된다', () => {
    const front = FIELD_W - PLAYER_X - PADDLE_THICK
    const s = makeState({
      ball: { x: front - BALL_R - 3, y: 240, vx: 6, vy: 0 },
      cpuY: 240,
    })
    const n = step(s, { dt: 1 })
    expect(n.ball.vx).toBeLessThan(0)
    expect(n.events.paddleHit).toBe(true)
  })
})

describe('step: 득점과 서브 재설정', () => {
  it('볼이 플레이어(왼쪽) 경계를 넘으면 CPU가 득점하고 볼이 중앙에서 재서브된다', () => {
    const s = makeState({ ball: { x: 2, y: 300, vx: -6, vy: 0 }, cpuY: 0 })
    const n = step(s, { dt: 1 })
    expect(n.cpuScore).toBe(1)
    expect(n.playerScore).toBe(0)
    expect(n.events.scored).toBe('cpu')
    expect(n.ball.x).toBe(FIELD_W / 2)
    expect(n.ball.y).toBe(FIELD_H / 2)
  })

  it('볼이 CPU(오른쪽) 경계를 넘으면 플레이어가 득점한다', () => {
    const s = makeState({ ball: { x: FIELD_W - 2, y: 100, vx: 6, vy: 0 }, playerY: 0 })
    const n = step(s, { dt: 1 })
    expect(n.playerScore).toBe(1)
    expect(n.cpuScore).toBe(0)
    expect(n.events.scored).toBe('player')
    expect(n.ball.x).toBe(FIELD_W / 2)
  })
})

describe('step: 승리 판정', () => {
  it('WIN_SCORE점에 도달하면 over=true, winner가 정해진다', () => {
    const s = makeState({
      ball: { x: FIELD_W - 2, y: 240, vx: 6, vy: 0 },
      playerScore: WIN_SCORE - 1,
      playerY: 0,
    })
    const n = step(s, { dt: 1 })
    expect(n.playerScore).toBe(WIN_SCORE)
    expect(n.over).toBe(true)
    expect(n.winner).toBe('player')
  })

  it('over 상태에서는 step이 상태를 그대로 반환한다', () => {
    const s = makeState({ over: true, winner: 'cpu', ball: { x: 200, y: 240, vx: 6, vy: 0 } })
    const n = step(s, { dt: 1 })
    expect(n).toBe(s)
  })
})

describe('cpuTrack', () => {
  it('볼이 패들 위에 있으면 CPU 패들이 위로(값 감소) 이동한다', () => {
    const s = makeState({ cpuY: 300, ball: { x: 400, y: 120, vx: 6, vy: 0 } })
    const n = cpuTrack(s, 1, 'hard')
    expect(n.cpuY).toBeLessThan(300)
  })

  it('볼이 패들 아래에 있으면 CPU 패들이 아래로(값 증가) 이동한다', () => {
    const s = makeState({ cpuY: 120, ball: { x: 400, y: 360, vx: 6, vy: 0 } })
    const n = cpuTrack(s, 1, 'hard')
    expect(n.cpuY).toBeGreaterThan(120)
  })

  it('hard가 easy보다 한 프레임에 더 많이 추적한다', () => {
    const s = makeState({ cpuY: 100, ball: { x: 400, y: 400, vx: 6, vy: 0 } })
    const easy = cpuTrack(s, 1, 'easy')
    const hard = cpuTrack(s, 1, 'hard')
    expect(hard.cpuY - 100).toBeGreaterThan(easy.cpuY - 100)
  })
})
