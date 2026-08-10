import { describe, expect, it } from 'vitest'
import { isValidGameSlug } from './slug'

describe('isValidGameSlug', () => {
  it('accepts lowercase letters, digits, and hyphens up to 40 chars', () => {
    expect(isValidGameSlug('snake')).toBe(true)
    expect(isValidGameSlug('bubble-shooter')).toBe(true)
    expect(isValidGameSlug('2048')).toBe(true)
    expect(isValidGameSlug('a'.repeat(40))).toBe(true)
  })

  it('rejects empty, uppercase, special characters, and over-length slugs', () => {
    expect(isValidGameSlug('')).toBe(false)
    expect(isValidGameSlug('Snake')).toBe(false)
    expect(isValidGameSlug('snake!')).toBe(false)
    expect(isValidGameSlug('snake game')).toBe(false)
    expect(isValidGameSlug('a'.repeat(41))).toBe(false)
  })
})
