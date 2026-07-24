/**
 * Battleship — the classic two-grid naval guessing game, as a pure engine.
 *
 * Two 10×10 boards. Each side hides the standard fleet — Carrier(5),
 * Battleship(4), Cruiser(3), Submarine(3), Destroyer(2). Players alternate
 * firing one shot at the opponent's board; a shot is a MISS, a HIT, or the HIT
 * that SINKS a ship (all its cells struck). First to sink the whole enemy fleet
 * wins.
 *
 * PURITY: every function here is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness (ship placement, AI tie-breaks) enters ONLY through
 * the injected `Rng`. `fire` is a (state) -> state transition that REJECTS
 * illegal moves — firing an already-fired cell, or firing after the game is
 * over — by returning the SAME state reference (so callers/tests assert a no-op
 * with `===`). `aiMove(state, difficulty, rng)` is deterministic for a fixed
 * state + seed and NEVER returns an already-fired or off-grid cell. The whole
 * game is golden-testable from a fixed seed + a scripted sequence of shots.
 *
 * ADJACENCY RULE (judgment call): ships may NOT overlap and must sit fully on
 * the grid, but they MAY touch (side-by-side or corner-to-corner). This matches
 * the classic Hasbro board game — the faithful "battleship online free"
 * experience — and keeps auto-placement instant.
 */

export type Rng = () => number // float in [0,1)

export const SIZE = 10

// -- PRNG (byte-identical to the solitaire template's mulberry32) -------------

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

// -- Fleet & ships ------------------------------------------------------------

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer'
export type Orientation = 'H' | 'V'
export type Coord = [number, number]

export interface ShipDef {
  id: ShipId
  name: string
  length: number
}

/** The standard fleet, longest first (placement order + probability scan). */
export const FLEET: readonly ShipDef[] = [
  { id: 'carrier', name: 'Carrier', length: 5 },
  { id: 'battleship', name: 'Battleship', length: 4 },
  { id: 'cruiser', name: 'Cruiser', length: 3 },
  { id: 'submarine', name: 'Submarine', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 },
]

/** Total cells occupied by a full fleet (5+4+3+3+2 = 17). */
export const FLEET_CELLS = FLEET.reduce((n, s) => n + s.length, 0)

export interface Ship {
  id: ShipId
  name: string
  length: number
  row: number // top-left row of the ship
  col: number // top-left col of the ship
  dir: Orientation
  hits: number // how many of its cells have been struck
}

/** The cells a ship occupies, from its anchor along its orientation. */
export function cellsOf(ship: Pick<Ship, 'row' | 'col' | 'dir' | 'length'>): Coord[] {
  const out: Coord[] = []
  for (let i = 0; i < ship.length; i++) {
    out.push(ship.dir === 'H' ? [ship.row, ship.col + i] : [ship.row + i, ship.col])
  }
  return out
}

export const isSunk = (ship: Ship): boolean => ship.hits >= ship.length

export const inBounds = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c < SIZE

// -- Board --------------------------------------------------------------------

/** A single cell's shot state on a board. */
export type Shot = 'none' | 'miss' | 'hit'

/**
 * One side's board: the fleet hidden on it, plus the grid of shots the OPPONENT
 * has fired AT it. (The player fires at `cpuBoard`; the CPU fires at
 * `playerBoard`.)
 */
export interface Board {
  ships: Ship[]
  shots: Shot[][] // [row][col]
}

const emptyGrid = (): Shot[][] => Array.from({ length: SIZE }, () => Array<Shot>(SIZE).fill('none'))

export function emptyBoard(): Board {
  return { ships: [], shots: emptyGrid() }
}

const cloneGrid = (g: Shot[][]): Shot[][] => g.map((row) => [...row])
const cloneShip = (s: Ship): Ship => ({ ...s })
export function cloneBoard(b: Board): Board {
  return { ships: b.ships.map(cloneShip), shots: cloneGrid(b.shots) }
}

