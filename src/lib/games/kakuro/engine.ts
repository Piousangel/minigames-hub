/**
 * Kakuro — cross-sums logic puzzle. Pure & deterministic engine.
 *
 * A Kakuro grid mixes BLACK cells (walls, some carrying clue numbers) and WHITE
 * cells (filled with digits 1-9). Every horizontal maximal run of white cells
 * has a clue = the sum its digits must total (shown in the top-right triangle of
 * the black cell to its LEFT); every vertical run has a clue in the bottom-left
 * triangle of the black cell ABOVE it. The iron rule: within any single run,
 * digits do NOT repeat. You win when every white cell holds a digit and every
 * run sums exactly to its clue with no repeats.
 *
 * PURITY: nothing here calls Math.random / Date.now / performance.now. Puzzles
 * are static, hand-baked data (offline-generated, then re-verified UNIQUE by the
 * solver in the test suite). Every board op — fill / erase / toggleNote — is a
 * pure (state) -> state that REJECTS illegal ops by returning the SAME reference
 * (so callers/tests can assert a no-op with `===`). The backtracking uniqueness
 * SOLVER (`countSolutions`) is used only by tests.
 *
 * Clues are DERIVED from the baked solution + wall layout, so a clue can never
 * disagree with its solution — the whole class of "typo'd clue" bugs is designed
 * out. The bank stores each puzzle as a grid of chars: '#' = black wall, a digit
 * '1'-'9' = a white cell whose SOLVED value is that digit.
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert']

/** A black (wall) cell. `across`/`down` hold the clue sums it announces, or null. */
export interface BlackCell {
  kind: 'black'
  across: number | null
  down: number | null
}
/** A white cell — the player writes a digit 1-9 here. */
export interface WhiteCell {
  kind: 'white'
}
export type StructCell = BlackCell | WhiteCell

export type Orient = 'across' | 'down'

/** A maximal run of consecutive white cells that must sum to `clue` with no repeats. */
export interface Run {
  orient: Orient
  clue: number
  /** Flat index of the black cell that announces this run's clue. */
  clueIndex: number
  /** Flat indices of the run's white cells, in reading order. */
  cells: number[]
}

export interface Puzzle {
  id: string
  name: string
  difficulty: Difficulty
  rows: number
  cols: number
  /** Flat rows*cols structure. */
  struct: StructCell[]
  /** Flat solution: 0 for black cells, the solved digit for white cells. */
  solution: number[]
  /** All across + down runs. */
  runs: Run[]
  /** Flat indices of all white cells. */
  whites: number[]
  /** whiteIndex -> index into `runs` of its across run (or -1). */
  acrossRunOf: number[]
  /** whiteIndex -> index into `runs` of its down run (or -1). */
  downRunOf: number[]
}

/** Mutable board state: what the player has entered. Everything else is static. */
export interface Board {
  puzzleId: string
  /** Flat: 0 = empty (or black), else the entered digit. */
  values: number[]
  /** Flat: per white cell, its sorted pencil-mark candidate digits. */
  notes: number[][]
}

export interface RawPuzzle {
  id: string
  name: string
  difficulty: Difficulty
  /** Rows of chars: '#' black, '1'-'9' = white cell's solved digit. */
  grid: string[]
}

// -- Build a Puzzle from its baked raw grid ----------------------------------

const BLACK = '#'

/**
 * Parse a raw grid into a fully-derived Puzzle: cell structure, solution, and
 * across/down runs with clue sums computed FROM the solution (guaranteeing
 * clue/solution consistency). Throws on malformed geometry so a bad bank entry
 * fails loudly rather than shipping.
 */
