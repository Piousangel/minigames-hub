// Duplex engine — pure, deterministic, rng injected (NO Math.random).
//
// One input drives two mirror-coupled tokens. Press a direction: "You" (blue)
// steps that way while "Echo" (amber) steps the mirrored direction determined
// by the level's reflection axis. A token blocked by a wall / edge / adverse
// one-way gate idles while its twin keeps moving — walls deliberately break the
// symmetry lock and become the solving tool.
//
// Static geometry (walls / ice / arrows / goals) is parsed once per level and
// shared by every derived state (frozen — never mutated). Only token positions,
// remaining pellet sets and the move counter change as the game is played.

export type Direction = 'up' | 'down' | 'left' | 'right'
export type MirrorMode = 'horizontal' | 'vertical' | 'point' | 'diagonal' | 'antidiagonal'

export interface Cell {
  row: number
  col: number
}

/** Returns [0, 1); ALWAYS injected — never sourced from Math.random. */
export type Rng = () => number

/** Static level geometry (shared across derived states — never mutate). */
export interface Level {
  name: string
  mode: MirrorMode
  /** MUST equal the BFS-optimal move count (test-enforced). */
  par: number
  /** First level of a new axis → plays the flip intro. */
  intro?: boolean
  /** ASCII rows (see the glyph table in parseLevel). */
  grid: readonly string[]
}

export type PelletKind = 'you' | 'echo'

export interface GameState {
  levelIndex: number
  width: number
  height: number
  mode: MirrorMode
  par: number
  walls: readonly (readonly boolean[])[]
  ice: readonly (readonly boolean[])[]
  arrows: readonly (readonly (Direction | null)[])[]
  youGoal: Cell | null
  echoGoal: Cell | null
  you: Cell
  echo: Cell
  youPellets: ReadonlySet<string>
  echoPellets: ReadonlySet<string>
  moves: number
}

export const keyOf = (row: number, col: number): string => `${row},${col}`

export const DELTAS: Record<Direction, Cell> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
}

export const MIRROR: Record<MirrorMode, Record<Direction, Direction>> = {
  // left↔right, up/down shared
  horizontal: { up: 'up', down: 'down', left: 'right', right: 'left' },
  // up↔down, left/right shared
  vertical: { up: 'down', down: 'up', left: 'left', right: 'right' },
  // 180° point: both components flip
  point: { up: 'down', down: 'up', left: 'right', right: 'left' },
  // reflect across main diagonal y=x: (dr,dc)→(dc,dr)
  diagonal: { up: 'left', down: 'right', left: 'up', right: 'down' },
  // reflect across anti-diagonal y=-x: (dr,dc)→(-dc,-dr)
  antidiagonal: { up: 'right', down: 'left', left: 'down', right: 'up' },
}

export function mirror(dir: Direction, mode: MirrorMode): Direction {
  return MIRROR[mode][dir]
}

export interface MoveResult {
  /** Cells ENTERED this move (excludes the origin). */
  path: Cell[]
  rest: Cell
}

export function resolveMove(state: GameState, from: Cell, dir: Direction): MoveResult {
  const { row: dr, col: dc } = DELTAS[dir]
  let cur = from
  const path: Cell[] = []
  const limit = state.width + state.height
  for (let i = 0; i < limit; i++) {
    const next = { row: cur.row + dr, col: cur.col + dc }
    // Edge / wall block.
    if (
      next.row < 0 ||
      next.row >= state.height ||
      next.col < 0 ||
      next.col >= state.width ||
      state.walls[next.row][next.col]
    ) {
      break
    }
    // One-way gate: enter only when the move direction equals the arrow.
    const gate = state.arrows[next.row][next.col]
    if (gate !== null && gate !== dir) break
    // Enter.
    cur = next
    path.push(next)
    // Ice keeps sliding; anything else rests here.
    if (!state.ice[cur.row][cur.col]) break
  }
  return { path, rest: cur }
}

