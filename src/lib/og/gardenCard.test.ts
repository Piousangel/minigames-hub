import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { gameMeta } from '@/lib/games/gameMeta'
import { gamePages } from '@/lib/games/registry'
import { CATEGORY_FLOWER, CATEGORY_MASCOT, COVER_SLUGS, G, titleSize } from './gardenCard'
import { ogImage } from './ogImage'

const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')
const token = (name: string) => css.match(new RegExp(`--garden-${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]?.toLowerCase()
const asset = (name: string) => path.join(process.cwd(), 'src/lib/og/assets', name)

describe('정원 공유 카드 — 사이트 토큰과 같은 색', () => {
  it('G 리터럴 = globals.css --garden-* (Satori는 CSS 변수를 못 읽는다)', () => {
    const map: Record<string, string> = { paper: 'paper', cream: 'cream', cream2: 'cream-2', ink: 'ink', inkSoft: 'ink-soft', inkDeep: 'ink-deep', coralText: 'coral-text', sun: 'sun' }
    for (const [k, css] of Object.entries(map)) expect(G[k as keyof typeof G], k).toBe(token(css))
  })
  it('카테고리 꽃색 = lavender·apricot·clover·sunflower', () => {
    expect(CATEGORY_FLOWER).toEqual({ Puzzle: token('lavender'), Arcade: token('apricot'), Classic: token('clover'), Skill: token('sunflower') })
  })
})

describe('정원 공유 카드 — 빌드 전용 그림 사본', () => {
  it('표지가 있는 게임 = COVER_SLUGS, 사본 JPEG가 있다(표지를 새로 달면 여기서 걸린다)', () => {
    const withCover = Object.entries(gameMeta).filter(([, m]) => m.cover).map(([s]) => s).sort()
    expect([...COVER_SLUGS].sort()).toEqual(withCover)
    for (const s of COVER_SLUGS) expect(existsSync(asset(`cover-${s}.jpg`)), s).toBe(true)
  })
  it('카테고리 마스코트 4마리·홈 배경·글꼴 사본이 있고 한 장 ≤ 80KB', () => {
    const names = [...Object.values(CATEGORY_MASCOT).map((m) => `${m}.png`), 'home-bg.jpg', 'Fraunces-600.ttf', 'Figtree-600.ttf', 'Figtree-800.ttf']
    for (const n of names) {
      expect(existsSync(asset(n)), n).toBe(true)
      expect(statSync(asset(n)).size, n).toBeLessThanOrEqual(80 * 1024)
    }
  })
})

describe('정원 공유 카드 — 브랜드 마크', () => {
  it('브랜드 줄 마크 = 헤더·파비콘 최종판과 같은 96px png(옛 해+섬 SVG 아님)', () => {
    const mark = readFileSync(asset('brand-mark.png'))
    expect(mark.subarray(1, 4).toString()).toBe('PNG') // Satori는 webp를 못 읽는다
    expect(mark.readUInt32BE(16), 'width').toBe(96)
    expect(mark.readUInt32BE(20), 'height').toBe(96)
    expect(mark.equals(readFileSync(path.join(process.cwd(), 'src/brand/icon-96.png')))).toBe(true)
    expect(readFileSync(path.join(process.cwd(), 'src/lib/og/gardenCard.tsx'), 'utf8')).not.toMatch(/GardenLogoMark/)
  })
})

describe('제목 크기', () => {
  it('모든 게임 제목이 72px 이상(작은 썸네일에서 읽히는 하한), 짧을수록 크다', () => {
    // 21자 이상 제목이 생기면 62px로 줄어 이 검사에 걸린다 → 카드를 390 썸네일·정사각 크롭으로 다시 보고 기준을 정할 것
    for (const g of gamePages) expect(titleSize(g.h1), g.h1).toBeGreaterThanOrEqual(72)
    expect(titleSize('2048')).toBeGreaterThan(titleSize('Rock Paper Scissors'))
  })
})

describe('ogImage — openGraph를 직접 주는 페이지의 카드', () => {
  it('게임 slug면 그 게임 카드, 없으면 홈 카드(둘 다 1200×630 png)', () => {
    expect(ogImage('2048')[0]).toMatchObject({ url: '/2048/opengraph-image?v=g1', alt: '2048 — play free on Quick MiniGames', width: 1200, height: 630, type: 'image/png' })
    expect(ogImage()[0].url).toBe('/opengraph-image?v=g1')
  })
})
