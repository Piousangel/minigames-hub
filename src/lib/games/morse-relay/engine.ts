/**
 * Morse Relay — pure engine.
 *
 * Transmit a target word by holding a single telegraph key for exactly the
 * right symbol durations and resting between symbols/letters/words for
 * exactly the right gap durations. The engine never reads a clock — every
 * `t` passed into an action is a monotonically increasing millisecond value
 * supplied by the component (an accumulated rAF delta); the engine only ever
 * looks at differences between two `t` values.
 *
 * Randomness enters in exactly one place: `pickWord`, which draws the target
 * word for a round from `mulberry32(mixSeed(seed, level))()` — consumed
 * exactly once. No `Rng` closure is ever stored in state, so `MorseRelayState`
 * is plain, serializable data and golden tests can `toEqual` it directly.
 */

export type Rng = () => number // [0,1)
export type Symbol = '.' | '-'

/** One target letter + its morse pattern + whether a word gap follows it. */
export interface TargetLetter {
  char: string // 'A'..'Z'
  pattern: Symbol[]
  wordBreakAfter: boolean // true => the gap after this letter must be a word gap
}

export interface LetterResult {
  char: string
  correct: boolean
  clean: boolean
}

export type MorseEventTag =
  | 'none'
  | 'symbolOk'
  | 'symbolMistake'
  | 'letterComplete'
  | 'letterMistake'
  | 'wordComplete'
  | 'timeout'
  | 'gameOver'

export interface MorseRelayState {
  seed: number
  level: number
  target: TargetLetter[]
  targetLabel: string

  unitMs: number | null
  pendingDownT: number | null
  lastUpT: number | null

  letterIndex: number
  symbolIndex: number
  enteredPattern: Symbol[]
  failed: boolean
  letterAllClean: boolean

  results: LetterResult[]
  wordMistakes: number

  combo: number
  maxCombo: number
  score: number
  wpm: number
  bestWpm: number
  lives: number
  wordsCompleted: number
  mistakes: number
  lettersAttempted: number
  lettersCorrect: number

  lost: boolean
  lastEvent: MorseEventTag
}

export type MorseRelayAction =
  | { type: 'down'; t: number }
  | { type: 'up'; t: number }
  | { type: 'tick'; t: number }
  | { type: 'nextWord'; t: number }
  | { type: 'reset'; seed: number }

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

export function mixSeed(seed: number, level: number): number {
  return ((seed ^ Math.imul(level, 0x9e3779b9)) >>> 0)
}

export const MORSE_TABLE: Record<string, Symbol[]> = {
  A: ['.', '-'],
  B: ['-', '.', '.', '.'],
  C: ['-', '.', '-', '.'],
  D: ['-', '.', '.'],
  E: ['.'],
  F: ['.', '.', '-', '.'],
  G: ['-', '-', '.'],
  H: ['.', '.', '.', '.'],
  I: ['.', '.'],
  J: ['.', '-', '-', '-'],
  K: ['-', '.', '-'],
  L: ['.', '-', '.', '.'],
  M: ['-', '-'],
  N: ['-', '.'],
  O: ['-', '-', '-'],
  P: ['.', '-', '-', '.'],
  Q: ['-', '-', '.', '-'],
  R: ['.', '-', '.'],
  S: ['.', '.', '.'],
  T: ['-'],
  U: ['.', '.', '-'],
  V: ['.', '.', '.', '-'],
  W: ['.', '-', '-'],
  X: ['-', '.', '.', '-'],
  Y: ['-', '.', '-', '-'],
  Z: ['-', '-', '.', '.'],
}

export const WORD_BUCKETS: string[][] = [
  ['SOS', 'HI', 'CQ', 'KEY', 'RUN', 'SUN'],
  ['CODE', 'SHIP', 'WAVE', 'ECHO', 'SIGN', 'OVER'],
  ['RELAY', 'RADIO', 'MORSE', 'SPARK', 'PULSE', 'TOWER'],
  ['SEND HELP', 'GOOD LUCK', 'ALL CLEAR', 'ROGER OUT', 'STAND BY', 'WELL DONE'],
]

export function wordBucketIndex(level: number): number {
  return Math.max(0, Math.min(level - 1, WORD_BUCKETS.length - 1))
}

