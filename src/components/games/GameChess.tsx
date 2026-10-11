'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyMove,
  bestMove,
  capturedPieces,
  createGame,
  isInCheck,
  legalMoves,
  materialBalance,
  outcome,
  sq,
  squareName,
  type Color,
  type Difficulty,
  type Move,
  type State,
  KING,
} from '@/lib/games/chess/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'cpu' | 'two'

interface Stack {
  states: State[]
  moves: Move[]
}

// Filled chess glyphs for BOTH colours (crisp, unmistakable shapes); colour +
// outline distinguish white from black on the neon board. Each glyph carries U+FE0E
// (text presentation) and a symbol-font stack so it never falls back to a colour emoji.
// The pawn is the exception: U+265F is an Emoji codepoint, and colour-emoji fonts paint it
// black whatever the CSS colour (White's pawns looked like Black's), so it is drawn as SVG.
const TEXT_VS = '\uFE0E'
const GLYPH: Record<number, string> = { 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' }
const SYMBOL_FONT = '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", "DejaVu Sans", "Arial Unicode MS", serif'
const PROMO_ORDER = [5, 4, 3, 2] as const // Q R B N
const PROMO_NAME: Record<number, string> = { 5: 'Queen', 4: 'Rook', 3: 'Bishop', 2: 'Knight' }

const WHITE_PIECE: React.CSSProperties = {
  color: '#f1f5f9',
  WebkitTextStroke: '0.6px rgba(0,0,0,0.7)',
  textShadow: '0 1px 2px rgba(0,0,0,0.85)',
}
const BLACK_PIECE: React.CSSProperties = {
  color: '#0b1120',
  WebkitTextStroke: '0.7px rgba(255,255,255,0.7)',
  textShadow: '0 0 2px rgba(255,255,255,0.55)',
}

const PAWN_FILL = { w: '#f1f5f9', b: '#0b1120' } as const
const PAWN_STROKE = { w: 'rgba(0,0,0,0.7)', b: 'rgba(255,255,255,0.7)' } as const

/** One chess piece (type 1..6) for the board, captured bars and promotion picker. */
function Piece({ type, white }: { type: number; white: boolean }) {
  if (type === 1) {
    const c = white ? 'w' : 'b'
    return (
      <svg
        data-piece="pawn"
        viewBox="0 0 45 45"
        width="1em"
        height="1em"
        aria-hidden="true"
        fill={PAWN_FILL[c]}
        stroke={PAWN_STROKE[c]}
        strokeWidth={1.5}
        strokeLinejoin="round"
        style={{
          filter: white ? 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.85))' : 'drop-shadow(0 0 1.5px rgba(255,255,255,0.55))',
        }}
      >
        <path d="M15 37.5C15 31 18.6 27 20 22.5h5c1.4 4.5 5 8.5 5 15z" />
        <rect x="17.5" y="19" width="10" height="3.5" rx="1.75" />
        <circle cx="22.5" cy="13.5" r="5" />
        <rect x="11.5" y="36" width="22" height="4" rx="1.5" />
      </svg>
    )
  }
  return <span style={{ ...(white ? WHITE_PIECE : BLACK_PIECE), fontFamily: SYMBOL_FONT }}>{GLYPH[type] + TEXT_VS}</span>
}

const CPU_DELAY = 380
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')

const rows8 = Array.from({ length: 8 }, (_, i) => i)

