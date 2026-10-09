'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  dailySeed,
  levelPoints,
  mulberry32,
  newGame,
  nextLevel,
  nextStreak,
  probe,
  scoreLevel,
  type LevelScore,
  type Pos,
  type QuarryState,
  type Rng,
} from '@/lib/games/quarry/engine'
import { todayUTC as todayStr } from '@/lib/dailyDate'
import { bumpStreak, currentStreak, loadStreak, saveStreak } from '@/lib/dailyStreak'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'free'

/** Blue(cold) -> red(hot) hue for a revealed distance; 0 (catch) is red. */
function warmthColor(distance: number, size: number): string {
  const maxD = Math.max(1, size - 1)
  const t = Math.min(1, Math.max(0, distance / maxD)) // 0 (hot) .. 1 (cold)
  const hue = 210 * t // 0 = red, 210 = blue
  const light = distance === 0 ? 58 : 62
  return `hsl(${hue}, 90%, ${light}%)`
}

function centerOf(size: number): Pos {
  const mid = (size - 1) / 2
  return { row: mid, col: mid }
}

/** Latest reading per cell, keyed "r,c" (cells can be re-probed; last wins). */
function readingsFrom(state: QuarryState): Map<string, number> {
  const m = new Map<string, number>()
  for (const rec of state.history) m.set(`${rec.at.row},${rec.at.col}`, rec.distance)
  return m
}

