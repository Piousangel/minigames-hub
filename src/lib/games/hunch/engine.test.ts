import { describe, expect, it } from 'vitest'
import {
  DECK_SIZE,
  LIVES,
  MAX_TESTS,
  PROBE_TARGETS,
  RULES,
  type CardId,
  type HunchAction,
  type HunchEvent,
  type HunchState,
  type Rng,
  type StageSpec,
  type Tier,
  buildStage,
  cardCount,
  cardLabel,
  createGame,
  createGameFromStages,
  deckExhausted,
  generateStages,
  isStuck,
  prevCard,
  isRed,
  judge,
  mulberry32,
  pickProbe,
  rankOf,
  reduce,
  ruleById,
  rulesForTier,
  stageBonus,
  suitOf,
} from './engine'

/** A queued-array Rng like the template's deterministic tests use. */
function queued(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

/** Build a stage deck: `ids` first, then fill with remaining copies so each id appears exactly twice. */
function mkStage(
  stageIdx: number,
  tier: Tier,
  ruleId: string,
  ids: number[],
  targets: boolean[] = Array(PROBE_TARGETS).fill(true),
): StageSpec {
  const count = new Array(52).fill(0)
  const order: number[] = []
  for (const id of ids) {
    count[id]++
    order.push(id)
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let id = 0; id < 52; id++) {
      if (count[id] < 2 && (pass === 1 || count[id] === 0)) {
        count[id]++
        order.push(id)
      }
    }
  }
  const padded = targets.concat(Array(PROBE_TARGETS).fill(true)).slice(0, PROBE_TARGETS)
  return {
    tier,
    ruleId,
    deck: order.map((id, i) => ({ uid: stageIdx * 1000 + i, id })),
    probeTargets: padded,
  }
}

/** Card id from rank (1..13) + suit (0♠ 1♥ 2♦ 3♣). */
const C = (rank: number, suit: number): CardId => suit * 13 + (rank - 1)

const ids = (slots: { id: number }[]) => slots.map((s) => s.id)

function stripEvent(s: HunchState): Omit<HunchState, 'lastEvent'> {
  const rest: Partial<HunchState> = { ...s }
  delete rest.lastEvent
  return rest as Omit<HunchState, 'lastEvent'>
}

