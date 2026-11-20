import { describe, expect, it } from 'vitest'
import { bandInk, contrastRatio, hslToRgb } from './bandInk'

const parse = (css: string, hue: number): [number, number, number] => {
  if (css === '#fff') return [255, 255, 255]
  if (css === '#000') return [0, 0, 0]
  const m = css.match(/hsl\((\d+) (\d+)% (\d+)%\)/)!
  return hslToRgb(hue, Number(m[2]), Number(m[3]))
}

/** decant: hue = round((rank-1)*300/(k-1)), k = 4..6 / interlock: K = 5, 1..4위 */
const decantHues = [4, 5, 6].flatMap((k) => Array.from({ length: k }, (_, i) => Math.round((i * 300) / (k - 1))))
const interlockHues = [0, 1, 2, 3].map((i) => Math.round((i * 300) / 4))

describe('bandInk(R7d 대비)', () => {
  it('hsl 변환이 알려진 값과 같다', () => {
    expect(hslToRgb(240, 100, 50).map(Math.round)).toEqual([0, 0, 255])
    expect(hslToRgb(0, 0, 100).map(Math.round)).toEqual([255, 255, 255])
  })

  it.each([
    ['decant', decantHues, 70],
    ['interlock', interlockHues, 75],
  ] as const)('%s 밴드 숫자는 모든 실제 색상에서 4.5:1 이상', (_name, hues, darkSat) => {
    for (const h of hues) {
      const ink = bandInk(h, 62, 52, darkSat)
      expect(contrastRatio(parse(ink, h), hslToRgb(h, 62, 52)), `hue ${h} ${ink}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each([
    ['decant·interlock·turntile', 62, 52, 70],
    ['interlock', 62, 52, 75],
    ['flapjack', 68, 54, 72],
  ] as const)('%s: 0~360 모든 색상에서 4.5:1 이상', (_name, sat, light, darkSat) => {
    for (let h = 0; h <= 360; h++) {
      const ink = bandInk(h, sat, light, darkSat)
      expect(contrastRatio(parse(ink, h), hslToRgb(h, sat, light)), `hue ${h} ${ink}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('원래 짙은 글자가 통과하던 밝은 밴드는 그대로', () => {
    expect(bandInk(60, 62, 52, 70)).toBe('hsl(60 70% 12%)')
    expect(bandInk(120, 62, 52, 70)).toBe('hsl(120 70% 12%)')
    expect(bandInk(240, 62, 52, 70)).toBe('#fff')
  })
})
