import { describe, expect, it } from 'vitest'
import { hintKilled, prevPassRate } from './gate'
import { runLine, waypointsToRaw } from './solver'
import { A2_MEADOW, A2_MEADOW_2, GATE_STAGES, STAGE_HINTS, SLIME_STAGES } from './stages'

/** 04시 숙의 v2.1 4장 1·3번(11-20): 2단계 legacy 강화안 c-meadow-2 + 콜백 게이트 CB-1·CB-2. */
const G_SLIDE = GATE_STAGES[0]

describe('c-meadow-2 (2단계 legacy 강화안, 풀 밖)', () => {
  it('일일 풀은 그대로다(풀을 바꾸면 그날 기록·서버 제출이 깨진다)', () => {
    expect(SLIME_STAGES.map((s) => s.id)).not.toContain('c-meadow-2')
  })
  it('1단계 땅·출발·꽃을 그대로 쓴다(같은 땅 콜백)', () => {
    expect(A2_MEADOW_2.terrain).toEqual(G_SLIDE.terrain)
    expect(A2_MEADOW_2.spawn).toEqual(G_SLIDE.spawn)
    expect(A2_MEADOW_2.nest).toEqual(G_SLIDE.nest)
  })
  it('추천 길로 별 3개를 먹고 도착한다', () => {
    const r = runLine(A2_MEADOW_2, waypointsToRaw(STAGE_HINTS['c-meadow-2']))
    expect(r?.res.outcome).toBe('nest')
    expect(r?.res.acorns).toBe(3)
  })
  it('1단계 추천 길과 대각선 직선은 독꽃에 닿는다', () => {
    expect(runLine(A2_MEADOW_2, waypointsToRaw(STAGE_HINTS['g-slide']))?.res.outcome).toBe('spiked')
    expect(runLine(A2_MEADOW_2, waypointsToRaw([{ x: 50, y: 150 }, { x: 315, y: 488 }]))?.res.outcome).toBe('spiked')
  })
})

describe('콜백 게이트 CB-1 prevPassRate (seed 2026·pop 80·n 80 고정)', () => {
  it('라이브 c-meadow는 1단계 해의 60%가 그대로 통과한다(약한 콜백, 실측 재현)', () => {
    expect(prevPassRate(G_SLIDE, A2_MEADOW)).toBeCloseTo(0.6, 6)
  })
  it('c-meadow-2는 23.75%로 합격선(≤35%) 안이다', () => {
    const r = prevPassRate(G_SLIDE, A2_MEADOW_2)
    expect(r).toBeCloseTo(0.2375, 6)
    expect(r).toBeLessThanOrEqual(0.35)
  })
  it('다음 판 잉크 한도를 넘는 선은 그을 수 없으므로 실패로 센다', () => {
    expect(prevPassRate(G_SLIDE, { ...G_SLIDE, ink: 60 })).toBe(0)
  })
  it('다음 판 금지 구역에 걸리는 선은 실패로 센다', () => {
    expect(prevPassRate(G_SLIDE, { ...G_SLIDE, banZones: [{ x0: 0, y0: 0, x1: 390, y1: 560 }] })).toBe(0)
  })
})

describe('콜백 게이트 CB-2 hintKilled', () => {
  it('g-slide 추천 길은 c-meadow-2에서 죽는다(사유 spiked)', () => {
    expect(hintKilled(G_SLIDE, A2_MEADOW_2)).toEqual({ killed: true, reason: 'spiked' })
  })
  it('같은 판이면 추천 길이 살아 있다(죽지 않음)', () => {
    expect(hintKilled(G_SLIDE, G_SLIDE)).toEqual({ killed: false, reason: 'nest' })
  })
})
