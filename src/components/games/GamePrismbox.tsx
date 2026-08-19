'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  createGame,
  reduce,
  type Port,
  type PrismboxAction,
  type PrismboxEvent,
  type PrismboxState,
} from '@/lib/games/prismbox/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface PrismboxSave {
  score: number
  daily?: { lastDate: string; streak: number }
}

/** Daily streak lives in its own key -- best:<slug> must stay a bare number for the weekly board. */
const DAILY_KEY = 'prismbox:daily'

function loadDaily(): PrismboxSave['daily'] {
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (!raw) return undefined
    const o = JSON.parse(raw) as Record<string, unknown>
    if (typeof o?.lastDate === 'string' && typeof o?.streak === 'number') {
      return { lastDate: o.lastDate, streak: o.streak }
    }
  } catch {
    // corrupt -> no streak
  }
  return undefined
}

function loadSave(storageKey: string): PrismboxSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }
    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }
  } catch {
    // corrupt -> reset
  }
  return { score: 0 }
}

function saveAll(storageKey: string, save: PrismboxSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

const SOUND: Record<PrismboxEvent, SoundName | null> = {
  none: null,
  'fire-hit': 'match',
  'fire-reflect': 'flip',
  'fire-through': 'move',
  'fire-refract': 'merge',
  'already-found': 'flip',
  win: 'win',
}

const EVENT_LABEL: Record<PrismboxEvent, string | null> = {
  none: null,
  'fire-hit': 'Hit!',
  'fire-reflect': 'Reflect!',
  'fire-through': 'Through',
  'fire-refract': 'Refract!',
  'already-found': 'Already found',
  win: null, // the win overlay handles this moment
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

interface Badge {
  seq: number
  text: string
}

const CELL = 32 // px, one interior grid cell

/** Build the fixed-order port list: N(0..size-1), E(0..size-1), S(0..size-1), W(0..size-1). */
function buildPorts(size: number): Port[] {
  const ports: Port[] = []
  for (let lane = 0; lane < size; lane++) ports.push({ edge: 'N', lane })
  for (let lane = 0; lane < size; lane++) ports.push({ edge: 'E', lane })
  for (let lane = 0; lane < size; lane++) ports.push({ edge: 'S', lane })
  for (let lane = 0; lane < size; lane++) ports.push({ edge: 'W', lane })
  return ports
}

function portKey(p: Port): string {
  return `${p.edge}:${p.lane}`
}

/** 1-indexed CSS grid row/col for a port button in the (size+2)x(size+2) frame. */
function portGridPos(p: Port, size: number): { row: number; col: number } {
  switch (p.edge) {
    case 'N':
      return { row: 1, col: p.lane + 2 }
    case 'S':
      return { row: size + 2, col: p.lane + 2 }
    case 'W':
      return { row: p.lane + 2, col: 1 }
    case 'E':
      return { row: p.lane + 2, col: size + 2 }
  }
}

function portLabel(p: Port, size: number): string {
  const names: Record<Port['edge'], string> = { N: 'North', S: 'South', E: 'East', W: 'West' }
  return `${names[p.edge]} port, lane ${p.lane + 1} of ${size}`
}

const PATH_COLOR: Record<'through' | 'refract', string> = {
  through: 'var(--neon-blue)',
  refract: 'var(--neon-purple)',
}

export function GamePrismbox({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<PrismboxState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [focus, setFocus] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<PrismboxState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevWon = useRef(false)
  const badgeSeq = useRef(0)
  const portRefs = useRef<(HTMLButtonElement | null)[]>([])

  const commit = useCallback((next: PrismboxState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily))
    const g = createGame(DAILY_CONFIG, dailySeed(new Date()))
    prevWon.current = false
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty) => {
      modeRef.current = nextMode
      const g =
        nextMode === 'daily'
          ? createGame(DAILY_CONFIG, dailySeed(new Date()))
          : createGame(DIFFICULTIES[diff], freshSeed())
      prevWon.current = false
      setBadges([])
      setFocus(0)
      commit(g)
    },
    [commit],
  )

  const persistWin = useCallback(
    (next: PrismboxState) => {
      const save = loadSave(storageKey)
      let nextSave: PrismboxSave = { ...save, score: Math.max(save.score, next.score) }
      if (modeRef.current === 'daily') {
        const bumped = bumpStreak(save.daily)
        nextSave = { ...nextSave, daily: bumped }
        setStreak(bumped.streak)
      }
      setBest(nextSave.score)
      saveAll(storageKey, nextSave)
      recordResult(storageKey.replace(/^best:/, ''), { won: true })
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: PrismboxAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      const label = EVENT_LABEL[next.lastEvent]
      if (label) {
        const seq = ++badgeSeq.current
        setBadges((b) => [...b, { seq, text: label }])
      }
      if (next.won && !prevWon.current) persistWin(next)
      prevWon.current = next.won
    },
    [commit, play, persistWin],
  )

  const size = state?.config.size ?? DAILY_CONFIG.size
  const ports = useMemo(() => buildPorts(size), [size])

  // Keyboard: roving focus over the flat port list + activation + new game.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      const n = ports.length
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          setFocus((f) => (f + 1) % n)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          setFocus((f) => (f - 1 + n) % n)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          dispatch({ type: 'fire', entry: ports[focus] })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard(modeRef.current, difficulty)
          break
      }
    },
    [dispatch, focus, ports, difficulty, startBoard],
  )

  // Keep DOM focus in sync with the roving index.
  useEffect(() => {
    if (!state) return
    portRefs.current[focus]?.focus()
  }, [focus, state])

  const onNewGame = useCallback(() => {
    if (mode === 'daily') dispatch({ type: 'reset' })
    else startBoard('practice', difficulty)
  }, [mode, difficulty, dispatch, startBoard])

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m)
      startBoard(m, difficulty)
    },
    [difficulty, startBoard],
  )

  const switchDifficulty = useCallback(
    (d: Difficulty) => {
      setDifficulty(d)
      if (modeRef.current === 'practice') startBoard('practice', d)
    },
    [startBoard],
  )

  const firedPorts = useMemo(() => {
    if (!state) return new Set<string>()
    return new Set(state.shots.map((s) => portKey(s.entry)))
  }, [state])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-[36rem] select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="prismbox-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const won = state.won
  const foundCount = state.found.filter(Boolean).length
  const cols = size + 2

  const hint = won
    ? 'All atoms found!'
    : state.shots.length === 0
      ? 'Fire a beam from an edge port to begin.'
      : `${foundCount}/${state.config.atoms} atoms found — trace the refraction paths.`

  const headerExtra = (
    <>
      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          onClick={() => switchMode('daily')}
          aria-pressed={mode === 'daily'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${mode === 'daily' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Daily
        </button>
        <button
          onClick={() => switchMode('practice')}
          aria-pressed={mode === 'practice'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${mode === 'practice' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Practice
        </button>
      </div>
      {mode === 'daily' ? (
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Streak <span className="font-bold text-accent">{streak}</span>
        </span>
      ) : (
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => switchDifficulty(d)}
              aria-pressed={difficulty === d}
              className={`px-2.5 py-1.5 text-sm font-semibold capitalize ${difficulty === d ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </>
  )

  const lastShot = state.lastShot
  const lastShotIsFresh = lastShot != null && (lastShot.event === 'through' || lastShot.event === 'refract')

  return (
    <GameShell
      stats={[
        { label: 'Shots', value: state.shots.length, testId: 'shots' },
        { label: 'Found', value: foundCount },
        { label: 'Atoms', value: state.config.atoms },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={won ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Board'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-[36rem]"
    >
      <div
        role="group"
        aria-label="Prismbox board"
        onKeyDown={onKeyDown}
        className="relative overflow-x-auto rounded-xl bg-surface p-4"
        style={reduced ? undefined : { animation: 'px-board-in .3s ease-out both' }}
        data-testid="prismbox-board"
      >
        <div
          className="mx-auto"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
            gridTemplateRows: `repeat(${cols}, ${CELL}px)`,
            width: cols * CELL,
          }}
        >
          {/* Interior cells */}
          {Array.from({ length: size }, (_, r) =>
            Array.from({ length: size }, (_, c) => (
              <div
                key={`cell-${r}-${c}`}
                data-testid="cell"
                aria-hidden="true"
                className="border border-border/40"
                style={{ gridRow: r + 2, gridColumn: c + 2 }}
              />
            )),
          )}

          {/* Prior shots (all but the current one), dimmed -- a corkboard of accumulated clues. */}
          {state.shots.slice(0, -1).map((shot) =>
            shot.path.map((p, i) => (
              <div
                key={`old-${shot.seq}-${i}`}
                aria-hidden="true"
                className="pointer-events-none m-1 rounded-sm opacity-20"
                style={{
                  gridRow: p.r + 2,
                  gridColumn: p.c + 2,
                  background: PATH_COLOR[shot.event === 'refract' ? 'refract' : 'through'],
                }}
              />
            )),
          )}

          {/* Current shot's traced path (through/refract), staggered fade-in. */}
          {lastShotIsFresh &&
            lastShot!.path.map((p, i) => {
              const isTurn = lastShot!.turns.some((t) => t.r === p.r && t.c === p.c)
              return (
                <div
                  key={`path-${lastShot!.seq}-${i}`}
                  data-testid="beam-cell"
                  aria-hidden="true"
                  className="pointer-events-none m-1 rounded-sm"
                  style={{
                    gridRow: p.r + 2,
                    gridColumn: p.c + 2,
                    background: PATH_COLOR[lastShot!.event === 'refract' ? 'refract' : 'through'],
                    boxShadow: isTurn ? '0 0 10px 2px var(--neon-amber)' : undefined,
                    animation: reduced
                      ? undefined
                      : `px-seg-in .35s ease-out ${i * 0.03}s both`,
                  }}
                />
              )
            })}

          {/* hit marker (absorbed cell) for the current shot */}
          {lastShot && lastShot.event === 'hit' && lastShot.hitAtom && (
            <div
              aria-hidden="true"
              className="pointer-events-none m-1 rounded-sm"
              style={{
                gridRow: lastShot.hitAtom.r + 2,
                gridColumn: lastShot.hitAtom.c + 2,
                background: 'var(--neon-red)',
                boxShadow: '0 0 14px 3px var(--neon-red)',
                animation: reduced ? undefined : 'px-pop .25s ease-out both',
              }}
            />
          )}

          {/* Found atoms: permanent neon markers. */}
          {state.atoms.map((a, i) =>
            state.found[i] ? (
              <div
                key={`atom-${i}`}
                data-testid="atom-found"
                aria-hidden="true"
                className="pointer-events-none m-1.5 rounded-full"
                style={{
                  gridRow: a.r + 2,
                  gridColumn: a.c + 2,
                  background: 'var(--neon-cyan)',
                  boxShadow: '0 0 12px 3px var(--neon-cyan)',
                  animation: reduced ? undefined : 'px-pop .3s ease-out both',
                }}
              />
            ) : null,
          )}

          {/* Port buttons */}
          {ports.map((p, i) => {
            const pos = portGridPos(p, size)
            const fired = firedPorts.has(portKey(p))
            const isFocused = i === focus
            const isEntryReflect =
              lastShot && lastShot.event === 'reflect' && lastShot.entry.edge === p.edge && lastShot.entry.lane === p.lane
            return (
              <button
                key={portKey(p)}
                ref={(el) => {
                  portRefs.current[i] = el
                }}
                type="button"
                data-testid="port"
                aria-label={portLabel(p, size)}
                tabIndex={isFocused ? 0 : -1}
                onFocus={() => setFocus(i)}
                onClick={() => dispatch({ type: 'fire', entry: p })}
                className={`px-port flex items-center justify-center rounded-sm border text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
                  isFocused ? 'border-accent bg-accent/20 text-accent' : 'border-border/70 bg-bg-2/60 text-fg-muted'
                } ${fired ? 'opacity-50' : ''}`}
                style={{
                  gridRow: pos.row,
                  gridColumn: pos.col,
                  boxShadow: isEntryReflect && !reduced ? '0 0 12px 3px var(--neon-amber)' : undefined,
                  animation:
                    !reduced && lastShot && lastShot.entry.edge === p.edge && lastShot.entry.lane === p.lane
                      ? 'px-fire .3s ease-out both'
                      : undefined,
                }}
              >
                {EDGE_GLYPH[p.edge]}
              </button>
            )
          })}
        </div>

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="event-badge"
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-sm font-bold text-accent"
            style={reduced ? undefined : { animation: 'px-badge .9s ease-out both' }}
          >
            {b.text}
          </span>
        ))}

        <GameOverlay show={won} variant="win" title="Atoms found!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Shots <span className="font-bold text-accent">{state.shots.length}</span> / Par{' '}
              <span className="font-bold text-accent">{state.par}</span>
            </p>
            {mode === 'daily' && (
              <p>
                Streak <span className="font-bold text-accent">{streak}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === 'daily' && (
              <DailyShareButton
                payload={() => {
                  const used = state.shots.length
                  const par = state.par
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} SHOTS · PAR ${par}`)
                  return {
                    gameName: 'Prismbox',
                    dateISO: todayUTC(),
                    accent: '#4d7cff',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/prismbox`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Prismbox',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `found all atoms in ${used} shots (par ${par})`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes px-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes px-seg-in { from { opacity: 0; transform: scale(.4) } to { opacity: 1; transform: none } }
          @keyframes px-pop { from { opacity: 0; transform: scale(.3) } to { opacity: 1; transform: none } }
          @keyframes px-fire { 0% { transform: scale(1) } 40% { transform: scale(1.25) } 100% { transform: scale(1) } }
          @keyframes px-badge {
            0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.12); opacity: 1 }
            100% { transform: translate(-50%, -14px) scale(1); opacity: 0 }
          }
          .px-port { box-shadow: inset 0 0 6px rgba(0,0,0,.2); }
        `}</style>
      </div>
    </GameShell>
  )
}

const EDGE_GLYPH: Record<Port['edge'], string> = {
  N: '▼',
  S: '▲',
  W: '▶',
  E: '◀',
}
