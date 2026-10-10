import { afterEach, describe, expect, it, vi } from 'vitest'
import { mulberry32 as decantMulberry32 } from '@/lib/games/decant/engine'
import {
  BALL_R,
  CHUNK_H,
  CORE_R,
  FOLLOW_OFFSET,
  FP,
  MAX_PLACE_ATTEMPTS,
  SPIKE_GATE_PAD,
  V_MAX,
  VIEW_H,
  createGame,
  ensureChunks,
  generateChunk,
  magnetForce,
  mulberry32,
  predictFlipPath,
  predictPath,
  reduce,
  scrollSpeed,
  stepBall,
  tierForChunk,
  type Ball,
  type Gate,
  type Magnet,
  type PolarityState,
  type Rng,
} from './engine'

const px = (v: number) => v * FP

function seqRng(values: number[]): Rng & { count: () => number } {
  let i = 0
  const f = (() => {
    if (i >= values.length) throw new Error(`rng exhausted after ${i}`)
    return values[i++]
  }) as Rng & { count: () => number }
  f.count = () => i
  return f
}

function constRng(v: number): Rng & { count: () => number } {
  let i = 0
  const f = (() => {
    i++
    return v
  }) as Rng & { count: () => number }
  f.count = () => i
  return f
}

function running(seed = 1, patch: Partial<PolarityState> = {}): PolarityState {
  return { ...reduce(createGame(seed), { type: 'start' }), ...patch }
}

const tick = (s: PolarityState) => reduce(s, { type: 'tick' })

function mag(x: number, y: number, charge: 1 | -1 = 1, strength: 1 | 2 = 1, id = 500): Magnet {
  return { id, x: px(x), y: px(y), charge, strength }
}

function gate(id: number, xPx: number, yPx: number, halfWPx: number): Gate {
  return { id, chunk: 0, x: px(xPx), y: px(yPx), halfW: px(halfWPx), state: 'pending' }
}

/** Run with a set of flip ticks (flip dispatched just before tick #k is processed). */
function runScript(seed: number, flipTicks: number[], ticks: number, from?: PolarityState): PolarityState {
  let s = from ?? reduce(createGame(seed), { type: 'start' })
  const set = new Set(flipTicks)
  while (s.tick < ticks && s.status === 'running') {
    if (set.has(s.tick + 1)) s = reduce(s, { type: 'flip' })
    s = tick(s)
  }
  return s
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('rng', () => {
  it('1. mulberry32 is bit-identical to decant', () => {
    const a = mulberry32(42)
    const b = decantMulberry32(42)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
  })
})

describe('createGame', () => {
  it('2. same seed → equal state; different seed → different magnets', () => {
    expect(createGame(7)).toEqual(createGame(7))
    expect(createGame(7).magnets).not.toEqual(createGame(8).magnets)
  })

  it('3. never touches Math.random / Date.now / performance.now', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random')
    })
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now')
    })
    vi.spyOn(performance, 'now').mockImplementation(() => {
      throw new Error('performance.now')
    })
    let s = reduce(createGame(99), { type: 'start' })
    for (let i = 0; i < 2000 && s.status === 'running'; i++) {
      if (i % 37 === 0) s = reduce(s, { type: 'flip' })
      s = tick(s)
    }
    expect(s.tick).toBeGreaterThan(0)
  })

  it('4. initial state', () => {
    const s = createGame(3)
    expect(s.status).toBe('ready')
    expect(s.polarity).toBe(1)
    expect(s.ball).toEqual({ x: px(160), y: px(120), vx: 0, vy: 0 })
    expect(s.camY).toBe(0)
    expect(s.score).toBe(0)
    expect(s.genY).toBeGreaterThanOrEqual((VIEW_H + CHUNK_H) * FP)
    expect(s.nextChunk).toBe(2)
  })
})

