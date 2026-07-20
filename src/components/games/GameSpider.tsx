'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Card,
  type State,
  type Suit,
  type SuitCount,
  canLand,
  canMoveRun,
  createGame,
  dealFromStock,
  moveRun,
  score as scoreOf,
} from '@/lib/games/spider/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { recordResult } from '@/lib/gameStats'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// -- card presentation -------------------------------------------------------

const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
const RANK_LABEL = (r: number): string =>
  r === 1 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r)

function isRedSuit(s: Suit): boolean {
  return s === 'H' || s === 'D'
}

/** Random-free seed for a "New deal": OK in the COMPONENT (never in the engine). */
function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const DIFFICULTIES: { count: SuitCount; label: string }[] = [
  { count: 1, label: '1 suit' },
  { count: 2, label: '2 suit' },
  { count: 4, label: '4 suit' },
]

// Selection: a source column + start index awaiting a destination click.
type Sel = { col: number; index: number } | null

// Card face — light face so suit colours read; red suits red, black suits ink.
function CardFace({ card, dim }: { card: Card; dim?: boolean }) {
  const red = isRedSuit(card.suit)
  return (
    <div
      className="flex h-full w-full flex-col justify-between rounded-[0.35rem] border px-1 py-0.5 leading-none"
      style={{
        background: dim ? '#c7c9d6' : '#f4f5fb',
        borderColor: 'rgba(0,0,0,0.25)',
        color: red ? '#d81f3a' : '#1b2130',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5)',
      }}
    >
      <span className="text-[0.62rem] font-extrabold sm:text-[0.8rem]">
        {RANK_LABEL(card.rank)}
        <span className="ml-[1px]">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span className="self-end text-[0.62rem] sm:text-sm" aria-hidden="true">
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  )
}

function CardBack() {
  return (
    <div
      className="h-full w-full rounded-[0.35rem] border"
      style={{
        borderColor: 'var(--neon-cyan)',
        background:
          'repeating-linear-gradient(45deg, rgba(34,211,238,0.28) 0 6px, rgba(139,92,246,0.28) 6px 12px)',
        boxShadow: 'inset 0 0 8px rgba(34,211,238,0.35)',
      }}
    />
  )
}

// A fixed card footprint. Tuned to fit 10 columns on small screens.
const CARD_W = 'w-[1.85rem] sm:w-[2.6rem]'
const CARD_H = 'h-[2.6rem] sm:h-[3.6rem]'

/** Length of the largest legal movable run whose TOP is tableau[col][index]. */
function runLenAt(state: State, col: number, index: number): number {
  const cards = state.tableau[col].slice(index)
  return canMoveRun(cards) ? cards.length : 0
}

