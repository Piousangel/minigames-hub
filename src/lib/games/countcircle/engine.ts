/**
 * Countcircle — pure engine.
 *
 * A Josephus-style survival: everyone sits in a circle, the count jumps K
 * seats every beat, and whoever it lands on is eliminated. You get a fixed
 * window of ticks to slide left/right into a different seat before the count
 * resolves. The target seat is telegraphed the instant the window opens —
 * nothing hidden, nothing is a reaction test (same philosophy as `fuse`).
 *
 * Determinism spine: randomness is drawn ONCE, up front, in `generateSchedule`
 * (the same MarketTape/fuse pattern). Each schedule entry stores a raw
 * `pick` in [0,1) that `armWindow` resolves against the CURRENT survivor
 * count via `resolveK` — occupancy-aware, but rng-free. `reduce()` never
 * calls the rng in any branch.
 *
 * No `Math.random`, no `Date`, no `performance.now` anywhere in this file.
 */

export type Rng = () => number // [0,1)

export type Phase = 'idle' | 'playing' | 'over'

/** rng는 이 픽을 뽑을 때만 소비된다. reduce()는 이 값을 해석만 한다. */
export interface KEntry {
  pick: number // [0,1) raw draw
}

export interface KSchedule {
  seed: number
  entries: KEntry[]
}

export interface CountcircleEvents {
  moved: boolean // 'move' 액션이 스왑을 성사시켰다
  illegal: boolean // 'move'가 거부됐다 (idle/over 상태에서 시도 등)
  resolved: boolean // 이번 tick에 소거가 확정됐다
  eliminatedSeat: number | null // 확정된 원래 좌석 id (resolved=false면 null)
  wasPlayer: boolean // 확정된 좌석이 플레이어 자신이었다 (=> over)
  clutch: boolean // resolved && !wasPlayer && 이 윈도우 시작 시점에 플레이어가 대상이었는데 탈출
  roundClear: boolean // resolved && 이 소거로 survivors.length가 1이 됨 (같은 tick에 다음 라운드 자동 시작)
  over: boolean // wasPlayer였다 (phase가 'over'로 전환)
}

export interface CountcircleState {
  phase: Phase
  schedule: KSchedule
  cursor: number // 다음에 소비할 schedule.entries 인덱스

  round: number // 1-based, 현재 플레이 중인 원(circle) 번호
  seats: number // 이번 라운드 시작 좌석 수 (survivors.length의 시작값, round 시작 시 survivors.length와 동일)
  survivors: number[] // 원래 좌석 id, 오름차순, 배열 인접 = 원형 인접
  playerIdx: number // survivors[] 안에서 플레이어가 앉아있는 인덱스

  count: number // 조세푸스 진행 포인터 (배열 인덱스 공간, 라운드 로컬)
  target: number // 현재 입력 윈도우의 소거 대상 배열 인덱스
  k: number // 현재 윈도우의 스텝값 (HUD 표시용)
  windowTicks: number // 남은 윈도우 틱
  windowTicksTotal: number // 윈도우 시작 시점 스냅샷 (진행률 바 %)
  dangerAtStart: boolean // 이 윈도우 시작 시 playerIdx === target 였는가 (클러치 판정용)

  eliminations: number // 이번 런 누적 소거 수 (윈도우 길이 램프의 입력)
  roundsCleared: number // 완주한 원(circle) 수. round === roundsCleared + 1 불변식.
  score: number // 리더보드 숫자. 높을수록 좋음. 절대 감소하지 않음.

  events: CountcircleEvents
}

export type CountcircleAction =
  | { type: 'start' }
  | { type: 'move'; dir: 'left' | 'right' }
  | { type: 'tick' }
  | { type: 'new'; seed: number }

// -- Constants ----------------------------------------------------------

export const START_SEATS = 8
export const SEATS_STEP = 3 // 라운드 클리어마다 좌석 +3
export const MAX_SEATS = 60 // 좌석 수 성장 상한 (안전장치)

export const TICK_MS = 90 // 컴포넌트 전용 상수. 엔진은 절대 시계를 읽지 않는다.
export const WINDOW_START = 16 // 첫 윈도우 길이 (틱)
export const WINDOW_MIN = 7 // 윈도우 길이 하한
export const WINDOW_RAMP_EVERY = 4 // 누적 소거 몇 회마다
export const WINDOW_RAMP_STEP = 1 // 윈도우를 몇 틱 줄이는가

