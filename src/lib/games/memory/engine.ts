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
