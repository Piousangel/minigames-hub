'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  aiMove,
  applyMove,
  counts,
  flipsFor,
  legalMoves,
  legalMovesFor,
  newGame,
  pass,
  SIZE,
  winner,
  type Color,
  type Coord,
  type Difficulty,
  type GameState,
} from '@/lib/games/reversi/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Player is dark ('D') and moves first; the computer is light ('L').
const PLAYER: Color = 'D'
const CPU: Color = 'L'

const CPU_DELAY = 620
const CPU_DELAY_REDUCED = 220
const PASS_DELAY = 900
const PASS_DELAY_REDUCED = 300

interface WinRecord {
  w: number // player wins
  l: number // computer wins
  d: number // draws (ties)
}
const EMPTY_RECORD: WinRecord = { w: 0, l: 0, d: 0 }

// Per-cell flip metadata so we can animate the flanked discs turning over. `key`
// re-triggers the CSS animation; `delay` staggers a ripple out from the drop.
interface FlipInfo {
  color: Color
  delay: number
}

// Component-scoped keyframes — globals.css stays untouched.
const RV_STYLE = `
@keyframes rv-place {
  0%   { transform: scale(0.2); opacity: 0; }
  55%  { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes rv-flip {
  0%   { transform: rotateY(0deg); }
  50%  { transform: rotateY(90deg); }
  100% { transform: rotateY(180deg); }
}
@keyframes rv-dot {
  0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.15; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0.85; }
}
@keyframes rv-glow {
  0%, 100% { box-shadow: 0 0 0 rgba(74, 222, 128, 0); }
  50%      { box-shadow: 0 0 14px rgba(74, 222, 128, 0.55); }
}`

const keyOf = (r: number, c: number): string => `${r},${c}`
const isCorner = (r: number, c: number): boolean => (r === 0 || r === SIZE - 1) && (c === 0 || c === SIZE - 1)

const rows = Array.from({ length: SIZE }, (_, i) => i)
const cols = Array.from({ length: SIZE }, (_, i) => i)

function discLabel(color: Color): string {
  return color === PLAYER ? 'your dark disc' : 'computer light disc'
}

