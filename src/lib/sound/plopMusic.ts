/**
 * 뿅 착지 배경음악 악보(순수 함수). 절차적 합성 루프: 느린 로파이 뮤직박스.
 * 시간대 틴트(0 노을, 1 새벽, 2 밤)마다 조성·코드가 달라 날마다 분위기가 다르다. 16마디(약 46초)마다 반복.
 * 재생은 usePlopAudio가 Web Audio로 한다(외부 음원 없음, 용량 0, 라이선스 문제 없음).
 */

export const BPM = 84
export const BEAT_S = 60 / BPM
export const BAR_BEATS = 4
export const BARS = 16

export type NoteKind = 'pad' | 'bass' | 'lead'
export interface Note {
  /** 마디 시작 기준 박 오프셋 */
  beat: number
  midi: number
  beats: number
  gain: number
  kind: NoteKind
}

/** 코드: [베이스, 패드 4음] */
const CHORDS: Record<0 | 1 | 2, number[][]> = {
  0: [[48, 60, 64, 67, 71], [45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [43, 55, 59, 62, 64]], // C: Cmaj7 Am7 Fmaj7 G6
  1: [[50, 62, 66, 69, 73], [47, 59, 62, 66, 69], [43, 55, 59, 62, 66], [45, 57, 61, 64, 66]], // D: Dmaj7 Bm7 Gmaj7 A6
  2: [[45, 57, 60, 64, 67], [41, 53, 57, 60, 64], [48, 60, 64, 67, 71], [43, 55, 59, 62, 64]], // Am: Am7 Fmaj7 Cmaj7 G6
}
const SCALE: Record<0 | 1 | 2, number[]> = {
  0: [72, 74, 76, 79, 81, 84],
  1: [74, 76, 78, 81, 83, 86],
  2: [69, 72, 74, 76, 79, 81],
}

function rng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** 마디 bar(0부터, BARS로 순환)의 음표들. 같은 (tint, bar)는 항상 같은 결과. */
export function barNotes(tint: 0 | 1 | 2, barIndex: number): Note[] {
  const bar = ((barIndex % BARS) + BARS) % BARS
  const chord = CHORDS[tint][bar % 4]
  const notes: Note[] = []
  // 패드: 마디 전체를 부드럽게 받치는 4음
  for (let i = 1; i < chord.length; i++) notes.push({ beat: 0, midi: chord[i], beats: 4, gain: 0.05, kind: 'pad' })
  // 베이스: 1박·3박
  notes.push({ beat: 0, midi: chord[0], beats: 1.6, gain: 0.2, kind: 'bass' })
  notes.push({ beat: 2, midi: chord[0], beats: 1.6, gain: 0.15, kind: 'bass' })
  // 리드(뮤직박스): 8분음표 8칸 중 일부, 음계 위에서 인접 음으로 움직인다. 4마디 구절의 끝은 쉰다.
  const r = rng(tint * 977 + bar * 131 + 17)
  const scale = SCALE[tint]
  let idx = Math.floor(r() * scale.length)
  const phraseEnd = bar % 4 === 3
  for (let slot = 0; slot < 8; slot++) {
    const play = slot === 0 ? r() < 0.8 : slot % 2 === 0 ? r() < 0.5 : r() < 0.35
    if (!play || (phraseEnd && slot >= 4)) continue
    const step = r() < 0.5 ? -1 : 1
    idx = Math.min(scale.length - 1, Math.max(0, idx + step * (r() < 0.25 ? 2 : 1)))
    notes.push({ beat: slot * 0.5, midi: scale[idx], beats: 1.2, gain: 0.1 + 0.05 * r(), kind: 'lead' })
  }
  return notes
}
