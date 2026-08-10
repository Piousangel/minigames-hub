import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Comments } from './Comments'

function mockFetchSequence(handlers: Array<(url: string, init?: RequestInit) => Response | Promise<Response>>) {
  let i = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const h = handlers[Math.min(i, handlers.length - 1)]
      i++
      return h(url, init)
    }),
  )
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('Comments', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders existing comments and posts a new one', async () => {
    mockFetchSequence([
      () => jsonResponse({ comments: [{ name: 'Alice', text: 'fun game', createdAt: 1 }] }),
      () =>
        jsonResponse({
          comments: [
            { name: 'Bob', text: 'me too', createdAt: 2 },
            { name: 'Alice', text: 'fun game', createdAt: 1 },
          ],
        }),
    ])

    render(<Comments slug="snake" />)
    await screen.findByTestId('comments')
    expect(screen.getByText('fun game')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Your name'), 'Bob')
    await user.type(screen.getByLabelText('Your comment'), 'me too')
    await user.click(screen.getByRole('button', { name: 'Post' }))

    await waitFor(() => expect(screen.getByText('me too')).toBeInTheDocument())
    // 제출 폼이 비워짐
    expect(screen.getByLabelText('Your comment')).toHaveValue('')
  })

  it('shows a rate-limit message on 429 without clearing the draft', async () => {
    mockFetchSequence([
      () => jsonResponse({ comments: [] }),
      () => jsonResponse({ error: 'slow down' }, 429),
    ])

    render(<Comments slug="snake" />)
    await screen.findByTestId('comments')

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Your comment'), 'again')
    await user.click(screen.getByRole('button', { name: 'Post' }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText('Your comment')).toHaveValue('again')
  })

  it('shows a link-specific message when the server rejects a link', async () => {
    mockFetchSequence([
      () => jsonResponse({ comments: [] }),
      () => jsonResponse({ error: 'links not allowed' }, 400),
    ])

    render(<Comments slug="snake" />)
    await screen.findByTestId('comments')

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Your comment'), 'visit www.spam.com')
    await user.click(screen.getByRole('button', { name: 'Post' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Links aren’t allowed')
  })

  it('does not render when the comments API is unavailable', async () => {
    mockFetchSequence([() => Promise.reject(new Error('network error'))])
    const { container } = render(<Comments slug="snake" />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
