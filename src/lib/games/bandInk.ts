// 색 밴드(hsl 채색 칸) 위 숫자 글자색 — 색 밴드 게임 공용(R7d 대비 수정).
// 예전엔 늘 같은 색상의 짙은 글자(L 12%)라 파랑·빨강·자홍 밴드에서 2.4~4.2:1이었다.
// 바꾸는 규칙: 원래 짙은 글자가 4.5:1 이상이면 그대로(밝은 밴드는 픽셀 그대로), 아니면 흰 글자,
// 그것도 모자라면 더 짙은 글자(L 6%), 마지막은 검정. 흰 글자가 4.5 미만이면 바탕 휘도 > 0.183이라
// 검정은 늘 4.66 이상 — 어떤 밴드 색이든 4.5를 보장한다(판정은 8비트 반올림 RGB). 밴드 색 자체는 바꾸지 않는다.
// 쓰는 곳: decant·interlock·turntile·flapjack(R7d), loopgrid·carousel(R7e).

type RGB = [number, number, number]

export function hslToRgb(h: number, s: number, l: number): RGB {
  const sat = s / 100
  const lig = l / 100
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  // 브라우저처럼 8비트로 반올림 — 실수 RGB로 판정하면 4.49대 색상이 '통과'로 잡힌다(R7d 리뷰)
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function luminance([r, g, b]: RGB): number {
  const ch = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

export function contrastRatio(a: RGB, b: RGB): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const WHITE: RGB = [255, 255, 255]
const AA = 4.5

/** hsl(hue sat% light%) 밴드 위 글자색. darkSat = 게임이 원래 쓰던 짙은 글자의 채도. */
export function bandInk(hue: number, sat: number, light: number, darkSat: number): string {
  const bg = hslToRgb(hue, sat, light)
  if (contrastRatio(hslToRgb(hue, darkSat, 12), bg) >= AA) return `hsl(${hue} ${darkSat}% 12%)`
  if (contrastRatio(WHITE, bg) >= AA) return '#fff'
  if (contrastRatio(hslToRgb(hue, darkSat, 6), bg) >= AA) return `hsl(${hue} ${darkSat}% 6%)`
  return '#000'
}
