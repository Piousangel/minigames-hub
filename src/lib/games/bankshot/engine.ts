/**
 * Bankshot — pure engine.
 *
 * A cushion-wall billiards puzzle: aim + power fire a ball from a fixed launch
 * point; it reflects off board edges and rectangular walls (axis-separated
 * collision) and slows every tick under rolling friction until it comes to
 * rest. Win = the resting position lands inside the target circle (not just
 * "passing through" it). Loss = missing on the last of `par + SHOT_SLACK` shots.
 *
 * One shot = one complete deterministic simulation, computed in full at
 * `fire()` time via `simulateShot`. The component only replays the returned
 * `path[]` — it never re-runs physics per animation frame. All coordinates
 * are integers scaled by `FP` (fixed point), and every operation that scales
 * a fixed-point value uses `Math.trunc` uniformly (never `Math.floor`, to
 * avoid a negative-direction rounding bias). `Math.floor` is used only for
 * picking an index/offset from an injected `Rng` — the same convention as
 * the decant engine.
 *
 * No `Math.random` / `Date` / `performance.now` anywhere in this file.
 * Randomness enters only through an injected `Rng`, consumed solely by
 * `generateLevel`. Aiming, firing, and the simulation itself are 100%
 * deterministic given (level, aimDeg, power) — that's what makes the physics
 * golden-testable.
 */

export type Rng = () => number // returns a float in [0,1)

export interface WallRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface BankshotConfig {
  minWalls: number
  maxWalls: number
  wallMinLen: number // FP units
  wallMaxLen: number // FP units
  par: number // reference shot count for score bonus
}

export interface BankshotLevel {
  walls: WallRect[]
  target: { x: number; y: number } // FP; circle radius = TARGET_R
  launch: { x: number; y: number } // FP; difficulty-fixed (not random)
}

export interface ShotResult {
  path: { x: number; y: number }[] // position after every tick; index 0 = launch point
  bouncePoints: { x: number; y: number }[] // exact positions where an axis reflection occurred
  bounces: number // total axis-reflection events (a corner hit counts as 2)
  ticks: number // ticks elapsed until rest
  restX: number
  restY: number
  closestApproach: number // min distance from the whole path to the target center (FP)
  won: boolean // did the resting position land inside the target radius?
}

export type ShotEvent = 'none' | 'win' | 'miss' | 'lose' | 'illegal' | 'undo'

export interface BankshotState {
  config: BankshotConfig
  seed: number
  level: BankshotLevel
  aimDeg: number // 0..360 (wrap); 0 = +x (right), clockwise increasing (screen y-down)
  power: number // 0..100 integer
  shots: number // shots fired on this board
  score: number // monotonic non-decreasing except on undo
  won: boolean
  lost: boolean // out of shots (shots reached shotLimit(par) without sinking it)
  lastShot: ShotResult | null
  lastEvent: ShotEvent
  undoStack: UndoEntry[]
  undosLeft: number
}

export interface UndoEntry {
  shots: number
  score: number
  won: boolean
  lost: boolean
  lastShot: ShotResult | null
}

export type BankshotAction =
  | { type: 'setAngle'; deg: number }
  | { type: 'setPower'; power: number }
  | { type: 'fire' }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

// -- Global physics / board constants (NOT part of config — physics itself
// must be identical across difficulties; only level generation varies). ----

export const FP = 1000
export const BOARD_W = 400 * FP
export const BOARD_H = 240 * FP
export const BALL_R = 6 * FP
export const TARGET_R = 14 * FP
export const WALL_THICKNESS = 10 * FP

export const FRICTION_PERMILLE = 980
export const RESTITUTION_PERMILLE = 970
export const STOP_SPEED = 300

export const SPEED_MIN = 6 * FP
export const SPEED_MAX = 26 * FP

export const MAX_STEP = 4 * FP
export const MAX_SUBSTEPS = 8
export const MAX_TICKS = 600

export const WALL_MARGIN = 8 * FP
export const LAUNCH_SAFE_RADIUS = 30 * FP
export const MIN_LAUNCH_TARGET_DIST = 120 * FP
export const TARGET_MARGIN = 20 * FP
export const MAX_PLACEMENT_ATTEMPTS = 40

export const WIN_BONUS = 1000
export const SHOT_BONUS_MAX = 1000
export const PRECISION_BONUS_MAX = 30
export const PRECISION_RADIUS = 60 * FP

export const UNDO_POOL = 3

/** Shots allowed beyond par before the board is lost (audit: no fail state = guaranteed win). */
export const SHOT_SLACK = 3

/** Hard shot cap for a board: missing on this shot loses it. */
export function shotLimit(par: number): number {
  return par + SHOT_SLACK
}