export function step(state: GameState, dir: Direction): GameState {
  const youM = resolveMove(state, state.you, dir)
  const echoM = resolveMove(state, state.echo, mirror(dir, state.mode))

  // No-op rejection: both tokens idle → return the same reference.
  if (youM.path.length === 0 && echoM.path.length === 0) return state

  let youPellets = state.youPellets
  if (youM.path.length > 0) {
    let next: Set<string> | null = null
    for (const c of youM.path) {
      const k = keyOf(c.row, c.col)
      if (state.youPellets.has(k)) {
        if (!next) next = new Set(state.youPellets)
        next.delete(k)
      }
    }
    if (next) youPellets = next
  }

  let echoPellets = state.echoPellets
  if (echoM.path.length > 0) {
    let next: Set<string> | null = null
    for (const c of echoM.path) {
      const k = keyOf(c.row, c.col)
      if (state.echoPellets.has(k)) {
        if (!next) next = new Set(state.echoPellets)
        next.delete(k)
      }
    }
    if (next) echoPellets = next
  }

  return {
    ...state,
    you: youM.rest,
    echo: echoM.rest,
    youPellets,
    echoPellets,
    moves: state.moves + 1,
  }
}

export function isWon(s: GameState): boolean {
  const youOk = s.youGoal === null || (s.you.row === s.youGoal.row && s.you.col === s.youGoal.col)
  const echoOk = s.echoGoal === null || (s.echo.row === s.echoGoal.row && s.echo.col === s.echoGoal.col)
  return youOk && echoOk && s.youPellets.size === 0 && s.echoPellets.size === 0
}

export function goalSatisfaction(s: GameState): { you: boolean; echo: boolean } {
  return {
    you: s.youGoal === null || (s.you.row === s.youGoal.row && s.you.col === s.youGoal.col),
    echo: s.echoGoal === null || (s.echo.row === s.echoGoal.row && s.echo.col === s.echoGoal.col),
  }
}

export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par) return 3
  if (moves <= par + Math.ceil(par * 0.5)) return 2
  return 1
}

export function preview(s: GameState, dir: Direction): { you: Cell; echo: Cell } {
  return {
    you: resolveMove(s, s.you, dir).rest,
    echo: resolveMove(s, s.echo, mirror(dir, s.mode)).rest,
  }
}

export function previewAll(s: GameState): Record<Direction, { you: Cell; echo: Cell }> {
  return {
    up: preview(s, 'up'),
    down: preview(s, 'down'),
    left: preview(s, 'left'),
    right: preview(s, 'right'),
  }
}

// ---------------------------------------------------------------------------
// Level notation + parsing
// ---------------------------------------------------------------------------
//
//   #  wall          ~  ice
//  ' ' floor         ^ v < >  one-way arrow (up/down/left/right)
//   Y  You start     G  You goal
//   E  Echo start    H  Echo goal
//   o  You pellet    x  Echo pellet

const ARROW_GLYPH: Record<string, Direction> = { '^': 'up', v: 'down', '<': 'left', '>': 'right' }

function freezeGrid<T>(rows: T[][]): readonly (readonly T[])[] {
  for (const r of rows) Object.freeze(r)
  return Object.freeze(rows)
}

