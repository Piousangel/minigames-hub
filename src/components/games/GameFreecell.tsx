'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Card,
  type State,
  type Suit,
  SUITS,
  autoToFoundations,
  cascadeToCascade,
  cascadeToFoundation,
  createGame,
  foundationCardCount,
  freeCellToCascade,
  freeCellToFoundation,
  isSequence,
  maxSupermove,
  score as scoreOf,
  suitIndex,
  toFreeCell,
} from '@/lib/games/freecell/engine'
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

// Selection: a source waiting for a destination click.
type Sel =
  | { kind: 'free'; cell: number }
  | { kind: 'cascade'; col: number; index: number }
  | null

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
      <span className="text-[0.7rem] font-extrabold sm:text-sm">
        {RANK_LABEL(card.rank)}
        <span className="ml-[1px]">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span className="self-end text-[0.7rem] sm:text-base" aria-hidden="true">
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  )
}

// A fixed card footprint. Tuned to fit 8 columns on small screens.
const CARD_W = 'w-[2.3rem] sm:w-[3.1rem]'
const CARD_H = 'h-[3.2rem] sm:h-[4.3rem]'

/** Length of the largest legal movable run whose TOP is cascades[col][index]. */
function runLenAt(state: State, col: number, index: number): number {
  const run = state.cascades[col].slice(index)
  return isSequence(run) ? run.length : 0
}

