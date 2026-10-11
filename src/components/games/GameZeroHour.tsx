'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CELLS,
  GRID,
  MAX_STRIKES,
  URGENT_AT,
  emptyCells,
  harvest,
  newGame,
  spawnTile,
  tick,
  TICKS_PER_LEVEL,
  type Tile,
  type ZeroHourState,
} from '@/lib/games/zerohour/engine'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const STEP_MS = 100 // master loop granularity
const TICK_INTERVAL_MS = 850 // fixed tick cadence (do NOT escalate the tick rate)
const INITIAL_TILES = 6
const MAX_CATCHUP = 4 // guard against spiral-of-death per step

function spawnIntervalMs(tickCount: number) {
  const level = Math.floor(tickCount / TICKS_PER_LEVEL)
  return Math.max(450, 1500 - level * 200) // 1500ms -> 450ms floor
}

interface BestBlob {
  score: number
  chain: number
}

/**
 * 통계 blob 전용 키. best:<slug>에는 숫자(score)만 넣는다 — 주간 리더보드가 그 키를
 * Number()로 읽으므로(모든 게임 공통 규약) JSON을 넣으면 NaN이 되어 제출이 영구히 막힌다.
 */
function statsKey(storageKey: string): string {
  return `${storageKey}:stats`
}

function toBlob(raw: string): BestBlob | null {
  const parsed = JSON.parse(raw) as unknown
  if (typeof parsed === 'number') {
    return { score: Number.isFinite(parsed) ? parsed : 0, chain: 0 }
  }
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  const score = typeof o.score === 'number' && Number.isFinite(o.score) ? o.score : 0
  const chain = typeof o.chain === 'number' && Number.isFinite(o.chain) ? o.chain : 0
  return { score, chain }
}

function saveBest(storageKey: string, blob: BestBlob): void {
  try {
    localStorage.setItem(storageKey, String(blob.score))
    localStorage.setItem(statsKey(storageKey), JSON.stringify(blob))
  } catch {
    // ignore storage failures
  }
}

function loadBest(storageKey: string): BestBlob {
  try {
    const stats = localStorage.getItem(statsKey(storageKey))
    if (stats) {
      const blob = toBlob(stats)
      if (blob) return blob
    }
    // 레거시: best:<slug>에 blob을 통째로 넣던 시절의 데이터를 옮겨 온다.
    const legacy = localStorage.getItem(storageKey)
    if (legacy) {
      const blob = toBlob(legacy)
      if (blob) {
        saveBest(storageKey, blob)
        return blob
      }
    }
  } catch {
    // legacy / corrupt value -> reset
  }
  return { score: 0, chain: 0 }
}

interface CellFloat {
  seq: number
  index: number
  gained: number
}

/** A one-shot crack effect on the cell a tile detonated in (now empty). */
interface CellCrack {
  seq: number
  index: number
}

const CRACK_MS = 350 // slightly longer than the zh-crack keyframes (.3s)

function seedBoard(): ZeroHourState {
  let s = newGame()
  for (let i = 0; i < INITIAL_TILES; i++) s = spawnTile(s, Math.random)
  return s
}

function fuseBand(value: number): 'safe' | 'warn' | 'danger' {
  return value >= 6 ? 'safe' : value >= 4 ? 'warn' : 'danger'
}

