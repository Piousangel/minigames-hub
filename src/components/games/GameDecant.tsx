'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  createGame,
  isDeadlocked,
  reduce,
  type Color,
  type DecantAction,
  type DecantEvent,
  type DecantState,
  type Tube,
} from '@/lib/games/decant/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface DecantSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/**
 * 일일 연속 기록 전용 키. best:<slug>에는 숫자만 넣는다 — 주간 리더보드가
 * 그 키를 Number()로 읽으므로(모든 게임 공통 규약) JSON을 넣으면 점수를 못 읽는다.
 */
const DAILY_KEY = 'decant:daily'

function loadDaily(): DecantSave['daily'] {
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

const SOUND: Record<DecantEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  select: 'flip',
  deselect: 'flip',
  move: 'move',
  merge: 'merge',
  cascade: 'match',
  illegal: 'error',
  undo: 'flip',
  win: 'win',
}

// UTC 기준(todayUTC와 동일 정의) — daily 경계를 전 게임에서 통일하기 위함.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadSave(storageKey: string): DecantSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }

    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }

    // 레거시: best 키에 {score, daily} JSON을 넣던 시절의 데이터를 옮겨 온다.
    const o = JSON.parse(raw) as Record<string, unknown>
    const score =
      typeof o?.score === 'number' && Number.isFinite(o.score) ? Math.max(0, Math.floor(o.score)) : 0
    let daily: DecantSave['daily']
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

