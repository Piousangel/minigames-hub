'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import * as R from '@/lib/games/ricochet/engine'
import { todayUTC as todayISO } from '@/lib/dailyDate'
import { shareDaily } from '@/lib/dailyShare'

// Component-scoped keyframes — globals.css stays untouched.
const RICOCHET_STYLE = `
@keyframes ric-burst {
  0%   { transform: scale(1);    filter: brightness(2.2); }
  60%  { transform: scale(1.18); filter: brightness(1.6); }
  100% { transform: scale(0.6);  opacity: 0; }
}
@keyframes ric-bolt {
  0%,100% { box-shadow: 0 0 10px 2px rgba(56,189,248,0.6); }
  50%     { box-shadow: 0 0 22px 6px rgba(56,189,248,0.95); }
}
@keyframes ric-preview {
  0%,100% { opacity: 0.25; transform: scale(0.8); }
  50%     { opacity: 0.55; transform: scale(1); }
}
@keyframes ric-shake {
  0%,100% { transform: translate(0,0); }
  25% { transform: translate(calc(var(--amp) * -1px), calc(var(--amp) * 0.4px)); }
  75% { transform: translate(var(--amp), calc(var(--amp) * -0.4px)); }
}
@keyframes ric-combo {
  0% { transform: scale(0.9); }
  40% { transform: scale(1.25); }
  100% { transform: scale(1); }
}
.ric-burst   { animation: ric-burst 0.32s ease-out forwards; }
.ric-bolt    { animation: ric-bolt 0.4s ease-in-out infinite; }
.ric-preview { animation: ric-preview 1.1s ease-in-out infinite; }
.ric-shake   { animation: ric-shake 0.16s ease-in-out; }
.ric-combo   { animation: ric-combo 0.2s ease-out; }
`

const ARROW: Record<R.Dir, string> = { up: '↑', down: '↓', left: '←', right: '→' }
const PREVIEW_HOPS = 2
const LONG_PRESS_MS = 260
const END_HOLD_MS = 120

// Value-tinted color — 4 signals a "monster" ignition.
function valueTint(value: number): string {
  switch (value) {
    case 4:
      return 'text-neon-magenta'
    case 3:
      return 'text-neon-purple'
    case 2:
      return 'text-neon-cyan'
    default:
      return 'text-neon-green'
  }
}


