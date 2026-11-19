'use client'

import { PlayZone, inPlayZone } from '@/components/game-shell/PlayZone'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { applyMove, move, newGame, type Direction, type GameState } from '@/lib/games/g2048/engine'
import type { Theme2048 } from '@/lib/games/g2048/themes'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
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

// 노을 정원 타일: 값이 오를수록 한 방향으로만 진해진다(크림 → 살구 → 주황 → 산호 → 적갈 → 노을 자주).
// 글자 대비(WCAG, 실제 hex로 계산): 2 9.6 · 4 8.5 · 8 7.1 · 16 8.3 · 32 6.7 · 64 5.1 · 128 4.5 · 256 5.9 ·
// 512 7.7 · 1024 8.6 · 2048 8.9 — 전 단계 4.5:1 이상.
const TILE_STYLES: Record<number, string> = {
  2: 'bg-[#fff8ea] text-garden-ink',
  4: 'bg-[#ffe8bd] text-garden-ink',
  8: 'bg-[#ffd27a] text-garden-ink',
  16: 'bg-[#ffb461] text-garden-ink-deep',
  32: 'bg-[#ff9550] text-garden-ink-deep',
  64: 'bg-[#f2733f] text-garden-ink-deep',
  128: 'bg-[#c9472a] text-[#fff8ea]',
  256: 'bg-[#ad3826] text-[#fff8ea]',
  512: 'bg-[#8f2d26] text-[#fff8ea]',
  1024: 'bg-[#70263a] text-[#ffe9a8]',
  2048: 'bg-[#4a2560] text-garden-sunflower',
}

/** 상위 단계(1024+)는 네온 글로우 대신 해바라기 테두리 + 정원 그림자로 구분. 2048은 더 두껍게. */
function tileDepth(value: number): string {
  if (value >= 2048) return 'shadow-[0_0_0_3px_var(--garden-sunflower),0_4px_0_3px_var(--garden-ink-deep)]'
  if (value >= 1024) return 'shadow-[0_0_0_2px_var(--garden-sunflower),0_3px_0_2px_var(--garden-ink-deep)]'
  return 'shadow-garden-button'
}

/** 합치기 진동: 128 이상은 조금 길게. 음소거·미지원 환경에서는 아무것도 하지 않는다. */
function vibrateMerge(maxValue: number) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    navigator.vibrate(maxValue >= 128 ? 18 : 8)
  } catch {
    // 일부 브라우저는 사용자 제스처 밖 호출이나 권한 정책으로 throw — 무시
  }
}

const MAX_QUEUE = 3

function faceAnimClass(animKey: string): string {
  if (animKey.startsWith('m')) return 'anim-pop'
  if (animKey.startsWith('s')) return 'anim-spawn'
  return ''
}

function fontSize(label: string): string {
  if (label.length <= 2) return 'text-[1.625rem]'
  if (label.length === 3) return 'text-[1.375rem]'
  return 'text-[1.1875rem]'
}

