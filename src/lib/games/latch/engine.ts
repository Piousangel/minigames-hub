// Latch — pure, deterministic one-button momentum skill.
//
// The ONLY control is a hold/release button. Hold = latch the nearest reachable
// peg ahead and swing on a frictionless pendulum; release = fly off tangentially
// with the pendulum's momentum fully preserved, arcing under gravity to catch
// the next peg mid-flight.
//
// Coordinate model: y grows DOWNWARD. Vertical is absolute (world y == screen y).
// Horizontal scrolls via `cameraX` (world x of the field's left edge); it is
// monotonic non-decreasing and force-advances at a rising `scrollSpeed`, so
// standing still means getting swept off the left edge.
//
// Time is expressed in `dt` frames where dt=1 means one 60fps step, so callers
// can pass fractional dt for frame-rate independence.
//
// No Math.random / Date.now / performance.now in here: peg/glint jitter comes
// from an injected `rng` (() => number in [0,1)) consumed in a FIXED draw order,
// so `(seed, input log)` is fully reproducible and snapshot-testable.

export type Rng = () => number
export type Mode = 'idle' | 'swinging' | 'flying'

export interface Peg {
  id: number // strictly increasing, unique
  x: number // world x
  y: number // world y (in [PEG_Y_MIN, PEG_Y_MAX])
  used: boolean // has been latched at least once
}

export interface Glint {
  id: number
  x: number
  y: number
  collected: boolean
}

export interface LatchEvents {
  released: boolean // detached from a peg this step (launch)
  caught: boolean // latched a NEW peg this step (chain++)
  regrab: boolean // latched a peg but not a new one (rare; no chain++)
  collectedGlint: boolean // collected >=1 glint this step
  tierUp: boolean // combo multiplier increased this step
  comboBroken: boolean // combo reset this step (latched with 0 glints on the arc)
  enteredDanger: boolean // crossed DANGER_Y while flying+falling with no reachable peg
  swept: boolean // died by left edge this step
  dropped: boolean // died by pit this step
  over: boolean // swept || dropped
}

export interface LatchState {
  mode: Mode
  // bob world position + kinematics
  bobX: number
  bobY: number
  vx: number // used while flying
  vy: number
  // pendulum params (valid when mode==='swinging')
  pivotId: number // peg id currently latched (-1 when flying/idle)
  pivotX: number
  pivotY: number
  L: number // tether length (clamped [MIN_L, MAX_L])
  theta: number // angle from straight-down; bob at (pivotX+L*sinθ, pivotY+L*cosθ)
  omega: number // angular velocity (rad/frame)
  // world
  cameraX: number
  scrollSpeed: number
  pegs: Peg[]
  glints: Glint[]
  nextPegId: number
  nextGlintId: number
  lastPegId: number // highest-id peg ever latched (prevents re-grabbing behind)
  spawnCursorX: number // world x where the next peg will be placed
  // scoring / progression
  distanceMeters: number
  score: number // Σ deltaMeters*multiplier (leaderboard number, integer)
  scoreRaw: number // internal float accumulator (score = floor(scoreRaw))
  pegsChained: number
  comboCount: number // glints collected in the current combo run
  multiplier: number // 1..MAX_MULT
  glintsThisArc: number // glints collected since last latch
  over: boolean
  events: LatchEvents
}

export interface StepInput {
  dt: number
  holding: boolean // current button state THIS frame (level, not edge)
}

// ---- Constants (difficulty is data, not code) ----
export const FIELD_W = 480
export const FIELD_H = 480
export const BOB_R = 11
export const BOB_SCREEN_X = 192 // 0.40 * FIELD_W
export const PEG_R = 7
export const GRAVITY = 0.42 // px/frame^2 (projectile) & pendulum g
export const REACH = 120 // latch reach radius (px)
export const MIN_L = 40
export const MAX_L = 120 // MAX_L === REACH
export const PEG_Y_MIN = 90
export const PEG_Y_MAX = 260
export const BASE_SPACING = 150
export const SPACING_RAMP = 0.15
export const MAX_SPACING = 300
export const BASE_SCROLL = 1.2
export const SCROLL_RAMP = 0.004
export const MAX_SCROLL = 4.0
export const PX_PER_METER = 48
export const START_ANGLE = -0.6 // rad, bob pulled behind at idle
export const START_CAMERA_X = 0
export const SPAWN_AHEAD = 200
export const CULL_BEHIND = 120
export const KILL_X = -BOB_R // swept when screenX < KILL_X
export const GLINT_R = 16
export const GLINTS_PER_TIER = 2
export const MAX_MULT = 5
export const GLINT_X_FRAC = 0.62
export const GLINT_Y_LIFT = 54
export const GLINT_Y_JITTER = 40
export const DANGER_Y = 360
export const FIRST_PEG_X = 192
export const FIRST_PEG_Y = 150

