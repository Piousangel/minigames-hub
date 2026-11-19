import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/plop-landing' }))
vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))
vi.mock('@/app/roundFont', () => ({ roundFont: { className: 'font-round' } })) // next/font/local은 빌드 때만

import { GameNavProvider } from '@/components/GameNav'
import { doneKey, recordDone, type DailyResult } from '@/lib/daily/result'
import { DailyResultSheet, SHEET_TEST_ID, sheetShareText } from './DailyResultSheet'
import { editionFor } from '@/lib/home/edition'
import { FIRST_GARDEN } from '@/lib/home/garden'

const NOW = new Date('2026-11-20T09:37:55Z') // 다음 호까지 14:22:05
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const result: DailyResult = { slug: 'plop-landing', primary: { label: 'points', value: 58 }, secondary: { label: 'islands', value: '7' }, streak: 3, bloomed: true }

function done(slug: string) {
  const day = slug === 'slime-slide' ? localDay(NOW) : '2026-11-20'
  recordDone(localStorage, { slug, day, primary: { label: 'points', value: 10 } })
}

function Sheet({ open = true, onClose = () => {} }: { open?: boolean; onClose?: () => void }) {
  return (
    <GameNavProvider slug="plop-landing">
      <button type="button">before</button>
      <DailyResultSheet open={open} onClose={onClose} slug="plop-landing" gameTitle="Plop Landing" result={result} shareText="Plop Landing #3 ✅7 🌸2">
        <p>slot</p>
      </DailyResultSheet>
    </GameNavProvider>
  )
}

/** 행동 색 sun(#ffc933) 면 = bg-garden-sun 클래스(시트 안). 꽃 아이콘의 #ffd966은 장식이라 세지 않는다. */
const sunButtons = () => [...document.body.querySelectorAll<HTMLElement>('*')].filter((el) => /(^|\s)bg-garden-sun(\s|$)/.test(el.getAttribute('class') ?? ''))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

describe('DailyResultSheet', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    render(<Sheet open={false} />)
    expect(screen.queryByTestId(SHEET_TEST_ID)).toBeNull()
  })

  it('3/3이면 "Today’s garden is full." + 꽃 3송이', () => {
    done('slime-slide')
    done('plop-landing')
    done('acorn-hop')
    render(<Sheet />)
    const sheet = screen.getByTestId(SHEET_TEST_ID)
    expect(sheet).toHaveAttribute('role', 'dialog')
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Today’s garden is full.')
    expect(screen.getByTestId('sheet-garden')).toHaveAccessibleName("Today's garden: 3 of 3 bloomed")
    expect(sheet).toHaveAttribute('data-full', 'true')
  })

  it('진행 중이면 "is growing." + n of 3', () => {
    done('plop-landing')
    render(<Sheet />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Today’s garden is growing.')
    expect(screen.getByTestId('sheet-garden')).toHaveAccessibleName("Today's garden: 1 of 3 bloomed")
  })

  it('primary·secondary·streak 숫자(coral-text) + 노란 버튼은 Share 하나 + 시트 안 광고 없음', () => {
    render(<Sheet />)
    const stats = screen.getByTestId('sheet-stats')
    expect(stats).toHaveTextContent('58')
    expect(stats).toHaveTextContent('points')
    expect(stats).toHaveTextContent('7')
    expect(stats).toHaveTextContent('islands')
    expect(screen.getByTestId('sheet-streak')).toHaveTextContent('3')
    expect(screen.getByTestId('sheet-streak').className).toContain('text-garden-coral-text')
    const sun = sunButtons()
    expect(sun).toHaveLength(1)
    expect(sun[0]).toBe(screen.getByTestId('sheet-share'))
    expect(screen.getByTestId(SHEET_TEST_ID).querySelector('ins.adsbygoogle, [data-ad-slot], [data-testid^="ad-"]')).toBeNull()
    expect(screen.getByText('slot')).toBeInTheDocument() // 게임별 칸(리더보드 제출 등)
  })

  it('카운트다운: 다음 UTC 자정까지 hh:mm:ss + 보미 자리 32px(비어 있음)', () => {
    render(<Sheet />)
    expect(screen.getByTestId('sheet-countdown')).toHaveTextContent('Next edition in 14:22:05')
    expect(screen.getByTestId('sheet-bomi-slot').className).toMatch(/h-8 w-8/)
    expect(screen.getByTestId('sheet-bomi-slot')).toBeEmptyDOMElement()
  })

  it('max-height 85dvh + 안쪽 스크롤', () => {
    render(<Sheet />)
    const sheet = screen.getByTestId(SHEET_TEST_ID)
    expect(sheet.style.maxHeight).toBe('85dvh')
    expect(sheet.className).toContain('overflow-y-auto')
  })

  it('열리면 시트로 포커스, Esc로 닫힌다(onClose)', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const sheet = screen.getByTestId(SHEET_TEST_ID)
    expect(sheet.contains(document.activeElement)).toBe(true)
    act(() => {
      // pushState로 넣은 칸이 맨 위 — 닫기는 history.back()(popstate가 onClose)
      fireEvent.keyDown(document, { key: 'Escape' })
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Tab은 시트 안에서 돈다(마지막 → 처음)', () => {
    render(<Sheet />)
    const sheet = screen.getByTestId(SHEET_TEST_ID)
    const items = [...sheet.querySelectorAll<HTMLElement>('a[href], button')]
    items[items.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    // jsdom은 offsetParent가 늘 null이라 거름 없이 첫 칸으로 간다
    expect(sheet.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(screen.getByText('before'))
  })

  it('브라우저 뒤로 가기(popstate)로 닫힌다', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('공유 문구 = 게임 원래 문구 + 정원·호수, 개인 정보(이름·기기 id) 없음', () => {
    localStorage.setItem('lb:name', 'Minsu')
    localStorage.setItem('vid', 'abc-123')
    const text = sheetShareText('Plop Landing #3 ✅7 🌸2', FIRST_GARDEN, editionFor(NOW))
    expect(text).toBe('Plop Landing #3 ✅7 🌸2\nToday\'s garden 0/3 · No. 126')
    expect(text).not.toMatch(/Minsu|abc-123/)
  })

  it('완료 키를 남긴 게임은 시트가 열린 채로 garden:done 이벤트에 꽃이 핀다', () => {
    render(<Sheet />)
    expect(screen.getByTestId('sheet-garden')).toHaveAccessibleName("Today's garden: 0 of 3 bloomed")
    act(() => {
      localStorage.setItem(doneKey('2026-11-20', 'acorn-hop'), JSON.stringify({ slug: 'acorn-hop', day: '2026-11-20', primary: { label: 'points', value: 1 }, streak: 1, bloomed: true }))
      window.dispatchEvent(new CustomEvent('garden:done'))
    })
    expect(screen.getByTestId('sheet-garden')).toHaveAccessibleName("Today's garden: 1 of 3 bloomed")
  })
})
