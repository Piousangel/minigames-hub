/**
 * 뿅 착지(Plop Landing) — 순수 엔진.
 *
 * 말랑이를 꾹 눌러 당겼다 놓으면 포물선으로 튀어 다음 섬에 내려앉는다. 설계: docs/team/specs/2026-11-17-plop-landing-brief.md (v2).
 *
 * 결정성: 시계·Math.random 금지. 모든 난수는 mulberry32(시드, 섬 번호). 시간은 호출자가 ms로 넘긴다(입력은 event.timeStamp 기준).
 * 해석식: 섬 높이가 모두 같아서 착지 x는 `x0 + p·Rmax(wind)` 한 줄이다(사거리가 힘에 선형 → v = vmax·√p).
 */

// ── 물리 ──
export const THETA = (55 * Math.PI) / 180
export const G = 655 // px/s²
export const VMAX = 479 // px/s
export const SIN = Math.sin(THETA)
export const COS = Math.cos(THETA)
/** 무풍 최대 사거리 = vmax²·sin(2θ)/g ≈ 329px */
export const RMAX = (VMAX * VMAX * Math.sin(2 * THETA)) / G
/** 바람 가속도 wind(g의 배수 k)가 사거리에 더하는 계수: R = p·(RMAX + WIND_K·k) */
export const WIND_K = (2 * VMAX * VMAX * SIN * SIN) / G
export const PING_MS = 1300 // 핑퐁 한 방향
export const MIN_P = 0.08 // 이보다 약하게 놓으면 점프 안 함

// ── 섬·규칙 ──
export const SAFE_ISLANDS = 3 // 1~3번 섬은 크고 안전(가라앉지 않음, 바람 없음)
export const HALFW_START = 110
export const HALFW_MIN = 32 // 19번째 섬의 반폭(1차 하한)
export const HALFW_FLOOR = 20 // 후반 램프의 최종 하한(40번째 섬)
export const HALFW_FLOOR_INDEX = 40
export const HALFW_SHRINK_END = 15 // 이 번호의 섬에서 1차 하한(오너 지적: 너무 쉽다 → 19에서 앞당김)
export const MIN_GAP = 40
export const WIND_FROM = 4 // 4(=다섯 번째 섬)부터 바람
export const WIND_FIRST = 0.06
export const WIND_MAX = 0.15 // 초중반 바람 상한
export const WIND_MAX_LATE = 0.21 // 후반(30번째 섬 이후) 바람 상한
// 후반 램프(오너 지적: 너무 쉽다 — 19번째 섬 이후 난이도가 평평했다)
export const PING_FAST = 700 // 30번째 섬 이후 게이지 한 방향 시간(ms), 기본 1300에서 점차 빨라진다
export const PING_RAMP_FROM = 6
export const PING_RAMP_TO = 30
export const PREVIEW_FRAC_START = 0.4
export const PREVIEW_FRAC_END = 0.18 // 점선 미리보기가 점차 짧아져 게이지 감각이 필요해진다
export const PREVIEW_RAMP_FROM = 8
export const PREVIEW_RAMP_TO = 24
export const SINK_LATE_END_MS = 1800 // 36번째 섬에서의 가라앉는 시간
export const SINK_LATE_INDEX = 36
export const SINK_FROM = 4
export const SINK_START_MS = 4600
export const SINK_END_MS = 2700
export const SINK_END_INDEX = 15
export const PERFECT_BONUS_MS = 500
export const PERFECT_FRAC = 0.3 // |dx| ≤ 0.30·halfW
export const EDGE_SLACK = 6 // Good 여유 px
export const D_MAX_FRAC = 0.85 // 중심거리 상한 = 0.85·Rmax(wind)
export const D_CAP = 300 // 카메라에 다음 섬 중심이 항상 들어오도록 하는 절대 상한(순풍에서 0.85·Rmax가 312px를 넘던 문제)
export const D_MIN_FRAC = 0.45
export const INPUT_LOCK_MS = 150 // 죽은 뒤 입력 무시
export const CANCEL_DRAG_PX = 48

export type Phase = 'ready' | 'charging' | 'flying' | 'over'
export type EndReason = 'short' | 'long' | 'sunk' | null
export type LandKind = 'perfect' | 'good' | 'self' | 'miss'
export type PlopEvent = 'charge' | 'cancel' | 'launch' | 'perfect' | 'good' | 'miss' | 'sunk' | 'warn'

