// Gem Match(매치-3 스왑 퍼즐) 순수/결정적 엔진.
// 8x8 격자에 6색 젬을 채우고, 인접한 두 젬을 스왑해 가로/세로 3+ 매치를 만든다.
// 매치가 생기면 제거 → 중력으로 아래로 떨어뜨리기 → 위에서 리필 → 새 매치가 나오면
// 캐스케이드로 반복하며 배수(멀티플라이어)로 점수를 누적한다.
//
// 렌더러와 무관한 순수 함수들만 노출한다. 난수는 항상 주입(rng)하며 전역 난수(Math 의
// random)를 쓰지 않는다(테스트 가능/결정적). g2048/engine.ts 스타일을 따른다.

export type Rng = () => number

/** 격자[row][col] = 색 인덱스 0..COLORS-1, 또는 EMPTY(빈 칸, 캐스케이드 중간 상태). */
export type Grid = number[][]

export interface Cell {
  row: number
  col: number
}

export const SIZE = 8
export const COLORS = 6
export const EMPTY = -1
export const MIN_MATCH = 3
export const MOVES_START = 30
/** 젬 하나당 기본 점수(캐스케이드 배수가 곱해진다). */
export const GEM_SCORE = 10

export interface GameState {
  grid: Grid
  score: number
  movesLeft: number
  over: boolean
}

/** 한 번의 캐스케이드 단계(주스/사운드/애니메이션용 스냅샷). */
export interface CascadeStep {
  /** 이번 단계에서 제거되는 셀들. */
  matches: Cell[]
  /** 제거 직후(빈 칸 포함) 격자. */
  clearedGrid: Grid
  /** 중력 적용 후(빈 칸이 위로 모임) 격자. */
  droppedGrid: Grid
  /** 리필 후(빈 칸 없음) 격자. */
  filledGrid: Grid
  /** 리필로 새로 생긴 셀들(filledGrid 기준). */
  spawned: Cell[]
  /** 이번 단계에서 얻은 점수(배수 반영). */
  gained: number
  /** 캐스케이드 배수(1, 2, 3, ...). */
  multiplier: number
}

// ---------- 기본 헬퍼 ----------

function randInt(rng: Rng, n: number): number {
  const i = Math.floor(rng() * n)
  return i < 0 ? 0 : i >= n ? n - 1 : i
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice())
}

function makeEmptyLike(grid: Grid): Grid {
  return grid.map((row) => row.map(() => EMPTY))
}

export function areAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.row - b.row)
  const dc = Math.abs(a.col - b.col)
  return dr + dc === 1
}

/** a와 b의 색을 맞바꾼 새 격자를 반환(불변). */
export function swapCells(grid: Grid, a: Cell, b: Cell): Grid {
  const g = cloneGrid(grid)
  const tmp = g[a.row][a.col]
  g[a.row][a.col] = g[b.row][b.col]
  g[b.row][b.col] = tmp
  return g
}

// ---------- 매치 탐지 ----------

/** 가로/세로 3+ 연속 런에 속한 모든 셀(중복 제거)을 반환한다. */
export function findMatches(grid: Grid): Cell[] {
  const H = grid.length
  const W = grid[0]?.length ?? 0
  const matched = new Set<number>()

  // 가로 런
  for (let r = 0; r < H; r++) {
    let c = 0
    while (c < W) {
      const v = grid[r][c]
      let k = c + 1
      while (k < W && grid[r][k] === v) k++
      if (v !== EMPTY && k - c >= MIN_MATCH) {
        for (let j = c; j < k; j++) matched.add(r * W + j)
      }
      c = k
    }
  }

  // 세로 런
  for (let c = 0; c < W; c++) {
    let r = 0
    while (r < H) {
      const v = grid[r][c]
      let k = r + 1
      while (k < H && grid[k][c] === v) k++
      if (v !== EMPTY && k - r >= MIN_MATCH) {
        for (let j = r; j < k; j++) matched.add(j * W + c)
      }
      r = k
    }
  }

  const out: Cell[] = []
  for (const key of matched) out.push({ row: Math.floor(key / W), col: key % W })
  return out
}

// ---------- 제거 / 중력 / 리필 ----------

/** matches 셀들을 EMPTY로 비운 새 격자. */
export function clearMatches(grid: Grid, matches: Cell[]): Grid {
  const g = cloneGrid(grid)
  for (const m of matches) g[m.row][m.col] = EMPTY
  return g
}

/** 각 열에서 젬을 아래로 떨어뜨린다(빈 칸은 위로 모인다). */
export function applyGravity(grid: Grid): Grid {
  const H = grid.length
  const W = grid[0]?.length ?? 0
  const g = makeEmptyLike(grid)
  for (let c = 0; c < W; c++) {
    let write = H - 1
    for (let r = H - 1; r >= 0; r--) {
      if (grid[r][c] !== EMPTY) {
        g[write][c] = grid[r][c]
        write--
      }
    }
    // write 위쪽은 EMPTY로 남는다(makeEmptyLike 기본값).
  }
  return g
}

/** 위쪽의 빈 칸을 rng로 채운다. 새로 채운 셀 목록을 함께 반환한다. */
export function refill(grid: Grid, rng: Rng): { grid: Grid; spawned: Cell[] } {
  const H = grid.length
  const W = grid[0]?.length ?? 0
  const g = cloneGrid(grid)
  const spawned: Cell[] = []
  for (let c = 0; c < W; c++) {
    for (let r = 0; r < H; r++) {
      if (g[r][c] === EMPTY) {
        g[r][c] = randInt(rng, COLORS)
        spawned.push({ row: r, col: c })
      }
    }
  }
  return { grid: g, spawned }
}

