import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { Reactions } from './Reactions'

// 00시 QA 11-19: 200 응답인데 counts가 없으면 counts[emoji]에서 터져 게임 페이지 전체가
// "Application error"로 바뀌었다. 깨진 응답은 숨김 처리, 정상 응답은 그대로 보여야 한다.
function mockFetch(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
}

describe('Reactions — 깨진 API 응답 방어', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('counts가 없는 200 응답이면 크래시 없이 숨긴다', async () => {
    mockFetch({})
    const { container } = render(<Reactions slug="slime-slide" />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(container.querySelector('[data-testid="reactions"]')).toBeNull()
  })

  it('정상 응답이면 버튼과 숫자를 보여 준다', async () => {
    mockFetch({ counts: { '🔥': 3, '😂': 0, '😭': 0, '💀': 0 } })
    render(<Reactions slug="slime-slide" />)
    await waitFor(() => expect(screen.getByTestId('reactions')).toBeInTheDocument())
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
