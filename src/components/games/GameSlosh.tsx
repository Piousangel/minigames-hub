'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  CELL,
  SPILL,
  TICK_MS,
  U_PER_M,
  WATER_MAX,
  ZONE,
  createGame,
  gradeAt,
  isGlassCalm,
  liveDistance,
  reduce,
  scoreBreakdown,
  type SloshAction,
  type SloshEvent,
  type SloshState,
  type StationKind,
  type Throttle,
  type Track,
} from '@/lib/games/slosh/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { sendHit } from '@/lib/hit'
import { MAX_NAME_LEN, loadPlayerName, savePlayerName } from '@/lib/leaderboard'
import { challengeUrl, compareChallenge, parseChallenge, type Challenge } from '@/lib/challenge'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

/** rAF frame delta cap (ms) — at most 5 ticks per frame, no background-tab burst. */
const MAX_FRAME_MS = 100
/** Screen scale: 1px = 200u, so the 400px-wide scene shows 20m of rail. */
const PX_PER_U = 1 / 200
const CART_SX = 120
const BASE_Y = 130
const HILL_PX = 12
const GLASS_H = 44
const GLASS_TOP = -60
const GLASS_BOTTOM = -16
const MAX_DROPS = 6
const SPILL_SOUND_GAP_MS = 300

const GAS_KEYS = new Set(['ArrowRight', 'ArrowUp', 'd', 'w'])
const BRAKE_KEYS = new Set(['ArrowLeft', 'ArrowDown', 'a', 's', ' '])

const KIND_LABEL: Record<StationKind, string> = { stop: 'STOP', refill: 'REFILL', terminal: 'END' }
const KIND_GLYPH: Record<StationKind, string> = { stop: '■', refill: '◆', terminal: '⚑' }

const EVENT_SOUND: Partial<Record<SloshEvent, SoundName>> = {
  start: 'flip',
  missed: 'mismatch',
  win: 'win',
  dry: 'lose',
  overrun: 'lose',
  timeout: 'lose',
}

const tint = (v: string, pct: number) => `color-mix(in srgb, var(${v}) ${pct}%, transparent)`

type PipStatus = 'pending' | 'next' | 'docked' | 'calm' | 'missed'
const PIP_COLOR: Record<PipStatus, string> = {
  pending: 'var(--color-border, rgba(140,140,200,.35))',
  next: 'var(--neon-amber)',
  docked: 'var(--neon-cyan)',
  calm: 'var(--neon-lime)',
  missed: 'var(--neon-red)',
}

interface Banner {
  seq: number
  text: string
  tone: 'cyan' | 'lime' | 'red'
}

interface Droplet {
  id: number
  side: 'front' | 'back'
}

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

/** Focus is on a control that handles Enter/Space itself (overlay buttons, links, inputs). */
function isControlTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && t.closest('button, a[href], input, textarea, select, [role="button"]') !== null
}

function normKey(e: KeyboardEvent): string {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key
}

/** Elevation (px, up = positive) at every cell boundary. */
function elevationProfile(track: Track): number[] {
  const elev = [0]
  for (let c = 0; c < track.grades.length; c++) elev.push(elev[c] + track.grades[c] * HILL_PX)
  return elev
}

function elevAt(elev: number[], x: number): number {
  const cells = elev.length - 1
  const c = Math.max(0, Math.min(cells - 1, Math.floor(x / CELL)))
  const frac = Math.max(0, Math.min(1, x / CELL - c))
  return elev[c] + (elev[c + 1] - elev[c]) * frac
}

function hintText(): string {
  return 'Hold GAS (→/D or the button) to roll, BRAKE (←/A/Space) to slow, let go to coast. Speeding up throws the water back, braking throws it forward: water over the rim is lost and an empty glass ends the run. Push against the swing to calm it, stop inside each glowing zone before the time bar empties, and park at END without hitting the bumper. Calm stops score +400. P pauses.'
}

