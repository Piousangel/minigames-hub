// Ticker — pure deterministic economy/market engine.
// RNG is injected via a seeded closure; there are NO wall-clock or global-random
// sources here. Math.imul and bit ops are deterministic and allowed.

export type Rng = () => number // yields [0,1); injected — the seeded closure is the only randomness
export type Bucket = 'cold' | 'warming' | 'hot' | 'overheated'
export type AssetId = 'A' | 'B' | 'C'
export type Choice = 'A' | 'B' | 'C' | 'CASH'

/** Momentum snapshot at a tick boundary — what the meter + tension ring render. */
export interface AssetSnapshot {
  bucket: Bucket
  heat: number // consecutive ticks spent in hot/overheated regime; 0 for cold/warming
  snapProb: number // snap probability for the UPCOMING resolution (0..1); 0 for cold/warming
}

/** Fully resolved outcome for one asset at one tick (precomputed, immutable). */
export interface AssetTick {
  before: AssetSnapshot // state ENTERING the tick — the ring the player reads before committing
  ret: number // fractional return applied to W if this asset is chosen (vol-scaled, clamped)
  snapped: boolean // a snap fired this tick
  after: AssetSnapshot // state after the tick; equals ticks[t+1][i].before (test invariant)
}

/** The whole deterministic market. Independent of player choices. */
export interface MarketTape {
  seed: number
  totalTicks: number
  ticks: AssetTick[][] // ticks[t] = [A, B, C] (fixed asset order)
}

/** One resolved round, for the W-sparkline and reveal. */
export interface TickRecord {
  choice: Choice
  chosenRet: number // return applied to W this tick (0 for CASH)
  W: number // W AFTER this tick
  assets: AssetTick[] // the 3 asset outcomes this tick (all shown; only `choice` affected W)
}

export interface TickerState {
  tape: MarketTape
  tick: number // 0..totalTicks; === totalTicks means finished
  W: number // current worth (float; display floored)
  startW: number // 100
  history: TickRecord[]
  choices: Choice[] // choice made at each resolved tick (length === history.length)
  over: boolean
  busted: boolean // ended early because W dropped below BUST_FLOOR
}

// --- Constants (exact, tuned so CASH stays live and no asset dominates) ---

export const TOTAL_TICKS = 20
export const START_W = 100
export const BUST_FLOOR = 1 // W < 1 → busted, run ends immediately
export const SPARK_LEN = 8 // sparkline shows last 8 returns
export const RET_FLOOR = -0.9 // one tick can never lose more than 90%
export const VOL_RAMP = 0.6 // late-tick volatility multiplier: vol(t)=1+0.6*t/(TOTAL_TICKS-1)

// Non-snap return band per bucket: ret = base + spread * dRet  (dRet in [0,1))
export const RET_BASE: Record<Bucket, number> = { cold: -0.05, warming: 0.02, hot: 0.06, overheated: 0.1 }
export const RET_SPREAD: Record<Bucket, number> = { cold: 0.11, warming: 0.06, hot: 0.1, overheated: 0.12 }
//   cold[-5%,+6%)  warming[+2%,+8%)  hot[+6%,+16%)  overheated[+10%,+22%)  (pre-vol)

/** The six fixed permutations of the opening buckets over [A,B,C]. */
export const PERMUTATIONS: Array<[Bucket, Bucket, Bucket]> = [
  ['cold', 'warming', 'hot'],
  ['cold', 'hot', 'warming'],
  ['warming', 'cold', 'hot'],
  ['warming', 'hot', 'cold'],
  ['hot', 'cold', 'warming'],
  ['hot', 'warming', 'cold'],
]

/** Snap probability for the UPCOMING resolution — structural, heat-driven, not vol-scaled. */
export function snapProbOf(b: Bucket, h: number): number {
  if (b === 'hot') return Math.min(0.1 + 0.08 * (h - 1), 0.55)
  if (b === 'overheated') return Math.min(0.3 + 0.1 * (h - 1), 0.85)
  return 0 // cold | warming
}

