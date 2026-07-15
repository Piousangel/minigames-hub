// Tower Stack — pure, deterministic "Stack" timing engine.
//
// A single block slides back and forth across a fixed-width field. On `drop`
// it is placed on top of the block below: the overhang (the part that sticks
// out past the block below) is sliced off, and the surviving overlap becomes
// the new block's width. Miss entirely (overlap <= 0) and the run ends. A
// near-exact "perfect" drop snaps to center and regains a little width.
//
// Coordinates: x grows rightward, in engine units across [0, FIELD_W]. A block
// is an interval [x, x + width]. Vertical stacking is a rendering concern and
// lives in the component — the engine only tracks x-position and width.
//
// No `Math.random` in here. Time is expressed in `dt` frames (dt = 1 is one
// 60fps step) so the moving block advances frame-rate independently. Every
// output is a pure function of its inputs, exactly like g2048's engine.

export type Dir = 1 | -1

/** A placed (or moving) block, described only by its horizontal extent. */
export interface Block {
  x: number // left edge
  width: number
}

export interface Moving extends Block {
  dir: Dir // current travel direction (+1 = right, -1 = left)
}

/** A sliced-off overhang rectangle, for the falling-sliver juice. */
export interface Slice {
  x: number
  width: number
}

export interface DropEvent {
  dropped: boolean // a drop was resolved this call
  perfect: boolean // near-exact alignment (regained width)
  missed: boolean // overlap <= 0 → game over
  slices: Slice[] // overhang pieces removed (empty on a perfect drop)
}

export interface StackState {
  tower: Block[] // index 0 = base (bottom) … last = top placed block
  moving: Moving | null // the block currently sliding; null once over
  speed: number // moving-block speed in units per frame (dt = 1)
  score: number // successful drops === tower.length - 1
  over: boolean
  events: DropEvent
}

// ---- Field / geometry ----
export const FIELD_W = 320
export const BASE_WIDTH = 130

// ---- Difficulty ----
export const START_SPEED = 2.2 // units per frame at score 0
export const SPEED_INC = 0.16 // added per successful drop
export const MAX_SPEED = 7 // clamp so it stays playable

// ---- Perfect drop ----
export const PERFECT_TOLERANCE = 4 // |offset| <= this snaps to a perfect drop
export const PERFECT_BONUS = 6 // width regained on a perfect drop
export const MAX_WIDTH = BASE_WIDTH // perfect regain never exceeds the base

const NO_EVENTS: DropEvent = { dropped: false, perfect: false, missed: false, slices: [] }

/**
 * Spawn the next moving block at the given width. Entry side alternates with
 * `score` (deterministic, no rng): even → enter from the left moving right,
 * odd → enter from the right moving left.
 */
export function spawnMoving(width: number, score: number): Moving {
  const dir: Dir = score % 2 === 0 ? 1 : -1
  const x = dir === 1 ? 0 : FIELD_W - width
  return { x, width, dir }
}

export function newGame(): StackState {
  const base: Block = { x: (FIELD_W - BASE_WIDTH) / 2, width: BASE_WIDTH }
  return {
    tower: [base],
    moving: spawnMoving(base.width, 0),
    speed: START_SPEED,
    score: 0,
    over: false,
    events: NO_EVENTS,
  }
}

/**
 * Advance the moving block one step, bouncing within [0, FIELD_W - width].
 * Reflects off each wall (flipping direction) and clamps so the block never
 * leaves the field even after a large dt. Pure: no side effects.
 */
export function step(state: StackState, dt: number): StackState {
  if (state.over || !state.moving) return state
  const m = state.moving
  const maxX = FIELD_W - m.width
  if (maxX <= 0) {
    // Block fills the field — nowhere to travel; hold still.
    return { ...state, moving: { ...m, x: 0 }, events: NO_EVENTS }
  }

  let x = m.x + state.speed * m.dir * dt
  let dir = m.dir
  if (x < 0) {
    x = -x
    dir = 1
  } else if (x > maxX) {
    x = 2 * maxX - x
    dir = -1
  }
  // Safety clamp for pathological dt.
  if (x < 0) x = 0
  else if (x > maxX) x = maxX

  return { ...state, moving: { x, width: m.width, dir }, events: NO_EVENTS }
}

/**
 * Drop the moving block onto the block below.
 *
 * overlap = intersection of the two intervals. overlap <= 0 → game over. Else
 * the overhang is sliced off, the surviving overlap becomes the new width, the
 * score increments and speed rises. A near-exact drop (|offset| <=
 * PERFECT_TOLERANCE) snaps to the below block's center and regains a little
 * width (never past MAX_WIDTH), then spawns the next moving block.
 */
export function drop(state: StackState): StackState {
  if (state.over || !state.moving) return state
  const below = state.tower[state.tower.length - 1]
  const m = state.moving

  const overlapLeft = Math.max(m.x, below.x)
  const overlapRight = Math.min(m.x + m.width, below.x + below.width)
  const overlap = overlapRight - overlapLeft

  if (overlap <= 0) {
    return {
      ...state,
      moving: null,
      over: true,
      events: { dropped: true, perfect: false, missed: true, slices: [{ x: m.x, width: m.width }] },
    }
  }

  const offset = m.x - below.x
  const perfect = Math.abs(offset) <= PERFECT_TOLERANCE

  let placed: Block
  const slices: Slice[] = []
  if (perfect) {
    const width = Math.min(MAX_WIDTH, below.width + PERFECT_BONUS)
    const center = below.x + below.width / 2
    let x = center - width / 2
    if (x < 0) x = 0
    else if (x + width > FIELD_W) x = FIELD_W - width
    placed = { x, width }
  } else {
    // Collect the removed overhang piece(s) for the falling sliver.
    if (m.x < overlapLeft) slices.push({ x: m.x, width: overlapLeft - m.x })
    const mRight = m.x + m.width
    if (mRight > overlapRight) slices.push({ x: overlapRight, width: mRight - overlapRight })
    placed = { x: overlapLeft, width: overlap }
  }

  const tower = [...state.tower, placed]
  const score = state.score + 1
  const speed = Math.min(MAX_SPEED, START_SPEED + score * SPEED_INC)

  return {
    tower,
    moving: spawnMoving(placed.width, score),
    speed,
    score,
    over: false,
    events: { dropped: true, perfect, missed: false, slices },
  }
}
