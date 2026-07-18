'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  cut,
  dailySeed,
  legalEdges,
  mulberry32,
  newGame,
  nextLevel,
  previewCut,
  undo,
  type CutResult,
  type EdgeId,
  type GameState,
  type Mode,
} from '@/lib/games/splice/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { todayUTC as todayISO } from '@/lib/dailyDate'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// A fixed, asset-free node palette (CSS discs only). Color id -> HSL.
const NODE_COLORS = [
  'hsl(190 90% 55%)',
  'hsl(330 85% 62%)',
  'hsl(95 70% 52%)',
  'hsl(45 95% 58%)',
  'hsl(265 80% 68%)',
]
// Redundant, color-blind-safe glyph per color id (rendered as a small node label).
const NODE_GLYPHS = ['C', 'M', 'G', 'Y', 'P']

const CUT_MS = 220 // input lock while a cut/collapse plays
const BANNER_MS = 900 // cascade banner lifetime

// SVG viewBox is 0..100; layout [0,1] maps into [PAD, 100-PAD].
const PAD = 8
const proj = (v: number) => PAD + v * (100 - 2 * PAD)

interface DailyRecord {
  bestScore: number
  fewestCuts: number
  cleared: boolean
  bestSolution: EdgeId[]
}
type DailyMap = Record<string, DailyRecord>

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}


