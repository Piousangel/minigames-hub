/**
 * 하단 시트 끌어 닫기의 순수 규칙(BottomSheet.tsx가 쓰고, 테스트가 같은 함수를 본다).
 * 숫자 근거는 DECISIONS 11-20 '공통 BottomSheet'.
 */

/** 손을 뗄 때 이만큼(시트 높이 비율) 넘게 내려가 있으면 닫는다. */
export const DISMISS_RATIO = 0.25
/** 손을 떼기 직전 속도가 이보다 빠르면(px/ms, 아래 방향) 거리와 상관없이 닫는다 — '튕겨 닫기'. */
export const DISMISS_VELOCITY = 0.5
/** 튕겨 닫기로 보려면 최소 이만큼은 움직였어야 한다(떨림·탭을 튕김으로 오인하지 않게). */
export const FLICK_MIN_PX = 12
/** 이 거리 전에는 끌기인지 스크롤·탭인지 정하지 않는다. */
export const DRAG_SLOP = 6
/** 속도는 손을 떼기 직전 이 시간(ms) 안의 움직임으로 잰다. */
export const VELOCITY_WINDOW = 100

/** iOS 시트 감속 곡선과 시간(ms). CSS 변수 --ease-sheet와 같은 값. */
export const EASE_SHEET = 'cubic-bezier(0.32, 0.72, 0, 1)'
export const OPEN_MS = 280
export const CLOSE_MS = 240
export const SPRING_MS = 300

export interface Sample {
  t: number
  y: number
}

/** 손을 떼기 전 멈춰 있던 시간이 이보다 길면 튕김이 아니다(손가락을 세웠다 놓음). */
export const STILL_MS = 150

/**
 * 손을 뗄 때의 아래 방향 속도(px/ms). 마지막 움직임 기준 VELOCITY_WINDOW ms 안의 표본으로 재되,
 * 그 안에 표본이 하나뿐이면(느린 기기 — 프레임 간격 > 100ms) 바로 앞 표본까지 쓴다. upT가 마지막 움직임에서 STILL_MS 넘게 지났으면 0.
 */
export function releaseVelocity(samples: readonly Sample[], upT?: number): number {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]
  if (upT !== undefined && upT - last.t > STILL_MS) return 0
  let first = samples[samples.length - 2]
  for (let i = samples.length - 3; i >= 0; i--) {
    if (last.t - samples[i].t > VELOCITY_WINDOW) break
    first = samples[i]
  }
  const dt = last.t - first.t
  if (dt <= 0) return 0
  return (last.y - first.y) / dt
}

/** 손을 뗀 순간 닫을지(아니면 제자리로 스프링 복귀). */
export function shouldDismiss(offset: number, height: number, velocity: number): boolean {
  if (offset <= 0 || height <= 0) return false
  if (offset > height * DISMISS_RATIO) return true
  return velocity > DISMISS_VELOCITY && offset >= FLICK_MIN_PX
}

/** 손가락 이동(dy, 아래 +)을 시트 위치로. 위로는 움직이지 않는다(시트 아래에 빈틈이 생기지 않게). */
export function dragOffset(dy: number): number {
  return dy > 0 ? dy : 0
}

/** 끌기 중 배경 어둠의 남은 비율(1 = 그대로, 시트가 끝까지 내려가면 0.35). */
export function dimOpacity(offset: number, height: number): number {
  if (height <= 0) return 1
  return 1 - Math.min(1, Math.max(0, offset / height)) * 0.65
}

/**
 * 화면 키보드가 가린 높이(px). visualViewport가 layout viewport보다 짧아진 만큼.
 * 핀치 확대(scale > 1) 중에는 키보드가 아니라 확대라서 0.
 */
export function keyboardInset(innerHeight: number, vvHeight: number, vvOffsetTop: number, vvScale = 1): number {
  if (vvScale > 1.01) return 0
  const kb = innerHeight - vvHeight - vvOffsetTop
  return kb > 40 ? Math.round(kb) : 0 // 주소창이 접히는 정도(수십 px)는 키보드가 아니다
}
