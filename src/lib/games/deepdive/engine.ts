/**
 * Deepdive — pure engine.
 *
 * A vertical shaft dive. The diver descends an open grid picking up treasure,
 * but every cell entered spends breath from a single global tank (`air`) that
 * NEVER refills — the rocket-equation of a round trip. Cell cost is symmetric
 * (same going down and coming up), so going one cell deeper immediately adds
 * that cell's cost back onto the return budget. Treasure only banks when the
 * diver physically touches the surface (row 0, cost 0). Run out of air below
 * the surface with every neighbor unaffordable and you drown — the whole
 * unbanked `haul` is lost, but `banked` survives.
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, consumed
 * solely inside `generateShaft`. The reducer / movement / scoring / drown /
 * clear consume no rng, so a seed + action list reproduces the final state
 * exactly (golden-testable).
 */

export type Rng = () => number // [0,1)

export interface Cell {
  cost: number // 진입 숨 비용. 행0(수면)=0, 행>=1 은 >=1
  treasure: number // 남은 보물값. 없거나 수집 완료면 0
}

export interface DeepdiveConfig {
  cols: number // 격자 폭 (기본 5)
  rows: number // 수면 포함 총 행수 (기본 8 → 수면+깊이7)
  capacity: number // 시작 숨 (기본 46)
}

export interface Pos {
  row: number
  col: number
}

export type Dir = 'up' | 'down' | 'left' | 'right'

export type DeepdiveEvent =
  | 'none'
  | 'move'
  | 'collect'
  | 'jackpot'
  | 'bank'
  | 'illegal'
  | 'drown'
  | 'clear'
  | 'retire'

export interface DeepdiveState {
  config: DeepdiveConfig
  seed: number
  grid: Cell[][] // grid[row][col]; 행0=수면
  startCol: number // 다이버 시작 열(수면)
  pos: Pos
  air: number // 남은 숨(전역, 감소만)
  haul: number // 미예치 보물(현재 소지)
  banked: number // 잠긴 점수 == score
  deepest: number // 도달 최대 행(통계)
  collectedCount: number // 비운 보물 셀 수
  treasureCount: number // 생성 시 보물 셀 총수(승리 판정)
  totalTreasure: number // 생성 시 보물값 총합(통계/공유)
  over: boolean // 런 종료
  won: boolean // 갱도 완전 클리어
  drowned: boolean // 익사로 종료
  drownedHaul: number // 익사로 잃은 haul(오버레이 표시)
  lastEvent: DeepdiveEvent
  lastGain: number // 직전 이동의 수집액(+N 플로트용; 없으면 0)
}

export type DeepdiveAction =
  | { type: 'move'; dir: Dir }
  | { type: 'retire' } // 수면에서만 유효 — 런 종료(banked 잠금)
  | { type: 'reset' }
  | { type: 'new'; seed: number }

export const DEFAULT_CONFIG: DeepdiveConfig = { cols: 5, rows: 8, capacity: 46 } // = DAILY_CONFIG
export const JACKPOT_MIN = 60 // 이 이상 수집 시 'jackpot' 이벤트
export const CLEAR_BASE = 500 // 클리어 보너스 기본
export const MAX_GEN_ATTEMPTS = 30 // 퇴화 시드 재시도
export const DIFFICULTIES = {
  easy: { cols: 4, rows: 6, capacity: 40 },
  normal: { cols: 5, rows: 8, capacity: 46 },
  hard: { cols: 6, rows: 10, capacity: 54 },
} satisfies Record<'easy' | 'normal' | 'hard', DeepdiveConfig>
export const DAILY_CONFIG: DeepdiveConfig = DIFFICULTIES.normal

/** Identical impl to the template's mulberry32. */
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

// -- Pure primitives --------------------------------------------------------

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

/** 진입 비용의 깊이 기반 하한. 단조 비감소. d1,2→1 / d3,4→2 / d5,6→3 / d7→4. */
export function costBase(d: number): number {
  return Math.ceil(d / 2)
}

/** 보물이 '비어있을' 확률. 깊을수록 보물 존재 확률↑ (empty↓). */
export function emptyProb(d: number): number {
  return clamp(0.5 - 0.05 * d, 0.12, 0.5)
}

export function inBounds(cfg: DeepdiveConfig, r: number, c: number): boolean {
  return r >= 0 && r < cfg.rows && c >= 0 && c < cfg.cols
}

