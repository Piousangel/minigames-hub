'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BALL_R,
  BOARD_W,
  CORE_R,
  FLIP_COOLDOWN,
  FP,
  R_MAX,
  VIEW_H,
  comboMult,
  createGame,
  distanceM,
  predictFlipPath,
  reduce,
  type Gate,
  type Magnet,
  type PolAction,
  type PolarityState,
  type Sign,
  type Spike,
} from '@/lib/games/polarity/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordFinish } from '@/lib/gameStats'
import { sendHit } from '@/lib/hit'
import { MAX_NAME_LEN, loadPlayerName, savePlayerName } from '@/lib/leaderboard'
import {
  type Challenge,
  challengeUrl,
  clearChallengeParams,
  compareChallenge,
  parseChallenge,
} from '@/lib/challenge'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const TICK_MS = 1000 / 60
/** rAF frame delta cap (ms) — a background-tab catch-up must not fire a burst of ticks. */
const MAX_FRAME_MS = 100
const MAX_TICKS_PER_FRAME = 6
const TRAIL_LEN = 8
const BUMP_SOUND_GAP = 8
const PREVIEW_TICKS = 20
const FIELD_R = 32

type Pt = { x: number; y: number }

/** Fixed-size ring buffer of recent ball positions (px), written once per tick without allocating. */
interface TrailRing {
  xs: Float64Array
  ys: Float64Array
  head: number // next write slot
  count: number
}

const newTrailRing = (): TrailRing => ({
  xs: new Float64Array(TRAIL_LEN),
  ys: new Float64Array(TRAIL_LEN),
  head: 0,
  count: 0,
})

function pushTrail(r: TrailRing, x: number, y: number): void {
  r.xs[r.head] = x
  r.ys[r.head] = y
  r.head = (r.head + 1) % TRAIL_LEN
  if (r.count < TRAIL_LEN) r.count++
}

