import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from './manifest'

/** PNG IHDR의 가로·세로(바이트 16~23). */
function pngSize(file: string) {
  const b = readFileSync(join(process.cwd(), 'src/brand', file))
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG')
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`
}

// 라우트 → 실제로 내보내는 src/brand 파일(src/app/icons/*/route.tsx, apple-icon.tsx)
const ROUTE_FILE: Record<string, string> = {
  '/icons/pwa-192': 'pwa-192.png',
  '/icons/pwa-512': 'pwa-512.png',
  '/icons/pwa-maskable-512': 'pwa-maskable-512.png',
  '/apple-icon': 'apple-180.png',
}

describe('manifest', () => {
  it('존재하지 않는 /icon.svg를 가리키지 않는다(404 방지)', () => {
    const srcs = manifest().icons?.map((i) => i.src) ?? []
    expect(srcs).not.toContain('/icon.svg')
    expect(srcs.length).toBeGreaterThan(0)
  })

  it('아이콘마다 같은 크기의 브랜드 PNG가 있고, 192·512 any와 maskable 전용 판이 있다', () => {
    const icons = manifest().icons ?? []
    for (const i of icons) expect(pngSize(ROUTE_FILE[i.src])).toBe(i.sizes)
    const purposes = icons.map((i) => `${i.sizes} ${i.purpose ?? 'any'}`)
    expect(purposes).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']))
    const maskable = icons.find((i) => i.purpose === 'maskable')
    expect(maskable?.src).toBe('/icons/pwa-maskable-512')
  })
})
