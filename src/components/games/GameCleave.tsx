'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  START_LIVES,
  createGame,
  isValidSplit,
  reduce,
  sumMy,
  type CleaveAction,
  type CleaveEvent,
  type CleaveState,
  type Item,
  type Pile,
} from '@/lib/games/cleave/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const SOUND: Record<CleaveEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  assign: 'flip',
  illegal: 'error',
  commit: 'move',
  safe: 'merge',
  perfect: 'match',
  robbed: 'mismatch',
  quotaFail: 'lose',
  next: 'flip',
  over: 'lose',
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const n = Number(localStorage.getItem(storageKey))
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

/** best:<slug> holds a bare number — the weekly leaderboard reads it with Number(). */
function saveBest(storageKey: string, best: number): void {
  try {
    localStorage.setItem(storageKey, String(best))
  } catch {
    // ignore storage failures
  }
}

function LivesPips({ lives }: { lives: number }) {
  return (
    <span
      className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm"
      aria-label={`${lives} lives left`}
    >
      {Array.from({ length: START_LIVES }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={i < lives ? '' : 'opacity-25'}
          style={{ color: 'var(--neon-red)' }}
        >
          ♥
        </span>
      ))}
    </span>
  )
}

function itemLabel(it: Item, pile: Pile, revealed: boolean): string {
  const rival =
    it.sealed && !revealed
      ? `rival value between ${it.bandLo} and ${it.bandHi}, sealed`
      : `rival value ${it.theirValue}`
  return `Item ${it.id + 1}, your value ${it.myValue}, ${rival}, in pile ${pile}`
}

/** Magenta total as the player can know it: a range while the seal holds. */
function theirRange(
  items: Item[],
  assign: Pile[],
  pile: Pile,
  revealed: boolean,
): { lo: number; hi: number } {
  let lo = 0
  let hi = 0
  for (let i = 0; i < items.length; i++) {
    if (assign[i] !== pile) continue
    const it = items[i]
    if (it.sealed && !revealed) {
      lo += it.bandLo
      hi += it.bandHi
    } else {
      lo += it.theirValue
      hi += it.theirValue
    }
  }
  return { lo, hi }
}

