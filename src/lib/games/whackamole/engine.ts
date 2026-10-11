/**
 * Whack-a-Mole 순수 엔진.
 *
 * RAF / setInterval / setTimeout 같은 타이머는 컴포넌트가 소유하고, 이 모듈은
 * 전부 순수 함수로만 구성된다(Math.random 금지 — RNG는 항상 주입). 덕분에
 * 두더지 등장·타격·시간 카운트다운을 결정적으로 테스트할 수 있다.
 */

export const GRID_SIZE = 3
export const HOLES = GRID_SIZE * GRID_SIZE // 3x3 = 9
export const ROUND_MS = 30_000 // 한 라운드 30초
/**
 * 빈 구멍을 칠 때마다 잃는 시간(ms). 패널티가 없으면 화면을 보지 않고 9개 구멍을
 * 연타하는 전략이 반응 플레이와 맞먹는다(engine.test.ts 밸런스 시뮬레이션 참고).
 * gameIntros: "every wasted tap is time you do not get back".
 */
export const MISS_PENALTY_MS = 1_000

/** 라운드 진행도(0→1)에 따른 다음 등장까지의 간격: 880ms → 450ms. */
export function spawnDelay(progress: number): number {
  return Math.round(880 - progress * 430)
}

/** 라운드 진행도(0→1)에 따른 두더지 노출 시간: 1150ms → 650ms. */
export function moleLife(progress: number): number {
  return Math.round(1150 - progress * 500)
}

export type Rng = () => number

export interface WhackState {
  /** 길이 HOLES. true = 해당 구멍에 두더지가 올라와 있음. */
  moles: boolean[]
  score: number
  misses: number
  /** 남은 시간(ms). */
  timeLeft: number
  over: boolean
}

export function newGame(): WhackState {
  return {
    moles: Array<boolean>(HOLES).fill(false),
    score: 0,
    misses: 0,
    timeLeft: ROUND_MS,
    over: false,
  }
}

/** 현재 두더지가 없는 구멍들의 인덱스 목록. */
export function emptyHoles(state: WhackState): number[] {
  const free: number[] = []
  for (let i = 0; i < state.moles.length; i++) {
    if (!state.moles[i]) free.push(i)
  }
  return free
}

/**
 * 두더지가 없는 구멍 중 하나를 RNG로 골라 인덱스를 돌려준다.
 * 빈 구멍이 없으면 null. 반환값은 항상 0..HOLES-1 범위(그리드 안).
 */
export function pickHole(state: WhackState, rng: Rng): number | null {
  const free = emptyHoles(state)
  if (free.length === 0) return null
  return free[Math.floor(rng() * free.length)]
}

/** 지정한 구멍에 두더지를 올린다(이미 올라와 있으면 그대로). */
export function activateHole(state: WhackState, hole: number): WhackState {
  if (state.over || hole < 0 || hole >= state.moles.length || state.moles[hole]) return state
  const moles = state.moles.slice()
  moles[hole] = true
  return { ...state, moles }
}

/**
 * 빈 구멍 하나에 두더지를 무작위로 올린 새 상태를 돌려준다.
 * (RNG 주입 — 순수 함수 유지). 올릴 곳이 없으면 상태 그대로.
 */
export function popMole(state: WhackState, rng: Rng): WhackState {
  const hole = pickHole(state, rng)
  if (hole === null) return state
  return activateHole(state, hole)
}

/** 지정한 구멍의 두더지를 내린다(자동 숨김/타이머 만료용). */
export function hideMole(state: WhackState, hole: number): WhackState {
  if (hole < 0 || hole >= state.moles.length || !state.moles[hole]) return state
  const moles = state.moles.slice()
  moles[hole] = false
  return { ...state, moles }
}

/**
 * 구멍을 때린다.
 * - 두더지가 있으면: score+1, 두더지 제거, hit=true.
 * - 비어 있으면: misses+1, 남은 시간 -penaltyMs(0 이하면 라운드 종료), hit=false.
 * 게임이 끝났으면 아무 변화 없음.
 */
export function whack(
  state: WhackState,
  hole: number,
  penaltyMs: number = MISS_PENALTY_MS,
): { state: WhackState; hit: boolean } {
  if (state.over || hole < 0 || hole >= state.moles.length) return { state, hit: false }
  if (state.moles[hole]) {
    const moles = state.moles.slice()
    moles[hole] = false
    return { state: { ...state, moles, score: state.score + 1 }, hit: true }
  }
  return { state: tickTime({ ...state, misses: state.misses + 1 }, penaltyMs), hit: false }
}

/** 적중률(0..1). 아직 한 번도 치지 않았으면 null. */
export function accuracy(state: WhackState): number | null {
  const swings = state.score + state.misses
  return swings === 0 ? null : state.score / swings
}

/**
 * 시간을 dt(ms)만큼 흘린다. 0 이하가 되면 라운드 종료(over) + 모든 두더지 제거.
 */
export function tickTime(state: WhackState, dt: number): WhackState {
  if (state.over) return state
  const timeLeft = state.timeLeft - dt
  if (timeLeft <= 0) {
    return { ...state, timeLeft: 0, moles: Array<boolean>(HOLES).fill(false), over: true }
  }
  return { ...state, timeLeft }
}
