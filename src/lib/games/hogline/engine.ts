/**
 * Hogline — pure engine.
 *
 * A curling-inspired momentum puzzle. Push a stone up the sheet with a chosen
 * power/angle; it decelerates under friction and collides elastically with
 * seeded "obstacle" stones (red) already resting on the ice. Score is the
 * curling house count of your (yellow) stones vs. the computer's (red)
 * obstacle stones, evaluated only on the FINAL resting position of every
 * throw — there is no live hog-line-crossing-at-release check, and no undo
 * (wasted throws should cost you; that tension is the whole point of the
 * min-shots leaderboard angle).
 *
 * All functions here are pure and total: no timers, no `Date`, and NO
 * `Math.random`. Randomness enters only through an injected `Rng`, used
 * solely in `generateObstacles` (called once from `createGame`). The throw
 * simulation, collision resolution, and scoring are all RNG-free and
 * closed-form, so every outcome is golden-testable from a fixed script.
 */

// -- Constants ----------------------------------------------------------

export const SHEET_WIDTH = 100
export const SHEET_LENGTH = 220 // y=0 (hack) .. y=220 (back line)
export const HOG_LINE_Y = 40 // stones resting below this are removed
export const HOUSE_CENTER = { x: 50, y: 200 }
export const HOUSE_R1 = 18 // outer ring: 1 pt   (R2 < dist <= R1)
export const HOUSE_R2 = 11 // mid ring:   2 pt   (R3 < dist <= R2)
export const HOUSE_R3 = 4 // button:     3 pt   (dist <= R3)
export const RING_POINTS = { outer: 1, mid: 2, center: 3 } as const

export const STONE_RADIUS = 2.4
export const STONE_MASS_NORMAL = 1
export const STONE_MASS_GUARD = 1.8 // heavier obstacle variant
export const GUARD_PROB = 0.3

export const FRICTION = 0.015 // v *= (1 - FRICTION) per tick
export const STOP_EPS = 0.04 // |v| below this snaps to exactly 0
export const MAX_TICKS_PER_THROW = 600 // safety valve, sim always converges before this given FRICTION>0

export const MIN_SPEED = 0.5
export const MAX_SPEED = 5.5
export const MAX_ANGLE_DEG = 22
export const POWER_STEP = 0.05
export const ANGLE_STEP = 2
export const HACK_POS = { x: 50, y: 3.4 } // fixed launch point

export const PLACEMENT_MARGIN = 1.0
export const MAX_PLACEMENT_ATTEMPTS = 20

export const SCORE_SCALE = 10
export const BONUS_PER_UNUSED_SHOT = 15
export const BASE_TARGET = 40
export const TARGET_OBSTACLE_COEF = 4 // fewer obstacles (easier board) -> higher bar

export const DIFFICULTIES = {
  easy: { obstacleMin: 2, obstacleMax: 3, shotsAllowed: 6 },
  normal: { obstacleMin: 3, obstacleMax: 5, shotsAllowed: 6 },
  hard: { obstacleMin: 5, obstacleMax: 7, shotsAllowed: 5 },
} satisfies Record<'easy' | 'normal' | 'hard', HoglineConfig>

export const DAILY_CONFIG: HoglineConfig = DIFFICULTIES.normal

// -- Types ----------------------------------------------------------------

export type Rng = () => number // returns a float in [0,1)

export interface Vec2 {
  x: number
  y: number
}

export type StoneColor = 'yellow' | 'red' // yellow = player, red = obstacle

export interface Stone {
  id: number
  color: StoneColor
  mass: number
  radius: number
  pos: Vec2
  vel: Vec2
  guard: boolean // mass === STONE_MASS_GUARD, kept redundant for rendering
}

export interface HoglineConfig {
  obstacleMin: number
  obstacleMax: number
  shotsAllowed: number
}

export interface ThrowFrame {
  tick: number
  stones: { id: number; pos: Vec2 }[] // positions only — playback data for the component
}

export interface ThrowResult {
  stones: Stone[] // full active-stone list AFTER this throw (post-removal)
  frames: ThrowFrame[] // frames[0] = positions at release (tick 0); last = settled, pre-removal
  removed: Stone[] // stones removed this throw (hogged or thrown-through)
  newStoneId: number // id of the stone just released
  ticksUsed: number
  collisionCount: number // # pairwise collision impulses applied across the whole throw
}

export type HoglineEvent =
  | 'none'
  | 'aim' // power/angle changed, no sim ran
  | 'release' // stone thrown, settled, no collisions, nothing removed
  | 'collision' // >=1 collision occurred this throw
  | 'removed' // >=1 stone (either color) was removed this throw
  | 'finish' // game ended (exhausted shots or banked), target not met
  | 'win' // game ended, score >= target

