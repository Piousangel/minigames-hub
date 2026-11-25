import sitemap from '@/app/sitemap'
import { gamePages } from '@/lib/games/registry'
import { allContent } from '@/content'
import { siteConfig } from '@/lib/siteConfig'

/** llms.txt에서 제외하는 정책 페이지(sitemap에는 있다). */
export const LLMS_EXCLUDED_PATHS = ['/privacy', '/terms', '/contact']

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * llms.txt 본문. URL 목록은 sitemap()과 같은 소스에서 뽑는다(손으로 쓴 목록 금지) —
 * sitemap에 새 색인 대상이 생기면 자동으로 따라오고, 빠지면 llmsTxt.test.ts가 실패한다.
 */
export function buildLlmsTxt(): string {
  const base = siteConfig.url
  const urls = sitemap().map((e) => e.url)
  const games = new Map(gamePages.map((g) => [`${base}/${g.slug}`, g]))
  const content = new Map(allContent().map((c) => [`${base}/guides/${c.entry.slug}`, c.entry]))

  const gameLines: string[] = []
  const guideLines: string[] = []
  const siteLines: string[] = []
  for (const url of urls) {
    const path = url.slice(base.length) || '/'
    if (LLMS_EXCLUDED_PATHS.includes(path)) continue
    const g = games.get(url)
    const c = content.get(url)
    if (g) gameLines.push(`- [${clean(g.h1)}](${url}): ${clean(g.shortDescription)}`)
    else if (c) guideLines.push(`- [${clean(c.title)}](${url}): ${clean(c.description)}`)
    else siteLines.push(`- [${path === '/' ? 'Home' : path.replace(/^\//, '')}](${url}): ${siteDescription(path)}`)
  }

  return [
    `# ${siteConfig.name}`,
    '',
    `> ${siteConfig.description}`,
    '',
    'Free browser mini games that run instantly on phone and desktop. No download and no sign-up; scores and progress are stored locally in the browser.',
    '',
    '## Site',
    ...siteLines,
    '',
    '## Games',
    ...gameLines,
    '',
    '## Guides',
    ...guideLines,
    '',
  ].join('\n')
}

function siteDescription(path: string): string {
  if (path === '/') return 'All games, today\'s daily puzzles and popular picks.'
  if (path === '/daily') return 'Daily puzzles that change every day.'
  if (path === '/guides') return 'Strategy guides and write-ups for the games.'
  if (path === '/about') return 'Who makes the site and why.'
  if (path.startsWith('/category/')) return `${path.slice(10)} games.`
  if (path.startsWith('/collection')) return 'Hand-picked game lists.'
  if (path === '/unblocked') return 'Games that work on school and work networks.'
  if (path === '/leaderboards') return 'Daily and all-time leaderboards.'
  return 'Page on the site.'
}
