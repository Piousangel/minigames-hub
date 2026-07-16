import { describe, expect, it } from 'vitest'
import {
  CASCADE_BASE,
  DIFFICULTIES,
  UNDO_POOL,
  WIN_BONUS,
  type DecantConfig,
  type DecantState,
  type Rng,
  type Tube,
  canPour,
  computePour,
  createGame,
  distinctLighter,
  generateTubes,
  isDeadlocked,
  isTubeSolved,
  isWon,
  mulberry32,
  reduce,
  topBand,
} from './engine'

const CFG: DecantConfig = DIFFICULTIES.normal

/** A queued-array Rng like the template's deterministic tests use. */
function queued(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

/** Hand-build a state for pour/reducer tests (bypasses generation). */
function stateWith(tubes: Tube[], overrides: Partial<DecantState> = {}): DecantState {
  return {
    config: { ...CFG, colors: 3, extraTubes: 1, scramble: 1 },
    seed: 1,
    tubes: tubes.map((t) => t.slice()),
    selection: null,
    pours: 0,
    par: 1,
    score: 0,
    cascadeStreak: 0,
    deepestCascade: 0,
    undoStack: [],
    undosLeft: UNDO_POOL,
    won: false,
    lastEvent: 'none',
    lastPour: null,
    ...overrides,
  }
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
    for (const v of seqA) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of seqA) expect(v).toBeLessThan(1)
  })

  it('diverges across different seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)())
  })
})

describe('primitives', () => {
  it('topBand handles empty, monochrome, mixed', () => {
    expect(topBand([])).toBeNull()
    expect(topBand([3, 3, 3])).toEqual({ color: 3, count: 3 })
    expect(topBand([5, 3, 2, 1])).toEqual({ color: 1, count: 1 })
    expect(topBand([4, 2, 2])).toEqual({ color: 2, count: 2 })
  })

  it('isTubeSolved / isWon', () => {
    expect(isTubeSolved([])).toBe(true)
    expect(isTubeSolved([2, 2, 2])).toBe(true)
    expect(isTubeSolved([3, 2])).toBe(false)
    expect(isWon([[1, 1], [2, 2], []])).toBe(true)
    expect(isWon([[2, 1], [2], []])).toBe(false)
  })

  it('distinctLighter counts distinct lighter colors', () => {
    expect(distinctLighter([5, 3, 2, 1], 4)).toBe(3)
    expect(distinctLighter([5, 5], 4)).toBe(0)
    expect(distinctLighter([3, 2, 2, 1], 2)).toBe(1)
  })
})

describe('computePour', () => {
  it('partial sink lands at density layer with cascadeDepth', () => {
    // src top band = [3]; dst = [5,2,1]. below=[5], same=[], above=[2,1]
    const out = computePour([[5, 2, 1], [3]], 1, 0, CFG)!
    expect(out).not.toBeNull()
    expect(out.tubes[0]).toEqual([5, 3, 2, 1])
    expect(out.tubes[1]).toEqual([])
    expect(out.landedIndex).toBe(1)
    expect(out.cascadeDepth).toBe(2)
    expect(out.merged).toBe(false)
    expect(out.burped).toBe(false)
  })

  it('merge: existing equal band absorbs the pour', () => {
    // src top = [3]; dst = [3,2]. below=[], same=[3], above=[2] -> [3,3,2]
    const out = computePour([[3, 2], [3]], 1, 0, CFG)!
    expect(out.tubes[0]).toEqual([3, 3, 2])
    expect(out.merged).toBe(true)
    expect(out.landedIndex).toBe(0)
  })

  it('burp: densest band drops to the bottom, lifting all lighter', () => {
    // src top = [5]; dst = [3,2,1]. below=[], same=[], above=[3,2,1] -> [5,3,2,1]
    const out = computePour([[3, 2, 1], [5]], 1, 0, CFG)!
    expect(out.tubes[0]).toEqual([5, 3, 2, 1])
    expect(out.landedIndex).toBe(0)
    expect(out.burped).toBe(true)
    expect(out.cascadeDepth).toBe(3)
  })

  it('overflow returns null', () => {
    // dst has 4 (full at CAP=4), pouring 1 overflows
    const out = computePour([[4, 3, 2, 1], [2]], 1, 0, CFG)
    expect(out).toBeNull()
  })

  it('same-tube and empty-source return null', () => {
    expect(computePour([[3]], 0, 0, CFG)).toBeNull()
    expect(computePour([[], [3]], 0, 1, CFG)).toBeNull()
  })

  it('moves a multi-unit band all-or-nothing', () => {
    // src top band = [2,2]; dst = [4]. below=[4], above=[] -> [4,2,2]
    const out = computePour([[4], [4, 2, 2]], 1, 0, CFG)!
    expect(out.count).toBe(2)
    expect(out.tubes[0]).toEqual([4, 2, 2])
    expect(out.tubes[1]).toEqual([4])
  })
})

