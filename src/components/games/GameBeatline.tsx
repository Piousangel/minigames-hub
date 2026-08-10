'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_CONFIG,
  TICK_MS,
  createGame,
  reduce,
  type BeatlineAction,
  type BeatlineEvent,
  type BeatlineState,
} from '@/lib/games/beatline/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeRatio, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'

interface BeatlineSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/** Daily-streak-only key. best:<slug> stays a bare number (weekly leaderboard reads it via Number()). */
const DAILY_KEY = 'beatline:daily'

/** Ticks of lead time a note is visible before the judgement line (~1.5s at TICK_MS=10). */
const TRAVEL_TICKS = 150
/** Ticks over which a freshly-spawned note fades in from opacity 0. */
const FADE_IN_TICKS = 15
/** rAF frame delta cap (ms) — background-tab catch-up shouldn't nuke several lives at once. */
const MAX_FRAME_MS = 250

const TRACK_HEIGHT = 360
const JUDGEMENT_LINE_Y = TRACK_HEIGHT - 40
const NOTE_HEIGHT = 26

const LANE_KEYS = ['d', 'f', 'j', 'k'] as const

function loadDaily(): BeatlineSave['daily'] {
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

const SOUND: Record<BeatlineEvent, SoundName | null> = {
  none: null,
  perfect: 'match',
  good: 'move',
  miss: 'error',
  'stage-clear': 'flag',
  win: 'win',
  lose: 'lose',
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadSave(storageKey: string): BeatlineSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }
    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }
  } catch {
    // corrupt -> reset
  }
  return { score: 0 }
}