export const BANKSHOT_DIFFICULTIES = {
  easy: { minWalls: 2, maxWalls: 3, wallMinLen: 50 * FP, wallMaxLen: 120 * FP, par: 3 },
  normal: { minWalls: 3, maxWalls: 5, wallMinLen: 40 * FP, wallMaxLen: 140 * FP, par: 5 },
  hard: { minWalls: 5, maxWalls: 7, wallMinLen: 35 * FP, wallMaxLen: 150 * FP, par: 7 },
} satisfies Record<'easy' | 'normal' | 'hard', BankshotConfig>

export const DAILY_CONFIG: BankshotConfig = BANKSHOT_DIFFICULTIES.normal

// Difficulty-fixed launch point (never randomized).
export const LAUNCH_POINT: Record<'easy' | 'normal' | 'hard', { x: number; y: number }> = {
  easy: { x: 30 * FP, y: (240 - 30) * FP },
  normal: { x: 30 * FP, y: (240 - 30) * FP },
  hard: { x: 30 * FP, y: (240 - 30) * FP },
}

// -- Small helpers ------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Identical impl to the decant/template mulberry32. */
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

// -- Aim / power primitives ---------------------------------------------

export function angleToVelocity(deg: number, speed: number): { vx: number; vy: number } {
  const rad = (deg * Math.PI) / 180
  return { vx: Math.round(speed * Math.cos(rad)), vy: Math.round(speed * Math.sin(rad)) }
}

export function powerToSpeed(power: number): number {
  const p = clamp(Math.round(power), 0, 100)
  return Math.round(SPEED_MIN + (p / 100) * (SPEED_MAX - SPEED_MIN))
}

function normalizeDeg(deg: number): number {
  const m = deg % 360
  return m < 0 ? m + 360 : m
}

// -- Collision primitive --------------------------------------------------

/**
 * Move `pos` along `axis` under `vel` (the true current axis velocity), one
 * substep at a time (internally clamped to at most `MAX_STEP` so a wall can
 * never be tunneled through), checking collision against the board boundary
 * and every wall. `otherPos` is the ball's position on the perpendicular
 * axis, used to test overlap with a wall's cross-section. Reflection uses
 * the full `vel` passed in (not the clamped movement distance), so the
 * result is physically consistent regardless of how far a single substep
 * actually travels.
 */
export function stepAxis(
  pos: number,
  vel: number,
  otherPos: number,
  axis: 'x' | 'y',
  walls: WallRect[],
): { pos: number; vel: number; bounced: boolean } {
  if (vel === 0) return { pos, vel, bounced: false }

  const boardMax = axis === 'x' ? BOARD_W : BOARD_H
  const step = Math.sign(vel) * Math.min(Math.abs(vel), MAX_STEP)
  let newPos = pos + step
  let newVel = vel
  let bounced = false

  const lo = BALL_R
  const hi = boardMax - BALL_R
  if (newPos < lo) {
    newPos = lo
    newVel = -Math.trunc((vel * RESTITUTION_PERMILLE) / 1000)
    bounced = true
  } else if (newPos > hi) {
    newPos = hi
    newVel = -Math.trunc((vel * RESTITUTION_PERMILLE) / 1000)
    bounced = true
  }

  if (!bounced) {
    for (const w of walls) {
      const along0 = axis === 'x' ? w.x0 : w.y0
      const along1 = axis === 'x' ? w.x1 : w.y1
      const perp0 = axis === 'x' ? w.y0 : w.x0
      const perp1 = axis === 'x' ? w.y1 : w.x1

      const perpOverlap = otherPos + BALL_R > perp0 && otherPos - BALL_R < perp1
      if (!perpOverlap) continue
      const axisOverlap = newPos + BALL_R > along0 && newPos - BALL_R < along1
      if (!axisOverlap) continue

      newPos = vel > 0 ? along0 - BALL_R : along1 + BALL_R
      newVel = -Math.trunc((vel * RESTITUTION_PERMILLE) / 1000)
      bounced = true
      break
    }
  }

  return { pos: newPos, vel: newVel, bounced }
}

// -- Full-shot simulation --------------------------------------------------

export function closestApproach(path: { x: number; y: number }[], target: { x: number; y: number }): number {
  let min = Infinity
  for (const p of path) {
    const dx = p.x - target.x
    const dy = p.y - target.y
    const d = Math.floor(Math.sqrt(dx * dx + dy * dy))
    if (d < min) min = d
  }
  return min === Infinity ? 0 : min
}

/**
 * Simulate one full shot from (startX, startY) with initial velocity
 * (vx0, vy0) until the ball comes to rest (both axes' speed snapped to 0
 * under STOP_SPEED after friction), or MAX_TICKS is hit as a safety valve.
 * No `Rng` — fully deterministic in (level, startX, startY, vx0, vy0).
 */
