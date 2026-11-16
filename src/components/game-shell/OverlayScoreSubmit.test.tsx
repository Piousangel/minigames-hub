import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OverlayScoreSubmit, readBestScore } from './OverlayScoreSubmit'

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

  it('shows nothing without a saved name or a best', () => {
    localStorage.setItem('best:snake', '10')
    const { container } = render(<OverlayScoreSubmit slug="snake" show />)
    expect(container).toBeEmptyDOMElement()
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
