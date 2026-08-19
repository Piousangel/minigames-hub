import { describe, expect, it } from 'vitest'
import {
  ABANDON_MS,
  GAP_ELEMENT_BOUNDARY_UNITS,
  GAP_WORD_BOUNDARY_UNITS,
  MAX_UNIT_MS,
  MIN_UNIT_MS,
  MORSE_TABLE,
  MULTIPLIER_CAP,
  STARTING_LIVES,
  SYMBOL_BOUNDARY_UNITS,
  WORD_BUCKETS,
  buildTarget,
  calibrate,
  classifyGap,
  classifySymbol,
  createGame,
  isClean,
  mixSeed,
  mulberry32,
  multiplierFor,
  pickWord,
  reduce,
  toleranceFor,
  wordBucketIndex,
  wpmFor,
  type MorseRelayAction,
  type MorseRelayState,
} from './engine'

/** Drive a sequence of actions through the reducer, returning the final state. */
function run(state: MorseRelayState, actions: MorseRelayAction[]): MorseRelayState {
  return actions.reduce(reduce, state)
}

// -- Pure helpers ---------------------------------------------------------

describe('mulberry32', () => {
  it('is deterministic for a fixed seed and stays within [0,1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('mixSeed', () => {
  it('is the identity XOR when level is 0 (Math.imul(0, k) === 0)', () => {
    expect(mixSeed(1234, 0)).toBe(1234)
    expect(mixSeed(0, 0)).toBe(0)
  })

  it('matches a hand-traced golden value for a non-trivial seed/level pair', () => {
    // Cross-checked directly against the engine's own mulberry32/mixSeed pairing.
    expect(mixSeed(14, 1)).toBe(2654435767)
  })

  it('differs across levels for the same seed (so each level gets its own word draw)', () => {
    expect(mixSeed(14, 1)).not.toBe(mixSeed(14, 2))
    expect(mixSeed(14, 2)).not.toBe(mixSeed(14, 3))
  })
})

describe('wordBucketIndex', () => {
  it('clamps level-1 into [0, WORD_BUCKETS.length-1]', () => {
    expect(wordBucketIndex(0)).toBe(0) // level-1 = -1 -> clamped to 0
    expect(wordBucketIndex(1)).toBe(0)
    expect(wordBucketIndex(2)).toBe(1)
    expect(wordBucketIndex(3)).toBe(2)
    expect(wordBucketIndex(4)).toBe(3)
    expect(wordBucketIndex(5)).toBe(3) // beyond the last bucket, clamped
    expect(wordBucketIndex(100)).toBe(WORD_BUCKETS.length - 1)
  })
})

describe('pickWord — golden', () => {
  it('reproduces exact golden words for hand-verified seed/level pairs', () => {
    expect(pickWord(0, 1)).toBe('CQ')
    expect(pickWord(1, 1)).toBe('HI')
    expect(pickWord(42, 1)).toBe('CQ')
    expect(pickWord(14, 1)).toBe('SOS')
    expect(pickWord(14, 2)).toBe('OVER')
    expect(pickWord(14, 3)).toBe('TOWER')
    expect(pickWord(14, 4)).toBe('ROGER OUT')
  })

  it('is deterministic (same seed/level always draws the same word)', () => {
    expect(pickWord(14, 1)).toBe(pickWord(14, 1))
    expect(pickWord(7, 3)).toBe(pickWord(7, 3))
  })

  it('always draws from the level-appropriate bucket', () => {
    for (const [seed, level] of [
      [0, 1],
      [14, 1],
      [14, 2],
      [14, 3],
      [14, 4],
      [7, 2],
    ] as [number, number][]) {
      expect(WORD_BUCKETS[wordBucketIndex(level)]).toContain(pickWord(seed, level))
    }
  })
})

describe('buildTarget', () => {
  it('builds a single-word target with wordBreakAfter always false', () => {
    const target = buildTarget('SOS')
    expect(target).toEqual([
      { char: 'S', pattern: ['.', '.', '.'], wordBreakAfter: false },
      { char: 'O', pattern: ['-', '-', '-'], wordBreakAfter: false },
      { char: 'S', pattern: ['.', '.', '.'], wordBreakAfter: false },
    ])
  })

  it('marks wordBreakAfter true exactly on the letter preceding a space, and drops spaces', () => {
    const target = buildTarget('AB CD')
    expect(target.map((l) => l.char)).toEqual(['A', 'B', 'C', 'D'])
    expect(target.map((l) => l.wordBreakAfter)).toEqual([false, true, false, false])
  })

  it('is case-insensitive', () => {
    expect(buildTarget('sos')).toEqual(buildTarget('SOS'))
  })

  it('silently skips characters with no MORSE_TABLE entry', () => {
    const target = buildTarget('A1B')
    expect(target.map((l) => l.char)).toEqual(['A', 'B'])
  })

  it('every buildTarget pattern for A-Z matches MORSE_TABLE exactly', () => {
    for (const ch of Object.keys(MORSE_TABLE)) {
      expect(buildTarget(ch)[0].pattern).toEqual(MORSE_TABLE[ch])
    }
  })
})

describe('classifySymbol — boundary at SYMBOL_BOUNDARY_UNITS', () => {
  it('is a dot at and below the boundary, a dash just beyond it', () => {
    const unitMs = 100
    const boundary = SYMBOL_BOUNDARY_UNITS * unitMs // 200
    expect(classifySymbol(boundary, unitMs)).toBe('.')
    expect(classifySymbol(boundary + 1, unitMs)).toBe('-')
  })

  it('classifies a very short hold as a dot and a very long hold as a dash', () => {
    expect(classifySymbol(1, 100)).toBe('.')
    expect(classifySymbol(10000, 100)).toBe('-')
  })
})

describe('classifyGap — boundaries', () => {
  const unitMs = 100

  it('element boundary: at GAP_ELEMENT_BOUNDARY_UNITS is element, just beyond is letter', () => {
    const boundary = GAP_ELEMENT_BOUNDARY_UNITS * unitMs // 200
    expect(classifyGap(boundary, unitMs)).toBe('element')
    expect(classifyGap(boundary + 1, unitMs)).toBe('letter')
  })

  it('word boundary: at GAP_WORD_BOUNDARY_UNITS is letter, just beyond is word', () => {
    const boundary = GAP_WORD_BOUNDARY_UNITS * unitMs // 500
    expect(classifyGap(boundary, unitMs)).toBe('letter')
    expect(classifyGap(boundary + 1, unitMs)).toBe('word')
  })

  it('a near-zero gap is an element gap', () => {
    expect(classifyGap(0, unitMs)).toBe('element')
  })
})

describe('toleranceFor', () => {
  it('matches the exact linear formula, clamped to [0.15, 0.55]', () => {
    expect(toleranceFor(1)).toBe(0.55)
    expect(toleranceFor(2)).toBeCloseTo(0.47, 10)
    expect(toleranceFor(3)).toBeCloseTo(0.39, 10)
    expect(toleranceFor(4)).toBeCloseTo(0.31, 10)
    expect(toleranceFor(5)).toBeCloseTo(0.23, 10)
    expect(toleranceFor(6)).toBeCloseTo(0.15, 10) // exact clamp floor (float noise: 0.55-0.4)
    expect(toleranceFor(7)).toBe(0.15) // formula would go to 0.07, clamped — well clear of float noise
    expect(toleranceFor(50)).toBe(0.15)
  })
})

describe('isClean', () => {
  it('boundary at exactly tolerance is clean; one ms beyond is not (idealUnits=1)', () => {
    // unitMs=100, level=1 -> tolerance 0.55 -> ideal=100, boundary offset = 55
    expect(isClean(155, 1, 100, 1)).toBe(true)
    expect(isClean(156, 1, 100, 1)).toBe(false)
    expect(isClean(45, 1, 100, 1)).toBe(true) // symmetric on the low side
    expect(isClean(44, 1, 100, 1)).toBe(false)
  })

  it('a dead-on-target duration is always clean regardless of idealUnits', () => {
    expect(isClean(100, 1, 100, 1)).toBe(true)
    expect(isClean(300, 3, 100, 1)).toBe(true)
    expect(isClean(700, 7, 100, 1)).toBe(true)
  })

  it('scales the tolerance window with idealUnits (3 and 7 accepted per the type)', () => {
    // idealUnits=3 -> ideal=300, boundary offset = 165 (0.55*300)
    expect(isClean(465, 3, 100, 1)).toBe(true)
    expect(isClean(466, 3, 100, 1)).toBe(false)
    // idealUnits=7 -> ideal=700, boundary offset = 385 (0.55*700)
    expect(isClean(1085, 7, 100, 1)).toBe(true)
    expect(isClean(1086, 7, 100, 1)).toBe(false)
  })

  it('tightens with level (less tolerant at higher levels)', () => {
    // 150ms vs ideal 100 at unitMs=100 is 50% off.
    expect(isClean(150, 1, 100, 1)).toBe(true) // tolerance .55 at level 1
    expect(isClean(150, 1, 100, 3)).toBe(false) // tolerance .39 at level 3
  })
})

describe('calibrate', () => {
  it('divides duration by idealUnits within the normal range', () => {
    expect(calibrate(100, 1)).toBe(100)
    expect(calibrate(300, 3)).toBe(100)
  })

  it('clamps to MIN_UNIT_MS for very short first presses', () => {
    expect(calibrate(1, 1)).toBe(MIN_UNIT_MS)
    expect(calibrate(90, 3)).toBe(MIN_UNIT_MS) // 30 < 40
  })

  it('clamps to MAX_UNIT_MS for very long first presses', () => {
    expect(calibrate(10000, 1)).toBe(MAX_UNIT_MS)
    expect(calibrate(3000, 3)).toBe(MAX_UNIT_MS) // 1000 > 600
  })
})

describe('wpmFor', () => {
  it('matches the exact 1200/unitMs rounding formula', () => {
    expect(wpmFor(100)).toBe(12)
    expect(wpmFor(MIN_UNIT_MS)).toBe(30) // 1200/40 = 30 exactly
    expect(wpmFor(MAX_UNIT_MS)).toBe(2) // 1200/600 = 2 exactly
    expect(wpmFor(90)).toBe(13) // 13.33 rounds to 13
  })
})

describe('multiplierFor', () => {
  it('steps every MULTIPLIER_STEP combo and caps at MULTIPLIER_CAP', () => {
    expect(multiplierFor(0)).toBe(1)
    expect(multiplierFor(4)).toBe(1)
    expect(multiplierFor(5)).toBe(2)
    expect(multiplierFor(9)).toBe(2)
    expect(multiplierFor(10)).toBe(3)
    expect(multiplierFor(24)).toBe(5) // 1+floor(24/5)=5, at the cap already
    expect(multiplierFor(25)).toBe(MULTIPLIER_CAP) // formula gives 6, capped to 5
    expect(multiplierFor(100)).toBe(MULTIPLIER_CAP)
  })
})

// -- createGame / reduce plumbing -----------------------------------------

describe('createGame', () => {
  it('starts with the documented initial shape', () => {
    const s = createGame(14)
    expect(s.seed).toBe(14)
    expect(s.level).toBe(1)
    expect(s.targetLabel).toBe('SOS')
    expect(s.target).toEqual(buildTarget('SOS'))
    expect(s.unitMs).toBeNull()
    expect(s.pendingDownT).toBeNull()
    expect(s.lastUpT).toBeNull()
    expect(s.letterIndex).toBe(0)
    expect(s.symbolIndex).toBe(0)
    expect(s.enteredPattern).toEqual([])
    expect(s.failed).toBe(false)
    expect(s.letterAllClean).toBe(true)
    expect(s.results).toEqual([])
    expect(s.wordMistakes).toBe(0)
    expect(s.combo).toBe(0)
    expect(s.maxCombo).toBe(0)
    expect(s.score).toBe(0)
    expect(s.wpm).toBe(0)
    expect(s.bestWpm).toBe(0)
    expect(s.lives).toBe(STARTING_LIVES)
    expect(s.wordsCompleted).toBe(0)
    expect(s.mistakes).toBe(0)
    expect(s.lettersAttempted).toBe(0)
    expect(s.lettersCorrect).toBe(0)
    expect(s.lost).toBe(false)
    expect(s.lastEvent).toBe('none')
  })
})

describe('reduce — unknown action', () => {
  it('falls through to the default branch and returns the same state reference', () => {
    const s = createGame(1)
    const bogus = { type: 'bogus' } as unknown as MorseRelayAction
    expect(reduce(s, bogus)).toBe(s)
  })
})

describe('reduce — reset', () => {
  it('always rebuilds via createGame(seed), discarding all prior state', () => {
    let s = createGame(14)
    s = run(s, [{ type: 'down', t: 0 }, { type: 'up', t: 100 }])
    expect(s.score).toBeGreaterThan(0)
    const reset = reduce(s, { type: 'reset', seed: 99 })
    expect(reset).toEqual(createGame(99))
  })
})

// -- Guard / no-op paths ----------------------------------------------------

describe('applyDown — guards', () => {
  it('is a no-op (lastEvent none) when the game is already lost', () => {
    const s = { ...createGame(14), lost: true }
    const next = reduce(s, { type: 'down', t: 100 })
    expect(next).toEqual({ ...s, lastEvent: 'none' })
  })

  it('is a no-op when the word is already done (awaiting nextWord)', () => {
    const s = { ...createGame(14), letterIndex: 3 } // target.length === 3
    const next = reduce(s, { type: 'down', t: 100 })
    expect(next).toEqual({ ...s, lastEvent: 'none' })
  })

  it('is a no-op (ignores a duplicate down) when a key is already held', () => {
    const s = { ...createGame(14), pendingDownT: 50 }
    const next = reduce(s, { type: 'down', t: 100 })
    expect(next.pendingDownT).toBe(50) // unchanged, first down wins
    expect(next.lastEvent).toBe('none')
  })
})

describe('applyDown — stale lastEvent subtlety (the documented "nothing resolved" path)', () => {
  it('reports lastEvent "none" on a down that resolves nothing, not the previous up\'s event', () => {
    let s = createGame(14) // SOS
    s = reduce(s, { type: 'down', t: 0 })
    s = reduce(s, { type: 'up', t: 100 }) // calibrates, clean dot -> lastEvent 'symbolOk'
    expect(s.lastEvent).toBe('symbolOk')

    // Short (element) gap: resolveGap's early-return path hands back `state`
    // unchanged (still carrying 'symbolOk' internally) — applyDown must not
    // leak that stale tag back out as this down's own event.
    const next = reduce(s, { type: 'down', t: 150 })
    expect(next.lastEvent).toBe('none')
    // Confirm nothing else about the mid-letter progress was disturbed either.
    expect(next.symbolIndex).toBe(s.symbolIndex)
    expect(next.letterIndex).toBe(s.letterIndex)
  })
})

describe('applyUp — guards', () => {
  it('is a no-op when the game is already lost', () => {
    const s = { ...createGame(14), lost: true }
    const next = reduce(s, { type: 'up', t: 100 })
    expect(next).toEqual({ ...s, lastEvent: 'none' })
  })

  it('is a no-op when the word is already done', () => {
    const s = { ...createGame(14), letterIndex: 3 }
    const next = reduce(s, { type: 'up', t: 100 })
    expect(next).toEqual({ ...s, lastEvent: 'none' })
  })

  it('is a no-op when there is no matching down (pendingDownT is null)', () => {
    const s = createGame(14)
    const next = reduce(s, { type: 'up', t: 100 })
    expect(next).toEqual({ ...s, lastEvent: 'none' })
  })
})

describe('applyTick — guards', () => {
  it('is a no-op when the game is already lost', () => {
    const s = { ...createGame(14), lost: true }
    expect(reduce(s, { type: 'tick', t: 999999 })).toEqual({ ...s, lastEvent: 'none' })
  })

  it('is a no-op when the word is already done', () => {
    const s = { ...createGame(14), letterIndex: 3 }
    expect(reduce(s, { type: 'tick', t: 999999 })).toEqual({ ...s, lastEvent: 'none' })
  })

  it('is a no-op while a key is currently held down', () => {
    let s = createGame(14)
    s = reduce(s, { type: 'down', t: 0 })
    s = reduce(s, { type: 'up', t: 100 })
    s = reduce(s, { type: 'down', t: 150 }) // holding again
    const next = reduce(s, { type: 'tick', t: 150 + ABANDON_MS })
    expect(next.pendingDownT).toBe(150) // still held, tick can't resolve a timeout mid-hold
    expect(next.lastEvent).toBe('none')
  })

  it('is a no-op before the first symbol has calibrated unitMs', () => {
    const s = createGame(14)
    expect(reduce(s, { type: 'tick', t: 999999 })).toEqual({ ...s, lastEvent: 'none' })
  })
})

describe('applyNextWord — guards', () => {
  it('is a no-op when the current word is not yet finished', () => {
    const s = createGame(14) // letterIndex 0, target.length 3
    const next = reduce(s, { type: 'nextWord', t: 0 })
    expect(next).toEqual({ ...s, lastEvent: 'none' })
  })

  it('is a no-op when the game is lost, even if the word looks finished', () => {
    const s = { ...createGame(14), letterIndex: 3, lost: true }
    const next = reduce(s, { type: 'nextWord', t: 0 })
    expect(next).toEqual({ ...s, lastEvent: 'none' })
  })
})

// -- First-press calibration semantics --------------------------------------

describe('calibration — the first symbol of the first letter can never itself be a mismatch', () => {
  it('any in-range duration for a dot-first letter always classifies as the expected dot', () => {
    for (const d of [MIN_UNIT_MS, 55, 100, 599, MAX_UNIT_MS]) {
      let s = createGame(14) // SOS: first symbol is '.'
      s = reduce(s, { type: 'down', t: 0 })
      s = reduce(s, { type: 'up', t: d })
      expect(s.lastEvent).toBe('symbolOk')
      expect(s.unitMs).toBe(d)
    }
  })

  it('any in-range duration for a dash-first letter always classifies as the expected dash', () => {
    for (const d of [120, 300, 1800]) {
      let s = createGame(14) // fresh SOS but retarget to an 'O'-first word manually
      s = { ...s, target: buildTarget('OVER'), targetLabel: 'OVER' }
      s = reduce(s, { type: 'down', t: 0 })
      s = reduce(s, { type: 'up', t: d })
      expect(s.lastEvent).toBe('symbolOk')
    }
  })

  it('counterexample: an extremely short first dash-press gets clamped to MIN_UNIT_MS and can misclassify', () => {
    let s = createGame(14)
    s = { ...s, target: buildTarget('OVER'), targetLabel: 'OVER' } // first symbol '-', idealUnits 3
    s = reduce(s, { type: 'down', t: 0 })
    s = reduce(s, { type: 'up', t: 60 }) // 60/3=20 < MIN_UNIT_MS -> clamped to 40
    expect(s.unitMs).toBe(MIN_UNIT_MS)
    // classifySymbol(60, 40): boundary = 80, 60 <= 80 -> '.', but the letter expected '-'.
    expect(s.lastEvent).toBe('symbolMistake')
  })
})

// -- Mistakes, deduction semantics, and delimiters ---------------------------

describe('a correct-but-unclean symbol resets combo without costing a life', () => {
  it('scores flat SYMBOL_POINTS and resets combo when timing is outside tolerance', () => {
    let s = createGame(14)
    s = reduce(s, { type: 'down', t: 0 })
    s = reduce(s, { type: 'up', t: 100 }) // calibrates unitMs=100, clean dot, combo 1
    expect(s.combo).toBe(1)
    s = reduce(s, { type: 'down', t: 150 })
    s = reduce(s, { type: 'up', t: 150 + 180 }) // classifySymbol(180,100)='.': correct but not clean (tol 55)
    expect(s.lastEvent).toBe('symbolOk')
    expect(s.letterAllClean).toBe(false)
    expect(s.combo).toBe(0) // reset, not incremented
    expect(s.lives).toBe(STARTING_LIVES) // no life lost for an unclean-but-correct symbol
    expect(s.score).toBe(20) // 10 (clean, x1) + 10 (flat, unclean)
  })
})

describe('a wrong symbol (not the calibrating first press) costs exactly one life', () => {
  it('sets failed/symbolMistake, resets combo, and does not double-deduct on a second wrong attempt', () => {
    let s = createGame(14) // SOS
    s = reduce(s, { type: 'down', t: 0 })
    s = reduce(s, { type: 'up', t: 100 }) // calibrates unitMs=100, correct dot
    s = reduce(s, { type: 'down', t: 150 })
    s = reduce(s, { type: 'up', t: 150 + 1100 }) // 1100ms -> classifies '-', expected '.'
    expect(s.lastEvent).toBe('symbolMistake')
    expect(s.failed).toBe(true)
    expect(s.combo).toBe(0)
    expect(s.lives).toBe(STARTING_LIVES - 1)
    expect(s.mistakes).toBe(1)

    // A further wrong attempt within the same already-failed letter must not
    // deduct a second life.
    s = reduce(s, { type: 'down', t: 1300 })
    s = reduce(s, { type: 'up', t: 1330 })
    expect(s.lastEvent).toBe('symbolMistake')
    expect(s.lives).toBe(STARTING_LIVES - 1) // unchanged
    expect(s.mistakes).toBe(1) // unchanged

    // Closing the letter out via a letter gap resolves it as a single mistake.
    s = reduce(s, { type: 'down', t: 1630 })
    expect(s.lastEvent).toBe('letterMistake')
    expect(s.results.at(-1)).toEqual({ char: 'S', correct: false, clean: false })
    expect(s.lives).toBe(STARTING_LIVES - 1) // still only one life lost total
    expect(s.letterIndex).toBe(1)
  })
})

describe('a wrong delimiter (correct symbols, mistimed gap category) costs no life', () => {
  it('still marks the letter correct, but flags a word mistake and resets combo', () => {
    let s = createGame(14) // SOS, level 1
    s = run(s, [
      { type: 'down', t: 0 },
      { type: 'up', t: 100 }, // clean dot, calibrates unitMs=100
      { type: 'down', t: 150 },
      { type: 'up', t: 250 }, // clean dot
      { type: 'down', t: 300 },
      { type: 'up', t: 400 }, // clean dot, symbols done for S (letter.wordBreakAfter=false -> expects 'letter' gap)
    ])
    expect(s.combo).toBe(3)
    // 600ms gap classifies as 'word' (>500), but 'letter' was expected.
    const next = reduce(s, { type: 'down', t: 1000 })
    expect(next.lastEvent).toBe('letterComplete') // still correct, so not 'letterMistake'
    expect(next.results.at(-1)).toEqual({ char: 'S', correct: true, clean: false })
    expect(next.wordMistakes).toBe(1)
    expect(next.mistakes).toBe(1)
    expect(next.combo).toBe(0)
    expect(next.lives).toBe(STARTING_LIVES) // no life lost for a delimiter-only mistake
  })
})

describe('timeout via ABANDON_MS while still mid-symbols (non-last letter)', () => {
  it('does nothing just under the abandon threshold, then force-resolves as a timeout mistake', () => {
    let s = createGame(14)
    s = reduce(s, { type: 'down', t: 0 })
    s = reduce(s, { type: 'up', t: 100 }) // calibrates, symbolIndex 1 of 3 (not done)

    const justUnder = reduce(s, { type: 'tick', t: 100 + ABANDON_MS - 1 })
    expect(justUnder.lastEvent).toBe('none')
    expect(justUnder.letterIndex).toBe(0) // still waiting

    const atThreshold = reduce(s, { type: 'tick', t: 100 + ABANDON_MS })
    expect(atThreshold.lastEvent).toBe('timeout')
    expect(atThreshold.lives).toBe(STARTING_LIVES - 1)
    expect(atThreshold.letterIndex).toBe(1)
    expect(atThreshold.results.at(-1)).toEqual({ char: 'S', correct: false, clean: false })
  })
})

describe('the last-letter early-resolve tick rule applies only to the final letter', () => {
  it('does NOT force-resolve a completed non-last letter at the (short) element-gap boundary', () => {
    let s = createGame(14) // SOS: letter 0 (S) is not the last letter
    s = run(s, [
      { type: 'down', t: 0 },
      { type: 'up', t: 100 },
      { type: 'down', t: 150 },
      { type: 'up', t: 250 },
      { type: 'down', t: 300 },
      { type: 'up', t: 400 }, // S symbols all done, letterIndex still 0 (not last letter, index 2 is)
    ])
    const next = reduce(s, { type: 'tick', t: 400 + GAP_ELEMENT_BOUNDARY_UNITS * 100 + 5 }) // 205ms > element boundary
    expect(next.lastEvent).toBe('none') // must wait for a real letter-gap 'down' or full ABANDON_MS
    expect(next.letterIndex).toBe(0)
  })

  it('DOES force-resolve the completed last letter shortly after the element-gap boundary', () => {
    // Build directly on a state where the only letter is also the last letter.
    const base: MorseRelayState = {
      ...createGame(1),
      target: buildTarget('E'),
      targetLabel: 'E',
      letterIndex: 0,
      symbolIndex: 1, // E's single '.' already keyed
      unitMs: 100,
      lastUpT: 0,
      pendingDownT: null,
      letterAllClean: true,
      results: [],
      failed: false,
    }
    const next = reduce(base, { type: 'tick', t: 250 }) // 250ms > 2*unitMs(200), well under ABANDON_MS
    expect(next.lastEvent).toBe('wordComplete')
    expect(next.wordsCompleted).toBe(1)
  })
})

// -- Game over / lost transitions --------------------------------------------

describe('losing the last life', () => {
  it('a wrong symbol on the final life reports "gameOver" instead of "symbolMistake"', () => {
    let s = createGame(14)
    s = reduce(s, { type: 'down', t: 0 })
    s = reduce(s, { type: 'up', t: 100 }) // calibrate, correct dot
    s = { ...s, lives: 1 }
    s = reduce(s, { type: 'down', t: 150 })
    s = reduce(s, { type: 'up', t: 150 + 500 }) // wrong symbol
    expect(s.lives).toBe(0)
    expect(s.lost).toBe(true)
    expect(s.lastEvent).toBe('gameOver')
  })

  it('a mid-symbol abandon timeout on the final life reports "gameOver" instead of "timeout"', () => {
    let s = createGame(14)
    s = reduce(s, { type: 'down', t: 0 })
    s = reduce(s, { type: 'up', t: 100 }) // calibrate, correct dot
    s = { ...s, lives: 1 }
    const next = reduce(s, { type: 'tick', t: 100 + ABANDON_MS }) // no interleaved down -> real abandon
    expect(next.lives).toBe(0)
    expect(next.lost).toBe(true)
    expect(next.lastEvent).toBe('gameOver')
  })

  it('once lost, further input is inert', () => {
    let s = createGame(14)
    s = reduce(s, { type: 'down', t: 0 })
    s = reduce(s, { type: 'up', t: 100 })
    s = { ...s, lives: 1 }
    s = reduce(s, { type: 'tick', t: 100 + ABANDON_MS })
    expect(s.lost).toBe(true)
    const afterDown = reduce(s, { type: 'down', t: 999999 })
    expect(afterDown.lastEvent).toBe('none')
    expect(afterDown.lives).toBe(0)
  })
})

// -- applyNextWord field reset/persistence split -----------------------------

describe('applyNextWord — resets per-word fields, persists run fields', () => {
  it('matches the documented split exactly on a real wordComplete transition', () => {
    let s = createGame(14) // SOS
    s = run(s, [
      { type: 'down', t: 0 },
      { type: 'up', t: 100 },
      { type: 'down', t: 150 },
      { type: 'up', t: 250 },
      { type: 'down', t: 300 },
      { type: 'up', t: 400 },
      { type: 'down', t: 700 },
      { type: 'up', t: 1000 },
      { type: 'down', t: 1050 },
      { type: 'up', t: 1350 },
      { type: 'down', t: 1400 },
      { type: 'up', t: 1700 },
      { type: 'down', t: 2000 },
      { type: 'up', t: 2100 },
      { type: 'down', t: 2150 },
      { type: 'up', t: 2250 },
      { type: 'down', t: 2300 },
      { type: 'up', t: 2400 },
      { type: 'tick', t: 2700 },
    ])
    expect(s.lastEvent).toBe('wordComplete')
    expect(s.level).toBe(2)
    expect(s.score).toBe(760)
    expect(s.wordsCompleted).toBe(1)
    expect(s.bestWpm).toBe(12)
    expect(s.combo).toBe(12)

    const next = reduce(s, { type: 'nextWord', t: 3000 })
    // Per-word fields reset:
    expect(next.targetLabel).toBe('OVER') // pickWord(14, 2)
    expect(next.target).toEqual(buildTarget('OVER'))
    expect(next.unitMs).toBeNull()
    expect(next.pendingDownT).toBeNull()
    expect(next.lastUpT).toBeNull()
    expect(next.letterIndex).toBe(0)
    expect(next.symbolIndex).toBe(0)
    expect(next.enteredPattern).toEqual([])
    expect(next.failed).toBe(false)
    expect(next.letterAllClean).toBe(true)
    expect(next.results).toEqual([])
    expect(next.wordMistakes).toBe(0)
    expect(next.wpm).toBe(0)
    expect(next.lastEvent).toBe('none')
    // Run fields persist:
    expect(next.score).toBe(s.score)
    expect(next.lives).toBe(s.lives)
    expect(next.level).toBe(s.level)
    expect(next.combo).toBe(s.combo)
    expect(next.maxCombo).toBe(s.maxCombo)
    expect(next.bestWpm).toBe(s.bestWpm)
    expect(next.mistakes).toBe(s.mistakes)
    expect(next.wordsCompleted).toBe(s.wordsCompleted)
    expect(next.lettersAttempted).toBe(s.lettersAttempted)
    expect(next.lettersCorrect).toBe(s.lettersCorrect)
  })

  it('bestWpm is a max, not an overwrite: a higher prior bestWpm survives a slower word', () => {
    const base: MorseRelayState = {
      ...createGame(1),
      target: buildTarget('E'),
      targetLabel: 'E',
      letterIndex: 0,
      symbolIndex: 1,
      unitMs: 100,
      lastUpT: 0,
      pendingDownT: null,
      wpm: 12,
      bestWpm: 50,
      letterAllClean: true,
      results: [],
      failed: false,
    }
    const next = reduce(base, { type: 'tick', t: 250 })
    expect(next.lastEvent).toBe('wordComplete')
    expect(next.wpm).toBe(12)
    expect(next.bestWpm).toBe(50) // preserved, higher than this word's 12
  })

  it('bestWpm is raised when this word is faster than the prior best', () => {
    const base: MorseRelayState = {
      ...createGame(1),
      target: buildTarget('E'),
      targetLabel: 'E',
      letterIndex: 0,
      symbolIndex: 1,
      unitMs: 100,
      lastUpT: 0,
      pendingDownT: null,
      wpm: 12,
      bestWpm: 5,
      letterAllClean: true,
      results: [],
      failed: false,
    }
    const next = reduce(base, { type: 'tick', t: 250 })
    expect(next.bestWpm).toBe(12)
  })
})

// -- Full golden session ------------------------------------------------------

describe('golden full session — transmitting "SOS" cleanly at level 1 (seed 14)', () => {
  it('reproduces exact score/lastEvent/combo/lives at every step, ending in a clean wordComplete', () => {
    let s = createGame(14)
    expect(s.targetLabel).toBe('SOS')

    s = reduce(s, { type: 'down', t: 0 })
    expect(s.lastEvent).toBe('none')

    s = reduce(s, { type: 'up', t: 100 }) // calibrates unitMs=100, clean dot #1
    expect(s).toMatchObject({ unitMs: 100, wpm: 12, combo: 1, score: 10, lastEvent: 'symbolOk' })

    s = reduce(s, { type: 'down', t: 150 }) // element gap, nothing resolved
    expect(s.lastEvent).toBe('none')

    s = reduce(s, { type: 'up', t: 250 }) // clean dot #2
    expect(s).toMatchObject({ combo: 2, score: 20, lastEvent: 'symbolOk' })

    s = reduce(s, { type: 'down', t: 300 })
    s = reduce(s, { type: 'up', t: 400 }) // clean dot #3, S symbols done
    expect(s).toMatchObject({ combo: 3, score: 30, symbolIndex: 3, lastEvent: 'symbolOk' })

    s = reduce(s, { type: 'down', t: 700 }) // 300ms letter-gap -> resolves S, clean
    expect(s).toMatchObject({
      letterIndex: 1,
      combo: 4,
      score: 70,
      lastEvent: 'letterComplete',
    })
    expect(s.results).toEqual([{ char: 'S', correct: true, clean: true }])

    s = reduce(s, { type: 'up', t: 1000 }) // O dash #1, clean
    expect(s).toMatchObject({ combo: 5, score: 90, lastEvent: 'symbolOk' })

    s = reduce(s, { type: 'down', t: 1050 })
    s = reduce(s, { type: 'up', t: 1350 }) // O dash #2
    expect(s).toMatchObject({ combo: 6, score: 110 })

    s = reduce(s, { type: 'down', t: 1400 })
    s = reduce(s, { type: 'up', t: 1700 }) // O dash #3, symbols done
    expect(s).toMatchObject({ combo: 7, score: 130 })

    s = reduce(s, { type: 'down', t: 2000 }) // letter gap resolves O, clean
    expect(s).toMatchObject({ letterIndex: 2, combo: 8, score: 210, lastEvent: 'letterComplete' })

    s = reduce(s, { type: 'up', t: 2100 }) // final S, dot #1
    expect(s).toMatchObject({ combo: 9, score: 230 })

    s = reduce(s, { type: 'down', t: 2150 })
    s = reduce(s, { type: 'up', t: 2250 }) // dot #2
    expect(s).toMatchObject({ combo: 10, score: 260 })

    s = reduce(s, { type: 'down', t: 2300 })
    s = reduce(s, { type: 'up', t: 2400 }) // dot #3, symbols done, letterIndex 2 IS the last letter
    expect(s).toMatchObject({ combo: 11, score: 290, symbolIndex: 3 })

    // No further down comes; the rAF-driven tick loop must close out the word.
    s = reduce(s, { type: 'tick', t: 2700 }) // 300ms elapsed, last-letter early-resolve rule fires
    expect(s).toMatchObject({
      level: 2,
      letterIndex: 3,
      combo: 12,
      maxCombo: 12,
      score: 760, // 290 + LETTER_BONUS*mult(40*3=120) + WORD_BONUS_UNIT*level(200) + CLEAN_WORD_BONUS(150)
      wpm: 12,
      bestWpm: 12,
      wordsCompleted: 1,
      mistakes: 0,
      lastEvent: 'wordComplete',
      lost: false,
    })
    expect(s.results).toEqual([
      { char: 'S', correct: true, clean: true },
      { char: 'O', correct: true, clean: true },
      { char: 'S', correct: true, clean: true },
    ])
  })
})
