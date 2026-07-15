// Simon — 순수·결정론 엔진. Math.random 미사용, RNG는 주입.
// 스타일 참고: src/lib/games/g2048/engine.ts

export type Pad = 0 | 1 | 2 | 3
export type Rng = () => number

export interface SimonState {
  /** 반복해야 할 전체 시퀀스 (패드 0-3). */
  sequence: Pad[]
  /** 이번 라운드에서 지금까지 맞춘 입력 개수. */
  inputIndex: number
  /** 완료한 라운드 수 (= score). */
  round: number
  /** 점수 — 완료한 라운드 수와 동일. */
  score: number
  /** 오답으로 게임이 끝났는지. */
  over: boolean
  /** 최소 한 번 시퀀스가 시작됐는지. */
  started: boolean
}

export interface PressResult {
  state: SimonState
  /** 이번 입력이 시퀀스와 일치했는지. */
  correct: boolean
  /** 이 입력으로 현재 라운드를 끝냈는지 (전체 시퀀스 완주). */
  roundComplete: boolean
}

export function newGame(): SimonState {
  return { sequence: [], inputIndex: 0, round: 0, score: 0, over: false, started: false }
}

/** 시퀀스 끝에 무작위 패드 하나를 추가하고 입력 커서를 리셋한다. */
export function extendSequence(state: SimonState, rng: Rng): SimonState {
  const pad = (Math.floor(rng() * 4) % 4) as Pad
  return {
    ...state,
    sequence: [...state.sequence, pad],
    inputIndex: 0,
    over: false,
    started: true,
  }
}

/**
 * 플레이어 입력을 시퀀스와 대조하며 커서를 전진시킨다.
 * - 일치: correct=true, 커서 +1. 전체를 완주하면 roundComplete=true 이며 round/score +1.
 * - 불일치: over=true (게임 종료).
 * over 상태이거나 시퀀스가 비어 있으면 no-op.
 */
export function pressPad(state: SimonState, pad: Pad): PressResult {
  if (state.over || state.sequence.length === 0) {
    return { state, correct: false, roundComplete: false }
  }

  const expected = state.sequence[state.inputIndex]
  if (pad !== expected) {
    return { state: { ...state, over: true }, correct: false, roundComplete: false }
  }

  const nextIndex = state.inputIndex + 1
  const roundComplete = nextIndex === state.sequence.length

  return {
    state: {
      ...state,
      inputIndex: roundComplete ? 0 : nextIndex,
      round: roundComplete ? state.round + 1 : state.round,
      score: roundComplete ? state.score + 1 : state.score,
    },
    correct: true,
    roundComplete,
  }
}
