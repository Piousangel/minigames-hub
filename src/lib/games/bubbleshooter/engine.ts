// Bubble Shooter(버블 슈터) 순수/결정적 엔진.
// 렌더러와 무관한 고정 논리 좌표계(FIELD_W × FIELD_H) 위에서 계산하고,
// 컴포넌트가 캔버스 크기에 맞춰 스케일한다.
//
// 그리드는 오프셋(육각) 배치: 짝수 행은 COLS칸, 홀수 행은 반 칸 밀린 COLS-1칸.
// step에는 난수를 쓰지 않으며, 새 버블 색 선택에만 RNG를 주입한다(순수/테스트 가능).
// 투사체 전진·스냅은 위치/각도만으로 결정적으로 계산한다.

export type Rng = () => number

export type Cell = { row: number; col: number }
export type ColoredCell = { row: number; col: number; color: number }

/** 논리 필드(정사각). 컴포넌트가 컨테이너 크기로 스케일한다. */
export const FIELD_W = 480
export const FIELD_H = 480

export const BUBBLE_R = 30
export const BUBBLE_D = BUBBLE_R * 2 // 60
export const COLS = 8 // 짝수 행 칸 수(홀수 행은 COLS-1)
export const ROW_H = BUBBLE_D * (Math.sqrt(3) / 2) // 육각 행 높이 ≈ 51.96
export const TOP_Y = BUBBLE_R // 0행 중심 y
export const MAX_ROWS = 9 // 0..8
export const DEATH_ROW = 8 // 이 행 이상에 버블이 붙으면 게임오버("바닥선")
export const NUM_COLORS = 5
export const FILL_ROWS = 4 // 시작 시 채우는 행 수
export const MIN_MATCH = 3 // 이 이상 같은 색이 뭉치면 터진다
export const POP_SCORE = 10 // 터진 버블당 점수
export const DROP_SCORE = 20 // 떨어진 버블당 점수

/** 발사대(하단 중앙). */
export const SHOOTER = { x: FIELD_W / 2, y: FIELD_H - BUBBLE_R } // (240, 450)

const MAX_ANGLE = (80 * Math.PI) / 180 // 수직 기준 좌우 최대 조준각
const ALL_COLORS = Array.from({ length: NUM_COLORS }, (_, i) => i)

/** step이 만든 이벤트(주스/사운드용). */
export interface ShotEvents {
  landed: ColoredCell | null
  popped: ColoredCell[]
  dropped: ColoredCell[]
}

export interface BubbleState {
  grid: (number | null)[][] // grid[row][col] = 색 인덱스 또는 null
  current: number // 지금 쏠 버블 색
  next: number // 다음 버블 색
  score: number
  over: boolean
  cleared: boolean
  events: ShotEvents
}

const NO_EVENTS: ShotEvents = { landed: null, popped: [], dropped: [] }

// ---------- 기하 헬퍼 ----------

/** 행별 칸 수(짝수 행 COLS, 홀수 행 COLS-1). */
export function colsInRow(row: number): number {
  return row % 2 === 0 ? COLS : COLS - 1
}

export function cellX(row: number, col: number): number {
  const offset = row % 2 === 0 ? 0 : BUBBLE_R
  return BUBBLE_R + col * BUBBLE_D + offset
}

export function cellY(row: number): number {
  return TOP_Y + row * ROW_H
}

export function cellCenter(row: number, col: number): { x: number; y: number } {
  return { x: cellX(row, col), y: cellY(row) }
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < MAX_ROWS && col >= 0 && col < colsInRow(row)
}

/** 오프셋 육각 그리드의 이웃 6칸(경계 밖 제외). */
export function neighbors(row: number, col: number): Cell[] {
  const even = row % 2 === 0
  const raw: [number, number][] = even
    ? [
        [row, col - 1],
        [row, col + 1],
        [row - 1, col - 1],
        [row - 1, col],
        [row + 1, col - 1],
        [row + 1, col],
      ]
    : [
        [row, col - 1],
        [row, col + 1],
        [row - 1, col],
        [row - 1, col + 1],
        [row + 1, col],
        [row + 1, col + 1],
      ]
  const out: Cell[] = []
  for (const [r, c] of raw) if (inBounds(r, c)) out.push({ row: r, col: c })
  return out
}

// ---------- 그리드 헬퍼 ----------

