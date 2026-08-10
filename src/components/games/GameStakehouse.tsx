'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BET_STEP,
  JACKPOT_MULT,
  ROUNDS,
  canCommit,
  createGame,
  hotZonePots,
  payoutMultiplier,
  reduce,
  remainingCount,
  remainingGems,
  type Pot,
  type StakehouseAction,
  type StakehouseEvent,
  type StakehouseState,
} from '@/lib/games/stakehouse/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { updateBestScore } from '@/lib/bestScore'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Component-scoped keyframes — globals.css stays untouched.
const SH_STYLE = `
@keyframes sh-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
@keyframes sh-hot-pulse {
  0%, 100% { box-shadow: 0 0 8px 1px rgba(251,191,36,.35); }
  50% { box-shadow: 0 0 20px 5px rgba(251,191,36,.65); }
}
@keyframes sh-badge {
  0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
  25% { transform: translate(-50%, 0) scale(1.15); opacity: 1 }
  100% { transform: translate(-50%, -18px) scale(1); opacity: 0 }
}
.sh-hot { animation: sh-hot-pulse 1.4s ease-in-out infinite; }
.sh-hot-static { box-shadow: 0 0 0 2px var(--neon-amber, #fbbf24) inset; }
`

const BADGE_MS = 950

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

const SOUND: Record<StakehouseEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  bet: 'flip',
  clear: 'flip',
  win: 'match',
  lose: 'mismatch',
  even: null,
  jackpot: 'win',
  busted: 'lose',
  complete: 'win',
}

function loadBest(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

function fmtMult(m: number | null): string {
  return m === null ? 'DEAD' : `${m.toFixed(2)}×`
}

function potAriaLabel(pot: Pot, index: number): string {
  const gems = remainingGems(pot)
  const left = remainingCount(pot)
  const mult = payoutMultiplier(pot)
  const payout = mult === null ? 'dead, cannot win' : `${mult.toFixed(2)}x payout`
  return `Pot ${index + 1}: ${gems} gem${gems === 1 ? '' : 's'}, ${left} left, ${payout}`
}

interface JackpotBadge {
  seq: number
  potIndex: number
  amount: number
}

function PotCard({
  pot,
  index,
  bet,
  bankroll,
  otherBets,
  focused,
  disabled,
  hot,
  reduced,
  lastResult,
  onSetBet,
  onAllIn,
  onFocus,
  cardRef,
}: {
  pot: Pot
  index: number
  bet: number
  bankroll: number
  otherBets: number
  focused: boolean
  disabled: boolean
  hot: boolean
  reduced: boolean
  lastResult: { bet: number; drawn: 'gem' | 'dud' | null; winnings: number } | null
  onSetBet: (pot: number, amount: number) => void
  onAllIn: (pot: number) => void
  onFocus: (pot: number) => void
  cardRef: (el: HTMLDivElement | null) => void
}) {
  const gems = remainingGems(pot)
  const total = remainingCount(pot)
  const mult = payoutMultiplier(pot)
  const dead = mult === null
  const fillFrac = pot.initialSize > 0 ? total / pot.initialSize : 0
  const gemFrac = total > 0 ? gems / total : 0
  const splitPct = (1 - gemFrac) * 100
  const canStep = !disabled && !dead
  const budgetLeft = bankroll - otherBets - bet

  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={potAriaLabel(pot, index)}
      tabIndex={focused ? 0 : -1}
      onFocus={() => onFocus(index)}
      data-testid="stakehouse-pot"
      className={`flex flex-col items-center gap-2 rounded-xl border-2 bg-surface p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        hot && !dead ? (reduced ? 'border-accent sh-hot-static' : 'border-accent sh-hot') : 'border-border'
      } ${focused ? 'border-accent' : ''}`}
    >
      <div className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-fg-muted">
        <span>Pot {index + 1}</span>
        <span data-testid="pot-mult" className={dead ? 'text-fg-muted' : hot ? 'text-accent' : 'text-fg'}>
          {fmtMult(mult)}
        </span>
      </div>

      {/* Jar fill visualization — transform-only animation, height stays fixed. */}
      <div
        aria-hidden="true"
        className="relative w-14 overflow-hidden rounded-b-xl rounded-t-md border border-border bg-bg-2"
        style={{ height: 120 }}
      >
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '100%',
            transformOrigin: 'bottom',
            transform: `scaleY(${fillFrac})`,
            transition: reduced ? undefined : 'transform .4s cubic-bezier(.2,.8,.2,1)',
            backgroundImage: `linear-gradient(to top, var(--neon-red, #ef4444) 0%, var(--neon-red, #ef4444) ${splitPct}%, var(--neon-lime, #a3e635) ${splitPct}%, var(--neon-lime, #a3e635) 100%)`,
            opacity: 0.85,
          }}
        />
      </div>

      <p className="text-center text-xs text-fg-muted">
        <span className="font-bold text-fg">{gems}</span> gem{gems === 1 ? '' : 's'} /{' '}
        <span className="font-bold text-fg">{total}</span> left
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          tabIndex={-1}
          disabled={!canStep || bet <= 0}
          onClick={() => onSetBet(index, Math.max(0, bet - BET_STEP))}
          aria-label={`Decrease pot ${index + 1} bet`}
          className="btn-press flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-2 text-sm font-bold disabled:opacity-40"
        >
          −
        </button>
        <span data-testid="pot-bet" className="min-w-12 text-center text-sm font-bold tabular-nums text-accent">
          {bet}
        </span>
        <button
          type="button"
          tabIndex={-1}
          disabled={!canStep || budgetLeft < BET_STEP}
          onClick={() => onSetBet(index, bet + BET_STEP)}
          aria-label={`Increase pot ${index + 1} bet`}
          className="btn-press flex h-7 w-7 items-center justify-center rounded-md border border-border bg-bg-2 text-sm font-bold disabled:opacity-40"
        >
          +
        </button>
      </div>

      <button
        type="button"
        tabIndex={-1}
        disabled={!canStep || budgetLeft <= 0}
        onClick={() => onAllIn(index)}
        className="btn-press w-full rounded-md border border-accent/50 bg-accent/10 px-2 py-1 text-xs font-bold text-accent disabled:opacity-40"
      >
        All In
      </button>

      <div className="h-4 text-center text-xs font-semibold">
        {lastResult === null ? null : lastResult.bet === 0 ? (
          <span className="text-fg-muted">sat out</span>
        ) : lastResult.winnings > 0 ? (
          <span className="text-neon-lime">+{lastResult.winnings}</span>
        ) : (
          <span className="text-neon-red">−{lastResult.bet}</span>
        )}
      </div>
    </div>
  )
}

