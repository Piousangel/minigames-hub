import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareButtons } from './ShareButtons'

vi.mock('@/lib/hit', () => ({ sendHit: vi.fn() }))
import { sendHit } from '@/lib/hit'

function setNav(share: unknown, writeText = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

describe('ShareButtons', () => {
  beforeEach(() => vi.mocked(sendHit).mockClear())
  afterEach(() => vi.restoreAllMocks())

  it('Threads·Facebook은 채널 ref가 붙은 URL로 새 창을 열고 클릭을 계측한다', () => {
    setNav(undefined)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ShareButtons slug="snake" title="Snake" description="eat" />)
    fireEvent.click(screen.getByTestId('share-threads'))
    fireEvent.click(screen.getByTestId('share-facebook'))
    expect(decodeURIComponent(String(open.mock.calls[0][0]))).toContain('/snake?ref=share-threads')
    expect(decodeURIComponent(String(open.mock.calls[1][0]))).toContain('/snake?ref=share-facebook')
    expect(sendHit).toHaveBeenCalledWith('snake', 'share_threads')
    expect(sendHit).toHaveBeenCalledWith('snake', 'share_facebook')
  })

  it('공유창이 없으면 Kakao는 문구+URL을, Copy link는 URL만 복사한다', async () => {
    const write = setNav(undefined)
    render(<ShareButtons slug="snake" title="Snake" description="eat" />)
    expect(screen.queryByTestId('share-native')).toBeNull()
    await act(async () => fireEvent.click(screen.getByTestId('share-kakao')))
    expect(write).toHaveBeenLastCalledWith('Snake — eat\nhttps://quickminigames.site/snake?ref=share-kakao')
    await act(async () => fireEvent.click(screen.getByTestId('share-copy')))
    expect(write).toHaveBeenLastCalledWith('https://quickminigames.site/snake?ref=share-copy')
  })

  it('공유창이 AbortError면 조용히 끝나고, 다른 오류면 복사로 넘어간다', async () => {
    const share = vi.fn().mockRejectedValueOnce(new DOMException('x', 'AbortError')).mockRejectedValueOnce(new Error('boom'))
    const write = setNav(share)
    render(<ShareButtons slug="snake" title="Snake" />)
    await act(async () => fireEvent.click(screen.getByTestId('share-instagram')))
    expect(write).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByTestId('share-instagram')))
    expect(write).toHaveBeenCalledTimes(1)
  })
})
