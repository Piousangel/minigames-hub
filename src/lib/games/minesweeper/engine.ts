export const MS_SIZE = 9
export const MS_MINES = 10

export type Rng = () => number

export interface MsCell {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

export interface MsState {
  grid: MsCell[][] // [y][x]
  minesPlaced: boolean
  over: boolean
  won: boolean
}

export function newMinesweeper(): MsState {
  const grid = Array.from({ length: MS_SIZE }, () =>
    Array.from({ length: MS_SIZE }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
  )
  return { grid, minesPlaced: false, over: false, won: false }
}

function neighbors(x: number, y: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < MS_SIZE && ny >= 0 && ny < MS_SIZE) out.push([nx, ny])
    }
  }
  return out
}

const cloneGrid = (grid: MsCell[][]): MsCell[][] => grid.map((row) => row.map((c) => ({ ...c })))

function placeMines(grid: MsCell[][], exclude: { x: number; y: number }, rng: Rng): MsCell[][] {
  const next = cloneGrid(grid)
  const candidates: Array<[number, number]> = []
  for (let y = 0; y < MS_SIZE; y++) {
    for (let x = 0; x < MS_SIZE; x++) {
      if (!(x === exclude.x && y === exclude.y)) candidates.push([x, y])
    }
  }
  for (let i = 0; i < MS_MINES; i++) {
    const [picked] = candidates.splice(Math.floor(rng() * candidates.length), 1)
    next[picked[1]][picked[0]].mine = true
  }
  for (let y = 0; y < MS_SIZE; y++) {
    for (let x = 0; x < MS_SIZE; x++) {
      next[y][x].adjacent = neighbors(x, y).filter(([nx, ny]) => next[ny][nx].mine).length
    }
  }
  return next
}

export function reveal(state: MsState, x: number, y: number, rng: Rng): MsState {
  if (state.over) return state
  const target = state.grid[y][x]
  if (target.revealed || target.flagged) return state
  const grid = state.minesPlaced ? cloneGrid(state.grid) : placeMines(state.grid, { x, y }, rng)
  if (grid[y][x].mine) {
    for (const row of grid) {
      for (const c of row) {
        if (c.mine) c.revealed = true
      }
    }
    return { grid, minesPlaced: true, over: true, won: false }
  }
  const stack: Array<[number, number]> = [[x, y]]
  while (stack.length > 0) {
    const item = stack.pop()
    if (!item) break
    const [cx, cy] = item
    const c = grid[cy][cx]
    if (c.revealed || c.flagged || c.mine) continue
    c.revealed = true
    if (c.adjacent === 0) {
      for (const n of neighbors(cx, cy)) stack.push(n)
    }
  }
  const won = grid.every((row) => row.every((c) => c.mine || c.revealed))
  return { grid, minesPlaced: true, over: won, won }
}

export function toggleFlag(state: MsState, x: number, y: number): MsState {
  if (state.over) return state
  if (state.grid[y][x].revealed) return state
  const grid = cloneGrid(state.grid)
  grid[y][x].flagged = !grid[y][x].flagged
  return { ...state, grid }
}

export function flagCount(state: MsState): number {
  return state.grid.flat().filter((c) => c.flagged).length
}