export interface HoglineState {
  config: HoglineConfig
  seed: number
  target: number // win threshold, computed once at generation
  stones: Stone[] // all currently active stones (obstacles + landed player stones)
  nextId: number // next id to assign to a released stone
  power: number // 0..1, current aim
  angle: number // -MAX_ANGLE_DEG..MAX_ANGLE_DEG, current aim
  shotsLeft: number
  shotsUsed: number
  score: number // houseScore*SCORE_SCALE, live; + efficiencyBonus once finished
  houseScore: number // last computed raw ring-sum (pre-scale), for display
  finished: boolean
  won: boolean
  lastThrow: ThrowResult | null
  lastEvent: HoglineEvent
}

export type HoglineAction =
  | { type: 'setPower'; power: number }
  | { type: 'setAngle'; angle: number }
  | { type: 'nudgePower'; delta: number }
  | { type: 'nudgeAngle'; delta: number }
  | { type: 'aimReset' }
  | { type: 'release' }
  | { type: 'bank' }
  | { type: 'reset' }
  | { type: 'new'; seed: number }

// -- RNG --------------------------------------------------------------------

/** Identical impl to Decant's mulberry32 (copied verbatim, no cross-import). */
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

// -- Vector primitives --------------------------------------------------------

export function vecSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}
export function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}
export function vecScale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s }
}
export function vecLen(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.y * a.y)
}
export function vecDot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y
}
/** Total function: zero-length input returns {0,0}, never NaN. */
export function vecNorm(a: Vec2): Vec2 {
  const len = vecLen(a)
  if (len === 0) return { x: 0, y: 0 }
  return { x: a.x / len, y: a.y / len }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

// -- House scoring ------------------------------------------------------------

/** Monotonic non-increasing in dist; boundaries inclusive on the inner comparison. */
export function ringValue(dist: number): 0 | 1 | 2 | 3 {
  if (dist <= HOUSE_R3) return 3
  if (dist <= HOUSE_R2) return 2
  if (dist <= HOUSE_R1) return 1
  return 0
}

// -- Physics tick -------------------------------------------------------------

/**
 * One fixed-dt=1 physics tick: integrate -> wall bounce -> pairwise collisions
 * (single ascending pass) -> friction decay -> epsilon snap. Pure: never
 * mutates the input array or its stones.
 */
export function stepTick(stones: Stone[]): { stones: Stone[]; collisions: number } {
  const s: Stone[] = stones.map((st) => ({ ...st, pos: { ...st.pos }, vel: { ...st.vel } }))

  // 1. Integrate.
  for (const st of s) {
    st.pos = vecAdd(st.pos, st.vel)
  }

  // 2. Wall bounce (side walls only — y is open-ended, handled by removal).
  for (const st of s) {
    if (st.pos.x - st.radius < 0) {
      st.pos.x = st.radius
      st.vel.x = -st.vel.x
    } else if (st.pos.x + st.radius > SHEET_WIDTH) {
      st.pos.x = SHEET_WIDTH - st.radius
      st.vel.x = -st.vel.x
    }
  }

  // 3. Pairwise collisions, ascending (i,j), single pass.
  let collisions = 0
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      const a = s[i]
      const b = s[j]
      const delta = vecSub(b.pos, a.pos)
      const dist = vecLen(delta)
      const minDist = a.radius + b.radius
      if (dist >= minDist) continue

      const n = dist === 0 ? { x: 1, y: 0 } : vecNorm(delta)
      const overlap = minDist - dist
      const totalMass = a.mass + b.mass

      // Positional correction — always, even if separating.
      const pushA = overlap * (b.mass / totalMass)
      const pushB = overlap * (a.mass / totalMass)
      a.pos = vecSub(a.pos, vecScale(n, pushA))
      b.pos = vecAdd(b.pos, vecScale(n, pushB))

      // Velocity impulse — only if approaching.
      const vRel = vecSub(a.vel, b.vel)
      const vRelN = vecDot(vRel, n)
      if (vRelN > 0) {
        const impulse = ((2 * a.mass * b.mass) / totalMass) * vRelN
        a.vel = vecSub(a.vel, vecScale(n, impulse / a.mass))
        b.vel = vecAdd(b.vel, vecScale(n, impulse / b.mass))
        collisions++
      }
    }
  }

  // 4. Friction decay.
  for (const st of s) st.vel = vecScale(st.vel, 1 - FRICTION)

  // 5. Epsilon snap.
  for (const st of s) {
    if (vecLen(st.vel) < STOP_EPS) st.vel = { x: 0, y: 0 }
  }

  return { stones: s, collisions }
}

export function isSettled(stones: Stone[]): boolean {
  return stones.every((s) => s.vel.x === 0 && s.vel.y === 0)
}

