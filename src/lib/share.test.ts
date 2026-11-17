import { describe, expect, it } from 'vitest'
import { facebookSharerUrl, shareText, tagShareUrl, threadsIntentUrl } from './share'

describe('share', () => {
  it('ref를 채널별로 붙이고 기존 쿼리는 보존, 기존 ref는 교체', () => {
    expect(tagShareUrl('https://quickminigames.site/snake', 'threads')).toBe('https://quickminigames.site/snake?ref=share-threads')
    expect(tagShareUrl('https://quickminigames.site/snake?vs=a-1-b&ref=x', 'kakao')).toBe('https://quickminigames.site/snake?vs=a-1-b&ref=share-kakao')
  })
  it('모든 채널의 ref가 hit.ts 태그 규칙(영숫자·_- 20자 이하)을 만족', () => {
    for (const c of ['threads', 'facebook', 'kakao', 'instagram', 'native', 'copy'] as const) {
      const ref = new URL(tagShareUrl('https://quickminigames.site/x', c)).searchParams.get('ref')!
      expect(ref).toMatch(/^[a-z0-9_-]{1,20}$/i)
    }
  })
  it('잘못된 URL은 그대로 돌려준다', () => {
    expect(tagShareUrl('not a url', 'copy')).toBe('not a url')
  })
  it('Threads·Facebook 링크는 인코딩된 텍스트·URL을 담는다', () => {
    const t = threadsIntentUrl('Snake — play free', 'https://quickminigames.site/snake?ref=share-threads')
    expect(t.startsWith('https://www.threads.net/intent/post?text=')).toBe(true)
    expect(decodeURIComponent(t.split('text=')[1])).toBe('Snake — play free https://quickminigames.site/snake?ref=share-threads')
    expect(facebookSharerUrl('https://quickminigames.site/snake?ref=share-facebook')).toBe(
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fquickminigames.site%2Fsnake%3Fref%3Dshare-facebook',
    )
  })
  it('공유 본문은 길면 자른다', () => {
    expect(shareText('A', 'b'.repeat(400)).length).toBeLessThanOrEqual(220)
    expect(shareText('Title', '')).toBe('Title')
    const emoji = shareText('🎮'.repeat(150), '🎮'.repeat(150))
    expect(() => encodeURIComponent(emoji)).not.toThrow()
  })
})
