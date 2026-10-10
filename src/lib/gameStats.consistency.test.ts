import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { gamePages } from './games/registry'
import { isEndless } from './games/gameMeta'

/**
 * endless 분류는 두 곳이 맞아야 한다: gameMeta의 `endless: true`와 컴포넌트의 기록 호출.
 * endless 게임은 recordFinish만, 승패 게임은 recordResult만 부른다. 어긋나면 Win %·Champion·
 * 분석 퍼널이 조용히 틀어지므로(리뷰 지적) 소스 수준에서 강제한다.
 */
const renderer = readFileSync('src/components/GameRenderer.tsx', 'utf8')

function componentFile(game: string): string | null {
  const m = renderer.match(new RegExp(`case '${game}':\\s*return <(Game[A-Za-z0-9]+)`))
  if (!m) return null
  const f = `src/components/games/${m[1]}.tsx`
  return existsSync(f) ? f : null
}

describe('endless flag ↔ recordFinish/recordResult', () => {
  const seen = new Set<string>()
  for (const page of gamePages) {
    if (seen.has(page.game)) continue
    seen.add(page.game)
    const file = componentFile(page.game)
    if (!file) continue
    const src = readFileSync(file, 'utf8')
    const usesFinish = /\brecordFinish\(/.test(src)
    const usesResult = /\brecordResult\(/.test(src)
    if (!usesFinish && !usesResult) continue
    it(`${page.slug}: ${isEndless(page.slug) ? 'endless → recordFinish' : 'win/lose → recordResult'}`, () => {
      if (isEndless(page.slug)) {
        expect(usesFinish).toBe(true)
        expect(usesResult).toBe(false)
      } else {
        expect(usesResult).toBe(true)
        expect(usesFinish).toBe(false)
      }
    })
  }
  it('스캔이 실제로 게임들을 덮는다', () => {
    expect(seen.size).toBeGreaterThan(90)
  })
})
