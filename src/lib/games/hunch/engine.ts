/**
 * Hunch — pure engine.
 *
 * An Eleusis-style induction game. A hidden rule decides which cards are
 * accepted onto the main line. The player tests cards from an 8-card hand
 * (accepted cards extend the line, rejected ones hang under the last line
 * card), then enters predict mode and must call 5 probe verdicts in a row to
 * crack the rule. Three stages per run: attribute rule (tier 1), sequence rule
 * comparing with the previous line card (tier 2), compound rule (tier 3).
 *
 * All functions are pure and total: no timers, no `Date`, NO `Math.random`.
 * Randomness enters only through an injected `Rng`, consumed inside
 * `createGame` → `generateStages` (136 draws per stage, 408 total), plus one
 * place in the reducer: when the draw pile runs out, the cancelled probes are
 * reshuffled into a new pile with `mulberry32(recycleSeed(seed, stage, n))`, so
 * the same seed + same actions still replay the exact run (challenge / daily).
 */

export const STAGES = 3
export const HAND_SIZE = 8
export const DECK_COPIES = 2 // 52 × 2 = 104 cards per stage
export const DECK_SIZE = 52 * DECK_COPIES
export const STREAK_TO_CLEAR = 5
export const LIVES = 3
export const MAX_TESTS = 40 // per-stage test cap; reaching it makes play illegal
export const MIN_TESTS_TO_PREDICT = 1
export const PROBE_WINDOW = 6
export const PROBE_TARGETS = 32
export const STAGE_BASE = [300, 500, 800] as const // tier 1, 2, 3
export const EFF_CAP = 20
export const EFF_UNIT = 20
export const CORRECT_PTS = 10
export const LIFE_BONUS = 150
export const PAR_TESTS = [6, 9, 12] as const // shared-card grade; sums to 27
export const PAR_TOTAL = PAR_TESTS[0] + PAR_TESTS[1] + PAR_TESTS[2]
export const MIN_ACCEPT = 6
export const MAX_ACCEPT = 46 // rule viability band (accepts per prev, out of 52)

export type Rng = () => number // float in [0,1)
/** 0..51. suit = floor(id/13) (0♠ 1♥ 2♦ 3♣), rank = id%13 + 1 (1=A … 13=K). */
export type CardId = number
export type Tier = 1 | 2 | 3
/** uid = stageIndex*1000 + post-shuffle position (0..103); unique across a run. */
export interface Slot {
  uid: number
  id: CardId
}
export interface LineEntry {
  slot: Slot
  rejects: Slot[]
  starter: boolean
}
export interface Rule {
  id: string
  tier: Tier
  name: string
  text: string
  test: (prev: CardId, card: CardId) => boolean
}
/** Immutable after createGame. */
export interface StageSpec {
  tier: Tier
  ruleId: string
  deck: Slot[]
  probeTargets: boolean[]
}
export type Phase = 'test' | 'predict' | 'stageClear' | 'won' | 'lost'
export type HunchEvent =
  | 'none'
  | 'accept'
  | 'reject'
  | 'predictMode'
  | 'correct'
  | 'wrong'
  | 'cancel'
  | 'stageClear'
  | 'nextStage'
  | 'win'
  | 'lose'
  | 'illegal'
export interface Verdict {
  uid: number
  id: CardId
  accepted: boolean
  via: 'test' | 'predict'
  correct: boolean | null
}

export interface HunchState {
  seed: number
  stages: StageSpec[] // length 3
  stageIndex: number // 0..2
  phase: Phase
  line: LineEntry[] // current stage; line[0].starter === true; length >= 1
  hand: Slot[] // length <= HAND_SIZE; slots refilled in place
  drawPile: Slot[] // remaining deck for the current stage (front = top)
  probe: Slot | null // non-null iff phase === 'predict'
  probeIdx: number // probeTargets index used so far in this stage
  burned: number // probes discarded by cancelPredict (this stage, cumulative)
  discard: Slot[] // cancelled probes awaiting reshuffle (never judged, so never evidence)
  recycles: number // times the discard was reshuffled into the draw pile (this stage)
  reshuffled: boolean // true only on the transition that just recycled the pile
  streak: number // 0..5
  tests: number // tests in the current stage
  totalTests: number
  lives: number
  wrong: number // wrong predictions in the whole run
  score: number
  stageScores: number[] // per-stage clear bonus (excludes CORRECT_PTS)
  lastEvent: HunchEvent
  lastVerdict: Verdict | null
}

