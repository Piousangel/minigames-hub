/**
 * Gravwell — pure engine.
 *
 * A one-shot orbital-slingshot puzzle. You fire a probe once (angle + power);
 * after launch there is no more input — real-time inverse-square gravity from
 * every planet on the board bends the trajectory, and you win by drifting the
 * probe into a target ring before it crashes, leaves the world, or times out.
 *
 * All physical state (positions, velocities, mass, radii) is stored as
 * integer fixed-point "mu" (milli-units): 1 world-unit == SCALE mu. Every
 * tick is a single semi-implicit ("symplectic") Euler step: velocity updates
 * first, then position uses the *new* velocity. `dt` is implicitly folded
 * into 1 tick == 1 — there is no separate dt variable.
 *
 * Floating point IS used for `Math.cos/sin` (launch angle -> initial
 * velocity, once per shot) and `Math.sqrt/floor/round` (acceleration
 * direction + rounding). What's forbidden is `Math.random`/`Date.now`/
 * `performance.now` — none of which appear anywhere below. Determinism comes
 * from "pure functions + an injected Rng", not from "integer ALU only".
 *
 * Softening: gravity floors the effective squared distance at radius^2 so it
 * never diverges inside a planet. In practice this is a safety net only,
 * because distance <= radius is already a crash the same tick.
 */

export type Rng = () => number // returns a float in [0,1)

export interface Vec {
  x: number // mu, integer
  y: number // mu, integer
}

export interface Planet {
  id: number
  x: number // mu
  y: number // mu
  mass: number // integer game-unit mass (not SI)
  radius: number // mu -- collision radius == softening radius
}

export interface TargetRing {
  x: number // mu
  y: number // mu
  innerRadius: number // mu
  outerRadius: number // mu -- innerRadius < outerRadius
}

export interface GravwellConfig {
  planetCount: number
  worldW: number // world-unit (not mu)
  worldH: number // world-unit
  g: number // integer gravity constant (per-difficulty)
  maxAttempts: number
  par: number
  massRange: [number, number]
  radiusRange: [number, number] // mu, massToRadius clamp range
}

export type GamePhase = 'aiming' | 'flying' | 'won' | 'lost'

export type GravwellEvent =
  | 'none'
  | 'aim'
  | 'launch'
  | 'tick'
  | 'graze'
  | 'crash'
  | 'oob'
  | 'timeout'
  | 'win'
  | 'lose'
  | 'reset'

export interface ProbeState {
  x: number // mu
  y: number // mu
  vx: number // mu/tick
  vy: number // mu/tick
  tick: number // ticks elapsed in this attempt
}

export interface GravwellState {
  config: GravwellConfig
  seed: number
  planets: Planet[]
  pad: Vec
  target: TargetRing
  phase: GamePhase
  angle: number // integer degrees, [ANGLE_MIN, ANGLE_MAX]
  power: number // integer, [POWER_MIN, POWER_MAX]
  probe: ProbeState | null // null while 'aiming'
  path: Vec[] // trajectory of the current (or just-finished) attempt; reset to [pad] on launch
  grazedPlanetIds: number[] // planet ids already grazed this attempt (ascending, no dupes)
  previousPaths: Vec[][] // ghost trails, newest last, length <= GHOST_LIMIT
  attemptsUsed: number
  score: number
  lastEvent: GravwellEvent
}

export type GravwellAction =
  | { type: 'aim'; angle?: number; power?: number } // absolute set (omitted fields keep current), clamped
  | { type: 'nudgeAngle'; delta: number }
  | { type: 'nudgePower'; delta: number }
  | { type: 'launch' }
  | { type: 'tick' }
  | { type: 'reset' } // restart the same seed (score/attempts back to 0)
  | { type: 'new'; seed: number } // new board

// -- Tunable constants -------------------------------------------------------

export const SCALE = 1000 // 1 world-unit == SCALE mu
export const VELOCITY_PER_POWER = 20 // mu/tick per power unit
export const ANGLE_MIN = -80
export const ANGLE_MAX = 80
export const POWER_MIN = 0
export const POWER_MAX = 100
export const GRAZE_MULT = 1.6
export const MAX_TICKS_PER_ATTEMPT = 900
export const MAX_PLANET_ATTEMPTS = 40
export const GHOST_LIMIT = 3
export const GRAZE_BONUS = 20
export const WIN_BONUS = 1000
export const PAR_BONUS_MAX = 1000
export const PAD_MARGIN = 6000 // mu -- planets must clear pad by radius + this
export const MIN_PLANET_SEPARATION = 2500 // mu -- planet<->planet / planet<->target clearance