export function GameCleave({ storageKey }: { storageKey: string }) {
  // SSR safety: the board is built on the client only.
  const [state, setState] = useState<CleaveState | null>(null)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [focus, setFocus] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<CleaveState | null>(null)
  const prevOver = useRef(false)
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commitState = useCallback((next: CleaveState) => {
    stateRef.current = next
    setState(next)
  }, [])

  useEffect(() => {
    setBest(loadBest(storageKey))
    const g = createGame(freshSeed())
    prevOver.current = false
    commitState(g)
  }, [storageKey, commitState])

  const dispatch = useCallback(
    (action: CleaveAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commitState(next)

      const isOverNow = next.phase === 'over' && !prevOver.current

      // 종료 틱의 사운드는 신기록 여부로 아래에서 결정한다. SOUND.over/quotaFail이
      // 'lose'라, 여기서 그냥 울리면 신기록에도 'lose'가 나 win과 겹친다.
      const sound = SOUND[next.lastEvent]
      if (sound && !isOverNow) play(sound)

      if (action.type === 'commit' && next.phase !== 'split') {
        setBest((b) => Math.max(b, next.score))
      }
      if (isOverNow) {
        const prevBest = loadBest(storageKey)
        const isNew = next.score > prevBest
        const top = Math.max(prevBest, next.score)
        setBest(top)
        saveBest(storageKey, top)
        setNewBest(isNew)
        play(isNew ? 'win' : 'lose')
      }
      prevOver.current = next.phase === 'over'
      if (action.type === 'new' || action.type === 'reset') {
        setNewBest(false)
        setFocus(0)
      }
    },
    [commitState, play, storageKey],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const n = s.board.items.length

      if (e.key >= '1' && e.key <= '9') {
        const i = Number(e.key) - 1
        if (i < n) {
          e.preventDefault()
          setFocus(i)
          dispatch({ type: 'toggle', item: i })
        }
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setFocus((f) => (f - 1 + n) % n)
          break
        case 'ArrowRight':
          e.preventDefault()
          setFocus((f) => (f + 1) % n)
          break
        case 'ArrowUp':
          e.preventDefault()
          dispatch({ type: 'assign', item: focus, pile: 'A' })
          break
        case 'ArrowDown':
          e.preventDefault()
          dispatch({ type: 'assign', item: focus, pile: 'B' })
          break
        case ' ':
          e.preventDefault()
          dispatch({ type: 'toggle', item: focus })
          break
        case 'Enter':
          e.preventDefault()
          if (s.phase === 'split') {
            if (isValidSplit(s.assign)) dispatch({ type: 'commit' })
          } else if (s.phase === 'reveal') {
            dispatch({ type: 'next' })
          }
          break
        case 'r':
        case 'R':
          e.preventDefault()
          dispatch({ type: 'new', seed: freshSeed() })
          break
      }
    },
    [dispatch, focus],
  )

  useEffect(() => {
    if (!state || state.phase !== 'split') return
    chipRefs.current[focus]?.focus()
  }, [focus, state])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-150 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="cleave-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const { items } = state.board
  const { assign, phase } = state
  const revealed = phase !== 'split'
  const result = state.lastResult
  const valid = isValidSplit(assign)

  const hint =
    phase === 'split'
      ? 'Split the loot. Cyan = your value, magenta = what the rival sees. The rival takes the pile with the bigger magenta total.'
      : phase === 'reveal' && result
        ? `Rival took pile ${result.rivalTook}. Press Enter to continue.`
        : 'Out of lives.'

  // Margin meter: signed magenta lead of A over B, normalized by the largest
  // total on the board so the bar never overflows its track.
  const rA = theirRange(items, assign, 'A', revealed)
  const rB = theirRange(items, assign, 'B', revealed)
  const midA = (rA.lo + rA.hi) / 2
  const midB = (rB.lo + rB.hi) / 2
  const span = Math.max(1, rA.hi + rB.hi)
  const lead = (midA - midB) / span // -1..1
  const uncertain = (rA.hi - rA.lo + (rB.hi - rB.lo)) / span

  function pileView(pile: Pile) {
    const r = pile === 'A' ? rA : rB
    const mine = sumMy(items, assign, pile)
    const took = revealed && result ? result.rivalTook === pile : false
    const kept = revealed && result ? result.keptPile === pile : false
    const border = took ? 'border-neon-red' : kept ? 'border-neon-lime' : 'border-border'
    return (
      <div
        className={`relative rounded-lg border-2 ${border} bg-bg/40 p-3 transition-colors`}
        style={took && !reduced ? { animation: 'cl-grab .4s ease-out both' } : undefined}
      >
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold text-fg-muted">Pile {pile}</span>
          <span className="text-sm tabular-nums">
            <span style={{ color: 'var(--neon-magenta)' }} className="font-bold">
              {r.lo === r.hi ? r.lo : `${r.lo}–${r.hi}`}
            </span>
            <span className="text-fg-muted"> · </span>
            <span style={{ color: 'var(--neon-cyan)' }} className="font-bold">
              {mine}
            </span>
          </span>
        </div>

        <div className="flex min-h-[9rem] flex-wrap content-start gap-2">
          {items.map((it, i) => {
            if (assign[i] !== pile) return null
            const showTrue = revealed || !it.sealed
            return (
              <button
                key={it.id}
                ref={(el) => {
                  chipRefs.current[i] = el
                }}
                type="button"
                data-testid="chip"
                aria-pressed={assign[i] === 'A'}
                aria-label={itemLabel(it, pile, revealed)}
                tabIndex={i === focus ? 0 : -1}
                onFocus={() => setFocus(i)}
                onClick={() => dispatch({ type: 'toggle', item: i })}
                className="flex h-16 w-14 flex-col items-center justify-center rounded-lg border border-border bg-surface transition-transform hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                style={reduced ? undefined : { animation: 'cl-chip-hop .16s ease-out both' }}
              >
                <span
                  className="text-xl font-extrabold tabular-nums leading-none"
                  style={{ color: 'var(--neon-cyan)' }}
                >
                  {it.myValue}
                </span>
                <span
                  className="mt-1 text-xs font-bold tabular-nums leading-none"
                  style={{ color: 'var(--neon-magenta)' }}
                >
                  {showTrue ? (
                    it.theirValue
                  ) : (
                    <>
                      {it.bandLo}–{it.bandHi}
                      <span
                        className="ml-0.5"
                        style={reduced ? undefined : { animation: 'cl-seal-pulse 1.6s ease-in-out infinite' }}
                      >
                        🔒
                      </span>
                    </>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {took && (
          <span className="absolute -top-2.5 left-2 rounded-full border border-neon-red bg-bg px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-neon-red">
            RIVAL TOOK
          </span>
        )}
        {kept && result && (
          <span
            className="absolute -top-2.5 left-2 rounded-full border border-neon-lime bg-bg px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-neon-lime"
            style={reduced ? undefined : { animation: 'cl-float .6s ease-out both' }}
          >
            +{result.myKept}
          </span>
        )}
      </div>
    )
  }

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, float: true, testId: 'points' },
        { label: 'Round', value: state.round },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      headerExtra={<LivesPips lives={state.lives} />}
      onNewGame={() => dispatch({ type: 'new', seed: freshSeed() })}
      newGameLabel={phase === 'over' ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-150"
    >
      <div
        role="group"
        aria-label="Cleave board"
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'cl-board-in .3s ease-out both' }}
        data-testid="cleave-board"
      >
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-fg-muted">
          <span>
            Quota <span className="font-bold text-accent tabular-nums">{state.board.quota}</span>
          </span>
          <span>
            Safe optimum{' '}
            <span className="font-bold text-accent tabular-nums">{state.board.bestGuaranteed}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {pileView('A')}
          {pileView('B')}
        </div>

        {/* Margin meter: which pile looks fatter to the rival, and how much of
            that lead is still hidden inside the seal. */}
        <div className="mt-3">
          <div className="relative mx-auto h-2.5 w-full overflow-hidden rounded-full bg-bg/60">
            {/* Two mirrored halves: the lead grows outward from the centre line,
                with the sealed uncertainty laid over it in amber. */}
            <div className="absolute inset-y-0 left-1/2 z-10 w-px bg-border" />
            {(['B', 'A'] as const).map((side) => {
              const active = side === 'A' ? lead > 0 : lead < 0
              const half = side === 'A' ? 'left-1/2' : 'right-1/2'
              const origin = side === 'A' ? 'left center' : 'right center'
              return (
                <div key={side} className={`absolute inset-y-0 ${half} w-1/2`}>
                  <div
                    className={`absolute inset-0 rounded-full ${reduced ? '' : 'transition-transform duration-200'}`}
                    style={{
                      background: 'var(--neon-magenta)',
                      opacity: 0.85,
                      transformOrigin: origin,
                      transform: `scaleX(${active ? Math.min(1, Math.abs(lead)) : 0})`,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className={`absolute inset-0 rounded-full ${reduced ? '' : 'transition-transform duration-200'}`}
                    style={{
                      background: 'var(--neon-amber)',
                      opacity: 0.35,
                      transformOrigin: origin,
                      transform: `scaleX(${active ? Math.min(1, uncertain) : 0})`,
                    }}
                  />
                </div>
              )
            })}
          </div>
          <p className="mt-1 text-center text-xs text-fg-muted">
            {lead === 0
              ? 'Piles look even to the rival'
              : `Rival leans ${lead > 0 ? 'A' : 'B'}`}
          </p>
        </div>

        <div className="mt-3 flex justify-center">
          {phase === 'split' ? (
            <GameButton disabled={!valid} onClick={() => dispatch({ type: 'commit' })}>
              Cleave
            </GameButton>
          ) : phase === 'reveal' ? (
            <GameButton onClick={() => dispatch({ type: 'next' })}>Continue</GameButton>
          ) : null}
        </div>

        {phase === 'reveal' && result && (
          <div
            aria-live="polite"
            className="mt-3 rounded-lg border border-border bg-bg/40 p-3 text-center text-sm"
          >
            <p>
              You kept <span className="font-bold text-neon-lime">{result.myKept}</span> · Rival took{' '}
              <span className="font-bold text-neon-red">{result.myGiven}</span> · Margin{' '}
              <span className="font-bold text-accent">{result.margin}</span> · Sealed was{' '}
              <span className="font-bold" style={{ color: 'var(--neon-magenta)' }}>
                {result.sealedTheirValue}
              </span>
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              Safe optimum {result.bestGuaranteed} · Perfect line was {result.hindsightOptimum} ·
              Left on table {result.leftOnTable}
            </p>
            {result.robbed && (
              <p className="mt-1 font-bold text-neon-red">You got robbed — the fat pile walked.</p>
            )}
            {!result.metQuota && (
              <p className="mt-1 font-bold text-neon-red">
                Under quota ({result.myKept} &lt; {state.board.quota}) — lost a life.
              </p>
            )}
          </div>
        )}

        <GameOverlay show={phase === 'over'} variant={newBest ? 'win' : 'lose'} title={newBest ? 'New best!' : 'Cleaved Out'} testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Round <span className="font-bold text-accent">{state.round}</span>
            </p>
            <p>
              Perfects <span className="font-bold text-accent">{state.perfects}</span>
            </p>
          </div>
          <GameButton onClick={() => dispatch({ type: 'new', seed: freshSeed() })}>
            Play again
          </GameButton>
        </GameOverlay>

        <style>{`
          @keyframes cl-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes cl-chip-hop { from { transform: translateY(-10px) } to { transform: none } }
          @keyframes cl-grab { 0% { transform: scale(1); opacity: .5 } 50% { transform: scale(1.04); opacity: 1 } 100% { transform: scale(1) } }
          @keyframes cl-float { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
          @keyframes cl-seal-pulse { 0%, 100% { opacity: .6 } 50% { opacity: 1 } }
        `}</style>
      </div>
    </GameShell>
  )
}
