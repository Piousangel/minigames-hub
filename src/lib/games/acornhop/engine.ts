/**
 * Acorn Hop — pure engine.
 *
 * A squirrel astronaut climbs a night sky with a pouch of acorns. Tapping the left/right half of the
 * screen fires an acorn down-and-away, and the recoil kicks the squirrel up and toward the tapped side.
 * Gravity pulls constantly; the run ends when it falls off the bottom or touches a hazard.
 *
 * Deterministic: floats but only +, -, *, / on fixed constants; no Math.random / Date. All randomness
 * comes from `mulberry32` seeded per 90px band, so the same seed gives the same sky for everyone.
 */

export const W = 320
export const VIEW_H = 480
export const BAND = 90
export const R = 13 // 토리 충돌 반경
export const G = 0.16
export const TAP_VY = -5.0
export const TAP_VX = 2.2
export const DRAG = 0.985
export const VX_MAX = 3.4
export const VY_MAX = 6.5
export const AMMO_START = 6
export const AMMO_MAX = 8
export const ACORN_REFILL = 3
export const TAP_COOLDOWN = 7
export const REST_EVERY = 8 // 8번째 밴드마다 쉼터 섬
export const ISLAND_W = 120
export const STAR_PTS = 15
export const TICK_HZ = 60

export type Phase = 'ready' | 'flying' | 'over'
export type EndReason = 'fell' | 'brambled' | 'stormed' | null
export type Side = -1 | 1
export type HopEvent = 'tap' | 'dry' | 'star' | 'acorn' | 'land' | 'bounce' | 'hit' | 'fall'

export type ObjKind = 'star' | 'acorn' | 'bramble' | 'storm' | 'island'
export interface WorldObj {
  id: string
  kind: ObjKind
  x: number
  y: number
  /** storm: 좌우로 흐르는 진폭(px)과 위상 */
  amp?: number
  phase?: number
}

export interface HopState {
  seed: number
  phase: Phase
  endReason: EndReason
  tick: number
  x: number
  y: number
  vx: number
  vy: number
  /** 섬 위에 서 있나 */
  grounded: boolean
  facing: Side
  ammo: number
  /** 지금까지 올라간 가장 높은 y(작을수록 높음) */
  minY: number
  stars: number
  acorns: number
  lastTapTick: number
  taken: string[]
  events: HopEvent[]
  score: number
}

