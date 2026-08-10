'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MODULES,
  PRESTIGE_STEP,
  PRESTIGE_THRESHOLD,
  buy,
  canPrestige,
  fmt,
  initialState,
  nextCost,
  offlineGain,
  prestige as doPrestige,
  prestigeMultiplier,
  productionPerSec,
  score,
  tap as doTap,
  tapGain,
  tick,
  type State,
} from '@/lib/games/reactor/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

/** Wall-clock is read ONLY here; the engine stays pure and time-agnostic. */
const SAVE_VERSION = 1
const OFFLINE_CAP_MS = 8 * 3600 * 1000 // 8h of offline accrual
const WELCOME_MIN_MS = 30_000 // don't nag for a quick tab-away
const TICK_MS = 150 // ~6.6 real-time ticks/sec
const PERSIST_MS = 4000 // throttle writes

interface SaveBlob {
  v: number
  state: State
  lastSeen: number
}

/** Best-effort save-blob parse; anything off → fresh game. */
function parseSave(raw: string | null): SaveBlob | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as Partial<SaveBlob>
    if (!o || typeof o !== 'object' || o.v !== SAVE_VERSION) return null
    const s = o.state
    if (
      !s ||
      typeof s.charge !== 'number' ||
      typeof s.lifetime !== 'number' ||
      typeof s.prestige !== 'number' ||
      typeof s.tapPower !== 'number' ||
      !Array.isArray(s.levels) ||
      s.levels.length !== MODULES.length ||
      s.levels.some((n) => typeof n !== 'number' || !Number.isFinite(n))
    ) {
      return null
    }
    const clean: State = {
      charge: Number.isFinite(s.charge) ? s.charge : 0,
      lifetime: Number.isFinite(s.lifetime) ? s.lifetime : 0,
      levels: s.levels.map((n) => Math.max(0, Math.floor(n))),
      prestige: Math.max(0, Math.floor(s.prestige)),
      tapPower: Math.max(1, Math.floor(s.tapPower)),
    }
    const lastSeen = typeof o.lastSeen === 'number' && Number.isFinite(o.lastSeen) ? o.lastSeen : Date.now()
    return { v: SAVE_VERSION, state: clean, lastSeen }
  } catch {
    return null
  }
}

