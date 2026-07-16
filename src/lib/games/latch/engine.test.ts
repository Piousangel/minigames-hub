import { describe, expect, it } from 'vitest'
import {
  BASE_SCROLL,
  FIELD_H,
  FIELD_W,
  FIRST_PEG_X,
  FIRST_PEG_Y,
  GRAVITY,
  KILL_X,
  MAX_L,
  MAX_MULT,
  MIN_L,
  mulberry32,
  newGame,
  reachablePeg,
  SPAWN_AHEAD,
  START_ANGLE,
  step,
  type LatchState,
  type Peg,
} from './engine'

const noHold = { dt: 1, holding: false }
const hold = { dt: 1, holding: true }
// A constant rng is fine for most step-level tests; determinism tests use mulberry32.
const rng = () => 0.5

/** Run a sequence of identical inputs, returning the final state. */
function run(s: LatchState, input: { dt: number; holding: boolean }, n: number, r = rng): LatchState {
  let cur = s
  for (let i = 0; i < n; i++) cur = step(cur, input, r)
  return cur
}

describe('newGame', () => {
  it('starts idle with peg 0 at (192,150) and the bob pulled behind', () => {
    const s = newGame(mulberry32(1))
    expect(s.mode).toBe('idle')
    expect(s.pegs[0]).toMatchObject({ id: 0, x: FIRST_PEG_X, y: FIRST_PEG_Y, used: true })
    expect(s.theta).toBe(START_ANGLE)
    expect(s.omega).toBe(0)
    expect(s.L).toBe(MAX_L)
    expect(s.bobX).toBeCloseTo(FIRST_PEG_X + MAX_L * Math.sin(START_ANGLE), 6)
    expect(s.bobY).toBeCloseTo(FIRST_PEG_Y + MAX_L * Math.cos(START_ANGLE), 6)
    expect(s.multiplier).toBe(1)
    expect(s.scrollSpeed).toBe(BASE_SCROLL)
    expect(s.over).toBe(false)
  })

  it('prefills the ribbon past FIELD_W + SPAWN_AHEAD with one glint per non-first peg', () => {
    const s = newGame(mulberry32(1))
    expect(s.spawnCursorX).toBeGreaterThan(FIELD_W + SPAWN_AHEAD)
    // Every peg except the first spawns exactly one glint.
    expect(s.glints.length).toBe(s.pegs.length - 1)
    // Peg ids and glint heights are within the seeded band.
    for (const p of s.pegs) {
      expect(p.y).toBeGreaterThanOrEqual(90)
      expect(p.y).toBeLessThanOrEqual(260)
    }
  })
})

describe('idle bootstrap', () => {
  it('stays frozen while holding is false', () => {
    const s = newGame(mulberry32(1))
    const after = run(s, noHold, 5)
    expect(after.mode).toBe('idle')
    expect(after.bobX).toBe(s.bobX)
    expect(after.bobY).toBe(s.bobY)
    expect(after.cameraX).toBe(s.cameraX)
    expect(after.events.over).toBe(false)
  })

  it('begins the first swing on the first holding frame', () => {
    const s = newGame(mulberry32(1))
    const after = step(s, hold, rng)
    expect(after.mode).toBe('swinging')
    // The pendulum has integrated one step: theta moved.
    expect(after.theta).not.toBe(START_ANGLE)
  })
})

describe('determinism', () => {
  it('same seed + identical input log yields deep-equal states', () => {
    const log = [hold, hold, hold, noHold, hold, noHold, hold, hold, noHold, hold]
    const rA = mulberry32(7)
    let sa = newGame(rA)
    for (const inp of log) sa = step(sa, inp, rA)
    const rB = mulberry32(7)
    let sb = newGame(rB)
    for (const inp of log) sb = step(sb, inp, rB)
    expect(sb).toEqual(sa)
  })
})

describe('release physics', () => {
  it('launches tangentially with momentum preserved', () => {
    // Swing a few frames so omega is non-zero, then release.
    let s = newGame(mulberry32(1))
    s = run(s, hold, 8)
    expect(s.mode).toBe('swinging')
    const { L, omega, theta } = s
    const released = step(s, noHold, rng)
    expect(released.mode).toBe('flying')
    expect(released.events.released).toBe(true)
    // vx is set at release; vy is set at release AND then gets gravity in the
    // same flying step (spec order C: release -> flying block runs same frame).
    expect(released.vx).toBeCloseTo(L * omega * Math.cos(theta), 6)
    expect(released.vy).toBeCloseTo(-L * omega * Math.sin(theta) + GRAVITY, 6)
    expect(released.pivotId).toBe(-1)
  })
})

