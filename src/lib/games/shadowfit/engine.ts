/**
 * Shadowfit — pure engine.
 *
 * A wall with a hole approaches. The player holds a small polycube (voxels in
 * {-1,0,1}^3, always containing the origin) and rolls it 90° at a time around
 * X/Y/Z so that its shadow — the (x,y) projection, z dropped — matches the
 * hole exactly (position included, no translation). Then it passes through.
 *
 * Coordinates: x right, y up, +z toward the player; the wall lies in the xy
 * plane. Wall cell (x,y) is drawn at column x+1, row 1-y (row 0 on top).
 *
 * Everything here is pure and deterministic: no timers, no `Date`, and NO
 * `Math.random`. The only randomness is a local rng inside `generateWall`,
 * seeded from `wallSeed(seed, index)`, so wall i depends only on (seed, i) and
 * never on player input. The reducer consumes no rng at all.
 */

export type Rng = () => number
export type Vec3 = readonly [number, number, number]
export type Cell = readonly [number, number] // (x,y), each -1..1
export type Axis = 'x' | 'y' | 'z'
export type Dir = 1 | -1
export interface Move {
  axis: Axis
  dir: Dir
}
export type Phase = 'ready' | 'approach' | 'resolve' | 'over'
export type ShadowfitEvent =
  | 'none'
  | 'start'
  | 'rotate'
  | 'blocked'
  | 'tick'
  | 'warn'
  | 'pass'
  | 'perfect'
  | 'crash'
  | 'next'
  | 'over'
/** fit = hole ∧ shadow, open = hole ∧ ¬shadow, collide = ¬hole ∧ shadow, solid = neither. */
export type CellStatus = 'fit' | 'open' | 'collide' | 'solid'

export interface Wall {
  index: number
  size: number
  piece: Vec3[] // spawn orientation, canonical order
  hole: Cell[] // canonical order
  holeKey: string
  par: number // min rotations from spawn to shadow == hole (>= 1 for generated walls)
  approachTicks: number
}

export interface PassResult {
  wallIndex: number
  passed: boolean
  early: number
  perfect: boolean
  mult: number
  gain: number
}

export interface ShadowfitState {
  seed: number
  wallIndex: number
  wall: Wall
  voxels: Vec3[]
  rotations: number
  distance: number
  phase: Phase
  gapLeft: number
  lives: number
  score: number
  passed: number
  perfects: number
  streak: number
  bestStreak: number
  totalTicks: number
  lastEvent: ShadowfitEvent
  lastResult: PassResult | null
}

export type ShadowfitAction =
  | { type: 'start' }
  | { type: 'rotate'; axis: Axis; dir: Dir }
  | { type: 'drop' }
  | { type: 'tick' }
  | { type: 'new'; seed: number }

export const TICK_MS = 100
export const STARTING_LIVES = 3
export const GAP_TICKS = 6
export const WARN_TICKS = 10
export const PASS_BASE = 100
export const EARLY_PER_TICK = 5
export const PERFECT_BONUS = 50
export const STREAK_STEP = 3
export const MULT_CAP = 4
export const MIN_APPROACH = 18
export const MAX_GROW_TRIES = 20
export const MOVES: readonly Move[] = [
  { axis: 'x', dir: 1 },
  { axis: 'x', dir: -1 },
  { axis: 'y', dir: 1 },
  { axis: 'y', dir: -1 },
  { axis: 'z', dir: 1 },
  { axis: 'z', dir: -1 },
]

const FALLBACK_PIECE: Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
]

// ---------------------------------------------------------------------------
// RNG
// ---------------------------------------------------------------------------

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