/**
 * Appends `released` to `stones`, records frame 0 at the release positions,
 * then repeatedly ticks until settled or the safety-valve tick cap.
 */
export function simulateThrow(
  stones: Stone[],
  released: Stone,
): { frames: ThrowFrame[]; finalStones: Stone[]; ticksUsed: number; collisionCount: number } {
  let current: Stone[] = [...stones, released]
  const frames: ThrowFrame[] = [
    { tick: 0, stones: current.map((s) => ({ id: s.id, pos: { ...s.pos } })) },
  ]
  let ticksUsed = 0
  let collisionCount = 0

  while (!isSettled(current) && ticksUsed < MAX_TICKS_PER_THROW) {
    const { stones: next, collisions } = stepTick(current)
    current = next
    collisionCount += collisions
    ticksUsed++
    frames.push({ tick: ticksUsed, stones: current.map((s) => ({ id: s.id, pos: { ...s.pos } })) })
  }

  return { frames, finalStones: current, ticksUsed, collisionCount }
}

/**
 * A stone is removed iff it rests below the hog line, past the back line, or
 * (defensively) outside the side walls. `kept` preserves input order.
 */
export function applyRemoval(stones: Stone[]): { kept: Stone[]; removed: Stone[] } {
  const kept: Stone[] = []
  const removed: Stone[] = []
  for (const s of stones) {
    if (s.pos.y < HOG_LINE_Y || s.pos.y > SHEET_LENGTH || s.pos.x < 0 || s.pos.x > SHEET_WIDTH) {
      removed.push(s)
    } else {
      kept.push(s)
    }
  }
  return { kept, removed }
}

export interface HouseScoreResult {
  houseScore: number
  controlling: StoneColor | null
  counted: number[]
}

/**
 * Curling counting rule: the color nearest the button "controls" the house.
 * If red controls, the player scores nothing this end. If yellow controls,
 * score = sum of ringValue over every yellow stone closer than the nearest
 * red in-house stone (or all yellow in-house stones, if no red is present).
 */
export function computeHouseScore(stones: Stone[]): HouseScoreResult {
  const inHouse = stones
    .map((s) => ({ s, d: vecLen(vecSub(s.pos, HOUSE_CENTER)) }))
    .filter((x) => ringValue(x.d) > 0)

  if (inHouse.length === 0) return { houseScore: 0, controlling: null, counted: [] }

  let nearest = inHouse[0]
  for (const x of inHouse) if (x.d < nearest.d) nearest = x
  const controlling = nearest.s.color

  if (controlling === 'red') return { houseScore: 0, controlling: 'red', counted: [] }

  const reds = inHouse.filter((x) => x.s.color === 'red')
  const cutoff = reds.length > 0 ? Math.min(...reds.map((x) => x.d)) : Infinity
  const counted = inHouse.filter((x) => x.s.color === 'yellow' && x.d < cutoff)
  const houseScore = counted.reduce((sum, x) => sum + ringValue(x.d), 0)

  return { houseScore, controlling: 'yellow', counted: counted.map((x) => x.s.id) }
}

// -- Throw resolution ---------------------------------------------------------

/** Pure given `state, power, angle`; no RNG. */
export function resolveThrow(state: HoglineState, power: number, angle: number): ThrowResult {
  const p = clamp(power, 0, 1)
  const a = clamp(angle, -MAX_ANGLE_DEG, MAX_ANGLE_DEG)
  const speed = MIN_SPEED + p * (MAX_SPEED - MIN_SPEED)
  const rad = (a * Math.PI) / 180
  const vel: Vec2 = { x: speed * Math.sin(rad), y: speed * Math.cos(rad) }
  const released: Stone = {
    id: state.nextId,
    color: 'yellow',
    mass: STONE_MASS_NORMAL,
    radius: STONE_RADIUS,
    pos: { ...HACK_POS },
    vel,
    guard: false,
  }

  const sim = simulateThrow(state.stones, released)
  const { kept, removed } = applyRemoval(sim.finalStones)

  return {
    stones: kept,
    frames: sim.frames,
    removed,
    newStoneId: released.id,
    ticksUsed: sim.ticksUsed,
    collisionCount: sim.collisionCount,
  }
}

// -- Board generation -----------------------------------------------------

export function computeTarget(cfg: HoglineConfig, obstacles: Stone[]): number {
  return Math.round(BASE_TARGET + (cfg.obstacleMax - obstacles.length) * TARGET_OBSTACLE_COEF)
}