describe('sorted invariant preserved by computePour', () => {
  function sorted(t: Tube): boolean {
    for (let i = 0; i + 1 < t.length; i++) if (t[i] < t[i + 1]) return false
    return true
  }
  it('holds for every legal pour over an enumerated board', () => {
    const boards: Tube[][] = [
      [[5, 3, 2], [4, 1], [2], []],
      [[6, 6, 4], [5, 2], [3, 3], [1]],
      [[4, 4, 4], [3], [2, 1], []],
    ]
    for (const tubes of boards) {
      for (let s = 0; s < tubes.length; s++) {
        for (let d = 0; d < tubes.length; d++) {
          const out = computePour(tubes, s, d, CFG)
          if (!out) continue
          for (const t of out.tubes) expect(sorted(t)).toBe(true)
          // unit conservation
          const before = tubes.reduce((a, t) => a + t.length, 0)
          const after = out.tubes.reduce((a, t) => a + t.length, 0)
          expect(after).toBe(before)
        }
      }
    }
  })
})

describe('reduce — two-tap flows', () => {
  it('select then pour applies a move', () => {
    let s = stateWith([[5, 2, 1], [3], []])
    s = reduce(s, { type: 'select', tube: 1 })
    expect(s.selection).toBe(1)
    expect(s.lastEvent).toBe('select')
    s = reduce(s, { type: 'select', tube: 0 })
    expect(s.tubes[0]).toEqual([5, 3, 2, 1])
    expect(s.selection).toBeNull()
    expect(s.pours).toBe(1)
    expect(s.lastEvent).toBe('cascade') // cascadeDepth 2
  })

  it('re-tapping the selected tube deselects', () => {
    let s = stateWith([[3, 2], [1], []])
    s = reduce(s, { type: 'select', tube: 0 })
    s = reduce(s, { type: 'select', tube: 0 })
    expect(s.selection).toBeNull()
    expect(s.lastEvent).toBe('deselect')
  })

  it('selecting an empty tube as source is a no-op', () => {
    const s0 = stateWith([[3], []])
    const s = reduce(s0, { type: 'select', tube: 1 })
    expect(s.selection).toBeNull()
    expect(s.lastEvent).toBe('none')
  })

  it('illegal overflow pour clears selection and leaves board unchanged', () => {
    let s = stateWith([[4, 3, 2, 1], [1], []])
    s = reduce(s, { type: 'select', tube: 1 })
    const before = s.tubes.map((t) => t.slice())
    s = reduce(s, { type: 'select', tube: 0 })
    expect(s.lastEvent).toBe('illegal')
    expect(s.selection).toBeNull()
    expect(s.tubes).toEqual(before)
  })

  it('plain move emits move, merge emits merge', () => {
    // move into empty (no cascade, no merge); a mixed tube keeps it unsolved
    let s = stateWith([[2, 2], [], [4, 1]])
    s = reduce(s, { type: 'select', tube: 0 })
    s = reduce(s, { type: 'select', tube: 1 })
    expect(s.lastEvent).toBe('move')
    // merge
    let m = stateWith([[3, 2], [3], []])
    m = reduce(m, { type: 'select', tube: 1 })
    m = reduce(m, { type: 'select', tube: 0 })
    expect(m.lastEvent).toBe('merge')
    expect(m.tubes[0]).toEqual([3, 3, 2])
  })
})

