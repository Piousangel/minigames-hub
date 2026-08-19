/**
 * Strata — pure engine.
 *
 * A hidden size×size×size voxel shape (several axis-aligned boxes OR'd
 * together). The player queries axis-aligned slices to reveal size×size
 * silhouettes, paints a guess voxel array layer by layer, then submits to
 * check for an exact match. Queries are budgeted (distinct queries only);
 * submits are counted.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, used
 * solely in `placeBoxes`. The reducer never throws — illegal input yields
 * `lastEvent: 'illegal'` and an unchanged (or same-shape) state.
 */

export type Rng = () => number // returns a float in [0,1)
export type Axis = 'x' | 'y' | 'z'
export const AXES: Axis[] = ['x', 'y', 'z']

export interface StrataConfig {
  size: number // cube edge length, 4..6
  boxCount: number // number of axis-aligned prisms OR'd together, 2..4
  boxMin: number // minimum per-axis prism length (>=1)
  boxMax: number // maximum per-axis prism length (<=size)
  querySlices: number // slice-query budget (distinct queries only)
  maxSubmits: number // allowed submit (answer-check) attempts
}

export type StrataResult = 'playing' | 'won' | 'lost'

export type StrataEvent =
  | 'none'
  | 'query'
  | 'query-repeat'
  | 'illegal'
  | 'toggle'
  | 'layer'
  | 'submit-wrong'
  | 'win'
  | 'lose'

export interface SliceResult {
  axis: Axis
  index: number
  grid: boolean[][] // size x size, [row][col]
  repeat: boolean
}

export interface SubmitResult {
  correct: boolean
  matches: number
  total: number
  tp: number
  fp: number
  fn: number
  iou: number
}

export interface StrataState {
  config: StrataConfig
  seed: number
  size: number
  voxels: boolean[] // answer, length size^3, idx(x,y,z)
  guess: boolean[] // player guess, length size^3, initially all false
  revealed: Record<string, boolean[][]> // layerKey -> revealed grid (first reveal only)
  revealedOrder: string[] // first-reveal order (repeats not appended)
  queriesLeft: number
  queriesUsed: number // distinct queries only
  submitsLeft: number
  submitsUsed: number
  score: number
  result: StrataResult
  activeLayer: { axis: Axis; index: number }
  lastEvent: StrataEvent
  lastSlice: SliceResult | null
  lastSubmit: SubmitResult | null
}

export type StrataAction =
  | { type: 'query'; axis: Axis; index: number }
  | { type: 'toggleVoxel'; x: number; y: number; z: number }
  | { type: 'setLayer'; axis: Axis; index: number }
  | { type: 'submit' }
  | { type: 'giveUp' }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

// -- Tuning constants ---------------------------------------------------

export const MAX_GEN_ATTEMPTS = 30
export const WIN_BASE = 1000
export const EFFICIENCY_BONUS_MAX = 1000
export const WRONG_SUBMIT_PENALTY = 150
export const LOSS_PARTIAL_MAX = 400

/** Identical impl to the template's mulberry32 (Decant included). */
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

export const DIFFICULTIES = {
  easy: { size: 4, boxCount: 2, boxMin: 1, boxMax: 3, querySlices: 6, maxSubmits: 4 },
  normal: { size: 5, boxCount: 3, boxMin: 1, boxMax: 3, querySlices: 8, maxSubmits: 3 },
  hard: { size: 6, boxCount: 4, boxMin: 1, boxMax: 3, querySlices: 10, maxSubmits: 3 },
} satisfies Record<'easy' | 'normal' | 'hard', StrataConfig>

export const DAILY_CONFIG: StrataConfig = DIFFICULTIES.normal

// -- Coordinates ----------------------------------------------------------

export function idx(size: number, x: number, y: number, z: number): number {
  return x + y * size + z * size * size
}

export function inBounds(size: number, v: number): boolean {
  return Number.isInteger(v) && v >= 0 && v < size
}

export function voxelAt(voxels: boolean[], size: number, x: number, y: number, z: number): boolean {
  return voxels[idx(size, x, y, z)]
}

// -- Pure primitives --------------------------------------------------------

