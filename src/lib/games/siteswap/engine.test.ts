import { describe, expect, it } from 'vitest'
import {
  BIRD_GAP,
  DEFAULT_CONFIG,
  DROP_INTERVAL,
  FIRST_DROP_BEAT,
  GRACE_BEATS,
  LOOKAHEAD,
  MAX_BPM,
  WINDOW,
  beatMs,
  bpmForBeat,
  createGame,
  genSlot,
  inHandCount,
  legalHeights,
  mulberry32,
  reduce,
  tick,
  toss,
  type GenCtx,
  type SiteswapConfig,
  type SiteswapState,
  type Slot,
} from './engine'

const pure = (n: number): SiteswapConfig => ({ startBalls: n, maxBalls: n, birds: false, drops: false })

/**
 * Each beat: if holding, toss the next height (prefix first, then the cycle),
 * then tick. Stops at death.
 */
function play(s: SiteswapState, heights: number[], beats: number, prefix: number[] = []): SiteswapState {
  let i = 0
  let p = 0
  for (let b = 0; b < beats && s.status !== 'dead'; b++) {
    if (s.held) {
      const h = p < prefix.length ? prefix[p++] : heights[i++ % heights.length]
      s = toss(s, h)
      if (s.status === 'dead') break
    }
    s = tick(s)
  }
  return s
}

/** Hand-patch slots for rule tests (generation bypassed). */
function withSlots(s: SiteswapState, patch: Record<number, Slot>): SiteswapState {
  const slots = s.slots.slice()
  for (const [k, v] of Object.entries(patch)) slots[Number(k)] = v
  return { ...s, slots }
}

function checkInvariants(s: SiteswapState): void {
  expect(inHandCount(s)).toBe(s.balls)
  expect(s.slots.length).toBe(WINDOW)
  const ballIdx = s.slots.map((v, k) => (k >= 1 && v === 'ball' ? k : -1)).filter((k) => k >= 1)
  const flightIdx = s.flights.map((f) => f.to - s.beat).sort((a, b) => a - b)
  expect(ballIdx).toEqual(flightIdx)
  for (let k = 6; k < WINDOW; k++) expect(s.slots[k]).not.toBe('ball')
  const pendingDrops = s.slots.slice(1).filter((v) => v === 'drop').length
  expect(s.balls + pendingDrops).toBe(s.gen.scheduledBalls)
  expect(s.gen.scheduledBalls).toBeLessThanOrEqual(s.config.maxBalls)
}

type Policy = (legal: number[], r: () => number) => number
const lowest: Policy = (l) => l[0]
const highest: Policy = (l) => l[l.length - 1]
const random: Policy = (l, r) => l[Math.floor(r() * l.length)]

/** Greedy bot: always picks a legal height. Returns the end state + every arrived slot by beat. */
function bot(seed: number, policy: Policy, beats: number, cfg: SiteswapConfig = DEFAULT_CONFIG) {
  const r = mulberry32(seed + 999)
  let s = createGame(seed, cfg)
  const arrivals: { beat: number; slot: Slot }[] = []
  let neverEmpty = true
  for (let b = 0; b < beats && s.status !== 'dead'; b++) {
    if (s.held) {
      const legal = legalHeights(s)
      if (legal.length === 0) {
        neverEmpty = false
        break
      }
      s = toss(s, policy(legal, r))
    }
    s = tick(s)
    if (s.lastTick) arrivals.push({ beat: s.lastTick.beat, slot: s.lastTick.arrived })
  }
  return { s, arrivals, neverEmpty }
}

// ---------------------------------------------------------------------------
// golden scenarios
// ---------------------------------------------------------------------------

