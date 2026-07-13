export const WORDS = [
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
  'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did',
  'its', 'let', 'put', 'say', 'she', 'too', 'use', 'that', 'with', 'have',
  'this', 'will', 'your', 'from', 'they', 'know', 'want', 'been', 'good', 'much',
  'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make',
  'many', 'more', 'only', 'over', 'such', 'take', 'than', 'them', 'well', 'were',
  'work', 'year', 'back', 'call', 'came', 'each', 'even', 'find', 'give', 'hand',
  'high', 'keep', 'last', 'life', 'live', 'look', 'made', 'most', 'move', 'must',
  'name', 'need', 'next', 'open', 'part', 'play', 'right', 'same', 'tell', 'turn',
]

export type Rng = () => number

export function sampleWords(count: number, rng: Rng): string[] {
  return Array.from({ length: count }, () => WORDS[Math.floor(rng() * WORDS.length)])
}

export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  return Math.round(correctChars / 5 / (elapsedMs / 60_000))
}

export function computeAccuracy(correctChars: number, typedChars: number): number {
  if (typedChars === 0) return 100
  return Math.round((correctChars / typedChars) * 100)
}
