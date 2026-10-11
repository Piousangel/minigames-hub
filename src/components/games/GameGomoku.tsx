'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  aiMove,
  mulberry32,
  newGame,
  place,
  SIZE,
  type Difficulty,
  type Player,
  type State,
} from '@/lib/games/gomoku/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'cpu' | 'two'

const CPU_DELAY = 360
const CPU_DELAY_REDUCED = 140

const cells = Array.from({ length: SIZE * SIZE }, (_, i) => i)
const linePos = Array.from({ length: SIZE }, (_, i) => i + 0.5) // grid line at each intersection

export function GameGomoku({ storageKey }: { storageKey: string }) {
  const slug = storageKey.replace(/^best:/, '')

  // SSR-safe: nothing until the client mounts.
  const [state, setState] = useState<State | null>(null)
  const [history, setHistory] = useState<State[]>([])
  const [mode, setMode] = useState<Mode>('cpu')
  const [playerColor, setPlayerColor] = useState<Player>(1) // human's stone in vs-CPU
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [wins, setWins] = useState(0)
  const [thinking, setThinking] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<State | null>(null)
  const historyRef = useRef<State[]>([])
  const modeRef = useRef<Mode>('cpu')
  const colorRef = useRef<Player>(1)
  const difficultyRef = useRef<Difficulty>('medium')
  const winsRef = useRef(0)
  const thinkingRef = useRef(false)
  const recordedRef = useRef(false)
  const seedRef = useRef(1)
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const commit = useCallback((s: State, hist: State[]) => {
    stateRef.current = s
    historyRef.current = hist
    setState(s)
    setHistory(hist)
  }, [])

  const bumpWins = useCallback(() => {
    const next = winsRef.current + 1
    winsRef.current = next
    setWins(next)
    try {
      localStorage.setItem(storageKey, String(next))
    } catch {
      // ignore storage failures (private mode, quota)
    }
  }, [storageKey])

  // End-of-game side effects (sound + record), fired exactly once per game.
  const resolve = useCallback(
    (s: State) => {
      if (s.status === 'playing' || recordedRef.current) return
      recordedRef.current = true
      // 2-player is a local hot-seat game: one person can play both sides, so it
      // never feeds the vs-CPU Wins counter, best:<slug> (leaderboard) or stats.
      if (modeRef.current === 'two') {
        play(s.status === 'won' ? 'win' : 'lose')
        return
      }
      const humanWon = s.status === 'won' && s.winner === colorRef.current
      play(humanWon ? 'win' : 'lose')
      if (humanWon) bumpWins()
      recordResult(slug, { won: humanWon })
    },
    [bumpWins, play, slug],
  )

  // Apply a move to the live state. Returns the resulting state, or the same
  // reference if illegal (so callers can detect a no-op).
  const doPlace = useCallback(
    (index: number): State => {
      const s = stateRef.current
      if (!s) return newGame()
      const next = place(s, index)
      if (next === s) return s
      play('move')
      const hist = [...historyRef.current, s]
      commit(next, hist)
      resolve(next)
      return next
    },
    [commit, play, resolve],
  )

  const scheduleCpu = useCallback(() => {
    clearTimer()
    const delay = reducedRef.current ? CPU_DELAY_REDUCED : CPU_DELAY
    timerRef.current = window.setTimeout(() => {
      const s = stateRef.current
      if (s && s.status === 'playing' && modeRef.current === 'cpu' && s.turn !== colorRef.current) {
        // Deterministic engine RNG, but varied per game/position via the seed.
        const rng = mulberry32((seedRef.current ^ Math.imul(s.moves + 1, 2654435761)) >>> 0)
        const move = aiMove(s, s.turn, difficultyRef.current, rng)
        if (move >= 0) doPlace(move)
      }
      thinkingRef.current = false
      setThinking(false)
    }, delay)
  }, [clearTimer, doPlace, reducedRef])

  const humanToMove = useCallback((): boolean => {
    const s = stateRef.current
    if (!s || s.status !== 'playing' || thinkingRef.current) return false
    return modeRef.current === 'two' || s.turn === colorRef.current
  }, [])

  const onCell = useCallback(
    (index: number) => {
      const s = stateRef.current
      if (!s || s.status !== 'playing') return
      if (!humanToMove()) return
      if (s.board[index] !== 0) {
        play('error')
        return
      }
      const next = doPlace(index)
      if (next === s || next.status !== 'playing') return
      if (modeRef.current === 'cpu') {
        thinkingRef.current = true
        setThinking(true)
        scheduleCpu()
      }
    },
    [doPlace, humanToMove, play, scheduleCpu],
  )

  const restart = useCallback(() => {
    clearTimer()
    thinkingRef.current = false
    setThinking(false)
    recordedRef.current = false
    const fresh = newGame()
    commit(fresh, [])
    // If the human chose White in vs-CPU, the computer (Black) opens.
    if (modeRef.current === 'cpu' && colorRef.current === 2) {
      thinkingRef.current = true
      setThinking(true)
      scheduleCpu()
    }
  }, [clearTimer, commit, scheduleCpu])

  const undo = useCallback(() => {
    if (thinkingRef.current) return
    // A decided game is final: undoing it would let the same win be recorded
    // again (and again) by replaying the winning move.
    if (stateRef.current?.status !== 'playing') return
    const hist = historyRef.current
    if (hist.length === 0) return
    let steps = 1
    // In vs-CPU, take back the whole pair so it stays the human's turn.
    if (modeRef.current === 'cpu' && hist.length >= 2) steps = 2
    const target = hist.length - steps
    if (target < 0) return
    const prev = hist[target]
    commit(prev, hist.slice(0, target))
    clearTimer()
    thinkingRef.current = false
    setThinking(false)
  }, [clearTimer, commit])

  // Init on client + hydrate the wins counter.
  useEffect(() => {
    seedRef.current = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
    restart()
    try {
      const raw = localStorage.getItem(storageKey)
      const n = raw ? Number(raw) : 0
      if (Number.isFinite(n) && n >= 0) {
        winsRef.current = n
        setWins(n)
      }
    } catch {
      // ignore malformed storage
    }
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep refs in sync.
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    colorRef.current = playerColor
  }, [playerColor])
  useEffect(() => {
    difficultyRef.current = difficulty
  }, [difficulty])

  // Keyboard: N new, U undo, Esc.
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
        ;(document.activeElement as HTMLElement | null)?.blur?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [restart, undo])

  const changeMode = (m: Mode) => {
    if (m === mode) return
    modeRef.current = m
    setMode(m)
    restart()
  }
  const changeColor = (c: Player) => {
    if (c === playerColor) return
    colorRef.current = c
    setPlayerColor(c)
    restart()
  }
  const changeDifficulty = (d: Difficulty) => {
    if (d === difficulty) return
    difficultyRef.current = d
    setDifficulty(d)
  }

  const winSet = useMemo(() => new Set(state?.winLine ?? []), [state])

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
        <>
          <div className="flex rounded-lg bg-surface p-0.5" role="group" aria-label="Your colour">
            {([1, 2] as const).map((c) => (
              <button
                key={c}
                onClick={() => changeColor(c)}
                aria-pressed={playerColor === c}
                className={`btn-press rounded-md px-2 py-1 font-semibold ${
                  playerColor === c ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {c === 1 ? 'Black' : 'White'}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg bg-surface p-0.5" role="group" aria-label="Difficulty">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => changeDifficulty(d)}
                aria-pressed={difficulty === d}
                className={`btn-press rounded-md px-2 py-1 font-semibold capitalize ${
                  difficulty === d ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'Wins', value: 0 }]}
        headerExtra={controls}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint="Get five in a row to win."
        maxWidthClassName="max-w-lg"
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="gomoku-loading" />
      </GameShell>
    )
  }

  const over = state.status !== 'playing'
  const humanWon = state.status === 'won' && (mode === 'two' || state.winner === playerColor)
  const turnLabel = state.turn === 1 ? 'Black' : 'White'

  const hint = over
    ? state.status === 'draw'
      ? "It's a draw — the board is full."
      : mode === 'two'
        ? `${state.winner === 1 ? 'Black' : 'White'} wins!`
        : humanWon
          ? 'You win! Five in a row.'
          : 'Computer wins. Try again!'
    : thinking
      ? 'Computer is thinking…'
      : mode === 'two'
        ? `${turnLabel} to move — tap an intersection.`
        : `Your move (${playerColor === 1 ? 'Black' : 'White'}) — tap an intersection.`

  const canPlay = !over && (mode === 'two' || (state.turn === playerColor && !thinking))

  return (
    <GameShell
      stats={[
        { label: 'Wins', value: wins, testId: 'gomoku-wins', float: true },
        { label: 'Moves', value: state.moves },
      ]}
      headerExtra={controls}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-lg"
    >
      <div className="anim-board-in relative">
        <div
          data-testid="gomoku-board"
          className="relative mx-auto aspect-square w-full touch-manipulation rounded-lg border border-border bg-[#1a1830] p-[3.33%] shadow-[inset_0_0_24px_rgba(0,0,0,0.5)]"
        >
          {/* Grid lines — drawn at intersection centres, stretched to the board. */}
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-[3.33%] h-[93.33%] w-[93.33%]"
            aria-hidden="true"
          >
            {linePos.map((p) => (
              <line
                key={`h${p}`}
                x1={0.5}
                y1={p}
                x2={SIZE - 0.5}
                y2={p}
                stroke="rgba(120,200,255,0.28)"
                strokeWidth={0.04}
              />
            ))}
            {linePos.map((p) => (
              <line
                key={`v${p}`}
                x1={p}
                y1={0.5}
                x2={p}
                y2={SIZE - 0.5}
                stroke="rgba(120,200,255,0.28)"
                strokeWidth={0.04}
              />
            ))}
          </svg>

          {/* Intersections — one button per cell, centred on the grid crossings. */}
          <div
            className="absolute inset-[3.33%] grid h-[93.33%] w-[93.33%]"
            style={{
              gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${SIZE}, 1fr)`,
            }}
          >
            {cells.map((i) => {
              const stone = state.board[i]
              const isLast = state.last === i
              const isWin = winSet.has(i)
              const r = Math.floor(i / SIZE)
              const c = i % SIZE
              return (
                <button
                  key={i}
                  onClick={() => onCell(i)}
                  disabled={!canPlay || stone !== 0}
                  aria-label={`Row ${r + 1}, column ${c + 1}${
                    stone === 1 ? ', Black stone' : stone === 2 ? ', White stone' : ', empty'
                  }`}
                  className="group relative flex items-center justify-center focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-neon-cyan disabled:cursor-default"
                >
                  {stone === 0 && canPlay && (
                    <span
                      aria-hidden="true"
                      className="absolute h-[44%] w-[44%] rounded-full bg-neon-cyan/0 transition-colors group-hover:bg-neon-cyan/25"
                    />
                  )}
                  {stone !== 0 && (
                    <span
                      aria-hidden="true"
                      className={`absolute h-[78%] w-[78%] rounded-full ${
                        reducedRef.current ? '' : 'anim-pop'
                      } ${
                        stone === 1
                          ? 'bg-[radial-gradient(circle_at_32%_28%,#3a4a6a,#0a0e1c_78%)] shadow-[0_1px_3px_rgba(0,0,0,0.7),0_0_7px_rgba(80,200,255,0.55)]'
                          : 'bg-[radial-gradient(circle_at_32%_28%,#ffffff,#c9c2e0_78%)] shadow-[0_1px_3px_rgba(0,0,0,0.6),0_0_8px_rgba(255,120,220,0.6)]'
                      } ${
                        isWin
                          ? 'z-10 ring-2 ring-neon-amber ' +
                            (reducedRef.current ? '' : 'anim-pulse') +
                            ' shadow-[0_0_14px_rgba(255,235,120,0.95)]'
                          : isLast
                            ? 'ring-2 ring-neon-cyan/70'
                            : ''
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <GameOverlay
          show={over && (mode === 'two' ? state.status === 'won' : humanWon)}
          variant="win"
          title={mode === 'two' ? `${state.winner === 1 ? 'Black' : 'White'} wins!` : 'You win!'}
          testId="gomoku-result-win"
        >
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>

        <GameOverlay
          show={over && mode === 'cpu' && state.status === 'won' && !humanWon}
          variant="lose"
          title="Computer wins"
          testId="gomoku-result-lose"
        >
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>

        <GameOverlay show={over && state.status === 'draw'} variant="lose" title="Draw" testId="gomoku-result-draw">
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>

      <div className="mt-3 flex justify-center gap-2">
        <GameButton onClick={undo} disabled={history.length === 0 || thinking || over} className="px-3 py-1.5 text-sm">
          Undo
        </GameButton>
      </div>
    </GameShell>
  )
}