export function pickWord(seed: number, level: number): string {
  const bucket = WORD_BUCKETS[wordBucketIndex(level)]
  const rng = mulberry32(mixSeed(seed, level))
  const idx = Math.floor(rng() * bucket.length)
  return bucket[idx]
}

export function buildTarget(word: string): TargetLetter[] {
  const upper = word.toUpperCase()
  const out: TargetLetter[] = []
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i]
    if (ch === ' ') continue
    const pattern = MORSE_TABLE[ch]
    if (!pattern) continue
    const wordBreakAfter = upper[i + 1] === ' '
    out.push({ char: ch, pattern, wordBreakAfter })
  }
  return out
}

export const SYMBOL_BOUNDARY_UNITS = 2
export const GAP_ELEMENT_BOUNDARY_UNITS = 2
export const GAP_WORD_BOUNDARY_UNITS = 5
export const MIN_UNIT_MS = 40
export const MAX_UNIT_MS = 600
export const ABANDON_MS = 3000
export const STARTING_LIVES = 5
export const SYMBOL_POINTS = 10
export const LETTER_BONUS = 40
export const CLEAN_WORD_BONUS = 150
export const WORD_BONUS_UNIT = 200
export const MULTIPLIER_STEP = 5
export const MULTIPLIER_CAP = 5

export function classifySymbol(durationMs: number, unitMs: number): Symbol {
  return durationMs <= SYMBOL_BOUNDARY_UNITS * unitMs ? '.' : '-'
}

export type GapCategory = 'element' | 'letter' | 'word'

export function classifyGap(gapMs: number, unitMs: number): GapCategory {
  if (gapMs <= GAP_ELEMENT_BOUNDARY_UNITS * unitMs) return 'element'
  if (gapMs <= GAP_WORD_BOUNDARY_UNITS * unitMs) return 'letter'
  return 'word'
}

export function toleranceFor(level: number): number {
  return Math.max(0.15, Math.min(0.55, 0.55 - (level - 1) * 0.08))
}

export function isClean(actualMs: number, idealUnits: 1 | 3 | 7, unitMs: number, level: number): boolean {
  const ideal = idealUnits * unitMs
  return Math.abs(actualMs - ideal) / ideal <= toleranceFor(level)
}

export function calibrate(firstDurationMs: number, firstIdealUnits: 1 | 3): number {
  return Math.max(MIN_UNIT_MS, Math.min(MAX_UNIT_MS, firstDurationMs / firstIdealUnits))
}

export function wpmFor(unitMs: number): number {
  return Math.round(1200 / unitMs)
}

export function multiplierFor(combo: number): number {
  return Math.min(MULTIPLIER_CAP, 1 + Math.floor(combo / MULTIPLIER_STEP))
}

export function createGame(seed: number): MorseRelayState {
  const word = pickWord(seed, 1)
  return {
    seed,
    level: 1,
    target: buildTarget(word),
    targetLabel: word,
    unitMs: null,
    pendingDownT: null,
    lastUpT: null,
    letterIndex: 0,
    symbolIndex: 0,
    enteredPattern: [],
    failed: false,
    letterAllClean: true,
    results: [],
    wordMistakes: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    wpm: 0,
    bestWpm: 0,
    lives: STARTING_LIVES,
    wordsCompleted: 0,
    mistakes: 0,
    lettersAttempted: 0,
    lettersCorrect: 0,
    lost: false,
    lastEvent: 'none',
  }
}

function isWordDone(state: MorseRelayState): boolean {
  return state.letterIndex === state.target.length
}

// -- Reducer internals --------------------------------------------------

function finalizeLetterAdvance(
  state: MorseRelayState,
  forced: boolean,
  gapEndT: number | null,
): MorseRelayState {
  const letterIndex = state.letterIndex + 1
  const lost = state.lost
  const next: MorseRelayState = {
    ...state,
    letterIndex,
    symbolIndex: 0,
    enteredPattern: [],
    failed: false,
    letterAllClean: true,
    pendingDownT: null,
    lastUpT: gapEndT,
  }

  if (lost) {
    return { ...next, lastEvent: 'gameOver' }
  }

  if (letterIndex === state.target.length) {
    const score = next.score + WORD_BONUS_UNIT * state.level + (next.wordMistakes === 0 ? CLEAN_WORD_BONUS : 0)
    const wordsCompleted = next.wordsCompleted + 1
    const bestWpm = Math.max(next.bestWpm, next.wpm)
    const level = state.level + 1
    return { ...next, score, wordsCompleted, bestWpm, level, lastEvent: 'wordComplete' }
  }

  const lastResult = next.results[next.results.length - 1]
  const lastEvent: MorseEventTag = forced ? 'timeout' : lastResult?.correct ? 'letterComplete' : 'letterMistake'
  return { ...next, lastEvent }
}