export type HunchAction =
  | { type: 'play'; index: number }
  | { type: 'predict' }
  | { type: 'answer'; accept: boolean }
  | { type: 'cancelPredict' }
  | { type: 'nextStage' }
  | { type: 'reset' } // restart with the same seed / stages
  | { type: 'new'; seed: number }

// ---------------------------------------------------------------------------
// RNG

/** Identical impl to the template's mulberry32. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Cards

const SUIT_GLYPHS = ['♠', '♥', '♦', '♣'] as const
export const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'] as const
const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
export const RANK_NAMES = [
  'ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king',
] as const

export function rankOf(id: CardId): number {
  return (id % 13) + 1
}
export function suitOf(id: CardId): number {
  return Math.floor(id / 13)
}
export function isRed(id: CardId): boolean {
  const s = suitOf(id)
  return s === 1 || s === 2
}
export function isFace(id: CardId): boolean {
  return rankOf(id) >= 11
}
export function suitGlyph(id: CardId): string {
  return SUIT_GLYPHS[suitOf(id)]
}
export function rankLabel(id: CardId): string {
  return RANK_LABELS[rankOf(id) - 1]
}
export function cardLabel(id: CardId): string {
  return `${rankLabel(id)}${suitGlyph(id)}`
}
/** Screen-reader friendly name, e.g. "7 of hearts", "queen of spades". */
export function cardName(id: CardId): string {
  return `${RANK_NAMES[rankOf(id) - 1]} of ${SUIT_NAMES[suitOf(id)]}`
}

/** Cyclic step from prev rank up to card rank, 0..12 (K→A is +1). */
export function stepUp(prev: CardId, card: CardId): number {
  return (rankOf(card) - rankOf(prev) + 13) % 13
}
function climb(prev: CardId, card: CardId): boolean {
  const s = stepUp(prev, card)
  return s >= 1 && s <= 6
}
function descend(prev: CardId, card: CardId): boolean {
  const s = stepUp(prev, card)
  return s >= 7 && s <= 12
}
function cycDist(prev: CardId, card: CardId): number {
  const s = stepUp(prev, card)
  return Math.min(s, 13 - s)
}
const isEven = (id: CardId) => rankOf(id) % 2 === 0
const isPrime = (id: CardId) => [2, 3, 5, 7, 11, 13].includes(rankOf(id))
const sameColor = (a: CardId, b: CardId) => isRed(a) === isRed(b)

// ---------------------------------------------------------------------------
// Rules (order is FIXED — rng indexing depends on it)