export const SCORE_PER_ELIMINATION = 10
export const CLUTCH_BONUS = 15
export const ROUND_CLEAR_BONUS = 100

export const SCHEDULE_LEN = 6000 // 정상적인 런 어떤 길이에서도 넉넉함

// -- Rng ------------------------------------------------------------------

/** Identical impl to decant/fuse's mulberry32. */
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

/**
 * rng의 유일한 소비 지점. 정확히 count개 항목, 각 항목당 rng() 1회.
 * entries[i].pick은 [0,1). 순서가 결정론의 전부이므로 반드시 인덱스 오름차순으로만 소비한다.
 */
export function generateSchedule(seed: number, count = SCHEDULE_LEN): KSchedule {
  const rng = mulberry32(seed)
  const entries: KEntry[] = []
  for (let i = 0; i < count; i++) entries.push({ pick: rng() })
  return { seed, entries }
}

/**
 * pick(raw [0,1)) 를 현재 생존자 수 n(>=2)에 대해 해석해 K를 [1, n-1] 범위의
 * 정수로 돌려준다. n===2일 때는 항상 K=1로 수렴한다(퇴화 케이스, 의도된 동작).
 */
export function resolveK(pick: number, survivorsCount: number): number {
  const span = Math.max(1, survivorsCount - 1)
  const k = 1 + Math.floor(pick * span)
  return Math.min(span, Math.max(1, k))
}

/**
 * 누적 소거 수(eliminations)로부터 이번 윈도우 길이를 결정하는 순수 램프.
 * 단조 비증가: eliminations가 클수록 windowTicks는 작거나 같다.
 */
export function computeWindowTicks(eliminations: number): number {
  const drops = Math.floor(eliminations / WINDOW_RAMP_EVERY) * WINDOW_RAMP_STEP
  return Math.max(WINDOW_MIN, WINDOW_START - drops)
}

/**
 * roundIndex(1-based, "이번에 시작하는 라운드 번호")로부터 그 라운드의 시작 좌석 수.
 */
export function nextSeatCount(roundIndex: number): number {
  const seats = START_SEATS + SEATS_STEP * Math.max(0, roundIndex - 1)
  return Math.min(MAX_SEATS, seats)
}

/**
 * 좌석 수로부터 라운드 시작 시 플레이어의 배열 인덱스(=원래 좌석 id, 라운드 시작 직후엔 동일).
 */
export function startIdx(seats: number): number {
  return Math.floor(seats / 2)
}

function emptyEvents(): CountcircleEvents {
  return {
    moved: false,
    illegal: false,
    resolved: false,
    eliminatedSeat: null,
    wasPlayer: false,
    clutch: false,
    roundClear: false,
    over: false,
  }
}

/**
 * 새 입력 윈도우를 무장(arm)한다: 다음 schedule 엔트리를 소비해 K를 해석하고,
 * target = (count + k) % survivors.length를 계산하고, windowTicks를
 * computeWindowTicks(eliminations)로 스냅샷하고, dangerAtStart를 기록한다.
 * cursor가 schedule.entries.length에 도달하면 마지막 엔트리를 재사용한다(폴백).
 * 순수, rng 미호출.
 */
export function armWindow(
  survivors: number[],
  playerIdx: number,
  count: number,
  schedule: KSchedule,
  cursor: number,
  eliminations: number,
): {
  target: number
  k: number
  windowTicks: number
  windowTicksTotal: number
  dangerAtStart: boolean
  cursor: number
} {
  const entries = schedule.entries
  const idx = Math.min(cursor, Math.max(0, entries.length - 1))
  const entry = entries[idx] ?? { pick: 0 }
  const n = survivors.length
  const k = resolveK(entry.pick, n)
  const target = (count + k) % n
  const windowTicks = computeWindowTicks(eliminations)
  const dangerAtStart = target === playerIdx
  const nextCursor = cursor < entries.length ? cursor + 1 : cursor
  return { target, k, windowTicks, windowTicksTotal: windowTicks, dangerAtStart, cursor: nextCursor }
}

/** playing 상태이고 target === playerIdx일 때 true. 렌더링용 파생 헬퍼. */
export function isDanger(state: CountcircleState): boolean {
  return state.phase === 'playing' && state.target === state.playerIdx
}

