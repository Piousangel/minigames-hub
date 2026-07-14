'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ghostPiece,
  gravityMs,
  hardDrop,
  HEIGHT,
  moveHorizontal,
  newGame,
  rotate,
  softDrop,
  tick,
  WIDTH,
  type Piece,
  type TetrisState,
} from '@/lib/games/tetris/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// 조각 id(1..7) → 색상. 위쪽 하이라이트 + 아래쪽 그림자로 입체감.
const PIECE_STYLE: Record<number, string> = {
  1: 'bg-cyan-400 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,0,0,0.28)]', // I
  2: 'bg-yellow-400 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,0,0,0.28)]', // O
  3: 'bg-purple-400 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,0,0,0.28)]', // T
  4: 'bg-green-400 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,0,0,0.28)]', // S
  5: 'bg-red-400 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,0,0,0.28)]', // Z
  6: 'bg-blue-400 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,0,0,0.28)]', // J
  7: 'bg-orange-400 shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-3px_0_rgba(0,0,0,0.28)]', // L
}

type CellView = { id: number; ghost?: boolean; lock?: boolean }

/** 보드 + 활성 조각 + 고스트 + 락 플래시를 하나의 렌더 그리드로 합성. */
function composeCells(state: TetrisState, showGhost: boolean): CellView[] {
  const cells: CellView[] = state.board.flat().map((v) => ({ id: v }))
  const at = (r: number, c: number) => r * WIDTH + c

  // 락 플래시(방금 고정된 셀)
  for (const { r, c } of state.lastLockedCells) {
    if (r >= 0 && r < HEIGHT && c >= 0 && c < WIDTH) cells[at(r, c)] = { id: cells[at(r, c)].id, lock: true }
  }

  // 고스트(착지 미리보기) — 빈 칸에만
  if (showGhost) {
    const ghost = ghostPiece(state)
    if (ghost) paint(ghost, (r, c, id) => {
      if (cells[at(r, c)].id === 0) cells[at(r, c)] = { id, ghost: true }
    })
  }

  // 활성 조각(고스트 위에 덮어씀)
  if (state.active) paint(state.active, (r, c, id) => {
    if (r >= 0 && r < HEIGHT && c >= 0 && c < WIDTH) cells[at(r, c)] = { id }
  })

  return cells
}

function paint(piece: Piece, fn: (r: number, c: number, id: number) => void) {
  for (let r = 0; r < piece.matrix.length; r++) {
    for (let c = 0; c < piece.matrix[r].length; c++) {
      const v = piece.matrix[r][c]
      if (v === 0) continue
      const br = piece.row + r
      const bc = piece.col + c
      if (br >= 0 && br < HEIGHT && bc >= 0 && bc < WIDTH) fn(br, bc, v)
    }
  }
}

/** 미리보기용 4x4 그리드로 정규화한 조각 셀. */
function previewCells(type: TetrisState['next']): number[] {
  const src = {
    I: [[1, 1, 1, 1]],
    O: [[2, 2], [2, 2]],
    T: [[0, 3, 0], [3, 3, 3]],
    S: [[0, 4, 4], [4, 4, 0]],
    Z: [[5, 5, 0], [0, 5, 5]],
    J: [[6, 0, 0], [6, 6, 6]],
    L: [[0, 0, 7], [7, 7, 7]],
  }[type]
  const grid = Array<number>(16).fill(0)
  const rowOff = Math.floor((4 - src.length) / 2)
  const colOff = Math.floor((4 - src[0].length) / 2)
  src.forEach((row, r) => row.forEach((v, c) => { if (v) grid[(r + rowOff) * 4 + (c + colOff)] = v }))
  return grid
}