export const RULES: readonly Rule[] = [
  // Tier 1 — a single attribute (prev ignored)
  { id: 't1-red', tier: 1, name: 'Red', text: 'The card is red (♥ or ♦)', test: (_p, c) => isRed(c) },
  { id: 't1-black', tier: 1, name: 'Black', text: 'The card is black (♠ or ♣)', test: (_p, c) => !isRed(c) },
  { id: 't1-even', tier: 1, name: 'Even', text: 'The rank is even (2, 4, 6, 8, 10, Q)', test: (_p, c) => isEven(c) },
  { id: 't1-odd', tier: 1, name: 'Odd', text: 'The rank is odd (A, 3, 5, 7, 9, J, K)', test: (_p, c) => !isEven(c) },
  { id: 't1-high', tier: 1, name: 'High', text: 'The rank is 8 or higher', test: (_p, c) => rankOf(c) >= 8 },
  { id: 't1-low', tier: 1, name: 'Low', text: 'The rank is 7 or lower (A counts as 1)', test: (_p, c) => rankOf(c) <= 7 },
  { id: 't1-face', tier: 1, name: 'Faces', text: 'The card is a face card (J, Q, K)', test: (_p, c) => isFace(c) },
  {
    id: 't1-spade-heart',
    tier: 1,
    name: 'Spades & Hearts',
    text: 'The suit is ♠ or ♥',
    test: (_p, c) => suitOf(c) === 0 || suitOf(c) === 1,
  },
  { id: 't1-no-clubs', tier: 1, name: 'No Clubs', text: 'Anything except ♣', test: (_p, c) => suitOf(c) !== 3 },
  { id: 't1-prime', tier: 1, name: 'Prime', text: 'The rank is prime (2, 3, 5, 7, J=11, K=13)', test: (_p, c) => isPrime(c) },
  {
    id: 't1-mid',
    tier: 1,
    name: 'Middle',
    text: 'The rank is between 5 and 9',
    test: (_p, c) => rankOf(c) >= 5 && rankOf(c) <= 9,
  },
  { id: 't1-diamonds', tier: 1, name: 'Diamonds', text: 'The suit is ♦', test: (_p, c) => suitOf(c) === 2 },

  // Tier 2 — compare with the last line card
  {
    id: 't2-alt-color',
    tier: 2,
    name: 'Alternate Colors',
    text: 'The color differs from the last card',
    test: (p, c) => !sameColor(p, c),
  },
  {
    id: 't2-same-color',
    tier: 2,
    name: 'Same Color',
    text: 'The color matches the last card',
    test: (p, c) => sameColor(p, c),
  },
  {
    id: 't2-climb',
    tier: 2,
    name: 'Climb',
    text: 'Rank is 1–6 steps above the last card (K wraps to A)',
    test: climb,
  },
  {
    id: 't2-descend',
    tier: 2,
    name: 'Descend',
    text: 'Rank is 1–6 steps below the last card (A wraps to K)',
    test: descend,
  },
  {
    id: 't2-suit-or-rank',
    tier: 2,
    name: 'Match',
    text: 'Same suit or same rank as the last card',
    test: (p, c) => suitOf(p) === suitOf(c) || rankOf(p) === rankOf(c),
  },
  {
    id: 't2-diff-suit',
    tier: 2,
    name: 'New Suit',
    text: 'The suit differs from the last card',
    test: (p, c) => suitOf(p) !== suitOf(c),
  },
  {
    id: 't2-parity-flip',
    tier: 2,
    name: 'Parity Flip',
    text: 'Odd/even rank flips from the last card',
    test: (p, c) => isEven(p) !== isEven(c),
  },
  {
    id: 't2-parity-same',
    tier: 2,
    name: 'Parity Keep',
    text: 'Odd/even rank matches the last card',
    test: (p, c) => isEven(p) === isEven(c),
  },
  {
    id: 't2-near',
    tier: 2,
    name: 'Near',
    text: 'Rank is within 2 of the last card (wrapping K–A)',
    test: (p, c) => cycDist(p, c) <= 2,
  },
  {
    id: 't2-far',
    tier: 2,
    name: 'Far',
    text: 'Rank is 4 or more away from the last card (wrapping K–A)',
    test: (p, c) => cycDist(p, c) >= 4,
  },
  {
    id: 't2-suit-cycle',
    tier: 2,
    name: 'Suit Cycle',
    text: 'The suit follows the last card in the cycle ♠ → ♥ → ♦ → ♣ → ♠',
    test: (p, c) => suitOf(c) === (suitOf(p) + 1) % 4,
  },
  {
    id: 't2-same-half',
    tier: 2,
    name: 'Same Half',
    text: 'Both cards are high (8+) or both are low (7 or less)',
    test: (p, c) => (rankOf(c) >= 8) === (rankOf(p) >= 8),
  },

  // Tier 3 — compound
  {
    id: 't3-even-or-face',
    tier: 3,
    name: 'Even or Face',
    text: 'The rank is even, or the card is a face card',
    test: (_p, c) => isEven(c) || isFace(c),
  },
  {
    id: 't3-red-and-high',
    tier: 3,
    name: 'Red & High',
    text: 'The card is red and its rank is 8 or higher',
    test: (_p, c) => isRed(c) && rankOf(c) >= 8,
  },
  {
    id: 't3-black-or-ace',
    tier: 3,
    name: 'Black or Ace',
    text: 'The card is black, or it is an Ace',
    test: (_p, c) => !isRed(c) || rankOf(c) === 1,
  },
  {
    id: 't3-alt-and-climb',
    tier: 3,
    name: 'Alternate & Climb',
    text: 'The color differs from the last card and the rank climbs 1–6',
    test: (p, c) => !sameColor(p, c) && climb(p, c),
  },
  {
    id: 't3-climb-or-face',
    tier: 3,
    name: 'Climb or Face',
    text: 'The rank climbs 1–6 from the last card, or the card is a face card',
    test: (p, c) => climb(p, c) || isFace(c),
  },
  {
    // QA: replaced an XOR rule (same color ≠ even) — its accepts looked random to
    // human testers. A plain AND shows both traits on every accepted card.
    id: 't3-samecolor-and-even',
    tier: 3,
    name: 'Same Color & Even',
    text: 'The color matches the last card and the rank is even',
    test: (p, c) => sameColor(p, c) && isEven(c),
  },
  {
    id: 't3-odd-not-clubs',
    tier: 3,
    name: 'Odd, No Clubs',
    text: 'The rank is odd and the suit is not ♣',
    test: (_p, c) => !isEven(c) && suitOf(c) !== 3,
  },
  {
    id: 't3-descend-or-suit',
    tier: 3,
    name: 'Descend or Suit',
    text: 'The rank descends 1–6 from the last card, or the suit matches it',
    test: (p, c) => descend(p, c) || suitOf(p) === suitOf(c),
  },
  {
    id: 't3-near-or-red',
    tier: 3,
    name: 'Near or Red',
    text: 'The rank is within 2 of the last card, or the card is red',
    test: (p, c) => cycDist(p, c) <= 2 || isRed(c),
  },
  {
    id: 't3-flip-and-black',
    tier: 3,
    name: 'Flip & Black',
    text: 'Odd/even flips from the last card and the card is black',
    test: (p, c) => isEven(p) !== isEven(c) && !isRed(c),
  },
  {
    id: 't3-face-alternates',
    tier: 3,
    name: 'Face Alternates',
    text: 'After a face card play a non-face; after a non-face play a face',
    test: (p, c) => (isFace(p) ? !isFace(c) : isFace(c)),
  },
  {
    id: 't3-prime-or-diamond',
    tier: 3,
    name: 'Prime or Diamond',
    text: 'The rank is prime (2, 3, 5, 7, J, K), or the suit is ♦',
    test: (_p, c) => isPrime(c) || suitOf(c) === 2,
  },
]