export function neighbor(pos: Pos, dir: Dir): Pos {
  switch (dir) {
    case 'up':
      return { row: pos.row - 1, col: pos.col }
    case 'down':
      return { row: pos.row + 1, col: pos.col }
    case 'left':
      return { row: pos.row, col: pos.col - 1 }
    case 'right':
      return { row: pos.row, col: pos.col + 1 }
  }
}

// -- Board generation -------------------------------------------------------

/**
 * Build the shaft. §3 rng order (exactly): startCol once, then depth-outer /
 * col-inner double loop consuming 2 rolls per cell (cost, then treasure).
 * Surface row (row 0) consumes NO rng — constant {cost:0, treasure:0}.
 */
export function generateShaft(
  cfg: DeepdiveConfig,
  rng: Rng,
): { grid: Cell[][]; startCol: number; totalTreasure: number; treasureCount: number } {
  const startCol = Math.floor(rng() * cfg.cols)

  const grid: Cell[][] = []
  const surface: Cell[] = []
  for (let c = 0; c < cfg.cols; c++) surface.push({ cost: 0, treasure: 0 })
  grid.push(surface)

  let totalTreasure = 0
  let treasureCount = 0

  for (let d = 1; d < cfg.rows; d++) {
    const row: Cell[] = []
    const ep = emptyProb(d)
    for (let c = 0; c < cfg.cols; c++) {
      const costRoll = rng()
      const cost = costBase(d) + (costRoll < 0.5 ? 0 : 1)

      const tRoll = rng()
      let treasure = 0
      if (tRoll >= ep) {
        const r = (tRoll - ep) / (1 - ep) // 0..1
        treasure = d * 4 + Math.round(r * d * 8)
        if (r > 0.8) treasure += d * 10 // 대박 셀
      }
      if (treasure > 0) {
        totalTreasure += treasure
        treasureCount++
      }
      row.push({ cost, treasure })
    }
    grid.push(row)
  }

  return { grid, startCol, totalTreasure, treasureCount }
}

/**
 * 각 보물 셀의 직행 수직 왕복 비용(그 열을 곧장 내려갔다 올라오는 최소 왕복 cost)이
 * capacity 이하인 셀들의 보물 합. 목표 셀은 한 번만 진입(내려갈 때), 그 위 셀들은
 * 왕복 두 번 → roundTrip = 2*Σ(1..row) - cost[row][col]. 순수, Rng 무소비.
 */
export function reachableTreasure(grid: Cell[][], cfg: DeepdiveConfig): number {
  let sum = 0
  for (let r = 1; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const cell = grid[r][c]
      if (cell.treasure <= 0) continue
      let down = 0
      for (let rr = 1; rr <= r; rr++) down += grid[rr][c].cost
      const roundTrip = 2 * down - cell.cost
      if (roundTrip <= cfg.capacity) sum += cell.treasure
    }
  }
  return sum
}

/**
 * Assemble the initial state from a generateShaft result. Pure, Rng-free —
 * exported so tests can build hand-crafted grids and drive the reducer
 * deterministically.
 */
export function initialState(
  cfg: DeepdiveConfig,
  seed: number,
  gen: { grid: Cell[][]; startCol: number; totalTreasure: number; treasureCount: number },
): DeepdiveState {
  return {
    config: cfg,
    seed,
    grid: gen.grid,
    startCol: gen.startCol,
    pos: { row: 0, col: gen.startCol },
    air: cfg.capacity,
    haul: 0,
    banked: 0,
    deepest: 0,
    collectedCount: 0,
    treasureCount: gen.treasureCount,
    totalTreasure: gen.totalTreasure,
    over: false,
    won: false,
    drowned: false,
    drownedHaul: 0,
    lastEvent: 'none',
    lastGain: 0,
  }
}

export function createGame(cfg: DeepdiveConfig, seed: number): DeepdiveState {
  let useSeed = seed
  let gen = generateShaft(cfg, mulberry32(useSeed))
  let attempts = 0
  while (
    (gen.totalTreasure === 0 || reachableTreasure(gen.grid, cfg) === 0) &&
    attempts < MAX_GEN_ATTEMPTS
  ) {
    useSeed = (useSeed + 1) >>> 0
    gen = generateShaft(cfg, mulberry32(useSeed))
    attempts++
  }
  return initialState(cfg, seed, gen)
}

// -- Movement predicates ----------------------------------------------------