/** Snap return (sharply negative, escalates with heat; magnitude then vol-scaled). */
export function snapRetOf(b: Bucket, h: number): number {
  if (b === 'hot') return -Math.min(0.16 + 0.03 * (h - 1), 0.4)
  if (b === 'overheated') return -Math.min(0.28 + 0.04 * (h - 1), 0.55)
  return 0
}

/** Non-snap transition table given a bucket, heat, and the return draw dRet in [0,1). */
export function transition(b: Bucket, h: number, dRet: number): { bucket: Bucket; heat: number } {
  switch (b) {
    case 'cold':
      return dRet < 0.35 ? { bucket: 'cold', heat: 0 } : { bucket: 'warming', heat: 0 }
    case 'warming':
      if (dRet < 0.2) return { bucket: 'cold', heat: 0 }
      if (dRet < 0.55) return { bucket: 'warming', heat: 0 }
      return { bucket: 'hot', heat: 1 }
    case 'hot':
      return dRet < 0.45 ? { bucket: 'hot', heat: h + 1 } : { bucket: 'overheated', heat: h + 1 }
    case 'overheated':
      return { bucket: 'overheated', heat: h + 1 } // only a snap resets it to cold
  }
}

/** Late-tick volatility multiplier: tick 0 → ×1.0, tick 19 → ×1.6. */
export function vol(t: number): number {
  return 1 + (VOL_RAMP * t) / (TOTAL_TICKS - 1)
}

/** mulberry32 — deterministic seeded PRNG. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function snapshot(bucket: Bucket, heat: number): AssetSnapshot {
  return { bucket, heat, snapProb: snapProbOf(bucket, heat) }
}

/**
 * Precompute the entire deterministic market tape from a seed.
 * Draw order is fixed and total (two draws per asset, assets in A,B,C order),
 * so the tape is a pure function of the seed alone.
 */
export function buildTape(seed: number, totalTicks = TOTAL_TICKS): MarketTape {
  const rng = makeRng(seed)
  const perm = PERMUTATIONS[(seed >>> 0) % 6]

  // Initial (bucket, heat) per asset. hot opens at heat 1; cold/warming at heat 0.
  const cur: Array<{ bucket: Bucket; heat: number }> = perm.map((b) => ({
    bucket: b,
    heat: b === 'hot' ? 1 : 0,
  }))

  const ticks: AssetTick[][] = []
  for (let t = 0; t < totalTicks; t++) {
    const row: AssetTick[] = []
    for (let i = 0; i < 3; i++) {
      const b = cur[i].bucket
      const h = cur[i].heat
      const p = snapProbOf(b, h)
      const dSnap = rng()
      const dRet = rng() // ALWAYS two draws per asset (dRet ignored on snap)

      let snapped: boolean
      let retRaw: number
      let nb: Bucket
      let nh: number
      if ((b === 'hot' || b === 'overheated') && dSnap < p) {
        snapped = true
        retRaw = snapRetOf(b, h)
        nb = 'cold'
        nh = 0
      } else {
        snapped = false
        retRaw = RET_BASE[b] + RET_SPREAD[b] * dRet
        const tr = transition(b, h, dRet)
        nb = tr.bucket
        nh = tr.heat
      }
      const ret = Math.max(RET_FLOOR, retRaw * vol(t))
      row.push({
        before: { bucket: b, heat: h, snapProb: p },
        ret,
        snapped,
        after: snapshot(nb, nh),
      })
      cur[i] = { bucket: nb, heat: nh }
    }
    ticks.push(row)
  }
  return { seed, totalTicks, ticks }
}

export function newGame(seed: number): TickerState {
  return {
    tape: buildTape(seed),
    tick: 0,
    W: START_W,
    startW: START_W,
    history: [],
    choices: [],
    over: false,
    busted: false,
  }
}

