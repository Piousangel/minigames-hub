'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  blockAnchors,
  createGame,
  displayValue,
  isBlockMatched,
  reduce,
  type Anchor,
  type Face,
  type TurntileAction,
  type TurntileEvent,
  type TurntileState,
} from '@/lib/games/turntile/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface TurntileSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/**
 * Daily-streak-only key. `best:<slug>` holds a bare number (weekly leaderboard
 * reads it with Number()) — never JSON, so streak metadata lives separately.
 */
const DAILY_KEY = 'turntile:daily'

function loadDaily(): TurntileSave['daily'] {
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (!raw) return undefined
    const o = JSON.parse(raw) as Record<string, unknown>
    if (typeof o?.lastDate === 'string' && typeof o?.streak === 'number') {
      return { lastDate: o.lastDate, streak: o.streak }
    }
  } catch {
    // corrupt -> no streak
  }
  return undefined
}

const SOUND: Record<TurntileEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  flip: 'flip',
  lock: 'merge',
  combo: 'match',
  illegal: 'error',
  win: 'win',
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadSave(storageKey: string): TurntileSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }

    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }

    // Legacy: reading an old {score, daily} JSON blob and migrating to the split scheme.
    const o = JSON.parse(raw) as Record<string, unknown>
    const score =
      typeof o?.score === 'number' && Number.isFinite(o.score) ? Math.max(0, Math.floor(o.score)) : 0
    let daily: TurntileSave['daily']
    const dd = o?.daily as Record<string, unknown> | undefined
    if (typeof dd?.lastDate === 'string' && typeof dd?.streak === 'number') {
      daily = { lastDate: dd.lastDate, streak: dd.streak }
    }
    saveAll(storageKey, { score, daily })
    return { score, daily }
  } catch {
    // corrupt / legacy -> reset
  }
  return { score: 0 }
}

