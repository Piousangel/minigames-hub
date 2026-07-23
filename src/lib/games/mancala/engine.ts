// Mancala — the classic Kalah rules. Pure, deterministic engine.
//
// Board = 14 pits in a flat array, indexed counterclockwise:
//   0..5   player 0's six small pits (bottom row, sown left→right)
//   6      player 0's STORE (bottom-right)
//   7..12  player 1's six small pits (top row, sown right→left)
//   13     player 1's STORE (top-left)
//
// 48 stones total, 4 in each of the 12 small pits at start.
//
// Sowing (counterclockwise, index +1 with wrap): lift all stones from one of
// YOUR OWN non-empty pits and drop them one at a time into the following pits —
// INCLUDING your own store, but SKIPPING the opponent's store.
//   • Extra turn: if the last stone lands in YOUR store, you move again.
//   • Capture: if the last stone lands in an EMPTY pit on YOUR OWN side and the
//     directly opposite opponent pit has stones, you take that stone plus all of
//     the opposite pit's stones into your store.
//   • End: when all six pits on one side are empty, each player sweeps the
//     remaining stones on their own side into their store. Most stones wins.
//
// No Math.random / Date.now / performance.now anywhere — the AI is a pure
// function of (state, depth) and breaks ties deterministically (lowest pit).

export type Player = 0 | 1
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GameState {
  /** 14 pit counts; see index map above. */
  pits: number[]
  /** Whose move it is. */
  turn: Player
}

export type Winner = Player | 'draw' | null

/** Full detail of one legal sow — for the UI (animation) and internal logic. */
export interface MoveDetail {
  /** Ordered pit indices, one per stone sown (opponent store already skipped). */
  path: number[]
  /** Index of the pit where the final stone landed. */
  last: number
  /** True when the mover earns another turn (last stone in own store). */
  extraTurn: boolean
  /** Capture info, or null. `pit` = own landing pit, `opposite` = opponent pit. */
  capture: { pit: number; opposite: number; gained: number } | null
  /** True when this move emptied a side and triggered the end-game sweep. */
  ended: boolean
  /** The resulting state (after capture, sweep and turn handoff). */
  state: GameState
}

export const PITS_PER_SIDE = 6
export const TOTAL_PITS = 14
export const P0_STORE = 6
export const P1_STORE = 13

const START_STONES = 4

export const storeOf = (p: Player): number => (p === 0 ? P0_STORE : P1_STORE)
export const oppStoreOf = (p: Player): number => (p === 0 ? P1_STORE : P0_STORE)
export const other = (p: Player): Player => (p === 0 ? 1 : 0)

/** The six small-pit indices a player may pick from. */
export const ownPits = (p: Player): number[] =>
  p === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]

/** True if pit index `i` is one of player `p`'s own small pits. */
export const isOwnPit = (p: Player, i: number): boolean =>
  p === 0 ? i >= 0 && i <= 5 : i >= 7 && i <= 12

/** The pit directly opposite a small pit (bottom↔top). Stores have no opposite. */
export const oppositePit = (i: number): number => 12 - i

export function newGame(): GameState {
  const pits = Array<number>(TOTAL_PITS).fill(START_STONES)
  pits[P0_STORE] = 0
  pits[P1_STORE] = 0
  return { pits, turn: 0 }
}

/** True when all six small pits on either side are empty (a swept, finished board). */
export function isOver(state: GameState): boolean {
  const p0 = state.pits[0] + state.pits[1] + state.pits[2] + state.pits[3] + state.pits[4] + state.pits[5]
  const p1 = state.pits[7] + state.pits[8] + state.pits[9] + state.pits[10] + state.pits[11] + state.pits[12]
  return p0 === 0 || p1 === 0
}

/** Legal moves (own non-empty small pits) for the side to move, ascending. */
export function legalMoves(state: GameState): number[] {
  if (isOver(state)) return []
  const moves: number[] = []
  for (const i of ownPits(state.turn)) {
    if (state.pits[i] > 0) moves.push(i)
  }
  return moves
}

