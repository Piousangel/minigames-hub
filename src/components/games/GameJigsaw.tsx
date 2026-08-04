'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Artwork,
  type Edges,
  type State,
  DIFFICULTIES,
  artworkFor,
  correctCellFor,
  createGame,
  edgesFor,
  placePiece,
  remaining,
  score as scoreOf,
  shuffle,
} from '@/lib/games/jigsaw/engine'
import { mulberry32 } from '@/lib/games/jigsaw/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { recordResult } from '@/lib/gameStats'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// -- geometry ----------------------------------------------------------------

const L = 100 // logical cell size (per-piece unit)
const MARGIN = 28 // room for tabs sticking out (tab height ≈ 0.26*L)
const R = L * 0.15 // knob radius
const HALF_CHORD = L * 0.1 // neck half-width
const H = Math.sqrt(R * R - HALF_CHORD * HALF_CHORD) // centre offset from chord

type Pt = [number, number]

/** Cubic-bezier approximation of a circular arc from a0→a1 (any span). */
function arcBeziers(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const span = a1 - a0
  const segs = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 2)))
  const step = span / segs
  let d = ''
  for (let i = 0; i < segs; i++) {
    const t0 = a0 + step * i
    const t1 = t0 + step
    const k = (4 / 3) * Math.tan((t1 - t0) / 4)
    const p0: Pt = [cx + r * Math.cos(t0), cy + r * Math.sin(t0)]
    const p3: Pt = [cx + r * Math.cos(t1), cy + r * Math.sin(t1)]
    const c1: Pt = [p0[0] - k * r * Math.sin(t0), p0[1] + k * r * Math.cos(t0)]
    const c2: Pt = [p3[0] + k * r * Math.sin(t1), p3[1] - k * r * Math.cos(t1)]
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p3[0].toFixed(2)} ${p3[1].toFixed(2)}`
  }
  return d
}

/** One edge from p0→p1 with outward unit normal `nrm`; sign ∈ {-1,0,1}. */
function edgeSegment(p0: Pt, p1: Pt, nrm: Pt, sign: number): string {
  if (sign === 0) return ` L ${p1[0]} ${p1[1]}`
  const tx = (p1[0] - p0[0]) / L
  const ty = (p1[1] - p0[1]) / L
  const n1: Pt = [p0[0] + tx * 0.4 * L, p0[1] + ty * 0.4 * L]
  const n2: Pt = [p0[0] + tx * 0.6 * L, p0[1] + ty * 0.6 * L]
  const mid: Pt = [p0[0] + tx * 0.5 * L, p0[1] + ty * 0.5 * L]
  // Knob bulges toward outward normal * sign; centre sits on that side.
  const cx = mid[0] + nrm[0] * sign * H
  const cy = mid[1] + nrm[1] * sign * H
  const a1 = Math.atan2(n1[1] - cy, n1[0] - cx)
  let a2 = Math.atan2(n2[1] - cy, n2[0] - cx)
  // Take the MAJOR arc (>180°) so the knob overhangs the neck.
  let span = a2 - a1
  while (span <= Math.PI) span += 2 * Math.PI
  while (span > 3 * Math.PI) span -= 2 * Math.PI
  a2 = a1 + span
  return ` L ${n1[0].toFixed(2)} ${n1[1].toFixed(2)}${arcBeziers(cx, cy, R, a1, a2)} L ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`
}

/** Full closed outline for a piece with the given edges, in local 0..L coords. */
function piecePath(e: Edges): string {
  const tl: Pt = [0, 0]
  const tr: Pt = [L, 0]
  const br: Pt = [L, L]
  const bl: Pt = [0, L]
  let d = `M ${tl[0]} ${tl[1]}`
  d += edgeSegment(tl, tr, [0, -1], e.top) // top, outward up
  d += edgeSegment(tr, br, [1, 0], e.right) // right, outward right
  d += edgeSegment(br, bl, [0, 1], e.bottom) // bottom, outward down
  d += edgeSegment(bl, tl, [-1, 0], e.left) // left, outward left
  d += ' Z'
  return d
}

// -- artwork rendering (deterministic neon composition) ----------------------

function ArtworkContent({ art, w, uid }: { art: Artwork; w: number; uid: string }) {
  const gid = `jig-grad-${uid}`
  const stops = art.bg
  const last = Math.max(1, stops.length - 1)
  return (
    <>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          {stops.map((c, i) => (
            <stop key={i} offset={`${(i / last) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={w} fill={`url(#${gid})`} />
      {art.shapes.map((s, i) => {
        const key = `s${i}`
        if (s.kind === 'circle') {
          return <circle key={key} cx={s.cx * w} cy={s.cy * w} r={s.r * w} fill={s.color} opacity={s.opacity} />
        }
        if (s.kind === 'ring') {
          return (
            <circle
              key={key}
              cx={s.cx * w}
              cy={s.cy * w}
              r={s.r * w}
              fill="none"
              stroke={s.color}
              strokeWidth={Math.max(1, s.sw * w)}
              opacity={s.opacity}
            />
          )
        }
        if (s.kind === 'triangle') {
          const cx = s.cx * w
          const cy = s.cy * w
          const rr = s.r * w
          const pts = [
            [cx, cy - rr],
            [cx + rr * 0.87, cy + rr * 0.5],
            [cx - rr * 0.87, cy + rr * 0.5],
          ]
            .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
            .join(' ')
          return <polygon key={key} points={pts} fill={s.color} opacity={s.opacity} />
        }
        // rect (buildings, horizons, starburst rays)
        const x = s.x * w
        const y = s.y * w
        const rw = s.w * w
        const rh = s.h * w
        const cxc = x + rw / 2
        const cyc = y + rh / 2
        return (
          <rect
            key={key}
            x={x}
            y={y}
            width={rw}
            height={rh}
            rx={(s.round ?? 0) * w}
            fill={s.color}
            opacity={s.opacity}
            transform={s.rot ? `rotate(${s.rot} ${cxc} ${cyc})` : undefined}
          />
        )
      })}
    </>
  )
}

