'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  MAX_BALLS,
  MAX_HEIGHT,
  WINDOW,
  beatMs,
  bpmForBeat,
  createGame,
  reduce,
  stageForBeat,
  type DeathCause,
  type SiteswapAction,
  type SiteswapState,
  type Slot,
} from '@/lib/games/siteswap/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { sendHit } from '@/lib/hit'
import { MAX_NAME_LEN, loadPlayerName, savePlayerName } from '@/lib/leaderboard'
import { challengeUrl, clearChallengeParams, compareChallenge, parseChallenge, type Challenge } from '@/lib/challenge'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

/** rAF frame delta cap (ms) — a background-tab catch-up must not fire a burst of beats. */
const MAX_FRAME_MS = 100
/** A press this close to the end of an empty-handed beat is buffered for the next beat. */
const EARLY_WINDOW_MS = 120

// SVG geometry (viewBox 0 0 360 230)
const VB_W = 360
const VB_H = 230
const COL_W = 36
const HAND_X = 36
const BASE_Y = 170
const ARC_UNIT = 26
const SLOT_Y = 210
const HELD_Y = 182
const x = (k: number) => HAND_X + k * COL_W

const HEIGHTS = Array.from({ length: MAX_HEIGHT }, (_, i) => i + 1)

const tint = (v: string, pct: number) => `color-mix(in srgb, var(${v}) ${pct}%, transparent)`

const DEATH_TITLE: Record<DeathCause, string> = {
  dropped: 'Dropped it!',
  collision: 'Mid-air collision',
  bird: 'Hit a bird',
  drop: 'Clipped the new ball',
}

const DEATH_HINT: Record<DeathCause, string> = {
  dropped: 'Every caught ball has to be tossed again before the next beat.',
  collision: 'That beat already had a ball coming down — two balls can never land together.',
  bird: 'A bird was sitting on that beat and knocked the ball away. Toss around the red birds.',
  drop: 'The magenta ball drops into your hand on its beat — keep that beat clear.',
}

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
    localStorage.setItem(storageKey, String(best))
  } catch {
    // ignore storage failures
  }
}

/** Focus is on a control that handles Enter/Space itself (overlay buttons, links, inputs). */
function isControlTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && t.closest('button, a[href], input, textarea, select, [role="button"]') !== null
}

interface Banner {
  seq: number
  text: string
  color: string
}

function SlotGlyph({ slot, k, deathHere }: { slot: Slot; k: number; deathHere: boolean }) {
  const cx = x(k)
  const cy = SLOT_Y
  let body: React.ReactNode
  if (slot === 'ball') {
    body = <circle cx={cx} cy={cy} r={6.5} fill="var(--neon-cyan)" style={{ filter: 'drop-shadow(0 0 3px var(--neon-cyan))' }} />
  } else if (slot === 'bird') {
    body = (
      <path
        d={`M${cx - 8} ${cy - 3} Q${cx - 4} ${cy - 6} ${cx} ${cy + 2} Q${cx + 4} ${cy - 6} ${cx + 8} ${cy - 3}`}
        fill="none"
        stroke="var(--neon-red)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  } else if (slot === 'drop') {
    body = (
      <g>
        <path
          d={`M${cx - 4} ${cy - 17} L${cx} ${cy - 13} L${cx + 4} ${cy - 17}`}
          fill="none"
          stroke="var(--neon-magenta)"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6.5} fill={tint('--neon-magenta', 35)} stroke="var(--neon-magenta)" strokeWidth={1.8} />
        <text x={cx + 9} y={cy - 7} fontSize={8} fontWeight={700} fill="var(--neon-magenta)">
          +1
        </text>
      </g>
    )
  } else {
    body = <circle cx={cx} cy={cy} r={6} fill="none" stroke="var(--fg-muted)" strokeOpacity={0.45} strokeWidth={1.2} />
  }
  return (
    <g data-testid={`slot-${k}`} data-slot={slot} opacity={k >= 6 ? 0.45 : 1}>
      {body}
      {deathHere && <circle cx={cx} cy={cy} r={11} fill="none" stroke="var(--neon-red)" strokeWidth={2} />}
    </g>
  )
}

