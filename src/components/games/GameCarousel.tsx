'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DIFFICULTIES,
  HAND_SIZE,
  createGame,
  reduce,
  type CarouselAction,
  type CarouselEvent,
  type CarouselState,
  type Color,
} from '@/lib/games/carousel/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Difficulty = 'easy' | 'normal' | 'hard'

const SOUND: Record<Exclude<CarouselEvent, 'gameover'>, SoundName | null> = {
  none: null,
  place: 'move',
  match: 'match',
  combo: 'merge',
}

const COLOR_NAMES = ['Ruby', 'Amber', 'Lime', 'Cyan', 'Violet', 'Rose']

/** Fixed HSL hue per color rank so marbles are legible in light + dark. */
function marbleStyle(rank: Color, k: number): { bg: string; fg: string } {
  const hue = k <= 1 ? 200 : Math.round(((rank - 1) * 300) / (k - 1))
  return { bg: `hsl(${hue} 70% 52%)`, fg: `hsl(${hue} 80% 12%)` }
}

function colorName(rank: Color): string {
  return COLOR_NAMES[(rank - 1) % COLOR_NAMES.length]
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey)
    const n = raw === null ? 0 : Number(raw)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, score: number): void {
  try {
    localStorage.setItem(storageKey, String(score))
  } catch {
    // ignore storage failures
  }
}

interface ClearFx {
  seq: number
  indices: number[]
  color: Color
}

interface Badge {
  seq: number
  streak: number
}

const RADIUS = 108 // px, ring layout radius
const SLOT = 34 // px, marble diameter

/** Fixed physical angle for slot i (independent of loaderPos) — used when the
 * wrapper itself carries the rotation animation. */
function physicalAngle(i: number, ringSize: number): number {
  return (360 / ringSize) * i - 90
}

/** Loader-relative angle (loaderPos always parked at -90/12 o'clock) — used
 * under prefers-reduced-motion, where the wrapper never rotates. */
function relativeAngle(i: number, loaderPos: number, ringSize: number): number {
  const n = ringSize
  const rel = ((i - loaderPos) % n + n) % n
  return (360 / n) * rel - 90
}