describe('reduce — cascade scoring', () => {
  it('escalates streak and resets on a non-cascade pour', () => {
    // Two consecutive cascades then a plain move. capacity 6 leaves room to
    // stack a second dense band on top of the first cascade's result.
    let s = stateWith([[5, 2, 1], [3], [4], []], {
      par: 5,
      config: { ...CFG, colors: 5, extraTubes: 1, capacity: 6 },
    })
    // pour [3] onto [5,2,1] -> cascadeDepth 2, streak 1, bonus 25*(2-1)*1 = 25
    s = reduce(s, { type: 'select', tube: 1 })
    s = reduce(s, { type: 'select', tube: 0 })
    expect(s.cascadeStreak).toBe(1)
    expect(s.score).toBe(CASCADE_BASE * 1 * 1)
    // now tubes: [5,3,2,1],[],[4],[]. pour [4] onto [5,3,2,1] -> below=[5], above=[3,2,1] depth 3
    s = reduce(s, { type: 'select', tube: 2 })
    s = reduce(s, { type: 'select', tube: 0 })
    expect(s.cascadeStreak).toBe(2)
    expect(s.deepestCascade).toBe(3)
    // bonus this pour = 25*(3-1)*2 = 100; running = 25 + 100 = 125
    expect(s.score).toBe(25 + 100)
    // a plain relocation resets the streak: move top band [1] onto empty tube 1
    s = reduce(s, { type: 'select', tube: 0 })
    s = reduce(s, { type: 'select', tube: 1 })
    expect(s.lastEvent).toBe('move')
    expect(s.cascadeStreak).toBe(0)
  })
})

describe('reduce — undo', () => {
  it('restores prior snapshot and decrements undosLeft', () => {
    let s = stateWith([[5, 2, 1], [3], []])
    const before = s.tubes.map((t) => t.slice())
    s = reduce(s, { type: 'select', tube: 1 })
    s = reduce(s, { type: 'select', tube: 0 })
    expect(s.pours).toBe(1)
    s = reduce(s, { type: 'undo' })
    expect(s.tubes).toEqual(before)
    expect(s.pours).toBe(0)
    expect(s.undosLeft).toBe(UNDO_POOL - 1)
    expect(s.lastEvent).toBe('undo')
  })

  it('is a no-op with an empty stack', () => {
    const s = reduce(stateWith([[3], []]), { type: 'undo' })
    expect(s.lastEvent).toBe('none')
    expect(s.undosLeft).toBe(UNDO_POOL)
  })

  it('caps the undo stack at UNDO_POOL snapshots', () => {
    // Six shuffling relocations; stack should not exceed UNDO_POOL.
    let s = stateWith([[1], [], [], [], [], [], []], { config: { ...CFG, colors: 1, extraTubes: 6 } })
    // relocate the single [1] band back and forth a bunch
    let from = 0
    let to = 1
    for (let i = 0; i < UNDO_POOL + 3; i++) {
      s = reduce(s, { type: 'select', tube: from })
      s = reduce(s, { type: 'select', tube: to })
      const t = from
      from = to
      to = t
    }
    expect(s.undoStack.length).toBeLessThanOrEqual(UNDO_POOL)
  })
})