describe('cards & rules', () => {
  it('rankOf / suitOf / isRed / cardLabel', () => {
    expect(cardLabel(0)).toBe('A♠')
    expect(cardLabel(13)).toBe('A♥')
    expect(cardLabel(38)).toBe('K♦')
    expect(cardLabel(51)).toBe('K♣')
    expect(cardLabel(C(10, 1))).toBe('10♥')
    expect(rankOf(38)).toBe(13)
    expect(suitOf(38)).toBe(2)
    expect(isRed(13)).toBe(true)
    expect(isRed(38)).toBe(true)
    expect(isRed(0)).toBe(false)
    expect(isRed(51)).toBe(false)
  })

  it('has >= 30 uniquely-identified rules, >= 10 per tier', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(30)
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length)
    for (const t of [1, 2, 3] as Tier[]) expect(rulesForTier(t).length).toBeGreaterThanOrEqual(10)
    expect(() => ruleById('nope')).toThrow()
  })

  it('every rule is viable: 6..46 accepts out of 52 for every prev', () => {
    for (const r of RULES) {
      for (let prev = 0; prev < 52; prev++) {
        let n = 0
        for (let c = 0; c < 52; c++) if (r.test(prev, c)) n++
        expect(n, `${r.id} prev=${prev}`).toBeGreaterThanOrEqual(6)
        expect(n, `${r.id} prev=${prev}`).toBeLessThanOrEqual(46)
      }
    }
  })

  const TRUTH: [string, CardId, CardId, boolean][] = [
    ['t1-red', 0, C(7, 1), true],
    ['t1-red', 0, C(7, 3), false],
    ['t1-black', 0, C(2, 3), true],
    ['t1-black', 0, C(2, 2), false],
    ['t1-even', 0, C(12, 0), true],
    ['t1-even', 0, C(11, 0), false],
    ['t1-odd', 0, C(1, 1), true],
    ['t1-odd', 0, C(10, 1), false],
    ['t1-high', 0, C(8, 0), true],
    ['t1-high', 0, C(7, 0), false],
    ['t1-low', 0, C(7, 2), true],
    ['t1-low', 0, C(8, 2), false],
    ['t1-face', 0, C(11, 3), true],
    ['t1-face', 0, C(10, 3), false],
    ['t1-spade-heart', 0, C(5, 1), true],
    ['t1-spade-heart', 0, C(5, 2), false],
    ['t1-no-clubs', 0, C(5, 2), true],
    ['t1-no-clubs', 0, C(5, 3), false],
    ['t1-prime', 0, C(11, 0), true],
    ['t1-prime', 0, C(9, 0), false],
    ['t1-mid', 0, C(5, 0), true],
    ['t1-mid', 0, C(10, 0), false],
    ['t1-diamonds', 0, C(1, 2), true],
    ['t1-diamonds', 0, C(1, 1), false],
    ['t2-alt-color', C(3, 0), C(4, 1), true],
    ['t2-alt-color', C(3, 0), C(4, 3), false],
    ['t2-same-color', C(3, 1), C(9, 2), true],
    ['t2-same-color', C(3, 1), C(9, 0), false],
    ['t2-climb', C(13, 0), C(1, 1), true], // K♠ → A♥
    ['t2-climb', C(5, 0), C(5, 1), false], // 5 → 5
    ['t2-climb', C(5, 0), C(11, 1), true], // +6
    ['t2-climb', C(5, 0), C(12, 1), false], // +7
    ['t2-descend', C(1, 0), C(13, 1), true], // A → K
    ['t2-descend', C(5, 0), C(6, 1), false],
    ['t2-suit-or-rank', C(5, 0), C(9, 0), true],
    ['t2-suit-or-rank', C(5, 0), C(5, 2), true],
    ['t2-suit-or-rank', C(5, 0), C(6, 2), false],
    ['t2-diff-suit', C(5, 0), C(5, 1), true],
    ['t2-diff-suit', C(5, 0), C(6, 0), false],
    ['t2-parity-flip', C(2, 0), C(3, 0), true],
    ['t2-parity-flip', C(2, 0), C(4, 0), false],
    ['t2-parity-same', C(2, 0), C(4, 1), true],
    ['t2-parity-same', C(2, 0), C(5, 1), false],
    ['t2-near', C(1, 0), C(12, 0), true], // A → Q is 2 away cyclically
    ['t2-near', C(1, 0), C(4, 0), false],
    ['t2-far', C(1, 0), C(5, 0), true],
    ['t2-far', C(1, 0), C(4, 0), false],
    ['t2-suit-cycle', C(5, 3), C(2, 0), true], // ♣ → ♠
    ['t2-suit-cycle', C(5, 0), C(2, 2), false],
    ['t2-same-half', C(8, 0), C(13, 1), true],
    ['t2-same-half', C(7, 0), C(8, 1), false],
    ['t3-even-or-face', 0, C(11, 0), true],
    ['t3-even-or-face', 0, C(4, 0), true],
    ['t3-even-or-face', 0, C(7, 0), false],
    ['t3-red-and-high', 0, C(9, 1), true],
    ['t3-red-and-high', 0, C(9, 0), false],
    ['t3-red-and-high', 0, C(3, 1), false],
    ['t3-black-or-ace', 0, C(1, 1), true],
    ['t3-black-or-ace', 0, C(5, 3), true],
    ['t3-black-or-ace', 0, C(5, 1), false],
    ['t3-alt-and-climb', C(3, 0), C(5, 1), true],
    ['t3-alt-and-climb', C(3, 0), C(5, 3), false],
    ['t3-alt-and-climb', C(3, 0), C(2, 1), false],
    ['t3-climb-or-face', C(3, 0), C(5, 0), true],
    ['t3-climb-or-face', C(3, 0), C(12, 0), true],
    ['t3-climb-or-face', C(3, 0), C(2, 0), false],
    ['t3-samecolor-and-even', C(2, 0), C(4, 3), true], // 2♠ → 4♣: same color AND even
    ['t3-samecolor-and-even', C(2, 0), C(3, 3), false], // odd
    ['t3-samecolor-and-even', C(2, 0), C(4, 1), false], // color changed
    ['t3-odd-not-clubs', 0, C(3, 1), true],
    ['t3-odd-not-clubs', 0, C(3, 3), false],
    ['t3-odd-not-clubs', 0, C(4, 1), false],
    ['t3-descend-or-suit', C(5, 0), C(4, 1), true],
    ['t3-descend-or-suit', C(5, 0), C(7, 0), true],
    ['t3-descend-or-suit', C(5, 0), C(7, 1), false],
    ['t3-near-or-red', C(5, 0), C(6, 3), true],
    ['t3-near-or-red', C(5, 0), C(11, 2), true],
    ['t3-near-or-red', C(5, 0), C(11, 3), false],
    ['t3-flip-and-black', C(2, 1), C(3, 0), true],
    ['t3-flip-and-black', C(2, 1), C(3, 1), false],
    ['t3-flip-and-black', C(2, 1), C(4, 0), false],
    ['t3-face-alternates', C(11, 0), C(7, 0), true], // J → 7
    ['t3-face-alternates', C(7, 0), C(8, 0), false], // 7 → 8
    ['t3-face-alternates', C(7, 0), C(13, 0), true],
    ['t3-face-alternates', C(12, 0), C(13, 0), false],
    ['t3-prime-or-diamond', 0, C(4, 2), true],
    ['t3-prime-or-diamond', 0, C(13, 0), true],
    ['t3-prime-or-diamond', 0, C(4, 0), false],
  ]

  it('truth table covers every rule with >= 2 cases', () => {
    for (const r of RULES) {
      expect(TRUTH.filter((t) => t[0] === r.id).length, r.id).toBeGreaterThanOrEqual(2)
    }
  })

  it.each(TRUTH)('%s(%i → %i) = %s', (ruleId, prev, card, want) => {
    expect(judge(ruleId, prev, card)).toBe(want)
  })

  it('rule tests are pure (1000 repeated calls agree)', () => {
    for (const r of RULES) {
      const first = r.test(C(11, 1), C(4, 3))
      for (let i = 0; i < 1000; i++) expect(r.test(C(11, 1), C(4, 3))).toBe(first)
    }
  })
})

