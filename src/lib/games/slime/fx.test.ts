import { describe, expect, it } from 'vitest'
import { Fx } from './fx'

describe('Fx', () => {
  it('파티클은 수명이 지나면 사라지고, 글자는 위로 떠오르다 사라진다', () => {
    const fx = new Fx()
    fx.sparks(0, 0, 12, '#fff', 100, 0.5)
    fx.confetti(0, 0, 10)
    fx.text(10, 100, '+100', '#fff', 18, 0.9)
    expect(fx.ps.length).toBe(22)
    fx.update(0.3)
    expect(fx.texts[0].y).toBeLessThan(100)
    for (let i = 0; i < 40; i++) fx.update(0.1)
    expect(fx.ps.length).toBe(0)
    expect(fx.texts.length).toBe(0)
  })
  it('움직임 줄이기(calm)에서는 파티클 수가 1/3로 줄고, clear는 모두 비운다', () => {
    const a = new Fx()
    const b = new Fx()
    b.calm = true
    a.confetti(0, 0, 30)
    b.confetti(0, 0, 30)
    expect(b.ps.length).toBe(10)
    expect(a.ps.length).toBe(30)
    a.text(0, 0, 'x')
    a.clear()
    expect(a.ps.length + a.texts.length).toBe(0)
  })
  it('중력으로 아래로 가속한다', () => {
    const fx = new Fx()
    fx.confetti(0, 0, 1)
    const vy0 = fx.ps[0].vy
    fx.update(0.1)
    expect(fx.ps[0].vy).toBeGreaterThan(vy0)
  })
})
