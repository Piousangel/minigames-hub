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
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'
import { GatePanel, PauseButton } from '@/components/game-shell/GatePanel'
import { useGameGate, type GatePhase } from '@/lib/useGameGate'

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
  const [best, setBest] = useState(0)
  const newBestRef = useRef(false)
  const [newBest, setNewBest] = useState(false)
  const [flashKey, setFlashKey] = useState(0) // 라인 클리어 화면 연출 트리거

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()
  const stateRef = useRef<TetrisState | null>(null)

  // 시작 게이트 + 일시정지(R1). 로드 즉시 조각이 떨어지던 문제와, 탭 복귀 뒤 아무 키가
  // '재개 + 조각 이동'을 동시에 하던 문제(옛 act의 setRunning(true))를 고친다.
  const gate = useGameGate({ canPause: () => !stateRef.current?.over })
  const gatePhaseRef = gate.phaseRef

  const commit = useCallback((updater: (s: TetrisState) => TetrisState) => {
    setState((s) => {
      if (!s) return s
      const next = updater(s)
      stateRef.current = next
      return next
    })
  }, [])

  const fresh = useCallback(() => {
    const s = newGame(Math.random)
    stateRef.current = s
    setState(s)
    newBestRef.current = false
    setNewBest(false)
  }, [])

  // Play again·New Game은 게이트를 다시 거치지 않는다.
  const restart = useCallback(() => {
    fresh()
    gate.reset('running')
  }, [fresh, gate])

  // 마운트: 판만 만들고 ready에서 기다린다.
  useEffect(() => {
    fresh()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) ? stored : 0)
  }, [fresh, storageKey])

  const over = state?.over ?? false
  const level = state?.level ?? 1

  // 중력 루프 — 레벨에 따라 간격이 짧아진다. running일 때만(탭 숨김 정지는 useGameGate가 맡는다).
  const running = gate.phase === 'running'
  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => commit((s) => (s.over ? s : tick(s, Math.random))), gravityMs(level))
    return () => clearInterval(id)
  }, [running, over, level, commit])

  // Best 저장. 죽는 순간에 score와 best를 비교하면 안 된다 — 그땐 이미 같아져 있다.
  // 경신이 실제로 일어나는 이 지점에서 플래그를 세운다(GameTowerStack과 같은 방식).
  useEffect(() => {
    if (state && state.score > best) {
      setBest(state.score)
      localStorage.setItem(storageKey, String(state.score))
      newBestRef.current = true
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
    if (state.over && !prevOver.current) {
      // 이 effect는 위의 best 갱신 effect보다 뒤에 선언돼 있어 플래그가 이미 서 있다.
      setNewBest(newBestRef.current)
      play(newBestRef.current ? 'win' : 'lose')
      recordFinish(storageKey.replace(/^best:/, ''))
    }
    prevOver.current = state.over
  }, [state, play, storageKey])

  // --- 액션(사운드 즉시 반응) ---
  const act = useCallback(
    (fn: (s: TetrisState) => TetrisState, sound?: boolean) => {
      const p = gatePhaseRef.current
      if (p === 'paused' || p === 'countdown') return // 멈춘 동안의 입력은 버린다(재개는 Resume·P만)
      if (p === 'ready') gate.start() // 첫 입력은 시작이면서 그대로 조작이다(Space·Enter 제외, 아래)
      let changed = false
      commit((s) => {
        if (s.over) return s
        const next = fn(s)
        changed = next !== s
        return next
      })
      if (changed && sound) play('move')
    },
    [commit, gate, gatePhaseRef, play],
  )

  const doMoveLeft = useCallback(() => act((s) => moveHorizontal(s, -1), true), [act])
  const doMoveRight = useCallback(() => act((s) => moveHorizontal(s, 1), true), [act])
  const doRotate = useCallback(() => act((s) => rotate(s), true), [act])
  const doSoftDrop = useCallback(() => act((s) => softDrop(s, Math.random)), [act])
  const doHardDrop = useCallback(() => act((s) => hardDrop(s, Math.random)), [act])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return // 포커스된 Resume·⏸는 Space/Enter로 눌려야 한다
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
          // ready에서 Space는 '시작'이 1순위 의도 — 첫 조각을 하드드롭하지 않는다(리뷰 4).
          if (gatePhaseRef.current === 'ready') gate.start()
          else doHardDrop()
          break
        case 'Enter':
          if (gatePhaseRef.current === 'ready' && e.target === document.body) {
            e.preventDefault()
            gate.start()
          }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMoveLeft, doMoveRight, doRotate, doSoftDrop, doHardDrop, gate, gatePhaseRef])

  const hint = 'Arrow keys move/rotate, Down soft-drops, Space hard-drops, P pauses. Use the buttons on mobile.'
  const pauseBtn = <PauseButton phase={gate.phase} show={!over} onPause={() => gate.pause('manual')} />

  // 헤더에는 Score만(compactHeader 한 줄·고정 높이). Best·Lines·Level은 판 옆 고정 폭 칸으로 — 4칸이 헤더에 있으면
  // 좁은 폰에서 헤더가 2~4줄로 접혀 조작 버튼이 첫 화면 밖으로 밀리고, 자릿수가 늘 때마다 판이 내려갔다(#253).
  const stats = [{ label: 'Score', value: state?.score ?? 0, testId: 'score', float: true }]
  const sideStats = [
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
        compactHeader
      >
        <div className="mx-auto aspect-[1/2] max-w-56 rounded-xl bg-surface" data-testid="tetris-loading" />
      </GameShell>
    )
  }

  const reduced = reducedRef.current
  const cells = composeCells(state, !reduced && !state.over)
  const preview = previewCells(state.next)

  return (
    <GameShell
      stats={stats}
      headerActions={pauseBtn}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      compactHeader
    >
      <div className="flex items-start justify-center gap-3">
        {/* 보드 */}
        <div
          className="anim-board-in relative rounded-xl bg-surface p-2"
          // 키 작은 폰(360×740)에서 조작 버튼까지 첫 화면에 들게 높이로도 줄인다(판 높이 ≈ 폭×2). 180px 아래로는 줄이지 않는다.
          style={{ width: 'min(60vw, 260px, max(180px, calc(50svh - 166px)))' }}
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

          {!state.over && (
            <GatePanel
              phase={gate.phase}
              count={gate.count}
              onStart={gate.start}
              onResume={gate.resume}
              title="Ready?"
              hint="Tap Play or press any arrow key. ← → move, ↑ rotates, Space drops."
            />
          )}
          {/* 결과 시트 자리: 판 위쪽 40%는 비워 마지막으로 꼭대기까지 쌓인 모습이 보이게 한다(#253).
              시트가 자리보다 크면 GameOverlay가 자리 최소 높이를 늘려 아래(조작 버튼 쪽)로 뻗는다. */}
          {state.over && (
            <div className="absolute inset-x-0 bottom-0 top-[40%]" data-testid="tetris-result-seat">
              <GameOverlay
                show={state.over}
                variant={newBest ? 'win' : 'lose'}
                title={newBest ? 'New best!' : 'Game over'}
                testId="game-over"
                compact
              >
                <p className="text-fg-muted">
                  Score: {state.score} · Best: {best}
                </p>
                <GameButton onClick={restart} className="px-4 py-2">
                  Play again
                </GameButton>
              </GameOverlay>
            </div>
          )}
        </div>

        {/* 사이드바: 다음 조각 미리보기 + Best·Lines·Level(고정 폭·tabular-nums — 자릿수가 늘어도 판이 움직이지 않는다) */}
        <div className="flex w-20 shrink-0 flex-col gap-2">
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
          {sideStats.map((s) => (
            <div key={s.label} className="rounded-lg bg-surface px-2 py-1.5 text-center">
              <p className="text-xs text-fg-muted">{s.label}</p>
              <p className="font-bold tabular-nums text-accent" data-tetris-stat={s.label.toLowerCase()}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 모바일 터치 컨트롤 — 5칸 같은 폭(320 폭에서도 칸마다 44px 이상) */}
      <div className="mx-auto mt-3 grid max-w-sm grid-cols-5 gap-2">
        <TouchButton phase={gate.phase} label="◀" aria="Move left" onPress={doMoveLeft} repeat />
        <TouchButton phase={gate.phase} label="⟳" aria="Rotate" onPress={doRotate} />
        <TouchButton phase={gate.phase} label="▶" aria="Move right" onPress={doMoveRight} repeat />
        <TouchButton phase={gate.phase} label="▼" aria="Soft drop" onPress={doSoftDrop} repeat />
        <TouchButton phase={gate.phase} label="⤓" aria="Hard drop" onPress={doHardDrop} />
      </div>
    </GameShell>
  )
}

function TouchButton({
  phase,
  label,
  aria,
  onPress,
  className = '',
  repeat = false,
}: {
  phase: GatePhase
  label: string
  aria: string
  onPress: () => void
  className?: string
  repeat?: boolean
}) {
  const timeoutRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const cls = `btn-press touch-none rounded-lg bg-surface py-3 text-xl font-bold text-fg hover:bg-white/10 ${className}`

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // 언마운트 시 인터벌 누수 방지(세션 넘어 잔존 금지).
  useEffect(() => clear, [clear])
  // 누른 채로 일시정지(탭 숨김 등)되면 pointerup을 놓칠 수 있다 — 반복을 끊어 재개 뒤 저절로 움직이지 않게(리뷰 2).
  useEffect(() => {
    if (phase !== 'running' && phase !== 'ready') clear()
  }, [phase, clear])

  if (!repeat) {
    return (
      <button aria-label={aria} onClick={onPress} className={cls}>
        <span aria-hidden="true">{label}</span>
      </button>
    )
  }

  // 홀드 반복(DAS): 즉시 1회 → 200ms 후 110ms 간격. click 대신 pointerdown만
  // 쓰고 preventDefault로 합성 click 이중 발화를 막는다.
  const startRepeat = (e: React.PointerEvent) => {
    e.preventDefault()
    onPress()
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(onPress, 110)
    }, 200)
  }

  return (
    <button
      aria-label={aria}
      onPointerDown={startRepeat}
      onPointerUp={clear}
      onPointerCancel={clear}
      onPointerLeave={clear}
      className={cls}
    >
      <span aria-hidden="true">{label}</span>
    </button>
  )
}
