import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameStats } from './GameStats'
import { statsKey } from '@/lib/gameStats'

describe('GameStats (Your stats 패널)', () => {
  beforeEach(() => localStorage.clear())

  it('완료 기록이 없으면 아무것도 안 그린다', () => {
    render(<GameStats slug="minesweeper" />)
    expect(screen.queryByTestId('game-stats')).not.toBeInTheDocument()
  })

  it('승패 게임은 Played + Win %를 보여준다', () => {
    localStorage.setItem(statsKey('minesweeper'), JSON.stringify({ plays: 4, wins: 1 }))
    render(<GameStats slug="minesweeper" />)
    expect(screen.getByTestId('game-stats')).toBeInTheDocument()
    expect(screen.getByText('Played')).toBeInTheDocument()
    expect(screen.getByText('Win %')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('endless 게임은 Win %를 숨기고 Played + Best만 — 레거시 wins가 있어도', () => {
    localStorage.setItem(statsKey('snake'), JSON.stringify({ plays: 3, wins: 3 }))
    localStorage.setItem('best:snake', '42')
    render(<GameStats slug="snake" />)
    expect(screen.getByText('Played')).toBeInTheDocument()
    expect(screen.queryByText('Win %')).not.toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})