export function GameCarousel({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<CarouselState | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [focus, setFocus] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])
  const [clearFx, setClearFx] = useState<ClearFx[]>([])
  const [popIndex, setPopIndex] = useState<number | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<CarouselState | null>(null)
  const prevGameOver = useRef(false)
  const newBestRef = useRef(false)
  const badgeSeq = useRef(0)
  const clearSeq = useRef(0)
  const totalDegRef = useRef(0) // never reset — keeps rotation continuous
  const handRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commit = useCallback((next: CarouselState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate best (client only).
  useEffect(() => {
    setBest(loadBest(storageKey))
    const g = createGame(DIFFICULTIES.normal, freshSeed())
    prevGameOver.current = false
    newBestRef.current = false
    totalDegRef.current = 0
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (diff: Difficulty) => {
      const g = createGame(DIFFICULTIES[diff], freshSeed())
      prevGameOver.current = false
      newBestRef.current = false
      totalDegRef.current = 0
      setBadges([])
      setClearFx([])
      setPopIndex(null)
      setFocus(0)
      commit(g)
    },
    [commit],
  )

  const persistGameOver = useCallback(
    (next: CarouselState) => {
      const prevBest = loadBest(storageKey)
      if (next.score > prevBest) {
        newBestRef.current = true
        setBest(next.score)
        saveBest(storageKey, next.score)
      } else {
        newBestRef.current = false
      }
      recordResult(storageKey.replace(/^best:/, ''), { won: true })
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: CarouselAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      if (next.lastEvent === 'none') return

      // Rotation only advances when a real placement happened.
      if (next.placements !== prev.placements) {
        const stepDeg = 360 / next.config.ringSize
        totalDegRef.current -= next.config.rotateStep * stepDeg
      }

      if (next.lastPlacement) {
        setPopIndex(next.lastPlacement.ringIndex)
        setTimeout(() => setPopIndex((cur) => (cur === next.lastPlacement!.ringIndex ? null : cur)), 180)
      }

      if (next.lastPlacement?.matched) {
        const seq = ++clearSeq.current
        const fx: ClearFx = {
          seq,
          indices: next.lastPlacement.runIndices,
          color: next.lastPlacement.color,
        }
        setClearFx((cur) => [...cur, fx])
        setTimeout(() => setClearFx((cur) => cur.filter((x) => x.seq !== seq)), 220)
      }

      if (next.lastEvent === 'combo') {
        const seq = ++badgeSeq.current
        const streak = next.comboStreak
        setBadges((b) => [...b, { seq, streak }])
        setTimeout(() => setBadges((cur) => cur.filter((x) => x.seq !== seq)), 900)
      }

      if (next.lastEvent === 'gameover') {
        if (!prevGameOver.current) persistGameOver(next)
        const sound: SoundName = newBestRef.current ? 'win' : 'lose'
        play(sound)
      } else {
        const sound = SOUND[next.lastEvent]
        if (sound) play(sound)
      }

      prevGameOver.current = next.gameOver
    },
    [commit, play, persistGameOver],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      switch (e.key) {
        case '1':
        case '2':
        case '3': {
          e.preventDefault()
          const idx = Number(e.key) - 1
          if (idx < HAND_SIZE) dispatch({ type: 'place', handIndex: idx })
          break
        }
        case 'ArrowLeft':
          e.preventDefault()
          setFocus((f) => (f - 1 + HAND_SIZE) % HAND_SIZE)
          break
        case 'ArrowRight':
          e.preventDefault()
          setFocus((f) => (f + 1) % HAND_SIZE)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          dispatch({ type: 'place', handIndex: focus })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard(difficulty)
          break
      }
    },
    [dispatch, focus, difficulty, startBoard],
  )

  useEffect(() => {
    if (!state) return
    handRefs.current[focus]?.focus()
  }, [focus, state])

  const onNewGame = useCallback(() => startBoard(difficulty), [startBoard, difficulty])

  const switchDifficulty = useCallback(
    (d: Difficulty) => {
      setDifficulty(d)
      startBoard(d)
    },
    [startBoard],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="carousel-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const k = state.config.colors
  const N = state.config.ringSize
  const gameOver = state.gameOver

  const hint = gameOver
    ? 'Ring stopped — New Game to try again.'
    : 'Choose a marble from your hand to feed the loader.'

  const headerExtra = (
    <div className="flex overflow-hidden rounded-lg border border-border">
      {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
        <button
          key={d}
          onClick={() => switchDifficulty(d)}
          aria-pressed={difficulty === d}
          className={`px-2.5 py-1.5 text-sm font-semibold capitalize ${
            difficulty === d ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  )

  const wrapperDeg = reduced ? 0 : totalDegRef.current
  const wrapperTransition = reduced ? 'none' : 'transform 300ms ease-out'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Best', value: best, testId: 'best' },
        { label: 'Placed', value: state.placements },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={gameOver ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-100"
    >
      <div
        role="group"
        aria-label="Carousel board"
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-4"
        data-testid="carousel-board"
      >
        <div className="relative mx-auto" style={{ width: RADIUS * 2 + SLOT, height: RADIUS * 2 + SLOT }}>
          {/* fixed loader pointer at 12 o'clock — never rotates */}
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-lg text-accent"
            style={{ filter: 'drop-shadow(0 0 6px currentColor)' }}
          >
            ▼
          </div>

          <div
            className="absolute inset-0"
            style={{ transform: `rotate(${wrapperDeg}deg)`, transition: wrapperTransition }}
          >
            {state.ring.map((slot, i) => {
              const angle = reduced ? relativeAngle(i, state.loaderPos, N) : physicalAngle(i, N)
              const rad = (angle * Math.PI) / 180
              const cx = RADIUS * Math.cos(rad)
              const cy = RADIUS * Math.sin(rad)
              const isLoader = i === state.loaderPos
              const isPop = popIndex === i && !reduced
              const style = slot !== null ? marbleStyle(slot, k) : null
              return (
                <div
                  key={i}
                  data-testid="ring-slot"
                  data-loader={isLoader ? 'true' : undefined}
                  className="absolute"
                  style={{
                    left: `calc(50% + ${cx}px - ${SLOT / 2}px)`,
                    top: `calc(50% + ${cy}px - ${SLOT / 2}px)`,
                    width: SLOT,
                    height: SLOT,
                  }}
                >
                  <div
                    className={`flex h-full w-full items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                      isLoader
                        ? reduced
                          ? 'car-loader-static border-accent'
                          : 'car-loader-pulse border-accent'
                        : 'border-border'
                    }`}
                    style={{
                      transform: reduced ? undefined : `rotate(${-wrapperDeg}deg)`,
                      background: style ? style.bg : 'rgba(255,255,255,0.04)',
                      color: style ? style.fg : undefined,
                      animation: isPop ? 'car-pop .15s ease-out both' : undefined,
                    }}
                  >
                    {slot !== null ? slot : null}
                  </div>
                </div>
              )
            })}

            {clearFx.map((fx) =>
              fx.indices.map((i) => {
                const angle = reduced ? relativeAngle(i, state.loaderPos, N) : physicalAngle(i, N)
                const rad = (angle * Math.PI) / 180
                const cx = RADIUS * Math.cos(rad)
                const cy = RADIUS * Math.sin(rad)
                const style = marbleStyle(fx.color, k)
                return (
                  <div
                    key={`${fx.seq}-${i}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute rounded-full"
                    style={{
                      left: `calc(50% + ${cx}px - ${SLOT / 2}px)`,
                      top: `calc(50% + ${cy}px - ${SLOT / 2}px)`,
                      width: SLOT,
                      height: SLOT,
                      background: style.bg,
                      animation: reduced ? undefined : 'car-clear .2s ease-in both',
                      opacity: reduced ? 0 : undefined,
                    }}
                  />
                )
              }),
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-3" role="group" aria-label="Hand">
          {state.hand.map((color, i) => {
            const style = marbleStyle(color, k)
            return (
              <button
                key={i}
                ref={(el) => {
                  handRefs.current[i] = el
                }}
                type="button"
                data-testid="hand-slot"
                aria-label={`Place ${colorName(color)} marble`}
                tabIndex={i === focus ? 0 : -1}
                onFocus={() => setFocus(i)}
                onClick={() => dispatch({ type: 'place', handIndex: i })}
                disabled={gameOver}
                className="btn-press flex items-center justify-center rounded-full border-2 border-border font-bold shadow-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-40"
                style={{
                  width: 56,
                  height: 56,
                  background: style.bg,
                  color: style.fg,
                }}
              >
                {color}
              </button>
            )
          })}
        </div>

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="combo-badge"
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-sm font-bold text-accent"
            style={reduced ? undefined : { animation: 'car-badge .9s ease-out both' }}
          >
            Combo ×{b.streak}
          </span>
        ))}

        <GameOverlay show={gameOver} variant="lose" title="Ring Stopped!" testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Placed <span className="font-bold text-accent">{state.placements}</span>
            </p>
            <p>
              Longest run <span className="font-bold text-accent">{state.longestRun}</span>
            </p>
            <p>
              Cleared <span className="font-bold text-accent">{state.cleared}</span>
            </p>
            {newBestRef.current && (
              <p className="font-bold text-neon-lime">New Best!</p>
            )}
          </div>
          <GameButton onClick={onNewGame}>Play again</GameButton>
        </GameOverlay>

        <style>{`
          @keyframes car-pop { from { opacity: .2; transform: scale(.4) } to { opacity: 1; transform: scale(1) } }
          @keyframes car-clear { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(.4) } }
          @keyframes car-badge {
            0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.12); opacity: 1 }
            100% { transform: translate(-50%, -14px) scale(1); opacity: 0 }
          }
          @keyframes car-loader-glow {
            0%, 100% { box-shadow: 0 0 4px 1px var(--neon-amber, #fbbf24); opacity: .7 }
            50% { box-shadow: 0 0 12px 4px var(--neon-amber, #fbbf24); opacity: 1 }
          }
          .car-loader-pulse { animation: car-loader-glow 1.4s ease-in-out infinite; }
          .car-loader-static { box-shadow: 0 0 0 2px var(--neon-amber, #fbbf24) inset; }
        `}</style>
      </div>
    </GameShell>
  )
}