export function emptyGrid(): (number | null)[][] {
  const g: (number | null)[][] = []
  for (let r = 0; r < MAX_ROWS; r++) g.push(new Array<number | null>(colsInRow(r)).fill(null))
  return g
}

function cloneGrid(grid: (number | null)[][]): (number | null)[][] {
  return grid.map((row) => row.slice())
}

function isGridEmpty(grid: (number | null)[][]): boolean {
  for (const row of grid) for (const c of row) if (c !== null) return false
  return true
}

function gridHasDeath(grid: (number | null)[][]): boolean {
  for (let r = DEATH_ROW; r < MAX_ROWS; r++) {
    for (const c of grid[r]) if (c !== null) return true
  }
  return false
}

function colorsPresent(grid: (number | null)[][]): number[] {
  const set = new Set<number>()
  for (const row of grid) for (const c of row) if (c !== null) set.add(c)
  return [...set].sort((a, b) => a - b)
}

function pickColor(rng: Rng, pool: number[]): number {
  const arr = pool.length ? pool : ALL_COLORS
  const i = Math.floor(rng() * arr.length)
  return arr[Math.min(arr.length - 1, Math.max(0, i))]
}

/** 상태 파생값(over/cleared)을 채워 완성한다. 테스트/컴포넌트에서 사용. */
export function stateFromGrid(grid: (number | null)[][], current: number, next: number): BubbleState {
  const cleared = isGridEmpty(grid)
  return { grid, current, next, score: 0, over: !cleared && gridHasDeath(grid), cleared, events: NO_EVENTS }
}

export function isCleared(state: BubbleState): boolean {
  return isGridEmpty(state.grid)
}

export function isOver(state: BubbleState): boolean {
  return gridHasDeath(state.grid) && !isGridEmpty(state.grid)
}

// ---------- 클러스터 / 낙하 ----------

const key = (r: number, c: number) => r * 100 + c

/** 시작 칸과 같은 색으로 연결된 클러스터(자신 포함). */
export function sameColorCluster(grid: (number | null)[][], row: number, col: number): Cell[] {
  const color = grid[row][col]
  if (color === null) return []
  const seen = new Set<number>()
  const stack: Cell[] = [{ row, col }]
  const out: Cell[] = []
  while (stack.length) {
    const cur = stack.pop() as Cell
    const k = key(cur.row, cur.col)
    if (seen.has(k)) continue
    seen.add(k)
    if (grid[cur.row][cur.col] !== color) continue
    out.push(cur)
    for (const n of neighbors(cur.row, cur.col)) {
      if (!seen.has(key(n.row, n.col)) && grid[n.row][n.col] === color) stack.push(n)
    }
  }
  return out
}

/** 천장(0행)에 (색 무관) 연결되지 않은 떠 있는 버블들. */
function findFloating(grid: (number | null)[][]): Cell[] {
  const connected = new Set<number>()
  const stack: Cell[] = []
  for (let c = 0; c < colsInRow(0); c++) if (grid[0][c] !== null) stack.push({ row: 0, col: c })
  while (stack.length) {
    const cur = stack.pop() as Cell
    const k = key(cur.row, cur.col)
    if (connected.has(k)) continue
    connected.add(k)
    for (const n of neighbors(cur.row, cur.col)) {
      if (grid[n.row][n.col] !== null && !connected.has(key(n.row, n.col))) stack.push(n)
    }
  }
  const floating: Cell[] = []
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < colsInRow(r); c++) {
      if (grid[r][c] !== null && !connected.has(key(r, c))) floating.push({ row: r, col: c })
    }
  }
  return floating
}

// ---------- 투사체 시뮬레이션 ----------

function clampAngle(a: number): number {
  return a < -MAX_ANGLE ? -MAX_ANGLE : a > MAX_ANGLE ? MAX_ANGLE : a
}

function hitsBubble(grid: (number | null)[][], x: number, y: number): boolean {
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < colsInRow(r); c++) {
      if (grid[r][c] === null) continue
      const dx = x - cellX(r, c)
      const dy = y - cellY(r)
      if (dx * dx + dy * dy < BUBBLE_D * BUBBLE_D) return true
    }
  }
  return false
}

/**
 * 발사대에서 angle(수직 기준, 우측 +) 방향으로 투사체를 전진시킨다.
 * 좌우 벽 반사, 천장/버블 충돌에서 정지. 경로와 충돌점을 반환(순수/결정적).
 */