describe('reachablePeg', () => {
  it('prefers the smallest new id within REACH and excludes pegs behind', () => {
    const base = newGame(mulberry32(1))
    const pegs: Peg[] = [
      { id: 0, x: -50, y: 150, used: true }, // behind the bob (x <= bobX)
      { id: 5, x: 60, y: 150, used: false }, // ahead, new, farther
      { id: 3, x: 40, y: 150, used: false }, // ahead, new, nearer -> but id > lastPegId both new; nearer wins on distance only within same key... check id preference
    ]
    const s: LatchState = { ...base, pegs, bobX: 0, bobY: 150, lastPegId: 0 }
    const p = reachablePeg(s)
    // Both id 3 and 5 are "new" (key 0); tie-break is ascending distance -> id 3 (nearer).
    expect(p?.id).toBe(3)
  })

  it('returns null when nothing ahead is within REACH', () => {
    const base = newGame(mulberry32(1))
    const pegs: Peg[] = [{ id: 9, x: 999, y: 150, used: false }]
    const s: LatchState = { ...base, pegs, bobX: 0, bobY: 150, lastPegId: 0 }
    expect(reachablePeg(s)).toBeNull()
  })

  it('prefers a new peg over a used one even if the used one is nearer', () => {
    const base = newGame(mulberry32(1))
    const pegs: Peg[] = [
      { id: 2, x: 30, y: 150, used: true }, // used, near, id <= lastPegId
      { id: 4, x: 90, y: 150, used: false }, // new, farther
    ]
    const s: LatchState = { ...base, pegs, bobX: 0, bobY: 150, lastPegId: 2 }
    expect(reachablePeg(s)?.id).toBe(4)
  })
})

describe('catch', () => {
  it('latches a new peg ahead, chains, and sets tangent theta + omega', () => {
    const base = newGame(mulberry32(1))
    // A hand-crafted flying state moving right toward a single peg.
    const peg: Peg = { id: 1, x: 100, y: 150, used: false }
    const s: LatchState = {
      ...base,
      mode: 'flying',
      pegs: [peg],
      glints: [],
      bobX: 40,
      bobY: 150,
      vx: 5,
      vy: 0,
      lastPegId: 0,
      pegsChained: 0,
      pivotId: -1,
    }
    const after = step(s, hold, rng)
    expect(after.mode).toBe('swinging')
    expect(after.events.caught).toBe(true)
    expect(after.pegsChained).toBe(1)
    expect(after.pivotId).toBe(1)
    // theta = atan2(bobX - px, bobY - py) evaluated at the post-move bob.
    const bobX = 40 + 5 // vx*dt
    const bobY = 150 + GRAVITY // vy became GRAVITY, bobY += that
    expect(after.theta).toBeCloseTo(Math.atan2(bobX - peg.x, bobY - peg.y), 6)
  })

  it('breaks the combo when catching with zero glints on the arc', () => {
    const base = newGame(mulberry32(1))
    const peg: Peg = { id: 1, x: 100, y: 150, used: false }
    const s: LatchState = {
      ...base,
      mode: 'flying',
      pegs: [peg],
      glints: [],
      bobX: 40,
      bobY: 150,
      vx: 5,
      vy: 0,
      lastPegId: 0,
      comboCount: 4,
      multiplier: 3,
      glintsThisArc: 0,
    }
    const after = step(s, hold, rng)
    expect(after.events.comboBroken).toBe(true)
    expect(after.multiplier).toBe(1)
    expect(after.comboCount).toBe(0)
  })
})

describe('combo', () => {
  it('collects glints, raises the multiplier, and fires tierUp once per tier', () => {
    const base = newGame(mulberry32(1))
    // Two glints directly on the bob's flight path so both are collected.
    const s: LatchState = {
      ...base,
      mode: 'flying',
      pegs: [],
      glints: [
        { id: 0, x: 45, y: 150, collected: false },
        { id: 1, x: 50, y: 150, collected: false },
      ],
      bobX: 42,
      bobY: 150,
      vx: 8,
      vy: 0,
      comboCount: 0,
      multiplier: 1,
      glintsThisArc: 0,
      lastPegId: 5,
    }
    const after = step(s, hold, rng)
    expect(after.events.collectedGlint).toBe(true)
    expect(after.comboCount).toBe(2)
    // multiplier = min(5, 1 + floor(2/2)) = 2, tierUp fired.
    expect(after.multiplier).toBe(2)
    expect(after.events.tierUp).toBe(true)
    expect(after.glintsThisArc).toBe(2)
  })

  it('caps the multiplier at MAX_MULT', () => {
    const base = newGame(mulberry32(1))
    const s: LatchState = { ...base, comboCount: 100, multiplier: 1 }
    // Recompute via a glint collection: give a huge comboCount then collect one.
    const s2: LatchState = {
      ...s,
      mode: 'flying',
      pegs: [],
      glints: [{ id: 0, x: 45, y: 150, collected: false }],
      bobX: 44,
      bobY: 150,
      vx: 4,
      vy: 0,
      lastPegId: 9,
    }
    const after = step(s2, hold, rng)
    expect(after.multiplier).toBe(MAX_MULT)
  })
})

