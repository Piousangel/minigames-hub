'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  STARTING_LIVES,
  STREAK_STEP,
  TICK_MS,
  WARN_TICKS,
  cellStatuses,
  createGame,
  fitsNow,
  multiplierFor,
  reduce,
  type Axis,
  type CellStatus,
  type Dir,
  type ShadowfitAction,
  type ShadowfitEvent,
  type ShadowfitState,
  type Vec3,
} from '@/lib/games/shadowfit/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { sendHit } from '@/lib/hit'
import { MAX_NAME_LEN, loadPlayerName, savePlayerName } from '@/lib/leaderboard'
import { challengeUrl, clearChallengeParams, compareChallenge, parseChallenge, type Challenge } from '@/lib/challenge'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const MAX_FRAME_MS = 100
const SWIPE_PX = 24
const VOXEL_PX = 36
const SPIN_MS = 140
const BANNER_MS = 1000

const SOUND: Record<ShadowfitEvent, SoundName | null> = {
  none: null,
  start: 'move',
  rotate: 'flip',
  blocked: null,
  tick: null,
  warn: 'flag',
  pass: 'match',
  perfect: 'merge',
  crash: 'error',
  next: null,
  over: 'lose',
}

/** Inverse CSS rotation for the spin tween (engine X+ = CSS rotateX(-90deg), etc.). */
function spinFrom(axis: Axis, dir: Dir): string {
  const base = axis === 'x' ? 90 : axis === 'y' ? -90 : 90
  const deg = base * dir
  return axis === 'x' ? `rotateX(${deg}deg)` : axis === 'y' ? `rotateY(${deg}deg)` : `rotateZ(${deg}deg)`
}

const tint = (v: string, pct: number) => `color-mix(in srgb, var(${v}) ${pct}%, transparent)`

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, best: number): void {
  try {
    localStorage.setItem(storageKey, String(Math.max(0, Math.floor(best))))
  } catch {
    // ignore storage failures
  }
}

/** Focus is on a control that handles Enter/Space itself (overlay buttons, links, inputs). */
function isControlTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && t.closest('button, a[href], input, textarea, select, [role="button"]') !== null
}

const live = (s: ShadowfitState) => s.phase === 'approach' || s.phase === 'resolve'

function LivesHearts({ lives }: { lives: number }) {
  return (
    <span
      className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm text-neon-red"
      data-testid="lives"
      aria-label={`Lives: ${lives}`}
    >
      {'♥'.repeat(Math.max(0, lives))}
      {'♡'.repeat(Math.max(0, STARTING_LIVES - lives))}
    </span>
  )
}

const CELL_STYLE: Record<CellStatus, CSSProperties> = {
  fit: { background: 'var(--neon-lime)', boxShadow: '0 0 12px var(--neon-lime)' },
  open: { background: 'rgba(0,0,0,.55)', border: '2px dashed var(--neon-cyan)' },
  collide: {
    background: `linear-gradient(135deg, var(--neon-magenta), var(--neon-red))`,
    boxShadow: '0 0 12px var(--neon-red)',
  },
  solid: { background: tint('--neon-purple', 20), border: `1px solid ${tint('--neon-purple', 35)}` },
}

const FACES: { t: string; pct: number }[] = [
  { t: `translateZ(${VOXEL_PX / 2}px)`, pct: 55 }, // front
  { t: `rotateY(180deg) translateZ(${VOXEL_PX / 2}px)`, pct: 40 }, // back
  { t: `rotateY(90deg) translateZ(${VOXEL_PX / 2}px)`, pct: 40 }, // right
  { t: `rotateY(-90deg) translateZ(${VOXEL_PX / 2}px)`, pct: 40 }, // left
  { t: `rotateX(90deg) translateZ(${VOXEL_PX / 2}px)`, pct: 70 }, // top
  { t: `rotateX(-90deg) translateZ(${VOXEL_PX / 2}px)`, pct: 40 }, // bottom
]