describe('generation & determinism', () => {
  it('buildStage: 104 cards, each id twice, unique uids, 32 probe targets', () => {
    const st = buildStage(1, mulberry32(42))
    expect(st.deck).toHaveLength(DECK_SIZE)
    const counts = new Array(52).fill(0)
    for (const s of st.deck) counts[s.id]++
    expect(counts.every((n) => n === 2)).toBe(true)
    expect(new Set(st.deck.map((s) => s.uid)).size).toBe(DECK_SIZE)
    expect(st.deck[0].uid).toBe(1000)
    expect(st.probeTargets).toHaveLength(32)
    expect(st.tier).toBe(2)
  })

  it('createGame is deterministic per seed and differs across seeds', () => {
    expect(createGame(20261009)).toEqual(createGame(20261009))
    expect(createGame(1).stages[0].deck).not.toEqual(createGame(2).stages[0].deck)
  })

  it('generateStages consumes exactly 408 rng draws', () => {
    const inner = mulberry32(5)
    let n = 0
    generateStages(() => {
      n++
      return inner()
    })
    expect(n).toBe(408)
  })

  it('stage i has tier i+1; queued([0]) picks the first rule of each tier', () => {
    const stages = generateStages(queued([0]))
    expect(stages.map((s) => s.tier)).toEqual([1, 2, 3])
    expect(stages.map((s) => s.ruleId)).toEqual(['t1-red', 't2-alt-color', 't3-even-or-face'])
    const g = createGame(99)
    g.stages.forEach((s, i) => expect(ruleById(s.ruleId).tier).toBe(i + 1))
  })

  it('initial state', () => {
    const s = createGame(7)
    expect(s.line).toHaveLength(1)
    expect(s.line[0].starter).toBe(true)
    expect(s.hand).toHaveLength(8)
    expect(s.drawPile).toHaveLength(95)
    expect(s.lives).toBe(LIVES)
    expect(s.score).toBe(0)
    expect(s.phase).toBe('test')
    expect(s.probe).toBeNull()
    expect(cardCount(s)).toBe(DECK_SIZE)
  })
})

