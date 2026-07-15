'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  SIZE,
  hasPossibleMove,
  newGame,
  resolveSteps,
  shuffleBoard,
  swap,
  type Cell,
  type GameState,
} from '@/lib/games/gemmatch/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// 색 인덱스별 젬 — 색만이 아니라 글리프/모양으로도 구분(색맹 접근성).
interface GemSpec {
  glyph: string
  color: string
  glow: string
  name: string
}
const GEMS: GemSpec[] = [
  { glyph: '◆', color: '#22d3ee', glow: 'rgba(34,211,238,0.75)', name: 'cyan diamond' },
  { glyph: '●', color: '#f472b6', glow: 'rgba(244,114,182,0.75)', name: 'pink circle' },
  { glyph: '▲', color: '#facc15', glow: 'rgba(250,204,21,0.75)', name: 'yellow triangle' },
  { glyph: '★', color: '#4ade80', glow: 'rgba(74,222,128,0.75)', name: 'green star' },
  { glyph: '⬢', color: '#a78bfa', glow: 'rgba(167,139,250,0.75)', name: 'purple hexagon' },
  { glyph: '♥', color: '#fb7185', glow: 'rgba(251,113,133,0.75)', name: 'red heart' },
]

const GAP = 6 // px, 셀 사이 간격(스왑 슬라이드 거리 계산에 사용)
const SWAP_MS = 170
const POP_MS = 210
const DROP_MS = 240

const cellKey = (c: Cell) => `${c.row}-${c.col}`

// 컴포넌트 스코프 애니메이션(globals.css 미사용).
const STYLES = `
@keyframes gmSlide { from { transform: translate(0,0); } to { transform: translate(var(--gx,0), var(--gy,0)); } }
@keyframes gmSlideBack { 0% { transform: translate(0,0); } 50% { transform: translate(var(--gx,0), var(--gy,0)); } 100% { transform: translate(0,0); } }
@keyframes gmDrop { from { transform: translateY(-42%); opacity: 0.15; } to { transform: translateY(0); opacity: 1; } }
@keyframes gmPop { 0% { transform: scale(1); } 35% { transform: scale(1.28); filter: brightness(1.9); } 100% { transform: scale(0); opacity: 0; } }
@keyframes gmBurst { from { transform: scale(0.3); opacity: 0.85; } to { transform: scale(2.1); opacity: 0; } }
@keyframes gmCombo { 0% { transform: translate(-50%,-50%) scale(0.6); opacity: 0; } 25% { transform: translate(-50%,-50%) scale(1.15); opacity: 1; } 80% { transform: translate(-50%,-60%) scale(1); opacity: 1; } 100% { transform: translate(-50%,-80%) scale(1); opacity: 0; } }
.gm-slide { animation: gmSlide ${SWAP_MS}ms ease forwards; }
.gm-slide-back { animation: gmSlideBack ${SWAP_MS * 2}ms ease; }
.gm-drop { animation: gmDrop ${DROP_MS}ms cubic-bezier(0.34,1.3,0.5,1); }
.gm-pop { animation: gmPop ${POP_MS}ms ease-in forwards; z-index: 2; }
.gm-burst { animation: gmBurst ${POP_MS + 60}ms ease-out forwards; }
.gm-combo { animation: gmCombo 620ms ease-out forwards; }
@media (prefers-reduced-motion: reduce) {
  .gm-slide, .gm-slide-back, .gm-drop, .gm-pop, .gm-burst, .gm-combo { animation: none; }
}
`