export function GameFreecell({ storageKey }: { storageKey: string }) {
  // SSR safety: build the deal on the client only (never Date/random in render).
  const [state, setState] = useState<State | null>(null)
  const [history, setHistory] = useState<State[]>([])
  const [sel, setSel] = useState<Sel>(null)
  const [best, setBest] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [manuallyEnded, setManuallyEnded] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const prevOverRef = useRef(false)
  const startRef = useRef(0)
  // manuallyEnded is UI state (Undo resets it so the overlay can close and play resume) —
  // this ref tracks whether THIS deal already recorded a loss, independent of Undo, so
  // click "No moves left" → Undo → click "No moves left" again can't double-record a loss.
  const lossRecordedRef = useRef(false)
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
    setHistory([])
    setSel(null)
    setElapsed(0)
    commit(createGame(freshSeed()))
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
      // FreeCell has no hard "lose": we only record an actual win.
      recordResult(slug, { won: true })
    },
    [storageKey, slug],
  )

  /** Apply a computed next-state. Same ref ⇒ illegal ⇒ error + deselect. */
  const apply = useCallback(
    (next: State, forced?: 'move' | 'match' | 'flip'): boolean => {
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
        if (forced) play(forced)
        else if (foundationCardCount(next) > foundationCardCount(prev)) play('match')
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

  const newDeal = useCallback(() => {
    prevOverRef.current = false
    startRef.current = Date.now()
    setHistory([])
    setSel(null)
    setElapsed(0)
    setManuallyEnded(false)
    lossRecordedRef.current = false
    commit(createGame(freshSeed()))
  }, [commit])

  const endNoMoves = useCallback(() => {
    if (stateRef.current?.status === 'won' || manuallyEnded) return
    setManuallyEnded(true)
    play('lose')
    if (!lossRecordedRef.current) {
      lossRecordedRef.current = true
      recordResult(slug, { won: false })
    }
  }, [manuallyEnded, play, slug])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      commit(prev)
      prevOverRef.current = prev.status === 'won'
      setManuallyEnded(false)
      setSel(null)
      play('flip')
      return h.slice(0, -1)
    })
  }, [commit, play])

  const doAuto = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    apply(autoToFoundations(s))
  }, [apply])

  // -- interactions ----------------------------------------------------------

  const onFreeCell = useCallback(
    (cell: number) => {
      const s = stateRef.current
      if (!s) return
      if (!sel) {
        // Select the card in this free cell (if any).
        if (s.freeCells[cell]) setSel({ kind: 'free', cell })
        return
      }
      if (sel.kind === 'free') {
        if (sel.cell === cell) setSel(null) // tap-again deselect
        else setSel(s.freeCells[cell] ? { kind: 'free', cell } : sel)
        return
      }
      // A cascade card is selected → drop onto this free cell (single card only).
      const col = sel.col
      const isTop = sel.index === s.cascades[col].length - 1
      if (isTop && s.freeCells[cell] === null) apply(toFreeCell(s, col), 'flip')
      else {
        play('error')
        setSel(null)
      }
    },
    [apply, sel, play],
  )

  const onFoundation = useCallback(
    (fi: number) => {
      const s = stateRef.current
      if (!s || !sel) {
        play('error')
        return
      }
      if (sel.kind === 'free') {
        apply(freeCellToFoundation(s, sel.cell), 'match')
      } else if (sel.index === s.cascades[sel.col].length - 1) {
        // Only the top card of a cascade can go to a foundation.
        const card = s.cascades[sel.col][sel.index]
        if (suitIndex(card.suit) === fi) apply(cascadeToFoundation(s, sel.col), 'match')
        else {
          play('error')
          setSel(null)
        }
      } else {
        play('error')
        setSel(null)
      }
    },
    [apply, sel, play],
  )

  /** Drop the current selection onto cascade `toCol`, clamping run size legally. */
  const dropOnCascade = useCallback(
    (toCol: number) => {
      const s = stateRef.current
      if (!s || !sel) return
      if (sel.kind === 'free') {
        apply(freeCellToCascade(s, sel.cell, toCol))
        return
      }
      const col = sel.col
      const selLen = s.cascades[col].length - sel.index
      const destEmpty = s.cascades[toCol].length === 0
      // Auto-clamp the selected run to what the free cells / empty columns allow.
      const max = maxSupermove(s, destEmpty)
      const count = destEmpty ? Math.min(selLen, max) : selLen
      apply(cascadeToCascade(s, col, count, toCol))
    },
    [apply, sel],
  )

  const onCascadeCard = useCallback(
    (col: number, index: number) => {
      const s = stateRef.current
      if (!s) return
      if (!sel) {
        // Select the largest legal run whose top is this card.
        if (runLenAt(s, col, index) > 0) setSel({ kind: 'cascade', col, index })
        else play('error')
        return
      }
      if (sel.kind === 'cascade' && sel.col === col) {
        // Re-target within the same column (or deselect the same card).
        if (sel.index === index) setSel(null)
        else if (runLenAt(s, col, index) > 0) setSel({ kind: 'cascade', col, index })
        else play('error')
        return
      }
      // A different pile → this column is the destination.
      dropOnCascade(col)
    },
    [sel, play, dropOnCascade],
  )

  const onCascadeDouble = useCallback(
    (col: number, index: number) => {
      const s = stateRef.current
      if (!s) return
      if (index !== s.cascades[col].length - 1) return // only the top card auto-lifts
      apply(cascadeToFoundation(s, col), 'match')
    },
    [apply],
  )

  const onEmptyColumn = useCallback(
    (col: number) => {
      const s = stateRef.current
      if (!s || !sel) return
      dropOnCascade(col)
    },
    [sel, dropOnCascade],
  )

  // Keyboard: Space/Enter auto-move, N new, U undo, Esc deselect.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          doAuto()
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
    [doAuto, newDeal, undo],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-180 select-none">
        <div className="h-80 rounded-xl bg-surface" data-testid="freecell-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.status === 'won'
  const score = scoreOf(state)
  const autoReady = autoToFoundations(state) !== state

  const isSelectedCascade = (col: number, index: number) =>
    sel?.kind === 'cascade' && sel.col === col && index >= sel.index
  const isSelectedFree = (cell: number) => sel?.kind === 'free' && sel.cell === cell

  const trans = reduced ? undefined : 'transform .12s ease, box-shadow .12s ease'

  const hint = won
    ? 'Solved! Every card is home.'
    : 'Tap a card to pick up a run, then tap a cascade, free cell, or foundation to drop it. Double-tap sends a card home. Auto-finish sweeps safe cards.'

  const headerExtra = (
    <>
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
        aria-label="FreeCell board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-3"
        data-testid="freecell-board"
      >
        {/* Top row: free cells (left) + foundations (right) */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex gap-1 sm:gap-1.5">
            {state.freeCells.map((card, cell) => {
              const selected = isSelectedFree(cell)
              return (
                <button
                  key={cell}
                  type="button"
                  onClick={() => onFreeCell(cell)}
                  aria-label={
                    card
                      ? `Free cell ${cell + 1}, ${RANK_LABEL(card.rank)} of ${card.suit}`
                      : `Free cell ${cell + 1}, empty`
                  }
                  data-testid="freecell"
                  data-cell={cell}
                  data-selected={selected}
                  className={`${CARD_W} ${CARD_H} rounded-md`}
                  style={{
                    transform: selected && !reduced ? 'translateY(-4px)' : undefined,
                    boxShadow: selected ? '0 0 0 2px var(--neon-amber)' : undefined,
                    transition: trans,
                  }}
                >
                  {card ? (
                    <CardFace card={card} dim={selected} />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-[0.35rem] border border-dashed text-xs text-fg-muted"
                      style={{ borderColor: 'var(--neon-cyan)' }}
                    >
                      ▢
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Foundations */}
          <div className="flex gap-1 sm:gap-1.5">
            {SUITS.map((suit, fi) => {
              const pile = state.foundations[fi]
              const topCard = pile[pile.length - 1]
              return (
                <button
                  key={suit}
                  type="button"
                  onClick={() => onFoundation(fi)}
                  aria-label={`${SUIT_SYMBOL[suit]} foundation${topCard ? `, top ${RANK_LABEL(topCard.rank)}` : ', empty'}`}
                  data-testid="foundation"
                  data-suit={suit}
                  className={`${CARD_W} ${CARD_H} rounded-md`}
                >
                  {topCard ? (
                    <CardFace card={topCard} />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-[0.35rem] border border-dashed text-lg"
                      style={{
                        borderColor: 'var(--neon-purple)',
                        color: isRedSuit(suit) ? '#d81f3a' : 'var(--neon-cyan)',
                      }}
                    >
                      {SUIT_SYMBOL[suit]}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Cascades */}
        <div className="flex justify-between gap-1 sm:gap-1.5">
          {state.cascades.map((column, col) => {
            const positions = column.map((_, i) => i * 20)
            const height = (positions[positions.length - 1] ?? 0) + 70
            return (
              <div
                key={col}
                data-testid="cascade-col"
                data-col={col}
                className={`relative ${CARD_W}`}
                style={{ minHeight: column.length === 0 ? undefined : height }}
              >
                {column.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onEmptyColumn(col)}
                    aria-label={`Empty column ${col + 1}`}
                    className={`${CARD_H} w-full rounded-[0.35rem] border border-dashed border-border`}
                  />
                ) : (
                  column.map((card, index) => {
                    const selectedRun = isSelectedCascade(col, index)
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => onCascadeCard(col, index)}
                        onDoubleClick={() => onCascadeDouble(col, index)}
                        aria-label={`${RANK_LABEL(card.rank)} of ${card.suit}`}
                        data-testid="cascade-card"
                        data-selected={selectedRun}
                        className={`absolute left-0 ${CARD_W} ${CARD_H}`}
                        style={{
                          top: positions[index],
                          zIndex: index,
                          transform:
                            selectedRun && !reduced ? 'translateY(-4px)' : undefined,
                          boxShadow: selectedRun ? '0 0 0 2px var(--neon-amber)' : undefined,
                          transition: trans,
                        }}
                      >
                        <CardFace card={card} dim={selectedRun} />
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
          {autoReady && !won && <GameButton onClick={doAuto}>Auto-finish</GameButton>}
          <GameButton variant="ghost" onClick={endNoMoves} disabled={won || manuallyEnded} data-testid="end-round">
            No moves left
          </GameButton>
        </div>

        <GameOverlay
          show={won || manuallyEnded}
          variant={won ? 'win' : 'lose'}
          title={won ? 'You win!' : 'Round ended'}
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{score}</span>
            </p>
            <p>
              Moves <span className="font-bold text-accent">{state.moves}</span> · Time{' '}
              <span className="font-bold text-accent">{fmtTime(elapsed)}</span>
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
