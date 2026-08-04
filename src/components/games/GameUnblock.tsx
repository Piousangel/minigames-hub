'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GRID,
  EXIT_ROW,
  LEVELS,
  LEVEL_PAR,
  type Block,
  type State,
  fromLevel,
  isSolved,
  maxSlide,
  slide,
} from '@/lib/games/unblock/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { recordResult } from '@/lib/gameStats'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// -- presentation ------------------------------------------------------------

/** Neon palette for the ordinary blocks (the target is always red). */
const BLOCK_NEON = [
  '#22d3ee', // cyan
  '#a3e635', // lime
  '#b06bff', // purple
  '#4d7cff', // blue
  '#ff3d9a', // magenta
  '#fbbf24', // amber
  '#34e39b', // green
]
const TARGET_NEON = '#ff4d6d' // --neon-red

function colorFor(b: Block): string {
  if (b.target) return TARGET_NEON
  let h = 0
  for (let i = 0; i < b.id.length; i++) h = (h * 31 + b.id.charCodeAt(i)) >>> 0
  return BLOCK_NEON[h % BLOCK_NEON.length]
}

const pct = (n: number) => `${(n / GRID) * 100}%`

// Progress persisted alongside the leaderboard number.
interface Progress {
  best: Record<number, number> // level index → fewest moves
  cur: number // last level opened
}

