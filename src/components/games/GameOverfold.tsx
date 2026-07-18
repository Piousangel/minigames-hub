'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  dailySeed,
  fold,
  JAM,
  legalCreases,
  mulberry32,
  newGame,
  nextLevel,
  previewFold,
  undo,
  type Axis,
  type FoldPreview,
  type GameState,
  type Mode,
  type Prefer,
} from '@/lib/games/overfold/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { todayUTC as todayISO } from '@/lib/dailyDate'
import { bumpStreak, currentStreak, loadStreak, saveStreak } from '@/lib/dailyStreak'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// A fixed, asset-free pip palette (CSS discs only).
const COLORS = [
  'hsl(190 90% 55%)',
  'hsl(330 85% 62%)',
  'hsl(95 70% 52%)',
  'hsl(45 95% 58%)',
  'hsl(265 80% 68%)',
  'hsl(15 90% 60%)',
  'hsl(210 90% 62%)',
  'hsl(150 70% 50%)',
]

const FOLD_MS = 190 // input lock while the fold plays
const BANNER_MS = 900 // combo banner lifetime

interface DailyRecord {
  bestScore: number
  fewestFolds: number
  cleared: boolean
}
type DailyMap = Record<string, DailyRecord>

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}


export function GameOverfold({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [mode, setMode] = useState<Mode>('random')
  const [preview, setPreview] = useState<FoldPreview | null>(null)
  const [creaseCursor, setCreaseCursor] = useState(0)
  const [prefer, setPrefer] = useState<Prefer>('low')
  const [banner, setBanner] = useState<{ seals: number; key: number } | null>(null)
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const bestRef = useRef(0)
  const dailyRef = useRef<DailyMap>({})
  const lockedRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const creaseElRef = useRef<(HTMLDivElement | null)[]>([])

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

  const refreshDailyRecord = useCallback((seed: number) => {
    setDailyRecord(dailyRef.current[String(seed)] ?? null)
  }, [])

  const refreshPreview = useCallback((s: GameState, cursor: number, pref: Prefer) => {
    const creases = legalCreases(s.board)
    const cr = creases[cursor]
    if (!cr || s.won || s.lost) {
      setPreview(null)
      return
    }
    setPreview(previewFold(s.board, cr.axis, cr.index, pref))
  }, [])

  const startRun = useCallback(
    (nextMode: Mode, seed: number, level: number) => {
      clearTimers()
      lockedRef.current = false
      setBanner(null)
      setPrefer('low')
      const fresh = newGame(mulberry32(seed), nextMode, seed, level)
      setCreaseCursor(0)
      commit(fresh)
      refreshPreview(fresh, 0, 'low')
      refreshDailyRecord(seed)
    },
    [clearTimers, commit, refreshDailyRecord, refreshPreview],
  )

  // Client-only bootstrap.
  useEffect(() => {
    const storedBest = Number(localStorage.getItem(storageKey))
    bestRef.current = Number.isFinite(storedBest) && storedBest > 0 ? storedBest : 0
    setBest(bestRef.current)

    try {
      const raw = localStorage.getItem(`${storageKey}:daily`)
      dailyRef.current = raw ? (JSON.parse(raw) as DailyMap) : {}
    } catch {
      dailyRef.current = {}
    }

    setStreak(currentStreak(loadStreak(`${storageKey}:streak`)))

    const storedMode = localStorage.getItem(`${storageKey}:mode`)
    // 홈의 Daily 필터가 이 게임을 가리키므로 저장값이 없으면 daily로 연다.
    const initialMode: Mode = storedMode === 'random' ? 'random' : 'daily'
    setMode(initialMode)
    const seed = initialMode === 'daily' ? dailySeed(todayISO()) : randomSeed()
    startRun(initialMode, seed, 1)

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

  const persistDaily = useCallback(
    (s: GameState) => {
      if (s.mode !== 'daily') return
      const key = String(s.seed)
      const prev = dailyRef.current[key]
      const rec: DailyRecord = {
        bestScore: Math.max(prev?.bestScore ?? 0, s.score),
        fewestFolds: s.won
          ? Math.min(prev?.fewestFolds ?? Number.MAX_SAFE_INTEGER, s.foldsUsed)
          : prev?.fewestFolds ?? Number.MAX_SAFE_INTEGER,
        cleared: (prev?.cleared ?? false) || s.won,
      }
      dailyRef.current[key] = rec
      setDailyRecord(rec)
      try {
        localStorage.setItem(`${storageKey}:daily`, JSON.stringify(dailyRef.current))
      } catch {
        /* storage unavailable */
      }

      // 오늘의 데일리를 처음 클리어하면 day-streak을 올린다(승리 시에만).
      if (s.won) {
        const streakKey = `${storageKey}:streak`
        const bumped = bumpStreak(loadStreak(streakKey))
        saveStreak(streakKey, bumped)
        setStreak(bumped.streak)
      }
    },
    [storageKey],
  )

  const resolveOutcome = useCallback(
    (next: GameState) => {
      persistBest(next.score)
      if (next.won || next.lost) persistDaily(next)
    },
    [persistBest, persistDaily],
  )

  const commitFold = useCallback(
    (axis: Axis, index: number, pref: Prefer) => {
      const s = stateRef.current
      if (lockedRef.current || !s || s.won || s.lost) {
        play('error')
        return
      }
      const { state: next, preview: pv } = fold(s, { axis, index, prefer: pref })
      if (!pv.legal) {
        play('error')
        return
      }

      // Sound precedence (§4).
      if (next.won) play('win')
      else if (next.lost) play('lose')
      else if (pv.seals >= 2) play('merge')
      else if (pv.seals === 1) play('match')
      else if (pv.jamsFormed > 0) play('mismatch')
      else play('flip')

      if (pv.seals >= 2) {
        setBanner({ seals: pv.seals, key: Date.now() })
        schedule(() => setBanner(null), BANNER_MS)
      }

      const applyState = () => {
        const creases = legalCreases(next.board)
        const nextCursor = Math.min(creaseCursor, Math.max(0, creases.length - 1))
        setCreaseCursor(nextCursor)
        commit(next)
        refreshPreview(next, nextCursor, pref)
        resolveOutcome(next)
        lockedRef.current = false
      }

      if (reducedRef.current) {
        applyState()
        return
      }
      lockedRef.current = true
      setPreview(pv) // keep the ghost visible during the brief fold
      schedule(applyState, FOLD_MS)
    },
    [commit, creaseCursor, play, reducedRef, refreshPreview, resolveOutcome, schedule],
  )

  const doUndo = useCallback(() => {
    const s = stateRef.current
    if (!s || lockedRef.current) return
    if (s.unfoldsLeft <= 0 || s.history.length === 0) {
      play('error')
      return
    }
    play('flip')
    const next = undo(s)
    const creases = legalCreases(next.board)
    const nextCursor = Math.min(creaseCursor, Math.max(0, creases.length - 1))
    setCreaseCursor(nextCursor)
    commit(next)
    refreshPreview(next, nextCursor, prefer)
  }, [commit, creaseCursor, play, prefer, refreshPreview])

  const moveCursor = useCallback(
    (nextCursor: number) => {
      const s = stateRef.current
      if (!s) return
      const creases = legalCreases(s.board)
      if (creases.length === 0) return
      const wrapped = ((nextCursor % creases.length) + creases.length) % creases.length
      setCreaseCursor(wrapped)
      refreshPreview(s, wrapped, prefer)
      play('move')
      creaseElRef.current[wrapped]?.focus()
    },
    [play, prefer, refreshPreview],
  )

  const onBoardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const creases = legalCreases(s.board)
      const cur = creases[creaseCursor]
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault()
          const verticals = creases
            .map((c, i) => ({ c, i }))
            .filter((x) => x.c.axis === 'v')
          if (verticals.length === 0) return
          const here = verticals.findIndex((x) => x.i === creaseCursor)
          const step = e.key === 'ArrowRight' ? 1 : -1
          const start = here === -1 ? 0 : here + step
          const pick = ((start % verticals.length) + verticals.length) % verticals.length
          moveCursor(verticals[pick].i)
          break
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault()
          const horizontals = creases
            .map((c, i) => ({ c, i }))
            .filter((x) => x.c.axis === 'h')
          if (horizontals.length === 0) return
          const here = horizontals.findIndex((x) => x.i === creaseCursor)
          const step = e.key === 'ArrowDown' ? 1 : -1
          const start = here === -1 ? 0 : here + step
          const pick = ((start % horizontals.length) + horizontals.length) % horizontals.length
          moveCursor(horizontals[pick].i)
          break
        }
        case 'Enter': {
          e.preventDefault()
          if (!cur) return
          commitFold(cur.axis, cur.index, e.shiftKey ? 'high' : 'low')
          break
        }
        case 'u':
        case 'U':
          e.preventDefault()
          doUndo()
          break
        default:
          break
      }
    },
    [commitFold, creaseCursor, doUndo, moveCursor],
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
      const seed = m === 'daily' ? dailySeed(todayISO()) : randomSeed()
      startRun(m, seed, 1)
    },
    [mode, startRun, storageKey],
  )

  const newRun = useCallback(() => {
    const seed = mode === 'daily' ? dailySeed(todayISO()) : randomSeed()
    startRun(mode, seed, 1)
  }, [mode, startRun])

  const retryBoard = useCallback(() => {
    const s = stateRef.current
    startRun(mode, s ? s.seed : randomSeed(), s ? s.level : 1)
  }, [mode, startRun])

  const advance = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    clearTimers()
    lockedRef.current = false
    setBanner(null)
    setPrefer('low')
    const seed = mode === 'daily' ? dailySeed(todayISO()) : randomSeed()
    const next = nextLevel(s, mulberry32(seed), seed)
    setCreaseCursor(0)
    commit(next)
    refreshPreview(next, 0, 'low')
    refreshDailyRecord(seed)
  }, [clearTimers, commit, mode, refreshDailyRecord, refreshPreview])

  // --- Derived UI data ------------------------------------------------------

  const { sealSet, jamSet } = useMemo(() => {
    const seals = new Set<number>()
    const jams = new Set<number>()
    if (preview && preview.legal) {
      for (const o of preview.overlaps) {
        if (o.kind === 'seal') {
          seals.add(o.flapIndex)
          seals.add(o.baseIndex)
        } else if (o.kind === 'jam') {
          jams.add(o.baseIndex)
        }
      }
    }
    return { sealSet: seals, jamSet: jams }
  }, [preview])

  const hint = (() => {
    const base =
      'Tap a crease — the smaller flap folds over, sealing matching pips. Seal them all before the paper runs out.'
    const par = state ? ` Par ${state.par} folds.` : ''
    if (mode === 'daily' && dailyRecord && dailyRecord.fewestFolds < Number.MAX_SAFE_INTEGER) {
      return `${base}${par} Your best: ${dailyRecord.fewestFolds} folds.`
    }
    return `${base}${par}`
  })()

  const stats = [
    { label: 'Score', value: state?.score ?? 0, testId: 'score', float: true },
    { label: 'Best', value: best, testId: 'best' },
    // day-streak은 데일리 모드에서만 의미 있다.
    ...(mode === 'daily' ? [{ label: 'Streak', value: streak, testId: 'streak' }] : []),
  ]

  const modeToggle = (
    <div
      className="flex overflow-hidden rounded-lg border border-border"
      role="group"
      aria-label="Game mode"
    >
      {(['random', 'daily'] as Mode[]).map((m) => (
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

  const headerExtra = (
    <>
      <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Folds</span>{' '}
        <span data-testid="folds" className="font-bold text-accent">
          {state ? `${state.foldsUsed} / ${state.par}` : '0 / 0'}
        </span>
      </div>
      <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Unfolds</span>{' '}
        <span data-testid="unfolds" className="font-bold text-accent">
          {state?.unfoldsLeft ?? 0}
        </span>
      </div>
      {mode === 'random' ? (
        <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          <span className="text-fg-muted">Level</span>{' '}
          <span data-testid="level" className="font-bold text-accent">
            {state?.level ?? 1}
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          <span className="text-fg-muted">Daily</span>{' '}
          <span data-testid="daily-date" className="font-bold text-accent">
            {todayISO().slice(5)}
          </span>
        </div>
      )}
      {modeToggle}
      <GameButton
        onClick={doUndo}
        variant="ghost"
        disabled={!state || state.unfoldsLeft === 0 || state.history.length === 0}
      >
        Unfold ({state?.unfoldsLeft ?? 0})
      </GameButton>
    </>
  )

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
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="overfold-loading" />
      </GameShell>
    )
  }

  const { board } = state
  const creases = legalCreases(board)
  const won = state.won
  const lost = state.lost

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
        @keyframes of-seal {
          0% { transform: scale(1); opacity: 1; }
          60% { transform: scale(1.5); opacity: 1; box-shadow: 0 0 16px rgba(74,222,128,0.9); }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes of-jam {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        @keyframes of-ghost {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.85; }
        }
        @keyframes of-crease {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes of-banner {
          0% { transform: scale(0.6); opacity: 0; }
          30% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>

      {/* Combo read-out */}
      <div className="mb-2 flex h-6 items-center justify-center gap-3 text-sm" aria-live="polite">
        {preview && preview.legal && (preview.seals > 0 || preview.jamsFormed > 0) && (
          <span data-testid="preview-badge" className="font-semibold text-fg-muted">
            {preview.seals > 0 && (
              <span className="text-neon-green">
                {preview.seals} seal · +{preview.scoreDelta}
              </span>
            )}
            {preview.jamsFormed > 0 && (
              <span className="ml-2 text-neon-red">{preview.jamsFormed} jam</span>
            )}
          </span>
        )}
      </div>

      <div className="relative rounded-xl bg-surface p-3">
        <div className="relative aspect-square w-full">
          <div
            className="grid h-full w-full gap-1"
            style={{
              gridTemplateColumns: `repeat(${board.w}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${board.h}, minmax(0, 1fr))`,
            }}
            data-testid="overfold-board"
            role="grid"
            aria-label="Overfold paper"
            onKeyDown={onBoardKeyDown}
          >
            {board.cells.map((value, i) => {
              const r = Math.floor(i / board.w)
              const c = i % board.w
              const isJam = value === JAM
              const isPip = value >= 0
              const seal = sealSet.has(i)
              const jamWarn = jamSet.has(i)
              return (
                <div
                  key={i}
                  data-testid="overfold-cell"
                  data-index={i}
                  data-value={value}
                  role="gridcell"
                  aria-label={`Row ${r + 1}, column ${c + 1}: ${
                    isJam ? 'fault' : isPip ? `pip ${value}` : 'empty'
                  }`}
                  className={`relative flex items-center justify-center rounded-md border ${
                    isJam
                      ? 'border-neon-red/40 bg-[repeating-linear-gradient(45deg,rgba(248,113,113,0.18)_0,rgba(248,113,113,0.18)_4px,transparent_4px,transparent_8px)]'
                      : seal
                        ? 'border-neon-green/70 bg-neon-green/10'
                        : jamWarn
                          ? 'border-neon-red/70 bg-neon-red/10'
                          : 'border-border bg-white/[0.03]'
                  }`}
                >
                  {isPip && (
                    <span
                      aria-hidden="true"
                      className="h-3/5 w-3/5 rounded-full"
                      style={{
                        background: COLORS[value % COLORS.length],
                        boxShadow: seal
                          ? '0 0 12px rgba(74,222,128,0.9)'
                          : `0 0 8px ${COLORS[value % COLORS.length]}`,
                        animation:
                          seal && !reducedRef.current ? 'of-seal 320ms ease-out forwards' : undefined,
                      }}
                    />
                  )}
                  {isJam && (
                    <span aria-hidden="true" className="text-lg font-black text-neon-red/80">
                      ✕
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Crease handles between rows/cols */}
          {creases.map((cr, i) => {
            const selected = i === creaseCursor
            const isTie = cr.axis === 'v' ? cr.index * 2 === board.w : cr.index * 2 === board.h
            const label =
              cr.axis === 'v'
                ? `Fold between column ${cr.index} and ${cr.index + 1}`
                : `Fold between row ${cr.index} and ${cr.index + 1}`
            const commonStyle: React.CSSProperties =
              cr.axis === 'v'
                ? { left: `${(cr.index / board.w) * 100}%`, top: 0, bottom: 0, width: 24, transform: 'translateX(-50%)' }
                : { top: `${(cr.index / board.h) * 100}%`, left: 0, right: 0, height: 24, transform: 'translateY(-50%)' }
            return (
              <div
                key={`${cr.axis}-${cr.index}`}
                ref={(el) => {
                  creaseElRef.current[i] = el
                }}
                data-testid="overfold-crease"
                data-axis={cr.axis}
                data-index={cr.index}
                role="button"
                tabIndex={selected ? 0 : -1}
                aria-label={label}
                onFocus={() => setCreaseCursor(i)}
                onMouseEnter={() => {
                  setCreaseCursor(i)
                  refreshPreview(state, i, prefer)
                }}
                onClick={() =>
                  commitFold(cr.axis, cr.index, isTie ? prefer : 'low')
                }
                className="absolute z-[1] flex cursor-pointer items-center justify-center focus-visible:outline-none"
                style={commonStyle}
              >
                <span
                  aria-hidden="true"
                  className={`rounded-full ${
                    cr.axis === 'v' ? 'h-full w-1' : 'h-1 w-full'
                  } ${selected ? 'bg-accent' : 'bg-fg-muted/30'}`}
                  style={
                    selected && !reducedRef.current
                      ? { animation: 'of-crease 1.2s ease-in-out infinite' }
                      : undefined
                  }
                />
              </div>
            )
          })}

          {/* Escalating combo banner */}
          {banner && !reducedRef.current && (
            <div
              key={banner.key}
              aria-live="polite"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span
                data-testid="combo-banner"
                className="neon-text font-extrabold text-accent"
                style={{
                  fontSize: `${1.5 + banner.seals * 0.4}rem`,
                  animation: 'of-banner 900ms ease-out forwards',
                }}
              >
                combo ×{banner.seals}
              </span>
            </div>
          )}
        </div>

        <GameOverlay
          show={won || lost}
          variant={won ? 'win' : 'lose'}
          title={won ? 'Sealed!' : state.board.w === 1 && state.board.h === 1 ? 'Folded to nothing' : 'Out of folds'}
          testId="game-over"
        >
          {won ? (
            <>
              <p className="text-sm text-fg-muted">
                Folded in{' '}
                <span className="font-bold text-accent">{state.foldsUsed}</span> / {state.par}
                {state.foldsUsed <= state.par && <span className="ml-1">⭐</span>}
              </p>
              <p className="text-sm text-fg-muted">
                Score <span className="font-bold text-accent">{state.score}</span>
              </p>
              <GameButton onClick={advance} className="px-4 py-2">
                Next paper
              </GameButton>
            </>
          ) : (
            <>
              <p className="text-sm text-fg-muted">
                Score <span className="font-bold text-accent">{state.score}</span>
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
