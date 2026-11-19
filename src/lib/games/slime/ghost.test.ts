import { describe, expect, it } from 'vitest'
import { ghostMark } from './ghost'
import { segmentInServerZone } from './multiline'
import { runLine } from './solver'
import { SLIME_STAGES } from './stages'
import { BOARD_H, BOARD_W, CONST, type Pt, type Stage } from './types'

const slide = SLIME_STAGES.find((s) => s.id === 'g-slide')!
const meadow = SLIME_STAGES.find((s) => s.id === 'c-meadow')!
const diag = runLine(slide, [{ x: 50, y: 150 }, { x: 315, y: 488 }])!.line
const inBoard = (p: Pt) => p.x >= 0 && p.x <= BOARD_W && p.y >= 0 && p.y <= BOARD_H

describe('ghostMark', () => {
  it('둥지에 가는 선이면 ✕ 없음', () => {
    expect(ghostMark(slide, diag)).toBeNull()
  })

  it('독꽃 판: 1단계 대각선은 2단계 독꽃 근처에 ✕', () => {
    const m = ghostMark(meadow, diag)!
    expect(m).not.toBeNull()
    expect(inBoard(m)).toBe(true)
    const near = Math.min(...meadow.spikes.map((s) => Math.hypot(s.x - m.x, s.y - m.y)))
    expect(near).toBeLessThan(CONST.SPIKE_R + 40)
  })

  it('추락 판: 보드 밖으로 떨어지면 마지막 점을 보드 안으로 clamp', () => {
    const flat = runLine(slide, [{ x: 40, y: 260 }, { x: 350, y: 300 }])!
    expect(flat.res.outcome).toBe('fell')
    const m = ghostMark(slide, flat.line)!
    expect(m).not.toBeNull()
    expect(inBoard(m)).toBe(true)
  })

  it('금지 구역: 처음 닿는 선분의 시작점', () => {
    const zone = { x0: 150, y0: 200, x1: 250, y1: 300 }
    const st: Stage = { ...slide, id: 't-ban', banZones: [zone] }
    const m = ghostMark(st, diag)
    const i = diag.findIndex((p, k) => k > 0 && segmentInServerZone(diag[k - 1], p, st))
    expect(i).toBeGreaterThan(0)
    expect(m).toEqual(diag[i - 1])
  })
})
