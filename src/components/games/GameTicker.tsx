'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SPARK_LEN,
  START_W,
  TOTAL_TICKS,
  bestPossibleW,
  commit,
  currentSnapshots,
  exitCallout,
  newGame,
  type AssetSnapshot,
  type Bucket,
  type Choice,
  type TickerState,
} from '@/lib/games/ticker/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const CHOICES: Choice[] = ['A', 'B', 'C', 'CASH']
const ASSET_IDS: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C']
const BUCKET_INDEX: Record<Bucket, number> = { cold: 0, warming: 1, hot: 2, overheated: 3 }
const BUCKET_LABEL: Record<Bucket, string> = { cold: 'cold', warming: 'warming', hot: 'hot', overheated: 'overheated' }

interface BestBlob {
  bestW: number
  bestStreak: number
  streak: number
}

const EMPTY_BEST: BestBlob = { bestW: 0, bestStreak: 0, streak: 0 }

/**
 * 통계 blob 전용 키. best:<slug>에는 숫자(bestW)만 넣는다 — 주간 리더보드가 그 키를
 * Number()로 읽으므로(모든 게임 공통 규약) JSON을 넣으면 NaN이 되어 제출이 영구히 막힌다.
 */
function statsKey(storageKey: string): string {
  return `${storageKey}:stats`
}

function toBlob(raw: string): BestBlob | null {
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return { bestW: num(o.bestW), bestStreak: num(o.bestStreak), streak: num(o.streak) }
}

function saveBest(storageKey: string, blob: BestBlob): void {
  try {
    localStorage.setItem(storageKey, String(blob.bestW))
    localStorage.setItem(statsKey(storageKey), JSON.stringify(blob))
  } catch {
    // ignore storage failures
  }
}

function loadBest(storageKey: string): BestBlob {
  try {
    const raw = localStorage.getItem(statsKey(storageKey))
    if (raw) {
      const blob = toBlob(raw)
      if (blob) return blob
    }
    // 레거시: best:<slug>에 blob을 통째로 넣던 시절의 데이터를 옮겨 온다.
    // 평문 숫자로 이미 정규화된 값은 JSON.parse가 number를 뱉으므로 toBlob이 null을 준다 —
    // 그 경우 통계는 잃되 기록 자체는 아래 bestW 복구로 살린다.
    const legacy = localStorage.getItem(storageKey)
    if (legacy) {
      const blob = toBlob(legacy)
      if (blob) {
        saveBest(storageKey, blob)
        return blob
      }
      const n = Number(legacy)
      if (Number.isFinite(n) && n > 0) return { ...EMPTY_BEST, bestW: Math.floor(n) }
    }
  } catch {
    // legacy / corrupt value -> reset
  }
  return { ...EMPTY_BEST }
}

function fmtPct(ret: number): string {
  const sign = ret > 0 ? '+' : ''
  return `${sign}${(ret * 100).toFixed(1)}%`
}

/** Pick a fresh, engine-safe seed. Math.random lives only at this component boundary. */
function pickSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}

/** Ring pulse duration in seconds, scaling with snap risk: 1.4s @ p=0.1 → 0.35s @ p=0.85. */
function ringDuration(p: number): number {
  const t = Math.max(0, Math.min(1, (p - 0.1) / (0.85 - 0.1)))
  return 1.4 + (0.35 - 1.4) * t
}

