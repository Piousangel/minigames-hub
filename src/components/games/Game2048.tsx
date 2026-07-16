'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { applyMove, move, newGame, type Direction, type GameState } from '@/lib/games/g2048/engine'
import type { Theme2048 } from '@/lib/games/g2048/themes'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'
import { findSpawn, planMove, tilesFromBoard, type Tile } from './tiles2048'

const KEY_DIRS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

const GAP = 8 // px — matches the board's gap-2 background grid
const SLIDE_MS = 130

const TILE_STYLES: Record<number, string> = {
  2: 'bg-amber-100 text-stone-800',
  4: 'bg-amber-200 text-stone-800',
  8: 'bg-orange-300 text-stone-900',
  16: 'bg-orange-400 text-white',
  32: 'bg-orange-500 text-white',
  64: 'bg-red-500 text-white',
  128: 'bg-yellow-400 text-stone-900',
  256: 'bg-yellow-500 text-stone-900',
  512: 'bg-yellow-600 text-white',
  1024: 'bg-amber-600 text-white',
  2048: 'bg-accent text-stone-900',
}

function faceAnimClass(animKey: string): string {
  if (animKey.startsWith('m')) return 'anim-pop'
  if (animKey.startsWith('s')) return 'anim-spawn'
  return ''
}

function fontSize(label: string): string {
  if (label.length <= 2) return 'text-2xl'
  if (label.length === 3) return 'text-xl'
  return 'text-base'
}