/** Sweep both sides into their stores (called once a side goes empty). Mutates. */
function sweep(pits: number[]): void {
  for (let i = 0; i <= 5; i++) {
    pits[P0_STORE] += pits[i]
    pits[i] = 0
  }
  for (let i = 7; i <= 12; i++) {
    pits[P1_STORE] += pits[i]
    pits[i] = 0
  }
}

const sideEmpty = (pits: number[], p: Player): boolean =>
  ownPits(p).every((i) => pits[i] === 0)

/**
 * Full description of playing pit `pit` for the side to move, or `null` when the
 * move is illegal (game over, not your pit, or an empty pit). Pure.
 */
export function moveDetail(state: GameState, pit: number): MoveDetail | null {
  if (isOver(state)) return null
  const me = state.turn
  if (!isOwnPit(me, pit)) return null
  const stones = state.pits[pit]
  if (stones <= 0) return null

  const pits = [...state.pits]
  pits[pit] = 0

  const oppStore = oppStoreOf(me)
  const myStore = storeOf(me)
  const path: number[] = []
  let idx = pit
  for (let n = 0; n < stones; n++) {
    idx = (idx + 1) % TOTAL_PITS
    if (idx === oppStore) idx = (idx + 1) % TOTAL_PITS // skip opponent's store
    pits[idx] += 1
    path.push(idx)
  }
  const last = idx

  let extraTurn = false
  let capture: MoveDetail['capture'] = null
  if (last === myStore) {
    extraTurn = true
  } else if (isOwnPit(me, last) && pits[last] === 1) {
    // Last stone landed in a pit that was empty on our own side.
    const opposite = oppositePit(last)
    if (pits[opposite] > 0) {
      const gained = pits[opposite] + 1
      pits[myStore] += gained
      pits[last] = 0
      pits[opposite] = 0
      capture = { pit: last, opposite, gained }
    }
  }

  // End-game sweep: if either side is now empty, both sides sweep to their store.
  let ended = false
  if (sideEmpty(pits, 0) || sideEmpty(pits, 1)) {
    sweep(pits)
    ended = true
  }

  const turn: Player = extraTurn ? me : other(me)
  return { path, last, extraTurn, capture, ended, state: { pits, turn } }
}

/**
 * Play a move for the side to move. Returns the SAME state reference (=== no-op)
 * when the move is illegal — empty pit, not your side, or the game is over.
 */
export function applyMove(state: GameState, pit: number): GameState {
  const d = moveDetail(state, pit)
  return d ? d.state : state
}

/** Stones in a player's store. */
export const storeCount = (state: GameState, p: Player): number => state.pits[storeOf(p)]

/** Total stones sitting in a player's six small pits. */
export const sideCount = (state: GameState, p: Player): number =>
  ownPits(p).reduce((sum, i) => sum + state.pits[i], 0)

/** Winner once the game is over, else null. */
export function winner(state: GameState): Winner {
  if (!isOver(state)) return null
  const a = state.pits[P0_STORE]
  const b = state.pits[P1_STORE]
  if (a > b) return 0
  if (b > a) return 1
  return 'draw'
}

// ── AI: minimax with alpha-beta pruning ──────────────────────────────────────
//
// Depth counts PLIES (individual sow moves). Because an extra turn keeps `turn`
// unchanged, the search naturally lets the same player move again — the
// maximizing/minimizing choice keys off `state.turn === me`, so an extra-turn
// chain stays on the same side of the tree.

const DEPTHS: Record<Difficulty, number> = { easy: 2, medium: 5, hard: 8 }

const WIN_SCORE = 1_000_000
const W_STORE = 12 // store lead dominates
const W_SIDE = 1 // material held on your own side
const W_EXTRA = 3 // pits set up to land exactly in your store (free move)
const W_VULN = 2 // penalty for capturable empty pits facing a loaded opponent pit

