/**
 * Unblock — a Rush Hour / "Unblock Me" sliding-block escape puzzle (pure engine).
 *
 * A 6×6 grid holds rectangular blocks of length 2 or 3. Each block slides ONLY
 * along its own axis (horizontal → left/right, vertical → up/down) and cannot
 * pass through another block or a wall. ONE special TARGET block (horizontal,
 * length 2, sitting on the EXIT row) must reach the right edge to escape.
 *
 * PURITY: every function here is pure and total. No timers, no `Date`, NO
 * `Math.random`. Move functions are (state) -> state and REJECT illegal moves
 * by returning the SAME state reference, so callers/tests can assert a no-op
 * with `===`. The whole game is golden-testable from a level + scripted slides.
 *
 * A "move" (as the player experiences it and as `moves`/BFS count it) is sliding
 * ONE block any distance in one direction — matching a single drag or tap. That
 * yields the classic Rush Hour minimum-move count.
 */

export const GRID = 6
/** The target block lives on this row; the exit gap is the right wall here. */
export const EXIT_ROW = 2
/** A block's right edge escapes when it reaches this column. */
export const EXIT_COL = GRID - 1

export type Dir = 'h' | 'v'

export interface Block {
  id: string
  row: number // top-most occupied row (0..5)
  col: number // left-most occupied col (0..5)
  len: 2 | 3
  dir: Dir
  target?: boolean
}

export type Status = 'playing' | 'won'

export interface State {
  blocks: Block[]
  status: Status
  moves: number
  levelIndex: number
}

export interface Level {
  id: number
  name: string
  blocks: Block[]
}

// -- cell / occupancy helpers ------------------------------------------------

function cellId(row: number, col: number): number {
  return row * GRID + col
}

/** Every cell a block occupies, as packed ids. */
export function blockCells(b: Block): number[] {
  const out: number[] = []
  for (let i = 0; i < b.len; i++) {
    out.push(b.dir === 'h' ? cellId(b.row, b.col + i) : cellId(b.row + i, b.col))
  }
  return out
}

/** Occupancy set of all blocks, optionally excluding the block at `exceptIdx`. */
function occupancy(blocks: Block[], exceptIdx = -1): Set<number> {
  const occ = new Set<number>()
  for (let i = 0; i < blocks.length; i++) {
    if (i === exceptIdx) continue
    for (const c of blockCells(blocks[i])) occ.add(c)
  }
  return occ
}

function indexOfId(blocks: Block[], id: string): number {
  for (let i = 0; i < blocks.length; i++) if (blocks[i].id === id) return i
  return -1
}

// -- reach / slide (raw arrays; the primitives everything else builds on) ----

/**
 * How many cells the block at `idx` can slide in one direction.
 * `sign` = +1 → right (h) / down (v); -1 → left (h) / up (v). Returns 0..N.
 */
function reach(blocks: Block[], idx: number, sign: 1 | -1): number {
  const b = blocks[idx]
  const occ = occupancy(blocks, idx)
  let row = b.row
  let col = b.col
  let dist = 0
  for (;;) {
    let lr: number
    let lc: number
    if (b.dir === 'h') {
      lr = row
      lc = sign > 0 ? col + b.len : col - 1
    } else {
      lc = col
      lr = sign > 0 ? row + b.len : row - 1
    }
    if (lr < 0 || lr >= GRID || lc < 0 || lc >= GRID) break
    if (occ.has(cellId(lr, lc))) break
    dist++
    if (b.dir === 'h') col += sign
    else row += sign
  }
  return dist
}

/** Furthest legal slide of a block along its axis in a given direction. */
export function maxSlide(state: State, blockId: string, sign: 1 | -1): number {
  const idx = indexOfId(state.blocks, blockId)
  if (idx < 0) return 0
  return reach(state.blocks, idx, sign)
}

/** Is `delta` cells a fully-legal slide for this block? (0 or blocked → false) */
export function canSlide(state: State, blockId: string, delta: number): boolean {
  if (delta === 0) return false
  const idx = indexOfId(state.blocks, blockId)
  if (idx < 0) return false
  const sign: 1 | -1 = delta > 0 ? 1 : -1
  return Math.abs(delta) <= reach(state.blocks, idx, sign)
}

