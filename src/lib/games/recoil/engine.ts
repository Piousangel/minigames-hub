/**
 * Recoil — pure engine.
 *
 * A frictionless zero-g box. Every shot fires a round along the aim direction
 * and pushes the ship the opposite way by exactly 1 unit/tick. Shooting is the
 * only way to move, and 12 rounds must collect all 5 stars.
 *
 * Fixed-point integer physics (FP = 256): no floats, no trig, no `Math.random`,
 * no `Date`. Randomness enters only through an injected `Rng`, consumed solely
 * in `generateLayout`. `step`, `setAim` and `predictPath` are rng-free, so every
 * trajectory / scoring outcome is golden-testable from a fixed input script.
 */

export const FP = 256
export const ARENA_W = 320
export const ARENA_H = 224
export const SHIP_R = 5
export const SPAWN_X = 160
export const SPAWN_Y = 112
export const VMAX = 1024
export const PICK_R = 12
export const WALL_T = 8
export const WALL_GAP = 24
export const SPAWN_CLEAR = 40
export const STAR_SPAWN_MIN = 56
export const STAR_WALL_CLEAR = 18
export const STAR_MIN_SEP = 44
export const WALL_TRIES = 40
export const STAR_TRIES = 80
export const MAX_GEN_ATTEMPTS = 30
export const DRIFT_LIMIT = 480
export const TICK_HZ = 60
export const STAR_PTS = 100
export const BANK_PTS = 50
export const WIN_BONUS = 500
export const AMMO_PTS = 150
export const TIME_PAR = 3600
export const TIME_DIV = 6
export const PREVIEW_TICKS = 45

/** 16-point compass unit vectors ×256. d·22.5°; 0 right, 4 down, 8 left, 12 up. */
export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [256, 0], [237, 98], [181, 181], [98, 237], [0, 256], [-98, 237], [-181, 181], [-237, 98],
  [-256, 0], [-237, -98], [-181, -181], [-98, -237], [0, -256], [98, -237], [181, -181], [237, -98],
]

export interface RecoilConfig {
  walls: number
  stars: number
  ammo: number
  parShots: number
}

export const DIFFICULTIES = {
  easy: { walls: 1, stars: 5, ammo: 14, parShots: 7 },
  normal: { walls: 3, stars: 5, ammo: 12, parShots: 6 },
  hard: { walls: 5, stars: 5, ammo: 10, parShots: 6 },
} satisfies Record<'easy' | 'normal' | 'hard', RecoilConfig>

export const DAILY_CONFIG: RecoilConfig = DIFFICULTIES.normal

export type Difficulty = keyof typeof DIFFICULTIES

/**
 * Seed ⇒ difficulty. The low 2 bits of every run seed name its difficulty
 * (0 easy, 1 normal, 2 hard, 3 normal), so a bare seed — e.g. one carried in a
 * 1:1 challenge link — reproduces the exact board *and* rule set. Practice seeds
 * are stamped with `seedWithDifficulty`; daily seeds are always normal.
 */
const DIFF_BY_CODE: readonly Difficulty[] = ['easy', 'normal', 'hard', 'normal']
const CODE_BY_DIFF: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2 }

export function difficultyOfSeed(seed: number): Difficulty {
  return DIFF_BY_CODE[(seed >>> 0) & 3]
}

export function seedWithDifficulty(seed: number, d: Difficulty): number {
  return ((seed & ~3) | CODE_BY_DIFF[d]) >>> 0
}

/** Daily seed from a UTC YYYYMMDD number (normal difficulty). Pure: caller supplies the date. */
export function dailySeedFor(yyyymmdd: number): number {
  return seedWithDifficulty((yyyymmdd * 4) >>> 0, 'normal')
}

/** Build a run from a seed alone — difficulty is decoded from the seed. */
export function createGameForSeed(seed: number): RecoilState {
  return createGame(DIFFICULTIES[difficultyOfSeed(seed)], seed >>> 0)
}

export type Rng = () => number // [0,1)
export type Dir = number // 0..15
export type Phase = 'ready' | 'flying' | 'won' | 'lost'
export type EndReason = 'stalled' | 'drift' | null
export type RecoilEvent = 'aim' | 'fire' | 'dry' | 'bounce' | 'star' | 'bank' | 'win' | 'lose'