/**
 * size x size silhouette of `voxels` cut at `axis = index`. Never mutates
 * `voxels`. Throws RangeError if `index` is out of `[0, size)` (a contract
 * violation guard — the reducer always validates before calling this).
 *
 * Mapping (see spec §3):
 *  z: grid[row][col] = voxelAt(col, row, index)   -- row=y, col=x
 *  y: grid[row][col] = voxelAt(col, index, row)   -- row=z, col=x
 *  x: grid[row][col] = voxelAt(index, col, row)   -- row=z, col=y
 */
export function sliceAt(voxels: boolean[], size: number, axis: Axis, index: number): boolean[][] {
  if (!inBounds(size, index)) throw new RangeError(`sliceAt: index ${index} out of bounds for size ${size}`)
  const grid: boolean[][] = []
  for (let row = 0; row < size; row++) {
    const line: boolean[] = []
    for (let col = 0; col < size; col++) {
      let v: boolean
      if (axis === 'z') v = voxelAt(voxels, size, col, row, index)
      else if (axis === 'y') v = voxelAt(voxels, size, col, index, row)
      else v = voxelAt(voxels, size, index, col, row)
      line.push(v)
    }
    grid.push(line)
  }
  return grid
}

export function layerKey(axis: Axis, index: number): string {
  return `${axis}:${index}`
}

export function countFilled(voxels: boolean[]): number {
  let n = 0
  for (const v of voxels) if (v) n++
  return n
}

export function guessAccuracy(
  guess: boolean[],
  voxels: boolean[],
): Omit<SubmitResult, 'correct'> {
  const total = voxels.length
  let tp = 0
  let fp = 0
  let fn = 0
  for (let i = 0; i < total; i++) {
    const g = guess[i]
    const v = voxels[i]
    if (g && v) tp++
    else if (g && !v) fp++
    else if (!g && v) fn++
  }
  const matches = tp + (total - tp - fp - fn)
  const denom = tp + fp + fn
  const iou = denom === 0 ? 1 : tp / denom
  return { matches, total, tp, fp, fn, iou }
}

