'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COLS,
  ROWS,
  TICKS_PER_CELL,
  TICK_MS,
  cellFromIndex,
  createGame,
  reachOf,
  reduce,
  type Cell,
  type FuseState,
  type Reach,
  type Wick,
} from '@/lib/games/fuse/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeRatio, barGlyph, resultSnippet } from '@/lib/dailyShare'

/** Reach drives the whole affordance — it is information, never decoration. */
const REACH_COLOR: Record<Reach, string> = {
  safe: 'var(--neon-lime)',
  tight: 'var(--neon-amber)',
  doomed: 'var(--neon-red)',
}

interface Pop {
  seq: number
  cell: Cell
  kind: 'defuse' | 'boom'
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function cellLabel(cell: Cell, w: Wick | undefined, reach: Reach | null): string {
  const where = `Cell ${cell.x + 1},${cell.y + 1}`
  if (!w || !reach) return `${where} — empty`
  const how = reach === 'doomed' ? 'too far' : 'reachable'
  return `${where} — fuse ${w.remaining} of ${w.total} ticks, ${how}`
}

export function GameFuse({ storageKey }: { storageKey: string }) {
  // SSR safety: the board is built on the client only (freshSeed touches Date).
  const [state, setState] = useState<FuseState | null>(null)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [focus, setFocus] = useState(12) // center cell (2,2)
  const [pops, setPops] = useState<Pop[]>([])
  const [shake, setShake] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<FuseState | null>(null)
  const rafRef = useRef(0)
  const accRef = useRef(0)
  const lastTsRef = useRef(0)
  const bestRef = useRef(0)
  const newBestRef = useRef(false)
  const popSeq = useRef(0)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commit = useCallback((next: FuseState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const addPop = useCallback((cell: Cell, kind: Pop['kind']) => {
    if (reducedRef.current) return
    const seq = ++popSeq.current
    setPops((p) => [...p, { seq, cell, kind }])
  }, [reducedRef])

  // ---- Tick loop: rAF + accumulator, clamped to 4 ticks per frame so a
  // backgrounded tab never resumes into a catch-up burst that kills the run.
  // rAF pauses while hidden — that freeze-on-blur is the desired behavior.
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
        const before = cur.wicks
        const next = reduce(cur, { type: 'tick' })
        const e = next.events

        // Pops: diff the wick lists so we know which cell each effect belongs to.
        if (e.defusedId !== null || e.exploded > 0) {
          const alive = new Set(next.wicks.map((w) => w.id))
          for (const w of before) {
            if (alive.has(w.id)) continue
            addPop(w.cell, w.id === e.defusedId ? 'defuse' : 'boom')
          }
        }

        if (e.defusedId !== null) play('eat')
        if (e.chainTierUp) play('merge')
        if (e.exploded > 0) {
          play('error') // once per tick, never once per wick
          if (!reducedRef.current) setShake(true)
        }
        if (e.spawned > 0) play('flag')

        // The record is broken the instant it is surpassed — so remember it HERE.
        // Comparing score to best at game-over is always wrong (best already moved).
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
          play(newBestRef.current ? 'win' : 'lose')
          recordFinish(storageKey.replace(/^best:/, ''))
        }

        cur = next
        advanced = true
        if (cur.phase !== 'playing') break
      }
      if (advanced) commit(cur)
    },
    [addPop, commit, play, reducedRef, storageKey],
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
    setShake(false)
    setFocus(12)
    commit(createGame(freshSeed()))
  }, [commit])

  /** One tap starts AND commits the target — no wasted tap. */
  const tap = useCallback(
    (cell: Cell) => {
      const s = stateRef.current
      if (!s || s.phase === 'over') return
      let next = s
      if (next.phase === 'idle') next = reduce(next, { type: 'start' })
      next = reduce(next, { type: 'target', cell })
      commit(next)
      play('move')
    },
    [commit, play],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const n = COLS * ROWS
      // Roving focus: DOM focus moves ONLY in response to an arrow key pressed
      // inside the board. Never from an effect on state — the 90 ms tick loop
      // would yank focus back from New Game / mute every frame.
      const moveTo = (i: number) => {
        e.preventDefault()
        setFocus(i)
        cellRefs.current[i]?.focus()
      }
      switch (e.key) {
        case 'ArrowLeft':
          moveTo((focus - 1 + n) % n)
          break
        case 'ArrowRight':
          moveTo((focus + 1) % n)
          break
        case 'ArrowUp':
          moveTo((focus - COLS + n) % n)
          break
        case 'ArrowDown':
          moveTo((focus + COLS) % n)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          tap(cellFromIndex(focus))
          break
      }
      // No `r` binding on purpose: a bare letter firing a restart mid-run in a
      // real-time game is hostile. GameShell's New Game covers it.
    },
    [focus, tap],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="rounded-xl bg-surface p-4" data-testid="fuse-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const { hand, wicks, phase } = state
  const byCell = new Map<number, Wick>()
  for (const w of wicks) byCell.set(w.cell.y * COLS + w.cell.x, w)
  const onPath = new Set(hand.path.map((c) => c.y * COLS + c.x))

  // Hand position: 3 integer sub-steps per cell + a linear CSS transition give
  // perfectly smooth motion with ZERO float path math in the engine.
  const frac = hand.path.length > 0 ? hand.stepTicks / TICKS_PER_CELL : 0
  const nextCell = hand.path[0] ?? hand.at
  const hx = hand.at.x + (nextCell.x - hand.at.x) * frac
  const hy = hand.at.y + (nextCell.y - hand.at.y) * frac

  const hint =
    phase === 'over'
      ? 'Out of hands.'
      : phase === 'idle'
        ? 'Tap a cell to send your hand there. Fuses burn while you travel — the order you visit them in is the whole game.'
        : 'Dimmed fuses are out of reach. Let them go and save two nearby instead.'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Lives', value: state.lives },
        { label: 'Chain', value: state.chain },
      ]}
      onNewGame={restart}
      newGameLabel={phase === 'over' ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-100"
    >
      <div
        className="relative rounded-xl bg-surface p-3"
        data-testid="fuse-board"
        style={reduced ? undefined : { animation: 'fz-board-in .3s ease-out both' }}
      >
        <div
          role="group"
          aria-label="Fuse board"
          onKeyDown={onKeyDown}
          onAnimationEnd={() => setShake(false)}
          className="relative aspect-square w-full"
          style={shake && !reduced ? { animation: 'fz-shake .26s ease-out' } : undefined}
        >
          <div className="grid h-full w-full grid-cols-5 grid-rows-5">
            {Array.from({ length: COLS * ROWS }, (_, i) => {
              const cell = cellFromIndex(i)
              const w = byCell.get(i)
              const reach = w ? reachOf(hand, w) : null
              const doomed = reach === 'doomed'
              const color = reach ? REACH_COLOR[reach] : undefined
              return (
                <button
                  key={i}
                  ref={(el) => {
                    cellRefs.current[i] = el
                  }}
                  type="button"
                  data-testid="fuse-cell"
                  aria-label={cellLabel(cell, w, reach)}
                  tabIndex={i === focus ? 0 : -1}
                  onFocus={() => setFocus(i)}
                  onClick={() => tap(cell)}
                  className="relative min-h-11 min-w-11 p-[3px] focus-visible:outline-none"
                >
                  <span
                    className="absolute inset-[3px] rounded-md border border-border/70"
                    aria-hidden="true"
                  />
                  {onPath.has(i) && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: 'var(--neon-cyan)', opacity: 0.35 }}
                    />
                  )}
                  {w && (
                    // The spawn pop is a one-shot keyed to the wick id; the doomed
                    // pulse lives on an inner layer so a reach change (safe ->
                    // doomed) can never re-trigger the pop.
                    <span
                      key={w.id}
                      aria-hidden="true"
                      className="absolute inset-[6px]"
                      style={{ animation: reduced ? undefined : 'fz-spawn .18s ease-out both' }}
                    >
                      <span
                        className="absolute inset-0 overflow-hidden rounded"
                        style={{
                          opacity: doomed ? 0.35 : 1,
                          animation:
                            reduced || !doomed ? undefined : 'fz-doom 1.6s ease-in-out infinite',
                        }}
                      >
                        {/* Fuse level via scaleY — never `height`; layout props are banned. */}
                        <span
                          className="absolute inset-0 origin-bottom rounded"
                          style={{
                            background: color,
                            boxShadow: doomed ? undefined : `0 0 10px ${color}`,
                            transform: `scaleY(${w.remaining / w.total})`,
                            transition: reduced ? 'none' : `transform ${TICK_MS}ms linear`,
                          }}
                        />
                        {doomed && (
                          <span
                            className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rotate-[-20deg]"
                            style={{ background: 'var(--neon-red)' }}
                          />
                        )}
                      </span>
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute inset-[3px] rounded-md ring-inset"
                    style={
                      i === focus
                        ? { boxShadow: 'inset 0 0 0 2px var(--neon-purple)' }
                        : undefined
                    }
                  />
                </button>
              )
            })}
          </div>

          {/* The hand — one absolutely positioned overlay, cell-sized. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0"
            style={{
              width: `${100 / COLS}%`,
              height: `${100 / ROWS}%`,
              transform: `translate(${hx * 100}%, ${hy * 100}%)`,
              transition: reduced ? 'none' : `transform ${TICK_MS}ms linear`,
            }}
          >
            <span
              className="absolute inset-[5px] rounded-lg border-2"
              style={{
                borderColor: 'var(--neon-cyan)',
                boxShadow: '0 0 12px var(--neon-cyan), inset 0 0 8px var(--neon-cyan)',
              }}
            />
          </div>

          {/* Transient pops (skipped entirely under reduced motion). */}
          {pops.map((p) => (
            <span
              key={p.seq}
              aria-hidden="true"
              onAnimationEnd={() => setPops((cur) => cur.filter((x) => x.seq !== p.seq))}
              className="pointer-events-none absolute left-0 top-0"
              style={{
                width: `${100 / COLS}%`,
                height: `${100 / ROWS}%`,
                transform: `translate(${p.cell.x * 100}%, ${p.cell.y * 100}%)`,
              }}
            >
              <span
                className="absolute inset-[5px] rounded-lg border-2"
                style={{
                  borderColor: p.kind === 'defuse' ? 'var(--neon-lime)' : 'var(--neon-red)',
                  background:
                    p.kind === 'defuse' ? 'rgba(163,230,53,0.25)' : 'rgba(248,113,113,0.3)',
                  animation:
                    p.kind === 'defuse'
                      ? 'fz-defuse .2s ease-out both'
                      : 'fz-boom .26s ease-out both',
                }}
              />
            </span>
          ))}
        </div>

        <GameOverlay
          show={phase === 'over'}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Out of hands'}
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Saved <span className="font-bold text-accent">{state.saved}</span> · Lost{' '}
              <span className="font-bold text-accent">{state.lost}</span>
            </p>
            <p>
              Best chain <span className="font-bold text-accent">{state.bestChain}</span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{best}</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <DailyShareButton
              payload={() => {
                const grade = gradeRatio(state.score, best, newBest)
                const glyph = state.bestChain >= 1 ? barGlyph(state.bestChain, undefined, `BEST CHAIN ${state.bestChain}`) : undefined
                return {
                  gameName: 'Fuse',
                  dateISO: todayUTC(),
                  subtitle: todayUTC(),
                  accent: '#ff4d6d',
                  lines: [],
                  url: `${window.location.origin}/fuse`,
                  grade,
                  scoreLine: `${state.score} PTS`,
                  glyph,
                  textSnippet: resultSnippet('Fuse', todayUTC(), false, grade, glyph?.cells ?? [], undefined, `scored ${state.score}, best chain ${state.bestChain}`),
                }
              }}
            />
            <GameButton onClick={restart}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes fz-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes fz-spawn { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none } }
          @keyframes fz-defuse { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(1.3) } }
          @keyframes fz-boom {
            0% { opacity: 1; transform: scale(.9) }
            40% { opacity: .9; transform: scale(1.25) }
            100% { opacity: 0; transform: scale(1.4) }
          }
          @keyframes fz-doom { 0%, 100% { opacity: .35 } 50% { opacity: .18 } }
          @keyframes fz-shake {
            0%, 100% { transform: translateX(0) }
            25% { transform: translateX(-4px) }
            50% { transform: translateX(4px) }
            75% { transform: translateX(-2px) }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