export function GameSpider({ storageKey }: { storageKey: string }) {
  // SSR safety: build the deal on the client only (never Date/random in render).
  const [state, setState] = useState<State | null>(null)
  const [history, setHistory] = useState<State[]>([])
  const [sel, setSel] = useState<Sel>(null)
  const [best, setBest] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [difficulty, setDifficulty] = useState<SuitCount>(1)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const prevOverRef = useRef(false)
  const startRef = useRef(0)
  const difficultyRef = useRef<SuitCount>(1)
  const slug = storageKey.replace(/^best:/, '')

  const commit = useCallback((next: State) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Bootstrap (client only).
  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0)
    prevOverRef.current = false
    startRef.current = Date.now()
    difficultyRef.current = 1
    setDifficulty(1)
    setHistory([])
    setSel(null)
    setElapsed(0)
    commit(createGame(freshSeed(), 1))
  }, [storageKey, commit])

  // Display-only timer (component-owned; NOT part of the pure engine).
  useEffect(() => {
    if (!state || state.status !== 'playing') return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [state])

  const persistWin = useCallback(
    (next: State) => {
      const s = scoreOf(next)
      const stored = Number(localStorage.getItem(storageKey))
      const prev = Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
      if (s > prev) {
        try {
          localStorage.setItem(storageKey, String(s)) // PLAIN NUMBER — leaderboard reads Number()
        } catch {
          /* storage unavailable */
        }
        setBest(s)
      }
      // Spider has no hard "lose": we only record an actual win.
      recordResult(slug, { won: true })
    },
    [storageKey, slug],
  )

  /** Apply a computed next-state. Same ref ⇒ illegal ⇒ error + deselect. */
  const apply = useCallback(
    (next: State, forced?: 'move' | 'flip'): boolean => {
      const prev = stateRef.current
      if (!prev) return false
      if (next === prev) {
        play('error')
        setSel(null)
        return false
      }
      setHistory((h) => [...h, prev])
      commit(next)
      setSel(null)

      const won = next.status === 'won' && !prevOverRef.current
      if (!won) {
        if (next.completed > prev.completed) play('match')
        else if (forced) play(forced)
        else play('move')
      }
      if (won) {
        prevOverRef.current = true
        play('win')
        persistWin(next)
      }
      return true
    },
    [commit, play, persistWin],
  )

  const startDeal = useCallback(
    (count: SuitCount) => {
      prevOverRef.current = false
      startRef.current = Date.now()
      difficultyRef.current = count
      setDifficulty(count)
      setHistory([])
      setSel(null)
      setElapsed(0)
      commit(createGame(freshSeed(), count))
    },
    [commit],
  )

  const newDeal = useCallback(() => {
    startDeal(difficultyRef.current)
  }, [startDeal])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      commit(prev)
      prevOverRef.current = prev.status === 'won'
      setSel(null)
      play('flip')
      return h.slice(0, -1)
    })
  }, [commit, play])

  // -- interactions ----------------------------------------------------------

  const onStock = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    apply(dealFromStock(s), 'flip')
  }, [apply])

  const onColumn = useCallback(
    (col: number, index: number) => {
      const s = stateRef.current
      if (!s) return
      if (!sel) {
        // Selecting a source: only if this card heads a legal movable run.
        if (runLenAt(s, col, index) > 0) setSel({ col, index })
        else play('error')
        return
      }
      if (sel.col === col) {
        // Re-target within the same column, or deselect on the same card.
        if (sel.index === index) setSel(null)
        else if (runLenAt(s, col, index) > 0) setSel({ col, index })
        else setSel(null)
        return
      }
      // Different column ⇒ destination.
      apply(moveRun(s, sel.col, sel.index, col))
    },
    [apply, sel, play],
  )

  const onEmptyColumn = useCallback(
    (col: number) => {
      const s = stateRef.current
      if (!s) return
      if (!sel) return
      apply(moveRun(s, sel.col, sel.index, col))
    },
    [apply, sel],
  )

  // Keyboard: Space/Enter deals, N new, U undo, Esc deselect.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          onStock()
          break
        case 'n':
        case 'N':
          e.preventDefault()
          newDeal()
          break
        case 'u':
        case 'U':
          e.preventDefault()
          undo()
          break
        case 'Escape':
          e.preventDefault()
          setSel(null)
          break
      }
    },
    [onStock, newDeal, undo],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-180 select-none">
        <div className="h-80 rounded-xl bg-surface" data-testid="spider-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.status === 'won'
  const score = scoreOf(state)
  const dealsLeft = Math.floor(state.stock.length / 10)
  const anyEmpty = state.tableau.some((col) => col.length === 0)

  const isSelected = (col: number, index: number) =>
    sel != null && sel.col === col && index >= sel.index

  // Highlight legal destinations for the current selection.
  const selHead = sel ? state.tableau[sel.col][sel.index] : null
  const isLegalDest = (col: number): boolean => {
    if (!selHead || sel?.col === col) return false
    return canLand(selHead, state.tableau[col][state.tableau[col].length - 1])
  }

  const trans = reduced ? undefined : 'transform .12s ease, box-shadow .12s ease'

  const hint = won
    ? 'Solved! All eight sets are home.'
    : 'Build columns down in rank. Only a same-suit run moves together — assemble King to Ace to clear a set. Tap the stock to deal a row (no empty columns allowed).'

  const headerExtra = (
    <>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Sets</span>{' '}
        <span className="font-bold text-accent" data-testid="completed">
          {state.completed}/8
        </span>
      </span>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Moves</span>{' '}
        <span className="font-bold text-accent" data-testid="moves">
          {state.moves}
        </span>
      </span>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Time</span>{' '}
        <span className="font-bold text-accent" data-testid="time">
          {fmtTime(elapsed)}
        </span>
      </span>
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={newDeal}
      newGameLabel="New deal"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-180"
    >
      <div
        role="group"
        aria-label="Spider Solitaire board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-3"
        data-testid="spider-board"
      >
        {/* Top row: difficulty toggle (left) + stock (right) */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d.count
              return (
                <button
                  key={d.count}
                  type="button"
                  onClick={() => startDeal(d.count)}
                  aria-pressed={active}
                  data-testid="difficulty"
                  data-suits={d.count}
                  className={`btn-press rounded-lg border px-2.5 py-1.5 text-xs font-semibold sm:text-sm ${
                    active
                      ? 'border-neon-cyan text-accent'
                      : 'border-border text-fg-muted hover:border-neon-cyan/60'
                  }`}
                  style={active ? { boxShadow: '0 0 0 1px var(--neon-cyan)' } : undefined}
                >
                  {d.label}
                </button>
              )
            })}
          </div>

          {/* Stock: remaining deals */}
          <button
            type="button"
            onClick={onStock}
            disabled={dealsLeft === 0}
            aria-label={
              dealsLeft > 0
                ? `Stock, ${dealsLeft} deals left${anyEmpty ? ' (blocked: an empty column)' : ''}`
                : 'Stock empty'
            }
            data-testid="stock"
            className={`${CARD_W} ${CARD_H} btn-press relative rounded-md`}
          >
            {dealsLeft > 0 ? (
              <>
                <CardBack />
                <span
                  className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-white"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                  aria-hidden="true"
                >
                  {dealsLeft}
                </span>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-[0.35rem] border border-dashed border-border text-lg text-fg-muted">
                ∅
              </div>
            )}
          </button>
        </div>

        {/* Tableau: 10 columns */}
        <div className="flex justify-between gap-0.5 sm:gap-1">
          {state.tableau.map((column, col) => {
            let offset = 0
            const positions = column.map((cd) => {
              const y = offset
              offset += cd.faceUp ? 15 : 8
              return y
            })
            const cardPx = 58 // approx card height fudge for min-height
            const height = (positions[positions.length - 1] ?? 0) + cardPx
            const legalDest = isLegalDest(col)
            return (
              <div
                key={col}
                data-testid="tableau-col"
                data-col={col}
                className={`relative ${CARD_W}`}
                style={{ minHeight: column.length === 0 ? undefined : height }}
              >
                {column.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onEmptyColumn(col)}
                    aria-label={`Empty column ${col + 1}`}
                    className={`${CARD_H} w-full rounded-[0.35rem] border border-dashed`}
                    style={{
                      borderColor: legalDest ? 'var(--neon-amber)' : 'var(--border, rgba(140,140,200,0.35))',
                      boxShadow: legalDest ? '0 0 0 2px var(--neon-amber)' : undefined,
                    }}
                  />
                ) : (
                  column.map((card, index) => {
                    const selectedRun = isSelected(col, index)
                    const isTop = index === column.length - 1
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => onColumn(col, index)}
                        aria-label={
                          card.faceUp
                            ? `${RANK_LABEL(card.rank)} of ${card.suit}`
                            : 'Face-down card'
                        }
                        data-testid="spider-card"
                        data-selected={selectedRun}
                        className={`absolute left-0 ${CARD_W} ${CARD_H}`}
                        style={{
                          top: positions[index],
                          zIndex: index,
                          transform: selectedRun && !reduced ? 'translateY(-4px)' : undefined,
                          boxShadow: selectedRun
                            ? '0 0 0 2px var(--neon-amber)'
                            : legalDest && isTop
                              ? '0 0 0 2px var(--neon-cyan)'
                              : undefined,
                          transition: trans,
                        }}
                      >
                        {card.faceUp ? <CardFace card={card} dim={selectedRun} /> : <CardBack />}
                      </button>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <GameButton variant="ghost" onClick={undo} disabled={history.length === 0}>
            Undo
          </GameButton>
        </div>

        <GameOverlay show={won} variant="win" title="You win!" testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{score}</span>
            </p>
            <p>
              Moves <span className="font-bold text-accent">{state.moves}</span> · Time{' '}
              <span className="font-bold text-accent">{fmtTime(elapsed)}</span>
            </p>
            <p>
              Difficulty{' '}
              <span className="font-bold text-accent">
                {DIFFICULTIES.find((d) => d.count === state.suitCount)?.label ?? `${state.suitCount} suit`}
              </span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{Math.max(best, score)}</span>
            </p>
          </div>
          <GameButton onClick={newDeal}>New deal</GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
