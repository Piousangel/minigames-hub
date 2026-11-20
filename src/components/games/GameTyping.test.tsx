import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))
// 단어를 고정해 'the '만 치면 되게 한다(채점 규칙은 실제 엔진 그대로).
vi.mock('@/lib/games/typing/engine', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/games/typing/engine')>()
  return { ...real, sampleWords: (count: number) => Array.from({ length: count }, () => 'the') }
})

import { GameTyping } from './GameTyping'

const KEY = 'best:typing-test'

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

/** 'the ' n번 = 정타 4자 × n → 60초 기준 WPM = round(4n/5). */
function typeWords(n: number) {
  const input = screen.getByTestId('typing-input')
  for (let i = 0; i < n; i++) {
    fireEvent.change(input, { target: { value: 'the' } })
    fireEvent.change(input, { target: { value: 'the ' } })
  }
}

function finishRound() {
  for (let i = 0; i < 70 && !screen.queryByTestId('typing-results'); i++) advance(1000)
}

describe('GameTyping', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('진행 중 WPM은 3초 전엔 —, 그 뒤엔 실제 경과 기준 숫자', () => {
    render(<GameTyping storageKey={KEY} />)
    typeWords(5) // 20 정타
    expect(screen.getByTestId('wpm').textContent).toBe('—')
    advance(4000)
    // 20자 / 5 / (4초/60) = 60
    expect(screen.getByTestId('wpm').textContent).toBe('60')
  })

  it('최고보다 낮으면 결과에 모자란 차이를 보여 주고 최고는 그대로', () => {
    localStorage.setItem(KEY, '50')
    render(<GameTyping storageKey={KEY} />)
    typeWords(25) // 100자 → 20 WPM
    finishRound()
    expect(screen.getByTestId('typing-results').textContent).toContain('20 WPM')
    expect(screen.getByTestId('typing-best-compare').textContent).toBe('30 WPM short of your best 50')
    expect(localStorage.getItem(KEY)).toBe('50')
  })

  it('저장된 최고가 있으면 결과 덮개가 한 프레임도 First record를 그리지 않는다', () => {
    localStorage.setItem(KEY, '50')
    // 동기 act 사이엔 관찰 콜백이 돌지 않으니 기록을 모아 본다: 바뀌기 전 글자(oldValue)·지워진 노드·더해진 노드 모두.
    const mo = new MutationObserver(() => {})
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, characterDataOldValue: true })
    render(<GameTyping storageKey={KEY} />)
    typeWords(25)
    finishRound()
    const seen = mo
      .takeRecords()
      .flatMap((r) => [r.oldValue ?? '', ...[...r.addedNodes, ...r.removedNodes].map((n) => n.textContent ?? '')])
    mo.disconnect()
    expect(seen.some((t) => t.includes('WPM short of your best'))).toBe(true)
    expect(seen.some((t) => t.includes('First record'))).toBe(false)
    expect(screen.getByTestId('typing-best-compare').textContent).toBe('30 WPM short of your best 50')
  })

  it('신기록이면 직전 최고 대비 +차이를 보여 주고 저장한다', () => {
    localStorage.setItem(KEY, '10')
    render(<GameTyping storageKey={KEY} />)
    typeWords(25) // 20 WPM
    finishRound()
    expect(screen.getByTestId('typing-best-compare').textContent).toBe('New best! +10 over 10')
    expect(localStorage.getItem(KEY)).toBe('20')
  })

  it('첫 기록이면 첫 기록 문구', () => {
    render(<GameTyping storageKey={KEY} />)
    typeWords(25)
    finishRound()
    expect(screen.getByTestId('typing-best-compare').textContent).toBe('First record — now beat it')
    expect(localStorage.getItem(KEY)).toBe('20')
  })

  it('단어 판을 누르면 입력칸에 포커스', () => {
    render(<GameTyping storageKey={KEY} />)
    const input = screen.getByTestId('typing-input')
    input.blur()
    expect(document.activeElement).not.toBe(input)
    fireEvent.click(screen.getByTestId('typing-words'))
    expect(document.activeElement).toBe(input)
  })
})