export type Difficulty = 'easy' | 'normal' | 'hard'

export const DIFFICULTIES: Record<Difficulty, GravwellConfig> = {
  easy: {
    planetCount: 2,
    worldW: 100,
    worldH: 60,
    g: 1.0e7,
    maxAttempts: 6,
    par: 2,
    massRange: [50, 300],
    radiusRange: [3500, 6000],
  },
  normal: {
    planetCount: 3,
    worldW: 100,
    worldH: 60,
    g: 1.6e7,
    maxAttempts: 5,
    par: 3,
    massRange: [50, 350],
    radiusRange: [3500, 6000],
  },
  hard: {
    planetCount: 4,
    worldW: 100,
    worldH: 60,
    g: 2.2e7,
    maxAttempts: 4,
    par: 4,
    massRange: [80, 400],
    radiusRange: [3500, 6000],
  },
}

export const DAILY_CONFIG: GravwellConfig = DIFFICULTIES.normal

// -- Randomness ---------------------------------------------------------------

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// -- Pure primitives ----------------------------------------------------------

export function massToRadius(mass: number, cfg: GravwellConfig): number {
  const [m0, m1] = cfg.massRange
  const [r0, r1] = cfg.radiusRange
  const denom = m1 - m0
  if (denom <= 0) return Math.round(r0)
  const t = Math.min(1, Math.max(0, (mass - m0) / denom))
  return Math.round(r0 + (r1 - r0) * t)
}

export function clampAngle(angle: number): number {
  return Math.min(ANGLE_MAX, Math.max(ANGLE_MIN, Math.round(angle)))
}

export function clampPower(power: number): number {
  return Math.min(POWER_MAX, Math.max(POWER_MIN, Math.round(power)))
}

/** angle=0 points along +x (toward a target laid out to the right of the pad).
 * Positive angle tilts the shot upward (toward smaller world y). */
export function launchVelocity(angle: number, power: number): { vx: number; vy: number } {
  const rad = (angle * Math.PI) / 180
  const speed = power * VELOCITY_PER_POWER
  // `|| 0` also collapses a `-0` result (e.g. angle=0 or power=0) to `0` so
  // deep-equal assertions against plain `{ vx: 0, vy: 0 }` hold.
  const vx = Math.round(Math.cos(rad) * speed) || 0
  const vy = Math.round(-Math.sin(rad) * speed) || 0
  return { vx, vy }
}

export function distance2(a: Vec, b: Vec): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function computeAcceleration(
  p: { x: number; y: number },
  planets: Planet[],
  g: number,
): { ax: number; ay: number } {
  let ax = 0
  let ay = 0
  for (const planet of planets) {
    const dx = planet.x - p.x
    const dy = planet.y - p.y
    const r2 = dx * dx + dy * dy
    const r2eff = Math.max(r2, planet.radius * planet.radius)
    if (r2eff === 0) continue
    const r = Math.sqrt(r2eff)
    const aMag = Math.floor((g * planet.mass) / r2eff)
    ax += Math.round((aMag * dx) / r)
    ay += Math.round((aMag * dy) / r)
  }
  return { ax, ay }
}

export function stepProbe(probe: ProbeState, planets: Planet[], g: number): ProbeState {
  const { ax, ay } = computeAcceleration(probe, planets, g)
  const vx = probe.vx + ax
  const vy = probe.vy + ay
  const x = probe.x + vx
  const y = probe.y + vy
  return { x, y, vx, vy, tick: probe.tick + 1 }
}

export function isInsideRing(p: Vec, ring: TargetRing): boolean {
  const d2 = distance2(p, { x: ring.x, y: ring.y })
  return d2 >= ring.innerRadius * ring.innerRadius && d2 <= ring.outerRadius * ring.outerRadius
}

export function isCollided(p: Vec, planet: Planet): boolean {
  const d2 = distance2(p, { x: planet.x, y: planet.y })
  return d2 <= planet.radius * planet.radius
}

export function isGrazing(p: Vec, planet: Planet): boolean {
  const d2 = distance2(p, { x: planet.x, y: planet.y })
  const r2 = planet.radius * planet.radius
  const grazeR = planet.radius * GRAZE_MULT
  const grazeR2 = grazeR * grazeR
  return d2 > r2 && d2 <= grazeR2
}