const NO_EVENTS: LatchEvents = {
  released: false,
  caught: false,
  regrab: false,
  collectedGlint: false,
  tierUp: false,
  comboBroken: false,
  enteredDanger: false,
  swept: false,
  dropped: false,
  over: false,
}

/** Identical impl to flywheel's mulberry32. */
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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Place the next peg (and its glint) onto the ribbon, mutating the given state
 * arrays in place. Consumes exactly two rng draws in a FIXED order:
 *   draw #1 -> peg y jitter, draw #2 -> glint y jitter. Never reorder.
 */
function spawnNext(state: LatchState, rng: Rng): void {
  const spacing = Math.min(MAX_SPACING, BASE_SPACING + state.distanceMeters * SPACING_RAMP)
  const prevX = state.spawnCursorX
  // The peg immediately behind the new one (chord anchor for the glint).
  const prevPeg = state.pegs.length ? state.pegs[state.pegs.length - 1] : null
  const x = prevX + spacing

  // draw #1: peg height.
  const ry = rng()
  const y = PEG_Y_MIN + ry * (PEG_Y_MAX - PEG_Y_MIN)
  state.pegs.push({ id: state.nextPegId++, x, y, used: false })
  state.spawnCursorX = x

  // draw #2: glint height jitter. The first peg (no predecessor) spawns none.
  const gj = rng()
  if (prevPeg) {
    const gx = prevPeg.x + GLINT_X_FRAC * spacing
    const gy = Math.min(y, prevPeg.y) - GLINT_Y_LIFT + gj * GLINT_Y_JITTER
    state.glints.push({ id: state.nextGlintId++, x: gx, y: gy, collected: false })
  }
}

export function newGame(rng: Rng): LatchState {
  const pivotX = FIRST_PEG_X
  const pivotY = FIRST_PEG_Y
  const L = MAX_L
  const theta = START_ANGLE
  const bobX = pivotX + L * Math.sin(theta)
  const bobY = pivotY + L * Math.cos(theta)

  const state: LatchState = {
    mode: 'idle',
    bobX,
    bobY,
    vx: 0,
    vy: 0,
    pivotId: 0,
    pivotX,
    pivotY,
    L,
    theta,
    omega: 0,
    cameraX: START_CAMERA_X,
    scrollSpeed: BASE_SCROLL,
    pegs: [{ id: 0, x: pivotX, y: pivotY, used: true }],
    glints: [],
    nextPegId: 1,
    nextGlintId: 0,
    lastPegId: 0,
    spawnCursorX: pivotX,
    distanceMeters: 0,
    score: 0,
    scoreRaw: 0,
    pegsChained: 0,
    comboCount: 0,
    multiplier: 1,
    glintsThisArc: 0,
    over: false,
    events: { ...NO_EVENTS },
  }

  // Prefill the ribbon ahead of the camera.
  while (state.spawnCursorX <= state.cameraX + FIELD_W + SPAWN_AHEAD) {
    spawnNext(state, rng)
  }
  return state
}

/**
 * Nearest latchable peg ahead within REACH. Ranks candidates:
 *   pegs strictly ahead (x > bobX) within REACH, preferring the smallest id
 *   > lastPegId, then by ascending distance. Returns null if none.
 */
export function reachablePeg(state: LatchState): Peg | null {
  const { bobX, bobY, lastPegId } = state
  let best: Peg | null = null
  let bestKey = Infinity
  let bestDist = Infinity
  for (const p of state.pegs) {
    if (p.x <= bobX) continue
    const dx = p.x - bobX
    const dy = p.y - bobY
    const d = Math.hypot(dx, dy)
    if (d > REACH) continue
    // Prefer new pegs (id > lastPegId): give them a lower rank key so they
    // always win over already-used pegs, then break ties by distance.
    const isNew = p.id > lastPegId
    const key = isNew ? 0 : 1
    if (key < bestKey || (key === bestKey && d < bestDist)) {
      best = p
      bestKey = key
      bestDist = d
    }
  }
  return best
}

export function isDanger(state: LatchState): boolean {
  return state.mode === 'flying' && state.vy > 0 && state.bobY > DANGER_Y && reachablePeg(state) === null
}

