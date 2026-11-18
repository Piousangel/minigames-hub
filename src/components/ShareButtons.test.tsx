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

  it('Threads·Facebook은 채널 ref가 붙은 진짜 링크(새 탭)이고 클릭을 계측한다', () => {
    setNav(undefined)
    render(<ShareButtons slug="snake" title="Snake" description="eat" />)
    const t = screen.getByTestId('share-threads') as HTMLAnchorElement
    const f = screen.getByTestId('share-facebook') as HTMLAnchorElement
    expect(decodeURIComponent(t.href)).toContain('/snake?ref=share-threads')
    expect(decodeURIComponent(f.href)).toContain('/snake?ref=share-facebook')
    expect(t.target).toBe('_blank')
    expect(t.rel).toContain('noopener')
    fireEvent.click(t)
    fireEvent.click(f)
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

  it('클립보드 API가 거부돼도 execCommand 폴백으로 복사하고, 둘 다 막히면 링크를 화면에 보여 준다', async () => {
    const write = vi.fn().mockRejectedValue(new Error('denied'))
    setNav(undefined, write)
    const exec = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false)
    ;(document as unknown as { execCommand: unknown }).execCommand = exec
    render(<ShareButtons slug="snake" title="Snake" />)
    await act(async () => fireEvent.click(screen.getByTestId('share-copy')))
    expect(exec).toHaveBeenCalledWith('copy')
    expect(screen.queryByTestId('share-manual')).toBeNull()
    await act(async () => fireEvent.click(screen.getByTestId('share-copy')))
    const input = screen.getByTestId('share-manual') as HTMLInputElement
    expect(input.value).toBe('https://quickminigames.site/snake?ref=share-copy')
  })

  it('결과 문구(text)를 주면 그 문구가 공유되고, compact 모드는 제목·시스템 공유 버튼이 없다', async () => {
    const write = setNav(vi.fn())
    render(<ShareButtons compact slug="plop-landing" title="Plop Landing" text="Plop Landing #1 ✅12 🌸7" />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByTestId('share-native')).toBeNull()
    const t = screen.getByTestId('share-threads') as HTMLAnchorElement
    expect(decodeURIComponent(t.href)).toContain('Plop Landing #1 ✅12 🌸7 https://quickminigames.site/plop-landing?ref=share-threads')
    await act(async () => fireEvent.click(screen.getByTestId('share-copy')))
    expect(write).toHaveBeenLastCalledWith('https://quickminigames.site/plop-landing?ref=share-copy')
  })
})