export function generateObstacles(cfg: HoglineConfig, rng: Rng): Stone[] {
  const count = cfg.obstacleMin + Math.floor(rng() * (cfg.obstacleMax - cfg.obstacleMin + 1))
  const stones: Stone[] = []

  for (let i = 0; i < count; i++) {
    const isGuard = rng() < GUARD_PROB
    let attempts = 0
    let x = 0
    let y = 0
    let placed = false
    do {
      x = STONE_RADIUS + rng() * (SHEET_WIDTH - 2 * STONE_RADIUS)
      y = HOG_LINE_Y + rng() * (HOUSE_CENTER.y + HOUSE_R1 - HOG_LINE_Y)
      attempts++
      const overlaps = stones.some(
        (s) => vecLen(vecSub({ x, y }, s.pos)) < STONE_RADIUS * 2 + PLACEMENT_MARGIN,
      )
      if (!overlaps) placed = true
    } while (!placed && attempts < MAX_PLACEMENT_ATTEMPTS)

    stones.push({
      id: i,
      color: 'red',
      mass: isGuard ? STONE_MASS_GUARD : STONE_MASS_NORMAL,
      radius: STONE_RADIUS,
      pos: { x, y },
      vel: { x: 0, y: 0 },
      guard: isGuard,
    })
  }

  return stones
}

export function createGame(cfg: HoglineConfig, seed: number): HoglineState {
  const rng = mulberry32(seed)
  const obstacles = generateObstacles(cfg, rng)
  const target = computeTarget(cfg, obstacles)
  return {
    config: cfg,
    seed,
    target,
    stones: obstacles,
    nextId: obstacles.length,
    power: 0.5,
    angle: 0,
    shotsLeft: cfg.shotsAllowed,
    shotsUsed: 0,
    score: 0,
    houseScore: 0,
    finished: false,
    won: false,
    lastThrow: null,
    lastEvent: 'none',
  }
}

// -- Reducer ------------------------------------------------------------------

export function reduce(state: HoglineState, action: HoglineAction): HoglineState {
  switch (action.type) {
    case 'setPower':
      return { ...state, power: clamp(action.power, 0, 1), lastEvent: 'aim' }

    case 'setAngle':
      return { ...state, angle: clamp(action.angle, -MAX_ANGLE_DEG, MAX_ANGLE_DEG), lastEvent: 'aim' }

    case 'nudgePower':
      return { ...state, power: clamp(state.power + action.delta, 0, 1), lastEvent: 'aim' }

    case 'nudgeAngle':
      return {
        ...state,
        angle: clamp(state.angle + action.delta, -MAX_ANGLE_DEG, MAX_ANGLE_DEG),
        lastEvent: 'aim',
      }

    case 'aimReset':
      return { ...state, power: 0.5, angle: 0, lastEvent: 'aim' }

    case 'release': {
      if (state.finished || state.shotsLeft <= 0) return { ...state, lastEvent: 'none' }

      const out = resolveThrow(state, state.power, state.angle)
      const { houseScore } = computeHouseScore(out.stones)
      const score = houseScore * SCORE_SCALE
      const shotsLeft = state.shotsLeft - 1
      const shotsUsed = state.shotsUsed + 1
      const nextId = state.nextId + 1

      let finished: boolean = state.finished
      let won: boolean = state.won
      if (shotsLeft === 0) {
        finished = true
        won = score >= state.target
      }

      let event: HoglineEvent
      if (finished) {
        event = won ? 'win' : 'finish'
      } else if (out.removed.length > 0) {
        event = 'removed'
      } else if (out.collisionCount > 0) {
        event = 'collision'
      } else {
        event = 'release'
      }

      return {
        ...state,
        stones: out.stones,
        nextId,
        shotsLeft,
        shotsUsed,
        score,
        houseScore,
        finished,
        won,
        lastThrow: out,
        lastEvent: event,
      }
    }

    case 'bank': {
      if (state.finished || state.shotsLeft === 0) return { ...state, lastEvent: 'none' }

      // The win is judged on the house alone (state.score === houseScore * SCORE_SCALE);
      // the unused-shot bonus only sweetens the final score. Counting the bonus toward
      // the target let a shot-0 bank (6 × 15 = 90) clear every target outright.
      const won = state.score >= state.target
      const unusedShots = state.shotsLeft
      const score = state.score + unusedShots * BONUS_PER_UNUSED_SHOT

      return {
        ...state,
        score,
        finished: true,
        shotsLeft: 0,
        won,
        lastEvent: won ? 'win' : 'finish',
      }
    }

    case 'reset':
      return createGame(state.config, state.seed)

    case 'new':
      return createGame(state.config, action.seed)

    default:
      return state
  }
}

// isDeadStone / isDeadlocked: NOT NEEDED. Every throw is always legal (power/angle
// are clamped, never illegal) — there is no deadlock/illegal-move concept here,
// unlike Decant.
