'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_SCRAMBLE,
  DIFFICULTIES,
  RING_A,
  RING_B,
  SHARED,
  createGame,
  reduce,
  type Color,
  type Dir,
  type InterlockAction,
  type InterlockEvent,
  type InterlockState,
  type RingId,
} from '@/lib/games/interlock/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface InterlockSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/** best:<slug>에는 숫자만 넣는다(리더보드가 Number()로 읽음). streak은 전용 키. */
const DAILY_KEY = 'interlock:daily'

const SOUND: Record<InterlockEvent, SoundName | null> = {
  none: null,
  rotate: 'move',
  undo: 'flip',
  win: 'win',
}

// -- Fixed board geometry (viewBox 0 0 320 220) -----------------------------

const K = 5
const BEAD_R = 12
/** Bead center per global index (precomputed from the two-ring geometry). */
const POS: [number, number][] = [
  [160, 52.6], // 0  shared top
  [160, 167.4], // 1  shared bottom
  [101.8, 42.4], // 2  arcA1
  [56.6, 80.4], // 3
  [56.6, 139.6], // 4
  [101.8, 177.6], // 5
  [178.6, 148.2], // 6  arcA2
  [188.7, 123.4], // 7
  [188.7, 96.6], // 8
  [178.6, 71.8], // 9
  [218.2, 42.4], // 10 arcB1
  [263.5, 80.4], // 11
  [263.5, 139.6], // 12
  [218.2, 177.6], // 13
  [141.4, 148.2], // 14 arcB2
  [131.3, 123.4], // 15
  [131.3, 96.6], // 16
  [141.4, 71.8], // 17
]

function loadDaily(): InterlockSave['daily'] {
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

function saveAll(storageKey: string, save: InterlockSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

function loadSave(storageKey: string): InterlockSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }
    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }
    // 레거시 JSON 마이그레이션
    const o = JSON.parse(raw) as Record<string, unknown>
    const score =
      typeof o?.score === 'number' && Number.isFinite(o.score) ? Math.max(0, Math.floor(o.score)) : 0
    let daily: InterlockSave['daily']
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

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

/** Fixed HSL per color rank; the hub color (5) is a distinct neutral gray. */
function bandColor(rank: Color): { bg: string; fg: string } {
  if (rank >= K) return { bg: 'hsl(0 0% 70%)', fg: 'hsl(0 0% 15%)' }
  const hue = Math.round(((rank - 1) * 300) / (K - 1))
  return { bg: `hsl(${hue} 62% 52%)`, fg: `hsl(${hue} 75% 12%)` }
}

const COLOR_NAME: Record<number, string> = {
  1: 'red',
  2: 'yellow',
  3: 'green',
  4: 'blue',
  5: 'gray',
}

/** Per-slot translate offset (from previous slot) for the rotated ring. */
function rotateOffsets(ring: RingId, dir: Dir): Map<number, [number, number]> {
  const R = ring === 'A' ? RING_A : RING_B
  const L = R.length
  const m = new Map<number, [number, number]>()
  for (let i = 0; i < L; i++) {
    const cur = R[i]
    const prev = R[(i - dir + L) % L]
    m.set(cur, [POS[prev][0] - POS[cur][0], POS[prev][1] - POS[cur][1]])
  }
  return m
}

interface Motion {
  key: number
  offsets: Map<number, [number, number]>
  glow: Set<number>
}

function ringSummary(cells: Color[], ring: RingId): string {
  const R = ring === 'A' ? RING_A : RING_B
  return R.map((gi) => COLOR_NAME[cells[gi]] ?? `rank ${cells[gi]}`).join(', ')
}