export function rulesForTier(t: Tier): Rule[] {
  return RULES.filter((r) => r.tier === t)
}

const RULE_MAP = new Map(RULES.map((r) => [r.id, r]))

export function ruleById(id: string): Rule {
  const r = RULE_MAP.get(id)
  if (!r) throw new Error(`Unknown hunch rule: ${id}`)
  return r
}

export function judge(ruleId: string, prev: CardId, card: CardId): boolean {
  return ruleById(ruleId).test(prev, card)
}

export function prevCard(s: HunchState): CardId {
  return s.line[s.line.length - 1].slot.id
}

export function currentRule(s: HunchState): Rule {
  return ruleById(s.stages[s.stageIndex].ruleId)
}

// ---------------------------------------------------------------------------
// Generation (the only rng consumers)

export function buildStage(stageIndex: number, rng: Rng): StageSpec {
  const tier = (stageIndex + 1) as Tier
  const pool = rulesForTier(tier)
  const ruleIdx = Math.floor(rng() * pool.length)
  const ruleId = pool[Math.min(ruleIdx, pool.length - 1)].id

  const base: CardId[] = []
  for (let c = 0; c < DECK_COPIES; c++) for (let id = 0; id < 52; id++) base.push(id)
  for (let i = base.length - 1; i >= 1; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = base[i]
    base[i] = base[j]
    base[j] = t
  }
  const deck: Slot[] = base.map((id, pos) => ({ uid: stageIndex * 1000 + pos, id }))

  const probeTargets: boolean[] = []
  for (let k = 0; k < PROBE_TARGETS; k++) probeTargets.push(rng() < 0.5)

  return { tier, ruleId, deck, probeTargets }
}

export function generateStages(rng: Rng): StageSpec[] {
  const stages: StageSpec[] = []
  for (let s = 0; s < STAGES; s++) stages.push(buildStage(s, rng))
  return stages
}

function enterStage(state: HunchState, idx: number): HunchState {
  const deck = state.stages[idx].deck
  return {
    ...state,
    stageIndex: idx,
    phase: 'test',
    line: [{ slot: deck[0], rejects: [], starter: true }],
    hand: deck.slice(1, 1 + HAND_SIZE),
    drawPile: deck.slice(1 + HAND_SIZE),
    probe: null,
    probeIdx: 0,
    burned: 0,
    discard: [],
    recycles: 0,
    reshuffled: false,
    streak: 0,
    tests: 0,
  }
}

export function createGameFromStages(seed: number, stages: StageSpec[]): HunchState {
  const blank: HunchState = {
    seed,
    stages,
    stageIndex: 0,
    phase: 'test',
    line: [],
    hand: [],
    drawPile: [],
    probe: null,
    probeIdx: 0,
    burned: 0,
    discard: [],
    recycles: 0,
    reshuffled: false,
    streak: 0,
    tests: 0,
    totalTests: 0,
    lives: LIVES,
    wrong: 0,
    score: 0,
    stageScores: [],
    lastEvent: 'none',
    lastVerdict: null,
  }
  return enterStage(blank, 0)
}

