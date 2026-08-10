'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  type State,
  type Tile,
  LAYOUT,
  availableMatches,
  createGame,
  freeTiles as freeTilesOf,
  hasMove,
  score as scoreOf,
  select as selectMove,
  shuffle as shuffleMove,
  mulberry32,
} from '@/lib/games/mahjong/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { recordResult } from '@/lib/gameStats'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// -- tile presentation -------------------------------------------------------
// No Mahjong Unicode block (🀇 etc.) — those glyphs are unreliable and break the
// OG font. Each face is composed here from an ASCII/CJK/emoji label + colour, so
// identical tiles render identically and different tiles differ.

const WIND = ['E', 'S', 'W', 'N']
const DRAGON = ['中', '發', '白']
const DRAGON_COLOR = ['#e11d48', '#059669', '#334155']

interface Face {
  main: string
  sub?: string
  color: string
}

function faceOf(tile: Tile): Face {
  switch (tile.kind) {
    case 'dot':
      return { main: String(tile.value), sub: '●', color: '#0e7490' }
    case 'bam':
      return { main: String(tile.value), sub: '‖', color: '#047857' }
    case 'char':
      return { main: String(tile.value), sub: '萬', color: '#b45309' }
    case 'wind':
      return { main: WIND[tile.value] ?? '?', color: '#6d28d9' }
    case 'dragon':
      return { main: DRAGON[tile.value] ?? '?', color: DRAGON_COLOR[tile.value] ?? '#334155' }
    case 'flower':
      return { main: '🌸', color: '#db2777' }
    case 'season':
      return { main: '🍁', color: '#c2410c' }
  }
}

// -- board geometry (half-tile grid → px) ------------------------------------

const CELL_W = 15
const CELL_H = 19
const LIFT_X = 3 // upper layers shift up-left for a 3-D look
const LIFT_Y = 4
const TILE_W = 2 * CELL_W - 2
const TILE_H = 2 * CELL_H - 2

const MAX_X = Math.max(...LAYOUT.map((s) => s.x))
const MAX_Y = Math.max(...LAYOUT.map((s) => s.y))
const MAX_Z = Math.max(...LAYOUT.map((s) => s.z))
const BOARD_W = (MAX_X + 2) * CELL_W + MAX_Z * LIFT_X
const BOARD_H = (MAX_Y + 2) * CELL_H + MAX_Z * LIFT_Y

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TileFace({
  tile,
  free,
  selected,
  hinted,
  reduced,
}: {
  tile: Tile
  free: boolean
  selected: boolean
  hinted: boolean
  reduced: boolean
}) {
  const f = faceOf(tile)
  const ring = selected
    ? '0 0 0 2px var(--neon-amber), 0 4px 10px rgba(0,0,0,0.5)'
    : hinted
      ? '0 0 0 2px var(--neon-cyan)'
      : '0 1px 2px rgba(0,0,0,0.45)'
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center rounded-[0.3rem] border font-extrabold leading-none"
      style={{
        background: free ? '#f4f5fb' : '#b9bccb',
        borderColor: 'rgba(0,0,0,0.3)',
        color: f.color,
        opacity: free ? 1 : 0.85,
        boxShadow: ring,
        transform: selected && !reduced ? 'translateY(-2px)' : undefined,
      }}
    >
      <span className="text-[0.85rem] sm:text-base">{f.main}</span>
      {f.sub && <span className="text-[0.6rem] leading-none opacity-80">{f.sub}</span>}
    </div>
  )
}