function Voxel({ v }: { v: Vec3 }) {
  const origin = v[0] === 0 && v[1] === 0 && v[2] === 0
  return (
    <div
      className="absolute"
      style={{
        width: VOXEL_PX,
        height: VOXEL_PX,
        left: -VOXEL_PX / 2,
        top: -VOXEL_PX / 2,
        transformStyle: 'preserve-3d',
        transform: `translate3d(${v[0] * VOXEL_PX}px, ${-v[1] * VOXEL_PX}px, ${v[2] * VOXEL_PX}px)`,
      }}
    >
      {FACES.map((f, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            transform: f.t,
            background: tint('--neon-cyan', f.pct),
            border: '1px solid var(--neon-cyan)',
            backfaceVisibility: 'visible',
          }}
        />
      ))}
      {origin && (
        <div
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            width: 10,
            height: 10,
            left: VOXEL_PX / 2 - 5,
            top: VOXEL_PX / 2 - 5,
            background: 'var(--neon-amber)',
            boxShadow: '0 0 8px var(--neon-amber)',
            transform: `translateZ(${VOXEL_PX / 2 + 1}px)`,
          }}
        />
      )}
    </div>
  )
}

interface Banner {
  seq: number
  text: string
  color: string
}

interface PadButton {
  testId: string
  axis: Axis
  dir: Dir
  glyph: string
  label: string
}

const PAD: { row: string; buttons: PadButton[] }[] = [
  {
    row: 'X',
    buttons: [
      { testId: 'rot-x-plus', axis: 'x', dir: 1, glyph: '⤓', label: 'Roll toward you (X)' },
      { testId: 'rot-x-minus', axis: 'x', dir: -1, glyph: '⤒', label: 'Roll away from you (X)' },
    ],
  },
  {
    row: 'Y',
    buttons: [
      { testId: 'rot-y-minus', axis: 'y', dir: -1, glyph: '⟲', label: 'Turn left (Y)' },
      { testId: 'rot-y-plus', axis: 'y', dir: 1, glyph: '⟳', label: 'Turn right (Y)' },
    ],
  },
  {
    row: 'Z',
    buttons: [
      { testId: 'rot-z-plus', axis: 'z', dir: 1, glyph: '↺', label: 'Spin counter-clockwise (Z)' },
      { testId: 'rot-z-minus', axis: 'z', dir: -1, glyph: '↻', label: 'Spin clockwise (Z)' },
    ],
  },
]

