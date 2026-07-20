'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Card,
  type State,
  type Suit,
  createGame,
  dealStock,
  hasMove,
  playColumn,
  playableColumns,
  score as scoreOf,
  tableauRemaining,
} from '@/lib/games/golf/engine'
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

// Card face — light face so suit colours read; red suits red, black suits ink.
function CardFace({ card, big, glow }: { card: Card; big?: boolean; glow?: boolean }) {
  const red = isRedSuit(card.suit)
  return (
    <div
      className="flex h-full w-full flex-col justify-between rounded-[0.35rem] border px-1 py-0.5 leading-none"
      style={{
        background: '#f4f5fb',
        borderColor: 'rgba(0,0,0,0.25)',
        color: red ? '#d81f3a' : '#1b2130',
        boxShadow: glow
          ? '0 0 0 2px var(--neon-amber), inset 0 0 0 1px rgba(255,255,255,0.5)'
          : 'inset 0 0 0 1px rgba(255,255,255,0.5)',
      }}
    >
      <span className={big ? 'text-sm font-extrabold sm:text-lg' : 'text-[0.7rem] font-extrabold sm:text-sm'}>
        {RANK_LABEL(card.rank)}
        <span className="ml-[1px]">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span
        className={big ? 'self-end text-lg sm:text-2xl' : 'self-end text-[0.7rem] sm:text-base'}
        aria-hidden="true"
      >
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

export function GameGolf({ storageKey }: { storageKey: string }) {
  // SSR safety: build the deal on the client only (never Date/random in render).
  const [state, setState] = useState<State | null>(null)
  const [history, setHistory] = useState<State[]>([])
  const [best, setBest] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [wrap, setWrap] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const wrapRef = useRef(false)
  const prevOverRef = useRef(false)
  const startRef = useRef(0)
  const slug = storageKey.replace(/^best:/, '')

  const commit = useCallback((next: State) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persistOver = useCallback(
    (next: State) => {
      const won = next.status === 'won'
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
      recordResult(slug, { won })
    },
    [storageKey, slug],
  )

  // Start a fresh deal with the given wrap setting.
  const startDeal = useCallback(
    (nextWrap: boolean) => {
      wrapRef.current = nextWrap
      prevOverRef.current = false
      startRef.current = Date.now()
      setHistory([])
      setElapsed(0)
      setWrap(nextWrap)
      commit(createGame(freshSeed(), nextWrap))
    },
    [commit],
  )

  // Bootstrap (client only).
  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0)
    startDeal(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Display-only timer (component-owned; NOT part of the pure engine).
  useEffect(() => {
    if (!state || state.status !== 'playing') return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [state])

  /** Apply a computed next-state. Same ref ⇒ illegal ⇒ error sound. */
  const apply = useCallback(
    (next: State, kind: 'move' | 'deal'): boolean => {
      const prev = stateRef.current
      if (!prev) return false
      if (next === prev) {
        play('error')
        return false
      }
      setHistory((h) => [...h, prev])
      commit(next)

      const over = next.status !== 'playing' && !prevOverRef.current
      if (!over) {
        play(kind === 'deal' ? 'flip' : 'move')
      } else {
        prevOverRef.current = true
        play(next.status === 'won' ? 'win' : 'lose')
        persistOver(next)
      }
      return true
    },
    [commit, play, persistOver],
  )

  const newDeal = useCallback(() => startDeal(wrapRef.current), [startDeal])

  const toggleWrap = useCallback(() => startDeal(!wrapRef.current), [startDeal])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      commit(prev)
      prevOverRef.current = prev.status !== 'playing'
      play('flip')
      return h.slice(0, -1)
    })
  }, [commit, play])

  const onStock = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    apply(dealStock(s), 'deal')
  }, [apply])

  const onColumn = useCallback(
    (col: number) => {
      const s = stateRef.current
      if (!s) return
      apply(playColumn(s, col), 'move')
    },
    [apply],
  )

  // Keyboard: Space/Enter deal, N new, U undo.
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
      }
    },
    [onStock, newDeal, undo],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-160 select-none">
        <div className="h-80 rounded-xl bg-surface" data-testid="golf-solitaire-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const over = state.status !== 'playing'
  const won = state.status === 'won'
  const scoreVal = scoreOf(state)
  const remaining = tableauRemaining(state)
  const cleared = 35 - remaining
  const playable = new Set(playableColumns(state))
  const wasteTop = state.waste[state.waste.length - 1]
  const stuck = state.status === 'playing' && state.stock.length === 0 && !hasMove(state)

  const trans = reduced ? undefined : 'transform .12s ease, box-shadow .12s ease'

  const hint = won
    ? 'Cleared the green! Every tableau card is gone.'
    : state.status === 'lost'
      ? 'No moves left. Deal a new hand to try again.'
      : `Tap a highlighted column card to play it onto ${RANK_LABEL(wasteTop.rank)}${SUIT_SYMBOL[wasteTop.suit]} (one rank up or down${state.wrap ? ', A↔K wraps' : ''}). Tap the stock to deal.`

  const headerExtra = (
    <>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Moves</span>{' '}
        <span className="font-bold text-accent" data-testid="moves">
          {state.moves}
        </span>
      </span>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Left</span>{' '}
        <span className="font-bold text-accent" data-testid="cards-left">
          {remaining}
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
        { label: 'Score', value: scoreVal, testId: 'score' },
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
        aria-label="Golf Solitaire board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-3"
        data-testid="golf-solitaire-board"
      >
        {/* Tableau: 7 columns of overlapping face-up cards */}
        <div className="flex justify-between gap-1 sm:gap-2">
          {state.tableau.map((column, col) => {
            const positions = column.map((_, i) => i * 20)
            const height = (positions[positions.length - 1] ?? 0) + 76
            const isPlayable = playable.has(col)
            const lastIndex = column.length - 1
            return (
              <div
                key={col}
                data-testid="tableau-col"
                data-col={col}
                data-playable={isPlayable}
                className={`relative ${CARD_W}`}
                style={{ minHeight: column.length === 0 ? undefined : height }}
              >
                {column.length === 0 ? (
                  <div
                    className={`${CARD_H} w-full rounded-[0.35rem] border border-dashed border-border`}
                    aria-hidden="true"
                  />
                ) : (
                  column.map((card, index) => {
                    const isExposed = index === lastIndex
                    const highlight = isExposed && isPlayable
                    if (!isExposed) {
                      // Non-playable overlapped cards: plain, not interactive.
                      return (
                        <div
                          key={index}
                          className={`absolute left-0 ${CARD_W} ${CARD_H}`}
                          style={{ top: positions[index], zIndex: index }}
                          aria-hidden="true"
                        >
                          <CardFace card={card} />
                        </div>
                      )
                    }
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => onColumn(col)}
                        aria-label={`${RANK_LABEL(card.rank)} of ${card.suit}${highlight ? ', playable' : ''}`}
                        data-testid="exposed-card"
                        data-playable={highlight}
                        className={`absolute left-0 ${CARD_W} ${CARD_H} rounded-md`}
                        style={{
                          top: positions[index],
                          zIndex: index,
                          transform: highlight && !reduced ? 'translateY(-4px)' : undefined,
                          transition: trans,
                        }}
                      >
                        <CardFace card={card} glow={highlight} />
                      </button>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom row: stock (deal) + waste (active foundation) */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onStock}
              disabled={state.stock.length === 0}
              aria-label={
                state.stock.length > 0 ? `Stock, deal one of ${state.stock.length}` : 'Stock empty'
              }
              data-testid="stock"
              className={`${CARD_W} ${CARD_H} btn-press rounded-md disabled:opacity-40`}
            >
              {state.stock.length > 0 ? (
                <CardBack />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[0.35rem] border border-dashed border-border text-lg text-fg-muted">
                  ✕
                </div>
              )}
            </button>
            <span className="text-xs text-fg-muted">
              Stock <span data-testid="stock-count">{state.stock.length}</span>
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div
              className={`${CARD_W} ${CARD_H} rounded-md sm:h-[5.6rem] sm:w-[4rem]`}
              data-testid="waste"
              style={{ boxShadow: '0 0 12px rgba(34,211,238,0.25)' }}
            >
              <CardFace card={wasteTop} big />
            </div>
            <span className="text-xs text-fg-muted">Waste</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <GameButton variant="ghost" onClick={undo} disabled={history.length === 0}>
            Undo
          </GameButton>
          <GameButton variant="ghost" onClick={toggleWrap} aria-pressed={wrap} data-testid="wrap-toggle">
            Wrap A↔K: {wrap ? 'On' : 'Off'}
          </GameButton>
          {stuck && <span className="text-sm text-neon-amber">Stuck — deal or start over</span>}
        </div>

        <GameOverlay
          show={over}
          variant={won ? 'win' : 'lose'}
          title={won ? 'You cleared it!' : 'No moves left'}
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Cleared <span className="font-bold text-accent">{cleared}</span> / 35
            </p>
            <p>
              Score <span className="font-bold text-accent">{scoreVal}</span> · Moves{' '}
              <span className="font-bold text-accent">{state.moves}</span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{Math.max(best, scoreVal)}</span>
            </p>
          </div>
          <GameButton onClick={newDeal}>New deal</GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
