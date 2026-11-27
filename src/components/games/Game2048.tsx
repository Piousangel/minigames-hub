'use client'

import { PlayZone, inPlayZone } from '@/components/game-shell/PlayZone'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { applyMove, move, newGame, type Direction, type GameState } from '@/lib/games/g2048/engine'
import type { Theme2048 } from '@/lib/games/g2048/themes'
import { LADDER, collectionOf, friendMeet, type FriendMeet } from '@/lib/games/g2048/friends'
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

// 진화 사다리(theme.ladder): 타일 단계 11칸(LADDER, friends.ts). 이번 판 최고 타일까지 '도달', 바로 다음 한 칸 '다음'.
const FRIEND_MS = 800 // 새 친구 등장 연출 길이 — 입력은 막지 않는다

function maxTileOf(board: number[][]): number {
  let m = 0
  for (const row of board) for (const v of row) if (v > m) m = v
  return m
}

function nextStep(max: number): number | null {
  return LADDER.find((v) => v > max) ?? null
}

/** 이름이 없는 값(4096+)은 최상위 단계 이름으로 — 사다리 밖으로 나간 동물도 '용'으로 읽힌다. */
function stepOf(theme: Theme2048, value: number): { emoji: string; name: string } {
  const v = theme.names?.[value] ? value : LADDER.filter((s) => s <= value).pop() ?? 2
  return { emoji: theme.tiles[v] ?? String(v), name: theme.names?.[v] ?? String(v) }
}

function EvolutionLadder({ theme, max }: { theme: Theme2048; max: number }) {
  const next = nextStep(max)
  const reached = LADDER.filter((v) => v <= max).map((v) => stepOf(theme, v).name)
  const label = `Evolution: ${reached.join(', ')}${next ? ` — next: ${stepOf(theme, next).name}` : ' — top reached'}`
  return (
    <div
      data-testid="evolution-ladder"
      role="img"
      aria-label={label}
      className="mt-3 flex w-full items-center justify-between gap-0.5 sm:gap-1"
    >
      {LADDER.map((v) => {
        const state = v <= max ? 'reached' : v === next ? 'next' : 'locked'
        const cls =
          state === 'reached'
            ? 'border-garden-ink bg-[#ffe8bd] shadow-[0_2px_0_var(--garden-ink)]'
            : state === 'next'
              ? 'border-dashed border-[#c9472a] bg-[#fff8ea]'
              : v === LADDER[LADDER.length - 1]
                ? // 최종 목표(용)는 잠겨 있어도 알아볼 수 있게 — GOAL 문구가 말하는 바로 그 동물
                  'border-garden-ink/40 bg-garden-cream-2 opacity-80'
                : 'border-garden-ink/25 bg-garden-cream-2 opacity-60 grayscale'
        return (
          <span
            key={v}
            aria-hidden="true"
            data-step={v}
            data-state={state}
            className={`flex aspect-square min-w-0 max-w-9 flex-1 items-center justify-center rounded-md border-2 text-[clamp(13px,4.4vw,20px)] leading-none ${cls}`}
          >
            {theme.tiles[v]}
          </span>
        )
      })}
    </div>
  )
}

/** 새 친구 등장 연출(#263): 판 위에 잠깐 뜨는 이름표. pointer-events-none — 스와이프·키 입력을 막지 않는다. */
function FriendBanner({ theme, meet, reduced }: { theme: Theme2048; meet: FriendMeet; reduced: boolean }) {
  const { emoji, name } = stepOf(theme, meet.value)
  const lifetime = meet.kind === 'lifetime'
  return (
    <div
      data-testid="friend-banner"
      data-kind={meet.kind}
      role="status"
      className="pointer-events-none absolute inset-x-0 top-[14%] z-10 flex justify-center px-3"
    >
      <div
        className={`flex items-center gap-2.5 rounded-2xl border-[3px] border-garden-ink px-4 py-2 shadow-garden-island ${
          lifetime ? 'bg-garden-sunflower' : 'bg-[#fff8ea]'
        } ${reduced ? '' : 'anim-friend'}`}
      >
        <span aria-hidden="true" className="text-[40px] leading-none drop-shadow-[0_1px_1px_rgba(58,36,16,0.45)]">
          {emoji}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="font-ui text-[11px] font-extrabold uppercase tracking-wider text-[#8f2d26]">
            {lifetime ? 'New friend!' : 'Hi again'}
          </span>
          <span className="font-display text-xl font-bold text-garden-ink">{name}</span>
        </span>
      </div>
    </div>
  )
}