export function GameStakehouse({ storageKey }: { storageKey: string }) {
  // SSR safety: real board is built only on the client (ZeroHour pattern).
  const [state, setState] = useState<StakehouseState | null>(null)
  const [best, setBest] = useState(0)
  const [focus, setFocus] = useState(0)
  const [badges, setBadges] = useState<JackpotBadge[]>([])

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<StakehouseState | null>(null)
  const prevPhase = useRef<StakehouseState['phase']>('betting')
  const badgeSeq = useRef(0)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const timersRef = useRef<number[]>([])
  const bestRef = useRef(0)

  const commit = useCallback((next: StakehouseState) => {
    stateRef.current = next
    setState(next)
  }, [])

  useEffect(() => {
    const b = loadBest(storageKey)
    bestRef.current = b
    setBest(b)
    const g = createGame(freshSeed())
    prevPhase.current = 'betting'
    commit(g)
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t))
      timersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(() => {
    setBadges([])
    setFocus(0)
    prevPhase.current = 'betting'
    commit(createGame(freshSeed()))
  }, [commit])

  const persistBest = useCallback(
    (next: StakehouseState) => {
      updateBestScore(next.bankroll, bestRef, storageKey, setBest)
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: StakehouseAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastEvent === 'jackpot') {
        const last = next.history[next.history.length - 1]
        if (last) {
          last.winnings.forEach((w, i) => {
            const m = last.multipliers[i]
            if (w > 0 && m !== null && m >= JACKPOT_MULT) {
              const seq = ++badgeSeq.current
              setBadges((b) => [...b, { seq, potIndex: i, amount: w }])
              // Reduced-motion never fires onAnimationEnd, so also clear on a timer —
              // otherwise the badge would linger forever.
              const id = window.setTimeout(() => {
                setBadges((b) => b.filter((x) => x.seq !== seq))
              }, BADGE_MS)
              timersRef.current.push(id)
            }
          })
        }
      }

      if (next.phase !== 'betting' && prevPhase.current === 'betting') {
        persistBest(next)
      }
      prevPhase.current = next.phase
    },
    [commit, play, persistBest],
  )

  const setBet = useCallback((pot: number, amount: number) => dispatch({ type: 'setBet', pot, amount }), [dispatch])
  const allIn = useCallback((pot: number) => dispatch({ type: 'allIn', pot }), [dispatch])
  const clearBets = useCallback(() => dispatch({ type: 'clearBets' }), [dispatch])
  const doCommit = useCallback(() => {
    const s = stateRef.current
    if (s && !canCommit(s)) play('error')
    dispatch({ type: 'commit' })
  }, [dispatch, play])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const n = s.pots.length
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          setFocus((f) => (f - 1 + n) % n)
          break
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          setFocus((f) => (f + 1) % n)
          break
        case '+':
        case '=':
          e.preventDefault()
          setBet(focus, (stateRef.current?.pendingBets[focus] ?? 0) + BET_STEP)
          break
        case '-':
          e.preventDefault()
          setBet(focus, Math.max(0, (stateRef.current?.pendingBets[focus] ?? 0) - BET_STEP))
          break
        case 'a':
        case 'A':
          e.preventDefault()
          allIn(focus)
          break
        case 'c':
        case 'C':
          e.preventDefault()
          clearBets()
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          doCommit()
          break
        case 'Escape':
          e.preventDefault()
          clearBets()
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard()
          break
      }
    },
    [focus, setBet, allIn, clearBets, doCommit, startBoard],
  )

  useEffect(() => {
    if (!state) return
    cardRefs.current[focus]?.focus()
  }, [focus, state])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-160 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="stakehouse-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const busted = state.phase === 'busted'
  const won = state.phase === 'complete'
  const terminal = busted || won
  const totalPending = state.pendingBets.reduce((a, b) => a + b, 0)
  const hotFlags = hotZonePots(state)
  const lastRound = state.history[state.history.length - 1] ?? null

  const hint = won
    ? `Ran the full ${ROUNDS} rounds — cash out with ${state.bankroll} chips.`
    : busted
      ? 'Busted — New Board to try again.'
      : 'Split your chips across the jars and Commit — payout tracks the gems still left, live.'

  return (
    <GameShell
      stats={[
        { label: 'Bankroll', value: state.bankroll, testId: 'bankroll', float: true },
        { label: 'Round', value: state.round },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      onNewGame={startBoard}
      newGameLabel={won ? 'Play again' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-160"
    >
      <style>{SH_STYLE}</style>
      <div
        role="group"
        aria-label="Stakehouse board"
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'sh-board-in .3s ease-out both' }}
        data-testid="stakehouse-board"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {state.pots.map((pot, i) => {
            const otherBets = state.pendingBets.reduce((sum, b, idx) => (idx === i ? sum : sum + b), 0)
            const lastResult = lastRound
              ? { bet: lastRound.bets[i], drawn: lastRound.drawn[i], winnings: lastRound.winnings[i] }
              : null
            return (
              <PotCard
                key={i}
                pot={pot}
                index={i}
                bet={state.pendingBets[i]}
                bankroll={state.bankroll}
                otherBets={otherBets}
                focused={i === focus}
                disabled={state.phase !== 'betting'}
                hot={hotFlags[i]}
                reduced={reduced}
                lastResult={lastResult}
                onSetBet={setBet}
                onAllIn={allIn}
                onFocus={setFocus}
                cardRef={(el) => {
                  cardRefs.current[i] = el
                }}
              />
            )
          })}
        </div>

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="jackpot-badge"
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-sm font-bold text-accent"
            style={reduced ? undefined : { animation: 'sh-badge .9s ease-out both' }}
          >
            Jackpot! Pot {b.potIndex + 1} +{b.amount}
          </span>
        ))}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-sm text-fg-muted">
            Wagering <span className="font-bold text-fg">{totalPending}</span> /{' '}
            <span className="font-bold text-fg">{state.bankroll}</span>
          </span>
          <div className="flex gap-2">
            <GameButton variant="ghost" onClick={clearBets} disabled={state.phase !== 'betting'}>
              Clear
            </GameButton>
            <GameButton onClick={doCommit} disabled={!canCommit(state)}>
              Commit Round
            </GameButton>
          </div>
        </div>

        <GameOverlay
          show={terminal}
          variant={busted ? 'lose' : 'win'}
          title={busted ? 'Busted' : 'House Closed'}
          testId={busted ? 'game-over' : 'you-win'}
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Final bankroll <span className="font-bold text-accent">{state.bankroll}</span>
            </p>
            <p>
              Survived <span className="font-bold text-accent">{state.round}</span> / {ROUNDS} rounds
            </p>
            <p>
              Best <span className="font-bold text-accent">{best}</span>
            </p>
          </div>
          <GameButton onClick={startBoard}>Play again</GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