export function isOutOfBounds(p: Vec, cfg: GravwellConfig): boolean {
  return p.x < 0 || p.y < 0 || p.x > cfg.worldW * SCALE || p.y > cfg.worldH * SCALE
}

export function computeParBonus(par: number, shotsUsed: number): number {
  return Math.round(PAR_BONUS_MAX * Math.min(1, par / Math.max(1, shotsUsed)))
}

// -- Board generation ----------------------------------------------------------

/**
 * Draws pad -> target -> planets in exactly that order, consuming rng() the
 * exact number of times documented in the spec (2 fixed draws + up to
 * MAX_PLANET_ATTEMPTS * 3 draws per planet). Changing this order breaks the
 * golden tests.
 */
export function generateBoard(
  cfg: GravwellConfig,
  rng: Rng,
): { planets: Planet[]; pad: Vec; target: TargetRing } {
  const padT = rng()
  const pad: Vec = {
    x: Math.round(cfg.worldW * 0.08 * SCALE),
    y: Math.round(lerp(cfg.worldH * 0.3, cfg.worldH * 0.7, padT) * SCALE),
  }

  const targetT = rng()
  const targetOuter = Math.round(cfg.worldH * 0.11 * SCALE)
  const target: TargetRing = {
    x: Math.round(cfg.worldW * 0.9 * SCALE),
    y: Math.round(lerp(cfg.worldH * 0.2, cfg.worldH * 0.8, targetT) * SCALE),
    outerRadius: targetOuter,
    innerRadius: Math.round(targetOuter * 0.4),
  }

  const planets: Planet[] = []
  for (let i = 0; i < cfg.planetCount; i++) {
    let candidate: Planet | null = null
    for (let attempt = 0; attempt < MAX_PLANET_ATTEMPTS; attempt++) {
      const tx = rng()
      const ty = rng()
      const tm = rng()
      const x = Math.round(lerp(cfg.worldW * 0.2, cfg.worldW * 0.8, tx) * SCALE)
      const y = Math.round(lerp(cfg.worldH * 0.1, cfg.worldH * 0.9, ty) * SCALE)
      const mass = Math.round(lerp(cfg.massRange[0], cfg.massRange[1], tm))
      const radius = massToRadius(mass, cfg)
      const p: Planet = { id: i, x, y, mass, radius }
      candidate = p

      const padClear = radius + PAD_MARGIN
      const okPad = distance2(p, pad) >= padClear * padClear
      const targetClear = radius + target.outerRadius + MIN_PLANET_SEPARATION
      const okTarget = distance2(p, { x: target.x, y: target.y }) >= targetClear * targetClear
      let okPlanets = true
      for (const other of planets) {
        const minD = radius + other.radius + MIN_PLANET_SEPARATION
        if (distance2(p, other) < minD * minD) {
          okPlanets = false
          break
        }
      }

      if (okPad && okTarget && okPlanets) break
    }
    planets.push(candidate as Planet)
  }

  return { planets, pad, target }
}

export function createGame(cfg: GravwellConfig, seed: number): GravwellState {
  const rng = mulberry32(seed)
  const { planets, pad, target } = generateBoard(cfg, rng)
  return {
    config: cfg,
    seed,
    planets,
    pad,
    target,
    phase: 'aiming',
    angle: 0,
    power: 50,
    probe: null,
    path: [],
    grazedPlanetIds: [],
    previousPaths: [],
    attemptsUsed: 0,
    score: 0,
    lastEvent: 'none',
  }
}

// -- Simulation -----------------------------------------------------------------

/** Shared bookkeeping for an attempt that ends without a win (crash/oob/timeout). */
function endAttempt(
  state: GravwellState,
  next: ProbeState,
  event: 'crash' | 'oob' | 'timeout',
): GravwellState {
  const finishedPath = [...state.path, { x: next.x, y: next.y }]
  const attemptsUsed = state.attemptsUsed + 1
  const previousPaths = [...state.previousPaths, finishedPath].slice(-GHOST_LIMIT)

  if (attemptsUsed >= state.config.maxAttempts) {
    return {
      ...state,
      probe: next,
      path: finishedPath,
      attemptsUsed,
      previousPaths,
      phase: 'lost',
      lastEvent: 'lose',
    }
  }
  return {
    ...state,
    probe: null,
    path: [],
    grazedPlanetIds: [],
    attemptsUsed,
    previousPaths,
    phase: 'aiming',
    lastEvent: event,
  }
}

