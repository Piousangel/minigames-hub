'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  aiMove,
  applyMove,
  counts,
  isDark,
  legalMoves,
  newGame,
  SIZE,
  winner,
  type Color,
  type Coord,
  type Difficulty,
  type GameState,
  type Move,
} from '@/lib/games/checkers/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Player is red (bottom), computer is black (top).
const PLAYER: Color = 'r'
const CPU: Color = 'b'

const CPU_DELAY = 620
const CPU_DELAY_REDUCED = 240

interface WinRecord {
  w: number // player wins
  l: number // computer wins
}
const EMPTY_RECORD: WinRecord = { w: 0, l: 0 }

// Track the last landing so we can slide + pop it. `key` re-triggers the anim.
interface LastLand {
  row: number
  col: number
  dRow: number // origin - dest, in cell steps (for the slide-in transform)
  dCol: number
  key: number
  promoted: boolean
}

// Component-scoped keyframes so globals.css stays untouched. One cell step is
// ~130% of a piece's own box (pieces sit inset inside their square).
const CHK_STYLE = `
@keyframes chk-land {
  0%   { transform: translate(var(--chk-dx), var(--chk-dy)) scale(1); }
  82%  { transform: translate(0, 0) scale(1); }
  100% { transform: translate(0, 0) scale(1); }
}
@keyframes chk-pop {
  0%   { transform: scale(0.4); opacity: 0; }
  60%  { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes chk-crown {
  0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
  60%  { transform: scale(1.3) rotate(8deg); opacity: 1; }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
@keyframes chk-dot {
  0%   { transform: scale(0.5); opacity: 0.2; }
  100% { transform: scale(1); opacity: 1; }
}`

const coordEq = (a: Coord, b: Coord): boolean => a[0] === b[0] && a[1] === b[1]
const keyOf = (r: number, c: number): string => `${r},${c}`

const rows = Array.from({ length: SIZE }, (_, i) => i)
const cols = Array.from({ length: SIZE }, (_, i) => i)

function pieceLabel(color: Color, king: boolean): string {
  const name = color === PLAYER ? 'your' : 'computer'
  return `${name} ${king ? 'king' : 'man'}`
}

