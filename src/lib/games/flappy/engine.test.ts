import { describe, expect, it } from 'vitest'
import {
  BIRD_R,
  FIELD_H,
  FLAP_IMPULSE,
  GAP,
  GAP_MARGIN,
  MAX_FALL,
  newGame,
  nextGapY,
  spawnPipe,
  step,
  type FlappyState,
  type Pipe,
} from './engine'

const S = (partial: Partial<FlappyState> = {}): FlappyState => ({
  y: FIELD_H / 2,
  vy: 0,
  pipes: [],
  score: 0,
  over: false,
  events: { scored: false, crashed: false },
  ...partial,
})

const noFlap = { dt: 1, flap: false }
const flap = { dt: 1, flap: true }
const rng = () => 0.5

describe('newGame', () => {
  it('centers the bird, at rest, with no pipes or score', () => {
    const s = newGame()
    expect(s.y).toBe(FIELD_H / 2)
    expect(s.vy).toBe(0)
    expect(s.score).toBe(0)
    expect(s.over).toBe(false)
    expect(s.pipes).toEqual([])
  })
})

describe('gravity', () => {
  it('increases the downward velocity each step', () => {
    const s = step(S({ vy: 0 }), noFlap, rng)
    expect(s.vy).toBeGreaterThan(0) // positive = falling
    const s2 = step(s, noFlap, rng)
    expect(s2.vy).toBeGreaterThan(s.vy)
  })

  it('clamps the fall to terminal velocity', () => {
    const s = step(S({ vy: MAX_FALL + 50 }), noFlap, rng)
    expect(s.vy).toBe(MAX_FALL)
  })
})

describe('flap', () => {
  it('sets an upward (negative) velocity', () => {
    const s = step(S({ vy: 5 }), flap, rng)
    expect(s.vy).toBeLessThan(0)
    expect(s.vy).toBeCloseTo(-FLAP_IMPULSE + 0.5) // impulse then one frame of gravity
  })

  it('moves the bird upward over the following steps', () => {
    const start = S({ y: 200, vy: 0 })
    const flapped = step(start, flap, rng)
    expect(flapped.y).toBeLessThan(start.y)
  })
})

describe('pipes', () => {
  it('move left over time', () => {
    const pipe: Pipe = { x: 300, gapY: 150, scored: false }
    const s = step(S({ pipes: [pipe] }), noFlap, rng)
    expect(s.pipes[0].x).toBeLessThan(300)
  })

  it('a new pipe spawns within valid gap bounds for the given rng', () => {
    // Extremes of rng must keep the gap fully inside the reachable band.
    for (const r of [() => 0, () => 0.999999]) {
      const p = spawnPipe(FIELD_H, r)
      expect(p.gapY).toBeGreaterThanOrEqual(GAP_MARGIN)
      expect(p.gapY + GAP).toBeLessThanOrEqual(FIELD_H - GAP_MARGIN)
    }
  })

  it('nextGapY maps rng=0 to the top margin', () => {
    expect(nextGapY(() => 0)).toBe(GAP_MARGIN)
  })

  it('spawns an initial pipe from an empty field', () => {
    const s = step(S({ pipes: [] }), noFlap, rng)
    expect(s.pipes.length).toBe(1)
  })
})

describe('scoring', () => {
  it('increments the score when a pipe is passed', () => {
    // Pipe just to the right of the bird; one step scrolls its trailing edge past BIRD_X.
    const pipe: Pipe = { x: 62, gapY: 150, scored: false } // 62 + 58 = 120 = BIRD_X
    const s = step(S({ pipes: [pipe] }), noFlap, rng)
    expect(s.score).toBe(1)
    expect(s.events.scored).toBe(true)
    expect(s.pipes.find((p) => p.gapY === 150)?.scored).toBe(true)
  })

  it('does not double-count an already-scored pipe', () => {
    const pipe: Pipe = { x: 10, gapY: 150, scored: true }
    const s = step(S({ score: 1, pipes: [pipe] }), noFlap, rng)
    expect(s.score).toBe(1)
  })
})

describe('collisions', () => {
  it('ends the game when the bird hits the ground', () => {
    const s = step(S({ y: FIELD_H - BIRD_R - 1, vy: 10 }), noFlap, rng)
    expect(s.over).toBe(true)
    expect(s.events.crashed).toBe(true)
  })

  it('ends the game when the bird hits the ceiling', () => {
    const s = step(S({ y: BIRD_R + 1, vy: -10 }), flap, rng)
    expect(s.over).toBe(true)
  })

  it('ends the game when the bird hits a pipe column', () => {
    // Pipe overlapping BIRD_X with a gap far below the bird → bird strikes it.
    const pipe: Pipe = { x: 110, gapY: 300, scored: false }
    const s = step(S({ y: 100, pipes: [pipe] }), noFlap, rng)
    expect(s.over).toBe(true)
  })

  it('passing through the gap does not end the game', () => {
    // Bird centered in a generous gap while the column overlaps its x.
    const pipe: Pipe = { x: 110, gapY: 200 - GAP / 2, scored: false }
    const s = step(S({ y: 200, vy: 0, pipes: [pipe] }), noFlap, rng)
    expect(s.over).toBe(false)
  })
})

describe('over state', () => {
  it('is returned unchanged once over', () => {
    const s = S({ over: true })
    expect(step(s, flap, rng)).toBe(s)
  })
})
