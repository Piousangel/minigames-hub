/**
 * 2048 Animals '새 친구' 판정(#263). 순수 함수 — 저장은 하지 않는다(평생 기록은 기존 `bestTile:<slug>`를 읽기만).
 */

/** 진화 사다리 11단계(2 Mouse … 2048 Dragon). */
export const LADDER = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048] as const

export type FriendMeet = { value: number; kind: 'round' | 'lifetime' }

/**
 * 한 번의 이동 뒤 등장 연출을 띄울지.
 * - 합쳐서 만든 최고 값(mergedMax)이 이번 판 최고(roundMaxBefore)를 넘을 때만 → 'round'(이번 판 첫 만남)
 * - 그 값이 평생 최고(lifetimeBefore)까지 넘으면 → 'lifetime'(New friend!)
 * 스폰 타일은 합치기가 아니라 세지 않는다(호출자가 합치기 값만 넘긴다).
 */
export function friendMeet(roundMaxBefore: number, mergedMax: number, lifetimeBefore: number): FriendMeet | null {
  if (!(mergedMax > roundMaxBefore)) return null
  return { value: mergedMax, kind: mergedMax > Math.max(lifetimeBefore, roundMaxBefore) ? 'lifetime' : 'round' }
}

/** 평생 도감: 평생 최고 타일까지의 단계는 만남. 사다리 밖 값(4096+)은 용까지 전부 만남. */
export function collectionOf(lifetimeBest: number): { value: number; met: boolean }[] {
  return LADDER.map((v) => ({ value: v, met: v <= lifetimeBest }))
}
