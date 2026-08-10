'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  bank,
  depthMult,
  fatalOdds,
  flip,
  idleState,
  newDescent,
  nextFlipEV,
  peekNext,
  shouldBank,
  tilesRemaining,
  TIER_NORMAL,
  type ProspectorState,
  type Tile,
} from '@/lib/games/prospector/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Component-scoped keyframes — globals.css stays untouched.
const PROS_STYLE = `
@keyframes pros-flip {
  from { transform: rotateY(90deg); opacity: 0; }
  to   { transform: rotateY(0deg); opacity: 1; }
}
@keyframes pros-shake {
  0%,100% { transform: translate(0,0); }
  20% { transform: translate(-6px,3px); }
  40% { transform: translate(6px,-2px); }
  60% { transform: translate(-4px,2px); }
  80% { transform: translate(4px,-1px); }
}
@keyframes pros-suspense {
  0%,100% { transform: scale(1); box-shadow: 0 0 12px 2px rgba(251,191,36,0.25); }
  50% { transform: scale(1.05); box-shadow: 0 0 26px 6px rgba(251,191,36,0.55); }
}
@keyframes pros-glow {
  0% { text-shadow: 0 0 0 rgba(251,191,36,0); transform: scale(1); }
  40% { text-shadow: 0 0 18px rgba(251,191,36,0.9); transform: scale(1.18); }
  100% { text-shadow: 0 0 0 rgba(251,191,36,0); transform: scale(1); }
}
@keyframes pros-dust {
  from { transform: translateY(-8px); opacity: 0.7; }
  to   { transform: translateY(46px); opacity: 0; }
}
.pros-flip { animation: pros-flip 0.28s ease-out; transform-origin: center; }
.pros-suspense { animation: pros-suspense 0.62s ease-in-out; }
.pros-glow { animation: pros-glow 0.5s ease-out; }
.pros-shake { animation: pros-shake 0.45s ease-in-out; }
.pros-dust-p { animation: pros-dust 1.1s linear infinite; }
`

const SUSPENSE_MS = 650

function tileFace(t: Tile): string {
  if (t.kind === 'gas') return '☠️'
  if (t.kind === 'dynamite') return '🧨'
  return '💎'
}

// Gem tint by face value — richer color for rarer gems.
function gemTint(value: number): string {
  switch (value) {
    case 5:
      return 'text-neon-magenta'
    case 3:
      return 'text-neon-purple'
    case 2:
      return 'text-neon-cyan'
    default:
      return 'text-neon-green'
  }
}

function fmt(n: number): string {
  return String(Math.round(n))
}

