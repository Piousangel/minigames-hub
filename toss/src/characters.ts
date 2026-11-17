/**
 * 우주 친구들(캐릭터 로스터). 모두 꾸미기 전용이다 — 물리·점수는 같아서 랭킹은 공정하다.
 * 해금은 플레이로만 한다(결제 없음). 진행도는 store.Save의 누적 값으로 계산한다.
 */
import type { Save } from './store'

export type CharId = 'tori' | 'muni' | 'hamzzi' | 'bbipo' | 'mallang'
export type Pose = 'idle' | 'aim' | 'fire' | 'happy' | 'dizzy'

export interface Character {
  id: CharId
  name: string
  species: string
  /** 발사체 이름(설명용) */
  shot: string
  /** 발사 궤적 색 */
  accent: string
  intro: string
  unlock: { label: string; progress: (s: Save) => [number, number] } | null
}

export const CHARACTERS: Character[] = [
  {
    id: 'tori',
    name: '토리',
    species: '우주 다람쥐',
    shot: '도토리',
    accent: '#f59e0b',
    intro: '도토리 한 알이면 어디든 가요. 반동 퍼즐의 첫 번째 우주 비행사.',
    unlock: null,
  },
  {
    id: 'muni',
    name: '무니',
    species: '우주 문어',
    shot: '먹물 방울',
    accent: '#a78bfa',
    intro: '먹물을 뿜으면 쭉 날아가요. 겁은 많지만 별 앞에서는 용감해요.',
    unlock: { label: '별 30개 모으기', progress: (s) => [s.totalStars, 30] },
  },
  {
    id: 'hamzzi',
    name: '햄찌',
    species: '우주 햄스터',
    shot: '코르크',
    accent: '#f472b6',
    intro: '볼에 넣어 둔 코르크를 펑! 오늘의 퍼즐을 빠짐없이 하는 성실파.',
    unlock: { label: '오늘의 퍼즐 3일 연속 성공', progress: (s) => [s.maxStreak, 3] },
  },
  {
    id: 'bbipo',
    name: '삐뽀',
    species: '꼬마 로봇',
    shot: '플라즈마',
    accent: '#22d3ee',
    intro: '계산은 정확한데 가끔 어지러워해요. 화면 눈으로 기분을 말해요.',
    unlock: { label: '별 150개 모으기', progress: (s) => [s.totalStars, 150] },
  },
  {
    id: 'mallang',
    name: '말랑',
    species: '젤리 별똥',
    shot: '불꽃 방울',
    accent: '#fb7185',
    intro: '쏠 때마다 쭈욱 늘어나요. 기준 발 수 안에 깨는 고수만 만날 수 있어요.',
    unlock: { label: '기준 발 수 이하로 10번 클리어', progress: (s) => [s.parClears, 10] },
  },
]

export function charById(id: string): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]
}

export function isUnlocked(c: Character, s: Save): boolean {
  if (!c.unlock) return true
  const [v, goal] = c.unlock.progress(s)
  return v >= goal
}

export function unlockedIds(s: Save): CharId[] {
  return CHARACTERS.filter((c) => isUnlocked(c, s)).map((c) => c.id)
}

export function spriteUrl(id: CharId, pose: Pose): string {
  return `./chars/${id}-${pose}.webp`
}

/** 첫 화면에서 깜빡임 없이 바꾸려고 미리 받아 둔다. */
export function preloadSprites(ids: CharId[]): void {
  for (const id of ids)
    for (const p of ['idle', 'aim', 'fire', 'happy', 'dizzy'] as Pose[]) {
      const img = new Image()
      img.src = spriteUrl(id, p)
    }
}

/** 받침에 맞춘 조사: josa('말랑', '은', '는') → '말랑은' */
export function josa(word: string, withBatchim: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const has = code >= 0 && code <= 11171 && code % 28 !== 0
  return word + (has ? withBatchim : without)
}
