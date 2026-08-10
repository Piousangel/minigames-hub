'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  createGame,
  reduce,
  type FlapjackAction,
  type FlapjackEvent,
  type FlapjackState,
  type Pancake,
} from '@/lib/games/flapjack/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface FlapjackSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/**
 * 일일 연속 기록 전용 키. best:<slug>에는 숫자만 넣는다 — 주간 리더보드가
 * 그 키를 Number()로 읽으므로(모든 게임 공통 규약) JSON을 넣으면 점수를 못 읽는다.
 */
const DAILY_KEY = 'flapjack:daily'

const SOUND: Record<FlapjackEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  flip: 'flip',
  illegal: 'error',
  undo: 'flip',
  win: 'win',
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadDaily(): FlapjackSave['daily'] {
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

function loadSave(storageKey: string): FlapjackSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }

    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }

    // 레거시: best 키에 {score, daily} JSON을 넣던 시절의 데이터를 옮겨 온다.
    const o = JSON.parse(raw) as Record<string, unknown>
    const score =
      typeof o?.score === 'number' && Number.isFinite(o.score) ? Math.max(0, Math.floor(o.score)) : 0
    let daily: FlapjackSave['daily']
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

function saveAll(storageKey: string, save: FlapjackSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

/** Fixed HSL hue per size rank so the density order reads in light + dark. */
function pancakeColor(rank: Pancake, n: number): { bg: string; fg: string } {
  const hue = n <= 1 ? 40 : Math.round(40 + ((rank - 1) * 280) / (n - 1))
  return {
    bg: `hsl(${hue} 68% 54%)`,
    fg: `hsl(${hue} 72% 12%)`,
  }
}

const MIN_W = 52 // px, smallest pancake
const MAX_W = 320 // px, largest pancake
const ROW_H = 30 // px per pancake row

export function GameFlapjack({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<FlapjackState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [focus, setFocus] = useState(0)
  const [hoverBand, setHoverBand] = useState<number | null>(null)
  const [flipKey, setFlipKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<FlapjackState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevWon = useRef(false)
  const pancakeRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commit = useCallback((next: FlapjackState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily)) // 끊긴 streak은 0으로
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
      setFocus(0)
      setHoverBand(null)
      commit(g)
    },
    [commit],
  )

  const persistWin = useCallback(
    (next: FlapjackState) => {
      const save = loadSave(storageKey)
      let nextSave: FlapjackSave = { ...save, score: Math.max(save.score, next.score) }
      if (modeRef.current === 'daily') {
        const bumped = bumpStreak(save.daily)
        nextSave = { ...nextSave, daily: bumped }
        setStreak(bumped.streak)
      }
      setBest(nextSave.score)
      saveAll(storageKey, nextSave)
      recordResult(storageKey.replace(/^best:/, ''), { won: true })
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: FlapjackAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastEvent === 'flip' || next.lastEvent === 'win') setFlipKey((k) => k + 1)
      if (next.won && !prevWon.current) persistWin(next)
      prevWon.current = next.won
    },
    [commit, play, persistWin],
  )

  // Keyboard: roving focus + activation + shortcuts.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const n = s.stack.length
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setFocus((f) => (f - 1 + n) % n)
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocus((f) => (f + 1) % n)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          dispatch({ type: 'flip', k: focus + 1 })
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
        default: {
          if (e.key >= '1' && e.key <= '9') {
            const d = Number(e.key)
            if (d <= n) {
              e.preventDefault()
              dispatch({ type: 'flip', k: d })
            }
          }
        }
      }
    },
    [dispatch, focus, difficulty, startBoard],
  )

  // Keep DOM focus in sync with the roving index.
  useEffect(() => {
    if (!state) return
    pancakeRefs.current[focus]?.focus()
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
        <div className="rounded-xl bg-surface p-6" data-testid="flapjack-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const n = state.config.size
  const won = state.won
  const undoDisabled = state.undosLeft === 0 || state.undoStack.length === 0 || won

  // The band that will flip if the current focus/hover is activated: rows 0..band.
  const activeBand = hoverBand ?? focus

  const hint = won
    ? 'Sorted! Small on top, large at the bottom.'
    : 'Slide the spatula under a pancake and flip the whole stack above it — sort big to the bottom in as few flips as you can.'

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

  const underPar = won && state.flips < state.par

  return (
    <GameShell
      stats={[
        { label: 'Flips', value: state.flips, testId: 'moves' },
        { label: 'Par', value: state.par },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={won ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        role="group"
        aria-label="Flapjack stack"
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHoverBand(null)}
        className="relative rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'fj-board-in .3s ease-out both' }}
        data-testid="flapjack-board"
      >
        <div className="flex flex-col items-center gap-1.5 py-2">
          {state.stack.map((rank, i) => {
            const width = MIN_W + (rank / n) * (MAX_W - MIN_W)
            const { bg, fg } = pancakeColor(rank, n)
            const inBand = !won && i <= activeBand
            const isSpatula = !won && i === activeBand
            // The band that just physically flipped: rows 0..lastFlipK-1.
            const justFlipped = state.lastFlipK != null && i < state.lastFlipK
            return (
              <div key={i} className="relative flex w-full flex-col items-center">
                <button
                  ref={(el) => {
                    pancakeRefs.current[i] = el
                  }}
                  type="button"
                  data-testid="pancake"
                  aria-label={`Pancake size ${rank}, position ${i + 1} from top`}
                  tabIndex={i === focus ? 0 : -1}
                  onFocus={() => setFocus(i)}
                  onMouseEnter={() => setHoverBand(i)}
                  onClick={() => dispatch({ type: 'flip', k: i + 1 })}
                  className={`flex items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums transition-[box-shadow,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                    inBand ? 'border-[var(--neon-cyan)]' : 'border-black/20'
                  }`}
                  style={{
                    width,
                    height: ROW_H,
                    background: bg,
                    color: fg,
                    boxShadow: inBand
                      ? '0 0 12px color-mix(in srgb, var(--neon-cyan) 60%, transparent)'
                      : 'inset 0 -3px 6px rgba(0,0,0,.28)',
                    // Alternate keyframe names by flipKey parity so the toss
                    // replays on every flip of the same band.
                    animation:
                      reduced || !justFlipped
                        ? undefined
                        : `fj-flip-${flipKey % 2} .25s ease-out both`,
                  }}
                >
                  {rank}
                </button>
                {isSpatula && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-1 left-1/2 h-0.5 w-[92%] -translate-x-1/2 rounded-full"
                    style={{
                      background: 'var(--neon-cyan)',
                      boxShadow: '0 0 8px var(--neon-cyan)',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        <GameOverlay show={won} variant="win" title="Flipped!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Flips <span className="font-bold text-accent">{state.flips}</span> · Par{' '}
              <span className="font-bold text-accent">{state.par}</span>
            </p>
            {underPar && <p className="font-bold text-accent">Under par!</p>}
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
                    gameName: 'Flapjack',
                    dateISO: todayUTC(),
                    accent: '#22d3ee',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/flapjack`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Flapjack',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `sorted in ${used} flips (par ${par})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes fj-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes fj-flip-0 {
            0% { opacity: .35; transform: rotateX(0) }
            45% { transform: rotateX(-14deg) }
            100% { opacity: 1; transform: rotateX(0) }
          }
          @keyframes fj-flip-1 {
            0% { opacity: .35; transform: rotateX(0) }
            45% { transform: rotateX(-14deg) }
            100% { opacity: 1; transform: rotateX(0) }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
