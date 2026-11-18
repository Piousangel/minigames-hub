import { describe, expect, it } from 'vitest'
import { hashKey } from './hashKey'

describe('hashKey', () => {
  it('결정적이고 24자 hex이며 원본을 포함하지 않는다', async () => {
    const a = await hashKey('203.0.113.7')
    expect(a).toMatch(/^[0-9a-f]{24}$/)
    expect(a).toBe(await hashKey('203.0.113.7'))
    expect(a).not.toContain('203')
  })
  it('값이나 salt가 다르면 다른 해시', async () => {
    expect(await hashKey('1.1.1.1')).not.toBe(await hashKey('1.1.1.2'))
    expect(await hashKey('1.1.1.1', 's1')).not.toBe(await hashKey('1.1.1.1', 's2'))
  })
})