export function Game2048({ theme, storageKey }: { theme: Theme2048; storageKey: string }) {
  // SSR 불일치 방지: 초기 보드는 클라이언트에서만 생성
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const bestRef = useRef(0) // 지속 best를 미러 — 이동 핸들러에서 동기 비교(이펙트 순서 회피)
  const newBestRef = useRef(false) // 이 게임에서 기록을 깼는지 latch. game-over 시점 비교는 best가 이미 올라 항상 틀리다
  const [wonSeen, setWonSeen] = useState(false)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [cell, setCell] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const boardInnerRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const tilesRef = useRef<Tile[]>([])
  const idRef = useRef(0)
  const animSeqRef = useRef(0)
  const animatingRef = useRef(false)
  const queuedRef = useRef<Direction | null>(null)
  const wonSeenRef = useRef(false)

  const nextId = useCallback(() => ++idRef.current, [])
  const commitTiles = useCallback((next: Tile[]) => {
    tilesRef.current = next
    setTiles(next)
  }, [])
  const commitState = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const restart = useCallback(() => {
    animatingRef.current = false
    queuedRef.current = null
    wonSeenRef.current = false
    setWonSeen(false)
    newBestRef.current = false
    setNewBest(false)
    const s = newGame(Math.random)
    commitState(s)
    commitTiles(tilesFromBoard(s.board, nextId, true))
  }, [commitState, commitTiles, nextId])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    const b = Number.isFinite(stored) ? stored : 0
    setBest(b)
    bestRef.current = b
  }, [restart, storageKey])

  useEffect(() => {
    if (state && state.score > best) {
      setBest(state.score)
      bestRef.current = state.score
      localStorage.setItem(storageKey, String(state.score))
    }
  }, [state, best, storageKey])

  // Measure the tile layer so tiles can be positioned with px transforms.
  useLayoutEffect(() => {
    const el = boardInnerRef.current
    if (!el) return
    const measure = () => setCell(Math.max(0, (el.clientWidth - GAP * 3) / 4))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [state !== null])

  const performMove = useCallback(
    (dir: Direction) => {
      const s = stateRef.current
      if (!s) return
      const { board: slid, moved } = applyMove(s.board, dir)
      if (!moved) return
      play('move')

      const plan = planMove(tilesRef.current, dir)
      const newEngine = move(s, dir, Math.random)
      const spawn = findSpawn(slid, newEngine.board)

      const finish = () => {
        const survivors = tilesRef.current
          .filter((t) => !plan.deadIds.has(t.id))
          .map((t) => {
            const pos = plan.positions.get(t.id)
            const merged = plan.merges.find((m) => m.survivorId === t.id)
            if (merged) {
              return { ...t, row: pos?.row ?? t.row, col: pos?.col ?? t.col, value: merged.newValue, animKey: `m${++animSeqRef.current}` }
            }
            return pos ? { ...t, row: pos.row, col: pos.col } : t
          })
        if (spawn) {
          survivors.push({ id: nextId(), value: spawn.value, row: spawn.row, col: spawn.col, animKey: 's', enterDelay: 0 })
        }
        commitTiles(survivors)
        commitState(newEngine)

        // 기록 갱신을 동기적으로 latch — 아래 사운드가 이 값을 바로 읽는다.
        if (newEngine.score > bestRef.current) newBestRef.current = true

        if (plan.merges.length) play('merge')
        if (newEngine.won && !s.won) play('win')
        else if (newEngine.over) {
          setNewBest(newBestRef.current)
          play(newBestRef.current ? 'win' : 'lose')
        }

        animatingRef.current = false
        const queued = queuedRef.current
        queuedRef.current = null
        if (queued) performMove(queued)
      }

      if (reducedRef.current) {
        finish()
        return
      }

      // Phase 1: slide every tile to its target (values unchanged).
      animatingRef.current = true
      commitTiles(
        tilesRef.current.map((t) => {
          const pos = plan.positions.get(t.id)
          return pos ? { ...t, row: pos.row, col: pos.col } : t
        }),
      )
      // Phase 2: settle (merge pop, remove consumed tiles, spawn new tile).
      window.setTimeout(finish, SLIDE_MS)
    },
    [commitState, commitTiles, nextId, play, reducedRef],
  )

  const doMove = useCallback(
    (dir: Direction) => {
      const s = stateRef.current
      if (!s || s.over) return
      if (s.won && !wonSeenRef.current) return // win overlay is blocking input
      if (animatingRef.current) {
        queuedRef.current = dir
        return
      }
      performMove(dir)
    },
    [performMove],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        doMove(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMove])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const keepGoing = () => {
    wonSeenRef.current = true
    setWonSeen(true)
  }

  const hint = 'Arrow keys or swipe to move the tiles.'

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-2 text-sm">
            <div className="rounded-lg bg-surface px-3 py-1.5">
              Score <span className="font-bold">0</span>
            </div>
            <div className="rounded-lg bg-surface px-3 py-1.5">
              Best <span className="font-bold">0</span>
            </div>
          </div>
          <button disabled className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-stone-900 opacity-50">
            New Game
          </button>
        </div>
        <div className="aspect-square w-full rounded-xl bg-surface p-2" data-testid="board-loading" />
        <p className="mt-3 text-center text-sm text-fg-muted">{hint}</p>
      </div>
    )
  }

  const winOverlayVisible = state.won && !wonSeen && !state.over

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Best', value: best },
      ]}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <div
        className="anim-board-in relative aspect-square w-full touch-none rounded-xl bg-surface p-2"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="board"
      >
        {/* Background grid — the empty slots (depth) */}
        <div className="grid h-full w-full grid-cols-4 gap-2">
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} data-testid="cell" className="rounded-lg bg-white/[0.04] shadow-inner" />
          ))}
        </div>

        {/* Tile layer — absolutely positioned, animated */}
        <div ref={boardInnerRef} className="pointer-events-none absolute inset-2">
          {tiles.map((tile) => {
            const label = theme.tiles[tile.value] ?? String(tile.value)
            const style = TILE_STYLES[tile.value] ?? TILE_STYLES[2048]
            const glow = tile.value >= 1024 ? 'shadow-[0_0_18px_rgba(245,158,11,0.55)]' : 'shadow-md'
            return (
              <div
                key={tile.id}
                data-testid="tile"
                className="tile-slide absolute left-0 top-0"
                style={{
                  width: cell,
                  height: cell,
                  transform: `translate(${tile.col * (cell + GAP)}px, ${tile.row * (cell + GAP)}px)`,
                  visibility: cell > 0 ? 'visible' : 'hidden',
                }}
              >
                <div
                  key={tile.animKey}
                  className={`flex h-full w-full items-center justify-center rounded-lg font-bold ${fontSize(label)} ${style} ${glow} ${faceAnimClass(tile.animKey)}`}
                  style={tile.enterDelay ? { animationDelay: `${tile.enterDelay}ms` } : undefined}
                >
                  {label}
                </div>
              </div>
            )
          })}
        </div>

        <GameOverlay
          show={state.over}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Game over'}
          testId="game-over"
        >
          <p className="text-fg-muted">
            Score: {state.score} · Best: {best}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>

        <GameOverlay show={winOverlayVisible} variant="win" title="You win!" testId="you-win">
          <div className="flex gap-2">
            <GameButton variant="ghost" onClick={keepGoing} className="px-4 py-2">
              Keep going
            </GameButton>
            <GameButton onClick={restart} className="px-4 py-2">
              New Game
            </GameButton>
          </div>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
