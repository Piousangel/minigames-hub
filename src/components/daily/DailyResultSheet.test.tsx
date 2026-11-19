import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }), usePathname: () => '/plop-landing' }))
vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))
vi.mock('@/app/roundFont', () => ({ roundFont: { className: 'font-round' } })) // next/font/local은 빌드 때만

import { GameNavProvider } from '@/components/GameNav'
import { sendHit } from '@/lib/hit'
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

function Sheet({ open = true, onClose = () => {}, r = result }: { open?: boolean; onClose?: () => void; r?: DailyResult }) {
  return (
    <GameNavProvider slug="plop-landing">
      <button type="button">before</button>
      <DailyResultSheet open={open} onClose={onClose} slug="plop-landing" gameTitle="Plop Landing" result={r} shareText="Plop Landing #3 ✅7 🌸2" leaderboard>
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
    // 광고 0: AdSlot이 그리는 <ins class="adsbygoogle">·광고 띠 라벨이 시트 안에 없다
    const sheetEl = screen.getByTestId(SHEET_TEST_ID)
    expect(sheetEl.querySelector('.adsbygoogle')).toBeNull()
    expect(sheetEl).not.toHaveTextContent(/Advertisement/i)
    expect(screen.getByText('slot')).toBeInTheDocument() // 게임별 칸(리더보드 제출 등)
  })

  it('카운트다운: 다음 UTC 자정까지 hh:mm:ss + 보미 countdown 32px(R6, 시트의 마스코트는 이 1마리)', () => {
    render(<Sheet />)
    expect(screen.getByTestId('sheet-countdown')).toHaveTextContent('Next edition in 14:22:05')
    const slot = screen.getByTestId('sheet-bomi-slot')
    expect(slot.className).toMatch(/h-8 w-8/)
    const imgs = screen.getByTestId(SHEET_TEST_ID).querySelectorAll('img[data-mascot]')
    expect(imgs).toHaveLength(1)
    expect(slot.querySelector('img')).toBe(imgs[0])
    expect(imgs[0]).toHaveAttribute('data-mascot', 'bomi-countdown')
    expect(imgs[0]).toHaveAttribute('width', '32')
    expect(imgs[0]).toHaveAttribute('height', '32')
    expect(imgs[0]).toHaveAttribute('loading', 'lazy')
    expect(imgs[0]).toHaveAttribute('alt', '')
  })

  it('max-height 85dvh + 안쪽 스크롤', () => {
    render(<Sheet />)
    const sheet = screen.getByTestId(SHEET_TEST_ID)
    expect(sheet.style.maxHeight).toBe('85dvh')
    expect(sheet.className).toContain('overflow-y-auto')
  })

  it('열리면 시트로 포커스 + history 칸 1개, Esc는 그 칸을 뒤로 가기로 뺀다(popstate 없이 Esc만)', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    render(<Sheet />)
    const sheet = screen.getByTestId(SHEET_TEST_ID)
    expect(sheet.contains(document.activeElement)).toBe(true)
    expect((window.history.state as Record<string, unknown>).__dailySheet).toBe(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })

  it('Tab은 시트 안에서 돈다: 마지막 → 처음, Shift+Tab 처음 → 마지막', () => {
    render(<Sheet />)
    const sheet = screen.getByTestId(SHEET_TEST_ID)
    const items = [...sheet.querySelectorAll<HTMLElement>('a[href], button')]
    expect(items.length).toBeGreaterThan(2)
    items[items.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(items[items.length - 1])
  })

  it('배경은 inert, 닫히면 풀린다', () => {
    const { rerender } = render(<Sheet />)
    const others = [...document.body.children].filter((n) => !n.querySelector(`[data-testid="${SHEET_TEST_ID}"]`))
    expect(others.length).toBeGreaterThan(0)
    for (const n of others) expect(n).toHaveAttribute('inert')
    rerender(<Sheet open={false} />)
    for (const n of others) expect(n).not.toHaveAttribute('inert')
  })

  it('UI 밖 이유로 닫히면(open=false) 남은 history 칸을 뺀다 — 뒤로 가기 두 번 방지', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const { rerender } = render(<Sheet />)
    rerender(<Sheet open={false} />)
    expect(back).toHaveBeenCalledTimes(1)
    back.mockRestore()
  })

  it('Next game 클릭은 시트 history 칸을 바꿔 끼운다(router.replace), next_show는 판마다 1번', async () => {
    replace.mockClear()
    vi.mocked(sendHit).mockClear()
    const { rerender } = render(<Sheet />)
    const next = await screen.findByTestId('sheet-next-game')
    fireEvent.click(next)
    expect(replace).toHaveBeenCalledWith(next.getAttribute('href'))
    const shows = () => vi.mocked(sendHit).mock.calls.filter((c) => c[1] === 'next_show').length
    expect(shows()).toBe(1)
    rerender(<Sheet open={false} />)
    rerender(<Sheet open />) // 'Today’s result'로 다시 열기 — 같은 판
    expect(shows()).toBe(1)
    rerender(<Sheet open r={{ ...result, primary: { label: 'points', value: 60 } }} />) // 새 판
    expect(shows()).toBe(2)
  })

  it('데스크톱 Share: 문구+URL 복사 → "Copied", 채널 줄 펼침', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    render(<Sheet />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('sheet-share'))
    })
    expect(write).toHaveBeenCalledWith(expect.stringMatching(/Plop Landing #3[\s\S]*Today's garden 0\/3 · No\. 126\nhttps:\/\/quickminigames\.site\/plop-landing\?ref=share-native$/))
    expect(screen.getByText('Copied — paste it anywhere.')).toBeInTheDocument()
    expect(screen.getByTestId('share-buttons')).toBeInTheDocument()
  })

  it('복사가 막히면 "Copy was blocked" + 채널 줄', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true })
    render(<Sheet />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('sheet-share'))
    })
    expect(screen.getByText('Copy was blocked — pick an app below.')).toBeInTheDocument()
    expect(screen.getByTestId('share-buttons')).toBeInTheDocument()
  })

  it('리더보드 링크(옛 오버레이의 See this week’s leaderboard)', () => {
    render(<Sheet />)
    expect(screen.getByTestId('sheet-leaderboard')).toHaveAttribute('href', '#leaderboard')
  })

  it('큰 숫자가 5글자 이상이면 24px로 줄인다(360 세 칸)', () => {
    render(<Sheet r={{ ...result, secondary: { label: 'height', value: '1024 m' } }} />)
    const dd = screen.getByText('1024 m')
    expect(dd.className).toContain('text-[24px]')
    expect(screen.getByText('58').className).toContain('text-[32px]')
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
