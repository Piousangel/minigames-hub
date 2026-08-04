'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  aiMove,
  isOwnPit,
  moveDetail,
  newGame,
  ownPits,
  P0_STORE,
  P1_STORE,
  storeOf,
  winner,
  type Difficulty,
  type GameState,
  type Player,
  type Winner,
} from '@/lib/games/mancala/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Bottom player (you, store on the right) is 0; top player (CPU / player 2) is 1.
const HUMAN: Player = 0
const CPU: Player = 1

type Mode = 'cpu' | 'two'

const STEP_MS = 170 // per-stone sow tick
const FX_MS = 560 // pause to show a capture / extra-turn flourish
const CPU_DELAY = 520
const CPU_DELAY_REDUCED = 180

interface WinRecord {
  w: number // human wins vs CPU
  l: number // CPU wins
  d: number // draws
}
const EMPTY_RECORD: WinRecord = { w: 0, l: 0, d: 0 }

// Board display order: top row runs right→left (12…7 counterclockwise), bottom
// row left→right (0…5). This makes vertically-aligned pits true opposites.
const TOP_ROW = [12, 11, 10, 9, 8, 7]
const BOTTOM_ROW = [0, 1, 2, 3, 4, 5]

// Component-scoped keyframes — globals.css stays untouched.
const MNC_STYLE = `
@keyframes mnc-drop {
  0%   { transform: scale(0.55); }
  55%  { transform: scale(1.14); }
  100% { transform: scale(1); }
}
@keyframes mnc-cap {
  0%, 100% { box-shadow: 0 0 0 rgba(251,191,36,0); }
  40%      { box-shadow: 0 0 0 3px rgba(251,191,36,0.9), 0 0 18px rgba(251,191,36,0.8); }
}
@keyframes mnc-pick {
  0%, 100% { box-shadow: 0 0 0 rgba(56,189,248,0); }
  50%      { box-shadow: 0 0 12px rgba(56,189,248,0.55); }
}
@keyframes mnc-badge {
  0%   { transform: translateY(6px) scale(0.8); opacity: 0; }
  20%  { transform: translateY(0) scale(1.05); opacity: 1; }
  80%  { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-4px) scale(0.96); opacity: 0; }
}`