export function GameTetris({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<TetrisState | null>(null)
  const [running, setRunning] = useState(false)
  const [best, setBest] = useState(0)
  const [flashKey, setFlashKey] = useState(0) // 라인 클리어 화면 연출 트리거

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()
  const stateRef = useRef<TetrisState | null>(null)

  const commit = useCallback((updater: (s: TetrisState) => TetrisState) => {
    setState((s) => {
      if (!s) return s
      const next = updater(s)
      stateRef.current = next
      return next
    })
  }, [])

  const restart = useCallback(() => {
    const s = newGame(Math.random)
    stateRef.current = s
    setState(s)
    setRunning(true)
  }, [])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) ? stored : 0)
  }, [restart, storageKey])

  const over = state?.over ?? false
  const level = state?.level ?? 1

  // 중력 루프 — 레벨에 따라 간격이 짧아진다.
  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => commit((s) => (s.over ? s : tick(s, Math.random))), gravityMs(level))
    return () => clearInterval(id)
  }, [running, over, level, commit])

  // 탭이 숨겨지면 일시정지.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setRunning(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Best 저장.
  useEffect(() => {
    if (state && state.score > best) {
      setBest(state.score)
      localStorage.setItem(storageKey, String(state.score))
    }
  }, [state, best, storageKey])

  // 사운드 + 라인 클리어 연출을 상태 전이에서 구동.
  const prevOver = useRef(false)
  useEffect(() => {
    if (!state) return
    if (state.lastClearedCount > 0) {
      play('merge')
      setFlashKey((k) => k + 1)
    } else if (state.lastLockedCells.length > 0) {
      play('move')
    }
    if (state.over && !prevOver.current) play('lose')
    prevOver.current = state.over
  }, [state, play])

  // --- 액션(사운드 즉시 반응) ---
  const act = useCallback(
    (fn: (s: TetrisState) => TetrisState, sound?: boolean) => {
      setRunning(true)
      let changed = false
      commit((s) => {
        if (s.over) return s
        const next = fn(s)
        changed = next !== s
        return next
      })
      if (changed && sound) play('move')
    },
    [commit, play],
  )

  const doMoveLeft = useCallback(() => act((s) => moveHorizontal(s, -1), true), [act])
  const doMoveRight = useCallback(() => act((s) => moveHorizontal(s, 1), true), [act])
  const doRotate = useCallback(() => act((s) => rotate(s), true), [act])
  const doSoftDrop = useCallback(() => act((s) => softDrop(s, Math.random)), [act])
  const doHardDrop = useCallback(() => act((s) => hardDrop(s, Math.random)), [act])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          doMoveLeft()
          break
        case 'ArrowRight':
          e.preventDefault()
          doMoveRight()
          break
        case 'ArrowUp':
          e.preventDefault()
          doRotate()
          break
        case 'ArrowDown':
          e.preventDefault()
          doSoftDrop()
          break
        case ' ':
          e.preventDefault()
          doHardDrop()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMoveLeft, doMoveRight, doRotate, doSoftDrop, doHardDrop])

  const hint = 'Arrow keys move/rotate, Down soft-drops, Space hard-drops. Use the buttons on mobile.'

  const stats = [
    { label: 'Score', value: state?.score ?? 0, testId: 'score', float: true },
    { label: 'Best', value: best },
    { label: 'Lines', value: state?.lines ?? 0 },
    { label: 'Level', value: level },
  ]

  if (!state) {
    return (
      <GameShell
        stats={stats}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="mx-auto aspect-[1/2] max-w-56 rounded-xl bg-surface" data-testid="tetris-loading" />
      </GameShell>
    )
  }

  const reduced = reducedRef.current
  const cells = composeCells(state, !reduced && !state.over)
  const preview = previewCells(state.next)

  return (
    <GameShell stats={stats} onNewGame={restart} muted={muted} onToggleMute={toggleMuted} hint={hint}>
      <div className="flex items-start justify-center gap-3">
        {/* 보드 */}
        <div
          className="anim-board-in relative rounded-xl bg-surface p-2"
          style={{ width: 'min(60vw, 260px)' }}
          data-testid="tetris-board"
        >
          <div
            key={flashKey}
            className={`grid aspect-[1/2] w-full gap-px overflow-hidden rounded-md ${flashKey && !reduced ? 'anim-pulse' : ''}`}
            style={{ gridTemplateColumns: `repeat(${WIDTH}, minmax(0, 1fr))` }}
          >
            {cells.map((cell, i) => {
              if (cell.id === 0) {
                return <div key={i} className="rounded-[2px] bg-white/[0.035]" />
              }
              if (cell.ghost) {
                return <div key={i} className="rounded-[2px] border border-white/25 bg-white/[0.06]" />
              }
              const style = PIECE_STYLE[cell.id]
              return (
                <div
                  key={i}
                  className={`rounded-[2px] ${style} ${cell.lock && !reduced ? 'anim-pop' : ''}`}
                />
              )
            })}
          </div>

          <GameOverlay show={state.over} variant="lose" title="Game over" testId="game-over">
            <p className="text-fg-muted">Score: {state.score}</p>
            <GameButton onClick={restart} className="px-4 py-2">
              Play again
            </GameButton>
          </GameOverlay>
        </div>

        {/* 사이드바: 다음 조각 미리보기 */}
        <div className="flex flex-col gap-2">
          <div className="rounded-lg bg-surface p-2">
            <p className="mb-1 text-center text-xs text-fg-muted">Next</p>
            <div className="grid grid-cols-4 gap-px" style={{ width: 64 }} data-testid="tetris-next">
              {preview.map((v, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-[2px] ${v ? PIECE_STYLE[v] : 'bg-white/[0.04]'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 터치 컨트롤 */}
      <div className="mx-auto mt-3 grid max-w-72 grid-cols-3 gap-2">
        <TouchButton label="◀" aria="Move left" onPress={doMoveLeft} />
        <TouchButton label="⟳" aria="Rotate" onPress={doRotate} />
        <TouchButton label="▶" aria="Move right" onPress={doMoveRight} />
        <TouchButton label="▼" aria="Soft drop" onPress={doSoftDrop} />
        <TouchButton label="⤓" aria="Hard drop" onPress={doHardDrop} className="col-span-2" />
      </div>
    </GameShell>
  )
}

function TouchButton({
  label,
  aria,
  onPress,
  className = '',
}: {
  label: string
  aria: string
  onPress: () => void
  className?: string
}) {
  return (
    <button
      aria-label={aria}
      onClick={onPress}
      className={`btn-press touch-none rounded-lg bg-surface py-3 text-xl font-bold text-fg hover:bg-white/10 ${className}`}
    >
      <span aria-hidden="true">{label}</span>
    </button>
  )
}
