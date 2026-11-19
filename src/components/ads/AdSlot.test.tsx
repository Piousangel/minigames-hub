import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

// 광고를 '켠' 상태를 흉내 낸다 — 실제 siteConfig.adsenseEnabled는 승인 전 false 그대로(마지막 테스트가 지킨다).
const enabled = vi.hoisted(() => ({ on: true }))
vi.mock('@/lib/siteConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/siteConfig')>()
  return {
    ...actual,
    siteConfig: new Proxy(actual.siteConfig, {
      get: (t, k) => (k === 'adsenseEnabled' ? enabled.on : t[k as keyof typeof t]),
    }),
  }
})

import { AdSlot } from './AdSlot'
import { AD_SLOTS } from './adSlots'
import { HomeAdBand } from '@/components/home/HomeAdBand'

afterEach(() => {
  cleanup()
  enabled.on = true
  delete (window as { adsbygoogle?: unknown }).adsbygoogle
})

const CLIENT = 'ca-pub-9363381710674627'

describe('AD_SLOTS (docs/team/adsense-units.md)', () => {
  it('홈 2곳 = 고정 320×100 단위의 실제 슬롯 ID', () => {
    expect(AD_SLOTS['home-about']).toEqual({ id: '3366937812', size: { width: 320, height: 100 } })
    expect(AD_SLOTS['home-footer']).toEqual({ id: '5373706948', size: { width: 320, height: 100 } })
  })
})

describe('광고를 켰을 때 HomeAdBand가 그리는 <ins>', () => {
  it.each([
    ['home-about', '3366937812'],
    ['home-footer', '5373706948'],
  ] as const)('%s → data-ad-slot %s, 고정 크기(inline-block 320×100, data-ad-format 없음)', (slot, id) => {
    const { container } = render(<HomeAdBand slot={slot} />)
    const ins = container.querySelectorAll('ins.adsbygoogle')
    expect(ins).toHaveLength(1)
    const el = ins[0] as HTMLElement
    expect(el.getAttribute('data-ad-client')).toBe(CLIENT)
    expect(el.getAttribute('data-ad-slot')).toBe(id)
    expect(el.hasAttribute('data-ad-format')).toBe(false)
    expect(el.hasAttribute('data-full-width-responsive')).toBe(false)
    expect(el.style.display).toBe('inline-block')
    expect(el.style.width).toBe('320px')
    expect(el.style.height).toBe('100px')
    expect(el.classList.contains('block')).toBe(false)
    // 띠가 광고 높이만큼 예약(CLS 0)
    expect((el.parentElement as HTMLElement).style.minHeight).toBe('100px')
    // 로더 큐에 한 번 push
    expect((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle).toHaveLength(1)
  })

  it('단위가 없는 자리(game-incontent)는 켜도 아무것도 그리지 않는다 — 이름 문자열이 data-ad-slot으로 새지 않음', () => {
    const { container } = render(<AdSlot slot="game-incontent" />)
    expect(container).toBeEmptyDOMElement()
    expect((window as { adsbygoogle?: unknown }).adsbygoogle).toBeUndefined()
  })

  it('광고가 꺼지면(adsenseEnabled false) 띠·ins 모두 DOM 0', () => {
    enabled.on = false
    const { container } = render(
      <>
        <HomeAdBand slot="home-about" />
        <AdSlot slot="home-footer" />
      </>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('실제 설정', () => {
  it('승인 전이라 adsenseEnabled는 false', async () => {
    const actual = await vi.importActual<typeof import('@/lib/siteConfig')>('@/lib/siteConfig')
    expect(actual.siteConfig.adsenseEnabled).toBe(false)
  })
})
