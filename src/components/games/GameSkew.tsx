'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createGame,
  resolveSteps,
  shear,
  WIDTH,
  HEIGHT,
  type Cell,
  type GameState,
  type Rng,
} from '@/lib/games/skew/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// 색 인덱스별 타일 — 색만이 아니라 글리프로도 구분(색약 접근성). gemmatch의 GEMS 관례를 따른다.
interface TileSpec {
  glyph: string
  color: string
  glow: string
  name: string
}
const TILES: TileSpec[] = [
  { glyph: '◆', color: '#22d3ee', glow: 'rgba(34,211,238,0.75)', name: 'cyan diamond' },
  { glyph: '●', color: '#f472b6', glow: 'rgba(244,114,182,0.75)', name: 'pink circle' },
  { glyph: '▲', color: '#facc15', glow: 'rgba(250,204,21,0.75)', name: 'yellow triangle' },
  { glyph: '★', color: '#4ade80', glow: 'rgba(74,222,128,0.75)', name: 'green star' },
  { glyph: '⬢', color: '#a78bfa', glow: 'rgba(167,139,250,0.75)', name: 'purple hexagon' },
]

const SHEAR_MS = 130
const SPAWN_MS = 160

const cellKey = (c: Cell) => `${c.row}-${c.col}`

// 컴포넌트 스코프 애니메이션(globals.css 미사용). transform/opacity만 사용.
const STYLES = `
@keyframes skPop { 0% { transform: scale(1); opacity: 1; } 40% { transform: scale(1.3); filter: brightness(1.9); } 100% { transform: scale(0.15); opacity: 0; } }
@keyframes skSpawn { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes skCombo { 0% { transform: translate(-50%,-50%) scale(0.6); opacity: 0; } 25% { transform: translate(-50%,-50%) scale(1.15); opacity: 1; } 80% { transform: translate(-50%,-60%) scale(1); opacity: 1; } 100% { transform: translate(-50%,-80%) scale(1); opacity: 0; } }
.sk-pop { animation: skPop ${SHEAR_MS}ms ease-in forwards; }
.sk-spawn { animation: skSpawn ${SPAWN_MS}ms ease-out; }
.sk-combo { animation: skCombo 620ms ease-out forwards; }
.sk-board { transition: transform ${SHEAR_MS}ms ease; }
@media (prefers-reduced-motion: reduce) {
  .sk-pop, .sk-spawn, .sk-combo { animation: none; }
  .sk-board { transition: none; }
}
`