describe('generateChunk', () => {
  it('5. golden: constant 0.5 rng, chunk 0 → 7 draws, exact layout', () => {
    const rng = constRng(0.5)
    const r = generateChunk(0, rng, 0)
    expect(rng.count()).toBe(7)
    expect(r.gate).toEqual({ id: 0, chunk: 0, x: px(160), y: px(620), halfW: px(48), state: 'pending' })
    expect(r.magnets).toEqual([{ id: 1, x: px(160), y: px(500), charge: 1, strength: 1 }])
    expect(r.spikes).toEqual([])
    expect(r.nextId).toBe(2)
  })

  it('6. rejected magnet re-samples (4 more draws) and keeps the second attempt', () => {
    // chunk 1: 2 magnets, 0..1 spikes, gate 88px wide, y0 = 680
    const rng = seqRng([
      0, // nMag → 2
      0.5, // gx → 160
      0, 0, 0.9, 0.9, // magnet 0 → (40, 710)
      0, 0, 0.9, 0.9, // magnet 1 attempt 1 → same spot, rejected
      0.5, 0.5, 0.9, 0.9, // magnet 1 attempt 2 → (160, 820)
      0, // nSpike → 0
    ])
    const r = generateChunk(1, rng, 10)
    expect(rng.count()).toBe(15)
    expect(r.magnets.map((m) => [m.x / FP, m.y / FP])).toEqual([
      [40, 710],
      [160, 820],
    ])
    expect(r.magnets.map((m) => m.id)).toEqual([11, 12])
  })

  it('7. six failed attempts drop the magnet after exactly 4*6 draws', () => {
    const fails: number[] = []
    for (let k = 0; k < MAX_PLACE_ATTEMPTS; k++) fails.push(0, 0, 0.9, 0.9)
    const rng = seqRng([0, 0.5, 0, 0, 0.9, 0.9, ...fails, 0])
    const r = generateChunk(1, rng, 0)
    expect(rng.count()).toBe(1 + 1 + 4 + 4 * 6 + 1)
    expect(r.magnets).toHaveLength(1)
  })

  it('fuzz: no spike inside any gate corridor (20 seeds × chunks 0..30)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = mulberry32(seed)
      let id = 0
      for (let c = 0; c <= 30; c++) {
        const ch = generateChunk(c, rng, id)
        id = ch.nextId
        const g = ch.gate
        for (const sp of ch.spikes) {
          const inCorr =
            Math.abs(sp.y - g.y) < px(48) && Math.abs(sp.x - g.x) < g.halfW + px(SPIKE_GATE_PAD)
          expect(inCorr).toBe(false)
        }
        const t = tierForChunk(c)
        expect(ch.magnets.length).toBeLessThanOrEqual(t.magMax)
        expect(ch.spikes.length).toBeLessThanOrEqual(t.spikeMax)
      }
    }
  })

  it('fuzz: chunk 0 is always 1 magnet, 0 spikes (50 seeds)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ch = generateChunk(0, mulberry32(seed), 0)
      expect(ch.magnets).toHaveLength(1)
      expect(ch.spikes).toHaveLength(0)
      expect(ch.magnets[0].charge).toBe(1)
    }
  })
})

describe('magnetForce', () => {
  const ball: Ball = { x: px(160), y: px(100), vx: 0, vy: 0 }

  it('8. golden: 40px straight below → ay 37; sign follows charge*polarity', () => {
    expect(magnetForce(ball, mag(160, 140), 1)).toEqual({ ax: 0, ay: 37 })
    expect(magnetForce(ball, mag(160, 140), -1)).toEqual({ ax: 0, ay: -37 })
    expect(magnetForce(ball, mag(160, 140, -1), -1)).toEqual({ ax: 0, ay: 37 })
  })

  it('9. strength 2 at the same distance → 75', () => {
    expect(magnetForce(ball, mag(160, 140, 1, 2), 1).ay).toBe(75)
  })

  it('10. close range clamps at F_MAX (s1)', () => {
    expect(magnetForce(ball, mag(160, 105), 1).ay).toBe(64)
  })

  it('11. beyond R_MAX → no force', () => {
    expect(magnetForce(ball, mag(160, 251), 1)).toEqual({ ax: 0, ay: 0 })
  })

  it('12. mirrored magnets give exactly opposite ax, and never -0', () => {
    const l = magnetForce(ball, mag(120, 130), 1)
    const r = magnetForce(ball, mag(200, 130), 1)
    expect(l.ax).toBe(-r.ax)
    expect(l.ay).toBe(r.ay)
    expect(l.ax).not.toBe(0)
    for (const pol of [1, -1] as const) {
      for (const ch of [1, -1] as const) {
        const f = magnetForce(ball, mag(160, 140, ch), pol)
        expect(Object.is(f.ax, -0)).toBe(false)
        expect(Object.is(f.ay, -0)).toBe(false)
      }
    }
  })
})