export function GameGemMatch({ storageKey }: { storageKey: string }) {
  // SSR 안전: 보드는 클라이언트에서만 생성.
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState(0)
  const [ready, setReady] = useState(false)
  const [selected, setSelected] = useState<Cell | null>(null)
  const [popping, setPopping] = useState<Set<string>>(new Set())
  const [swapAnim, setSwapAnim] = useState<{ a: Cell; b: Cell; invalid: boolean } | null>(null)
  const [dropKey, setDropKey] = useState(0)
  const [combo, setCombo] = useState<{ n: number; key: number } | null>(null)
  const [finished, setFinished] = useState<null | 'over'>(null)
  const [newBest, setNewBest] = useState(false)
  const [metrics, setMetrics] = useState({ cell: 0, stride: 0 })

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const boardRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const bestRef = useRef(0)
  const busyRef = useRef(false)
  const comboSeq = useRef(0)
  const dragRef = useRef<{ cell: Cell; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const strideRef = useRef(0)

  const commitState = useCallback((s: GameState) => {
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
    setSelected(null)
    setPopping(new Set())
    setSwapAnim(null)
    setCombo(null)
    setFinished(null)
    setNewBest(false)
    commitState(newGame(Math.random))
  }, [commitState])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    const b = Number.isFinite(stored) ? stored : 0
    bestRef.current = b
    setBest(b)
    setReady(true)
  }, [restart, storageKey])

  // 셀 크기/슬라이드 거리 측정(반응형).
  const hasBoard = state !== null
  useLayoutEffect(() => {
    const el = boardRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const cell = Math.max(0, (w - GAP * (SIZE - 1)) / SIZE)
      const stride = cell + GAP
      strideRef.current = stride
      setMetrics({ cell, stride })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasBoard])

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

  const attemptSwap = useCallback(
    async (a: Cell, b: Cell) => {
      const s = stateRef.current
      if (!s || s.over || busyRef.current) return
      const prevBest = bestRef.current
      const { state: swapped, valid } = swap(s, a, b)
      setSelected(null)

      if (!valid) {
        play('error')
        setSwapAnim({ a, b, invalid: true })
        await sleep(SWAP_MS * 2)
        setSwapAnim(null)
        return
      }

      busyRef.current = true
      play('flip')
      if (!reducedRef.current) {
        setSwapAnim({ a, b, invalid: false })
        await sleep(SWAP_MS)
        setSwapAnim(null)
      }
      commitState(swapped)
      play('move')

      // 캐스케이드를 한 번의 rng 패스로 계산해 애니메이션과 상태를 일치시킨다.
      const { steps, grid: finalGrid, gained } = resolveSteps(swapped.grid, Math.random)
      let running = swapped.score
      for (const step of steps) {
        setPopping(new Set(step.matches.map(cellKey)))
        play(step.multiplier > 1 ? 'eat' : 'match')
        if (step.multiplier > 1) setCombo({ n: step.multiplier, key: ++comboSeq.current })
        await sleep(POP_MS)
        setPopping(new Set())
        running += step.gained
        commitState({ grid: step.filledGrid, score: running, movesLeft: swapped.movesLeft, over: false })
        setDropKey((k) => k + 1)
        await sleep(DROP_MS)
      }

      const over = swapped.movesLeft <= 0
      const finalScore = swapped.score + gained
      let grid = finalGrid
      // 남은 수가 있는데 가능한 수가 없으면 셔플(막힌 판 구제).
      if (!over && !hasPossibleMove(grid)) {
        grid = shuffleBoard(grid, Math.random)
        setDropKey((k) => k + 1)
      }
      commitState({ grid, score: finalScore, movesLeft: swapped.movesLeft, over })
      registerBest(finalScore)

      if (over) {
        const beat = finalScore > prevBest && finalScore > 0
        setNewBest(beat)
        setFinished('over')
        play(beat ? 'win' : 'lose')
      }
      busyRef.current = false
    },
    [commitState, play, reducedRef, registerBest, sleep],
  )

  const handleTap = useCallback(
    (cell: Cell) => {
      if (busyRef.current || !stateRef.current || stateRef.current.over) return
      setSelected((prev) => {
        if (!prev) return cell
        if (prev.row === cell.row && prev.col === cell.col) return null
        const adjacent = Math.abs(prev.row - cell.row) + Math.abs(prev.col - cell.col) === 1
        if (adjacent) {
          void attemptSwap(prev, cell)
          return null
        }
        return cell
      })
    },
    [attemptSwap],
  )

  const onCellPointerDown = useCallback((cell: Cell, e: React.PointerEvent) => {
    dragRef.current = { cell, x: e.clientX, y: e.clientY }
  }, [])

  const onBoardPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      dragRef.current = null
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      const threshold = Math.max(12, strideRef.current * 0.4)
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return // 탭은 onClick이 처리
      const horizontal = Math.abs(dx) > Math.abs(dy)
      const target: Cell = horizontal
        ? { row: d.cell.row, col: d.cell.col + (dx > 0 ? 1 : -1) }
        : { row: d.cell.row + (dy > 0 ? 1 : -1), col: d.cell.col }
      if (target.row < 0 || target.row >= SIZE || target.col < 0 || target.col >= SIZE) return
      suppressClick.current = true
      setSelected(null)
      void attemptSwap(d.cell, target)
    },
    [attemptSwap],
  )

  const onCellClick = useCallback(
    (cell: Cell) => {
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      handleTap(cell)
    },
    [handleTap],
  )

  const hint =
    finished === 'over'
      ? 'Out of moves — press New Game to play again.'
      : 'Swap adjacent gems (tap two or drag) to line up 3+ of a kind. Chain cascades for combo bonuses.'

  const movesLeft = state?.movesLeft ?? 0
  const score = state?.score ?? 0
  const stride = metrics.stride
  const cell = metrics.cell

  return (
    <GameShell
      stats={[
        { label: 'Score', value: score, testId: 'score', float: true },
        { label: 'Moves', value: movesLeft, testId: 'moves' },
        { label: 'Best', value: best },
      ]}
      onNewGame={restart}
      newGameDisabled={!ready}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{STYLES}</style>
      <div className="anim-board-in relative aspect-square w-full touch-none rounded-xl bg-surface p-2">
        <div
          ref={boardRef}
          data-testid="gemmatch-board"
          onPointerUp={onBoardPointerUp}
          className="grid h-full w-full touch-none select-none"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: GAP }}
          aria-label="Gem Match board"
        >
          {(state?.grid ?? emptyGrid()).map((row, r) =>
            row.map((color, c) => {
              const gem = GEMS[((color % GEMS.length) + GEMS.length) % GEMS.length]
              const here = { row: r, col: c }
              const isSel = selected?.row === r && selected?.col === c
              const isPop = popping.has(`${r}-${c}`)
              const inSwap =
                swapAnim && ((swapAnim.a.row === r && swapAnim.a.col === c) || (swapAnim.b.row === r && swapAnim.b.col === c))
              let gx = 0
              let gy = 0
              if (inSwap && stride > 0) {
                const other = swapAnim.a.row === r && swapAnim.a.col === c ? swapAnim.b : swapAnim.a
                gx = (other.col - c) * stride
                gy = (other.row - r) * stride
              }
              const slideClass = inSwap ? (swapAnim.invalid ? 'gm-slide-back' : 'gm-slide') : ''
              const dropClass = !reducedRef.current && !isPop && !inSwap ? 'gm-drop' : ''
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  data-testid="gem"
                  onPointerDown={(e) => onCellPointerDown(here, e)}
                  onClick={() => onCellClick(here)}
                  aria-label={`${gem.name} at row ${r + 1}, column ${c + 1}`}
                  aria-pressed={isSel}
                  className="relative flex items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                  style={{
                    background: `${gem.color}1f`,
                    boxShadow: isSel ? `0 0 0 2px ${gem.color}, 0 0 14px ${gem.glow}` : `inset 0 0 0 1px ${gem.color}55`,
                  }}
                >
                  {color >= 0 && (
                    <span
                      key={`${dropKey}`}
                      className={`pointer-events-none leading-none ${slideClass} ${dropClass} ${isPop ? 'gm-pop' : ''}`}
                      style={{
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...( { '--gx': `${gx}px`, '--gy': `${gy}px` } as any ),
                        color: gem.color,
                        fontSize: cell > 0 ? cell * 0.56 : 18,
                        textShadow: `0 0 8px ${gem.glow}`,
                        transform: isSel ? 'scale(1.12)' : undefined,
                      }}
                    >
                      {gem.glyph}
                    </span>
                  )}
                  {isPop && (
                    <span
                      aria-hidden="true"
                      className="gm-burst pointer-events-none absolute rounded-full"
                      style={{
                        width: '60%',
                        height: '60%',
                        background: `radial-gradient(circle, ${gem.glow} 0%, transparent 70%)`,
                      }}
                    />
                  )}
                </button>
              )
            }),
          )}
        </div>

        {combo && !reducedRef.current && (
          <span
            key={combo.key}
            aria-hidden="true"
            className="gm-combo neon-text-strong pointer-events-none absolute left-1/2 top-1/2 z-[3] text-3xl font-extrabold text-accent"
          >
            Combo ×{combo.n}
          </span>
        )}

        <GameOverlay show={finished === 'over'} variant={newBest ? 'win' : 'lose'} title={newBest ? 'New best!' : 'Out of moves'} testId="game-over">
          <p className="text-fg-muted">Final score: {score}</p>
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}

function emptyGrid(): number[][] {
  return Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(-1))
}