export function GameZeroHour({ storageKey }: { storageKey: string }) {
  // SSR safety: state is created only on the client (WhackAMole pattern).
  const [state, setState] = useState<ZeroHourState | null>(null)
  const [running, setRunning] = useState(false)
  const [best, setBest] = useState<BestBlob>({ score: 0, chain: 0 })
  const [newBest, setNewBest] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [floats, setFloats] = useState<CellFloat[]>([])
  const [cracks, setCracks] = useState<CellCrack[]>([])
  // Tab hidden mid-run → paused (NOT ended). Resume continues the same run.
  const [paused, setPaused] = useState(false)
  const runningRef = useRef(false)
  runningRef.current = running

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  // Deadline refs read by the loop without re-subscribing.
  const nextTickAt = useRef(0)
  const nextSpawnAt = useRef(0)
  const floatSeq = useRef(0)
  const crackSeq = useRef(0)
  // Time left on each clock when paused, so resuming doesn't skip or bunch ticks.
  const pausedLeft = useRef<{ tick: number; spawn: number } | null>(null)
  const prevOver = useRef(false)
  const gridRef = useRef<HTMLDivElement | null>(null)

  const over = state?.over ?? false
  const score = state?.score ?? 0

  const pushFloat = useCallback((index: number, gained: number) => {
    const seq = ++floatSeq.current
    setFloats((f) => [...f, { seq, index, gained }])
  }, [])

  // Crack events are transient: each removes itself after the animation, so a
  // tile later spawned in that cell never replays it.
  const pushCrack = useCallback((index: number) => {
    const seq = ++crackSeq.current
    setCracks((c) => [...c, { seq, index }])
    window.setTimeout(() => setCracks((c) => c.filter((x) => x.seq !== seq)), CRACK_MS)
  }, [])

  const restart = useCallback(() => {
    setState(seedBoard())
    setRunning(false)
    setPaused(false)
    pausedLeft.current = null
    setNewBest(false)
    setFloats([])
    setCracks([])
    setCursor(0)
    prevOver.current = false
  }, [])

  // Init + load best (client only).
  useEffect(() => {
    restart()
    setBest(loadBest(storageKey))
  }, [restart, storageKey])

  const start = useCallback(() => {
    const fresh = seedBoard()
    setState(fresh)
    setNewBest(false)
    setFloats([])
    setCracks([])
    setPaused(false)
    pausedLeft.current = null
    setCursor(emptyCells(fresh).length < CELLS ? fresh.cells.findIndex((c) => c !== null) : 0)
    prevOver.current = false
    const now = performance.now()
    nextTickAt.current = now + TICK_INTERVAL_MS
    nextSpawnAt.current = now + spawnIntervalMs(0)
    setRunning(true)
  }, [])

  const onNewGame = useCallback(() => {
    start()
  }, [start])

  const resume = useCallback(() => {
    const left = pausedLeft.current
    const now = performance.now()
    nextTickAt.current = now + (left?.tick ?? TICK_INTERVAL_MS)
    nextSpawnAt.current = now + (left?.spawn ?? 0)
    pausedLeft.current = null
    setPaused(false)
    setRunning(true)
  }, [])

  // Master loop: single deadline-driven interval (RAF-free, testable).
  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => {
      const now = performance.now()
      setState((s) => {
        if (!s || s.over) return s
        let next = s
        let iterations = 0
        // Apply due ticks (capped catch-up).
        while (now >= nextTickAt.current && iterations < MAX_CATCHUP) {
          const res = tick(next)
          next = res.state
          const ev = res.event
          if (ev.cracked.length > 0) {
            play('error')
            for (const idx of ev.cracked) pushCrack(idx)
          }
          if (ev.chainEnded && ev.cracked.length === 0) play('mismatch')
          nextTickAt.current += TICK_INTERVAL_MS
          iterations++
          if (next.over) break
        }
        // Spawn clock (only when there's room).
        if (!next.over && now >= nextSpawnAt.current && emptyCells(next).length > 0) {
          next = spawnTile(next, Math.random)
          nextSpawnAt.current = now + spawnIntervalMs(next.tick)
        }
        return next
      })
    }, STEP_MS)
    return () => clearInterval(id)
  }, [running, over, play, pushCrack])

  // Pause when tab is hidden so fuses don't burn in the background. The run is
  // kept; a Resume overlay continues it (Start would deal a fresh board).
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden || !runningRef.current) return
      const now = performance.now()
      pausedLeft.current = {
        tick: Math.max(0, nextTickAt.current - now),
        spawn: Math.max(0, nextSpawnAt.current - now),
      }
      setRunning(false)
      setPaused(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Game-over effect: persist + sound.
  useEffect(() => {
    if (!state) return
    if (state.over && !prevOver.current) {
      setRunning(false)
      const beatScore = state.score > best.score
      const beatChain = state.longestChain > best.chain
      const nextBest: BestBlob = {
        score: Math.max(best.score, state.score),
        chain: Math.max(best.chain, state.longestChain),
      }
      if (beatScore || beatChain) {
        setBest(nextBest)
        saveBest(storageKey, nextBest)
      }
      setNewBest(beatScore)
      play(beatScore ? 'win' : 'lose')
      recordFinish(storageKey.replace(/^best:/, ''))
    }
    prevOver.current = state.over
  }, [state, best, storageKey, play])

  const onHarvest = useCallback(
    (index: number) => {
      if (!running) return
      setState((s) => {
        if (!s || s.over) return s
        const res = harvest(s, index, Math.random)
        const ev = res.event
        if (ev.type === 'none') return s
        if (ev.type === 'chain') play('merge')
        else play('eat')
        if (ev.brokeChain && ev.type !== 'chain') play('mismatch')
        pushFloat(index, ev.gained)
        return res.state
      })
      setCursor(index)
    },
    [running, play, pushFloat],
  )

  // Roving-tabindex arrow navigation, skipping to nearest occupied cell.
  const moveCursor = useCallback(
    (delta: number) => {
      setCursor((cur) => {
        const s = state
        if (!s) return cur
        const col = cur % GRID
        let target = cur
        if (delta === -1 && col === 0) return cur
        if (delta === 1 && col === GRID - 1) return cur
        target = cur + delta
        if (target < 0 || target >= CELLS) return cur
        // Prefer landing on an occupied cell; otherwise land on the raw target.
        if (s.cells[target] !== null) return target
        // Scan onward in the same direction for an occupied cell within bounds.
        let probe = target
        const step = delta
        while (probe >= 0 && probe < CELLS) {
          // Respect row edges for horizontal movement.
          if (Math.abs(step) === 1 && probe % GRID === (step === 1 ? 0 : GRID - 1) && probe !== target) break
          if (s.cells[probe] !== null) return probe
          probe += step
        }
        return target
      })
    },
    [state],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          moveCursor(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          moveCursor(1)
          break
        case 'ArrowUp':
          e.preventDefault()
          moveCursor(-GRID)
          break
        case 'ArrowDown':
          e.preventDefault()
          moveCursor(GRID)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          onHarvest(cursor)
          break
      }
    },
    [moveCursor, onHarvest, cursor],
  )

  const strikes = state?.strikes ?? 0
  const multiplier = state?.multiplier ?? 1
  const combo = state?.combo ?? 0
  const longestChain = state?.longestChain ?? 0

  const newGameLabel = running || paused ? 'Restart' : over ? 'Play again' : 'Start'
  const hint = paused
    ? 'Paused — press Resume to continue this run.'
    : running
    ? 'Harvest high-value tiles for points — but every number is also its fuse. Chain descending values for a multiplier.'
    : over
      ? 'Three strikes — press Play again.'
      : 'Press Start. Tap a tile to bank its number before it hits zero.'

  const stats = [
    { label: 'Score', value: score, testId: 'score', float: true },
    { label: 'Best', value: best.score },
  ]

  const board = (
    <div
      className="relative rounded-xl bg-surface p-4"
      style={reduced ? undefined : { animation: 'zh-board-in .3s ease-out both' }}
    >
      {/* Strikes + combo header row (component-owned, inside the board). */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5" aria-label={`${strikes} of ${MAX_STRIKES} strikes`}>
          {Array.from({ length: MAX_STRIKES }, (_, i) => {
            const lit = i < strikes
            return (
              <span
                key={i}
                data-testid="zh-strike"
                aria-hidden="true"
                className="text-lg leading-none"
                style={{ opacity: lit ? 1 : 0.28, filter: lit ? 'none' : 'grayscale(1)' }}
              >
                {lit ? '💥' : '○'}
              </span>
            )
          })}
        </div>
        {combo >= 2 && (
          <span
            data-testid="zh-combo"
            key={reduced ? undefined : `combo-${combo}`}
            className="rounded-full border border-accent/60 bg-accent/15 px-2.5 py-0.5 text-sm font-bold text-accent"
            style={reduced ? undefined : { animation: 'zh-combo-pop .28s ease-out both' }}
          >
            ×{multiplier}
          </span>
        )}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Zero Hour board"
        onKeyDown={onKeyDown}
        className="grid touch-none gap-2"
        style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
        data-testid="zero-hour-board"
      >
        {Array.from({ length: CELLS }, (_, i) => {
          const tileCell = state?.cells[i] ?? null
          const cellFloats = floats.filter((f) => f.index === i)
          if (!tileCell) {
            return (
              <div
                key={`empty-${i}`}
                aria-hidden="true"
                className="relative aspect-square rounded-lg border border-white/5 bg-black/20"
              >
                {!reduced &&
                  cracks
                    .filter((k) => k.index === i)
                    .map((k) => (
                      <span
                        key={`crack-${k.seq}`}
                        data-testid="zh-crack"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-lg"
                        style={{ animation: 'zh-crack .3s ease-out both' }}
                      />
                    ))}
                {!reduced &&
                  cellFloats.map((f) => (
                    <span
                      key={f.seq}
                      aria-hidden="true"
                      onAnimationEnd={() => setFloats((cur) => cur.filter((x) => x.seq !== f.seq))}
                      className="zh-float pointer-events-none absolute inset-x-0 top-1 text-center text-sm font-bold text-accent"
                    >
                      +{f.gained}
                    </span>
                  ))}
              </div>
            )
          }
          const tile: Tile = tileCell
          const band = fuseBand(tile.value)
          const danger = tile.value <= URGENT_AT
          const isCursor = i === cursor
          const label = danger
            ? `Tile value ${tile.value}, about to detonate, harvest`
            : `Tile value ${tile.value}, harvest`
          return (
            <button
              key={tile.id}
              type="button"
              data-testid="zh-tile"
              data-fuse={band}
              role="gridcell"
              tabIndex={isCursor ? 0 : -1}
              aria-label={label}
              onPointerDown={(e) => {
                e.preventDefault()
                onHarvest(i)
              }}
              onFocus={() => setCursor(i)}
              className="zh-tile relative flex aspect-square items-center justify-center rounded-lg text-[clamp(1.1rem,6vw,1.9rem)] font-extrabold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              style={reduced ? undefined : { animation: 'zh-spawn .22s ease-out both' }}
            >
              <span className="relative z-[1]">{tile.value}</span>
              {!reduced && danger && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-lg"
                  style={{ animation: 'zh-pulse 0.85s ease-in-out infinite' }}
                />
              )}
              {!reduced &&
                cellFloats.map((f) => (
                  <span
                    key={f.seq}
                    aria-hidden="true"
                    onAnimationEnd={() => setFloats((cur) => cur.filter((x) => x.seq !== f.seq))}
                    className="zh-float pointer-events-none absolute inset-x-0 top-0 z-[2] text-center text-sm font-bold text-accent"
                  >
                    +{f.gained}
                  </span>
                ))}
            </button>
          )
        })}
      </div>

      {paused && !over && (
        <div
          data-testid="zh-paused"
          role="dialog"
          aria-label="Paused"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80"
        >
          <p className="text-2xl font-extrabold text-fg">Paused</p>
          <p className="text-sm text-fg-muted">Score {score} · fuses are frozen</p>
          <GameButton onClick={resume} className="px-5 py-2" autoFocus>
            Resume
          </GameButton>
        </div>
      )}

      <GameOverlay
        show={over}
        variant={newBest ? 'win' : 'lose'}
        title={newBest ? 'New best!' : 'Three strikes!'}
        testId="game-over"
      >
        <div className="flex flex-col items-center gap-1 text-sm">
          <p>
            Score <span className="font-bold text-accent">{score}</span>
          </p>
          <p>
            Longest chain <span className="font-bold text-accent">{longestChain}</span>
          </p>
          <p>
            Best <span className="font-bold text-accent">{best.score}</span>
          </p>
        </div>
        <GameButton onClick={onNewGame}>Play again</GameButton>
      </GameOverlay>

      <style>{`
        @keyframes zh-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
        @keyframes zh-spawn { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none } }
        @keyframes zh-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); }
          50% { box-shadow: 0 0 14px 2px rgba(248,113,113,.55); }
        }
        @keyframes zh-crack {
          0% { background: rgba(248,113,113,.55); transform: translateX(0) }
          25% { transform: translateX(-3px) }
          50% { transform: translateX(3px) }
          75% { transform: translateX(-2px) }
          100% { background: rgba(248,113,113,0); transform: translateX(0) }
        }
        @keyframes zh-float {
          from { opacity: 1; transform: translateY(0) }
          to { opacity: 0; transform: translateY(-18px) }
        }
        @keyframes zh-combo-pop {
          0% { transform: scale(.7); opacity: .4 }
          60% { transform: scale(1.15) }
          100% { transform: scale(1); opacity: 1 }
        }
        .zh-float { animation: zh-float .7s ease-out both; }
        .zh-tile { background: #3f3f46; color: #fafafa; }
        .zh-tile[data-fuse='safe'] { background: linear-gradient(160deg,#166534,#14532d); color:#dcfce7; box-shadow: inset 0 0 12px rgba(34,197,94,.25); }
        .zh-tile[data-fuse='warn'] { background: linear-gradient(160deg,#a16207,#854d0e); color:#fef9c3; box-shadow: inset 0 0 12px rgba(234,179,8,.3); }
        .zh-tile[data-fuse='danger'] { background: linear-gradient(160deg,#b91c1c,#7f1d1d); color:#fee2e2; box-shadow: inset 0 0 12px rgba(239,68,68,.4); }
      `}</style>
    </div>
  )

  return (
    <GameShell
      stats={stats}
      onNewGame={onNewGame}
      newGameLabel={newGameLabel}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      {board}
    </GameShell>
  )
}