// ---------- 캐스케이드 해소 ----------

/**
 * 매치 제거 → 중력 → 리필을 안정될 때까지 반복하며 단계별 스냅샷을 만든다.
 * 점수는 단계마다 (제거 젬 수 × GEM_SCORE × 배수)로 누적한다(배수 = 1,2,3,...).
 * 순수/결정적 — (grid, rng)만으로 결과가 정해진다.
 */
export function resolveSteps(input: Grid, rng: Rng): { steps: CascadeStep[]; grid: Grid; gained: number } {
  let grid = cloneGrid(input)
  const steps: CascadeStep[] = []
  let gained = 0
  let cascade = 0

  for (;;) {
    const matches = findMatches(grid)
    if (matches.length === 0) break
    cascade++
    const multiplier = cascade
    const stepGain = matches.length * GEM_SCORE * multiplier
    gained += stepGain

    const clearedGrid = clearMatches(grid, matches)
    const droppedGrid = applyGravity(clearedGrid)
    const { grid: filledGrid, spawned } = refill(droppedGrid, rng)

    steps.push({ matches, clearedGrid, droppedGrid, filledGrid, spawned, gained: stepGain, multiplier })
    grid = filledGrid
  }

  return { steps, grid, gained }
}

/**
 * 캐스케이드를 끝까지 해소한 새 상태를 반환한다(점수 누적).
 * movesLeft는 그대로 두고 over(움직임 소진) 여부만 갱신한다.
 */
export function resolveBoard(state: GameState, rng: Rng): GameState {
  const { grid, gained } = resolveSteps(state.grid, rng)
  return {
    grid,
    score: state.score + gained,
    movesLeft: state.movesLeft,
    over: state.movesLeft <= 0,
  }
}

// ---------- 스왑(플레이어 입력) ----------

/**
 * 인접한 두 젬을 스왑한다. 스왑 결과가 3+ 매치를 만들면 적용(격자 유지 + 이동 1 소모)하고
 * valid=true를 반환한다. 매치가 없으면 되돌리고 valid=false(상태 불변)를 반환한다.
 * 캐스케이드 해소는 호출자가 resolveBoard/resolveSteps로 이어서 처리한다(rng 필요).
 */
export function swap(state: GameState, a: Cell, b: Cell): { state: GameState; valid: boolean } {
  if (state.over || !areAdjacent(a, b)) return { state, valid: false }
  const grid = swapCells(state.grid, a, b)
  if (findMatches(grid).length === 0) return { state, valid: false }
  const movesLeft = state.movesLeft - 1
  return {
    state: { grid, score: state.score, movesLeft, over: movesLeft <= 0 },
    valid: true,
  }
}

// ---------- 이동 가능 여부 / 셔플 ----------

/** 인접 스왑 중 하나라도 매치를 만들 수 있으면 true. */
export function hasPossibleMove(grid: Grid): boolean {
  const H = grid.length
  const W = grid[0]?.length ?? 0
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (c + 1 < W) {
        const g = swapCells(grid, { row: r, col: c }, { row: r, col: c + 1 })
        if (findMatches(g).length > 0) return true
      }
      if (r + 1 < H) {
        const g = swapCells(grid, { row: r, col: c }, { row: r + 1, col: c })
        if (findMatches(g).length > 0) return true
      }
    }
  }
  return false
}

// ---------- 보드 생성 ----------

/** 초기 매치가 없는 격자를 생성한다(좌/상 두 칸을 보고 런을 회피). */
export function makeBoard(rng: Rng): Grid {
  const grid: Grid = Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(EMPTY))
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const banned = new Set<number>()
      if (c >= 2 && grid[r][c - 1] === grid[r][c - 2]) banned.add(grid[r][c - 1])
      if (r >= 2 && grid[r - 1][c] === grid[r - 2][c]) banned.add(grid[r - 1][c])
      const candidates: number[] = []
      for (let k = 0; k < COLORS; k++) if (!banned.has(k)) candidates.push(k)
      grid[r][c] = candidates[randInt(rng, candidates.length)]
    }
  }
  return grid
}

/** 기존 젬들을 섞어 매치는 없고 이동 가능한 배치를 만든다(막힌 판 구제용). */
export function shuffleBoard(grid: Grid, rng: Rng): Grid {
  const flat: number[] = []
  for (const row of grid) for (const v of row) if (v !== EMPTY) flat.push(v)
  const H = grid.length
  const W = grid[0]?.length ?? 0
  for (let attempt = 0; attempt < 60; attempt++) {
    // Fisher–Yates(주입 rng)
    const arr = flat.slice()
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1)
      const t = arr[i]
      arr[i] = arr[j]
      arr[j] = t
    }
    const g: Grid = []
    let idx = 0
    for (let r = 0; r < H; r++) {
      const row: number[] = []
      for (let c = 0; c < W; c++) row.push(arr[idx++])
      g.push(row)
    }
    if (findMatches(g).length === 0 && hasPossibleMove(g)) return g
  }
  // 실패 시 새 보드로 대체(항상 진행 가능하게).
  return makeBoard(rng)
}

// ---------- 게임 생성 ----------

/** 초기 매치 없음 + 최소 한 수 이상 가능한 새 게임(MOVES_START 이동). */
export function newGame(rng: Rng): GameState {
  let grid = makeBoard(rng)
  let guard = 0
  while (!hasPossibleMove(grid) && guard++ < 40) grid = makeBoard(rng)
  return { grid, score: 0, movesLeft: MOVES_START, over: false }
}
