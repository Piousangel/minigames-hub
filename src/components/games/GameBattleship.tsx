'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  aiMove,
  canPlace,
  cellsOf,
  createGame,
  emptyBoard,
  fire,
  FLEET,
  fleetComplete,
  isSunk,
  mulberry32,
  placementCells,
  placeShip,
  randomFleet,
  shipsRemaining,
  SIZE,
  type Board,
  type Difficulty,
  type GameState,
  type Orientation,
  type Ship,
  type ShipDef,
} from '@/lib/games/battleship/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Phase = 'place' | 'play'

interface WinRecord {
  w: number // player wins
  l: number // computer wins
}
const EMPTY_RECORD: WinRecord = { w: 0, l: 0 }

const CPU_DELAY = 660
const CPU_DELAY_REDUCED = 240
const FLASH_MS = 1700

const rows = Array.from({ length: SIZE }, (_, i) => i)
const cols = Array.from({ length: SIZE }, (_, i) => i)
const keyOf = (r: number, c: number): string => `${r},${c}`
const seed = (): number => (Math.random() * 0x100000000) >>> 0

// Component-scoped keyframes — globals.css stays untouched.
const BS_STYLE = `
@keyframes bs-hit {
  0%   { transform: scale(0.3); opacity: 0; }
  55%  { transform: scale(1.35); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes bs-miss {
  0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 0; }
  100% { transform: translate(-50%,-50%) scale(1); opacity: 0.9; }
}
@keyframes bs-sunk {
  0%, 100% { box-shadow: inset 0 0 0 rgba(255,77,109,0); }
  50%      { box-shadow: inset 0 0 12px rgba(255,77,109,0.9); }
}
@keyframes bs-flash {
  0%   { transform: scale(0.9); opacity: 0; }
  20%  { transform: scale(1); opacity: 1; }
  80%  { transform: scale(1); opacity: 1; }
  100% { opacity: 0; }
}`

/** Map a cell on a defender board to the ship occupying it (or null). */
function shipAt(board: Board, r: number, c: number): Ship | null {
  for (const s of board.ships) {
    for (const [sr, sc] of cellsOf(s)) if (sr === r && sc === c) return s
  }
  return null
}

