'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type AiAction,
  type Side,
  type State,
  aiMove,
  deal,
  draw,
  handPips,
  hasPlay,
  mulberry32,
  pass,
  play,
  playableTiles,
} from '@/lib/games/dominoes/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'cpu' | '2p'

const CPU_DELAY = 620
const CPU_DELAY_REDUCED = 220

interface WinRecord {
  w: number // human (player 0) wins in vs-CPU
  l: number // computer wins / block-losses in vs-CPU
}
const EMPTY_RECORD: WinRecord = { w: 0, l: 0 }

// Pip positions in a 3×3 grid (row-major cells 0..8) for each face value 0..6.
const PIP_CELLS: readonly number[][] = [
  [], // 0
  [4], // 1
  [0, 8], // 2
  [0, 4, 8], // 3
  [0, 2, 6, 8], // 4
  [0, 2, 4, 6, 8], // 5
  [0, 2, 3, 5, 6, 8], // 6
]

const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

/** One half of a domino: a 3×3 grid of neon pips. */
function PipFace({ value }: { value: number }) {
  const on = PIP_CELLS[value]
  return (
    <div className="grid aspect-square h-full w-full grid-cols-3 grid-rows-3 gap-[6%] p-[15%]">
      {CELLS.map((i) => (
        <span key={i} className="flex items-center justify-center">
          {on.includes(i) && (
            <span className="block h-full w-full rounded-full bg-neon-cyan shadow-[0_0_4px_var(--neon-cyan)]" />
          )}
        </span>
      ))}
    </div>
  )
}

/** A rendered domino tile. `orient` = 'h' (line) or 'v' (hand). */
function DominoTile({ a, b, orient }: { a: number; b: number; orient: 'h' | 'v' }) {
  const flex = orient === 'h' ? 'flex-row' : 'flex-col'
  const divider =
    orient === 'h'
      ? 'w-px self-stretch bg-neon-cyan/30'
      : 'h-px self-stretch bg-neon-cyan/30'
  return (
    <div
      className={`flex ${flex} items-stretch rounded-md border border-neon-cyan/40 bg-bg-2/90 shadow-[0_0_8px_rgba(34,211,238,0.15),inset_0_0_6px_rgba(0,0,0,0.5)]`}
    >
      <div className={orient === 'h' ? 'h-full' : 'w-full'} style={{ aspectRatio: '1 / 1' }}>
        <PipFace value={a} />
      </div>
      <div className={divider} aria-hidden="true" />
      <div className={orient === 'h' ? 'h-full' : 'w-full'} style={{ aspectRatio: '1 / 1' }}>
        <PipFace value={b} />
      </div>
    </div>
  )
}

/** Face-down back (opponent tile). */
function TileBack({ orient }: { orient: 'h' | 'v' }) {
  const size = orient === 'v' ? 'h-16 w-8' : 'h-8 w-16'
  return (
    <div
      aria-hidden="true"
      className={`${size} shrink-0 rounded-md border border-neon-magenta/40 bg-gradient-to-br from-bg-2 to-surface shadow-[0_0_8px_rgba(255,61,154,0.15)]`}
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,61,154,0.14) 0 4px, transparent 4px 8px)',
      }}
    />
  )
}