export function GameSiteswap({ storageKey }: { storageKey: string }) {
  // SSR safety: the run (and its random seed) is created on the client only.
  const [state, setState] = useState<SiteswapState | null>(null)
  const [paused, setPaused] = useState(false)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [banner, setBanner] = useState<Banner | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  // 1:1 도전(?vs=...) — 있으면 모든 판(재시작 포함)을 도전자와 같은 시드로 시작한다.
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const challengeRef = useRef<Challenge | null>(null)
  const [name, setName] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<SiteswapState | null>(null)
  const pausedRef = useRef(false)
  const bestRef = useRef(0)
  const accRef = useRef(0)
  const lastTsRef = useRef(0)
  const rafRef = useRef(0)
  const overPersistedRef = useRef(false)
  const timelineRef = useRef<SVGGElement | null>(null)
  const ballRefs = useRef(new Map<number, SVGGElement>())
  const bannerSeq = useRef(0)

  const commit = useCallback((next: SiteswapState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // accRef (elapsed part of the current beat) is kept across pause/resume:
  // resetting it would hand out a fresh full beat on every P,P.
  const setPausedBoth = useCallback((p: boolean) => {
    pausedRef.current = p
    setPaused(p)
  }, [])

  const showBanner = useCallback((text: string, color: string) => {
    const seq = ++bannerSeq.current
    setBanner({ seq, text, color })
  }, [])

  // Banner lifetime is owned by a timer (the keyframes are cosmetic and off under reduced motion).
  useEffect(() => {
    if (!banner) return
    const id = window.setTimeout(() => setBanner((b) => (b && b.seq === banner.seq ? null : b)), 1100)
    return () => window.clearTimeout(id)
  }, [banner])

  /** Write the beat-phase transforms straight to the DOM (no React render per frame). */
  const paint = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const phase =
      reducedRef.current || s.status !== 'running' ? 0 : Math.min(1, Math.max(0, accRef.current / beatMs(s.beat)))
    const tl = timelineRef.current
    if (tl) tl.style.transform = `translate3d(${-phase * COL_W}px,0,0)`
    const now = s.beat + phase
    for (const f of s.flights) {
      const el = ballRefs.current.get(f.id)
      if (!el) continue
      const h = f.to - f.from
      const t = Math.min(1, Math.max(0, (now - f.from) / h))
      const y = BASE_Y - 4 * ARC_UNIT * h * t * (1 - t)
      el.style.transform = `translate(0px, ${y}px)`
    }
  }, [reducedRef])

  // After every React commit, re-place newly mounted balls before the browser paints.
  useLayoutEffect(() => {
    paint()
  }, [state, paused, reduced, shakeKey, paint])

  // Init run + best + incoming challenge (client only).
  useEffect(() => {
    const b = loadBest(storageKey)
    bestRef.current = b
    setBest(b)
    const incoming = parseChallenge(window.location.search)
    challengeRef.current = incoming
    setChallenge(incoming)
    setName(loadPlayerName())
    overPersistedRef.current = false
    commit(createGame(incoming?.seed ?? freshSeed()))
  }, [storageKey, commit])

  const startNew = useCallback(() => {
    accRef.current = 0
    lastTsRef.current = 0
    overPersistedRef.current = false
    setPausedBoth(false)
    setNewBest(false)
    setBanner(null)
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
    async (seed: number, score: number) => {
      const slug = storageKey.replace(/^best:/, '')
      const trimmed = name.trim()
      if (trimmed) savePlayerName(trimmed)
      const url = challengeUrl(window.location.origin, slug, { seed, score, name: trimmed })
      const text = `I juggled ${score} in Siteswap. Same birds, same tempo — can you beat me? 🤹`
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Siteswap challenge', text, url })
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

  const persist = useCallback(
    (final: SiteswapState) => {
      const slug = storageKey.replace(/^best:/, '')
      // 도전 판은 같은 시드를 무한 Rematch할 수 있어(새 위치 암기) 최고기록에 넣지 않는다 —
      // 넣으면 아무 시드로 링크를 만들어 리더보드를 파밍할 수 있다.
      if (!challengeRef.current && final.score > bestRef.current) {
        bestRef.current = final.score
        setBest(final.score)
        saveBest(storageKey, final.score)
        setNewBest(true)
        play('win')
      }
      recordFinish(slug)
      if (challengeRef.current) sendHit(slug, 'challenge-done')
    },
    [play, storageKey],
  )

  const dispatch = useCallback(
    (action: SiteswapAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      if (next === prev) return
      commit(next)

      const ev = next.lastEvent
      const ticked = action.type === 'tick' && next.lastTick !== null && next.lastTick !== prev.lastTick
      if (ticked && next.lastTick) {
        const { beat, arrived, stageUp } = next.lastTick
        const parts: string[] = []
        if (arrived === 'drop') {
          play('eat')
          showBanner('+1 BALL', 'var(--neon-magenta)')
          parts.push(`New ball joined — ${next.balls} balls`)
        } else if (arrived === 'ball' && beat % 4 === 0) {
          play('move')
        }
        if (stageUp) {
          const stage = stageForBeat(beat) + 1
          const bpm = bpmForBeat(beat)
          play('match')
          if (arrived !== 'drop') showBanner(`STAGE ${stage} · ${bpm} BPM`, 'var(--neon-amber)')
          parts.push(`Stage ${stage}, ${bpm} BPM`)
        }
        if (parts.length) setAnnounce(parts.join(' — '))
      }

      if (ev === 'toss') play('flip')

      if (ev === 'dead' && prev.status !== 'dead') {
        play('lose')
        setShakeKey((k) => k + 1)
        const cause = next.deathCause ?? 'dropped'
        setAnnounce(`${DEATH_TITLE[cause]} Score ${next.score} after ${next.beat} beats.`)
        if (!overPersistedRef.current) {
          overPersistedRef.current = true
          persist(next)
        }
      }
    },
    [commit, persist, play, showBanner],
  )

  /** A toss from any input source. Resumes (without tossing) when paused. */
  const sendToss = useCallback(
    (h: number) => {
      const s = stateRef.current
      if (!s || s.status === 'dead') return
      if (pausedRef.current) {
        setPausedBoth(false)
        return
      }
      const early = s.status === 'running' && beatMs(s.beat) - accRef.current <= EARLY_WINDOW_MS
      dispatch({ type: 'toss', h, early })
    },
    [dispatch, setPausedBoth],
  )

  // rAF beat driver: accumulate real ms, fire one tick per beat length.
  useEffect(() => {
    function frame(ts: number) {
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      let dt = ts - last
      if (dt > MAX_FRAME_MS) dt = MAX_FRAME_MS

      const s = stateRef.current
      if (s && s.status === 'running' && !pausedRef.current) {
        accRef.current += dt
        let cur = s
        while (accRef.current >= beatMs(cur.beat)) {
          accRef.current -= beatMs(cur.beat)
          dispatch({ type: 'tick' })
          const nxt = stateRef.current
          if (!nxt || nxt.status !== 'running') {
            accRef.current = 0
            break
          }
          cur = nxt
        }
      } else if (!s || s.status !== 'running') {
        accRef.current = 0
      }
      paint()
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [dispatch, paint])

  // Auto-pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && stateRef.current?.status === 'running') setPausedBoth(true)
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
      // Outside a live run, Enter/Space on a focused button/link must activate it
      // (e.g. "Challenge a friend"), not restart the game.
      if (
        (key === 'Enter' || key === ' ') &&
        (s.status !== 'running' || pausedRef.current) &&
        isControlTarget(e.target) &&
        !(e.target instanceof HTMLElement && e.target.closest('[data-siteswap-control]'))
      ) {
        return
      }
      if (key >= '1' && key <= '5' && key.length === 1) {
        e.preventDefault()
        sendToss(Number(key))
        return
      }
      switch (key) {
        case 'p':
        case 'Escape':
          if (s.status === 'running') {
            e.preventDefault()
            setPausedBoth(!pausedRef.current)
          }
          return
        case 'r':
          // Only outside a live run (ready / dead) — a stray R must not wipe a run.
          if (s.status !== 'running') {
            e.preventDefault()
            startNew()
          }
          return
        case 'Enter':
          if (s.status === 'dead') {
            e.preventDefault()
            startNew()
          }
          return
        default:
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sendToss, setPausedBoth, startNew])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="siteswap-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const dead = state.status === 'dead'
  const ready = state.status === 'ready'
  const running = state.status === 'running'
  const cause = state.deathCause
  const bpm = bpmForBeat(state.beat)

  const hint = ready
    ? 'Press or tap 1–5 to toss the ball in your hand before the beat ends. A toss of h lands h beats later — never on another ball, a bird, or the incoming ball.'
    : dead && cause
      ? DEATH_HINT[cause]
      : paused
        ? 'Paused — press P or tap to resume'
        : 'Toss every caught ball before its beat ends · keys or tap 1–5 · P to pause'

  const outcome = challenge && dead ? compareChallenge(state.score, challenge.score) : null
  const overlayTitle = !outcome
    ? DEATH_TITLE[cause ?? 'dropped']
    : outcome.kind === 'win'
      ? `You beat ${challenge!.name}!`
      : outcome.kind === 'tie'
        ? `Dead even with ${challenge!.name}`
        : `${challenge!.name} keeps juggling`

  const headerExtra = (
    <>
      <span
        data-testid="balls"
        aria-label={`Balls: ${state.balls}`}
        className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm tracking-widest"
        style={{ color: 'var(--neon-lime)' }}
      >
        {'●'.repeat(state.balls)}
        <span className="text-fg-muted">{'○'.repeat(Math.max(0, MAX_BALLS - state.balls))}</span>
      </span>
      <span
        data-testid="bpm"
        className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm font-semibold tabular-nums"
        style={{ color: 'var(--neon-amber)' }}
      >
        {bpm} BPM
      </span>
    </>
  )

  const deathSlot = dead && cause !== 'dropped' && state.deathHeight !== null ? state.deathHeight : null

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Beats', value: state.beat, testId: 'beats' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={startNew}
      newGameLabel={dead ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
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
          {/* 진행 중인 판에선 숨긴다 — 보드 바로 위라 모바일 오탭 한 번에 판이 날아간다. */}
          {!running && (
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
        data-testid="siteswap-board"
        data-seed={state.seed}
        role="group"
        aria-label="Siteswap board"
        className={`relative rounded-xl bg-surface p-4 ${dead ? 'min-h-[460px]' : ''}`}
      >
        <div
          key={shakeKey}
          style={{ animation: !reduced && shakeKey > 0 ? 'ss-shake .38s ease-out both' : undefined }}
        >
          <div className="relative">
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="block h-auto w-full"
              role="img"
              aria-label={`Beat ${state.beat}. ${state.held ? 'A ball is in your hand.' : 'Hand empty.'}`}
            >
              <defs>
                <clipPath id="ss-clip">
                  <rect x={HAND_X - 12} y={0} width={VB_W - HAND_X + 12} height={VB_H} />
                </clipPath>
              </defs>

              {/* now column highlight */}
              <rect
                x={HAND_X - 15}
                y={8}
                width={30}
                height={VB_H - 10}
                rx={8}
                fill={tint('--accent', 7)}
                stroke={tint('--accent', 30)}
                strokeWidth={1}
              />
              {/* reach marker over k=1..5 */}
              <line
                x1={x(1) - 14}
                x2={x(MAX_HEIGHT) + 14}
                y1={VB_H - 3}
                y2={VB_H - 3}
                stroke={tint('--neon-cyan', 35)}
                strokeWidth={2}
                strokeLinecap="round"
              />

              <g clipPath="url(#ss-clip)">
                <g ref={timelineRef} style={{ willChange: 'transform' }}>
                  {/* arcs */}
                  {state.flights.map((f) => {
                    const h = f.to - f.from
                    const x1 = x(f.from - state.beat)
                    const x2 = x(f.to - state.beat)
                    const cy = BASE_Y - 2 * ARC_UNIT * h
                    return (
                      <path
                        key={`arc-${f.id}-${f.from}`}
                        d={`M${x1} ${BASE_Y} Q${(x1 + x2) / 2} ${cy} ${x2} ${BASE_Y}`}
                        fill="none"
                        stroke="var(--neon-cyan)"
                        strokeOpacity={0.4}
                        strokeWidth={1.4}
                        strokeDasharray="3 4"
                      />
                    )
                  })}
                  {/* landing ticks */}
                  {Array.from({ length: WINDOW }, (_, k) => (
                    <line
                      key={`tick-${state.beat + k}`}
                      x1={x(k)}
                      x2={x(k)}
                      y1={BASE_Y + 4}
                      y2={SLOT_Y - 11}
                      stroke="var(--fg-muted)"
                      strokeOpacity={k >= 6 ? 0.12 : 0.25}
                      strokeWidth={1}
                    />
                  ))}
                  {/* slot row */}
                  {state.slots.map((slot, k) => (
                    <SlotGlyph key={`slot-${state.beat + k}`} slot={slot} k={k} deathHere={deathSlot === k} />
                  ))}
                </g>
              </g>

              {/* now line */}
              <line
                x1={HAND_X}
                x2={HAND_X}
                y1={12}
                y2={BASE_Y}
                stroke="var(--fg-muted)"
                strokeOpacity={0.35}
                strokeDasharray="2 4"
              />

              {/* airborne balls on the now line (rAF moves them vertically only) */}
              {state.flights.map((f) => (
                <g
                  key={`ball-${f.id}`}
                  ref={(el) => {
                    if (el) ballRefs.current.set(f.id, el)
                    else ballRefs.current.delete(f.id)
                  }}
                  style={{ willChange: 'transform' }}
                >
                  <circle
                    cx={HAND_X}
                    cy={0}
                    r={8}
                    fill="var(--neon-lime)"
                    style={{ filter: 'drop-shadow(0 0 4px var(--neon-lime))' }}
                  />
                </g>
              ))}

              {/* held ball */}
              {state.held && (
                <g
                  className={!reduced && running && !paused ? 'ss-held' : undefined}
                  style={{ transformOrigin: `${HAND_X}px ${HELD_Y}px` }}
                >
                  <circle
                    cx={HAND_X}
                    cy={HELD_Y}
                    r={8}
                    fill={dead && cause === 'dropped' ? 'var(--neon-red)' : 'var(--neon-lime)'}
                    style={{ filter: 'drop-shadow(0 0 6px var(--neon-lime))' }}
                  />
                </g>
              )}

              {/* hand */}
              <path
                d={`M${HAND_X - 13} ${HELD_Y - 2} Q${HAND_X - 12} ${HELD_Y + 13} ${HAND_X} ${HELD_Y + 13} Q${HAND_X + 12} ${HELD_Y + 13} ${HAND_X + 13} ${HELD_Y - 2}`}
                fill="none"
                stroke={dead && cause === 'dropped' ? 'var(--neon-red)' : 'var(--accent)'}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </svg>

            {/* banner */}
            {banner && (
              <div
                key={banner.seq}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center"
              >
                <span
                  className="rounded-lg border px-4 py-1 text-lg font-extrabold tracking-widest"
                  style={{
                    color: banner.color,
                    borderColor: banner.color,
                    background: 'rgba(10,10,20,.78)',
                    boxShadow: `0 0 16px ${banner.color}`,
                    animation: reduced ? undefined : 'ss-banner 1.1s ease-out both',
                  }}
                >
                  {banner.text}
                </span>
              </div>
            )}

            {/* ready card (translucent so the board stays readable) */}
            {ready && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                <div className="mx-4 rounded-xl border border-neon-cyan/50 bg-bg-2/80 px-4 py-2 text-center shadow-[0_0_18px_rgba(34,211,238,.25)]">
                  <p className="text-base font-bold text-neon-cyan">Toss to start</p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    The bottom row is the future, one beat per column. Pick a free one.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* toss buttons, aligned under slot columns 1..5 */}
          <div className="relative mt-1 h-12">
            {HEIGHTS.map((h) => (
              <button
                key={h}
                type="button"
                data-testid={`toss-${h}`}
                data-siteswap-control=""
                aria-label={`Toss ${h} — lands on beat ${state.beat + h}`}
                disabled={dead}
                onPointerDown={(e) => {
                  e.preventDefault()
                  sendToss(h)
                }}
                // Keyboard activation (Tab-focused button + Enter/Space) arrives as a click with
                // detail 0; pointer clicks already tossed on pointer-down, so ignore those.
                onClick={(e) => {
                  if (e.detail === 0) sendToss(h)
                }}
                className="btn-press absolute top-0 flex h-12 items-center justify-center rounded-lg border border-border bg-bg-2 text-lg font-bold text-fg hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:opacity-50"
                style={{
                  left: `${(x(h) / VB_W) * 100}%`,
                  width: `${(32 / VB_W) * 100}%`,
                  minWidth: 30,
                  transform: 'translateX(-50%)',
                  touchAction: 'manipulation',
                }}
              >
                {h}
              </button>
            ))}
          </div>

          <p data-testid="pattern" className="mt-3 text-center font-mono text-sm text-fg-muted">
            Your siteswap:{' '}
            <span className="text-neon-cyan">{state.pattern.length ? state.pattern.join(' ') : '—'}</span>
          </p>
        </div>

        {/* pause card — opaque so a pause can't be used to plan */}
        {paused && !dead && (
          <div
            data-testid="pause-card"
            className="absolute inset-0 z-[5] flex items-center justify-center rounded-xl bg-surface"
            onPointerDown={(e) => {
              e.preventDefault()
              setPausedBoth(false)
            }}
          >
            <div className="rounded-xl border border-border bg-bg-2 px-5 py-3 text-center">
              <p className="text-base font-bold">Paused</p>
              <p className="text-xs text-fg-muted">Tap, press P, or press 1–5 to resume</p>
            </div>
          </div>
        )}

        <GameOverlay
          show={dead}
          variant={outcome?.kind === 'win' ? 'win' : 'lose'}
          title={overlayTitle}
          testId="game-over"
        >
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
              Score <span className="font-bold text-accent">{state.score}</span> · Beats{' '}
              <span className="font-bold text-accent">{state.beat}</span>
            </p>
            <p>
              Peak balls <span className="font-bold text-accent">{state.peakBalls}</span> · Tosses{' '}
              <span className="font-bold text-accent">{state.tosses}</span>
            </p>
            {state.pattern.length > 0 && (
              <p className="font-mono text-fg-muted">Pattern {state.pattern.join(' ')}</p>
            )}
            {newBest && <p className="font-bold text-neon-amber">New best!</p>}
          </div>
          <GameButton onClick={startNew}>{challenge ? 'Rematch' : 'Try again'}</GameButton>
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
              <GameButton variant="ghost" onClick={() => void shareChallenge(state.seed, state.score)}>
                {shareStatus === 'copied'
                  ? 'Link copied!'
                  : outcome?.kind === 'win'
                    ? `Send it back to ${challenge!.name}`
                    : 'Challenge a friend'}
              </GameButton>
            </div>
          )}
        </GameOverlay>

        <span className="sr-only" aria-live="polite">
          {announce}
        </span>

        <style>{`
          .ss-held { animation: ss-held-pulse 0.6s ease-in-out infinite; }
          @keyframes ss-held-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: .75; transform: scale(1.12); }
          }
          @keyframes ss-banner {
            0% { transform: translateY(10px) scale(.9); opacity: 0 }
            18% { transform: none; opacity: 1 }
            75% { opacity: 1 }
            100% { transform: translateY(-8px); opacity: 0 }
          }
          @keyframes ss-shake {
            0%, 100% { transform: none }
            20% { transform: translateX(-7px) }
            40% { transform: translateX(6px) }
            60% { transform: translateX(-4px) }
            80% { transform: translateX(2px) }
          }
          @media (prefers-reduced-motion: reduce) {
            .ss-held { animation: none; }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