function moveBlock(b: Block, delta: number): Block {
  return b.dir === 'h' ? { ...b, col: b.col + delta } : { ...b, row: b.row + delta }
}

/** The target block, or undefined. */
export function targetBlock(blocks: Block[]): Block | undefined {
  return blocks.find((b) => b.target)
}

/** Win = the target block's right edge has reached the exit column. */
export function isSolvedBlocks(blocks: Block[]): boolean {
  const t = targetBlock(blocks)
  return !!t && t.col + t.len - 1 >= EXIT_COL
}

export function isSolved(state: State): boolean {
  return isSolvedBlocks(state.blocks)
}

/**
 * Slide a block `delta` cells along its axis. Legal (fully clear + in-bounds) →
 * new State (moves+1, status updated). Illegal (0, blocked, clamped short, or
 * unknown id) → the SAME reference (a no-op callers can detect with `===`).
 */
export function slide(state: State, blockId: string, delta: number): State {
  if (state.status !== 'playing') return state
  if (!canSlide(state, blockId, delta)) return state
  const idx = indexOfId(state.blocks, blockId)
  const blocks = state.blocks.map((b, i) => (i === idx ? moveBlock(b, delta) : b))
  const status: Status = isSolvedBlocks(blocks) ? 'won' : 'playing'
  return { ...state, blocks, status, moves: state.moves + 1 }
}

/**
 * Slide a block so its leading edge lands on a target cell along its axis
 * (the tap-to-destination path). Non-axis / unreachable target → same ref.
 * Returns the same state if the requested cell isn't a legal stopping point.
 */
export function slideTo(state: State, blockId: string, row: number, col: number): State {
  const b = state.blocks.find((x) => x.id === blockId)
  if (!b) return state
  const delta = b.dir === 'h' ? col - b.col : row - b.row
  return slide(state, blockId, delta)
}

// -- level parsing (pure; hand-designed ASCII → block lists) -----------------

/**
 * Parse a 6×6 ASCII grid into a block list. `.` is empty; every other char is a
 * block id (contiguous same-char cells form one block). `X` is the target.
 * Deterministic and total; malformed input throws (caught by tests, never at
 * runtime since the bank is fixed).
 */
export function parseGrid(id: number, name: string, rows: readonly string[]): Level {
  if (rows.length !== GRID) throw new Error(`level ${id}: need ${GRID} rows`)
  const points = new Map<string, Array<[number, number]>>()
  for (let r = 0; r < GRID; r++) {
    const line = rows[r]
    if (line.length !== GRID) throw new Error(`level ${id}: row ${r} not ${GRID} wide`)
    for (let c = 0; c < GRID; c++) {
      const ch = line[c]
      if (ch === '.') continue
      const list = points.get(ch) ?? []
      list.push([r, c])
      points.set(ch, list)
    }
  }
  const blocks: Block[] = []
  for (const [ch, pts] of points) {
    const rowsSet = new Set(pts.map((p) => p[0]))
    const colsSet = new Set(pts.map((p) => p[1]))
    const len = pts.length
    if (len !== 2 && len !== 3) throw new Error(`level ${id}: block ${ch} len ${len}`)
    const horizontal = rowsSet.size === 1
    const vertical = colsSet.size === 1
    if (horizontal === vertical) throw new Error(`level ${id}: block ${ch} not a line`)
    const dir: Dir = horizontal ? 'h' : 'v'
    const row = Math.min(...pts.map((p) => p[0]))
    const col = Math.min(...pts.map((p) => p[1]))
    // contiguity check
    const cells = new Set(pts.map((p) => cellId(p[0], p[1])))
    for (let i = 0; i < len; i++) {
      const cid = dir === 'h' ? cellId(row, col + i) : cellId(row + i, col)
      if (!cells.has(cid)) throw new Error(`level ${id}: block ${ch} not contiguous`)
    }
    blocks.push({ id: ch, row, col, len: len as 2 | 3, dir, target: ch === 'X' })
  }
  const t = blocks.find((b) => b.target)
  if (!t) throw new Error(`level ${id}: no target (X)`)
  if (t.dir !== 'h' || t.len !== 2 || t.row !== EXIT_ROW)
    throw new Error(`level ${id}: target must be horizontal len2 on exit row`)
  // Stable order: target first, then by id — deterministic keys for BFS/UI.
  blocks.sort((a, b) => (a.target ? -1 : b.target ? 1 : a.id < b.id ? -1 : 1))
  return { id, name, blocks }
}

