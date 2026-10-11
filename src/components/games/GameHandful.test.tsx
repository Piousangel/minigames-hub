import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameHandful } from './GameHandful'

const STORAGE_KEY = 'best:handful'

// Cold first render (module import + jsdom) can exceed the 5s default under a
// loaded parallel run; give the suite headroom so it doesn't flake.
describe('GameHandful — scoring v2 migration', { timeout: 20000 }, () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('drops a best recorded under the old (exploitable) scoring so it is comparable again', async () => {
    localStorage.setItem(STORAGE_KEY, '368')
    render(<GameHandful storageKey={STORAGE_KEY} />)
    await screen.findByTestId('handful-board')
    expect(screen.getByTestId('score')).toHaveTextContent('0')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('handful:scoring')).toBe('2')
  })

  it('migration keeps the daily streak (stored under its own key)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(STORAGE_KEY, '368')
    localStorage.setItem('handful:daily', JSON.stringify({ lastDate: today, streak: 4 }))
    render(<GameHandful storageKey={STORAGE_KEY} />)
    await screen.findByTestId('handful-board')
    expect(document.body).toHaveTextContent('Streak 4')
    expect(JSON.parse(localStorage.getItem('handful:daily') ?? '{}').streak).toBe(4)
  })

  it('keeps a best recorded under the current scoring', async () => {
    localStorage.setItem('handful:scoring', '2')
    localStorage.setItem(STORAGE_KEY, '57')
    render(<GameHandful storageKey={STORAGE_KEY} />)
    await screen.findByTestId('handful-board')
    expect(screen.getByTestId('score')).toHaveTextContent('57')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('57')
  })

  it('a fresh basket starts at a small handful (3), not maxGrab', async () => {
    render(<GameHandful storageKey={STORAGE_KEY} />)
    await screen.findByTestId('handful-board')
    expect(screen.getByRole('button', { name: /GRAB/ })).toHaveTextContent('GRAB ×3')
  })
})