export function GameMahjong({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<State | null>(null)
  const [history, setHistory] = useState<State[]>([])
  const [best, setBest] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [hint, setHint] = useState<[number, number] | null>(null)
  const [scale, setScale] = useState(1)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const prevOverRef = useRef(false)
  const startRef = useRef(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const slug = storageKey.replace(/^best:/, '')

  // 좁은 화면(모바일)에서 보드를 통째로 축소 — 좌표계·클릭 핸들러는 그대로 두고
  // 시각적으로만 scale한다. overflow-x-auto는 그 아래(<340px)로 밀릴 때의 폴백.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    // el은 p-2(8px) 패딩을 가진 컨테이너라 clientWidth엔 패딩이 포함된다 — 콘텐츠 폭 기준으로 빼준다.
    const WRAP_PAD_X = 16
    const measure = () =>
      setScale(Math.max(0.6, Math.min(1, (el.clientWidth - WRAP_PAD_X) / BOARD_W)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [state !== null])

  const commit = useCallback((next: State) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Bootstrap on the client only (never Date/random in render).
  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0)
    prevOverRef.current = false
    startRef.current = Date.now()
    setHistory([])
    setHint(null)
    setElapsed(0)
    commit(createGame(freshSeed()))
  }, [storageKey, commit])

  // Display-only timer (component-owned; NOT part of the pure engine).
  useEffect(() => {
    if (!state || state.status !== 'playing') return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [state])

  const persistBest = useCallback(
    (next: State) => {
      const s = scoreOf(next)
      const stored = Number(localStorage.getItem(storageKey))
      const prev = Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0
      if (s > prev) {
        try {
          localStorage.setItem(storageKey, String(s)) // PLAIN number — leaderboard reads Number()
        } catch {
          /* storage unavailable */
        }
        setBest(s)
      }
    },
    [storageKey],
  )

  /** Apply a computed next-state. Same ref ⇒ illegal ⇒ error cue. */
  const apply = useCallback(
    (next: State, cue?: 'shuffle'): boolean => {
      const prev = stateRef.current
      if (!prev) return false
      if (next === prev) {
        play('error')
        return false
      }
      setHistory((h) => [...h, prev])
      setHint(null)
      commit(next)

      const over = next.status === 'won' || next.status === 'lost'
      if (over && !prevOverRef.current) {
        prevOverRef.current = true
        if (next.status === 'won') {
          play('win')
        } else {
          play('lose')
        }
        persistBest(next)
        recordResult(slug, { won: next.status === 'won' })
        return true
      }
      if (cue === 'shuffle') play('flip')
      else if (next.removed > prev.removed) play('match')
      else play('flip') // selection change / deselect
      return true
    },
    [commit, play, persistBest, slug],
  )

  const newDeal = useCallback(() => {
    prevOverRef.current = false
    startRef.current = Date.now()
    setHistory([])
    setHint(null)
    setElapsed(0)
    commit(createGame(freshSeed()))
  }, [commit])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      commit(prev)
      prevOverRef.current = prev.status === 'won' || prev.status === 'lost'
      setHint(null)
      play('flip')
      return h.slice(0, -1)
    })
  }, [commit, play])

  const onTile = useCallback(
    (i: number) => {
      const s = stateRef.current
      if (!s) return
      apply(selectMove(s, i))
    },
    [apply],
  )

  const doHint = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const matches = availableMatches(s)
    if (matches.length === 0) {
      play('error')
      return
    }
    setHint(matches[0])
    play('move')
  }, [play])

  const doShuffle = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    apply(shuffleMove(s, mulberry32(freshSeed())), 'shuffle')
  }, [apply])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      switch (e.key) {
        case 'n':
        case 'N':
          e.preventDefault()
          newDeal()
          break
        case 'u':
        case 'U':
          e.preventDefault()
          undo()
          break
        case 'h':
        case 'H':
          e.preventDefault()
          doHint()
          break
        case 'Escape': {
          e.preventDefault()
          const s = stateRef.current
          if (s && s.selected !== null) apply(selectMove(s, s.selected)) // deselect
          break
        }
      }
    },
    [newDeal, undo, doHint, apply],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-140 select-none">
        <div className="h-72 rounded-xl bg-surface" data-testid="mahjong-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.status === 'won'
  const lost = state.status === 'lost'
  const scoreVal = scoreOf(state)
  const free = new Set(freeTilesOf(state))
  const tilesLeft = state.tiles.reduce((n, t) => n + (t ? 1 : 0), 0)
  const stuck = !won && !lost && !hasMove(state)
  const hintSet = hint ? new Set(hint) : null

  const hintLine = won
    ? 'Board cleared — every tile is home!'
    : lost
      ? 'No matches left and no shuffles remaining.'
      : stuck
        ? 'No free matching pair — shuffle to rescue the board.'
        : 'Tap a free (bright) tile, then its matching free tile to clear the pair. Blocked tiles are dimmed.'

  return (
    <GameShell
      stats={[
        { label: 'Score', value: scoreVal, testId: 'score' },
        { label: 'Best', value: best, testId: 'best' },
        { label: 'Left', value: tilesLeft, testId: 'tiles-left' },
        { label: 'Moves', value: state.moves, testId: 'moves' },
        { label: 'Time', value: fmtTime(elapsed), testId: 'time' },
      ]}
      onNewGame={newDeal}
      newGameLabel="New deal"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hintLine}
      maxWidthClassName="max-w-140"
    >
      <div
        ref={wrapRef}
        role="group"
        aria-label="Mahjong Solitaire board"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative overflow-x-auto rounded-xl bg-surface p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="mahjong-board"
      >
        <div className="relative mx-auto" style={{ width: BOARD_W * scale, height: BOARD_H * scale }}>
        <div
          className="relative"
          style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {LAYOUT.map((slot, i) => {
            const tile = state.tiles[i]
            if (!tile) return null
            const isFreeTile = free.has(i)
            const left = slot.x * CELL_W + (MAX_Z - slot.z) * LIFT_X
            const top = slot.y * CELL_H + (MAX_Z - slot.z) * LIFT_Y
            return (
              <button
                key={i}
                type="button"
                onClick={() => onTile(i)}
                aria-label={`${faceOf(tile).main} ${tile.kind}${isFreeTile ? ', free' : ', blocked'}`}
                data-testid="mahjong-tile"
                data-free={isFreeTile}
                data-selected={state.selected === i}
                className="absolute rounded-[0.3rem]"
                style={{
                  left,
                  top,
                  width: TILE_W,
                  height: TILE_H,
                  zIndex: slot.z * 1000 + i,
                }}
              >
                <TileFace
                  tile={tile}
                  free={isFreeTile}
                  selected={state.selected === i}
                  hinted={hintSet?.has(i) ?? false}
                  reduced={reduced}
                />
              </button>
            )
          })}
        </div>
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <GameButton variant="ghost" onClick={undo} disabled={history.length === 0}>
            Undo
          </GameButton>
          <GameButton variant="ghost" onClick={doHint} disabled={won || lost}>
            Hint
          </GameButton>
          <GameButton
            variant={stuck ? 'accent' : 'ghost'}
            onClick={doShuffle}
            disabled={won || lost || state.shufflesLeft <= 0}
          >
            Shuffle ({state.shufflesLeft})
          </GameButton>
        </div>

        {stuck && (
          <p className="mt-2 text-center text-sm text-neon-amber" data-testid="stuck-prompt">
            No moves — shuffle to keep playing.
          </p>
        )}

        <GameOverlay show={won || lost} variant={won ? 'win' : 'lose'} title={won ? 'Board cleared!' : 'No moves left'} testId="game-over">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{scoreVal}</span>
            </p>
            <p>
              Moves <span className="font-bold text-accent">{state.moves}</span> · Time{' '}
              <span className="font-bold text-accent">{fmtTime(elapsed)}</span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{Math.max(best, scoreVal)}</span>
            </p>
          </div>
          <GameButton onClick={newDeal}>New deal</GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