export function parseLevel(level: Level, levelIndex = 0): GameState {
  const grid = level.grid
  const height = grid.length
  if (height === 0) throw new Error('Duplex level: empty grid')
  const width = Math.max(...grid.map((r) => r.length))

  const walls: boolean[][] = []
  const ice: boolean[][] = []
  const arrows: (Direction | null)[][] = []
  let you: Cell | null = null
  let echo: Cell | null = null
  let youGoal: Cell | null = null
  let echoGoal: Cell | null = null
  const youPellets = new Set<string>()
  const echoPellets = new Set<string>()
  let youCount = 0
  let echoCount = 0
  let goalCount = 0
  let echoGoalCount = 0

  for (let r = 0; r < height; r++) {
    const wRow: boolean[] = []
    const iRow: boolean[] = []
    const aRow: (Direction | null)[] = []
    const line = grid[r]
    for (let c = 0; c < width; c++) {
      const ch = c < line.length ? line[c] : ' '
      let wall = false
      let isIce = false
      let arrow: Direction | null = null
      switch (ch) {
        case '#':
          wall = true
          break
        case '~':
          isIce = true
          break
        case '^':
        case 'v':
        case '<':
        case '>':
          arrow = ARROW_GLYPH[ch]
          break
        case 'Y':
          you = { row: r, col: c }
          youCount++
          break
        case 'E':
          echo = { row: r, col: c }
          echoCount++
          break
        case 'G':
          youGoal = { row: r, col: c }
          goalCount++
          break
        case 'H':
          echoGoal = { row: r, col: c }
          echoGoalCount++
          break
        case 'o':
          youPellets.add(keyOf(r, c))
          break
        case 'x':
          echoPellets.add(keyOf(r, c))
          break
        case ' ':
          break
        default:
          throw new Error(`Duplex level: unknown glyph '${ch}'`)
      }
      wRow.push(wall)
      iRow.push(isIce)
      aRow.push(arrow)
    }
    walls.push(wRow)
    ice.push(iRow)
    arrows.push(aRow)
  }

  if (youCount !== 1) throw new Error('Duplex level: must have exactly one Y')
  if (echoCount !== 1) throw new Error('Duplex level: must have exactly one E')
  if (goalCount > 1) throw new Error('Duplex level: at most one G')
  if (echoGoalCount > 1) throw new Error('Duplex level: at most one H')
  if (level.par < 1) throw new Error('Duplex level: par must be >= 1')
  const hasObjective = youGoal !== null || echoGoal !== null || youPellets.size > 0 || echoPellets.size > 0
  if (!hasObjective) throw new Error('Duplex level: needs at least one objective')
  if (!you || !echo) throw new Error('Duplex level: missing Y or E')
  // Start cells sit on floor in authored content.
  if (walls[you.row][you.col] || ice[you.row][you.col] || arrows[you.row][you.col] !== null)
    throw new Error('Duplex level: Y must start on floor')
  if (walls[echo.row][echo.col] || ice[echo.row][echo.col] || arrows[echo.row][echo.col] !== null)
    throw new Error('Duplex level: E must start on floor')

  return {
    levelIndex,
    width,
    height,
    mode: level.mode,
    par: level.par,
    walls: freezeGrid(walls),
    ice: freezeGrid(ice),
    arrows: freezeGrid(arrows),
    youGoal,
    echoGoal,
    you,
    echo,
    youPellets,
    echoPellets,
    moves: 0,
  }
}

// ---------------------------------------------------------------------------
// Levels + packs (escalating reflection axis)
// ---------------------------------------------------------------------------