export function resolveTick(state: GravwellState): GravwellState {
  if (state.phase !== 'flying' || !state.probe) {
    return { ...state, lastEvent: 'none' }
  }
  const next = stepProbe(state.probe, state.planets, state.config.g)

  // 1. crash
  for (const planet of state.planets) {
    if (isCollided(next, planet)) {
      return endAttempt(state, next, 'crash')
    }
  }

  // 2. win
  if (isInsideRing(next, state.target)) {
    const attemptsUsed = state.attemptsUsed + 1
    const parBonus = computeParBonus(state.config.par, attemptsUsed)
    const score = state.score + WIN_BONUS + parBonus
    return {
      ...state,
      probe: next,
      path: [...state.path, { x: next.x, y: next.y }],
      phase: 'won',
      attemptsUsed,
      score,
      lastEvent: 'win',
    }
  }

  // 3. out of bounds
  if (isOutOfBounds(next, state.config)) {
    return endAttempt(state, next, 'oob')
  }

  // 4. graze (does not end the attempt; every planet is checked, no early-return)
  let score = state.score
  let grazedPlanetIds = state.grazedPlanetIds
  let grazedThisTick = false
  for (const planet of state.planets) {
    if (isGrazing(next, planet) && !grazedPlanetIds.includes(planet.id)) {
      score += GRAZE_BONUS
      grazedPlanetIds = [...grazedPlanetIds, planet.id].sort((a, b) => a - b)
      grazedThisTick = true
    }
  }

  // 5. timeout
  if (next.tick >= MAX_TICKS_PER_ATTEMPT) {
    return endAttempt({ ...state, score, grazedPlanetIds }, next, 'timeout')
  }

  // 6. still flying
  return {
    ...state,
    probe: next,
    path: [...state.path, { x: next.x, y: next.y }],
    score,
    grazedPlanetIds,
    lastEvent: grazedThisTick ? 'graze' : 'tick',
  }
}

// -- Reducer ----------------------------------------------------------------------

export function reduce(state: GravwellState, action: GravwellAction): GravwellState {
  switch (action.type) {
    case 'aim': {
      if (state.phase === 'flying') return { ...state, lastEvent: 'none' }
      const angle = action.angle !== undefined ? clampAngle(action.angle) : state.angle
      const power = action.power !== undefined ? clampPower(action.power) : state.power
      return { ...state, angle, power, lastEvent: 'aim' }
    }
    case 'nudgeAngle': {
      if (state.phase !== 'aiming') return { ...state, lastEvent: 'none' }
      return { ...state, angle: clampAngle(state.angle + action.delta), lastEvent: 'aim' }
    }
    case 'nudgePower': {
      if (state.phase !== 'aiming') return { ...state, lastEvent: 'none' }
      return { ...state, power: clampPower(state.power + action.delta), lastEvent: 'aim' }
    }
    case 'launch': {
      if (state.phase !== 'aiming') return { ...state, lastEvent: 'none' }
      const { vx, vy } = launchVelocity(state.angle, state.power)
      const probe: ProbeState = { x: state.pad.x, y: state.pad.y, vx, vy, tick: 0 }
      return {
        ...state,
        probe,
        path: [{ x: state.pad.x, y: state.pad.y }],
        grazedPlanetIds: [],
        phase: 'flying',
        lastEvent: 'launch',
      }
    }
    case 'tick':
      return resolveTick(state)
    case 'reset':
      return { ...createGame(state.config, state.seed), lastEvent: 'reset' }
    case 'new':
      return { ...createGame(state.config, action.seed), lastEvent: 'reset' }
    default:
      return state
  }
}

// -- Preview (aiming-time ghost trajectory) ----------------------------------------

/**
 * Traces where the probe would go if launched right now, without touching
 * `state`. Stops on crash/win/oob or after `maxTicks`.
 */
export function simulatePreview(state: GravwellState, maxTicks: number): Vec[] {
  const { vx, vy } = launchVelocity(state.angle, state.power)
  let probe: ProbeState = { x: state.pad.x, y: state.pad.y, vx, vy, tick: 0 }
  const pts: Vec[] = [{ x: probe.x, y: probe.y }]
  for (let i = 0; i < maxTicks; i++) {
    const next = stepProbe(probe, state.planets, state.config.g)
    pts.push({ x: next.x, y: next.y })

    let stop = false
    for (const planet of state.planets) {
      if (isCollided(next, planet)) {
        stop = true
        break
      }
    }
    if (!stop && isInsideRing(next, state.target)) stop = true
    if (!stop && isOutOfBounds(next, state.config)) stop = true
    if (stop) return pts

    probe = next
  }
  return pts
}
