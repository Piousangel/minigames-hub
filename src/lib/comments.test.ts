import { describe, expect, it } from 'vitest'
import { MAX_COMMENT_LEN, cleanCommentText, containsLink, isHoneypotTripped } from './comments'

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

  it('does not leave a dangling surrogate when an astral character sits at the cap', () => {
    // 이모지 하나가 MAX_COMMENT_LEN 경계에 딱 걸치는 경우 — UTF-16 code unit 단위로 자르면
    // 서로게이트 페어가 반으로 잘려 깨진 문자가 저장될 수 있다(리뷰에서 발견된 버그).
    const near = 'x'.repeat(MAX_COMMENT_LEN - 1) + '\u{1F600}'
    const result = cleanCommentText(near)
    // result.length는 UTF-16 코드유닛 수라 이모지(2유닛) 하나가 있으면 코드포인트 수보다
    // 커진다 — 잘려야 할 건 코드포인트 수(=[...result].length)다.
    expect([...result].length).toBeLessThanOrEqual(MAX_COMMENT_LEN)
    // 하이 서로게이트(U+D800~U+DBFF)로 끝나면 안 됨 — 그건 깨진 페어라는 뜻.
    const lastCode = result.charCodeAt(result.length - 1)
    expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false)
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

describe('isHoneypotTripped', () => {
  it('flags any non-empty value as a bot', () => {
    expect(isHoneypotTripped('x')).toBe(true)
    expect(isHoneypotTripped('anything')).toBe(true)
  })

  it('does not flag empty, undefined, or null', () => {
    expect(isHoneypotTripped('')).toBe(false)
    expect(isHoneypotTripped(undefined)).toBe(false)
    expect(isHoneypotTripped(null)).toBe(false)
  })
})
