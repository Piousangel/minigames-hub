import { describe, expect, it } from 'vitest'
import {
  BASE_SPEED,
  CHAIN_BONUS,
  CLEAR_BONUS,
  GHOST_MAX,
  LOOP_MICRO,
  MAX_SPEED,
  NOTE_BASE,
  STEPS,
  STEP_MICRO,
  adjacency,
  createGame,
  ghostsFor,
  headStep,
  mulberry32,
  multFor,
  noteCount,
  placeGhosts,
  reduce,
  speedFor,
  type OverdubState,
  type Rng,
} from './engine'

// -- helpers ----------------------------------------------------------------

/** A queued-array Rng, like the template's deterministic tests use. */
function queued(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

/** Wraps an Rng and tallies how many times it was called. */
function counting(rng: Rng): { rng: Rng; calls: () => number } {
  let n = 0
  return {
    rng: () => {
      n++
      return rng()
    },
    calls: () => n,
  }
}

/** Hand-build a state (bypasses ghost generation) for reducer tests. */
function stateWith(steps: number[], overrides: Partial<OverdubState> = {}): OverdubState {
  const notes = Array<boolean>(STEPS).fill(false)
  for (const s of steps) notes[s] = true
  return {
    seed: 1,
    notes,
    ghosts: Array<boolean>(STEPS).fill(false),
    headMicro: 0,
    tick: 0,
    lap: 0,
    wraps: 0,
    score: 0,
    chain: 0,
    bestChain: 0,
    placed: 0,
    lastGain: 0,
    lastStep: null,
    lastMult: 1,
    over: false,
    event: 'none',
    ...overrides,
  }
}

function runTicks(s: OverdubState, n: number): OverdubState {
  let cur = s
  for (let i = 0; i < n; i++) cur = reduce(cur, { type: 'tick' })
  return cur
}

/** Tick the head onto `step`, then tap it. */
function tapAt(s: OverdubState, step: number): OverdubState {
  let cur = s
  for (let i = 0; i < 4000 && headStep(cur) !== step; i++) cur = reduce(cur, { type: 'tick' })
  expect(headStep(cur)).toBe(step)
  return reduce(cur, { type: 'tap' })
}

// -- 1..7 construction & rng ------------------------------------------------

describe('createGame', () => {
  it('starts a zeroed run with a 16-step loop', () => {
    const g = createGame(7)
    expect(g.notes.length).toBe(STEPS)
    expect(g.ghosts.length).toBe(STEPS)
    expect(g.score).toBe(0)
    expect(g.headMicro).toBe(0)
    expect(g.over).toBe(false)
    expect(g.lap).toBe(0)
    expect(g.lastStep).toBeNull()
  })

  it('is deterministic for a fixed seed', () => {
    expect(createGame(12345)).toEqual(createGame(12345))
  })

  it('lays ghosts differently for different seeds', () => {
    const a = createGame(1)
    const b = createGame(999)
    expect(a.notes).not.toEqual(b.notes)
  })

  it('consumes exactly ghostsFor(0) rng calls to lay the opening ghosts', () => {
    const c = counting(mulberry32(42))
    placeGhosts(0, c.rng)
    expect(c.calls()).toBe(ghostsFor(0))
  })

  it('lays ghostsFor(0) distinct ghost steps', () => {
    for (const seed of [1, 2, 3, 12345, 88888]) {
      const g = createGame(seed)
      expect(noteCount(g.notes)).toBe(ghostsFor(0))
      expect(noteCount(g.ghosts)).toBe(ghostsFor(0))
    }
  })

  it('keeps the invariant ghosts[i] implies notes[i]', () => {
    for (const seed of [1, 77, 12345]) {
      const g = createGame(seed)
      for (let i = 0; i < STEPS; i++) if (g.ghosts[i]) expect(g.notes[i]).toBe(true)
    }
  })

  it('clamps ghostsFor at GHOST_MAX', () => {
    expect(ghostsFor(0)).toBe(2)
    expect(ghostsFor(3)).toBe(5)
    expect(ghostsFor(4)).toBe(GHOST_MAX)
    expect(ghostsFor(99)).toBe(GHOST_MAX)
  })
})

// -- 8..12 head & speed -----------------------------------------------------

describe('head & speed', () => {
  it('advances headMicro by exactly speedFor(count, lap) per tick', () => {
    const s = stateWith([0, 5])
    const n = reduce(s, { type: 'tick' })
    expect(n.headMicro).toBe(speedFor(2, 0))
    expect(n.tick).toBe(1)
    expect(n.event).toBe('none')
  })

  it('wraps at the loop boundary and emits wrap', () => {
    const s = stateWith([], { headMicro: LOOP_MICRO - 1 })
    const n = reduce(s, { type: 'tick' })
    expect(n.headMicro).toBeLessThan(LOOP_MICRO)
    expect(n.headMicro).toBe((LOOP_MICRO - 1 + BASE_SPEED) % LOOP_MICRO)
    expect(n.event).toBe('wrap')
    expect(n.wraps).toBe(1)
  })

  it('keeps headStep inside 0..15 across a full revolution', () => {
    let s: OverdubState = stateWith([3])
    for (let i = 0; i < 400; i++) {
      s = reduce(s, { type: 'tick' })
      const st = headStep(s)
      expect(st).toBeGreaterThanOrEqual(0)
      expect(st).toBeLessThan(STEPS)
      expect(Number.isInteger(st)).toBe(true)
    }
    expect(s.wraps).toBeGreaterThan(0)
  })

  it('speedFor is non-decreasing in count and lap', () => {
    for (let c = 1; c <= STEPS; c++) {
      expect(speedFor(c, 0)).toBeGreaterThan(speedFor(c - 1, 0))
      expect(speedFor(c, 1)).toBeGreaterThan(speedFor(c, 0))
    }
    expect(speedFor(0, 0)).toBe(BASE_SPEED)
  })

  it('speedFor never exceeds MAX_SPEED', () => {
    expect(speedFor(STEPS, 99)).toBe(MAX_SPEED)
    for (let lap = 0; lap < 40; lap++) {
      for (let c = 0; c <= STEPS; c++) {
        const v = speedFor(c, lap)
        expect(v).toBeLessThanOrEqual(MAX_SPEED)
        expect(v).toBeGreaterThanOrEqual(BASE_SPEED)
        expect(Number.isInteger(v)).toBe(true)
      }
    }
  })
})

// -- 13..18 placement & adjacency -------------------------------------------

describe('placement & adjacency', () => {
  it('stamps a note on the head step', () => {
    const s = stateWith([8], { headMicro: 0 })
    const n = reduce(s, { type: 'tap' })
    expect(n.notes[0]).toBe(true)
    expect(n.event).toBe('place')
    expect(n.placed).toBe(1)
    expect(n.lastStep).toBe(0)
    expect(n.over).toBe(false)
  })

  it('scores an isolated placement at NOTE_BASE * count', () => {
    const s = stateWith([8], { headMicro: 0 })
    const n = reduce(s, { type: 'tap' })
    expect(n.lastMult).toBe(1)
    expect(n.lastGain).toBe(NOTE_BASE * 2)
    expect(n.score).toBe(NOTE_BASE * 2)
  })

  it('doubles a placement landed beside one note', () => {
    const s = stateWith([1], { headMicro: 0 })
    const n = reduce(s, { type: 'tap' })
    expect(n.lastMult).toBe(2)
    expect(n.event).toBe('bonus')
    expect(n.lastGain).toBe(NOTE_BASE * 2 * 2 + CHAIN_BONUS * 1)
  })

  it('quadruples a placement sandwiched between two notes', () => {
    const s = stateWith([1, 3], { headMicro: 2 * STEP_MICRO })
    const n = reduce(s, { type: 'tap' })
    expect(n.lastMult).toBe(4)
    expect(n.event).toBe('bonus')
  })

  it('wraps adjacency modularly: step 0 neighbours step 15', () => {
    const notes = Array<boolean>(STEPS).fill(false)
    notes[15] = true
    expect(adjacency(notes, 0)).toBe(1)
    expect(adjacency(notes, 14)).toBe(1)
    notes[1] = true
    expect(adjacency(notes, 0)).toBe(2)
    expect(multFor(adjacency(notes, 0))).toBe(4)
  })

  it('reads the pre-placement loop — a note is never its own neighbour', () => {
    const s = stateWith([], { headMicro: 0 })
    const n = reduce(s, { type: 'tap' })
    expect(n.lastMult).toBe(1) // empty loop -> no neighbours
    // and the placed note does not retroactively boost itself
    expect(n.lastGain).toBe(NOTE_BASE * 1)
    expect(adjacency(n.notes, 0)).toBe(0)
  })
})

// -- 19..21 chain -----------------------------------------------------------

describe('chain', () => {
  it('grows on consecutive mult>1 placements and pays CHAIN_BONUS * chain', () => {
    // notes at 1; tap 0 (adj 1 -> chain 1), then tap 15 (adj 1 via 0 -> chain 2)
    let s = stateWith([1], { headMicro: 0 })
    s = reduce(s, { type: 'tap' })
    expect(s.chain).toBe(1)
    const first = s.lastGain
    expect(first).toBe(NOTE_BASE * 2 * 2 + CHAIN_BONUS * 1)

    s = tapAt(s, 15)
    expect(s.chain).toBe(2)
    expect(s.lastMult).toBe(2)
    expect(s.lastGain).toBe(NOTE_BASE * 3 * 2 + CHAIN_BONUS * 2)
  })

  it('resets the chain to 0 on an isolated placement', () => {
    let s = stateWith([1], { headMicro: 0 })
    s = reduce(s, { type: 'tap' }) // chain 1
    expect(s.chain).toBe(1)
    s = tapAt(s, 8) // isolated
    expect(s.lastMult).toBe(1)
    expect(s.chain).toBe(0)
    expect(s.lastGain).toBe(NOTE_BASE * 3)
  })

  it('tracks bestChain as the max chain reached', () => {
    let s = stateWith([1], { headMicro: 0 })
    s = reduce(s, { type: 'tap' }) // chain 1
    s = tapAt(s, 15) // chain 2
    expect(s.bestChain).toBe(2)
    s = tapAt(s, 8) // chain 0
    expect(s.chain).toBe(0)
    expect(s.bestChain).toBe(2)
  })
})

// -- 22..25 terminal & no-ops -----------------------------------------------

describe('terminal & no-ops', () => {
  it('ends the run when tapping an occupied step', () => {
    const s = stateWith([0], { headMicro: 0, score: 120 })
    const n = reduce(s, { type: 'tap' })
    expect(n.over).toBe(true)
    expect(n.event).toBe('out')
    expect(n.score).toBe(120)
    expect(n.lastStep).toBe(0)
    expect(n.lastGain).toBe(0)
  })

  it('ignores taps after the run is over', () => {
    const dead = reduce(stateWith([0], { headMicro: 0 }), { type: 'tap' })
    const again = reduce(dead, { type: 'tap' })
    expect(again.event).toBe('none')
    expect(again.score).toBe(dead.score)
    expect(again.notes).toEqual(dead.notes)
    expect(again.tick).toBe(dead.tick)
    expect(again.placed).toBe(dead.placed)
  })

  it('freezes the head once the run is over', () => {
    const dead = reduce(stateWith([0], { headMicro: 0 }), { type: 'tap' })
    const later = runTicks(dead, 50)
    expect(later.headMicro).toBe(dead.headMicro)
    expect(later.tick).toBe(dead.tick)
    expect(later.wraps).toBe(dead.wraps)
    expect(later.event).toBe('none')
  })

  it('never mutates its input state or arrays', () => {
    const s = stateWith([0, 4])
    Object.freeze(s)
    Object.freeze(s.notes)
    Object.freeze(s.ghosts)
    const before = s.notes.slice()

    expect(() => reduce(s, { type: 'tick' })).not.toThrow()
    expect(() => reduce({ ...s, headMicro: 2 * STEP_MICRO }, { type: 'tap' })).not.toThrow()
    expect(() => reduce(s, { type: 'tap' })).not.toThrow() // fatal tap on step 0
    expect(s.notes).toEqual(before)
    expect(s.score).toBe(0)
    expect(s.over).toBe(false)
  })
})

// -- 26..28 clear & scoring shape -------------------------------------------

/** A state one note short of full, with the head parked on the hole. */
function oneShortOfFull(hole: number, overrides: Partial<OverdubState> = {}): OverdubState {
  const all: number[] = []
  for (let i = 0; i < STEPS; i++) if (i !== hole) all.push(i)
  return stateWith(all, { headMicro: hole * STEP_MICRO, ...overrides })
}

describe('clear', () => {
  it('clears the loop when the 16th note lands', () => {
    const s = oneShortOfFull(7, { seed: 4242 })
    const n = reduce(s, { type: 'tap' })
    expect(n.event).toBe('clear')
    expect(n.lap).toBe(1)
    expect(noteCount(n.notes)).toBe(ghostsFor(1))
    expect(n.notes.every(Boolean)).toBe(false) // never returns a full loop
    const placement = NOTE_BASE * 16 * 4 + CHAIN_BONUS * 1
    expect(n.score).toBe(placement + CLEAR_BONUS * 1)
    expect(n.placed).toBe(1)
    expect(n.headMicro).toBe(s.headMicro) // head keeps its position
    for (let i = 0; i < STEPS; i++) if (n.ghosts[i]) expect(n.notes[i]).toBe(true)
  })

  it('reseeds a clear deterministically from (seed, lap)', () => {
    const c = counting(mulberry32(1))
    placeGhosts(1, c.rng)
    expect(c.calls()).toBe(ghostsFor(1))

    const a = reduce(oneShortOfFull(7, { seed: 4242 }), { type: 'tap' })
    const b = reduce(oneShortOfFull(7, { seed: 4242 }), { type: 'tap' })
    expect(a.notes).toEqual(b.notes)
    expect(a.ghosts).toEqual(b.ghosts)

    const other = reduce(oneShortOfFull(7, { seed: 99 }), { type: 'tap' })
    expect(other.notes).not.toEqual(a.notes)
    // reset replays the whole run: the seed field stays the run's own seed
    expect(a.seed).toBe(4242)
  })

  it('keeps score non-decreasing and integral across a scripted run', () => {
    let s = createGame(2024)
    let prev = s.score
    for (let i = 0; i < 200; i++) {
      s = reduce(s, { type: 'tick' })
      expect(s.score).toBeGreaterThanOrEqual(prev)
      prev = s.score
      if (i % 17 === 0 && !s.notes[headStep(s)] && !s.over) {
        s = reduce(s, { type: 'tap' })
      }
      expect(Number.isInteger(s.score)).toBe(true)
      expect(s.score).toBeGreaterThanOrEqual(prev)
      expect(s.headMicro).toBeGreaterThanOrEqual(0)
      expect(s.headMicro).toBeLessThan(LOOP_MICRO)
      prev = s.score
    }
    expect(s.score).toBeGreaterThan(0)
  })
})

// -- 29..30 golden ----------------------------------------------------------

const GOLDEN_SEED = 12345
const GOLDEN_TAPS = [10, 21, 32, 43, 60, 71, 84, 95, 108, 119, 130, 141]

function playGolden(): OverdubState {
  let s = createGame(GOLDEN_SEED)
  const taps = new Set(GOLDEN_TAPS)
  for (let i = 0; i < 400; i++) {
    s = reduce(s, { type: 'tick' })
    if (taps.has(s.tick)) s = reduce(s, { type: 'tap' })
  }
  return s
}

describe('golden', () => {
  it('replays a fixed (seed, tapTicks) script to a pinned state', () => {
    const s = playGolden()
    expect({
      score: s.score,
      notes: s.notes,
      ghosts: s.ghosts,
      lap: s.lap,
      wraps: s.wraps,
      placed: s.placed,
      bestChain: s.bestChain,
      over: s.over,
      tick: s.tick,
    }).toMatchSnapshot()
  })

  it('is reproducible: two identical scripts land on identical states', () => {
    expect(playGolden()).toEqual(playGolden())
  })

  it('queued rng makes ghost placement fully predictable', () => {
    // free = [0..15]; 0 -> index 0 (step 0); then free = [1..15], 0.5 -> index 7 (step 8)
    const { notes, ghosts } = placeGhosts(0, queued([0, 0.5]))
    expect(noteCount(notes)).toBe(2)
    expect(notes[0]).toBe(true)
    expect(notes[8]).toBe(true)
    expect(ghosts).toEqual(notes)
  })
})