describe('stepBall', () => {
  it('13. golden free fall: vy 6 after 1 tick, terminal 378', () => {
    let b: Ball = { x: px(160), y: px(120), vx: 0, vy: 0 }
    b = stepBall(b, [], 1).ball
    expect(b.vy).toBe(6)
    expect(b.y).toBe(px(120) + 6)
    for (let i = 1; i < 2000; i++) b = stepBall(b, [], 1).ball
    expect(b.vy).toBe(378)
    expect(b.vx).toBe(0)
  })

  it('14. left wall: clamps x and reflects at 3/4 (after damping)', () => {
    const r = stepBall({ x: px(BALL_R + 1), y: px(200), vx: -1024, vy: 0 }, [], 1)
    expect(r.walled).toBe(true)
    expect(r.ball.x).toBe(px(BALL_R))
    // damping first: -1024 - trunc(-1024/64) = -1008 → reflected trunc(1008*3/4) = 756
    expect(r.ball.vx).toBe(756)
  })

  it('15. head-on core hit: pushed out to contact, normal speed ≥ 0, bumped', () => {
    const m = mag(160, 200)
    const r = stepBall({ x: px(160), y: px(178), vx: 0, vy: 1000 }, [m], 1)
    expect(r.bumped).toBe(true)
    const RR = (CORE_R + BALL_R) * FP
    const bx = r.ball.x - m.x
    const by = r.ball.y - m.y
    expect(Math.sqrt(bx * bx + by * by)).toBeGreaterThanOrEqual(RR - 1)
    expect(r.ball.vx * bx + r.ball.vy * by).toBeGreaterThanOrEqual(0)
    expect(r.ball.vy).toBeLessThan(0)
  })
})

describe('reduce: hazards and gates', () => {
  it('16. spike contact kills', () => {
    let s = running(5, { magnets: [], gates: [] })
    s = { ...s, spikes: [{ id: 999, x: s.ball.x, y: s.ball.y + px(10) }] }
    s = tick(s)
    expect(s.status).toBe('dead')
    expect(s.deathCause).toBe('spike')
    expect(s.lastEvent).toBe('dead')
  })

  it('17. three gates in a row: +10, +20, +30, combo 3', () => {
    let s = running(5, { magnets: [], spikes: [], gates: [gate(900, 160, 125, 40), gate(901, 160, 140, 40), gate(902, 160, 160, 40)] })
    const gains: number[] = []
    for (let i = 0; i < 200 && s.gatesPassed < 3; i++) {
      s = tick(s)
      if (s.lastTick!.gained) gains.push(s.lastTick!.gained)
    }
    expect(gains).toEqual([10, 20, 30])
    expect(s.score).toBe(60)
    expect(s.combo).toBe(3)
    expect(s.bestCombo).toBe(3)
    expect(s.lastEvent).toBe('gate')
  })

  it('18. a miss resets combo but keeps score', () => {
    let s = running(5, { magnets: [], spikes: [], gates: [gate(900, 40, 125, 10)], combo: 2, score: 30 })
    for (let i = 0; i < 200 && s.gatesMissed === 0; i++) s = tick(s)
    expect(s.combo).toBe(0)
    expect(s.score).toBe(30)
    expect(s.gatesMissed).toBe(1)
    expect(s.lastEvent).toBe('miss')
    expect(s.gates[0].state).toBe('missed')
  })

  it('19. multiplier caps at ×8 (+80)', () => {
    let s = running(5, { magnets: [], spikes: [], gates: [gate(900, 160, 125, 40)], combo: 11 })
    for (let i = 0; i < 200 && s.gatesPassed === 0; i++) s = tick(s)
    expect(s.lastTick!.gained).toBe(80)
    expect(s.combo).toBe(12)
  })

  it('20. re-crossing the same gate counts once', () => {
    let s = running(5, { magnets: [], spikes: [], gates: [gate(900, 160, 125, 40)] })
    for (let i = 0; i < 200 && s.gatesPassed === 0; i++) s = tick(s)
    expect(s.gatesPassed).toBe(1)
    s = { ...s, ball: { ...s.ball, y: s.gates[0].y - px(2), vy: 0 } }
    for (let i = 0; i < 30; i++) s = tick(s)
    expect(s.ball.y).toBeGreaterThan(s.gates[0].y)
    expect(s.gatesPassed).toBe(1)
    expect(s.score).toBe(10)
  })
})