function loadProgress(slug: string): Progress {
  try {
    const raw = localStorage.getItem(`${slug}:progress`)
    if (raw) {
      const o = JSON.parse(raw) as Partial<Progress>
      if (o && typeof o === 'object') {
        return {
          best: o.best && typeof o.best === 'object' ? (o.best as Record<number, number>) : {},
          cur: typeof o.cur === 'number' ? o.cur : 0,
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { best: {}, cur: 0 }
}

// Drag bookkeeping (component-local; never in the pure engine).
interface Drag {
  id: string
  axis: 'h' | 'v'
  startX: number
  startY: number
  cellPx: number
  minPx: number // most-negative legal pixel offset (left/up)
  maxPx: number // most-positive legal pixel offset (right/down)
  offPx: number // current clamped pixel offset along the axis
  moved: boolean // crossed the tap→drag threshold
}

const TAP_SLOP = 6 // px of movement below which a press counts as a tap

export function GameUnblock({ storageKey }: { storageKey: string }) {
  const slug = storageKey.replace(/^best:/, '')

  // SSR-safe: build the level on the client only.
  const [state, setState] = useState<State | null>(null)
  const [history, setHistory] = useState<State[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [best, setBest] = useState<Record<number, number>>({})
  const [solvedCount, setSolvedCount] = useState(0)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [escaping, setEscaping] = useState(false)
  const [overlayShown, setOverlayShown] = useState(false)
  // A just-dropped block is already under the finger — commit WITHOUT a slide
  // animation (tap/keyboard moves, by contrast, animate for juice).
  const [justDragged, setJustDragged] = useState<string | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const bestRef = useRef<Record<number, number>>({})
  const wonRef = useRef(false)
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t)
    timers.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const commit = useCallback((next: State) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persist = useCallback(
    (nextBest: Record<number, number>, cur: number) => {
      try {
        localStorage.setItem(`${slug}:progress`, JSON.stringify({ best: nextBest, cur }))
        // best:<slug> = distinct levels solved (a plain, monotone leaderboard number).
        localStorage.setItem(storageKey, String(Object.keys(nextBest).length))
      } catch {
        /* storage unavailable */
      }
    },
    [slug, storageKey],
  )

  const openLevel = useCallback(
    (index: number) => {
      const idx = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length
      clearTimers()
      wonRef.current = false
      setEscaping(false)
      setOverlayShown(false)
      setHistory([])
      setSel(null)
      setDrag(null)
      commit(fromLevel(idx))
      persist(bestRef.current, idx)
    },
    [clearTimers, commit, persist],
  )

  // Bootstrap.
  useEffect(() => {
    const p = loadProgress(slug)
    bestRef.current = p.best
    setBest(p.best)
    setSolvedCount(Object.keys(p.best).length)
    wonRef.current = false
    setEscaping(false)
    setOverlayShown(false)
    setHistory([])
    setSel(null)
    commit(fromLevel(p.cur))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const handleWin = useCallback(
    (next: State) => {
      wonRef.current = true
      const prevBest = bestRef.current[next.levelIndex]
      const nextBest = { ...bestRef.current }
      if (prevBest == null || next.moves < prevBest) nextBest[next.levelIndex] = next.moves
      bestRef.current = nextBest
      setBest(nextBest)
      setSolvedCount(Object.keys(nextBest).length)
      persist(nextBest, next.levelIndex)
      recordResult(slug, { won: true })
      // Satisfying escape: let the target slide out the right, THEN reveal the
      // win overlay (whose backdrop would otherwise hide the escape).
      if (reducedRef.current) {
        play('win')
        setOverlayShown(true)
      } else {
        setEscaping(true)
        timers.current.push(window.setTimeout(() => play('win'), 110))
        timers.current.push(window.setTimeout(() => setOverlayShown(true), 470))
      }
    },
    [persist, play, reducedRef, slug],
  )

  /** Apply a slide by `delta` cells to `id`. Returns whether it moved. */
  const applySlide = useCallback(
    (id: string, delta: number): boolean => {
      const cur = stateRef.current
      if (!cur || cur.status !== 'playing') return false
      const next = slide(cur, id, delta)
      if (next === cur) return false // illegal / no-op
      setHistory((h) => [...h, cur])
      commit(next)
      if (isSolved(next)) handleWin(next)
      else play('move')
      return true
    },
    [commit, handleWin, play],
  )

  const undo = useCallback(() => {
    if (wonRef.current) return
    setHistory((h) => {
      if (h.length === 0) return h
      commit(h[h.length - 1])
      setSel(null)
      play('flip')
      return h.slice(0, -1)
    })
  }, [commit, play])

  const resetLevel = useCallback(() => {
    const cur = stateRef.current
    if (cur) openLevel(cur.levelIndex)
  }, [openLevel])

  const nextLevel = useCallback(() => {
    const cur = stateRef.current
    openLevel((cur?.levelIndex ?? 0) + 1)
  }, [openLevel])

  // -- pointer drag (axis-locked, clamps to the legal range) -----------------

  const onBlockPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, b: Block) => {
      const cur = stateRef.current
      const board = boardRef.current
      if (!cur || cur.status !== 'playing' || !board) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const cellPx = board.getBoundingClientRect().width / GRID
      const maxPos = maxSlide(cur, b.id, 1)
      const maxNeg = maxSlide(cur, b.id, -1)
      setSel(b.id)
      setDrag({
        id: b.id,
        axis: b.dir,
        startX: e.clientX,
        startY: e.clientY,
        cellPx,
        minPx: -maxNeg * cellPx,
        maxPx: maxPos * cellPx,
        offPx: 0,
        moved: false,
      })
    },
    [],
  )

  const onBlockPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setDrag((d) => {
      if (!d) return d
      const raw = d.axis === 'h' ? e.clientX - d.startX : e.clientY - d.startY
      const offPx = Math.max(d.minPx, Math.min(d.maxPx, raw))
      const moved = d.moved || Math.abs(raw) > TAP_SLOP
      return { ...d, offPx, moved }
    })
  }, [])

  const endDrag = useCallback(() => {
    setDrag((d) => {
      if (!d) return null
      if (d.moved) {
        const cells = Math.round(d.offPx / d.cellPx)
        if (cells !== 0) {
          setJustDragged(d.id) // suppress the slide tween for the dropped block
          timers.current.push(window.setTimeout(() => setJustDragged(null), 40))
          applySlide(d.id, cells)
        } else {
          play('flip') // dragged but couldn't advance — a soft wall/neighbour bump
        }
      }
      // A tap (not moved) leaves the block selected for tap-to-destination.
      return null
    })
  }, [applySlide, play])

  // -- tap a destination cell (fallback for the selected block) --------------

  const onCellTap = useCallback(
    (r: number, c: number) => {
      const cur = stateRef.current
      if (!cur || cur.status !== 'playing' || !sel) return
      const b = cur.blocks.find((x) => x.id === sel)
      if (!b) return
      let delta = 0
      if (b.dir === 'h' && r === b.row) {
        delta = c < b.col ? c - b.col : c >= b.col + b.len ? c - (b.col + b.len - 1) : 0
      } else if (b.dir === 'v' && c === b.col) {
        delta = r < b.row ? r - b.row : r >= b.row + b.len ? r - (b.row + b.len - 1) : 0
      } else {
        setSel(null) // tapped off the block's track — just put it down, quietly
        return
      }
      if (delta === 0) {
        setSel(null)
        return
      }
      const sign: 1 | -1 = delta > 0 ? 1 : -1
      const clamped = Math.max(-maxSlide(cur, sel, -1), Math.min(maxSlide(cur, sel, 1), delta))
      if (clamped === 0 || Math.sign(clamped) !== sign) {
        play('error') // an on-track move that's fully blocked — invalid
        return
      }
      applySlide(sel, clamped)
    },
    [applySlide, play, sel],
  )

  // Keyboard: arrows nudge the selected block along its axis; U/R/N shortcuts.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const cur = stateRef.current
      const b = sel && cur ? cur.blocks.find((x) => x.id === sel) : undefined
      switch (e.key) {
        case 'ArrowLeft':
          if (b?.dir === 'h') {
            e.preventDefault()
            applySlide(b.id, -1)
          }
          break
        case 'ArrowRight':
          if (b?.dir === 'h') {
            e.preventDefault()
            applySlide(b.id, 1)
          }
          break
        case 'ArrowUp':
          if (b?.dir === 'v') {
            e.preventDefault()
            applySlide(b.id, -1)
          }
          break
        case 'ArrowDown':
          if (b?.dir === 'v') {
            e.preventDefault()
            applySlide(b.id, 1)
          }
          break
        case 'u':
        case 'U':
          e.preventDefault()
          undo()
          break
        case 'r':
        case 'R':
          e.preventDefault()
          resetLevel()
          break
        case 'n':
        case 'N':
          e.preventDefault()
          nextLevel()
          break
        case 'Escape':
          setSel(null)
          break
      }
    },
    [applySlide, nextLevel, resetLevel, sel, undo],
  )

  // -- render ----------------------------------------------------------------

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-120 select-none">
        <div className="aspect-square rounded-xl bg-surface" data-testid="unblock-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const idx = state.levelIndex
  const level = LEVELS[idx]
  const par = LEVEL_PAR[idx]
  const bestHere = best[idx]
  const won = state.status === 'won'
  const beatPar = won && state.moves <= par

  const slideTrans = reduced ? 'none' : 'left .14s cubic-bezier(.2,.8,.3,1), top .14s cubic-bezier(.2,.8,.3,1)'

  const hint = won
    ? '🎉 Escaped! Pick the next level to keep going.'
    : 'Slide the RED block out through the gap on the right. Drag a block (or tap it, then tap where to go) — blocks only move along their length.'

  const headerExtra = (
    <>
      <label className="sr-only" htmlFor="unblock-level">
        Level
      </label>
      <select
        id="unblock-level"
        value={idx}
        onChange={(e) => openLevel(Number(e.target.value))}
        data-testid="level-select"
        className="rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-sm font-semibold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {LEVELS.map((lv, i) => (
          <option key={lv.id} value={i}>
            {i + 1}. {lv.name} · par {LEVEL_PAR[i]}
            {best[i] != null ? ' ✓' : ''}
          </option>
        ))}
      </select>
      <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Par</span>{' '}
        <span className="font-bold text-accent" data-testid="par">
          {par}
        </span>
        {bestHere != null && (
          <>
            {' · '}
            <span className="text-fg-muted">Best</span>{' '}
            <span className="font-bold text-neon-green" data-testid="best-moves">
              {bestHere}
            </span>
          </>
        )}
      </span>
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Solved', value: solvedCount, testId: 'solved' },
        { label: 'Moves', value: state.moves, testId: 'moves' },
      ]}
      headerExtra={headerExtra}
      onNewGame={resetLevel}
      newGameLabel="Reset"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-120"
    >
      {/* Board + exit lane. Extra right padding holds the escape arrow. */}
      <div className="relative pr-6 sm:pr-7">
        <div
          ref={boardRef}
          role="group"
          aria-label={`Unblock level ${idx + 1}: ${level.name}`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          data-testid="unblock-board"
          className="relative aspect-square w-full touch-none rounded-xl border border-border bg-surface p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ touchAction: 'none' }}
        >
          {/* Exit lane highlight — a faint red band leading to the gap. */}
          <div
            className="pointer-events-none absolute"
            style={{
              top: pct(EXIT_ROW),
              height: pct(1),
              left: 0,
              right: 0,
              background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${TARGET_NEON} 14%, transparent))`,
            }}
            aria-hidden="true"
          />

          {/* Grid lines */}
          <div className="pointer-events-none absolute inset-0 rounded-xl">
            {Array.from({ length: GRID - 1 }).map((_, i) => (
              <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-border" style={{ left: pct(i + 1) }} />
            ))}
            {Array.from({ length: GRID - 1 }).map((_, i) => (
              <div key={`h${i}`} className="absolute right-0 left-0 h-px bg-border" style={{ top: pct(i + 1) }} />
            ))}
          </div>

          {/* Exit gap — the right wall opens on the exit row, glowing red. */}
          <div
            className="pointer-events-none absolute rounded-r-xl"
            style={{
              top: pct(EXIT_ROW),
              height: pct(1),
              right: -2,
              width: 4,
              background: TARGET_NEON,
              boxShadow: `0 0 12px 2px ${TARGET_NEON}`,
              opacity: 0.9,
            }}
            aria-hidden="true"
          />

          {/* Destination-tap layer (only meaningful when a block is selected) */}
          {Array.from({ length: GRID }).map((_, r) =>
            Array.from({ length: GRID }).map((__, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                tabIndex={-1}
                aria-label={`Cell row ${r + 1} column ${c + 1}`}
                onClick={() => onCellTap(r, c)}
                className="absolute border-0 bg-transparent p-0"
                style={{
                  left: pct(c),
                  top: pct(r),
                  width: pct(1),
                  height: pct(1),
                  cursor: sel ? 'pointer' : 'default',
                }}
              />
            )),
          )}

          {/* Blocks */}
          {state.blocks.map((b) => {
            const color = colorFor(b)
            const isSel = sel === b.id
            const isDragging = drag?.id === b.id
            const dragT =
              isDragging && drag
                ? drag.axis === 'h'
                  ? `translateX(${drag.offPx}px)`
                  : `translateY(${drag.offPx}px)`
                : undefined
            // The target's celebratory escape: slide out the gap and fade.
            const escapeT = b.target && escaping && !reduced ? 'translateX(150%)' : undefined
            return (
              <div
                key={b.id}
                data-testid={b.target ? 'target-block' : 'block'}
                data-block={b.id}
                onPointerDown={(e) => onBlockPointerDown(e, b)}
                onPointerMove={onBlockPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="absolute flex touch-none items-center justify-center rounded-lg font-bold"
                style={{
                  left: pct(b.col),
                  top: pct(b.row),
                  width: pct(b.dir === 'h' ? b.len : 1),
                  height: pct(b.dir === 'v' ? b.len : 1),
                  padding: 3,
                  cursor: won ? 'default' : 'grab',
                  touchAction: 'none',
                  zIndex: isDragging ? 30 : isSel ? 20 : 10,
                  transform: escapeT ?? dragT,
                  opacity: b.target && escaping ? 0 : 1,
                  transition:
                    isDragging || justDragged === b.id
                      ? 'none'
                      : b.target && escaping && !reduced
                        ? 'transform .4s cubic-bezier(.4,0,.9,.4), opacity .4s ease .12s'
                        : slideTrans,
                }}
              >
                <span
                  className="flex h-full w-full items-center justify-center rounded-md"
                  style={{
                    background: b.target
                      ? `linear-gradient(150deg, ${color}, #ff2d55)`
                      : `linear-gradient(150deg, ${color}, color-mix(in srgb, ${color} 55%, #000))`,
                    border: `1px solid color-mix(in srgb, ${color} 70%, #fff)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,.35), inset 0 -3px 6px rgba(0,0,0,.35), 0 0 ${
                      isSel ? 14 : 6
                    }px ${color}${b.target ? ', 0 0 18px #ff2d55' : ''}`,
                    color: '#0a0a12',
                  }}
                >
                  {b.target ? (
                    <span aria-hidden="true" className="text-lg font-black tracking-tight sm:text-2xl">
                      ►
                    </span>
                  ) : (
                    // grip dots — a subtle "this is draggable" affordance
                    <span
                      aria-hidden="true"
                      className="rounded-full"
                      style={{
                        width: b.dir === 'h' ? 4 : 12,
                        height: b.dir === 'v' ? 4 : 12,
                        background: 'rgba(10,10,18,.5)',
                        boxShadow:
                          b.dir === 'h'
                            ? '-7px 0 0 rgba(10,10,18,.5), 7px 0 0 rgba(10,10,18,.5)'
                            : '0 -7px 0 rgba(10,10,18,.5), 0 7px 0 rgba(10,10,18,.5)',
                      }}
                    />
                  )}
                </span>
              </div>
            )
          })}

          <GameOverlay show={won && overlayShown} variant="win" title={beatPar ? 'Perfect escape!' : 'Escaped!'} testId="game-over">
            <div className="flex flex-col items-center gap-1 text-sm">
              <p>
                Solved in <span className="font-bold text-accent">{state.moves}</span> moves
                <span className="text-fg-muted"> · par {par}</span>
              </p>
              {beatPar ? (
                <p className="font-semibold text-neon-green">Optimal solution! 🏆</p>
              ) : (
                <p className="text-fg-muted">Best here: {bestHere ?? state.moves}</p>
              )}
            </div>
            <GameButton onClick={nextLevel} data-testid="next-level">
              Next level ▶
            </GameButton>
          </GameOverlay>
        </div>

        {/* Escape arrow just outside the exit gap */}
        <div
          className="pointer-events-none absolute flex items-center"
          style={{ top: pct(EXIT_ROW), height: pct(1), right: -2 }}
          aria-hidden="true"
        >
          <span
            className={reduced ? '' : 'anim-pulse'}
            style={{ color: TARGET_NEON, fontSize: '1.25rem', lineHeight: 1, textShadow: `0 0 8px ${TARGET_NEON}` }}
          >
            ▶
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <GameButton variant="ghost" onClick={undo} disabled={history.length === 0 || won} data-testid="undo">
          Undo
        </GameButton>
        <GameButton variant="ghost" onClick={() => openLevel(idx - 1)} disabled={idx === 0}>
          ◀ Prev
        </GameButton>
        <GameButton onClick={nextLevel}>Next ▶</GameButton>
      </div>
    </GameShell>
  )
}
