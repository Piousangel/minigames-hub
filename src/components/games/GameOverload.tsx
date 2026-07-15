'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addCharge,
  CAPACITY,
  CELLS,
  COLS,
  mulberry32,
  newGame,
  nextBoard,
  ROWS,
  TAP_BUDGET,
  type CascadeResult,
  type GameState,
  type Mode,
} from '@/lib/games/overload/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const TAP_DELAY = 120 // ms: show the tapped +1 before the first wave fires
const WAVE_DELAY = 140 // ms between cascade waves (the "crescendo")
const MAX_ANIM_WAVES = 24 // cap the visual replay for pathological long cascades
const MAX_SHAKE = 6 // shake intensity ceiling

interface BoardRecord {
  best: number
  fewestTaps: number
}
type BoardsMap = Record<string, BoardRecord>

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

export function GameOverload({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 보드는 클라이언트에서만 생성한다.
  const [state, setState] = useState<GameState | null>(null)
  const [display, setDisplay] = useState<number[]>(() => new Array(CELLS).fill(0))
  const [best, setBest] = useState(0)
  const [mode, setMode] = useState<Mode>('puzzle')
  const [combo, setCombo] = useState(0)
  const [chainBanner, setChainBanner] = useState<number | null>(null)
  const [flash, setFlash] = useState<{ set: number[]; key: number }>({ set: [], key: 0 })
  const [shake, setShake] = useState(0)
  const [popKey, setPopKey] = useState(0)
  const [popIndex, setPopIndex] = useState(-1)
  const [cursor, setCursor] = useState(0)
  const [boardRecord, setBoardRecord] = useState<BoardRecord | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const bestRef = useRef(0)
  const boardsRef = useRef<BoardsMap>({})
  const lockedRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const cellsRef = useRef<(HTMLButtonElement | null)[]>([])

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
  }, [])

  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms))
  }, [])

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  // Load/refresh the per-board record shown in the hint line.
  const refreshBoardRecord = useCallback((seed: number) => {
    const rec = boardsRef.current[String(seed)] ?? null
    setBoardRecord(rec)
  }, [])

  const startRun = useCallback(
    (nextMode: Mode, seed: number) => {
      clearTimers()
      lockedRef.current = false
      setCombo(0)
      setChainBanner(null)
      setFlash({ set: [], key: 0 })
      setShake(0)
      setCursor(0)
      const fresh = newGame(mulberry32(seed), nextMode, seed)
      setDisplay(fresh.charges.slice())
      commit(fresh)
      refreshBoardRecord(seed)
    },
    [clearTimers, commit, refreshBoardRecord],
  )

  // Client-only bootstrap: read persistence, generate the first board.
  useEffect(() => {
    const storedBest = Number(localStorage.getItem(storageKey))
    bestRef.current = Number.isFinite(storedBest) && storedBest > 0 ? storedBest : 0
    setBest(bestRef.current)

    try {
      const raw = localStorage.getItem(`${storageKey}:boards`)
      boardsRef.current = raw ? (JSON.parse(raw) as BoardsMap) : {}
    } catch {
      boardsRef.current = {}
    }

    const storedMode = localStorage.getItem(`${storageKey}:mode`)
    const initialMode: Mode = storedMode === 'endless' ? 'endless' : 'puzzle'
    setMode(initialMode)
    startRun(initialMode, randomSeed())

    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persistBest = useCallback(
    (score: number) => {
      if (score > bestRef.current) {
        bestRef.current = score
        setBest(score)
        try {
          localStorage.setItem(storageKey, String(score))
        } catch {
          /* storage unavailable */
        }
      }
    },
    [storageKey],
  )

  const persistBoard = useCallback(
    (s: GameState) => {
      const key = String(s.seed)
      const prev = boardsRef.current[key]
      const tapsUsed = TAP_BUDGET - s.tapsLeft
      const record: BoardRecord = {
        best: Math.max(prev?.best ?? 0, s.score),
        fewestTaps: s.cleared
          ? Math.min(prev?.fewestTaps ?? Number.MAX_SAFE_INTEGER, tapsUsed)
          : prev?.fewestTaps ?? Number.MAX_SAFE_INTEGER,
      }
      boardsRef.current[key] = record
      setBoardRecord(record)
      try {
        localStorage.setItem(`${storageKey}:boards`, JSON.stringify(boardsRef.current))
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey],
  )

  const resolveOutcome = useCallback(
    (next: GameState) => {
      persistBest(next.score)
      if (next.cleared) {
        play('win')
        persistBoard(next)
      } else if (next.over) {
        play('lose')
        persistBoard(next)
      }
    },
    [persistBest, persistBoard, play],
  )

  const finishCascade = useCallback(
    (next: GameState, result: CascadeResult) => {
      setDisplay(next.charges.slice())
      setCombo(result.chainLength)
      setChainBanner(result.chainLength)
      setShake(0)
      lockedRef.current = false
      commit(next)
      resolveOutcome(next)
    },
    [commit, resolveOutcome],
  )

  const handleTap = useCallback(
    (index: number) => {
      const s = stateRef.current
      if (lockedRef.current || !s || s.over || s.cleared || s.tapsLeft <= 0) {
        play('error')
        return
      }

      const { state: next, result } = addCharge(s, index)

      // Reset any lingering banner from a previous tap.
      setChainBanner(null)

      // Immediate feedback: the tapped cell pops.
      setPopIndex(index)
      setPopKey((k) => k + 1)

      if (result.waves.length === 0) {
        // No overload — commit instantly.
        play('move')
        setDisplay(next.charges.slice())
        setCombo(0)
        commit(next)
        resolveOutcome(next)
        return
      }

      // Cascade: lock input and replay the waves.
      lockedRef.current = true
      setCombo(0)

      // Show the tapped +1 first.
      const tapped = s.charges.slice()
      tapped[index] += 1
      setDisplay(tapped)

      if (reducedRef.current) {
        // Reduced motion: no delays, no shake — jump straight to the result.
        finishCascade(next, result)
        return
      }

      const waves = result.waves.slice(0, MAX_ANIM_WAVES)
      let running = 0
      waves.forEach((wave, w) => {
        schedule(() => {
          setDisplay(wave.chargesAfter.slice())
          running += wave.overloaded.length
          setCombo(running)
          setFlash({ set: wave.overloaded, key: w + 1 })
          setShake(Math.min(w + 1, MAX_SHAKE))
          play(w === waves.length - 1 ? 'match' : 'merge')
        }, TAP_DELAY + w * WAVE_DELAY)
      })
      schedule(() => finishCascade(next, result), TAP_DELAY + waves.length * WAVE_DELAY + 80)
    },
    [commit, finishCascade, play, reducedRef, resolveOutcome, schedule],
  )

  // Roving-tabindex keyboard navigation over the 6×6 grid.
  const focusCell = useCallback((idx: number) => {
    setCursor(idx)
    cellsRef.current[idx]?.focus()
  }, [])

  const onGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const r = Math.floor(cursor / COLS)
      const c = cursor % COLS
      let nr = r
      let nc = c
      switch (e.key) {
        case 'ArrowUp':
          nr = Math.max(0, r - 1)
          break
        case 'ArrowDown':
          nr = Math.min(ROWS - 1, r + 1)
          break
        case 'ArrowLeft':
          nc = Math.max(0, c - 1)
          break
        case 'ArrowRight':
          nc = Math.min(COLS - 1, c + 1)
          break
        default:
          return
      }
      e.preventDefault()
      focusCell(nr * COLS + nc)
    },
    [cursor, focusCell],
  )

  const switchMode = useCallback(
    (m: Mode) => {
      if (m === mode) return
      setMode(m)
      try {
        localStorage.setItem(`${storageKey}:mode`, m)
      } catch {
        /* storage unavailable */
      }
      startRun(m, randomSeed())
    },
    [mode, startRun, storageKey],
  )

  const newRun = useCallback(() => startRun(mode, randomSeed()), [mode, startRun])

  const retryBoard = useCallback(() => {
    const s = stateRef.current
    startRun(mode, s ? s.seed : randomSeed())
  }, [mode, startRun])

  const advance = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    clearTimers()
    lockedRef.current = false
    setCombo(0)
    setChainBanner(null)
    setFlash({ set: [], key: 0 })
    setShake(0)
    const seed = randomSeed()
    const next = nextBoard(s, mulberry32(seed), seed)
    setDisplay(next.charges.slice())
    commit(next)
    refreshBoardRecord(seed)
  }, [clearTimers, commit, refreshBoardRecord])

  // --- Rendering ------------------------------------------------------------

  const hint = (() => {
    const base =
      mode === 'puzzle'
        ? 'Tap cells to charge them — a cell hits capacity, overloads, and chains across the board. Sweep the whole grid for a Perfect Storm.'
        : 'Endless: each Perfect Storm refills taps and reseeds a denser board. Chase the high score.'
    if (boardRecord && boardRecord.best > 0) {
      const ft =
        boardRecord.fewestTaps < Number.MAX_SAFE_INTEGER
          ? ` · Fewest taps: ${boardRecord.fewestTaps}`
          : ''
      return `${base}  (Board best: ${boardRecord.best}${ft})`
    }
    return base
  })()

  const modeToggle = (
    <div
      className="flex overflow-hidden rounded-lg border border-border"
      role="group"
      aria-label="Game mode"
    >
      {(['puzzle', 'endless'] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => switchMode(m)}
          aria-pressed={mode === m}
          className={`btn-press px-2.5 py-1.5 text-sm font-semibold capitalize ${
            mode === m ? 'bg-accent text-stone-900' : 'bg-surface text-fg hover:bg-white/10'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )

  const tapsChip = (
    <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
      <span className="text-fg-muted">Taps</span>{' '}
      <span data-testid="taps" className="font-bold text-accent">
        {state ? state.tapsLeft : 0}
      </span>
    </div>
  )

  const roundChip =
    mode === 'endless' ? (
      <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Round</span>{' '}
        <span data-testid="round" className="font-bold text-accent">
          {state ? state.level : 1}
        </span>
      </div>
    ) : null

  const headerExtra = (
    <>
      {tapsChip}
      {roundChip}
      {modeToggle}
    </>
  )

  const stats = [
    { label: 'Score', value: state ? state.score : 0, testId: 'score', float: true },
    { label: 'Best', value: best, testId: 'best' },
  ]

  if (!state) {
    return (
      <GameShell
        stats={stats}
        headerExtra={headerExtra}
        onNewGame={newRun}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div
          className="aspect-square w-full rounded-xl bg-surface"
          data-testid="overload-loading"
        />
      </GameShell>
    )
  }

  const flashSet = new Set(flash.set)
  const won = state.cleared
  const lost = state.over

  return (
    <GameShell
      stats={stats}
      headerExtra={headerExtra}
      onNewGame={newRun}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{`
        @keyframes ov-pop {
          0% { transform: scale(1); }
          40% { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        @keyframes ov-flash {
          0% { background-color: rgba(255,255,255,0.9); box-shadow: 0 0 22px rgba(255,255,255,0.85); }
          100% { background-color: transparent; box-shadow: 0 0 0 rgba(255,255,255,0); }
        }
        @keyframes ov-ignite {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.0); }
          50% { box-shadow: 0 0 12px 2px rgba(251,191,36,0.55); }
        }
        @keyframes ov-shake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(calc(var(--amp) * -1px), calc(var(--amp) * 1px)); }
          40% { transform: translate(calc(var(--amp) * 1px), calc(var(--amp) * -1px)); }
          60% { transform: translate(calc(var(--amp) * -1px), 0); }
          80% { transform: translate(calc(var(--amp) * 1px), calc(var(--amp) * 1px)); }
        }
      `}</style>

      {/* Combo / chain read-out */}
      <div className="mb-2 flex h-6 items-center justify-center gap-3 text-sm" aria-live="polite">
        {combo > 0 && (
          <span className="font-bold text-accent" data-testid="combo">
            combo ×{combo}
          </span>
        )}
        {chainBanner != null && chainBanner > 0 && (
          <span className="neon-text font-extrabold text-accent" data-testid="chain-banner">
            chain: {chainBanner}
          </span>
        )}
      </div>

      <div
        className="anim-board-in relative rounded-xl bg-surface p-2"
        style={
          shake > 0
            ? ({ animation: 'ov-shake 140ms ease-in-out', ['--amp' as string]: String(shake) } as React.CSSProperties)
            : undefined
        }
      >
        <div
          className="grid aspect-square w-full gap-2"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          data-testid="overload-board"
          onKeyDown={onGridKeyDown}
          role="grid"
          aria-label="Overload board"
        >
          {display.map((charge, i) => {
            const cap = CAPACITY[i]
            const critical = charge === cap - 1
            const filled = Math.min(charge, cap)
            const isFlashing = flashSet.has(i)
            const r = Math.floor(i / COLS)
            const c = i % COLS
            return (
              <button
                key={i}
                ref={(el) => {
                  cellsRef.current[i] = el
                }}
                data-testid="overload-cell"
                data-index={i}
                data-charge={charge}
                data-cap={cap}
                data-critical={critical}
                tabIndex={i === cursor ? 0 : -1}
                onFocus={() => setCursor(i)}
                onClick={() => handleTap(i)}
                aria-label={`Row ${r + 1}, column ${c + 1}: charge ${charge} of ${cap}${
                  critical ? ', critical' : ''
                }`}
                className={`relative aspect-square rounded-lg border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                  critical
                    ? 'border-accent/70 bg-accent/15'
                    : 'border-border bg-white/[0.04] hover:bg-white/[0.1]'
                }`}
                style={
                  critical && !reducedRef.current
                    ? { animation: 'ov-ignite 1.4s ease-in-out infinite' }
                    : undefined
                }
              >
                {/* overload flash overlay */}
                {isFlashing && !reducedRef.current && (
                  <span
                    key={flash.key}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-lg"
                    style={{ animation: 'ov-flash 300ms ease-out forwards' }}
                  />
                )}
                {/* charge pips */}
                <span
                  key={popIndex === i ? `pop${popKey}` : 'idle'}
                  aria-hidden="true"
                  className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-1 p-1"
                  style={
                    popIndex === i && !reducedRef.current
                      ? { animation: 'ov-pop 220ms ease-out' }
                      : undefined
                  }
                >
                  {Array.from({ length: cap }, (_, k) => (
                    <span
                      key={k}
                      className={`h-1.5 w-1.5 rounded-full ${
                        k < filled
                          ? critical
                            ? 'bg-accent shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                            : 'bg-neon-cyan/90'
                          : 'bg-white/15'
                      }`}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        <GameOverlay
          show={won || lost}
          variant={won ? 'win' : 'lose'}
          title={won ? 'Perfect Storm!' : 'Out of taps'}
          testId="game-over"
        >
          {won ? (
            <>
              <p className="text-sm text-fg-muted">
                Board swept in a{' '}
                <span className="font-bold text-accent">{chainBanner ?? 0}</span>-overload chain.
              </p>
              <p className="text-sm text-fg-muted">
                Score <span className="font-bold text-accent">{state.score}</span>
              </p>
              <GameButton onClick={advance} className="px-4 py-2">
                {mode === 'puzzle' ? 'Next board' : 'Next round'}
              </GameButton>
            </>
          ) : (
            <>
              <p className="text-sm text-fg-muted">
                Final score <span className="font-bold text-accent">{state.score}</span>
              </p>
              <div className="flex gap-2">
                <GameButton onClick={retryBoard} variant="ghost" className="px-4 py-2">
                  Retry board
                </GameButton>
                <GameButton onClick={newRun} className="px-4 py-2">
                  New Game
                </GameButton>
              </div>
            </>
          )}
        </GameOverlay>
      </div>
    </GameShell>
  )
}
