'use client'

import { PlayZone, inPlayZone } from '@/components/game-shell/PlayZone'
import { useCallback, useEffect, useRef, useState } from 'react'
import { changeDir, GRID, newSnakeGame, tick, type Dir, type SnakeState } from '@/lib/games/snake/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const KEY_DIRS: Record<string, Dir> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

const TICK_MS = 130
/** 죽은 칸을 보여 줄 시간 — 이 뒤에 결과 오버레이(reduced-motion이면 즉시). */
export const DEATH_REVEAL_MS = 600

const STEP: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
// 머리 눈 2점 — 진행 방향 쪽으로 쏠린다(칸 크기 대비 %).
const EYES: Record<Dir, { left: string; top: string }[]> = {
  right: [{ left: '56%', top: '16%' }, { left: '56%', top: '62%' }],
  left: [{ left: '22%', top: '16%' }, { left: '22%', top: '62%' }],
  up: [{ left: '16%', top: '22%' }, { left: '62%', top: '22%' }],
  down: [{ left: '16%', top: '56%' }, { left: '62%', top: '56%' }],
}

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
  const { reducedRef } = useReducedMotion()
  // 죽는 순간 판을 바로 덮지 않는다: 충돌 칸이 깜빡이는 동안(DEATH_REVEAL_MS) 오버레이를 미룬다.
  const [overlayShown, setOverlayShown] = useState(false)
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 먹은 직후 머리 칸 펄스 — 먹은 그 칸 좌표. 다음 틱에 머리가 옮겨 가면 자연히 꺼진다.
  const [gulpAt, setGulpAt] = useState<string | null>(null)

  const clearOverlayTimer = () => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current)
    overlayTimer.current = null
  }
  useEffect(() => clearOverlayTimer, [])

  const restart = useCallback(() => {
    clearOverlayTimer()
    setOverlayShown(false)
    setGulpAt(null)
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
    if (state.score > prevScore.current) {
      play('eat')
      setGulpAt(`${state.snake[0].x},${state.snake[0].y}`)
    }
    prevScore.current = state.score
    if (state.over && !prevOver.current) {
      // 이 effect는 위의 best 갱신 effect보다 뒤에 선언돼 있어 플래그가 이미 서 있다.
      setNewBest(newBestRef.current)
      play(newBestRef.current ? 'win' : 'lose')
      recordFinish(storageKey.replace(/^best:/, ''))
      if (!muted) {
        try {
          navigator.vibrate?.(60)
        } catch {
          /* 진동 미지원·차단 — 무시 */
        }
      }
      clearOverlayTimer()
      if (reducedRef.current) setOverlayShown(true)
      else overlayTimer.current = setTimeout(() => setOverlayShown(true), DEATH_REVEAL_MS)
    }
    prevOver.current = state.over
  }, [state, play, storageKey, muted, reducedRef])

  const steer = useCallback((dir: Dir) => {
    setRunning(true)
    setState((s) => (s && !s.over ? changeDir(s, dir) : s))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return // 리더보드 이름 입력 등
      if (e.key === 'Enter' || e.key === ' ') {
        // 게임오버 결과가 떠 있을 때만 재시작. 버튼·링크에 포커스가 있으면 그쪽 기본 동작
        // (Try again 클릭, Next 링크 이동)에 맡긴다 — 이중 재시작·링크 가로채기 방지.
        if (!over || !overlayShown) return
        if (e.target instanceof Element && e.target.closest('button, a')) return
        e.preventDefault()
        restart()
        return
      }
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        steer(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steer, restart, over, overlayShown])

  const onTouchStart = (e: React.TouchEvent) => {
    if (!inPlayZone(e)) {
      touchStart.current = null // 가장자리 스크롤 띠에서 시작한 터치는 게임 입력이 아니다
      return
    }
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  // touchmove로 손을 떼기 전에 반응한다(실시간 게임이라 지연이 치명적). null 리셋은
  // 반드시 임계 통과 분기 안에서 — 앞에 두면 임계 미달 첫 이벤트가 시작점을 지워
  // 이후 touchmove가 전부 죽는다(1스와이프=1턴은 이 리셋 위치로 보장).
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.touches[0].clientX - touchStart.current.x
    const dy = e.touches[0].clientY - touchStart.current.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    touchStart.current = null
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const hint =
    running && !over ? (
      'Eat the food to grow — avoid the walls and your own tail.'
    ) : (
      <>
        {/* D-pad는 sm 미만에만 있다 */}
        <span className="sm:hidden">Swipe, use the D-pad, or press an arrow key to start.</span>
        <span className="hidden sm:inline">Press an arrow key to start.</span>
      </>
    )

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
        <div className="aspect-square rounded-xl bg-garden-cream-shade" data-testid="snake-loading" />
      </GameShell>
    )
  }

  const occupied = new Map<string, 'head' | 'body'>()
  state.snake.forEach((p, i) => occupied.set(`${p.x},${p.y}`, i === 0 ? 'head' : 'body'))
  const head = state.snake[0]
  // 충돌 칸: 머리가 가려던 칸. 판 안이면 부딪힌 몸통, 밖이면 벽(머리만 깜빡).
  const crash = { x: head.x + STEP[state.dir].x, y: head.y + STEP[state.dir].y }
  const crashKey = state.over && crash.x >= 0 && crash.x < GRID && crash.y >= 0 && crash.y < GRID ? `${crash.x},${crash.y}` : null
  const dying = state.over && !overlayShown
  const shortBy = best - state.score

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
        className="anim-board-in relative grid aspect-square gap-px rounded-xl bg-garden-cream-shade p-2"
        style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${GRID}, minmax(0, 1fr))` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        data-testid="snake-board"
      >
        <PlayZone />
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID
          const y = Math.floor(i / GRID)
          const key = `${x},${y}`
          const kind = occupied.get(key)
          const isFood = state.food.x === x && state.food.y === y
          if (kind === 'head') {
            return (
              <div
                key={i}
                data-testid="snake-head"
                data-dir={state.dir}
                className={`relative rounded-[4px] ${state.over ? 'bg-garden-danger-text' : 'bg-garden-leaf-text'} ${
                  dying ? 'anim-snake-blink' : !state.over && gulpAt === key ? 'anim-snake-gulp' : ''
                }`}
              >
                {EYES[state.dir].map((p, j) => (
                  <span key={j} aria-hidden="true" className="absolute h-[24%] w-[24%] rounded-full bg-garden-cream" style={p} />
                ))}
              </div>
            )
          }
          const crashed = key === crashKey
          return (
            <div
              key={i}
              data-testid={crashed ? 'snake-crash' : undefined}
              className={
                kind === 'body'
                  ? `rounded-[3px] bg-garden-leaf-deep ${crashed ? `ring-2 ring-inset ring-garden-danger-text ${dying ? 'anim-snake-blink' : ''}` : ''}`
                  : isFood
                    ? 'anim-pop rounded-full border-2 border-garden-ink bg-[radial-gradient(circle_at_35%_35%,var(--garden-apricot)_0%,var(--garden-apricot)_30%,var(--garden-coral)_75%)]'
                    : 'rounded-[2px] bg-garden-cream-2'
              }
            />
          )
        })}
        <GameOverlay
          show={state.over && overlayShown}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Game over'}
          testId="game-over"
          tone="cozy"
        >
          <p className="font-semibold tabular-nums">
            Score: {state.score} · Best: {best}
          </p>
          {!newBest && shortBy > 0 && (
            <p data-testid="snake-short-of-best" className="text-sm font-bold text-garden-coral-text">
              {shortBy} short of your best
            </p>
          )}
          <button
            type="button"
            onClick={restart}
            autoFocus
            className="btn-press inline-flex h-11 items-center justify-center rounded-full border-[3px] border-garden-ink bg-garden-sun px-5 text-sm font-bold text-garden-ink shadow-garden-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-coral-text focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <p className="hidden text-xs text-garden-ink-soft sm:block">or press Enter</p>
        </GameOverlay>
      </div>

      {/* 모바일 D-pad — 스와이프의 대체 조작(엄지 도달 범위) */}
      <div className="mt-4 flex justify-center sm:hidden">
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Direction pad">
          <span />
          <GameButton variant="ghost" aria-label="Steer up" onClick={() => steer('up')} className="px-4 py-3 text-lg">
            ↑
          </GameButton>
          <span />
          <GameButton variant="ghost" aria-label="Steer left" onClick={() => steer('left')} className="px-4 py-3 text-lg">
            ←
          </GameButton>
          <GameButton variant="ghost" aria-label="Steer down" onClick={() => steer('down')} className="px-4 py-3 text-lg">
            ↓
          </GameButton>
          <GameButton variant="ghost" aria-label="Steer right" onClick={() => steer('right')} className="px-4 py-3 text-lg">
            →
          </GameButton>
        </div>
      </div>
    </GameShell>
  )
}