describe('reduce: flipping', () => {
  it('21. two flips before one tick → one polarity change', () => {
    let s = running(2)
    s = reduce(s, { type: 'flip' })
    const again = reduce(s, { type: 'flip' })
    expect(again).toBe(s)
    s = tick(again)
    expect(s.polarity).toBe(-1)
    expect(s.flips).toBe(1)
    expect(s.lastTick!.flipped).toBe(true)
  })

  it('22. cooldown: a flip queued right after flipping at T lands exactly at T+10', () => {
    let s = running(2, { magnets: [], spikes: [], gates: [] })
    s = tick(reduce(s, { type: 'flip' }))
    const T = s.tick
    expect(s.polarity).toBe(-1)
    s = reduce(s, { type: 'flip' })
    let landed = -1
    for (let i = 0; i < 20 && landed < 0; i++) {
      s = tick(s)
      expect(s.pendingFlip || s.lastTick!.flipped).toBe(true)
      if (s.lastTick!.flipped) landed = s.tick
    }
    expect(landed).toBe(T + 10)
    expect(s.polarity).toBe(1)
  })

  it('23. flip in ready starts the run without flipping', () => {
    const s = reduce(createGame(4), { type: 'flip' })
    expect(s.status).toBe('running')
    expect(s.polarity).toBe(1)
    expect(s.pendingFlip).toBe(false)
  })

  it('24. tick in ready / dead returns the same reference', () => {
    const ready = createGame(4)
    expect(tick(ready)).toBe(ready)
    const dead: PolarityState = { ...ready, status: 'dead' }
    expect(tick(dead)).toBe(dead)
    expect(reduce(dead, { type: 'flip' })).toBe(dead)
    expect(reduce(dead, { type: 'start' })).toBe(dead)
  })
})

