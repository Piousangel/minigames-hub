// Flappy — pure, deterministic tap-to-fly physics.
//
// Coordinate system: y grows downward. The bird is fixed on the x axis at
// BIRD_X and only moves vertically; the world scrolls left past it. All time
// is expressed in `dt` frames where dt=1 means one 60fps step, so callers can
// pass fractional dt for frame-rate independence.
//
// No Math.random in here: pipe gap positions come from an injected `rng`
// (a () => number in [0,1)), exactly like snake's `placeFood`.

export type Rng = () => number

export interface Pipe {
  x: number // left edge of the pipe column
  gapY: number // top of the vertical opening; gap spans [gapY, gapY + GAP]
  scored: boolean // already counted toward the score (bird cleared it)
}

export interface FlappyEvents {
  scored: boolean // a pipe was passed this step
  crashed: boolean // the bird died this step
}

export interface FlappyState {
  y: number // bird center y
  vy: number // vertical velocity (positive = falling)
  pipes: Pipe[]
  score: number
  over: boolean
  events: FlappyEvents
}

export interface StepInput {
  dt: number // frames elapsed (1 = one 60fps frame)
  flap: boolean // true on the frame the player tapped
}

// ---- Field ----
export const FIELD_W = 400
export const FIELD_H = 400

// ---- Bird ----
export const BIRD_X = 120
export const BIRD_R = 13

// ---- Physics ----
export const GRAVITY = 0.5 // velocity gained per frame while falling
export const FLAP_IMPULSE = 7.6 // upward velocity set on a flap
export const MAX_FALL = 12 // terminal downward velocity (clamp)

// ---- Pipes ----
export const PIPE_W = 58
export const GAP = 130 // vertical opening height
export const PIPE_SPEED = 2.6 // leftward scroll per frame
export const PIPE_SPACING = 210 // horizontal distance between pipe columns
export const GAP_MARGIN = 45 // min distance of the gap from ceiling/ground

const NO_EVENTS: FlappyEvents = { scored: false, crashed: false }

/** Pick a gap-top y within the valid, reachable band for the given rng draw. */
export function nextGapY(rng: Rng): number {
  const min = GAP_MARGIN
  const span = FIELD_H - GAP - 2 * GAP_MARGIN
  return min + rng() * span
}

/** A fresh pipe entering from the right edge. */
export function spawnPipe(x: number, rng: Rng): Pipe {
  return { x, gapY: nextGapY(rng), scored: false }
}

export function newGame(): FlappyState {
  return {
    y: FIELD_H / 2,
    vy: 0,
    pipes: [],
    score: 0,
    over: false,
    events: NO_EVENTS,
  }
}

/** Does the bird (a circle at BIRD_X, y) overlap this pipe's solid part? */
function hitsPipe(y: number, pipe: Pipe): boolean {
  const overlapsX = BIRD_X + BIRD_R > pipe.x && BIRD_X - BIRD_R < pipe.x + PIPE_W
  if (!overlapsX) return false
  const throughGap = y - BIRD_R >= pipe.gapY && y + BIRD_R <= pipe.gapY + GAP
  return !throughGap
}

/**
 * Advance the world one step.
 *
 * Order: apply flap impulse (if any) → gravity → integrate position → scroll
 * pipes → cull/spawn → score cleared pipes → detect collisions. Pure: same
 * inputs (including rng draws) always yield the same output.
 */
export function step(state: FlappyState, input: StepInput, rng: Rng): FlappyState {
  if (state.over) return state
  const { dt, flap } = input

  // Velocity: a flap sets an upward impulse, then gravity always pulls down.
  let vy = flap ? -FLAP_IMPULSE : state.vy
  vy += GRAVITY * dt
  if (vy > MAX_FALL) vy = MAX_FALL

  const y = state.y + vy * dt

  // Scroll existing pipes left and drop any fully off-screen to the left.
  let pipes = state.pipes
    .map((p) => ({ ...p, x: p.x - PIPE_SPEED * dt }))
    .filter((p) => p.x + PIPE_W > 0)

  // Spawn a new pipe once the field has room on the right.
  const rightmost = pipes.length ? pipes[pipes.length - 1].x : -Infinity
  if (pipes.length === 0) {
    pipes = [...pipes, spawnPipe(FIELD_W, rng)]
  } else if (rightmost <= FIELD_W - PIPE_SPACING) {
    pipes = [...pipes, spawnPipe(rightmost + PIPE_SPACING, rng)]
  }

  // Score: any not-yet-scored pipe whose right edge has passed the bird.
  let score = state.score
  let scored = false
  pipes = pipes.map((p) => {
    if (!p.scored && p.x + PIPE_W < BIRD_X) {
      score += 1
      scored = true
      return { ...p, scored: true }
    }
    return p
  })

  // Collisions: ground, ceiling, or any pipe column.
  const hitGround = y + BIRD_R >= FIELD_H
  const hitCeiling = y - BIRD_R <= 0
  const hitColumn = pipes.some((p) => hitsPipe(y, p))
  const over = hitGround || hitCeiling || hitColumn

  return {
    y,
    vy,
    pipes,
    score,
    over,
    events: { scored, crashed: over },
  }
}
