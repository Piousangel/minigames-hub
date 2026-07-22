/**
 * Gomoku (Five in a Row) — pure engine, "free-style" rules.
 *
 * Two players place stones on a 15×15 grid; Black (1) moves first. The first to
 * make an unbroken line of FIVE (or more — freestyle counts overlines as a win)
 * horizontally, vertically, or diagonally wins. A full board with no five is a
 * draw. No opening restrictions, no overline ban — the common casual variant.
 *
 * PURITY: every function here is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through the injected `Rng`, consumed
 * ONLY by `aiMove` (candidate tie-breaking / Easy jitter). `place` is a pure
 * (state) -> state transition that REJECTS illegal moves by returning the SAME
 * state reference (so callers/tests can assert a no-op with `===`). This makes
 * the whole game golden-testable from a fixed seed + a scripted move sequence.
 */

export type Rng = () => number // float in [0,1)

export type Cell = 0 | 1 | 2 // empty / black / white
export type Player = 1 | 2
export type Difficulty = 'easy' | 'medium' | 'hard'

export const SIZE = 15
export const CELLS = SIZE * SIZE // 225
export const CENTER = Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2) // 112

export interface State {
  board: number[] // length 225, 0 empty / 1 black / 2 white
  turn: Player // side to move (1 = black first)
  status: 'playing' | 'won' | 'draw'
  winner: Player | null
  winLine: number[] | null // the winning cells (ascending), for UI highlight
  moves: number // stones placed so far
  last: number | null // index of the most recent stone
}

// -- PRNG (byte-identical to the clusters/solitaire template's mulberry32) ----

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

// -- Geometry -----------------------------------------------------------------

/** The 4 line axes: horizontal, vertical, diagonal ↘, anti-diagonal ↙. */
const AXES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
]

export function rc(index: number): [number, number] {
  return [Math.floor(index / SIZE), index % SIZE]
}
export function idx(r: number, c: number): number {
  return r * SIZE + c
}
function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE
}

/**
 * Count contiguous `who` stones stepping (dr,dc) from (r,c) — NOT counting the
 * origin. Also reports whether the cell just past the run is an in-board empty
 * (an "open" end). No wraparound: bounds are checked per step on (r,c).
 */
function walk(
  board: number[],
  r: number,
  c: number,
  dr: number,
  dc: number,
  who: number,
): { count: number; open: boolean } {
  let count = 0
  let nr = r + dr
  let nc = c + dc
  while (inBounds(nr, nc) && board[idx(nr, nc)] === who) {
    count++
    nr += dr
    nc += dc
  }
  const open = inBounds(nr, nc) && board[idx(nr, nc)] === 0
  return { count, open }
}

// -- Win detection ------------------------------------------------------------

/**
 * Scan the 4 axes through `index` (which must already hold `player`'s stone)
 * and, if any contiguous run reaches 5+, return that run's cell indices in
 * ascending order (a "winLine"). Otherwise null. Freestyle: an overline (6+)
 * still wins and the full run is returned.
 */
export function checkWin(board: number[], index: number, player: number): number[] | null {
  const [r, c] = rc(index)
  for (const [dr, dc] of AXES) {
    const fwd = walk(board, r, c, dr, dc, player)
    const bwd = walk(board, r, c, -dr, -dc, player)
    const total = fwd.count + bwd.count + 1
    if (total >= 5) {
      const line: number[] = []
      for (let k = -bwd.count; k <= fwd.count; k++) {
        line.push(idx(r + dr * k, c + dc * k))
      }
      line.sort((a, b) => a - b)
      return line
    }
  }
  return null
}

/** True if placing `who` at empty `index` would make an unbroken 5+ line. */
function makesFive(board: number[], index: number, who: number): boolean {
  const [r, c] = rc(index)
  for (const [dr, dc] of AXES) {
    const fwd = walk(board, r, c, dr, dc, who)
    const bwd = walk(board, r, c, -dr, -dc, who)
    if (fwd.count + bwd.count + 1 >= 5) return true
  }
  return false
}

// -- Core transitions ---------------------------------------------------------

export function newGame(): State {
  return {
    board: new Array<number>(CELLS).fill(0),
    turn: 1,
    status: 'playing',
    winner: null,
    winLine: null,
    moves: 0,
    last: null,
  }
}

/**
 * Place the side-to-move's stone at `index`. Pure. Returns the SAME reference
 * (a no-op) if the game is over, `index` is out of range, or the cell is taken.
 * On success returns a fresh state with a copied board, win/draw resolved, and
 * the turn advanced only while play continues.
 */
export function place(state: State, index: number): State {
  if (state.status !== 'playing') return state
  if (!Number.isInteger(index) || index < 0 || index >= CELLS) return state
  if (state.board[index] !== 0) return state

  const player = state.turn
  const board = state.board.slice()
  board[index] = player

  const winLine = checkWin(board, index, player)
  const moves = state.moves + 1

  if (winLine) {
    return { board, turn: player, status: 'won', winner: player, winLine, moves, last: index }
  }
  if (moves >= CELLS) {
    return { board, turn: player, status: 'draw', winner: null, winLine: null, moves, last: index }
  }
  return {
    board,
    turn: player === 1 ? 2 : 1,
    status: 'playing',
    winner: null,
    winLine: null,
    moves,
    last: index,
  }
}

