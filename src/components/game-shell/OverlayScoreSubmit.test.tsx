import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OverlayScoreSubmit, readBestScore } from './OverlayScoreSubmit'
import { MAX_NAME_LEN } from '@/lib/leaderboard'

describe('OverlayScoreSubmit', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('readBestScore applies SCORE_SCALE and floors', () => {
    localStorage.setItem('best:aim-trainer', '3.26')
    expect(readBestScore('aim-trainer')).toBe(32)
    expect(readBestScore('snake')).toBe(0)
  })

  it('shows nothing without a best', () => {
    localStorage.setItem('lb:name', 'Ann')
    const { container } = render(<OverlayScoreSubmit slug="snake" show />)
    expect(container).toBeEmptyDOMElement()
  })

  it('without a saved name shows a name input, submits, and saves the name', async () => {
    localStorage.setItem('best:snake', '10')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(<OverlayScoreSubmit slug="snake" show />)
    const input = await screen.findByTestId('overlay-submit-name')
    const button = screen.getByTestId('overlay-submit')
    expect(button).toBeDisabled() // 빈 이름으로는 제출 불가
    expect(input).toHaveAttribute('maxLength', String(MAX_NAME_LEN))
    expect(document.activeElement).not.toBe(input) // 자동 포커스로 게임 재시작 키를 삼키지 않음
    fireEvent.change(input, { target: { value: '  Bo  ' } })
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByTestId('overlay-submit-done')).toBeInTheDocument())
    const scoreCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/score'))
    expect(scoreCalls).toHaveLength(1)
    expect(JSON.parse(scoreCalls[0][1].body)).toEqual({ game: 'snake', name: 'Bo', score: 10 })
    expect(localStorage.getItem('lb:name')).toBe('Bo')
    expect(localStorage.getItem('submitted:snake')).toBe('10')
    const hits = fetchMock.mock.calls.map((c) => String(c[0]) + ' ' + String(c[1]?.body ?? ''))
    expect(hits.some((h) => h.includes('lb_submit_overlay'))).toBe(true)
  })

  it('submits from the name input with Enter (form submit)', async () => {
    localStorage.setItem('best:snake', '10')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(<OverlayScoreSubmit slug="snake" show />)
    fireEvent.change(await screen.findByTestId('overlay-submit-name'), { target: { value: 'Cy' } })
    fireEvent.submit(screen.getByTestId('overlay-submit-form'))
    await waitFor(() => expect(screen.getByTestId('overlay-submit-done')).toBeInTheDocument())
  })

  it('typing in the name input does not reach window game key handlers', async () => {
    localStorage.setItem('best:snake', '10')
    const onKey = vi.fn()
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    document.addEventListener('keydown', onKey)
    try {
      render(<OverlayScoreSubmit slug="snake" show />)
      const input = await screen.findByTestId('overlay-submit-name')
      for (const key of ['ArrowUp', 'ArrowLeft', ' ', 'w', 'r', 'Enter']) {
        fireEvent.keyDown(input, { key })
        fireEvent.keyUp(input, { key })
      }
      expect(onKey).not.toHaveBeenCalled()
      // 대조군: 입력창 밖 키는 그대로 게임에 전달된다.
      fireEvent.keyDown(document.body, { key: 'ArrowUp' })
      expect(onKey).toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      document.removeEventListener('keydown', onKey)
    }
  })

  it('with a saved name is one click and offers a rename link', async () => {
    localStorage.setItem('best:snake', '42')
    localStorage.setItem('lb:name', 'Ann')
    render(<OverlayScoreSubmit slug="snake" show />)
    expect(await screen.findByTestId('overlay-submit')).toHaveTextContent('as Ann')
    expect(screen.queryByTestId('overlay-submit-name')).toBeNull()
    fireEvent.click(screen.getByTestId('overlay-submit-rename'))
    expect(screen.getByTestId('overlay-submit-name')).toHaveValue('Ann')
  })

  it('submits once, records submitted score, then hides the button', async () => {
    localStorage.setItem('best:snake', '42')
    localStorage.setItem('lb:name', 'Ann')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(<OverlayScoreSubmit slug="snake" show />)
    fireEvent.click(await screen.findByTestId('overlay-submit'))
    await waitFor(() => expect(screen.getByTestId('overlay-submit-done')).toBeInTheDocument())
    const scoreCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/score'))
    expect(scoreCalls).toHaveLength(1)
    expect(JSON.parse(scoreCalls[0][1].body)).toEqual({ game: 'snake', name: 'Ann', score: 42 })
    expect(localStorage.getItem('submitted:snake')).toContain('42')
  })

  it('does not offer a score already submitted', () => {
    localStorage.setItem('best:snake', '42')
    localStorage.setItem('lb:name', 'Ann')
    localStorage.setItem('submitted:snake', '42')
    const { container } = render(<OverlayScoreSubmit slug="snake" show />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps the button and shows an error when the API fails', async () => {
    localStorage.setItem('best:snake', '42')
    localStorage.setItem('lb:name', 'Ann')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    render(<OverlayScoreSubmit slug="snake" show />)
    fireEvent.click(await screen.findByTestId('overlay-submit'))
    await waitFor(() => expect(screen.getByText(/Couldn't submit/)).toBeInTheDocument())
    expect(screen.getByTestId('overlay-submit')).toBeInTheDocument()
  })
})