/** Inline SVG polyline for a list of returns, colored per net sign. */
function Sparkline({ rets }: { rets: number[] }) {
  const w = 64
  const h = 20
  if (rets.length < 2) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="opacity-40">
        <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="currentColor" strokeWidth={1} strokeDasharray="2 2" />
      </svg>
    )
  }
  const max = Math.max(...rets.map(Math.abs), 0.02)
  const pts = rets
    .map((r, i) => {
      const x = (i / (rets.length - 1)) * w
      const y = h / 2 - (r / max) * (h / 2 - 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const last = rets[rets.length - 1]
  const stroke = last >= 0 ? '#4ade80' : '#f87171'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="currentColor" strokeWidth={0.5} opacity={0.25} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** The big W value line + inline W-sparkline of the run so far. */
function WorthSpark({ ws }: { ws: number[] }) {
  const w = 120
  const h = 28
  if (ws.length < 2) return null
  const min = Math.min(...ws)
  const max = Math.max(...ws)
  const span = Math.max(max - min, 1)
  const pts = ws
    .map((v, i) => {
      const x = (i / (ws.length - 1)) * w
      const y = h - ((v - min) / span) * (h - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const startY = h - ((START_W - min) / span) * (h - 2) - 1
  const up = ws[ws.length - 1] >= START_W
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="text-fg-muted">
      <line x1={0} y1={startY} x2={w} y2={startY} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4} />
      <polyline points={pts} fill="none" stroke={up ? '#4ade80' : '#f87171'} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function GameTicker({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<TickerState | null>(null)
  const [best, setBest] = useState<BestBlob>({ ...EMPTY_BEST })
  const [newBest, setNewBest] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [revealSeq, setRevealSeq] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const seedRef = useRef(0)
  const prevOver = useRef(false)
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([null, null, null, null])

  const over = state?.over ?? false

  const startWithSeed = useCallback((seed: number) => {
    seedRef.current = seed
    setState(newGame(seed))
    setNewBest(false)
    setCursor(0)
    setRevealSeq((n) => n + 1)
    prevOver.current = false
  }, [])

  // Mount: fresh run + load best (client only).
  useEffect(() => {
    startWithSeed(pickSeed())
    setBest(loadBest(storageKey))
  }, [startWithSeed, storageKey])

  const onNewGame = useCallback(() => {
    startWithSeed(pickSeed())
    btnRefs.current[0]?.focus()
  }, [startWithSeed])

  const onReplaySeed = useCallback(() => {
    startWithSeed(seedRef.current)
    btnRefs.current[0]?.focus()
  }, [startWithSeed])

  const commitChoice = useCallback(
    (choice: Choice) => {
      setState((s) => {
        if (!s || s.over) return s
        const next = commit(s, choice)
        const rec = next.history[next.history.length - 1]
        play('flip')
        // Resolve feedback for the chosen line.
        if (rec.chosenRet > 0) play('merge')
        else if (rec.chosenRet < 0) play('error')
        else play('move')
        // Single danger ping if any asset newly enters overheated this tick.
        const overheatNow = rec.assets.some((a) => a.after.bucket === 'overheated' && a.before.bucket !== 'overheated')
        if (overheatNow && !next.over) play('flag')
        return next
      })
      setRevealSeq((n) => n + 1)
    },
    [play],
  )

  const moveCursor = useCallback((delta: number) => {
    setCursor((c) => {
      const nc = Math.max(0, Math.min(CHOICES.length - 1, c + delta))
      btnRefs.current[nc]?.focus()
      return nc
    })
  }, [])

  // Keyboard: number/letter shortcuts, arrow roving, Enter to commit focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      // Cmd/Ctrl+C (copy) etc. must not commit an irreversible bet.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (over) return
      const k = e.key.toLowerCase()
      let choice: Choice | null = null
      if (k === '1' || k === 'a') choice = 'A'
      else if (k === '2' || k === 'b') choice = 'B'
      else if (k === '3' || k === 'c') choice = 'C'
      else if (k === '4' || k === '0' || k === 'x' || k === ' ' || k === 'spacebar') choice = 'CASH'

      if (choice) {
        e.preventDefault()
        commitChoice(choice)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moveCursor(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        moveCursor(1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        commitChoice(CHOICES[cursor])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [over, cursor, commitChoice, moveCursor])

  // Game-over: persist best + streak, play win/lose once.
  useEffect(() => {
    if (!state) return
    if (state.over && !prevOver.current) {
      const finalW = Math.floor(state.W)
      const green = finalW >= START_W
      const hadRecord = best.bestW > 0
      const isNewHigh = finalW > best.bestW
      const streak = green ? best.streak + 1 : 0
      const nextBest: BestBlob = {
        bestW: Math.max(best.bestW, finalW),
        bestStreak: Math.max(best.bestStreak, streak),
        streak,
      }
      setBest(nextBest)
      saveBest(storageKey, nextBest)
      // 'New best!'는 이긴 판(시작 자산 이상)에서만. 첫 판은 bestW가 0이라 isNewHigh가
      // 항상 true이므로, 손실로 끝난 첫 판이나 손실 기록끼리의 갱신을 축하하지 않는다.
      const win = green && (isNewHigh || !hadRecord)
      setNewBest(win)
      play(win ? 'win' : 'lose')
      recordResult(storageKey.replace(/^best:/, ''), { won: green })
    }
    prevOver.current = state.over
  }, [state, best, storageKey, play])

  const W = state?.W ?? START_W
  const finalW = Math.floor(W)
  const tickNo = state ? Math.min(state.tick + 1, TOTAL_TICKS) : 1
  const parW = state ? bestPossibleW(state.tape) : START_W
  const delta = finalW - parW
  const callout = state ? exitCallout(state) : null

  // Snapshots to render (upcoming while live; final `after` when over).
  const lastRec = state && state.history.length > 0 ? state.history[state.history.length - 1] : null
  let snaps: AssetSnapshot[] = []
  if (state) {
    if (state.over) {
      snaps = lastRec ? lastRec.assets.map((a) => a.after) : state.tape.ticks[0].map((a) => a.before)
    } else {
      snaps = currentSnapshots(state)
    }
  }

  const wSeries = state ? [START_W, ...state.history.map((h) => h.W)] : [START_W]

  const newGameLabel = over ? 'New Run' : 'Restart'
  const hint = over
    ? 'Run over — New Run for a fresh market, or Replay seed to beat this one.'
    : 'Each tick, tap one asset (A/B/C) to go all-in — or CASH to sit out. Read momentum + the tension ring, and bail to cash before a hot asset snaps.'

  const streakBadge =
    best.streak > 0 ? (
      <span className="rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-sm font-bold text-accent" data-testid="ticker-streak">
        🔥×{best.streak}
      </span>
    ) : null

  const headerExtra = (
    <>
      <span className="rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-sm text-fg-muted" data-testid="ticker-tick">
        Tick {tickNo}/{TOTAL_TICKS}
      </span>
      {streakBadge}
    </>
  )

  const board = (
    <div
      className="relative rounded-xl bg-surface p-4"
      style={reduced ? undefined : { animation: 'tk-board-in .3s ease-out both' }}
    >
      {/* Worth line + W-sparkline */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wide text-fg-muted">Worth</span>
          <span className="text-3xl font-extrabold tabular-nums text-fg">{finalW}</span>
        </div>
        <WorthSpark ws={wSeries} />
      </div>

      {/* Three asset cards */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Ticker market board" data-testid="ticker-board">
        {ASSET_IDS.map((id, i) => {
          const snap = snaps[i]
          const bucket = snap?.bucket ?? 'cold'
          const snapProb = snap?.snapProb ?? 0
          const heatPct = Math.round(snapProb * 100)
          const litTo = BUCKET_INDEX[bucket]
          const rec = lastRec?.assets[i] ?? null
          const chosen = lastRec ? lastRec.choice === id : false
          const assetRets = state ? state.history.map((h) => h.assets[i].ret).slice(-SPARK_LEN) : []
          return (
            <div
              key={id}
              data-testid="ticker-asset"
              data-asset={id}
              data-bucket={bucket}
              data-heat={heatPct}
              className={`tk-card relative flex flex-col items-center gap-2 rounded-lg border p-2 ${chosen ? 'tk-card-chosen' : 'tk-card-dim'}`}
              data-bkt={bucket}
            >
              {/* Tension ring overlay when a snap is possible */}
              {snapProb > 0 && (
                <span
                  aria-hidden="true"
                  data-heat={heatPct}
                  className="tk-ring pointer-events-none absolute inset-0 rounded-lg"
                  style={
                    reduced
                      ? { borderColor: `hsl(${45 - snapProb * 45} 90% 55%)`, borderWidth: 2, borderStyle: 'solid' }
                      : {
                          borderColor: `hsl(${45 - snapProb * 45} 90% 55%)`,
                          animation: `tk-ring-pulse ${ringDuration(snapProb).toFixed(2)}s ease-in-out infinite`,
                        }
                  }
                />
              )}

              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-bold text-fg">{id}</span>
                <span className="text-[10px] uppercase tracking-wide text-fg-muted">{BUCKET_LABEL[bucket]}</span>
              </div>

              {/* 4-segment momentum meter */}
              <div className="flex w-full gap-0.5" aria-hidden="true">
                {[0, 1, 2, 3].map((seg) => (
                  <span
                    key={seg}
                    className="h-1.5 flex-1 rounded-full"
                    data-lit={seg <= litTo}
                    data-seg={seg}
                  />
                ))}
              </div>

              <Sparkline rets={assetRets} />

              {/* Just-resolved return chip */}
              {rec ? (
                <span
                  key={`chip-${revealSeq}`}
                  data-testid="ticker-return"
                  data-asset={id}
                  data-snapped={rec.snapped}
                  className={`tk-chip rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${rec.ret >= 0 ? 'tk-chip-up' : 'tk-chip-down'}`}
                  style={reduced ? undefined : { animation: 'tk-chip-in .28s ease-out both' }}
                >
                  {fmtPct(rec.ret)}
                </span>
              ) : (
                <span data-testid="ticker-return" data-asset={id} data-snapped="false" className="text-xs text-fg-muted tabular-nums">
                  —
                </span>
              )}

              {/* Chosen-card resolve juice */}
              {!reduced && chosen && rec && rec.ret < 0 && (
                <span key={`snap-${revealSeq}`} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg" style={{ animation: 'tk-snap-flash .4s ease-out both' }} />
              )}
              {!reduced && chosen && rec && rec.ret > 0 && (
                <span key={`gain-${revealSeq}`} aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg" style={{ animation: 'tk-gain-glow .5s ease-out both' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Choice buttons */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {CHOICES.map((choice, idx) => {
          const isCash = choice === 'CASH'
          const i = isCash ? -1 : idx
          const snap = i >= 0 ? snaps[i] : null
          const label = isCash
            ? 'Hold cash, 0% safe'
            : `Go all-in on asset ${choice} — momentum ${snap?.bucket ?? 'cold'}, snap risk ${Math.round((snap?.snapProb ?? 0) * 100)}%`
          return (
            <button
              key={choice}
              ref={(el) => {
                btnRefs.current[idx] = el
              }}
              type="button"
              data-testid="ticker-choice"
              data-choice={choice}
              disabled={over}
              tabIndex={cursor === idx ? 0 : -1}
              aria-label={label}
              onFocus={() => setCursor(idx)}
              // 되돌릴 수 없는 올인 베팅이라 pointerdown이 아닌 click으로 확정한다 —
              // 스크롤하려고 버튼 위에 엄지를 올린 것만으로는 확정되지 않는다.
              onClick={() => commitChoice(choice)}
              className="tk-choice min-h-11 rounded-lg border border-border bg-surface/80 py-2.5 text-base font-extrabold text-fg disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {choice}
            </button>
          )
        })}
      </div>

      {/* Seed line */}
      <div className="mt-2 text-center text-[11px] text-fg-muted">
        seed <span data-testid="ticker-seed" className="tabular-nums">{seedRef.current}</span>
      </div>

      <GameOverlay
        show={over}
        variant={newBest ? 'win' : 'lose'}
        title={state?.busted ? 'Busted!' : newBest ? 'New best!' : 'Run over'}
        testId="game-over"
      >
        <div className="flex flex-col items-center gap-1 text-sm">
          <p>
            Final worth <span className="font-bold text-accent tabular-nums">{finalW}</span>
          </p>
          <p>
            Best possible <span className="font-bold text-accent tabular-nums" data-testid="ticker-par">{parW}</span>
          </p>
          <p className={delta >= 0 ? 'text-neon-green' : 'text-neon-red'}>
            {delta >= 0 ? `Beat par by ${delta}` : `Short by ${-delta}`}
          </p>
          {callout && <p className="max-w-64 text-center text-fg-muted">{callout.message}</p>}
          <p className="text-[11px] text-fg-muted">
            seed <span className="tabular-nums">{seedRef.current}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <GameButton onClick={onNewGame}>New Run</GameButton>
          <GameButton variant="ghost" onClick={onReplaySeed}>
            Replay seed
          </GameButton>
        </div>
      </GameOverlay>

      <style>{`
        @keyframes tk-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
        @keyframes tk-chip-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes tk-ring-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); opacity: .55; transform: scale(1); }
          50% { box-shadow: 0 0 12px 1px rgba(248,113,113,.5); opacity: 1; transform: scale(.985); }
        }
        @keyframes tk-gain-glow {
          0% { box-shadow: inset 0 0 0 0 rgba(74,222,128,0); }
          40% { box-shadow: inset 0 0 18px 2px rgba(74,222,128,.55); }
          100% { box-shadow: inset 0 0 0 0 rgba(74,222,128,0); }
        }
        @keyframes tk-snap-flash {
          0% { background: rgba(248,113,113,.5); transform: translateX(0) }
          20% { transform: translateX(-3px) }
          45% { transform: translateX(3px) }
          70% { transform: translateX(-2px) }
          100% { background: rgba(248,113,113,0); transform: translateX(0) }
        }
        .tk-card { background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.08); transition: opacity .2s ease; }
        .tk-card-dim { opacity: .72; }
        .tk-card-chosen { opacity: 1; border-color: rgba(251,191,36,.55); box-shadow: 0 0 12px rgba(251,191,36,.2); }
        .tk-ring { border-width: 2px; border-style: solid; }
        .tk-card .h-1\\.5[data-lit='false'] { background: rgba(255,255,255,0.12); }
        .tk-card[data-bkt='cold'] .h-1\\.5[data-lit='true'] { background: #94a3b8; }
        .tk-card[data-bkt='warming'] .h-1\\.5[data-lit='true'] { background: #22d3ee; }
        .tk-card[data-bkt='hot'] .h-1\\.5[data-lit='true'] { background: #f59e0b; }
        .tk-card[data-bkt='overheated'] .h-1\\.5[data-lit='true'] { background: #ef4444; }
        .tk-chip-up { background: rgba(74,222,128,.16); color: #4ade80; }
        .tk-chip-down { background: rgba(248,113,113,.16); color: #f87171; }
        .tk-choice[data-choice='CASH'] { border-color: rgba(148,163,184,.5); }
      `}</style>
    </div>
  )

  const stats = [
    { label: 'Worth', value: finalW, testId: 'score' },
    { label: 'Best', value: best.bestW },
  ]

  return (
    <GameShell
      stats={stats}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={newGameLabel}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      {board}
    </GameShell>
  )
}