/** 평생 도감(#263): 기존 `bestTile:<slug>` 기록 + 이번 판 최고까지. 만난 동물은 그림·이름, 못 만난 동물은 실루엣·'?'. */
function FriendCollection({ theme, lifetimeBest, before }: { theme: Theme2048; lifetimeBest: number; before: number }) {
  const items = collectionOf(lifetimeBest)
  const met = items.filter((x) => x.met).length
  return (
    <section
      data-testid="friend-collection"
      data-met={met}
      aria-label={`Animal collection: ${met} of ${items.length} met`}
      className="mt-3 w-full rounded-xl border-2 border-garden-ink/30 bg-garden-cream-2 px-2.5 pb-2 pt-1.5"
    >
      <div className="mb-1 flex items-baseline justify-between font-ui text-xs font-bold text-garden-ink">
        <span>Animal collection</span>
        <span className="tabular-nums text-garden-ink-soft">
          {met} / {items.length} met
        </span>
      </div>
      <ul className="grid grid-cols-6 gap-1">
        {items.map(({ value, met: isMet }) => {
          const { emoji, name } = stepOf(theme, value)
          const fresh = isMet && value > before
          return (
            <li
              key={value}
              data-friend={value}
              data-met={isMet ? 'yes' : 'no'}
              className={`flex min-w-0 flex-col items-center rounded-md py-0.5 ${
                fresh ? 'bg-[#ffe8bd] shadow-[0_0_0_2px_var(--garden-sunflower)]' : ''
              }`}
            >
              <span
                aria-hidden="true"
                className={`text-[20px] leading-6 ${isMet ? '' : 'opacity-25 brightness-0'}`}
              >
                {emoji}
              </span>
              <span
                className={`w-full truncate text-center font-ui text-[10px] font-bold leading-3 ${
                  isMet ? 'text-garden-ink' : 'text-garden-ink-soft'
                }`}
              >
                {isMet ? name : '?'}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
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
  // 역대 최고 타일(동물) — 점수 기록(best:<slug>)과 별개의 새 키. names가 있는 테마(animals)만 쓴다.
  const tileKey = theme.names ? `bestTile:${storageKey.replace(/^best:/, '')}` : null
  const bestTileRef = useRef(0)
  const [bestTileBefore, setBestTileBefore] = useState(0) // 이 판 시작 시점의 역대 최고 — 'New animal!' 판정
  const [friend, setFriend] = useState<(FriendMeet & { seq: number }) | null>(null) // 새 친구 등장 연출(names 테마만)
  const friendSeqRef = useRef(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const boardInnerRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const tilesRef = useRef<Tile[]>([])
  const idRef = useRef(0)
  const animSeqRef = useRef(0)
  const animatingRef = useRef(false)
  // 애니메이션 중 들어온 입력. 새 입력이 오면 진행 중 슬라이드를 즉시 확정하고 바로 다음 이동을 처리하므로
  // 실제로는 거의 비어 있다(MAX_QUEUE는 확정 중 재진입 대비 상한).
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
    setFriend(null)
    setBestTileBefore(bestTileRef.current)
    const s = newGame(Math.random)
    commitState(s)
    commitTiles(tilesFromBoard(s.board, nextId, true))
  }, [cancelSlide, commitState, commitTiles, nextId])

  useEffect(() => {
    restart()
    let stored = 0
    try {
      stored = Number(localStorage.getItem(storageKey))
    } catch {
      // 저장소 차단 — 기록 없음으로 시작
    }
    const b = Number.isFinite(stored) ? stored : 0
    setBest(b)
    bestRef.current = b
    if (tileKey) {
      let t = 0
      try {
        t = Number(localStorage.getItem(tileKey)) || 0
      } catch {
        // 저장소 차단 — 0으로
      }
      bestTileRef.current = t
      setBestTileBefore(t)
    }
  }, [restart, storageKey, tileKey])

  useEffect(() => {
    if (state && state.score > best) {
      setBest(state.score)
      bestRef.current = state.score
      localStorage.setItem(storageKey, String(state.score))
    }
  }, [state, best, storageKey])

  // 역대 최고 타일: 이번 판 최고가 기록을 넘을 때만 저장(같거나 낮으면 건드리지 않음).
  useEffect(() => {
    if (!tileKey || !state) return
    const m = maxTileOf(state.board)
    if (m > bestTileRef.current) {
      bestTileRef.current = m
      try {
        localStorage.setItem(tileKey, String(m))
      } catch {
        // 저장소 차단 — 화면 표시만
      }
    }
  }, [state, tileKey])

  // 등장 연출은 FRIEND_MS 뒤 스스로 사라진다(새 친구가 이어 오면 seq가 바뀌어 타이머가 다시 시작).
  useEffect(() => {
    if (!friend) return
    const t = window.setTimeout(() => setFriend(null), FRIEND_MS)
    return () => window.clearTimeout(t)
  }, [friend])

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
          // 이번 판 첫 만남 / 평생 첫 만남(기존 bestTile 기록을 읽기만 — 저장은 위 이펙트 그대로).
          // 연출 렌더는 names 테마에서만(아래 FriendBanner 조건) — 원조 2048은 상태만 잠깐 바뀌고 화면 변화 0.
          const meet = friendMeet(maxTileOf(s.board), Math.max(...plan.merges.map((m) => m.newValue)), bestTileRef.current)
          if (meet) setFriend({ ...meet, seq: ++friendSeqRef.current })
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
        {/* 사다리 자리를 미리 잡아 로드 뒤 아래 내용이 밀리지 않게(CLS) */}
        {theme.ladder && theme.names && <EvolutionLadder theme={theme} max={0} />}
        {theme.ladder && theme.names && <FriendCollection theme={theme} lifetimeBest={0} before={0} />}
        <p className="mt-3 text-center text-sm text-fg-muted">{hint}</p>
      </div>
    )
  }

  const winOverlayVisible = state.won && !wonSeen && !state.over
  const maxTile = maxTileOf(state.board)

  // 결과 오버레이의 '도달한 동물' 한 줄(names가 있는 테마만). 기록을 넘긴 판은 'New animal!'.
  const reachedLine = (() => {
    if (!theme.names || maxTile === 0) return null
    const top = stepOf(theme, maxTile)
    const next = nextStep(maxTile)
    const lead = bestTileBefore > 0 && maxTile > bestTileBefore ? 'New animal!' : 'You reached'
    return (
      <p data-testid="result-animal" className="text-balance text-[0.95rem] font-bold text-garden-ink">
        {lead} {top.emoji} {top.name}
        {next && (
          <span className="font-semibold text-garden-ink-soft">
            {' · next: '}
            {stepOf(theme, next).emoji} {stepOf(theme, next).name}
          </span>
        )}
      </p>
    )
  })()

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
            const emoji = theme.ladder === true
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
                  className={`flex h-full w-full items-center justify-center rounded-lg border-2 border-garden-ink font-display font-bold leading-none tabular-nums ${emoji ? 'relative' : fontSize(label)} ${style} ${depth} ${faceAnimClass(tile.animKey)}`}
                  style={
                    emoji
                      ? { fontSize: Math.round(cell * 0.55), ...(tile.enterDelay ? { animationDelay: `${tile.enterDelay}ms` } : {}) }
                      : tile.enterDelay
                        ? { animationDelay: `${tile.enterDelay}ms` }
                        : undefined
                  }
                >
                  {emoji ? (
                    <>
                      {/* 진한 단계(128+)는 크림 원판 위에 — 갈색·회색 동물이 바탕에 묻히지 않게 */}
                      {tile.value >= 128 && (
                        <span
                          aria-hidden="true"
                          className="absolute rounded-full bg-[#fff3dc]/85"
                          style={{ width: Math.round(cell * 0.66), height: Math.round(cell * 0.66) }}
                        />
                      )}
                      <span className="relative drop-shadow-[0_1px_1px_rgba(58,36,16,0.45)]">{label}</span>
                      {/* 단계 값 — 기기마다 이모지 생김이 달라도 몇 단계인지 확정 */}
                      <span
                        data-testid="tile-value"
                        aria-hidden="true"
                        className="absolute bottom-[3px] right-[5px] font-ui text-[11px] font-extrabold leading-none tracking-tight"
                      >
                        {tile.value}
                      </span>
                    </>
                  ) : (
                    label
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {friend && theme.names && <FriendBanner key={friend.seq} theme={theme} meet={friend} reduced={reduced} />}

        <GameOverlay
          show={state.over}
          variant={newBest ? 'win' : 'lose'}
          title={newBest ? 'New best!' : 'Game over'}
          testId="game-over"
          tone="cozy"
          compact={theme.ladder === true}
        >
          {reachedLine ? (
            <div className="flex flex-col items-center gap-0.5">
              {reachedLine}
              <p className="text-sm font-semibold tabular-nums text-garden-ink-soft">
                Score: {state.score} · Best: {best}
              </p>
            </div>
          ) : (
            <p className="font-semibold tabular-nums text-garden-ink-soft">
              Score: {state.score} · Best: {best}
            </p>
          )}
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>

        <GameOverlay show={winOverlayVisible} variant="win" title="You win!" testId="you-win" tone="cozy" compact={theme.ladder === true}>
          {reachedLine}
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
      {theme.ladder && theme.names && <EvolutionLadder theme={theme} max={maxTile} />}
      {theme.ladder && theme.names && (
        <FriendCollection theme={theme} lifetimeBest={Math.max(bestTileBefore, maxTile)} before={bestTileBefore} />
      )}
    </GameShell>
  )
}
