import { describe, expect, it } from 'vitest'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  allAtomsHittable,
  MAX_STEPS_MULT,
  PAR_BONUS_MAX,
  WIN_BONUS,
  cellToExitPort,
  createGame,
  hasAtomAt,
  inBounds,
  key,
  mulberry32,
  placeAtoms,
  portToStart,
  reduce,
  simulateShot,
  turnLeft,
  turnRight,
  type Coord,
  type Port,
  type PrismboxConfig,
  type PrismboxState,
  type ShotRecord,
} from './engine'

const CFG: PrismboxConfig = { size: 8, atoms: 1, parPerAtom: 4 }
const CFG2: PrismboxConfig = { size: 8, atoms: 2, parPerAtom: 4 }

/** Hand-build a state for reducer tests (bypasses placeAtoms). */
function stateWith(atoms: Coord[], overrides: Partial<PrismboxState> = {}): PrismboxState {
  return {
    config: atoms.length === 1 ? CFG : CFG2,
    seed: 1,
    atoms,
    found: atoms.map(() => false),
    shots: [],
    score: 0,
    par: 4,
    won: false,
    lastEvent: 'none',
    lastShot: null,
    ...overrides,
  }
}

const DIRS4 = [
  { dr: 1, dc: 0 },
  { dr: -1, dc: 0 },
  { dr: 0, dc: 1 },
  { dr: 0, dc: -1 },
]

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})

describe('A. geometry primitives', () => {
  it('1: turnLeft/turnRight are mutual inverses on all 4 cardinal directions', () => {
    for (const d of DIRS4) {
      const l = turnLeft(d.dr, d.dc)
      expect(turnRight(l.dr, l.dc)).toEqual(d)
      const r = turnRight(d.dr, d.dc)
      expect(turnLeft(r.dr, r.dc)).toEqual(d)
    }
  })

  it('2: turnLeft applied 4 times returns the original vector', () => {
    for (const d of DIRS4) {
      let v = { dr: d.dr, dc: d.dc }
      for (let i = 0; i < 4; i++) v = turnLeft(v.dr, v.dc)
      expect(v).toEqual(d)
    }
  })

  it('3: portToStart gives correct start/direction on all 4 edges, size=8', () => {
    const size = 8
    expect(portToStart({ edge: 'N', lane: 0 }, size)).toEqual({ r: 0, c: 0, dr: 1, dc: 0 })
    expect(portToStart({ edge: 'N', lane: 7 }, size)).toEqual({ r: 0, c: 7, dr: 1, dc: 0 })
    expect(portToStart({ edge: 'S', lane: 0 }, size)).toEqual({ r: 7, c: 0, dr: -1, dc: 0 })
    expect(portToStart({ edge: 'S', lane: 7 }, size)).toEqual({ r: 7, c: 7, dr: -1, dc: 0 })
    expect(portToStart({ edge: 'W', lane: 0 }, size)).toEqual({ r: 0, c: 0, dr: 0, dc: 1 })
    expect(portToStart({ edge: 'W', lane: 7 }, size)).toEqual({ r: 7, c: 0, dr: 0, dc: 1 })
    expect(portToStart({ edge: 'E', lane: 0 }, size)).toEqual({ r: 0, c: 7, dr: 0, dc: -1 })
    expect(portToStart({ edge: 'E', lane: 7 }, size)).toEqual({ r: 7, c: 7, dr: 0, dc: -1 })
    // every start is in-bounds, direction is a cardinal unit vector
    for (const edge of ['N', 'S', 'E', 'W'] as const) {
      for (let lane = 0; lane < size; lane++) {
        const s = portToStart({ edge, lane }, size)
        expect(inBounds(s.r, s.c, size)).toBe(true)
        expect(Math.abs(s.dr) + Math.abs(s.dc)).toBe(1)
      }
    }
  })

  it('4: cellToExitPort <-> portToStart round-trip over all 4*size ports, size=5', () => {
    const size = 5
    for (const edge of ['N', 'S', 'E', 'W'] as const) {
      for (let lane = 0; lane < size; lane++) {
        const p: Port = { edge, lane }
        const s = portToStart(p, size)
        // Model "one more step outward" from the entry cell -- this leaves the
        // grid through the very same port. cellToExitPort must recover it.
        const exitR = s.r - s.dr
        const exitC = s.c - s.dc
        const recovered = cellToExitPort(exitR, exitC, -s.dr, -s.dc, size)
        expect(recovered).toEqual(p)
      }
    }
  })

  it('5: hasAtomAt is always false for out-of-range coordinates', () => {
    const atomKeys = new Set([key(2, 2), key(0, 0)])
    const size = 8
    expect(hasAtomAt(atomKeys, -1, 3, size)).toBe(false)
    expect(hasAtomAt(atomKeys, 3, -1, size)).toBe(false)
    expect(hasAtomAt(atomKeys, 8, 3, size)).toBe(false)
    expect(hasAtomAt(atomKeys, 3, 8, size)).toBe(false)
    expect(hasAtomAt(atomKeys, -100, 999, size)).toBe(false)
    // sanity: in-range hit still works
    expect(hasAtomAt(atomKeys, 2, 2, size)).toBe(true)
  })
})