export function GameDominoes({ storageKey }: { storageKey: string }) {
  // SSR-safe: no board until the client mounts.
  const [state, setState] = useState<State | null>(null)
  const [record, setRecord] = useState<WinRecord>(EMPTY_RECORD)
  const [mode, setMode] = useState<Mode>('cpu')
  const [thinking, setThinking] = useState(false)
  // A tapped tile awaiting a side choice (both ends legal).
  const [pending, setPending] = useState<{ tileIndex: number; sides: Side[] } | null>(null)
  // 2-player: hide the board between turns so the next player can pick up.
  const [handHidden, setHandHidden] = useState(false)

  const { play: sfx, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const modeRef = useRef<Mode>('cpu')
  const recordRef = useRef<WinRecord>(EMPTY_RECORD)
  const thinkingRef = useRef(false)
  const historyRef = useRef<State[]>([]) // human-turn snapshots (vs-CPU undo)
  const timerRef = useRef<number | null>(null)

  const commit = useCallback((s: State) => {
    stateRef.current = s
    setState(s)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const bumpRecord = useCallback(
    (kind: keyof WinRecord) => {
      const next = { ...recordRef.current, [kind]: recordRef.current[kind] + 1 }
      recordRef.current = next
      setRecord(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // ignore storage failures (private mode, quota)
      }
    },
    [storageKey],
  )

  // End-of-game side effects. Returns true if terminal.
  const resolve = useCallback(
    (s: State): boolean => {
      if (s.status === 'playing') return false
      if (modeRef.current === 'cpu') {
        const humanWon = s.winner === 0
        if (humanWon) {
          sfx('win')
          bumpRecord('w')
        } else {
          sfx('lose')
          bumpRecord('l')
        }
        // 개인 기록: 사람(0) 승리만 won:true. 무승부/블록패는 won:false.
        recordResult(storageKey.replace(/^best:/, ''), { won: humanWon })
      } else {
        // 2P: no single "human" — just play the fanfare, no record.
        sfx('win')
      }
      return true
    },
    [bumpRecord, sfx, storageKey],
  )

  // Resolve the computer's full turn (draw until playable, then play/pass).
  const runCpuTurn = useCallback(
    (start: State): State => {
      let cur = start
      // Safety bound: the boneyard is finite, so this always terminates.
      for (let guard = 0; guard < 40; guard++) {
        const action: AiAction = aiMove(cur, 1, Math.random)
        if (action.type === 'play') {
          cur = play(cur, 1, action.tileIndex, action.side)
          sfx('move')
          break
        }
        if (action.type === 'draw') {
          cur = draw(cur, 1)
          sfx('flip')
          continue
        }
        cur = pass(cur, 1)
        sfx('flag')
        break
      }
      return cur
    },
    [sfx],
  )

  // Begin a fresh human turn (vs-CPU): snapshot for undo, then hand over.
  const beginHumanTurn = useCallback(
    (s: State) => {
      historyRef.current = [...historyRef.current, s]
      commit(s)
    },
    [commit],
  )

  const startCpuTurn = useCallback(() => {
    thinkingRef.current = true
    setThinking(true)
    clearTimer()
    const delay = reducedRef.current ? CPU_DELAY_REDUCED : CPU_DELAY
    timerRef.current = window.setTimeout(() => {
      const s = stateRef.current
      if (s && s.status === 'playing' && s.turn === 1) {
        const next = runCpuTurn(s)
        if (!resolve(next)) beginHumanTurn(next)
        else commit(next)
      }
      thinkingRef.current = false
      setThinking(false)
    }, delay)
  }, [beginHumanTurn, clearTimer, commit, reducedRef, resolve, runCpuTurn])

  // After a human action lands: check terminal, then route to CPU / handoff.
  const afterHuman = useCallback(
    (next: State) => {
      setPending(null)
      commit(next)
      if (resolve(next)) return
      if (modeRef.current === 'cpu') {
        startCpuTurn()
      } else {
        // 2P: hide the device so the next player can pick up unseen.
        setHandHidden(true)
      }
    },
    [commit, resolve, startCpuTurn],
  )

  // Apply a validated tile placement for the active (human) player.
  const doPlay = useCallback(
    (tileIndex: number, side: Side) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing' || thinkingRef.current) return
      const player = s.turn
      const next = play(s, player, tileIndex, side)
      if (next === s) {
        sfx('error')
        return
      }
      sfx('move')
      afterHuman(next)
    },
    [afterHuman, sfx],
  )

  // Tap a tile in the active hand.
  const onTapTile = useCallback(
    (tileIndex: number) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing' || thinkingRef.current || handHidden) return
      if (modeRef.current === 'cpu' && s.turn !== 0) return
      if (pending && pending.tileIndex === tileIndex) {
        setPending(null) // tap again to cancel
        return
      }
      const opt = playableTiles(s, s.turn).find((p) => p.tileIndex === tileIndex)
      if (!opt) {
        sfx('error')
        return
      }
      if (opt.sides.length === 1) {
        doPlay(tileIndex, opt.sides[0])
      } else {
        setPending({ tileIndex, sides: opt.sides })
      }
    },
    [doPlay, handHidden, pending, sfx],
  )

  // Draw from the boneyard until the active player has a play (or it empties).
  const onDraw = useCallback(() => {
    const s = stateRef.current
    if (!s || s.status !== 'playing' || thinkingRef.current || handHidden) return
    if (modeRef.current === 'cpu' && s.turn !== 0) return
    if (hasPlay(s, s.turn)) return
    let cur = s
    let drew = false
    while (cur.boneyard.length > 0 && !hasPlay(cur, cur.turn)) {
      const n = draw(cur, cur.turn)
      if (n === cur) break
      cur = n
      drew = true
    }
    if (drew) {
      sfx('flip')
      commit(cur)
    }
  }, [commit, handHidden, sfx])

  // Pass (only when no play + empty boneyard).
  const onPass = useCallback(() => {
    const s = stateRef.current
    if (!s || s.status !== 'playing' || thinkingRef.current || handHidden) return
    if (modeRef.current === 'cpu' && s.turn !== 0) return
    const next = pass(s, s.turn)
    if (next === s) {
      sfx('error')
      return
    }
    sfx('flag')
    afterHuman(next)
  }, [afterHuman, handHidden, sfx])

  const restart = useCallback(() => {
    clearTimer()
    thinkingRef.current = false
    setThinking(false)
    setPending(null)
    setHandHidden(false)
    // Seed from a client-only time source (never in render → SSR-safe).
    const s = deal(mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0))
    historyRef.current = [s]
    commit(s)
  }, [clearTimer, commit])

  const undo = useCallback(() => {
    if (modeRef.current !== 'cpu') return
    const hist = historyRef.current
    if (hist.length < 2 || thinkingRef.current) return
    const prev = hist[hist.length - 2]
    historyRef.current = hist.slice(0, -1)
    setPending(null)
    commit(prev)
  }, [commit])

  // Reveal the current player's hand in 2P (after the pass-device screen).
  const reveal = useCallback(() => {
    setHandHidden(false)
    sfx('flip')
  }, [sfx])

  // Init on client + hydrate the wins record.
  useEffect(() => {
    restart()
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
    return clearTimer
  }, [restart, storageKey, clearTimer])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  // Keyboard: N new, U undo, Esc cancel pending.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const k = e.key.toLowerCase()
      if (k === 'n') {
        e.preventDefault()
        restart()
      } else if (k === 'u') {
        e.preventDefault()
        undo()
      } else if (e.key === 'Escape') {
        setPending(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [restart, undo])

  const switchMode = useCallback(
    (m: Mode) => {
      if (m === mode) return
      setMode(m)
      modeRef.current = m
      clearTimer()
      thinkingRef.current = false
      setThinking(false)
      setPending(null)
      setHandHidden(false)
      const s = deal(mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0))
      historyRef.current = [s]
      commit(s)
    },
    [clearTimer, commit, mode],
  )

  // ── Derived render data ──────────────────────────────────────────────────
  const over = !!state && state.status !== 'playing'
  const activePlayer = state ? state.turn : 0
  const humanCanAct =
    !!state && !over && !thinking && !handHidden && (mode === '2p' || activePlayer === 0)

  const playable = useMemo(() => {
    if (!state || !humanCanAct) return new Map<number, Side[]>()
    const m = new Map<number, Side[]>()
    for (const p of playableTiles(state, activePlayer)) m.set(p.tileIndex, p.sides)
    return m
  }, [state, humanCanAct, activePlayer])

  const noPlay = humanCanAct && playable.size === 0
  const canDraw = !!state && noPlay && state.boneyard.length > 0
  const canPass = !!state && noPlay && state.boneyard.length === 0

  const playerName = useCallback(
    (i: number): string => (mode === 'cpu' ? (i === 0 ? 'You' : 'Computer') : `Player ${i + 1}`),
    [mode],
  )

  const modeToggle = (
    <div className="flex rounded-lg bg-surface p-0.5 text-sm" role="group" aria-label="Mode">
      {(
        [
          ['cpu', 'vs CPU'],
          ['2p', '2-Player'],
        ] as const
      ).map(([m, label]) => (
        <button
          key={m}
          onClick={() => switchMode(m)}
          aria-pressed={mode === m}
          className={`btn-press rounded-md px-2.5 py-1 font-semibold ${
            mode === m ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'Wins', value: 0 }]}
        headerExtra={modeToggle}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint="Match an open end to empty your hand first."
        maxWidthClassName="max-w-2xl"
      >
        <div className="h-64 w-full rounded-xl bg-surface" data-testid="dominoes-loading" />
      </GameShell>
    )
  }

  const oppIndex = mode === 'cpu' ? 1 : (1 - activePlayer)
  const oppCount = state.hands[oppIndex].length
  const activeHand = state.hands[activePlayer]

  const stats =
    mode === 'cpu'
      ? [
          { label: 'Wins', value: record.w, testId: 'dominoes-wins', float: true },
          { label: 'Losses', value: record.l },
          { label: 'Boneyard', value: state.boneyard.length },
        ]
      : [
          { label: 'P1 tiles', value: state.hands[0].length },
          { label: 'P2 tiles', value: state.hands[1].length },
          { label: 'Boneyard', value: state.boneyard.length },
        ]

  const hint = over
    ? state.winner === null
      ? `Blocked — it's a draw (${handPips(state.hands[0])} vs ${handPips(state.hands[1])} pips).`
      : state.status === 'blocked'
        ? `Blocked — ${playerName(state.winner)} win${mode === 'cpu' && state.winner === 0 ? '' : 's'} on fewer pips.`
        : `${playerName(state.winner)} domino! Hand emptied.`
    : thinking
      ? 'Computer is thinking…'
      : handHidden
        ? `Pass the device to ${playerName(activePlayer)}.`
        : pending
          ? 'Tap an open end to place your tile.'
          : noPlay
            ? canDraw
              ? 'No move — draw from the boneyard.'
              : 'No move and boneyard empty — you must pass.'
            : `${playerName(activePlayer)}: tap a matching tile.`

  const won = over && state.status === 'won'
  const humanResult =
    mode === 'cpu'
      ? state.winner === 0
        ? 'win'
        : 'lose'
      : 'win' // 2P: neutral fanfare, treat as celebratory
  const resultTitle =
    state.winner === null
      ? "It's a draw"
      : won
        ? `${playerName(state.winner)} win${mode === 'cpu' && state.winner === 0 ? '' : 's'}!`
        : `${playerName(state.winner)} win${mode === 'cpu' && state.winner === 0 ? '' : 's'}`

  return (
    <GameShell
      stats={stats}
      headerExtra={modeToggle}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-2xl"
    >
      <div className="anim-board-in relative select-none">
        <div
          data-testid="dominoes-board"
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-3 shadow-[inset_0_0_18px_rgba(0,0,0,0.4)] sm:p-4"
        >
          {/* Opponent */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-neon-magenta">
              {playerName(oppIndex)}
            </span>
            <div className="flex items-center gap-1 overflow-hidden">
              {Array.from({ length: Math.min(oppCount, 9) }).map((_, i) => (
                <TileBack key={i} orient="v" />
              ))}
              <span className="ml-1 text-sm text-fg-muted">×{oppCount}</span>
            </div>
          </div>

          {/* The line */}
          <div className="relative rounded-lg border border-border/70 bg-bg/50 p-2">
            <div className="flex min-h-16 items-center gap-2 overflow-x-auto">
              {state.line.length === 0 ? (
                <span className="mx-auto py-4 text-sm text-fg-muted">
                  Empty layout — play the first tile.
                </span>
              ) : (
                <>
                  {/* Left drop target */}
                  {pending && pending.sides.includes('left') && (
                    <button
                      onClick={() => doPlay(pending.tileIndex, 'left')}
                      aria-label={`Place on the left (open end ${state.leftEnd})`}
                      className="btn-press h-8 w-16 shrink-0 rounded-md border-2 border-dashed border-neon-green bg-neon-green/10 text-xs font-bold text-neon-green"
                    >
                      ◀ {state.leftEnd}
                    </button>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {state.line.map((t, i) => (
                      <div key={`${t[0]}-${t[1]}-${i}`} className="h-8 shrink-0">
                        <DominoTile a={t[0]} b={t[1]} orient="h" />
                      </div>
                    ))}
                  </div>
                  {/* Right drop target */}
                  {pending && pending.sides.includes('right') && (
                    <button
                      onClick={() => doPlay(pending.tileIndex, 'right')}
                      aria-label={`Place on the right (open end ${state.rightEnd})`}
                      className="btn-press h-8 w-16 shrink-0 rounded-md border-2 border-dashed border-neon-green bg-neon-green/10 text-xs font-bold text-neon-green"
                    >
                      {state.rightEnd} ▶
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Active hand */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neon-cyan">
                {playerName(activePlayer)}
                {mode === '2p' && !handHidden ? " — your turn" : ''}
              </span>
              <span className="text-xs text-fg-muted">{activeHand.length} tiles</span>
            </div>
            {handHidden ? (
              <div className="flex flex-wrap gap-2">
                {activeHand.map((_, i) => (
                  <TileBack key={i} orient="v" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2" data-testid="dominoes-hand">
                {activeHand.map((t, i) => {
                  const canTap = humanCanAct && playable.has(i)
                  const isPending = pending?.tileIndex === i
                  return (
                    <button
                      key={`${t[0]}-${t[1]}-${i}`}
                      onClick={() => onTapTile(i)}
                      disabled={!humanCanAct}
                      aria-label={`Tile ${t[0]}-${t[1]}${canTap ? ', playable' : ''}`}
                      className={`h-16 w-8 shrink-0 rounded-md transition-transform disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
                        canTap ? 'cursor-pointer hover:-translate-y-1' : 'opacity-60'
                      } ${isPending ? '-translate-y-1 ring-2 ring-neon-green' : ''} ${
                        canTap && !isPending ? 'ring-1 ring-neon-cyan/50' : ''
                      }`}
                    >
                      <DominoTile a={t[0]} b={t[1]} orient="v" />
                    </button>
                  )
                })}
              </div>
            )}

            {/* Action buttons */}
            {!handHidden && (canDraw || canPass) && (
              <div className="flex gap-2">
                {canDraw && (
                  <GameButton onClick={onDraw} data-testid="dominoes-draw">
                    Draw ({state.boneyard.length})
                  </GameButton>
                )}
                {canPass && (
                  <GameButton onClick={onPass} variant="ghost" data-testid="dominoes-pass">
                    Pass
                  </GameButton>
                )}
              </div>
            )}

            {mode === 'cpu' && !over && (
              <div>
                <GameButton
                  onClick={undo}
                  variant="ghost"
                  disabled={historyRef.current.length < 2 || thinking}
                  className="text-xs"
                >
                  Undo
                </GameButton>
              </div>
            )}
          </div>
        </div>

        {/* 2P pass-the-device screen */}
        {handHidden && !over && (
          <div
            data-testid="dominoes-handoff"
            className="anim-backdrop-in absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-xl bg-bg/85 text-center"
          >
            <p className="neon-text text-xl font-bold text-neon-cyan">
              {playerName(activePlayer)}&apos;s turn
            </p>
            <p className="text-sm text-fg-muted">Hand the device over, then reveal.</p>
            <GameButton onClick={reveal} className="px-5 py-2">
              Reveal my hand
            </GameButton>
          </div>
        )}

        <GameOverlay
          show={over && humanResult === 'win'}
          variant="win"
          title={resultTitle}
          testId="dominoes-result-win"
        >
          <p className="text-sm text-fg-muted">
            {state.winner === null
              ? `${handPips(state.hands[0])} vs ${handPips(state.hands[1])} pips`
              : state.status === 'blocked'
                ? 'Blocked — fewer pips wins.'
                : 'Hand emptied.'}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>

        <GameOverlay
          show={over && humanResult === 'lose'}
          variant="lose"
          title={resultTitle}
          testId="dominoes-result-lose"
        >
          <p className="text-sm text-fg-muted">
            {state.status === 'blocked'
              ? `Blocked — ${handPips(state.hands[0])} vs ${handPips(state.hands[1])} pips.`
              : 'Computer emptied its hand.'}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
