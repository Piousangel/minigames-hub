import { describe, expect, it } from 'vitest'
import {
  DIFFICULTIES,
  EFF_CAP,
  PAR_BONUS_MAX,
  SIZE_UNIT,
  UNDO_POOL,
  WIN_BONUS,
  type FlapjackConfig,
  type FlapjackState,
  type Pancake,
  canFlip,
  computeScore,
  createGame,
  flip,
  generateStack,
  isSorted,
  mulberry32,
  parFlips,
  reduce,
} from './engine'

const CFG: FlapjackConfig = DIFFICULTIES.normal

/** Hand-build a state for reducer tests (bypasses generation). */
function stateWith(stack: Pancake[], overrides: Partial<FlapjackState> = {}): FlapjackState {
  return {
    config: { size: stack.length, scramble: 1 },
    seed: 1,
    stack: stack.slice(),
    flips: 0,
    par: parFlips(stack),
    score: 0,
    undoStack: [],
    undosLeft: UNDO_POOL,
    won: false,
    lastEvent: 'none',
    lastFlipK: null,
    ...overrides,
  }
}

/** Replay the greedy par sequence, returning it. */
function parSequence(stack: Pancake[]): number[] {
  const n = stack.length
  let s = stack.slice()
  const seq: number[] = []
  for (let target = n; target >= 2; target--) {
    const idx = s.indexOf(target)
    if (idx === target - 1) continue
    if (idx !== 0) {
      s = flip(s, idx + 1)
      seq.push(idx + 1)
    }
    s = flip(s, target)
    seq.push(target)
  }
  return seq
}

describe('flip / isSorted', () => {
  it('1. flips the top-k prefix in place', () => {
    expect(flip([1, 2, 3, 4, 5], 3)).toEqual([3, 2, 1, 4, 5])
  })

  it('2. k<=1 is a no-op copy', () => {
    const s = [3, 1, 2]
    expect(flip(s, 1)).toEqual(s)
    expect(flip(s, 0)).toEqual(s)
  })

  it('3. k=n reverses the whole stack', () => {
    expect(flip([1, 2, 3, 4, 5], 5)).toEqual([5, 4, 3, 2, 1])
  })

  it('4. flip is an involution for any k', () => {
    const s = [4, 2, 5, 1, 3]
    for (let k = 0; k <= 5; k++) {
      expect(flip(flip(s, k), k)).toEqual(s)
    }
  })

  it('5. never mutates its input', () => {
    const s = [3, 1, 2]
    const copy = s.slice()
    flip(s, 3)
    expect(s).toEqual(copy)
  })

  it('6. isSorted only for [1..n]; length 0/1 sorted', () => {
    expect(isSorted([1, 2, 3, 4, 5])).toBe(true)
    expect(isSorted([2, 1, 3, 4, 5])).toBe(false)
    expect(isSorted([5, 4, 3, 2, 1])).toBe(false)
    expect(isSorted([])).toBe(true)
    expect(isSorted([1])).toBe(true)
  })
})

describe('generateStack + Rng determinism', () => {
  it('7. same seed => identical stack', () => {
    expect(generateStack(CFG, mulberry32(42))).toEqual(generateStack(CFG, mulberry32(42)))
  })

  it('8. always a permutation of 1..n', () => {
    for (const cfg of Object.values(DIFFICULTIES)) {
      for (const seed of [0, 1, 7, 55, 999]) {
        const s = generateStack(cfg, mulberry32(seed))
        expect(s.length).toBe(cfg.size)
        expect([...s].sort((a, b) => a - b)).toEqual(
          Array.from({ length: cfg.size }, (_, i) => i + 1),
        )
      }
    }
  })

  it('9. never returns an already-sorted stack (seeds 0..200)', () => {
    for (let seed = 0; seed <= 200; seed++) {
      for (const cfg of Object.values(DIFFICULTIES)) {
        expect(isSorted(generateStack(cfg, mulberry32(seed)))).toBe(false)
      }
    }
  })

  it('10. golden: normal seed=1 stack is pinned', () => {
    expect(createGame(DIFFICULTIES.normal, 1).stack).toEqual([6, 3, 2, 4, 7, 5, 1])
  })
})