/** Independent per-wall sub-seed (uint32). */
export function wallSeed(seed: number, index: number): number {
  return (Math.imul((seed ^ 0x5f3759df) >>> 0, 0x01000193) + Math.imul(index + 1, 0x9e3779b1)) >>> 0
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

// `+ 0` normalises -0 to 0 so keys and deepEqual stay clean.
const n0 = (v: number) => v + 0

export function rotateVec(v: Vec3, axis: Axis, dir: Dir): Vec3 {
  const [x, y, z] = v
  if (axis === 'x') return dir === 1 ? [n0(x), n0(-z), n0(y)] : [n0(x), n0(z), n0(-y)]
  if (axis === 'y') return dir === 1 ? [n0(z), n0(y), n0(-x)] : [n0(-z), n0(y), n0(x)]
  return dir === 1 ? [n0(-y), n0(x), n0(z)] : [n0(y), n0(-x), n0(z)]
}

function cmpVec(a: Vec3, b: Vec3): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

function cmpCell(a: Cell, b: Cell): number {
  return a[0] - b[0] || a[1] - b[1]
}

export function canonVoxels(vs: readonly Vec3[]): Vec3[] {
  return vs.map((v) => [v[0], v[1], v[2]] as Vec3).sort(cmpVec)
}

export function voxelKey(vs: readonly Vec3[]): string {
  return canonVoxels(vs)
    .map((v) => v.join(','))
    .join(';')
}

export function rotateVoxels(vs: readonly Vec3[], axis: Axis, dir: Dir): Vec3[] {
  return vs.map((v) => rotateVec(v, axis, dir)).sort(cmpVec)
}

function canonCells(cs: readonly Cell[]): Cell[] {
  const seen = new Set<string>()
  const out: Cell[] = []
  for (const c of cs) {
    const k = `${c[0]},${c[1]}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push([c[0], c[1]])
  }
  return out.sort(cmpCell)
}

function cellsKey(cs: readonly Cell[]): string {
  return canonCells(cs)
    .map((c) => c.join(','))
    .join(';')
}

export function shadowCells(vs: readonly Vec3[]): Cell[] {
  return canonCells(vs.map((v) => [v[0], v[1]] as Cell))
}

export function shadowKey(vs: readonly Vec3[]): string {
  return cellsKey(shadowCells(vs))
}

function parseCellKey(key: string): Cell[] {
  return key.split(';').map((p) => {
    const [x, y] = p.split(',').map(Number)
    return [x, y] as Cell
  })
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export function voxelsFor(index: number): number {
  if (index < 3) return 3
  if (index < 8) return 4
  if (index < 16) return 5
  return 6
}

export function approachTicksFor(index: number): number {
  return Math.max(MIN_APPROACH, 70 - 2 * index)
}

export function minParFor(index: number): number {
  if (index < 2) return 1
  if (index < 10) return 2
  return 3
}

export function multiplierFor(streak: number): number {
  return 1 + Math.min(Math.floor(streak / STREAK_STEP), MULT_CAP - 1)
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const NEIGHBORS: Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]

const inRange = (v: number) => v >= -1 && v <= 1

/** Grow a face-connected polycube of n voxels from the origin. Uses rng exactly n-1 times. */
export function growPolycube(n: number, rng: Rng): Vec3[] {
  const cubes: Vec3[] = [[0, 0, 0]]
  const have = new Set<string>(['0,0,0'])
  for (let i = 1; i < n; i++) {
    const front = new Map<string, Vec3>()
    for (const c of cubes) {
      for (const d of NEIGHBORS) {
        const p: Vec3 = [c[0] + d[0], c[1] + d[1], c[2] + d[2]]
        if (!inRange(p[0]) || !inRange(p[1]) || !inRange(p[2])) continue
        const k = p.join(',')
        if (have.has(k) || front.has(k)) continue
        front.set(k, p)
      }
    }
    const frontier = [...front.values()].sort(cmpVec)
    const pick = frontier[Math.floor(rng() * frontier.length)]
    cubes.push(pick)
    have.add(pick.join(','))
  }
  return canonVoxels(cubes)
}

function bfsOrientations(piece: readonly Vec3[]): { voxels: Vec3[]; dist: number; path: Move[] }[] {
  const start = canonVoxels(piece)
  const seen = new Set<string>([voxelKey(start)])
  const out: { voxels: Vec3[]; dist: number; path: Move[] }[] = [{ voxels: start, dist: 0, path: [] }]
  for (let i = 0; i < out.length; i++) {
    const cur = out[i]
    for (const m of MOVES) {
      const nv = rotateVoxels(cur.voxels, m.axis, m.dir)
      const k = voxelKey(nv)
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ voxels: nv, dist: cur.dist + 1, path: [...cur.path, m] })
    }
  }
  return out
}

/** shadowKey → minimum rotations from the spawn orientation (spawn shadow = 0). */
export function parTable(piece: readonly Vec3[]): Map<string, number> {
  const table = new Map<string, number>()
  for (const o of bfsOrientations(piece)) {
    const k = shadowKey(o.voxels)
    if (!table.has(k)) table.set(k, o.dist)
  }
  return table
}

/** Shortest rotation sequence (MOVES-order BFS, first found) to reach holeKey; null if unreachable. */
export function solveMoves(voxels: readonly Vec3[], holeKey: string): Move[] | null {
  for (const o of bfsOrientations(voxels)) {
    if (shadowKey(o.voxels) === holeKey) return o.path
  }
  return null
}

export function generateWall(seed: number, index: number): Wall {
  const rng = mulberry32(wallSeed(seed, index))
  const n = voxelsFor(index)
  let piece: Vec3[] | null = null
  let table: Map<string, number> | null = null
  for (let t = 0; t < MAX_GROW_TRIES; t++) {
    const p = growPolycube(n, rng)
    const tb = parTable(p)
    if (tb.size >= 2) {
      piece = p
      table = tb
      break
    }
  }
  if (!piece || !table) {
    piece = canonVoxels(FALLBACK_PIECE.slice(0, n))
    table = parTable(piece)
  }
  const minPar = minParFor(index)
  let cands = [...table.entries()].filter(([, p]) => p >= 1 && p >= minPar).map(([k]) => k)
  if (cands.length === 0) {
    let maxPar = 0
    for (const p of table.values()) maxPar = Math.max(maxPar, p)
    cands = [...table.entries()].filter(([, p]) => p === maxPar).map(([k]) => k)
  }
  cands.sort()
  const key = cands[Math.floor(rng() * cands.length)]
  return {
    index,
    size: piece.length,
    piece,
    hole: parseCellKey(key),
    holeKey: key,
    par: table.get(key) as number,
    approachTicks: approachTicksFor(index),
  }
}

/** Test helper: build a wall from an explicit piece + hole. Throws if the hole is unreachable. */
export function makeWall(index: number, piece: readonly Vec3[], hole: readonly Cell[]): Wall {
  const canon = canonVoxels(piece)
  const holeCells = canonCells(hole)
  const holeKey = cellsKey(holeCells)
  const par = parTable(canon).get(holeKey)
  if (par === undefined) throw new Error(`hole ${holeKey} unreachable for piece ${voxelKey(canon)}`)
  return {
    index,
    size: canon.length,
    piece: canon,
    hole: holeCells,
    holeKey,
    par,
    approachTicks: approachTicksFor(index),
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function fitsNow(state: ShadowfitState): boolean {
  return shadowKey(state.voxels) === state.wall.holeKey
}

/** 9 statuses, row-major; screen row r / col c ↔ (x = c-1, y = 1-r). */
export function cellStatuses(state: ShadowfitState): CellStatus[] {
  const hole = new Set(state.wall.hole.map((c) => `${c[0]},${c[1]}`))
  const shadow = new Set(shadowCells(state.voxels).map((c) => `${c[0]},${c[1]}`))
  const out: CellStatus[] = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const k = `${c - 1},${1 - r}`
      const h = hole.has(k)
      const s = shadow.has(k)
      out.push(h && s ? 'fit' : h ? 'open' : s ? 'collide' : 'solid')
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function createGame(seed: number): ShadowfitState {
  const s = seed >>> 0
  const wall = generateWall(s, 0)
  return {
    seed: s,
    wallIndex: 0,
    wall,
    voxels: wall.piece.map((v) => [v[0], v[1], v[2]] as Vec3),
    rotations: 0,
    distance: wall.approachTicks,
    phase: 'ready',
    gapLeft: 0,
    lives: STARTING_LIVES,
    score: 0,
    passed: 0,
    perfects: 0,
    streak: 0,
    bestStreak: 0,
    totalTicks: 0,
    lastEvent: 'none',
    lastResult: null,
  }
}

function resolveWall(state: ShadowfitState, early: number): ShadowfitState {
  if (fitsNow(state)) {
    const streak = state.streak + 1
    const mult = multiplierFor(streak)
    const perfect = state.rotations === state.wall.par
    const gain = (PASS_BASE + EARLY_PER_TICK * early + (perfect ? PERFECT_BONUS : 0)) * mult
    return {
      ...state,
      distance: 0,
      phase: 'resolve',
      gapLeft: GAP_TICKS,
      score: state.score + gain,
      passed: state.passed + 1,
      perfects: state.perfects + (perfect ? 1 : 0),
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      lastEvent: perfect ? 'perfect' : 'pass',
      lastResult: { wallIndex: state.wallIndex, passed: true, early, perfect, mult, gain },
    }
  }
  const lives = state.lives - 1
  const lastResult: PassResult = {
    wallIndex: state.wallIndex,
    passed: false,
    early,
    perfect: false,
    mult: 1,
    gain: 0,
  }
  if (lives <= 0) {
    return { ...state, distance: 0, lives: 0, streak: 0, phase: 'over', gapLeft: 0, lastEvent: 'over', lastResult }
  }
  return {
    ...state,
    distance: 0,
    lives,
    streak: 0,
    phase: 'resolve',
    gapLeft: GAP_TICKS,
    lastEvent: 'crash',
    lastResult,
  }
}

export function reduce(state: ShadowfitState, action: ShadowfitAction): ShadowfitState {
  if (action.type === 'new') return createGame(action.seed)
  const ev = (e: ShadowfitEvent): ShadowfitState => (state.lastEvent === e ? state : { ...state, lastEvent: e })

  switch (state.phase) {
    case 'over':
      return state
    case 'ready':
      if (action.type === 'start') return { ...state, phase: 'approach', lastEvent: 'start' }
      return ev(action.type === 'rotate' ? 'blocked' : 'none')
    case 'resolve':
      if (action.type === 'tick') {
        const gapLeft = state.gapLeft - 1
        if (gapLeft > 0) return { ...state, gapLeft, lastEvent: 'tick' }
        const wallIndex = state.wallIndex + 1
        const wall = generateWall(state.seed, wallIndex)
        return {
          ...state,
          wallIndex,
          wall,
          voxels: wall.piece.map((v) => [v[0], v[1], v[2]] as Vec3),
          rotations: 0,
          distance: wall.approachTicks,
          phase: 'approach',
          gapLeft: 0,
          lastEvent: 'next',
        }
      }
      return ev(action.type === 'start' ? 'none' : 'blocked')
    case 'approach':
      switch (action.type) {
        case 'start':
          return ev('none')
        case 'rotate':
          return {
            ...state,
            voxels: rotateVoxels(state.voxels, action.axis, action.dir),
            rotations: state.rotations + 1,
            lastEvent: 'rotate',
          }
        case 'drop':
          return resolveWall(state, state.distance)
        case 'tick': {
          const distance = state.distance - 1
          const ticked = { ...state, distance, totalTicks: state.totalTicks + 1 }
          if (distance <= 0) return resolveWall({ ...ticked, distance: 0 }, 0)
          return { ...ticked, lastEvent: distance === WARN_TICKS ? 'warn' : 'tick' }
        }
      }
  }
  return state
}
