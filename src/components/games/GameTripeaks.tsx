'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Card,
  type State,
  type Suit,
  TABLEAU_SIZE,
  clearedCount,
  createGame,
  drawStock,
  freePlayable,
  isFree,
  playCard,
  rowOf,
  score as scoreOf,
} from '@/lib/games/tripeaks/engine'
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

// Card footprint. Tri-peaks needs 10 across the bottom → tighter than solitaire.
const CARD_W = 'w-[1.9rem] sm:w-[2.5rem]'
const CARD_H = 'h-[2.7rem] sm:h-[3.5rem]'

// Peak layout geometry (px). Each row is horizontally offset so the three peaks
// overlap into a single bottom row of 10. Values are half-card steps.
const ROW_START: readonly number[] = [0, 3, 9, 18] // first slot index of each row

/**
 * Horizontal slot column (in "half bottom-card" units) for a given tableau slot,
 * so upper cards sit centered between the two cards they cover. The bottom row of
 * 10 defines the grid; each higher row is inset by half a card and, for the two
 * upper rows, the three peaks are spread to straddle their bottom-row group.
 */
function slotColumn(slot: number): number {
  const row = rowOf(slot)
  const withinRow = slot - ROW_START[row]
  switch (row) {
    case 3: // bottom: 10 cards at columns 0..9
      return withinRow
    case 2: // 9 cards, each between two bottom cards → 0.5 .. 8.5
      return withinRow + 0.5
    case 1: {
      // 6 cards = 2 per peak; peaks centered over bottom-row groups.
      const peak = Math.floor(withinRow / 2)
      const inPeak = withinRow % 2
      return peak * 3 + 1 + inPeak
    }
    default: {
      // 3 tips, centered over each peak's pair.
      return slot * 3 + 1.5
    }
  }
}

