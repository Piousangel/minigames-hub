'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ANGLE_STEP,
  DAILY_CONFIG,
  DIFFICULTIES,
  HACK_POS,
  HOG_LINE_Y,
  HOUSE_CENTER,
  HOUSE_R1,
  HOUSE_R2,
  HOUSE_R3,
  MAX_ANGLE_DEG,
  POWER_STEP,
  SHEET_LENGTH,
  SHEET_WIDTH,
  STONE_RADIUS,
  createGame,
  reduce,
  type HoglineAction,
  type HoglineEvent,
  type HoglineState,
  type Stone,
  type Vec2,
} from '@/lib/games/hogline/engine'
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
type Difficulty = 'easy' | 'normal' | 'hard'

const DAILY_KEY = 'hogline:daily'

interface HoglineSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

function loadDaily(): HoglineSave['daily'] {
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

function loadSave(storageKey: string): HoglineSave {
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

function saveAll(storageKey: string, save: HoglineSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

const SOUND: Record<HoglineEvent, SoundName | null> = {
  none: null,
  aim: null,
  release: 'move',
  collision: 'match',
  removed: 'flip',
  finish: 'mismatch',
  win: 'win',
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

// -- Board layout ---------------------------------------------------------

const VIEW_W = SHEET_WIDTH
const VIEW_H = SHEET_LENGTH
const RENDER_FRAMES_TARGET = 90 // ~1.5s at 60fps regardless of ticksUsed
const AIM_DRAG_PX_PER_ANGLE = 3 // px of horizontal drag per degree of angle
const AIM_DRAG_PX_FOR_FULL_POWER = 140 // px of vertical drag for power 0->1

/** Un-does the board's outer y-flip so text/labels read upright. */
function Upright({ x, y, children, ...rest }: { x: number; y: number; children: React.ReactNode } & React.SVGProps<SVGTextElement>) {
  return (
    <g transform={`translate(${x} ${y}) scale(1 -1)`}>
      <text textAnchor="middle" {...rest}>
        {children}
      </text>
    </g>
  )
}

function StoneGlyph({
  stone,
  pos,
  fresh,
  reduced,
}: {
  stone: Stone
  pos: Vec2
  fresh: boolean
  reduced: boolean
}) {
  const fill = stone.color === 'yellow' ? 'var(--neon-amber)' : 'var(--neon-red)'
  return (
    <g transform={`translate(${pos.x} ${pos.y})`} data-testid="stone" data-color={stone.color}>
      <circle
        r={stone.radius}
        fill={fill}
        fillOpacity={0.9}
        stroke={stone.guard ? 'var(--neon-purple)' : 'rgba(0,0,0,0.35)'}
        strokeWidth={stone.guard ? 0.7 : 0.35}
        style={
          !reduced && fresh
            ? { animation: 'hg-drop .22s ease-out both', transformOrigin: 'center' }
            : undefined
        }
      />
      <circle r={stone.radius * 0.32} fill="rgba(255,255,255,0.55)" />
    </g>
  )
}

export function GameHogline({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<HoglineState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [displayPositions, setDisplayPositions] = useState<Record<number, Vec2> | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<HoglineState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevFinished = useRef(false)
  const rafRef = useRef<number | null>(null)
  const boardRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; pointerId: number } | null>(null)

  const commit = useCallback((next: HoglineState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily))
    const g = createGame(DAILY_CONFIG, dailySeed(new Date()))
    prevFinished.current = false
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty) => {
      modeRef.current = nextMode
      const g =
        nextMode === 'daily'
          ? createGame(DAILY_CONFIG, dailySeed(new Date()))
          : createGame(DIFFICULTIES[diff], freshSeed())
      prevFinished.current = false
      setDisplayPositions(null)
      commit(g)
    },
    [commit],
  )

  const persistWin = useCallback(
    (next: HoglineState) => {
      const save = loadSave(storageKey)
      let nextSave: HoglineSave = { ...save, score: Math.max(save.score, next.score) }
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
    (action: HoglineAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      // Record the result exactly once, on the false->true finish transition.
      if (next.finished && !prevFinished.current) {
        if (next.won) persistWin(next)
        else recordResult(storageKey.replace(/^best:/, ''), { won: false })
      }
      prevFinished.current = next.finished
    },
    [commit, play, persistWin, storageKey],
  )

  // -- Throw-frame playback (rAF), skipped entirely under reduced motion --
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const thrown = state?.lastThrow
    if (!thrown || thrown.frames.length <= 1 || reducedRef.current) {
      setDisplayPositions(null)
      return
    }
    let idx = 0
    const step = Math.max(1, Math.ceil(thrown.frames.length / RENDER_FRAMES_TARGET))
    const advance = () => {
      const frame = thrown.frames[Math.min(idx, thrown.frames.length - 1)]
      const map: Record<number, Vec2> = {}
      for (const s of frame.stones) map[s.id] = s.pos
      setDisplayPositions(map)
      if (idx >= thrown.frames.length - 1) {
        rafRef.current = null
        setDisplayPositions(null) // hand back to canonical state.stones positions
        return
      }
      idx += step
      rafRef.current = requestAnimationFrame(advance)
    }
    rafRef.current = requestAnimationFrame(advance)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.lastThrow])

  // Keyboard controls.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          dispatch({ type: 'nudgePower', delta: POWER_STEP })
          break
        case 'ArrowDown':
          e.preventDefault()
          dispatch({ type: 'nudgePower', delta: -POWER_STEP })
          break
        case 'ArrowLeft':
          e.preventDefault()
          dispatch({ type: 'nudgeAngle', delta: -ANGLE_STEP })
          break
        case 'ArrowRight':
          e.preventDefault()
          dispatch({ type: 'nudgeAngle', delta: ANGLE_STEP })
          break
        case ' ':
          e.preventDefault()
          dispatch({ type: 'release' })
          break
        case 'Enter':
          e.preventDefault()
          if (e.shiftKey) dispatch({ type: 'bank' })
          else dispatch({ type: 'release' })
          break
        case 'Escape':
          e.preventDefault()
          dispatch({ type: 'aimReset' })
          break
        case 'b':
        case 'B':
          e.preventDefault()
          dispatch({ type: 'bank' })
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

  // Drag-to-aim from the hack stone.
  const onHackPointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    const s = stateRef.current
    if (!s || s.finished || s.shotsLeft <= 0) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, pointerId: e.pointerId }
  }, [])

  const onHackPointerMove = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      const dx = e.clientX - drag.startX
      const dy = drag.startY - e.clientY // up = more power
      const angle = Math.max(-MAX_ANGLE_DEG, Math.min(MAX_ANGLE_DEG, dx / AIM_DRAG_PX_PER_ANGLE))
      const power = Math.max(0, Math.min(1, dy / AIM_DRAG_PX_FOR_FULL_POWER))
      dispatch({ type: 'setAngle', angle })
      dispatch({ type: 'setPower', power })
    },
    [dispatch],
  )

  const onHackPointerUp = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      dragRef.current = null
      dispatch({ type: 'release' })
    },
    [dispatch],
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
        <div className="rounded-xl bg-surface p-6" data-testid="hogline-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.won
  const canAct = !state.finished && state.shotsLeft > 0
  const angleRad = (state.angle * Math.PI) / 180
  const aimLen = 12 + state.power * 26
  const aimTip = {
    x: HACK_POS.x + Math.sin(angleRad) * aimLen,
    y: HACK_POS.y + Math.cos(angleRad) * aimLen,
  }

  const hint = won
    ? 'Target cleared!'
    : state.finished
      ? 'Short of target — try again.'
      : state.lastEvent === 'collision' || state.lastEvent === 'removed'
        ? 'Nice hit!'
        : 'Aim and throw — sink stones into the house.'

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
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Shots', value: state.shotsLeft, testId: 'shots' },
        { label: 'House', value: state.houseScore },
        { label: 'Best', value: best, testId: 'score', float: true },
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
        aria-label="Hogline board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-3"
        style={reduced ? undefined : { animation: 'hg-board-in .3s ease-out both' }}
        data-testid="hogline-board"
      >
        <svg
          ref={boardRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="mx-auto block w-full max-w-70"
          role="img"
          aria-label={`Ice sheet, ${state.stones.length} stones in play, target ${state.target} points`}
        >
          <rect x={0} y={0} width={VIEW_W} height={VIEW_H} rx={2} fill="rgba(255,255,255,0.035)" />
          <g transform={`translate(0 ${VIEW_H}) scale(1 -1)`}>
            {/* Side walls */}
            <rect
              x={0.3}
              y={0.3}
              width={VIEW_W - 0.6}
              height={VIEW_H - 0.6}
              fill="none"
              stroke="var(--border, rgba(255,255,255,0.15))"
              strokeWidth={0.4}
            />

            {/* House rings */}
            <circle cx={HOUSE_CENTER.x} cy={HOUSE_CENTER.y} r={HOUSE_R1} fill="var(--neon-blue)" fillOpacity={0.08} stroke="var(--neon-blue)" strokeOpacity={0.55} strokeWidth={0.35} />
            <circle cx={HOUSE_CENTER.x} cy={HOUSE_CENTER.y} r={HOUSE_R2} fill="var(--neon-cyan)" fillOpacity={0.1} stroke="var(--neon-cyan)" strokeOpacity={0.6} strokeWidth={0.35} />
            <circle cx={HOUSE_CENTER.x} cy={HOUSE_CENTER.y} r={HOUSE_R3} fill="var(--neon-amber)" fillOpacity={0.3} stroke="var(--neon-amber)" strokeOpacity={0.75} strokeWidth={0.35} />
            <circle cx={HOUSE_CENTER.x} cy={HOUSE_CENTER.y} r={0.6} fill="var(--neon-amber)" />

            {/* Hog line */}
            <line x1={0} y1={HOG_LINE_Y} x2={VIEW_W} y2={HOG_LINE_Y} stroke="var(--neon-red)" strokeOpacity={0.55} strokeWidth={0.5} strokeDasharray="2 1.4" />

            {/* Stones */}
            {state.stones.map((stone) => {
              const pos = displayPositions?.[stone.id] ?? stone.pos
              const fresh = !reduced && state.lastThrow?.newStoneId === stone.id
              return <StoneGlyph key={stone.id} stone={stone} pos={pos} fresh={fresh} reduced={reduced} />
            })}

            {/* Aim indicator */}
            {canAct && (
              <g aria-hidden="true">
                <line
                  x1={HACK_POS.x}
                  y1={HACK_POS.y}
                  x2={aimTip.x}
                  y2={aimTip.y}
                  stroke="var(--neon-lime)"
                  strokeWidth={0.5}
                  strokeLinecap="round"
                  opacity={0.85}
                />
                <circle cx={aimTip.x} cy={aimTip.y} r={0.9} fill="var(--neon-lime)" />
              </g>
            )}

            {/* Hack (launch point) — primary drag-to-aim target */}
            <circle
              cx={HACK_POS.x}
              cy={HACK_POS.y}
              r={STONE_RADIUS + 1.2}
              fill="transparent"
              stroke="var(--neon-lime)"
              strokeOpacity={canAct ? 0.7 : 0.25}
              strokeWidth={0.4}
              strokeDasharray="1.2 0.8"
              style={{ cursor: canAct ? 'grab' : 'default', touchAction: 'none' }}
              onPointerDown={onHackPointerDown}
              onPointerMove={onHackPointerMove}
              onPointerUp={onHackPointerUp}
              onPointerCancel={onHackPointerUp}
              data-testid="hack"
            />

            <Upright x={HOUSE_CENTER.x} y={HOG_LINE_Y - 2.2} fontSize={4} fill="var(--fg-muted, #8b93a7)">
              HOG LINE
            </Upright>
          </g>
        </svg>

        {/* Fallback / accessible controls */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/80 px-2 py-1.5">
            <span className="text-xs text-fg-muted">Power</span>
            <GameButton
              variant="ghost"
              className="px-2 py-1"
              disabled={!canAct}
              onClick={() => dispatch({ type: 'nudgePower', delta: -POWER_STEP })}
              aria-label="Decrease power"
            >
              −
            </GameButton>
            <span data-testid="power" className="w-10 text-center text-sm font-bold tabular-nums text-accent">
              {Math.round(state.power * 100)}%
            </span>
            <GameButton
              variant="ghost"
              className="px-2 py-1"
              disabled={!canAct}
              onClick={() => dispatch({ type: 'nudgePower', delta: POWER_STEP })}
              aria-label="Increase power"
            >
              +
            </GameButton>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/80 px-2 py-1.5">
            <span className="text-xs text-fg-muted">Angle</span>
            <GameButton
              variant="ghost"
              className="px-2 py-1"
              disabled={!canAct}
              onClick={() => dispatch({ type: 'nudgeAngle', delta: -ANGLE_STEP })}
              aria-label="Aim left"
            >
              ◀
            </GameButton>
            <span data-testid="angle" className="w-10 text-center text-sm font-bold tabular-nums text-accent">
              {state.angle}°
            </span>
            <GameButton
              variant="ghost"
              className="px-2 py-1"
              disabled={!canAct}
              onClick={() => dispatch({ type: 'nudgeAngle', delta: ANGLE_STEP })}
              aria-label="Aim right"
            >
              ▶
            </GameButton>
          </div>
          <GameButton onClick={() => dispatch({ type: 'release' })} disabled={!canAct} data-testid="throw">
            Throw
          </GameButton>
          <GameButton
            variant="ghost"
            onClick={() => dispatch({ type: 'bank' })}
            disabled={state.finished || state.shotsLeft === 0}
            data-testid="bank"
          >
            Bank Score
          </GameButton>
        </div>

        <GameOverlay show={state.finished} variant={won ? 'win' : 'lose'} title={won ? 'Target cleared!' : 'End of ends'} testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span> / Target{' '}
              <span className="font-bold text-accent">{state.target}</span>
            </p>
            <p>
              House <span className="font-bold text-accent">{state.houseScore}</span> pts · Shots used{' '}
              <span className="font-bold text-accent">{state.shotsUsed}</span>
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
                  const glyph = barGlyph(Math.min(10, Math.round(state.score / 10)), undefined, `${state.score} PTS · TARGET ${state.target}`)
                  return {
                    gameName: 'Hogline',
                    dateISO: todayUTC(),
                    accent: '#22d3ee',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/hogline`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Hogline',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      undefined,
                      won ? `cleared target ${state.target}` : `${state.score}/${state.target} pts`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes hg-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes hg-drop { from { opacity: .25; transform: scale(1.6) } to { opacity: 1; transform: scale(1) } }
        `}</style>
      </div>
    </GameShell>
  )
}