export function GameReversi({ storageKey }: { storageKey: string }) {
  // SSR-safe: no board until the client mounts.
  const [state, setState] = useState<GameState | null>(null)
  const [record, setRecord] = useState<WinRecord>(EMPTY_RECORD)
  const [difficulty, setDifficulty] = useState<Difficulty>('hard')
  const [thinking, setThinking] = useState(false)
  const [passNote, setPassNote] = useState<string | null>(null)
  // Discs flipped by the most recent move, keyed by cell (for the flip anim).
  const [flips, setFlips] = useState<Map<string, FlipInfo>>(new Map())
  // The cell most recently placed (for the pop-in animation).
  const [placed, setPlaced] = useState<string | null>(null)
  const [animKey, setAnimKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const recordRef = useRef<WinRecord>(EMPTY_RECORD)
  const difficultyRef = useRef<Difficulty>('hard')
  const busyRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const commit = useCallback((s: GameState) => {
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
    (key: keyof WinRecord) => {
      const next = { ...recordRef.current, [key]: recordRef.current[key] + 1 }
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

  // End-of-game side effects (sound + record). Returns true if terminal.
  const resolve = useCallback(
    (s: GameState): boolean => {
      const win = winner(s)
      if (win === null) return false
      if (win === PLAYER) {
        play('win')
        bumpRecord('w')
      } else if (win === CPU) {
        play('lose')
        bumpRecord('l')
      } else {
        play('flip')
        bumpRecord('d')
      }
      // 개인 기록: 완료 판수/승수 누적(무승부는 패로 집계) → 스탯 패널이 읽는다.
      recordResult(storageKey.replace(/^best:/, ''), { won: win === PLAYER })
      busyRef.current = false
      setThinking(false)
      return true
    },
    [bumpRecord, play, storageKey],
  )

  // Register the flip animation for a move's flipped discs + the placed disc.
  const animateMove = useCallback((prev: GameState, cell: Coord, flipped: Coord[]) => {
    const [pr, pc] = cell
    const map = new Map<string, FlipInfo>()
    for (const [fr, fc] of flipped) {
      const dist = Math.max(Math.abs(fr - pr), Math.abs(fc - pc))
      map.set(keyOf(fr, fc), { color: prev.turn, delay: dist * 55 })
    }
    setFlips(map)
    setPlaced(keyOf(pr, pc))
    setAnimKey((k) => k + 1)
  }, [])

  // Whether `color` can move on the given state's board.
  const canMove = useCallback((s: GameState, color: Color): boolean => legalMovesFor(s.board, color).length > 0, [])

  // Advance the game after a disc was placed: resolve end, run the CPU, or pass.
  const advance = useCallback(
    (s: GameState) => {
      if (resolve(s)) return

      if (s.turn === CPU) {
        if (!canMove(s, CPU)) {
          // Computer must pass — bounce straight back to the player.
          setPassNote('Computer has no move — pass')
          const passed = pass(s)
          commit(passed)
          busyRef.current = false
          setThinking(false)
          return
        }
        busyRef.current = true
        setThinking(true)
        const delay = reducedRef.current ? CPU_DELAY_REDUCED : CPU_DELAY
        clearTimer()
        timerRef.current = window.setTimeout(() => {
          const cur = stateRef.current
          if (!cur || cur.turn !== CPU) return
          const cell = aiMove(cur, difficultyRef.current, Math.random)
          if (cell) {
            const flipped = flipsFor(cur.board, CPU, cell)
            const next = applyMove(cur, cell)
            animateMove(cur, cell, flipped)
            play('move')
            if (flipped.length) play('flip')
            commit(next)
            setThinking(false)
            advance(next)
          } else {
            busyRef.current = false
            setThinking(false)
          }
        }, delay)
        return
      }

      // Player's turn — if the player is stuck, auto-pass to the computer.
      if (!canMove(s, PLAYER)) {
        setPassNote('You have no move — pass')
        busyRef.current = true
        const delay = reducedRef.current ? PASS_DELAY_REDUCED : PASS_DELAY
        clearTimer()
        timerRef.current = window.setTimeout(() => {
          const passed = pass(s)
          commit(passed)
          advance(passed)
        }, delay)
        return
      }
      busyRef.current = false
    },
    [animateMove, canMove, clearTimer, commit, play, reducedRef, resolve],
  )

  const onCell = useCallback(
    (r: number, c: number) => {
      const s = stateRef.current
      if (!s || busyRef.current || s.turn !== PLAYER || winner(s) !== null) return
      const flipped = flipsFor(s.board, PLAYER, [r, c])
      if (flipped.length === 0) {
        play('error')
        return
      }
      setPassNote(null)
      const next = applyMove(s, [r, c])
      animateMove(s, [r, c], flipped)
      play('move')
      if (flipped.length) play('flip')
      commit(next)
      advance(next)
    },
    [advance, animateMove, commit, play],
  )

  const restart = useCallback(() => {
    clearTimer()
    busyRef.current = false
    setThinking(false)
    setPassNote(null)
    setFlips(new Map())
    setPlaced(null)
    commit(newGame())
  }, [clearTimer, commit])

  // Init on client + hydrate the wins record.
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
    difficultyRef.current = difficulty
  }, [difficulty])

  // ── Derived render data ──────────────────────────────────────────────────
  const win = state ? winner(state) : null
  const over = win !== null
  const discs = state ? counts(state.board) : { D: 0, L: 0 }
  const majorityColor: Color | null = discs.D === discs.L ? null : discs.D > discs.L ? 'D' : 'L'

  const legalKeys = useMemo(() => {
    if (!state || over || state.turn !== PLAYER) return new Set<string>()
    const set = new Set<string>()
    for (const [r, c] of legalMoves(state)) set.add(keyOf(r, c))
    return set
  }, [state, over])

  const hint = over
    ? win === PLAYER
      ? 'You win! Start a new game.'
      : win === CPU
        ? 'Computer wins. Try again!'
        : "It's a tie! Start a new game."
    : thinking
      ? 'Computer is thinking…'
      : passNote
        ? passNote
        : state && state.turn === PLAYER
          ? "Your turn — tap a highlighted square to trap and flip the computer's discs. Most discs at the end wins."
          : 'Waiting…'

  const difficultyToggle = (
    <div className="flex rounded-lg bg-surface p-0.5 text-sm" role="group" aria-label="Difficulty">
      {(['easy', 'hard'] as const).map((d) => (
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

  const stats = [
    { label: 'Wins', value: record.w, testId: 'reversi-wins', float: true },
    { label: 'You', value: discs.D },
    { label: 'CPU', value: discs.L },
  ]

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'Wins', value: 0 }]}
        headerExtra={difficultyToggle}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint="Tap a highlighted square to trap and flip the computer's discs. Most discs at the end wins."
        maxWidthClassName="max-w-md"
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="reversi-loading" />
      </GameShell>
    )
  }

  const reduced = reducedRef.current

  return (
    <GameShell
      stats={stats}
      headerExtra={difficultyToggle}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-md"
    >
      <style>{RV_STYLE}</style>
      <div className="anim-board-in relative select-none">
        <div
          data-testid="reversi-board"
          role="grid"
          aria-label="Reversi board"
          className="grid aspect-square w-full grid-cols-8 gap-[2px] overflow-hidden rounded-xl border border-border bg-emerald-950/70 p-[2px] shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]"
        >
          {rows.map((r) =>
            cols.map((c) => {
              const k = keyOf(r, c)
              const cell = state.board[r][c]
              const isLegal = legalKeys.has(k)
              const flip = flips.get(k)
              const justPlaced = placed === k && !reduced
              const glow = over && !!cell && majorityColor === cell && !reduced

              const label = cell
                ? `Row ${r + 1}, column ${c + 1}, ${discLabel(cell)}`
                : `Row ${r + 1}, column ${c + 1}, empty${isLegal ? ' — play here' : ''}`

              const clickable = isLegal && !over && state.turn === PLAYER && !thinking

              // Disc colour classes. During a flip we start on the OLD colour
              // (opposite of the new) and rotate to reveal the new face.
              const discClass = (color: Color): string =>
                color === PLAYER
                  ? 'bg-gradient-to-br from-slate-700 to-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_2px_3px_rgba(255,255,255,0.18)]'
                  : 'bg-gradient-to-br from-slate-100 to-slate-400 shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_2px_3px_rgba(255,255,255,0.7)]'

              return (
                <button
                  key={k}
                  role="gridcell"
                  aria-label={label}
                  disabled={!clickable}
                  onClick={() => onCell(r, c)}
                  className={`relative flex aspect-square w-full items-center justify-center bg-emerald-800/60 transition-colors disabled:cursor-default ${
                    clickable ? 'cursor-pointer hover:bg-emerald-700/70' : ''
                  } focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan`}
                >
                  {isLegal && !cell && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-1/2 top-1/2 h-1/4 w-1/4 rounded-full bg-neon-green/70"
                      style={reduced ? { transform: 'translate(-50%,-50%)' } : { animation: 'rv-dot 200ms ease-out both' }}
                    />
                  )}
                  {cell && (
                    <span
                      key={flip && !reduced ? `flip-${animKey}` : justPlaced ? `place-${animKey}` : 'static'}
                      aria-hidden="true"
                      className={`absolute inset-[12%] rounded-full ${discClass(cell)} ${glow ? 'ring-1 ring-neon-green/60' : ''}`}
                      style={
                        flip && !reduced
                          ? ({
                              animation: `rv-flip 320ms ease-in-out ${flip.delay}ms both`,
                              transformStyle: 'preserve-3d',
                            } as React.CSSProperties)
                          : justPlaced
                            ? { animation: 'rv-place 260ms cubic-bezier(0.34,1.2,0.64,1) both' }
                            : glow
                              ? { animation: 'rv-glow 1.6s ease-in-out infinite' }
                              : undefined
                      }
                    />
                  )}
                  {isCorner(r, c) && !cell && (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-amber-400/20" />
                  )}
                </button>
              )
            }),
          )}
        </div>

        <GameOverlay show={over && win === PLAYER} variant="win" title="You win!" testId="reversi-result-win">
          <p className="text-sm text-fg-muted">
            {discs.D}–{discs.L} discs
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>

        <GameOverlay show={over && win === CPU} variant="lose" title="Computer wins" testId="reversi-result-lose">
          <p className="text-sm text-fg-muted">
            {discs.D}–{discs.L} discs
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>

        <GameOverlay show={over && win === 'tie'} variant="lose" title="It's a tie" testId="reversi-result-tie">
          <p className="text-sm text-fg-muted">
            {discs.D}–{discs.L} discs
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
