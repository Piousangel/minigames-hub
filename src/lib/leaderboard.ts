// 리더보드 설정 — Worker(백엔드)와 프론트엔드가 공유. 별칭(@/) 없이 상대 임포트 가능하게 유지.

// 리더보드가 있는 게임(전부 "높을수록 좋음" 점수). label = 표시 단위.
export const LEADERBOARD_GAMES: Record<string, { label: string }> = {
  '2048': { label: 'Score' },
  '2048-animals': { label: 'Score' },
  decant: { label: 'Score' },
  backspace: { label: 'Score' },
  overdub: { label: 'Score' },
  pinwheel: { label: 'Score' },
  cleave: { label: 'Score' },
  umbra: { label: 'Score' },
  fuse: { label: 'Score' },
  polytap: { label: 'Score' },
  deepdive: { label: 'Score' },
  sonar: { label: 'Score' },
  handful: { label: 'Score' },
  flapjack: { label: 'Score' },
  interlock: { label: 'Score' },
  clusters: { label: 'Score' },
  quadle: { label: 'Score' },
  equate: { label: 'Score' },
  reactor: { label: 'Charge' },
  solitaire: { label: 'Score' },
  yahtzee: { label: 'Score' },
  freecell: { label: 'Score' },
  spider: { label: 'Score' },
  pyramid: { label: 'Score' },
  tripeaks: { label: 'Score' },
  mahjong: { label: 'Score' },
  'golf-solitaire': { label: 'Score' },
  jigsaw: { label: 'Score' },
  'yukon-solitaire': { label: 'Score' },
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
  beatline: { label: 'Score' },
  skew: { label: 'Score' },
  turntile: { label: 'Score' },
  stakehouse: { label: 'Bankroll' },
  grasp: { label: 'Score' },
  countcircle: { label: 'Score' },
  offbeat: { label: 'Score' },
  hogline: { label: 'House' },
  prismbox: { label: 'Score' },
  gravwell: { label: 'Score' },
  loopgrid: { label: 'Score' },
  bisect: { label: 'Score' },
  slotter: { label: 'Score' },
  carousel: { label: 'Score' },
  gridlock: { label: 'Score' },
  bearing: { label: 'Score' },
  strata: { label: 'Score' },
  bankshot: { label: 'Score' },
  'morse-relay': { label: 'Score' },
  recoil: { label: 'Score' },
  lagline: { label: 'Score' },
  chess: { label: 'Wins' },
  gomoku: { label: 'Wins' },
  pong: { label: 'Wins' },
  flow: { label: 'Level' },
  'aim-trainer': { label: 'Targets/s' },
}

export function hasLeaderboard(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(LEADERBOARD_GAMES, slug)
}

// best:<slug>가 plain number가 아니라 JSON 블롭({wins,...})으로 저장되는 게임 —
// GameStats/Leaderboard가 트로피 케이스에서 승수만 읽어오는 폴백에 쓴다. 리더보드
// 등록(LEADERBOARD_GAMES) 대상은 아니다(AI 난이도 파밍 우려로 별도 검토 필요).
export const WINS_JSON_GAMES: Record<string, string> = {
  'tic-tac-toe': 'wins',
  'connect-four': 'w',
  checkers: 'w',
  reversi: 'w',
  mancala: 'w',
  dominoes: 'w',
  battleship: 'w',
  hangman: 'wins',
  mastermind: 'wins',
  'rock-paper-scissors': 'wins',
}

// 리더보드는 정수만 저장(cleanScore가 Math.floor) — 소수점 단위(targets/sec 등)를
// 쓰는 게임은 제출 전 이 배율을 곱해 정수화하고, 표시할 땐 다시 나눈다.
// 나머지 게임은 배율 1(기존과 동일한 정수 그대로).
export const SCORE_SCALE: Record<string, number> = {
  'aim-trainer': 10,
}

// 위조 방어(캐주얼): 말도 안 되는 값 컷.
export const MAX_SCORE = 100_000_000
// 같은 IP의 점수 제출 간격(ms). 리더보드는 사람 손으로 한 판 끝나야 제출되므로 10초면
// 정상 플레이는 안 막고 curl 루프 도배만 막는다(저장 방식은 worker의 passCooldown 참고).
export const SCORE_RATE_LIMIT_MS = 10_000
// 키에 game을 넣어, 같은 NAT/CGNAT 뒤의 두 사람이 다른 게임 점수를 낼 땐 서로 막지 않게 한다.
export function scoreRateKey(ip: string, game: string): string {
  return `score:${ip}:${game}`
}
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

// 리더보드·도전장이 공유하는 플레이어 이름 저장 키(무계정, 기기 로컬).
export const PLAYER_NAME_KEY = 'lb:name'

export function loadPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name.trim().slice(0, MAX_NAME_LEN))
  } catch {
    // ignore storage failures
  }
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
