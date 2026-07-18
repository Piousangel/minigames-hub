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

export interface GameMeta {
  icon: string // 이모지
  accent: NeonAccent
  category: GameCategory
  /** 매일 같은 판이 주어지는 Daily 모드가 있는 게임. 홈의 Daily 필터가 이걸 읽는다. */
  daily?: true
}

export const gameMeta: Record<string, GameMeta> = {
  '2048': { icon: '🔢', accent: 'amber', category: 'Puzzle' },
  '2048-animals': { icon: '🐾', accent: 'lime', category: 'Puzzle' },
  snake: { icon: '🐍', accent: 'green', category: 'Arcade' },
  minesweeper: { icon: '💣', accent: 'red', category: 'Puzzle' },
  'memory-game': { icon: '🧠', accent: 'purple', category: 'Skill' },
  'typing-test': { icon: '⌨️', accent: 'cyan', category: 'Skill' },
  tetris: { icon: '🧱', accent: 'blue', category: 'Arcade' },
  'sliding-puzzle': { icon: '🔀', accent: 'cyan', category: 'Puzzle' },
  breakout: { icon: '🧱', accent: 'magenta', category: 'Arcade' },
  'word-guess': { icon: '🔤', accent: 'lime', category: 'Puzzle' },
  'tic-tac-toe': { icon: '⭕', accent: 'cyan', category: 'Classic' },
  'reaction-time': { icon: '⚡', accent: 'amber', category: 'Skill' },
  'connect-four': { icon: '🔴', accent: 'red', category: 'Classic' },
  hangman: { icon: '🔡', accent: 'purple', category: 'Puzzle' },
  simon: { icon: '🎵', accent: 'magenta', category: 'Skill' },
  'whack-a-mole': { icon: '🔨', accent: 'lime', category: 'Arcade' },
  'aim-trainer': { icon: '🎯', accent: 'red', category: 'Skill' },
  sudoku: { icon: '9️⃣', accent: 'blue', category: 'Puzzle' },
  'rock-paper-scissors': { icon: '✊', accent: 'amber', category: 'Classic' },
  pong: { icon: '🏓', accent: 'cyan', category: 'Arcade' },
  'lights-out': { icon: '💡', accent: 'amber', category: 'Puzzle' },
  mastermind: { icon: '🎨', accent: 'purple', category: 'Puzzle' },
  'bubble-shooter': { icon: '🫧', accent: 'cyan', category: 'Arcade' },
  nonogram: { icon: '🖼️', accent: 'blue', category: 'Puzzle' },
  sokoban: { icon: '📦', accent: 'amber', category: 'Puzzle' },
  'dots-and-boxes': { icon: '⬜', accent: 'magenta', category: 'Classic' },
  flappy: { icon: '🐤', accent: 'lime', category: 'Arcade' },
  checkers: { icon: '⚫', accent: 'red', category: 'Classic' },
  maze: { icon: '🌀', accent: 'green', category: 'Puzzle' },
  'number-memory': { icon: '🔟', accent: 'purple', category: 'Skill' },
  'word-search': { icon: '🔍', accent: 'cyan', category: 'Puzzle' },
  reversi: { icon: '🔵', accent: 'green', category: 'Classic' },
  'gem-match': { icon: '💎', accent: 'magenta', category: 'Puzzle' },
  'space-shooter': { icon: '🚀', accent: 'purple', category: 'Arcade' },
  'tower-stack': { icon: '🗼', accent: 'amber', category: 'Arcade' },
  prospector: { icon: '⛏️', accent: 'amber', category: 'Skill' },
  'zero-hour': { icon: '⏳', accent: 'red', category: 'Puzzle' },
  overload: { icon: '⚡', accent: 'magenta', category: 'Puzzle' },
  ricochet: { icon: '↗️', accent: 'cyan', category: 'Puzzle', daily: true },
  stackpot: { icon: '🪙', accent: 'amber', category: 'Arcade', daily: true },
  flywheel: { icon: '🎡', accent: 'lime', category: 'Skill' },
  ripple: { icon: '🌊', accent: 'cyan', category: 'Arcade' },
  ticker: { icon: '📈', accent: 'green', category: 'Skill' },
  overfold: { icon: '📄', accent: 'purple', category: 'Puzzle', daily: true },
  splice: { icon: '✂️', accent: 'cyan', category: 'Puzzle', daily: true },
  quarry: { icon: '🔦', accent: 'blue', category: 'Puzzle', daily: true },
  latch: { icon: '🪝', accent: 'cyan', category: 'Skill' },
  decant: { icon: '🧪', accent: 'magenta', category: 'Puzzle', daily: true },
  backspace: { icon: '⏪', accent: 'red', category: 'Arcade' },
  duplex: { icon: '🪞', accent: 'blue', category: 'Puzzle', daily: true },
  overdub: { icon: '🥁', accent: 'lime', category: 'Skill' },
  pinwheel: { icon: '🌀', accent: 'purple', category: 'Puzzle' },
  cleave: { icon: '⚖️', accent: 'amber', category: 'Puzzle' },
  umbra: { icon: '🌑', accent: 'purple', category: 'Skill' },
  fuse: { icon: '🧨', accent: 'red', category: 'Puzzle' },
  polytap: { icon: '🥁', accent: 'cyan', category: 'Skill' },
  deepdive: { icon: '🤿', accent: 'cyan', category: 'Skill', daily: true },
  sonar: { icon: '📡', accent: 'blue', category: 'Puzzle', daily: true },
  handful: { icon: '🧺', accent: 'lime', category: 'Arcade', daily: true },
  flapjack: { icon: '🥞', accent: 'cyan', category: 'Puzzle', daily: true },
  interlock: { icon: '⛓️', accent: 'magenta', category: 'Puzzle', daily: true },
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