export function GameQuarry({ storageKey }: { storageKey: string }) {
  // SSR-safe: the board is only built after mount (mirrors GameLightsOut).
  const [state, setState] = useState<QuarryState | null>(null)
  const [best, setBest] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [mode, setMode] = useState<Mode>('free')
  const [cursor, setCursor] = useState<Pos>({ row: 2, col: 2 })
  const [keyboardActive, setKeyboardActive] = useState(false)
  // Retriggers the panic-hop animation exactly once per probe.
  const [hopKey, setHopKey] = useState(0)
  const [lastScore, setLastScore] = useState<LevelScore | null>(null)
  const [lastPoints, setLastPoints] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [dayStreak, setDayStreak] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<QuarryState | null>(null)
  const bestRef = useRef(0)
  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const rngRef = useRef<Rng>(mulberry32(1))
  const modeRef = useRef<Mode>('free')

  const commit = useCallback((s: QuarryState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const persistBest = useCallback(
    (candidate: number) => {
      if (candidate > bestRef.current) {
        bestRef.current = candidate
        setBest(candidate)
        localStorage.setItem(storageKey, String(candidate))
        return true
      }
      return false
    },
    [storageKey],
  )

  const startRun = useCallback(
    (m: Mode) => {
      const seed =
        m === 'daily' ? dailySeed(todayStr()) : (Math.random() * 2 ** 32) >>> 0
      const rng = mulberry32(seed)
      rngRef.current = rng
      scoreRef.current = 0
      streakRef.current = 0
      setScore(0)
      setStreak(0)
      setLastScore(null)
      setLastPoints(0)
      setNewBest(false)
      setHopKey(0)
      const s = newGame(rng)
      setCursor(centerOf(s.size))
      commit(s)
    },
    [commit],
  )

  const restart = useCallback(() => {
    // Persist a mid-run best before wiping the score (New Game during a run).
    persistBest(scoreRef.current)
    startRun(modeRef.current)
  }, [persistBest, startRun])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    // 모드를 기억한다. 홈의 Daily 필터가 이 게임을 가리키므로 기본값은 daily.
    // startRun이 modeRef가 아니라 인자를 쓰지만, mode 상태·modeRef를 함께 맞춰
    // 첫 토글이 뒤집히지 않게 한다.
    const initialMode: Mode = localStorage.getItem(`${storageKey}:mode`) === 'free' ? 'free' : 'daily'
    modeRef.current = initialMode
    setMode(initialMode)
    startRun(initialMode)
    setDayStreak(currentStreak(loadStreak(`${storageKey}:streak`)))
    const stored = Number(localStorage.getItem(storageKey))
    const value = Number.isFinite(stored) && stored > 0 ? stored : 0
    bestRef.current = value
    setBest(value)
  }, [startRun, storageKey])

  const handleProbe = useCallback(
    (row: number, col: number) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing') return
      const next = probe(s, { row, col })
      if (next === s) return // off-board no-op
      setHopKey((k) => k + 1)
      commit(next)

      const lp = next.lastProbe
      if (next.status === 'won' && lp?.caught) {
        // Catch feedback tone.
        play('eat')
        const sc = scoreLevel(next.level, next.history.length)
        const st = nextStreak(streakRef.current, sc)
        const pts = levelPoints(sc, st)
        streakRef.current = st
        scoreRef.current += pts
        setStreak(st)
        setScore(scoreRef.current)
        setLastScore(sc)
        setLastPoints(pts)
        // Level-clear overlay show -> celebratory layer.
        play('win')
      } else if (next.status === 'lost') {
        play('lose')
        setLastScore(null)
        const isNew = persistBest(scoreRef.current)
        setNewBest(isNew)
        if (modeRef.current === 'daily') {
          const streakKey = `${storageKey}:streak`
          const bumped = bumpStreak(loadStreak(streakKey))
          saveStreak(streakKey, bumped)
          setDayStreak(bumped.streak)
        }
        // Endless run: like Snake/Tetris/etc. a finished run is recorded with won:true (hub-wide
        // convention). Hiding Win % for endless games is a separate, cross-game change.
        recordResult(storageKey.replace(/^best:/, ''), { won: true })
      } else if (lp?.fled) {
        play('move') // the panic-hop
      } else {
        play('error') // pinned / no progress
      }
    },
    [commit, play, persistBest, storageKey],
  )

  const handleNext = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const nl = nextLevel(s, rngRef.current)
    setCursor(centerOf(nl.size))
    setHopKey(0)
    commit(nl)
  }, [commit])

  // Desktop keyboard: arrow-cursor + Enter/Space to probe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s || s.status !== 'playing') return
      const size = s.size
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setKeyboardActive(true)
          setCursor((c) => ({ ...c, row: Math.max(0, c.row - 1) }))
          break
        case 'ArrowDown':
          e.preventDefault()
          setKeyboardActive(true)
          setCursor((c) => ({ ...c, row: Math.min(size - 1, c.row + 1) }))
          break
        case 'ArrowLeft':
          e.preventDefault()
          setKeyboardActive(true)
          setCursor((c) => ({ ...c, col: Math.max(0, c.col - 1) }))
          break
        case 'ArrowRight':
          e.preventDefault()
          setKeyboardActive(true)
          setCursor((c) => ({ ...c, col: Math.min(size - 1, c.col + 1) }))
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          setKeyboardActive(true)
          setCursor((c) => {
            handleProbe(c.row, c.col)
            return c
          })
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleProbe])

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const nextMode = prev === 'free' ? 'daily' : 'free'
      modeRef.current = nextMode
      localStorage.setItem(`${storageKey}:mode`, nextMode)
      persistBest(scoreRef.current)
      startRun(nextMode)
      return nextMode
    })
  }, [persistBest, startRun, storageKey])

  // 'king-move'는 엔진 내부 용어다(engine.ts는 그대로 둔다). 방문자는 모르므로
  // registry가 이미 쓰는 hot-and-cold 비유로 바꾼다.
  const hint =
    'Tap a cell to probe — the number is how many steps away the hidden quarry is, like hot-and-cold. Each probe also spooks it one step away, so corner it and land a 0 before your probes run out.'

  if (!state) {
    return (
      <GameShell
        stats={[
          { label: 'Probes', value: 0, testId: 'probes' },
          { label: 'Level', value: 1, testId: 'level' },
          { label: 'Score', value: 0, testId: 'score', float: true },
          { label: 'Best', value: 0, testId: 'best' },
        ]}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="quarry-loading" />
      </GameShell>
    )
  }

  const size = state.size
  const readings = readingsFrom(state)
  const showCursor = keyboardActive && state.status === 'playing'
  const hopActive = hopKey > 0 && !reducedRef.current

  const headerExtra = (
    <>
      {streak > 0 && (
        <span
          data-testid="streak"
          className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm font-bold text-accent"
        >
          🔥 {streak}
        </span>
      )}
      <GameButton variant="ghost" onClick={toggleMode} data-testid="quarry-mode">
        {mode === 'daily' ? 'Daily' : 'Free'}
      </GameButton>
    </>
  )

  const wonScore = lastScore
  const quarry = state.quarry

  return (
    <GameShell
      stats={[
        { label: 'Probes', value: state.probesLeft, testId: 'probes' },
        { label: 'Level', value: state.level, testId: 'level' },
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best, testId: 'best' },
        ...(mode === 'daily' ? [{ label: 'Day Streak', value: dayStreak, testId: 'day-streak' }] : []),
      ]}
      headerExtra={headerExtra}
      onNewGame={restart}
      newGameLabel={mode === 'daily' ? 'Replay Daily' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{`
        @keyframes qr-hop {
          0% { transform: scale(1); }
          45% { transform: scale(0.86); }
          100% { transform: scale(1); }
        }
        @keyframes qr-reveal {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .qr-anim { animation: none !important; }
        }
      `}</style>
      <div
        className="anim-board-in relative grid aspect-square w-full gap-1.5 rounded-xl bg-surface p-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        data-testid="quarry-board"
        data-probes-left={state.probesLeft}
        aria-label="Quarry board"
      >
        <span className="sr-only" data-testid="probes-left">
          {state.probesLeft}
        </span>
        {Array.from({ length: size * size }, (_, i) => {
          const r = Math.floor(i / size)
          const c = i % size
          const key = `${r},${c}`
          const reading = readings.get(key)
          const probed = reading != null
          const isCursor = showCursor && cursor.row === r && cursor.col === c
          const lp = state.lastProbe
          const isLastProbed = lp != null && lp.at.row === r && lp.at.col === c
          const isFinal =
            state.status !== 'playing' && quarry.row === r && quarry.col === c

          return (
            <button
              key={key}
              data-testid="quarry-cell"
              data-row={r}
              data-col={c}
              {...(probed ? { 'data-probed': reading } : {})}
              {...(isCursor ? { 'data-cursor': 'true' } : {})}
              aria-current={isCursor ? 'true' : undefined}
              aria-label={`Cell row ${r + 1}, column ${c + 1}${
                probed ? `, last reading ${reading}` : ''
              }`}
              onClick={() => handleProbe(r, c)}
              className={`btn-press relative flex aspect-square items-center justify-center rounded-lg text-lg font-bold transition-[background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                probed
                  ? 'bg-white/[0.10] shadow-inner'
                  : 'bg-white/[0.045] shadow-inner hover:bg-white/[0.10]'
              } ${isCursor ? 'ring-2 ring-neon-cyan' : ''}`}
              style={
                hopActive && isLastProbed
                  ? { animation: 'qr-hop 220ms ease-out' }
                  : undefined
              }
            >
              {isFinal ? (
                <span
                  aria-hidden="true"
                  className="text-2xl"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(255,80,80,0.8))' }}
                >
                  ⛏️
                </span>
              ) : probed ? (
                <span
                  key={`${key}:${hopKey}:${reading}`}
                  className="qr-anim"
                  style={{
                    color: warmthColor(reading, size),
                    animation: reducedRef.current ? undefined : 'qr-reveal 180ms ease-out',
                    textShadow:
                      reading === 0
                        ? '0 0 10px rgba(255,60,60,0.9)'
                        : `0 0 6px ${warmthColor(reading, size)}55`,
                  }}
                >
                  {reading}
                </span>
              ) : null}
            </button>
          )
        })}

        <GameOverlay
          show={state.status === 'won'}
          variant="win"
          title={wonScore ? `Caught in ${wonScore.probesUsed}!` : 'Caught!'}
          testId="game-over"
        >
          {wonScore && (
            <>
              <p
                data-testid="stars"
                data-stars={wonScore.stars}
                className="text-2xl"
                aria-label={`${wonScore.stars} star${wonScore.stars === 1 ? '' : 's'}`}
              >
                {Array.from({ length: 3 }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    style={{ color: i < wonScore.stars ? '#fbbf24' : 'rgba(255,255,255,0.18)' }}
                  >
                    ★
                  </span>
                ))}
              </p>
              <p className="text-sm text-fg-muted">
                Par {wonScore.par} · <span className="font-bold text-accent">+{lastPoints}</span>
              </p>
            </>
          )}
          <GameButton onClick={handleNext} className="px-4 py-2">
            Next level
          </GameButton>
        </GameOverlay>

        <GameOverlay
          show={state.status === 'lost'}
          variant="lose"
          title="It slipped away"
          testId="you-lose"
        >
          <p className="text-sm text-fg-muted">
            It was hiding at row {quarry.row + 1}, column {quarry.col + 1}
          </p>
          <p className="text-sm text-fg-muted">
            Final score <span className="font-bold text-accent">{score}</span>
            {newBest && <span className="ml-1 font-bold text-neon-green">— New best!</span>}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
