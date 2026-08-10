// 홈페이지 카드 + 게임별 비주얼 아이덴티티(레트로 네온). registry(SEO/게임로직)와 분리.
// accent는 globals.css의 --neon-* 토큰 키. category는 홈 필터 탭.

export type NeonAccent =
  | 'cyan'
  | 'magenta'
  | 'lime'
  | 'amber'
  | 'purple'
  | 'blue'
  | 'red'
  | 'green'

export type GameCategory = 'Puzzle' | 'Arcade' | 'Classic' | 'Skill'

// 언어독립 조작 글리프(DOMAIN.md P3 잔여 항목) — 글로벌·모바일 낯선 유저가 텍스트 없이도
// "이걸 어떻게 조작하는지" 즉시 이해하게 한다. registry.ts의 howToPlay 원문(게임별 실제
// 조작 설명, 이미 정확함)을 근거로 89종 전부 분류 — 애매한 카드류(솔리테어 계열)는
// 실제 컴포넌트의 이벤트 핸들러(onClick vs onDragStart)까지 확인해서 정했다.
export type ControlScheme = 'arrows' | 'tap' | 'type' | 'drag' | 'point'

export const CONTROL_GLYPH: Record<ControlScheme, { icon: string; label: string }> = {
  arrows: { icon: '↑↓←→', label: 'Arrow keys' },
  tap: { icon: '👆', label: 'Tap or click' },
  type: { icon: '⌨️', label: 'Type' },
  drag: { icon: '✋', label: 'Drag' },
  // 🖱️(마우스 이모지)는 브라우저/폰트 환경에 따라 빈 사각형으로 깨져서 렌더링 확인 중
  // 발견(스크린샷 검증) — 이모지 대신 플레인 유니코드 화살표(arrows와 같은 계열, 폰트
  // 의존성 없음)로 대체.
  point: { icon: '↔', label: 'Move mouse/finger' },
}

export interface GameMeta {
  icon: string // 이모지
  accent: NeonAccent
  category: GameCategory
  /** 매일 같은 판이 주어지는 Daily 모드가 있는 게임. 홈의 Daily 필터가 이걸 읽는다. */
  daily?: true
  /** 추가된 날짜 'YYYY-MM-DD'(UTC). 최근이면 홈 'New games' 행 + NEW 뱃지(자동 만료). */
  addedDate?: string
  /** 엄선(Featured) — 잘 만든/찾는 게임. 홈 최상단 Featured 레일 + 추천 가중. 첫인상=체류. */
  featured?: true
  /** 주 조작 방식(최대 2개, 우선순위 순). ObjectiveBanner가 아이콘으로 표시. */
  controls?: ControlScheme[]
}

