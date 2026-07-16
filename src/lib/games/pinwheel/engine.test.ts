import { describe, expect, it } from 'vitest'
import {
  DIFFICULTIES,
  LOCK_BASE,
  MULTI_BASE,
  PAR_BONUS_MAX,
  UNDO_POOL,
  WIN_BONUS,
  computeSpin,
  createGame,
  fallbackBoard,
  freeAnchors,
  generateBoard,
  hasLegalMove,
  inBounds,
  inv,
  keyOf,
  mulberry32,
  preview,
  reduce,
  rotate,
  rotateMote,
  sortPoints,
  stateFromBoard,
  stateKey,
  type Dir,
  type Mote,
  type PinwheelConfig,
  type PinwheelState,
  type Point,
  type Rng,
} from './engine'

const DIFFS = Object.entries(DIFFICULTIES) as [string, PinwheelConfig][]
const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1)

const CFG5: PinwheelConfig = { width: 5, height: 5, motes: 3, scramble: 4 }

/** Hand-build a state (bypasses generation) for spin/reducer tests. */
function stateWith(
  anchors: Point[],
  motes: Mote[],
  overrides: Partial<PinwheelState> = {},
): PinwheelState {
  return {
    config: CFG5,
    seed: 1,
    anchors: anchors.map((a) => ({ ...a })),
    motes: motes.map((m) => ({ ...m })),
    locked: [],
    moves: 0,
    par: 1,
    score: 0,
    bestShed: 0,
    undoStack: [],
    undosLeft: UNDO_POOL,
    won: false,
    dead: false,
    lastEvent: 'none',
    lastSpin: null,
    lastPivot: null,
    ...overrides,
  }
}

function counting(seed: number): { rng: Rng; count: () => number } {
  const base = mulberry32(seed)
  let n = 0
  return {
    rng: () => {
      n++
      return base()
    },
    count: () => n,
  }
}

const cells5: Point[] = []
for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) cells5.push({ x, y })
const pivots5: Point[] = [
  { x: 0, y: 0 },
  { x: 2, y: 2 },
  { x: 4, y: 4 },
  { x: 1, y: 3 },
  { x: 3, y: 1 },
]

/** Multiset of pairwise squared distances, canonical (sorted) form. */
function pairDists(pts: Point[]): number[] {
  const out: number[] = []
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x
      const dy = pts[i].y - pts[j].y
      out.push(dx * dx + dy * dy)
    }
  }
  return out.sort((a, b) => a - b)
}

// -- The literal golden board ------------------------------------------------
//
// 5x5. Anchors and motes given as literals; par hand-set to 3 so both a
// par-matching (3 move) and a par-beating (2 move) run exist.
//
//   anchors: (1,1) (3,1) (4,4)      motes: m0 (0,4)  m1 (0,2)  m2 (1,3)
//
// Spin cw about (2,3) lands m0 -> (1,1), m1 -> (3,1) (both free anchors, a
// double shed) and m2 -> (2,2). Spin cw about (2,4) then lands m2 -> (4,4).
const G_ANCHORS: Point[] = [
  { x: 1, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 4 },
]
const G_MOTES: Mote[] = [
  { id: 0, x: 0, y: 4 },
  { id: 1, x: 0, y: 2 },
  { id: 2, x: 1, y: 3 },
]
const goldenState = () => stateWith(G_ANCHORS, G_MOTES, { par: 3 })

// ---------------------------------------------------------------- Geometry