/** 경계 내 && air >= cost 인 이웃 좌표들. 수면 아래에서 비면 익사 조건. */
export function affordableNeighbors(state: DeepdiveState): Pos[] {
  const out: Pos[] = []
  const dirs: Dir[] = ['up', 'down', 'left', 'right']
  for (const dir of dirs) {
    const n = neighbor(state.pos, dir)
    if (!inBounds(state.config, n.row, n.col)) continue
    if (state.air >= state.grid[n.row][n.col].cost) out.push(n)
  }
  return out
}

export function canMove(state: DeepdiveState, dir: Dir): boolean {
  if (state.over) return false
  const n = neighbor(state.pos, dir)
  if (!inBounds(state.config, n.row, n.col)) return false
  return state.air >= state.grid[n.row][n.col].cost
}

/**
 * 수면에 있고 소지가 없는데 어떤 열로도 잠수(하강)를 감당할 수 없음 → 더 못 잠수.
 * 수면 이동은 공짜라 어느 열로든 걸어가 하강할 수 있으므로 모든 열의 행1 셀을 검사한다.
 * 리듀서는 이걸로 자동 종료하지 않는다(컴포넌트가 종료 유도에 사용).
 */
export function isStranded(state: DeepdiveState): boolean {
  if (state.over || state.pos.row !== 0 || state.haul !== 0) return false
  if (state.config.rows < 2) return true
  for (let c = 0; c < state.config.cols; c++) {
    if (state.grid[1][c].cost <= state.air) return false
  }
  return true
}

// -- Reducer ----------------------------------------------------------------

/** grid를 수정 셀만 얕은 복제하여 그 셀을 replacement로 교체. */
function withCell(grid: Cell[][], row: number, col: number, replacement: Cell): Cell[][] {
  const next = grid.slice()
  const nextRow = grid[row].slice()
  nextRow[col] = replacement
  next[row] = nextRow
  return next
}

export function reduce(state: DeepdiveState, action: DeepdiveAction): DeepdiveState {
  switch (action.type) {
    case 'reset':
      return createGame(state.config, state.seed)
    case 'new':
      return createGame(state.config, action.seed)
    case 'retire': {
      if (state.over) return state
      if (state.pos.row !== 0) return { ...state, lastEvent: 'illegal' }
      return {
        ...state,
        over: true,
        won: state.collectedCount === state.treasureCount && state.haul === 0,
        lastEvent: 'retire',
      }
    }
    case 'move': {
      if (state.over) return { ...state, lastEvent: 'none' }

      const t = neighbor(state.pos, action.dir)
      if (!inBounds(state.config, t.row, t.col)) {
        return { ...state, lastEvent: 'illegal', lastGain: 0 }
      }

      const tc = state.grid[t.row][t.col].cost
      if (state.air < tc) {
        return { ...state, lastEvent: 'illegal', lastGain: 0 }
      }

      // 4. 이동 실행
      let grid = state.grid
      const air = state.air - tc
      let haul = state.haul
      let banked = state.banked
      let collectedCount = state.collectedCount
      let drownedHaul = state.drownedHaul
      const deepest = Math.max(state.deepest, t.row)
      let lastGain = 0
      let event: DeepdiveEvent = 'move'

      // 5. 수집
      if (t.row >= 1 && state.grid[t.row][t.col].treasure > 0) {
        const g = state.grid[t.row][t.col].treasure
        grid = withCell(grid, t.row, t.col, { cost: tc, treasure: 0 })
        haul += g
        lastGain = g
        collectedCount += 1
        event = g >= JACKPOT_MIN ? 'jackpot' : 'collect'
      }

      // 6. 예치 (수면)
      if (t.row === 0) {
        banked += haul
        drownedHaul = 0
        haul = 0
        event = 'bank'
      }

      let over = false
      let won = false
      let drowned = false

      // 7. 승리 판정 (익사보다 먼저)
      if (collectedCount === state.treasureCount && haul === 0) {
        won = true
        over = true
        banked += CLEAR_BASE + air
        event = 'clear'
      } else if (t.row >= 1) {
        // 8. 익사 판정
        const probe: DeepdiveState = { ...state, grid, air, pos: t }
        if (affordableNeighbors(probe).length === 0) {
          over = true
          drowned = true
          drownedHaul = haul
          haul = 0
          event = 'drown'
        }
      }

      return {
        ...state,
        grid,
        pos: t,
        air,
        haul,
        banked,
        collectedCount,
        deepest,
        over,
        won,
        drowned,
        drownedHaul,
        lastEvent: event,
        lastGain,
      }
    }
    default:
      return state
  }
}

/** 리더보드/best 소스. */
export function score(state: DeepdiveState): number {
  return state.banked
}