export function GameBattleship({ storageKey }: { storageKey: string }) {
  // SSR-safe: nothing until the client mounts (seeds come from an effect).
  const [phase, setPhase] = useState<Phase | null>(null)
  const [playerShips, setPlayerShips] = useState<Ship[]>([])
  const [orient, setOrient] = useState<Orientation>('H')
  const [hover, setHover] = useState<[number, number] | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

  const [game, setGame] = useState<GameState | null>(null)
  const [record, setRecord] = useState<WinRecord>(EMPTY_RECORD)
  const [thinking, setThinking] = useState(false)
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null)
  const [shakeKey, setShakeKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const gameRef = useRef<GameState | null>(null)
  const recordRef = useRef<WinRecord>(EMPTY_RECORD)
  const difficultyRef = useRef<Difficulty>('normal')
  const resolvedRef = useRef(false)
  const flashTimer = useRef<number | null>(null)

  const commitGame = useCallback((g: GameState) => {
    gameRef.current = g
    setGame(g)
  }, [])

  // ── persistence ────────────────────────────────────────────────────────────
  const persist = useCallback(
    (next: WinRecord) => {
      recordRef.current = next
      setRecord(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // ignore (private mode / quota)
      }
    },
    [storageKey],
  )

  const showFlash = useCallback((text: string, good: boolean) => {
    setFlash({ text, good })
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS)
  }, [])

  // Resolve a finished game exactly once: sound, W/L record, personal stats.
  const resolve = useCallback(
    (g: GameState) => {
      if (resolvedRef.current || !g.winner) return
      resolvedRef.current = true
      const won = g.winner === 'player'
      play(won ? 'win' : 'lose')
      const next: WinRecord = { w: recordRef.current.w + (won ? 1 : 0), l: recordRef.current.l + (won ? 0 : 1) }
      persist(next)
      // 개인 기록(스탯 패널): 완료 1판/승수 누적. slug = storageKey에서 best: 제거 → 'battleship'.
      recordResult(storageKey.replace(/^best:/, ''), { won })
    },
    [persist, play, storageKey],
  )

  // ── one shot (player or CPU), driven by whose turn it currently is ───────────
  const doFire = useCallback(
    (cell: [number, number]) => {
      const cur = gameRef.current
      if (!cur) return
      const next = fire(cur, cell)
      if (next === cur) return // illegal / no-op
      const ls = next.lastShot
      if (ls) {
        if (ls.result === 'sunk') {
          play('match')
          const def = FLEET.find((f) => f.id === ls.sunk)
          const name = def?.name ?? 'ship'
          showFlash(ls.by === 'player' ? `You sank the ${name}!` : `Your ${name} was sunk!`, ls.by === 'player')
          if (ls.by === 'cpu') setShakeKey((k) => k + 1)
        } else if (ls.result === 'hit') {
          play('eat')
          if (ls.by === 'cpu') setShakeKey((k) => k + 1)
        } else {
          play('flip')
        }
      }
      commitGame(next)
      if (next.winner) resolve(next)
    },
    [commitGame, play, resolve, showFlash],
  )

  // Player fires at an Enemy Waters cell.
  const onFire = useCallback(
    (r: number, c: number) => {
      const cur = gameRef.current
      if (!cur || cur.winner || cur.turn !== 'player' || thinking) return
      if (cur.cpuBoard.shots[r][c] !== 'none') {
        play('flag')
        return
      }
      doFire([r, c])
    },
    [doFire, play, thinking],
  )

  // ── CPU turn: scheduled in an effect with a reduced-motion-aware delay ───────
  useEffect(() => {
    if (!game || game.winner || game.turn !== 'cpu') {
      setThinking(false)
      return
    }
    setThinking(true)
    const delay = reducedRef.current ? CPU_DELAY_REDUCED : CPU_DELAY
    const t = window.setTimeout(() => {
      const cur = gameRef.current
      if (!cur || cur.winner || cur.turn !== 'cpu') return
      const move = aiMove(cur, difficultyRef.current, mulberry32(seed()))
      if (move) doFire(move)
      setThinking(false)
    }, delay)
    return () => window.clearTimeout(t)
  }, [game, doFire, reducedRef])

  useEffect(() => {
    difficultyRef.current = difficulty
  }, [difficulty])

  // ── setup: placement helpers ─────────────────────────────────────────────────
  const nextDef: ShipDef | undefined = useMemo(
    () => FLEET.find((d) => !playerShips.some((s) => s.id === d.id)),
    [playerShips],
  )
  const complete = fleetComplete(playerShips)

  const autoPlace = useCallback(() => {
    setPlayerShips(randomFleet(mulberry32(seed())))
    play('flag')
  }, [play])

  const clearShips = useCallback(() => {
    setPlayerShips([])
    play('flip')
  }, [play])

  const rotate = useCallback(() => {
    setOrient((o) => (o === 'H' ? 'V' : 'H'))
    play('flip')
  }, [play])

  const tryPlaceAt = useCallback(
    (r: number, c: number) => {
      if (!nextDef) return
      if (canPlace(playerShips, r, c, orient, nextDef.length)) {
        const placed = placeShip(playerShips, nextDef, r, c, orient)
        if (placed) {
          setPlayerShips(placed)
          play('flag')
        }
      } else {
        play('error')
      }
    },
    [nextDef, orient, play, playerShips],
  )

  // ── start / restart ──────────────────────────────────────────────────────────
  const startBattle = useCallback(
    (ships: Ship[]) => {
      resolvedRef.current = false
      setThinking(false)
      setFlash(null)
      setShakeKey(0)
      const g = createGame({ ships, shots: emptyBoard().shots }, mulberry32(seed()))
      commitGame(g)
      setPhase('play')
      play('merge')
    },
    [commitGame, play],
  )

  // Header "New Game" → back to fleet placement with a fresh auto-placed fleet.
  const newSetup = useCallback(() => {
    resolvedRef.current = false
    setThinking(false)
    setFlash(null)
    gameRef.current = null
    setGame(null)
    setPlayerShips(randomFleet(mulberry32(seed())))
    setPhase('place')
  }, [])

  // Overlay "Rematch" → instant new battle reusing the current fleet.
  const rematch = useCallback(() => {
    const ships = playerShips.length ? playerShips : randomFleet(mulberry32(seed()))
    startBattle(ships)
  }, [playerShips, startBattle])

  // Init on client: auto-place a fleet so a first-timer can start in one tap.
  useEffect(() => {
    setPlayerShips(randomFleet(mulberry32(seed())))
    setPhase('place')
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WinRecord>
        const loaded: WinRecord = { w: Number(parsed.w) || 0, l: Number(parsed.l) || 0 }
        recordRef.current = loaded
        setRecord(loaded)
      }
    } catch {
      // ignore malformed storage
    }
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    }
  }, [storageKey])

  // ── derived preview for placement ────────────────────────────────────────────
  const previewSet = useMemo(() => {
    if (phase !== 'place' || !nextDef || !hover) return null
    const cells = placementCells(hover[0], hover[1], orient, nextDef.length)
    const ok = cells !== null && canPlace(playerShips, hover[0], hover[1], orient, nextDef.length)
    const set = new Set<string>()
    for (const [r, c] of cells ?? [[hover[0], hover[1]]]) set.add(keyOf(r, c))
    return { set, ok }
  }, [phase, nextDef, hover, orient, playerShips])

  const over = !!game?.winner
  const won = game?.winner === 'player'
  const reduced = reducedRef.current

  // ── loading ─────────────────────────────────────────────────────────────────
  if (phase === null) {
    return (
      <GameShell
        stats={[{ label: 'Wins', value: 0 }]}
        onNewGame={() => {}}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint="Place your fleet, then hunt down the enemy ships."
        maxWidthClassName="max-w-md"
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="battleship-loading" />
      </GameShell>
    )
  }

  const stats = [
    { label: 'Wins', value: record.w, testId: 'battleship-wins', float: true },
    { label: 'Losses', value: record.l },
  ]

  const difficultyToggle = (
    <div className="flex rounded-lg bg-surface p-0.5 text-sm" role="group" aria-label="Difficulty">
      {(['easy', 'normal', 'hard'] as const).map((d) => (
        <button
          key={d}
          onClick={() => setDifficulty(d)}
          aria-pressed={difficulty === d}
          className={`btn-press rounded-md px-2.5 py-1 font-semibold capitalize ${
            difficulty === d ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  )

  const hint = over
    ? won
      ? 'Victory! You sank the entire enemy fleet.'
      : 'Your fleet is destroyed. Try again!'
    : phase === 'place'
      ? nextDef
        ? `Tap a square to place your ${nextDef.name} (${nextDef.length}). Rotate to turn it, or hit Auto-place.`
        : 'Fleet ready! Press Start Battle to begin firing.'
      : thinking
        ? 'Enemy is taking aim…'
        : game?.turn === 'player'
          ? 'Your turn — tap a square in Enemy Waters to fire.'
          : 'Enemy turn…'

  // ── setup fleet roster / status pills ────────────────────────────────────────
  const enemyRemaining = game ? shipsRemaining(game.cpuBoard) : FLEET.length
  const playerRemaining = game ? shipsRemaining(game.playerBoard) : FLEET.length

  return (
    <GameShell
      stats={stats}
      headerExtra={difficultyToggle}
      onNewGame={newSetup}
      newGameLabel={phase === 'place' ? 'Reset' : 'New Fleet'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-md"
    >
      <style>{BS_STYLE}</style>

      {/* Sunk / event flash — assertive so screen readers announce it. */}
      <div aria-live="assertive" className="mb-2 h-6 text-center">
        {flash && (
          <span
            key={flash.text}
            className={`inline-block rounded-full border px-3 py-0.5 text-sm font-bold ${
              flash.good
                ? 'border-neon-lime/50 bg-neon-lime/10 text-neon-lime'
                : 'border-neon-red/50 bg-neon-red/10 text-neon-red'
            }`}
            style={reduced ? undefined : { animation: `bs-flash ${FLASH_MS}ms ease-in-out both` }}
          >
            {flash.text}
          </span>
        )}
      </div>

      <div data-testid="battleship-board" className="anim-board-in flex flex-col gap-4 select-none">
        {phase === 'place' ? (
          <PlacementControls
            orient={orient}
            onRotate={rotate}
            onAuto={autoPlace}
            onClear={clearShips}
            onStart={() => startBattle(playerShips)}
            complete={complete}
            placedCount={playerShips.length}
          />
        ) : null}

        {/* ENEMY WATERS — where the player fires (only shown once playing). */}
        {phase === 'play' && game && (
          <section aria-label="Enemy waters">
            <GridHeader
              title="Enemy Waters"
              subtitle={`${enemyRemaining} ship${enemyRemaining === 1 ? '' : 's'} left`}
              tone="cyan"
              active={!over && game.turn === 'player' && !thinking}
            />
            <div
              role="grid"
              aria-label="Enemy waters — tap to fire"
              className="grid grid-cols-10 gap-[2px] overflow-hidden rounded-xl border border-neon-cyan/30 bg-slate-950/70 p-[3px] shadow-[inset_0_0_18px_rgba(34,211,238,0.12)]"
            >
              {rows.map((r) =>
                cols.map((c) => {
                  const shot = game.cpuBoard.shots[r][c]
                  const ship = shot === 'hit' ? shipAt(game.cpuBoard, r, c) : null
                  const sunk = ship ? isSunk(ship) : false
                  const clickable = !over && game.turn === 'player' && !thinking && shot === 'none'
                  const justHit = game.lastShot?.by === 'player' && game.lastShot.cell[0] === r && game.lastShot.cell[1] === c
                  return (
                    <button
                      key={keyOf(r, c)}
                      role="gridcell"
                      aria-label={`Enemy ${String.fromCharCode(65 + r)}${c + 1}${
                        shot === 'none' ? ', unknown — fire here' : shot === 'miss' ? ', miss' : sunk ? ', sunk' : ', hit'
                      }`}
                      disabled={!clickable}
                      onClick={() => onFire(r, c)}
                      className={`relative flex aspect-square w-full items-center justify-center rounded-[3px] transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan ${
                        shot === 'none'
                          ? clickable
                            ? 'cursor-crosshair bg-cyan-500/10 hover:bg-cyan-400/25'
                            : 'bg-cyan-500/10'
                          : sunk
                            ? 'bg-neon-red/25'
                            : shot === 'hit'
                              ? 'bg-neon-red/15'
                              : 'bg-slate-800/60'
                      }`}
                      style={sunk && !reduced ? { animation: 'bs-sunk 1.2s ease-in-out infinite' } : undefined}
                    >
                      <FireMark shot={shot} sunk={sunk} justPlaced={justHit && !reduced} />
                    </button>
                  )
                }),
              )}
            </div>
          </section>
        )}

        {/* YOUR FLEET — always visible: placement board, then the defended board. */}
        <section aria-label="Your fleet" key={shakeKey} className={phase === 'play' && shakeKey > 0 && !reduced ? 'anim-shake' : ''}>
          <GridHeader
            title="Your Fleet"
            subtitle={phase === 'play' ? `${playerRemaining} ship${playerRemaining === 1 ? '' : 's'} left` : `${playerShips.length}/${FLEET.length} placed`}
            tone="lime"
            active={phase === 'play' && !over && game?.turn === 'cpu'}
          />
          <div
            role="grid"
            aria-label="Your fleet"
            className="grid grid-cols-10 gap-[2px] overflow-hidden rounded-xl border border-neon-lime/25 bg-slate-950/70 p-[3px] shadow-[inset_0_0_18px_rgba(163,230,53,0.1)]"
          >
            {rows.map((r) =>
              cols.map((c) => {
                const board: Board | null = phase === 'play' && game ? game.playerBoard : null
                const shipsForCell = phase === 'play' && game ? game.playerBoard.ships : playerShips
                const ship = (() => {
                  for (const s of shipsForCell) for (const [sr, sc] of cellsOf(s)) if (sr === r && sc === c) return s
                  return null
                })()
                const shot = board ? board.shots[r][c] : 'none'
                const sunk = ship ? isSunk(ship) : false
                const inPreview = previewSet?.set.has(keyOf(r, c)) ?? false
                const previewOk = previewSet?.ok ?? false
                const placeable = phase === 'place' && !!nextDef

                const justHit = phase === 'play' && game?.lastShot?.by === 'cpu' && game.lastShot.cell[0] === r && game.lastShot.cell[1] === c

                return (
                  <button
                    key={keyOf(r, c)}
                    role="gridcell"
                    aria-label={`${String.fromCharCode(65 + r)}${c + 1}${ship ? ', your ship' : ''}${
                      shot === 'miss' ? ', enemy missed' : shot === 'hit' ? (sunk ? ', ship sunk' : ', ship hit') : ''
                    }`}
                    disabled={!placeable}
                    onClick={placeable ? () => tryPlaceAt(r, c) : undefined}
                    onPointerEnter={placeable ? () => setHover([r, c]) : undefined}
                    onPointerLeave={placeable ? () => setHover(null) : undefined}
                    className={`relative flex aspect-square w-full items-center justify-center rounded-[3px] transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-lime ${
                      placeable ? 'cursor-pointer' : ''
                    } ${
                      inPreview
                        ? previewOk
                          ? 'bg-neon-lime/50'
                          : 'bg-neon-red/50'
                        : sunk
                          ? 'bg-neon-red/30'
                          : ship
                            ? 'bg-slate-500/70'
                            : 'bg-slate-800/50 hover:bg-slate-700/60'
                    }`}
                    style={sunk && !reduced ? { animation: 'bs-sunk 1.2s ease-in-out infinite' } : undefined}
                  >
                    {ship && !inPreview && (
                      <span aria-hidden="true" className="absolute inset-[14%] rounded-[2px] bg-gradient-to-br from-slate-300/70 to-slate-500/70" />
                    )}
                    <FireMark shot={shot} sunk={sunk} justPlaced={justHit && !reduced} />
                  </button>
                )
              }),
            )}
          </div>
        </section>

        <GameOverlay show={over && won} variant="win" title="Victory!" testId="battleship-result-win">
          <p className="text-sm text-fg-muted">You sank the enemy fleet.</p>
          <GameButton onClick={rematch} className="px-4 py-2">
            Rematch
          </GameButton>
        </GameOverlay>

        <GameOverlay show={over && !won} variant="lose" title="Fleet destroyed" testId="battleship-result-lose">
          <p className="text-sm text-fg-muted">The enemy sank all your ships.</p>
          <GameButton onClick={rematch} className="px-4 py-2">
            Rematch
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}

// ── small presentational pieces ────────────────────────────────────────────────

function GridHeader({
  title,
  subtitle,
  tone,
  active,
}: {
  title: string
  subtitle: string
  tone: 'cyan' | 'lime'
  active: boolean
}) {
  const color = tone === 'cyan' ? 'text-neon-cyan' : 'text-neon-lime'
  return (
    <div className="mb-1.5 flex items-baseline justify-between px-0.5">
      <h3 className={`text-sm font-bold uppercase tracking-wide ${color} ${active ? 'neon-text' : 'opacity-80'}`}>
        {active ? '▸ ' : ''}
        {title}
      </h3>
      <span className="text-xs text-fg-muted">{subtitle}</span>
    </div>
  )
}

function FireMark({ shot, sunk, justPlaced }: { shot: 'none' | 'miss' | 'hit'; sunk: boolean; justPlaced: boolean }) {
  if (shot === 'miss') {
    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-1/4 w-1/4 rounded-full bg-slate-400/70"
        style={justPlaced ? { animation: 'bs-miss 200ms ease-out both' } : { transform: 'translate(-50%,-50%)' }}
      />
    )
  }
  if (shot === 'hit') {
    return (
      <span
        aria-hidden="true"
        className={`pointer-events-none text-[0.7rem] leading-none ${sunk ? '' : ''}`}
        style={justPlaced ? { animation: 'bs-hit 320ms cubic-bezier(0.34,1.4,0.64,1) both' } : undefined}
      >
        {sunk ? '💥' : '🔥'}
      </span>
    )
  }
  return null
}

function PlacementControls({
  orient,
  onRotate,
  onAuto,
  onClear,
  onStart,
  complete,
  placedCount,
}: {
  orient: Orientation
  onRotate: () => void
  onAuto: () => void
  onClear: () => void
  onStart: () => void
  complete: boolean
  placedCount: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <GameButton variant="ghost" onClick={onRotate} className="px-3 py-2">
          Rotate: {orient === 'H' ? 'Horizontal' : 'Vertical'}
        </GameButton>
        <GameButton onClick={onAuto} className="px-4 py-2">
          🎲 Auto-place
        </GameButton>
        <GameButton variant="ghost" onClick={onClear} disabled={placedCount === 0} className="px-3 py-2">
          Clear
        </GameButton>
      </div>
      <GameButton
        onClick={onStart}
        disabled={!complete}
        className="w-full py-3 text-base"
      >
        {complete ? '⚓ Start Battle' : 'Place all 5 ships to start'}
      </GameButton>
    </div>
  )
}
