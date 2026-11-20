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
  /** 패배 때 밟은 지뢰 칸 [x, y] — 화면이 그 칸만 빨갛게 칠한다. 진행 중·승리는 없음. */
  exploded?: [number, number]
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
    return { grid, minesPlaced: true, over: true, won: false, exploded: [x, y] }
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

/**
 * 코드(chord): 공개된 숫자 칸 주변 깃발 수가 그 숫자와 같으면, 깃발 없는 닫힌 이웃을 한 번에 연다.
 * 이웃을 하나씩 reveal한 것과 결과가 같다(규칙은 그대로, 탭 수만 줄인다). 깃발이 틀렸으면 지뢰를 밟는다.
 * 조건이 안 맞으면(숫자 아님·깃발 수 불일치·열 칸 없음·종료) 같은 state를 돌려준다.
 */
export function chord(state: MsState, x: number, y: number): MsState {
  if (state.over) return state
  const c = state.grid[y][x]
  if (!c.revealed || c.adjacent === 0) return state
  const ns = neighbors(x, y)
  const flags = ns.filter(([nx, ny]) => state.grid[ny][nx].flagged).length
  if (flags !== c.adjacent) return state
  let next = state
  for (const [nx, ny] of ns) {
    // 지뢰는 첫 reveal 뒤라 이미 배치돼 있어 rng는 쓰이지 않는다.
    next = reveal(next, nx, ny, Math.random)
    if (next.over) break
  }
  return next
}

/** 아직 열지 않은 안전 칸 수(패배 화면의 '남은 칸', 진행률). */
export function safeLeft(state: MsState): number {
  return state.grid.flat().filter((c) => !c.mine && !c.revealed).length
}