describe('reduce: camera and chunks', () => {
  it('25. a ball at the top edge with no help gets crushed', () => {
    let s = running(6, { magnets: [], spikes: [] })
    s = { ...s, ball: { x: px(160), y: s.camY + px(BALL_R) + 1, vx: 0, vy: 0 } }
    for (let i = 0; i < 2 && s.status === 'running'; i++) s = tick(s)
    expect(s.status).toBe('dead')
    expect(s.deathCause).toBe('crushed')
  })

  it('26. scrollSpeed is monotone in [160, 320]', () => {
    expect(scrollSpeed(0)).toBe(160)
    expect(scrollSpeed(px(1e7))).toBe(320)
    let prev = 0
    for (let y = 0; y < px(20000); y += px(37)) {
      const v = scrollSpeed(y)
      expect(v).toBeGreaterThanOrEqual(prev)
      expect(v).toBeGreaterThanOrEqual(160)
      expect(v).toBeLessThanOrEqual(320)
      prev = v
    }
  })

  it('27. camera never goes back and follows the ball below FOLLOW_OFFSET', () => {
    for (const seed of [11, 12, 13]) {
      const flipRng = mulberry32(seed * 7)
      let s = running(seed)
      let followed = 0
      while (s.status === 'running' && s.tick < 1500) {
        if (flipRng() < 0.05) s = reduce(s, { type: 'flip' })
        const prev = s
        s = tick(s)
        expect(s.camY).toBeGreaterThanOrEqual(prev.camY)
        if (s.status === 'dead' && s.deathCause === 'spike') break
        expect(s.camY).toBe(Math.max(prev.camY + scrollSpeed(prev.camY), s.ball.y - FOLLOW_OFFSET * FP))
        if (s.ball.y - FOLLOW_OFFSET * FP > prev.camY + scrollSpeed(prev.camY)) {
          expect(s.camY).toBe(s.ball.y - FOLLOW_OFFSET * FP)
          followed++
        }
      }
      expect(followed).toBeGreaterThan(0)
    }
  })

  it('28. ensureChunks / prune invariants every tick', () => {
    let pruned = 0
    for (const seed of [21, 22, 23, 24, 25]) {
      const flipRng = mulberry32(seed + 1000)
      let s = running(seed)
      while (s.status === 'running' && s.tick < 2000) {
        if (flipRng() < 0.04) s = reduce(s, { type: 'flip' })
        const prev = s
        s = tick(s)
        if (s.status !== 'running') break
        expect(s.genY).toBeGreaterThanOrEqual(s.camY + (VIEW_H + CHUNK_H) * FP)
        const ids = [...s.magnets, ...s.spikes, ...s.gates].map((e) => e.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const id of ids) expect(id).toBeLessThan(s.nextId)
        expect(s.nextId).toBeGreaterThanOrEqual(prev.nextId)
        const nowIds = new Set(s.gates.map((g) => g.id))
        for (const g of prev.gates) {
          if (nowIds.has(g.id)) continue
          pruned++
          const judged = s.lastTick!.passed.includes(g.id) || s.lastTick!.missed.includes(g.id)
          expect(g.state !== 'pending' || judged).toBe(true)
        }
      }
    }
    expect(pruned).toBeGreaterThan(0)
  })

  it('ensureChunks returns the same reference when nothing changes', () => {
    const s = createGame(8)
    expect(ensureChunks(s)).toBe(s)
  })

  it('29. the board is independent of input', () => {
    const a = runScript(31, [5, 30, 60, 100, 160, 220, 330, 400, 520, 610], 800)
    const b = runScript(31, [12, 45, 46, 47, 200, 260, 300, 700], 800)
    const strip = (g: Gate) => ({ ...g, state: 'x' })
    const byId = <T extends { id: number }>(arr: T[]) => new Map(arr.map((e) => [e.id, e]))
    let shared = 0
    for (const [listA, listB, f] of [
      [a.magnets, b.magnets, (e: unknown) => e],
      [a.spikes, b.spikes, (e: unknown) => e],
      [a.gates, b.gates, (e: unknown) => strip(e as Gate)],
    ] as const) {
      const mb = byId(listB as { id: number }[])
      for (const e of listA as { id: number }[]) {
        const o = mb.get(e.id)
        if (!o) continue
        shared++
        expect(f(o)).toEqual(f(e))
      }
    }
    expect(shared).toBeGreaterThan(0)
  })
})

describe('predictPath', () => {
  it('does not mutate state and stops at a spike', () => {
    const base = running(9, { magnets: [], gates: [] })
    const s = { ...base, spikes: [{ id: 999, x: base.ball.x, y: base.ball.y + px(20) }] }
    const snap = JSON.stringify(s)
    const path = predictPath(s, 200, 1)
    expect(JSON.stringify(s)).toBe(snap)
    expect(path.length).toBeLessThan(200)
    const last = path[path.length - 1]
    expect((last.y - s.spikes[0].y) ** 2).toBeLessThan(((7 + BALL_R) * FP) ** 2)
  })
})