describe('B. simulateShot golden scenarios (size=8 unless noted)', () => {
  it('6: empty board through, N lane=4', () => {
    const r = simulateShot([], { edge: 'N', lane: 4 }, 8)
    expect(r.event).toBe('through')
    expect(r.exit).toEqual({ edge: 'S', lane: 4 })
    expect(r.path).toHaveLength(8)
    expect(r.path.every((p) => p.c === 4)).toBe(true)
    expect(r.turns).toEqual([])
    expect(r.hitAtom).toBeNull()
  })

  it('7: direct hit on the straight path', () => {
    const r = simulateShot([{ r: 3, c: 4 }], { edge: 'N', lane: 4 }, 8)
    expect(r.event).toBe('hit')
    expect(r.hitAtom).toEqual({ r: 3, c: 4 })
    expect(r.path).toEqual([])
    expect(r.turns).toEqual([])
    expect(r.exit).toBeNull()
  })

  it('8: atom on the left only -> refract via a right turn', () => {
    // At (3,4) facing down (1,0): turnLeft offset = (0,1) -> (3,5).
    const r = simulateShot([{ r: 3, c: 5 }], { edge: 'N', lane: 4 }, 8)
    expect(r.event).toBe('refract')
    expect(r.turns).toEqual([{ r: 3, c: 4 }])
    // Turning right from (1,0) gives (0,-1) -- the very next path cell after
    // the turn point must be one step west.
    const turnIdx = r.path.findIndex((p) => p.r === 3 && p.c === 4)
    expect(r.path[turnIdx + 1]).toEqual({ r: 3, c: 3 })
    expect(r.exit).toEqual({ edge: 'W', lane: 3 })
  })

  it('9: mirror of 8 -- atom on the right only -> refract via a left turn', () => {
    // turnRight offset at (3,4) facing down = (0,-1) -> (3,3).
    const r = simulateShot([{ r: 3, c: 3 }], { edge: 'N', lane: 4 }, 8)
    expect(r.event).toBe('refract')
    expect(r.turns).toEqual([{ r: 3, c: 4 }])
    const turnIdx = r.path.findIndex((p) => p.r === 3 && p.c === 4)
    expect(r.path[turnIdx + 1]).toEqual({ r: 3, c: 5 })
    expect(r.exit).toEqual({ edge: 'E', lane: 3 })
  })

  it('10: atoms on both sides mid-path -> reflect', () => {
    const r = simulateShot(
      [
        { r: 3, c: 5 },
        { r: 3, c: 3 },
      ],
      { edge: 'N', lane: 4 },
      8,
    )
    expect(r.event).toBe('reflect')
    expect(r.exit).toEqual({ edge: 'N', lane: 4 })
    expect(r.path).toEqual([])
    expect(r.turns).toEqual([])
    expect(r.hitAtom).toBeNull()
  })

  it('11: atoms on both sides of the very first interior cell -> reflect, empty path regardless', () => {
    const r = simulateShot(
      [
        { r: 0, c: 5 },
        { r: 0, c: 3 },
      ],
      { edge: 'N', lane: 4 },
      8,
    )
    expect(r.event).toBe('reflect')
    expect(r.exit).toEqual({ edge: 'N', lane: 4 })
    expect(r.path).toEqual([])
  })

  it('12: two turns produce a refract with turns.length===2 and the hand-computed exit', () => {
    const atoms: Coord[] = [
      { r: 1, c: 1 },
      { r: 2, c: 5 },
    ]
    const r = simulateShot(atoms, { edge: 'N', lane: 4 }, 8)
    expect(r.event).toBe('refract')
    expect(r.turns).toHaveLength(2)
    expect(r.turns).toEqual([
      { r: 2, c: 4 },
      { r: 2, c: 1 },
    ])
    expect(r.exit).toEqual({ edge: 'S', lane: 1 })
  })

  it('13: corner lanes N,0 and N,size-1 on an empty board never crash and go through', () => {
    const size = 8
    const r0 = simulateShot([], { edge: 'N', lane: 0 }, size)
    expect(r0.event).toBe('through')
    expect(r0.exit).toEqual({ edge: 'S', lane: 0 })
    const rLast = simulateShot([], { edge: 'N', lane: size - 1 }, size)
    expect(rLast.event).toBe('through')
    expect(rLast.exit).toEqual({ edge: 'S', lane: size - 1 })
  })

  it('14: an atom at chebyshev distance exactly 2 from the path has no effect', () => {
    const r = simulateShot([{ r: 3, c: 6 }], { edge: 'N', lane: 4 }, 8)
    expect(r.event).toBe('through')
    expect(r.exit).toEqual({ edge: 'S', lane: 4 })
  })

  it('15: the same setup at distance 1 flips the outcome to refract', () => {
    const r = simulateShot([{ r: 3, c: 5 }], { edge: 'N', lane: 4 }, 8)
    expect(r.event).toBe('refract')
  })

  it('16: trapped safety net -- a hand-built adjacent pair loops forever within MAX_STEPS', () => {
    const size = 3
    const atoms: Coord[] = [
      { r: 0, c: 0 },
      { r: 1, c: 1 },
    ]
    const r = simulateShot(atoms, { edge: 'N', lane: 0 }, size)
    expect(r.event).toBe('trapped')
    expect(r.exit).toBeNull()
    expect(r.path).toEqual([])
    expect(r.turns).toEqual([])
    expect(r.hitAtom).toBeNull()
    // the loop must actually be bounded by MAX_STEPS, not an accidental crash
    expect(MAX_STEPS_MULT * size * size).toBe(36)
  })
})

