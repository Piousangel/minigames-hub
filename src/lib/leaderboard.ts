// 리더보드 설정 — Worker(백엔드)와 프론트엔드가 공유. 별칭(@/) 없이 상대 임포트 가능하게 유지.

// 리더보드가 있는 게임(전부 "높을수록 좋음" 점수). label = 표시 단위.
export const LEADERBOARD_GAMES: Record<string, { label: string }> = {
  '2048': { label: 'Score' },
  snake: { label: 'Score' },
  tetris: { label: 'Score' },
  breakout: { label: 'Score' },
  flappy: { label: 'Score' },
  'space-shooter': { label: 'Score' },
  'tower-stack': { label: 'Height' },
  'gem-match': { label: 'Score' },
  'bubble-shooter': { label: 'Score' },
  'whack-a-mole': { label: 'Score' },
  'number-memory': { label: 'Level' },
  simon: { label: 'Round' },
  'typing-test': { label: 'WPM' },
  prospector: { label: 'Best' },
  'zero-hour': { label: 'Score' },
  overload: { label: 'Score' },
  ricochet: { label: 'Score' },
  stackpot: { label: 'Score' },
  flywheel: { label: 'Score' },
  ripple: { label: 'Score' },
  ticker: { label: 'Worth' },
  overfold: { label: 'Score' },
  splice: { label: 'Score' },
  quarry: { label: 'Best' },
  latch: { label: 'Score' },
}

export function hasLeaderboard(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(LEADERBOARD_GAMES, slug)
}

// 위조 방어(캐주얼): 말도 안 되는 값 컷.
export const MAX_SCORE = 100_000_000
export const MAX_NAME_LEN = 16
export const TOP_N = 10

// ISO-8601 주 문자열 (예: "2026-W29"). 주간 보드 회전용.
export function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// 이름 정리: 제어문자 제거, 트림, 길이 컷. 빈 값이면 'Anon'.
export function cleanName(raw: unknown): string {
  const controls = /[\u0000-\u001f\u007f]/g
  const s = String(raw ?? '').replace(controls, '').trim().slice(0, MAX_NAME_LEN)
  return s.length > 0 ? s : 'Anon'
}

// 점수 검증: 정수, 0..MAX. 유효하면 정수, 아니면 null.
export function cleanScore(raw: unknown): number | null {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 0 || n > MAX_SCORE) return null
  return n
}

export interface ScoreRow {
  name: string
  score: number
}
