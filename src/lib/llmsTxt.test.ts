import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import { siteConfig } from '@/lib/siteConfig'
import { buildLlmsTxt, LLMS_EXCLUDED_PATHS } from './llmsTxt'

describe('llms.txt', () => {
  const txt = buildLlmsTxt()

  it('llmstxt.org 형식: H1, 요약 인용문, 절별 링크 목록', () => {
    const lines = txt.split('\n')
    expect(lines[0]).toBe(`# ${siteConfig.name}`)
    expect(lines[2]).toMatch(/^> .+/)
    expect(txt).toMatch(/^## Games$/m)
    expect(txt).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)]+\): .+/m)
  })

  it('sitemap의 색인 대상 URL이 하나라도 빠지면 실패(정책 페이지 제외)', () => {
    const missing = sitemap()
      .map((e) => e.url)
      .filter((u) => !LLMS_EXCLUDED_PATHS.includes(u.slice(siteConfig.url.length)))
      .filter((u) => !txt.includes(`(${u})`))
    expect(missing).toEqual([])
  })

  it('sitemap에 없는 URL·정책 페이지를 싣지 않는다', () => {
    const inSitemap = new Set(sitemap().map((e) => e.url))
    const linked = [...txt.matchAll(/\]\((https:[^)]+)\)/g)].map((m) => m[1])
    for (const u of linked) expect(inSitemap.has(u), u).toBe(true)
    for (const p of LLMS_EXCLUDED_PATHS) expect(txt).not.toContain(`${siteConfig.url}${p})`)
  })
})