export function GameProspector({ storageKey }: { storageKey: string }) {
  // SSR-safe: real initial state created in the mount effect.
  const [state, setState] = useState<ProspectorState | null>(null)
  const [best, setBest] = useState(0)
  const [deepest, setDeepest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [peek, setPeek] = useState<Tile | null>(null)
  const [showPeek, setShowPeek] = useState(false)
  const [verdict, setVerdict] = useState('')
  const [lastGained, setLastGained] = useState(0)
  const [flipKey, setFlipKey] = useState(0)
  const [glowKey, setGlowKey] = useState(0)
  const [shakeKey, setShakeKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<ProspectorState | null>(null)
  const bestRef = useRef(0)
  const deepestRef = useRef(0)
  const evBeforeRef = useRef(0)
  const timersRef = useRef<number[]>([])
  const boardRef = useRef<HTMLDivElement | null>(null)

  const commit = useCallback((s: ProspectorState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
  }, [])

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }, [])

  // Mount: idle state + load records.
  useEffect(() => {
    commit(idleState(0))
    const b = Number(localStorage.getItem(storageKey))
    const bv = Number.isFinite(b) && b > 0 ? b : 0
    bestRef.current = bv
    setBest(bv)
    const d = Number(localStorage.getItem(`${storageKey}:depth`))
    const dv = Number.isFinite(d) && d > 0 ? d : 0
    deepestRef.current = dv
    setDeepest(dv)
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearPeek = useCallback(() => {
    setPeek(null)
    setShowPeek(false)
    setVerdict('')
  }, [])

  const startDescent = useCallback(() => {
    clearTimers()
    clearPeek()
    setNewBest(false)
    commit(newDescent(TIER_NORMAL, Math.random, stateRef.current ?? idleState()))
    play('move')
    boardRef.current?.focus()
  }, [clearTimers, clearPeek, commit, play])

  // Full career reset — clears score, keeps Best/Deepest.
  const newGame = useCallback(() => {
    clearTimers()
    clearPeek()
    setNewBest(false)
    commit(newDescent(TIER_NORMAL, Math.random, idleState(0)))
    play('move')
    boardRef.current?.focus()
  }, [clearTimers, clearPeek, commit, play])

  const doFlip = useCallback(() => {
    const cur = stateRef.current
    if (!cur) return
    if (cur.phase !== 'descending') {
      play('error')
      return
    }
    evBeforeRef.current = nextFlipEV(cur)
    const next = flip(cur)
    commit(next)
    setFlipKey((k) => k + 1)
    const kind = next.lastTile?.kind

    if (next.phase === 'collapsed') {
      play('lose')
      if (!reducedRef.current) setShakeKey((k) => k + 1)
      recordResult(storageKey.replace(/^best:/, ''), { won: false })
      return
    }
    if (kind === 'gas') {
      play('flag')
    } else if (kind === 'dynamite') {
      play('merge')
      if (!reducedRef.current) setGlowKey((k) => k + 1)
    } else if (kind === 'gem') {
      play('flip')
      const big = (next.lastTile?.value ?? 0) >= 3 || depthMult(next.safeFlips - 1) >= 2
      if (big && !reducedRef.current) setGlowKey((k) => k + 1)
      if (!reducedRef.current) after(120, () => play('match'))
    }
  }, [after, commit, play, reducedRef, storageKey])

  const doBank = useCallback(() => {
    const cur = stateRef.current
    if (!cur || cur.phase !== 'descending') return
    evBeforeRef.current = nextFlipEV(cur)
    const gained = Math.round(cur.potValue)
    const next = bank(cur)
    commit(next)
    setLastGained(gained)

    const isBest = gained > bestRef.current && gained > 0
    if (isBest) {
      bestRef.current = gained
      setBest(gained)
      localStorage.setItem(storageKey, String(gained))
      setNewBest(true)
      play('win')
    } else {
      setNewBest(false)
      play('merge')
    }

    if (cur.safeFlips > deepestRef.current) {
      deepestRef.current = cur.safeFlips
      setDeepest(cur.safeFlips)
      localStorage.setItem(`${storageKey}:depth`, String(cur.safeFlips))
    }

    recordResult(storageKey.replace(/^best:/, ''), { won: true })

    setVerdict(
      evBeforeRef.current <= 0
        ? 'Disciplined bank — flipping was −EV ✓'
        : 'You banked early — the next flip was still +EV',
    )

    // Near-miss reveal after a suspense beat.
    const p = peekNext(next)
    setPeek(p)
    setShowPeek(false)
    const revealDelay = reducedRef.current ? 0 : SUSPENSE_MS
    after(revealDelay, () => {
      setShowPeek(true)
      play('flip')
    })
  }, [after, commit, play, reducedRef, storageKey])

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current
      if (!s) return
      if (isTypingTarget(e.target)) return
      if (s.phase === 'idle') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          startDescent()
        }
        return
      }
      if (s.phase === 'descending') {
        if (e.key === ' ') {
          e.preventDefault()
          doFlip()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          doBank()
        }
        return
      }
      // collapsed / banked
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        startDescent()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doBank, doFlip, startDescent])

  const phase = state?.phase ?? 'idle'
  const gasCount = state?.gasCount ?? 0
  const potValue = state?.potValue ?? 0
  const safeFlips = state?.safeFlips ?? 0
  const score = state?.score ?? 0
  const mult = depthMult(safeFlips)
  const p = state ? fatalOdds(state) : 0
  const tilesLeft = state ? tilesRemaining(state) : 0
  const nudge = state ? shouldBank(state) : false
  const collapsed = phase === 'collapsed'
  const banked = phase === 'banked'
  const descending = phase === 'descending'

  const faceUp = state ? state.deck.slice(0, state.cursor) : []

  const hint =
    phase === 'idle'
      ? 'FLIP to dig deeper, BANK to keep your loot. Three gas tiles collapse the shaft and you lose the pot.'
      : descending
        ? 'Watch the fatal odds. Bank before greed buries you.'
        : collapsed
          ? 'The shaft collapsed — the pot is gone. Press R for a new descent.'
          : 'Banked! Press R to descend again.'

  // Fatal odds display.
  const fatalPct = Math.round(p * 100)
  const fatalText = p > 0 ? `${fatalPct}%` : gasCount < 2 ? 'Safe so far' : '—'

  const dustCount = descending ? (gasCount >= 2 ? 8 : gasCount === 1 ? 3 : 0) : 0
  const dimStyle = descending
    ? { filter: gasCount >= 2 ? 'brightness(0.72)' : gasCount === 1 ? 'brightness(0.87)' : 'none' }
    : undefined

  const peekLine = (() => {
    if (!peek || !state) return ''
    if (peek.kind === 'gas') {
      return state.gasCount === 2
        ? 'You walked away one tile before the collapse.'
        : 'The next tile was gas — you dodged it.'
    }
    if (peek.kind === 'dynamite') return 'You left a pot-doubler in the ground.'
    return `You left a +${peek.value} ×${depthMult(state.safeFlips)} in the ground.`
  })()

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Deepest', value: deepest },
      ]}
      onNewGame={phase === 'idle' ? startDescent : newGame}
      newGameLabel={phase === 'idle' ? 'Start' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{PROS_STYLE}</style>
      <div
        ref={boardRef}
        tabIndex={-1}
        data-testid="prospector-board"
        aria-label="Prospector board"
        className="anim-board-in relative flex w-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 outline-none"
        key={`board-${shakeKey}`}
      >
        <div className={!reduced && collapsed ? 'pros-shake' : ''} key={`shake-${shakeKey}`}>
          {/* Live odds readout */}
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-bg-2 px-3 py-1.5">
              <div className="text-xs uppercase tracking-wide text-fg-muted">Next fatal</div>
              <div
                data-testid="fatal-odds"
                className={`font-bold ${p >= 0.3 ? 'text-neon-red' : p > 0 ? 'text-accent' : 'text-fg'}`}
              >
                {fatalText}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-bg-2 px-3 py-1.5">
              <div className="text-xs uppercase tracking-wide text-fg-muted">Gas up</div>
              <div className="font-bold text-fg">{gasCount}/3</div>
            </div>
            <div className="rounded-lg border border-border bg-bg-2 px-3 py-1.5">
              <div className="text-xs uppercase tracking-wide text-fg-muted">Pot ×{mult}</div>
              <div key={`glow-${glowKey}`} data-testid="pot" className={`font-bold text-accent ${!reduced && glowKey > 0 ? 'pros-glow inline-block' : ''}`}>
                {fmt(potValue)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-bg-2 px-3 py-1.5">
              <div className="text-xs uppercase tracking-wide text-fg-muted">Tiles left</div>
              <div className="font-bold text-fg">{tilesLeft}</div>
            </div>
          </div>

          {/* Shaft — flip target */}
          <div
            data-testid="prospector-shaft"
            role="button"
            tabIndex={0}
            aria-label="Flip the top tile"
            onClick={descending ? doFlip : phase === 'idle' ? startDescent : undefined}
            style={dimStyle}
            className={`relative flex min-h-40 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-border bg-bg-2 p-4 transition-[filter] ${
              descending ? 'cursor-pointer hover:border-accent/60' : ''
            }`}
          >
            {/* Falling dust particles ramp with gasCount */}
            {!reduced &&
              Array.from({ length: dustCount }).map((_, i) => (
                <span
                  key={`dust-${gasCount}-${i}`}
                  aria-hidden="true"
                  className="pros-dust-p pointer-events-none absolute top-1 text-xs opacity-60"
                  style={{ left: `${(i * 97) % 92 + 4}%`, animationDelay: `${(i % 4) * 0.22}s` }}
                >
                  ·
                </span>
              ))}

            {phase === 'idle' && (
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-2xl font-extrabold tracking-tight text-fg">Prospector</p>
                <p className="max-w-72 text-sm text-fg-muted">
                  Flip tiles to grow the pot. Bank before the third gas buries you.
                </p>
                <GameButton onClick={startDescent} className="px-5 py-2">
                  Start
                </GameButton>
              </div>
            )}

            {descending && (
              <>
                <span
                  key={`face-${flipKey}`}
                  aria-hidden="true"
                  className={`text-6xl ${!reduced ? 'pros-flip' : ''} ${
                    state?.lastTile ? gemTint(state.lastTile.value) : ''
                  }`}
                >
                  {state?.lastTile ? tileFace(state.lastTile) : '⛏️'}
                </span>
                <span className="text-xs uppercase tracking-widest text-fg-muted">
                  {state?.lastTile
                    ? state.lastTile.kind === 'gem'
                      ? `+${state.lastTile.value} landed`
                      : state.lastTile.kind === 'dynamite'
                        ? 'Pot doubled!'
                        : `Gas ${gasCount}/3 — careful`
                    : 'Tap or press Space to flip'}
                </span>
                {nudge && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                    Banking is +EV
                  </span>
                )}
              </>
            )}

            {collapsed && (
              <div className="flex flex-col items-center gap-1 text-center">
                <span aria-hidden="true" className="text-6xl">
                  💥
                </span>
                <span className="text-sm font-semibold text-neon-red">The shaft collapsed</span>
              </div>
            )}

            {banked && (
              <div className="flex flex-col items-center gap-2 text-center">
                {peek && showPeek ? (
                  <span
                    key="peek-face"
                    aria-hidden="true"
                    className={`text-6xl ${!reduced ? 'pros-flip' : ''} ${gemTint(peek.value)}`}
                  >
                    {tileFace(peek)}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className={`text-6xl ${!reduced && !showPeek ? 'pros-suspense' : ''}`}
                  >
                    🂠
                  </span>
                )}
                <span className="text-xs uppercase tracking-widest text-fg-muted">
                  {showPeek ? peekLine || 'What you left behind' : 'What came next…'}
                </span>
              </div>
            )}
          </div>

          {/* Flipped tiles row */}
          {faceUp.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1" aria-label="Flipped tiles">
              {faceUp.map((t, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-surface text-sm ${
                    t.kind === 'gem' ? gemTint(t.value) : ''
                  }`}
                  title={t.kind === 'gem' ? `Gem +${t.value}` : t.kind}
                >
                  {tileFace(t)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bank bar — bank target */}
        <div
          data-testid="prospector-bank"
          role="button"
          tabIndex={0}
          aria-label="Bank the pot"
          onClick={descending && potValue > 0 ? doBank : undefined}
          className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
            descending && potValue > 0
              ? 'cursor-pointer border-accent/50 bg-accent/10 hover:border-accent'
              : 'border-border bg-bg-2 opacity-70'
          }`}
        >
          <span className="text-sm font-semibold text-fg">Bank the pot</span>
          <span className="text-lg font-extrabold text-accent">+{fmt(potValue)}</span>
        </div>

        {/* Big buttons */}
        <div className="grid grid-cols-2 gap-2">
          <GameButton
            onClick={doFlip}
            disabled={!descending}
            aria-label="Flip the top tile"
            className="py-3 text-base"
          >
            FLIP ⛏️
          </GameButton>
          <GameButton
            variant="ghost"
            onClick={doBank}
            disabled={!descending || potValue <= 0}
            aria-label="Bank the pot"
            className="py-3 text-base"
          >
            BANK 💰
          </GameButton>
        </div>

        {(collapsed || banked) && (
          <GameButton onClick={startDescent} className="py-3 text-base" aria-label="New descent">
            New Descent (R)
          </GameButton>
        )}

        {/* Collapse overlay */}
        <GameOverlay
          show={collapsed}
          variant="lose"
          title="Shaft collapsed"
          testId="game-over"
        >
          <p className="text-sm text-fg-muted">
            The third gas buried your pot. All un-banked loot is lost.
          </p>
          <GameButton onClick={startDescent} className="px-4 py-2">
            New Descent
          </GameButton>
        </GameOverlay>

        {/* New-best win overlay */}
        <GameOverlay
          show={banked && newBest}
          variant="win"
          title={`New best! +${lastGained}`}
          testId="you-win"
        >
          <p className="text-sm text-fg-muted">{verdict || 'Banked a record pot.'}</p>
          {showPeek && peek && (
            <p className="text-sm text-fg">{peekLine}</p>
          )}
          <GameButton onClick={startDescent} className="px-4 py-2">
            Descend again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