function simulate(grid: (number | null)[][], angle: number): { x: number; y: number; path: { x: number; y: number }[] } {
  const a = clampAngle(angle)
  let x = SHOOTER.x
  let y = SHOOTER.y
  let vx = Math.sin(a)
  const vy = -Math.cos(a)
  const STEP = 2
  const path: { x: number; y: number }[] = [{ x, y }]
  for (let iter = 0; iter < 6000; iter++) {
    x += vx * STEP
    y += vy * STEP
    if (x < BUBBLE_R) {
      x = BUBBLE_R
      vx = Math.abs(vx)
    } else if (x > FIELD_W - BUBBLE_R) {
      x = FIELD_W - BUBBLE_R
      vx = -Math.abs(vx)
    }
    path.push({ x, y })
    if (y <= TOP_Y) {
      y = TOP_Y
      return { x, y, path }
    }
    if (hitsBubble(grid, x, y)) return { x, y, path }
  }
  return { x, y, path }
}

/** 충돌점에 가장 가까운 "부착 가능한" 빈 칸(0행이거나 점유 이웃이 있는 칸). */
function nearestEmptyCell(grid: (number | null)[][], x: number, y: number): Cell | null {
  let best: Cell | null = null
  let bestD = Infinity
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < colsInRow(r); c++) {
      if (grid[r][c] !== null) continue
      const attachable = r === 0 || neighbors(r, c).some((n) => grid[n.row][n.col] !== null)
      if (!attachable) continue
      const dx = cellX(r, c) - x
      const dy = cellY(r) - y
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = { row: r, col: c }
      }
    }
  }
  return best
}

/**
 * 조준 미리보기용: 투사체 경로와 최종 스냅 칸을 반환한다(그리드 불변).
 */
export function traceShot(state: BubbleState, angle: number): { path: { x: number; y: number }[]; cell: Cell | null } {
  const { x, y, path } = simulate(state.grid, angle)
  return { path, cell: nearestEmptyCell(state.grid, x, y) }
}

// ---------- 공개 게임 함수 ----------

export function newGame(rng: Rng): BubbleState {
  const grid = emptyGrid()
  for (let r = 0; r < FILL_ROWS; r++) {
    for (let c = 0; c < colsInRow(r); c++) {
      grid[r][c] = Math.floor(rng() * NUM_COLORS) % NUM_COLORS
    }
  }
  const current = pickColor(rng, colorsPresent(grid))
  const next = pickColor(rng, colorsPresent(grid))
  return stateFromGrid(grid, current, next)
}

/**
 * 한 발 발사: 투사체 전진 → 충돌 시 그리드 스냅 → 같은 색 3+ 클러스터 팝 →
 * 천장에서 끊긴 버블 낙하 → 점수 → 색 교체(next→current, rng로 새 next).
 * 순수 함수 — (state, angle, rng)만으로 결정적.
 */
export function shoot(state: BubbleState, angle: number, rng: Rng): BubbleState {
  if (state.over || state.cleared) return state
  const grid = cloneGrid(state.grid)
  const { x, y } = simulate(grid, angle)
  const cell = nearestEmptyCell(grid, x, y)
  const color = state.current

  // 붙일 곳이 없다 = 그리드가 바닥까지 꽉 참 → 게임오버.
  if (!cell) {
    return { ...state, over: true, events: { landed: null, popped: [], dropped: [] } }
  }

  grid[cell.row][cell.col] = color
  const landed: ColoredCell = { row: cell.row, col: cell.col, color }

  let popped: ColoredCell[] = []
  let dropped: ColoredCell[] = []
  const cluster = sameColorCluster(grid, cell.row, cell.col)
  if (cluster.length >= MIN_MATCH) {
    popped = cluster.map((c) => ({ row: c.row, col: c.col, color }))
    for (const c of cluster) grid[c.row][c.col] = null
    const floating = findFloating(grid)
    dropped = floating.map((c) => ({ row: c.row, col: c.col, color: grid[c.row][c.col] as number }))
    for (const c of floating) grid[c.row][c.col] = null
  }

  const score = state.score + popped.length * POP_SCORE + dropped.length * DROP_SCORE
  const current = state.next
  const next = pickColor(rng, colorsPresent(grid))
  const cleared = isGridEmpty(grid)
  const over = !cleared && gridHasDeath(grid)

  return { grid, current, next, score, over, cleared, events: { landed, popped, dropped } }
}
