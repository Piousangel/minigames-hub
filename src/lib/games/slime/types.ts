/** 말랑 미끄럼길 공통 타입. 좌표: 논리 390×560 보드, 원점 왼쪽 위, y는 아래로 증가. */
export type Pt = { x: number; y: number }
export type Seg = { a: Pt; b: Pt }

export const BOARD_W = 390
export const BOARD_H = 560

export interface Stage {
  id: string
  tier: 1 | 2 | 3
  /** 지형 선분(고정). 끝점은 반지름 0 원과 같이 처리된다. */
  terrain: Seg[]
  spawn: Pt
  acorns: [Pt, Pt, Pt]
  nest: Pt
  spikes: Pt[]
  /** 잉크 한도(px): 파이프라인 후 폴리라인 길이. */
  ink: number
}

export type Outcome = 'nest' | 'spiked' | 'fell' | 'stalled' | 'timeout'

export interface SimResult {
  outcome: Outcome
  /** 먹은 도토리 수(0~3). 도착 못 해도 센다(점수는 도착 시만). */
  acorns: number
  /** 먹은 도토리 비트마스크. */
  acornMask: number
  steps: number
  /** 시뮬 중 중심이 둥지에 가장 가까웠던 거리(솔버 탐색용 근접도). */
  minNest: number
}

/** 물리 계수(기본값은 브리프 4-2 표). 강건성 시험(9조합)에서 바꾼다. */
export interface Physics {
  g: number
  e: number
  mu: number
}
export const DEFAULT_PHYSICS: Physics = { g: 900, e: 0.1, mu: 0.08 }

export const CONST = {
  DT: 1 / 120,
  MAX_STEPS: 1440,
  R: 14,
  HALF_THICK: 2,
  D0: 16, // r + 반두께
  V_MAX: 800,
  ACORN_R: 24,
  NEST_R: 22,
  SPIKE_R: 26,
  FALL_Y: 600,
  FALL_X0: -40,
  FALL_X1: 430,
  STALL_V: 6,
  STALL_STEPS: 120, // 1초
  START_DELAY: 60, // 손을 뗀 뒤 0.5초
  MIN_LINE: 40,
  SPAWN_BAN_R: 34,
} as const
