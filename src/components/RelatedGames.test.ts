import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NEON_PATTERN } from './garden-hub/neonClasses'
import { GARDEN_ACCENT_INK } from './RelatedGames'

/**
 * 리디자인 v2 R8 — 게임 페이지 하단 '관련 게임'이 네온 GameCard 대신 정원 카드를 쓴다.
 * ① 카드 색 표가 정원 틀 스코프(globals.css main[data-world='garden'])의 --neon-* 재매핑과 같다(정원 틀 게임 화면 그대로).
 * ② 관련 게임 카드 부품 소스에 네온 클래스 0, 지운 네온 카드(GameCard·SpotlightCard)가 돌아오지 않는다.
 */
const ROOT = process.cwd()
const code = (file: string) =>
  readFileSync(join(ROOT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('관련 게임 정원 카드(R8)', () => {
  it('카드 색 = 정원 틀 바깥의 --neon-* 재매핑 값', () => {
    const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')
    const block = css.match(/\nmain\[data-world='garden'\] \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const remap = Object.fromEntries([...block.matchAll(/--neon-(\w+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
    expect(Object.keys(remap).sort()).toEqual(Object.keys(GARDEN_ACCENT_INK).sort())
    expect(GARDEN_ACCENT_INK).toEqual(remap)
  })

  it.each(['src/components/RelatedGames.tsx', 'src/components/NewBadge.tsx', 'src/components/FavoriteHeart.tsx'])(
    '%s: 네온 클래스 0',
    (file) => {
      expect(code(file).match(NEON_PATTERN) ?? []).toEqual([])
    },
  )

  it('네온 카드 GameCard·SpotlightCard는 지워진 채로 남는다', () => {
    expect(existsSync(join(ROOT, 'src/components/GameCard.tsx'))).toBe(false)
    expect(existsSync(join(ROOT, 'src/components/SpotlightCard.tsx'))).toBe(false)
    expect(code('src/components/RelatedGames.tsx')).not.toMatch(/\bGameCard\b|\bSpotlightCard\b|\baccentVar\b/)
  })
})
