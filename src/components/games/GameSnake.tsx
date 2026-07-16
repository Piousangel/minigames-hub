'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { changeDir, GRID, newSnakeGame, tick, type Dir, type SnakeState } from '@/lib/games/snake/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const KEY_DIRS: Record<string, Dir> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

const TICK_MS = 130

export function GameSnake({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<SnakeState | null>(null)
  const [running, setRunning] = useState(false)
  const [best, setBest] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const prevScore = useRef(0)
  const prevOver = useRef(false)
  // 죽는 순간에 score와 best를 비교하면 안 된다 — best는 그전에 이미 갱신돼 같아진다.
  // 경신이 실제로 일어나는 지점에서 플래그를 세운다(GameTowerStack과 같은 방식).
  const newBestRef = useRef(false)
  const [newBest, setNewBest] = useState(false)

  const restart = useCallback(() => {
    setState(newSnakeGame(Math.random))
    setRunning(false)
    prevScore.current = 0
    prevOver.current = false
    newBestRef.current = false
    setNewBest(false)
  }, [])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) ? stored : 0)
  }, [restart, storageKey])

  const over = state?.over ?? false

  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => setState((s) => (s && !s.over ? tick(s, Math.random) : s)), TICK_MS)
    return () => clearInterval(id)
  }, [running, over])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setRunning(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (state && state.score > best) {
      setBest(state.score)
      localStorage.setItem(storageKey, String(state.score))
      newBestRef.current = true
    }
  }, [state, best, storageKey])

  // Sound cues driven off state transitions.
  useEffect(() => {
    if (!state) return
    if (state.score > prevScore.current) play('eat')
    prevScore.current = state.score
    if (state.over && !prevOver.current) {
      // 이 effect는 위의 best 갱신 effect보다 뒤에 선언돼 있어 플래그가 이미 서 있다.
      setNewBest(newBestRef.current)
      play(newBestRef.current ? 'win' : 'lose')
    }
    prevOver.current = state.over
  }, [state, play])

  const steer = useCallback((dir: Dir) => {
    setRunning(true)
    setState((s) => (s && !s.over ? changeDir(s, dir) : s))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        steer(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steer])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const hint = 'Press an arrow key (or swipe) to start.'

  if (!state) {
    return (
      <GameShell
        stats={[
          { label: 'Score', value: 0, testId: 'score', float: true },
          { label: 'Best', value: best },
        ]}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="aspect-square rounded-xl bg-surface" data-testid="snake-loading" />
      </GameShell>
    )
  }

  const occupied = new Map<string, 'head' | 'body'>()
  state.snake.forEach((p, i) => occupied.set(`${p.x},${p.y}`, i === 0 ? 'head' : 'body'))

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
        className="anim-board-in relative grid aspect-square touch-none gap-px rounded-xl bg-surface p-2"
        style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="snake-board"
      >
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID
          const y = Math.floor(i / GRID)
          const kind = occupied.get(`${x},${y}`)
          const isFood = state.food.x === x && state.food.y === y
          return (
            <div
              key={i}
              className={
                kind === 'head'
                  ? 'rounded-[3px] bg-accent shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                  : kind === 'body'
                    ? 'rounded-[2px] bg-accent/70'
                    : isFood
                      ? 'anim-pop rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                      : 'rounded-[2px] bg-white/[0.04]'
              }
            />
          )
        })}
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
      </div>
    </GameShell>
  )
}