describe('predictFlipPath (honest flip preview)', () => {
  /** A running board with one magnet right next to the ball, so flip timing matters. */
  function nearMagnet(seed = 9): PolarityState {
    const base = running(seed, { spikes: [], gates: [] })
    return { ...base, magnets: [mag(base.ball.x / FP + 30, base.ball.y / FP + 50)] }
  }

  /** The real trajectory: flip now (if `tap`), then tick `n` times with no further input. */
  function actual(s: PolarityState, n: number, tap: boolean): { x: number; y: number }[] {
    let cur = tap ? reduce(s, { type: 'flip' }) : s
    const out: { x: number; y: number }[] = []
    for (let i = 0; i < n && cur.status === 'running'; i++) {
      cur = tick(cur)
      out.push({ x: cur.ball.x, y: cur.ball.y })
    }
    return out
  }

  /** A state mid-cooldown: flipped at tick 1, then `after` more ticks. */
  function midCooldown(after: number): PolarityState {
    let s = tick(reduce(nearMagnet(), { type: 'flip' }))
    for (let i = 0; i < after; i++) s = tick(s)
    return s
  }

  it('a tap during cooldown: preview == the trajectory the flip actually produces', () => {
    const s = midCooldown(2)
    expect(s.flipCooldown).toBeGreaterThan(0)
    expect(s.pendingFlip).toBe(false)
    const real = actual(s, 20, true)
    expect(real).toHaveLength(20)
    expect(predictFlipPath(s, 20)).toEqual(real)
    // The old immediate-flip simulation drew a path that cannot happen.
    expect(predictPath(s, 20, (s.polarity === 1 ? -1 : 1) as 1 | -1)).not.toEqual(real)
  })

  it('a flip already queued: preview == the path that will actually happen (no extra tap)', () => {
    const s = reduce(midCooldown(4), { type: 'flip' })
    expect(s.pendingFlip).toBe(true)
    expect(predictFlipPath(s, 20)).toEqual(actual(s, 20, false))
  })

  it('cooldown 0: preview == immediate flip', () => {
    const s = nearMagnet()
    expect(s.flipCooldown).toBe(0)
    expect(predictFlipPath(s, 20)).toEqual(actual(s, 20, true))
    expect(predictFlipPath(s, 20)).toEqual(predictPath(s, 20, -1))
  })

  it('every cooldown phase matches the real run', () => {
    for (let after = 0; after <= 10; after++) {
      const s = midCooldown(after)
      expect(predictFlipPath(s, 20)).toEqual(actual(s, 20, true))
    }
  })

  it('does not mutate state and stops at a spike', () => {
    const base = running(9, { magnets: [], gates: [] })
    const s = { ...base, flipCooldown: 5, spikes: [{ id: 999, x: base.ball.x, y: base.ball.y + px(20) }] }
    const snap = JSON.stringify(s)
    const path = predictFlipPath(s, 200)
    expect(JSON.stringify(s)).toBe(snap)
    expect(path.length).toBeLessThan(200)
  })
})

describe('fuzz', () => {
  it('integers and speed bound hold (5 seeds × 2000 ticks)', () => {
    for (const seed of [101, 202, 303, 404, 505]) {
      const flipRng = mulberry32(seed)
      let s = running(seed)
      while (s.status === 'running' && s.tick < 2000) {
        if (flipRng() < 0.08) s = reduce(s, { type: 'flip' })
        s = tick(s)
        for (const v of [s.ball.x, s.ball.y, s.ball.vx, s.ball.vy, s.camY, s.score]) {
          expect(Number.isInteger(v)).toBe(true)
        }
        expect(Math.abs(s.ball.vx)).toBeLessThanOrEqual(V_MAX)
        expect(Math.abs(s.ball.vy)).toBeLessThanOrEqual(V_MAX)
      }
    }
  })
})

describe('golden full run', () => {
  const FLIPS = [40, 90, 150, 210, 300, 360, 420, 500]
  const snap = (s: PolarityState) => ({
    status: s.status,
    tick: s.tick,
    score: s.score,
    combo: s.combo,
    gatesPassed: s.gatesPassed,
    ball: s.ball,
    camY: s.camY,
    deathCause: s.deathCause,
  })

  it('30. seed 20261010 is stable and survives a JSON round trip', () => {
    const full = runScript(20261010, FLIPS, 900)
    const GOLDEN = {
      status: 'dead',
      tick: 333,
      score: 0,
      combo: 0,
      gatesPassed: 0,
      ball: { x: 23166, y: 80042, vx: -259, vy: -605 },
      camY: 78260,
      deathCause: 'crushed',
    }
    expect(snap(full)).toEqual(GOLDEN)

    const half = runScript(20261010, FLIPS, 450)
    const revived = JSON.parse(JSON.stringify(half)) as PolarityState
    const resumed = runScript(20261010, FLIPS, 900, revived)
    expect(snap(resumed)).toEqual(snap(full))

    // The golden run is dead by tick 333, so also round-trip a state that is still
    // mid-flight (pending flip schedule, live chunks, cooldowns) and keep going.
    const early = runScript(20261010, FLIPS, 200)
    expect(early.status).toBe('running')
    const revivedEarly = JSON.parse(JSON.stringify(early)) as PolarityState
    expect(snap(runScript(20261010, FLIPS, 900, revivedEarly))).toEqual(snap(full))
  })
})