function resolveGap(state: MorseRelayState, gapMs: number, forced: boolean, gapEndT: number | null): MorseRelayState {
  const letter = state.target[state.letterIndex]
  const symbolsDone = state.symbolIndex === letter.pattern.length
  const unitMs = state.unitMs as number

  if (!symbolsDone) {
    const category = classifyGap(gapMs, unitMs)
    if (category === 'element' && !forced) {
      return state
    }
    let lives = state.lives
    let mistakes = state.mistakes
    let wordMistakes = state.wordMistakes
    let combo = state.combo
    let failed: boolean = state.failed
    let lost: boolean = state.lost
    if (!state.failed) {
      lives -= 1
      mistakes += 1
      wordMistakes += 1
      combo = 0
      failed = true
      if (lives <= 0) lost = true
    }
    const results = [...state.results, { char: letter.char, correct: false, clean: false }]
    const lettersAttempted = state.lettersAttempted + 1
    return finalizeLetterAdvance(
      { ...state, lives, mistakes, wordMistakes, combo, failed, lost, results, lettersAttempted },
      forced,
      gapEndT,
    )
  }

  // symbolsDone
  let results: LetterResult[]
  let wordMistakes = state.wordMistakes
  let mistakes = state.mistakes
  let combo = state.combo
  let maxCombo = state.maxCombo
  let score = state.score

  if (state.failed) {
    results = [...state.results, { char: letter.char, correct: false, clean: false }]
  } else {
    const category = classifyGap(gapMs, unitMs)
    const expected: GapCategory = letter.wordBreakAfter ? 'word' : 'letter'
    const delimiterOk = forced || category === expected
    if (!delimiterOk) {
      wordMistakes += 1
      mistakes += 1
      combo = 0
      results = [...state.results, { char: letter.char, correct: true, clean: false }]
    } else {
      const clean = state.letterAllClean
      if (clean) {
        combo += 1
        maxCombo = Math.max(maxCombo, combo)
        score += LETTER_BONUS * multiplierFor(combo)
      } else {
        combo = 0
      }
      results = [...state.results, { char: letter.char, correct: true, clean }]
    }
  }

  const lettersAttempted = state.lettersAttempted + 1
  const lastResult = results[results.length - 1]
  const lettersCorrect = state.lettersCorrect + (lastResult.correct ? 1 : 0)

  return finalizeLetterAdvance(
    { ...state, results, wordMistakes, mistakes, combo, maxCombo, score, lettersAttempted, lettersCorrect },
    forced,
    gapEndT,
  )
}

function applyDown(state: MorseRelayState, t: number): MorseRelayState {
  if (state.lost || isWordDone(state) || state.pendingDownT !== null) {
    return { ...state, lastEvent: 'none' }
  }
  let next = state
  if (state.lastUpT !== null) {
    const gapMs = t - state.lastUpT
    next = resolveGap(state, gapMs, false, t)
    if (next.lost || isWordDone(next)) {
      return { ...next, pendingDownT: null }
    }
  }
  // resolveGap's early-return branch (mid-letter element gap, nothing resolved)
  // hands back `state` unchanged — its `lastEvent` is stale from a prior action
  // (e.g. the 'symbolOk' from the up that just preceded this down). This down
  // itself resolved nothing, so its own event is 'none'; only report an event
  // when resolveGap actually mutated something.
  const lastEvent: MorseEventTag = next === state ? 'none' : next.lastEvent
  return { ...next, pendingDownT: t, lastEvent }
}