/** A quick lookup grid: which ship index (or -1) sits on each cell. */
function occupancy(ships: Ship[]): Int8Array {
  const grid = new Int8Array(SIZE * SIZE).fill(-1)
  ships.forEach((ship, idx) => {
    for (const [r, c] of cellsOf(ship)) grid[r * SIZE + c] = idx
  })
  return grid
}

// -- Placement (setup phase) --------------------------------------------------

/**
 * The cells a prospective placement would occupy, or null if any fall off the
 * grid. Pure geometry — does not consider collisions.
 */
export function placementCells(row: number, col: number, dir: Orientation, length: number): Coord[] | null {
  const cells: Coord[] = []
  for (let i = 0; i < length; i++) {
    const r = dir === 'H' ? row : row + i
    const c = dir === 'H' ? col + i : col
    if (!inBounds(r, c)) return null
    cells.push([r, c])
  }
  return cells
}

/**
 * Is placing a ship of `length` at (row,col)/dir legal against the ships already
 * down? On-grid and no overlap (touching is allowed). `ignoreId` lets a ship be
 * re-placed without colliding with its own old position.
 */
export function canPlace(
  ships: Ship[],
  row: number,
  col: number,
  dir: Orientation,
  length: number,
  ignoreId?: ShipId,
): boolean {
  const cells = placementCells(row, col, dir, length)
  if (!cells) return false
  const taken = new Set<number>()
  for (const s of ships) {
    if (s.id === ignoreId) continue
    for (const [r, c] of cellsOf(s)) taken.add(r * SIZE + c)
  }
  return cells.every(([r, c]) => !taken.has(r * SIZE + c))
}

/**
 * Place (or re-place) one ship. Returns a NEW ships array on success, or null
 * when the placement is illegal (off-grid or overlapping another ship).
 */
export function placeShip(
  ships: Ship[],
  def: ShipDef,
  row: number,
  col: number,
  dir: Orientation,
): Ship[] | null {
  if (!canPlace(ships, row, col, dir, def.length, def.id)) return null
  const kept = ships.filter((s) => s.id !== def.id)
  kept.push({ id: def.id, name: def.name, length: def.length, row, col, dir, hits: 0 })
  return kept
}

/** True once every ship in the fleet is on the board. */
export function fleetComplete(ships: Ship[]): boolean {
  return FLEET.every((def) => ships.some((s) => s.id === def.id))
}

/**
 * A full, legal fleet placed at random via the injected rng. Deterministic for
 * a given seed. Falls back to a deterministic scan if random tries are unlucky,
 * so it ALWAYS returns a complete legal fleet.
 */
export function randomFleet(rng: Rng): Ship[] {
  const ships: Ship[] = []
  for (const def of FLEET) {
    let placed = false
    // Random attempts first (keeps layouts varied and unpredictable).
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const dir: Orientation = rng() < 0.5 ? 'H' : 'V'
      const span = def.length - 1
      const maxRow = dir === 'H' ? SIZE - 1 : SIZE - 1 - span
      const maxCol = dir === 'H' ? SIZE - 1 - span : SIZE - 1
      const row = Math.floor(rng() * (maxRow + 1))
      const col = Math.floor(rng() * (maxCol + 1))
      if (canPlace(ships, row, col, dir, def.length)) {
        ships.push({ id: def.id, name: def.name, length: def.length, row, col, dir, hits: 0 })
        placed = true
      }
    }
    if (!placed) {
      // Deterministic guarantee: first legal slot in row-major, H then V.
      outer: for (const dir of ['H', 'V'] as const) {
        for (let row = 0; row < SIZE; row++) {
          for (let col = 0; col < SIZE; col++) {
            if (canPlace(ships, row, col, dir, def.length)) {
              ships.push({ id: def.id, name: def.name, length: def.length, row, col, dir, hits: 0 })
              placed = true
              break outer
            }
          }
        }
      }
    }
  }
  return ships
}

export function randomBoard(rng: Rng): Board {
  return { ships: randomFleet(rng), shots: emptyGrid() }
}