export const gameMeta: Record<string, GameMeta> = {
  '2048': { icon: '🔢', accent: 'amber', category: 'Puzzle', featured: true, controls: ['arrows'] },
  '2048-animals': { icon: '🐾', accent: 'lime', category: 'Puzzle', controls: ['arrows'] },
  snake: { icon: '🐍', accent: 'green', category: 'Arcade', featured: true, controls: ['arrows'] },
  minesweeper: { icon: '💣', accent: 'red', category: 'Puzzle', featured: true, controls: ['tap'] },
  'memory-game': { icon: '🧠', accent: 'purple', category: 'Skill', controls: ['tap'] },
  'typing-test': { icon: '⌨️', accent: 'cyan', category: 'Skill', controls: ['type'] },
  tetris: { icon: '🧱', accent: 'blue', category: 'Arcade', featured: true, controls: ['arrows'] },
  'sliding-puzzle': { icon: '🔀', accent: 'cyan', category: 'Puzzle', controls: ['tap', 'arrows'] },
  breakout: { icon: '🧱', accent: 'magenta', category: 'Arcade', controls: ['point', 'arrows'] },
  'word-guess': { icon: '🔤', accent: 'lime', category: 'Puzzle', controls: ['type'] },
  'tic-tac-toe': { icon: '⭕', accent: 'cyan', category: 'Classic', controls: ['tap'] },
  'reaction-time': { icon: '⚡', accent: 'amber', category: 'Skill', controls: ['tap'] },
  'connect-four': { icon: '🔴', accent: 'red', category: 'Classic', controls: ['tap'] },
  hangman: { icon: '🔡', accent: 'purple', category: 'Puzzle', controls: ['tap', 'type'] },
  simon: { icon: '🎵', accent: 'magenta', category: 'Skill', controls: ['tap'] },
  'whack-a-mole': { icon: '🔨', accent: 'lime', category: 'Arcade', controls: ['tap'] },
  'aim-trainer': { icon: '🎯', accent: 'red', category: 'Skill', controls: ['tap'] },
  sudoku: { icon: '9️⃣', accent: 'blue', category: 'Puzzle', controls: ['tap', 'type'] },
  'rock-paper-scissors': { icon: '✊', accent: 'amber', category: 'Classic', controls: ['tap'] },
  pong: { icon: '🏓', accent: 'cyan', category: 'Arcade', controls: ['point', 'arrows'] },
  'lights-out': { icon: '💡', accent: 'amber', category: 'Puzzle', controls: ['tap'] },
  mastermind: { icon: '🎨', accent: 'purple', category: 'Puzzle', controls: ['tap'] },
  'bubble-shooter': { icon: '🫧', accent: 'cyan', category: 'Arcade', controls: ['point', 'tap'] },
  nonogram: { icon: '🖼️', accent: 'blue', category: 'Puzzle', controls: ['tap'] },
  sokoban: { icon: '📦', accent: 'amber', category: 'Puzzle', controls: ['arrows'] },
  'dots-and-boxes': { icon: '⬜', accent: 'magenta', category: 'Classic', controls: ['tap'] },
  flappy: { icon: '🐤', accent: 'lime', category: 'Arcade', controls: ['tap'] },
  checkers: { icon: '⚫', accent: 'red', category: 'Classic', controls: ['tap'] },
  maze: { icon: '🌀', accent: 'green', category: 'Puzzle', controls: ['arrows'] },
  'number-memory': { icon: '🔟', accent: 'purple', category: 'Skill', controls: ['type'] },
  'word-search': { icon: '🔍', accent: 'cyan', category: 'Puzzle', controls: ['drag'] },
  reversi: { icon: '🔵', accent: 'green', category: 'Classic', controls: ['tap'] },
  'gem-match': { icon: '💎', accent: 'magenta', category: 'Puzzle', controls: ['tap', 'drag'] },
  'space-shooter': { icon: '🚀', accent: 'purple', category: 'Arcade', controls: ['arrows', 'tap'] },
  'tower-stack': { icon: '🗼', accent: 'amber', category: 'Arcade', controls: ['tap'] },
  prospector: { icon: '⛏️', accent: 'amber', category: 'Skill', controls: ['tap'] },
  'zero-hour': { icon: '⏳', accent: 'red', category: 'Puzzle', controls: ['tap'] },
  overload: { icon: '⚡', accent: 'magenta', category: 'Puzzle', controls: ['tap'] },
  ricochet: { icon: '↗️', accent: 'cyan', category: 'Puzzle', daily: true, controls: ['tap'] },
  stackpot: { icon: '🪙', accent: 'amber', category: 'Arcade', daily: true, controls: ['tap'] },
  flywheel: { icon: '🎡', accent: 'lime', category: 'Skill', controls: ['tap'] },
  ripple: { icon: '🌊', accent: 'cyan', category: 'Arcade', controls: ['tap'] },
  ticker: { icon: '📈', accent: 'green', category: 'Skill', controls: ['tap'] },
  overfold: { icon: '📄', accent: 'purple', category: 'Puzzle', daily: true, controls: ['tap'] },
  splice: { icon: '✂️', accent: 'cyan', category: 'Puzzle', daily: true, controls: ['tap'] },
  quarry: { icon: '🔦', accent: 'blue', category: 'Puzzle', daily: true, controls: ['tap'] },
  latch: { icon: '🪝', accent: 'cyan', category: 'Skill', controls: ['tap'] },
  decant: { icon: '🧪', accent: 'magenta', category: 'Puzzle', daily: true, controls: ['tap'] },
  backspace: { icon: '⏪', accent: 'red', category: 'Arcade', controls: ['arrows', 'tap'] },
  duplex: { icon: '🪞', accent: 'blue', category: 'Puzzle', daily: true, controls: ['arrows'] },
  overdub: { icon: '🥁', accent: 'lime', category: 'Skill', controls: ['tap'] },
  pinwheel: { icon: '🌀', accent: 'purple', category: 'Puzzle', controls: ['tap'] },
  cleave: { icon: '⚖️', accent: 'amber', category: 'Puzzle', controls: ['tap'] },
  umbra: { icon: '🌑', accent: 'purple', category: 'Skill' , addedDate: '2026-07-16', controls: ['tap'] },
  fuse: { icon: '🧨', accent: 'red', category: 'Puzzle' , addedDate: '2026-07-16', controls: ['tap'] },
  polytap: { icon: '🥁', accent: 'cyan', category: 'Skill' , addedDate: '2026-07-16', controls: ['tap'] },
  deepdive: { icon: '🤿', accent: 'cyan', category: 'Skill', daily: true , addedDate: '2026-07-17', controls: ['arrows'] },
  sonar: { icon: '📡', accent: 'blue', category: 'Puzzle', daily: true , addedDate: '2026-07-17', controls: ['tap'] },
  handful: { icon: '🧺', accent: 'lime', category: 'Arcade', daily: true , addedDate: '2026-07-17', controls: ['arrows'] },
  flapjack: { icon: '🥞', accent: 'cyan', category: 'Puzzle', daily: true , addedDate: '2026-07-18', controls: ['tap'] },
  interlock: { icon: '⛓️', accent: 'magenta', category: 'Puzzle', daily: true , addedDate: '2026-07-18', controls: ['tap'] },
  clusters: { icon: '🔠', accent: 'lime', category: 'Puzzle', daily: true , addedDate: '2026-07-19', featured: true, controls: ['tap'] },
  quadle: { icon: '🔡', accent: 'cyan', category: 'Puzzle', daily: true, addedDate: '2026-07-20', featured: true, controls: ['type'] },
  equate: { icon: '🔢', accent: 'purple', category: 'Puzzle', daily: true, addedDate: '2026-07-20', featured: true, controls: ['type'] },
  reactor: { icon: '⚡', accent: 'green', category: 'Arcade', addedDate: '2026-07-20', featured: true, controls: ['tap'] },
  solitaire: { icon: '🃏', accent: 'green', category: 'Classic', addedDate: '2026-07-20', featured: true, controls: ['tap'] },
  freecell: { icon: '🎴', accent: 'cyan', category: 'Classic', addedDate: '2026-07-20', controls: ['tap'] },
  spider: { icon: '🕷️', accent: 'purple', category: 'Classic', addedDate: '2026-07-20', controls: ['tap'] },
  pyramid: { icon: '🔺', accent: 'amber', category: 'Classic', addedDate: '2026-07-20', controls: ['tap'] },
  tripeaks: { icon: '⛰️', accent: 'green', category: 'Classic', addedDate: '2026-07-20', controls: ['tap'] },
  mahjong: { icon: '🐉', accent: 'red', category: 'Puzzle', addedDate: '2026-07-20', featured: true, controls: ['tap'] },
  chess: { icon: '♟️', accent: 'cyan', category: 'Classic', addedDate: '2026-07-20', featured: true, controls: ['tap'] },
  'golf-solitaire': { icon: '⛳', accent: 'green', category: 'Classic', addedDate: '2026-07-20', controls: ['tap'] },
  dominoes: { icon: '🎲', accent: 'amber', category: 'Classic', addedDate: '2026-07-20', controls: ['tap'] },
  jigsaw: { icon: '🧩', accent: 'magenta', category: 'Puzzle', addedDate: '2026-07-21', featured: true, controls: ['tap'] },
  'yukon-solitaire': { icon: '🃏', accent: 'blue', category: 'Classic', addedDate: '2026-07-21', controls: ['tap'] },
  gomoku: { icon: '⚫', accent: 'cyan', category: 'Classic', addedDate: '2026-07-22', controls: ['tap'] },
  flow: { icon: '🔗', accent: 'cyan', category: 'Puzzle', addedDate: '2026-07-23', featured: true, controls: ['drag'] },
  unblock: { icon: '🚗', accent: 'red', category: 'Puzzle', addedDate: '2026-07-23', featured: true, controls: ['drag'] },
  yahtzee: { icon: '🎲', accent: 'amber', category: 'Classic', addedDate: '2026-07-23', featured: true, controls: ['tap'] },
  mancala: { icon: '🪙', accent: 'lime', category: 'Classic', addedDate: '2026-07-23', featured: true, controls: ['tap'] },
  battleship: { icon: '🚢', accent: 'blue', category: 'Classic', addedDate: '2026-07-24', featured: true, controls: ['tap'] },
  kakuro: { icon: '🧮', accent: 'blue', category: 'Puzzle', addedDate: '2026-07-29', controls: ['tap', 'type'] },
  beatline: { icon: '🎧', accent: 'magenta', category: 'Skill', addedDate: '2026-08-04', featured: true, daily: true, controls: ['tap'] },
  skew: { icon: '📐', accent: 'lime', category: 'Puzzle', addedDate: '2026-08-04', controls: ['tap'] },
  turntile: { icon: '🔄', accent: 'purple', category: 'Puzzle', addedDate: '2026-08-04', daily: true, controls: ['tap'] },
  stakehouse: { icon: '🏺', accent: 'amber', category: 'Arcade', addedDate: '2026-08-10', controls: ['tap'] },
  grasp: { icon: '🤏', accent: 'red', category: 'Skill', addedDate: '2026-08-10', daily: true, controls: ['tap'] },
  countcircle: { icon: '💺', accent: 'blue', category: 'Arcade', addedDate: '2026-08-10', controls: ['tap'] },
  offbeat: { icon: '🔇', accent: 'magenta', category: 'Skill', addedDate: '2026-08-10', controls: ['tap'] },
  hogline: { icon: '🥌', accent: 'blue', category: 'Puzzle', addedDate: '2026-08-10', daily: true, controls: ['drag', 'arrows'] },
  prismbox: { icon: '🌈', accent: 'lime', category: 'Puzzle', addedDate: '2026-08-10', daily: true, controls: ['tap', 'arrows'] },
}

export const CATEGORIES: GameCategory[] = ['Puzzle', 'Arcade', 'Classic', 'Skill']

export const DEFAULT_META: GameMeta = { icon: '🎮', accent: 'cyan', category: 'Arcade' }

// accent 키 → globals.css의 --neon-* CSS 변수. 인라인 color로 넣어
// .neon-box / .neon-text 가 currentColor 로 발광하도록 한다.
export const ACCENT_VAR: Record<NeonAccent, string> = {
  cyan: 'var(--neon-cyan)',
  magenta: 'var(--neon-magenta)',
  lime: 'var(--neon-lime)',
  amber: 'var(--neon-amber)',
  purple: 'var(--neon-purple)',
  blue: 'var(--neon-blue)',
  red: 'var(--neon-red)',
  green: 'var(--neon-green)',
}

export function accentVar(accent: NeonAccent): string {
  return ACCENT_VAR[accent]
}