export function GameReactor({ storageKey }: { storageKey: string }) {
  // SSR-safe: engine state built on the client only (no Date/random in render).
  const [state, setState] = useState<State | null>(null)
  const [best, setBest] = useState(0)
  const [welcome, setWelcome] = useState<{ gain: number; awayMs: number } | null>(null)
  const [confirmReboot, setConfirmReboot] = useState(false)
  const [tapPulse, setTapPulse] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const lastPersistRef = useRef(0)
  const reactorBtnRef = useRef<HTMLButtonElement | null>(null)

  const commit = useCallback((next: State) => {
    stateRef.current = next
    setState(next)
  }, [])

  const bestKey = storageKey
  const saveKey = `save:reactor`

  const persist = useCallback(
    (s: State) => {
      try {
        const blob: SaveBlob = { v: SAVE_VERSION, state: s, lastSeen: Date.now() }
        localStorage.setItem(saveKey, JSON.stringify(blob))
        // best:<slug> holds ONLY the plain leaderboard number (hub convention).
        const sc = score(s)
        const storedBest = Number(localStorage.getItem(bestKey))
        const prevBest = Number.isFinite(storedBest) && storedBest > 0 ? Math.floor(storedBest) : 0
        if (sc > prevBest) {
          localStorage.setItem(bestKey, String(sc))
          setBest(sc)
        }
      } catch {
        /* storage unavailable */
      }
    },
    [bestKey, saveKey],
  )

  // Bootstrap: load save, apply offline accrual, maybe show welcome-back.
  useEffect(() => {
    const storedBest = Number(localStorage.getItem(bestKey))
    setBest(Number.isFinite(storedBest) && storedBest > 0 ? Math.floor(storedBest) : 0)

    const blob = parseSave(localStorage.getItem(saveKey))
    if (!blob) {
      commit(initialState()) // first-ever load: no popup
      lastPersistRef.current = Date.now()
      return
    }

    const now = Date.now()
    const awayMs = now - blob.lastSeen
    const prod = productionPerSec(blob.state)
    if (awayMs > WELCOME_MIN_MS && prod > 0) {
      const gain = offlineGain(blob.state, awayMs, OFFLINE_CAP_MS)
      commit(tick(blob.state, Math.min(awayMs, OFFLINE_CAP_MS)))
      if (gain > 0) setWelcome({ gain, awayMs: Math.min(awayMs, OFFLINE_CAP_MS) })
    } else {
      commit(blob.state)
    }
    lastPersistRef.current = now
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Real-time production loop.
  useEffect(() => {
    let last = Date.now()
    const id = window.setInterval(() => {
      const s = stateRef.current
      if (!s) return
      const now = Date.now()
      const elapsed = now - last
      last = now
      if (elapsed <= 0) return
      const next = tick(s, elapsed)
      if (next !== s) commit(next)
      if (now - lastPersistRef.current >= PERSIST_MS) {
        lastPersistRef.current = now
        persist(next)
      }
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [commit, persist])

  // Persist on tab hide / unload so offline accrual has a fresh lastSeen.
  useEffect(() => {
    const flush = () => {
      if (stateRef.current) persist(stateRef.current)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [persist])

  const onTap = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    commit(doTap(s))
    play('move')
    if (!reducedRef.current) setTapPulse((n) => n + 1)
  }, [commit, play, reducedRef])

  const onBuy = useCallback(
    (index: number) => {
      const s = stateRef.current
      if (!s) return
      const next = buy(s, index)
      if (next === s) {
        play('error')
        return
      }
      commit(next)
      play('merge')
    },
    [commit, play],
  )

  const onReboot = useCallback(() => {
    const s = stateRef.current
    if (!s || !canPrestige(s)) return
    const next = doPrestige(s)
    commit(next)
    persist(next)
    play('win')
    setConfirmReboot(false)
    recordResult(storageKey.replace(/^best:/, ''), { won: true })
  }, [commit, persist, play, storageKey])

  // Keyboard: 1-6 buy modules, Space/Enter taps (when not on a control).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      if (e.key >= '1' && e.key <= '6') {
        const idx = Number(e.key) - 1
        if (idx < MODULES.length) {
          e.preventDefault()
          onBuy(idx)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBuy])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="h-96 rounded-xl bg-surface" data-testid="reactor-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const prod = productionPerSec(state)
  const mult = prestigeMultiplier(state)
  const perTap = tapGain(state)
  const canReboot = canPrestige(state)
  const nextMult = 1 + (state.prestige + 1) * PRESTIGE_STEP
  const progressToReboot = Math.min(1, state.lifetime / PRESTIGE_THRESHOLD)

  const hint = canReboot
    ? 'Tap the reactor and buy modules to auto-generate ⚡. Reboot now for a permanent production boost — it resets modules but keeps your goal.'
    : 'TAP the reactor for ⚡, then spend it on modules that generate ⚡/sec. Come back later — it keeps running while you are away. Keys: 1-6 buy modules.'

  const headerExtra = (
    <>
      <span className="rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-sm text-fg-muted" data-testid="reactor-rate">
        <span className="font-bold text-accent">{fmt(prod)}</span> ⚡/s
      </span>
      {state.prestige > 0 && (
        <span className="rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-sm text-fg-muted" data-testid="reactor-mult">
          ×{mult.toFixed(1)} · ♻{state.prestige}
        </span>
      )}
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Charge', value: Math.floor(state.charge), testId: 'score' },
        { label: 'Best', value: best },
      ]}
      headerExtra={headerExtra}
      onNewGame={onTap}
      newGameLabel="Tap ⚡"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div className="relative rounded-xl bg-surface p-3 sm:p-4" data-testid="reactor-board">
        {/* Big tappable reactor */}
        <div className="flex flex-col items-center gap-2 py-2">
          <button
            ref={reactorBtnRef}
            type="button"
            data-testid="reactor-core"
            onClick={onTap}
            aria-label={`Charge the reactor. Current charge ${fmt(state.charge)}. +${fmt(perTap)} per tap.`}
            className="rc-core group relative flex h-40 w-40 min-h-11 items-center justify-center rounded-full border-2 border-accent/70 bg-accent/10 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:h-48 sm:w-48"
            style={
              reduced
                ? undefined
                : { boxShadow: '0 0 22px rgba(251,191,36,0.35), inset 0 0 30px rgba(251,191,36,0.18)' }
            }
          >
            {!reduced && (
              <span
                key={tapPulse}
                aria-hidden="true"
                className="rc-ping pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
              />
            )}
            <span className="flex flex-col items-center gap-1">
              <span aria-hidden="true" className="text-4xl">⚡</span>
              <span className="text-2xl font-extrabold tabular-nums text-accent" data-testid="reactor-charge">
                {fmt(state.charge)}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-fg-muted">+{fmt(perTap)} / tap</span>
            </span>
          </button>
          <p className="text-xs text-fg-muted">
            Producing <span className="font-bold text-accent tabular-nums">{fmt(prod)}</span> ⚡/sec · lifetime{' '}
            <span className="tabular-nums">{fmt(state.lifetime)}</span>
          </p>
        </div>

        {/* Module ladder */}
        <div className="mt-2 flex flex-col gap-1.5" role="list" aria-label="Modules">
          {MODULES.map((m, i) => {
            const level = state.levels[i]
            const cost = nextCost(state, i)
            const affordable = state.charge >= cost
            const rate = m.baseRate * mult
            return (
              <button
                key={m.id}
                type="button"
                role="listitem"
                data-testid="reactor-module"
                data-module={m.id}
                data-affordable={affordable}
                disabled={!affordable}
                onClick={() => onBuy(i)}
                aria-label={`Buy ${m.name}, level ${level}, cost ${fmt(cost)} charge, +${fmt(m.baseRate)} per second each`}
                className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                  affordable
                    ? 'border-accent/70 bg-accent/10 hover:bg-accent/20'
                    : 'border-border bg-white/5 opacity-60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-xs font-bold text-fg-muted"
                  >
                    {i + 1}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-bold text-fg">
                      {m.name}{' '}
                      <span className="text-fg-muted" data-testid="reactor-level">
                        Lv {level}
                      </span>
                    </span>
                    <span className="text-[11px] text-fg-muted">+{fmt(rate)} ⚡/s each</span>
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className={`text-sm font-bold tabular-nums ${affordable ? 'text-accent' : 'text-fg-muted'}`}>
                    {fmt(cost)} ⚡
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-fg-muted">Buy</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Reboot / prestige */}
        <div className="mt-3 rounded-lg border border-border bg-white/5 p-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-fg-muted">
            <span className="font-semibold uppercase tracking-wide">Reboot</span>
            <span className="tabular-nums">
              {fmt(state.lifetime)} / {fmt(PRESTIGE_THRESHOLD)} lifetime
            </span>
          </div>
          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface" aria-hidden="true">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(progressToReboot * 100).toFixed(1)}%` }}
            />
          </div>
          {canReboot ? (
            confirmReboot ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-fg-muted">
                  Reset all modules for a permanent <span className="font-bold text-accent">×{nextMult.toFixed(1)}</span> boost?
                </span>
                <span className="flex gap-2">
                  <GameButton variant="ghost" onClick={() => setConfirmReboot(false)}>
                    Cancel
                  </GameButton>
                  <GameButton onClick={onReboot} data-testid="reactor-reboot-confirm">
                    Reboot
                  </GameButton>
                </span>
              </div>
            ) : (
              <GameButton
                onClick={() => setConfirmReboot(true)}
                data-testid="reactor-reboot"
                className="w-full"
              >
                ♻ Reboot for ×{nextMult.toFixed(1)} production
              </GameButton>
            )
          ) : (
            <p className="text-xs text-fg-muted">
              Reach <span className="font-bold text-accent">{fmt(PRESTIGE_THRESHOLD)}</span> lifetime ⚡ to unlock a permanent
              production boost.
            </p>
          )}
        </div>

        {/* Welcome-back offline reward */}
        <GameOverlay
          show={welcome !== null}
          variant="win"
          title="Welcome back!"
          testId="reactor-welcome"
        >
          {welcome && (
            <div className="flex flex-col items-center gap-2 text-sm">
              <p className="text-fg-muted">
                While you were away ({fmtDuration(welcome.awayMs)})
              </p>
              <p>
                your reactor made <span className="font-bold text-accent tabular-nums">+{fmt(welcome.gain)} ⚡</span>
              </p>
            </div>
          )}
          <GameButton onClick={() => setWelcome(null)} data-testid="reactor-welcome-collect">
            Collect
          </GameButton>
        </GameOverlay>

        <style>{`
          @keyframes rc-ping {
            0% { opacity: .7; transform: scale(1); }
            100% { opacity: 0; transform: scale(1.35); }
          }
          .rc-ping { animation: rc-ping .5s ease-out both; }
          .rc-core { transition: transform .08s ease; }
          .rc-core:active { transform: scale(.96); }
        `}</style>
      </div>
    </GameShell>
  )
}

/** Human-readable elapsed span for the welcome-back copy (e.g. "2h 14m"). */
function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  const s = Math.floor(ms / 1000)
  return `${s}s`
}
