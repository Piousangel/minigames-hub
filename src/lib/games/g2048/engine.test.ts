import { describe, expect, it } from 'vitest'
import { slideRowLeft } from './engine'

describe('slideRowLeft', () => {
  it('빈 칸을 건너 왼쪽으로 민다', () => {
    expect(slideRowLeft([0, 2, 0, 4]).row).toEqual([2, 4, 0, 0])
  })
  it('같은 값 쌍을 병합하고 점수를 얻는다', () => {
    expect(slideRowLeft([2, 2, 0, 0])).toEqual({ row: [4, 0, 0, 0], gained: 4 })
  })
  it('네 개 같은 값은 두 쌍으로 병합된다', () => {
    expect(slideRowLeft([2, 2, 2, 2])).toEqual({ row: [4, 4, 0, 0], gained: 8 })
  })
  it('한 턴에 연쇄 병합은 없다 (4,2,2 → 4,4, 8 아님)', () => {
    expect(slideRowLeft([4, 2, 2, 0]).row).toEqual([4, 4, 0, 0])
  })
  it('이동 불가면 그대로', () => {
    expect(slideRowLeft([2, 4, 8, 16]).row).toEqual([2, 4, 8, 16])
  })
})