// -- Game state ---------------------------------------------------------------

export type Turn = 'player' | 'cpu'
export type FireResult = 'miss' | 'hit' | 'sunk'
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface ShotLog {
  by: Turn
  cell: Coord
  result: FireResult
  /** The ship id sunk by this shot, if any. */
  sunk: ShipId | null
}

export interface GameState {
  /** Player's own fleet; `shots` here are the CPU's shots at the player. */
  playerBoard: Board
  /** CPU's hidden fleet; `shots` here are the player's shots at the CPU. */
  cpuBoard: Board
  turn: Turn
  winner: Turn | null
  /** The most recent resolved shot (for UI feedback + sound). Null at start. */
  lastShot: ShotLog | null
}

/**
 * Start a playable game: the player's finished board on one side, a fresh random
 * enemy fleet on the other. The player fires first. `playerBoard`'s shot grid is
 * reset so a re-used setup board starts clean.
 */
export function createGame(playerBoard: Board, rng: Rng): GameState {
  return {
    playerBoard: { ships: playerBoard.ships.map(cloneShip), shots: emptyGrid() },
    cpuBoard: randomBoard(rng),
    turn: 'player',
    winner: null,
    lastShot: null,
  }
}

/** Count of ships not yet sunk on a board. */
export function shipsRemaining(board: Board): number {
  return board.ships.filter((s) => !isSunk(s)).length
}

/** All ships are sunk → this board's owner has lost. */
export function fleetDestroyed(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk)
}

const opponentOf = (t: Turn): Turn => (t === 'player' ? 'cpu' : 'player')

/**
 * Fire the side-to-move's single shot at (r,c) on the opponent's board.
 *
 * Returns the SAME state reference (a `===` no-op) when the shot is illegal:
 * the game is already over, the cell is off-grid, or that cell was already
 * fired at. Otherwise returns a NEW state with the shot resolved, `lastShot`
 * set, the winner updated, and the turn handed to the opponent.
 */
export function fire(state: GameState, cell: Coord): GameState {
  if (state.winner !== null) return state
  const [r, c] = cell
  if (!inBounds(r, c)) return state

  const targetKey = state.turn === 'player' ? 'cpuBoard' : 'playerBoard'
  const target = state[targetKey]
  if (target.shots[r][c] !== 'none') return state // already fired here — no-op

  const occ = occupancy(target.ships)
  const shipIdx = occ[r * SIZE + c]
  const hit = shipIdx >= 0

  const shots = cloneGrid(target.shots)
  shots[r][c] = hit ? 'hit' : 'miss'

  let ships = target.ships
  let result: FireResult = 'miss'
  let sunkId: ShipId | null = null
  if (hit) {
    ships = target.ships.map(cloneShip)
    const ship = ships[shipIdx]
    ship.hits += 1
    if (isSunk(ship)) {
      result = 'sunk'
      sunkId = ship.id
    } else {
      result = 'hit'
    }
  }

  const nextTarget: Board = { ships, shots }
  const won = fleetDestroyed(nextTarget)
  const winner: Turn | null = won ? state.turn : null

  return {
    ...state,
    [targetKey]: nextTarget,
    turn: winner ? state.turn : opponentOf(state.turn),
    winner,
    lastShot: { by: state.turn, cell: [r, c], result, sunk: sunkId },
  }
}

// -- AI: hunt / target / probability-density ---------------------------------
//
// The CPU fires at `playerBoard`, seeing only its own shot results (miss/hit)
// and the sink announcements — never the hidden ship positions it hasn't hit.
// All hunting memory is DERIVED from the board each call, so `aiMove` is a pure
// function of (state, rng): no hidden mutable AI state to desync.

