// Skew — 스와이프 없는 매치 퍼즐 순수/결정적 엔진.
// 보드를 직접 스와이프하지 않고, "기울이기(shear)" 한 번으로 각 행을 서로 다른 양만큼
// 순환 이동시켜 대각선으로 색을 흩뜨린다. 같은 색이 가로/세로로 3+ 줄지어 서면 저절로
// 사라지고, 중력 → 리필 → 재매치로 캐스케이드가 이어진다.
//
// gemmatch/engine.ts의 매치/중력/리필/캐스케이드 로직을 그대로 계승한다(이름도 유지).
// 다른 점은 오직 입력 하나 — 스왑 대신 shear. shear는 (보드가 완전 단색이 아닌 한)
// 항상 보드 구조를 바꾸므로 "이 수는 무효"라는 개념이 없고, hasPossibleMove/셔플 구제
// 로직도 필요 없다. 종료 조건은 순수히 이동 예산 소진(movesLeft<=0)이다.
//
// 난수는 항상 주입(rng)하며 전역 Math.random/Date를 쓰지 않는다(결정적, 골든 테스트 가능).

export type Rng = () => number // [0,1)

/** grid[row][col]; row 0 = 위, row HEIGHT-1 = 아래. 값: 0..COLORS-1 또는 EMPTY(캐스케이드 중간 상태). */
export type Grid = number[][]

export interface Cell {
  row: number
  col: number
}

export const WIDTH = 6 // 열 개수 — shear의 회전 modulus
export const HEIGHT = 8 // 행 개수 (H > W → 모든 시프트값 0..W-1이 최소 한 번씩 등장)
export const COLORS = 5
export const EMPTY = -1
export const MIN_MATCH = 3
export const MOVES_START = 30
export const TILE_SCORE = 10
export const MAX_WAVES = 20 // 한 번의 tilt 안에서 캐스케이드 웨이브 상한(무한루프 안전장치)

export interface CascadeWave {
  matches: Cell[]
  clearedGrid: Grid
  droppedGrid: Grid
  filledGrid: Grid
  spawned: Cell[]
  gained: number
  waveIndex: number // 1부터 시작
}

export interface GameState {
  grid: Grid
  score: number
  movesLeft: number
  comboStreak: number
  bestCombo: number
  over: boolean
}

// ---------- 기반 ----------

/** decant/gemmatch 계열 엔진과 동일한 구현. 같은 seed → 항상 같은 출력 시퀀스. */
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

function randInt(rng: Rng, n: number): number {
  const i = Math.floor(rng() * n)
  return i < 0 ? 0 : i >= n ? n - 1 : i
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice())
}

function makeEmptyLike(grid: Grid): Grid {
  return grid.map((row) => row.map(() => EMPTY))
}

/** 행을 오른쪽으로 k칸 순환 이동(k는 임의 정수, 내부에서 모듈러 정규화). */
export function rotateRowRight(row: number[], k: number): number[] {
  const w = row.length
  const s = ((k % w) + w) % w
  if (s === 0) return row.slice()
  return [...row.slice(w - s), ...row.slice(0, w - s)]
}

// ---------- shear (핵심 메커닉) ----------

/**
 * 각 행 i에 rotateRowRight(row_i, i*dir)를 적용한다. dir=1은 "오른쪽으로 기울이기",
 * dir=-1은 "왼쪽으로 기울이기". grid[0]은 시프트가 항상 0이라 절대 변하지 않는다.
 */
export function shearGrid(grid: Grid, dir: -1 | 1): Grid {
  return grid.map((row, i) => rotateRowRight(row, i * dir))
}

// ---------- 매치 탐지 (gemmatch와 동일 로직) ----------

export function findMatches(grid: Grid): Cell[] {
  const H = grid.length
  const W = grid[0]?.length ?? 0
  const matched = new Set<number>()

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

export function clearMatches(grid: Grid, matches: Cell[]): Grid {
  const g = cloneGrid(grid)
  for (const m of matches) g[m.row][m.col] = EMPTY
  return g
}

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
  }
  return g
}

/** EMPTY 셀을 rng로 채운다. 순회 순서: 열 우선(col 0..W-1), 각 열 위→아래(row 0..H-1). */
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
 * findMatches → clearMatches → applyGravity → refill을 반복한다.
 * 웨이브 w(1-index)의 gained = matches.length * TILE_SCORE * w.
 * MAX_WAVES에 도달하면 강제 종료(무한루프 안전장치).
 */
export function resolveSteps(input: Grid, rng: Rng): { steps: CascadeWave[]; grid: Grid; gained: number } {
  let grid = cloneGrid(input)
  const steps: CascadeWave[] = []
  let gained = 0
  let waveIndex = 0

  while (waveIndex < MAX_WAVES) {
    const matches = findMatches(grid)
    if (matches.length === 0) break
    waveIndex++
    const waveGained = matches.length * TILE_SCORE * waveIndex
    gained += waveGained

    const clearedGrid = clearMatches(grid, matches)
    const droppedGrid = applyGravity(clearedGrid)
    const { grid: filledGrid, spawned } = refill(droppedGrid, rng)

    steps.push({ matches, clearedGrid, droppedGrid, filledGrid, spawned, gained: waveGained, waveIndex })
    grid = filledGrid
  }

  return { steps, grid, gained }
}

// ---------- 보드 생성 ----------

/**
 * 행 우선(row 0..H-1, 각 행 col 0..W-1) 순회. 매치가 하나도 없는 정착 보드를 생성한다.
 */
export function generateBoard(rng: Rng): Grid {
  const grid: Grid = Array.from({ length: HEIGHT }, () => new Array<number>(WIDTH).fill(EMPTY))
  for (let r = 0; r < HEIGHT; r++) {
    for (let c = 0; c < WIDTH; c++) {
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

export function createGame(rng: Rng): GameState {
  return {
    grid: generateBoard(rng),
    score: 0,
    movesLeft: MOVES_START,
    comboStreak: 0,
    bestCombo: 0,
    over: false,
  }
}

// ---------- 플레이어 입력 — shear / resolveBoard / tilt ----------

/**
 * 보드를 기울인다. rng를 소비하지 않는다(순수·결정적). over면 완전 no-op.
 */
export function shear(state: GameState, dir: -1 | 1): GameState {
  if (state.over) return state
  const grid = shearGrid(state.grid, dir)
  const movesLeft = state.movesLeft - 1
  return { ...state, grid, movesLeft, over: movesLeft <= 0 }
}

/**
 * shear() 직후의 상태에 대해서만 호출한다(호출자 책임). 캐스케이드를 끝까지 해소하고
 * 콤보 배수를 반영한 점수를 누적한다.
 */
export function resolveBoard(state: GameState, rng: Rng): GameState {
  if (state.over) return state
  const { steps, grid, gained } = resolveSteps(state.grid, rng)
  const matched = steps.length > 0
  const comboStreak = matched ? state.comboStreak + 1 : 0
  const scoreGained = matched ? gained * comboStreak : 0
  return {
    ...state,
    grid,
    score: state.score + scoreGained,
    comboStreak,
    bestCombo: Math.max(state.bestCombo, comboStreak),
  }
}

export function tilt(state: GameState, dir: -1 | 1, rng: Rng): GameState {
  return resolveBoard(shear(state, dir), rng)
}
