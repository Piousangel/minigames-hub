// Sokoban engine — pure, deterministic, no rng.
//
// A warehouse grid: the player pushes boxes onto target spots. Walls block
// movement, a single box can be pushed if the cell beyond it is free, and two
// boxes (or a box against a wall) cannot be pushed.
//
// Static geometry (walls + targets) is parsed once per level and shared by
// every derived state; only the player position, the set of box positions and
// the move counter change as the game is played. Style mirrors
// `src/lib/games/g2048/engine.ts`.

export type Direction = 'up' | 'down' | 'left' | 'right'

/** What to render at a given cell (static + dynamic combined). */
export type TileKind =
  | 'wall'
  | 'floor'
  | 'target'
  | 'box'
  | 'box-on-target'
  | 'player'
  | 'player-on-target'

export interface Cell {
  row: number
  col: number
}

export interface GameState {
  levelIndex: number
  width: number
  height: number
  /** Static walls — shared across states of the same level (do not mutate). */
  walls: boolean[][]
  /** Static targets — shared across states of the same level (do not mutate). */
  targets: boolean[][]
  /** Dynamic box positions, keyed "row,col". */
  boxes: Set<string>
  player: Cell
  moves: number
}

const DELTAS: Record<Direction, Cell> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
}

export const keyOf = (row: number, col: number): string => `${row},${col}`

/**
 * Hand-designed, solvable levels of increasing difficulty. Curated (never
 * procedurally generated). Legend follows the classic Sokoban notation:
 *
 *   `#` wall   ` ` floor   `.` target   `$` box
 *   `*` box on target      `@` player   `+` player on target
 */
export const LEVELS: readonly (readonly string[])[] = [
  // 1 — the very first push: one box, one step right.
  [
    '#####',
    '#@$.#',
    '#####',
  ],
  // 2 — push the box twice across the aisle.
  [
    '######',
    '#    #',
    '#@$ .#',
    '#    #',
    '######',
  ],
  // 3 — a corner turn: right, then up.
  [
    '#######',
    '#   . #',
    '# @$  #',
    '#     #',
    '#######',
  ],
  // 4 — two boxes, pushed outward to opposite walls.
  [
    '########',
    '#      #',
    '# .$ $.#',
    '#  @   #',
    '#      #',
    '########',
  ],
  // 5 — two boxes, each needing a turn.
  [
    '#######',
    '#     #',
    '# .$  #',
    '#  @  #',
    '#  $ .#',
    '#     #',
    '#######',
  ],
  // 6 — a walled aisle: route around the barrier to push left.
  [
    '######',
    '#    #',
    '# .$ #',
    '# ## #',
    '#  @ #',
    '######',
  ],
  // 7 — three boxes to a shared goal strip.
  [
    '########',
    '#      #',
    '# $$$  #',
    '# @    #',
    '# ...  #',
    '#      #',
    '########',
  ],
  // 8 — four boxes, each nudged to its wall target.
  [
    '########',
    '#      #',
    '# .$ $.#',
    '#      #',
    '# .$ $.#',
    '#  @   #',
    '########',
  ],
]

export const levelCount = LEVELS.length

interface ParsedLevel {
  width: number
  height: number
  walls: boolean[][]
  targets: boolean[][]
  boxes: string[]
  player: Cell
}

/** Parse a level's character rows into static geometry + dynamic starts. */
export function parseLevel(rows: readonly string[]): ParsedLevel {
  const height = rows.length
  const width = Math.max(...rows.map((r) => r.length))
  const walls: boolean[][] = []
  const targets: boolean[][] = []
  const boxes: string[] = []
  let player: Cell | null = null

  for (let r = 0; r < height; r++) {
    const wallRow: boolean[] = []
    const targetRow: boolean[] = []
    for (let c = 0; c < width; c++) {
      const ch = rows[r][c] ?? ' '
      wallRow.push(ch === '#')
      targetRow.push(ch === '.' || ch === '*' || ch === '+')
      if (ch === '$' || ch === '*') boxes.push(keyOf(r, c))
      if (ch === '@' || ch === '+') player = { row: r, col: c }
    }
    walls.push(wallRow)
    targets.push(targetRow)
  }

  if (!player) throw new Error('Sokoban level has no player')
  return { width, height, walls, targets, boxes, player }
}

/** Build a fresh playable state for the given level index. */
export function loadLevel(index: number): GameState {
  const clamped = ((index % levelCount) + levelCount) % levelCount
  const parsed = parseLevel(LEVELS[clamped])
  return {
    levelIndex: clamped,
    width: parsed.width,
    height: parsed.height,
    walls: parsed.walls,
    targets: parsed.targets,
    boxes: new Set(parsed.boxes),
    player: parsed.player,
    moves: 0,
  }
}

/** Restore the state's level to its starting position (move counter reset). */
export function reset(state: GameState): GameState {
  return loadLevel(state.levelIndex)
}

const inBounds = (state: GameState, r: number, c: number): boolean =>
  r >= 0 && r < state.height && c >= 0 && c < state.width

const isWall = (state: GameState, r: number, c: number): boolean =>
  !inBounds(state, r, c) || state.walls[r][c]

/**
 * Attempt to move the player one step in `direction`.
 *
 * - Walking into floor/target moves the player.
 * - Walking into a box pushes it if the cell beyond is free (not a wall and not
 *   another box); otherwise nothing happens.
 * - A move that changes nothing returns the same state reference (so the move
 *   counter only advances on real moves).
 */
export function move(state: GameState, direction: Direction): GameState {
  const d = DELTAS[direction]
  const nr = state.player.row + d.row
  const nc = state.player.col + d.col

  if (isWall(state, nr, nc)) return state

  const targetKey = keyOf(nr, nc)
  if (state.boxes.has(targetKey)) {
    // Pushing a box — the cell beyond must be free.
    const br = nr + d.row
    const bc = nc + d.col
    if (isWall(state, br, bc) || state.boxes.has(keyOf(br, bc))) return state

    const boxes = new Set(state.boxes)
    boxes.delete(targetKey)
    boxes.add(keyOf(br, bc))
    return { ...state, boxes, player: { row: nr, col: nc }, moves: state.moves + 1 }
  }

  // Walking into empty floor/target.
  return { ...state, player: { row: nr, col: nc }, moves: state.moves + 1 }
}

/** True when every box sits on a target (puzzle complete). */
export function isSolved(state: GameState): boolean {
  for (const key of state.boxes) {
    const [r, c] = key.split(',').map(Number)
    if (!state.targets[r][c]) return false
  }
  return true
}

/** Resolve the display tile at a cell, combining static + dynamic layers. */
export function tileAt(state: GameState, row: number, col: number): TileKind {
  if (state.walls[row][col]) return 'wall'
  const onTarget = state.targets[row][col]
  if (state.player.row === row && state.player.col === col) {
    return onTarget ? 'player-on-target' : 'player'
  }
  if (state.boxes.has(keyOf(row, col))) {
    return onTarget ? 'box-on-target' : 'box'
  }
  return onTarget ? 'target' : 'floor'
}
