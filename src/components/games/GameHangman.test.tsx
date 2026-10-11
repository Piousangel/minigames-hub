import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { newGame } from '@/lib/games/hangman/engine'
import { GameHangman } from './GameHangman'

const STORAGE_KEY = 'best:hangman'

describe('GameHangman board animation', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a wrong guess shakes the board without remounting drawn parts or revealed letters', () => {
    const word = newGame(() => 0).word
    const hitLetter = word[0]
    const missLetters = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((l) => !word.includes(l))

    render(<GameHangman storageKey={STORAGE_KEY} />)

    fireEvent.click(screen.getByTestId(`hangman-key-${hitLetter}`))
    fireEvent.click(screen.getByTestId(`hangman-key-${missLetters[0]}`))

    const board = screen.getByTestId('hangman-board')
    const revealed = screen.getByTestId('hangman-word').querySelector('.hm-slot-reveal')
    const head = screen.getByTestId('hangman-figure').querySelector('.hm-part')
    expect(revealed).not.toBeNull()
    expect(head).not.toBeNull()

    fireEvent.click(screen.getByTestId(`hangman-key-${missLetters[1]}`))

    // Same DOM nodes → their entry animations do not replay.
    expect(screen.getByTestId('hangman-board')).toBe(board)
    expect(screen.getByTestId('hangman-word').querySelector('.hm-slot-reveal')).toBe(revealed)
    expect(screen.getByTestId('hangman-figure').querySelector('.hm-part')).toBe(head)
    expect(screen.getByTestId('hangman-figure').querySelectorAll('.hm-part')).toHaveLength(2)
    // The shake still fires on the miss.
    expect(board.classList.contains('anim-shake')).toBe(true)
  })
})