export function mulberry32(a: number): () => number {
  let t = a >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** 날짜(YYYYMMDD, KST) → 시드 */
export function dailySeedFor(yyyymmdd: number): number {
  return (Math.imul(yyyymmdd, 2654435761) ^ 0x70f1a4) >>> 0
}

/** 시드 → 시간대 틴트(0 노을, 1 새벽, 2 밤) */
export function tintOf(seed: number): 0 | 1 | 2 {
  return (Math.imul(seed >>> 0, 0x9e3779b1) >>> 28) % 3 as 0 | 1 | 2
}

export interface Island {
  /** 섬 번호(0=시작) */
  i: number
  cx: number
  halfW: number
  /** 이 섬으로 오는 점프에 작용하는 바람(g의 배수, +는 순풍) */
  wind: number
  /** 착지 후 충전을 시작해야 하는 시간(ms), 0이면 가라앉지 않음 */
  graceMs: number
}

const lerp01 = (i: number, from: number, to: number) => Math.min(1, Math.max(0, (i - from) / (to - from)))
/** i번째 섬으로 가는 점프의 게이지 한 방향 시간(ms). 8번째 섬부터 30번째까지 1300→900으로 빨라진다. */
export function pingOf(i: number): number {
  return PING_MS + (PING_FAST - PING_MS) * lerp01(i, PING_RAMP_FROM, PING_RAMP_TO)
}
/** 점선 미리보기가 보여 주는 궤적 비율(0.4 → 0.18) */
export function previewFracOf(i: number): number {
  return PREVIEW_FRAC_START + (PREVIEW_FRAC_END - PREVIEW_FRAC_START) * lerp01(i, PREVIEW_RAMP_FROM, PREVIEW_RAMP_TO)
}
/** i번째 섬의 바람 상한(0.15g → 후반 0.21g) */
export function windMaxOf(i: number): number {
  return WIND_MAX + (WIND_MAX_LATE - WIND_MAX) * lerp01(i, 8, 26)
}

/** 바람 k(g의 배수)에서의 최대 사거리 */
export function rangeMax(wind: number): number {
  return RMAX + WIND_K * wind
}

/** 힘 p, 바람 k에서의 사거리(px). 사거리는 p에 선형. */
export function rangeAt(p: number, wind: number): number {
  return p * rangeMax(wind)
}

export function halfWOf(i: number): number {
  if (i <= SAFE_ISLANDS) return HALFW_START
  if (i >= HALFW_FLOOR_INDEX) return HALFW_FLOOR
  if (i >= HALFW_SHRINK_END) return HALFW_MIN + ((HALFW_FLOOR - HALFW_MIN) * (i - HALFW_SHRINK_END)) / (HALFW_FLOOR_INDEX - HALFW_SHRINK_END)
  const t = (i - SAFE_ISLANDS) / (HALFW_SHRINK_END - SAFE_ISLANDS)
  return HALFW_START + (HALFW_MIN - HALFW_START) * t
}

export function graceOf(i: number): number {
  if (i < SINK_FROM) return 0
  if (i >= SINK_LATE_INDEX) return SINK_LATE_END_MS
  if (i >= SINK_END_INDEX) return SINK_END_MS + ((SINK_LATE_END_MS - SINK_END_MS) * (i - SINK_END_INDEX)) / (SINK_LATE_INDEX - SINK_END_INDEX)
  const t = (i - SINK_FROM) / (SINK_END_INDEX - SINK_FROM)
  return SINK_START_MS + (SINK_END_MS - SINK_START_MS) * t
}

/** 섬 i를 직전 섬 prev에서 만든다. 시드와 번호만으로 결정. 중심거리는 [d_min, 0.85·Rmax(wind)]를 항상 만족한다. */
export function nextIsland(seed: number, i: number, prev: Island): Island {
  const rnd = mulberry32((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0)
  const halfW = halfWOf(i)
  const dMinEdge = prev.halfW + halfW + MIN_GAP
  let wind = 0
  if (i >= WIND_FROM) {
    const sign = rnd() < 0.5 ? -1 : 1
    wind = i === WIND_FROM ? sign * WIND_FIRST : sign * windMaxOf(i) * (0.3 + 0.7 * rnd())
    // 맞바람이라 최소 거리를 못 채우면 순풍으로 뒤집는다(생성기 제약)
    if (dMinEdge > Math.min(D_CAP, D_MAX_FRAC * rangeMax(wind))) wind = Math.abs(wind)
  } else {
    rnd() // 호출 횟수를 맞춘다
  }
  const dMax = Math.min(D_CAP, D_MAX_FRAC * rangeMax(wind))
  const dMin = Math.max(dMinEdge, D_MIN_FRAC * rangeMax(wind))
  const early = i <= SAFE_ISLANDS
  const d = early ? Math.min(dMax, dMinEdge + rnd() * 15) : dMin + rnd() * (dMax - dMin)
  if (early) rnd()
  return { i, cx: prev.cx + d, halfW, wind, graceMs: graceOf(i) }
}

export function startIsland(): Island {
  return { i: 0, cx: 0, halfW: HALFW_START, wind: 0, graceMs: 0 }
}

export interface Flight {
  fromX: number
  p: number
  wind: number
  /** 비행 총 시간(ms) */
  durMs: number
  /** 경과(ms) */
  tMs: number
  landX: number
  kind: LandKind
  /** 착지한 섬 번호(self/miss면 현재 섬) */
  toIsland: number
  /** 다음 섬 중심 기준 착지 오차(px, 음수=짧음) — 사망 고스트용 */
  dx: number
  cause: EndReason
}

export interface PlopState {
  seed: number
  phase: Phase
  endReason: EndReason
  /** 현재 서 있는 섬 번호 */
  cur: number
  islands: Island[]
  score: number
  landed: number
  perfects: number
  streak: number
  /** 충전 시작 시각(ms) */
  chargeStartMs: number
  /** 충전 중 눌린 y 기준점(취소 판정용은 UI가 처리) */
  sinkLeftMs: number
  flight: Flight | null
  /** 죽은 시각, 입력 잠금용 */
  overAtMs: number
  /** 마지막 틱에서 발생한 이벤트(소리·FX용) */
  events: PlopEvent[]
  /** 경과 시계(ms, tick 누적) */
  clock: number
  /** 입력 로그: 점프마다 홀드 ms */
  holds: number[]
}

export function newGame(seed: number): PlopState {
  const s0 = startIsland()
  return {
    seed,
    phase: 'ready',
    endReason: null,
    cur: 0,
    islands: [s0],
    score: 0,
    landed: 0,
    perfects: 0,
    streak: 0,
    chargeStartMs: 0,
    sinkLeftMs: 0,
    flight: null,
    overAtMs: -1,
    events: [],
    clock: 0,
    holds: [],
  }
}

export function ensureIslands(st: PlopState, upto: number): void {
  while (st.islands.length <= upto) {
    st.islands.push(nextIsland(st.seed, st.islands.length, st.islands[st.islands.length - 1]))
  }
}

/** 핑퐁 힘: 홀드 시간(ms) → p∈[0,1] (0→1→0 …) */
export function powerAt(holdMs: number, pingMs: number = PING_MS): number {
  const ph = (Math.max(0, holdMs) / pingMs) % 2
  return ph <= 1 ? ph : 2 - ph
}

/** 비행 총 시간(ms) */
export function flightDuration(p: number): number {
  const v = VMAX * Math.sqrt(p)
  return ((2 * v * SIN) / G) * 1000
}

/** 비행 중 위치(상대 좌표: x는 fromX 기준 절대, y는 위가 +, px) */
export function flightPos(fromX: number, p: number, wind: number, tMs: number): { x: number; y: number } {
  const t = tMs / 1000
  const v = VMAX * Math.sqrt(p)
  const w = wind * G
  return { x: fromX + v * COS * t + 0.5 * w * t * t, y: Math.max(0, v * SIN * t - 0.5 * G * t * t) }
}

/** 점선 미리보기: 궤적의 앞 frac(0~1) 구간 점들 */
export function previewPoints(fromX: number, p: number, wind: number, frac = 0.4, n = 12): { x: number; y: number }[] {
  const dur = flightDuration(p)
  const out: { x: number; y: number }[] = []
  for (let k = 0; k <= n; k++) out.push(flightPos(fromX, p, wind, (dur * frac * k) / n))
  return out
}

/** 충전 시작. 'ready'이고 입력 잠금이 풀렸을 때만. */
export function press(st: PlopState, nowMs: number): boolean {
  if (st.phase !== 'ready') return false
  st.phase = 'charging'
  st.chargeStartMs = nowMs
  st.events.push('charge')
  return true
}

export function cancelCharge(st: PlopState): void {
  if (st.phase !== 'charging') return
  st.phase = 'ready'
  st.events.push('cancel')
}

/** 놓기. 힘이 너무 약하면 점프하지 않는다. 반환: 점프했는가 */
export function release(st: PlopState, nowMs: number): boolean {
  if (st.phase !== 'charging') return false
  const hold = nowMs - st.chargeStartMs
  const p = powerAt(hold, pingOf(st.cur + 1))
  if (p < MIN_P) {
    st.phase = 'ready'
    st.events.push('cancel')
    return false
  }
  ensureIslands(st, st.cur + 4)
  const from = st.islands[st.cur]
  const target = st.islands[st.cur + 1]
  const wind = target.wind
  const landX = from.cx + rangeAt(p, wind)
  st.holds.push(Math.round(hold))

  // 착지 판정: 현재 섬 이후 섬들 중 범위에 드는 첫 섬
  let kind: LandKind = 'miss'
  let toIsland = st.cur
  let dxNearest = landX - target.cx
  if (Math.abs(landX - from.cx) <= from.halfW + EDGE_SLACK) {
    kind = 'self'
  } else {
    for (let j = st.cur + 1; j <= st.cur + 4; j++) {
      const isl = st.islands[j]
      const d = landX - isl.cx
      if (Math.abs(d) <= isl.halfW + EDGE_SLACK) {
        kind = Math.abs(d) <= PERFECT_FRAC * isl.halfW ? 'perfect' : 'good'
        toIsland = j
        dxNearest = d
        break
      }
    }
  }
  // 원인은 방향만 구분한다(짧음/김). 바람이 변수인지는 시뮬이 섬별 사망률로 따로 본다.
  let cause: EndReason = null
  if (kind === 'miss') cause = landX < target.cx - target.halfW - EDGE_SLACK ? 'short' : 'long'
  st.flight = { fromX: from.cx, p, wind, durMs: flightDuration(p), tMs: 0, landX, kind, toIsland, dx: dxNearest, cause }
  st.phase = 'flying'
  st.events.push('launch')
  return true
}

function mult(streak: number): number {
  return Math.min(3, 1 + 0.25 * Math.max(0, streak - 1))
}

function finishFlight(st: PlopState, f: Flight): void {
  st.flight = f
  if (f.kind === 'miss') {
    st.phase = 'over'
    st.endReason = f.cause
    st.overAtMs = st.clock
    st.events.push('miss')
    return
  }
  if (f.kind === 'self') {
    st.phase = 'ready'
    return
  }
  const isl = st.islands[f.toIsland]
  st.cur = f.toIsland
  st.landed += 1
  if (f.kind === 'perfect') {
    st.streak += 1
    st.perfects += 1
    st.score += Math.round(2 * mult(st.streak))
    st.events.push('perfect')
  } else {
    st.streak = Math.max(0, st.streak - 1)
    st.score += 1
    st.events.push('good')
  }
  st.sinkLeftMs = isl.graceMs > 0 ? isl.graceMs + (f.kind === 'perfect' ? PERFECT_BONUS_MS : 0) : 0
  st.phase = 'ready'
  ensureIslands(st, st.cur + 4)
}

/** 시간을 dtMs만큼 진행: 비행 경과, 가라앉는 섬 타이머. 충전 중에는 타이머 정지. */
export function tick(st: PlopState, dtMs: number): void {
  st.clock += dtMs
  if (st.phase === 'flying' && st.flight) {
    st.flight.tMs += dtMs
    if (st.flight.tMs >= st.flight.durMs) {
      st.flight.tMs = st.flight.durMs
      finishFlight(st, st.flight)
    }
    return
  }
  if (st.phase === 'ready' && st.sinkLeftMs > 0) {
    const before = st.sinkLeftMs
    st.sinkLeftMs = Math.max(0, st.sinkLeftMs - dtMs)
    if (before > 1000 && st.sinkLeftMs <= 1000) st.events.push('warn')
    if (st.sinkLeftMs === 0) {
      st.phase = 'over'
      st.endReason = 'sunk'
      st.overAtMs = st.clock
      st.events.push('sunk')
    }
  }
}

/** UI가 이벤트를 소비한 뒤 호출 */
export function drainEvents(st: PlopState): PlopEvent[] {
  const e = st.events
  st.events = []
  return e
}

export function inputLocked(st: PlopState): boolean {
  return st.phase === 'over' && st.clock - st.overAtMs < INPUT_LOCK_MS
}