export function GameInterlock({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<InterlockState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [motion, setMotion] = useState<Motion | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<InterlockState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const reducedRef = useRef(false)
  const prevWon = useRef(false)
  const motionSeq = useRef(0)

  reducedRef.current = reduced

  const commit = useCallback((next: InterlockState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily))
    modeRef.current = 'daily'
    const g = createGame(dailySeed(new Date()), DAILY_SCRAMBLE)
    prevWon.current = false
    setMotion(null)
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty) => {
      modeRef.current = nextMode
      const g =
        nextMode === 'daily'
          ? createGame(dailySeed(new Date()), DAILY_SCRAMBLE)
          : createGame(freshSeed(), DIFFICULTIES[diff].scramble)
      prevWon.current = false
      setMotion(null)
      commit(g)
    },
    [commit],
  )

  const persistWin = useCallback(
    (next: InterlockState) => {
      const save = loadSave(storageKey)
      let nextSave: InterlockSave = { ...save, score: Math.max(save.score, next.score) }
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
    (action: InterlockAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      // Bead motion (rotate/win transitions only, non-reduced).
      if (
        !reducedRef.current &&
        (next.lastEvent === 'rotate' || next.lastEvent === 'win') &&
        next.lastRotate
      ) {
        const { ring, dir } = next.lastRotate
        const glow = new Set<number>()
        for (const p of SHARED) if (next.cells[p] !== prev.cells[p]) glow.add(p)
        setMotion({ key: ++motionSeq.current, offsets: rotateOffsets(ring, dir), glow })
      } else if (next.lastEvent === 'undo' || next.lastEvent === 'none') {
        setMotion(null)
      }

      if (next.won && !prevWon.current) persistWin(next)
      prevWon.current = next.won
    },
    [commit, play, persistWin],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const rotate = (ring: RingId, dir: Dir) => {
        e.preventDefault()
        dispatch({ type: 'rotate', ring, dir })
      }
      switch (e.key) {
        case 'a':
        case 'A':
        case 'ArrowLeft':
          rotate('A', 1)
          break
        case 'd':
        case 'D':
        case 'ArrowRight':
          rotate('A', -1)
          break
        // Ring B's slot order (top → upper-right → right → bottom) runs clockwise on
        // screen, so dir=+1 is clockwise for B (the mirror of ring A). J/L mirror A/D:
        // J = counter-clockwise, L = clockwise.
        case 'j':
        case 'J':
        case ',':
          rotate('B', -1)
          break
        case 'l':
        case 'L':
        case '.':
          rotate('B', 1)
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
    [dispatch, difficulty, startBoard],
  )

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
        <div className="rounded-xl bg-surface p-6" data-testid="interlock-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.won
  const undoDisabled = state.undosLeft === 0 || state.undoStack.length === 0 || won

  const hint = won
    ? 'Solved! Every arc is home.'
    : 'Rotate a ring one step. Beads at the two crossings hop to the other ring — chain moves to herd each color home.'

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

  const boardAria = `Interlock board. Left ring: ${ringSummary(state.cells, 'A')}. Right ring: ${ringSummary(state.cells, 'B')}.`

  const rotateBtn = (ring: RingId, dir: Dir, glyph: string, label: string, cls: string) => (
    <button
      type="button"
      onClick={() => dispatch({ type: 'rotate', ring, dir })}
      aria-label={label}
      className={`il-rot ${cls}`}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  )

  return (
    <GameShell
      stats={[
        { label: 'Moves', value: state.moves, testId: 'moves' },
        { label: 'Par', value: state.scramble },
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
        aria-label={boardAria}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={reduced ? undefined : { animation: 'il-board-in .3s ease-out both' }}
        data-testid="interlock-board"
      >
        <div className="relative mx-auto flex max-w-full items-stretch justify-center gap-1">
          {/* Ring A controls (left) */}
          <div className="flex flex-col justify-center gap-2">
            {rotateBtn('A', 1, '↺', 'Rotate left ring counter-clockwise', '')}
            {rotateBtn('A', -1, '↻', 'Rotate left ring clockwise', '')}
          </div>

          <svg
            viewBox="0 0 320 220"
            className="h-auto w-full max-w-100 flex-1"
            role="presentation"
          >
            {/* ring tracks */}
            <circle cx="120" cy="110" r="70" className="il-track" />
            <circle cx="200" cy="110" r="70" className="il-track" />
            {state.cells.map((color, i) => {
              const { bg, fg } = bandColor(color)
              const off = motion?.offsets.get(i)
              const glowing = motion?.glow.has(i)
              const shared = SHARED.includes(i)
              return (
                <g
                  key={i}
                  transform={`translate(${POS[i][0]}, ${POS[i][1]})`}
                >
                  <g
                    key={motion ? `${motion.key}-${i}` : `s-${i}`}
                    style={
                      off && !reduced
                        ? {
                            animation: 'il-slide .18s ease-out both',
                            // start offset via CSS var consumed in keyframes
                            ['--il-dx' as string]: `${off[0]}px`,
                            ['--il-dy' as string]: `${off[1]}px`,
                          }
                        : undefined
                    }
                  >
                    <circle
                      r={shared ? BEAD_R + 0.5 : BEAD_R}
                      fill={bg}
                      stroke={shared ? 'var(--accent, #fbbf24)' : 'rgba(0,0,0,0.28)'}
                      strokeWidth={shared ? 2.5 : 1.5}
                      className={glowing && !reduced ? 'il-glow' : undefined}
                      style={glowing && !reduced ? { animationDelay: '.05s' } : undefined}
                    />
                    <text
                      aria-hidden="true"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="11"
                      fontWeight="700"
                      fill={fg}
                    >
                      {color}
                    </text>
                  </g>
                </g>
              )
            })}
          </svg>

          {/* Ring B controls (right) */}
          <div className="flex flex-col justify-center gap-2">
            {/* B's dir=+1 runs clockwise on screen (see RING_B order / POS). */}
            {rotateBtn('B', -1, '↺', 'Rotate right ring counter-clockwise', '')}
            {rotateBtn('B', 1, '↻', 'Rotate right ring clockwise', '')}
          </div>
        </div>

        <GameOverlay show={won} variant="win" title="Interlocked!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Moves <span className="font-bold text-accent">{state.moves}</span> / Par{' '}
              <span className="font-bold text-accent">{state.scramble}</span>
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
                  const used = state.moves
                  const par = state.scramble
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} MOVES · PAR ${par}`)
                  return {
                    gameName: 'Interlock',
                    dateISO: todayUTC(),
                    accent: '#ff3d9a',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/interlock`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Interlock',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `solved in ${used} moves (par ${par})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes il-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes il-slide {
            from { transform: translate(var(--il-dx, 0), var(--il-dy, 0)) }
            to { transform: translate(0, 0) }
          }
          @keyframes il-glow {
            0% { transform: scale(1); opacity: .55 }
            40% { transform: scale(1.35); opacity: 1 }
            100% { transform: scale(1); opacity: 1 }
          }
          .il-track { fill: none; stroke: rgba(140,140,200,0.16); stroke-width: 2; }
          .il-glow { animation: il-glow .25s ease-out both; transform-box: fill-box; transform-origin: center; }
          .il-rot {
            display: flex; align-items: center; justify-content: center;
            width: 44px; height: 56px; border-radius: 12px; font-size: 22px;
            border: 2px solid var(--border, rgba(140,140,200,0.28));
            background: rgba(255,255,255,0.04); color: var(--accent, #fbbf24);
            transition: transform .1s ease, border-color .1s ease;
          }
          .il-rot:hover { border-color: var(--accent, #fbbf24); }
          .il-rot:active { transform: scale(.92); }
          .il-rot:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent, #fbbf24); }
        `}</style>
      </div>
    </GameShell>
  )
}
