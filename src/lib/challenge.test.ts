import { describe, expect, it } from 'vitest'
import { challengeQuery, challengeUrl, compareChallenge, parseChallenge } from './challenge'

describe('challenge link', () => {
  it('round-trips seed, score and name', () => {
    const c = { seed: 0xdeadbeef, score: 1240, name: 'Minsu' }
    expect(parseChallenge('?' + challengeQuery(c))).toEqual(c)
  })

  it('tags the link with ref=share for inflow tracking', () => {
    const url = challengeUrl('https://quickminigames.site', 'morse-relay', { seed: 1, score: 5, name: 'a' })
    expect(url.startsWith('https://quickminigames.site/morse-relay?')).toBe(true)
    expect(new URL(url).searchParams.get('ref')).toBe('share')
  })

  it('keeps non-ASCII names intact', () => {
    const c = { seed: 42, score: 300, name: '민수' }
    expect(parseChallenge('?' + challengeQuery(c))?.name).toBe('민수')
  })

  it('falls back to Anon for an empty name', () => {
    const q = challengeQuery({ seed: 7, score: 90, name: '   ' })
    expect(parseChallenge('?' + q)?.name).toBe('Anon')
  })

  it('rejects a tampered score or name (checksum mismatch)', () => {
    const q = new URLSearchParams(challengeQuery({ seed: 99, score: 500, name: 'kim' }))
    const [seed, , chk] = q.get('vs')!.split('-')
    const tamperedScore = new URLSearchParams(q)
    tamperedScore.set('vs', `${seed}-${(9999).toString(36)}-${chk}`)
    expect(parseChallenge('?' + tamperedScore.toString())).toBeNull()

    const tamperedName = new URLSearchParams(q)
    tamperedName.set('n', 'lee')
    expect(parseChallenge('?' + tamperedName.toString())).toBeNull()
  })

  it('returns null for missing or malformed vs', () => {
    expect(parseChallenge('')).toBeNull()
    expect(parseChallenge('?vs=')).toBeNull()
    expect(parseChallenge('?vs=abc')).toBeNull()
    expect(parseChallenge('?vs=1-2')).toBeNull()
    expect(parseChallenge('?vs=1-0-000')).toBeNull() // score 0은 도전 불가
  })
})

describe('compareChallenge', () => {
  it('win / tie / lose with near-miss percent', () => {
    expect(compareChallenge(1280, 1240)).toEqual({ kind: 'win', diff: 40 })
    expect(compareChallenge(500, 500)).toEqual({ kind: 'tie', diff: 0 })
    expect(compareChallenge(1217, 1240)).toEqual({ kind: 'lose', diff: 23, pct: 98 })
    expect(compareChallenge(0, 1240)).toEqual({ kind: 'lose', diff: 1240, pct: 0 })
  })
})
