import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NEON_PATTERN } from './neonClasses'

/**
 * 리디자인 v2 R9 — 게임 밖 허브 페이지 정원화의 소스 안전망(R8 옛 네온 코드 제거 전에 '이 페이지들은 네온을 안 쓴다'를 고정).
 * 렌더 결과는 e2e/garden-hub.spec.ts가 본다(main[data-world="garden-hub"] + 네온 클래스 0 + 대비·44px·가로 스크롤).
 *
 * ① 전수: src/app의 page.tsx 중 게임 페이지([slug])·홈·내부 도구(/tools)·/leaderboards(R6 이월에서 이미 정원)를 뺀 나머지는
 *    전부 HUB_PAGES에 있어야 한다 — 새 허브 페이지가 생기면 여기서 실패해 정원 틀을 강제한다.
 * ② 각 페이지와 그 페이지가 쓰는 공용 부품 소스에 네온 클래스·네온 카드(GameCard)·accentVar가 0.
 */
const APP = join(process.cwd(), 'src/app')

const HUB_PAGES = [
  'about/page.tsx',
  'category/[slug]/page.tsx',
  'collection/[slug]/page.tsx',
  'collections/page.tsx',
  'contact/page.tsx',
  'daily/page.tsx',
  'guides/[slug]/page.tsx',
  'guides/page.tsx',
  'privacy/page.tsx',
  'terms/page.tsx',
  'unblocked/page.tsx',
]
const HUB_PARTS = [
  'src/components/garden-hub/GardenHub.tsx',
  'src/components/ProsePage.tsx',
  'src/components/ContentBody.tsx',
  'src/components/DailyCountdown.tsx',
  'src/app/not-found.tsx',
  // /leaderboards는 R6 이월(#203)에서 먼저 정원이 됐다 — 자기 <main data-world="garden-hub">를 쓰지만 네온 0은 같이 고정
  'src/app/leaderboards/page.tsx',
  'src/components/LeaderboardsHub.tsx',
]
const NOT_HUB = new Set(['page.tsx', '[slug]/page.tsx', 'leaderboards/page.tsx'])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('게임 밖 허브 페이지 정원 틀(R9)', () => {
  it('src/app의 허브 페이지 전수가 목록에 있다(새 페이지는 정원 틀로)', () => {
    const pages = walk(APP)
      .filter((p) => p.endsWith('/page.tsx'))
      .map((p) => relative(APP, p))
      .filter((p) => !NOT_HUB.has(p) && !p.startsWith('tools/'))
      .sort()
    expect(pages).toEqual([...HUB_PAGES].sort())
  })

  it.each(HUB_PAGES)('%s: 정원 틀(GardenHubPage·ProsePage)로 그린다', (file) => {
    const src = readFileSync(join(APP, file), 'utf8')
    expect(src).toMatch(/<(GardenHubPage|ProsePage)\b/)
    expect(src).not.toMatch(/<main\b/)
  })

  it.each([...HUB_PAGES.map((f) => `src/app/${f}`), ...HUB_PARTS])('%s: 네온 클래스·GameCard·accentVar 0', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8')
    // 주석 안의 설명 글은 빼고 본다
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code.match(NEON_PATTERN) ?? []).toEqual([])
    expect(code).not.toMatch(/\bGameCard\b|\baccentVar\b/)
  })

  it('패턴 자체가 네온 클래스를 잡는다(자기 검사)', () => {
    const sample = 'neon-text text-neon-cyan bg-surface/60 text-fg-muted text-accent border-border font-pixel neon-box-hover text-garden-ink bg-garden-cream'
    expect(sample.match(NEON_PATTERN)).toEqual(['neon-text', 'text-neon-cyan', 'bg-surface/60', 'text-fg-muted', 'text-accent', 'border-border', 'font-pixel', 'neon-box-hover'])
  })
})