// -- the hand-designed level bank --------------------------------------------
// Row 2 (0-indexed) is the exit row; `X` (red) escapes out the RIGHT edge.
// Progressive difficulty; every level is BFS-verified solvable in engine.test.ts
// and its known minimum-move count is recorded there.

const RAW: Array<{ name: string; grid: string[] }> = [
  // -- warm-up: sparse, the exit and the one blocker are obvious (min 2) -----
  { name: 'First Steps', grid: ['......', '......', 'XX.A..', '...A..', '......', '......'] },
  { name: 'Drop Down', grid: ['...A..', '...A..', 'XX.A..', '......', '......', '......'] },
  // -- easy (min 3–4): looks busy, short solve — a confidence builder --------
  { name: 'Jailbreak', grid: ['FI..K.', 'FI.EK.', 'XX.E.D', '...BCD', 'JGABCH', 'JGA.CH'] },
  { name: 'Side Step', grid: ['.CKKK.', '.CDD.J', 'XXE..J', 'FAEB.H', 'FA.BGH', '.IIIG.'] },
  { name: 'Warm Up', grid: ['.....F', '...D.F', 'XX.DE.', '.C..EH', '.CBB.H', '.GGAA.'] },
  { name: 'Nudge', grid: ['CC....', '.....A', 'XXB..A', '..BFFA', 'DD.EEE', '..GG..'] },
  { name: 'Detour', grid: ['..GGG.', 'FFBBE.', 'XX..EA', '.CC..A', 'IH.DD.', 'IH....'] },
  { name: 'Shuffle', grid: ['.....H', 'GGBAAH', 'XXB.E.', '.II.E.', '.D.FF.', '.DCC..'] },
  // -- medium (min 6–8): a chain of blockers to clear ------------------------
  { name: 'Crossing', grid: ['...ACC', '..BAH.', 'XXB.HI', 'D.BGHI', 'DF.G..', '.FEE..'] },
  { name: 'Traffic', grid: ['GGAA.D', '....ED', 'XXB.ED', '..B.E.', '.FFF..', '....CC'] },
  { name: 'Junction', grid: ['....C.', '..DACE', 'XXDACE', 'BB.A..', '..FF..', '.GGG..'] },
  { name: 'Tangle', grid: ['KKCI.H', 'GGCI.H', 'XXFL.D', 'B.FLED', 'B...ED', 'BAAAJJ'] },
  { name: 'Gridlock', grid: ['F..EII', 'FGGE.D', 'XXJ..D', '..JAAH', 'BBB..H', '..CC..'] },
  { name: 'Interlock', grid: ['..HHHF', 'GGBC.F', 'XXBCIJ', '.AB.IJ', '.A..EJ', '.ADDE.'] },
  // -- hard (min 10–12): deep ordering, false starts everywhere --------------
  { name: 'Bottleneck', grid: ['.JJHH.', '.BB.CE', 'XX..CE', 'K.FFFE', 'KAAAGG', 'DDD.II'] },
  { name: 'Logjam', grid: ['C..AFF', 'CEEA..', 'XX.B.J', '.GGB.J', '..IHHD', '..I..D'] },
  { name: 'Standstill', grid: ['..E...', '..E.CC', 'XXED..', 'AA.DHH', 'IGBBBF', 'IG...F'] },
  { name: 'Deadlock', grid: ['.JII..', '.J..G.', 'XXC.GD', 'EEC..D', 'BHH.FK', 'B.AAFK'] },
  { name: 'Snarl', grid: ['..G...', '..GAD.', 'XXGAD.', 'C...DB', 'C.FF.B', '..EE..'] },
  { name: 'Roadblock', grid: ['GG.BB.', '..D.A.', 'XXD.A.', '..D.A.', 'E.FF..', 'E...CC'] },
  // -- brutal (min 14+): grandmaster gridlock --------------------------------
  { name: 'Impasse', grid: ['FEEE.G', 'F.IC.G', 'XXIC.J', 'B..C.J', 'B..DD.', 'BHHHAA'] },
  { name: 'Knot', grid: ['GHH.FF', 'G...II', 'XXEK..', 'B.EKAA', 'BDD.J.', '..CCJ.'] },
  { name: 'Stalemate', grid: ['.GG..I', '...F.I', 'XXCFA.', '..CFA.', 'EDHHA.', 'EDBB..'] },
  { name: 'Checkmate', grid: ['GGJ..K', '..JCFK', 'XXJCF.', 'E..AID', 'EHHAID', '.BB...'] },
  { name: 'Endgame', grid: ['IGGFFF', 'I.AABB', 'XXHL..', '..HLC.', 'EEELCD', 'KKK..D'] },
  { name: 'The Vault', grid: ['..BBBF', '.DDJ.F', 'XXIJ.F', 'KKIHH.', 'G.AALL', 'GEE.CC'] },
  { name: 'Last Stand', grid: ['HCCCDF', 'HEEEDF', 'XXJGDF', '..JGAA', 'BIII..', 'B.....'] },
]