describe('C. placeAtoms / createGame', () => {
  it('17: createGame(DAILY_CONFIG, 12345) is a stable golden board', () => {
    const g1 = createGame(DAILY_CONFIG, 12345)
    const g2 = createGame(DAILY_CONFIG, 12345)
    expect(g1.atoms).toEqual(g2.atoms)
    expect(g1.atoms).toEqual([
      { r: 6, c: 2 },
      { r: 3, c: 5 },
      { r: 4, c: 3 },
      { r: 1, c: 5 },
    ])
    expect(g1.par).toBe(16)
  })

  it('18: property test over seeds 0..49 -- bounds, spacing, cardinality', () => {
    for (let seed = 0; seed < 50; seed++) {
      const atoms = placeAtoms(DAILY_CONFIG, mulberry32(seed))
      expect(atoms).toHaveLength(DAILY_CONFIG.atoms)
      const seen = new Set<string>()
      for (const a of atoms) {
        expect(a.r).toBeGreaterThanOrEqual(1)
        expect(a.r).toBeLessThanOrEqual(DAILY_CONFIG.size - 2)
        expect(a.c).toBeGreaterThanOrEqual(1)
        expect(a.c).toBeLessThanOrEqual(DAILY_CONFIG.size - 2)
        const k = key(a.r, a.c)
        expect(seen.has(k)).toBe(false)
        seen.add(k)
      }
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const d = Math.max(Math.abs(atoms[i].r - atoms[j].r), Math.abs(atoms[i].c - atoms[j].c))
          expect(d).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it('19: seed 1 and seed 2 produce different atom sets', () => {
    const a1 = placeAtoms(DAILY_CONFIG, mulberry32(1))
    const a2 = placeAtoms(DAILY_CONFIG, mulberry32(2))
    expect(a1).not.toEqual(a2)
  })
})

describe('D. reducer / scoring', () => {
  it('20: single-atom board -- hit wins immediately with full bonuses', () => {
    let s = stateWith([{ r: 3, c: 4 }])
    s = reduce(s, { type: 'fire', entry: { edge: 'N', lane: 4 } })
    expect(s.found).toEqual([true])
    expect(s.won).toBe(true)
    expect(s.lastEvent).toBe('win')
    expect(s.score).toBe(100 + WIN_BONUS + PAR_BONUS_MAX)
  })

  it('21: a through shot leaves the board untouched', () => {
    let s = stateWith([{ r: 3, c: 4 }])
    s = reduce(s, { type: 'fire', entry: { edge: 'N', lane: 0 } })
    expect(s.found).toEqual([false])
    expect(s.score).toBe(0)
    expect(s.won).toBe(false)
    expect(s.lastEvent).toBe('fire-through')
  })

  it('22: hitting an already-found atom is a no-score no-op event', () => {
    let s = stateWith([
      { r: 3, c: 4 },
      { r: 5, c: 2 },
    ])
    s = reduce(s, { type: 'fire', entry: { edge: 'N', lane: 4 } })
    expect(s.lastEvent).toBe('fire-hit')
    expect(s.score).toBe(100)
    s = reduce(s, { type: 'fire', entry: { edge: 'N', lane: 4 } })
    expect(s.lastEvent).toBe('already-found')
    expect(s.score).toBe(100)
    expect(s.shots).toHaveLength(2)
  })

  it('23: firing after a win is a no-op besides lastEvent', () => {
    let s = stateWith([{ r: 3, c: 4 }])
    s = reduce(s, { type: 'fire', entry: { edge: 'N', lane: 4 } })
    expect(s.won).toBe(true)
    const won = s
    s = reduce(s, { type: 'fire', entry: { edge: 'N', lane: 0 } })
    expect(s.lastEvent).toBe('none')
    expect(s.shots).toEqual(won.shots)
    expect(s.score).toBe(won.score)
    expect(s.found).toEqual(won.found)
  })

  it('24: out-of-range lane is a no-op', () => {
    const s0 = stateWith([{ r: 3, c: 4 }])
    const sNeg = reduce(s0, { type: 'fire', entry: { edge: 'N', lane: -1 } })
    expect(sNeg.lastEvent).toBe('none')
    expect(sNeg.shots).toEqual([])
    const sOver = reduce(s0, { type: 'fire', entry: { edge: 'N', lane: s0.config.size } })
    expect(sOver.lastEvent).toBe('none')
    expect(sOver.shots).toEqual([])
  })

  it('25: reset reproduces the exact atoms from the seed and clears progress', () => {
    const g = createGame(DIFFICULTIES.easy, 999)
    let s = reduce(g, { type: 'fire', entry: { edge: 'N', lane: 0 } })
    s = reduce(s, { type: 'reset' })
    expect(s.atoms).toEqual(g.atoms)
    expect(s.shots).toEqual([])
    expect(s.score).toBe(0)
    expect(s.found).toEqual(g.found)
  })

  it('26: new(seed) reinitializes atoms/score/won/found to match placeAtoms(seed)', () => {
    const g = createGame(DIFFICULTIES.easy, 999)
    const s = reduce(g, { type: 'new', seed: 12321 })
    expect(s.atoms).toEqual(placeAtoms(DIFFICULTIES.easy, mulberry32(12321)))
    expect(s.won).toBe(false)
    expect(s.score).toBe(0)
    expect(s.shots).toEqual([])
    expect(s.found).toEqual(Array(DIFFICULTIES.easy.atoms).fill(false))
  })

  it('27: par-bonus boundary -- exactly at par gives full bonus, 2x par gives half', () => {
    const dummy: ShotRecord = {
      seq: 0,
      entry: { edge: 'N', lane: 0 },
      event: 'through',
      exit: { edge: 'S', lane: 0 },
      path: [],
      turns: [],
      hitAtom: null,
    }
    let atPar = stateWith([{ r: 3, c: 4 }], { par: 4, shots: Array(3).fill(dummy) })
    atPar = reduce(atPar, { type: 'fire', entry: { edge: 'N', lane: 4 } })
    expect(atPar.shots).toHaveLength(4)
    expect(atPar.score).toBe(100 + WIN_BONUS + PAR_BONUS_MAX)

    let twicePar = stateWith([{ r: 3, c: 4 }], { par: 4, shots: Array(7).fill(dummy) })
    twicePar = reduce(twicePar, { type: 'fire', entry: { edge: 'N', lane: 4 } })
    expect(twicePar.shots).toHaveLength(8)
    expect(twicePar.score).toBe(100 + WIN_BONUS + Math.round(PAR_BONUS_MAX * 0.5))
  })

  it('28: two-atom board -- first hit does not win, second hit wins with bonuses added exactly once', () => {
    let s = stateWith([
      { r: 3, c: 4 },
      { r: 5, c: 2 },
    ])
    s = reduce(s, { type: 'fire', entry: { edge: 'N', lane: 4 } })
    expect(s.won).toBe(false)
    expect(s.found).toEqual([true, false])
    expect(s.score).toBe(100)

    s = reduce(s, { type: 'fire', entry: { edge: 'W', lane: 5 } })
    expect(s.won).toBe(true)
    expect(s.found).toEqual([true, true])
    // 2x hit bonus + win + par bonus (par=4, shots=2 -> full PAR_BONUS_MAX), added once.
    expect(s.score).toBe(100 * 2 + WIN_BONUS + PAR_BONUS_MAX)
  })
})

describe('layout reachability', () => {
  it('회귀: 모든 원자는 어떤 포트의 빔으로든 직접 맞힐 수 있다(hard ~1%가 클리어 불가였음)', () => {
    for (const cfg of [DIFFICULTIES.easy, DIFFICULTIES.normal, DIFFICULTIES.hard]) {
      for (let seed = 1; seed <= 3000; seed++) {
        const g = createGame(cfg, seed)
        expect(allAtomsHittable(g.atoms, cfg.size)).toBe(true)
      }
    }
  })

  it('이미 정상인 배치는 바뀌지 않는다(데일리 시드 보존)', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const original = placeAtoms(DIFFICULTIES.normal, mulberry32(seed))
      if (allAtomsHittable(original, DIFFICULTIES.normal.size)) {
        expect(createGame(DIFFICULTIES.normal, seed).atoms).toEqual(original)
      }
    }
  })
})