export function createGame(seed: number): HunchState {
  return createGameFromStages(seed, generateStages(mulberry32(seed)))
}

// ---------------------------------------------------------------------------
// Rules of play

/** Choose the first card in the top PROBE_WINDOW whose verdict === target; else the top card. */
export function pickProbe(
  drawPile: Slot[],
  ruleId: string,
  prev: CardId,
  target: boolean,
): { probe: Slot | null; drawPile: Slot[] } {
  if (drawPile.length === 0) return { probe: null, drawPile }
  const win = Math.min(PROBE_WINDOW, drawPile.length)
  let pick = 0
  for (let i = 0; i < win; i++) {
    if (judge(ruleId, prev, drawPile[i].id) === target) {
      pick = i
      break
    }
  }
  return {
    probe: drawPile[pick],
    drawPile: [...drawPile.slice(0, pick), ...drawPile.slice(pick + 1)],
  }
}

export function stageBonus(tier: Tier, tests: number): number {
  return STAGE_BASE[tier - 1] + EFF_UNIT * Math.max(0, EFF_CAP - tests)
}

export function canPlay(s: HunchState): boolean {
  return s.phase === 'test' && s.tests < MAX_TESTS && s.hand.length > 0
}

export function canPredict(s: HunchState): boolean {
  return s.phase === 'test' && s.tests >= MIN_TESTS_TO_PREDICT && s.drawPile.length > 0
}

/** Place a judged card: accepted → new line entry; rejected → under the last line card. */
function place(line: LineEntry[], slot: Slot, accepted: boolean): LineEntry[] {
  if (accepted) return [...line, { slot, rejects: [], starter: false }]
  const last = line[line.length - 1]
  return [...line.slice(0, -1), { ...last, rejects: [...last.rejects, slot] }]
}

/** Seed for the n-th (0-based) recycle of a stage: a pure mix of run seed, stage and count. */
export function recycleSeed(seed: number, stageIndex: number, n: number): number {
  let h = (seed >>> 0) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) ^ Math.imul(stageIndex + 1, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) ^ Math.imul(n + 1, 0x27d4eb2f)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * Recycle rule: once the draw pile is empty, the cancelled probes (the discard)
 * are shuffled into a fresh pile. Line cards and rejects are evidence and stay
 * put; hand cards stay in hand. Deterministic via `recycleSeed`.
 */
function recycle(s: HunchState): HunchState {
  if (s.drawPile.length > 0 || s.discard.length === 0) return s
  const pile = s.discard.slice()
  const rng = mulberry32(recycleSeed(s.seed, s.stageIndex, s.recycles))
  for (let i = pile.length - 1; i >= 1; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = pile[i]
    pile[i] = pile[j]
    pile[j] = t
  }
  return { ...s, drawPile: pile, discard: [], recycles: s.recycles + 1, reshuffled: true }
}

function illegal(s: HunchState): HunchState {
  return { ...s, lastEvent: 'illegal' }
}

/**
 * Dead-end guard: back in 'test' with no legal play (test cap reached or hand
 * empty) and nothing left to probe → the run ends instead of soft-locking.
 * Cancelled probes are recycled, so the pile only stays empty when every card
 * has been judged onto the table — dozens of correct calls that never reach a
 * streak of 5. Kept so the reducer stays total.
 */
export function isStuck(s: HunchState): boolean {
  return s.phase === 'test' && !canPlay(s) && !canPredict(s)
}

function settle(s: HunchState): HunchState {
  return isStuck(s) ? { ...s, phase: 'lost', lastEvent: 'lose' } : s
}

/** Lost with lives to spare → every card of the stage was judged and nothing is left to probe. */
export function deckExhausted(s: HunchState): boolean {
  return s.phase === 'lost' && s.lives > 0
}