/** Distance from small pit `i` to that player's store (1..6). */
const distToStore = (p: Player, i: number): number => storeOf(p) - i

/** Static evaluation from `me`'s perspective. Higher = better for `me`. */
function evaluate(state: GameState, me: Player): number {
  const p = state.pits
  const foe = other(me)
  let score = (p[storeOf(me)] - p[storeOf(foe)]) * W_STORE
  score += (sideCount(state, me) - sideCount(state, foe)) * W_SIDE

  // Extra-turn readiness: a pit holding exactly its distance-to-store lands the
  // last stone in the store → a free move. Reward mine, penalize the foe's.
  for (const i of ownPits(me)) if (p[i] === distToStore(me, i)) score += W_EXTRA
  for (const i of ownPits(foe)) if (p[i] === distToStore(foe, i)) score -= W_EXTRA

  // Capture vulnerability: an empty own pit whose opposite (opponent) pit is
  // loaded is a standing capture threat against whoever owns the empty pit.
  for (const i of ownPits(me)) if (p[i] === 0 && p[oppositePit(i)] > 0) score -= W_VULN
  for (const i of ownPits(foe)) if (p[i] === 0 && p[oppositePit(i)] > 0) score += W_VULN

  return score
}

/** Terminal score from `me`'s perspective (bigger margin = better/worse). */
function terminalScore(state: GameState, me: Player): number {
  const diff = state.pits[storeOf(me)] - state.pits[storeOf(other(me))]
  if (diff > 0) return WIN_SCORE + diff
  if (diff < 0) return -WIN_SCORE + diff
  return 0
}

// Order moves so extra-turn moves come first (better alpha-beta pruning), while
// staying deterministic: stable within each group by ascending pit index.
function orderedMoves(state: GameState): number[] {
  const moves = legalMoves(state)
  const me = state.turn
  const extra: number[] = []
  const rest: number[] = []
  for (const m of moves) {
    if (state.pits[m] === distToStore(me, m)) extra.push(m)
    else rest.push(m)
  }
  return [...extra, ...rest]
}

function search(state: GameState, depth: number, alpha: number, beta: number, me: Player): number {
  if (isOver(state)) return terminalScore(state, me)
  if (depth === 0) return evaluate(state, me)

  const moves = orderedMoves(state)
  const maximizing = state.turn === me
  if (maximizing) {
    let best = -Infinity
    for (const m of moves) {
      best = Math.max(best, search(applyMove(state, m), depth - 1, alpha, beta, me))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }
  let best = Infinity
  for (const m of moves) {
    best = Math.min(best, search(applyMove(state, m), depth - 1, alpha, beta, me))
    beta = Math.min(beta, best)
    if (beta <= alpha) break
  }
  return best
}

/**
 * The score the search assigns to the state to move — exposed for tests.
 * `me` defaults to the side to move.
 */
export function evaluatePosition(state: GameState, depth: number, me: Player = state.turn): number {
  return search(state, depth, -Infinity, Infinity, me)
}

/**
 * Choose a pit for the computer via minimax + alpha-beta at a depth set by
 * `difficulty` (easy 2, medium 5, hard 8 plies). Deterministic: no rng, ties
 * broken toward the lowest pit index (moves iterated ascending, strict `>`).
 * Returns `null` only when the side to move has no legal move.
 */
export function aiMove(state: GameState, difficulty: Difficulty): number | null {
  const moves = legalMoves(state) // ascending → deterministic tie-break
  if (moves.length === 0) return null
  if (moves.length === 1) return moves[0]

  const me = state.turn
  const depth = DEPTHS[difficulty]
  let bestScore = -Infinity
  let bestPit = moves[0]
  let alpha = -Infinity
  for (const m of moves) {
    const v = search(applyMove(state, m), depth - 1, alpha, Infinity, me)
    if (v > bestScore) {
      bestScore = v
      bestPit = m
      if (v > alpha) alpha = v
    }
  }
  return bestPit
}