export function buildPuzzle(raw: RawPuzzle): Puzzle {
  const rows = raw.grid.length
  const cols = rows > 0 ? raw.grid[0].length : 0
  const N = rows * cols
  const idx = (r: number, c: number) => r * cols + c

  const struct: StructCell[] = new Array(N)
  const solution = new Array<number>(N).fill(0)
  const whites: number[] = []

  for (let r = 0; r < rows; r++) {
    const line = raw.grid[r]
    if (line.length !== cols) throw new Error(`${raw.id}: ragged row ${r}`)
    for (let c = 0; c < cols; c++) {
      const ch = line[c]
      const i = idx(r, c)
      if (ch === BLACK) {
        struct[i] = { kind: 'black', across: null, down: null }
      } else {
        const d = Number(ch)
        if (!Number.isInteger(d) || d < 1 || d > 9) throw new Error(`${raw.id}: bad char '${ch}' at ${r},${c}`)
        struct[i] = { kind: 'white' }
        solution[i] = d
        whites.push(i)
      }
    }
  }

  const isWhite = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols && struct[idx(r, c)].kind === 'white'

  const runs: Run[] = []
  const acrossRunOf = new Array<number>(N).fill(-1)
  const downRunOf = new Array<number>(N).fill(-1)

  // Across runs: a run starts at a white cell whose left neighbour is not white.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isWhite(r, c) || isWhite(r, c - 1)) continue
      const cells: number[] = []
      let sum = 0
      let cc = c
      while (isWhite(r, cc)) {
        const i = idx(r, cc)
        cells.push(i)
        sum += solution[i]
        cc++
      }
      if (c === 0) throw new Error(`${raw.id}: across run has no clue holder at row ${r} (col 0 must be black)`)
      const runIndex = runs.length
      runs.push({ orient: 'across', clue: sum, clueIndex: idx(r, c - 1), cells })
      for (const i of cells) acrossRunOf[i] = runIndex
      ;(struct[idx(r, c - 1)] as BlackCell).across = sum
    }
  }
  // Down runs: a run starts at a white cell whose top neighbour is not white.
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!isWhite(r, c) || isWhite(r - 1, c)) continue
      const cells: number[] = []
      let sum = 0
      let rr = r
      while (isWhite(rr, c)) {
        const i = idx(rr, c)
        cells.push(i)
        sum += solution[i]
        rr++
      }
      if (r === 0) throw new Error(`${raw.id}: down run has no clue holder at col ${c} (row 0 must be black)`)
      const runIndex = runs.length
      runs.push({ orient: 'down', clue: sum, clueIndex: idx(r - 1, c), cells })
      for (const i of cells) downRunOf[i] = runIndex
      ;(struct[idx(r - 1, c)] as BlackCell).down = sum
    }
  }

  return { id: raw.id, name: raw.name, difficulty: raw.difficulty, rows, cols, struct, solution, runs, whites, acrossRunOf, downRunOf }
}

// -- Board ops (each pure; illegal → SAME reference) -------------------------

export function createBoard(p: Puzzle): Board {
  return {
    puzzleId: p.id,
    values: new Array<number>(p.struct.length).fill(0),
    notes: p.struct.map(() => [] as number[]),
  }
}

const isWhiteCell = (p: Puzzle, i: number) => i >= 0 && i < p.struct.length && p.struct[i].kind === 'white'

/** Write `digit` (1-9) into white cell `index`. No-op (same ref) if illegal or unchanged. */
export function fill(p: Puzzle, board: Board, index: number, digit: number): Board {
  if (!isWhiteCell(p, index)) return board
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return board
  if (board.values[index] === digit) return board
  const values = board.values.slice()
  values[index] = digit
  let notes = board.notes
  if (board.notes[index].length > 0) {
    notes = board.notes.slice()
    notes[index] = []
  }
  return { ...board, values, notes }
}

/** Clear white cell `index` (value + notes). No-op (same ref) if already empty / illegal. */
export function erase(p: Puzzle, board: Board, index: number): Board {
  if (!isWhiteCell(p, index)) return board
  const hadValue = board.values[index] !== 0
  const hadNotes = board.notes[index].length > 0
  if (!hadValue && !hadNotes) return board
  let values = board.values
  if (hadValue) {
    values = board.values.slice()
    values[index] = 0
  }
  let notes = board.notes
  if (hadNotes) {
    notes = board.notes.slice()
    notes[index] = []
  }
  return { ...board, values, notes }
}

/** Toggle a pencil-mark digit on white cell `index`. No-op (same ref) if illegal
 *  or the cell already holds a value (can't pencil over an answer). */
export function toggleNote(p: Puzzle, board: Board, index: number, digit: number): Board {
  if (!isWhiteCell(p, index)) return board
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return board
  if (board.values[index] !== 0) return board
  const cur = board.notes[index]
  const at = cur.indexOf(digit)
  const notes = board.notes.slice()
  notes[index] = at >= 0 ? cur.filter((d) => d !== digit) : [...cur, digit].sort((a, b) => a - b)
  return { ...board, notes }
}

// -- Run / error validation --------------------------------------------------

export type RunState = 'empty' | 'partial' | 'complete' | 'error'

/**
 * State of a single run given the current board:
 * - 'empty'    — no cell filled
 * - 'complete' — every cell filled, no repeats, sum === clue
 * - 'error'    — a repeated digit, a full-but-wrong sum, or a partial sum that
 *                already makes the clue unreachable (over/exact-with-cells-left)
 * - 'partial'  — otherwise (still in progress, still feasible)
 */