export function simulateShot(
  level: BankshotLevel,
  startX: number,
  startY: number,
  vx0: number,
  vy0: number,
): ShotResult {
  const walls = level.walls
  let x = startX
  let y = startY
  let vx = vx0
  let vy = vy0

  const path: { x: number; y: number }[] = [{ x, y }]
  const bouncePoints: { x: number; y: number }[] = []
  let bounces = 0
  let ticks = 0

  while (ticks < MAX_TICKS && (vx !== 0 || vy !== 0)) {
    const speed = Math.max(Math.abs(vx), Math.abs(vy))
    const substeps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(speed / MAX_STEP)))

    for (let i = 0; i < substeps; i++) {
      // Both axes resolved against the substep's starting state so a wall
      // corner reflects both axes in the same substep (axis-separated but
      // simultaneous, not sequentially chained).
      const preX = x
      const preY = y

      if (vx !== 0) {
        const rx = stepAxis(preX, vx, preY, 'x', walls)
        x = rx.pos
        if (rx.bounced) {
          vx = rx.vel
          bounces++
          bouncePoints.push({ x, y: preY })
        }
      }
      if (vy !== 0) {
        const ry = stepAxis(preY, vy, preX, 'y', walls)
        y = ry.pos
        if (ry.bounced) {
          vy = ry.vel
          bounces++
          bouncePoints.push({ x: preX, y })
        }
      }
    }

    vx = Math.trunc((vx * FRICTION_PERMILLE) / 1000)
    vy = Math.trunc((vy * FRICTION_PERMILLE) / 1000)
    if (Math.abs(vx) < STOP_SPEED) vx = 0
    if (Math.abs(vy) < STOP_SPEED) vy = 0

    ticks++
    path.push({ x, y })
  }

  // Safety valve: force a full stop if MAX_TICKS was exhausted mid-motion.
  if (vx !== 0 || vy !== 0) {
    vx = 0
    vy = 0
  }

  const restX = x
  const restY = y
  const closest = closestApproach(path, level.target)
  const dtx = restX - level.target.x
  const dty = restY - level.target.y
  const won = dtx * dtx + dty * dty <= TARGET_R * TARGET_R

  return { path, bouncePoints, bounces, ticks, restX, restY, closestApproach: closest, won }
}

// -- Scoring -----------------------------------------------------------

export function scoreOnMiss(closest: number): number {
  if (closest > PRECISION_RADIUS) return 0
  const t = clamp((PRECISION_RADIUS - closest) / (PRECISION_RADIUS - TARGET_R), 0, 1)
  return Math.round(PRECISION_BONUS_MAX * t)
}

export function scoreOnWin(shotsTaken: number, par: number): number {
  return WIN_BONUS + Math.round(SHOT_BONUS_MAX * Math.min(1, par / Math.max(1, shotsTaken)))
}

// -- Board generation (the only place an Rng is consumed) -----------------

/** Do rectangles `a` and `b` come within `margin` of each other (incl. overlap)? */
function rectsClose(a: WallRect, b: WallRect, margin: number): boolean {
  return !(a.x1 + margin <= b.x0 || b.x1 + margin <= a.x0 || a.y1 + margin <= b.y0 || b.y1 + margin <= a.y0)
}

/** Does the circle (cx, cy, r) overlap rect `rect`? */
function circleRectOverlap(cx: number, cy: number, r: number, rect: WallRect): boolean {
  const nx = clamp(cx, rect.x0, rect.x1)
  const ny = clamp(cy, rect.y0, rect.y1)
  const dx = cx - nx
  const dy = cy - ny
  return dx * dx + dy * dy <= r * r
}

/**
 * Build a level: place `cfg.minWalls..cfg.maxWalls` non-overlapping walls
 * (each clear of the launch's safe radius), then place a target clear of
 * every wall and far enough from launch. Rng consumption order is fixed and
 * documented (see spec §3) so a scripted Rng produces a golden, reproducible
 * board. Never throws; every loop is bounded by MAX_PLACEMENT_ATTEMPTS, so a
 * hostile config just yields fewer walls (or a fallback centered target)
 * rather than looping forever.
 */