export function voxelsEqual(a: boolean[], b: boolean[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// -- Board generation -------------------------------------------------------

/**
 * Places cfg.boxCount axis-aligned boxes (OR'd together) into a fresh
 * size^3 boolean array. Consumes rng in exactly 6 calls per box, in the
 * fixed order: xLen, xStart, yLen, yStart, zLen, zStart. Pure & total.
 */
export function placeBoxes(cfg: StrataConfig, rng: Rng): boolean[] {
  const { size } = cfg
  const voxels = new Array<boolean>(size * size * size).fill(false)

  for (let b = 0; b < cfg.boxCount; b++) {
    const xLen = cfg.boxMin + Math.floor(rng() * (cfg.boxMax - cfg.boxMin + 1))
    const xStart = Math.floor(rng() * (cfg.size - xLen + 1))
    const yLen = cfg.boxMin + Math.floor(rng() * (cfg.boxMax - cfg.boxMin + 1))
    const yStart = Math.floor(rng() * (cfg.size - yLen + 1))
    const zLen = cfg.boxMin + Math.floor(rng() * (cfg.boxMax - cfg.boxMin + 1))
    const zStart = Math.floor(rng() * (cfg.size - zLen + 1))

    for (let x = xStart; x < xStart + xLen; x++) {
      for (let y = yStart; y < yStart + yLen; y++) {
        for (let z = zStart; z < zStart + zLen; z++) {
          voxels[idx(size, x, y, z)] = true
        }
      }
    }
  }

  return voxels
}

/**
 * Generates a non-degenerate voxel shape (not entirely empty, not entirely
 * full). Retries with a freshly-derived seed (new mulberry32 stream, not a
 * continuation) up to MAX_GEN_ATTEMPTS times.
 */
export function generateVoxels(cfg: StrataConfig, seed: number): boolean[] {
  let useSeed = seed
  let voxels = placeBoxes(cfg, mulberry32(useSeed))
  let attempts = 0
  const total = cfg.size ** 3
  while (attempts < MAX_GEN_ATTEMPTS) {
    const filled = countFilled(voxels)
    if (filled > 0 && filled < total) break
    useSeed = (useSeed + 1) >>> 0
    voxels = placeBoxes(cfg, mulberry32(useSeed))
    attempts++
  }
  return voxels
}

export function createGame(cfg: StrataConfig, seed: number): StrataState {
  const voxels = generateVoxels(cfg, seed)
  const size = cfg.size
  return {
    config: cfg,
    seed,
    size,
    voxels,
    guess: new Array<boolean>(size ** 3).fill(false),
    revealed: {},
    revealedOrder: [],
    queriesLeft: cfg.querySlices,
    queriesUsed: 0,
    submitsLeft: cfg.maxSubmits,
    submitsUsed: 0,
    score: 0,
    result: 'playing',
    activeLayer: { axis: 'z', index: 0 },
    lastEvent: 'none',
    lastSlice: null,
    lastSubmit: null,
  }
}

// -- Reducer ------------------------------------------------------------

export function reduce(state: StrataState, action: StrataAction): StrataState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)

    case 'query': {
      if (state.result !== 'playing') return { ...state, lastEvent: 'none' }
      const { axis, index } = action
      if (!inBounds(state.size, index)) return { ...state, lastEvent: 'illegal' }

      const key = layerKey(axis, index)
      const existing = state.revealed[key]
      if (existing) {
        return {
          ...state,
          lastSlice: { axis, index, grid: existing, repeat: true },
          lastEvent: 'query-repeat',
        }
      }

      if (state.queriesLeft <= 0) return { ...state, lastEvent: 'illegal' }

      const grid = sliceAt(state.voxels, state.size, axis, index)
      const revealed = { ...state.revealed, [key]: grid }
      const revealedOrder = [...state.revealedOrder, key]
      return {
        ...state,
        revealed,
        revealedOrder,
        queriesLeft: state.queriesLeft - 1,
        queriesUsed: state.queriesUsed + 1,
        lastSlice: { axis, index, grid, repeat: false },
        lastEvent: 'query',
      }
    }

    case 'toggleVoxel': {
      if (state.result !== 'playing') return { ...state, lastEvent: 'none' }
      const { x, y, z } = action
      if (!inBounds(state.size, x) || !inBounds(state.size, y) || !inBounds(state.size, z)) {
        return { ...state, lastEvent: 'illegal' }
      }
      const i = idx(state.size, x, y, z)
      const guess = state.guess.slice()
      guess[i] = !guess[i]
      return { ...state, guess, lastEvent: 'toggle' }
    }

    case 'setLayer': {
      const { axis, index } = action
      if (!inBounds(state.size, index)) return { ...state, lastEvent: 'illegal' }
      return { ...state, activeLayer: { axis, index }, lastEvent: 'layer' }
    }

    case 'submit': {
      if (state.result !== 'playing') return { ...state, lastEvent: 'none' }
      const acc = guessAccuracy(state.guess, state.voxels)
      const correct = voxelsEqual(state.guess, state.voxels)
      const submitsUsed = state.submitsUsed + 1
      const submitsLeft = state.submitsLeft - 1
      const lastSubmit: SubmitResult = { correct, ...acc }

      if (correct) {
        const efficiencyBonus = Math.round(
          EFFICIENCY_BONUS_MAX * (state.queriesLeft / state.config.querySlices),
        )
        return {
          ...state,
          submitsUsed,
          submitsLeft,
          score: state.score + WIN_BASE + efficiencyBonus,
          result: 'won',
          lastSubmit,
          lastEvent: 'win',
        }
      }

      if (submitsLeft > 0) {
        return {
          ...state,
          submitsUsed,
          submitsLeft,
          score: Math.max(0, state.score - WRONG_SUBMIT_PENALTY),
          lastSubmit,
          lastEvent: 'submit-wrong',
        }
      }

      return {
        ...state,
        submitsUsed,
        submitsLeft,
        score: state.score + Math.round(LOSS_PARTIAL_MAX * acc.iou),
        result: 'lost',
        lastSubmit,
        lastEvent: 'lose',
      }
    }

    case 'giveUp': {
      if (state.result !== 'playing') return { ...state, lastEvent: 'none' }
      const acc = guessAccuracy(state.guess, state.voxels)
      const lastSubmit: SubmitResult = { correct: false, ...acc }
      return {
        ...state,
        score: state.score + Math.round(LOSS_PARTIAL_MAX * acc.iou),
        result: 'lost',
        lastSubmit,
        lastEvent: 'lose',
      }
    }

    default:
      return state
  }
}
