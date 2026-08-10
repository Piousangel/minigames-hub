'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Card,
  type State,
  type Suit,
  type Target,
  ROWS,
  createGame,
  drawStock,
  isAvailable,
  pair,
  removeKing,
  score as scoreOf,
} from '@/lib/games/pyramid/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { recordResult } from '@/lib/gameStats'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// -- card presentation (matches Solitaire/FreeCell/Spider) -------------------

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

function pyramidRemaining(state: State): number {
  let n = 0
  for (const row of state.pyramid) for (const cell of row) if (cell) n++
  return n
}

// Card face — light face so suit colours read; red suits red, black suits ink.
function CardFace({ card, dim, selected }: { card: Card; dim?: boolean; selected?: boolean }) {
  const red = isRedSuit(card.suit)
  return (
    <div
      className="flex h-full w-full flex-col justify-between rounded-[0.35rem] border px-1 py-0.5 leading-none"
      style={{
        background: dim ? '#c7c9d6' : '#f4f5fb',
        borderColor: selected ? 'var(--neon-amber)' : 'rgba(0,0,0,0.25)',
        color: red ? '#d81f3a' : '#1b2130',
        boxShadow: selected
          ? '0 0 0 2px var(--neon-amber)'
          : 'inset 0 0 0 1px rgba(255,255,255,0.5)',
        opacity: dim ? 0.55 : 1,
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

// A fixed card footprint (CSS vars so the pyramid geometry stays in `calc`).
const CARD_W = 'w-[2.6rem] sm:w-[3.4rem]'
const CARD_H = 'h-[3.6rem] sm:h-[4.7rem]'

function targetEq(a: Target | null, b: Target): boolean {
  if (!a) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'waste') return true
  return a.row === (b as { row: number; col: number }).row && a.col === (b as { row: number; col: number }).col
}

export function GamePyramid({ storageKey }: { storageKey: string }) {
  // SSR safety: build the deal on the client only (never Date/random in render).
  const [state, setState] = useState<State | null>(null)
  const [history, setHistory] = useState<State[]>([])
  const [sel, setSel] = useState<Target | null>(null)
  const [best, setBest] = useState(0)
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

  const persistOver = useCallback(
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
      // Record a loss too: pyramid stuck with the stock exhausted is a real end.
      recordResult(slug, { won: next.status === 'won' })
    },
    [storageKey, slug],
  )

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

  /** Apply a computed next-state. Same ref ⇒ illegal ⇒ error + deselect. */
  const apply = useCallback(
    (next: State, sound: 'match' | 'flip'): boolean => {
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

      const over = next.status !== 'playing'
      if (over && !prevOverRef.current) {
        prevOverRef.current = true
        play(next.status === 'won' ? 'win' : 'lose')
        persistOver(next)
      } else {
        play(sound)
      }
      return true
    },
    [commit, play, persistOver],
  )

  const newDeal = useCallback(() => {
    prevOverRef.current = false
    startRef.current = Date.now()
    setHistory([])
    setSel(null)
    setElapsed(0)
    commit(createGame(freshSeed()))
  }, [commit])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      commit(prev)
      prevOverRef.current = prev.status !== 'playing'
      setSel(null)
      play('flip')
      return h.slice(0, -1)
    })
  }, [commit, play])

  // -- interactions ----------------------------------------------------------

  const onDraw = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    apply(drawStock(s), 'flip')
  }, [apply])

  /** Tap a free card (pyramid or waste). King → remove; else select/pair. */
  const onCard = useCallback(
    (t: Target) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing') return
      if (!isAvailable(s, t)) return // covered/absent → non-interactive
      const card =
        t.kind === 'waste'
          ? s.waste[s.waste.length - 1]
          : (s.pyramid[t.row][t.col] as Card)

      if (card.rank === 13) {
        apply(removeKing(s, t), 'match') // King needs no partner
        return
      }
      if (!sel) {
        setSel(t) // pick up
        return
      }
      if (targetEq(sel, t)) {
        setSel(null) // tap the same card → deselect
        return
      }
      apply(pair(s, sel, t), 'match') // second tap → try to pair (13)
    },
    [apply, sel],
  )

  // Keyboard: Space/Enter draw, N new, U undo, Esc deselect.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          onDraw()
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
    [onDraw, newDeal, undo],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-160 select-none">
        <div className="h-80 rounded-xl bg-surface" data-testid="pyramid-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const over = state.status !== 'playing'
  const won = state.status === 'won'
  const score = scoreOf(state)
  const remaining = pyramidRemaining(state)
  const wasteTop = state.waste[state.waste.length - 1]
  const wasteSelected = sel?.kind === 'waste'
  const trans = reduced ? undefined : 'transform .12s ease, box-shadow .12s ease'

  const hint = won
    ? 'Cleared! Every card is off the pyramid.'
    : over
      ? 'No moves left. Deal again to try a new pyramid.'
      : 'Goal: clear the pyramid. Tap two free cards that add up to 13 (A=1 … Q=12); a King (13) clears on a single tap. Tap the stock to draw.'

  const headerExtra = (
    <>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Left</span>{' '}
        <span className="font-bold text-accent" data-testid="remaining">
          {remaining}
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
        aria-label="Pyramid Solitaire board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-3"
        data-testid="pyramid-board"
      >
        {/* Pyramid — absolute layout via CSS vars so rows overlap (each card
            is covered by the two below it). --cw/--ch scale at the sm break. */}
        <div
          className="relative mx-auto [--ch:3.6rem] [--cw:2.6rem] sm:[--ch:4.7rem] sm:[--cw:3.4rem]"
          style={{ width: 'calc(7 * var(--cw))', height: 'calc(4 * var(--ch))' }}
        >
          {state.pyramid.map((row, r) =>
            row.map((card, col) => {
              if (!card) return null
              const t: Target = { kind: 'pyramid', row: r, col }
              const free = isAvailable(state, t)
              const selected = targetEq(sel, t)
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onCard(t)}
                  disabled={!free || over}
                  aria-label={`${RANK_LABEL(card.rank)} of ${card.suit}${free ? ', free' : ', covered'}`}
                  data-testid="pyramid-card"
                  data-free={free}
                  data-selected={selected}
                  className={`absolute ${CARD_W} ${CARD_H} rounded-md`}
                  style={{
                    left: `calc(${col} * var(--cw) + ${(6 - r) * 0.5} * var(--cw))`,
                    top: `calc(${r * 0.5} * var(--ch))`,
                    zIndex: r,
                    transform: selected && !reduced ? 'translateY(-4px)' : undefined,
                    transition: trans,
                    cursor: free && !over ? 'pointer' : 'default',
                  }}
                >
                  <CardFace card={card} dim={!free} selected={selected} />
                </button>
              )
            }),
          )}
        </div>

        {/* Stock + waste + passes */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={onDraw}
              disabled={over}
              aria-label={
                state.stock.length > 0
                  ? `Stock, ${state.stock.length} cards — draw`
                  : state.passesLeft > 1
                    ? 'Recycle waste'
                    : 'Stock empty'
              }
              data-testid="stock"
              className={`${CARD_W} ${CARD_H} btn-press rounded-md`}
            >
              {state.stock.length > 0 ? (
                <CardBack />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[0.35rem] border border-dashed border-border text-lg text-fg-muted">
                  {state.passesLeft > 1 ? '↻' : '∅'}
                </div>
              )}
            </button>
            <span className="text-[0.65rem] text-fg-muted" data-testid="stock-count">
              {state.stock.length} left
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => wasteTop && onCard({ kind: 'waste' })}
              disabled={!wasteTop || over}
              aria-label={
                wasteTop
                  ? `Waste top ${RANK_LABEL(wasteTop.rank)} of ${wasteTop.suit}`
                  : 'Waste, empty'
              }
              data-testid="waste"
              data-selected={wasteSelected}
              className={`${CARD_W} ${CARD_H} rounded-md`}
              style={{
                transform: wasteSelected && !reduced ? 'translateY(-4px)' : undefined,
                transition: trans,
              }}
            >
              {wasteTop ? (
                <CardFace card={wasteTop} selected={wasteSelected} />
              ) : (
                <div className="h-full w-full rounded-[0.35rem] border border-dashed border-border" />
              )}
            </button>
            <span className="text-[0.65rem] text-fg-muted" data-testid="passes">
              Passes {state.passesLeft}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <GameButton variant="ghost" onClick={undo} disabled={history.length === 0}>
            Undo
          </GameButton>
          <GameButton onClick={onDraw} disabled={over}>
            Draw
          </GameButton>
        </div>

        <GameOverlay show={over} variant={won ? 'win' : 'lose'} title={won ? 'You cleared it!' : 'No moves left'} testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{score}</span>
            </p>
            <p>
              Cards left <span className="font-bold text-accent">{remaining}</span> · Moves{' '}
              <span className="font-bold text-accent">{state.moves}</span> · Time{' '}
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