describe('mulberry32', () => {
  it('is reproducible for equal seeds and divergent for different ones', () => {
    const a = mulberry32(9876)
    const b = mulberry32(9876)
    const c = mulberry32(9877)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    const seqC = [c(), c(), c(), c()]
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('rotate', () => {
  it('matches the brief literally — ccw sends right to up on a y-down screen', () => {
    const o = { x: 0, y: 0 }
    expect(rotate({ x: 1, y: 0 }, o, 'ccw')).toEqual({ x: 0, y: -1 })
    expect(rotate({ x: 1, y: 0 }, o, 'cw')).toEqual({ x: 0, y: 1 })
  })

  it('cw and ccw are exact inverses over every point x pivot sample', () => {
    for (const p of cells5) {
      for (const v of pivots5) {
        expect(rotate(rotate(p, v, 'cw'), v, 'ccw')).toEqual(p)
        expect(rotate(rotate(p, v, 'ccw'), v, 'cw')).toEqual(p)
      }
    }
  })

  it('four rotations in the same direction are the identity', () => {
    for (const p of cells5) {
      for (const v of pivots5) {
        for (const dir of ['cw', 'ccw'] as Dir[]) {
          let q = p
          for (let i = 0; i < 4; i++) q = rotate(q, v, dir)
          expect(q).toEqual(p)
        }
      }
    }
  })

  it('fixes the pivot itself', () => {
    for (const v of pivots5) {
      expect(rotate(v, v, 'cw')).toEqual(v)
      expect(rotate(v, v, 'ccw')).toEqual(v)
    }
  })

  it('is integer-exact and preserves squared distance to the pivot', () => {
    for (const p of cells5) {
      for (const v of pivots5) {
        for (const dir of ['cw', 'ccw'] as Dir[]) {
          const q = rotate(p, v, dir)
          expect(Number.isInteger(q.x)).toBe(true)
          expect(Number.isInteger(q.y)).toBe(true)
          const d0 = (p.x - v.x) ** 2 + (p.y - v.y) ** 2
          const d1 = (q.x - v.x) ** 2 + (q.y - v.y) ** 2
          expect(d1).toBe(d0)
        }
      }
    }
  })

  it('is injective for a fixed pivot and direction', () => {
    for (const v of pivots5) {
      for (const dir of ['cw', 'ccw'] as Dir[]) {
        const seen = new Set(cells5.map((p) => keyOf(rotate(p, v, dir))))
        expect(seen.size).toBe(cells5.length)
      }
    }
  })

  it('inv is an involution and rotateMote carries the id', () => {
    expect(inv('cw')).toBe('ccw')
    expect(inv(inv('cw'))).toBe('cw')
    expect(inv(inv('ccw'))).toBe('ccw')
    const m = rotateMote({ id: 7, x: 1, y: 0 }, { x: 0, y: 0 }, 'ccw')
    expect(m).toEqual({ id: 7, x: 0, y: -1 })
  })

  it('sortPoints is canonical (y then x) and non-mutating', () => {
    const src = [
      { x: 3, y: 1 },
      { x: 0, y: 4 },
      { x: 1, y: 1 },
    ]
    const copy = src.map((p) => ({ ...p }))
    expect(sortPoints(src)).toEqual([
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 0, y: 4 },
    ])
    expect(src).toEqual(copy)
  })
})

// -------------------------------------------------------------- Generation

describe('generation', () => {
  it('createGame is deterministic for a fixed seed, all difficulties', () => {
    for (const [, cfg] of DIFFS) {
      for (const seed of [1, 2, 42]) {
        expect(createGame(cfg, seed)).toEqual(createGame(cfg, seed))
      }
    }
  })

  it('produces structurally sound fresh state', () => {
    for (const [, cfg] of DIFFS) {
      for (const seed of SEEDS) {
        const s = createGame(cfg, seed)
        expect(s.anchors).toHaveLength(cfg.motes)
        expect(new Set(s.anchors.map(keyOf)).size).toBe(cfg.motes)
        for (const a of s.anchors) expect(inBounds(a, cfg)).toBe(true)

        expect(s.motes).toHaveLength(cfg.motes)
        expect(new Set(s.motes.map((m) => m.id))).toEqual(
          new Set(Array.from({ length: cfg.motes }, (_, i) => i)),
        )
        for (const m of s.motes) expect(inBounds(m, cfg)).toBe(true)

        expect(s.locked).toEqual([])
        expect(s.moves).toBe(0)
        expect(s.score).toBe(0)
        expect(s.bestShed).toBe(0)
        expect(s.undosLeft).toBe(UNDO_POOL)
        expect(s.par).toBeGreaterThanOrEqual(1)
        expect(s.par).toBeLessThanOrEqual(cfg.scramble)
        expect(s.won).toBe(false)
        expect(s.dead).toBe(false)
      }
    }
  })

  it('fresh boards satisfy invariant (I) and are not already won', () => {
    for (const [, cfg] of DIFFS) {
      for (const seed of SEEDS) {
        const s = createGame(cfg, seed)
        const free = new Set(freeAnchors(s.anchors, s.locked).map(keyOf))
        for (const m of s.motes) expect(free.has(keyOf(m))).toBe(false)
        expect(s.motes.length).toBeGreaterThan(0)
      }
    }
  })

  it('consumes exactly N + 3M rng values (golden accounting)', () => {
    for (const [, cfg] of DIFFS) {
      // seed 1 is known to succeed on the first attempt for every difficulty.
      const c = counting(1)
      const b = generateBoard(cfg, c.rng)
      expect(b).not.toBeNull()
      const n = c.count()
      expect(n).toBe(cfg.motes + 3 * cfg.scramble)
      expect((n - cfg.motes) % 3).toBe(0)
    }
  })

  it('golden — every generated script replays forward to a win in par moves', () => {
    for (const [, cfg] of DIFFS) {
      for (const seed of SEEDS) {
        const b = generateBoard(cfg, mulberry32(seed))
        if (!b) continue // aborted attempt; createGame retries the seed
        let s = stateFromBoard(cfg, seed, b)
        for (const step of b.script) {
          s = reduce(s, { type: 'spin', pivot: step.pivot, dir: step.dir })
          expect(s.lastEvent).not.toBe('crash')
          expect(s.dead).toBe(false)
        }
        expect(s.won).toBe(true)
        expect(s.moves).toBe(s.par)
        expect(s.moves).toBe(b.par)
      }
    }
  })

  it('difficulty configs are odd squares with motes <= scramble <= board', () => {
    for (const [, cfg] of DIFFS) {
      expect(cfg.width).toBe(cfg.height)
      expect(cfg.width % 2).toBe(1)
      expect(cfg.motes).toBeLessThanOrEqual(cfg.scramble)
      expect(cfg.motes).toBeLessThanOrEqual(cfg.width * cfg.height)
    }
  })

  it('fallbackBoard is valid and winnable in one spin', () => {
    for (const [, cfg] of DIFFS) {
      const b = fallbackBoard(cfg)
      expect(b.par).toBe(1)
      expect(b.motes).toHaveLength(cfg.motes)
      for (const m of b.motes) expect(inBounds(m, cfg)).toBe(true)
      let s = stateFromBoard(cfg, 0, b)
      s = reduce(s, { type: 'spin', pivot: b.script[0].pivot, dir: b.script[0].dir })
      expect(s.won).toBe(true)
    }
  })
})

// --------------------------------------------------------------- Mechanics

describe('mechanics', () => {
  it('rigid-body: pairwise squared distances and ids survive every spin', () => {
    for (const [, cfg] of DIFFS) {
      for (const seed of SEEDS) {
        const b = generateBoard(cfg, mulberry32(seed))
        if (!b) continue
        let s = stateFromBoard(cfg, seed, b)
        for (const step of b.script) {
          const before = s.motes.map((m) => ({ ...m }))
          s = reduce(s, { type: 'spin', pivot: step.pivot, dir: step.dir })
          const landed = s.lastSpin!.landed
          // the whole constellation moved rigidly
          expect(pairDists(landed)).toEqual(pairDists(before))
          expect(landed.map((m) => m.id)).toEqual(before.map((m) => m.id))
          // ...and so did the survivors, considered on their own
          const surviving = new Set(s.motes.map((m) => m.id))
          expect(pairDists(s.motes)).toEqual(
            pairDists(before.filter((m) => surviving.has(m.id))),
          )
        }
      }
    }
  })

  it('computeSpin never mutates its input', () => {
    const s = goldenState()
    Object.freeze(s.motes)
    Object.freeze(s.locked)
    Object.freeze(s.anchors)
    const clone = JSON.parse(JSON.stringify(s)) as PinwheelState
    computeSpin(s, { x: 2, y: 3 }, 'cw')
    expect(JSON.parse(JSON.stringify(s))).toEqual(clone)
  })

  it('a mote landing on a free anchor pins there, id carried through', () => {
    // one mote at (0,2), one free anchor at (3,1); cw about (2,3) lands it.
    const s = stateWith([{ x: 3, y: 1 }], [{ id: 1, x: 0, y: 2 }])
    const out = computeSpin(s, { x: 2, y: 3 }, 'cw')
    expect(out.crashed).toBe(false)
    expect(out.shed).toEqual([{ id: 1, x: 3, y: 1 }])
    expect(out.motes).toEqual([])
    expect(out.locked).toHaveLength(1)
    expect(out.won).toBe(true)

    const next = reduce(s, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    expect(next.locked).toEqual([{ id: 1, x: 3, y: 1 }])
    expect(next.motes).toHaveLength(0)
  })

  it('pinned motes are walls — landing on one crashes and freezes the motes', () => {
    // Golden board after its first spin: pins at (1,1),(3,1); free mote at (2,2).
    const s = stateWith(G_ANCHORS, [{ id: 2, x: 2, y: 2 }], {
      locked: [
        { id: 0, x: 1, y: 1 },
        { id: 1, x: 3, y: 1 },
      ],
    })
    // cw about (2,1) sends (2,2) onto the pinned mote at (1,1).
    const out = computeSpin(s, { x: 2, y: 1 }, 'cw')
    expect(out.landed).toEqual([{ id: 2, x: 1, y: 1 }])
    expect(out.crashed).toBe(true)
    expect(out.crashIdx).toEqual([0])
    expect(out.shed).toEqual([])
    expect(out.locked).toBe(s.locked)

    const next = reduce(s, { type: 'spin', pivot: { x: 2, y: 1 }, dir: 'cw' })
    expect(next.dead).toBe(true)
    expect(next.lastEvent).toBe('crash')
    expect(next.moves).toBe(1)
    // pre-spin positions are kept; the UI reads lastSpin.landed for the shatter
    expect(next.motes).toEqual([{ id: 2, x: 2, y: 2 }])
    expect(next.lastSpin!.landed).toEqual([{ id: 2, x: 1, y: 1 }])
  })

  it('landing on a CLAIMED anchor is a collision, not a pin', () => {
    // (1,1) is an anchor AND already claimed -> the cell is a wall.
    const s = stateWith(G_ANCHORS, [{ id: 2, x: 2, y: 2 }], {
      locked: [{ id: 0, x: 1, y: 1 }],
    })
    const out = computeSpin(s, { x: 2, y: 1 }, 'cw')
    expect(out.crashed).toBe(true)
    expect(out.shed).toEqual([])
    // the same landing cell on an UNclaimed anchor pins instead
    const s2 = stateWith(G_ANCHORS, [{ id: 2, x: 2, y: 2 }])
    const out2 = computeSpin(s2, { x: 2, y: 1 }, 'cw')
    expect(out2.crashed).toBe(false)
    expect(out2.shed).toEqual([{ id: 2, x: 1, y: 1 }])
  })

  it('off-board kills: score unchanged, landed keeps the OOB cell', () => {
    const s = goldenState()
    // cw about (0,0) throws m0 (0,4) to (-4,0).
    const out = computeSpin(s, { x: 0, y: 0 }, 'cw')
    expect(out.crashed).toBe(true)
    expect(out.crashIdx).toContain(0)
    expect(out.landed[0]).toEqual({ id: 0, x: -4, y: 0 })
    expect(out.shed).toEqual([])

    const next = reduce(s, { type: 'spin', pivot: { x: 0, y: 0 }, dir: 'cw' })
    expect(next.dead).toBe(true)
    expect(next.score).toBe(0)
    expect(next.motes).toEqual(s.motes)
    expect(next.lastSpin!.landed[0]).toEqual({ id: 0, x: -4, y: 0 })
  })

  it('crash ordering: validate-all runs before shedding', () => {
    // cw about (0,0): m0 (0,0) -> (0,0), a FREE anchor; m1 (0,1) -> (-1,0), OOB.
    const s = stateWith(
      [
        { x: 0, y: 0 },
        { x: 4, y: 4 },
      ],
      [
        { id: 0, x: 0, y: 0 },
        { id: 1, x: 0, y: 1 },
      ],
    )
    const out = computeSpin(s, { x: 0, y: 0 }, 'cw')
    expect(out.landed).toEqual([
      { id: 0, x: 0, y: 0 },
      { id: 1, x: -1, y: 0 },
    ])
    expect(out.crashed).toBe(true)
    expect(out.crashIdx).toEqual([1])
    expect(out.shed).toEqual([]) // NOT shed, even though m0 sat on a free anchor
    expect(out.locked).toEqual([])
  })

  it('spins are no-ops once dead, and once won', () => {
    const dead = goldenState()
    const d1 = reduce(dead, { type: 'spin', pivot: { x: 0, y: 0 }, dir: 'cw' })
    expect(d1.dead).toBe(true)
    const d2 = reduce(d1, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    expect(d2.lastEvent).toBe('none')
    expect(d2.motes).toEqual(d1.motes)
    expect(d2.moves).toBe(d1.moves)

    const won = reduce(
      stateWith([{ x: 3, y: 1 }], [{ id: 1, x: 0, y: 2 }]),
      { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' },
    )
    expect(won.won).toBe(true)
    const w2 = reduce(won, { type: 'spin', pivot: { x: 2, y: 2 }, dir: 'cw' })
    expect(w2.lastEvent).toBe('none')
    expect(w2.moves).toBe(won.moves)
  })

  it('an out-of-bounds pivot is illegal and leaves the state otherwise identical', () => {
    const s = goldenState()
    const next = reduce(s, { type: 'spin', pivot: { x: 5, y: 0 }, dir: 'cw' })
    expect(next.lastEvent).toBe('illegal')
    expect({ ...next, lastEvent: 'none' as const }).toEqual({ ...s, lastEvent: 'none' as const })
  })

  it('multi-lock: one spin sheds two', () => {
    const s = goldenState()
    const next = reduce(s, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    expect(next.lastEvent).toBe('multilock')
    expect(next.bestShed).toBe(2)
    expect(next.score).toBe(2 * LOCK_BASE + MULTI_BASE)
    expect(next.locked).toEqual([
      { id: 0, x: 1, y: 1 },
      { id: 1, x: 3, y: 1 },
    ])
    expect(next.motes).toEqual([{ id: 2, x: 2, y: 2 }])
  })
})

// ------------------------------------------------------------- Golden trace

describe('golden literal trace', () => {
  it('asserts motes / locked / moves / score / lastEvent at every step', () => {
    let s = goldenState()
    expect(s.par).toBe(3)

    // Step 1 — cw about (2,3): double shed.
    s = reduce(s, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    expect(s.motes).toEqual([{ id: 2, x: 2, y: 2 }])
    expect(s.locked).toEqual([
      { id: 0, x: 1, y: 1 },
      { id: 1, x: 3, y: 1 },
    ])
    expect(s.moves).toBe(1)
    expect(s.score).toBe(350) // 2*100 + 150
    expect(s.lastEvent).toBe('multilock')
    expect(s.won).toBe(false)

    // Step 2 — cw about (2,4): the last mote lands on (4,4) and wins.
    s = reduce(s, { type: 'spin', pivot: { x: 2, y: 4 }, dir: 'cw' })
    expect(s.motes).toEqual([])
    expect(s.locked).toEqual([
      { id: 0, x: 1, y: 1 },
      { id: 1, x: 3, y: 1 },
      { id: 2, x: 4, y: 4 },
    ])
    expect(s.moves).toBe(2)
    expect(s.lastEvent).toBe('win')
    expect(s.won).toBe(true)
    // 350 + 100 (lock) + 1000 (win) + round(1000 * 3 / 2) = 2950
    expect(s.score).toBe(2950)
    expect(s.bestShed).toBe(2)
  })

  it('win + par bonus arithmetic is exact', () => {
    let s = goldenState()
    s = reduce(s, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    s = reduce(s, { type: 'spin', pivot: { x: 2, y: 4 }, dir: 'cw' })
    const shedPoints = 2 * LOCK_BASE + MULTI_BASE + LOCK_BASE
    const parBonus = Math.round((PAR_BONUS_MAX * 3) / 2)
    expect(s.score).toBe(shedPoints + WIN_BONUS + parBonus)
    expect(parBonus).toBe(1500) // uncapped: beating par pays over PAR_BONUS_MAX
  })

  it('beating par pays strictly more than matching it', () => {
    // Run A — 2 moves on a par-3 board.
    let a = goldenState()
    a = reduce(a, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    a = reduce(a, { type: 'spin', pivot: { x: 2, y: 4 }, dir: 'cw' })

    // Run B — same board, same pins, but a wasted spin about the lone mote
    // itself (a legal no-shed spin) makes it 3 moves === par.
    let b = goldenState()
    b = reduce(b, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    b = reduce(b, { type: 'spin', pivot: { x: 2, y: 2 }, dir: 'cw' })
    expect(b.lastEvent).toBe('spin')
    expect(b.motes).toEqual([{ id: 2, x: 2, y: 2 }])
    b = reduce(b, { type: 'spin', pivot: { x: 2, y: 4 }, dir: 'cw' })

    expect(a.won).toBe(true)
    expect(b.won).toBe(true)
    expect(a.moves).toBe(2)
    expect(b.moves).toBe(3)
    expect(b.score).toBe(2450) // 450 + 1000 + round(1000*3/3)
    expect(a.score).toBeGreaterThan(b.score)
  })

  it('leaderboard contract: score is a non-decreasing non-negative integer', () => {
    for (const [, cfg] of DIFFS) {
      for (const seed of SEEDS) {
        const board = generateBoard(cfg, mulberry32(seed))
        if (!board) continue
        let s = stateFromBoard(cfg, seed, board)
        let prev = s.score
        for (const step of board.script) {
          s = reduce(s, { type: 'spin', pivot: step.pivot, dir: step.dir })
          expect(Number.isInteger(s.score)).toBe(true)
          expect(s.score).toBeGreaterThanOrEqual(prev)
          expect(s.score).toBeGreaterThanOrEqual(0)
          prev = s.score
        }
        expect(s.won).toBe(true)
      }
    }
  })
})

// -------------------------------------------------------- Undo / reset / new

describe('undo, reset, new', () => {
  it('undo restores everything exactly and un-pins motes back into the constellation', () => {
    const s0 = goldenState()
    const s1 = reduce(s0, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    expect(s1.locked).toHaveLength(2)

    const u = reduce(s1, { type: 'undo' })
    expect(u.lastEvent).toBe('undo')
    expect(u.motes).toEqual(s0.motes) // shed motes rejoined the constellation
    expect(u.locked).toEqual([])
    expect(u.moves).toBe(0)
    expect(u.score).toBe(0)
    expect(u.bestShed).toBe(0)
    expect(u.undosLeft).toBe(UNDO_POOL - 1)
    expect(u.lastSpin).toBeNull()
    expect(u.lastPivot).toBeNull()
  })

  it('undo is a no-op on an empty stack, when exhausted, and when won or dead', () => {
    const s0 = goldenState()
    expect(reduce(s0, { type: 'undo' })).toEqual({ ...s0, lastEvent: 'none' })

    // Exhaust the pool: UNDO_POOL + 1 spin/undo pairs.
    let s = goldenState()
    for (let i = 0; i < UNDO_POOL; i++) {
      s = reduce(s, { type: 'spin', pivot: { x: 2, y: 2 }, dir: 'cw' })
      s = reduce(s, { type: 'undo' })
      expect(s.lastEvent).toBe('undo')
    }
    expect(s.undosLeft).toBe(0)
    s = reduce(s, { type: 'spin', pivot: { x: 2, y: 2 }, dir: 'cw' })
    const blocked = reduce(s, { type: 'undo' })
    expect(blocked.lastEvent).toBe('none')
    expect(blocked.undosLeft).toBe(0)

    const won = reduce(goldenState(), { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    const wonEnd = reduce(won, { type: 'spin', pivot: { x: 2, y: 4 }, dir: 'cw' })
    expect(reduce(wonEnd, { type: 'undo' }).lastEvent).toBe('none')

    const dead = reduce(goldenState(), { type: 'spin', pivot: { x: 0, y: 0 }, dir: 'cw' })
    expect(dead.dead).toBe(true)
    expect(reduce(dead, { type: 'undo' }).lastEvent).toBe('none')
  })

  it('reset reproduces the same board; new with another seed changes it', () => {
    const cfg = DIFFICULTIES.normal
    const s = createGame(cfg, 7)
    const played = reduce(s, { type: 'spin', pivot: { x: 3, y: 3 }, dir: 'cw' })
    expect(reduce(played, { type: 'reset' })).toEqual(createGame(cfg, 7))

    const fresh = reduce(s, { type: 'new', seed: 8 })
    expect(fresh.seed).toBe(8)
    expect(stateKey(fresh.motes, fresh.locked)).not.toBe(stateKey(s.motes, s.locked))
  })
})

// ---------------------------------------------------------- preview / hints

describe('preview and hasLegalMove', () => {
  it('preview is null iff won/dead/pivot off-board, and mirrors computeSpin otherwise', () => {
    const s = goldenState()
    expect(preview(s, { x: 5, y: 0 }, 'cw')).toBeNull()
    expect(preview(s, { x: -1, y: 0 }, 'cw')).toBeNull()
    for (const dir of ['cw', 'ccw'] as Dir[]) {
      for (const p of cells5) {
        expect(preview(s, p, dir)).toEqual(computeSpin(s, p, dir))
      }
    }
    const clone = JSON.parse(JSON.stringify(s)) as PinwheelState
    preview(s, { x: 2, y: 3 }, 'cw')
    expect(JSON.parse(JSON.stringify(s))).toEqual(clone)

    const dead = reduce(s, { type: 'spin', pivot: { x: 0, y: 0 }, dir: 'cw' })
    expect(preview(dead, { x: 2, y: 2 }, 'cw')).toBeNull()

    let won = reduce(s, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    won = reduce(won, { type: 'spin', pivot: { x: 2, y: 4 }, dir: 'cw' })
    expect(won.won).toBe(true)
    expect(preview(won, { x: 2, y: 2 }, 'cw')).toBeNull()
  })

  it('hasLegalMove is true on fresh boards and false once won or dead', () => {
    for (const [, cfg] of DIFFS) {
      for (const seed of SEEDS) {
        expect(hasLegalMove(createGame(cfg, seed))).toBe(true)
      }
    }
    const s = goldenState()
    const dead = reduce(s, { type: 'spin', pivot: { x: 0, y: 0 }, dir: 'cw' })
    expect(hasLegalMove(dead)).toBe(false)
    let won = reduce(s, { type: 'spin', pivot: { x: 2, y: 3 }, dir: 'cw' })
    won = reduce(won, { type: 'spin', pivot: { x: 2, y: 4 }, dir: 'cw' })
    expect(hasLegalMove(won)).toBe(false)
  })

  it('freeAnchors drops claimed anchors and preserves anchor order', () => {
    expect(freeAnchors(G_ANCHORS, [{ x: 3, y: 1 }])).toEqual([
      { x: 1, y: 1 },
      { x: 4, y: 4 },
    ])
    expect(freeAnchors(G_ANCHORS, [])).toEqual(G_ANCHORS)
  })
})
