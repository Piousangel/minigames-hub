'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TICK_MS,
  createGame,
  isDanger,
  reduce,
  type CountcircleState,
} from '@/lib/games/countcircle/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// -- Rendering-only geometry (never enters the pure engine) ------------------

const RING_R = 38 // radius, in cqw units, of the seat circle

/** Fixed angle for a seat id within a `total`-seat ring. Top = -90deg, clockwise. */
function seatAngle(id: number, total: number): number {
  return (id / total) * Math.PI * 2 - Math.PI / 2
}

/** cqw offsets from the ring center for a seat id. */
function seatOffset(id: number, total: number): { x: number; y: number } {
  const a = seatAngle(id, total)
  return { x: Math.cos(a) * RING_R, y: Math.sin(a) * RING_R }
}

function seatTransform(id: number, total: number): string {
  const { x, y } = seatOffset(id, total)
  return `translate(-50%, -50%) translate(${50 + x}cqw, ${50 + y}cqw)`
}

/** Smaller seats as the circle fills up, so 60 seats stay legible. */
function seatDiameter(total: number): number {
  if (total <= 10) return 9
  if (total <= 20) return 6.4
  if (total <= 35) return 4.6
  return 3.4
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

interface Pop {
  seq: number
  seatId: number
  fatal: boolean
}

export function GameCountcircle({ storageKey }: { storageKey: string }) {
  // SSR safety: the run is built on the client only (freshSeed touches Date).
  const [state, setState] = useState<CountcircleState | null>(null)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [pops, setPops] = useState<Pop[]>([])

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<CountcircleState | null>(null)
  const rafRef = useRef(0)
  const accRef = useRef(0)
  const lastTsRef = useRef(0)
  const bestRef = useRef(0)
  const newBestRef = useRef(false)
  const popSeq = useRef(0)

  const commit = useCallback((next: CountcircleState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const addPop = useCallback(
    (seatId: number, fatal: boolean) => {
      if (reducedRef.current) return
      const seq = ++popSeq.current
      setPops((p) => [...p, { seq, seatId, fatal }])
    },
    [reducedRef],
  )

  // ---- Tick loop: rAF + accumulator, same shape as fuse's. rAF pauses while
  // the tab is hidden — that freeze-on-blur is the desired behavior.
  const frame = useCallback(
    (ts: number) => {
      rafRef.current = requestAnimationFrame(frame)
      const s = stateRef.current
      if (!s || s.phase !== 'playing') {
        lastTsRef.current = ts
        accRef.current = 0
        return
      }
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      accRef.current += ts - last
      if (accRef.current > TICK_MS * 4) accRef.current = TICK_MS * 4

      let cur = s
      let advanced = false
      while (accRef.current >= TICK_MS) {
        accRef.current -= TICK_MS
        const next = reduce(cur, { type: 'tick' })
        const e = next.events

        if (e.resolved && e.eliminatedSeat !== null) {
          addPop(e.eliminatedSeat, e.wasPlayer)
        }

        if (e.resolved && !e.clutch && !e.wasPlayer) play('flip')
        if (e.clutch) play('match')
        if (e.roundClear) play('win')
        if (e.over) play('lose')

        // The record is broken the instant it is surpassed.
        if (next.score > bestRef.current) {
          bestRef.current = next.score
          setBest(next.score)
          newBestRef.current = true
          try {
            localStorage.setItem(storageKey, String(next.score))
          } catch {
            // ignore storage failures
          }
        }

        if (e.over) {
          setNewBest(newBestRef.current)
          recordResult(storageKey.replace(/^best:/, ''), { won: true })
        }

        cur = next
        advanced = true
        if (cur.phase !== 'playing') break
      }
      if (advanced) commit(cur)
    },
    [addPop, commit, play, storageKey],
  )

  // ---- Init (client only) ----
  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey))
    const b = Number.isFinite(stored) ? stored : 0
    bestRef.current = b
    setBest(b)
    commit(createGame(freshSeed()))
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
    // Mount once; frame is a stable useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restart = useCallback(() => {
    accRef.current = 0
    lastTsRef.current = 0
    newBestRef.current = false
    setNewBest(false)
    setPops([])
    commit(createGame(freshSeed()))
  }, [commit])

  /** One tap/keypress starts AND commits the move — no wasted input. */
  const step = useCallback(
    (dir: 'left' | 'right') => {
      const s = stateRef.current
      if (!s || s.phase === 'over') return
      let next = s
      if (next.phase === 'idle') next = reduce(next, { type: 'start' })
      next = reduce(next, { type: 'move', dir })
      commit(next)
      play('move')
    },
    [commit, play],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault()
          step('left')
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault()
          step('right')
          break
      }
    },
    [step],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="rounded-xl bg-surface p-4" data-testid="countcircle-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const { survivors, seats, playerIdx, target, phase } = state
  const survivorSet = new Set(survivors)
  const n = survivors.length
  const leftIdx = ((playerIdx - 1) % n + n) % n
  const rightIdx = (playerIdx + 1) % n
  const leftSeatId = survivors[leftIdx]
  const rightSeatId = survivors[rightIdx]
  const playerSeatId = survivors[playerIdx]
  const targetSeatId = phase === 'playing' ? survivors[target] : null
  const danger = isDanger(state)
  const pct = state.windowTicksTotal > 0 ? state.windowTicks / state.windowTicksTotal : 0

  const hint =
    phase === 'over'
      ? 'Eliminated. Press New Game to try again.'
      : phase === 'idle'
        ? 'Press ← / → (or tap a side seat) to step around the circle before the count reaches you.'
        : danger
          ? "That's your seat — move now!"
          : 'Watch the pulsing ring — it marks the seat the count is heading for.'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Round', value: state.round },
        { label: 'Best', value: best },
      ]}
      onNewGame={restart}
      newGameLabel={phase === 'over' ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-100"
    >
      <div
        className="relative rounded-xl bg-surface p-4"
        data-testid="countcircle-board"
        style={reduced ? undefined : { animation: 'cc-board-in .3s ease-out both' }}
      >
        <div
          role="group"
          aria-label="Countcircle board"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="cc-ring relative aspect-square w-full focus-visible:outline-none"
        >
          {Array.from({ length: seats }, (_, seatId) => {
            const alive = survivorSet.has(seatId)
            const isButton = phase !== 'over' && (seatId === leftSeatId || seatId === rightSeatId)
            const size = seatDiameter(seats)
            const style: React.CSSProperties = {
              width: `${size}cqw`,
              height: `${size}cqw`,
              transform: seatTransform(seatId, seats),
              transition: reduced ? 'none' : `transform ${TICK_MS * 3}ms ease-out`,
            }
            if (!alive) {
              return (
                <span
                  key={seatId}
                  aria-hidden="true"
                  className="absolute left-0 top-0 rounded-full border border-border bg-bg-2/40"
                  style={style}
                />
              )
            }
            if (isButton) {
              const dir = seatId === leftSeatId ? 'left' : 'right'
              return (
                <button
                  key={seatId}
                  type="button"
                  aria-label={dir === 'left' ? 'Move left' : 'Move right'}
                  onClick={() => step(dir)}
                  className="absolute left-0 top-0 rounded-full border-2 border-border bg-surface/90 transition-colors hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  style={{
                    ...style,
                    // Seats shrink well under 44px once the circle grows past ~20 —
                    // keep the tap target floor even as the visual dot stays small.
                    width: `max(${size}cqw, 44px)`,
                    height: `max(${size}cqw, 44px)`,
                  }}
                />
              )
            }
            return (
              <span
                key={seatId}
                aria-hidden="true"
                className="absolute left-0 top-0 rounded-full border-2 border-border bg-surface/70"
                style={style}
              />
            )
          })}

          {/* Player ring — a separate overlay so it can slide between seats. */}
          {phase !== 'over' && playerSeatId !== undefined && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 rounded-full"
              style={{
                width: `${seatDiameter(seats) + 2.2}cqw`,
                height: `${seatDiameter(seats) + 2.2}cqw`,
                transform: `${seatTransform(playerSeatId, seats)} scale(1.15)`,
                transition: reduced ? 'none' : `transform ${TICK_MS}ms ease-out`,
                boxShadow: '0 0 0 2px var(--neon-cyan), 0 0 10px var(--neon-cyan)',
              }}
            />
          )}

          {/* Target ring — telegraphed the instant the window opens. */}
          {targetSeatId !== undefined && targetSeatId !== null && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 rounded-full"
              style={{
                width: `${seatDiameter(seats) + 2.2}cqw`,
                height: `${seatDiameter(seats) + 2.2}cqw`,
                transform: seatTransform(targetSeatId, seats),
                transition: reduced ? 'none' : `transform ${TICK_MS}ms ease-out`,
                boxShadow: '0 0 0 2px var(--neon-red), 0 0 12px var(--neon-red)',
                animation: reduced ? undefined : 'cc-pulse 0.6s ease-in-out infinite',
              }}
            />
          )}

          {/* Transient elimination pops. Outer span holds the (static) seat
              position; inner span carries the boom animation so the two
              `transform` declarations never fight each other. */}
          {pops.map((p) => (
            <span
              key={p.seq}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0"
              style={{
                width: `${seatDiameter(seats) + 4}cqw`,
                height: `${seatDiameter(seats) + 4}cqw`,
                transform: seatTransform(p.seatId, seats),
              }}
            >
              <span
                onAnimationEnd={() => setPops((cur) => cur.filter((x) => x.seq !== p.seq))}
                className="absolute inset-0 rounded-full"
                style={{
                  background: p.fatal ? 'rgba(255,77,109,0.35)' : 'rgba(148,163,184,0.3)',
                  animation: 'cc-boom .3s ease-out both',
                }}
              />
            </span>
          ))}
        </div>

        {/* Window progress bar. scaleX reflects state, not decoration — kept under reduced motion. */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-2/70">
          <div
            className="h-full origin-left rounded-full"
            style={{
              transform: `scaleX(${Math.max(0, Math.min(1, pct))})`,
              background: danger ? 'var(--neon-red)' : 'var(--neon-cyan)',
              transition: reduced ? 'none' : `transform ${TICK_MS}ms linear`,
            }}
          />
        </div>

        <GameOverlay
          show={phase === 'over'}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Eliminated'}
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Round <span className="font-bold text-accent">{state.round}</span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{best}</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <GameButton onClick={restart}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          .cc-ring { container-type: inline-size; }
          @keyframes cc-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes cc-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .45; }
          }
          @keyframes cc-boom {
            0% { opacity: .9; transform: scale(.9); }
            100% { opacity: 0; transform: scale(1.5); }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