function saveAll(storageKey: string, save: DecantSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

/** Fixed HSL hue per density rank so sink order is legible in light + dark. */
function bandColor(rank: Color, k: number): { bg: string; fg: string } {
  const hue = k <= 1 ? 200 : Math.round(((rank - 1) * 300) / (k - 1))
  return {
    bg: `hsl(${hue} 62% 52%)`,
    fg: `hsl(${hue} 70% 12%)`,
  }
}

function tubeLabel(tube: Tube, index: number): string {
  if (tube.length === 0) return `Tube ${index + 1}, empty`
  return `Tube ${index + 1}, bottom to top: ${tube.map((c) => `rank ${c}`).join(', ')}`
}

interface Badge {
  seq: number
  depth: number
}

const CAP_HEIGHT = 168 // px column height for CAP units

export function GameDecant({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client (ZeroHour pattern).
  const [state, setState] = useState<DecantState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [focus, setFocus] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<DecantState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevWon = useRef(false)
  const badgeSeq = useRef(0)
  const tubeRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commit = useCallback((next: DecantState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(save.daily?.streak ?? 0)
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
    (next: DecantState) => {
      const save = loadSave(storageKey)
      let nextSave: DecantSave = { ...save, score: Math.max(save.score, next.score) }
      if (modeRef.current === 'daily') {
        const today = isoDate(new Date())
        const y = new Date()
        y.setUTCDate(y.getUTCDate() - 1) // UTC로 하루 전 — isoDate가 UTC라 반드시 UTC 산술
        const yesterday = isoDate(y)
        if (save.daily?.lastDate !== today) {
          const nextStreak = save.daily?.lastDate === yesterday ? (save.daily?.streak ?? 0) + 1 : 1
          nextSave = { ...nextSave, daily: { lastDate: today, streak: nextStreak } }
          setStreak(nextStreak)
        }
      }
      setBest(nextSave.score)
      saveAll(storageKey, nextSave)
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: DecantAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastEvent === 'cascade' && next.lastPour) {
        const seq = ++badgeSeq.current
        const depth = next.lastPour.cascadeDepth
        setBadges((b) => [...b, { seq, depth }])
      }
      if (next.won && !prevWon.current) persistWin(next)
      prevWon.current = next.won
    },
    [commit, play, persistWin],
  )

  // Keyboard: roving focus + activation + undo + new game.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const n = s.tubes.length
      const cols = Math.min(n, 6)
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
        case ' ':
          e.preventDefault()
          dispatch({ type: 'select', tube: focus })
          break
        case 'Escape':
          e.preventDefault()
          if (s.selection !== null) dispatch({ type: 'select', tube: s.selection })
          break
        case 'u':
        case 'U':
          e.preventDefault()
          dispatch({ type: 'undo' })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard(modeRef.current, difficulty)
          break
      }
    },
    [dispatch, focus, difficulty, startBoard],
  )

  // Keep the DOM focus in sync with the roving index.
  useEffect(() => {
    if (!state) return
    tubeRefs.current[focus]?.focus()
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
        <div className="rounded-xl bg-surface p-6" data-testid="decant-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const k = state.config.colors
  const cap = state.config.capacity
  const won = state.won
  const deadlocked = !won && isDeadlocked(state)
  const undoDisabled = state.undosLeft === 0 || state.undoStack.length === 0 || won

  const hint = won
    ? 'Solved! Every tube is one color.'
    : deadlocked
      ? 'Stuck — press Undo or New Board.'
      : state.selection === null
        ? 'Sort every color into its own tube. Tap a tube, then tap where to pour — the top band sinks to its density layer.'
        : 'Now tap a destination (any color). Tap the same tube to cancel.'

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
      <GameButton variant="ghost" onClick={() => dispatch({ type: 'undo' })} disabled={undoDisabled}>
        Undo ({state.undosLeft})
      </GameButton>
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Moves', value: state.pours, testId: 'moves' },
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
        aria-label="Decant board"
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'dc-board-in .3s ease-out both' }}
        data-testid="decant-board"
      >
        <div className="flex flex-wrap items-end justify-center gap-3">
          {state.tubes.map((tube, i) => {
            const selected = state.selection === i
            return (
              <button
                key={i}
                ref={(el) => {
                  tubeRefs.current[i] = el
                }}
                type="button"
                data-testid="tube"
                aria-label={tubeLabel(tube, i)}
                aria-pressed={selected}
                tabIndex={i === focus ? 0 : -1}
                onFocus={() => setFocus(i)}
                onClick={() => dispatch({ type: 'select', tube: i })}
                className={`dc-tube relative flex flex-col-reverse rounded-b-2xl rounded-t-md border-2 p-1 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                  selected ? 'dc-selected border-accent' : 'border-border'
                }`}
                style={{
                  width: 48,
                  height: CAP_HEIGHT + 8,
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                {Array.from({ length: cap }, (_, slot) => {
                  const color = tube[slot]
                  if (color === undefined) {
                    return <span key={slot} className="w-full" style={{ height: CAP_HEIGHT / cap }} />
                  }
                  const { bg, fg } = bandColor(color, k)
                  const isTop = slot === tube.length - 1
                  return (
                    <span
                      key={slot}
                      aria-hidden="true"
                      className="flex w-full items-center justify-center text-xs font-bold tabular-nums"
                      style={{
                        height: CAP_HEIGHT / cap,
                        background: bg,
                        color: fg,
                        borderRadius: slot === 0 ? '0 0 10px 10px' : 0,
                        animation:
                          reduced || !isTop ? undefined : 'dc-drop .18s ease-out both',
                      }}
                    >
                      {color}
                    </span>
                  )
                })}
              </button>
            )
          })}
        </div>

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="cascade"
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-sm font-bold text-accent"
            style={reduced ? undefined : { animation: 'dc-badge .9s ease-out both' }}
          >
            Cascade ×{b.depth}
          </span>
        ))}

        <GameOverlay show={won} variant="win" title="Decanted!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Moves <span className="font-bold text-accent">{state.pours}</span> / Par{' '}
              <span className="font-bold text-accent">{state.par}</span>
            </p>
            <p>
              Deepest cascade <span className="font-bold text-accent">×{state.deepestCascade}</span>
            </p>
            {mode === 'daily' && (
              <p>
                Streak <span className="font-bold text-accent">{streak}</span>
              </p>
            )}
          </div>
          <GameButton onClick={onNewGame}>Play again</GameButton>
        </GameOverlay>

        <style>{`
          @keyframes dc-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes dc-drop { from { opacity: .2; transform: translateY(-14px) } to { opacity: 1; transform: none } }
          @keyframes dc-badge {
            0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.12); opacity: 1 }
            100% { transform: translate(-50%, -14px) scale(1); opacity: 0 }
          }
          .dc-tube { box-shadow: inset 0 -6px 12px rgba(0,0,0,.25); }
          .dc-selected { transform: translateY(-8px); box-shadow: 0 0 16px rgba(251,191,36,.55), inset 0 -6px 12px rgba(0,0,0,.25); }
        `}</style>
      </div>
    </GameShell>
  )
}