// Small neon pips. For crowded pits (>8) we show a bold number instead so the
// count stays instantly readable on a phone.
function Stones({ count, tone }: { count: number; tone: 'you' | 'cpu' }) {
  const dot = tone === 'you' ? 'bg-neon-cyan' : 'bg-neon-magenta'
  if (count === 0) return null
  if (count > 8) {
    return (
      <span
        className={`text-lg font-extrabold leading-none ${tone === 'you' ? 'text-neon-cyan' : 'text-neon-magenta'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]`}
      >
        {count}
      </span>
    )
  }
  return (
    <span className="flex max-w-[80%] flex-wrap content-center items-center justify-center gap-[3px]">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-[7px] w-[7px] rounded-full ${dot} shadow-[0_0_5px_currentColor]`}
          style={{ color: tone === 'you' ? 'var(--neon-cyan)' : 'var(--neon-magenta)' }}
        />
      ))}
    </span>
  )
}

export function GameMancala({ storageKey }: { storageKey: string }) {
  // SSR-safe: nothing until the client mounts.
  const [state, setState] = useState<GameState | null>(null)
  const [displayPits, setDisplayPits] = useState<number[] | null>(null)
  const [mode, setMode] = useState<Mode>('cpu')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [record, setRecord] = useState<WinRecord>(EMPTY_RECORD)
  const [thinking, setThinking] = useState(false)
  // Reactive lock: true while a sow animates or the CPU thinks. Mirrors busyRef
  // (busyRef is the synchronous guard for handlers/timers; busy drives render).
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<{ pit: number; key: number } | null>(null)
  const [captureFx, setCaptureFx] = useState<{ pit: number; opposite: number; key: number } | null>(null)
  const [extraTurnFor, setExtraTurnFor] = useState<{ who: Player; key: number } | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const displayRef = useRef<number[]>([])
  const modeRef = useRef<Mode>('cpu')
  const difficultyRef = useRef<Difficulty>('medium')
  const recordRef = useRef<WinRecord>(EMPTY_RECORD)
  const busyRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const genRef = useRef(0)
  const pulseRef = useRef(0)

  const lock = useCallback((v: boolean) => {
    busyRef.current = v
    setBusy(v)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const setDisplay = useCallback((pits: number[]) => {
    displayRef.current = pits
    setDisplayPits(pits)
  }, [])

  const bumpRecord = useCallback(
    (key: keyof WinRecord) => {
      const next = { ...recordRef.current, [key]: recordRef.current[key] + 1 }
      recordRef.current = next
      setRecord(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // ignore storage failures (private mode / quota)
      }
    },
    [storageKey],
  )

  // End-of-game side effects (sound + record). `w` is the confirmed winner.
  const resolve = useCallback(
    (w: Winner) => {
      const humanWon = modeRef.current === 'cpu' ? w === HUMAN : w !== 'draw'
      if (w === 'draw') play('flip')
      else if (humanWon) play('win')
      else play('lose')
      if (modeRef.current === 'cpu') bumpRecord(w === HUMAN ? 'w' : w === CPU ? 'l' : 'd')
      // 개인 기록(트로피): 완료 1판 = plays++, 사람 승리만 wins++.
      recordResult(storageKey.replace(/^best:/, ''), { won: humanWon })
      lock(false)
      setThinking(false)
    },
    [bumpRecord, lock, play, storageKey],
  )

  const scheduleCpu = useCallback(() => {
    setThinking(true)
    const delay = reducedRef.current ? CPU_DELAY_REDUCED : CPU_DELAY
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      const s = stateRef.current
      if (!s || modeRef.current !== 'cpu' || s.turn !== CPU || winner(s) !== null) {
        setThinking(false)
        lock(false)
        return
      }
      const pit = aiMove(s, difficultyRef.current)
      setThinking(false)
      if (pit === null) {
        lock(false)
        return
      }
      runMoveRef.current(s, pit)
    }, delay)
  }, [clearTimer, lock, reducedRef])

  // Hand off after a move fully resolves: end the game, let the CPU reply, or
  // unlock the board for the (same or next) human.
  const finalizeMove = useCallback(
    (next: GameState) => {
      commit(next)
      const w = winner(next)
      if (w !== null) {
        resolve(w)
        return
      }
      if (modeRef.current === 'cpu' && next.turn === CPU) {
        scheduleCpu()
      } else {
        lock(false)
      }
    },
    [commit, lock, resolve, scheduleCpu],
  )

  // Animate a full move (sow one stone at a time, then capture / extra-turn),
  // committing the resulting state when the flourish finishes.
  const runMove = useCallback(
    (from: GameState, pit: number) => {
      const detail = moveDetail(from, pit)
      if (!detail) return
      setCaptureFx(null)
      setExtraTurnFor(null)
      lock(true)
      const gen = ++genRef.current
      const reduced = reducedRef.current
      const mover = from.turn
      const myStore = storeOf(mover)

      const work = [...from.pits]
      work[pit] = 0
      setDisplay([...work])
      setActive({ pit, key: ++pulseRef.current })

      const finish = () => {
        if (detail.capture) {
          const { pit: cp, opposite, gained } = detail.capture
          work[cp] = 0
          work[opposite] = 0
          work[myStore] += gained
          setCaptureFx({ pit: cp, opposite, key: ++pulseRef.current })
          play('match')
        }
        setDisplay([...detail.state.pits])
        setActive(null)
        if (detail.extraTurn) {
          setExtraTurnFor({ who: mover, key: ++pulseRef.current })
          play('flip')
        }
        const post = (detail.capture || detail.extraTurn) && !reduced ? FX_MS : 0
        clearTimer()
        timerRef.current = window.setTimeout(() => {
          if (genRef.current === gen) finalizeMove(detail.state)
        }, post)
      }

      if (reduced) {
        for (const idx of detail.path) work[idx] += 1
        setDisplay([...work])
        play('move')
        finish()
        return
      }

      let i = 0
      const stepOnce = () => {
        if (genRef.current !== gen) return
        if (i >= detail.path.length) {
          clearTimer()
          timerRef.current = window.setTimeout(() => {
            if (genRef.current === gen) finish()
          }, STEP_MS)
          return
        }
        const idx = detail.path[i]
        work[idx] += 1
        setDisplay([...work])
        setActive({ pit: idx, key: ++pulseRef.current })
        play('move')
        i += 1
        clearTimer()
        timerRef.current = window.setTimeout(stepOnce, STEP_MS)
      }
      stepOnce()
    },
    [clearTimer, finalizeMove, lock, play, reducedRef, setDisplay],
  )

  // scheduleCpu references runMove which references scheduleCpu — bridge via ref.
  const runMoveRef = useRef(runMove)
  useEffect(() => {
    runMoveRef.current = runMove
  }, [runMove])

  const onPit = useCallback(
    (i: number) => {
      const s = stateRef.current
      if (!s || busyRef.current || thinking || winner(s) !== null) return
      const turn = s.turn
      if (modeRef.current === 'cpu' && turn !== HUMAN) return
      if (!isOwnPit(turn, i) || s.pits[i] === 0) {
        play('error')
        return
      }
      runMove(s, i)
    },
    [play, runMove, thinking],
  )

  const restart = useCallback(() => {
    clearTimer()
    genRef.current += 1
    lock(false)
    setThinking(false)
    setActive(null)
    setCaptureFx(null)
    setExtraTurnFor(null)
    const g = newGame()
    commit(g)
    setDisplay(g.pits)
  }, [clearTimer, commit, lock, setDisplay])

  // Init on client + hydrate the W/L/D record.
  useEffect(() => {
    restart()
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WinRecord>
        const loaded: WinRecord = {
          w: Number(parsed.w) || 0,
          l: Number(parsed.l) || 0,
          d: Number(parsed.d) || 0,
        }
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
  useEffect(() => {
    difficultyRef.current = difficulty
  }, [difficulty])

  const changeMode = useCallback(
    (m: Mode) => {
      if (m === mode) return
      setMode(m)
      modeRef.current = m
      restart()
    },
    [mode, restart],
  )

  // ── Derived render data ──────────────────────────────────────────────────
  const win = state ? winner(state) : null
  const over = win !== null
  const turn = state ? state.turn : HUMAN
  const reduced = reducedRef.current

  // Pits the current player may pick right now.
  const pickable = useMemo(() => {
    const set = new Set<number>()
    if (!state || over || thinking || busy) return set
    if (mode === 'cpu' && turn !== HUMAN) return set
    for (const i of ownPits(turn)) if (state.pits[i] > 0) set.add(i)
    return set
  }, [state, over, thinking, busy, mode, turn])

  const youName = mode === 'two' ? 'Player 1' : 'You'
  const foeName = mode === 'two' ? 'Player 2' : 'CPU'

  const turnName = (p: Player): string => (p === HUMAN ? youName : foeName)

  const hint = over
    ? win === 'draw'
      ? "It's a draw — new game?"
      : mode === 'cpu'
        ? win === HUMAN
          ? 'You win! Start a new game.'
          : 'CPU wins. Try again!'
        : `${turnName(win)} wins! New game?`
    : thinking
      ? 'CPU is thinking…'
      : 'Tap one of your glowing pits. Stones sow counterclockwise — land your last stone in your store to go again.'

  const controls = (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <div className="flex rounded-lg bg-surface p-0.5" role="group" aria-label="Mode">
        {(['cpu', 'two'] as const).map((m) => (
          <button
            key={m}
            onClick={() => changeMode(m)}
            aria-pressed={mode === m}
            className={`btn-press rounded-md px-2 py-1 font-semibold ${
              mode === m ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {m === 'cpu' ? 'vs CPU' : '2 Player'}
          </button>
        ))}
      </div>
      {mode === 'cpu' && (
        <div className="flex rounded-lg bg-surface p-0.5" role="group" aria-label="Difficulty">
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              aria-pressed={difficulty === d}
              className={`btn-press rounded-md px-2 py-1 font-semibold capitalize ${
                difficulty === d ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const pits = displayPits ?? (state ? state.pits : Array<number>(14).fill(0))
  const youStore = pits[P0_STORE]
  const foeStore = pits[P1_STORE]

  const stats = [
    { label: 'Wins', value: record.w, testId: 'mancala-wins', float: true },
    { label: youName, value: youStore },
    { label: foeName, value: foeStore },
  ]

  if (!state || !displayPits) {
    return (
      <GameShell
        stats={[{ label: 'Wins', value: 0 }]}
        headerExtra={controls}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint="Sow your pits counterclockwise and collect the most stones in your store."
        maxWidthClassName="max-w-lg"
      >
        <div className="h-48 w-full rounded-xl bg-surface" data-testid="mancala-loading" />
      </GameShell>
    )
  }

  // A single small pit on the board.
  const renderPit = (i: number) => {
    const tone: 'you' | 'cpu' = isOwnPit(HUMAN, i) ? 'you' : 'cpu'
    const count = pits[i]
    const canPick = pickable.has(i)
    const isActive = active?.pit === i && !reduced
    const isCap = (captureFx?.pit === i || captureFx?.opposite === i) && !reduced
    const border = tone === 'you' ? 'border-neon-cyan/60' : 'border-neon-magenta/50'
    const bg = tone === 'you' ? 'bg-neon-cyan/5' : 'bg-neon-magenta/5'
    const ownerLabel = tone === 'you' ? youName : foeName
    const label = `${ownerLabel} pit, ${count} ${count === 1 ? 'stone' : 'stones'}${canPick ? ' — tap to sow' : ''}`

    const inner = (
      <span
        key={isActive ? `a${active?.key}` : 'static'}
        className="flex h-full w-full items-center justify-center"
        style={isActive ? { animation: 'mnc-drop 240ms cubic-bezier(0.34,1.3,0.6,1) both' } : undefined}
      >
        <Stones count={count} tone={tone} />
      </span>
    )

    const base = `relative flex aspect-square items-center justify-center rounded-full border-2 ${border} ${bg} transition-colors`
    const capStyle = isCap ? { animation: `mnc-cap 620ms ease-in-out both` } : undefined

    if (canPick) {
      return (
        <button
          key={i}
          onClick={() => onPit(i)}
          aria-label={label}
          className={`${base} cursor-pointer hover:brightness-125 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan`}
          style={{
            ...(capStyle ?? {}),
            ...(reduced ? {} : { animation: capStyle ? capStyle.animation : 'mnc-pick 1.8s ease-in-out infinite' }),
          }}
        >
          {inner}
        </button>
      )
    }
    return (
      <div key={i} aria-label={label} className={`${base} ${count === 0 ? 'opacity-70' : ''}`} style={capStyle}>
        {inner}
      </div>
    )
  }

  const Store = ({ who }: { who: Player }) => {
    const idx = storeOf(who)
    const count = pits[idx]
    const tone = who === HUMAN ? 'you' : 'cpu'
    const isTurn = turn === who && !over
    return (
      <div
        className={`flex w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 py-3 sm:w-16 ${
          tone === 'you'
            ? 'border-neon-cyan/70 bg-neon-cyan/10'
            : 'border-neon-magenta/60 bg-neon-magenta/10'
        } ${isTurn ? 'shadow-[0_0_16px_rgba(56,189,248,0.35)]' : ''}`}
        aria-label={`${who === HUMAN ? youName : foeName} store, ${count} ${count === 1 ? 'stone' : 'stones'}`}
      >
        <span
          className={`text-[11px] font-bold uppercase tracking-wide ${tone === 'you' ? 'text-neon-cyan' : 'text-neon-magenta'}`}
        >
          {who === HUMAN ? youName : foeName}
        </span>
        <span
          data-testid={who === HUMAN ? 'mancala-you-store' : 'mancala-cpu-store'}
          className={`text-2xl font-extrabold tabular-nums ${tone === 'you' ? 'text-neon-cyan' : 'text-neon-magenta'} drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]`}
        >
          {count}
        </span>
      </div>
    )
  }

  const overlayTitle =
    win === 'draw'
      ? "It's a draw"
      : mode === 'cpu'
        ? win === HUMAN
          ? 'You win!'
          : 'CPU wins'
        : `${turnName(win as Player)} wins!`
  const overlayVariant: 'win' | 'lose' = win === HUMAN || (mode === 'two' && win !== 'draw') ? 'win' : 'lose'
  const overlayTestId = win === 'draw' ? 'mancala-result-draw' : overlayVariant === 'win' ? 'mancala-result-win' : 'mancala-result-lose'

  return (
    <GameShell
      stats={stats}
      headerExtra={controls}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-lg"
    >
      <style>{MNC_STYLE}</style>

      {/* Whose turn — prominent, colour-coded, with the extra-turn cue. */}
      <div className="mb-2 flex items-center justify-center gap-2" aria-live="polite">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold ${
            over
              ? 'border-border text-fg-muted'
              : turn === HUMAN
                ? 'border-neon-cyan/70 bg-neon-cyan/10 text-neon-cyan'
                : 'border-neon-magenta/60 bg-neon-magenta/10 text-neon-magenta'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 rounded-full ${
              over ? 'bg-fg-muted' : turn === HUMAN ? 'bg-neon-cyan' : 'bg-neon-magenta'
            }`}
          />
          {over
            ? 'Game over'
            : thinking
              ? 'CPU is thinking…'
              : turnName(turn) === 'You'
                ? 'Your turn'
                : `${turnName(turn)}'s turn`}
        </span>
        {extraTurnFor && !over && (
          <span
            key={extraTurnFor.key}
            className="rounded-full bg-neon-amber/15 px-2.5 py-1 text-sm font-extrabold text-neon-amber"
            style={reduced ? undefined : { animation: 'mnc-badge 1.4s ease-out both' }}
          >
            ✦ Extra turn!
          </span>
        )}
      </div>

      <div className="anim-board-in select-none">
        <div
          data-testid="mancala-board"
          role="group"
          aria-label="Mancala board"
          className="flex items-stretch gap-2 rounded-2xl border border-border bg-bg-2/70 p-2 shadow-[inset_0_0_20px_rgba(0,0,0,0.45)] sm:gap-3 sm:p-3"
        >
          {/* Opponent store sits on the left (counterclockwise flow). */}
          <Store who={CPU} />

          <div className="min-w-0 flex-1">
            {/* Direction cue: each row's stones flow toward that player's store. */}
            <div className="mb-1 flex items-center px-1 text-[11px] font-semibold text-neon-magenta/70">
              <span aria-hidden="true">◂ {foeName} sows this way</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
              {TOP_ROW.map(renderPit)}
              {BOTTOM_ROW.map(renderPit)}
            </div>
            <div className="mt-1 flex items-center justify-end px-1 text-[11px] font-semibold text-neon-cyan/80">
              <span aria-hidden="true">{youName} sows this way ▸</span>
            </div>
          </div>

          {/* Your store on the right — your last stone drops in here. */}
          <Store who={HUMAN} />
        </div>

        <GameOverlay show={over && overlayVariant === 'win'} variant="win" title={overlayTitle} testId={overlayTestId}>
          <p className="text-sm text-fg-muted">
            {youStore}–{foeStore} stones
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>

        <GameOverlay show={over && overlayVariant === 'lose'} variant="lose" title={overlayTitle} testId={overlayTestId}>
          <p className="text-sm text-fg-muted">
            {youStore}–{foeStore} stones
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
