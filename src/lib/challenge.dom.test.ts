// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearChallengeParams } from './challenge'

describe('clearChallengeParams', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('removes vs/n/ref but keeps the path, other params, the hash and history.state', () => {
    window.history.replaceState({ keep: 1 }, '', '/slosh?vs=abc-1-xyz&x=1&n=Ana&ref=share#top')
    clearChallengeParams()
    expect(window.location.pathname).toBe('/slosh')
    expect(window.location.search).toBe('?x=1')
    expect(window.location.hash).toBe('#top')
    expect(window.history.state).toEqual({ keep: 1 })
  })

  it('leaves a plain URL alone', () => {
    window.history.replaceState(null, '', '/hunch')
    clearChallengeParams()
    expect(window.location.pathname + window.location.search).toBe('/hunch')
  })

  it('swallows history errors', () => {
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => clearChallengeParams()).not.toThrow()
  })
})
