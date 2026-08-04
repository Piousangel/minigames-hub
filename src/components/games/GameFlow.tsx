'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Cell,
  type FlowState,
  LEVELS,
  LEVEL_COUNT,
  clearAll,
  clearPath,
  connectedCount,
  createLevel,
  difficultyOf,
  endpointColorAt,
  eq,
  extendPath,
  filledCount,
  isConnected,
  ownerAt,
  startPath,
  totalCells,
} from '@/lib/games/flow/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { recordResult } from '@/lib/gameStats'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const U = 100 // SVG units per cell
const NEON = new Set(['cyan', 'magenta', 'lime', 'amber', 'purple', 'blue', 'red', 'green'])
const cssColor = (c: string) => (NEON.has(c) ? `var(--neon-${c})` : c)

const center = (cell: Cell): [number, number] => [cell[1] * U + U / 2, cell[0] * U + U / 2]

export function GameFlow({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<FlowState | null>(null)
  const [history, setHistory] = useState<FlowState[]>([])
  const [best, setBest] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const slug = storageKey.replace(/^best:/, '')
  const levelKey = `${slug}:level`

  const stateRef = useRef<FlowState | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const dragColorRef = useRef<string | null>(null)
  const lastCellRef = useRef<Cell | null>(null)
  const grabCellRef = useRef<Cell | null>(null)
  const startedRef = useRef(false)
  const strokeStartRef = useRef<FlowState | null>(null)
  const prevWonRef = useRef(false)

  const commit = useCallback((next: FlowState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persistWin = useCallback(
    (s: FlowState) => {
      const reached = s.levelIndex + 1
      try {
        const stored = Number(localStorage.getItem(storageKey))
        const prev = Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
        if (reached > prev) {
          localStorage.setItem(storageKey, String(reached)) // PLAIN NUMBER for leaderboard
          setBest(reached)
        }
      } catch {
        /* storage unavailable */
      }
      recordResult(slug, { won: true })
    },
    [storageKey, slug],
  )

  const loadLevel = useCallback(
    (idx: number) => {
      const norm = ((idx % LEVEL_COUNT) + LEVEL_COUNT) % LEVEL_COUNT
      prevWonRef.current = false
      dragColorRef.current = null
      lastCellRef.current = null
      grabCellRef.current = null
      startedRef.current = false
      strokeStartRef.current = null
      setHistory([])
      try {
        localStorage.setItem(levelKey, String(norm))
      } catch {
        /* ignore */
      }
      commit(createLevel(norm))
    },
    [commit, levelKey],
  )

  // Bootstrap (client only — no Date/random in render).
  useEffect(() => {
    let bestVal = 0
    let lvl = 0
    try {
      const b = Number(localStorage.getItem(storageKey))
      if (Number.isFinite(b) && b > 0) bestVal = Math.floor(b)
      const l = Number(localStorage.getItem(levelKey))
      if (Number.isFinite(l) && l >= 0 && l < LEVEL_COUNT) lvl = Math.floor(l)
    } catch {
      /* ignore */
    }
    setBest(bestVal)
    loadLevel(lvl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // -- pointer → cell mapping ------------------------------------------------

  const cellFromEvent = useCallback((clientX: number, clientY: number): Cell | null => {
    const el = boardRef.current
    const s = stateRef.current
    if (!el || !s) return null
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
    const c = Math.min(s.size - 1, Math.max(0, Math.floor((x / rect.width) * s.size)))
    const r = Math.min(s.size - 1, Math.max(0, Math.floor((y / rect.height) * s.size)))
    return [r, c]
  }, [])

  // -- drag lifecycle --------------------------------------------------------

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = stateRef.current
      if (!s || s.status === 'won') return
      const cell = cellFromEvent(e.clientX, e.clientY)
      if (!cell) return
      const color = endpointColorAt(s, cell) ?? ownerAt(s, cell)
      if (!color) return // pressed a blank cell — nothing to grab
      e.preventDefault()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* older browsers */
      }
      // Defer startPath until the finger actually MOVES to a new cell — a plain
      // tap must never chop or reset a pipe (only a drag redraws).
      strokeStartRef.current = s
      dragColorRef.current = color
      grabCellRef.current = cell
      lastCellRef.current = cell
      startedRef.current = false
    },
    [cellFromEvent],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const color = dragColorRef.current
      if (!color) return
      const target = cellFromEvent(e.clientX, e.clientY)
      if (!target) return
      if (lastCellRef.current && eq(lastCellRef.current, target)) return
      lastCellRef.current = target
      e.preventDefault()

      let s = stateRef.current as FlowState
      const before = s
      const wasConnected = isConnected(before, color)
      let moved = false
      let guard = 0
      const budget = s.size * s.size + 2

      // First real movement: NOW grab the pipe (start at an endpoint, or truncate
      // our own pipe to the grabbed cell) so it follows the finger.
      if (!startedRef.current) {
        startedRef.current = true
        const grab = grabCellRef.current
        if (grab) {
          const started = startPath(s, color, grab)
          if (started !== s) {
            s = started
            moved = true
          }
        }
      }

      // RETRACT: if the finger is on a cell already in our own pipe, snap the
      // head back to it (drop everything after). Robust even for curved pipes
      // and fast backward drags — the classic Flow behaviour.
      {
        const path = s.paths[color]
        if (path && path.length > 1) {
          const idx = path.findIndex((c) => eq(c, target))
          if (idx >= 0 && idx < path.length - 1) {
            const retracted = startPath(s, color, target)
            if (retracted !== s) {
              commit(retracted)
              play('move')
              return
            }
          }
        }
      }

      // Walk the head toward the finger one orthogonal step at a time so a fast
      // drag that skips cells still lays a continuous pipe (forgiving feel).
      for (;;) {
        const path = s.paths[color]
        if (!path || path.length === 0) break
        const head = path[path.length - 1]
        if (eq(head, target)) break
        if (guard++ > budget) break
        const dr = Math.sign(target[0] - head[0])
        const dc = Math.sign(target[1] - head[1])
        const cands: Cell[] = []
        // Prefer the longer remaining axis first, then try the other (L-routes).
        if (Math.abs(target[0] - head[0]) >= Math.abs(target[1] - head[1])) {
          if (dr !== 0) cands.push([head[0] + dr, head[1]])
          if (dc !== 0) cands.push([head[0], head[1] + dc])
        } else {
          if (dc !== 0) cands.push([head[0], head[1] + dc])
          if (dr !== 0) cands.push([head[0] + dr, head[1]])
        }
        let stepped = false
        for (const cand of cands) {
          const next = extendPath(s, color, cand)
          if (next !== s) {
            s = next
            moved = true
            stepped = true
            break
          }
        }
        if (!stepped) break
      }

      if (!moved) {
        // A genuine blocked attempt onto an adjacent cell → gentle error tick.
        const head = before.paths[color]?.[before.paths[color].length - 1]
        if (head && Math.abs(head[0] - target[0]) + Math.abs(head[1] - target[1]) === 1) {
          play('error')
        }
        return
      }

      commit(s)
      if (s.status === 'won' && !prevWonRef.current) {
        prevWonRef.current = true
        play('win')
        persistWin(s)
      } else if (!wasConnected && isConnected(s, color)) {
        play('match')
      } else {
        play('move')
      }
    },
    [cellFromEvent, commit, play, persistWin],
  )

  const endStroke = useCallback(() => {
    const color = dragColorRef.current
    dragColorRef.current = null
    lastCellRef.current = null
    if (!color) return
    const start = strokeStartRef.current
    const cur = stateRef.current
    strokeStartRef.current = null
    if (start && cur && cur !== start) {
      setHistory((h) => [...h, start])
    }
  }, [])

  // -- controls --------------------------------------------------------------

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      prevWonRef.current = prev.status === 'won'
      commit(prev)
      play('flip')
      return h.slice(0, -1)
    })
  }, [commit, play])

  const restart = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const next = clearAll(s)
    if (next === s) return
    setHistory((h) => [...h, s])
    prevWonRef.current = false
    commit(next)
    play('flip')
  }, [commit, play])

  const eraseColor = useCallback(
    (color: string) => {
      const s = stateRef.current
      if (!s || s.status === 'won') return
      const next = clearPath(s, color)
      if (next === s) return
      setHistory((h) => [...h, s])
      commit(next)
      play('flip')
    },
    [commit, play],
  )

  const goLevel = useCallback((delta: number) => {
    const s = stateRef.current
    if (!s) return
    loadLevel(s.levelIndex + delta)
  }, [loadLevel])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case 'u':
        case 'U':
          e.preventDefault()
          undo()
          break
        case 'r':
        case 'R':
          e.preventDefault()
          restart()
          break
        case 'n':
        case 'N':
        case 'ArrowRight':
          e.preventDefault()
          goLevel(1)
          break
        case 'ArrowLeft':
          e.preventDefault()
          goLevel(-1)
          break
      }
    },
    [undo, restart, goLevel],
  )

  // -- render ----------------------------------------------------------------

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-[26rem] select-none">
        <div className="aspect-square rounded-xl bg-surface" data-testid="flow-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const { size } = state
  const W = size * U
  const won = state.status === 'won'
  const connected = connectedCount(state)
  const totalPairs = state.pairs.length
  const filled = filledCount(state)
  const total = totalCells(state)
  const coverage = Math.round((filled / total) * 100)
  const level = LEVELS[state.levelIndex]

  const hint = won
    ? 'Solved! Every dot linked and every square filled.'
    : 'Drag from a coloured dot to its twin. Fill every square — pipes can’t cross.'

  const headerExtra = (
    <>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Pairs</span>{' '}
        <span className="font-bold text-accent" data-testid="pairs">
          {connected}/{totalPairs}
        </span>
      </span>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Filled</span>{' '}
        <span className="font-bold text-accent" data-testid="coverage">
          {coverage}%
        </span>
      </span>
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Level', value: state.levelIndex + 1, testId: 'level' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={restart}
      newGameLabel="Restart"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-[26rem]"
    >
      <div
        role="group"
        aria-label={`Flow level ${state.levelIndex + 1}, ${size} by ${size}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative mx-auto rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div
          ref={boardRef}
          data-testid="flow-board"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-bg-2"
          style={{
            touchAction: 'none',
            transition: reduced ? undefined : 'transform .2s ease',
            transform: won && !reduced ? 'scale(1.01)' : undefined,
          }}
        >
          {/* Cell tint + grid lines */}
          <div
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
            aria-hidden="true"
          >
            {Array.from({ length: size * size }, (_, i) => {
              const r = Math.floor(i / size)
              const c = i % size
              const o = ownerAt(state, [r, c])
              return (
                <div
                  key={i}
                  style={{
                    borderRight: c < size - 1 ? '1px solid rgba(140,140,200,0.14)' : undefined,
                    borderBottom: r < size - 1 ? '1px solid rgba(140,140,200,0.14)' : undefined,
                    background: o
                      ? `color-mix(in srgb, ${cssColor(o)} 15%, transparent)`
                      : undefined,
                    transition: reduced ? undefined : 'background .12s ease',
                  }}
                />
              )
            })}
          </div>

          {/* Pipes + endpoint dots */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${W} ${W}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {state.pairs.map((p) => {
              const path = state.paths[p.color]
              const color = cssColor(p.color)
              const pts = (path ?? []).map(center)
              const done = isConnected(state, p.color)
              const head = path && path.length > 0 ? path[path.length - 1] : null
              const showHead =
                head &&
                path.length > 1 &&
                endpointColorAt(state, head) !== p.color // not sitting on an endpoint
              return (
                <g key={p.color} style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
                  {pts.length >= 2 && (
                    <polyline
                      points={pts.map((pt) => `${pt[0]},${pt[1]}`).join(' ')}
                      fill="none"
                      stroke={color}
                      strokeWidth={U * 0.36}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.95}
                    />
                  )}
                  {/* the two endpoint dots — always visible so the puzzle reads instantly */}
                  {[p.a, p.b].map((ep, i) => {
                    const [x, y] = center(ep)
                    return (
                      <g key={i}>
                        {done && (
                          <circle
                            cx={x}
                            cy={y}
                            r={U * 0.42}
                            fill="none"
                            stroke={color}
                            strokeWidth={U * 0.06}
                            opacity={0.5}
                          />
                        )}
                        <circle cx={x} cy={y} r={U * 0.3} fill={color} />
                        <circle cx={x} cy={y} r={U * 0.13} fill="rgba(255,255,255,0.55)" />
                      </g>
                    )
                  })}
                  {showHead && head && (
                    <circle
                      cx={center(head)[0]}
                      cy={center(head)[1]}
                      r={U * 0.17}
                      fill={color}
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth={U * 0.03}
                    />
                  )}
                </g>
              )
            })}
          </svg>

          <GameOverlay show={won} variant="win" title="Level solved!" testId="game-over">
            <div className="flex flex-col items-center gap-1 text-sm">
              <p>
                Level <span className="font-bold text-accent">{state.levelIndex + 1}</span> ·{' '}
                {difficultyOf(level)}
              </p>
              <p>
                All <span className="font-bold text-accent">{totalPairs}</span> pipes linked ·{' '}
                <span className="font-bold text-accent">100%</span> filled
              </p>
            </div>
            <GameButton onClick={() => goLevel(1)}>Next level ▶</GameButton>
          </GameOverlay>
        </div>

        {/* Colour erasers — a quick tap-to-clear per pipe (also nice on touch). */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {state.pairs.map((p) => {
            const active = (state.paths[p.color] ?? []).length > 0
            return (
              <button
                key={p.color}
                type="button"
                onClick={() => eraseColor(p.color)}
                disabled={!active || won}
                aria-label={`Clear ${p.color} pipe`}
                data-testid="flow-eraser"
                className="h-5 w-5 rounded-full border border-border transition disabled:opacity-30"
                style={{
                  background: `color-mix(in srgb, ${cssColor(p.color)} ${active ? 85 : 25}%, transparent)`,
                  boxShadow: active ? `0 0 6px ${cssColor(p.color)}` : undefined,
                }}
                title={`Clear ${p.color}`}
              />
            )
          })}
        </div>
      </div>

      {/* Level controls */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <GameButton variant="ghost" onClick={() => goLevel(-1)} aria-label="Previous level">
          ◀ Prev
        </GameButton>
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Level <span className="font-bold text-accent">{state.levelIndex + 1}</span>
          <span className="text-fg-muted">/{LEVEL_COUNT}</span>{' '}
          <span className="text-fg-muted">· {difficultyOf(level)}</span>
        </span>
        <GameButton variant="ghost" onClick={() => goLevel(1)} aria-label="Next level">
          Next ▶
        </GameButton>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <GameButton variant="ghost" onClick={undo} disabled={history.length === 0}>
          Undo
        </GameButton>
        <GameButton variant="ghost" onClick={restart}>
          Clear
        </GameButton>
      </div>
    </GameShell>
  )
}