export function GameTripeaks({ storageKey }: { storageKey: string }) {
  // SSR safety: build the deal on the client only (never Date/random in render).
  const [state, setState] = useState<State | null>(null)
  const [history, setHistory] = useState<State[]>([])
  const [best, setBest] = useState(0)
  const [bestChain, setBestChain] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const prevOverRef = useRef(false)
  const startRef = useRef(0)
  const slug = storageKey.replace(/^best:/, '')

  const commit = useCallback((next: State) => {
    stateRef.current = next
    setState(next)
  }, [])

  const resetRun = useCallback(() => {
    prevOverRef.current = false
    startRef.current = Date.now()
    setHistory([])
    setElapsed(0)
    setBestChain(0)
    commit(createGame(freshSeed()))
  }, [commit])

  // Bootstrap (client only).
  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0)
    resetRun()
  }, [storageKey, resetRun])

  // Display-only timer (component-owned; NOT part of the pure engine).
  useEffect(() => {
    if (!state || state.status !== 'playing') return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [state])

  const persistGameOver = useCallback(
    (next: State) => {
      const won = next.status === 'won'
      if (won) {
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
      }
      // We DO record losses: a Tri Peaks loss (stock empty + no playable card) is
      // a genuine terminal outcome, so the win/lose funnel is meaningful.
      recordResult(slug, { won })
    },
    [storageKey, slug],
  )

  /** Apply a computed next-state. Same ref ⇒ illegal ⇒ error. */
  const apply = useCallback(
    (next: State): boolean => {
      const prev = stateRef.current
      if (!prev) return false
      if (next === prev) {
        play('error')
        return false
      }
      setHistory((h) => [...h, prev])
      commit(next)
      setBestChain((b) => Math.max(b, next.chain))

      const over = next.status !== 'playing' && !prevOverRef.current
      if (!over) {
        if (clearedCount(next) > clearedCount(prev)) play('match') // card cleared
        else play('flip') // stock draw
      } else {
        prevOverRef.current = true
        if (next.status === 'won') play('win')
        else play('lose')
        persistGameOver(next)
      }
      return true
    },
    [commit, play, persistGameOver],
  )

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

  // -- interactions ----------------------------------------------------------

  const onStock = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    apply(drawStock(s))
  }, [apply])

  const onTableau = useCallback(
    (slot: number) => {
      const s = stateRef.current
      if (!s) return
      apply(playCard(s, slot))
    },
    [apply],
  )

  // Keyboard: Space/Enter draw, N new deal, U undo.
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
          resetRun()
          break
        case 'u':
        case 'U':
          e.preventDefault()
          undo()
          break
      }
    },
    [onStock, resetRun, undo],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-140 select-none">
        <div className="h-80 rounded-xl bg-surface" data-testid="tripeaks-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const over = state.status !== 'playing'
  const won = state.status === 'won'
  const score = scoreOf(state)
  const cleared = clearedCount(state)
  const playable = new Set(freePlayable(state))
  const wasteTop = state.waste[state.waste.length - 1]

  // Peak-board geometry. Column unit ≈ half a bottom card so cards overlap.
  const COL_UNIT = 26 // px per column step (mobile); scaled up on sm via transform
  const CARD_PX = 2 * COL_UNIT
  const ROW_STEP = 30 // vertical px between rows
  const boardWidth = 9 * COL_UNIT + CARD_PX
  const boardHeight = 3 * ROW_STEP + 44 + 4

  const trans = reduced ? undefined : 'transform .12s ease, box-shadow .12s ease'

  const hint = won
    ? 'Cleared every peak — perfect run!'
    : over
      ? 'No moves left. Deal again to try a fresh board.'
      : 'Goal: clear all 28 peak cards. Tap any card one rank above or below the waste (A wraps to K and 2). Tap the stock to deal when stuck.'

  const headerExtra = (
    <>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Cleared</span>{' '}
        <span className="font-bold text-accent" data-testid="cleared">
          {cleared}/{TABLEAU_SIZE}
        </span>
      </span>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Chain</span>{' '}
        <span className="font-bold text-accent" data-testid="chain">
          {state.chain}
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
      onNewGame={resetRun}
      newGameLabel="New deal"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-140"
    >
      <div
        role="group"
        aria-label="Tri Peaks board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-3"
        data-testid="tripeaks-board"
      >
        {/* Peaks */}
        <div className="flex justify-center overflow-x-auto pb-1">
          <div className="relative" style={{ width: boardWidth, height: boardHeight }}>
            {state.tableau.map((card, slot) => {
              if (!card) return null
              const free = isFree(state, slot)
              const canPlay = playable.has(slot)
              const left = slotColumn(slot) * COL_UNIT
              const topPx = rowOf(slot) * ROW_STEP
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onTableau(slot)}
                  disabled={!card.faceUp}
                  aria-label={
                    card.faceUp
                      ? `${RANK_LABEL(card.rank)} of ${card.suit}${canPlay ? ', playable' : ''}`
                      : 'Face-down card'
                  }
                  data-testid="tableau-card"
                  data-slot={slot}
                  data-free={free}
                  data-playable={canPlay}
                  className="absolute rounded-md"
                  style={{
                    left,
                    top: topPx,
                    width: CARD_PX,
                    height: 44,
                    zIndex: rowOf(slot),
                    transform: canPlay && !reduced ? 'translateY(-3px)' : undefined,
                    boxShadow: canPlay ? '0 0 0 2px var(--neon-amber)' : undefined,
                    transition: trans,
                  }}
                >
                  {card.faceUp ? <CardFace card={card} dim={free && !canPlay} /> : <CardBack />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Stock + waste */}
        <div className="mt-2 flex items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onStock}
              disabled={state.stock.length === 0}
              aria-label={
                state.stock.length > 0 ? `Stock, ${state.stock.length} cards. Draw.` : 'Stock empty'
              }
              data-testid="stock"
              className={`${CARD_W} ${CARD_H} btn-press rounded-md`}
            >
              {state.stock.length > 0 ? (
                <CardBack />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[0.35rem] border border-dashed border-border text-lg text-fg-muted">
                  —
                </div>
              )}
            </button>
            <span className="text-xs text-fg-muted" data-testid="stock-count">
              {state.stock.length}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div
              className={`${CARD_W} ${CARD_H} rounded-md`}
              data-testid="waste"
              aria-label={
                wasteTop ? `Waste top ${RANK_LABEL(wasteTop.rank)} of ${wasteTop.suit}` : 'Waste empty'
              }
            >
              {wasteTop ? (
                <CardFace card={wasteTop} />
              ) : (
                <div className="h-full w-full rounded-[0.35rem] border border-dashed border-border" />
              )}
            </div>
            <span className="text-xs text-fg-muted">Waste</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <GameButton variant="ghost" onClick={undo} disabled={history.length === 0}>
            Undo
          </GameButton>
        </div>

        <GameOverlay
          show={over}
          variant={won ? 'win' : 'lose'}
          title={won ? 'You win!' : 'No moves left'}
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Cleared{' '}
              <span className="font-bold text-accent">
                {cleared}/{TABLEAU_SIZE}
              </span>
            </p>
            <p>
              Score <span className="font-bold text-accent">{score}</span> · Moves{' '}
              <span className="font-bold text-accent">{state.moves}</span>
            </p>
            <p>
              Best chain <span className="font-bold text-accent">{bestChain}</span> · Time{' '}
              <span className="font-bold text-accent">{fmtTime(elapsed)}</span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{Math.max(best, won ? score : best)}</span>
            </p>
          </div>
          <GameButton onClick={resetRun}>New deal</GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