/** Per-hop cumulative delay: base 70ms accelerating toward 45ms for punch. */
function hopDelay(k: number): number {
  let total = 0
  for (let j = 0; j < k; j++) total += Math.max(45, 70 - 2 * j)
  return total
}

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: R.Mode
  onChange: (m: R.Mode) => void
  disabled: boolean
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Game mode">
      {(['endless', 'daily'] as R.Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled}
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors disabled:opacity-50 ${
            mode === m ? 'bg-accent/20 text-accent' : 'bg-surface/80 text-fg-muted hover:text-fg'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}

export function GameRicochet({ storageKey }: { storageKey: string }) {
  // SSR-safe: real state created in the mount effect.
  const [state, setState] = useState<R.GameState | null>(null)
  const [best, setBest] = useState(0)
  const [bestChain, setBestChain] = useState(0)
  const [mode, setMode] = useState<R.Mode>('endless')

  // Animation state.
  const [activeHops, setActiveHops] = useState<R.Hop[]>([])
  const [revealCount, setRevealCount] = useState(0)
  const [comboScore, setComboScore] = useState(0)
  const [boltIndex, setBoltIndex] = useState<number | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const [previewCells, setPreviewCells] = useState<number[]>([])
  const [cursor, setCursor] = useState(24)
  const [newChain, setNewChain] = useState(false)
  const [shareMsg, setShareMsg] = useState('')

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<R.GameState | null>(null)
  const bestRef = useRef(0)
  const bestChainRef = useRef(0)
  const rngRef = useRef<R.Rng>(() => 0)
  const timersRef = useRef<number[]>([])
  const boardRef = useRef<HTMLDivElement | null>(null)
  const pendingRef = useRef<R.IgniteOutcome | null>(null)
  const longPressRef = useRef<number | null>(null)
  const longPressedRef = useRef(false)
  const modeRef = useRef<R.Mode>('endless')

  const commit = useCallback((s: R.GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
  }, [])

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }, [])

  const resetAnim = useCallback(() => {
    setActiveHops([])
    setRevealCount(0)
    setComboScore(0)
    setBoltIndex(null)
    setIsAnimating(false)
    setPreviewCells([])
    pendingRef.current = null
  }, [])

  const startGame = useCallback(
    (nextMode: R.Mode, seedOverride?: number) => {
      clearTimers()
      resetAnim()
      setNewChain(false)
      setShareMsg('')
      modeRef.current = nextMode
      setMode(nextMode)
      const seed =
        nextMode === 'daily'
          ? (seedOverride ?? R.dailySeed(todayISO()))
          : (Date.now() ^ (Date.now() >>> 3)) >>> 0
      rngRef.current = R.mulberry32(seed)
      commit(
        R.newGame({
          mode: nextMode,
          seed,
          rng: rngRef.current,
          tapLimit: nextMode === 'daily' ? R.DAILY_TAPS : null,
        }),
      )
      play('move')
      boardRef.current?.focus()
    },
    [clearTimers, commit, play, resetAnim],
  )

  // Mount: load records, parse ?seed= for a shared daily, start a game.
  useEffect(() => {
    const b = Number(localStorage.getItem(storageKey))
    const bv = Number.isFinite(b) && b > 0 ? b : 0
    bestRef.current = bv
    setBest(bv)
    const c = Number(localStorage.getItem(`${storageKey}:chain`))
    const cv = Number.isFinite(c) && c > 0 ? c : 0
    bestChainRef.current = cv
    setBestChain(cv)

    // 우선순위: ?seed=(공유 링크) > 저장 모드 > daily(기본). 홈의 Daily 필터가
    // 이 게임을 가리키므로 저장값이 없으면 daily로 연다.
    let startMode: R.Mode = localStorage.getItem(`${storageKey}:mode`) === 'endless' ? 'endless' : 'daily'
    let seedOverride: number | undefined
    try {
      const params = new URLSearchParams(window.location.search)
      const raw = params.get('seed')
      if (raw) {
        const n = Number(raw)
        if (Number.isFinite(n) && n >= 0) {
          startMode = 'daily' // 공유 시드는 저장 모드를 덮어쓴다(공유 링크가 최우선)
          seedOverride = n >>> 0
        }
      }
    } catch {
      // ignore malformed URL
    }
    startGame(startMode, seedOverride)
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commitCollapsed = useCallback(() => {
    const outcome = pendingRef.current
    if (!outcome) return
    commit(outcome.state)
    const len = outcome.result.length

    if (outcome.state.score > bestRef.current) {
      bestRef.current = outcome.state.score
      setBest(outcome.state.score)
      localStorage.setItem(storageKey, String(outcome.state.score))
    }
    if (len > bestChainRef.current) {
      bestChainRef.current = len
      setBestChain(len)
      localStorage.setItem(`${storageKey}:chain`, String(len))
      setNewChain(true)
      play('win')
    } else {
      setNewChain(false)
    }

    setIsAnimating(false)
    setActiveHops([])
    setBoltIndex(null)
    pendingRef.current = null
  }, [commit, play, storageKey])

  const fireTap = useCallback(
    (index: number) => {
      const cur = stateRef.current
      if (!cur || isAnimating || cur.over) return
      if (!cur.board[index]) {
        play('error')
        return
      }
      const outcome = R.ignite(cur, index, rngRef.current)
      if (outcome.result.length === 0) {
        play('error')
        return
      }
      pendingRef.current = outcome
      const hops = outcome.result.hops
      const len = hops.length

      setPreviewCells([])
      setIsAnimating(true)
      setActiveHops(hops)
      setRevealCount(0)
      setComboScore(0)
      setBoltIndex(index)

      const instant = reducedRef.current
      hops.forEach((hop, k) => {
        const delay = instant ? 0 : hopDelay(k + 1)
        after(delay, () => {
          setRevealCount(k + 1)
          setBoltIndex(hop.index)
          setComboScore((prev) => prev + (k + 1))
          if (!instant) setShakeKey((s) => s + 1)
          const last = k === len - 1
          if (last) {
            play(len >= 8 ? 'win' : 'eat')
          } else {
            play('move')
          }
        })
      })

      const finishDelay = (instant ? 0 : hopDelay(len)) + (instant ? 0 : END_HOLD_MS)
      after(finishDelay, commitCollapsed)
    },
    [after, commitCollapsed, isAnimating, play, reducedRef],
  )

  // Preview (desktop hover).
  const showPreview = useCallback(
    (index: number) => {
      const cur = stateRef.current
      if (!cur || isAnimating || !cur.board[index]) return
      const cells = R.previewHops(cur.board, index, PREVIEW_HOPS)
      if (cells.length > 0) {
        setPreviewCells(cells)
        play('flip')
      }
    },
    [isAnimating, play],
  )

  const clearPreview = useCallback(() => setPreviewCells([]), [])

  // Touch: long-press previews, quick tap fires.
  const onTouchStart = useCallback(
    (index: number) => {
      longPressedRef.current = false
      if (longPressRef.current) window.clearTimeout(longPressRef.current)
      longPressRef.current = window.setTimeout(() => {
        longPressedRef.current = true
        showPreview(index)
      }, LONG_PRESS_MS)
    },
    [showPreview],
  )

  const onTouchEnd = useCallback(
    (index: number) => {
      if (longPressRef.current) {
        window.clearTimeout(longPressRef.current)
        longPressRef.current = null
      }
      if (longPressedRef.current) {
        longPressedRef.current = false
        clearPreview()
        return // long-press was a preview, not a fire
      }
      fireTap(index)
    },
    [clearPreview, fireTap],
  )

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }, [])

  const switchMode = useCallback(
    (m: R.Mode) => {
      if (m === modeRef.current) return
      localStorage.setItem(`${storageKey}:mode`, m)
      startGame(m)
    },
    [startGame, storageKey],
  )

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current
      if (!s) return
      if (isTypingTarget(e.target)) return
      if (s.over) {
        if (e.key === 'r' || e.key === 'R' || e.key === 'Enter') {
          e.preventDefault()
          startGame(modeRef.current, modeRef.current === 'daily' ? s.seed : undefined)
        }
        return
      }
      if (isAnimating) return
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((i) => (R.toRow(i) > 0 ? i - R.SIZE : i))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((i) => (R.toRow(i) < R.SIZE - 1 ? i + R.SIZE : i))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCursor((i) => (R.toCol(i) > 0 ? i - 1 : i))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setCursor((i) => (R.toCol(i) < R.SIZE - 1 ? i + 1 : i))
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        fireTap(cursor)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cursor, fireTap, isAnimating, startGame])

  const revealedSet = new Set(activeHops.slice(0, revealCount).map((h) => h.index))
  const previewSet = new Set(previewCells)

  const par = state ? R.dailyPar(state.seed) : 0
  const over = state?.over ?? false
  const won = over && (state?.longestChain ?? 0) >= par
  const isDaily = mode === 'daily'

  const doShare = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?seed=${s.seed}`
        : `?seed=${s.seed}`
    const par = R.dailyPar(s.seed)
    const textSnippet = `Ricochet Daily ${todayISO()} — ${s.longestChain}-chain (par ${par}) · ${s.score} pts`
    setShareMsg(`${textSnippet}\n${url}`) // 폴백: 이미지 안 되는 환경에서 수동 복사용
    void shareDaily({
      gameName: 'Ricochet',
      dateISO: todayISO(),
      accent: '#22d3ee', // neon-cyan (Ricochet accent)
      lines: [
        { label: 'Longest chain', value: String(s.longestChain) },
        { label: 'Score', value: String(s.score) },
      ],
      url,
      textSnippet,
    }).then(
      (r) => play(r.method === 'text-only' ? 'error' : 'match'),
      () => play('error'),
    )
  }, [play])

  const hintText = state
    ? isDaily
      ? `${state.tapsLeft ?? 0} taps left · par ${par}. Longest chain this board: ${state.longestChain}.`
      : 'Tap any tile to fire a bolt — it jumps its number, then obeys wherever it lands. Chase one monster ignition.'
    : ''

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state?.score ?? 0, testId: 'score', float: true },
        { label: 'Best', value: best },
        { label: 'Longest', value: bestChain },
      ]}
      headerExtra={<ModeToggle mode={mode} onChange={switchMode} disabled={isAnimating} />}
      onNewGame={() => startGame(mode, isDaily ? state?.seed : undefined)}
      newGameLabel={isDaily ? 'Replay Daily' : 'New Board'}
      newGameDisabled={isAnimating}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hintText}
    >
      <style>{RICOCHET_STYLE}</style>

      {/* Status row */}
      <div
        data-testid="ricochet-status"
        className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs"
      >
        <span className="rounded-full border border-border bg-bg-2 px-3 py-1 font-semibold text-fg-muted">
          Chain best: <span className="text-accent">{bestChain}</span>
        </span>
        {isDaily && state && (
          <>
            <span className="rounded-full border border-border bg-bg-2 px-3 py-1 font-semibold text-fg-muted">
              Taps: <span className="text-fg">{state.tapsLeft ?? 0}</span>/{R.DAILY_TAPS}
            </span>
            <span className="rounded-full border border-border bg-bg-2 px-3 py-1 font-semibold text-fg-muted">
              Par: <span className="text-fg">{par}</span>
            </span>
          </>
        )}
      </div>

      <div
        key={`shake-${shakeKey}`}
        style={{ '--amp': String(Math.min(8, revealCount)) } as React.CSSProperties}
        className={!reduced && isAnimating && revealCount > 0 ? 'ric-shake' : ''}
      >
        <div
          ref={boardRef}
          tabIndex={-1}
          data-testid="ricochet-board"
          role="grid"
          aria-label="Ricochet board"
          className="anim-board-in relative grid aspect-square w-full grid-cols-7 gap-1 rounded-xl border border-border bg-surface p-2 outline-none"
        >
          {(state?.board ?? (new Array(R.CELL_COUNT).fill(null) as R.Board)).map((tile, i) => {
            const isCursor = cursor === i
            const isBolt = boltIndex === i
            const isRevealed = revealedSet.has(i)
            const isPreview = previewSet.has(i)
            const r = R.toRow(i)
            const c = R.toCol(i)
            const label = tile
              ? `row ${r + 1} column ${c + 1}, value ${tile.value} arrow ${tile.dir}`
              : `row ${r + 1} column ${c + 1}, empty`
            return (
              <button
                key={i}
                type="button"
                data-testid={`cell-${i}`}
                role="gridcell"
                aria-label={label}
                disabled={!tile || isAnimating}
                onClick={() => fireTap(i)}
                onMouseEnter={() => showPreview(i)}
                onMouseLeave={clearPreview}
                onTouchStart={() => onTouchStart(i)}
                onTouchEnd={(e) => {
                  e.preventDefault()
                  onTouchEnd(i)
                }}
                onTouchMove={cancelLongPress}
                className={`relative flex flex-col items-center justify-center rounded-md border text-center transition-colors ${
                  tile
                    ? 'border-border bg-bg-2 hover:border-accent/60'
                    : 'border-transparent bg-bg-2/30'
                } ${isCursor ? 'ring-2 ring-accent' : ''} ${
                  isBolt && !reduced ? 'ric-bolt border-neon-cyan' : ''
                }`}
              >
                {tile && (
                  <>
                    <span className={`text-lg font-extrabold leading-none sm:text-xl ${valueTint(tile.value)}`}>
                      {tile.value}
                    </span>
                    <span aria-hidden="true" className="text-[10px] leading-none text-fg-muted sm:text-xs">
                      {ARROW[tile.dir]}
                    </span>
                  </>
                )}
                {isRevealed && !reduced && (
                  <span
                    aria-hidden="true"
                    className="ric-burst pointer-events-none absolute inset-0 rounded-md bg-neon-cyan/40"
                  />
                )}
                {isRevealed && reduced && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-md bg-neon-cyan/20"
                  />
                )}
                {isPreview && (
                  <span
                    aria-hidden="true"
                    className="ric-preview pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-accent"
                  />
                )}
              </button>
            )
          })}

          {/* Live combo counter */}
          {isAnimating && revealCount > 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div
                data-testid="ricochet-combo"
                key={`combo-${revealCount}`}
                className={`flex flex-col items-center ${!reduced ? 'ric-combo' : ''}`}
              >
                <span className="text-5xl font-extrabold text-accent drop-shadow-[0_0_18px_rgba(56,189,248,0.8)]">
                  +{comboScore}
                </span>
                <span className="mt-1 rounded-full bg-accent/20 px-3 py-0.5 text-sm font-bold text-accent">
                  ×{revealCount} chain
                </span>
              </div>
            </div>
          )}

          {/* Daily win overlay */}
          <GameOverlay
            show={over && won}
            variant="win"
            title={`Par beaten! ${state?.longestChain ?? 0}-chain`}
            testId="you-win"
          >
            <p className="text-sm text-fg-muted">
              {state?.score ?? 0} pts · par {par}. {newChain ? 'New personal chain best!' : ''}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton onClick={doShare} className="px-4 py-2">
                Share
              </GameButton>
              <GameButton
                variant="ghost"
                onClick={() => startGame('daily', state?.seed)}
                className="px-4 py-2"
              >
                Replay
              </GameButton>
            </div>
            {shareMsg && (
              <textarea
                readOnly
                value={shareMsg}
                aria-label="Share text"
                className="mt-1 h-20 w-64 rounded-lg border border-border bg-bg-2 p-2 text-xs text-fg"
              />
            )}
          </GameOverlay>

          {/* Daily lose overlay */}
          <GameOverlay
            show={over && !won}
            variant="lose"
            title={`Daily done — best ${state?.longestChain ?? 0}`}
            testId="game-over"
          >
            <p className="text-sm text-fg-muted">
              Par was {par}. You scored {state?.score ?? 0} pts. Share and try again.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton onClick={doShare} className="px-4 py-2">
                Share
              </GameButton>
              <GameButton
                variant="ghost"
                onClick={() => startGame('daily', state?.seed)}
                className="px-4 py-2"
              >
                Replay
              </GameButton>
            </div>
            {shareMsg && (
              <textarea
                readOnly
                value={shareMsg}
                aria-label="Share text"
                className="mt-1 h-20 w-64 rounded-lg border border-border bg-bg-2 p-2 text-xs text-fg"
              />
            )}
          </GameOverlay>
        </div>
      </div>
    </GameShell>
  )
}