const ORTHO: readonly Coord[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/** Lengths of the player's ships the CPU has NOT yet sunk. */
function remainingLengths(board: Board): number[] {
  return board.ships.filter((s) => !isSunk(s)).map((s) => s.length)
}

/** Cells struck as hits that belong to a ship not yet sunk (live targets). */
function activeHits(board: Board): Coord[] {
  const sunkCells = new Set<number>()
  for (const s of board.ships) {
    if (isSunk(s)) for (const [r, c] of cellsOf(s)) sunkCells.add(r * SIZE + c)
  }
  const out: Coord[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board.shots[r][c] === 'hit' && !sunkCells.has(r * SIZE + c)) out.push([r, c])
    }
  }
  return out
}

/** Every cell that has never been fired at. */
function unfiredCells(board: Board): Coord[] {
  const out: Coord[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (board.shots[r][c] === 'none') out.push([r, c])
  }
  return out
}

const isFired = (board: Board, r: number, c: number): boolean => board.shots[r][c] !== 'none'

function pick(cells: Coord[], rng: Rng): Coord {
  return cells[Math.floor(rng() * cells.length)]
}

/**
 * From a set of active hits, the unfired cells that EXTEND a line of two or more
 * colinear, contiguous hits (the classic "found the ship's axis, follow it").
 */
function lineExtensions(board: Board, hits: Coord[]): Coord[] {
  const hitSet = new Set(hits.map(([r, c]) => r * SIZE + c))
  const out = new Set<number>()
  for (const [r, c] of hits) {
    // Horizontal line through (r,c)?
    if (hitSet.has(r * SIZE + (c - 1)) || hitSet.has(r * SIZE + (c + 1))) {
      let lo = c
      while (hitSet.has(r * SIZE + (lo - 1))) lo--
      let hi = c
      while (hitSet.has(r * SIZE + (hi + 1))) hi++
      if (inBounds(r, lo - 1) && !isFired(board, r, lo - 1)) out.add(r * SIZE + (lo - 1))
      if (inBounds(r, hi + 1) && !isFired(board, r, hi + 1)) out.add(r * SIZE + (hi + 1))
    }
    // Vertical line through (r,c)?
    if (hitSet.has((r - 1) * SIZE + c) || hitSet.has((r + 1) * SIZE + c)) {
      let lo = r
      while (hitSet.has((lo - 1) * SIZE + c)) lo--
      let hi = r
      while (hitSet.has((hi + 1) * SIZE + c)) hi++
      if (inBounds(lo - 1, c) && !isFired(board, lo - 1, c)) out.add((lo - 1) * SIZE + c)
      if (inBounds(hi + 1, c) && !isFired(board, hi + 1, c)) out.add((hi + 1) * SIZE + c)
    }
  }
  return [...out].map((k) => [Math.floor(k / SIZE), k % SIZE] as Coord)
}

/** Unfired orthogonal neighbours of any active hit (target a lone hit). */
function hitNeighbours(board: Board, hits: Coord[]): Coord[] {
  const seen = new Set<number>()
  const out: Coord[] = []
  for (const [r, c] of hits) {
    for (const [dr, dc] of ORTHO) {
      const nr = r + dr
      const nc = c + dc
      if (!inBounds(nr, nc) || isFired(board, nr, nc)) continue
      const k = nr * SIZE + nc
      if (!seen.has(k)) {
        seen.add(k)
        out.push([nr, nc])
      }
    }
  }
  return out
}

/**
 * Probability-density grid: for every remaining ship, slide it through every
 * legal position (on-grid, not over a miss, not over a sunk ship) and tally the
 * unfired cells it covers. Placements that also cover a live hit get a large
 * multiplier so density concentrates on completing a wounded ship — hunt AND
 * target emerge from one heuristic.
 */