export function GameShadowfit({ storageKey }: { storageKey: string }) {
  // SSR safety: the run (and its random seed) is created on the client only.
  const [state, setState] = useState<ShadowfitState | null>(null)
  const [paused, setPaused] = useState(false)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [flash, setFlash] = useState<{ seq: number; kind: 'pass' | 'crash' } | null>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  // 1:1 도전(?vs=...) — 있으면 모든 판(재시작 포함)을 도전자와 같은 시드로 시작한다.
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const challengeRef = useRef<Challenge | null>(null)
  const [name, setName] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<ShadowfitState | null>(null)
  const pausedRef = useRef(false)
  const bestRef = useRef(0)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const accRef = useRef(0)
  const animRef = useRef<HTMLDivElement | null>(null)
  const pendingSpinRef = useRef<{ axis: Axis; dir: Dir } | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const bannerSeq = useRef(0)
  const flashSeq = useRef(0)

  const commit = useCallback((next: ShadowfitState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const setPausedBoth = useCallback((p: boolean) => {
    pausedRef.current = p
    setPaused(p)
  }, [])

  const showBanner = useCallback((text: string, color: string) => {
    const seq = ++bannerSeq.current
    setBanner({ seq, text, color })
  }, [])

  useEffect(() => {
    if (!banner) return
    const id = window.setTimeout(() => setBanner((b) => (b && b.seq === banner.seq ? null : b)), BANNER_MS)
    return () => window.clearTimeout(id)
  }, [banner])

  // Init run + best + incoming challenge (client only).
  useEffect(() => {
    const b = loadBest(storageKey)
    bestRef.current = b
    setBest(b)
    const incoming = parseChallenge(window.location.search)
    challengeRef.current = incoming
    setChallenge(incoming)
    setName(loadPlayerName())
    commit(createGame(incoming?.seed ?? freshSeed()))
  }, [storageKey, commit])

  const startNew = useCallback(() => {
    accRef.current = 0
    lastTsRef.current = 0
    pendingSpinRef.current = null
    setPausedBoth(false)
    setNewBest(false)
    setBanner(null)
    setFlash(null)
    setAnnounce('')
    setShareStatus('idle')
    commit(createGame(challengeRef.current?.seed ?? freshSeed()))
  }, [commit, setPausedBoth])

  const leaveChallenge = useCallback(() => {
    challengeRef.current = null
    setChallenge(null)
    clearChallengeParams()
    startNew()
  }, [startNew])

  // 결과 화면의 "친구에게 도전장": 방금 판의 시드+점수를 링크로. 받은 사람은 같은 판을 한다.
  const shareChallenge = useCallback(
    async (seed: number, score: number, passed: number) => {
      const slug = storageKey.replace(/^best:/, '')
      const trimmed = name.trim()
      if (trimmed) savePlayerName(trimmed)
      const url = challengeUrl(window.location.origin, slug, { seed, score, name: trimmed })
      const text = `I scored ${score} in Shadowfit (${passed} walls). Same blocks, same holes — can you beat me? 🧊`
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Shadowfit challenge', text, url })
        } else {
          await navigator.clipboard.writeText(`${text} ${url}`)
          setShareStatus('copied')
        }
        // 공유 시트 취소·클립보드 실패는 위에서 throw → 'sent'로 세지 않는다.
        sendHit(slug, 'challenge-sent')
      } catch {
        // 취소/불가 무시
      }
    },
    [name, storageKey],
  )

  const dispatch = useCallback(
    (action: ShadowfitAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      if (next === prev) return
      commit(next)

      const ev = next.lastEvent
      const sound = SOUND[ev]
      if (sound) play(sound)

      if (ev === 'rotate' && action.type === 'rotate' && !reducedRef.current) {
        pendingSpinRef.current = { axis: action.axis, dir: action.dir }
      }

      if (ev === 'pass' || ev === 'perfect') {
        const r = next.lastResult!
        setFlash({ seq: ++flashSeq.current, kind: 'pass' })
        setAnnounce(ev === 'perfect' ? `Perfect! +${r.gain}` : `Fits! +${r.gain}`)
        // Multiplier steps up exactly when the streak hits a multiple of STREAK_STEP.
        const stepUp = next.streak % STREAK_STEP === 0 && multiplierFor(next.streak) > multiplierFor(next.streak - 1)
        if (ev === 'perfect') {
          showBanner(stepUp ? `PERFECT · ×${multiplierFor(next.streak)}` : 'PERFECT!', 'var(--neon-lime)')
        } else if (stepUp) {
          showBanner(`STREAK ${next.streak} · ×${multiplierFor(next.streak)}`, 'var(--neon-amber)')
        }
      } else if (ev === 'crash') {
        setFlash({ seq: ++flashSeq.current, kind: 'crash' })
        setShakeKey((k) => k + 1)
        setAnnounce(`Crash — ${next.lives} ${next.lives === 1 ? 'life' : 'lives'} left`)
      } else if (ev === 'next') {
        setAnnounce(`Wall ${next.wallIndex + 1}`)
      }

      if (prev.phase !== 'over' && next.phase === 'over') {
        setFlash({ seq: ++flashSeq.current, kind: 'crash' })
        setShakeKey((k) => k + 1)
        const slug = storageKey.replace(/^best:/, '')
        // 도전 판은 같은 시드를 무한 Rematch할 수 있어(벽 암기) 최고기록에 넣지 않는다 —
        // 넣으면 아무 시드로 링크를 만들어 리더보드를 파밍할 수 있다.
        if (!challengeRef.current && next.score > bestRef.current) {
          bestRef.current = next.score
          setBest(next.score)
          saveBest(storageKey, next.score)
          setNewBest(true)
          play('win')
        }
        recordFinish(slug)
        if (challengeRef.current) sendHit(slug, 'challenge-done')
        setAnnounce(`Crushed by wall ${next.wallIndex + 1}. Score ${next.score}, ${next.passed} walls passed.`)
      }
    },
    [commit, play, reducedRef, showBanner, storageKey],
  )

  // Rotation tween: runs right after the rotated orientation is in the DOM.
  useLayoutEffect(() => {
    const spin = pendingSpinRef.current
    if (!spin) return
    pendingSpinRef.current = null
    const el = animRef.current
    if (!el || typeof el.animate !== 'function' || reducedRef.current) return
    el.getAnimations?.().forEach((a) => a.cancel())
    el.animate([{ transform: spinFrom(spin.axis, spin.dir) }, { transform: 'none' }], {
      duration: SPIN_MS,
      easing: 'cubic-bezier(.2,.8,.2,1)',
    })
  }, [state, reducedRef])

  const rotate = useCallback(
    (axis: Axis, dir: Dir) => {
      const s = stateRef.current
      if (!s || s.phase === 'over') return
      if (pausedRef.current) {
        setPausedBoth(false)
        return
      }
      dispatch({ type: 'rotate', axis, dir })
    },
    [dispatch, setPausedBoth],
  )

  const slam = useCallback(() => {
    const s = stateRef.current
    if (!s || s.phase === 'over') return
    if (pausedRef.current) {
      setPausedBoth(false)
      return
    }
    if (s.phase === 'ready') dispatch({ type: 'start' })
    else if (s.phase === 'approach') dispatch({ type: 'drop' })
  }, [dispatch, setPausedBoth])

  // rAF tick driver: accumulate real ms, fire one tick per TICK_MS.
  useEffect(() => {
    function frame(ts: number) {
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      let dt = ts - last
      if (dt > MAX_FRAME_MS) dt = MAX_FRAME_MS
      const s = stateRef.current
      if (s && live(s) && !pausedRef.current) {
        accRef.current += dt
        while (accRef.current >= TICK_MS) {
          accRef.current -= TICK_MS
          dispatch({ type: 'tick' })
          const nxt = stateRef.current
          if (!nxt || nxt.phase === 'over') {
            accRef.current = 0
            break
          }
        }
      } else if (!s || !live(s)) {
        accRef.current = 0
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [dispatch])

  // Auto-pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      const s = stateRef.current
      if (document.visibilityState === 'hidden' && s && live(s)) setPausedBoth(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [setPausedBoth])

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (e.repeat) return
      const s = stateRef.current
      if (!s) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      // Outside a live run (ready card, pause, game-over overlay) Enter/Space on a focused
      // button/link must activate it (e.g. "Challenge a friend"), not restart or slam.
      // The pad buttons are excluded: their keyboard input is the game's.
      if (
        (key === 'Enter' || key === ' ') &&
        (!live(s) || pausedRef.current) &&
        isControlTarget(e.target) &&
        !(e.target instanceof HTMLElement && e.target.closest('[data-shadowfit-control]'))
      ) {
        return
      }
      switch (key) {
        case 'ArrowDown':
        case 's':
          e.preventDefault()
          rotate('x', 1)
          return
        case 'ArrowUp':
        case 'w':
          e.preventDefault()
          rotate('x', -1)
          return
        case 'ArrowRight':
        case 'd':
          e.preventDefault()
          rotate('y', 1)
          return
        case 'ArrowLeft':
        case 'a':
          e.preventDefault()
          rotate('y', -1)
          return
        case 'q':
          e.preventDefault()
          rotate('z', 1)
          return
        case 'e':
          e.preventDefault()
          rotate('z', -1)
          return
        case ' ':
          e.preventDefault()
          slam()
          return
        case 'Enter':
          if (s.phase === 'ready') {
            e.preventDefault()
            dispatch({ type: 'start' })
          } else if (s.phase === 'over') {
            e.preventDefault()
            startNew()
          }
          return
        case 'p':
        case 'Escape':
          if (live(s)) {
            e.preventDefault()
            setPausedBoth(!pausedRef.current)
          }
          return
        case 'r':
          // Only outside a live run (ready card / game over) — a stray R must not wipe a run.
          if (!live(s)) {
            e.preventDefault()
            startNew()
          }
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, rotate, slam, setPausedBoth, startNew])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY }
    // A swipe that ends outside the panel must still count: keep the pointer captured.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      // ignore (synthetic events / unsupported)
    }
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = pointerRef.current
      pointerRef.current = null
      const s = stateRef.current
      if (!start || !s) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_PX) {
        if (Math.abs(dx) >= Math.abs(dy)) rotate('y', dx > 0 ? 1 : -1)
        else rotate('x', dy > 0 ? 1 : -1)
        return
      }
      if (pausedRef.current) setPausedBoth(false)
      else if (s.phase === 'ready') dispatch({ type: 'start' })
    },
    [dispatch, rotate, setPausedBoth],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-110 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="shadowfit-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const over = state.phase === 'over'
  const ready = state.phase === 'ready'
  const fits = fitsNow(state)
  const statuses = cellStatuses(state)
  const ratio = state.wall.approachTicks > 0 ? state.distance / state.wall.approachTicks : 0
  const warning = state.phase === 'approach' && state.distance <= WARN_TICKS
  const wallScale = reduced ? 1 : 0.55 + 0.45 * (1 - ratio)
  const holeText = state.wall.hole.map((c) => `(${c[0]},${c[1]})`).join(' ')

  const hint = paused
    ? 'Paused — tap to resume'
    : ready
      ? 'Rotate the block so its shadow matches the hole. Space to slam early for bonus.'
      : over
        ? 'Press Enter or Play again for another run.'
        : 'Fill the dashed hole with no red cells, then Space/Slam ·↑↓ W S tilt · ←→ A D turn · Q E roll · swipe the block or use the pad'

  const outcome = challenge && over ? compareChallenge(state.score, challenge.score) : null
  const overlayTitle = !challenge
    ? newBest
      ? 'New best!'
      : 'Crushed by the wall'
    : outcome?.kind === 'win'
      ? `You beat ${challenge.name}!`
      : outcome?.kind === 'tie'
        ? `Dead even with ${challenge.name}`
        : `${challenge.name} still fits through`

  const headerExtra = (
    <>
      <LivesHearts lives={state.lives} />
      {state.streak >= 1 && (
        <span
          data-testid="streak"
          className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-bold text-accent"
        >
          Streak {state.streak} · ×{multiplierFor(state.streak)}
        </span>
      )}
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Walls', value: state.passed, testId: 'walls' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={startNew}
      newGameLabel={over ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-110"
    >
      {challenge && (
        <div
          data-testid="challenge-banner"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm"
        >
          <span>
            ⚔️ <span className="font-bold">{challenge.name}</span> scored{' '}
            <span className="font-bold text-accent">{challenge.score}</span> on this exact run. Beat it!
            <span className="block text-xs text-fg-muted">Challenge runs don&apos;t count toward your best.</span>
          </span>
          {/* 진행 중인 판에선 숨긴다 — 보드 바로 위라 모바일 오탭 한 번에 판이 날아간다. */}
          {(ready || over) && (
            <button
              type="button"
              onClick={leaveChallenge}
              className="text-xs text-fg-muted underline hover:text-fg"
              data-testid="challenge-leave"
            >
              Play solo
            </button>
          )}
        </div>
      )}

      <div className="relative rounded-xl bg-surface p-4" data-testid="shadowfit-board">
        {/* approach bar */}
        <div className="mb-3 flex items-center gap-2 text-xs text-fg-muted">
          <span className="w-14 shrink-0 font-semibold">Wall {state.wallIndex + 1}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-2">
            <div
              data-testid="approach-bar"
              className="h-full w-full origin-left rounded-full"
              style={{
                transform: `scaleX(${ratio})`,
                background: warning ? 'var(--neon-red)' : 'var(--neon-cyan)',
                transition: reduced ? undefined : 'transform 100ms linear',
              }}
            />
          </div>
          <span className="w-14 shrink-0 text-right">Par {state.wall.par}</span>
        </div>

        {/* WALL */}
        <div className="relative flex justify-center py-2">
          <div
            style={{
              transform: `scale(${wallScale})`,
              transition: reduced ? undefined : 'transform 100ms linear',
              transformOrigin: 'center',
            }}
          >
            <div
              key={shakeKey}
              data-testid="wall"
              aria-label={`Wall ${state.wallIndex + 1} — hole ${holeText}`}
              role="img"
              className="relative grid grid-cols-3 gap-1 rounded-xl p-2"
              style={{
                border: `2px solid ${fits ? 'var(--neon-lime)' : tint('--neon-purple', 60)}`,
                boxShadow: fits ? '0 0 18px var(--neon-lime)' : undefined,
                background: tint('--neon-purple', 10),
                animation: !reduced && shakeKey > 0 ? 'sf-shake 320ms ease-out' : undefined,
              }}
            >
              {statuses.map((st, i) => (
                <div
                  key={i}
                  data-testid="wall-cell"
                  data-status={st}
                  className="size-16 rounded-md sm:size-20"
                  style={CELL_STYLE[st]}
                />
              ))}
              {flash && !reduced && (
                <div
                  key={flash.seq}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{
                    background: flash.kind === 'pass' ? 'var(--neon-lime)' : 'var(--neon-red)',
                    animation: 'sf-flash 420ms ease-out both',
                  }}
                />
              )}
            </div>
          </div>
          {fits && state.phase === 'approach' && (
            <span
              data-testid="fits"
              className="absolute right-1 top-1 rounded-md border border-neon-lime/60 bg-bg-2/90 px-2 py-0.5 text-xs font-extrabold tracking-widest text-neon-lime"
              style={{ animation: reduced ? undefined : 'sf-pulse 700ms ease-in-out infinite' }}
            >
              FITS
            </span>
          )}
          {banner && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                key={banner.seq}
                className="rounded-lg bg-bg-2/90 px-3 py-1 text-xl font-extrabold tracking-wide"
                style={{
                  color: banner.color,
                  textShadow: `0 0 10px ${banner.color}`,
                  animation: reduced ? undefined : 'sf-pop 1s ease-out both',
                }}
              >
                {banner.text}
              </span>
            </div>
          )}
        </div>

        {/* PIECE */}
        <div
          data-testid="piece"
          aria-label={`Your block: ${state.voxels.length} cubes`}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            pointerRef.current = null
          }}
          className="relative mx-auto mt-2 h-44 w-full overflow-hidden rounded-xl border border-border bg-bg-2/50"
          style={{ touchAction: 'none', perspective: '600px' }}
        >
          <span className="absolute left-2 top-1 text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
            Your block
          </span>
          <div
            className="absolute left-1/2 top-1/2"
            style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-20deg) rotateY(-30deg)' }}
          >
            <div ref={animRef} style={{ transformStyle: 'preserve-3d' }}>
              {state.voxels.map((v) => (
                <Voxel key={v.join(',')} v={v} />
              ))}
            </div>
          </div>
        </div>

        {/* PAD */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {PAD.map((row) => (
            <div key={row.row} className="flex items-center gap-1">
              {row.buttons.map((b) => (
                <button
                  key={b.testId}
                  type="button"
                  data-testid={b.testId}
                  data-shadowfit-control=""
                  aria-label={b.label}
                  onClick={() => rotate(b.axis, b.dir)}
                  disabled={over}
                  className="btn-press flex min-h-11 min-w-11 flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-bg-2/70 text-lg text-neon-cyan hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:opacity-40"
                >
                  <span className="text-[10px] font-bold text-fg-muted">{row.row}</span>
                  <span aria-hidden="true">{b.glyph}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          data-testid="slam"
          data-shadowfit-control=""
          aria-label="Slam the block through the wall now"
          onClick={slam}
          disabled={over}
          className="btn-press mt-2 min-h-12 w-full rounded-lg border-2 font-extrabold uppercase tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-lime disabled:opacity-40"
          style={{
            borderColor: fits ? 'var(--neon-lime)' : 'var(--neon-magenta)',
            color: fits ? 'var(--neon-lime)' : 'var(--neon-magenta)',
            background: tint(fits ? '--neon-lime' : '--neon-magenta', 12),
          }}
        >
          Slam
        </button>

        <p className="sr-only" aria-live="polite">
          {announce}
        </p>

        {/* ready card */}
        {ready && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-bg/80">
            <div className="mx-4 flex flex-col items-center gap-3 rounded-xl border border-neon-cyan/50 bg-bg-2/90 px-5 py-4 text-center shadow-[0_0_18px_rgba(34,211,238,.25)]">
              <p className="text-base font-bold text-neon-cyan">Fit the shadow through the hole</p>
              <p className="text-xs text-fg-muted">
                Roll the block on X / Y / Z. When its shadow matches the hole exactly, it passes. Slam early for
                bonus, match par for <span className="font-bold text-neon-lime">Perfect</span>. Three crashes end
                the run.
              </p>
              <GameButton data-testid="shadowfit-start" data-shadowfit-control="" onClick={() => dispatch({ type: 'start' })}>
                Start
              </GameButton>
            </div>
          </div>
        )}

        {/* paused card — hides the board so you can't solve while frozen */}
        {paused && !over && (
          <button
            type="button"
            onClick={() => setPausedBoth(false)}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-bg"
          >
            <span className="text-2xl font-extrabold">Paused</span>
            <span className="text-xs text-fg-muted">Tap or press P to resume</span>
          </button>
        )}

        <GameOverlay
          show={over}
          variant={outcome?.kind === 'win' ? 'win' : 'lose'}
          title={overlayTitle}
          testId="game-over"
        >
          {outcome && challenge && (
            <p data-testid="challenge-result" className="text-base font-bold">
              {outcome.kind === 'win' && (
                <>
                  🏆 +{outcome.diff} over {challenge.name}&apos;s {challenge.score}
                </>
              )}
              {outcome.kind === 'tie' && <>Both scored {challenge.score} — break the tie</>}
              {outcome.kind === 'lose' && (
                <>
                  {outcome.diff} short of {challenge.score} ({outcome.pct}%) — one more?
                </>
              )}
            </p>
          )}
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Walls passed <span className="font-bold text-accent">{state.passed}</span>
            </p>
            <p>
              Perfect fits <span className="font-bold text-accent">{state.perfects}</span>
            </p>
            <p>
              Best streak <span className="font-bold text-accent">{state.bestStreak}</span>
            </p>
          </div>
          <GameButton onClick={startNew}>{challenge ? 'Rematch' : 'Play again'}</GameButton>
          {state.score > 0 && (
            <div className="flex flex-col items-center gap-2" data-testid="challenge-share">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME_LEN}
                placeholder="Your name"
                aria-label="Your name for the challenge link"
                className="w-40 rounded-lg border border-border bg-bg-2 px-3 py-1.5 text-center text-sm text-fg"
              />
              <GameButton
                variant="ghost"
                onClick={() => void shareChallenge(state.seed, state.score, state.passed)}
              >
                {shareStatus === 'copied'
                  ? 'Link copied!'
                  : outcome?.kind === 'win' && challenge
                    ? `Send it back to ${challenge.name}`
                    : 'Challenge a friend'}
              </GameButton>
            </div>
          )}
        </GameOverlay>

        <style>{`
          @keyframes sf-shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(7px); }
            60% { transform: translateX(-5px); }
            80% { transform: translateX(3px); }
          }
          @keyframes sf-flash {
            0% { opacity: .6; }
            100% { opacity: 0; }
          }
          @keyframes sf-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: .65; transform: scale(1.08); }
          }
          @keyframes sf-pop {
            0% { opacity: 0; transform: scale(.6); }
            20% { opacity: 1; transform: scale(1.12); }
            35% { transform: scale(1); }
            80% { opacity: 1; }
            100% { opacity: 0; transform: scale(1); }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