function applyUp(state: MorseRelayState, t: number): MorseRelayState {
  if (state.lost || isWordDone(state) || state.pendingDownT === null) {
    return { ...state, lastEvent: 'none' }
  }
  const durationMs = t - state.pendingDownT
  const letter = state.target[state.letterIndex]

  let unitMs: number
  let wpm: number
  if (state.unitMs === null) {
    const firstIdealUnits: 1 | 3 = letter.pattern[0] === '.' ? 1 : 3
    unitMs = calibrate(durationMs, firstIdealUnits)
    wpm = wpmFor(unitMs)
  } else {
    unitMs = state.unitMs
    wpm = state.wpm
  }

  const symbol = classifySymbol(durationMs, unitMs)
  const enteredPattern = [...state.enteredPattern, symbol]
  const lastUpT = t

  const expected: Symbol | undefined = state.failed ? undefined : letter.pattern[state.symbolIndex]
  if (state.failed || expected === undefined || expected !== symbol) {
    let lives = state.lives
    let mistakes = state.mistakes
    let wordMistakes = state.wordMistakes
    let combo = state.combo
    let failed: boolean = state.failed
    let lost: boolean = state.lost
    if (!state.failed) {
      lives -= 1
      mistakes += 1
      wordMistakes += 1
      combo = 0
      failed = true
      if (lives <= 0) lost = true
    }
    return {
      ...state,
      unitMs,
      wpm,
      enteredPattern,
      pendingDownT: null,
      lastUpT,
      lives,
      mistakes,
      wordMistakes,
      combo,
      failed: true,
      lost,
      lastEvent: lost ? 'gameOver' : 'symbolMistake',
    }
  }

  const idealUnits: 1 | 3 = symbol === '.' ? 1 : 3
  const clean = isClean(durationMs, idealUnits, unitMs, state.level)
  const letterAllClean = state.letterAllClean && clean
  const symbolIndex = state.symbolIndex + 1
  let combo = state.combo
  let maxCombo = state.maxCombo
  let score = state.score
  if (clean) {
    combo += 1
    maxCombo = Math.max(maxCombo, combo)
    score += SYMBOL_POINTS * multiplierFor(combo)
  } else {
    combo = 0
    score += SYMBOL_POINTS
  }

  return {
    ...state,
    unitMs,
    wpm,
    enteredPattern,
    pendingDownT: null,
    lastUpT,
    symbolIndex,
    letterAllClean,
    combo,
    maxCombo,
    score,
    lastEvent: 'symbolOk',
  }
}

function applyTick(state: MorseRelayState, t: number): MorseRelayState {
  if (
    state.lost ||
    isWordDone(state) ||
    state.pendingDownT !== null ||
    state.lastUpT === null ||
    state.unitMs === null
  ) {
    return { ...state, lastEvent: 'none' }
  }
  const elapsed = t - state.lastUpT
  const letter = state.target[state.letterIndex]
  const isLastLetter = state.letterIndex === state.target.length - 1
  const symbolsDone = state.symbolIndex === letter.pattern.length

  if (isLastLetter && symbolsDone && elapsed >= GAP_ELEMENT_BOUNDARY_UNITS * state.unitMs) {
    return resolveGap(state, elapsed, true, t)
  }
  if (elapsed >= ABANDON_MS) {
    return resolveGap(state, elapsed, true, t)
  }
  return { ...state, lastEvent: 'none' }
}

function applyNextWord(state: MorseRelayState, _t: number): MorseRelayState {
  if (state.lost || state.letterIndex !== state.target.length) {
    return { ...state, lastEvent: 'none' }
  }
  const word = pickWord(state.seed, state.level)
  return {
    ...state,
    target: buildTarget(word),
    targetLabel: word,
    unitMs: null,
    pendingDownT: null,
    lastUpT: null,
    letterIndex: 0,
    symbolIndex: 0,
    enteredPattern: [],
    failed: false,
    letterAllClean: true,
    results: [],
    wordMistakes: 0,
    wpm: 0,
    lastEvent: 'none',
  }
}

export function reduce(state: MorseRelayState, action: MorseRelayAction): MorseRelayState {
  switch (action.type) {
    case 'down':
      return applyDown(state, action.t)
    case 'up':
      return applyUp(state, action.t)
    case 'tick':
      return applyTick(state, action.t)
    case 'nextWord':
      return applyNextWord(state, action.t)
    case 'reset':
      return createGame(action.seed)
    default:
      return state
  }
}
