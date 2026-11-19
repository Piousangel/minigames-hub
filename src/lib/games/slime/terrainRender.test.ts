import { describe, expect, it } from 'vitest'
import { chainsOf, landformsOf } from './terrainRender'
import { SLIME_STAGES } from './stages'

const seg = (ax: number, ay: number, bx: number, by: number) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } })

describe('지형 체인·종류', () => {
  it('끝점이 이어진 선분은 하나의 체인이 된다(순서·방향 무관)', () => {
    const t = [seg(0, 0, 10, 0), seg(20, 5, 10, 0), seg(20, 5, 30, 9), seg(100, 100, 100, 200)]
    const c = chainsOf(t)
    expect(c.length).toBe(2)
    expect(c[0].length).toBe(4) // 0,0 → 10,0 → 20,5 → 30,9
    expect(c[1].length).toBe(2)
  })
  it('skip(튕기는 벽)은 체인에서 빠진다', () => {
    expect(chainsOf([seg(0, 0, 10, 0), seg(50, 50, 60, 60)], [1]).length).toBe(1)
  })
  it('가로로 긴 체인은 ridge, 세로로 선 것은 slab', () => {
    const forms = landformsOf({ ...SLIME_STAGES[0], terrain: [seg(0, 500, 200, 500), seg(300, 300, 300, 560)], bouncy: undefined })
    expect(forms.map((f) => f.kind)).toEqual(['ridge', 'slab'])
  })
  it('모든 스테이지의 충돌 선분이 하나도 빠짐없이 체인에 들어간다(튕기는 벽 제외)', () => {
    for (const st of SLIME_STAGES) {
      const skip = st.bouncy ?? []
      const need = st.terrain.length - skip.length
      const got = chainsOf(st.terrain, skip).reduce((n, c) => n + (c.length - 1), 0)
      expect(got, st.id).toBe(need)
    }
  })
})