/** The three `before` snapshots the player reads for the current tick (empty if over). */
export function currentSnapshots(s: TickerState): AssetSnapshot[] {
  if (s.over || s.tick >= s.tape.totalTicks) return []
  return s.tape.ticks[s.tick].map((a) => a.before)
}

const CHOICE_INDEX: Record<AssetId, number> = { A: 0, B: 1, C: 2 }

/** Pure resolve of the current tick (no rng — the tape is precomputed). Never mutates input. */
export function commit(s: TickerState, choice: Choice): TickerState {
  if (s.over || s.tick >= s.tape.totalTicks) return s
  const assets = s.tape.ticks[s.tick]
  const chosenRet = choice === 'CASH' ? 0 : assets[CHOICE_INDEX[choice]].ret
  const W2 = s.W * (1 + chosenRet)
  const tick2 = s.tick + 1
  const busted = W2 < BUST_FLOOR
  const over = busted || tick2 >= s.tape.totalTicks
  return {
    ...s,
    tick: tick2,
    W: W2,
    history: [...s.history, { choice, chosenRet, W: W2, assets }],
    choices: [...s.choices, choice],
    over,
    busted,
  }
}

/** Best possible W with full foresight — greedy is globally optimal (all factors > 0). */
export function bestPossibleW(tape: MarketTape): number {
  let w = START_W
  for (const row of tape.ticks) {
    let best = 1 // CASH factor
    for (let i = 0; i < 3; i++) best = Math.max(best, 1 + row[i].ret)
    w *= best
  }
  return Math.floor(w)
}

/** Per-tick argmax over {CASH:1.0, A, B, C}; ties resolve to CASH (safer read). */
export function optimalChoices(tape: MarketTape): Choice[] {
  const order: AssetId[] = ['A', 'B', 'C']
  return tape.ticks.map((row) => {
    let bestChoice: Choice = 'CASH'
    let bestFactor = 1
    for (const id of order) {
      const f = 1 + row[CHOICE_INDEX[id]].ret
      if (f > bestFactor) {
        bestFactor = f
        bestChoice = id
      }
    }
    return bestChoice
  })
}

/** Best factor available at a resolved tick (CASH floor of 1.0). */
function optFactorOf(assets: AssetTick[]): number {
  let best = 1
  for (let i = 0; i < 3; i++) best = Math.max(best, 1 + assets[i].ret)
  return best
}

function pct(x: number): string {
  return (x * 100).toFixed(1)
}

export interface ExitCallout {
  tick: number
  kind: 'early' | 'late' | 'other'
  message: string
}

/**
 * The sharpest missed tick, classified. null unless the run is over with history.
 * Picks t* = argmax(optFactor - playerFactor) (first on ties).
 */
export function exitCallout(s: TickerState): ExitCallout | null {
  if (!s.over || s.history.length === 0) return null
  const opt = optimalChoices(s.tape)

  let tStar = 0
  let bestGap = -Infinity
  for (let t = 0; t < s.history.length; t++) {
    const rec = s.history[t]
    const gap = optFactorOf(rec.assets) - (1 + rec.chosenRet)
    if (gap > bestGap) {
      bestGap = gap
      tStar = t
    }
  }

  const rec = s.history[tStar]
  const optChoice = opt[tStar]
  const optFactor = optFactorOf(rec.assets)

  if (rec.choice === 'CASH' && optChoice !== 'CASH' && optFactor > 1) {
    return {
      tick: tStar,
      kind: 'early',
      message: `You sat in cash a tick early — ${optChoice} still had room (+${pct(optFactor - 1)}%).`,
    }
  }
  if (rec.choice !== 'CASH' && rec.chosenRet < 0 && optChoice === 'CASH') {
    return {
      tick: tStar,
      kind: 'late',
      message: `You rode ${rec.choice} one tick too long — it snapped ${pct(rec.chosenRet)}%.`,
    }
  }
  return {
    tick: tStar,
    kind: 'other',
    message: `Sharpest miss: tick ${tStar + 1}, ${optChoice} would've paid +${pct(optFactor - 1)}%.`,
  }
}
