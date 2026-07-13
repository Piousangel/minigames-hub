export const SIZE = 4

export type Board = number[][] // [row][col], 0 = 빈 칸

export function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter((v) => v !== 0)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2)
      gained += tiles[i] * 2
      i++ // 병합된 쌍의 두 번째 타일 소비 — 연쇄 병합 방지
    } else {
      out.push(tiles[i])
    }
  }
  while (out.length < row.length) out.push(0)
  return { row: out, gained }
}