/** The parsed, immutable level bank in play order. */
export const LEVELS: readonly Level[] = RAW.map((r, i) => parseGrid(i, r.name, r.grid))

/**
 * The minimum ("par") move count for each level, in play order. These are the
 * exact BFS results (see engine.test.ts, which re-derives and pins them) — baked
 * here so the UI can show par without re-running BFS on the client.
 */
export const LEVEL_PAR: readonly number[] = [
  2, 2, 3, 3, 3, 4, 4, 4, 6, 6, 7, 8, 8, 8, 10, 10, 10, 12, 12, 12, 14, 15, 15, 17, 19, 25, 25,
]

export function levelCount(): number {
  return LEVELS.length
}

export function getLevel(index: number): Level {
  const i = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length
  return LEVELS[i]
}

/** Fresh playing state for a level (deep-cloned blocks; moves=0). */
export function fromLevel(index: number): State {
  const lvl = getLevel(index)
  return {
    blocks: lvl.blocks.map((b) => ({ ...b })),
    status: 'playing',
    moves: 0,
    levelIndex: ((index % LEVELS.length) + LEVELS.length) % LEVELS.length,
  }
}

// -- BFS solver (tests: prove solvable + record min-moves) -------------------

/** Positional key: each block's variable coordinate, in fixed block order. */
function key(blocks: Block[]): string {
  let s = ''
  for (const b of blocks) s += (b.dir === 'h' ? b.col : b.row) + ','
  return s
}

/** All one-move successors of a position (each = sliding one block any distance). */
function successors(blocks: Block[]): Block[][] {
  const out: Block[][] = []
  for (let i = 0; i < blocks.length; i++) {
    for (const sign of [1, -1] as const) {
      const far = reach(blocks, i, sign)
      for (let d = 1; d <= far; d++) {
        const delta = sign * d
        out.push(blocks.map((b, j) => (j === i ? moveBlock(b, delta) : b)))
      }
    }
  }
  return out
}

/**
 * Shortest solution length (in moves) for a level via breadth-first search,
 * or `null` if unsolvable. 6×6 state space is small — this is exhaustive.
 */
export function solveBFS(level: Level): number | null {
  const start = level.blocks.map((b) => ({ ...b }))
  if (isSolvedBlocks(start)) return 0
  const seen = new Set<string>([key(start)])
  let frontier: Block[][] = [start]
  let depth = 0
  while (frontier.length > 0) {
    depth++
    const next: Block[][] = []
    for (const cur of frontier) {
      for (const nb of successors(cur)) {
        const k = key(nb)
        if (seen.has(k)) continue
        if (isSolvedBlocks(nb)) return depth
        seen.add(k)
        next.push(nb)
      }
    }
    frontier = next
  }
  return null
}