describe('golden patterns', () => {
  it('3-ball cascade 333 survives 1000 beats', () => {
    const s = play(createGame(7, pure(3)), [3], 1000)
    expect(s.status).toBe('running')
    expect(s.beat).toBe(1000)
    expect(s.score).toBe(3000)
    expect(s.balls).toBe(3)
    expect(s.pattern).toEqual([3, 3, 3, 3, 3, 3, 3, 3])
  })

  it('441 survives 999 beats with 3 balls', () => {
    const s = play(createGame(7, pure(3)), [4, 4, 1], 999)
    expect(s.status).toBe('running')
    expect(s.beat).toBe(999)
    expect(s.balls).toBe(3)
    expect(s.score).toBe(2997)
  })

  it('531 survives from ground; 51 needs a transition (dies from ground, survives after a 4)', () => {
    const a = play(createGame(1, pure(3)), [5, 3, 1], 600)
    expect(a.status).toBe('running')
    expect(a.beat).toBe(600)

    const ground = play(createGame(1, pure(3)), [5, 1], 600)
    expect(ground.status).toBe('dead')
    expect(ground.beat).toBe(1)
    expect(ground.deathCause).toBe('collision')
    expect(ground.deathHeight).toBe(1)

    const b = play(createGame(1, pure(3)), [5, 1], 600, [4])
    expect(b.status).toBe('running')
    expect(b.beat).toBe(600)
    expect(b.score).toBe(1800)
  })

  it('432 dies on beat 1 with a collision at height 3', () => {
    const s = play(createGame(1, pure(3)), [4, 3, 2], 50)
    expect(s.status).toBe('dead')
    expect(s.beat).toBe(1)
    expect(s.deathCause).toBe('collision')
    expect(s.deathHeight).toBe(3)
    expect(s.score).toBe(3)
  })

  it('2-ball 2 and 31 are valid; 33 with 2 balls leaves rest beats but survives', () => {
    expect(play(createGame(1, pure(2)), [2], 300).status).toBe('running')
    expect(play(createGame(1, pure(2)), [3, 1], 300).status).toBe('running')

    let s = createGame(1, pure(2))
    const events: string[] = []
    for (let b = 0; b < 12; b++) {
      if (s.held) s = toss(s, 3)
      s = tick(s)
      events.push(s.lastEvent)
    }
    expect(s.status).toBe('running')
    expect(events.slice(0, 6)).toEqual(['catch', 'rest', 'catch', 'catch', 'rest', 'catch'])
    expect(s.score).toBe(24)
  })

  it('4-ball 4444, 53 and 552 survive; 543 dies at beat 1', () => {
    const a = play(createGame(3, pure(4)), [4], 400)
    expect(a.status).toBe('running')
    expect(a.score).toBe(1600)
    expect(play(createGame(3, pure(4)), [5, 3], 400).status).toBe('running')
    expect(play(createGame(3, pure(4)), [5, 5, 2], 400).status).toBe('running')
    const d = play(createGame(3, pure(4)), [5, 4, 3], 400)
    expect(d.status).toBe('dead')
    expect(d.beat).toBe(1)
    expect(d.deathCause).toBe('collision')
    expect(d.deathHeight).toBe(4)
    expect(d.score).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// rules
// ---------------------------------------------------------------------------

describe('rules', () => {
  it('tossing onto a bird kills with cause bird', () => {
    const s = toss(withSlots(createGame(1, pure(2)), { 4: 'bird' }), 4)
    expect(s.status).toBe('dead')
    expect(s.deathCause).toBe('bird')
    expect(s.deathHeight).toBe(4)
  })

  it('tossing onto an incoming new ball kills with cause drop', () => {
    const s = toss(withSlots(createGame(1, pure(2)), { 5: 'drop' }), 5)
    expect(s.status).toBe('dead')
    expect(s.deathCause).toBe('drop')
  })

  it('ticking while holding drops the ball and scores nothing for that beat', () => {
    let s = toss(createGame(1, pure(3)), 3)
    s = tick(s) // catch
    expect(s.held).toBe(true)
    const before = s.score
    const d = tick(s)
    expect(d.status).toBe('dead')
    expect(d.deathCause).toBe('dropped')
    expect(d.lastEvent).toBe('dead')
    expect(d.score).toBe(before)
    expect(d.beat).toBe(s.beat)
  })

  it('pressing with an empty hand is an empty-press with no other change', () => {
    let s = toss(createGame(1, pure(2)), 3)
    s = tick(s) // catch ground ball
    s = toss(s, 4) // lands on beat 5
    s = tick(s) // beat 2: empty (rest)
    expect(s.held).toBe(false)
    const p = toss(s, 4)
    expect(p.lastEvent).toBe('empty-press')
    expect({ ...p, lastEvent: s.lastEvent }).toEqual(s)
  })

  it('an early press is buffered and applied on the next beat with that beat’s slots', () => {
    let s = toss(createGame(1, pure(3)), 3) // beat 0 → lands 3
    const b = toss(s, 2, true)
    expect(b.lastEvent).toBe('buffered')
    expect(b.buffered).toBe(2)
    // At beat 1, slot 2 (abs 3) is taken → buffered 2 collides
    const dead = tick(b)
    expect(dead.status).toBe('dead')
    expect(dead.deathCause).toBe('collision')
    expect(dead.lastTick?.beat).toBe(1)
    // A legal buffered toss works and keeps lastTick
    const ok = tick(toss(s, 3, true))
    expect(ok.lastEvent).toBe('toss')
    expect(ok.held).toBe(false)
    expect(ok.buffered).toBeNull()
    expect(ok.lastTick?.arrived).toBe('ball')
    expect(ok.flights.some((f) => f.from === 1 && f.to === 4)).toBe(true)

    // Buffer into a beat with no ball is discarded
    s = toss(createGame(1, pure(2)), 3)
    s = tick(s) // beat 1 catch
    s = toss(s, 4) // lands on beat 5
    const buf = toss(s, 4, true)
    const rest = tick(buf) // beat 2 empty
    expect(rest.lastEvent).toBe('rest')
    expect(rest.buffered).toBeNull()
    expect(rest.held).toBe(false)
    expect(rest.tosses).toBe(s.tosses)
  })

  it('ignores heights outside 1..5 and non-integers', () => {
    const s = createGame(1)
    for (const h of [0, 6, -1, 2.5, Number.NaN]) {
      const n = toss(s, h)
      expect(n.lastEvent).toBe('none')
      expect({ ...n, lastEvent: s.lastEvent }).toEqual(s)
    }
  })

  it('tick in ready and any action after death are no-ops', () => {
    const s = createGame(1)
    expect(tick(s)).toEqual(s)
    const dead = toss(s, 1) // slot 1 holds the ground ball
    expect(dead.status).toBe('dead')
    expect(dead.score).toBe(0)
    expect(tick(dead)).toEqual(dead)
    const t = toss(dead, 3)
    expect({ ...t, lastEvent: dead.lastEvent }).toEqual(dead)
  })

  it('the first toss switches ready to running', () => {
    const s = createGame(1)
    expect(s.status).toBe('ready')
    const n = toss(s, 2)
    expect(n.status).toBe('running')
    expect(n.lastEvent).toBe('toss')
    expect(n.tosses).toBe(1)
  })

  it('a drop arrival adds a ball with a new id and updates peakBalls', () => {
    let s = toss(createGame(1, { ...pure(2), maxBalls: 3 }), 2) // lands 2
    s = withSlots(s, { 1: 'drop' })
    s = { ...s, gen: { ...s.gen, scheduledBalls: 3 } }
    const n = tick(s)
    expect(n.lastEvent).toBe('join')
    expect(n.balls).toBe(3)
    expect(n.peakBalls).toBe(3)
    expect(n.held).toBe(true)
    expect(n.heldId).toBe(2)
    expect(n.nextBallId).toBe(3)
    expect(inHandCount(n)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// invariants & generation
// ---------------------------------------------------------------------------

describe('invariants and generation', () => {
  it('ball accounting holds after every action', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = mulberry32(seed + 1)
      let s = createGame(seed)
      checkInvariants(s)
      for (let b = 0; b < 500 && s.status !== 'dead'; b++) {
        if (s.held) {
          const legal = legalHeights(s)
          s = toss(s, legal[Math.floor(r() * legal.length)])
          checkInvariants(s)
        }
        s = tick(s)
        checkInvariants(s)
      }
      expect(s.status).toBe('running')
    }
  })

  it('scheduledBalls counts balls plus pending drops and never exceeds maxBalls', () => {
    const { s } = bot(11, lowest, 400)
    expect(s.balls + s.slots.slice(1).filter((v) => v === 'drop').length).toBe(s.gen.scheduledBalls)
    expect(s.gen.scheduledBalls).toBeLessThanOrEqual(DEFAULT_CONFIG.maxBalls)
    expect(s.balls).toBe(DEFAULT_CONFIG.maxBalls)
  })

  it('birds respect the grace period and the minimum gap (seeds 1..30, 2000 beats)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed)
      let ctx: GenCtx = { scheduledBalls: 2, nextDropBeat: FIRST_DROP_BEAT, lastBirdBeat: -BIRD_GAP }
      const birds: number[] = []
      for (let B = 0; B < 2000; B++) {
        const g = genSlot(B, ctx, DEFAULT_CONFIG, rng)
        ctx = g.ctx
        if (g.slot === 'bird') birds.push(B)
        expect(g.slot).not.toBe('ball')
      }
      expect(birds.length).toBeGreaterThan(0)
      expect(birds[0]).toBeGreaterThanOrEqual(GRACE_BEATS)
      for (let i = 1; i < birds.length; i++) expect(birds[i] - birds[i - 1]).toBeGreaterThanOrEqual(BIRD_GAP)
    }
  })

  it('drops: first in 16..20, gaps 16..20, none after maxBalls', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { s, arrivals } = bot(seed, lowest, 300)
      const drops = arrivals.filter((a) => a.slot === 'drop').map((a) => a.beat)
      expect(drops.length).toBe(DEFAULT_CONFIG.maxBalls - DEFAULT_CONFIG.startBalls)
      expect(drops[0]).toBeGreaterThanOrEqual(FIRST_DROP_BEAT)
      expect(drops[0]).toBeLessThanOrEqual(FIRST_DROP_BEAT + 4)
      for (let i = 1; i < drops.length; i++) {
        expect(drops[i] - drops[i - 1]).toBeGreaterThanOrEqual(DROP_INTERVAL)
        expect(drops[i] - drops[i - 1]).toBeLessThanOrEqual(DROP_INTERVAL + 4)
      }
      expect(s.balls).toBe(DEFAULT_CONFIG.maxBalls)
      expect(s.peakBalls).toBe(DEFAULT_CONFIG.maxBalls)
    }
  })

  it('lookahead is stable: a tick shifts the window and only index 8 is new', () => {
    const r = mulberry32(5)
    let s = createGame(42)
    for (let b = 0; b < 300 && s.status !== 'dead'; b++) {
      if (s.held) {
        const legal = legalHeights(s)
        s = toss(s, legal[Math.floor(r() * legal.length)])
      }
      const n = tick(s)
      expect(n.slots.slice(0, LOOKAHEAD)).toEqual(s.slots.slice(1))
      expect(n.slots[LOOKAHEAD]).not.toBe('ball')
      s = n
    }
  })

  it('no forced deaths: 3 policies × seeds 1..50 survive 800 beats', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const policy of [lowest, highest, random]) {
        const { s, neverEmpty } = bot(seed, policy, 800)
        expect(neverEmpty).toBe(true)
        expect(s.status).toBe('running')
        expect(s.beat).toBe(800)
      }
    }
  })

  it('is deterministic for the same seed and toss sequence', () => {
    const a = bot(77, random, 400)
    const b = bot(77, random, 400)
    expect(a.s).toEqual(b.s)
    expect(a.arrivals).toEqual(b.arrivals)
    expect(createGame(77)).toEqual(createGame(77))
  })

  it('different seeds produce different hazard streams', () => {
    const stream = (seed: number) =>
      bot(seed, lowest, 200)
        .arrivals.map((a) => `${a.beat}:${a.slot}`)
        .filter((x) => x.endsWith('bird') || x.endsWith('drop'))
        .join(',')
    expect(stream(1)).not.toBe(stream(2))
  })

  it('with birds and drops off, rng is used once at creation and never on ticks', () => {
    const s0 = createGame(9, pure(3))
    expect(s0.rngState).not.toBe(9)
    const s = play(s0, [3], 200)
    expect(s.rngState).toBe(s0.rngState)
  })

  it('tempo curve: 66 → 72 at 16, capped at 150 from beat 224, monotonic', () => {
    expect(bpmForBeat(0)).toBe(66)
    expect(bpmForBeat(15)).toBe(66)
    expect(bpmForBeat(16)).toBe(72)
    expect(bpmForBeat(223)).toBeLessThan(MAX_BPM)
    expect(bpmForBeat(224)).toBe(MAX_BPM)
    expect(bpmForBeat(10_000)).toBe(MAX_BPM)
    expect(beatMs(0)).toBe(909)
    expect(beatMs(224)).toBe(400)
    for (let b = 1; b < 400; b++) {
      expect(bpmForBeat(b)).toBeGreaterThanOrEqual(bpmForBeat(b - 1))
      expect(beatMs(b)).toBeLessThanOrEqual(beatMs(b - 1))
    }
  })

  it('reduce never mutates its input', () => {
    const r = mulberry32(3)
    let s = createGame(5)
    for (let b = 0; b < 200 && s.status !== 'dead'; b++) {
      const actions = s.held
        ? [{ type: 'toss' as const, h: legalHeights(s)[Math.floor(r() * legalHeights(s).length)] }]
        : [{ type: 'toss' as const, h: 3 }]
      for (const a of [...actions, { type: 'tick' as const }]) {
        const snap = JSON.stringify(s)
        const n = reduce(s, a)
        expect(JSON.stringify(s)).toBe(snap)
        s = n
      }
    }
    expect(s.status).toBe('running')
  })
})
