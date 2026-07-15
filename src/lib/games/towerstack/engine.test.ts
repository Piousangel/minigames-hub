import { describe, expect, it } from 'vitest'
import {
  BASE_WIDTH,
  drop,
  FIELD_W,
  MAX_SPEED,
  MAX_WIDTH,
  newGame,
  PERFECT_BONUS,
  spawnMoving,
  START_SPEED,
  step,
  type Moving,
  type StackState,
} from './engine'

/** Build a state with a single below-block and a moving block placed exactly. */
function stateWith(below: { x: number; width: number }, moving: Moving, score = 0): StackState {
  return {
    tower: [below],
    moving,
    speed: START_SPEED + score * 0.16,
    score,
    over: false,
    events: { dropped: false, perfect: false, missed: false, slices: [] },
  }
}

const top = (s: StackState) => s.tower[s.tower.length - 1]

describe('newGame', () => {
  it('centers a base block and spawns a moving block at the base width', () => {
    const s = newGame()
    expect(s.tower).toHaveLength(1)
    expect(s.tower[0].width).toBe(BASE_WIDTH)
    expect(s.tower[0].x).toBe((FIELD_W - BASE_WIDTH) / 2)
    expect(s.moving?.width).toBe(BASE_WIDTH)
    expect(s.over).toBe(false)
    expect(s.score).toBe(0)
  })
})

describe('step', () => {
  it('moves the block back and forth, always staying within [0, FIELD_W - width]', () => {
    let s = newGame()
    const maxX = FIELD_W - s.moving!.width
    const seenDirs = new Set<number>()
    for (let i = 0; i < 500; i++) {
      s = step(s, 1)
      const m = s.moving!
      expect(m.x).toBeGreaterThanOrEqual(0)
      expect(m.x).toBeLessThanOrEqual(maxX)
      seenDirs.add(m.dir)
    }
    // Over 500 frames it must have bounced off both walls.
    expect(seenDirs.has(1)).toBe(true)
    expect(seenDirs.has(-1)).toBe(true)
  })

  it('reverses direction at the right wall', () => {
    // Place the block one step away from the right wall, heading right.
    let s = newGame()
    const maxX = FIELD_W - s.moving!.width
    s = { ...s, moving: { x: maxX - 1, width: s.moving!.width, dir: 1 } }
    s = step(s, 1)
    expect(s.moving!.dir).toBe(-1)
    expect(s.moving!.x).toBeLessThanOrEqual(maxX)
  })

  it('does not mutate the input state', () => {
    const s = newGame()
    const x0 = s.moving!.x
    step(s, 1)
    expect(s.moving!.x).toBe(x0)
  })
})

describe('drop', () => {
  it('slices off the overhang, keeping only the overlap width, and scores', () => {
    const below = { x: 95, width: 130 } // spans [95, 225]
    const moving: Moving = { x: 125, width: 130, dir: 1 } // spans [125, 255]
    const s = drop(stateWith(below, moving))
    // overlap = [125, 225] = 100
    expect(top(s).width).toBe(100)
    expect(top(s).x).toBe(125)
    expect(s.score).toBe(1)
    expect(s.over).toBe(false)
    expect(s.events.missed).toBe(false)
    expect(s.events.slices).toHaveLength(1)
    expect(s.events.slices[0]).toEqual({ x: 225, width: 30 })
  })

  it('ends the game when there is no overlap', () => {
    const below = { x: 95, width: 130 } // spans [95, 225]
    const moving: Moving = { x: 226, width: 130, dir: 1 } // fully to the right
    const s = drop(stateWith(below, moving))
    expect(s.over).toBe(true)
    expect(s.moving).toBeNull()
    expect(s.events.missed).toBe(true)
  })

  it('never grows the placed block beyond the block below on a normal drop', () => {
    const below = { x: 100, width: 120 }
    for (const dx of [-40, -13, 7, 33, 55]) {
      const moving: Moving = { x: below.x + dx, width: below.width, dir: 1 }
      const s = drop(stateWith(below, moving))
      if (!s.over) expect(top(s).width).toBeLessThanOrEqual(below.width)
    }
  })

  it('keeps (nearly) full width on a perfect, near-exact drop', () => {
    const below = { x: 100, width: 100 }
    const moving: Moving = { x: 102, width: 100, dir: 1 } // offset 2 <= tolerance
    const s = drop(stateWith(below, moving))
    expect(s.events.perfect).toBe(true)
    expect(s.events.slices).toHaveLength(0)
    // Perfect regains a little width (the "except perfect-bonus" case).
    expect(top(s).width).toBe(below.width + PERFECT_BONUS)
    expect(top(s).width).toBeGreaterThan(below.width)
  })

  it('caps perfect regain at MAX_WIDTH', () => {
    const below = { x: 95, width: MAX_WIDTH }
    const moving: Moving = { x: 95, width: MAX_WIDTH, dir: 1 }
    const s = drop(stateWith(below, moving))
    expect(s.events.perfect).toBe(true)
    expect(top(s).width).toBe(MAX_WIDTH)
  })

  it('increments the score once per successful drop', () => {
    let s = newGame()
    // Line the moving block up onto the base each time and drop.
    for (let i = 0; i < 4; i++) {
      const below = top(s)
      s = { ...s, moving: { x: below.x, width: s.moving!.width, dir: s.moving!.dir } }
      s = drop(s)
      expect(s.score).toBe(i + 1)
      expect(s.tower).toHaveLength(i + 2)
    }
  })

  it('increases speed as the score grows and clamps at MAX_SPEED', () => {
    const s1 = drop(stateWith({ x: 95, width: 130 }, { x: 95, width: 130, dir: 1 }, 0))
    const s2 = drop(stateWith({ x: 95, width: 130 }, { x: 95, width: 130, dir: 1 }, 5))
    expect(s2.speed).toBeGreaterThan(s1.speed)
    expect(s1.speed).toBeGreaterThan(START_SPEED)

    const fast = drop(stateWith({ x: 95, width: 130 }, { x: 95, width: 130, dir: 1 }, 999))
    expect(fast.speed).toBe(MAX_SPEED)
  })

  it('sets over=true and freezes the moving block on game over', () => {
    const below = { x: 0, width: 40 }
    const moving: Moving = { x: 300, width: 40, dir: 1 }
    const over = drop(stateWith(below, moving))
    expect(over.over).toBe(true)
    // Further steps/drops on an over state are no-ops.
    expect(step(over, 1)).toBe(over)
    expect(drop(over)).toBe(over)
  })
})

describe('spawnMoving', () => {
  it('alternates entry side with score and starts inside the field', () => {
    const even = spawnMoving(80, 0)
    const odd = spawnMoving(80, 1)
    expect(even.dir).toBe(1)
    expect(even.x).toBe(0)
    expect(odd.dir).toBe(-1)
    expect(odd.x).toBe(FIELD_W - 80)
  })
})