export function step(state: LatchState, input: StepInput, rng: Rng): LatchState {
  if (state.over) return state
  const { dt } = input
  const holding = input.holding

  const events: LatchEvents = { ...NO_EVENTS }

  // Work on a shallow-cloned draft so the input state is never mutated.
  const s: LatchState = {
    ...state,
    pegs: state.pegs.map((p) => ({ ...p })),
    glints: state.glints.map((g) => ({ ...g })),
    events,
  }

  // (A) idle bootstrap: idle stays frozen until holding first goes true.
  if (s.mode === 'idle') {
    if (!holding) {
      return { ...state, events: { ...NO_EVENTS } }
    }
    s.mode = 'swinging'
  }

  // (B) difficulty.
  s.scrollSpeed = Math.min(MAX_SCROLL, BASE_SCROLL + s.distanceMeters * SCROLL_RAMP)

  // (C) physics.
  if (s.mode === 'swinging') {
    if (holding) {
      // Rigid frictionless pendulum, semi-implicit Euler.
      const alpha = -(GRAVITY / s.L) * Math.sin(s.theta)
      s.omega += alpha * dt
      s.theta += s.omega * dt
      s.bobX = s.pivotX + s.L * Math.sin(s.theta)
      s.bobY = s.pivotY + s.L * Math.cos(s.theta)
    } else {
      // RELEASE — tangential launch, momentum preserved.
      s.vx = s.L * s.omega * Math.cos(s.theta)
      s.vy = -s.L * s.omega * Math.sin(s.theta)
      s.mode = 'flying'
      s.pivotId = -1
      events.released = true
    }
  }

  if (s.mode === 'flying') {
    s.vy += GRAVITY * dt
    s.bobX += s.vx * dt
    s.bobY += s.vy * dt
    if (holding) {
      const p = reachablePeg(s)
      if (p) {
        const dx = s.bobX - p.x
        const dy = s.bobY - p.y
        s.L = clamp(Math.hypot(dx, dy), MIN_L, MAX_L)
        s.theta = Math.atan2(s.bobX - p.x, s.bobY - p.y)
        // Tangential component of velocity / L (radial absorbed by tether).
        s.omega = (s.vx * Math.cos(s.theta) - s.vy * Math.sin(s.theta)) / s.L
        s.pivotId = p.id
        s.pivotX = p.x
        s.pivotY = p.y
        s.mode = 'swinging'
        if (p.id > s.lastPegId) {
          p.used = true
          s.lastPegId = p.id
          s.pegsChained++
          events.caught = true
          if (s.glintsThisArc === 0) {
            s.comboCount = 0
            s.multiplier = 1
            events.comboBroken = true
          }
          s.glintsThisArc = 0
        } else {
          events.regrab = true
        }
      }
    }
  }

  // (D) camera (after bob moved).
  const prevCameraX = s.cameraX
  s.cameraX = Math.max(s.cameraX + s.scrollSpeed * dt, s.bobX - BOB_SCREEN_X)

  // (E) spawn ahead / cull behind.
  while (s.spawnCursorX <= s.cameraX + FIELD_W + SPAWN_AHEAD) {
    spawnNext(s, rng)
  }
  s.pegs = s.pegs.filter((p) => p.x >= s.cameraX - CULL_BEHIND)
  s.glints = s.glints.filter((g) => g.x >= s.cameraX - CULL_BEHIND)

  // (F) glint collection (flying only).
  if (s.mode === 'flying') {
    for (const g of s.glints) {
      if (g.collected) continue
      if (Math.hypot(s.bobX - g.x, s.bobY - g.y) <= GLINT_R + BOB_R) {
        g.collected = true
        s.comboCount++
        s.glintsThisArc++
        events.collectedGlint = true
        const m = Math.min(MAX_MULT, 1 + Math.floor(s.comboCount / GLINTS_PER_TIER))
        if (m > s.multiplier) events.tierUp = true
        s.multiplier = m
      }
    }
  }

  // (G) score.
  const deltaMeters = Math.max(0, (s.cameraX - prevCameraX) / PX_PER_METER)
  s.scoreRaw += deltaMeters * s.multiplier
  s.score = Math.floor(s.scoreRaw)
  s.distanceMeters = Math.floor((s.cameraX - START_CAMERA_X) / PX_PER_METER)

  // (H) danger (for slow-mo) — compute BEFORE death so component can react.
  events.enteredDanger = s.mode === 'flying' && s.vy > 0 && s.bobY > DANGER_Y && reachablePeg(s) === null

  // (I) death.
  const screenX = s.bobX - s.cameraX
  if (s.bobY - BOB_R > FIELD_H) {
    s.over = true
    events.dropped = true
  } else if (screenX < KILL_X) {
    s.over = true
    events.swept = true
  }
  events.over = s.over

  return s
}
