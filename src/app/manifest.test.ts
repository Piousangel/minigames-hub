import { describe, expect, it } from 'vitest'
import manifest from './manifest'

describe('manifest', () => {
  it('존재하지 않는 /icon.svg를 가리키지 않는다(404 방지)', () => {
    const srcs = manifest().icons?.map((i) => i.src) ?? []
    expect(srcs).not.toContain('/icon.svg')
    expect(srcs.length).toBeGreaterThan(0)
  })
})
