'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LANES,
  beatMs,
  bpmForBeat,
  createGame,
  delayForBeat,
  isCleared,
  isInputLocked,
  predictPath,
  reduce,
  stageForBeat,
  type Cell,
  type Cmd,
  type LagAction,
  type LagEvent,
  type LagState,
} from '@/lib/games/lagline/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { sendHit } from '@/lib/hit'
import { MAX_NAME_LEN, loadPlayerName, savePlayerName } from '@/lib/leaderboard'
import { challengeUrl, compareChallenge, parseChallenge, type Challenge } from '@/lib/challenge'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

/** rAF frame delta cap (ms) — a background-tab catch-up must not fire a burst of beats. */
const MAX_FRAME_MS = 100
/** Row height (px) of the field. */
const ROW_H = 32
/** Visible rows: the player row + 8 rows ahead. */
const VISIBLE_ROWS = 9
/** Min pointer travel (px) that counts as a swipe. */
const SWIPE_PX = 24

const GLYPH: Record<Cmd, string> = { left: '←', right: '→', jump: '⤒', stay: '·' }
const CMD_NAME: Record<Cmd, string> = { left: 'left', right: 'right', jump: 'jump', stay: 'stay' }

const SOUND: Record<LagEvent, SoundName | null> = {
  none: null,
  start: null,
  queued: 'flip',
  locked: 'error',
  step: null, // metronome handled separately (every 4th beat)
  move: 'move',
  bump: 'error',
  jump: 'eat',
  'delay-up': 'flag',
  'delay-down': 'flag',
  stage: 'match',
  dead: 'lose',
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

interface Banner {
  seq: number
  text: string
  color: string
}

export function GameLagline({ storageKey }: { storageKey: string }) {
  // SSR safety: the run (and its random seed) is created on the client only.
  const [state, setState] = useState<LagState | null>(null)
  const [paused, setPaused] = useState(false)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [banner, setBanner] = useState<Banner | null>(null)
  // 1:1 도전(?vs=...) — 있으면 모든 판(재시작 포함)을 도전자와 같은 시드로 시작한다.
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const challengeRef = useRef<Challenge | null>(null)
  const [name, setName] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<LagState | null>(null)
  const pausedRef = useRef(false)
  const bestRef = useRef(0)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const accRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const bannerSeq = useRef(0)

  const commit = useCallback((next: LagState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // accRef (the elapsed part of the current beat) is deliberately kept across
  // pause/resume: resetting it would hand out a fresh full beat on every P,P.
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
    pausedRef.current = false
    setPaused(false)
    setNewBest(false)
    setBanner(null)
    setAnnounce('')
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
    async (seed: number, score: number) => {
      const slug = storageKey.replace(/^best:/, '')
      const trimmed = name.trim()
      if (trimmed) savePlayerName(trimmed)
      const url = challengeUrl(window.location.origin, slug, { seed, score, name: trimmed })
      const text = `I survived ${score} beats in Lagline. Same lanes, same lag — can you beat me? ⏱️`
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Lagline challenge', text, url })
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
    (action: LagAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const ev = next.lastEvent
      if (ev === 'step') {
        if (next.beat % 4 === 0) play('flag')
      } else {
        const sound = SOUND[ev]
        if (sound) play(sound)
      }

      if (action.type === 'tick' && next.lastTick && ev !== 'dead') {
        const n = next.lastTick.beat
        const parts: string[] = []
        const stageUp = stageForBeat(n) > stageForBeat(n - 1)
        if (stageUp) {
          parts.push(`Stage ${stageForBeat(n) + 1} · ${bpmForBeat(n)} BPM`)
          if (ev !== 'stage') play('match')
        }
        if (ev === 'delay-up') {
          parts.push('Lag 4!')
          showBanner('LAG 4', 'var(--neon-purple)')
        } else if (ev === 'delay-down') {
          parts.push('Lag 3')
          showBanner('LAG 3', 'var(--neon-cyan)')
        } else if (stageUp) {
          showBanner(`STAGE ${stageForBeat(n) + 1}`, 'var(--neon-amber)')
        }
        if (parts.length) setAnnounce(parts.join(' — '))
      }

      if (ev === 'dead' && prev.status !== 'dead') {
        setShakeKey((k) => k + 1)
        const score = next.beat
        const slug = storageKey.replace(/^best:/, '')
        // 도전 판은 같은 시드를 무한 Rematch할 수 있어(맵 암기) 최고기록에 넣지 않는다 —
        // 넣으면 아무 시드로 링크를 만들어 리더보드를 파밍할 수 있다.
        if (!challengeRef.current && score > bestRef.current) {
          bestRef.current = score
          setBest(score)
          saveBest(storageKey, score)
          setNewBest(true)
          play('win')
        }
        recordResult(slug, { won: isCleared(next) })
        if (challengeRef.current) sendHit(slug, 'challenge-done')
        const lane = (next.lastTick?.to ?? next.lane) + 1
        setAnnounce(`Out of sync after ${score} beats. ${next.deathCause === 'hurdle' ? 'Hurdle' : 'Wall'} at lane ${lane}.`)
      }
    },
    [commit, play, showBanner, storageKey],
  )

  /** A command from any input source. Resumes (without queuing) when paused. */
  const sendCmd = useCallback(
    (cmd: Cmd) => {
      const s = stateRef.current
      if (!s || s.status === 'dead') return
      if (pausedRef.current) {
        setPausedBoth(false)
        return
      }
      dispatch({ type: 'input', cmd })
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
      let phase = 0
      if (s && s.status === 'running' && !pausedRef.current) {
        accRef.current += dt
        let cur = s
        while (accRef.current >= beatMs(cur.beat + 1)) {
          accRef.current -= beatMs(cur.beat + 1)
          dispatch({ type: 'tick' })
          const nxt = stateRef.current
          if (!nxt || nxt.status !== 'running') {
            accRef.current = 0
            break
          }
          cur = nxt
        }
        const after = stateRef.current
        if (after && after.status === 'running') phase = Math.min(1, accRef.current / beatMs(after.beat + 1))
      } else if (s && s.status === 'running') {
        // paused: freeze the beat phase where it was (no accumulation, no reset)
        phase = Math.min(1, accRef.current / beatMs(s.beat + 1))
      } else {
        accRef.current = 0
      }
      const el = scrollRef.current
      if (el) el.style.transform = `translate3d(0, ${reducedRef.current ? 0 : phase * ROW_H}px, 0)`
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [dispatch, reducedRef])

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
      // Browser/OS shortcuts (Cmd/Ctrl+R reload, Cmd+D bookmark, Ctrl+S save…) are never moves.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (e.repeat) return
      const s = stateRef.current
      if (!s) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      // Outside a live run (ready card, pause, game-over overlay) Enter/Space on a focused
      // button/link must activate it (e.g. "Challenge a friend"), not restart or jump.
      // The touch-control buttons are excluded: their keyboard input is the game's.
      if (
        (key === 'Enter' || key === ' ') &&
        (s.status !== 'running' || pausedRef.current) &&
        isControlTarget(e.target) &&
        !(e.target instanceof HTMLElement && e.target.closest('[data-lagline-control]'))
      ) {
        return
      }
      let cmd: Cmd | null = null
      switch (key) {
        case 'ArrowLeft':
        case 'a':
          cmd = 'left'
          break
        case 'ArrowRight':
        case 'd':
          cmd = 'right'
          break
        case 'ArrowUp':
        case 'w':
        case ' ':
          cmd = 'jump'
          break
        case 'ArrowDown':
        case 's':
          cmd = 'stay'
          break
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
          if (s.status === 'dead') {
            e.preventDefault()
            startNew()
          }
          return
        default:
          return
      }
      e.preventDefault()
      sendCmd(cmd)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sendCmd, setPausedBoth, startNew])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY }
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
        if (Math.abs(dx) >= Math.abs(dy)) sendCmd(dx < 0 ? 'left' : 'right')
        else sendCmd(dy < 0 ? 'jump' : 'stay')
        return
      }
      // tap
      if (pausedRef.current) setPausedBoth(false)
      else if (s.status === 'ready') dispatch({ type: 'start' })
    },
    [dispatch, sendCmd, setPausedBoth],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="lagline-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const dead = state.status === 'dead'
  const ready = state.status === 'ready'
  const locked = isInputLocked(state)
  const lag = state.queue.length
  const cleared = isCleared(state)
  const path = state.status === 'running' && !paused ? predictPath(state) : []
  const deathTick = dead ? state.lastTick : null

  const hint = ready
    ? 'Your moves land 3 beats late. ←/→ change lane, ↑ jumps amber hurdles, red walls must be dodged.'
    : locked
      ? 'SYNC — lag shrinking, input locked this beat'
      : paused
        ? 'Paused — tap to resume'
        : `Watch the row ${lag} ahead, not your feet. ↑ clears amber hurdles; dodge red walls.`

  const outcome = challenge && dead ? compareChallenge(state.beat, challenge.score) : null
  const overlayTitle = !outcome
    ? cleared
      ? 'In Sync!'
      : 'Out of Sync'
    : outcome.kind === 'win'
      ? `You beat ${challenge!.name}!`
      : outcome.kind === 'tie'
        ? `Dead even with ${challenge!.name}`
        : `${challenge!.name} stays in sync`

  const headerExtra = (
    <span
      data-testid="lagline-delay"
      className="rounded-lg border bg-surface/80 px-3 py-1.5 text-sm font-semibold tabular-nums"
      style={{
        borderColor: lag === 4 ? 'var(--neon-purple)' : 'var(--color-border, rgba(140,140,200,.3))',
        color: lag === 4 ? 'var(--neon-purple)' : undefined,
        boxShadow: lag === 4 ? `0 0 10px ${tint('--neon-purple', 45)}` : undefined,
      }}
    >
      Lag {lag}
    </span>
  )

  // Field rows top → bottom: ahead[VIEW-1] … ahead[0], current.
  const rows = [...state.ahead.map((row, k) => ({ row, k })).reverse(), { row: state.current, k: -1 }]
  const fieldH = VISIBLE_ROWS * ROW_H
  const stackH = rows.length * ROW_H

  const cellStyle = (cell: Cell, isDeathCell: boolean): React.CSSProperties | undefined => {
    if (cell === 'wall') {
      return {
        background: isDeathCell ? 'var(--neon-red)' : tint('--neon-red', 70),
        boxShadow: `0 0 8px ${tint('--neon-red', 55)}`,
        borderRadius: 4,
      }
    }
    return undefined
  }

  return (
    <GameShell
      stats={[
        { label: 'Beats', value: state.beat, testId: 'score' },
        { label: 'Best', value: best, testId: 'best' },
        { label: 'BPM', value: bpmForBeat(state.beat + 1) },
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
        key={shakeKey}
        data-testid="lagline-board"
        role="group"
        aria-label="Lagline board"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerRef.current = null
        }}
        className="relative rounded-xl bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
        style={{
          touchAction: 'none',
          animation: !reduced && shakeKey > 0 ? 'lg-hit .38s ease-out both' : undefined,
        }}
      >
        {/* Queue strip */}
        <div data-testid="lagline-queue" className="mb-3 flex items-stretch gap-1.5" aria-label="Command queue">
          <div className="flex flex-1 overflow-hidden">
            <div
              key={state.beat}
              className="flex flex-1 gap-1.5"
              style={!reduced && state.status === 'running' ? { animation: 'lg-slot-in .16s ease-out both' } : undefined}
            >
              {state.queue.map((c, i) => {
                const next = i === 0
                return (
                  <div
                    key={i}
                    data-testid="queue-slot"
                    aria-label={`In ${i + 1} beat${i ? 's' : ''}: ${CMD_NAME[c]}`}
                    className="flex min-w-0 flex-1 flex-col items-center rounded-lg border py-1"
                    style={{
                      borderColor: next ? 'var(--neon-cyan)' : tint('--neon-purple', 35),
                      background: next ? tint('--neon-cyan', 12) : tint('--neon-purple', 6),
                      boxShadow: next ? `0 0 10px ${tint('--neon-cyan', 50)}` : undefined,
                    }}
                  >
                    <span className="text-[10px] font-semibold text-fg-muted tabular-nums">+{i + 1}</span>
                    <span
                      className="text-lg leading-none font-bold"
                      style={{ color: next ? 'var(--neon-cyan)' : 'var(--neon-purple)' }}
                    >
                      {GLYPH[c]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <div aria-hidden="true" className="w-px self-stretch bg-border" />
          <div
            data-testid="queue-pending"
            aria-label={locked ? 'Input locked this beat' : `Queued now: ${state.pending ? CMD_NAME[state.pending] : 'nothing'}`}
            className="flex w-14 flex-col items-center justify-center rounded-lg border border-dashed py-1"
            style={{
              borderColor: locked ? 'var(--neon-red)' : state.pending ? 'var(--neon-amber)' : 'var(--color-border, rgba(140,140,200,.35))',
            }}
          >
            {locked ? (
              <span className="text-xs font-extrabold tracking-wider" style={{ color: 'var(--neon-red)' }}>
                SYNC
              </span>
            ) : (
              <>
                <span className="text-[10px] font-semibold text-fg-muted">now</span>
                <span className="text-lg leading-none font-bold" style={{ color: 'var(--neon-amber)' }}>
                  {state.pending ? GLYPH[state.pending] : ' '}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Field */}
        <div
          className="relative overflow-hidden rounded-lg"
          style={{ height: fieldH, background: 'rgba(0,0,0,.18)' }}
        >
          {/* lane separators */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-5">
            {Array.from({ length: LANES }, (_, i) => (
              <div key={i} className={i ? 'border-l border-border/40' : ''} />
            ))}
          </div>

          {/* scrolling rows (bottom-aligned; translateY by the beat phase) */}
          <div
            ref={scrollRef}
            aria-hidden="true"
            className="absolute inset-x-0"
            style={{ height: stackH, bottom: 0, willChange: 'transform' }}
          >
            {rows.map(({ row, k }, idx) => {
              const absBeat = state.beat + 1 + k
              const longLag = k >= 0 && delayForBeat(absBeat) === 4
              const ghosts = k >= 0 ? path.filter((_, pi) => pi === k) : []
              return (
                <div
                  key={absBeat}
                  className="absolute inset-x-0 grid grid-cols-5"
                  style={{
                    top: idx * ROW_H,
                    height: ROW_H,
                    background: longLag ? tint('--neon-purple', 10) : k === -1 ? tint('--neon-cyan', 6) : undefined,
                  }}
                >
                  {longLag && (
                    <span
                      className="pointer-events-none absolute left-0.5 top-0.5 text-[9px] font-bold leading-none"
                      style={{ color: 'var(--neon-purple)' }}
                    >
                      4
                    </span>
                  )}
                  {row.map((cell, lane) => {
                    const isDeathCell = dead && k === -1 && deathTick?.to === lane
                    return (
                      <div key={lane} className="relative flex items-center justify-center p-1">
                        {cell === 'wall' && <div className="h-full w-full" style={cellStyle(cell, isDeathCell)} />}
                        {cell === 'hurdle' && (
                          <div
                            className="w-full rounded-sm"
                            style={{
                              height: '40%',
                              background: isDeathCell ? 'var(--neon-red)' : 'var(--neon-amber)',
                              boxShadow: `0 0 8px ${tint('--neon-amber', 60)}`,
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                  {ghosts.map((g) => (
                    <div
                      key={`g${k}`}
                      data-testid="lagline-ghost"
                      className="pointer-events-none absolute top-0 flex items-center justify-center"
                      style={{ left: `${g.lane * 20}%`, width: '20%', height: ROW_H }}
                    >
                      <div
                        className="flex items-center justify-center rounded-full border-2 text-xs font-bold"
                        style={{
                          width: ROW_H - 10,
                          height: ROW_H - 10,
                          borderColor: g.fatal ? 'var(--neon-red)' : 'var(--neon-purple)',
                          color: 'var(--neon-red)',
                          opacity: g.fatal ? 0.95 : 0.6,
                          background: g.fatal ? tint('--neon-red', 18) : undefined,
                        }}
                      >
                        {g.fatal ? '✕' : g.cmd === 'jump' ? <span style={{ color: 'var(--neon-purple)' }}>⤒</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* player (fixed on the bottom row) */}
          <div
            data-testid="lagline-player"
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 flex items-center justify-center"
            style={{
              width: '20%',
              height: ROW_H,
              transform: `translateX(${state.lane * 100}%)`,
              transition: reduced ? undefined : 'transform 120ms ease-out',
            }}
          >
            <div
              key={state.lastTick?.jumped ? `j${state.beat}` : 'p'}
              style={{
                animation: !reduced && state.lastTick?.jumped && !dead ? 'lg-jump .24s ease-out both' : undefined,
              }}
            >
              <div
                key={state.beat}
                className="rounded-full"
                style={{
                  width: ROW_H - 8,
                  height: ROW_H - 8,
                  background: dead ? 'var(--neon-red)' : 'var(--neon-cyan)',
                  boxShadow: `0 0 14px ${dead ? tint('--neon-red', 70) : tint('--neon-cyan', 70)}`,
                  animation: !reduced && state.status === 'running' && !paused ? 'lg-beat .3s ease-out both' : undefined,
                }}
              />
            </div>
          </div>

          {/* death flash */}
          {dead && !reduced && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: tint('--neon-red', 35), animation: 'lg-flash .5s ease-out both' }}
            />
          )}

          {/* lag / stage banner */}
          {banner && (
            <div
              key={banner.seq}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center"
            >
              <span
                className="rounded-lg border px-4 py-1 text-lg font-extrabold tracking-widest"
                style={{
                  color: banner.color,
                  borderColor: banner.color,
                  background: 'rgba(10,10,20,.75)',
                  boxShadow: `0 0 16px ${banner.color}`,
                  animation: reduced ? undefined : 'lg-banner 1.1s ease-out both',
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
                <p className="text-base font-bold text-neon-cyan">Press an arrow / swipe to start</p>
                <p className="mt-1 text-xs text-fg-muted">
                  Every move runs <span className="font-bold text-fg">3 beats later</span>. Ghost rings show where your queue
                  is taking you.
                </p>
              </div>
            </div>
          )}

          {/* paused card */}
          {paused && !dead && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/55">
              <div className="rounded-xl border border-border bg-bg-2/90 px-5 py-3 text-center">
                <p className="text-base font-bold">Paused</p>
                <p className="text-xs text-fg-muted">Tap or press any arrow to resume</p>
              </div>
            </div>
          )}
        </div>

        <GameOverlay
          show={dead}
          variant={outcome ? (outcome.kind === 'win' ? 'win' : 'lose') : cleared ? 'win' : 'lose'}
          title={overlayTitle}
          testId="game-over"
        >
          {outcome && (
            <p data-testid="challenge-result" className="text-base font-bold">
              {outcome.kind === 'win' && <>🏆 +{outcome.diff} over {challenge!.name}&apos;s {challenge!.score}</>}
              {outcome.kind === 'tie' && <>Both survived {challenge!.score} beats — break the tie</>}
              {outcome.kind === 'lose' && (
                <>
                  {outcome.diff} short of {challenge!.score} ({outcome.pct}%) — one more?
                </>
              )}
            </p>
          )}
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Beats <span className="font-bold text-accent">{state.beat}</span> · Best{' '}
              <span className="font-bold text-accent">{best}</span>
            </p>
            {newBest && <p className="font-bold text-neon-amber">New best!</p>}
            {deathTick && (
              <p className="text-fg-muted">
                {state.deathCause === 'hurdle' ? 'Hurdle' : 'Wall'} at lane {deathTick.to + 1} — queued {lag} beats ago
              </p>
            )}
          </div>
          <GameButton onClick={startNew}>{challenge ? 'Rematch' : 'Play again'}</GameButton>
          {state.beat > 0 && (
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
              <GameButton variant="ghost" onClick={() => void shareChallenge(state.seed, state.beat)}>
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
          @keyframes lg-slot-in { from { transform: translateX(18%) } to { transform: none } }
          @keyframes lg-hit {
            0%, 100% { transform: none }
            20% { transform: translateX(-7px) }
            40% { transform: translateX(6px) }
            60% { transform: translateX(-4px) }
            80% { transform: translateX(2px) }
          }
          @keyframes lg-flash { from { opacity: 1 } to { opacity: 0 } }
          @keyframes lg-beat { 0% { transform: scale(1.18); opacity: 1 } 100% { transform: scale(1); opacity: .88 } }
          @keyframes lg-jump { 0% { transform: scale(1) } 45% { transform: scale(1.25) } 100% { transform: scale(1) } }
          @keyframes lg-banner {
            0% { transform: translateY(10px) scale(.9); opacity: 0 }
            18% { transform: none; opacity: 1 }
            75% { opacity: 1 }
            100% { transform: translateY(-8px); opacity: 0 }
          }
        `}</style>
      </div>

      {/* touch controls */}
      <div className="mt-3 flex justify-center gap-2">
        {(
          [
            ['left', '◀', 'Queue left'],
            ['jump', '▲', 'Queue jump'],
            ['stay', '▼', 'Queue stay'],
            ['right', '▶', 'Queue right'],
          ] as const
        ).map(([cmd, glyph, label]) => (
          <GameButton
            key={cmd}
            data-lagline-control=""
            variant="ghost"
            aria-label={label}
            className="min-h-11 min-w-11 text-lg"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              e.preventDefault()
              sendCmd(cmd)
            }}
            onKeyDown={(e) => {
              // keyboard activation of the buttons themselves is handled by the window listener
              if (e.key === 'Enter') e.preventDefault()
            }}
          >
            {glyph}
          </GameButton>
        ))}
      </div>
    </GameShell>
  )
}
