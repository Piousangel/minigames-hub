export const MEMORY_EMOJI = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍉', '🍒', '🥝']

export type Rng = () => number

export interface MemoryCard {
  id: number
  emoji: string
  matched: boolean
}

export interface MemoryState {
  cards: MemoryCard[]
  faceUp: number[] // 미매치 상태로 뒤집힌 카드 인덱스 (0~2개)
  moves: number
  won: boolean
}

export function newMemoryGame(rng: Rng): MemoryState {
  const deck = [...MEMORY_EMOJI, ...MEMORY_EMOJI].map((emoji, i) => ({ id: i, emoji, matched: false }))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return { cards: deck, faceUp: [], moves: 0, won: false }
}

export function flip(state: MemoryState, index: number): MemoryState {
  if (state.won) return state
  const card = state.cards[index]
  if (!card || card.matched || state.faceUp.includes(index)) return state
  if (state.faceUp.length >= 2) return state // 컴포넌트가 clearMismatch 후 다시 flip
  const faceUp = [...state.faceUp, index]
  if (faceUp.length < 2) return { ...state, faceUp }
  const [a, b] = faceUp
  const moves = state.moves + 1
  if (state.cards[a].emoji === state.cards[b].emoji) {
    const cards = state.cards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c))
    return { cards, faceUp: [], moves, won: cards.every((c) => c.matched) }
  }
  return { ...state, faceUp, moves }
}

export function clearMismatch(state: MemoryState): MemoryState {
  if (state.faceUp.length < 2) return state
  return { ...state, faceUp: [] }
}

/** 실수 없이 다 맞히면 쌍 수만큼의 moves(= 이론상 최저). 결과 화면의 '다음 목표' 기준. */
export const PERFECT_MOVES = MEMORY_EMOJI.length

export type WinKind = 'first' | 'best' | 'tie' | 'short'

export interface WinSummary {
  kind: WinKind
  moves: number
  /** 이 판 전 최고 기록(0 = 기록 없음) */
  prevBest: number
  /** moves - prevBest. best면 음수(줄인 만큼), short면 양수(모자란 만큼), 그 밖엔 0 */
  gap: number
  perfect: boolean
}

/**
 * 판을 다 맞힌 순간의 결과 요약. 점수 체계(최소 moves = Best)는 그대로 두고 결과 화면 문구만 고른다.
 */
export function winSummary(moves: number, prevBest: number): WinSummary {
  const perfect = moves <= PERFECT_MOVES
  if (!(prevBest > 0)) return { kind: 'first', moves, prevBest: 0, gap: 0, perfect }
  if (moves < prevBest) return { kind: 'best', moves, prevBest, gap: moves - prevBest, perfect }
  if (moves === prevBest) return { kind: 'tie', moves, prevBest, gap: 0, perfect }
  return { kind: 'short', moves, prevBest, gap: moves - prevBest, perfect }
}