// -- AI -----------------------------------------------------------------------

/**
 * Empty cells within Chebyshev distance 2 of any stone (ascending index). This
 * bounds the search near live play for speed. Empty board → [] (handled by the
 * caller as the center opening).
 */
export function candidateCells(board: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < CELLS; i++) {
    if (board[i] !== 0) continue
    const [r, c] = rc(i)
    let near = false
    for (let dr = -2; dr <= 2 && !near; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr
        const nc = c + dc
        if (inBounds(nr, nc) && board[idx(nr, nc)] !== 0) {
          near = true
          break
        }
      }
    }
    if (near) out.push(i)
  }
  return out
}

/** Map a would-be run (length + open ends) to a heuristic value. */
function shapeValue(line: number, open: number): number {
  if (line >= 5) return 100000
  if (line === 4) return open === 2 ? 10000 : open === 1 ? 1000 : 0
  if (line === 3) return open === 2 ? 500 : open === 1 ? 60 : 0
  if (line === 2) return open === 2 ? 50 : open === 1 ? 5 : 0
  return open === 2 ? 5 : 1
}

/** Summed shape value across the 4 axes for `who` playing (hypothetically) at cell. */
function patternValue(board: number[], index: number, who: number): number {
  const [r, c] = rc(index)
  let total = 0
  for (const [dr, dc] of AXES) {
    const fwd = walk(board, r, c, dr, dc, who)
    const bwd = walk(board, r, c, -dr, -dc, who)
    const line = fwd.count + bwd.count + 1
    const open = (fwd.open ? 1 : 0) + (bwd.open ? 1 : 0)
    total += shapeValue(line, open)
  }
  return total
}

/** How many axes reach an open-three-or-better for `who` at cell (fork detector). */
function strongAxes(board: number[], index: number, who: number): number {
  const [r, c] = rc(index)
  let n = 0
  for (const [dr, dc] of AXES) {
    const fwd = walk(board, r, c, dr, dc, who)
    const bwd = walk(board, r, c, -dr, -dc, who)
    const line = fwd.count + bwd.count + 1
    const open = (fwd.open ? 1 : 0) + (bwd.open ? 1 : 0)
    if (shapeValue(line, open) >= 500) n++
  }
  return n
}

function pickTie(cells: number[], rng: Rng): number {
  if (cells.length === 1) return cells[0]
  const i = Math.min(cells.length - 1, Math.floor(rng() * cells.length))
  return cells[i]
}

function pickBest(cells: number[], score: (c: number) => number, rng: Rng): number {
  let best = -Infinity
  let top: number[] = []
  for (const c of cells) {
    const s = score(c)
    if (s > best) {
      best = s
      top = [c]
    } else if (s === best) {
      top.push(c)
    }
  }
  return pickTie(top, rng)
}

/**
 * Choose a move for `aiPlayer` — a bounded heuristic, NOT full minimax:
 *   1. take an immediate win if one exists;
 *   2. otherwise block an opponent's immediate win (four → five);
 *   3. otherwise score every candidate by its own pattern strength plus the
 *      opponent threat it denies, and take the best.
 * Difficulty scales greed: Easy adds rng jitter + discounts defense (short-
 * sighted); Medium weighs defense fully; Hard adds fork make/block bonuses.
 * Deterministic given a fixed `rng`. Always returns a legal empty cell.
 */
export function aiMove(state: State, aiPlayer: Player, difficulty: Difficulty, rng: Rng): number {
  const board = state.board

  // Opening: empty board (or center still free with no stones) → center.
  let hasStone = false
  for (let i = 0; i < CELLS; i++) {
    if (board[i] !== 0) {
      hasStone = true
      break
    }
  }
  if (!hasStone) return CENTER

  const cands = candidateCells(board)
  if (cands.length === 0) {
    for (let i = 0; i < CELLS; i++) if (board[i] === 0) return i
    return -1
  }

  const opp: Player = aiPlayer === 1 ? 2 : 1

  // 1. Immediate win.
  const wins = cands.filter((c) => makesFive(board, c, aiPlayer))
  if (wins.length) return pickTie(wins, rng)

  // 2. Block the opponent's immediate win (their four-in-a-row).
  const blocks = cands.filter((c) => makesFive(board, c, opp))
  if (blocks.length) return pickBest(blocks, (c) => patternValue(board, c, aiPlayer), rng)

  // 3. Heuristic scoring.
  const defW = difficulty === 'easy' ? 0.5 : difficulty === 'medium' ? 0.9 : 0.95
  const jitter = difficulty === 'easy' ? 400 : 0

  let best = -Infinity
  let top: number[] = []
  for (const c of cands) {
    let s = patternValue(board, c, aiPlayer) + defW * patternValue(board, c, opp)
    if (difficulty === 'hard') {
      if (strongAxes(board, c, aiPlayer) >= 2) s += 3000 // build a fork
      if (strongAxes(board, c, opp) >= 2) s += 2500 // deny opponent's fork
    }
    if (jitter) s += rng() * jitter
    if (s > best) {
      best = s
      top = [c]
    } else if (s === best) {
      top.push(c)
    }
  }
  return pickTie(top, rng)
}
