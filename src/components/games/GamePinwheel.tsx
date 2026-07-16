'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CONFIG,
  DIFFICULTIES,
  createGame,
  preview,
  reduce,
  type Dir,
  type Mote,
  type PinwheelAction,
  type PinwheelEvent,
  type PinwheelState,
  type Point,
  type SpinOutcome,
} from '@/lib/games/pinwheel/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Difficulty = 'easy' | 'normal' | 'hard'

const SOUND: Record<PinwheelEvent, SoundName | null> = {
  none: null,
  spin: 'move',
  lock: 'merge',
  multilock: 'match',
  crash: 'lose',
  undo: 'flip',
  win: 'win',
  illegal: 'error',
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const n = Number(localStorage.getItem(storageKey))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

/** Bare number, per the weekly-leaderboard contract (it reads with Number()). */
function saveBest(storageKey: string, n: number): void {
  try {
    localStorage.setItem(storageKey, String(n))
  } catch {
    // ignore storage failures
  }
}

function keyOf(p: Point): string {
  return `${p.x},${p.y}`
}

function cellLabel(
  x: number,
  y: number,
  anchor: boolean,
  pinned: boolean,
  mote: boolean,
  isPivot: boolean,
): string {
  let s = `${x + 1},${y + 1}`
  if (anchor) s += ' anchor'
  if (pinned) s += ' pinned dot'
  else if (mote) s += ' dot'
  if (isPivot) s += ' — pin here'
  return s
}

/** Layer-2 positioning contract: one cell box, translated by whole cells. */
function cellStyle(x: number, y: number, W: number, H: number): React.CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: `${100 / W}%`,
    height: `${100 / H}%`,
    transform: `translate(${x * 100}%, ${y * 100}%)`,
  }
}

function announce(state: PinwheelState): string {
  switch (state.lastEvent) {
    case 'crash':
      return 'Crashed — the constellation left the board'
    case 'win':
      return 'Every dot is pinned. You win!'
    case 'lock':
    case 'multilock': {
      const k = state.lastSpin?.shed.length ?? 0
      return `${k} dot${k === 1 ? '' : 's'} pinned, ${state.motes.length} remaining`
    }
    case 'spin':
      return 'Spun — nothing pinned'
    case 'undo':
      return 'Undone'
    case 'illegal':
      return 'Pin must be on the board'
    default:
      return ''
  }
}

