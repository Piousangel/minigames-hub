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

/** 결과 화면의 '최고 기록 대비' 한 줄 판정. prevBest = 이번 판 직전의 최고(0 = 기록 없음). 점수 체계는 그대로, 표시만. */
export type BestCompare =
  | { kind: 'first'; diff: number } // 첫 기록
  | { kind: 'new'; diff: number } // 직전 최고보다 diff만큼 높음
  | { kind: 'tie'; diff: 0 }
  | { kind: 'short'; diff: number } // 최고까지 diff 모자람

export function compareToBest(wpm: number, prevBest: number): BestCompare {
  if (prevBest <= 0) return wpm > 0 ? { kind: 'first', diff: wpm } : { kind: 'tie', diff: 0 }
  if (wpm > prevBest) return { kind: 'new', diff: wpm - prevBest }
  if (wpm === prevBest) return { kind: 'tie', diff: 0 }
  return { kind: 'short', diff: prevBest - wpm }
}

/** 진행 중 WPM 표시용: 경과가 이보다 짧으면 한두 단어로 수백 WPM이 튀므로 '—'로 둔다. 최종 점수와 무관. */
export const LIVE_WPM_MIN_MS = 3000

/** 진행 중 WPM(표시 전용). 실제 경과 ms로 잰다 — 남은 초 올림으로 재면 경과가 최대 1초 짧게 잡혀 초반에 부풀었다. */
export function liveWpm(correctChars: number, elapsedMs: number): number | null {
  if (elapsedMs < LIVE_WPM_MIN_MS) return null
  return computeWpm(correctChars, elapsedMs)
}
