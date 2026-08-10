import { describe, expect, it } from 'vitest'
import { MAX_COMMENT_LEN, cleanCommentText, containsLink } from './comments'

describe('cleanCommentText', () => {
  it('trims and passes through normal text', () => {
    expect(cleanCommentText('  nice game!  ')).toBe('nice game!')
  })

  it('strips control characters (0-31, 127)', () => {
    const withControls = ['a', String.fromCharCode(0), 'b', String.fromCharCode(31), 'c', String.fromCharCode(127), 'd'].join('')
    expect(cleanCommentText(withControls)).toBe('abcd')
  })

  it('keeps newlines out but keeps regular unicode (e.g. Korean, emoji)', () => {
    expect(cleanCommentText('재밌다 불')).toBe('재밌다 불')
  })

  it('caps length at MAX_COMMENT_LEN', () => {
    const long = 'x'.repeat(MAX_COMMENT_LEN + 50)
    expect(cleanCommentText(long).length).toBe(MAX_COMMENT_LEN)
  })

  it('non-string input becomes an empty string, not "undefined"/"null"', () => {
    expect(cleanCommentText(undefined)).toBe('')
    expect(cleanCommentText(null)).toBe('')
  })
})

describe('containsLink', () => {
  it('flags http(s):// and www. patterns', () => {
    expect(containsLink('check http://spam.example')).toBe(true)
    expect(containsLink('check https://spam.example')).toBe(true)
    expect(containsLink('visit www.spam.example')).toBe(true)
  })

  it('does not flag normal text', () => {
    expect(containsLink('this game is great')).toBe(false)
    expect(containsLink('')).toBe(false)
  })
})