export function mulberry32(a: number): () => number {
  let t = a >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function dailySeedFor(yyyymmdd: number): number {
  return (Math.imul(yyyymmdd, 2654435761) ^ 0xac0221) >>> 0
}

const START_ISLAND: WorldObj = { id: 'i0', kind: 'island', x: W / 2, y: 40 }

/** 밴드 b(1부터, 위로 갈수록 큼)의 오브젝트. 시드와 밴드 번호만으로 결정된다. */
export function bandObjects(seed: number, b: number): WorldObj[] {
  if (b <= 0) return b === 0 ? [START_ISLAND] : []
  const rnd = mulberry32((seed ^ Math.imul(b, 0x9e3779b1)) >>> 0)
  const top = -(b + 1) * BAND
  const objs: WorldObj[] = []
  const place = (kind: ObjKind, margin: number, tries = 8): WorldObj | null => {
    for (let i = 0; i < tries; i++) {
      const x = margin + rnd() * (W - margin * 2)
      const y = top + 14 + rnd() * (BAND - 28)
      if (objs.every((o) => Math.hypot(o.x - x, o.y - y) > 46)) {
        const o: WorldObj = { id: `${kind[0]}${b}.${objs.length}`, kind, x, y }
        objs.push(o)
        return o
      }
    }
    return null
  }
  if (b % REST_EVERY === 0) {
    objs.push({ id: `i${b}`, kind: 'island', x: 70 + rnd() * (W - 140), y: top + BAND / 2 })
    return objs
  }
  const hazardP = Math.min(0.75, 0.1 + b * 0.035)
  if (b >= 3 && rnd() < hazardP) place('bramble', 28)
  if (b >= 6 && rnd() < hazardP * 0.6) {
    const s = place('storm', 50)
    if (s) {
      s.amp = 24 + rnd() * 26
      s.phase = rnd() * Math.PI * 2
    }
  }
  if (b % 3 === 0 || rnd() < 0.35) place('acorn', 26)
  if (rnd() < 0.6) place('star', 24)
  return objs
}

export function objectsInRange(seed: number, yTop: number, yBottom: number): WorldObj[] {
  const bLo = Math.max(0, Math.floor(-yBottom / BAND) - 1)
  const bHi = Math.max(0, Math.ceil(-yTop / BAND) + 1)
  const out: WorldObj[] = []
  for (let b = bLo; b <= bHi; b++) out.push(...bandObjects(seed, b))
  return out
}

/** 구름 위치는 시간에 따라 좌우로 흐른다. */
export function objX(o: WorldObj, tick: number): number {
  if (o.kind !== 'storm') return o.x
  return o.x + Math.sin(tick / 55 + (o.phase ?? 0)) * (o.amp ?? 0)
}

export function createGame(seed: number): HopState {
  return {
    seed: seed >>> 0,
    phase: 'ready',
    endReason: null,
    tick: 0,
    x: W / 2,
    y: START_ISLAND.y - R,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 1,
    ammo: AMMO_START,
    minY: START_ISLAND.y - R,
    stars: 0,
    acorns: 0,
    lastTapTick: -999,
    taken: [],
    events: [],
    score: 0,
  }
}

export function heightM(minY: number): number {
  return Math.max(0, Math.floor((START_ISLAND.y - R - minY) / 10))
}

export function scoreOf(s: Pick<HopState, 'minY' | 'stars'>): number {
  return heightM(s.minY) + s.stars * STAR_PTS
}

/** 카메라 위쪽 y. 한 번 올라간 만큼만 따라가고 내려오지 않는다. */
export function cameraTop(s: Pick<HopState, 'minY'>): number {
  return Math.min(0, s.minY - VIEW_H * 0.58)
}

export function isOver(s: HopState): boolean {
  return s.phase === 'over'
}

export interface HopInput {
  /** -1: 왼쪽 절반 탭(왼쪽으로 튀어 오름), 1: 오른쪽 */
  tap: Side
}

export function step(state: HopState, input: HopInput | null): HopState {
  if (state.phase === 'over') return state
  const events: HopEvent[] = []
  let { x, y, vx, vy, ammo, grounded, facing, minY, stars, acorns, lastTapTick, phase } = state
  const taken = state.taken.slice()
  const tick = state.tick + 1

  if (input && tick - lastTapTick >= TAP_COOLDOWN) {
    if (ammo > 0) {
      ammo -= 1
      vy = TAP_VY
      vx = Math.max(-VX_MAX, Math.min(VX_MAX, vx * 0.4 + input.tap * TAP_VX))
      facing = input.tap
      grounded = false
      phase = 'flying'
      lastTapTick = tick
      events.push('tap')
    } else {
      events.push('dry')
      lastTapTick = tick
    }
  }

  if (phase === 'ready') {
    return { ...state, tick, ammo, vx, vy, grounded, facing, lastTapTick, phase, events }
  }

  const prevBottom = y + R
  if (!grounded) {
    vy = Math.min(VY_MAX, vy + G)
    vx *= DRAG
    x += vx
    y += vy
  } else {
    vx *= 0.8
    x += vx
  }
  if (x < R) {
    x = R
    vx = Math.abs(vx) * 0.7
    events.push('bounce')
  } else if (x > W - R) {
    x = W - R
    vx = -Math.abs(vx) * 0.7
    events.push('bounce')
  }
  if (y < minY) minY = y

  let endReason: EndReason = null
  const near = objectsInRange(state.seed, y - 60, y + 60)
  for (const o of near) {
    if (taken.includes(o.id)) continue
    const ox = objX(o, tick)
    const d = Math.hypot(ox - x, o.y - y)
    if (o.kind === 'star' && d < R + 14) {
      taken.push(o.id)
      stars += 1
      events.push('star')
    } else if (o.kind === 'acorn' && d < R + 13) {
      taken.push(o.id)
      acorns += 1
      ammo = Math.min(AMMO_MAX, ammo + ACORN_REFILL)
      events.push('acorn')
    } else if (o.kind === 'bramble' && d < R + 16) {
      endReason = 'brambled'
      events.push('hit')
    } else if (o.kind === 'storm' && d < R + 18) {
      endReason = 'stormed'
      events.push('hit')
    } else if (o.kind === 'island' && vy >= 0 && !grounded) {
      const top = o.y
      const half = ISLAND_W / 2 + 4
      if (prevBottom <= top + 2 && y + R >= top && Math.abs(x - o.x) < half) {
        y = top - R
        vy = 0
        grounded = true
        ammo = Math.max(ammo, AMMO_START)
        events.push('land')
      }
    }
  }
  // 서 있던 섬에서 벗어나면 다시 떨어진다
  if (grounded) {
    const under = near.find((o) => o.kind === 'island' && Math.abs(o.y - (y + R)) < 1 && Math.abs(x - o.x) < ISLAND_W / 2 + 4)
    if (!under) grounded = false
  }

  const next: HopState = {
    ...state,
    tick,
    x,
    y,
    vx,
    vy,
    grounded,
    facing,
    ammo,
    minY,
    stars,
    acorns,
    lastTapTick,
    taken,
    phase,
    events,
    endReason: null,
    score: 0,
  }
  next.score = scoreOf(next)
  if (endReason) return { ...next, phase: 'over', endReason }
  if (y - R > cameraTop(next) + VIEW_H + 10) {
    events.push('fall')
    return { ...next, phase: 'over', endReason: 'fell', events }
  }
  return next
}

/** 점선 미리보기: 지금 탭하면 N틱 동안 어디로 가는지(위험물·쉼터는 무시한 순수 궤적). */
export function previewPath(s: HopState, side: Side, ticks = 30): Array<{ x: number; y: number }> {
  if (s.ammo <= 0) return []
  let x = s.x
  let y = s.y
  let vx = Math.max(-VX_MAX, Math.min(VX_MAX, s.vx * 0.4 + side * TAP_VX))
  let vy = TAP_VY
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < ticks; i++) {
    vy = Math.min(VY_MAX, vy + G)
    vx *= DRAG
    x += vx
    y += vy
    if (x < R) { x = R; vx = Math.abs(vx) * 0.7 }
    else if (x > W - R) { x = W - R; vx = -Math.abs(vx) * 0.7 }
    if (i % 3 === 2) pts.push({ x, y })
  }
  return pts
}
