'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Card,
  type State,
  type Suit,
  SUITS,
  autoToFoundation,
  canAutoFinish,
  createGame,
  drawFromStock,
  score as scoreOf,
  tableauToFoundation,
  tableauToTableau,
  wasteToFoundation,
  wasteToTableau,
} from '@/lib/games/solitaire/engine'
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

function foundationCount(state: State): number {
  return state.foundations.reduce((n, f) => n + f.length, 0)
}
function faceDownCount(state: State): number {
  return state.tableau.reduce((n, col) => n + col.filter((c) => !c.faceUp).length, 0)
}

// Selection: a source waiting for a destination click.
type Sel = { kind: 'waste' } | { kind: 'tableau'; col: number; index: number } | null

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

// A fixed card footprint. Tuned to fit 7 columns on small screens.
const CARD_W = 'w-[2.6rem] sm:w-[3.4rem]'
const CARD_H = 'h-[3.6rem] sm:h-[4.7rem]'

export function GameSolitaire({ storageKey }: { storageKey: string }) {
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
      // Solitaire has no hard "lose": we only record an actual win.
      recordResult(slug, { won: true })
    },
    [storageKey, slug],
  )

  /** Apply a computed next-state. Same ref ⇒ illegal ⇒ error + deselect. */
  const apply = useCallback(
    (next: State, forced?: 'move'): boolean => {
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
        else if (foundationCount(next) > foundationCount(prev)) play('match')
        else if (faceDownCount(next) < faceDownCount(prev)) play('flip')
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

  const doAutoFinish = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    apply(autoToFoundation(s))
  }, [apply])

  // -- interactions ----------------------------------------------------------

  const onStock = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    apply(drawFromStock(s), 'move')
  }, [apply])

  const onWaste = useCallback(() => {
    const s = stateRef.current
    if (!s || s.waste.length === 0) return
    setSel((cur) => (cur && cur.kind === 'waste' ? null : { kind: 'waste' }))
  }, [])

  const onWasteDouble = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    apply(wasteToFoundation(s))
  }, [apply])

  const onFoundation = useCallback(() => {
    const s = stateRef.current
    if (!s || !sel) {
      play('error')
      return
    }
    if (sel.kind === 'waste') {
      apply(wasteToFoundation(s))
    } else if (sel.index === s.tableau[sel.col].length - 1) {
      apply(tableauToFoundation(s, sel.col))
    } else {
      play('error')
      setSel(null)
    }
  }, [apply, sel, play])

  const onTableauCard = useCallback(
    (col: number, index: number) => {
      const s = stateRef.current
      if (!s) return
      const card = s.tableau[col][index]
      if (!sel) {
        if (card?.faceUp) setSel({ kind: 'tableau', col, index })
        return
      }
      if (sel.kind === 'tableau' && sel.col === col) {
        // Re-target within the same column (or deselect if the same card).
        if (sel.index === index) setSel(null)
        else if (card?.faceUp) setSel({ kind: 'tableau', col, index })
        return
      }
      // Different pile ⇒ this column is the destination.
      if (sel.kind === 'waste') apply(wasteToTableau(s, col))
      else apply(tableauToTableau(s, sel.col, sel.index, col))
    },
    [apply, sel],
  )

  const onTableauCardDouble = useCallback(
    (col: number, index: number) => {
      const s = stateRef.current
      if (!s) return
      if (index !== s.tableau[col].length - 1) return // only the top card auto-lifts
      apply(tableauToFoundation(s, col))
    },
    [apply],
  )

  const onEmptyColumn = useCallback(
    (col: number) => {
      const s = stateRef.current
      if (!s || !sel) return
      if (sel.kind === 'waste') apply(wasteToTableau(s, col))
      else apply(tableauToTableau(s, sel.col, sel.index, col))
    },
    [apply, sel],
  )

  // Keyboard: draw on Space/Enter, N = new deal, U = undo.
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
      <div className="mx-auto w-full max-w-160 select-none">
        <div className="h-80 rounded-xl bg-surface" data-testid="solitaire-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.status === 'won'
  const score = scoreOf(state)
  const autoReady = canAutoFinish(state)

  const isSelectedTableau = (col: number, index: number) =>
    sel?.kind === 'tableau' && sel.col === col && index >= sel.index
  const wasteSelected = sel?.kind === 'waste'

  const trans = reduced ? undefined : 'transform .12s ease, box-shadow .12s ease'

  const hint = won
    ? 'Solved! Every card is home.'
    : autoReady
      ? 'All cards are up — hit Auto-finish to sweep them home.'
      : 'Tap a card to pick it up, tap a pile to drop it. Double-tap sends a card to its foundation. Tap the stock to deal.'

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
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={newDeal}
      newGameLabel="New deal"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-160"
    >
      <div
        role="group"
        aria-label="Solitaire board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-3"
        data-testid="solitaire-board"
      >
        {/* Top row: stock + waste (left), foundations (right) */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex gap-1.5 sm:gap-2">
            {/* Stock */}
            <button
              type="button"
              onClick={onStock}
              aria-label={state.stock.length > 0 ? `Stock, ${state.stock.length} cards` : 'Recycle waste'}
              data-testid="stock"
              className={`${CARD_W} ${CARD_H} btn-press rounded-md`}
            >
              {state.stock.length > 0 ? (
                <CardBack />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[0.35rem] border border-dashed border-border text-lg text-fg-muted">
                  ↻
                </div>
              )}
            </button>
            {/* Waste */}
            <button
              type="button"
              onClick={onWaste}
              onDoubleClick={onWasteDouble}
              disabled={state.waste.length === 0}
              aria-label={
                state.waste.length > 0
                  ? `Waste top ${RANK_LABEL(state.waste[state.waste.length - 1].rank)}${state.waste[state.waste.length - 1].suit}`
                  : 'Waste, empty'
              }
              data-testid="waste"
              data-selected={wasteSelected}
              className={`${CARD_W} ${CARD_H} touch-manipulation rounded-md`}
              style={{
                transform: wasteSelected && !reduced ? 'translateY(-4px)' : undefined,
                boxShadow: wasteSelected ? '0 0 0 2px var(--neon-amber)' : undefined,
                transition: trans,
              }}
            >
              {state.waste.length > 0 ? (
                <CardFace card={state.waste[state.waste.length - 1]} />
              ) : (
                <div className="h-full w-full rounded-[0.35rem] border border-dashed border-border" />
              )}
            </button>
          </div>

          {/* Foundations */}
          <div className="flex gap-1.5 sm:gap-2">
            {SUITS.map((suit, fi) => {
              const pile = state.foundations[fi]
              const topCard = pile[pile.length - 1]
              return (
                <button
                  key={suit}
                  type="button"
                  onClick={onFoundation}
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

        {/* Tableau */}
        <div className="flex justify-between gap-1 sm:gap-2">
          {state.tableau.map((column, col) => {
            let offset = 0
            const positions = column.map((c) => {
              const y = offset
              offset += c.faceUp ? 20 : 11
              return y
            })
            const height = (positions[positions.length - 1] ?? 0) + 76
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
                    className={`${CARD_H} w-full rounded-[0.35rem] border border-dashed border-border`}
                  />
                ) : (
                  column.map((card, index) => {
                    const selectedRun = isSelectedTableau(col, index)
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => onTableauCard(col, index)}
                        onDoubleClick={() => onTableauCardDouble(col, index)}
                        aria-label={
                          card.faceUp
                            ? `${RANK_LABEL(card.rank)} of ${card.suit}`
                            : 'Face-down card'
                        }
                        data-testid="tableau-card"
                        data-selected={selectedRun}
                        className={`absolute left-0 ${CARD_W} ${CARD_H} touch-manipulation`}
                        style={{
                          top: positions[index],
                          zIndex: index,
                          transform: selectedRun && !reduced ? 'translateY(-4px)' : undefined,
                          boxShadow: selectedRun ? '0 0 0 2px var(--neon-amber)' : undefined,
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
          {autoReady && !won && <GameButton onClick={doAutoFinish}>Auto-finish</GameButton>}
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