function saveAll(storageKey: string, save: BeatlineSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

interface Popup {
  seq: number
  lane: number
  kind: 'perfect' | 'good' | 'miss'
  text: string
}

const POPUP_COLOR: Record<Popup['kind'], string> = {
  perfect: 'var(--neon-lime)',
  good: 'var(--neon-cyan)',
  miss: 'var(--neon-red)',
}

export function GameBeatline({ storageKey }: { storageKey: string }) {
  // SSR safety: build the run only on the client (GameShell template pattern).
  const [state, setState] = useState<BeatlineState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [popups, setPopups] = useState<Popup[]>([])
  const [missFlashes, setMissFlashes] = useState<number[]>([])

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<BeatlineState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevWon = useRef(false)
  const prevLost = useRef(false)
  const popupSeq = useRef(0)
  const flashSeq = useRef(0)

  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const accRef = useRef(0)
  const nextTickRef = useRef(0)

  const commit = useCallback((next: BeatlineState) => {
    stateRef.current = next
    nextTickRef.current = next.tick
    setState(next)
  }, [])

  const persistResult = useCallback(
    (next: BeatlineState) => {
      const save = loadSave(storageKey)
      let nextSave: BeatlineSave = { ...save, score: Math.max(save.score, next.score) }
      if (next.won && modeRef.current === 'daily') {
        const bumped = bumpStreak(save.daily) // 어제 완료면 +1, 아니면 1, 오늘 중복은 멱등
        nextSave = { ...nextSave, daily: bumped }
        setStreak(bumped.streak)
      }
      setBest(nextSave.score)
      saveAll(storageKey, nextSave)
      recordResult(storageKey.replace(/^best:/, ''), { won: next.won })
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: BeatlineAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastJudgement && (next.lastEvent === 'perfect' || next.lastEvent === 'good' || next.lastEvent === 'miss' || next.lastEvent === 'lose')) {
        const j = next.lastJudgement
        const kind: Popup['kind'] = j.judgement
        const seq = ++popupSeq.current
        setPopups((p) => [...p, { seq, lane: j.lane, kind, text: kind.toUpperCase() }])
        if (kind === 'miss') {
          const fseq = ++flashSeq.current
          setMissFlashes((f) => [...f, fseq])
        }
      }

      if ((next.won || next.lost) && !prevWon.current && !prevLost.current) {
        persistResult(next)
      }
      prevWon.current = next.won
      prevLost.current = next.lost
    },
    [commit, play, persistResult],
  )

  // Init run + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily))
    const g = createGame(DEFAULT_CONFIG, dailySeed(new Date()))
    prevWon.current = false
    prevLost.current = false
    lastTsRef.current = 0
    accRef.current = 0
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startRun = useCallback(
    (nextMode: Mode) => {
      modeRef.current = nextMode
      const g = nextMode === 'daily' ? createGame(DEFAULT_CONFIG, dailySeed(new Date())) : createGame(DEFAULT_CONFIG, freshSeed())
      prevWon.current = false
      prevLost.current = false
      lastTsRef.current = 0
      accRef.current = 0
      setPopups([])
      setMissFlashes([])
      commit(g)
    },
    [commit],
  )

  const onNewGame = useCallback(() => {
    if (mode === 'daily') dispatch({ type: 'reset' })
    else startRun('practice')
  }, [mode, dispatch, startRun])

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m)
      startRun(m)
    },
    [startRun],
  )

  // rAF tick driver: fixed-width accumulator quantizes real ms into TICK_MS steps.
  useEffect(() => {
    function frame(ts: number) {
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      let dt = ts - last
      if (dt > MAX_FRAME_MS) dt = MAX_FRAME_MS

      const s = stateRef.current
      const paused = !s || s.won || s.lost || s.stageCleared
      if (!paused) {
        accRef.current += dt
        let target = nextTickRef.current
        let ticked = false
        while (accRef.current >= TICK_MS) {
          accRef.current -= TICK_MS
          target += 1
          ticked = true
        }
        if (ticked) dispatch({ type: 'tick', tick: target })
      } else {
        accRef.current = 0
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [dispatch])

  const press = useCallback(
    (lane: number) => {
      dispatch({ type: 'press', lane })
    },
    [dispatch],
  )

  const continueStage = useCallback(() => {
    dispatch({ type: 'advance-stage' })
  }, [dispatch])

  // Keyboard: D F J K lanes, Space/Enter to continue after a stage clear, R for New Game.
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.repeat) return
      const s = stateRef.current
      if (!s) return
      const key = e.key.toLowerCase()
      const laneIdx = LANE_KEYS.indexOf(key as (typeof LANE_KEYS)[number])
      if (laneIdx !== -1) {
        e.preventDefault()
        press(laneIdx)
        return
      }
      if (key === ' ' || key === 'spacebar' || key === 'enter') {
        if (s.stageCleared) {
          e.preventDefault()
          continueStage()
        }
        return
      }
      if (key === 'r') {
        e.preventDefault()
        onNewGame()
      }
    },
    [press, continueStage, onNewGame],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="beatline-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.won
  const lost = state.lost
  const stages = state.config.stages.length

  const hint = won
    ? "Cleared! Today's chart complete."
    : lost
      ? 'Run over — hit New Game to try again.'
      : state.stageCleared
        ? 'Stage clear! Press to continue.'
        : 'Press D, F, J, K to hit the falling notes on the judgement line.'

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
      {mode === 'daily' && (
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Streak <span className="font-bold text-accent">{streak}</span>
        </span>
      )}
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm" data-testid="lives">
        {'♥'.repeat(Math.max(0, state.lives))}
        {'♡'.repeat(Math.max(0, state.config.lives - state.lives))}
      </span>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm" data-testid="stage">
        Stage {Math.min(state.stageIndex + 1, stages)}/{stages}
      </span>
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Combo', value: state.combo, testId: 'combo' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={won || lost ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        className="relative rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'bl-board-in .3s ease-out both' }}
        data-testid="beatline-board"
      >
        <div className="flex items-stretch justify-center gap-2">
          {Array.from({ length: state.config.lanes }, (_, lane) => {
            const laneNotes = state.chart.filter(
              (n) => n.lane === lane && n.status === 'pending' && n.tick - state.tick <= TRAVEL_TICKS,
            )
            const lanePopups = popups.filter((p) => p.lane === lane)
            return (
              <div
                key={lane}
                className="bl-lane relative flex-1 overflow-hidden rounded-lg border border-border"
                style={{ height: TRACK_HEIGHT, minWidth: 64, maxWidth: 96, background: 'rgba(255,255,255,0.03)' }}
              >
                {/* judgement line */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0"
                  style={{ top: JUDGEMENT_LINE_Y, height: 3, background: 'var(--neon-cyan)', opacity: 0.8 }}
                />

                {/* falling notes */}
                {laneNotes.map((n) => {
                  const remaining = n.tick - state.tick
                  const y = JUDGEMENT_LINE_Y - (remaining / TRAVEL_TICKS) * TRACK_HEIGHT
                  const opacity = reduced ? 1 : Math.min(1, (TRAVEL_TICKS - remaining) / FADE_IN_TICKS)
                  return (
                    <div
                      key={`${lane}-${n.tick}`}
                      aria-hidden="true"
                      className="absolute left-1 right-1 rounded-md"
                      style={{
                        top: 0,
                        height: NOTE_HEIGHT,
                        transform: `translateY(${y}px)`,
                        background: 'var(--neon-magenta)',
                        opacity,
                        boxShadow: '0 0 8px var(--neon-magenta)',
                      }}
                    />
                  )
                })}

                {/* judgement popups */}
                {lanePopups.map((p) => (
                  <span
                    key={p.seq}
                    aria-hidden="true"
                    onAnimationEnd={() => setPopups((cur) => cur.filter((x) => x.seq !== p.seq))}
                    className="pointer-events-none absolute inset-x-0 text-center text-xs font-extrabold"
                    style={{
                      top: JUDGEMENT_LINE_Y - 30,
                      color: POPUP_COLOR[p.kind],
                      textShadow: `0 0 8px ${POPUP_COLOR[p.kind]}`,
                      animation: reduced ? 'bl-popup-static .5s ease-out both' : 'bl-popup .6s ease-out both',
                    }}
                  >
                    {p.text}
                  </span>
                ))}

                {/* touch tap target */}
                <button
                  type="button"
                  data-testid="lane-button"
                  aria-label={`Lane ${lane + 1} (${LANE_KEYS[lane]?.toUpperCase() ?? lane + 1})`}
                  onPointerDown={() => press(lane)}
                  className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  style={{ touchAction: 'manipulation', background: 'transparent' }}
                />
              </div>
            )
          })}
        </div>

        {state.stageCleared && !won && (
          <button
            type="button"
            data-testid="stage-continue"
            onPointerDown={continueStage}
            className="btn-press absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-bg/60 text-lg font-bold text-accent backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
          >
            Stage {state.stageIndex + 1} clear — Tap to continue
          </button>
        )}

        {/* miss vignette flash (opacity only, skipped under reduced motion) */}
        {!reduced &&
          missFlashes.map((f) => (
            <div
              key={f}
              aria-hidden="true"
              onAnimationEnd={() => setMissFlashes((cur) => cur.filter((x) => x !== f))}
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={{
                boxShadow: 'inset 0 0 60px var(--neon-red)',
                animation: 'bl-flash .35s ease-out both',
              }}
            />
          ))}

        <GameOverlay show={won} variant="win" title="Run complete!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Best combo <span className="font-bold text-accent">{state.bestCombo}</span>
            </p>
            <p>
              Stage <span className="font-bold text-accent">{stages}</span>/{stages} clear
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
                  const isNewBest = state.score >= best
                  const grade = gradeRatio(state.score, best, isNewBest)
                  const glyph = barGlyph(Math.min(10, state.bestCombo), undefined, `SCORE ${state.score}`)
                  return {
                    gameName: 'Beatline',
                    dateISO: todayUTC(),
                    accent: '#00e5ff',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/beatline`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Beatline',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      undefined,
                      `cleared all ${stages} stages, best combo ${state.bestCombo}`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <GameOverlay show={lost} variant="lose" title="Run over" testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Reached stage <span className="font-bold text-accent">{state.stageIndex + 1}</span>/{stages}
            </p>
            <p>
              Best combo <span className="font-bold text-accent">{state.bestCombo}</span>
            </p>
          </div>
          <GameButton onClick={onNewGame}>Try again</GameButton>
        </GameOverlay>

        <style>{`
          @keyframes bl-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes bl-popup {
            0% { transform: translateY(6px); opacity: 0 }
            25% { transform: translateY(0); opacity: 1 }
            100% { transform: translateY(-18px); opacity: 0 }
          }
          @keyframes bl-popup-static {
            0% { opacity: 0 }
            15% { opacity: 1 }
            85% { opacity: 1 }
            100% { opacity: 0 }
          }
          @keyframes bl-flash {
            0% { opacity: .9 }
            100% { opacity: 0 }
          }
          .bl-lane { box-shadow: inset 0 0 16px rgba(0,0,0,.3); }
        `}</style>
      </div>
    </GameShell>
  )
}
