import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
const sendHit = vi.fn()
vi.mock('@/lib/hit', () => ({ sendHit: (...a: unknown[]) => sendHit(...a) }))
import { HeroPlayButton, PICKS } from './HeroPlayButton'
import { gamePages } from '@/lib/games/registry'

describe('HeroPlayButton', () => {
  beforeEach(() => {
    push.mockClear()
    sendHit.mockClear()
    vi.restoreAllMocks()
  })
  it('모든 PICKS는 실제 게임 slug', () => {
    for (const s of PICKS) expect(gamePages.map((g) => g.slug), s).toContain(s)
  })
  it('클릭하면 PICKS 중 하나로 이동하고 hero_play를 보낸다', () => {
    render(<HeroPlayButton />)
    fireEvent.click(screen.getByRole('link', { name: /play a game now/i }))
    const slug = push.mock.calls[0][0].slice(1).replace('?ref=hero', '')
    expect(PICKS).toContain(slug)
    expect(sendHit).toHaveBeenCalledWith(slug, 'hero_play')
  })
  it('?ref=hero 태그를 붙여 코호트를 분리한다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<HeroPlayButton />)
    fireEvent.click(screen.getByRole('link', { name: /play a game now/i }))
    expect(push).toHaveBeenCalledWith(`/${PICKS[0]}?ref=hero`)
  })
  it('마지막 인덱스 경계도 유효하다', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999)
    render(<HeroPlayButton />)
    fireEvent.click(screen.getByRole('link', { name: /play a game now/i }))
    expect(push).toHaveBeenCalledWith(`/${PICKS[PICKS.length - 1]}?ref=hero`)
  })
  it('수정키 클릭은 가로채지 않는다', () => {
    render(<HeroPlayButton />)
    const a = screen.getByRole('link', { name: /play a game now/i })
    fireEvent.click(a, { ctrlKey: true })
    expect(push).not.toHaveBeenCalled()
    expect(sendHit).not.toHaveBeenCalled()
    expect(a.getAttribute('href')).toBe('/recoil')
  })
})