export const LEVELS: readonly Level[] = [
  // ===== Pack 1 — Horizontal (left↔right; up/down shared) =====
  {
    name: 'Meet in the Middle',
    mode: 'horizontal',
    par: 1,
    intro: true,
    grid: ['#######', '#YG HE#', '#######'],
  },
  {
    name: 'Descend Together',
    mode: 'horizontal',
    par: 2,
    grid: ['#####', '#Y E#', '#   #', '#G H#', '#####'],
  },
  {
    name: 'Long Hall',
    mode: 'horizontal',
    par: 3,
    grid: ['#########', '#Y  G  E#', '#########'],
  },
  {
    name: 'Wall Between',
    mode: 'horizontal',
    par: 2,
    grid: ['#######', '#Y   E#', '#  #  #', '#G   H#', '#######'],
  },
  {
    name: 'Twin Crumbs',
    mode: 'horizontal',
    par: 8,
    grid: ['#######', '#Yo oE#', '#     #', '#G   H#', '#######'],
  },

  // ===== Pack 2 — Vertical (up↔down; left/right shared) =====
  {
    name: 'Stacked',
    mode: 'vertical',
    par: 2,
    intro: true,
    grid: ['#####', '#Y H#', '#   #', '#G E#', '#####'],
  },
  {
    name: 'Side Step',
    mode: 'vertical',
    par: 4,
    grid: ['#####', '#Y H#', '#   #', '#E G#', '#####'],
  },
  {
    name: 'Column Swap',
    mode: 'vertical',
    par: 3,
    grid: ['######', '#Y  H#', '#    #', '#    #', '#G  E#', '######'],
  },
  {
    name: 'Frost Drop',
    mode: 'vertical',
    par: 1,
    grid: ['#####', '#Y H#', '#~ ~#', '#~ ~#', '#G E#', '#####'],
  },

  // ===== Pack 3 — Point (180°; both axes flip) =====
  {
    name: 'Half Turn',
    mode: 'point',
    par: 1,
    intro: true,
    grid: ['#####', '#YG #', '#   #', '# HE#', '#####'],
  },
  {
    name: 'Diagonal Meet',
    mode: 'point',
    par: 2,
    grid: ['#####', '#Y G#', '#   #', '#H E#', '#####'],
  },
  {
    name: 'Opposite Corners',
    mode: 'point',
    par: 2,
    grid: ['######', '#Y   #', '# G  #', '#  H #', '#   E#', '######'],
  },
  {
    name: 'Around the Post',
    mode: 'point',
    par: 2,
    grid: ['#####', '#Y H#', '# # #', '#G E#', '#####'],
  },

  // ===== Pack 4 — Diagonal (transpose; row↔col) =====
  {
    name: 'Transpose',
    mode: 'diagonal',
    par: 2,
    intro: true,
    grid: ['####', '#YG#', '#HE#', '####'],
  },
  {
    name: 'Mirror Fall',
    mode: 'diagonal',
    par: 6,
    grid: ['#####', '#Y  #', '#  H#', '# G #', '#  E#', '#####'],
  },
  {
    name: 'Cross Weave',
    mode: 'diagonal',
    par: 4,
    grid: ['#####', '#Y  #', '#   #', '#  G#', '#  E#', '#####'],
  },

  // ===== Bonus — Antidiagonal =====
  {
    name: 'Counter-Diagonal',
    mode: 'antidiagonal',
    par: 1,
    intro: true,
    grid: ['#####', '#YG #', '#  H#', '#  E#', '#####'],
  },
]

export interface Pack {
  name: string
  mode: MirrorMode
  /** inclusive level range */
  start: number
  end: number
}

export const PACKS: readonly Pack[] = [
  { name: 'Horizontal', mode: 'horizontal', start: 0, end: 4 },
  { name: 'Vertical', mode: 'vertical', start: 5, end: 8 },
  { name: 'Point', mode: 'point', start: 9, end: 12 },
  { name: 'Diagonal', mode: 'diagonal', start: 13, end: 15 },
  { name: 'Anti-Diagonal', mode: 'antidiagonal', start: 16, end: 16 },
]

export const levelCount: number = LEVELS.length

export function loadLevel(index: number): GameState {
  const n = LEVELS.length
  const i = ((index % n) + n) % n
  return parseLevel(LEVELS[i], i)
}

export function reset(state: GameState): GameState {
  return loadLevel(state.levelIndex)
}