describe('reduce', () => {
  // starter A♠; rule red. hand: A♥(acc), 2♠(rej), ...
  const redGame = () =>
    createGameFromStages(1, [
      mkStage(0, 1, 't1-red', [0, 13, 1, 14, 2, 15, 3, 16, 4, 39, 40, 26, 27, 28, 29, 30, 31, 32, 33]),
      mkStage(1, 2, 't2-same-color', []),
      mkStage(2, 3, 't3-black-or-ace', []),
    ])

  it('play accepted: line grows, hand slot refilled from drawPile top, tests = 1', () => {
    const s0 = redGame()
    const top = s0.drawPile[0]
    const s1 = reduce(s0, { type: 'play', index: 0 })
    expect(s1.lastEvent).toBe('accept')
    expect(s1.line).toHaveLength(2)
    expect(s1.line[1].slot.id).toBe(13)
    expect(s1.hand[0]).toEqual(top)
    expect(s1.drawPile).toHaveLength(s0.drawPile.length - 1)
    expect(s1.tests).toBe(1)
    expect(s1.totalTests).toBe(1)
    expect(s1.lastVerdict).toEqual({ uid: 1, id: 13, accepted: true, via: 'test', correct: null })
  })

  it('play rejected: card hangs under the last line card, line length unchanged', () => {
    const s1 = reduce(redGame(), { type: 'play', index: 1 })
    expect(s1.lastEvent).toBe('reject')
    expect(s1.line).toHaveLength(1)
    expect(ids(s1.line[0].rejects)).toEqual([1])
  })

  it('reduce never mutates its input', () => {
    let s = redGame()
    const script: HunchAction[] = [
      { type: 'play', index: 0 },
      { type: 'play', index: 1 },
      { type: 'predict' },
      { type: 'answer', accept: true },
      { type: 'answer', accept: false },
      { type: 'predict' },
      { type: 'cancelPredict' },
    ]
    for (const a of script) {
      const snap = structuredClone(s)
      const next = reduce(s, a)
      expect(s).toEqual(snap)
      s = next
    }
  })

  it('illegal actions only flip lastEvent', () => {
    const s0 = redGame()
    const cases: [HunchState, HunchAction][] = []
    cases.push([s0, { type: 'predict' }]) // 0 tests
    cases.push([s0, { type: 'answer', accept: true }]) // test phase answer
    cases.push([s0, { type: 'play', index: 8 }]) // out of range
    cases.push([s0, { type: 'play', index: -1 }])
    cases.push([s0, { type: 'cancelPredict' }])
    cases.push([s0, { type: 'nextStage' }])
    const pred = reduce(reduce(s0, { type: 'play', index: 0 }), { type: 'predict' })
    expect(pred.phase).toBe('predict')
    cases.push([pred, { type: 'play', index: 0 }]) // play during predict
    cases.push([pred, { type: 'predict' }])
    cases.push([{ ...s0, tests: MAX_TESTS }, { type: 'play', index: 0 }]) // budget spent
    const won: HunchState = { ...s0, phase: 'won' }
    const lost: HunchState = { ...s0, phase: 'lost' }
    for (const end of [won, lost]) {
      for (const a of [
        { type: 'play', index: 0 },
        { type: 'predict' },
        { type: 'answer', accept: true },
        { type: 'answer', accept: false },
        { type: 'cancelPredict' },
        { type: 'nextStage' },
      ] as HunchAction[]) {
        cases.push([end, a])
      }
    }
    for (const [s, a] of cases) {
      const r = reduce(s, a)
      expect(r.lastEvent, JSON.stringify(a)).toBe('illegal')
      expect(stripEvent(r)).toEqual(stripEvent(s))
    }
  })

  it('pickProbe: first target match in window; fallback to top; empty → null', () => {
    const pile = [C(2, 0), C(3, 3), C(4, 1), C(5, 2)].map((id, i) => ({ uid: i, id }))
    const hit = pickProbe(pile, 't1-red', 0, true)
    expect(hit.probe?.id).toBe(C(4, 1))
    expect(ids(hit.drawPile)).toEqual([C(2, 0), C(3, 3), C(5, 2)])
    expect(pile).toHaveLength(4) // input untouched

    const blackPile = [C(2, 0), C(3, 3), C(4, 0), C(5, 3), C(6, 0), C(7, 0), C(8, 1)].map((id, i) => ({ uid: i, id }))
    const miss = pickProbe(blackPile, 't1-red', 0, true) // red only outside the 6-window
    expect(miss.probe?.id).toBe(C(2, 0))
    expect(miss.drawPile).toHaveLength(6)

    expect(pickProbe([], 't1-red', 0, true)).toEqual({ probe: null, drawPile: [] })
  })

  it('predict → cancelPredict burns the probe and resets streak', () => {
    let s = reduce(redGame(), { type: 'play', index: 0 })
    s = reduce(s, { type: 'predict' })
    s = reduce(s, { type: 'answer', accept: true })
    expect(s.streak).toBe(1)
    s = reduce(s, { type: 'cancelPredict' })
    expect(s.lastEvent).toBe('cancel')
    expect(s.probe).toBeNull()
    expect(s.burned).toBe(1)
    expect(s.streak).toBe(0)
    expect(s.phase).toBe('test')
    expect(cardCount(s)).toBe(DECK_SIZE)
  })

  it('wrong answer: -1 life, streak 0, back to test; probe still placed by truth', () => {
    let s = reduce(redGame(), { type: 'play', index: 0 }) // prev = A♥
    s = reduce(s, { type: 'predict' }) // target true → first red in window
    const probe = s.probe!
    expect(isRed(probe.id)).toBe(true)
    s = reduce(s, { type: 'answer', accept: false })
    expect(s.lastEvent).toBe('wrong')
    expect(s.lives).toBe(2)
    expect(s.wrong).toBe(1)
    expect(s.streak).toBe(0)
    expect(s.phase).toBe('test')
    expect(s.probe).toBeNull()
    expect(s.line[s.line.length - 1].slot).toEqual(probe)
    expect(s.lastVerdict).toEqual({ uid: probe.uid, id: probe.id, accepted: true, via: 'predict', correct: false })
  })

  it('three wrong answers → lost; score kept; further play illegal', () => {
    let s = reduce(redGame(), { type: 'play', index: 0 })
    s = reduce(s, { type: 'predict' })
    s = reduce(s, { type: 'answer', accept: true }) // correct, +10
    expect(s.score).toBe(10)
    const events: HunchEvent[] = []
    for (let k = 0; k < 3; k++) {
      if (s.phase === 'test') s = reduce(s, { type: 'predict' })
      const truth = judge('t1-red', s.line[s.line.length - 1].slot.id, s.probe!.id)
      s = reduce(s, { type: 'answer', accept: !truth })
      events.push(s.lastEvent)
    }
    expect(events).toEqual(['wrong', 'wrong', 'lose'])
    expect(s.phase).toBe('lost')
    expect(s.lives).toBe(0)
    expect(s.score).toBe(10)
    expect(reduce(s, { type: 'play', index: 0 }).lastEvent).toBe('illegal')
  })

  it('card conservation + bounds hold over a 100-action random script', () => {
    const rng = mulberry32(7)
    let s = createGame(7)
    let lastScore = 0
    for (let k = 0; k < 100; k++) {
      const r = rng()
      let a: HunchAction
      if (s.phase === 'stageClear') a = { type: 'nextStage' }
      else if (s.phase === 'won' || s.phase === 'lost') a = { type: 'new', seed: k }
      else if (r < 0.45) a = { type: 'play', index: Math.floor(rng() * 9) }
      else if (r < 0.6) a = { type: 'predict' }
      else if (r < 0.95) a = { type: 'answer', accept: rng() < 0.5 }
      else a = { type: 'cancelPredict' }
      const next = reduce(s, a)
      if (a.type === 'new') lastScore = 0
      expect(cardCount(next)).toBe(DECK_SIZE)
      expect(next.streak).toBeGreaterThanOrEqual(0)
      expect(next.streak).toBeLessThanOrEqual(5)
      expect(next.lives).toBeGreaterThanOrEqual(0)
      expect(next.lives).toBeLessThanOrEqual(3)
      expect(Number.isInteger(next.score)).toBe(true)
      expect(next.score).toBeGreaterThanOrEqual(lastScore)
      expect(next.phase === 'predict').toBe(next.probe !== null)
      lastScore = next.score
      s = next
    }
  })

  it('stageBonus', () => {
    expect(stageBonus(1, 2)).toBe(660)
    expect(stageBonus(3, 25)).toBe(800)
    expect(stageBonus(2, 0)).toBe(900)
  })

  it('reset rebuilds from the same stages; new uses a different seed', () => {
    const g = createGame(123)
    let s = reduce(g, { type: 'play', index: 0 })
    s = reduce(s, { type: 'play', index: 1 })
    expect(reduce(s, { type: 'reset' })).toEqual(g)
    const n = reduce(s, { type: 'new', seed: 456 })
    expect(n).toEqual(createGame(456))
    expect(n.seed).toBe(456)
    expect(n.stages).not.toEqual(g.stages)
  })
})