export function runState(board: Board, run: Run): RunState {
  let filled = 0
  let sum = 0
  let mask = 0
  let repeat = false
  for (const i of run.cells) {
    const v = board.values[i]
    if (v === 0) continue
    filled++
    sum += v
    const bit = 1 << v
    if (mask & bit) repeat = true
    mask |= bit
  }
  if (filled === 0) return 'empty'
  if (repeat) return 'error'
  const full = filled === run.cells.length
  if (full) return sum === run.clue ? 'complete' : 'error'
  // Not full: remaining cells each need a distinct unused digit ≥ 1, so the
  // running sum must leave strictly positive room.
  if (sum >= run.clue) return 'error'
  return 'partial'
}

/** Flat indices of every white cell that sits in a run currently in 'error' state. */
export function findErrors(p: Puzzle, board: Board): Set<number> {
  const bad = new Set<number>()
  for (const run of p.runs) {
    if (runState(board, run) === 'error') for (const i of run.cells) bad.add(i)
  }
  return bad
}

/** Every white cell filled AND every run complete (no repeats, sums exact). */
export function isSolved(p: Puzzle, board: Board): boolean {
  for (const i of p.whites) if (board.values[i] === 0) return false
  for (const run of p.runs) if (runState(board, run) !== 'complete') return false
  return true
}

/** How many white cells are still empty. */
export function remainingCells(p: Puzzle, board: Board): number {
  let n = 0
  for (const i of p.whites) if (board.values[i] === 0) n++
  return n
}

// -- Solving aid: digit combinations -----------------------------------------

/**
 * All sets of `n` DISTINCT digits (1-9) that sum to `sum`, each as an ascending
 * array. The classic Kakuro "which digits can make this?" aid. Pure & total.
 */
export function combos(sum: number, n: number): number[][] {
  const out: number[][] = []
  if (n < 1 || n > 9) return out
  const acc: number[] = []
  const rec = (start: number, remaining: number, need: number) => {
    if (need === 0) {
      if (remaining === 0) out.push(acc.slice())
      return
    }
    for (let d = start; d <= 9; d++) {
      if (d > remaining) break
      acc.push(d)
      rec(d + 1, remaining - d, need - 1)
      acc.pop()
    }
  }
  rec(1, sum, n)
  return out
}

// -- Uniqueness solver (TESTS ONLY) ------------------------------------------

/**
 * Count solutions of `p`, stopping once `limit` (default 2) are found. `1` means
 * the puzzle is uniquely solvable; `>=2` ambiguous; `0` unsolvable. Backtracking
 * with MRV cell selection and per-run no-repeat + sum-feasibility pruning. Pure
 * (operates on scratch arrays; never touches a Board).
 */
export function countSolutions(p: Puzzle, limit = 2): number {
  const values = new Array<number>(p.struct.length).fill(0)
  const runs = p.runs
  const usedMask = runs.map(() => 0)
  const sumLeft = runs.map((r) => r.clue)
  const emptyLeft = runs.map((r) => r.cells.length)
  const whites = p.whites
  const acrossRunOf = p.acrossRunOf
  const downRunOf = p.downRunOf
  let count = 0

  const candidatesFor = (i: number): number[] => {
    const ar = acrossRunOf[i]
    const dr = downRunOf[i]
    const res: number[] = []
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << d
      if (usedMask[ar] & bit) continue
      if (usedMask[dr] & bit) continue
      if (d > sumLeft[ar] || d > sumLeft[dr]) continue
      // If this is the last empty in a run, the digit must land the sum exactly.
      if (emptyLeft[ar] === 1 && d !== sumLeft[ar]) continue
      if (emptyLeft[dr] === 1 && d !== sumLeft[dr]) continue
      res.push(d)
    }
    return res
  }

  const search = (): boolean => {
    let bestIdx = -1
    let bestCands: number[] | null = null
    for (const i of whites) {
      if (values[i] !== 0) continue
      const cands = candidatesFor(i)
      if (cands.length === 0) return false // dead end
      if (bestCands === null || cands.length < bestCands.length) {
        bestIdx = i
        bestCands = cands
        if (cands.length === 1) break
      }
    }
    if (bestIdx === -1) {
      count++
      return count >= limit
    }
    const ar = acrossRunOf[bestIdx]
    const dr = downRunOf[bestIdx]
    for (const d of bestCands as number[]) {
      const bit = 1 << d
      values[bestIdx] = d
      usedMask[ar] |= bit
      usedMask[dr] |= bit
      sumLeft[ar] -= d
      sumLeft[dr] -= d
      emptyLeft[ar]--
      emptyLeft[dr]--
      const abort = search()
      values[bestIdx] = 0
      usedMask[ar] &= ~bit
      usedMask[dr] &= ~bit
      sumLeft[ar] += d
      sumLeft[dr] += d
      emptyLeft[ar]++
      emptyLeft[dr]++
      if (abort) return true
    }
    return false
  }

  search()
  return count
}