export function GameSlosh({ storageKey }: { storageKey: string }) {
  const slug = storageKey.replace(/^best:/, '')
  // SSR safety: the run (and its random seed) is created on the client only.
  const [state, setState] = useState<SloshState | null>(null)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState({ gas: false, brake: false })
  const [banner, setBanner] = useState<Banner | null>(null)
  const [droplets, setDroplets] = useState<Droplet[]>([])
  const [calmBurst, setCalmBurst] = useState(0)
  // 1:1 도전(?vs=...) — 있으면 모든 판(재시작 포함)을 도전자와 같은 시드로 시작한다.
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const challengeRef = useRef<Challenge | null>(null)
  const [name, setName] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()
  const clipId = `sl-glass-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  const stateRef = useRef<SloshState | null>(null)
  const bestRef = useRef(0)
  const pausedRef = useRef(false)
  const keysRef = useRef<Set<string>>(new Set())
  const ptrRef = useRef({ gas: false, brake: false })
  const heldRef = useRef({ gas: false, brake: false })
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const accRef = useRef(0)
  const persistedRef = useRef(false)
  const lastSpillSoundRef = useRef(-Infinity)
  const bannerSeq = useRef(0)
  const dropSeq = useRef(0)

  const commit = useCallback((next: SloshState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const setPausedBoth = useCallback((p: boolean) => {
    pausedRef.current = p
    setPaused(p)
  }, [])

  const showBanner = useCallback((text: string, tone: Banner['tone']) => {
    const seq = ++bannerSeq.current
    setBanner({ seq, text, tone })
  }, [])

  // The timer owns the banner's lifetime (the pop animation is cosmetic).
  useEffect(() => {
    if (!banner) return
    const id = window.setTimeout(() => setBanner((b) => (b && b.seq === banner.seq ? null : b)), 1100)
    return () => window.clearTimeout(id)
  }, [banner])

  const persist = useCallback(
    (final: SloshState) => {
      if (persistedRef.current) return
      persistedRef.current = true
      // 도전 판은 같은 시드를 무한 Rematch할 수 있어(레일 암기) 최고기록에 넣지 않는다 —
      // 넣으면 아무 시드로 링크를 만들어 리더보드를 파밍할 수 있다.
      if (!challengeRef.current && final.score > bestRef.current) {
        bestRef.current = final.score
        setBest(final.score)
        saveBest(storageKey, final.score)
        setNewBest(true)
      }
      recordResult(slug, { won: final.won })
      if (challengeRef.current) sendHit(slug, 'challenge-done')
    },
    [slug, storageKey],
  )

  const clearHeld = useCallback(() => {
    keysRef.current.clear()
    ptrRef.current = { gas: false, brake: false }
    heldRef.current = { gas: false, brake: false }
    setHeld({ gas: false, brake: false })
  }, [])

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
    clearHeld()
    setPausedBoth(false)
    setNewBest(false)
    setBanner(null)
    setDroplets([])
    setShareStatus('idle')
    persistedRef.current = false
    commit(createGame(challengeRef.current?.seed ?? freshSeed()))
  }, [clearHeld, commit, setPausedBoth])

  const leaveChallenge = useCallback(() => {
    challengeRef.current = null
    setChallenge(null)
    clearChallengeParams()
    startNew()
  }, [startNew])

  // 결과 화면의 "친구에게 도전장": 방금 판의 시드+점수를 링크로. 받은 사람은 같은 판을 한다.
  const shareChallenge = useCallback(
    async (seed: number, score: number, pct: number) => {
      const trimmed = name.trim()
      if (trimmed) savePlayerName(trimmed)
      const url = challengeUrl(window.location.origin, slug, { seed, score, name: trimmed })
      const text = `I delivered ${pct}% of the water in Slosh — ${score} pts. Same rails, same hills. Can you beat me? 🥛`
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Slosh challenge', text, url })
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
    [name, slug],
  )

  /** Plays sounds / banners for one engine step's outcome. */
  const handleEvent = useCallback(
    (next: SloshState, ts: number) => {
      const ev = next.lastEvent
      if (ev === 'spill') {
        if (ts - lastSpillSoundRef.current >= SPILL_SOUND_GAP_MS) {
          lastSpillSoundRef.current = ts
          play('error')
        }
        if (!reducedRef.current) {
          const id = ++dropSeq.current
          const side: Droplet['side'] = next.theta > 0 ? 'front' : 'back'
          setDroplets((d) => (d.length >= MAX_DROPS ? d : [...d, { id, side }]))
        }
        return
      }
      if (ev === 'dock' || ev === 'calm' || ev === 'win') {
        const r = next.results[next.results.length - 1]
        if (!r) return
        const refillTxt = r.refilled > 0 ? ` · +${r.refilled / 100}% water` : ''
        if (r.refilled > 0) play('eat')
        if (r.calm) {
          if (ev !== 'win') play('merge')
          showBanner(`GLASS-CALM +${r.accuracyPts + r.calmPts}${refillTxt}`, 'lime')
          setCalmBurst((k) => k + 1)
        } else {
          if (ev !== 'win') play('match')
          showBanner(`DOCKED +${r.accuracyPts}${refillTxt}`, 'cyan')
        }
      }
      if (ev === 'missed') showBanner('MISSED STOP', 'red')
      const snd = EVENT_SOUND[ev]
      if (snd) play(snd)
    },
    [play, reducedRef, showBanner],
  )

  const dispatchInput = useCallback(
    (throttle: Throttle) => {
      const prev = stateRef.current
      if (!prev || prev.status === 'over') return
      const action: SloshAction = { type: 'input', throttle }
      const next = reduce(prev, action)
      commit(next)
      if (next.lastEvent === 'start') play('flip')
    },
    [commit, play],
  )

  /** Recompute throttle from every held source (brake wins) and send it if it changed. */
  const syncThrottle = useCallback(() => {
    let gas = ptrRef.current.gas
    let brake = ptrRef.current.brake
    for (const k of keysRef.current) {
      if (GAS_KEYS.has(k)) gas = true
      if (BRAKE_KEYS.has(k)) brake = true
    }
    if (heldRef.current.gas !== gas || heldRef.current.brake !== brake) {
      heldRef.current = { gas, brake }
      setHeld({ gas, brake })
    }
    const th: Throttle = brake ? -1 : gas ? 1 : 0
    const s = stateRef.current
    if (s && s.status !== 'over' && s.throttle !== th) dispatchInput(th)
  }, [dispatchInput])

  // rAF tick driver: fixed 20ms ticks from an accumulator, one commit per frame.
  useEffect(() => {
    function frame(ts: number) {
      const last = lastTsRef.current || ts
      lastTsRef.current = ts
      const dt = Math.min(ts - last, MAX_FRAME_MS)
      const s = stateRef.current
      if (s && s.status === 'running' && !pausedRef.current) {
        accRef.current += dt
        let cur = s
        const steps: SloshState[] = []
        while (accRef.current >= TICK_MS) {
          accRef.current -= TICK_MS
          cur = reduce(cur, { type: 'tick' })
          steps.push(cur)
          if (cur.status === 'over') {
            accRef.current = 0
            break
          }
        }
        if (steps.length) {
          commit(cur)
          for (const st of steps) handleEvent(st, ts)
          if (cur.status === 'over') persist(cur)
        }
      } else if (!s || s.status !== 'running') {
        accRef.current = 0
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [commit, handleEvent, persist])

  // Safety: losing focus releases everything; hiding the tab pauses.
  useEffect(() => {
    const onBlur = () => {
      clearHeld()
      syncThrottle()
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden' && stateRef.current?.status === 'running') setPausedBoth(true)
    }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [clearHeld, setPausedBoth, syncThrottle])

  // Keyboard.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const key = normKey(e)
      // Outside a live run, Enter/Space on a focused button (Share, Rematch) belongs to the button.
      // A paused run is still live: Space is BRAKE and must resume, not click a focused New Game/Mute.
      if (
        (key === 'Enter' || key === ' ') &&
        s.status !== 'running' &&
        isControlTarget(e.target) &&
        !(e.target instanceof HTMLElement && e.target.closest('[data-slosh-control]'))
      ) {
        return
      }
      if (GAS_KEYS.has(key) || BRAKE_KEYS.has(key)) {
        e.preventDefault()
        if (e.repeat || s.status === 'over') return
        if (pausedRef.current) {
          setPausedBoth(false) // resume only — this press is consumed
          return
        }
        keysRef.current.add(key)
        syncThrottle()
        return
      }
      if (e.repeat) return
      switch (key) {
        case 'p':
        case 'Escape':
          if (s.status === 'running') {
            e.preventDefault()
            setPausedBoth(!pausedRef.current)
          }
          return
        case 'r':
          e.preventDefault()
          startNew()
          return
        case 'Enter':
          if (s.status === 'over') {
            e.preventDefault()
            startNew()
          }
          return
        default:
          return
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const key = normKey(e)
      if (!GAS_KEYS.has(key) && !BRAKE_KEYS.has(key)) return
      if (!isTypingTarget(e.target)) e.preventDefault()
      if (keysRef.current.delete(key)) syncThrottle()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [setPausedBoth, startNew, syncThrottle])

  const pressPointer = useCallback(
    (src: 'gas' | 'brake', e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const s = stateRef.current
      if (!s || s.status === 'over') return
      if (pausedRef.current) {
        setPausedBoth(false)
        return
      }
      ptrRef.current = { ...ptrRef.current, [src]: true }
      syncThrottle()
    },
    [setPausedBoth, syncThrottle],
  )

  const releasePointer = useCallback(
    (src: 'gas' | 'brake') => {
      if (!ptrRef.current[src]) return
      ptrRef.current = { ...ptrRef.current, [src]: false }
      syncThrottle()
    },
    [syncThrottle],
  )

  const onBoardPointerDown = useCallback(() => {
    if (pausedRef.current) setPausedBoth(false)
  }, [setPausedBoth])

  const track = state?.track ?? null
  const elev = useMemo(() => (track ? elevationProfile(track) : [0, 0]), [track])

  if (!state || !track) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div data-testid="slosh-board" className="rounded-xl bg-surface p-6" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const over = state.status === 'over'
  const ready = state.status === 'ready'
  const S = track.stations.length
  const resultByIndex = new Map(state.results.map((r) => [r.index, r]))
  const pipStatus = (i: number): PipStatus => {
    const r = resultByIndex.get(i)
    if (r) return r.docked ? (r.calm ? 'calm' : 'docked') : 'missed'
    return i === state.nextStation && !over ? 'next' : 'pending'
  }
  const nextSt = track.stations[state.nextStation]
  const nextText = nextSt
    ? `Next: ${KIND_LABEL[nextSt.kind]} · ${(liveDistance(state) / U_PER_M).toFixed(1)} m`
    : 'Delivered'
  const timeLeft = Math.max(0, track.timeLimit - state.ticks) / track.timeLimit
  const calm = isGlassCalm(state.theta, state.omega)
  const danger = Math.abs(state.theta) > 0.75 * SPILL
  // 0.5%만 남아도 살아 있는 판 — 0%로 표시하면 '왜 안 끝나지?'가 된다.
  const waterPct = state.water > 0 ? Math.max(1, Math.floor(state.water / 100)) : 0

  // Scene geometry.
  const camElev = elevAt(elev, state.x)
  const grade = gradeAt(track, state.x)
  const slopeDeg = (-Math.atan2(grade * HILL_PX, CELL * PX_PER_U) * 180) / Math.PI
  const tiltDeg = (-state.theta / SPILL) * 32
  const fillShift = (1 - state.water / WATER_MAX) * GLASS_H
  const wheelDeg = reduced ? 0 : ((state.x * PX_PER_U) / 6) * (180 / Math.PI)
  const railPts = elev.map((h, c) => `${c * CELL * PX_PER_U},${-h}`)
  const railLine = [`-400,0`, ...railPts].join(' ')
  const lastX = (elev.length - 1) * CELL * PX_PER_U
  const groundPoly = `${railLine} ${lastX},400 -400,400`

  const breakdown = scoreBreakdown(state)
  const calmCount = state.results.filter((r) => r.calm).length
  const outcome = challenge && over ? compareChallenge(state.score, challenge.score) : null
  const lossTitle =
    state.loseReason === 'dry' ? 'Glass ran dry' : state.loseReason === 'overrun' ? 'Overran the terminal' : 'Out of time'
  const overlayTitle = !outcome
    ? state.won
      ? 'Delivered!'
      : lossTitle
    : outcome.kind === 'win'
      ? `You beat ${challenge!.name}!`
      : outcome.kind === 'tie'
        ? `Dead even with ${challenge!.name}`
        : `${challenge!.name} kept it steadier`
  const overlayVariant: 'win' | 'lose' = outcome ? (outcome.kind === 'win' ? 'win' : 'lose') : state.won ? 'win' : 'lose'

  const bannerColor =
    banner?.tone === 'lime' ? 'var(--neon-lime)' : banner?.tone === 'red' ? 'var(--neon-red)' : 'var(--neon-cyan)'

  const headerExtra = (
    <span
      data-testid="stop-count"
      className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm font-semibold tabular-nums"
    >
      Stop {Math.min(state.nextStation + 1, S)}/{S}
    </span>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Water', value: `${waterPct}%`, testId: 'water' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={startNew}
      newGameLabel={over ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hintText()}
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
        data-testid="slosh-board"
        className="relative rounded-xl bg-surface p-3 select-none"
        onPointerDown={onBoardPointerDown}
      >
        {/* Station pips */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" aria-label="Stations">
            {track.stations.map((st, i) => {
              const ps = pipStatus(i)
              const color = PIP_COLOR[ps]
              return (
                <span
                  key={i}
                  data-testid="station-pip"
                  data-status={ps}
                  aria-label={`${KIND_LABEL[st.kind]} ${i + 1}: ${ps}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold"
                  style={{
                    borderColor: color,
                    color: ps === 'pending' ? undefined : color,
                    background: ps === 'pending' ? undefined : tint(ps === 'next' ? '--neon-amber' : ps === 'calm' ? '--neon-lime' : ps === 'missed' ? '--neon-red' : '--neon-cyan', 12),
                    animation: ps === 'next' && !reduced ? 'sl-pulse 1.1s ease-in-out infinite' : undefined,
                  }}
                >
                  {KIND_GLYPH[st.kind]}
                </span>
              )
            })}
          </div>
          <span data-testid="next-stop" className="text-xs font-semibold text-fg-muted tabular-nums">
            {nextText}
          </span>
        </div>

        {/* Time bar */}
        <div
          data-testid="time-bar"
          className="mb-2 h-1.5 overflow-hidden rounded-full bg-bg-2/60"
          role="progressbar"
          aria-label="Time left"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(timeLeft * 100)}
        >
          <div
            className="h-full w-full origin-left rounded-full"
            style={{
              transform: `scaleX(${timeLeft})`,
              background: timeLeft < 0.2 ? 'var(--neon-red)' : 'var(--neon-cyan)',
            }}
          />
        </div>

        {/* Scene */}
        <div className="relative overflow-hidden rounded-lg" style={{ background: 'rgba(0,0,0,.18)' }}>
          <svg viewBox="0 0 400 180" style={{ width: '100%', display: 'block' }} aria-hidden="true">
            <g transform={`translate(${CART_SX - state.x * PX_PER_U}, ${BASE_Y + camElev})`}>
              <polygon points={groundPoly} style={{ fill: tint('--neon-purple', 8) }} />
              <polyline points={railLine} style={{ fill: 'none', stroke: 'var(--neon-purple)', strokeWidth: 2 }} />
              {track.stations.map((st, i) => {
                const ps = pipStatus(i)
                const sx = st.target * PX_PER_U
                const sy = -elevAt(elev, st.target)
                const bandColor = ps === 'pending' ? 'var(--fg-muted, #888)' : PIP_COLOR[ps]
                return (
                  <g key={i}>
                    <rect
                      x={(st.target - ZONE) * PX_PER_U}
                      y={sy - 70}
                      width={2 * ZONE * PX_PER_U}
                      height={74}
                      style={{ fill: bandColor, opacity: 0.18 }}
                    />
                    <line x1={sx} y1={sy - 70} x2={sx} y2={sy + 4} style={{ stroke: bandColor, strokeWidth: 2 }} />
                    <text
                      x={sx}
                      y={sy - 74}
                      textAnchor="middle"
                      style={{ fill: bandColor, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}
                    >
                      {KIND_LABEL[st.kind]}
                    </text>
                    {st.kind === 'terminal' && (
                      <rect
                        x={(st.target + ZONE) * PX_PER_U}
                        y={-elevAt(elev, st.target + ZONE) - 18}
                        width={6}
                        height={18}
                        rx={1}
                        style={{ fill: 'var(--neon-red)' }}
                      />
                    )}
                  </g>
                )
              })}
            </g>

            {/* Cart (screen-fixed) */}
            <g transform={`translate(${CART_SX}, ${BASE_Y}) rotate(${slopeDeg})`}>
              <defs>
                <clipPath id={clipId}>
                  <path d={`M -11 ${GLASS_BOTTOM} L 11 ${GLASS_BOTTOM} L 15 ${GLASS_TOP} L -15 ${GLASS_TOP} Z`} />
                </clipPath>
              </defs>
              {[-20, 20].map((wx) => (
                <g key={wx} transform={`translate(${wx}, -6)`}>
                  <circle r={6} style={{ fill: 'var(--bg-2, #222)', stroke: 'var(--neon-cyan)', strokeWidth: 1.5 }} />
                  <g transform={`rotate(${wheelDeg})`}>
                    <line x1={-5} y1={0} x2={5} y2={0} style={{ stroke: 'var(--neon-cyan)', strokeWidth: 1 }} />
                    <line x1={0} y1={-5} x2={0} y2={5} style={{ stroke: 'var(--neon-cyan)', strokeWidth: 1 }} />
                  </g>
                </g>
              ))}
              <rect x={-32} y={-16} width={64} height={6} rx={2} style={{ fill: 'var(--neon-amber)' }} />
              <g clipPath={`url(#${clipId})`}>
                <rect
                  x={-60}
                  y={GLASS_TOP}
                  width={120}
                  height={110}
                  transform={`rotate(${tiltDeg}, 0, ${(GLASS_TOP + GLASS_BOTTOM) / 2}) translate(0, ${fillShift})`}
                  style={{ fill: tint('--neon-blue', 70) }}
                />
              </g>
              <path
                d={`M -11 ${GLASS_BOTTOM} L 11 ${GLASS_BOTTOM} L 15 ${GLASS_TOP} L -15 ${GLASS_TOP} Z`}
                style={{
                  fill: 'none',
                  stroke: danger ? 'var(--neon-red)' : 'rgba(220,230,255,.85)',
                  strokeWidth: danger ? 2 : 1.5,
                  animation: danger && !reduced ? 'sl-rim .3s ease-in-out infinite alternate' : undefined,
                }}
              />
              {!reduced && calmBurst > 0 && (
                <circle
                  key={calmBurst}
                  cx={0}
                  cy={(GLASS_TOP + GLASS_BOTTOM) / 2}
                  r={30}
                  onAnimationEnd={() => setCalmBurst(0)}
                  style={{
                    fill: 'none',
                    stroke: 'var(--neon-lime)',
                    strokeWidth: 2,
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    animation: 'sl-pop .6s ease-out both',
                  }}
                />
              )}
              {!reduced &&
                droplets.map((d) => (
                  <circle
                    key={d.id}
                    cx={d.side === 'front' ? 15 : -15}
                    cy={GLASS_TOP}
                    r={2.5}
                    onAnimationEnd={() => setDroplets((cur) => cur.filter((x) => x.id !== d.id))}
                    style={
                      {
                        fill: 'var(--neon-blue)',
                        '--dx': d.side === 'front' ? '14px' : '-14px',
                        animation: 'sl-drop .7s ease-in both',
                      } as React.CSSProperties
                    }
                  />
                ))}
            </g>
          </svg>

          {banner && (
            <div
              key={banner.seq}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-2 flex justify-center"
            >
              <span
                className="rounded-lg border px-3 py-0.5 text-sm font-extrabold tracking-widest"
                style={{
                  color: bannerColor,
                  borderColor: bannerColor,
                  background: 'rgba(10,10,20,.75)',
                  boxShadow: `0 0 14px ${bannerColor}`,
                  animation: reduced ? undefined : 'sl-pop 1.1s ease-out both',
                }}
              >
                {banner.text}
              </span>
            </div>
          )}

          {ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/40">
              <p className="mx-4 rounded-xl border border-neon-cyan/50 bg-bg-2/90 px-4 py-3 text-center text-sm font-semibold text-neon-cyan">
                Hold GAS to roll · Stop inside each glowing zone · Glass-calm stops score big
              </p>
            </div>
          )}

          {paused && !over && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/55">
              <p className="rounded-xl border border-border bg-bg-2/90 px-4 py-2 text-center text-sm font-bold">
                Paused — press P or tap to resume
              </p>
            </div>
          )}
        </div>

        {/* Slosh gauge */}
        <div className="mt-2 flex items-center gap-2">
          <div
            data-testid="slosh-gauge"
            className="relative h-6 flex-1 overflow-hidden rounded-md border border-border bg-bg-2/50"
            role="meter"
            aria-label="Slosh"
            aria-valuemin={-100}
            aria-valuemax={100}
            aria-valuenow={Math.round((state.theta / SPILL) * 100)}
          >
            <div className="absolute inset-y-0 left-0 w-[10%]" style={{ background: tint('--neon-red', 30) }} />
            <div className="absolute inset-y-0 right-0 w-[10%]" style={{ background: tint('--neon-red', 30) }} />
            <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `translateX(${(state.theta / SPILL) * 50}%)` }}
            >
              <span
                className="block h-full w-1 rounded-full"
                style={{ background: danger ? 'var(--neon-red)' : 'var(--neon-cyan)' }}
              />
              <span
                className="ml-1 text-xs font-bold leading-none"
                style={{ color: danger ? 'var(--neon-red)' : 'var(--neon-cyan)' }}
              >
                {state.omega > 0 ? '→' : state.omega < 0 ? '←' : '·'}
              </span>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-fg-muted">
            <span
              data-testid="calm-lamp"
              data-on={calm ? 'true' : 'false'}
              aria-label={calm ? 'Glass calm' : 'Glass sloshing'}
              className="inline-block h-3 w-3 rounded-full"
              style={{
                background: calm ? 'var(--neon-lime)' : tint('--neon-lime', 15),
                boxShadow: calm ? `0 0 8px ${tint('--neon-lime', 80)}` : undefined,
              }}
            />
            Calm
          </span>
        </div>

        <GameOverlay show={over} variant={overlayVariant} title={overlayTitle} testId="game-over">
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
          <table data-testid="result-breakdown" className="text-sm tabular-nums">
            <tbody>
              <tr>
                <td className="pr-4 text-left text-fg-muted">Stops</td>
                <td className="text-right font-bold text-accent">+{breakdown.accuracy}</td>
              </tr>
              <tr>
                <td className="pr-4 text-left text-fg-muted">
                  Glass-calm {calmCount}/{S}
                </td>
                <td className="text-right font-bold text-accent">+{breakdown.calm}</td>
              </tr>
              <tr>
                <td className="pr-4 text-left text-fg-muted">Water kept {waterPct}%</td>
                <td className="text-right font-bold text-accent">+{breakdown.water}</td>
              </tr>
              <tr>
                <td className="pr-4 text-left text-fg-muted">Time</td>
                <td className="text-right font-bold text-accent">+{breakdown.time}</td>
              </tr>
              {breakdown.perfect > 0 && (
                <tr>
                  <td className="pr-4 text-left text-fg-muted">Perfect</td>
                  <td className="text-right font-bold text-accent">+{breakdown.perfect}</td>
                </tr>
              )}
              <tr>
                <td className="pr-4 text-left font-bold">Total</td>
                <td className="text-right font-extrabold text-accent">{breakdown.total}</td>
              </tr>
            </tbody>
          </table>
          {newBest && (
            <p data-testid="new-best" className="font-bold text-neon-amber">
              New best!
            </p>
          )}
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
              <GameButton variant="ghost" onClick={() => void shareChallenge(state.seed, state.score, waterPct)}>
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
          @keyframes sl-pulse { 0%, 100% { opacity: 1; transform: scale(1) } 50% { opacity: .55; transform: scale(1.08) } }
          @keyframes sl-rim { from { opacity: 1 } to { opacity: .35 } }
          @keyframes sl-drop {
            0% { transform: translate(0, 0); opacity: 1 }
            100% { transform: translate(var(--dx, 12px), 40px); opacity: 0 }
          }
          @keyframes sl-pop {
            0% { transform: scale(.7); opacity: 0 }
            18% { transform: scale(1.06); opacity: 1 }
            75% { transform: scale(1); opacity: 1 }
            100% { transform: scale(1.1); opacity: 0 }
          }
        `}</style>
      </div>

      {/* Touch controls */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {(
          [
            ['brake', 'slosh-brake', '◀ BRAKE', 'Brake (hold)', '--neon-red'],
            ['gas', 'slosh-gas', 'GAS ▶', 'Gas (hold)', '--neon-lime'],
          ] as const
        ).map(([src, testId, label, aria, color]) => (
          <button
            key={src}
            type="button"
            data-testid={testId}
            data-slosh-control=""
            aria-label={aria}
            aria-pressed={held[src]}
            disabled={over}
            onPointerDown={(e) => pressPointer(src, e)}
            onPointerUp={() => releasePointer(src)}
            onPointerCancel={() => releasePointer(src)}
            onPointerLeave={() => releasePointer(src)}
            onLostPointerCapture={() => releasePointer(src)}
            onContextMenu={(e) => e.preventDefault()}
            className="btn-press h-16 select-none rounded-xl border-2 text-base font-extrabold tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              touchAction: 'none',
              borderColor: `var(${color})`,
              color: `var(${color})`,
              background: held[src] ? tint(color, 28) : tint(color, 8),
              boxShadow: held[src] ? `0 0 16px ${tint(color, 60)}` : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </GameShell>
  )
}