export function generateLevel(cfg: BankshotConfig, launch: { x: number; y: number }, rng: Rng): BankshotLevel {
  const wallCount = cfg.minWalls + Math.floor(rng() * (cfg.maxWalls - cfg.minWalls + 1))
  const walls: WallRect[] = []

  for (let i = 0; i < wallCount; i++) {
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const horizontal = rng() < 0.5
      const len = cfg.wallMinLen + Math.floor(rng() * (cfg.wallMaxLen - cfg.wallMinLen + 1))
      const x0 = Math.floor(rng() * (BOARD_W - (horizontal ? len : WALL_THICKNESS)))
      const y0 = Math.floor(rng() * (BOARD_H - (horizontal ? WALL_THICKNESS : len)))
      const rect: WallRect = horizontal
        ? { x0, y0, x1: x0 + len, y1: y0 + WALL_THICKNESS }
        : { x0, y0, x1: x0 + WALL_THICKNESS, y1: y0 + len }

      if (circleRectOverlap(launch.x, launch.y, LAUNCH_SAFE_RADIUS, rect)) continue

      let collides = false
      for (const w of walls) {
        if (rectsClose(w, rect, WALL_MARGIN)) {
          collides = true
          break
        }
      }
      if (collides) continue

      walls.push(rect)
      break
      // (if every attempt fails, this wall is simply skipped — allowed by spec)
    }
  }

  let target = { x: Math.trunc(BOARD_W / 2), y: Math.trunc(BOARD_H / 2) }
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const tx = TARGET_MARGIN + TARGET_R + Math.floor(rng() * (BOARD_W - 2 * (TARGET_MARGIN + TARGET_R)))
    const ty = TARGET_MARGIN + TARGET_R + Math.floor(rng() * (BOARD_H - 2 * (TARGET_MARGIN + TARGET_R)))

    let overlapsWall = false
    for (const w of walls) {
      if (circleRectOverlap(tx, ty, TARGET_R + WALL_MARGIN, w)) {
        overlapsWall = true
        break
      }
    }
    if (overlapsWall) continue

    const ddx = tx - launch.x
    const ddy = ty - launch.y
    if (ddx * ddx + ddy * ddy < MIN_LAUNCH_TARGET_DIST * MIN_LAUNCH_TARGET_DIST) continue

    target = { x: tx, y: ty }
    break
  }

  return { walls, target, launch }
}

export function createGame(cfg: BankshotConfig, seed: number, launch: { x: number; y: number }): BankshotState {
  const level = generateLevel(cfg, launch, mulberry32(seed))
  const aimDeg = normalizeDeg(
    (Math.atan2(level.target.y - launch.y, level.target.x - launch.x) * 180) / Math.PI,
  )
  return {
    config: cfg,
    seed,
    level,
    aimDeg,
    power: 50,
    shots: 0,
    score: 0,
    won: false,
    lost: false,
    lastShot: null,
    lastEvent: 'none',
    undoStack: [],
    undosLeft: UNDO_POOL,
  }
}

// -- Reducer ----------------------------------------------------------------

function snapshot(state: BankshotState): UndoEntry {
  return { shots: state.shots, score: state.score, won: state.won, lost: state.lost, lastShot: state.lastShot }
}

export function reduce(state: BankshotState, action: BankshotAction): BankshotState {
  switch (action.type) {
    case 'setAngle':
      return { ...state, aimDeg: normalizeDeg(action.deg), lastEvent: 'none' }

    case 'setPower':
      return { ...state, power: clamp(Math.round(action.power), 0, 100), lastEvent: 'none' }

    case 'fire': {
      if (state.won || state.lost) return { ...state, lastEvent: 'illegal' }

      const speed = powerToSpeed(state.power)
      const { vx, vy } = angleToVelocity(state.aimDeg, speed)
      const result = simulateShot(state.level, state.level.launch.x, state.level.launch.y, vx, vy)

      const pre = snapshot(state)
      const undoStack = [pre, ...state.undoStack].slice(0, UNDO_POOL)
      const shots = state.shots + 1

      let score: number
      let won: boolean
      let lost = false
      let event: ShotEvent
      if (result.won) {
        score = state.score + scoreOnWin(shots, state.config.par)
        won = true
        event = 'win'
      } else {
        score = state.score + scoreOnMiss(result.closestApproach)
        won = false
        lost = shots >= shotLimit(state.config.par)
        event = lost ? 'lose' : 'miss'
      }

      return {
        ...state,
        shots,
        score,
        won,
        lost,
        lastShot: result,
        lastEvent: event,
        undoStack,
      }
    }

    case 'undo': {
      // A lost board is final: undo can't buy back shots past the limit.
      if (state.lost || state.undosLeft <= 0 || state.undoStack.length === 0) {
        return { ...state, lastEvent: 'none' }
      }
      const [head, ...rest] = state.undoStack
      return {
        ...state,
        shots: head.shots,
        score: head.score,
        won: head.won,
        lost: head.lost,
        lastShot: head.lastShot,
        undoStack: rest,
        undosLeft: state.undosLeft - 1,
        lastEvent: 'undo',
      }
    }

    case 'reset':
      return createGame(state.config, state.seed, state.level.launch)

    case 'new':
      return createGame(state.config, action.seed, state.level.launch)

    default:
      return state
  }
}
