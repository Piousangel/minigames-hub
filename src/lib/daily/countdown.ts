/**
 * 결과 시트 "Next edition in hh:mm:ss" — 다음 호(다음 UTC 자정)까지 남은 시간(계획서 D3: 호는 UTC 자정 기준).
 * 순수 함수: 시각(ms)을 주입받는다.
 */
const DAY_S = 86_400

/** 다음 UTC 자정까지 남은 초(1~86399). 자정 정각(00:00:00.000)은 이미 새 호가 나온 순간이라 23:59:59로 본다. */
export function secondsToNextEdition(nowMs: number): number {
  const msIntoDay = ((nowMs % 86_400_000) + 86_400_000) % 86_400_000
  const left = Math.ceil((86_400_000 - msIntoDay) / 1000)
  return Math.min(DAY_S - 1, Math.max(1, left))
}

/** 초 → 'hh:mm:ss'(늘 8글자, 고정 폭). */
export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

export const nextEditionLabel = (nowMs: number): string => formatHMS(secondsToNextEdition(nowMs))