describe('parFlips', () => {
  it('11. sorted stack has par 0', () => {
    expect(parFlips([1, 2, 3, 4])).toBe(0)
  })

  it('12. never mutates its input', () => {
    const s = [3, 1, 4, 2]
    const copy = s.slice()
    parFlips(s)
    expect(s).toEqual(copy)
  })

  it('13. replaying the par sequence actually sorts the stack', () => {
    const perms: Pancake[][] = [
      [3, 1, 4, 2],
      [6, 3, 2, 4, 7, 5, 1],
      [5, 4, 3, 2, 1],
      [2, 5, 1, 4, 3],
    ]
    for (const p of perms) {
      let s = p.slice()
      const seq = parSequence(p)
      for (const k of seq) s = flip(s, k)
      expect(isSorted(s)).toBe(true)
      expect(seq.length).toBe(parFlips(p))
    }
  })

  it('14. par is bounded by 2*(n-1)', () => {
    for (const seed of [0, 3, 17, 88, 250]) {
      for (const cfg of Object.values(DIFFICULTIES)) {
        const s = generateStack(cfg, mulberry32(seed))
        expect(parFlips(s)).toBeLessThanOrEqual(2 * (cfg.size - 1))
      }
    }
  })

  it('15. golden hand-computed cases', () => {
    expect(parFlips([3, 1, 4, 2])).toBe(4)
    expect(parFlips([2, 3, 1])).toBe(2)
  })
})

describe('computeScore', () => {
  it('16. flips===par gives base + size + full par bonus', () => {
    expect(computeScore(7, 10, 10)).toBe(WIN_BONUS + SIZE_UNIT * 7 + PAR_BONUS_MAX)
  })

  it('17. beating par raises score, saturating at EFF_CAP', () => {
    const atPar = computeScore(7, 10, 10)
    const better = computeScore(7, 10, 6)
    expect(better).toBeGreaterThan(atPar)
    // par/flips >= EFF_CAP saturates: flips = par/EFF_CAP and anything smaller equal
    const sat = computeScore(7, 10, 5) // 10/5 = 2 = EFF_CAP
    const beyond = computeScore(7, 10, 2) // 10/2 = 5, clamped to 2
    expect(sat).toBe(beyond)
    expect(sat).toBe(WIN_BONUS + SIZE_UNIT * 7 + PAR_BONUS_MAX * EFF_CAP)
  })

  it('18. more flips than par is lower but never below base+size', () => {
    const atPar = computeScore(7, 10, 10)
    const worse = computeScore(7, 10, 20)
    expect(worse).toBeLessThan(atPar)
    expect(worse).toBeGreaterThanOrEqual(WIN_BONUS + SIZE_UNIT * 7)
  })
})

