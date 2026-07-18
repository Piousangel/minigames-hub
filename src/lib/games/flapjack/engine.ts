/**
 * Flapjack — pure engine.
 *
 * A pancake-sorting (prefix reversal) puzzle. The stack holds `n` pancakes,
 * each an integer 1..n whose numeric value IS its size rank (1 = smallest,
 * n = largest); all values are distinct (a permutation). `stack[0]` is the TOP
 * pancake, `stack[n-1]` the BOTTOM. Slide a spatula under the k-th pancake and
 * flip the whole top-k stack over. The board is solved when the stack reads
 * `[1,2,…,n]` — small on top, large at the bottom. There is no lose state.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, consumed
 * solely by `generateStack`. `flip` / `parFlips` / `computeScore` / `isSorted`
 * / `reduce` consume no rng, so every scoring / transition outcome is
 * golden-testable from a fixed script.
 */

export type Rng = () => number // returns a float in [0,1)
export type Pancake = number // 1..n; value === size rank

export interface FlapjackConfig {
  size: number // n = pancake count (5..9)
  scramble: number // # random prefix-reversals applied to the solved stack
}

export type FlapjackEvent = 'none' | 'flip' | 'illegal' | 'undo' | 'win'

export interface UndoEntry {
  stack: Pancake[]
  flips: number
}

export interface FlapjackState {
  config: FlapjackConfig
  seed: number
  stack: Pancake[] // index 0 = TOP
  flips: number // valid flips performed so far
  par: number // greedy benchmark flip count (parFlips of the initial stack)
  score: number // 0 until win, then computeScore (final, one-shot)
  undoStack: UndoEntry[] // newest at head, capped at UNDO_POOL
  undosLeft: number
  won: boolean
  lastEvent: FlapjackEvent
  lastFlipK: number | null // the k just flipped (animation target); null on undo/none
}

export type FlapjackAction =
  | { type: 'flip'; k: number } // flip the top k pancakes (1..n)
  | { type: 'undo' }
  | { type: 'reset' } // rebuild from the same seed
  | { type: 'new'; seed: number } // rebuild from a new seed

// -- Constants --------------------------------------------------------------

export const UNDO_POOL = 5
export const WIN_BONUS = 1000
export const SIZE_UNIT = 150
export const PAR_BONUS_MAX = 1500
export const EFF_CAP = 2 // bonus credited up to 2x better than par
export const MAX_GEN_FIXUP = 8 // extra flip tries if a scramble lands solved

export const DIFFICULTIES = {
  easy: { size: 5, scramble: 15 },
  normal: { size: 7, scramble: 21 },
  hard: { size: 9, scramble: 27 },
} satisfies Record<'easy' | 'normal' | 'hard', FlapjackConfig>

export const DAILY_CONFIG: FlapjackConfig = DIFFICULTIES.normal

// -- PRNG (identical bytes to the template's mulberry32) ---------------------

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

// -- Pure primitives --------------------------------------------------------

/** Reverse `stack[0..k-1]` in a NEW array. Input is never mutated. */
export function flip(stack: Pancake[], k: number): Pancake[] {
  const out = stack.slice()
  if (k <= 1) return out
  const top = Math.min(k, out.length)
  let i = 0
  let j = top - 1
  while (i < j) {
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
    i++
    j--
  }
  return out
}

/** Solved (= won) when stack[i] === i+1 for all i. Length 0/1 is sorted. */
export function isSorted(stack: Pancake[]): boolean {
  for (let i = 0; i < stack.length; i++) if (stack[i] !== i + 1) return false
  return true
}

/**
 * Build a scrambled stack by applying `cfg.scramble` random prefix-reversals to
 * `[1..n]`, then a fixup so the returned stack is never already sorted. Always
 * a permutation of 1..n.
 */
export function generateStack(cfg: FlapjackConfig, rng: Rng): Pancake[] {
  const n = cfg.size
  let stack: Pancake[] = []
  for (let i = 1; i <= n; i++) stack.push(i)

  for (let i = 0; i < cfg.scramble; i++) {
    const k = 2 + Math.floor(rng() * (n - 1)) // k in [2, n]
    stack = flip(stack, k)
  }

  let fixups = 0
  while (isSorted(stack) && fixups < MAX_GEN_FIXUP) {
    const k = 2 + Math.floor(rng() * (n - 1))
    stack = flip(stack, k)
    fixups++
  }

  return stack
}

/**
 * Greedy pancake sort flip count of `stack`, used as the par benchmark. Pure —
 * the input is never mutated. Upper bound 2*(n-1).
 */
export function parFlips(stack: Pancake[]): number {
  const n = stack.length
  let s = stack.slice()
  let flips = 0
  for (let target = n; target >= 2; target--) {
    const idx = s.indexOf(target)
    if (idx === target - 1) continue // already parked at the bottom
    if (idx !== 0) {
      s = flip(s, idx + 1) // bring target to the top
      flips++
    }
    s = flip(s, target) // send it down to its resting slot
    flips++
  }
  return flips
}

/**
 * Final score on a win: a base for solving, a size premium, and an efficiency
 * bonus rewarding fewer flips than par (saturating at EFF_CAP). Always a
 * positive integer.
 */
export function computeScore(n: number, par: number, flips: number): number {
  return (
    WIN_BONUS +
    SIZE_UNIT * n +
    Math.round(PAR_BONUS_MAX * Math.min(EFF_CAP, par / Math.max(1, flips)))
  )
}

/** A flip is valid when not won and 2 <= k <= length (k=1 is a no-op). */
export function canFlip(state: FlapjackState, k: number): boolean {
  return !state.won && k >= 2 && k <= state.stack.length
}

export function createGame(cfg: FlapjackConfig, seed: number): FlapjackState {
  const stack = generateStack(cfg, mulberry32(seed))
  return {
    config: cfg,
    seed,
    stack,
    flips: 0,
    par: parFlips(stack),
    score: 0,
    undoStack: [],
    undosLeft: UNDO_POOL,
    won: false,
    lastEvent: 'none',
    lastFlipK: null,
  }
}

// -- Reducer ----------------------------------------------------------------

export function reduce(state: FlapjackState, action: FlapjackAction): FlapjackState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    case 'undo': {
      if (state.won || state.undosLeft <= 0 || state.undoStack.length === 0) {
        return { ...state, lastEvent: 'none' }
      }
      const [head, ...rest] = state.undoStack
      return {
        ...state,
        stack: head.stack.slice(),
        flips: head.flips,
        undoStack: rest,
        undosLeft: state.undosLeft - 1,
        lastFlipK: null,
        lastEvent: 'undo',
      }
    }
    case 'flip': {
      if (state.won) return { ...state, lastEvent: 'none' }
      const k = action.k
      if (!canFlip(state, k)) {
        if (k > state.stack.length) return { ...state, lastEvent: 'illegal' }
        return { ...state, lastEvent: 'none' } // k < 2: free no-op
      }
      const nextStack = flip(state.stack, k)
      const flips = state.flips + 1
      const undoStack = [
        { stack: state.stack.slice(), flips: state.flips },
        ...state.undoStack,
      ].slice(0, UNDO_POOL)

      if (isSorted(nextStack)) {
        return {
          ...state,
          stack: nextStack,
          flips,
          undoStack,
          score: computeScore(state.config.size, state.par, flips),
          won: true,
          lastFlipK: k,
          lastEvent: 'win',
        }
      }
      return {
        ...state,
        stack: nextStack,
        flips,
        undoStack,
        score: 0,
        won: false,
        lastFlipK: k,
        lastEvent: 'flip',
      }
    }
    default:
      return state
  }
}