// ---------------------------------------------------------------------------
// Deterministic RNG + daily generator (rng injected)
// ---------------------------------------------------------------------------

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dailySeed(isoDate: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < isoDate.length; i++) {
    h ^= isoDate.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** BFS-optimal move count over `step`; null if unsolvable within the bound. */
export function solveOptimal(start: GameState, maxNodes = 200000): number | null {
  if (isWon(start)) return 0
  const serialize = (s: GameState): string =>
    `${keyOf(s.you.row, s.you.col)}|${keyOf(s.echo.row, s.echo.col)}|${[...s.youPellets]
      .sort()
      .join(',')}|${[...s.echoPellets].sort().join(',')}`
  const dirs: Direction[] = ['up', 'down', 'left', 'right']
  const seen = new Set<string>([serialize(start)])
  let frontier: GameState[] = [start]
  let depth = 0
  let nodes = 0
  while (frontier.length) {
    depth++
    const nextFrontier: GameState[] = []
    for (const cur of frontier) {
      for (const d of dirs) {
        const next = step(cur, d)
        if (next === cur) continue
        if (isWon(next)) return depth
        const key = serialize(next)
        if (seen.has(key)) continue
        seen.add(key)
        nodes++
        if (nodes > maxNodes) return null
        nextFrontier.push(next)
      }
    }
    frontier = nextFrontier
  }
  return null
}

const DAILY_MODES: readonly MirrorMode[] = ['horizontal', 'vertical', 'point', 'diagonal', 'antidiagonal']

function mirrorCell(cell: Cell, mode: MirrorMode, size: number): Cell {
  const { row: r, col: c } = cell
  const m = size - 1
  switch (mode) {
    case 'horizontal':
      return { row: r, col: m - c }
    case 'vertical':
      return { row: m - r, col: c }
    case 'point':
      return { row: m - r, col: m - c }
    case 'diagonal':
      return { row: c, col: r }
    case 'antidiagonal':
      return { row: m - c, col: m - r }
  }
}

/**
 * Deterministic daily puzzle. A square walled grid with mirror-consistent token
 * and goal placement; verified BFS-solvable, par set to the BFS optimum. Every
 * draw comes from the injected rng — no Math.random.
 */
export function generateDaily(rng: Rng): GameState {
  const size = 5 // interior 3×3 inside a border wall; square so diagonal works
  const modeIdx = Math.floor(rng() * DAILY_MODES.length) % DAILY_MODES.length
  const mode = DAILY_MODES[modeIdx]
  const interior: Cell[] = []
  for (let r = 1; r < size - 1; r++) for (let c = 1; c < size - 1; c++) interior.push({ row: r, col: c })

  const pick = (cells: Cell[]): Cell => cells[Math.floor(rng() * cells.length) % cells.length]

  for (let attempt = 0; attempt < 400; attempt++) {
    const you = pick(interior)
    const echo = mirrorCell(you, mode, size)
    const youGoal = pick(interior)
    const echoGoal = mirrorCell(youGoal, mode, size)
    // Require a real puzzle: You must actually have to move.
    if (you.row === youGoal.row && you.col === youGoal.col) continue

    const state = buildDailyState(size, mode, you, echo, youGoal, echoGoal)
    const par = solveOptimal(state)
    if (par !== null && par >= 1) return { ...state, par }
  }

  // Fallback (guaranteed solvable open grid).
  const you = { row: 1, col: 1 }
  const echo = mirrorCell(you, mode, size)
  const youGoal = { row: size - 2, col: size - 2 }
  const echoGoal = mirrorCell(youGoal, mode, size)
  const state = buildDailyState(size, mode, you, echo, youGoal, echoGoal)
  const par = solveOptimal(state) ?? 1
  return { ...state, par }
}

function buildDailyState(
  size: number,
  mode: MirrorMode,
  you: Cell,
  echo: Cell,
  youGoal: Cell,
  echoGoal: Cell,
): GameState {
  const walls: boolean[][] = []
  const ice: boolean[][] = []
  const arrows: (Direction | null)[][] = []
  for (let r = 0; r < size; r++) {
    const wRow: boolean[] = []
    const iRow: boolean[] = []
    const aRow: (Direction | null)[] = []
    for (let c = 0; c < size; c++) {
      wRow.push(r === 0 || c === 0 || r === size - 1 || c === size - 1)
      iRow.push(false)
      aRow.push(null)
    }
    walls.push(wRow)
    ice.push(iRow)
    arrows.push(aRow)
  }
  return {
    levelIndex: -1,
    width: size,
    height: size,
    mode,
    par: 1,
    walls: freezeGrid(walls),
    ice: freezeGrid(ice),
    arrows: freezeGrid(arrows),
    youGoal,
    echoGoal,
    you,
    echo,
    youPellets: new Set<string>(),
    echoPellets: new Set<string>(),
    moves: 0,
  }
}