describe('createGame / reduce', () => {
  it('19. createGame initializes cleanly with par===parFlips(stack)', () => {
    const g = createGame(CFG, 4242)
    expect(g.flips).toBe(0)
    expect(g.score).toBe(0)
    expect(g.won).toBe(false)
    expect(g.undosLeft).toBe(UNDO_POOL)
    expect(g.undoStack).toEqual([])
    expect(g.par).toBe(parFlips(g.stack))
  })

  it('20. valid flip: flips+1, stack flipped, lastFlipK/event set', () => {
    const s0 = stateWith([3, 1, 2, 4, 5])
    const s = reduce(s0, { type: 'flip', k: 3 })
    expect(s.flips).toBe(1)
    expect(s.stack).toEqual(flip(s0.stack, 3))
    expect(s.lastFlipK).toBe(3)
    expect(s.lastEvent).toBe('flip')
  })

  it('21. flip k=1 is a free no-op (event none, unchanged)', () => {
    const s0 = stateWith([3, 1, 2, 4, 5])
    const s = reduce(s0, { type: 'flip', k: 1 })
    expect(s.lastEvent).toBe('none')
    expect(s.flips).toBe(0)
    expect(s.stack).toEqual(s0.stack)
  })

  it('22. flip k>n is illegal and leaves state unchanged', () => {
    const s0 = stateWith([3, 1, 2, 4, 5])
    const s = reduce(s0, { type: 'flip', k: 9 })
    expect(s.lastEvent).toBe('illegal')
    expect(s.flips).toBe(0)
    expect(s.stack).toEqual(s0.stack)
  })

  it('23. golden win scenario: [2,3,1] solved in 2 flips', () => {
    const base = stateWith([2, 3, 1])
    let s = reduce(base, { type: 'flip', k: 2 }) // [3,2,1]
    expect(s.stack).toEqual([3, 2, 1])
    expect(s.won).toBe(false)
    s = reduce(s, { type: 'flip', k: 3 }) // [1,2,3]
    expect(s.stack).toEqual([1, 2, 3])
    expect(s.won).toBe(true)
    expect(s.lastEvent).toBe('win')
    expect(s.flips).toBe(2)
    expect(s.score).toBe(computeScore(3, base.par, 2))
  })

  it('24. golden par-play: replay par sequence => win with flips===par', () => {
    const g = createGame(DIFFICULTIES.normal, 1)
    const seq = parSequence(g.stack)
    let s = g
    for (const k of seq) s = reduce(s, { type: 'flip', k })
    expect(s.won).toBe(true)
    expect(s.flips).toBe(g.par)
    expect(s.score).toBe(computeScore(g.config.size, g.par, g.par))
  })

  it('25. flips/undos after win are locked out', () => {
    const won = reduce(reduce(stateWith([2, 3, 1]), { type: 'flip', k: 2 }), { type: 'flip', k: 3 })
    expect(won.won).toBe(true)
    const afterFlip = reduce(won, { type: 'flip', k: 2 })
    expect(afterFlip.stack).toEqual(won.stack)
    expect(afterFlip.flips).toBe(won.flips)
    expect(afterFlip.lastEvent).toBe('none')
    const afterUndo = reduce(won, { type: 'undo' })
    expect(afterUndo.stack).toEqual(won.stack)
    expect(afterUndo.lastEvent).toBe('none')
  })

  it('26. undo restores prior stack/flips and decrements undosLeft', () => {
    const s0 = stateWith([3, 1, 2, 4, 5])
    const s1 = reduce(s0, { type: 'flip', k: 3 })
    expect(s1.flips).toBe(1)
    const s2 = reduce(s1, { type: 'undo' })
    expect(s2.stack).toEqual(s0.stack)
    expect(s2.flips).toBe(0)
    expect(s2.undosLeft).toBe(UNDO_POOL - 1)
    expect(s2.lastEvent).toBe('undo')
    expect(s2.lastFlipK).toBeNull()
  })

  it('27. undo is a no-op with an empty stack or no undos left', () => {
    const empty = reduce(stateWith([3, 1, 2]), { type: 'undo' })
    expect(empty.lastEvent).toBe('none')
    expect(empty.undosLeft).toBe(UNDO_POOL)

    const s1 = reduce(stateWith([3, 1, 2]), { type: 'flip', k: 2 })
    const drained = reduce({ ...s1, undosLeft: 0 }, { type: 'undo' })
    expect(drained.lastEvent).toBe('none')
    expect(drained.stack).toEqual(s1.stack)
  })

  it('28. undoStack is capped at UNDO_POOL', () => {
    let s = stateWith([2, 4, 1, 5, 3, 6, 7])
    for (let i = 0; i < UNDO_POOL + 4; i++) {
      // alternate two harmless non-solving flips
      s = reduce(s, { type: 'flip', k: 2 })
      s = reduce(s, { type: 'flip', k: 3 })
    }
    expect(s.undoStack.length).toBeLessThanOrEqual(UNDO_POOL)
  })

  it('29. reset reproduces the initial state for the same seed', () => {
    const g = createGame(CFG, 777)
    let s = reduce(g, { type: 'flip', k: 3 })
    s = reduce(s, { type: 'flip', k: 4 })
    const back = reduce(s, { type: 'reset' })
    expect(back).toEqual(g)
  })

  it('30. new builds the board for a different seed', () => {
    const g = createGame(CFG, 1)
    const n = reduce(g, { type: 'new', seed: 2 })
    expect(n.seed).toBe(2)
    expect(n.stack).toEqual(createGame(CFG, 2).stack)
  })

  it('31. canFlip predicate respects won and k bounds', () => {
    const s = stateWith([3, 1, 2, 4, 5])
    expect(canFlip(s, 1)).toBe(false)
    expect(canFlip(s, 2)).toBe(true)
    expect(canFlip(s, 5)).toBe(true)
    expect(canFlip(s, 6)).toBe(false)
    expect(canFlip({ ...s, won: true }, 3)).toBe(false)
  })
})