describe('golden scenarios', () => {
  it('A: clears all three stages with 2 tests each → 3280, won', () => {
    const stages = [
      // t1-red. starter A♠; hand A♥ 2♠ 2♥ 3♠ 3♥ 4♠ 4♥ 5♠; then A♣ 2♣ refills, A♦.. 8♦ probes
      mkStage(0, 1, 't1-red', [0, 13, 1, 14, 2, 15, 3, 16, 4, 39, 40, 26, 27, 28, 29, 30, 31, 32, 33]),
      // t2-same-color. starter A♠; 3♠ accepted, A♥ rejected; spade probes follow
      mkStage(1, 2, 't2-same-color', [0, 2, 13, 20, 21, 22, 23, 24, 25, 14, 15, 3, 4, 5, 6, 7]),
      // t3-black-or-ace. starter A♥; A♠ accepted, 2♥ rejected; black probes follow
      mkStage(2, 3, 't3-black-or-ace', [13, 0, 14, 15, 16, 17, 18, 19, 20, 21, 22, 1, 2, 3, 4, 5]),
    ]
    let s = createGameFromStages(1, stages)
    const events: HunchEvent[] = []
    const step = (a: HunchAction) => {
      s = reduce(s, a)
      events.push(s.lastEvent)
      expect(cardCount(s)).toBe(DECK_SIZE)
    }

    // Stage 0
    step({ type: 'play', index: 0 })
    expect(s.line[1].slot.id).toBe(13)
    expect(s.hand[0].id).toBe(39)
    step({ type: 'play', index: 1 })
    expect(s.lastEvent).toBe('reject')
    step({ type: 'predict' })
    expect(s.probe?.id).toBe(26)
    for (let k = 0; k < 5; k++) step({ type: 'answer', accept: true })
    expect(s.score).toBe(50 + 300 + 20 * 18)
    expect(s.score).toBe(710)
    expect(s.phase).toBe('stageClear')
    expect(s.line.map((e) => e.slot.id)).toEqual([0, 13, 26, 27, 28, 29, 30])
    expect(ids(s.line[1].rejects)).toEqual([1])
    expect(s.stageScores).toEqual([660])

    // Stage 1
    step({ type: 'nextStage' })
    expect(s.stageIndex).toBe(1)
    expect(s.tests).toBe(0)
    expect(s.streak).toBe(0)
    expect(s.line.map((e) => e.slot.id)).toEqual([0])
    step({ type: 'play', index: 0 })
    step({ type: 'play', index: 1 })
    step({ type: 'predict' })
    expect(s.probe?.id).toBe(3)
    for (let k = 0; k < 5; k++) step({ type: 'answer', accept: true })
    expect(s.score).toBe(710 + 910)
    expect(s.phase).toBe('stageClear')

    // Stage 2
    step({ type: 'nextStage' })
    step({ type: 'play', index: 0 })
    step({ type: 'play', index: 1 })
    step({ type: 'predict' })
    for (let k = 0; k < 5; k++) step({ type: 'answer', accept: true })

    expect(s.phase).toBe('won')
    expect(s.score).toBe(710 + 910 + 1210 + 450)
    expect(s.score).toBe(3280)
    expect(s.totalTests).toBe(6)
    expect(s.stageScores).toEqual([660, 860, 1160])
    expect(s.probe).toBeNull()

    const stageRun: HunchEvent[] = ['accept', 'reject', 'predictMode', 'correct', 'correct', 'correct', 'correct']
    expect(events).toEqual([
      ...stageRun,
      'stageClear',
      'nextStage',
      ...stageRun,
      'stageClear',
      'nextStage',
      ...stageRun,
      'win',
    ])
  })

  it('B: wrong answer path, then a target=true probe surfaces a face card', () => {
    const stages = [
      mkStage(0, 1, 't1-face', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 15, 11, 12], [false, true]),
      mkStage(1, 2, 't2-climb', []),
      mkStage(2, 3, 't3-prime-or-diamond', []),
    ]
    let s = createGameFromStages(9, stages)
    s = reduce(s, { type: 'play', index: 0 }) // 2♠ rejected
    expect(s.lastEvent).toBe('reject')
    s = reduce(s, { type: 'predict' }) // target false → 2♥ (non-face)
    expect(s.probe?.id).toBe(14)
    s = reduce(s, { type: 'answer', accept: true }) // wrong
    expect(s.lastEvent).toBe('wrong')
    expect(s.lives).toBe(2)
    expect(s.phase).toBe('test')
    expect(s.score).toBe(0)
    expect(ids(s.line[0].rejects)).toEqual([1, 14])

    s = reduce(s, { type: 'predict' }) // probeIdx 1 → target true → Q♠ from window [3♥,Q♠,K♠,…]
    expect(s.probeIdx).toBe(1)
    expect(s.probe?.id).toBe(11)
    s = reduce(s, { type: 'answer', accept: true })
    expect(s.lastEvent).toBe('correct')
    expect(s.score).toBe(10)
    expect(s.streak).toBe(1)
  })
})