function saveAll(storageKey: string, save: TurntileSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

/** Fixed HSL hue per pattern id so tiles are legible + colorblind-safe (number shown too). */
function tileColor(face: Face, symbols: number): { bg: string; fg: string } {
  const hue = symbols <= 1 ? 200 : Math.round((face * 360) / symbols)
  return { bg: `hsl(${hue} 62% 52%)`, fg: `hsl(${hue} 70% 12%)` }
}

interface Badge {
  seq: number
  text: string
}

const TILE = 52 // px, square tile
const PIVOT = 44 // px, pivot button tap target — 44px accessibility minimum, fits within 52px TILE spacing with 8px clearance

export function GameTurntile({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<TurntileState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [focus, setFocus] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<TurntileState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevWon = useRef(false)
  const badgeSeq = useRef(0)
  const pivotRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commit = useCallback((next: TurntileState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily)) // a broken streak reads as 0 (no pretending a dead streak is alive)
    const g = createGame(DAILY_CONFIG, dailySeed(new Date()))
    prevWon.current = false
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty) => {
      modeRef.current = nextMode
      const g =
        nextMode === 'daily'
          ? createGame(DAILY_CONFIG, dailySeed(new Date()))
          : createGame(DIFFICULTIES[diff], freshSeed())
      prevWon.current = false
      setBadges([])
      setFocus(0)
      commit(g)
    },
    [commit],
  )

  const persistWin = useCallback(
    (next: TurntileState) => {
      const save = loadSave(storageKey)
      let nextSave: TurntileSave = { ...save, score: Math.max(save.score, next.score) }
      if (modeRef.current === 'daily') {
        const bumped = bumpStreak(save.daily) // completed yesterday -> +1, else 1, same-day repeat is idempotent
        nextSave = { ...nextSave, daily: bumped }
        setStreak(bumped.streak)
      }
      setBest(nextSave.score)
      saveAll(storageKey, nextSave)
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: TurntileAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (
        (next.lastEvent === 'lock' || next.lastEvent === 'combo' || next.lastEvent === 'win') &&
        next.lastFlip
      ) {
        const n = next.lastFlip.newlyLocked.length
        if (n > 0) {
          const seq = ++badgeSeq.current
          const text = n === 1 ? 'Locked!' : `Combo ×${n}!`
          setBadges((b) => [...b, { seq, text }])
        }
      }
      if (next.won && !prevWon.current) persistWin(next)
      prevWon.current = next.won
    },
    [commit, play, persistWin],
  )

  // Keyboard: roving focus over the pivot grid + activation + new game.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const prows = s.config.rows - 1
      const pcols = s.config.cols - 1
      const n = prows * pcols
      if (n <= 0) return
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setFocus((f) => {
            const row = Math.floor(f / pcols)
            const col = (f % pcols) - 1 + pcols
            return row * pcols + (col % pcols)
          })
          break
        case 'ArrowRight':
          e.preventDefault()
          setFocus((f) => {
            const row = Math.floor(f / pcols)
            const col = (f % pcols) + 1
            return row * pcols + (col % pcols)
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocus((f) => (f - pcols + n) % n)
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocus((f) => (f + pcols) % n)
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const i = Math.floor(focus / pcols)
          const j = focus % pcols
          dispatch({ type: 'flip', i, j })
          break
        }
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard(modeRef.current, difficulty)
          break
        // Escape: no separate cancel/selection state exists in Turntile, so no-op.
      }
    },
    [dispatch, focus, difficulty, startBoard],
  )

  // Keep the DOM focus in sync with the roving index.
  useEffect(() => {
    if (!state) return
    pivotRefs.current[focus]?.focus()
  }, [focus, state])

  const onNewGame = useCallback(() => {
    if (mode === 'daily') dispatch({ type: 'reset' })
    else startBoard('practice', difficulty)
  }, [mode, difficulty, dispatch, startBoard])

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m)
      startBoard(m, difficulty)
    },
    [difficulty, startBoard],
  )

  const switchDifficulty = useCallback(
    (d: Difficulty) => {
      setDifficulty(d)
      if (modeRef.current === 'practice') startBoard('practice', d)
    },
    [startBoard],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="turntile-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const { rows, cols, symbols } = state.config
  const won = state.won
  const pivots: Anchor[] = blockAnchors(rows, cols)

  // Positions touched by the most recent flip -> only those tiles replay the entrance animation.
  const touched = new Set<number>()
  if (state.lastFlip && (state.lastEvent === 'flip' || state.lastEvent === 'lock' || state.lastEvent === 'combo' || state.lastEvent === 'win')) {
    const { i, j } = state.lastFlip.anchor
    touched.add(i * cols + j)
    touched.add(i * cols + j + 1)
    touched.add((i + 1) * cols + j)
    touched.add((i + 1) * cols + j + 1)
  }

  const hint = won
    ? 'Solved! The whole board is one pattern.'
    : 'Press an intersection to flip the 2x2 block around it — positions swap and hidden faces are revealed.'

  const headerExtra = (
    <>
      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          onClick={() => switchMode('daily')}
          aria-pressed={mode === 'daily'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${mode === 'daily' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Daily
        </button>
        <button
          onClick={() => switchMode('practice')}
          aria-pressed={mode === 'practice'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${mode === 'practice' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Practice
        </button>
      </div>
      {mode === 'daily' ? (
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Streak <span className="font-bold text-accent">{streak}</span>
        </span>
      ) : (
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => switchDifficulty(d)}
              aria-pressed={difficulty === d}
              className={`px-2.5 py-1.5 text-sm font-semibold capitalize ${difficulty === d ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Flips', value: state.flips, testId: 'flips' },
        { label: 'Par', value: state.par },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={won ? 'Play again' : mode === 'daily' ? 'Reset' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        role="group"
        aria-label="Turntile board"
        onKeyDown={onKeyDown}
        className="relative mx-auto overflow-x-auto rounded-xl bg-surface p-4"
        style={{ width: 'fit-content', maxWidth: '100%', ...(reduced ? {} : { animation: 'tt-board-in .3s ease-out both' }) }}
        data-testid="turntile-board"
      >
        <div
          className="relative"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${TILE}px)`,
            gridTemplateRows: `repeat(${rows}, ${TILE}px)`,
          }}
        >
          {state.board.map((cell, pos) => {
            const face = displayValue(cell)
            const { bg, fg } = tileColor(face, symbols)
            const isTouched = touched.has(pos)
            return (
              <div
                key={pos}
                aria-hidden="true"
                className="flex items-center justify-center text-sm font-bold tabular-nums"
                style={{
                  background: bg,
                  color: fg,
                }}
              >
                <span
                  key={isTouched ? `${pos}-${state.flips}` : 'static'}
                  style={
                    reduced || !isTouched
                      ? undefined
                      : { animation: 'tt-flip-in .2s ease-out both', display: 'inline-block' }
                  }
                >
                  {face}
                </span>
              </div>
            )
          })}

          {pivots.map((a, idx) => {
            const matched = isBlockMatched(state.board, a.i, a.j, cols)
            const left = (a.j + 1) * TILE - PIVOT / 2
            const top = (a.i + 1) * TILE - PIVOT / 2
            return (
              <button
                key={`${a.i}-${a.j}`}
                ref={(el) => {
                  pivotRefs.current[idx] = el
                }}
                type="button"
                data-testid="pivot"
                aria-label={`Flip block at row ${a.i + 1}, col ${a.j + 1}${matched ? ' (matched)' : ''}`}
                tabIndex={idx === focus ? 0 : -1}
                onFocus={() => setFocus(idx)}
                onClick={() => dispatch({ type: 'flip', i: a.i, j: a.j })}
                disabled={won}
                className="absolute rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-default"
                style={{
                  left,
                  top,
                  width: PIVOT,
                  height: PIVOT,
                  background: matched ? 'rgba(163,230,53,0.25)' : 'rgba(0,0,0,0.35)',
                  borderColor: matched ? 'var(--neon-lime)' : 'rgba(255,255,255,0.4)',
                  boxShadow: matched ? '0 0 10px var(--neon-lime)' : 'none',
                }}
              >
                <span aria-hidden="true" className="sr-only">
                  flip
                </span>
              </button>
            )
          })}
        </div>

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="lock-badge"
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-sm font-bold text-accent"
            style={reduced ? undefined : { animation: 'tt-badge .9s ease-out both' }}
          >
            {b.text}
          </span>
        ))}

        <GameOverlay show={won} variant="win" title="Aligned!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Flips <span className="font-bold text-accent">{state.flips}</span> / Par{' '}
              <span className="font-bold text-accent">{state.par}</span>
            </p>
            <p>
              Best combo <span className="font-bold text-accent">×{state.bestCombo}</span>
            </p>
            {mode === 'daily' && (
              <p>
                Streak <span className="font-bold text-accent">{streak}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === 'daily' && (
              <DailyShareButton
                payload={() => {
                  const used = state.flips
                  const par = state.par
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} FLIPS · PAR ${par}`)
                  return {
                    gameName: 'Turntile',
                    dateISO: todayUTC(),
                    accent: '#22d3ee',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/turntile`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Turntile',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `solved in ${used} flips (par ${par})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes tt-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes tt-flip-in { from { opacity: .2; transform: scale(.85) } to { opacity: 1; transform: none } }
          @keyframes tt-badge {
            0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.12); opacity: 1 }
            100% { transform: translate(-50%, -14px) scale(1); opacity: 0 }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