function densityGrid(board: Board): number[][] {
  const density = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0))
  const active = activeHits(board)
  const activeSet = new Set(active.map(([r, c]) => r * SIZE + c))
  const sunkCells = new Set<number>()
  for (const s of board.ships) {
    if (isSunk(s)) for (const [r, c] of cellsOf(s)) sunkCells.add(r * SIZE + c)
  }
  const lengths = remainingLengths(board)

  for (const len of lengths) {
    for (const dir of ['H', 'V'] as const) {
      const maxRow = dir === 'H' ? SIZE : SIZE - len + 1
      const maxCol = dir === 'H' ? SIZE - len + 1 : SIZE
      for (let row = 0; row < maxRow; row++) {
        for (let col = 0; col < maxCol; col++) {
          let ok = true
          let coversActive = 0
          const cells: Coord[] = []
          for (let i = 0; i < len; i++) {
            const r = dir === 'H' ? row : row + i
            const c = dir === 'H' ? col + i : col
            const k = r * SIZE + c
            if (board.shots[r][c] === 'miss' || sunkCells.has(k)) {
              ok = false
              break
            }
            if (activeSet.has(k)) coversActive++
            cells.push([r, c])
          }
          if (!ok) continue
          // Big bonus per live hit covered → completing a wounded ship dominates.
          const weight = coversActive > 0 ? 100 * coversActive : 1
          for (const [r, c] of cells) {
            if (board.shots[r][c] === 'none') density[r][c] += weight
          }
        }
      }
    }
  }
  return density
}

/** Highest-density unfired cell; ties broken by rng. Optionally parity-gated. */
function bestDensityCell(board: Board, rng: Rng, parityGate: boolean): Coord | null {
  const density = densityGrid(board)
  // In pure hunt (no live hits) we may restrict to a parity class: no ship of
  // length ≥2 can straddle only one parity, so half the cells suffice.
  let best: Coord[] = []
  let bestVal = -1
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board.shots[r][c] !== 'none') continue
      if (parityGate && (r + c) % 2 !== 0) continue
      const v = density[r][c]
      if (v > bestVal) {
        bestVal = v
        best = [[r, c]]
      } else if (v === bestVal) {
        best.push([r, c])
      }
    }
  }
  if (best.length === 0 || bestVal <= 0) return null
  return pick(best, rng)
}

/** Easy: fire a uniformly random unfired cell. Never repeats, never illegal. */
function easyMove(board: Board, rng: Rng): Coord | null {
  const cells = unfiredCells(board)
  return cells.length ? pick(cells, rng) : null
}

/**
 * Normal: explicit hunt/target. On live hits, follow a two-hit line, else probe
 * a lone hit's neighbours. Otherwise hunt on a checkerboard parity pattern.
 */
function normalMove(board: Board, rng: Rng): Coord | null {
  const hits = activeHits(board)
  if (hits.length > 0) {
    const line = lineExtensions(board, hits)
    if (line.length) return pick(line, rng)
    const nbrs = hitNeighbours(board, hits)
    if (nbrs.length) return pick(nbrs, rng)
  }
  // Hunt: parity cells first (checkerboard), fall back to any unfired.
  const parity: Coord[] = []
  const any: Coord[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board.shots[r][c] !== 'none') continue
      any.push([r, c])
      if ((r + c) % 2 === 0) parity.push([r, c])
    }
  }
  if (parity.length) return pick(parity, rng)
  return any.length ? pick(any, rng) : null
}

/**
 * Hard: probability-density hunting. With no live hits it fires the densest cell
 * on the majority parity (density + parity); once a ship is wounded, density
 * collapses onto the cells that finish it. Falls back gracefully.
 */
function hardMove(board: Board, rng: Rng): Coord | null {
  const hits = activeHits(board)
  const gated = bestDensityCell(board, rng, hits.length === 0)
  if (gated) return gated
  const ungated = bestDensityCell(board, rng, false)
  if (ungated) return ungated
  return easyMove(board, rng)
}

/**
 * Choose the CPU's shot at the player's board. Deterministic for a fixed state +
 * seed. Returns null only when the player's board has no unfired cell left.
 * NEVER returns an already-fired or off-grid cell.
 */
export function aiMove(state: GameState, difficulty: Difficulty, rng: Rng): Coord | null {
  const board = state.playerBoard
  if (difficulty === 'easy') return easyMove(board, rng)
  if (difficulty === 'normal') return normalMove(board, rng)
  return hardMove(board, rng)
}