export interface Wall {
  x: number
  y: number
  w: number
  h: number
} // fp, top-left AABB

export interface Star {
  id: number
  x: number
  y: number
  taken: boolean
  takenAt: number | null
} // fp

export interface Layout {
  walls: Wall[]
  stars: Star[]
}

export interface RecoilState {
  config: RecoilConfig
  seed: number
  walls: Wall[]
  stars: Star[]
  x: number
  y: number
  vx: number
  vy: number
  aim: Dir
  ammo: number
  shotsFired: number
  phase: Phase
  endReason: EndReason
  ticks: number
  driftTicks: number
  bounces: number
  bouncesSinceFire: number
  collected: number
  bankShots: number
  score: number
  events: RecoilEvent[]
  lastShot: { dir: Dir; tick: number } | null
}

export type RecoilInput = { fire: Dir }

export interface Body {
  x: number
  y: number
  vx: number
  vy: number
}

/** Identical impl to decant's mulberry32. */
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

export function rotateDir(d: Dir, delta: number): Dir {
  return (((d + delta) % 16) + 16) % 16
}

/** Quantise a vector to the nearest of the 16 directions (max dot, ties → lower index). */
export function dirFromVector(dx: number, dy: number): Dir | null {
  if (dx === 0 && dy === 0) return null
  let best = 0
  let bestDot = -Infinity
  for (let i = 0; i < 16; i++) {
    const dot = dx * DIRS[i][0] + dy * DIRS[i][1]
    if (dot > bestDot) {
      bestDot = dot
      best = i
    }
  }
  return best
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Recoil: the ship is pushed opposite to the aim. */
export function applyImpulse(vx: number, vy: number, d: Dir): { vx: number; vy: number } {
  return {
    vx: clamp(vx - DIRS[d][0], -VMAX, VMAX),
    vy: clamp(vy - DIRS[d][1], -VMAX, VMAX),
  }
}

/** One-tick integration with perfectly elastic axis-separated reflection. */
export function advance(body: Body, walls: Wall[]): Body & { bounced: boolean } {
  const R = SHIP_R * FP
  const minX = R
  const maxX = ARENA_W * FP - R
  const minY = R
  const maxY = ARENA_H * FP - R
  let { vx, vy } = body
  const { y } = body
  let bounced = false

  // X axis
  let nx = body.x + vx
  if (nx < minX) {
    nx = 2 * minX - nx
    vx = -vx
    bounced = true
  } else if (nx > maxX) {
    nx = 2 * maxX - nx
    vx = -vx
    bounced = true
  }
  for (const w of walls) {
    if (nx - R < w.x + w.w && nx + R > w.x && y - R < w.y + w.h && y + R > w.y) {
      if (vx > 0) nx = 2 * (w.x - R) - nx
      else nx = 2 * (w.x + w.w + R) - nx
      vx = -vx
      bounced = true
      break
    }
  }

  // Y axis (with updated nx)
  let ny = y + vy
  if (ny < minY) {
    ny = 2 * minY - ny
    vy = -vy
    bounced = true
  } else if (ny > maxY) {
    ny = 2 * maxY - ny
    vy = -vy
    bounced = true
  }
  for (const w of walls) {
    if (nx - R < w.x + w.w && nx + R > w.x && ny - R < w.y + w.h && ny + R > w.y) {
      if (vy > 0) ny = 2 * (w.y - R) - ny
      else ny = 2 * (w.y + w.h + R) - ny
      vy = -vy
      bounced = true
      break
    }
  }

  return { x: nx, y: ny, vx, vy, bounced }
}

export function timeBonus(ticks: number): number {
  return Math.max(0, Math.floor((TIME_PAR - ticks) / TIME_DIV))
}

interface URect {
  x: number
  y: number
  w: number
  h: number
}

function strictOverlap(a: URect, b: URect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Place walls then stars (unit coords, ×FP on output). null if a star can't be placed. */
export function generateLayout(cfg: RecoilConfig, rng: Rng): Layout | null {
  const rand = (n: number) => Math.floor(rng() * n)
  const spawnRect: URect = {
    x: SPAWN_X - SPAWN_CLEAR,
    y: SPAWN_Y - SPAWN_CLEAR,
    w: SPAWN_CLEAR * 2,
    h: SPAWN_CLEAR * 2,
  }
  const walls: URect[] = []
  for (let i = 0; i < cfg.walls; i++) {
    for (let t = 0; t < WALL_TRIES; t++) {
      const orient = rng() < 0.5 ? 'h' : 'v'
      const len = 40 + rand(9) * 8
      const w = orient === 'h' ? len : WALL_T
      const h = orient === 'h' ? WALL_T : len
      const x = 16 + rand((ARENA_W - 32 - w) / 8 + 1) * 8
      const y = 16 + rand((ARENA_H - 32 - h) / 8 + 1) * 8
      const cand: URect = { x, y, w, h }
      if (strictOverlap(cand, spawnRect)) continue
      let ok = true
      for (const o of walls) {
        const grown: URect = { x: o.x - WALL_GAP, y: o.y - WALL_GAP, w: o.w + 2 * WALL_GAP, h: o.h + 2 * WALL_GAP }
        if (strictOverlap(cand, grown)) {
          ok = false
          break
        }
      }
      if (!ok) continue
      walls.push(cand)
      break
    }
  }

  const stars: { x: number; y: number }[] = []
  for (let s = 0; s < cfg.stars; s++) {
    let placed = false
    for (let t = 0; t < STAR_TRIES; t++) {
      const x = 20 + rand(ARENA_W - 40 + 1)
      const y = 20 + rand(ARENA_H - 40 + 1)
      const sdx = x - SPAWN_X
      const sdy = y - SPAWN_Y
      if (sdx * sdx + sdy * sdy < STAR_SPAWN_MIN * STAR_SPAWN_MIN) continue
      let ok = true
      for (const w of walls) {
        const ddx = Math.max(w.x - x, 0, x - (w.x + w.w))
        const ddy = Math.max(w.y - y, 0, y - (w.y + w.h))
        if (ddx * ddx + ddy * ddy < STAR_WALL_CLEAR * STAR_WALL_CLEAR) {
          ok = false
          break
        }
      }
      if (!ok) continue
      for (const o of stars) {
        const dx = x - o.x
        const dy = y - o.y
        if (dx * dx + dy * dy < STAR_MIN_SEP * STAR_MIN_SEP) {
          ok = false
          break
        }
      }
      if (!ok) continue
      stars.push({ x, y })
      placed = true
      break
    }
    if (!placed) return null
  }

  return {
    walls: walls.map((w) => ({ x: w.x * FP, y: w.y * FP, w: w.w * FP, h: w.h * FP })),
    stars: stars.map((s, id) => ({ id, x: s.x * FP, y: s.y * FP, taken: false, takenAt: null })),
  }
}

const FALLBACK_STARS: ReadonlyArray<readonly [number, number]> = [
  [60, 40], [260, 40], [60, 184], [260, 184], [160, 40],
]

export function fallbackLayout(cfg: RecoilConfig): Layout {
  return {
    walls: [],
    stars: FALLBACK_STARS.slice(0, cfg.stars).map(([x, y], id) => ({
      id,
      x: x * FP,
      y: y * FP,
      taken: false,
      takenAt: null,
    })),
  }
}

export function createGameFromLayout(cfg: RecoilConfig, layout: Layout, seed = 0): RecoilState {
  return {
    config: cfg,
    seed,
    walls: layout.walls.map((w) => ({ ...w })),
    stars: layout.stars.map((s) => ({ ...s })),
    x: SPAWN_X * FP,
    y: SPAWN_Y * FP,
    vx: 0,
    vy: 0,
    aim: 0,
    ammo: cfg.ammo,
    shotsFired: 0,
    phase: 'ready',
    endReason: null,
    ticks: 0,
    driftTicks: 0,
    bounces: 0,
    bouncesSinceFire: 0,
    collected: 0,
    bankShots: 0,
    score: 0,
    events: [],
    lastShot: null,
  }
}

export function createGame(cfg: RecoilConfig, seed: number): RecoilState {
  let layout: Layout | null = null
  for (let i = 0; i < MAX_GEN_ATTEMPTS && !layout; i++) {
    layout = generateLayout(cfg, mulberry32((seed + i) >>> 0))
  }
  return createGameFromLayout(cfg, layout ?? fallbackLayout(cfg), seed)
}

export function isOver(state: RecoilState): boolean {
  return state.phase === 'won' || state.phase === 'lost'
}

export function setAim(state: RecoilState, d: Dir): RecoilState {
  if (isOver(state)) return state
  if (d === state.aim) return state
  return { ...state, aim: d, events: ['aim'] }
}

export function step(state: RecoilState, input: RecoilInput | null): RecoilState {
  if (isOver(state)) return state
  if (state.phase === 'ready' && input === null) return state

  const events: RecoilEvent[] = []
  let { x, y, vx, vy, aim, ammo, shotsFired, phase, ticks, driftTicks, bounces, bouncesSinceFire } = state
  let { collected, bankShots, score, lastShot } = state
  let endReason: EndReason = state.endReason

  if (input) {
    aim = input.fire
    if (ammo > 0) {
      const v = applyImpulse(vx, vy, input.fire)
      vx = v.vx
      vy = v.vy
      ammo--
      shotsFired++
      bouncesSinceFire = 0
      lastShot = { dir: input.fire, tick: ticks + 1 }
      events.push('fire')
      if (phase === 'ready') phase = 'flying'
    } else {
      events.push('dry')
    }
  }

  if (phase === 'flying') {
    ticks++
    const b = advance({ x, y, vx, vy }, state.walls)
    x = b.x
    y = b.y
    vx = b.vx
    vy = b.vy
    if (b.bounced) {
      bounces++
      bouncesSinceFire++
      events.push('bounce')
    }
  }

  const pr = PICK_R * FP
  const pr2 = pr * pr
  let stars = state.stars
  for (let i = 0; i < stars.length; i++) {
    const st = stars[i]
    if (st.taken) continue
    const dx = st.x - x
    const dy = st.y - y
    if (dx * dx + dy * dy <= pr2) {
      if (stars === state.stars) stars = stars.slice()
      stars[i] = { ...st, taken: true, takenAt: ticks }
      collected++
      score += STAR_PTS
      events.push('star')
      if (bouncesSinceFire > 0) {
        bankShots++
        score += BANK_PTS
        events.push('bank')
      }
    }
  }

  const base = {
    ...state,
    stars,
    x,
    y,
    vx,
    vy,
    aim,
    ammo,
    shotsFired,
    ticks,
    bounces,
    bouncesSinceFire,
    collected,
    bankShots,
    lastShot,
  }

  if (collected === stars.length) {
    score += WIN_BONUS + AMMO_PTS * ammo + timeBonus(ticks)
    events.push('win')
    return { ...base, phase: 'won', endReason: null, driftTicks, score, events }
  }

  if (ammo === 0) driftTicks++

  if (ammo === 0 && ((vx === 0 && vy === 0) || driftTicks >= DRIFT_LIMIT)) {
    phase = 'lost'
    endReason = vx === 0 && vy === 0 ? 'stalled' : 'drift'
    events.push('lose')
  }

  return { ...base, phase, endReason, driftTicks, score, events }
}

/** Ghost trajectory: integrate `ticks` steps from the post-shot velocity. No stars, no win/lose. */
export function predictPath(state: RecoilState, d: Dir | null, ticks: number): Array<{ x: number; y: number }> {
  let body: Body = { x: state.x, y: state.y, vx: state.vx, vy: state.vy }
  if (d !== null && state.ammo > 0) {
    const v = applyImpulse(state.vx, state.vy, d)
    body = { ...body, vx: v.vx, vy: v.vy }
  }
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i < ticks; i++) {
    const b = advance(body, state.walls)
    body = { x: b.x, y: b.y, vx: b.vx, vy: b.vy }
    out.push({ x: b.x, y: b.y })
  }
  return out
}
