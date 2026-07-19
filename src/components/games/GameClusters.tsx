'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GROUP_SIZE,
  LIVES_START,
  createGame,
  dailySeed,
  mistakes as mistakeCount,
  reduce,
  score as scoreOf,
  type ClustersAction,
  type ClustersState,
  type LastResult,
  type Tier,
} from '@/lib/games/clusters/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak, loadStreak, saveStreak } from '@/lib/dailyStreak'
import { recordResult } from '@/lib/gameStats'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { type Grade } from '@/lib/dailyShare'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'

// tier → neon color var (0 easiest 🟨 → 3 trickiest 🟪)
const TIER_COLOR: Record<Tier, string> = {
  0: 'var(--neon-amber)',
  1: 'var(--neon-green)',
  2: 'var(--neon-blue)',
  3: 'var(--neon-purple)',
}
const TIER_EMOJI: Record<Tier, string> = { 0: '🟨', 1: '🟩', 2: '🟦', 3: '🟪' }

const RESULT_SOUND: Record<LastResult, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  correct: 'match',
  wrong: 'mismatch',
  'one-away': 'mismatch',
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

/** Grade from mistakes: 0→S, 1→A, 2→B, 3→C, lost→D. */
function gradeFor(state: ClustersState): Grade {
  if (state.status === 'lost') return 'D'
  const m = mistakeCount(state)
  return (['S', 'A', 'B', 'C', 'D'] as const)[Math.min(m, 4)]
}

/** Spoiler-free Connections-style emoji grid, one row per guess. */
function emojiGrid(state: ClustersState): string {
  return state.guessRows.map((row) => row.map((t) => TIER_EMOJI[t]).join('')).join('\n')
}