/** Oldest → newest snapshot (taken once per committed frame, not per tick). */
function trailSnapshot(r: TrailRing): Pt[] {
  const out: Pt[] = []
  const start = (r.head - r.count + TRAIL_LEN) % TRAIL_LEN
  for (let i = 0; i < r.count; i++) {
    const k = (start + i) % TRAIL_LEN
    out.push({ x: r.xs[k], y: r.ys[k] })
  }
  return out
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

const chargeVar = (c: Sign) => (c === 1 ? '--neon-cyan' : '--neon-magenta')

/** Six-point star centred at (cx, cy) for spikes. */
function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI / 6) * i - Math.PI / 2
    const rr = i % 2 === 0 ? r + 2 : r * 0.45
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`)
  }
  return pts.join(' ')
}

/** Reduced-motion field marker: four small chevrons pointing in (pull) or out (push). */
function fieldArrows(cx: number, cy: number, pull: boolean): string[] {
  const out: string[] = []
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i + Math.PI / 4
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const tipR = pull ? FIELD_R - 9 : FIELD_R + 7
    const baseR = pull ? FIELD_R - 2 : FIELD_R
    const tx = cx + ux * tipR
    const ty = cy + uy * tipR
    const bx = cx + ux * baseR
    const by = cy + uy * baseR
    const px = -uy * 3.5
    const py = ux * 3.5
    out.push(`${tx.toFixed(1)},${ty.toFixed(1)} ${(bx + px).toFixed(1)},${(by + py).toFixed(1)} ${(bx - px).toFixed(1)},${(by - py).toFixed(1)}`)
  }
  return out
}

export function GamePolarity({ storageKey }: { storageKey: string }) {
  // SSR safety: the run (and its random seed) is created on the client only.
  const [state, setState] = useState<PolarityState | null>(null)
  const [paused, setPaused] = useState(false)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [trail, setTrail] = useState<Pt[]>([])
  // 1:1 도전(?vs=...) — 있으면 모든 판(재시작 포함)을 도전자와 같은 시드로 시작한다.
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const challengeRef = useRef<Challenge | null>(null)
  const [name, setName] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<PolarityState | null>(null)
  const pausedRef = useRef(false)
  const bestRef = useRef(0)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const accRef = useRef(0)
  const bannerSeq = useRef(0)
  const lastBumpTickRef = useRef(-1000)
  const trailRingRef = useRef<TrailRing>(newTrailRing())

  const commit = useCallback((next: PolarityState) => {
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

  // Auto-dismiss the banner (animation is cosmetic; the timer owns its lifetime).
  useEffect(() => {
    if (!banner) return
    const id = window.setTimeout(() => setBanner((b) => (b && b.seq === banner.seq ? null : b)), 1100)
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
    lastBumpTickRef.current = -1000
    pausedRef.current = false
    setPaused(false)
    setNewBest(false)
    setBanner(null)
    setAnnounce('')
    trailRingRef.current = newTrailRing()
    setTrail([])
    setShareStatus('idle')
    commit(createGame(challengeRef.current?.seed ?? freshSeed()))
  }, [commit])

  const leaveChallenge = useCallback(() => {
    challengeRef.current = null
    setChallenge(null)
    clearChallengeParams()
    startNew()
  }, [startNew])

  // 결과 화면의 "친구에게 도전장": 방금 판의 시드+점수를 링크로. 받은 사람은 같은 판을 한다.
  const shareChallenge = useCallback(
    async (seed: number, score: number, gates: number) => {
      const slug = storageKey.replace(/^best:/, '')
      const trimmed = name.trim()
      if (trimmed) savePlayerName(trimmed)
      const url = challengeUrl(window.location.origin, slug, { seed, score, name: trimmed })
      const text = `I threaded ${gates} gates for ${score} in Polarity. Same magnets — can you beat me? 🧲`
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Polarity challenge', text, url })
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

  /** Side effects of one engine tick (sounds, banners, trail). No React state commit here. */
  const onTicked = useCallback(
    (prev: PolarityState, next: PolarityState) => {
      const info = next.lastTick
      if (!info) return
      pushTrail(trailRingRef.current, next.ball.x / FP, next.ball.y / FP)
      if (info.flipped) play('flip')
      if (info.passed.length) {
        const multUp = info.mult > comboMult(prev.combo)
        play(multUp ? 'merge' : 'match')
        if (multUp) showBanner(`×${info.mult}`, 'var(--neon-lime)')
        setAnnounce(`Gate! ×${info.mult}`)
      } else if (info.missed.length) {
        play('mismatch')
        if (prev.combo >= 3) showBanner('COMBO LOST', 'var(--neon-red)')
      }
      if (info.bumped && next.tick - lastBumpTickRef.current > BUMP_SOUND_GAP && next.lastEvent !== 'dead') {
        lastBumpTickRef.current = next.tick
        play('move')
      }
    },
    [play, showBanner],
  )

  /** Game-over bookkeeping, run once on the transition into 'dead'. */
  const onDied = useCallback(
    (next: PolarityState) => {
      play('lose')
      setShakeKey((k) => k + 1)
      const score = next.score
      const slug = storageKey.replace(/^best:/, '')
      // 도전 판은 같은 시드를 무한 Rematch할 수 있어(맵 암기) 최고기록에 넣지 않는다.
      if (!challengeRef.current && score > bestRef.current) {
        bestRef.current = score
        setBest(score)
        saveBest(storageKey, score)
        setNewBest(true)
        play('win')
      }
      recordFinish(slug)
      if (challengeRef.current) sendHit(slug, 'challenge-done')
      setAnnounce(
        next.deathCause === 'spike'
          ? `Spiked after ${next.gatesPassed} gates`
          : `Left behind after ${next.gatesPassed} gates`,
      )
    },
    [play, storageKey],
  )

  /** Input actions (start / flip) commit immediately; ticks go through the rAF loop below. */
  const dispatch = useCallback(
    (action: PolAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      if (next === prev) return
      commit(next)
    },
    [commit],
  )

  /** One flip from any input source. Starts from ready; resumes (without flipping) when paused. */
  const sendFlip = useCallback(() => {
    const s = stateRef.current
    if (!s || s.status === 'dead') return
    if (pausedRef.current) {
      setPausedBoth(false)
      return
    }
    dispatch({ type: 'flip' })
  }, [dispatch, setPausedBoth])

  // rAF tick driver: fixed 60 Hz steps from an accumulator, stepped locally and
  // committed to React once per animation frame (no input can land between two
  // ticks of the same frame, so this is tick-for-tick identical to per-tick commits).
  useEffect(() => {
    function frame(ts: number) {
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      let dt = ts - last
      if (dt > MAX_FRAME_MS) dt = MAX_FRAME_MS
      const s = stateRef.current
      if (s && s.status === 'running' && !pausedRef.current) {
        accRef.current += dt
        let n = 0
        let cur = s
        while (accRef.current >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
          accRef.current -= TICK_MS
          n++
          const next = reduce(cur, { type: 'tick' })
          onTicked(cur, next)
          if (next.status === 'dead' && cur.status !== 'dead') onDied(next)
          cur = next
          if (cur.status !== 'running') {
            accRef.current = 0
            break
          }
        }
        if (n >= MAX_TICKS_PER_FRAME) accRef.current = Math.min(accRef.current, TICK_MS)
        if (cur !== s) {
          commit(cur)
          setTrail(trailSnapshot(trailRingRef.current))
        }
      } else if (!s || s.status !== 'running') {
        accRef.current = 0
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [commit, onDied, onTicked])

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
      const el = e.target instanceof HTMLElement ? e.target : null
      const onFlipControl = !!el?.closest('[data-polarity-control]')
      // The header New Run / mute buttons keep focus after a mouse click. On the ready card the
      // prompt says "press Space to start", so Space there starts the run (and drops focus so the
      // keyup can't click New Run again) instead of silently restarting the same ready card.
      const headerSpace =
        key === ' ' &&
        s.status === 'ready' &&
        !pausedRef.current &&
        isControlTarget(e.target) &&
        !onFlipControl &&
        !el?.closest('[data-testid="challenge-banner"], [data-testid="game-over"]')
      // Outside a live run Enter/Space on a focused button/link must activate it, not flip.
      if (
        !headerSpace &&
        (key === 'Enter' || key === ' ') &&
        (s.status !== 'running' || pausedRef.current) &&
        isControlTarget(e.target) &&
        !onFlipControl
      ) {
        return
      }
      switch (key) {
        case ' ':
          // After game over these keys do nothing here, so leave them to the browser (scrolling).
          if (s.status === 'dead') return
          // A focused button must not also receive Space's native click on keyup.
          if (el && !onFlipControl && isControlTarget(el)) el.blur()
          e.preventDefault()
          sendFlip()
          return
        case 'ArrowUp':
        case 'ArrowDown':
        case 'f':
        case 'j':
        case 'k':
          if (s.status === 'dead') return
          e.preventDefault()
          sendFlip()
          return
        case 'p':
        case 'Escape':
          if (s.status === 'running') {
            e.preventDefault()
            setPausedBoth(!pausedRef.current)
          }
          return
        case 'r':
          // Only outside a live run (ready / dead) — R sits next to the flip key F, so a stray R
          // must not wipe a run (a paused run is still live).
          if (s.status !== 'running') {
            e.preventDefault()
            startNew()
          }
          return
        case 'Enter':
          // Enter on the focused FLIP button flips (its native click is suppressed there).
          if (e.target instanceof HTMLElement && e.target.closest('[data-polarity-control]')) {
            e.preventDefault()
            sendFlip()
            return
          }
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
  }, [sendFlip, setPausedBoth, startNew])

  const onBoardPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = stateRef.current
      if (!s || s.status === 'dead') return
      // Taps on overlay controls (none while alive, but be safe) keep their own behaviour.
      if (e.target instanceof HTMLElement && e.target.closest('button, a[href], input')) return
      sendFlip()
    },
    [sendFlip],
  )

  const magnets = state?.magnets
  const spikes = state?.spikes
  const gates = state?.gates
  const polarity = state?.polarity ?? 1

  // Static entity layer: rebuilt only when the engine hands out new arrays
  // (generation, prune, gate judgement) or the polarity flips.
  const entityLayer = useMemo(() => {
    if (!magnets || !spikes || !gates) return null
    return (
      <>
        {gates.map((g: Gate) => {
          const x = g.x / FP
          const y = g.y / FP
          const hw = g.halfW / FP
          const color =
            g.state === 'pending' ? 'var(--neon-lime)' : g.state === 'passed' ? 'var(--neon-green)' : 'var(--neon-red)'
          const op = g.state === 'pending' ? 1 : g.state === 'passed' ? 0.45 : 0.35
          return (
            <g
              key={g.id}
              data-testid="polarity-gate"
              data-state={g.state}
              style={{ opacity: op, transition: reduced ? undefined : 'opacity .5s ease-out' }}
            >
              <line
                x1={x - hw}
                x2={x + hw}
                y1={y}
                y2={y}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="5 4"
              />
              <circle cx={x - hw} cy={y} r={4} fill="var(--neon-amber)" />
              <circle cx={x + hw} cy={y} r={4} fill="var(--neon-amber)" />
            </g>
          )
        })}
        {spikes.map((sp: Spike) => (
          <polygon
            key={sp.id}
            data-testid="polarity-spike"
            points={starPoints(sp.x / FP, sp.y / FP, 7)}
            fill="var(--neon-red)"
            style={{ filter: `drop-shadow(0 0 4px ${tint('--neon-red', 70)})` }}
          />
        ))}
        {magnets.map((m: Magnet) => {
          const x = m.x / FP
          const y = m.y / FP
          const c = `var(${chargeVar(m.charge)})`
          return (
            <g key={m.id} data-testid="polarity-magnet">
              {m.strength === 2 && <circle cx={x} cy={y} r={CORE_R + 3.5} fill="none" stroke={c} strokeWidth={1.5} />}
              <circle
                cx={x}
                cy={y}
                r={CORE_R}
                fill={tint(chargeVar(m.charge), 25)}
                stroke={c}
                strokeWidth={2}
                style={{ filter: `drop-shadow(0 0 5px ${tint(chargeVar(m.charge), 70)})` }}
              />
              <text
                x={x}
                y={y + 4.5}
                textAnchor="middle"
                fontSize={13}
                fontWeight={800}
                fill={c}
                style={{ pointerEvents: 'none' }}
              >
                {m.charge === 1 ? '+' : '−'}
              </text>
            </g>
          )
        })}
      </>
    )
  }, [magnets, spikes, gates, reduced])

  // Flip preview: recomputed per committed state (≤ once per frame), not per render.
  // Hidden while paused so the pause card can't be used to plan flips.
  const previewPoints = useMemo(() => {
    if (!state || state.status === 'dead' || paused) return null
    const path = predictFlipPath(state, PREVIEW_TICKS)
    if (path.length < 2) return null
    return [`${state.ball.x / FP},${state.ball.y / FP}`, ...path.map((p) => `${p.x / FP},${p.y / FP}`)].join(' ')
  }, [state, paused])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="polarity-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const dead = state.status === 'dead'
  const ready = state.status === 'ready'
  const camPx = state.camY / FP
  const ballX = state.ball.x / FP
  const ballY = state.ball.y / FP
  const pull = polarity === 1
  const polVar = pull ? '--neon-cyan' : '--neon-magenta'
  const ballGlow = dead ? '--neon-red' : polVar
  const headroom = ballY - camPx
  const danger = dead ? 0 : Math.max(0, Math.min(1, (60 - headroom) / 50))
  const cooldownFrac = state.flipCooldown / FLIP_COOLDOWN

  const hint = ready
    ? 'Tap / Space flips every magnet: PULL ↔ PUSH. Thread the gates, dodge the red spikes, don’t fall behind.'
    : paused
      ? 'Paused — tap to resume'
      : 'Chain gates for up to ×8 points — a missed gate resets the combo. Magenta (−) magnets do the opposite of cyan (+).'

  const outcome = challenge && dead ? compareChallenge(state.score, challenge.score) : null
  const overlayTitle = !outcome
    ? state.deathCause === 'spike'
      ? 'Spiked!'
      : 'Left Behind'
    : outcome.kind === 'win'
      ? `You beat ${challenge!.name}!`
      : outcome.kind === 'tie'
        ? `Dead even with ${challenge!.name}`
        : `${challenge!.name} holds the line`
  const overlayVariant: 'win' | 'lose' = outcome
    ? outcome.kind === 'win'
      ? 'win'
      : 'lose'
    : newBest
      ? 'win'
      : 'lose'

  const headerExtra = (
    <span
      data-testid="polarity-state"
      data-polarity={pull ? 'pull' : 'push'}
      className="relative overflow-hidden rounded-lg border bg-surface/80 px-3 py-1.5 text-sm font-extrabold tracking-wider"
      style={{ borderColor: `var(${polVar})`, color: `var(${polVar})` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg"
        style={{
          boxShadow: `0 0 12px ${tint(polVar, 60)}`,
          animation: reduced ? undefined : 'pl-glow 1.4s ease-in-out infinite',
        }}
      />
      {pull ? 'PULL' : 'PUSH'}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left"
        style={{ background: `var(${polVar})`, transform: `scaleX(${cooldownFrac})`, opacity: cooldownFrac > 0 ? 0.9 : 0 }}
      />
    </span>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Best', value: best, testId: 'best' },
        { label: 'Combo', value: '×' + comboMult(state.combo) },
      ]}
      headerExtra={headerExtra}
      onNewGame={startNew}
      newGameLabel={dead ? 'Play again' : 'New Run'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-100"
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
          {(ready || dead) && (
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
        data-testid="polarity-board"
        role="group"
        aria-label="Polarity board"
        onPointerDown={onBoardPointerDown}
        className="relative select-none rounded-xl bg-surface p-2"
        style={{ touchAction: 'none' }}
      >
        <div
          key={shakeKey}
          className="relative overflow-hidden rounded-lg"
          style={{
            background: 'rgba(0,0,0,.18)',
            animation: !reduced && shakeKey > 0 ? 'pl-shake .38s ease-out both' : undefined,
          }}
        >
          <svg viewBox={`0 0 ${BOARD_W} ${VIEW_H}`} className="block w-full" aria-hidden="true">
            <g style={{ transform: `translate3d(0, ${-camPx}px, 0)` }}>
              {/* guide lines */}
              {Array.from({ length: Math.ceil(VIEW_H / 40) + 2 }, (_, i) => {
                const y = Math.floor(camPx / 40) * 40 + i * 40
                return <line key={y} x1={0} x2={BOARD_W} y1={y} y2={y} stroke="rgba(160,160,220,.07)" strokeWidth={1} />
              })}

              {/* field rings (depend on the ball's distance → per tick) */}
              {state.magnets.map((m) => {
                const x = m.x / FP
                const y = m.y / FP
                const eff = m.charge * polarity
                const attract = eff === 1
                const near = (x - ballX) ** 2 + (y - ballY) ** 2 <= R_MAX * R_MAX
                const c = `var(${chargeVar(m.charge)})`
                return (
                  <g key={m.id} style={{ opacity: near ? 0.85 : 0.3 }}>
                    {reduced ? (
                      <>
                        <circle cx={x} cy={y} r={FIELD_R} fill="none" stroke={c} strokeWidth={1} strokeDasharray="3 4" />
                        {fieldArrows(x, y, attract).map((pts, i) => (
                          <polygon key={i} points={pts} fill={c} />
                        ))}
                      </>
                    ) : (
                      <circle
                        key={attract ? 'a' : 'r'}
                        cx={x}
                        cy={y}
                        r={FIELD_R}
                        fill="none"
                        stroke={c}
                        strokeWidth={1.5}
                        style={{
                          transformBox: 'fill-box',
                          transformOrigin: 'center',
                          animation: `${attract ? 'pl-pull' : 'pl-push'} 1.1s linear infinite`,
                        }}
                      />
                    )}
                  </g>
                )
              })}

              {entityLayer}

              {/* flip preview */}
              {previewPoints && (
                <polyline
                  data-testid="polarity-preview"
                  points={previewPoints}
                  fill="none"
                  stroke={`var(${pull ? '--neon-magenta' : '--neon-cyan'})`}
                  strokeWidth={2}
                  strokeDasharray="3 4"
                  strokeLinecap="round"
                  opacity={0.35}
                />
              )}

              {/* trail */}
              {!reduced &&
                !dead &&
                trail.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={BALL_R * (0.4 + (0.5 * (i + 1)) / trail.length)}
                    fill={`var(${polVar})`}
                    opacity={(0.28 * (i + 1)) / trail.length}
                  />
                ))}

              {/* ball */}
              <circle
                data-testid="polarity-ball"
                cx={ballX}
                cy={ballY}
                r={BALL_R}
                fill={dead ? 'var(--neon-red)' : '#e5e7eb'}
                stroke="#f8fafc"
                strokeWidth={1}
                style={{ filter: `drop-shadow(0 0 6px ${tint(ballGlow, 85)})` }}
              />
              <circle cx={ballX - 3} cy={ballY - 3} r={2.5} fill="#ffffff" opacity={0.8} />
            </g>
          </svg>

          {/* danger edge */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-16"
            style={{
              background: `linear-gradient(to bottom, ${tint('--neon-red', 55)}, transparent)`,
              opacity: danger,
            }}
          />

          {/* distance */}
          <span className="pointer-events-none absolute right-2 bottom-1 text-[11px] font-semibold text-fg-muted tabular-nums">
            {distanceM(state)} m
          </span>

          {/* death flash */}
          {dead && !reduced && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: tint('--neon-red', 35), animation: 'pl-flash .5s ease-out both' }}
            />
          )}

          {/* banner */}
          {banner && (
            <div key={banner.seq} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
              <span
                className="rounded-lg border px-4 py-1 text-lg font-extrabold tracking-widest"
                style={{
                  color: banner.color,
                  borderColor: banner.color,
                  background: 'rgba(10,10,20,.75)',
                  boxShadow: `0 0 16px ${banner.color}`,
                  animation: reduced ? undefined : 'pl-banner 1.1s ease-out both',
                }}
              >
                {banner.text}
              </span>
            </div>
          )}

          {/* ready card */}
          {ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/40">
              <div className="mx-4 rounded-xl border border-neon-cyan/50 bg-bg-2/90 px-5 py-4 text-center shadow-[0_0_18px_rgba(34,211,238,.25)]">
                <p className="text-base font-bold text-neon-cyan">Tap or press Space to start</p>
                <p className="mt-1 text-xs text-fg-muted">
                  Each tap flips <span className="font-bold text-fg">every</span> magnet between PULL and PUSH. The dotted
                  line shows where a flip would send you.
                </p>
              </div>
            </div>
          )}

          {/* paused card */}
          {paused && !dead && (
            // Opaque on purpose: pausing must not become a free look to plan flips.
            <div data-testid="pause-card" className="absolute inset-0 flex items-center justify-center bg-bg">
              <div className="rounded-xl border border-border bg-bg-2 px-5 py-3 text-center">
                <p className="text-base font-bold">Paused</p>
                <p className="text-xs text-fg-muted">Tap or press Space to resume</p>
              </div>
            </div>
          )}
        </div>

        <GameOverlay show={dead} variant={overlayVariant} title={overlayTitle} testId="game-over">
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
              Score <span className="font-bold text-accent">{state.score}</span> · Best{' '}
              <span className="font-bold text-accent">{best}</span> · Gates{' '}
              <span className="font-bold">{state.gatesPassed}</span> · Max combo{' '}
              <span className="font-bold">×{comboMult(state.bestCombo)}</span>
            </p>
            {!challenge && newBest && <p className="font-bold text-neon-amber">New best!</p>}
            <p className="text-fg-muted">{distanceM(state)} m down the rail</p>
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
                onClick={() => void shareChallenge(state.seed, state.score, state.gatesPassed)}
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

        <span className="sr-only" aria-live="polite">
          {announce}
        </span>

        <style>{`
          @keyframes pl-pull {
            0% { transform: scale(1.45); opacity: 0 }
            30% { opacity: .9 }
            100% { transform: scale(.45); opacity: 0 }
          }
          @keyframes pl-push {
            0% { transform: scale(.45); opacity: 0 }
            30% { opacity: .9 }
            100% { transform: scale(1.45); opacity: 0 }
          }
          @keyframes pl-glow { 0%, 100% { opacity: .35 } 50% { opacity: 1 } }
          @keyframes pl-flash { from { opacity: 1 } to { opacity: 0 } }
          @keyframes pl-shake {
            0%, 100% { transform: none }
            20% { transform: translateX(-7px) }
            40% { transform: translateX(6px) }
            60% { transform: translateX(-4px) }
            80% { transform: translateX(2px) }
          }
          @keyframes pl-banner {
            0% { transform: translateY(10px) scale(.9); opacity: 0 }
            18% { transform: none; opacity: 1 }
            75% { opacity: 1 }
            100% { transform: translateY(-8px); opacity: 0 }
          }
        `}</style>
      </div>

      {/* big flip button (accessibility / thumb target) */}
      <div className="mt-3 flex justify-center">
        <GameButton
          data-polarity-control=""
          variant="ghost"
          aria-label="Flip polarity"
          className="min-h-12 w-full max-w-60 text-lg font-extrabold tracking-widest"
          style={{ touchAction: 'none', borderColor: `var(${pull ? '--neon-magenta' : '--neon-cyan'})` }}
          disabled={dead}
          onPointerDown={(e) => {
            e.preventDefault()
            sendFlip()
          }}
          onKeyDown={(e) => {
            // keyboard activation is handled by the window listener (Space / Enter would double-fire)
            if (e.key === 'Enter' || e.key === ' ') e.preventDefault()
          }}
        >
          FLIP → {pull ? 'PUSH' : 'PULL'}
        </GameButton>
      </div>
    </GameShell>
  )
}