export function GamePinwheel({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<PinwheelState | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [pivot, setPivot] = useState<Point | null>(null)
  const [hover, setHover] = useState<Point | null>(null)
  const [crashFrame, setCrashFrame] = useState<Mote[] | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<PinwheelState | null>(null)
  const pivotRef = useRef<Point | null>(null)
  const reducedRef = useRef(reduced)
  const prevWon = useRef(false)
  const cellRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())

  reducedRef.current = reduced

  const commit = useCallback((next: PinwheelState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const arm = useCallback((p: Point | null) => {
    pivotRef.current = p
    setPivot(p)
  }, [])

  const startBoard = useCallback(
    (diff: Difficulty, seed: number) => {
      const g = createGame(DIFFICULTIES[diff], seed)
      prevWon.current = false
      setCrashFrame(null)
      setHover(null)
      arm(null)
      commit(g)
    },
    [arm, commit],
  )

  // Init board + hydrate best (client only).
  useEffect(() => {
    setBest(loadBest(storageKey))
    const g = createGame(DEFAULT_CONFIG, freshSeed())
    prevWon.current = false
    commit(g)
  }, [storageKey, commit])

  const dispatch = useCallback(
    (action: PinwheelAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastEvent === 'crash' && next.lastSpin && !reducedRef.current) {
        setCrashFrame(next.lastSpin.landed)
      }
      if (action.type === 'undo' && next.lastEvent === 'undo') setCrashFrame(null)

      if (next.won && !prevWon.current) {
        setBest((b) => {
          const nb = Math.max(b, next.score)
          saveBest(storageKey, nb)
          return nb
        })
      }
      prevWon.current = next.won
    },
    [commit, play, storageKey],
  )

  const spin = useCallback(
    (dir: Dir) => {
      const p = pivotRef.current
      if (!p) return
      // The pivot stays armed: plant once, crank.
      dispatch({ type: 'spin', pivot: p, dir })
    },
    [dispatch],
  )

  const onCell = useCallback(
    (p: Point) => {
      const cur = pivotRef.current
      if (cur && cur.x === p.x && cur.y === p.y) arm(null)
      else arm(p)
    },
    [arm],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const W = s.config.width
      const H = s.config.height
      const centre: Point = { x: (W - 1) / 2, y: (H - 1) / 2 }
      const cur = pivotRef.current

      const move = (dx: number, dy: number) => {
        if (!cur) return arm(centre)
        arm({
          x: Math.min(W - 1, Math.max(0, cur.x + dx)),
          y: Math.min(H - 1, Math.max(0, cur.y + dy)),
        })
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          move(-1, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          move(1, 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          move(0, -1)
          break
        case 'ArrowDown':
          e.preventDefault()
          move(0, 1)
          break
        case 'q':
        case 'Q':
        case ',':
          e.preventDefault()
          spin('ccw')
          break
        case 'e':
        case 'E':
        case '.':
        case 'Enter':
        case ' ':
          e.preventDefault()
          spin('cw')
          break
        case 'Escape':
          e.preventDefault()
          arm(null)
          break
        case 'z':
        case 'Z':
          e.preventDefault()
          dispatch({ type: 'undo' })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          dispatch({ type: 'reset' })
          setCrashFrame(null)
          arm(null)
          break
        case 'n':
        case 'N':
          e.preventDefault()
          startBoard(difficulty, freshSeed())
          break
      }
    },
    [arm, dispatch, spin, startBoard, difficulty],
  )

  // Keep DOM focus in sync with the armed pivot (roving tabIndex).
  useEffect(() => {
    if (!state || !pivot) return
    cellRefs.current.get(keyOf(pivot))?.focus()
  }, [pivot, state])

  const onNewGame = useCallback(() => {
    startBoard(difficulty, freshSeed())
  }, [startBoard, difficulty])

  const switchDifficulty = useCallback(
    (d: Difficulty) => {
      setDifficulty(d)
      startBoard(d, freshSeed())
    },
    [startBoard],
  )

  // Preview target: the armed pivot wins; hover only previews when nothing is armed.
  const target = pivot ?? hover
  const previews = useMemo(() => {
    if (!state || !target) return null
    return {
      ccw: preview(state, target, 'ccw'),
      cw: preview(state, target, 'cw'),
    }
  }, [state, target])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="aspect-square rounded-xl bg-surface p-4" data-testid="pinwheel-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const W = state.config.width
  const H = state.config.height
  const won = state.won
  const dead = state.dead
  const undoDisabled = won || dead || state.undosLeft === 0 || state.undoStack.length === 0
  const spinDisabled = !pivot || won || dead

  const anchorSet = new Set(state.anchors.map(keyOf))
  const lockedSet = new Set(state.locked.map(keyOf))
  const freeAnchorSet = new Set(state.anchors.filter((a) => !lockedSet.has(keyOf(a))).map(keyOf))
  const moteSet = new Set(state.motes.map(keyOf))
  const shedSet = new Set(
    state.lastEvent === 'lock' || state.lastEvent === 'multilock' || state.lastEvent === 'win'
      ? (state.lastSpin?.shed.map(keyOf) ?? [])
      : [],
  )

  const badge = (out: SpinOutcome | null): string | null => {
    if (!out) return null
    if (out.crashed) return 'Crash'
    if (out.shed.length === 0) return null
    return `+${out.shed.length} pin`
  }

  const hint = won
    ? 'Every dot is pinned!'
    : dead
      ? 'You threw the constellation off the board. Press R to retry.'
      : pivot
        ? 'Ghosts show where the constellation lands. Rings are anchors — a dot that lands on one is pinned for good.'
        : 'Tap a cell to plant your pin, then spin the whole board around it.'

  const headerExtra = (
    <>
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
      <GameButton variant="ghost" onClick={() => dispatch({ type: 'undo' })} disabled={undoDisabled}>
        Undo ({state.undosLeft})
      </GameButton>
    </>
  )

  /** Hollow preview ring; filled when it will pin. */
  const ghost = (m: Mote, color: string, crashing: boolean) => {
    const willPin = !crashing && freeAnchorSet.has(keyOf(m))
    return (
      <span
        key={`${color}-${m.id}`}
        aria-hidden="true"
        style={cellStyle(m.x, m.y, W, H)}
        className="flex items-center justify-center"
      >
        <span
          className="rounded-full"
          style={{
            width: '52%',
            height: '52%',
            border: `${reduced ? 3 : 2}px solid ${color}`,
            background: willPin ? color : 'transparent',
            opacity: reduced ? 0.75 : undefined,
            animation: reduced ? undefined : 'pw-ghost 1.1s ease-in-out infinite',
          }}
        />
      </span>
    )
  }

  return (
    <GameShell
      stats={[
        { label: 'Moves', value: state.moves, testId: 'moves' },
        { label: 'Par', value: state.par },
        { label: 'Score', value: state.score, float: true },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={won ? 'Play again' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        role="group"
        aria-label="Pinwheel board"
        onKeyDown={onKeyDown}
        className="relative aspect-square rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'pw-board-in .3s ease-out both' }}
        data-testid="pinwheel-board"
      >
        <div className="relative h-full w-full">
          {/* Layer 1 — hit targets, anchor rings, pivot marker. */}
          <div
            className="grid h-full w-full"
            style={{ gridTemplateColumns: `repeat(${W}, 1fr)`, gap: 0 }}
          >
            {Array.from({ length: W * H }, (_, i) => {
              const x = i % W
              const y = Math.floor(i / W)
              const k = `${x},${y}`
              const isAnchor = anchorSet.has(k)
              const claimed = lockedSet.has(k)
              const isPivot = !!pivot && pivot.x === x && pivot.y === y
              // 로빙 tabIndex의 진입점. 핀이 없을 땐 중앙 칸이 Tab을 받는다 —
              // 이게 없으면 모든 칸이 -1이라 키보드만 쓰는 사용자는 격자에 들어올 수조차 없다.
              const isTabEntry = !pivot && x === (W >> 1) && y === (H >> 1)
              return (
                <button
                  key={k}
                  ref={(el) => {
                    cellRefs.current.set(k, el)
                  }}
                  type="button"
                  data-testid="cell"
                  aria-label={cellLabel(x, y, isAnchor, claimed, moteSet.has(k), isPivot)}
                  aria-pressed={isPivot}
                  tabIndex={isPivot || isTabEntry ? 0 : -1}
                  // 포커스로 핀을 꽂는 건 키보드 이동(방향키)용이다. 마우스 클릭도
                  // 포커스를 유발하므로 무조건 arm하면 뒤이은 onClick 토글이 그걸 곧바로
                  // 해제해 핀이 영영 안 꽂힌다. :focus-visible은 키보드 포커스에만 참이라
                  // 이걸로 갈라낸다 — 마우스 경로는 onClick만 처리한다.
                  onFocus={(e) => {
                    if (e.currentTarget.matches(':focus-visible')) arm({ x, y })
                  }}
                  onClick={() => onCell({ x, y })}
                  onPointerEnter={() => setHover({ x, y })}
                  onPointerLeave={() => setHover((h) => (h && h.x === x && h.y === y ? null : h))}
                  className="relative flex items-center justify-center focus-visible:outline-none"
                  style={{ boxShadow: 'inset 0 0 0 1px rgba(140,140,200,0.12)' }}
                >
                  {isAnchor && (
                    <span
                      aria-hidden="true"
                      className="rounded-full border-2 border-dashed"
                      style={{
                        width: '62%',
                        height: '62%',
                        borderColor: 'var(--neon-purple)',
                        opacity: claimed ? 0.25 : 0.9,
                      }}
                    />
                  )}
                  {isPivot && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                      style={{
                        color: 'var(--neon-blue)',
                        boxShadow: 'inset 0 0 0 2px var(--neon-blue)',
                        borderRadius: 4,
                        animation: reduced ? undefined : 'pw-pin-drop .2s ease-out both',
                      }}
                    >
                      ✛
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Layer 2 — motes and ghosts. transform-only, zero layout props. */}
          <div className="pointer-events-none absolute inset-0">
            {!crashFrame &&
              previews?.ccw?.landed.map((m, i) =>
                previews.ccw!.crashIdx.includes(i)
                  ? null
                  : ghost(m, 'var(--neon-cyan)', previews.ccw!.crashed),
              )}
            {!crashFrame &&
              previews?.cw?.landed.map((m, i) =>
                previews.cw!.crashIdx.includes(i)
                  ? null
                  : ghost(m, 'var(--neon-magenta)', previews.cw!.crashed),
              )}

            {state.locked.map((m) => (
              <span
                key={`lock-${m.id}`}
                aria-hidden="true"
                style={cellStyle(m.x, m.y, W, H)}
                className="flex items-center justify-center"
              >
                <span
                  className="flex items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    width: '58%',
                    height: '58%',
                    background: 'var(--neon-lime)',
                    color: '#0b1000',
                    boxShadow: '0 0 12px var(--neon-lime)',
                    animation:
                      reduced || !shedSet.has(keyOf(m)) ? undefined : 'pw-pin .35s ease-out both',
                  }}
                >
                  ✦
                </span>
              </span>
            ))}

            {(crashFrame ?? state.motes).map((m) => (
              <span
                key={`mote-${m.id}`}
                aria-hidden="true"
                style={{
                  ...cellStyle(m.x, m.y, W, H),
                  transition: reduced ? 'none' : 'transform 180ms ease-out',
                }}
                className="flex items-center justify-center"
                onAnimationEnd={crashFrame ? () => setCrashFrame(null) : undefined}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: '52%',
                    height: '52%',
                    background: crashFrame ? 'var(--neon-red)' : 'var(--neon-amber)',
                    animation: crashFrame ? 'pw-shatter .4s ease-out both' : undefined,
                  }}
                />
              </span>
            ))}
          </div>
        </div>

        <div className="sr-only" aria-live="polite">
          {announce(state)}
        </div>

        <GameOverlay show={won} variant="win" title="Pinned!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Moves <span className="font-bold text-accent">{state.moves}</span> / Par{' '}
              <span className="font-bold text-accent">{state.par}</span>
            </p>
            <p>
              Best single shed <span className="font-bold text-accent">×{state.bestShed}</span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{best}</span>
            </p>
          </div>
          <GameButton onClick={onNewGame}>Play again</GameButton>
        </GameOverlay>

        <GameOverlay
          show={dead && !won && !crashFrame}
          variant="lose"
          title="Off the board!"
          testId="game-over"
        >
          <div className="flex gap-2">
            <GameButton
              onClick={() => {
                dispatch({ type: 'reset' })
                setCrashFrame(null)
                arm(null)
              }}
            >
              Retry
            </GameButton>
            <GameButton variant="ghost" onClick={onNewGame}>
              New board
            </GameButton>
          </div>
        </GameOverlay>
      </div>

      <div className="mt-3 flex justify-center gap-3">
        <GameButton
          variant="ghost"
          className="min-h-11 px-5 text-base"
          onClick={() => spin('ccw')}
          disabled={spinDisabled}
        >
          ↺ Spin CCW
          {previews?.ccw && badge(previews.ccw) && (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                previews.ccw.crashed ? 'text-neon-red' : 'text-accent'
              }`}
              style={{
                background: previews.ccw.crashed
                  ? 'color-mix(in srgb, var(--neon-red) 18%, transparent)'
                  : 'color-mix(in srgb, var(--neon-lime) 18%, transparent)',
                color: previews.ccw.crashed ? 'var(--neon-red)' : 'var(--neon-lime)',
              }}
            >
              {badge(previews.ccw)}
            </span>
          )}
        </GameButton>
        <GameButton
          variant="ghost"
          className="min-h-11 px-5 text-base"
          onClick={() => spin('cw')}
          disabled={spinDisabled}
        >
          ↻ Spin CW
          {previews?.cw && badge(previews.cw) && (
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold"
              style={{
                background: previews.cw.crashed
                  ? 'color-mix(in srgb, var(--neon-red) 18%, transparent)'
                  : 'color-mix(in srgb, var(--neon-lime) 18%, transparent)',
                color: previews.cw.crashed ? 'var(--neon-red)' : 'var(--neon-lime)',
              }}
            >
              {badge(previews.cw)}
            </span>
          )}
        </GameButton>
      </div>

      <style>{`
        @keyframes pw-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
        @keyframes pw-ghost { 0%, 100% { opacity: .5 } 50% { opacity: .9 } }
        @keyframes pw-pin {
          0% { transform: scale(1) }
          45% { transform: scale(1.4) }
          100% { transform: scale(1) }
        }
        @keyframes pw-shatter { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(1.6) } }
        @keyframes pw-pin-drop { from { opacity: 0; transform: scale(1.6) } to { opacity: 1; transform: none } }
      `}</style>
    </GameShell>
  )
}