export function GameClusters({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board on the client only (never Date/random in render).
  const [state, setState] = useState<ClustersState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [focus, setFocus] = useState(0)
  const [flash, setFlash] = useState<LastResult>('none')

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<ClustersState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevOverRef = useRef(false)
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([])
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commit = useCallback((next: ClustersState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const bestKey = storageKey
  const streakKey = `${storageKey}:streak`

  // Bootstrap (client only).
  useEffect(() => {
    const storedBest = Number(localStorage.getItem(bestKey))
    setBest(Number.isFinite(storedBest) && storedBest > 0 ? Math.floor(storedBest) : 0)
    setStreak(currentStreak(loadStreak(streakKey)))
    modeRef.current = 'daily'
    prevOverRef.current = false
    commit(createGame(dailySeed(todayUTC())))
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode) => {
      modeRef.current = nextMode
      prevOverRef.current = false
      setFocus(0)
      setFlash('none')
      commit(nextMode === 'daily' ? createGame(dailySeed(todayUTC())) : createGame(freshSeed()))
    },
    [commit],
  )

  const persistOutcome = useCallback(
    (next: ClustersState) => {
      const s = scoreOf(next)
      const storedBest = Number(localStorage.getItem(bestKey))
      const prevBest = Number.isFinite(storedBest) && storedBest > 0 ? Math.floor(storedBest) : 0
      if (s > prevBest) {
        try {
          localStorage.setItem(bestKey, String(s)) // PLAIN NUMBER — leaderboard reads Number()
        } catch {
          /* storage unavailable */
        }
        setBest(s)
      }
      // Day-streak only on a daily WIN.
      if (next.status === 'won' && modeRef.current === 'daily') {
        const bumped = bumpStreak(loadStreak(streakKey))
        saveStreak(streakKey, bumped)
        setStreak(bumped.streak)
      }
      // 개인 기록: 완료 판수/승수 + 실수 분포(0~4)를 누적 → 게임 페이지 스탯 패널이 읽는다.
      recordResult(bestKey.replace(/^best:/, ''), {
        won: next.status === 'won',
        bucket: mistakeCount(next),
      })
    },
    [bestKey, streakKey],
  )

  const dispatch = useCallback(
    (action: ClustersAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      if (action.type === 'select' && next.selected.length !== prev.selected.length) {
        play('flip')
      }
      if (action.type === 'submit' && next.lastResult !== 'none') {
        const sound = RESULT_SOUND[next.lastResult]
        if (sound) play(sound)
        setFlash(next.lastResult)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlash('none'), 1100)
      }

      const over = next.status !== 'playing'
      if (over && !prevOverRef.current) {
        if (next.status === 'won') play('win')
        else play('lose')
        persistOutcome(next)
      }
      prevOverRef.current = over
    },
    [commit, play, persistOutcome],
  )

  // Keyboard: roving focus + select + submit + shuffle + new.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const n = s.tiles.length
      if (n === 0) return
      const cols = Math.min(4, n)
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
          setFocus((f) => (f - cols + n) % n)
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocus((f) => (f + cols) % n)
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          // Enter on a full selection submits; otherwise toggle the focused tile.
          if (e.key === 'Enter' && s.selected.length === GROUP_SIZE) {
            dispatch({ type: 'submit' })
          } else {
            const item = s.tiles[focus]
            if (item !== undefined) dispatch({ type: 'select', item })
          }
          break
        }
        case 'Backspace':
        case 'Escape':
          e.preventDefault()
          dispatch({ type: 'deselect' })
          break
        case 's':
        case 'S':
          e.preventDefault()
          dispatch({ type: 'shuffle' })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard(modeRef.current)
          break
      }
    },
    [dispatch, focus, startBoard],
  )

  // Keep DOM focus synced to the roving index.
  useEffect(() => {
    if (!state) return
    const n = state.tiles.length
    if (n === 0) return
    const idx = Math.min(focus, n - 1)
    tileRefs.current[idx]?.focus()
  }, [focus, state])

  const onNewGame = useCallback(() => {
    if (mode === 'daily') dispatch({ type: 'reset' })
    else startBoard('practice')
  }, [mode, dispatch, startBoard])

  const switchMode = useCallback(
    (m: Mode) => {
      if (m === mode) return
      setMode(m)
      startBoard(m)
    },
    [mode, startBoard],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="aspect-square rounded-xl bg-surface" data-testid="clusters-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.status === 'won'
  const lost = state.status === 'lost'
  const over = won || lost
  const canSubmit = state.selected.length === GROUP_SIZE && !over
  const score = scoreOf(state)

  const hint = over
    ? won
      ? 'Solved! You found all four groups.'
      : 'Out of guesses — the groups are revealed below.'
    : 'Find four groups of four. Select 4 items you think share a category, then Submit.'

  const headerExtra = (
    <>
      <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Game mode">
        {(['daily', 'practice'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            aria-pressed={mode === m}
            className={`btn-press px-2.5 py-1.5 text-sm font-semibold capitalize ${
              mode === m ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      {mode === 'daily' && (
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Streak <span className="font-bold text-accent" data-testid="streak">{streak}</span>
        </span>
      )}
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm" aria-label={`${state.lives} lives remaining`}>
        <span className="text-fg-muted">Lives</span>{' '}
        <span className="font-bold" data-testid="lives">
          {Array.from({ length: LIVES_START }, (_, i) => (
            <span key={i} aria-hidden="true" className={i < state.lives ? 'text-neon-red' : 'text-fg-muted/40'}>
              ♥
            </span>
          ))}
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
      onNewGame={onNewGame}
      newGameLabel={mode === 'daily' ? 'Reset' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        role="group"
        aria-label="Clusters board"
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-3 sm:p-4"
        data-testid="clusters-board"
      >
        {/* Solved groups: locked colored rows */}
        <div className="flex flex-col gap-2">
          {state.solved.map((g) => (
            <div
              key={g.name}
              data-testid="solved-group"
              className="flex flex-col items-center justify-center rounded-lg px-3 py-2 text-center"
              style={{
                background: TIER_COLOR[g.tier],
                color: '#0b0b12',
                animation: reduced ? undefined : 'cl-lock .3s ease-out both',
              }}
            >
              <span className="text-sm font-extrabold uppercase tracking-wide">{g.name}</span>
              <span className="text-xs font-semibold uppercase opacity-80">
                {g.items.join(' · ')}
              </span>
            </div>
          ))}
        </div>

        {/* Unsolved tiles: 4-wide grid */}
        {state.tiles.length > 0 && (
          <div
            className={`mt-2 grid grid-cols-4 gap-1.5 sm:gap-2 ${
              flash !== 'none' && flash !== 'correct' && !reduced ? 'cl-shake' : ''
            }`}
          >
            {state.tiles.map((item, i) => {
              const selected = state.selected.includes(item)
              return (
                <button
                  key={item}
                  ref={(el) => {
                    tileRefs.current[i] = el
                  }}
                  type="button"
                  data-testid="tile"
                  data-selected={selected}
                  aria-label={item}
                  aria-pressed={selected}
                  disabled={over}
                  tabIndex={i === focus ? 0 : -1}
                  onFocus={() => setFocus(i)}
                  onClick={() => dispatch({ type: 'select', item })}
                  className={`flex min-h-11 items-center justify-center rounded-lg border-2 px-1 py-2 text-center text-[0.68rem] font-bold uppercase leading-tight tracking-tight transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:text-xs ${
                    selected
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border bg-white/5 text-fg hover:border-accent/50'
                  }`}
                  style={selected && !reduced ? { transform: 'translateY(-3px) scale(1.03)' } : undefined}
                >
                  {item}
                </button>
              )
            })}
          </div>
        )}

        {/* One-away / wrong live readout */}
        <div className="mt-2 flex h-6 items-center justify-center text-sm" aria-live="polite">
          {!over && flash === 'one-away' && (
            <span data-testid="one-away" className="font-bold text-neon-amber">
              One away…
            </span>
          )}
          {!over && flash === 'wrong' && (
            <span className="font-semibold text-neon-red">Not a group</span>
          )}
        </div>

        {/* Controls */}
        {!over && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <GameButton
              variant="ghost"
              onClick={() => dispatch({ type: 'shuffle' })}
              disabled={state.tiles.length <= 1}
            >
              Shuffle
            </GameButton>
            <GameButton
              variant="ghost"
              onClick={() => dispatch({ type: 'deselect' })}
              disabled={state.selected.length === 0}
            >
              Deselect
            </GameButton>
            <GameButton onClick={() => dispatch({ type: 'submit' })} disabled={!canSubmit}>
              Submit ({state.selected.length}/{GROUP_SIZE})
            </GameButton>
          </div>
        )}

        <GameOverlay
          show={over}
          variant={won ? 'win' : 'lose'}
          title={won ? 'Clustered!' : 'Out of guesses'}
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{score}</span>
            </p>
            <p>
              Mistakes <span className="font-bold text-accent">{mistakeCount(state)}</span> / {LIVES_START}
            </p>
            {mode === 'daily' && (
              <p>
                Streak <span className="font-bold text-accent">{streak}</span>
              </p>
            )}
            {state.guessRows.length > 0 && (
              <pre className="mt-1 text-base leading-tight" aria-hidden="true">
                {emojiGrid(state)}
              </pre>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === 'daily' && (
              <DailyShareButton
                payload={() => {
                  const grade = gradeFor(state)
                  const guesses = state.guessRows.length
                  const grid = emojiGrid(state)
                  return {
                    gameName: 'Clusters',
                    dateISO: todayUTC(),
                    accent: '#a3e635',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/clusters`,
                    isDaily: true,
                    grade,
                    scoreLine: `${score} PTS`,
                    textSnippet: `Clusters ${todayUTC()}  ${won ? mistakeCount(state) : 'X'}/${LIVES_START}\n${grid}\nYour turn ↓`,
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>
              {mode === 'daily' ? 'Replay daily' : 'New Board'}
            </GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes cl-lock { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: none } }
          @keyframes cl-shake {
            0%, 100% { transform: translateX(0) }
            20% { transform: translateX(-6px) }
            40% { transform: translateX(6px) }
            60% { transform: translateX(-4px) }
            80% { transform: translateX(4px) }
          }
          .cl-shake { animation: cl-shake .4s ease-in-out both; }
        `}</style>
      </div>
    </GameShell>
  )
}