/** createGame과 동일 결과를 내는 순수 생성기. 'new'/'start' 초기화가 공유한다. */
export function createGame(seed: number): CountcircleState {
  const schedule = generateSchedule(seed)
  const seats = START_SEATS
  const survivors = Array.from({ length: seats }, (_, i) => i)
  const playerIdx = startIdx(seats)
  return {
    phase: 'idle',
    schedule,
    cursor: 0,
    round: 1,
    seats,
    survivors,
    playerIdx,
    count: 0,
    target: 0,
    k: 0,
    windowTicks: 0,
    windowTicksTotal: 0,
    dangerAtStart: false,
    eliminations: 0,
    roundsCleared: 0,
    score: 0,
    events: emptyEvents(),
  }
}

// -- Reducer --------------------------------------------------------------

/** 총괄 리듀서. 순수, 전역(total), 입력을 절대 변형하지 않는다. rng를 절대 호출하지 않는다. */
export function reduce(state: CountcircleState, action: CountcircleAction): CountcircleState {
  switch (action.type) {
    case 'new':
      return createGame(action.seed)

    case 'start': {
      if (state.phase !== 'idle') return state
      const armed = armWindow(state.survivors, state.playerIdx, state.count, state.schedule, state.cursor, state.eliminations)
      return {
        ...state,
        phase: 'playing',
        target: armed.target,
        k: armed.k,
        windowTicks: armed.windowTicks,
        windowTicksTotal: armed.windowTicksTotal,
        dangerAtStart: armed.dangerAtStart,
        cursor: armed.cursor,
        events: emptyEvents(),
      }
    }

    case 'move': {
      if (state.phase !== 'playing') {
        return { ...state, events: { ...emptyEvents(), illegal: true } }
      }
      const n = state.survivors.length
      const delta = action.dir === 'left' ? -1 : 1
      const otherIdx = ((state.playerIdx + delta) % n + n) % n
      const newSurvivors = state.survivors.slice()
      const tmp = newSurvivors[state.playerIdx]
      newSurvivors[state.playerIdx] = newSurvivors[otherIdx]
      newSurvivors[otherIdx] = tmp
      return {
        ...state,
        survivors: newSurvivors,
        playerIdx: otherIdx,
        events: { ...emptyEvents(), moved: true },
      }
    }

    case 'tick': {
      if (state.phase !== 'playing') return { ...state, events: emptyEvents() }
      const events = emptyEvents()
      const windowTicks = state.windowTicks - 1

      if (windowTicks > 0) {
        return { ...state, windowTicks, events }
      }

      // 확정
      const eliminatedSeat = state.survivors[state.target]
      const wasPlayer = state.target === state.playerIdx
      const eliminations = state.eliminations + 1
      events.resolved = true
      events.eliminatedSeat = eliminatedSeat
      events.wasPlayer = wasPlayer

      if (wasPlayer) {
        events.over = true
        return { ...state, phase: 'over', eliminations, events }
      }

      const clutch = state.dangerAtStart
      events.clutch = clutch
      let score = state.score + SCORE_PER_ELIMINATION + (clutch ? CLUTCH_BONUS : 0)

      let newSurvivors = state.survivors.slice()
      newSurvivors.splice(state.target, 1)
      let newPlayerIdx = state.playerIdx - (state.target < state.playerIdx ? 1 : 0)
      let newCount = state.target % newSurvivors.length

      let seats = state.seats
      let round = state.round
      let roundsCleared = state.roundsCleared

      if (newSurvivors.length === 1) {
        events.roundClear = true
        roundsCleared += 1
        score += ROUND_CLEAR_BONUS
        round += 1
        const newSeats = nextSeatCount(round)
        newSurvivors = Array.from({ length: newSeats }, (_, i) => i)
        newPlayerIdx = startIdx(newSeats)
        newCount = 0
        seats = newSeats
      }

      const armed = armWindow(newSurvivors, newPlayerIdx, newCount, state.schedule, state.cursor, eliminations)

      return {
        ...state,
        survivors: newSurvivors,
        playerIdx: newPlayerIdx,
        count: newCount,
        seats,
        round,
        roundsCleared,
        eliminations,
        score,
        target: armed.target,
        k: armed.k,
        windowTicks: armed.windowTicks,
        windowTicksTotal: armed.windowTicksTotal,
        dangerAtStart: armed.dangerAtStart,
        cursor: armed.cursor,
        events,
      }
    }

    default:
      return state
  }
}