/** Convenience: does the puzzle have exactly one solution? (tests) */
export function isUnique(p: Puzzle): boolean {
  return countSolutions(p, 2) === 1
}

// -- The puzzle bank ---------------------------------------------------------
// Offline-generated (scratch script) then re-verified UNIQUELY solvable by
// `countSolutions` in engine.test.ts. Progressive difficulty. '#' = black wall,
// digit = white cell's solved value. Row 0 and col 0 are always black so every
// run has a clue holder.

export const RAW_PUZZLES: RawPuzzle[] = [
  {
    id: 'k1',
    name: 'Warm-up',
    difficulty: 'easy',
    grid: ['#####', '#489#', '#248#', '#136#', '#####'],
  },
  {
    id: 'k2',
    name: 'First Steps',
    difficulty: 'easy',
    grid: ['#####', '#214#', '#869#', '#138#', '#####'],
  },
  {
    id: 'k3',
    name: 'Easy Does It',
    difficulty: 'easy',
    grid: ['######', '#95###', '#719##', '##683#', '###41#', '######'],
  },
  {
    id: 'k4',
    name: 'Getting Warmer',
    difficulty: 'easy',
    grid: ['######', '##623#', '##859#', '#796##', '#251##', '######'],
  },
  {
    id: 'k5',
    name: 'Steady',
    difficulty: 'medium',
    grid: ['######', '#91###', '#8792#', '#3271#', '###84#', '######'],
  },
  {
    id: 'k6',
    name: 'Cross Talk',
    difficulty: 'medium',
    grid: ['#######', '##51###', '#895###', '#12#42#', '###281#', '###13##', '#######'],
  },
  {
    id: 'k7',
    name: 'Interlock',
    difficulty: 'medium',
    grid: ['#######', '####93#', '###241#', '##598##', '#946###', '#41####', '#######'],
  },
  {
    id: 'k8',
    name: 'Sum Puzzle',
    difficulty: 'medium',
    grid: ['#######', '###62##', '###549#', '#13#18#', '#984###', '##71###', '#######'],
  },
  {
    id: 'k9',
    name: 'Tangle',
    difficulty: 'hard',
    grid: ['#######', '##41###', '##1254#', '#23#17#', '#9583##', '###12##', '#######'],
  },
  {
    id: 'k10',
    name: 'Knot',
    difficulty: 'hard',
    grid: ['########', '########', '#85#98##', '#78#75##', '##95#26#', '##79#49#', '########', '########'],
  },
  {
    id: 'k11',
    name: 'Deep End',
    difficulty: 'hard',
    grid: ['########', '##31####', '#31298##', '#46#79##', '##59#79#', '##23168#', '####75##', '########'],
  },
  {
    id: 'k12',
    name: 'Gridlock',
    difficulty: 'hard',
    grid: ['########', '##67####', '#47963##', '#19#54##', '##43#17#', '##51924#', '####85##', '########'],
  },
  {
    id: 'k13',
    name: 'Labyrinth',
    difficulty: 'expert',
    grid: ['########', '###59###', '##1473##', '#59##42#', '#17##94#', '##4215##', '###43###', '########'],
  },
  {
    id: 'k14',
    name: 'Crosswind',
    difficulty: 'expert',
    grid: ['#########', '##36#####', '#4123####', '#17#21###', '##59#89##', '###63#73#', '####5769#', '#####32##', '#########'],
  },
  {
    id: 'k15',
    name: 'Deep Cross',
    difficulty: 'expert',
    grid: ['########', '####59##', '##9738##', '#715#76#', '#98#431#', '##7861##', '##53####', '########'],
  },
  {
    id: 'k16',
    name: 'Overtime',
    difficulty: 'expert',
    grid: ['########', '####29##', '##16579#', '##78#23#', '#26#73##', '#14298##', '##84####', '########'],
  },
]

export const PUZZLES: Puzzle[] = RAW_PUZZLES.map(buildPuzzle)

export function puzzleById(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id)
}