/** A single jigsaw piece showing its slice of the artwork, clipped to its edges. */
function PieceArt({
  art,
  edges,
  row,
  col,
  n,
  uid,
  strong,
}: {
  art: Artwork
  edges: Edges
  row: number
  col: number
  n: number
  uid: string
  strong?: boolean
}) {
  const path = useMemo(() => piecePath(edges), [edges])
  const clipId = `jig-clip-${uid}`
  const w = n * L
  return (
    <svg
      viewBox={`${-MARGIN} ${-MARGIN} ${L + 2 * MARGIN} ${L + 2 * MARGIN}`}
      className="h-full w-full"
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(${-col * L} ${-row * L})`}>
          <ArtworkContent art={art} w={w} uid={uid} />
        </g>
      </g>
      {/* Clean beveled tile edge (dark base + light inner) so pieces read as
          interlocking glass tiles over the picture — no rainbow noise. */}
      <path d={path} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={strong ? 4.5 : 3.5} strokeLinejoin="round" />
      <path
        d={path}
        fill="none"
        stroke={strong ? 'var(--neon-amber)' : 'rgba(255,255,255,0.6)'}
        strokeWidth={strong ? 2.6 : 1.4}
        strokeLinejoin="round"
      />
    </svg>
  )
}

// -- component ---------------------------------------------------------------

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

export function GameJigsaw({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<State | null>(null)
  const [n, setN] = useState<number>(3)
  const [sel, setSel] = useState<number | null>(null) // selected tray pieceId
  const [preview, setPreview] = useState(false)
  const [best, setBest] = useState(0)
  const [solved, setSolved] = useState(0) // puzzles completed on this device
  const [flash, setFlash] = useState<{ row: number; col: number; k: number } | null>(null) // snap pulse
  const flashK = useRef(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const nRef = useRef(3)
  const wonRef = useRef(false)
  const slug = storageKey.replace(/^best:/, '')

  const commit = useCallback((next: State) => {
    stateRef.current = next
    setState(next)
  }, [])

  const startNew = useCallback(
    (size: number) => {
      wonRef.current = false
      nRef.current = size
      setN(size)
      setSel(null)
      setFlash(null)
      commit(createGame(freshSeed(), size))
    },
    [commit],
  )

  const solvedKey = `${slug}:solved`

  // Bootstrap on the client only (SSR-safe: no random/Date in render).
  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0)
    const sv = Number(localStorage.getItem(solvedKey))
    setSolved(Number.isFinite(sv) && sv > 0 ? Math.floor(sv) : 0)
    startNew(3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persistWin = useCallback(
    (next: State) => {
      const s = scoreOf(next)
      const stored = Number(localStorage.getItem(storageKey))
      const prev = Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
      if (s > prev) {
        try {
          localStorage.setItem(storageKey, String(s)) // PLAIN NUMBER for leaderboard
        } catch {
          /* storage unavailable */
        }
        setBest(s)
      }
      // Solved count — a stat that's always meaningful (never "Best 0 / Score 100").
      setSolved((prevSolved) => {
        const nextSolved = prevSolved + 1
        try {
          localStorage.setItem(solvedKey, String(nextSolved))
        } catch {
          /* storage unavailable */
        }
        return nextSolved
      })
      recordResult(slug, { won: true })
    },
    [storageKey, slug, solvedKey],
  )

  // Try to place the selected (or given) piece onto (row,col).
  const tryPlace = useCallback(
    (pieceId: number, row: number, col: number) => {
      const cur = stateRef.current
      if (!cur) return
      const next = placePiece(cur, pieceId, row, col)
      if (next === cur) {
        play('error') // gentle no-op (wrong cell / occupied)
        return
      }
      commit(next)
      setSel(null)
      // Snap pulse on the cell that just locked in — makes placement feel solid.
      flashK.current += 1
      setFlash({ row, col, k: flashK.current })
      if (next.status === 'won' && !wonRef.current) {
        wonRef.current = true
        play('win')
        persistWin(next)
      } else {
        play('match')
      }
    },
    [commit, play, persistWin],
  )

  const onTrayPiece = useCallback(
    (pieceId: number) => {
      setSel((cur) => {
        if (cur === pieceId) return null // tap again → deselect
        play('flip')
        return pieceId
      })
    },
    [play],
  )

  const onCell = useCallback(
    (row: number, col: number) => {
      const cur = stateRef.current
      if (!cur) return
      if (cur.board[row][col] !== null) return // already filled
      if (sel === null) return
      tryPlace(sel, row, col)
    },
    [sel, tryPlace],
  )

  // Desktop drag-and-drop (tap-to-place is the primary path).
  const onDropCell = useCallback(
    (row: number, col: number, e: React.DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData('text/plain')
      const id = Number(raw)
      if (Number.isInteger(id)) tryPlace(id, row, col)
    },
    [tryPlace],
  )

  const shuffleTray = useCallback(() => {
    const cur = stateRef.current
    if (!cur) return
    const tray = shuffle(cur.tray, mulberry32(freshSeed()))
    commit({ ...cur, tray })
    play('flip')
  }, [commit, play])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault()
          startNew(nRef.current)
          break
        case 'p':
        case 'P':
          e.preventDefault()
          setPreview((v) => !v)
          break
        case 'Escape':
          e.preventDefault()
          setSel(null)
          break
      }
    },
    [startNew],
  )

  // Clear the snap pulse shortly after it fires (one-shot).
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash((cur) => (cur && cur.k === flash.k ? null : cur)), 480)
    return () => clearTimeout(t)
  }, [flash])

  // Artwork is derived deterministically from the seed + variant.
  const art = useMemo<Artwork | null>(
    () => (state ? artworkFor(state.seed, state.variant) : null),
    [state],
  )

  if (!state || !art) {
    return (
      <div className="mx-auto w-full max-w-120 select-none">
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="jigsaw-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.status === 'won'
  const score = scoreOf(state)
  const total = state.n * state.n
  const left = remaining(state)
  const selCell = sel !== null ? correctCellFor(state, sel) : null

  const hint = won
    ? 'Solved! The picture is complete.'
    : sel !== null
      ? 'Now tap the highlighted cell to drop the piece in.'
      : 'Tap a tray piece to pick it up — its home cell lights up. Tap that cell to place it.'

  const headerExtra = (
    <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
      <span className="text-fg-muted">Pieces</span>{' '}
      <span className="font-bold text-accent" data-testid="placed">
        {state.placedCount}/{total}
      </span>
    </span>
  )

  return (
    <GameShell
      stats={[
        { label: 'Solved', value: solved, testId: 'solved' },
        { label: 'Best', value: Math.max(best, won ? score : 0), testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={() => startNew(nRef.current)}
      newGameLabel="New puzzle"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-120"
    >
      <div
        role="group"
        aria-label="Jigsaw board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-3"
        data-testid="jigsaw-board"
      >
        {/* Difficulty selector */}
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-border">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => startNew(d)}
                aria-pressed={n === d}
                data-testid="difficulty"
                className={`px-3 py-1.5 text-sm font-semibold ${
                  n === d ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'
                }`}
              >
                {d}×{d}
              </button>
            ))}
          </div>
          <GameButton variant="ghost" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>
            {preview ? 'Hide preview' : 'Show preview'}
          </GameButton>
          <GameButton variant="ghost" onClick={shuffleTray}>
            Shuffle tray
          </GameButton>
        </div>

        {/* Board */}
        <div
          className="relative mx-auto w-full max-w-100 rounded-lg border border-border bg-bg-2/40 p-1"
          data-testid="jigsaw-grid"
        >
          {/* Always-on picture guide behind the cells: you can see the target
              image, and each placed piece visibly completes it (the "fitting"
              feel). Faint while playing, brighter with Show preview / on win. */}
          <svg
            viewBox={`0 0 ${state.n * L} ${state.n * L}`}
            className="pointer-events-none absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] rounded"
            style={{ opacity: won ? 0.95 : preview ? 0.42 : 0.16 }}
            aria-hidden="true"
          >
            <ArtworkContent art={art} w={state.n * L} uid="guide" />
          </svg>
          <div
            className="grid gap-0"
            style={{ gridTemplateColumns: `repeat(${state.n}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: state.n * state.n }, (_, idx) => {
              const row = Math.floor(idx / state.n)
              const col = idx % state.n
              const pieceId = state.board[row][col]
              const isTarget = selCell?.row === row && selCell?.col === col
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onCell(row, col)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropCell(row, col, e)}
                  data-testid="cell"
                  data-row={row}
                  data-col={col}
                  data-filled={pieceId !== null}
                  aria-label={
                    pieceId !== null
                      ? `Piece placed at row ${row + 1}, column ${col + 1}`
                      : `Empty cell row ${row + 1}, column ${col + 1}`
                  }
                  className={`relative aspect-square outline-none ${
                    pieceId === null ? 'rounded-[2px] border border-white/12 bg-white/[0.02]' : ''
                  }`}
                  style={
                    isTarget
                      ? { boxShadow: 'inset 0 0 0 3px var(--neon-amber), 0 0 12px var(--neon-amber)', borderRadius: 4 }
                      : undefined
                  }
                >
                  {pieceId !== null && (
                    <span className="pointer-events-none absolute inset-0" style={{ zIndex: row + 1 }}>
                      <PieceArt
                        art={art}
                        edges={edgesFor(row, col, state.seed, state.n)}
                        row={row}
                        col={col}
                        n={state.n}
                        uid={`b-${pieceId}`}
                      />
                    </span>
                  )}
                  {/* Snap pulse — a quick amber ring on the cell that just locked. */}
                  {flash?.row === row && flash.col === col && !reduced && (
                    <span
                      key={flash.k}
                      className="pointer-events-none absolute inset-0 animate-ping rounded ring-2 ring-neon-amber"
                      style={{ zIndex: state.n + 2 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tray */}
        <div className="mt-3">
          <p className="mb-1 text-center text-xs text-fg-muted">
            {left > 0 ? `${left} piece${left === 1 ? '' : 's'} to place` : 'All pieces placed!'}
          </p>
          <div
            className="flex flex-wrap items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-2/30 p-2"
            data-testid="jigsaw-tray"
          >
            {state.tray.map((pieceId) => {
              const cell = correctCellFor(state, pieceId)!
              const selected = sel === pieceId
              return (
                <button
                  key={pieceId}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(pieceId))
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onClick={() => onTrayPiece(pieceId)}
                  data-testid="tray-piece"
                  data-piece={pieceId}
                  data-selected={selected}
                  aria-label={`Tray piece ${pieceId + 1}${selected ? ', selected' : ''}`}
                  className="h-11 w-11 rounded outline-none focus-visible:ring-2 focus-visible:ring-accent sm:h-12 sm:w-12"
                  style={{
                    transform: selected && !reduced ? 'translateY(-3px) scale(1.06)' : undefined,
                    boxShadow: selected ? '0 0 0 2px var(--neon-amber)' : undefined,
                    transition: reduced ? undefined : 'transform .12s ease, box-shadow .12s ease',
                  }}
                >
                  <PieceArt
                    art={art}
                    edges={edgesFor(cell.row, cell.col, state.seed, state.n)}
                    row={cell.row}
                    col={cell.col}
                    n={state.n}
                    uid={`t-${pieceId}`}
                    strong={selected}
                  />
                </button>
              )
            })}
            {state.tray.length === 0 && (
              <span className="py-3 text-sm text-fg-muted">Tray empty — nice work.</span>
            )}
          </div>
        </div>

        <GameOverlay show={won} variant="win" title="Puzzle solved!" testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              {total} pieces · {state.n}×{state.n}
            </p>
            <p>
              Moves <span className="font-bold text-accent">{state.moves}</span>
            </p>
            <p>
              Score <span className="font-bold text-accent">{score}</span> · Best{' '}
              <span className="font-bold text-accent">{Math.max(best, score)}</span>
            </p>
          </div>
          <GameButton onClick={() => startNew(state.n)}>New puzzle</GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