export function GameCheckers({ storageKey }: { storageKey: string }) {
  // SSR-safe: no board until the client mounts.
  const [state, setState] = useState<GameState | null>(null)
  const [record, setRecord] = useState<WinRecord>(EMPTY_RECORD)
  const [difficulty, setDifficulty] = useState<Difficulty>('hard')
  const [thinking, setThinking] = useState(false)
  const [selected, setSelected] = useState<Coord | null>(null)
  // Mid multi-jump: the chains still consistent with the hops taken, and which
  // hop index comes next. When non-null the player is forced to keep jumping.
  const [chain, setChain] = useState<{ remaining: Move[]; step: number } | null>(null)
  const [lastLand, setLastLand] = useState<LastLand | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const recordRef = useRef<WinRecord>(EMPTY_RECORD)
  const difficultyRef = useRef<Difficulty>('hard')
  const thinkingRef = useRef(false)
  const landKeyRef = useRef(0)
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
      if (!win) return false
      if (win === PLAYER) {
        play('win')
        bumpRecord('w')
      } else {
        play('lose')
        bumpRecord('l')
      }
      // 개인 기록: 완료 판수/승수 누적 → 스탯 패널이 읽는다.
      recordResult(storageKey.replace(/^best:/, ''), { won: win === PLAYER })
      return true
    },
    [bumpRecord, play, storageKey],
  )

  const setLand = useCallback((from: Coord, to: Coord, promoted: boolean) => {
    setLastLand({
      row: to[0],
      col: to[1],
      dRow: from[0] - to[0],
      dCol: from[1] - to[1],
      key: ++landKeyRef.current,
      promoted,
    })
  }, [])

  // Apply a complete move (used for the computer + simple player moves).
  const playFull = useCallback(
    (s: GameState, move: Move) => {
      const next = applyMove(s, move)
      const captured = move.captures.length > 0
      const to = move.path[move.path.length - 1]
      const landed = next.board[to[0]][to[1]]
      const promoted = !!landed && landed.king && !s.board[move.from[0]][move.from[1]]?.king
      setLand(move.from, to, promoted)
      if (captured) play('eat')
      else play('move')
      if (promoted) play('match')
      commit(next)
      return next
    },
    [commit, play, setLand],
  )

  const scheduleCpu = useCallback(() => {
    clearTimer()
    const delay = reducedRef.current ? CPU_DELAY_REDUCED : CPU_DELAY
    timerRef.current = window.setTimeout(() => {
      const s = stateRef.current
      if (s && s.turn === CPU && !winner(s)) {
        const move = aiMove(s, difficultyRef.current, Math.random)
        if (move) {
          const next = playFull(s, move)
          resolve(next)
        }
      }
      thinkingRef.current = false
      setThinking(false)
    }, delay)
  }, [clearTimer, playFull, reducedRef, resolve])

  const startCpuTurn = useCallback(() => {
    thinkingRef.current = true
    setThinking(true)
    scheduleCpu()
  }, [scheduleCpu])

  // Advance one hop of the player's move. Handles both simple moves and the
  // step-by-step multi-jump prompt.
  const stepPlayer = useCallback(
    (dest: Coord) => {
      const s = stateRef.current
      if (!s || thinkingRef.current || s.turn !== PLAYER || winner(s) || !selected) return

      const step = chain ? chain.step : 0
      const pool = chain ? chain.remaining : legalMoves(s).filter((m) => coordEq(m.from, selected))
      const candidates = pool.filter((m) => m.path.length > step && coordEq(m.path[step], dest))
      if (candidates.length === 0) return

      const from: Coord = selected
      const capturing = candidates[0].captures.length > step
      const done = candidates.every((m) => m.path.length === step + 1)

      // Build the intermediate board for this single hop (turn stays PLAYER).
      const board = s.board.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
      const piece = board[from[0]][from[1]]
      if (!piece) return
      board[from[0]][from[1]] = null
      if (capturing) {
        const cap = candidates[0].captures[step]
        board[cap[0]][cap[1]] = null
      }
      let promoted = false
      if (done && !piece.king) {
        const backRow = piece.color === 'r' ? 0 : SIZE - 1
        if (dest[0] === backRow) promoted = true
      }
      board[dest[0]][dest[1]] = { color: piece.color, king: piece.king || promoted }

      setLand(from, dest, promoted)
      if (capturing) play('eat')
      else play('move')
      if (promoted) play('match')

      if (done) {
        const next: GameState = { board, turn: CPU }
        commit(next)
        setSelected(null)
        setChain(null)
        if (!resolve(next)) startCpuTurn()
      } else {
        // More jumps required — keep the turn, force continuation from `dest`.
        commit({ board, turn: PLAYER })
        setSelected(dest)
        setChain({ remaining: candidates, step: step + 1 })
      }
    },
    [chain, commit, play, resolve, selected, setLand, startCpuTurn],
  )

  // Handle a click on any dark square.
  const onSquare = useCallback(
    (r: number, c: number) => {
      const s = stateRef.current
      if (!s || thinkingRef.current || s.turn !== PLAYER || winner(s)) return
      const target: Coord = [r, c]

      // If it's a legal destination for the current selection, move there.
      if (selected) {
        const step = chain ? chain.step : 0
        const pool = chain ? chain.remaining : legalMoves(s).filter((m) => coordEq(m.from, selected))
        if (pool.some((m) => m.path.length > step && coordEq(m.path[step], target))) {
          stepPlayer(target)
          return
        }
      }
      // Otherwise (only when not locked into a multi-jump) try selecting a piece.
      if (chain) return
      const piece = s.board[r][c]
      if (piece && piece.color === PLAYER) {
        const has = legalMoves(s).some((m) => coordEq(m.from, target))
        setSelected(has ? target : null)
      } else {
        setSelected(null)
      }
    },
    [chain, selected, stepPlayer],
  )

  const restart = useCallback(() => {
    clearTimer()
    thinkingRef.current = false
    setThinking(false)
    setSelected(null)
    setChain(null)
    setLastLand(null)
    commit(newGame())
  }, [clearTimer, commit])

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
    difficultyRef.current = difficulty
  }, [difficulty])

  // ── Derived render data ──────────────────────────────────────────────────
  const win = state ? winner(state) : null
  const over = !!win
  const pieceCounts = state ? counts(state.board) : { r: 0, b: 0, rKings: 0, bKings: 0 }

  // Squares the current selection can move to (first/next hop).
  const destKeys = useMemo(() => {
    if (!state || !selected || over) return new Set<string>()
    const step = chain ? chain.step : 0
    const pool = chain ? chain.remaining : legalMoves(state).filter((m) => coordEq(m.from, selected))
    const set = new Set<string>()
    for (const m of pool) if (m.path.length > step) set.add(keyOf(m.path[step][0], m.path[step][1]))
    return set
  }, [state, selected, chain, over])

  // Pieces the player may pick up this turn (mandatory-capture already filters).
  const movableKeys = useMemo(() => {
    if (!state || over || state.turn !== PLAYER || chain) return new Set<string>()
    const set = new Set<string>()
    for (const m of legalMoves(state)) set.add(keyOf(m.from[0], m.from[1]))
    return set
  }, [state, over, chain])

  const hint = over
    ? win === PLAYER
      ? 'You win! Start a new game.'
      : 'Computer wins. Try again!'
    : thinking
      ? 'Computer is thinking…'
      : chain
        ? 'Keep jumping — you must finish the capture.'
        : selected
          ? 'Tap a highlighted square to move.'
          : 'Your turn — tap one of your pieces.'

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
    { label: 'Wins', value: record.w, testId: 'checkers-wins', float: true },
    { label: 'Losses', value: record.l },
    { label: 'Red', value: pieceCounts.r },
    { label: 'Black', value: pieceCounts.b },
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
        hint="Tap one of your pieces to begin."
        maxWidthClassName="max-w-md"
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="checkers-loading" />
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
      <style>{CHK_STYLE}</style>
      <div className="anim-board-in relative select-none">
        <div
          data-testid="checkers-board"
          role="grid"
          aria-label="Checkers board"
          className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl border border-border bg-surface shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]"
        >
          {rows.map((r) =>
            cols.map((c) => {
              const dark = isDark(r, c)
              const cell = state.board[r][c]
              const k = keyOf(r, c)
              const isSel = !!selected && selected[0] === r && selected[1] === c
              const isDest = destKeys.has(k)
              const isMovable = movableKeys.has(k)
              const justLanded =
                !!lastLand && lastLand.row === r && lastLand.col === c && !reduced

              const squareBg = dark ? 'bg-bg/70' : 'bg-surface/40'
              const label = cell
                ? `Row ${r + 1}, column ${c + 1}, ${pieceLabel(cell.color, cell.king)}`
                : `Row ${r + 1}, column ${c + 1}, ${dark ? 'empty dark square' : 'light square'}`

              const clickable = dark && !over && state.turn === PLAYER && (isDest || (!chain && isMovable))

              const inner = (
                <>
                  {isDest && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                        cell ? 'h-[86%] w-[86%] ring-2 ring-neon-green/80' : 'h-1/3 w-1/3 bg-neon-green/80'
                      }`}
                      style={reduced ? undefined : { animation: 'chk-dot 160ms ease-out both' }}
                    />
                  )}
                  {cell && (
                    <span
                      key={justLanded ? lastLand.key : 'static'}
                      aria-hidden="true"
                      className={`absolute inset-[13%] flex items-center justify-center rounded-full ${
                        cell.color === PLAYER
                          ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_2px_3px_rgba(255,255,255,0.4)]'
                          : 'bg-gradient-to-br from-slate-600 to-slate-900 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_2px_3px_rgba(255,255,255,0.25)]'
                      } ${isSel ? 'ring-2 ring-neon-cyan ring-offset-1 ring-offset-bg' : ''}`}
                      style={
                        justLanded
                          ? ({
                              animation: 'chk-land 260ms cubic-bezier(0.34,1.1,0.64,1) both',
                              '--chk-dx': `${lastLand.dCol * 130}%`,
                              '--chk-dy': `${lastLand.dRow * 130}%`,
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      {cell.king && (
                        <span
                          className="text-[min(4vw,1.1rem)] leading-none text-amber-200 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                          style={
                            justLanded && lastLand.promoted && !reduced
                              ? { animation: 'chk-crown 360ms ease-out both' }
                              : undefined
                          }
                        >
                          ♔
                        </span>
                      )}
                    </span>
                  )}
                  {isMovable && !isSel && !isDest && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-[9%] rounded-full ring-2 ring-neon-cyan/40"
                    />
                  )}
                </>
              )

              if (!dark) {
                return (
                  <div key={k} role="gridcell" aria-label={label} className={`relative ${squareBg}`}>
                    <div className="aspect-square w-full" />
                  </div>
                )
              }

              return (
                <button
                  key={k}
                  role="gridcell"
                  aria-label={clickable ? `${label} — move here` : label}
                  disabled={!clickable}
                  onClick={() => onSquare(r, c)}
                  className={`relative aspect-square w-full ${squareBg} transition-colors disabled:cursor-default ${
                    clickable ? 'cursor-pointer hover:bg-neon-cyan/10' : ''
                  } focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan`}
                >
                  {inner}
                </button>
              )
            }),
          )}
        </div>

        <GameOverlay show={over && win === PLAYER} variant="win" title="You win!" testId="checkers-result-win">
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>

        <GameOverlay show={over && win === CPU} variant="lose" title="Computer wins" testId="checkers-result-lose">
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
