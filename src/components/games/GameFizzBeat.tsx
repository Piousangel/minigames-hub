'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COUNT_IN,
  MAX_PHASES,
  PHASE_BEATS,
  STARTING_LIVES,
  TICK_MS,
  beatTick,
  beatValue,
  createGame,
  expectKey,
  hasCountIn,
  multiplierFor,
  phaseOf,
  reduce,
  type Expect,
  type FizzAction,
  type FizzState,
  type Side,
} from '@/lib/games/fizzbeat/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { sendHit } from '@/lib/hit'
import { MAX_NAME_LEN, loadPlayerName, savePlayerName } from '@/lib/leaderboard'
import { challengeUrl, compareChallenge, parseChallenge, type Challenge } from '@/lib/challenge'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

/** rAF frame delta cap (ms) — a background-tab catch-up must not fire a burst of beats. */
const MAX_FRAME_MS = 100
/** Max engine ticks per catch-up call. */
const MAX_TICKS_PER_STEP = 12
const PAD_FLASH_MS = 120
const ERROR_FLASH_MS = 300
const LAST_BEAT = MAX_PHASES * PHASE_BEATS - 1

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const raw = Number(localStorage.getItem(storageKey))
    return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, score: number): void {
  try {
    localStorage.setItem(storageKey, String(score))
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

/** 도전 모드를 끄면 주소창에서 vs/n/ref를 지워, 새로고침해도 일반 판으로 돌아오게 한다. */
function clearChallengeParams(): void {
  try {
    const url = new URL(window.location.href)
    for (const k of ['vs', 'n', 'ref']) url.searchParams.delete(k)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    // ignore
  }
}

function isControlTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && t.closest('button, a, [role="button"]') !== null
}

/**
 * Controls that own Space for themselves: the game-over overlay (Rematch / Challenge a friend)
 * and the challenge banner (Play solo). Any other focused control — the header New Game / Mute
 * button left focused after a mouse click — must not eat "Space to start" or reset a live run.
 */
function isOverlayControlTarget(t: EventTarget | null): boolean {
  return (
    isControlTarget(t) &&
    t instanceof HTMLElement &&
    t.closest('[data-testid="game-over"], [data-testid="challenge-banner"]') !== null
  )
}

function wantText(e: Expect): string {
  const k = expectKey(e)
  return k === 'LR' ? 'L+R' : k === '' ? 'silence' : k
}

/** Render-relevant view of the state. The engine ticks at 100 Hz; React only re-renders when this changes. */
interface View {
  beat: number // clamped cursor
  k: number
  T: number
  W: number
  P: number
  inCountIn: boolean
  litDots: number
  showNext: boolean
}

function viewOf(s: FizzState): View {
  const beat = Math.min(s.cursor, LAST_BEAT)
  const k = phaseOf(beat)
  const p = s.phases[k]
  const T = beatTick(s.phases, s.phaseStart, beat)
  // Count-in clicks lead up to T: at a phase start, or before the first unseen beat after a resume.
  const d = s.tick - (T - COUNT_IN * p.period)
  const running = s.status === 'running'
  const litDots = running && d >= 0 ? Math.min(COUNT_IN, Math.floor(d / p.period) + 1) : 0
  return {
    beat,
    k,
    T,
    W: p.window,
    P: p.period,
    inCountIn: s.status !== 'over' && hasCountIn(s, beat) && s.tick < T - p.window,
    litDots,
    showNext: running && s.tick >= T && (beat + 1) % PHASE_BEATS !== 0 && beat + 1 <= LAST_BEAT,
  }
}

function viewSig(s: FizzState, clickSeq: number): string {
  const v = viewOf(s)
  const j = s.lastJudgment
  return [
    s.status,
    s.cursor,
    s.lives,
    s.score,
    s.streak,
    j ? `${j.beat}${j.kind}` : '-',
    clickSeq,
    v.inCountIn ? 1 : 0,
    v.litDots,
    v.showNext ? 1 : 0,
  ].join('|')
}

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

function StreakBadge({ streak }: { streak: number }) {
  if (streak <= 0) return null
  return (
    <span
      data-testid="streak"
      className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-bold text-accent"
    >
      Streak {streak} · ×{multiplierFor(streak)}
    </span>
  )
}

type PadFlash = { side: Side | 'both'; id: number } | null

export function GameFizzBeat({ storageKey }: { storageKey: string }) {
  // SSR safety: the run is built only on the client.
  const [state, setState] = useState<FizzState | null>(null)
  const [best, setBest] = useState(0)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const challengeRef = useRef<Challenge | null>(null)
  const [name, setName] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')
  const [paused, setPaused] = useState(false)
  const [padFlash, setPadFlash] = useState<PadFlash>(null)
  const [errorFlash, setErrorFlash] = useState(0) // id of the active error flash, 0 = none

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<FizzState | null>(null)
  const bestRef = useRef(0)
  const accRef = useRef(0)
  const lastTsRef = useRef(0)
  const rafRef = useRef(0)
  const overPersistedRef = useRef(false)
  const pausedRef = useRef(false)
  const ringRef = useRef<HTMLDivElement | null>(null)
  const dotRef = useRef<HTMLDivElement | null>(null)
  const clickSeqRef = useRef(0)
  const sigRef = useRef('')
  const flashIdRef = useRef(0)
  const padTimerRef = useRef<number | null>(null)
  const errTimerRef = useRef<number | null>(null)

  const slug = storageKey.replace(/^best:/, '')

  const commit = useCallback((next: FizzState) => {
    stateRef.current = next
    sigRef.current = viewSig(next, clickSeqRef.current)
    setState(next)
  }, [])

  const persist = useCallback(
    (finalState: FizzState) => {
      // 도전 판은 같은 시드를 무한 Rematch할 수 있어 최고기록·주간 리더보드에 넣지 않는다.
      if (!challengeRef.current) {
        if (finalState.score > bestRef.current) {
          bestRef.current = finalState.score
          setBest(finalState.score)
        }
        saveBest(storageKey, Math.max(bestRef.current, finalState.score))
      }
      recordFinish(slug)
      if (challengeRef.current) sendHit(slug, 'challenge-done')
    },
    [storageKey, slug],
  )

  const flashPad = useCallback((side: Side | 'both', ms: number) => {
    const id = ++flashIdRef.current
    setPadFlash({ side, id })
    if (padTimerRef.current !== null) window.clearTimeout(padTimerRef.current)
    padTimerRef.current = window.setTimeout(() => {
      padTimerRef.current = null
      setPadFlash((cur) => (cur && cur.id === id ? null : cur))
    }, ms)
  }, [])

  const flashError = useCallback(() => {
    const id = ++flashIdRef.current
    setErrorFlash(id)
    if (errTimerRef.current !== null) window.clearTimeout(errTimerRef.current)
    errTimerRef.current = window.setTimeout(() => {
      errTimerRef.current = null
      setErrorFlash((cur) => (cur === id ? 0 : cur))
    }, ERROR_FLASH_MS)
  }, [])

  const dispatch = useCallback(
    (action: FizzAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      stateRef.current = next
      const ev = next.events

      // One sound per call: over > judged > phaseChanged > tap > click. 'rest' is silent.
      let sound: SoundName | null = null
      if (ev.over) sound = 'lose'
      else if (ev.judged === 'hit') sound = 'match'
      else if (ev.judged === 'wrong' || ev.judged === 'miss') sound = 'mismatch'
      else if (ev.phaseChanged) sound = 'merge'
      else if (ev.tap) sound = 'flip'
      else if (ev.click) sound = 'move'
      if (sound) play(sound)

      if (ev.click) clickSeqRef.current += 1
      if (ev.tap) flashPad(ev.tap, PAD_FLASH_MS)
      if (ev.judged === 'wrong' || ev.judged === 'miss') {
        flashError()
        if (ev.judged === 'wrong') flashPad('both', ERROR_FLASH_MS)
      }

      if (next.status === 'over' && !overPersistedRef.current) {
        overPersistedRef.current = true
        persist(next)
      }

      const sig = viewSig(next, clickSeqRef.current)
      if (sig !== sigRef.current) {
        sigRef.current = sig
        setState(next)
      }
    },
    [play, flashPad, flashError, persist],
  )

  /** Advance the fixed-timestep clock up to `ts` (rAF time or an input event's timeStamp). */
  const catchUp = useCallback(
    (ts: number) => {
      const last = lastTsRef.current
      if (last === 0 || ts < last) {
        lastTsRef.current = Math.max(last, ts)
        return
      }
      const dt = Math.min(ts - last, MAX_FRAME_MS)
      lastTsRef.current = ts
      const s = stateRef.current
      if (!s || s.status !== 'running' || pausedRef.current) {
        accRef.current = 0
        return
      }
      accRef.current += dt
      let n = 0
      while (accRef.current >= TICK_MS && n < MAX_TICKS_PER_STEP) {
        dispatch({ type: 'tick' })
        accRef.current -= TICK_MS
        n++
        if (stateRef.current?.status !== 'running') {
          accRef.current = 0
          break
        }
      }
      if (accRef.current > TICK_MS * MAX_TICKS_PER_STEP) accRef.current = 0
    },
    [dispatch],
  )

  // rAF driver + per-frame ring/dot transforms (direct DOM, no setState).
  useEffect(() => {
    function frame(ts: number) {
      catchUp(ts)
      const s = stateRef.current
      if (s) {
        const v = viewOf(s)
        const running = s.status === 'running' && !pausedRef.current
        const ring = ringRef.current
        if (ring) {
          const phase = Math.max(0, Math.min(1, 1 - (v.T - s.tick) / v.P))
          const scale = 1.6 - 0.6 * phase
          ring.style.transform = `scale(${scale})`
          ring.style.opacity = running && !reducedRef.current && !v.inCountIn ? String(0.25 + 0.6 * phase) : '0'
        }
        const dot = dotRef.current
        if (dot) {
          const d = s.tick - s.phaseStart[v.k]
          const sinceClick = d >= 0 ? d % v.P : Infinity
          dot.style.opacity = running && reducedRef.current ? (sinceClick < 10 ? '1' : '0.3') : '0'
        }
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [catchUp, reducedRef])

  const resetGame = useCallback(() => {
    overPersistedRef.current = false
    accRef.current = 0
    pausedRef.current = false
    setPaused(false)
    setShareStatus('idle')
    setPadFlash(null)
    setErrorFlash(0)
    commit(createGame(challengeRef.current?.seed ?? freshSeed()))
  }, [commit])

  // Init (client only, SSR-safe).
  useEffect(() => {
    const stored = loadBest(storageKey)
    bestRef.current = stored
    setBest(stored)
    const incoming = parseChallenge(window.location.search)
    challengeRef.current = incoming
    setChallenge(incoming)
    setName(loadPlayerName())
    resetGame()
    return () => {
      if (padTimerRef.current !== null) window.clearTimeout(padTimerRef.current)
      if (errTimerRef.current !== null) window.clearTimeout(errTimerRef.current)
    }
    // Mount once. resetGame is a stable useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startRun = useCallback(() => {
    const s = stateRef.current
    if (!s || s.status !== 'ready') return
    accRef.current = 0
    dispatch({ type: 'start' })
  }, [dispatch])

  /**
   * The clock restarts where pause() froze it, so the engine's resume forfeits every number that was
   * already on screen and counts in again before the next unseen one — pausing buys no thinking time.
   */
  const resume = useCallback(() => {
    if (!pausedRef.current) return
    accRef.current = 0
    lastTsRef.current = 0
    pausedRef.current = false
    setPaused(false)
    dispatch({ type: 'resume' })
  }, [dispatch])

  const press = useCallback(
    (side: Side, ts: number) => {
      const s = stateRef.current
      if (!s || s.status !== 'running' || pausedRef.current) return
      // Bring the engine clock up to the input's real time before judging it. Only when the
      // event clock looks like the rAF clock: an epoch-based timeStamp (old engines, synthetic
      // events) would otherwise jump lastTs into the far future and freeze the metronome.
      if (Number.isFinite(ts) && Math.abs(ts - lastTsRef.current) <= 1000) catchUp(ts)
      dispatch({ type: 'press', side })
    },
    [catchUp, dispatch],
  )

  const pause = useCallback(() => {
    if (stateRef.current?.status !== 'running') return
    pausedRef.current = true
    accRef.current = 0
    setPaused(true)
  }, [])

  // Auto-pause when the tab is hidden; the engine itself knows nothing about pausing.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') pause()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [pause])

  // Keyboard: layout-independent e.code.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      let side: Side | null = null
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyF':
        case 'KeyD':
          side = 'L'
          break
        case 'ArrowRight':
        case 'KeyJ':
        case 'KeyK':
          side = 'R'
          break
        case 'Space':
          // Starts a fresh run or resumes a paused one. Never restarts from game over — the
          // overlay buttons (Rematch / Challenge a friend) must keep Space/Enter for themselves.
          if (isOverlayControlTarget(e.target)) return
          if (s.status !== 'ready' && s.status !== 'running') return
          // Ready or running: Space belongs to the game. Swallow it (no page scroll mid-run) and
          // drop focus from any stray control so its keyup cannot click it (New Game would reset).
          e.preventDefault()
          if (isControlTarget(e.target)) (e.target as HTMLElement).blur()
          if (e.repeat) return
          if (s.status === 'ready') startRun()
          else if (pausedRef.current) resume()
          return
        case 'KeyP':
        case 'Escape':
          if (s.status !== 'running' || e.repeat) return
          e.preventDefault()
          if (pausedRef.current) resume()
          else pause()
          return
        default:
          return
      }
      e.preventDefault()
      if (e.repeat) return
      press(side, e.timeStamp)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, startRun, pause, resume])

  const leaveChallenge = useCallback(() => {
    challengeRef.current = null
    setChallenge(null)
    clearChallengeParams()
    resetGame()
  }, [resetGame])

  const shareChallenge = useCallback(
    async (seed: number, score: number, survived: number) => {
      const trimmed = name.trim()
      if (trimmed) savePlayerName(trimmed)
      const url = challengeUrl(window.location.origin, slug, { seed, score, name: trimmed })
      const text = `I scored ${score} in FizzBeat (${survived} beats). Same rules, same run — can you beat me? 🥁`
      try {
        if (navigator.share) {
          await navigator.share({ title: 'FizzBeat challenge', text, url })
        } else {
          await navigator.clipboard.writeText(`${text} ${url}`)
          setShareStatus('copied')
        }
        sendHit(slug, 'challenge-sent')
      } catch {
        // 취소/불가 무시
      }
    },
    [name, slug],
  )

  const onPadDown = useCallback(
    (side: Side) => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      press(side, e.timeStamp)
    },
    [press],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="fizzbeat-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const v = viewOf(state)
  const rule = state.phases[v.k]
  const over = state.status === 'over'
  const ready = state.status === 'ready'
  const running = state.status === 'running'
  const bpm = Math.round(6000 / rule.period)
  const stepLabel = `count ${rule.dir === 1 ? '+' : '−'}${rule.step}`
  const value = beatValue(state.phases, v.beat)
  const nextValue = v.showNext ? beatValue(state.phases, v.beat + 1) : null
  const clickSeq = clickSeqRef.current
  const lj = state.lastJudgment

  const outcome = challenge && over ? compareChallenge(state.score, challenge.score) : null
  // Surviving all MAX_PHASES phases also ends the run (lives > 0) — that is not a loss.
  const finishedAll = over && state.lives > 0
  const overlayTitle = !outcome
    ? finishedAll
      ? 'Counted to the end!'
      : 'Lost the count'
    : outcome.kind === 'win'
      ? `You beat ${challenge!.name}!`
      : outcome.kind === 'tie'
        ? `Dead even with ${challenge!.name}`
        : `${challenge!.name} kept the count`

  const padClass = (side: Side) => {
    const flashing = padFlash && (padFlash.side === side || padFlash.side === 'both')
    const wrong = padFlash?.side === 'both'
    const tone =
      side === 'L'
        ? 'border-neon-cyan/70 text-neon-cyan focus-visible:ring-neon-cyan'
        : 'border-neon-magenta/70 text-neon-magenta focus-visible:ring-neon-magenta'
    return {
      className: `relative flex h-full w-full select-none flex-col items-center justify-center overflow-hidden rounded-xl border-2 bg-bg-2/60 font-extrabold tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 ${tone} ${reduced ? '' : 'transition-transform duration-100'}`,
      style: {
        touchAction: 'none' as const,
        transform: !reduced && flashing ? 'scale(0.96)' : undefined,
      },
      flashing: !!flashing,
      wrong,
    }
  }

  const left = padClass('L')
  const right = padClass('R')
  const flashBg = (side: Side, wrong: boolean) =>
    wrong ? 'bg-neon-red/35' : side === 'L' ? 'bg-neon-cyan/30' : 'bg-neon-magenta/30'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Beats', value: state.survived, testId: 'beats' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={
        <>
          <LivesHearts lives={state.lives} />
          <StreakBadge streak={state.streak} />
        </>
      }
      onNewGame={resetGame}
      newGameLabel={over ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={`After 4 count-in clicks, judge each number on the beat: multiple of ${rule.a} → LEFT (← / F / D, or tap), multiple of ${rule.b} → RIGHT (→ / J / K), both → both at once, anything else → stay silent. A wrong press or a miss costs one of 3 lives. Every 30 beats the divisors change, and later phases count in steps of 2, 3 or 7 or count down — watch the chips. P / Esc pauses, but the number on screen is forfeited (judged as you left it) and a fresh count-in plays before the next one.`}
      maxWidthClassName="max-w-125"
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
          {/* 진행 중엔 숨긴다 — 보드 바로 위라 모바일 오탭 한 번에 판이 날아간다. */}
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

      <div
        className="relative rounded-xl bg-surface p-4"
        data-testid="fizzbeat-board"
        data-status={state.status}
      >
        {/* error border (reduced-motion keeps this, drops the shake) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-neon-red"
          style={{ opacity: errorFlash ? 1 : 0, transition: reduced ? undefined : 'opacity 150ms' }}
        />
        <div
          style={
            !reduced && errorFlash
              ? { animation: `${errorFlash % 2 ? 'fb-shake-a' : 'fb-shake-b'} 200ms ease-in-out` }
              : undefined
          }
        >
          {/* 1. rule chips */}
          <div
            key={`rule-${v.k}`}
            className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs font-bold"
            style={!reduced && v.k > 0 ? { animation: 'fb-chip-in 250ms ease-out' } : undefined}
          >
            <span data-testid="rule-left" className="rounded-md border border-neon-cyan/70 px-2 py-1 text-neon-cyan">
              LEFT ÷{rule.a}
            </span>
            <span
              data-testid="rule-right"
              className="rounded-md border border-neon-magenta/70 px-2 py-1 text-neon-magenta"
            >
              RIGHT ÷{rule.b}
            </span>
            <span data-testid="rule-step" className="rounded-md border border-neon-amber/70 px-2 py-1 text-neon-amber">
              {stepLabel}
            </span>
            <span className="rounded-md border border-border px-2 py-1 text-fg-muted">≈{bpm} BPM</span>
            <span data-testid="phase" className="rounded-md border border-border px-2 py-1 text-fg-muted">
              Phase {v.k + 1}
            </span>
          </div>
          <p className="sr-only" aria-live="polite">
            {`New rule: LEFT on multiples of ${rule.a}, RIGHT on multiples of ${rule.b}, counting ${rule.dir === 1 ? 'up' : 'down'} by ${rule.step}.`}
          </p>

          {/* 2. number stage */}
          <div className="relative mx-auto flex h-48 items-center justify-center">
            <div
              ref={ringRef}
              aria-hidden="true"
              className="pointer-events-none absolute h-36 w-36 rounded-full border-4 border-accent"
              style={{ opacity: 0, transform: 'scale(1.6)' }}
            />
            <div
              ref={dotRef}
              aria-hidden="true"
              className="pointer-events-none absolute top-2 h-3 w-3 rounded-full bg-accent"
              style={{ opacity: 0 }}
            />
            {v.inCountIn ? (
              <div className="flex flex-col items-center gap-3" data-testid="count-in">
                <div className="flex gap-3 text-3xl" aria-hidden="true">
                  {Array.from({ length: COUNT_IN }, (_, i) => (
                    <span key={i} className={i < v.litDots ? 'text-accent' : 'text-fg-muted/30'}>
                      ●
                    </span>
                  ))}
                </div>
                <span className="text-sm font-semibold uppercase tracking-widest text-fg-muted">
                  {ready ? 'Ready' : 'Get ready'}
                </span>
              </div>
            ) : (
              <span
                key={`n-${v.beat}-${clickSeq}`}
                data-testid="beat-number"
                className="relative font-mono text-7xl font-extrabold tabular-nums text-fg"
                style={!reduced && running ? { animation: 'fb-pop 120ms ease-out' } : undefined}
              >
                {value}
              </span>
            )}
            {nextValue !== null && (
              <span
                data-testid="next-number"
                className="absolute right-4 font-mono text-2xl font-bold tabular-nums text-fg-muted/50"
                style={!reduced ? { animation: 'fb-fade 150ms ease-out' } : undefined}
              >
                {nextValue}
              </span>
            )}

            {ready && (
              <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 rounded-xl bg-surface/80">
                <GameButton onClick={startRun} data-testid="fizzbeat-start" className="px-6 py-2 text-base">
                  Start
                </GameButton>
                <span className="text-xs text-fg-muted">Space to start</span>
              </div>
            )}
          </div>

          {/* 3. judgment feedback (answer only revealed after the window closes) */}
          <div className="mb-3 flex h-6 items-center justify-center text-sm font-bold" data-testid="judgment">
            {lj && (
              <span
                key={`${lj.beat}-${lj.kind}`}
                style={!reduced ? { animation: 'fb-judge 500ms ease-out both' } : undefined}
                className={
                  lj.kind === 'hit' ? 'text-neon-lime' : lj.kind === 'rest' ? 'text-fg-muted' : 'text-neon-red'
                }
              >
                {lj.kind === 'hit' && `✓ ${lj.value}`}
                {lj.kind === 'rest' && `· rest`}
                {(lj.kind === 'wrong' || lj.kind === 'miss') && `✗ ${lj.value} wanted ${wantText(lj.expected)}`}
              </span>
            )}
          </div>

          {/* 4. pads */}
          <div className="grid h-28 grid-cols-2 gap-3">
            {(
              [
                ['L', left, 'pad-left', `LEFT — multiples of ${rule.a}`, 'LEFT', `÷${rule.a} · ← F`],
                ['R', right, 'pad-right', `RIGHT — multiples of ${rule.b}`, 'RIGHT', `÷${rule.b} · → J`],
              ] as const
            ).map(([side, pad, testId, label, title, sub]) => (
              <button
                key={side}
                type="button"
                data-testid={testId}
                aria-label={label}
                onPointerDown={onPadDown(side)}
                disabled={!running}
                className={pad.className}
                style={pad.style}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 ${flashBg(side, pad.wrong)}`}
                  style={{ opacity: pad.flashing ? 1 : 0, transition: reduced ? undefined : 'opacity 120ms' }}
                />
                <span className="relative text-lg">{title}</span>
                <span className="relative text-xs font-semibold text-fg-muted">{sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* paused card */}
        {paused && running && (
          <div
            data-testid="paused"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg"
          >
            {/* Opaque on purpose: pausing must not become a free look at the upcoming numbers. */}
            <p className="text-xl font-extrabold">Paused</p>
            <GameButton onClick={resume} data-testid="fizzbeat-resume">
              Resume
            </GameButton>
            <span className="text-xs text-fg-muted">Space / P to resume · the number on screen is forfeited</span>
          </div>
        )}

        <GameOverlay show={over} variant={outcome?.kind === 'win' || (!outcome && finishedAll) ? 'win' : 'lose'} title={overlayTitle} testId="game-over">
          {outcome && (
            <p data-testid="challenge-result" className="text-base font-bold">
              {outcome.kind === 'win' && <>🏆 +{outcome.diff} over {challenge!.name}&apos;s {challenge!.score}</>}
              {outcome.kind === 'tie' && <>Both scored {challenge!.score} — break the tie</>}
              {outcome.kind === 'lose' && (
                <>
                  {outcome.diff} short of {challenge!.score} ({outcome.pct}%) — one more?
                </>
              )}
            </p>
          )}
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Beats survived <span className="font-bold text-accent">{state.survived}</span>
            </p>
            <p>
              Phase reached <span className="font-bold text-accent">{v.k + 1}</span>
            </p>
            <p>
              Best streak <span className="font-bold text-accent">{state.bestStreak}</span>
            </p>
          </div>
          <GameButton onClick={resetGame}>{challenge ? 'Rematch' : 'Try again'}</GameButton>
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
                onClick={() => void shareChallenge(state.seed, state.score, state.survived)}
              >
                {shareStatus === 'copied'
                  ? 'Link copied!'
                  : outcome?.kind === 'win'
                    ? `Send it back to ${challenge!.name}`
                    : 'Challenge a friend'}
              </GameButton>
            </div>
          )}
        </GameOverlay>

        <style>{`
          @keyframes fb-pop { from { transform: scale(1.12); } to { transform: scale(1); } }
          @keyframes fb-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes fb-chip-in { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes fb-judge { from { opacity: 1; transform: scale(1.08); } to { opacity: 0.75; transform: scale(1); } }
          @keyframes fb-shake-a {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            75% { transform: translateX(4px); }
          }
          @keyframes fb-shake-b {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            75% { transform: translateX(4px); }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