describe('death', () => {
  it('drops into the pit when the bob falls below the field', () => {
    const base = newGame(mulberry32(1))
    const s: LatchState = {
      ...base,
      mode: 'flying',
      pegs: [],
      glints: [],
      bobX: 200,
      bobY: FIELD_H + 30,
      vx: 0,
      vy: 5,
      cameraX: 100,
    }
    const after = step(s, noHold, rng)
    expect(after.over).toBe(true)
    expect(after.events.dropped).toBe(true)
    expect(after.events.over).toBe(true)
  })

  it('is swept when the screenX crosses the left kill edge', () => {
    const base = newGame(mulberry32(1))
    const s: LatchState = {
      ...base,
      mode: 'flying',
      pegs: [],
      glints: [],
      bobX: 50,
      bobY: 150,
      vx: 0,
      vy: 0,
      // camera far ahead of the bob so screenX = bobX - cameraX < KILL_X.
      cameraX: 50 - KILL_X + 5,
    }
    const after = step(s, noHold, rng)
    expect(after.events.swept).toBe(true)
    expect(after.over).toBe(true)
  })

  it('returns an over state unchanged (idempotent)', () => {
    const base = newGame(mulberry32(1))
    const dead: LatchState = { ...base, over: true }
    expect(step(dead, hold, rng)).toBe(dead)
  })
})

describe('scoring', () => {
  it('is monotonic non-decreasing across a swing-and-fly run', () => {
    let s = newGame(mulberry32(3))
    let prev = s.score
    for (let i = 0; i < 40 && !s.over; i++) {
      s = step(s, i % 6 < 4 ? hold : noHold, mulberry32(3 + i))
      expect(s.score).toBeGreaterThanOrEqual(prev)
      prev = s.score
    }
  })

  it('a higher multiplier accumulates more score for the same camera advance', () => {
    const base = newGame(mulberry32(1))
    // Force flying with no reachable peg so the camera advances by forced scroll.
    const mk = (mult: number): LatchState => ({
      ...base,
      mode: 'flying',
      pegs: [],
      glints: [],
      bobX: 200,
      bobY: 150,
      vx: 0,
      vy: 0,
      cameraX: 0,
      scoreRaw: 0,
      multiplier: mult,
      distanceMeters: 0,
    })
    const low = step(mk(1), hold, rng)
    const high = step(mk(3), hold, rng)
    expect(high.scoreRaw).toBeGreaterThan(low.scoreRaw)
  })
})

describe('camera', () => {
  it('is monotonic non-decreasing and force-advances at scrollSpeed', () => {
    const base = newGame(mulberry32(1))
    // Bob stationary far from the left edge; camera should still creep forward.
    const s: LatchState = {
      ...base,
      mode: 'flying',
      pegs: [],
      glints: [],
      bobX: 400,
      bobY: 150,
      vx: 0,
      vy: 0,
      cameraX: 0,
      scrollSpeed: BASE_SCROLL,
    }
    const after = step(s, hold, rng)
    expect(after.cameraX).toBeGreaterThanOrEqual(s.cameraX)
    expect(after.cameraX).toBeGreaterThanOrEqual(BASE_SCROLL)
  })
})

describe('MIN_L / MAX_L clamp on catch', () => {
  it('clamps tether length into [MIN_L, MAX_L]', () => {
    const base = newGame(mulberry32(1))
    // A peg extremely close so raw distance < MIN_L.
    const peg: Peg = { id: 1, x: 44, y: 150, used: false }
    const s: LatchState = {
      ...base,
      mode: 'flying',
      pegs: [peg],
      glints: [],
      bobX: 42,
      bobY: 150,
      vx: 1,
      vy: 0,
      lastPegId: 0,
    }
    const after = step(s, hold, rng)
    expect(after.L).toBeGreaterThanOrEqual(MIN_L)
    expect(after.L).toBeLessThanOrEqual(MAX_L)
  })
})