export function GameSplice({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState(0)
  const [mode, setMode] = useState<Mode>('puzzle')
  const [preview, setPreview] = useState<CutResult | null>(null)
  const [edgeCursor, setEdgeCursor] = useState(0)
  const [banner, setBanner] = useState<{ n: number; key: number } | null>(null)
  const [pulseKey, setPulseKey] = useState(0)
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const bestRef = useRef(0)
  const dailyRef = useRef<DailyMap>({})
  const lockedRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const edgeElRef = useRef<(SVGLineElement | null)[]>([])

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
  }, [])

  const schedule = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms))
  }, [])

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const refreshDailyRecord = useCallback((seed: number) => {
    setDailyRecord(dailyRef.current[String(seed)] ?? null)
  }, [])

  const refreshPreview = useCallback((s: GameState, cursor: number) => {
    if (s.won || s.lost) {
      setPreview(null)
      return
    }
    const legal = legalEdges(s)
    const eid = legal[cursor]
    if (eid === undefined) {
      setPreview(null)
      return
    }
    setPreview(previewCut(s, eid))
  }, [])

  const startRun = useCallback(
    (nextMode: Mode, seed: number, level: number) => {
      clearTimers()
      lockedRef.current = false
      setBanner(null)
      const fresh = newGame(mulberry32(seed), nextMode, seed, level)
      setEdgeCursor(0)
      commit(fresh)
      refreshPreview(fresh, 0)
      refreshDailyRecord(seed)
    },
    [clearTimers, commit, refreshDailyRecord, refreshPreview],
  )

  // Client-only bootstrap.
  useEffect(() => {
    const storedBest = Number(localStorage.getItem(storageKey))
    bestRef.current = Number.isFinite(storedBest) && storedBest > 0 ? storedBest : 0
    setBest(bestRef.current)

    try {
      const raw = localStorage.getItem(`${storageKey}:daily`)
      dailyRef.current = raw ? (JSON.parse(raw) as DailyMap) : {}
    } catch {
      dailyRef.current = {}
    }

    const storedMode = localStorage.getItem(`${storageKey}:mode`)
    const initialMode: Mode = storedMode === 'endless' ? 'endless' : 'puzzle'
    setMode(initialMode)
    const seed = initialMode === 'puzzle' ? dailySeed(todayISO()) : randomSeed()
    startRun(initialMode, seed, 1)

    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persistBest = useCallback(
    (score: number) => {
      if (score > bestRef.current) {
        bestRef.current = score
        setBest(score)
        try {
          localStorage.setItem(storageKey, String(score))
        } catch {
          /* storage unavailable */
        }
      }
    },
    [storageKey],
  )

  const persistDaily = useCallback(
    (s: GameState, solutionLine: EdgeId[]) => {
      if (s.mode !== 'puzzle') return
      const key = String(s.seed)
      const prev = dailyRef.current[key]
      const beatsFewest = s.won && s.cutsUsed < (prev?.fewestCuts ?? Number.MAX_SAFE_INTEGER)
      const rec: DailyRecord = {
        bestScore: Math.max(prev?.bestScore ?? 0, s.score),
        fewestCuts: s.won
          ? Math.min(prev?.fewestCuts ?? Number.MAX_SAFE_INTEGER, s.cutsUsed)
          : (prev?.fewestCuts ?? Number.MAX_SAFE_INTEGER),
        cleared: (prev?.cleared ?? false) || s.won,
        bestSolution: beatsFewest ? solutionLine : (prev?.bestSolution ?? []),
      }
      dailyRef.current[key] = rec
      setDailyRecord(rec)
      try {
        localStorage.setItem(`${storageKey}:daily`, JSON.stringify(dailyRef.current))
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey],
  )

  // The set of edges the player has actually cut this run (for the daily ghost line).
  const cutLineRef = useRef<EdgeId[]>([])

  const resolveOutcome = useCallback(
    (next: GameState) => {
      persistBest(next.score)
      if (next.won || next.lost) persistDaily(next, cutLineRef.current.slice())
    },
    [persistBest, persistDaily],
  )

  const commitCut = useCallback(
    (edgeId: EdgeId) => {
      const s = stateRef.current
      if (lockedRef.current || !s || s.won || s.lost) {
        play('error')
        return
      }
      const { state: next, result } = cut(s, edgeId)
      if (!result.legal) {
        play('error')
        return
      }
      cutLineRef.current = cutLineRef.current.concat(edgeId)

      // Sound precedence (§4).
      if (next.won) play('win')
      else if (next.lost) play('lose')
      else if (result.collapsed.length >= 2) play('merge')
      else if (result.collapsed.length >= 1) play('match')
      else play('flip')

      if (result.collapsed.length >= 2) {
        setBanner({ n: result.collapsed.length, key: Date.now() })
        setPulseKey((k) => k + 1)
        schedule(() => setBanner(null), BANNER_MS)
      }

      const applyState = () => {
        const legal = legalEdges(next)
        const nextCursor = Math.min(edgeCursor, Math.max(0, legal.length - 1))
        setEdgeCursor(nextCursor)
        commit(next)
        refreshPreview(next, nextCursor)
        resolveOutcome(next)
        lockedRef.current = false
      }

      if (reducedRef.current) {
        applyState()
        return
      }
      lockedRef.current = true
      setPreview(result) // keep the collapse preview visible during the brief animation
      schedule(applyState, CUT_MS)
    },
    [commit, edgeCursor, play, reducedRef, refreshPreview, resolveOutcome, schedule],
  )

  const doUndo = useCallback(() => {
    const s = stateRef.current
    if (!s || lockedRef.current) return
    if (s.mode === 'endless' || s.undosLeft <= 0 || s.history.length === 0) {
      play('error')
      return
    }
    play('flip')
    cutLineRef.current = cutLineRef.current.slice(0, -1)
    const next = undo(s)
    const legal = legalEdges(next)
    const nextCursor = Math.min(edgeCursor, Math.max(0, legal.length - 1))
    setEdgeCursor(nextCursor)
    commit(next)
    refreshPreview(next, nextCursor)
  }, [commit, edgeCursor, play, refreshPreview])

  const moveCursor = useCallback(
    (delta: number) => {
      const s = stateRef.current
      if (!s) return
      const legal = legalEdges(s)
      if (legal.length === 0) return
      const wrapped = ((edgeCursor + delta) % legal.length + legal.length) % legal.length
      setEdgeCursor(wrapped)
      refreshPreview(s, wrapped)
      play('move')
      edgeElRef.current[legal[wrapped]]?.focus?.()
    },
    [edgeCursor, play, refreshPreview],
  )

  const onBoardKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const legal = legalEdges(s)
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          moveCursor(1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          moveCursor(-1)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (legal[edgeCursor] !== undefined) commitCut(legal[edgeCursor])
          break
        case 'u':
        case 'U':
          e.preventDefault()
          doUndo()
          break
        default:
          break
      }
    },
    [commitCut, doUndo, edgeCursor, moveCursor],
  )

  const switchMode = useCallback(
    (m: Mode) => {
      if (m === mode) return
      setMode(m)
      try {
        localStorage.setItem(`${storageKey}:mode`, m)
      } catch {
        /* storage unavailable */
      }
      cutLineRef.current = []
      const seed = m === 'puzzle' ? dailySeed(todayISO()) : randomSeed()
      startRun(m, seed, 1)
    },
    [mode, startRun, storageKey],
  )

  const newRun = useCallback(() => {
    cutLineRef.current = []
    const seed = mode === 'puzzle' ? dailySeed(todayISO()) : randomSeed()
    startRun(mode, seed, 1)
  }, [mode, startRun])

  const retryBoard = useCallback(() => {
    const s = stateRef.current
    cutLineRef.current = []
    startRun(mode, s ? s.seed : randomSeed(), s ? s.level : 1)
  }, [mode, startRun])

  const advance = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    clearTimers()
    lockedRef.current = false
    setBanner(null)
    cutLineRef.current = []
    const seed = mode === 'puzzle' ? dailySeed(todayISO()) : randomSeed()
    const next = nextLevel(s, mulberry32(seed), seed)
    setEdgeCursor(0)
    commit(next)
    refreshPreview(next, 0)
    refreshDailyRecord(seed)
  }, [clearTimers, commit, mode, refreshDailyRecord, refreshPreview])

  // --- Derived UI data ------------------------------------------------------

  const { sideASet, sideBSet, collapseSet } = useMemo(() => {
    const a = new Set<number>()
    const b = new Set<number>()
    const col = new Set<number>()
    if (preview && preview.legal) {
      for (const nd of preview.sideA) a.add(nd)
      for (const nd of preview.sideB) b.add(nd)
      for (const ev of preview.collapsed) for (const nd of ev.nodes) col.add(nd)
    }
    return { sideASet: a, sideBSet: b, collapseSet: col }
  }, [preview])

  const parDelta = state ? state.cutsUsed - state.par : 0
  const starTier = (() => {
    if (!state || !state.won) return 0
    if (state.cutsUsed <= state.par) return 3
    if (state.cutsUsed <= state.par + 1) return 2
    return 1
  })()

  const hint = (() => {
    const base = 'Cut an edge — same-color groups pop for size² points and can chain. Clear the network in as few cuts as possible.'
    const par = state ? ` Par ${state.par} cuts.` : ''
    if (mode === 'puzzle' && dailyRecord && dailyRecord.fewestCuts < Number.MAX_SAFE_INTEGER) {
      return `${base}${par} Your best: ${dailyRecord.fewestCuts} cuts.`
    }
    return `${base}${par}`
  })()

  const stats = [
    { label: 'Score', value: state?.score ?? 0, testId: 'score', float: true },
    { label: 'Best', value: best, testId: 'best' },
  ]

  const modeToggle = (
    <div
      className="flex overflow-hidden rounded-lg border border-border"
      role="group"
      aria-label="Game mode"
    >
      {(['puzzle', 'endless'] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => switchMode(m)}
          aria-pressed={mode === m}
          className={`btn-press px-2.5 py-1.5 text-sm font-semibold capitalize ${
            mode === m ? 'bg-accent text-stone-900' : 'bg-surface text-fg hover:bg-white/10'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )

  const headerExtra = (
    <>
      <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
        <span className="text-fg-muted">Cuts</span>{' '}
        <span data-testid="cuts" className="font-bold text-accent">
          {state ? `${state.cutsUsed} / ${state.par}` : '0 / 0'}
        </span>
      </div>
      {mode === 'puzzle' ? (
        <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          <span className="text-fg-muted">Undos</span>{' '}
          <span data-testid="undos" className="font-bold text-accent">
            {state?.undosLeft ?? 0}
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          <span className="text-fg-muted">Level</span>{' '}
          <span data-testid="level" className="font-bold text-accent">
            {state?.level ?? 1}
          </span>
        </div>
      )}
      {mode === 'puzzle' && (
        <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          <span className="text-fg-muted">Daily</span>{' '}
          <span data-testid="daily-date" className="font-bold text-accent">
            {todayISO().slice(5)}
          </span>
        </div>
      )}
      {modeToggle}
      <GameButton
        onClick={doUndo}
        variant="ghost"
        disabled={!state || state.undosLeft === 0 || state.history.length === 0 || mode === 'endless'}
      >
        Undo ({state?.undosLeft ?? 0})
      </GameButton>
    </>
  )

  if (!state) {
    return (
      <GameShell
        stats={stats}
        headerExtra={headerExtra}
        onNewGame={newRun}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="splice-loading" />
      </GameShell>
    )
  }

  const { board } = state
  const legal = legalEdges(state)
  const cursorEdge = legal[edgeCursor]
  const won = state.won
  const lost = state.lost

  // Ghost of the recorded best daily line (faint dashed overlay).
  const ghostEdges = mode === 'puzzle' && dailyRecord ? dailyRecord.bestSolution : []

  return (
    <GameShell
      stats={stats}
      headerExtra={headerExtra}
      onNewGame={newRun}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{`
        @keyframes sp-collapse {
          0% { transform: scale(1); opacity: 1; }
          55% { transform: scale(1.45); opacity: 1; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes sp-cut {
          0% { opacity: 0.9; }
          100% { opacity: 0; }
        }
        @keyframes sp-pulse {
          0% { box-shadow: 0 0 0 0 rgba(56,220,255,0.0); }
          40% { box-shadow: 0 0 0 6px rgba(56,220,255,0.35), 0 0 28px rgba(56,220,255,0.5); }
          100% { box-shadow: 0 0 0 0 rgba(56,220,255,0.0); }
        }
        @keyframes sp-banner {
          0% { transform: scale(0.6); opacity: 0; }
          30% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes sp-edge {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Preview read-out */}
      <div className="mb-2 flex h-6 items-center justify-center gap-3 text-sm" aria-live="polite">
        {preview && preview.legal && (preview.collapsed.length > 0 || preview.disconnected) && (
          <span data-testid="preview-badge" className="font-semibold text-fg-muted">
            {preview.collapsed.length > 0 ? (
              <span className="text-neon-green">
                {preview.collapsed.length} pop · +{preview.scoreDelta}
              </span>
            ) : (
              <span>splits {preview.sideA.length + preview.sideB.length} nodes</span>
            )}
            {preview.collapsed.length >= 2 && (
              <span className="ml-2 text-accent">cascade ×{preview.collapsed.length}</span>
            )}
          </span>
        )}
      </div>

      <div className="relative rounded-xl bg-surface p-3">
        <div
          key={pulseKey}
          className="relative aspect-square w-full rounded-lg"
          style={
            banner && !reducedRef.current ? { animation: 'sp-pulse 600ms ease-out' } : undefined
          }
        >
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full touch-manipulation focus-visible:outline-none"
            data-testid="splice-board"
            role="application"
            aria-label="Splice network"
            tabIndex={0}
            onKeyDown={onBoardKeyDown}
          >
            {/* Ghost best line (faint dashed) */}
            {ghostEdges.map((eid) => {
              const e = board.edges[eid]
              if (!e) return null
              const p1 = board.layout[e.a]
              const p2 = board.layout[e.b]
              return (
                <line
                  key={`ghost-${eid}`}
                  x1={proj(p1.x)}
                  y1={proj(p1.y)}
                  x2={proj(p2.x)}
                  y2={proj(p2.y)}
                  stroke="var(--accent, hsl(190 90% 55%))"
                  strokeWidth={0.7}
                  strokeDasharray="1.5 1.5"
                  opacity={0.28}
                />
              )
            })}

            {/* Visible edges */}
            {board.edges.map((e, i) => {
              if (state.cutEdges[i]) return null
              if (!state.alive[e.a] || !state.alive[e.b]) return null
              const p1 = board.layout[e.a]
              const p2 = board.layout[e.b]
              const isCursor = i === cursorEdge
              return (
                <line
                  key={`edge-${i}`}
                  x1={proj(p1.x)}
                  y1={proj(p1.y)}
                  x2={proj(p2.x)}
                  y2={proj(p2.y)}
                  stroke={isCursor ? 'var(--accent, hsl(190 90% 55%))' : 'rgba(190,200,230,0.35)'}
                  strokeWidth={isCursor ? 1.6 : 0.9}
                  strokeLinecap="round"
                  style={
                    isCursor && !reducedRef.current
                      ? { animation: 'sp-edge 1.3s ease-in-out infinite' }
                      : undefined
                  }
                />
              )
            })}

            {/* Transparent wide hitboxes (one per edge, forgiving mobile taps) */}
            {board.edges.map((e, i) => {
              const cutHere = state.cutEdges[i] || !state.alive[e.a] || !state.alive[e.b]
              const p1 = board.layout[e.a]
              const p2 = board.layout[e.b]
              return (
                <line
                  key={`hit-${i}`}
                  ref={(el) => {
                    edgeElRef.current[i] = el
                  }}
                  data-testid="splice-edge"
                  data-edge-id={i}
                  data-cut={cutHere}
                  data-a={e.a}
                  data-b={e.b}
                  x1={proj(p1.x)}
                  y1={proj(p1.y)}
                  x2={proj(p2.x)}
                  y2={proj(p2.y)}
                  stroke="transparent"
                  strokeWidth={8}
                  strokeLinecap="round"
                  style={{ cursor: cutHere ? 'default' : 'pointer', pointerEvents: cutHere ? 'none' : 'stroke' }}
                  tabIndex={-1}
                  aria-label={`Cut edge between node ${e.a} and node ${e.b}`}
                  onMouseEnter={() => {
                    if (cutHere) return
                    const legalNow = legalEdges(state)
                    const idx = legalNow.indexOf(i)
                    if (idx >= 0) {
                      setEdgeCursor(idx)
                      setPreview(previewCut(state, i))
                    }
                  }}
                  onMouseLeave={() => setPreview(null)}
                  onClick={() => {
                    if (!cutHere) commitCut(i)
                  }}
                />
              )
            })}

            {/* Nodes */}
            {board.colors.map((color, i) => {
              if (!state.alive[i]) return null
              const p = board.layout[i]
              const cx = proj(p.x)
              const cy = proj(p.y)
              const inA = sideASet.has(i)
              const inB = sideBSet.has(i)
              const willCollapse = collapseSet.has(i)
              const fill = NODE_COLORS[color % NODE_COLORS.length]
              return (
                <g key={`node-${i}`} data-testid="splice-node" data-node-id={i} data-color={color} data-alive="true">
                  {willCollapse && (
                    <circle cx={cx} cy={cy} r={7} fill="none" stroke="var(--neon-green, #4ade80)" strokeWidth={0.8} opacity={0.9}>
                      {!reducedRef.current && (
                        <animate attributeName="r" values="5;8;5" dur="0.9s" repeatCount="indefinite" />
                      )}
                    </circle>
                  )}
                  {inA && !willCollapse && (
                    <circle cx={cx} cy={cy} r={6.4} fill="none" stroke="var(--accent, hsl(190 90% 55%))" strokeWidth={0.9} opacity={0.85} />
                  )}
                  {inB && !willCollapse && (
                    <circle cx={cx} cy={cy} r={6.4} fill="none" stroke="hsl(330 85% 62%)" strokeWidth={0.9} opacity={0.85} />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4.6}
                    fill={fill}
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={0.5}
                    style={{ filter: `drop-shadow(0 0 2px ${fill})` }}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={3.4}
                    fontWeight={800}
                    fill="rgba(0,0,0,0.75)"
                    aria-hidden="true"
                  >
                    {NODE_GLYPHS[color % NODE_GLYPHS.length]}
                  </text>
                </g>
              )
            })}

            {/* Collapse point labels (+size²) */}
            {preview &&
              preview.legal &&
              preview.collapsed.map((ev, k) => {
                let sx = 0
                let sy = 0
                for (const nd of ev.nodes) {
                  sx += board.layout[nd].x
                  sy += board.layout[nd].y
                }
                const cx = proj(sx / ev.nodes.length)
                const cy = proj(sy / ev.nodes.length)
                return (
                  <text
                    key={`pts-${k}`}
                    x={cx}
                    y={cy - 8}
                    textAnchor="middle"
                    fontSize={5}
                    fontWeight={900}
                    fill="var(--neon-green, #4ade80)"
                    aria-hidden="true"
                  >
                    +{ev.points}
                  </text>
                )
              })}
          </svg>

          {/* Cascade banner */}
          {banner && !reducedRef.current && (
            <div
              key={banner.key}
              aria-live="polite"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span
                data-testid="cascade-banner"
                className="neon-text font-extrabold text-accent"
                style={{
                  fontSize: `${1.4 + banner.n * 0.4}rem`,
                  animation: 'sp-banner 900ms ease-out forwards',
                }}
              >
                cascade ×{banner.n}
              </span>
            </div>
          )}
        </div>

        <GameOverlay
          show={won || lost}
          variant={won ? 'win' : 'lose'}
          title={won ? 'Spliced!' : 'Out of cuts'}
          testId="game-over"
        >
          {won ? (
            <>
              <p className="text-sm text-fg-muted">
                Cleared in <span className="font-bold text-accent">{state.cutsUsed}</span> / {state.par}
                <span className="ml-1">{'⭐'.repeat(starTier)}</span>
              </p>
              <p className="text-sm text-fg-muted">
                {parDelta === 0
                  ? 'On par'
                  : parDelta < 0
                    ? `${parDelta} under par`
                    : `+${parDelta} over par`}
              </p>
              <p className="text-sm text-fg-muted">
                Score <span className="font-bold text-accent">{state.score}</span>
              </p>
              {mode === 'endless' ? (
                <GameButton onClick={advance} className="px-4 py-2">
                  Next network
                </GameButton>
              ) : (
                <GameButton onClick={newRun} className="px-4 py-2">
                  Replay daily
                </GameButton>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-fg-muted">
                Score <span className="font-bold text-accent">{state.score}</span>
              </p>
              <p className="text-sm text-fg-muted">
                <span className="font-bold text-neon-red">{state ? state.alive.filter(Boolean).length : 0}</span> fragments left
              </p>
              <div className="flex gap-2">
                <GameButton onClick={retryBoard} variant="ghost" className="px-4 py-2">
                  Retry board
                </GameButton>
                <GameButton onClick={newRun} className="px-4 py-2">
                  New Game
                </GameButton>
              </div>
            </>
          )}
        </GameOverlay>
      </div>
    </GameShell>
  )
}
