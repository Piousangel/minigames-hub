import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeAbout, HOME_GUIDE_SLUGS } from './HomeAbout'
import { contentBySlug } from '@/content'
import { signboardLinks } from './GardenSignboard'

describe('HomeAbout (R4 편집 블록, 리뷰 B5)', () => {
  it('About 본문은 120~200단어, 수는 넘긴 값', () => {
    render(<HomeAbout gameCount={113} dailyCount={31} />)
    const text = screen.getByTestId('home-about').querySelector('div.space-y-3')!.textContent!
    const words = text.trim().split(/\s+/).length
    expect(words).toBeGreaterThanOrEqual(120)
    expect(words).toBeLessThanOrEqual(200)
    expect(text).toContain('113 free games')
    expect(text).toContain('31 daily games')
  })

  it('From the guides 3링크 = 실제 가이드·기사 페이지', () => {
    const { container } = render(<HomeAbout gameCount={113} dailyCount={31} />)
    expect(HOME_GUIDE_SLUGS).toHaveLength(3)
    for (const slug of HOME_GUIDE_SLUGS) {
      expect(contentBySlug(slug), slug).toBeDefined()
      expect(container.querySelector(`a[href="/guides/${slug}"]`)).not.toBeNull()
    }
  })
})

describe('정원 안내판', () => {
  it('예전 홈 Explore 스트립 링크를 모두 포함(내부 링크 감소 0)', () => {
    const hrefs = signboardLinks().map((l) => l.href)
    for (const h of ['/daily', '/collections', '/category/puzzle', '/category/arcade', '/category/classic', '/category/skill']) {
      expect(hrefs).toContain(h)
    }
  })
})
