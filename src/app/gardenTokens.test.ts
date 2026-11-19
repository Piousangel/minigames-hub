import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// 허브 리디자인 v2(R1) 「노을 정원」 토큰이 콘셉트 3-1·3-4 값과 어긋나지 않는지 지킨다.
// 정본: docs/team/research/2026-11-19/hub-redesign-concept.md 3장.
// 주석을 지운 뒤 읽는다(주석 안의 `--x: y;` 예시에 걸리지 않게).
const css = readFileSync(path.resolve(__dirname, 'globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// 첫 정의(:root)만 본다. R7에서 [data-world="garden"] 스코프 재정의가 생겨도 :root가 먼저 나온다.
const tokenValue = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  return m?.[1].trim().toLowerCase().replace(/\s+/g, ' ')
}

const COLORS: [string, string][] = [
  ['paper', '#fffaf0'],
  ['cream', '#fff3dc'],
  ['cream-2', '#fbeccc'],
  ['cream-shade', '#f3d9aa'],
  ['ink', '#5b3a1e'],
  ['ink-soft', '#7a5636'],
  ['ink-deep', '#3a2410'],
  ['sun', '#ffc933'],
  ['coral', '#e8643f'],
  ['coral-text', '#b3431f'],
  ['leaf', '#7cc26a'],
  ['leaf-deep', '#4f8a3c'],
  ['leaf-text', '#2f6b4f'],
  ['danger', '#ff5a4a'],
  ['danger-text', '#b3431f'],
  ['lavender', '#c9b6f2'],
  ['apricot', '#ffb27a'],
  ['clover', '#a8d98f'],
  ['sunflower', '#ffd966'],
]

describe('garden design tokens (globals.css)', () => {
  it.each(COLORS)('--garden-%s = %s', (name, value) => {
    expect(tokenValue(`garden-${name}`)).toBe(value)
  })

  it('keeps the legacy --garden-gold name equal to sun', () => {
    expect(tokenValue('garden-gold')).toBe('#ffc933')
  })

  it.each([
    ['dawn', 'linear-gradient(180deg, #ffe3b8, #bfe6ff)'],
    ['day', 'linear-gradient(180deg, #8fd3ff, #e9f8ff)'],
    ['sunset', 'linear-gradient(180deg, #ff9d7a, #ffc6a0, #b79ad9)'],
    ['night', 'linear-gradient(180deg, #3d3170, #241c4a)'],
  ])('--garden-sky-%s', (name, value) => {
    expect(tokenValue(`garden-sky-${name}`)).toBe(value)
  })

  it.each([
    ['island', '0 6px 0 var(--garden-ink-deep)'],
    ['seed', '0 4px 0 var(--garden-ink-deep)'],
    ['button', '0 3px 0 var(--garden-ink-deep)'],
  ])('--garden-shadow-%s (solid, no blur)', (name, value) => {
    expect(tokenValue(`garden-shadow-${name}`)).toBe(value)
  })

  it('exposes every garden color and shadow to Tailwind', () => {
    for (const [name] of COLORS) {
      expect(css).toMatch(new RegExp(`--color-garden-${name}:\\s*var\\(--garden-${name}\\);`))
    }
    for (const name of ['island', 'seed', 'button', 'sheet']) {
      expect(css).toMatch(new RegExp(`--shadow-garden-${name}:\\s*var\\(--garden-shadow-${name}\\);`))
    }
  })

  it('keeps the neon palette and the global dark color-scheme (D7)', () => {
    expect(tokenValue('neon-cyan')).toBe('#22d3ee')
    expect(css).toMatch(/html\s*\{\s*color-scheme:\s*dark;/)
  })
})