describe('challenge seeds & fairness', () => {
  it('the seed alone fixes every rule, deck order and probe target (challenge links replay exactly)', () => {
    for (const seed of [1, 20261009, 0xffffffff, 123456789]) {
      const a = createGame(seed)
      const b = createGame(seed)
      expect(a.stages.map((s) => s.ruleId)).toEqual(b.stages.map((s) => s.ruleId))
      expect(a.stages.map((s) => s.deck)).toEqual(b.stages.map((s) => s.deck))
      expect(a.stages.map((s) => s.probeTargets)).toEqual(b.stages.map((s) => s.probeTargets))
      // and the same action script yields the same probes
      const script: HunchAction[] = [
        { type: 'play', index: 0 },
        { type: 'play', index: 3 },
        { type: 'predict' },
        { type: 'answer', accept: true },
      ]
      let sa = a
      let sb = b
      for (const act of script) {
        sa = reduce(sa, act)
        sb = reduce(sb, act)
        expect(sa.probe).toEqual(sb.probe)
      }
      expect(sa).toEqual(sb)
    }
  })

  it('an oracle that knows each rule always wins with every life (probes are always answerable)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = createGame(seed * 2654435761)
      for (let guard = 0; guard < 200 && s.phase !== 'won' && s.phase !== 'lost'; guard++) {
        if (s.phase === 'stageClear') s = reduce(s, { type: 'nextStage' })
        else if (s.phase === 'test') s = reduce(s, s.tests === 0 ? { type: 'play', index: 0 } : { type: 'predict' })
        else if (s.probe) {
          const rule = s.stages[s.stageIndex].ruleId
          s = reduce(s, { type: 'answer', accept: judge(rule, prevCard(s), s.probe.id) })
        }
      }
      expect(s.phase, `seed ${seed}`).toBe('won')
      expect(s.lives).toBe(LIVES)
      expect(Number.isInteger(s.score) && s.score > 0).toBe(true)
    }
  })

  it('a drained draw pile ends the run instead of soft-locking', () => {
    let s = createGame(77)
    for (let i = 0; i < MAX_TESTS - 1; i++) s = reduce(s, { type: 'play', index: 0 })
    // burn probes until only the final test can be played
    s = { ...s, drawPile: [] }
    expect(isStuck(s)).toBe(false) // one test left
    s = reduce(s, { type: 'play', index: 0 })
    expect(s.phase).toBe('lost')
    expect(s.lastEvent).toBe('lose')
    expect(deckExhausted(s)).toBe(true)
  })
})
