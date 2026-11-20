import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TodayVisitors } from './TodayVisitors'

function mockFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}
afterEach(() => vi.unstubAllGlobals())

describe('TodayVisitors', () => {
  it('10 이상이면 숫자와 UTC 기준을 보여 준다', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ today: 42, yesterday: 30 }) }))
    render(<TodayVisitors />)
    await waitFor(() => expect(screen.getByTestId('today-visitors').textContent).toContain('Today in the garden: 42 visitors'))
    expect(screen.getByTestId('today-visitors').textContent).toContain('00:00 UTC')
  })
  it('10 미만이면 숫자 대신 문장', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ today: 3 }) }))
    render(<TodayVisitors />)
    await waitFor(() => expect(screen.getByTestId('today-visitors').textContent).toContain('First visitors of the day'))
    expect(screen.getByTestId('today-visitors').textContent).not.toMatch(/\d+ visitors/)
  })
  it('실패·null이면 줄은 비어 있지만 높이는 그대로(h-5)', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ today: null }) }))
    render(<TodayVisitors />)
    const p = screen.getByTestId('today-visitors')
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(p.textContent).toBe('')
    expect(p.className).toContain('h-5')
    expect(p.getAttribute('aria-hidden')).toBe('true')
  })
  it('네트워크 오류도 조용히 빈 줄', async () => {
    mockFetch(async () => {
      throw new Error('offline')
    })
    render(<TodayVisitors />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.getByTestId('today-visitors').textContent).toBe('')
  })
})