export function GameSkew({ storageKey }: { storageKey: string }) {
  // SSR 안전: 보드는 클라이언트에서만 생성.
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState(0)
  const [ready, setReady] = useState(false)
  const [tiltDir, setTiltDir] = useState<0 | 1 | -1>(0)
  const [popCells, setPopCells] = useState<Set<string>>(new Set())
  const [spawnCells, setSpawnCells] = useState<Set<string>>(new Set())
  const [combo, setCombo] = useState<{ n: number; key: number } | null>(null)
  const [announce, setAnnounce] = useState('')
  const [newBest, setNewBest] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const bestRef = useRef(0)
  const busyRef = useRef(false)
  const comboSeq = useRef(0)
  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const sleep = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        if (reducedRef.current) resolve()
        else window.setTimeout(resolve, ms)
      }),
    [reducedRef],
  )

  const restart = useCallback(() => {
    busyRef.current = false
    setTiltDir(0)
    setPopCells(new Set())
    setSpawnCells(new Set())
    setCombo(null)
    setNewBest(false)
    setAnnounce('')
    commit(createGame(Math.random as Rng))
  }, [commit])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    const b = Number.isFinite(stored) ? stored : 0
    bestRef.current = b
    setBest(b)
    setReady(true)
  }, [restart, storageKey])

  const registerBest = useCallback(
    (score: number) => {
      if (score > bestRef.current) {
        bestRef.current = score
        setBest(score)
        localStorage.setItem(storageKey, String(score))
      }
    },
    [storageKey],
  )

  const onTilt = useCallback(
    async (dir: -1 | 1) => {
      const s = stateRef.current
      if (!s || s.over || busyRef.current) return
      busyRef.current = true
      const prevBest = bestRef.current

      const sheared = shear(s, dir)
      const { steps, grid, gained } = resolveSteps(sheared.grid, Math.random)
      const matched = steps.length > 0
      const comboStreak = matched ? sheared.comboStreak + 1 : 0
      const scoreGained = matched ? gained * comboStreak : 0
      const resolved: GameState = {
        ...sheared,
        grid,
        score: sheared.score + scoreGained,
        comboStreak,
        bestCombo: Math.max(sheared.bestCombo, comboStreak),
      }

      const firstWave = steps[0]
      const lastWave = steps[steps.length - 1]

      if (!reducedRef.current) {
        setTiltDir(dir)
        commit(sheared)
        if (firstWave) setPopCells(new Set(firstWave.matches.map(cellKey)))
        await sleep(SHEAR_MS)
        setTiltDir(0)
        setPopCells(new Set())
      }

      commit(resolved)
      if (!reducedRef.current && lastWave) {
        setSpawnCells(new Set(lastWave.spawned.map(cellKey)))
      }

      if (matched) {
        play(comboStreak >= 2 ? 'merge' : 'match')
        if (comboStreak >= 2) setCombo({ n: comboStreak, key: ++comboSeq.current })
      } else {
        play('move')
      }

      const totalCleared = steps.reduce((n, w) => n + w.matches.length, 0)
      setAnnounce(
        matched
          ? `Tilted ${dir > 0 ? 'right' : 'left'}. Cleared ${totalCleared} tiles, ${steps.length} wave${steps.length > 1 ? 's' : ''}.${comboStreak >= 2 ? ` Combo ×${comboStreak}.` : ''}`
          : `Tilted ${dir > 0 ? 'right' : 'left'}. No matches.`,
      )

      if (!reducedRef.current && lastWave) {
        await sleep(SPAWN_MS)
        setSpawnCells(new Set())
      }

      if (resolved.over) {
        const beat = resolved.score > prevBest
        setNewBest(beat)
        if (beat) registerBest(resolved.score)
        play('lose')
        recordFinish(storageKey.replace(/^best:/, ''))
      }

      busyRef.current = false
    },
    [commit, play, reducedRef, registerBest, sleep, storageKey],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        void onTilt(-1)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        void onTilt(1)
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        restart()
      }
    },
    [onTilt, restart],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      dragRef.current = null
      if (!d || (state && state.over)) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        void onTilt(dx > 0 ? 1 : -1)
      }
    },
    [onTilt, state],
  )

  const score = state?.score ?? 0
  const movesLeft = state?.movesLeft ?? 0
  const over = state?.over ?? false

  const hint = over
    ? 'Round over — press New Game.'
    : 'Tilt left or right. Same-color runs of 3+ clear.'

  const grid = state?.grid ?? emptyGrid()
  const tiltDeg = tiltDir === 0 ? 0 : tiltDir * 4

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Moves', value: movesLeft, testId: 'moves' },
      ]}
      headerExtra={
        combo &&
        combo.n >= 2 && (
          <span data-testid="combo" className="neon-text font-bold text-accent">
            Combo ×{combo.n}
          </span>
        )
      }
      onNewGame={restart}
      newGameLabel={over ? 'Play again' : 'New Game'}
      newGameDisabled={!ready}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{STYLES}</style>
      <div className="anim-board-in relative w-full">
        <div
          role="group"
          aria-label="Skew board"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="relative w-full touch-pan-y select-none rounded-xl bg-surface p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
          style={{ touchAction: 'pan-y' }}
        >
          <div
            data-testid="skew-board"
            aria-hidden="true"
            className="sk-board grid w-full"
            style={{
              aspectRatio: `${WIDTH} / ${HEIGHT}`,
              gridTemplateColumns: `repeat(${WIDTH}, 1fr)`,
              gridTemplateRows: `repeat(${HEIGHT}, 1fr)`,
              gap: 4,
              transform: tiltDeg ? `skewX(${tiltDeg}deg)` : undefined,
            }}
          >
            {grid.map((row, r) =>
              row.map((color, c) => {
                const tile = TILES[((color % TILES.length) + TILES.length) % TILES.length]
                const key = `${r}-${c}`
                const isPop = popCells.has(key)
                const isSpawn = spawnCells.has(key)
                return (
                  <div
                    key={key}
                    className="relative flex items-center justify-center rounded-md"
                    style={{
                      background: `${tile.color}1f`,
                      boxShadow: `inset 0 0 0 1px ${tile.color}55`,
                    }}
                  >
                    {color >= 0 && (
                      <span
                        className={`pointer-events-none leading-none ${isPop ? 'sk-pop' : ''} ${isSpawn ? 'sk-spawn' : ''}`}
                        style={{
                          color: tile.color,
                          fontSize: 'clamp(10px, 3.2vw, 22px)',
                          textShadow: `0 0 6px ${tile.glow}`,
                        }}
                      >
                        {tile.glyph}
                      </span>
                    )}
                  </div>
                )
              }),
            )}
          </div>

          {combo && !reducedRef.current && (
            <span
              key={combo.key}
              aria-hidden="true"
              className="sk-combo neon-text-strong pointer-events-none absolute left-1/2 top-1/2 z-[3] text-3xl font-extrabold text-accent"
            >
              Combo ×{combo.n}
            </span>
          )}

          <span className="sr-only" aria-live="polite">
            {announce}
          </span>
        </div>

        <div className="mt-3 flex justify-center gap-3">
          <GameButton
            variant="ghost"
            onClick={() => void onTilt(-1)}
            disabled={over || !ready}
            aria-label="Tilt left"
            className="px-5 py-2.5 text-base"
          >
            ⬅ Tilt Left
          </GameButton>
          <GameButton
            variant="ghost"
            onClick={() => void onTilt(1)}
            disabled={over || !ready}
            aria-label="Tilt right"
            className="px-5 py-2.5 text-base"
          >
            Tilt Right ➡
          </GameButton>
        </div>

        <GameOverlay
          show={over}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Out of moves'}
          testId="game-over"
        >
          <p className="text-fg-muted">Final score: {score}</p>
          <p className="text-fg-muted">Best combo: ×{state?.bestCombo ?? 0}</p>
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}

function emptyGrid(): number[][] {
  return Array.from({ length: HEIGHT }, () => new Array<number>(WIDTH).fill(-1))
}