export function reduce(s0: HunchState, a: HunchAction): HunchState {
  // The reshuffle announcement lives for exactly one transition.
  const s = s0.reshuffled ? { ...s0, reshuffled: false } : s0
  switch (a.type) {
    case 'reset':
      return createGameFromStages(s.seed, s.stages)
    case 'new':
      return createGame(a.seed)

    case 'play': {
      if (!canPlay(s)) return illegal(s)
      const i = a.index
      if (!Number.isInteger(i) || i < 0 || i >= s.hand.length) return illegal(s)
      const card = s.hand[i]
      const ruleId = s.stages[s.stageIndex].ruleId
      const acc = judge(ruleId, prevCard(s), card.id)
      const line = place(s.line, card, acc)
      // Recycle first: if the pile is empty but cancelled probes wait in the discard,
      // the replacement card must come from the reshuffled pile (hand stays full).
      const pre = recycle(s)
      let hand: Slot[]
      let drawPile = pre.drawPile
      if (drawPile.length > 0) {
        hand = s.hand.slice()
        hand[i] = drawPile[0]
        drawPile = drawPile.slice(1)
      } else {
        hand = [...s.hand.slice(0, i), ...s.hand.slice(i + 1)]
      }
      return settle(recycle({
        ...pre,
        line,
        hand,
        drawPile,
        tests: s.tests + 1,
        totalTests: s.totalTests + 1,
        lastEvent: acc ? 'accept' : 'reject',
        lastVerdict: { uid: card.uid, id: card.id, accepted: acc, via: 'test', correct: null },
      }))
    }

    case 'predict': {
      if (!canPredict(s)) return illegal(s)
      const st = s.stages[s.stageIndex]
      const target = st.probeTargets[s.probeIdx % PROBE_TARGETS]
      const { probe, drawPile } = pickProbe(s.drawPile, st.ruleId, prevCard(s), target)
      if (!probe) return illegal(s) // unreachable: canPredict guarantees a card
      return { ...s, phase: 'predict', probe, drawPile, lastEvent: 'predictMode' }
    }

    case 'answer': {
      if (s.phase !== 'predict' || !s.probe) return illegal(s)
      const st = s.stages[s.stageIndex]
      const probe = s.probe
      const truth = judge(st.ruleId, prevCard(s), probe.id)
      const correct = a.accept === truth
      const line = place(s.line, probe, truth)
      const probeIdx = s.probeIdx + 1
      const lastVerdict: Verdict = { uid: probe.uid, id: probe.id, accepted: truth, via: 'predict', correct }
      const base: HunchState = { ...s, line, probeIdx, lastVerdict }

      if (!correct) {
        const lives = s.lives - 1
        return settle(recycle({
          ...base,
          lives,
          wrong: s.wrong + 1,
          streak: 0,
          probe: null,
          phase: lives === 0 ? 'lost' : 'test',
          lastEvent: lives === 0 ? 'lose' : 'wrong',
        }))
      }

      const streak = s.streak + 1
      let score = s.score + CORRECT_PTS
      if (streak >= STREAK_TO_CLEAR) {
        const bonus = stageBonus(st.tier, s.tests)
        score += bonus
        const stageScores = [...s.stageScores, bonus]
        if (s.stageIndex >= s.stages.length - 1) {
          score += LIFE_BONUS * s.lives
          return { ...base, streak, score, stageScores, probe: null, phase: 'won', lastEvent: 'win' }
        }
        return { ...base, streak, score, stageScores, probe: null, phase: 'stageClear', lastEvent: 'stageClear' }
      }

      const target = st.probeTargets[probeIdx % PROBE_TARGETS]
      const refilled = recycle(base) // the probe just answered may have been the last pile card
      const next = pickProbe(refilled.drawPile, st.ruleId, prevCard(base), target)
      if (!next.probe) {
        // Pile and discard both empty (every card is on the table). That is not a loss:
        // drop back to 'test' (hand cards may still be played) and let settle() end
        // the run only if no legal action remains. Leaving predict mode breaks the
        // run of calls, exactly like cancelPredict, so the streak resets to 0.
        return settle({ ...refilled, streak: 0, score, probe: null, phase: 'test', lastEvent: 'correct' })
      }
      return { ...refilled, streak, score, probe: next.probe, drawPile: next.drawPile, lastEvent: 'correct' }
    }

    case 'cancelPredict': {
      if (s.phase !== 'predict' || !s.probe) return illegal(s)
      return settle(
        recycle({
          ...s,
          probe: null,
          discard: [...s.discard, s.probe],
          burned: s.burned + 1,
          streak: 0,
          phase: 'test',
          lastEvent: 'cancel',
        }),
      )
    }

    case 'nextStage': {
      if (s.phase !== 'stageClear' || s.stageIndex + 1 >= s.stages.length) return illegal(s)
      return { ...enterStage(s, s.stageIndex + 1), lastEvent: 'nextStage', lastVerdict: null }
    }
  }
}

/** Count of cards in the current stage across all zones (conservation invariant = DECK_SIZE). */
export function cardCount(s: HunchState): number {
  let n = 0
  for (const e of s.line) n += 1 + e.rejects.length
  return n + s.hand.length + s.drawPile.length + (s.probe ? 1 : 0) + s.discard.length
}