describe('reduce — win + reset', () => {
  it('awards WIN_BONUS when the last pour solves the board', () => {
    // One pour from tube1 completes color 2 in tube0.
    let s = stateWith([[2, 2, 2], [2], []], {
      config: { ...CFG, colors: 1, extraTubes: 2, capacity: 4 },
      par: 1,
    })
    s = reduce(s, { type: 'select', tube: 1 })
    s = reduce(s, { type: 'select', tube: 0 })
    expect(s.won).toBe(true)
    expect(s.lastEvent).toBe('win')
    expect(s.score).toBeGreaterThanOrEqual(WIN_BONUS)
  })

  it('blocks undo and selection after win', () => {
    let s = stateWith([[2, 2, 2], [2], []], {
      config: { ...CFG, colors: 1, extraTubes: 2, capacity: 4 },
      par: 1,
    })
    s = reduce(s, { type: 'select', tube: 1 })
    s = reduce(s, { type: 'select', tube: 0 })
    const won = s
    s = reduce(s, { type: 'undo' })
    expect(s.tubes).toEqual(won.tubes)
    expect(s.lastEvent).toBe('none')
    s = reduce(s, { type: 'select', tube: 0 })
    expect(s.lastEvent).toBe('none')
  })

  it('reset reproduces the exact board from the seed', () => {
    const g = createGame(CFG, 4242)
    let s = reduce(g, { type: 'select', tube: 0 })
    s = reduce(s, { type: 'select', tube: g.tubes.length - 1 })
    s = reduce(s, { type: 'reset' })
    expect(s.tubes).toEqual(g.tubes)
    expect(s.par).toBe(g.par)
    expect(s.undosLeft).toBe(UNDO_POOL)
  })
})

describe('generateTubes / createGame', () => {
  function sorted(t: Tube): boolean {
    for (let i = 0; i + 1 < t.length; i++) if (t[i] < t[i + 1]) return false
    return true
  }

  it('produces sorted tubes with conserved unit counts', () => {
    const { tubes, par } = generateTubes(CFG, mulberry32(999))
    expect(par).toBeGreaterThanOrEqual(1)
    for (const t of tubes) expect(sorted(t)).toBe(true)
    const counts = new Map<number, number>()
    for (const t of tubes) for (const c of t) counts.set(c, (counts.get(c) ?? 0) + 1)
    for (let k = 1; k <= CFG.colors; k++) expect(counts.get(k)).toBe(CFG.capacity)
    expect(tubes.length).toBe(CFG.colors + CFG.extraTubes)
  })

  it('createGame never returns an already-won board', () => {
    for (const seed of [1, 2, 3, 100, 12345, 88888]) {
      expect(isWon(createGame(CFG, seed).tubes)).toBe(false)
    }
  })

  it('is deterministic: same seed => identical board', () => {
    expect(createGame(CFG, 777).tubes).toEqual(createGame(CFG, 777).tubes)
  })
})

describe('isDeadlocked', () => {
  it('is false while any legal pour exists', () => {
    expect(isDeadlocked(stateWith([[3, 2, 1], [4], []]))).toBe(false)
  })

  it('is false on a won board (win is not a deadlock)', () => {
    expect(isDeadlocked(stateWith([[2, 2]], { won: true }))).toBe(false)
  })
})

describe('snapshot: seeded createGame', () => {
  it('matches a stable golden board', () => {
    const g = createGame(DIFFICULTIES.normal, 12345)
    expect(g.tubes).toMatchSnapshot()
    expect(g.par).toMatchSnapshot()
  })

  it('a scripted pour sequence lands on a stable final state', () => {
    let s = stateWith([[5, 2, 1], [3], [4], []], { par: 3 })
    s = reduce(s, { type: 'select', tube: 1 })
    s = reduce(s, { type: 'select', tube: 0 })
    s = reduce(s, { type: 'select', tube: 2 })
    s = reduce(s, { type: 'select', tube: 0 })
    expect({ tubes: s.tubes, score: s.score, pours: s.pours }).toMatchSnapshot()
  })
})

describe('canPour predicate', () => {
  it('respects range, room, emptiness, won', () => {
    const s = stateWith([[3, 2], [1], []])
    expect(canPour(s, 0, 1)).toBe(true) // band [2] fits onto [1]
    expect(canPour(s, 2, 0)).toBe(false) // empty source
    expect(canPour(s, 0, 5)).toBe(false) // out of range
    expect(canPour({ ...s, won: true }, 0, 1)).toBe(false)
  })
})

it('queued rng helper picks candidates deterministically', () => {
  // Sanity: generateTubes with a constant rng still yields a solvable-shaped board.
  const { tubes } = generateTubes(DIFFICULTIES.easy, queued([0]))
  expect(tubes.length).toBe(DIFFICULTIES.easy.colors + DIFFICULTIES.easy.extraTubes)
})