export function GameChess({ storageKey }: { storageKey: string }) {
  const slug = storageKey.replace(/^best:/, '')

  // SSR-safe: nothing until the client mounts.
  const [stack, setStack] = useState<Stack | null>(null)
  const [mode, setMode] = useState<Mode>('cpu')
  const [playerColor, setPlayerColor] = useState<Color>('w')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [selected, setSelected] = useState<number | null>(null)
  const [pending, setPending] = useState<{ from: number; to: number; moves: Move[] } | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [wins, setWins] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stackRef = useRef<Stack | null>(null)
  const modeRef = useRef<Mode>('cpu')
  const playerColorRef = useRef<Color>('w')
  const difficultyRef = useRef<Difficulty>('medium')
  const thinkingRef = useRef(false)
  const winsRef = useRef(0)
  const resolvedRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const cpuColor = other(playerColor)
  const current = stack ? stack.states[stack.states.length - 1] : null
  const result = current ? outcome(current) : null
  const over = result !== null

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const commit = useCallback((next: Stack) => {
    stackRef.current = next
    setStack(next)
  }, [])

  const bumpWins = useCallback(() => {
    const n = winsRef.current + 1
    winsRef.current = n
    setWins(n)
    try {
      localStorage.setItem(storageKey, String(n))
    } catch {
      // ignore storage failures (private mode / quota)
    }
  }, [storageKey])

  // End-of-game side effects (sound + persistence), guarded to fire once.
  const resolve = useCallback(
    (s: State) => {
      const oc = outcome(s)
      if (!oc || resolvedRef.current) return
      resolvedRef.current = true
      if (oc === 'checkmate') {
        // The side to move is mated → the OTHER side delivered mate.
        const winner = other(s.turn)
        // In vs-computer "won" = the human won. In 2-player a local human won.
        const humanWon = modeRef.current === 'two' ? true : winner === playerColorRef.current
        if (humanWon) {
          play('win')
          bumpWins()
        } else {
          play('lose')
        }
        recordResult(slug, { won: humanWon })
      } else {
        // stalemate / draw
        play('lose')
        recordResult(slug, { won: false })
      }
    },
    [bumpWins, play, slug],
  )

  // Apply a fully-specified move, with sounds + terminal handling.
  const doMove = useCallback(
    (move: Move) => {
      const s = stackRef.current
      if (!s) return
      const cur = s.states[s.states.length - 1]
      const next = applyMove(cur, move)
      if (move.flag === 'castle') play('flip')
      else if (move.captured !== 0) play('eat')
      else play('move')
      const nextStack: Stack = { states: [...s.states, next], moves: [...s.moves, move] }
      commit(nextStack)
      setSelected(null)
      setPending(null)
      const oc = outcome(next)
      if (oc) {
        resolve(next)
      } else if (isInCheck(next, next.turn)) {
        play('flag')
      }
    },
    [commit, play, resolve],
  )

  const startCpuTurn = useCallback(() => {
    clearTimer()
    thinkingRef.current = true
    setThinking(true)
    const delay = reducedRef.current ? 120 : CPU_DELAY
    timerRef.current = window.setTimeout(() => {
      const s = stackRef.current
      const cur = s ? s.states[s.states.length - 1] : null
      if (cur && !outcome(cur) && cur.turn === other(playerColorRef.current)) {
        const move = bestMove(cur, difficultyRef.current, Math.random)
        if (move) doMove(move)
      }
      thinkingRef.current = false
      setThinking(false)
    }, delay)
  }, [clearTimer, doMove, reducedRef])

  const restart = useCallback(() => {
    clearTimer()
    thinkingRef.current = false
    resolvedRef.current = false
    setThinking(false)
    setSelected(null)
    setPending(null)
    setFlipped(modeRef.current === 'cpu' && playerColorRef.current === 'b')
    commit({ states: [createGame()], moves: [] })
  }, [clearTimer, commit])

  // Keep refs in sync for use inside timers / handlers.
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    playerColorRef.current = playerColor
  }, [playerColor])
  useEffect(() => {
    difficultyRef.current = difficulty
  }, [difficulty])

  // Client init + hydrate the wins counter.
  useEffect(() => {
    restart()
    try {
      const raw = localStorage.getItem(storageKey)
      const n = raw ? Number(raw) : 0
      if (Number.isFinite(n) && n > 0) {
        winsRef.current = n
        setWins(n)
      }
    } catch {
      // ignore malformed storage
    }
    return clearTimer
  }, [restart, storageKey, clearTimer])

  // Drive the computer whenever it is its turn.
  useEffect(() => {
    if (!current || over) return
    if (mode === 'cpu' && current.turn === cpuColor && !thinkingRef.current) {
      startCpuTurn()
    }
  }, [current, over, mode, cpuColor, startCpuTurn])

  // Whose move a local human controls right now.
  const humanToMove =
    !!current && !over && (mode === 'two' || (current.turn === playerColor && !thinking))

  // Legal destinations for the current selection.
  const selMoves = useMemo(() => {
    if (!current || selected === null) return [] as Move[]
    return legalMoves(current).filter((m) => m.from === selected)
  }, [current, selected])

  const destTargets = useMemo(() => new Set(selMoves.map((m) => m.to)), [selMoves])

  // Squares a local human may pick up this turn.
  const movableFrom = useMemo(() => {
    if (!current || !humanToMove) return new Set<number>()
    const set = new Set<number>()
    for (const m of legalMoves(current)) set.add(m.from)
    return set
  }, [current, humanToMove])

  const onSquare = useCallback(
    (square: number) => {
      const s = stackRef.current
      if (!s || pending) return
      const cur = s.states[s.states.length - 1]
      if (outcome(cur)) return
      const controllable = modeRef.current === 'two' || (cur.turn === playerColorRef.current && !thinkingRef.current)
      if (!controllable) return

      if (selected !== null) {
        const matching = legalMoves(cur).filter((m) => m.from === selected && m.to === square)
        if (matching.length > 1) {
          // Promotion — same from/to, different promotion pieces.
          setPending({ from: selected, to: square, moves: matching })
          return
        }
        if (matching.length === 1) {
          doMove(matching[0])
          return
        }
      }
      // (Re)select one of the mover's own pieces that has a legal move.
      const piece = cur.board[square]
      if (piece !== 0 && (piece > 0) === (cur.turn === 'w')) {
        const has = legalMoves(cur).some((m) => m.from === square)
        setSelected(has ? square : null)
      } else {
        setSelected(null)
      }
    },
    [doMove, pending, selected],
  )

  const undo = useCallback(() => {
    const s = stackRef.current
    if (!s || s.states.length <= 1) return
    clearTimer()
    thinkingRef.current = false
    resolvedRef.current = false
    setThinking(false)
    setSelected(null)
    setPending(null)
    const states = [...s.states]
    const moves = [...s.moves]
    const pop = () => {
      states.pop()
      moves.pop()
    }
    pop()
    // In vs-computer, take back the full pair so it stays the human's turn.
    if (modeRef.current === 'cpu') {
      while (states.length > 1 && states[states.length - 1].turn !== playerColorRef.current) pop()
    }
    commit({ states, moves })
  }, [clearTimer, commit])

  // Keyboard: N new, U undo, Esc deselect.
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
        setSelected(null)
        setPending(null)
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
  const changeColor = (c: Color) => {
    if (c === playerColor) return
    playerColorRef.current = c
    setPlayerColor(c)
    restart()
  }

  // ── Derived render data ──────────────────────────────────────────────────
  const whiteBottom = !flipped
  const checkedKingSq = useMemo(() => {
    if (!current || !isInCheck(current, current.turn)) return -1
    const kc = KING * (current.turn === 'w' ? 1 : -1)
    for (let s = 0; s < 128; s++) if ((s & 0x88) === 0 && current.board[s] === kc) return s
    return -1
  }, [current])

  // The move that produced the position on screen (human or CPU) — highlighted so a CPU reply
  // landing after its delay is visible. Undo pops it with the stack.
  const lastMove = stack && stack.moves.length > 0 ? stack.moves[stack.moves.length - 1] : null

  const captured = current ? capturedPieces(current.board) : { white: [], black: [] }
  const balance = current ? materialBalance(current.board) : 0

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
            {(['w', 'b'] as const).map((c) => (
              <button
                key={c}
                onClick={() => changeColor(c)}
                aria-pressed={playerColor === c}
                className={`btn-press rounded-md px-2 py-1 font-semibold ${
                  playerColor === c ? 'bg-accent text-stone-900' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {c === 'w' ? 'White' : 'Black'}
              </button>
            ))}
          </div>
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
        </>
      )}
    </div>
  )

  const stats = [{ label: 'Wins', value: wins, testId: 'chess-wins', float: true }]

  if (!current) {
    return (
      <GameShell
        stats={[{ label: 'Wins', value: 0 }]}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint="Tap a piece to begin."
        maxWidthClassName="max-w-md"
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="chess-loading" />
      </GameShell>
    )
  }

  const turnLabel = current.turn === 'w' ? 'White' : 'Black'
  const hint = over
    ? result === 'checkmate'
      ? `Checkmate — ${other(current.turn) === 'w' ? 'White' : 'Black'} wins.`
      : result === 'stalemate'
        ? 'Stalemate — the game is a draw.'
        : 'Draw.'
    : thinking
      ? 'Computer is thinking…'
      : isInCheck(current, current.turn)
        ? `${turnLabel} is in check.`
        : selected !== null
          ? 'Tap a highlighted square to move.'
          : mode === 'two'
            ? `${turnLabel} to move — tap a piece.`
            : `Your move (${turnLabel}) — tap a piece.`

  const capBar = (side: 'white' | 'black') => {
    const glyphs = captured[side] // pieces of this colour that were captured
    return (
      <div className="flex min-h-5 items-center gap-0.5 text-lg leading-none" aria-hidden="true">
        {glyphs.map((t, i) => (
          <Piece key={i} type={t} white={side === 'white'} />
        ))}
      </div>
    )
  }

  const advantage =
    balance === 0 ? '' : balance > 0 ? `White +${(balance / 100).toFixed(1)}` : `Black +${(-balance / 100).toFixed(1)}`

  return (
    <GameShell
      stats={stats}
      headerExtra={controls}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-md"
    >
      <div className="anim-board-in relative select-none">
        {/* captured black pieces (taken by White) + advantage */}
        <div className="mb-1 flex items-center justify-between">
          {capBar('black')}
          {advantage && <span className="text-xs font-semibold text-fg-muted">{advantage}</span>}
        </div>

        <div
          data-testid="chess-board"
          role="grid"
          aria-label="Chess board"
          className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl border border-border bg-surface shadow-[inset_0_0_18px_rgba(0,0,0,0.5)]"
        >
          {rows8.map((r) =>
            rows8.map((c) => {
              const rank = whiteBottom ? 7 - r : r
              const file = whiteBottom ? c : 7 - c
              const square = sq(rank, file)
              const light = (rank + file) % 2 === 1
              const piece = current.board[square]
              const isSel = selected === square
              const isDest = destTargets.has(square)
              const isCheck = square === checkedKingSq
              const isPickable = movableFrom.has(square)
              const lastRole = lastMove ? (square === lastMove.from ? 'from' : square === lastMove.to ? 'to' : null) : null

              const squareBg = light
                ? 'bg-neon-cyan/12'
                : 'bg-bg/50'
              const name = squareName(square)
              const pieceName = piece
                ? `${piece > 0 ? 'white' : 'black'} ${['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'][Math.abs(piece)]}`
                : 'empty'
              const label = `${name}, ${pieceName}${isDest ? ' — move here' : ''}`
              const clickable = humanToMove && (isDest || isPickable)

              return (
                <button
                  key={`${r}-${c}`}
                  role="gridcell"
                  aria-label={label}
                  data-last-move={lastRole ?? undefined}
                  disabled={!clickable && !isSel}
                  onClick={() => onSquare(square)}
                  className={`relative aspect-square w-full ${squareBg} transition-colors disabled:cursor-default ${
                    clickable ? 'cursor-pointer hover:brightness-125' : ''
                  } ${isCheck ? 'ring-2 ring-inset ring-red-500' : ''} focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan`}
                >
                  {lastRole && (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-yellow-300/30" />
                  )}
                  {isSel && (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-neon-cyan/25 ring-2 ring-inset ring-neon-cyan" />
                  )}
                  {isDest && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                        piece ? 'h-[88%] w-[88%] ring-[3px] ring-neon-green/80' : 'h-1/3 w-1/3 bg-neon-green/80'
                      }`}
                    />
                  )}
                  {piece !== 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center text-[min(9vw,2.3rem)] leading-none"
                    >
                      <Piece type={Math.abs(piece)} white={piece > 0} />
                    </span>
                  )}
                  {/* file / rank coordinate hints on the edge squares */}
                  {c === 0 && (
                    <span className="pointer-events-none absolute left-0.5 top-0 text-[8px] font-bold text-fg-muted/70">
                      {rank + 1}
                    </span>
                  )}
                  {r === 7 && (
                    <span className="pointer-events-none absolute bottom-0 right-0.5 text-[8px] font-bold text-fg-muted/70">
                      {'abcdefgh'[file]}
                    </span>
                  )}
                </button>
              )
            }),
          )}
        </div>

        {/* captured white pieces (taken by Black) */}
        <div className="mt-1 flex items-center justify-between">
          {capBar('white')}
          <div className="flex gap-1.5">
            <GameButton onClick={() => setFlipped((f) => !f)} className="px-2.5 py-1 text-sm">
              Flip
            </GameButton>
            <GameButton
              onClick={undo}
              disabled={!stack || stack.states.length <= 1 || thinking}
              className="px-2.5 py-1 text-sm"
            >
              Undo
            </GameButton>
          </div>
        </div>

        {/* Promotion picker */}
        {pending && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-bg/80 backdrop-blur-sm" data-testid="chess-promotion">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-fg">Promote to</p>
              <div className="flex gap-2">
                {PROMO_ORDER.map((t) => {
                  const mv = pending.moves.find((m) => m.promotion === t)
                  if (!mv) return null
                  return (
                    <button
                      key={t}
                      onClick={() => doMove(mv)}
                      aria-label={`Promote to ${PROMO_NAME[t]}`}
                      className="btn-press flex h-12 w-12 items-center justify-center rounded-lg bg-bg text-3xl leading-none ring-1 ring-border hover:ring-neon-cyan"
                    >
                      <Piece type={t} white={current.turn === 'w'} />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <GameOverlay
          show={over && result === 'checkmate' && (mode === 'two' || other(current.turn) === playerColor)}
          variant="win"
          title="Checkmate!"
          testId="chess-result-win"
        >
          <p className="mb-3 text-sm text-fg-muted">
            {other(current.turn) === 'w' ? 'White' : 'Black'} wins.
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>

        <GameOverlay
          show={over && result === 'checkmate' && mode === 'cpu' && other(current.turn) !== playerColor}
          variant="lose"
          title="Checkmate"
          testId="chess-result-lose"
        >
          <p className="mb-3 text-sm text-fg-muted">The computer wins.</p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>

        <GameOverlay
          show={over && result !== 'checkmate'}
          variant="lose"
          title={result === 'stalemate' ? 'Stalemate' : 'Draw'}
          testId="chess-result-draw"
        >
          <p className="mb-3 text-sm text-fg-muted">The game is a draw.</p>
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
