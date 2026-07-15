import { describe, expect, it } from 'vitest'
import {
  activateHole,
  emptyHoles,
  GRID_SIZE,
  HOLES,
  hideMole,
  newGame,
  pickHole,
  popMole,
  ROUND_MS,
  tickTime,
  whack,
  type WhackState,
} from './engine'

const S = (partial: Partial<WhackState> = {}): WhackState => ({
  moles: Array<boolean>(HOLES).fill(false),
  score: 0,
  misses: 0,
  timeLeft: ROUND_MS,
  over: false,
  ...partial,
})

describe('newGame', () => {
  it('3x3 그리드, 두더지 없음, 점수 0, 시간 가득, over 아님', () => {
    const s = newGame()
    expect(HOLES).toBe(GRID_SIZE * GRID_SIZE)
    expect(s.moles).toHaveLength(HOLES)
    expect(s.moles.some(Boolean)).toBe(false)
    expect(s.score).toBe(0)
    expect(s.misses).toBe(0)
    expect(s.timeLeft).toBe(ROUND_MS)
    expect(s.over).toBe(false)
  })
})

describe('pickHole / popMole (rng 주입)', () => {
  it('두더지 등장 위치는 항상 그리드(0..HOLES-1) 안이다', () => {
    // 여러 rng 값에 대해 범위를 벗어나지 않음을 확인
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const hole = pickHole(S(), () => r)
      expect(hole).not.toBeNull()
      expect(hole! >= 0 && hole! < HOLES).toBe(true)
    }
  })

  it('popMole은 빈 구멍 중 하나에만 두더지를 올린다', () => {
    const next = popMole(S(), () => 0) // 첫 빈 구멍(0)
    expect(next.moles[0]).toBe(true)
    expect(next.moles.filter(Boolean)).toHaveLength(1)
  })

  it('이미 두더지가 있는 구멍은 건너뛴다', () => {
    const moles = Array<boolean>(HOLES).fill(false)
    moles[0] = true // 0번은 이미 점유
    const next = popMole(S({ moles }), () => 0) // rng=0 → 남은 빈 구멍 중 첫 번째(1번)
    expect(next.moles[1]).toBe(true)
    expect(next.moles.filter(Boolean)).toHaveLength(2)
  })

  it('빈 구멍이 없으면 상태를 그대로 반환한다', () => {
    const full = S({ moles: Array<boolean>(HOLES).fill(true) })
    expect(pickHole(full, () => 0)).toBeNull()
    expect(popMole(full, () => 0)).toBe(full)
  })

  it('emptyHoles는 두더지가 없는 인덱스만 센다', () => {
    const moles = Array<boolean>(HOLES).fill(false)
    moles[2] = true
    moles[5] = true
    expect(emptyHoles(S({ moles }))).toEqual([0, 1, 3, 4, 6, 7, 8])
  })
})

describe('whack', () => {
  it('두더지가 있는 구멍을 때리면 hit=true, 점수+1, 두더지 제거', () => {
    const moles = Array<boolean>(HOLES).fill(false)
    moles[4] = true
    const { state, hit } = whack(S({ moles }), 4)
    expect(hit).toBe(true)
    expect(state.score).toBe(1)
    expect(state.moles[4]).toBe(false)
  })

  it('빈 구멍을 때리면 hit=false, 점수 그대로, misses+1', () => {
    const { state, hit } = whack(S(), 0)
    expect(hit).toBe(false)
    expect(state.score).toBe(0)
    expect(state.misses).toBe(1)
  })

  it('점수가 여러 번 누적된다', () => {
    let s = S({ moles: Array<boolean>(HOLES).fill(true) })
    ;[0, 3, 7].forEach((h) => {
      s = whack(s, h).state
    })
    expect(s.score).toBe(3)
    expect(s.moles[0]).toBe(false)
    expect(s.moles[3]).toBe(false)
    expect(s.moles[7]).toBe(false)
  })

  it('over 상태에서는 점수가 변하지 않는다', () => {
    const moles = Array<boolean>(HOLES).fill(false)
    moles[0] = true
    const over = S({ moles, over: true })
    const { state, hit } = whack(over, 0)
    expect(hit).toBe(false)
    expect(state).toBe(over)
  })

  it('그리드 밖 인덱스는 안전하게 무시한다', () => {
    expect(whack(S(), -1).hit).toBe(false)
    expect(whack(S(), HOLES).hit).toBe(false)
  })
})

describe('hideMole / activateHole', () => {
  it('activateHole은 지정 구멍에 두더지를 올린다', () => {
    const s = activateHole(S(), 6)
    expect(s.moles[6]).toBe(true)
  })

  it('hideMole은 지정 구멍의 두더지를 내린다(자동 숨김)', () => {
    const moles = Array<boolean>(HOLES).fill(false)
    moles[6] = true
    const s = hideMole(S({ moles }), 6)
    expect(s.moles[6]).toBe(false)
  })
})

describe('tickTime', () => {
  it('시간이 줄어든다', () => {
    const s = tickTime(S({ timeLeft: 10_000 }), 1000)
    expect(s.timeLeft).toBe(9000)
    expect(s.over).toBe(false)
  })

  it('시간이 0 이하가 되면 게임이 끝나고 두더지가 모두 사라진다', () => {
    const moles = Array<boolean>(HOLES).fill(true)
    const s = tickTime(S({ timeLeft: 500, moles }), 800)
    expect(s.timeLeft).toBe(0)
    expect(s.over).toBe(true)
    expect(s.moles.some(Boolean)).toBe(false)
  })

  it('over 상태에서는 시간이 더 줄지 않는다', () => {
    const s = S({ over: true, timeLeft: 0 })
    expect(tickTime(s, 1000)).toBe(s)
  })
})