export function Game2048({ theme, storageKey }: { theme: Theme2048; storageKey: string }) {
  // SSR 불일치 방지: 초기 보드는 클라이언트에서만 생성
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const bestRef = useRef(0) // 지속 best를 미러 — 이동 핸들러에서 동기 비교(이펙트 순서 회피)
  const newBestRef = useRef(false) // 이 게임에서 기록을 깼는지 latch. game-over 시점 비교는 best가 이미 올라 항상 틀리다
  const recordedRef = useRef(false) // 이 판의 결과를 이미 recordResult 했는지(판당 1회)
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
  // 애니메이션 중 들어온 입력(FIFO, 최대 MAX_QUEUE). 새 입력이 오면 진행 중 슬라이드를 즉시 확정한다.
  const queueRef = useRef<Direction[]>([])
  const slideTimerRef = useRef<number | null>(null)
  const pendingFinishRef = useRef<(() => void) | null>(null)
  const wonSeenRef = useRef(false)
  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  const nextId = useCallback(() => ++idRef.current, [])
  const commitTiles = useCallback((next: Tile[]) => {
    tilesRef.current = next
    setTiles(next)
  }, [])
  const commitState = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const cancelSlide = useCallback(() => {
    if (slideTimerRef.current !== null) window.clearTimeout(slideTimerRef.current)
    slideTimerRef.current = null
    pendingFinishRef.current = null
  }, [])

  // 진행 중 슬라이드를 기다리지 않고 지금 확정(finish가 큐의 다음 이동을 이어서 처리한다).
  const flushSlide = useCallback(() => {
    const finish = pendingFinishRef.current
    cancelSlide()
    finish?.()
  }, [cancelSlide])

  useEffect(() => cancelSlide, [cancelSlide])

  const restart = useCallback(() => {
    cancelSlide()
    animatingRef.current = false
    queueRef.current = []
    wonSeenRef.current = false
    setWonSeen(false)
    newBestRef.current = false
    setNewBest(false)
    recordedRef.current = false
    const s = newGame(Math.random)
    commitState(s)
    commitTiles(tilesFromBoard(s.board, nextId, true))
  }, [cancelSlide, commitState, commitTiles, nextId])

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
    (dir: Direction): boolean => {
      const s = stateRef.current
      if (!s) return false
      const { board: slid, moved } = applyMove(s.board, dir)
      if (!moved) return false
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

        if (plan.merges.length) {
          play('merge')
          if (!mutedRef.current) vibrateMerge(Math.max(...plan.merges.map((m) => m.newValue)))
        }
        if (newEngine.won && !s.won) play('win')
        else if (newEngine.over) play(newBestRef.current ? 'win' : 'lose')
        if (newEngine.over) setNewBest(newBestRef.current)
        // Record once per game: a win the moment the 2048 tile first appears (most players
        // hit New Game on the win overlay, so waiting for game-over would miss it), otherwise
        // a loss when the board locks.
        if (!recordedRef.current && (newEngine.won || newEngine.over)) {
          recordedRef.current = true
          recordResult(storageKey.replace(/^best:/, ''), { won: newEngine.won })
        }

        animatingRef.current = false
        // 판이 끝났거나 승리 오버레이가 입력을 막으면 남은 입력은 버린다.
        if (newEngine.over || (newEngine.won && !wonSeenRef.current)) {
          queueRef.current = []
          return
        }
        // 막힌 방향은 건너뛰고 실제로 움직이는 다음 입력까지 진행
        while (queueRef.current.length) {
          if (performMove(queueRef.current.shift()!)) break
        }
      }

      if (reducedRef.current) {
        finish()
        return true
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
      // 새 입력이 오면 flushSlide가 이 타이머를 취소하고 finish를 바로 부른다.
      const settle = () => {
        slideTimerRef.current = null
        pendingFinishRef.current = null
        finish()
      }
      pendingFinishRef.current = settle
      slideTimerRef.current = window.setTimeout(settle, SLIDE_MS)
      return true
    },
    [commitState, commitTiles, nextId, play, reducedRef, storageKey],
  )

  const doMove = useCallback(
    (dir: Direction) => {
      const s = stateRef.current
      if (!s || s.over) return
      if (s.won && !wonSeenRef.current) return // win overlay is blocking input
      if (animatingRef.current) {
        // 빠른 연타: 입력을 FIFO에 넣고 진행 중 슬라이드를 즉시 확정 → 다음 이동이 바로 시작된다.
        if (queueRef.current.length < MAX_QUEUE) queueRef.current.push(dir)
        flushSlide()
        return
      }
      performMove(dir)
    },
    [flushSlide, performMove],
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
    if (!inPlayZone(e)) {
      touchStart.current = null // 가장자리 스크롤 띠에서 시작한 터치는 게임 입력이 아니다
      return
    }
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
        {/* 실제 헤더(compactHeader, min-h-11)와 같은 높이 — 하이드레이션 때 판이 튀지 않게 */}
        <div className="mb-3 flex min-h-11 items-center justify-between">
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
        <div className="aspect-square w-full rounded-xl border-[3px] border-garden-ink bg-garden-cream-2 p-2 shadow-garden-island" data-testid="board-loading" />
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
      compactHeader
    >
      <div
        className="anim-board-in relative aspect-square w-full rounded-xl border-[3px] border-garden-ink bg-garden-cream-2 p-2 shadow-garden-island"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="board"
      >
        <PlayZone />
        {/* Background grid — the empty slots (depth) */}
        <div className="grid h-full w-full grid-cols-4 gap-2">
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} data-testid="cell" className="rounded-lg bg-garden-cream-shade shadow-[inset_0_2px_0_rgba(58,36,16,0.14)]" />
          ))}
        </div>

        {/* Tile layer — absolutely positioned, animated */}
        <div ref={boardInnerRef} className="pointer-events-none absolute inset-2">
          {tiles.map((tile) => {
            const label = theme.tiles[tile.value] ?? String(tile.value)
            const style = TILE_STYLES[tile.value] ?? TILE_STYLES[2048]
            const depth = tileDepth(tile.value)
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
                  className={`flex h-full w-full items-center justify-center rounded-lg border-2 border-garden-ink font-display font-bold leading-none tabular-nums ${fontSize(label)} ${style} ${depth} ${faceAnimClass(tile.animKey)}`}
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
          tone="cozy"
        >
          <p className="font-semibold tabular-nums text-garden-ink-soft">
            Score: {state.score} · Best: {best}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>

        <GameOverlay show={winOverlayVisible} variant="win" title="You win!" testId="you-win" tone="cozy">
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
