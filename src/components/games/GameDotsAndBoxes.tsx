'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aiMove,
  drawEdge,
  DEFAULT_DOTS,
  isDrawn,
  isLegal,
  isOver,
  newGame,
  winner,
  type Difficulty,
  type Edge,
  type GameState,
} from '@/lib/games/dotsandboxes/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const CPU_DELAY = 520
const CPU_DELAY_REDUCED = 200

// Player 0 is You (cyan), player 1 is the Computer (magenta).
const YOU = 0
const CPU = 1

interface WinRecord {
  w: number // player wins
  l: number // computer wins
  d: number // ties
}
const EMPTY_RECORD: WinRecord = { w: 0, l: 0, d: 0 }

// Component-scoped keyframes so globals.css stays untouched.
const STYLE = `
@keyframes dab-edge-in {
  0%   { transform: scale(0.2); opacity: 0.3; }
  60%  { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes dab-box-pop {
  0%   { transform: scale(0.4); opacity: 0; }
  55%  { transform: scale(1.14); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}`

const YOU_LINE = '#22d3ee' // cyan-400
const CPU_LINE = '#e879f9' // fuchsia-400
const YOU_FILL = 'rgba(34,211,238,0.20)'
const CPU_FILL = 'rgba(232,121,249,0.20)'
const YOU_FILL_STRONG = 'rgba(34,211,238,0.32)'
const CPU_FILL_STRONG = 'rgba(232,121,249,0.32)'

export function GameDotsAndBoxes({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성.
  const [state, setState] = useState<GameState | null>(null)
  const [record, setRecord] = useState<WinRecord>(EMPTY_RECORD)
  const [difficulty, setDifficulty] = useState<Difficulty>('hard')
  const [thinking, setThinking] = useState(false)
  // Key of the most-recently drawn edge, for the draw-in animation.
  const [lastEdge, setLastEdge] = useState<string | null>(null)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  const recordRef = useRef<WinRecord>(EMPTY_RECORD)
  const difficultyRef = useRef<Difficulty>('hard')
  const thinkingRef = useRef(false)
  const resolvedRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const commitState = useCallback((s: GameState) => {
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

  // Apply end-of-game side effects (sound + record) exactly once.
  const resolve = useCallback(
    (s: GameState): boolean => {
      if (!isOver(s)) return false
      if (resolvedRef.current) return true
      resolvedRef.current = true
      const win = winner(s)
      if (win?.player === YOU) {
        play('win')
        bumpRecord('w')
      } else if (win?.player === CPU) {
        play('lose')
        bumpRecord('l')
      } else {
        play('match')
        bumpRecord('d')
      }
      recordResult(storageKey.replace(/^best:/, ''), { won: win?.player === YOU })
      return true
    },
    [bumpRecord, play, storageKey],
  )

  // Draw a single edge; returns whether it moved and whether the game ended.
  const doDraw = useCallback(
    (edge: Edge): { moved: boolean; over: boolean; completed: boolean } => {
      const s = stateRef.current
      if (!s) return { moved: false, over: false, completed: false }
      const before = s.current
      const next = drawEdge(s, edge)
      if (next === s) return { moved: false, over: false, completed: false }
      const completed = next.current === before && !isOver(next)
      const claimed = next.scores[before] > s.scores[before]
      play(claimed ? 'eat' : 'move')
      setLastEdge(`${edge.type}${edge.r}-${edge.c}`)
      commitState(next)
      return { moved: true, over: resolve(next), completed: claimed }
    },
    [commitState, play, resolve],
  )

  // Run the computer's turn, chaining extra moves after each box it completes.
  const runCpu = useCallback(() => {
    clearTimer()
    const delay = reducedRef.current ? CPU_DELAY_REDUCED : CPU_DELAY
    timerRef.current = window.setTimeout(() => {
      const s = stateRef.current
      if (!s || s.current !== CPU || isOver(s)) {
        thinkingRef.current = false
        setThinking(false)
        return
      }
      const edge = aiMove(s, difficultyRef.current, Math.random)
      if (!edge) {
        thinkingRef.current = false
        setThinking(false)
        return
      }
      doDraw(edge)
      const after = stateRef.current
      if (after && after.current === CPU && !isOver(after)) {
        runCpu() // completed a box → move again after another beat
      } else {
        thinkingRef.current = false
        setThinking(false)
      }
    }, delay)
  }, [clearTimer, doDraw, reducedRef])

  const onEdge = useCallback(
    (edge: Edge) => {
      const s = stateRef.current
      if (!s || thinkingRef.current) return
      if (s.current !== YOU || isOver(s) || !isLegal(s, edge)) return
      const { moved, over } = doDraw(edge)
      if (!moved || over) return
      // If the turn passed to the CPU, let it play. If the player completed a
      // box, it's still their turn — do nothing and wait for the next click.
      const after = stateRef.current
      if (after && after.current === CPU) {
        thinkingRef.current = true
        setThinking(true)
        runCpu()
      }
    },
    [doDraw, runCpu],
  )

  const restart = useCallback(() => {
    clearTimer()
    thinkingRef.current = false
    resolvedRef.current = false
    setThinking(false)
    setLastEdge(null)
    commitState(newGame(DEFAULT_DOTS))
  }, [clearTimer, commitState])

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

  const win = state ? winner(state) : null
  const over = !!win
  const yourScore = state ? state.scores[YOU] : 0
  const cpuScore = state ? state.scores[CPU] : 0

  const hint = over
    ? win?.player === YOU
      ? 'You win! Start a new game.'
      : win?.player === CPU
        ? 'Computer wins. Try again!'
        : "It's a tie — the board is full."
    : thinking
      ? 'Computer is thinking…'
      : state?.current === YOU
        ? 'Your turn — tap a gap to draw a line. Close the 4th side of a box to claim it and go again. Most boxes wins.'
        : ' '

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

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'You', value: 0 }]}
        headerExtra={difficultyToggle}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint="Tap a gap to draw a line. Close the 4th side of a box to claim it and go again. Most boxes wins."
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="dab-loading" />
      </GameShell>
    )
  }

  const dots = state.dots
  const reduced = reducedRef.current
  const yourTurn = state.current === YOU && !over && !thinking

  // Build a grid of (2*dots-1) tracks: dot columns are fixed, gaps are flexible.
  const track = (i: number) => (i % 2 === 0 ? '14px' : 'minmax(18px, 1fr)')
  const template = Array.from({ length: 2 * dots - 1 }, (_, i) => track(i)).join(' ')

  // Render one clickable edge cell (horizontal or vertical line segment).
  const renderEdge = (edge: Edge) => {
    const key = `${edge.type}${edge.r}-${edge.c}`
    const drawn = isDrawn(state, edge)
    const clickable = yourTurn && !drawn
    const justDrawn = drawn && lastEdge === key && !reduced
    const horizontal = edge.type === 'h'

    // Drawn edges are shared between two boxes, so their "owner" is ambiguous;
    // colour them with a bright neutral neon while owned boxes carry the
    // per-player fill. Undrawn edges are faint until hovered.
    const lineColor = '#a5b4fc' // indigo-300

    const label = horizontal
      ? `Draw horizontal line, row ${edge.r + 1}, column ${edge.c + 1}`
      : `Draw vertical line, row ${edge.r + 1}, column ${edge.c + 1}`

    return (
      <button
        key={key}
        type="button"
        onClick={() => onEdge(edge)}
        disabled={!clickable}
        aria-label={label}
        aria-disabled={drawn || undefined}
        className={`group relative flex items-center justify-center ${
          horizontal ? 'px-0.5 py-1.5' : 'px-1.5 py-0.5'
        } ${clickable ? 'cursor-pointer' : 'cursor-default'} rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-bg`}
      >
        <span
          aria-hidden="true"
          className="rounded-full transition-all duration-150"
          style={{
            width: horizontal ? '100%' : '3px',
            height: horizontal ? '3px' : '100%',
            background: drawn
              ? lineColor
              : clickable
                ? 'rgba(140,140,200,0.18)'
                : 'rgba(140,140,200,0.08)',
            boxShadow: drawn ? `0 0 6px ${lineColor}` : undefined,
            transformOrigin: horizontal ? 'left center' : 'top center',
            animation: justDrawn ? 'dab-edge-in 220ms ease-out both' : undefined,
          }}
        />
        {clickable && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{
              width: horizontal ? '100%' : '3px',
              height: horizontal ? '3px' : '100%',
              background: YOU_LINE,
              boxShadow: `0 0 6px ${YOU_LINE}`,
            }}
          />
        )}
      </button>
    )
  }

  const cells: React.ReactNode[] = []
  for (let row = 0; row < 2 * dots - 1; row++) {
    for (let col = 0; col < 2 * dots - 1; col++) {
      const rEven = row % 2 === 0
      const cEven = col % 2 === 0

      if (rEven && cEven) {
        // Dot.
        cells.push(
          <div key={`d${row}-${col}`} className="flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-fg-muted/70 shadow-[0_0_4px_rgba(140,140,200,0.5)]" />
          </div>,
        )
        continue
      }

      if (rEven && !cEven) {
        // Horizontal edge h[row/2][(col-1)/2].
        const er = row / 2
        const ec = (col - 1) / 2
        const edge: Edge = { type: 'h', r: er, c: ec }
        cells.push(renderEdge(edge))
        continue
      }

      if (!rEven && cEven) {
        // Vertical edge v[(row-1)/2][col/2].
        const er = (row - 1) / 2
        const ec = col / 2
        const edge: Edge = { type: 'v', r: er, c: ec }
        cells.push(renderEdge(edge))
        continue
      }

      // Box owner[(row-1)/2][(col-1)/2].
      const br = (row - 1) / 2
      const bc = (col - 1) / 2
      const owner = state.owner[br][bc]
      const key = `b${br}-${bc}`
      cells.push(
        <div key={key} className="flex items-center justify-center p-[3px]">
          {owner !== null && (
            <div
              key={owner}
              data-testid={`dab-box-${br}-${bc}`}
              className="h-full w-full rounded-[4px]"
              style={{
                background: owner === YOU ? YOU_FILL : CPU_FILL,
                boxShadow:
                  owner === YOU
                    ? `inset 0 0 0 1px ${YOU_FILL_STRONG}`
                    : `inset 0 0 0 1px ${CPU_FILL_STRONG}`,
                animation: reduced ? undefined : 'dab-box-pop 320ms cubic-bezier(0.34,1.3,0.64,1) both',
              }}
            />
          )}
        </div>,
      )
    }
  }

  return (
    <GameShell
      stats={[
        { label: 'You', value: yourScore, testId: 'dab-you-score', float: true },
        { label: 'CPU', value: cpuScore, testId: 'dab-cpu-score' },
        { label: 'W', value: record.w, testId: 'dab-wins' },
        { label: 'L', value: record.l },
        { label: 'D', value: record.d },
      ]}
      headerExtra={difficultyToggle}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-md"
    >
      <style>{STYLE}</style>
      <div className="anim-board-in relative select-none">
        {/* Turn indicator */}
        <div className="mb-2 flex items-center justify-center gap-4 text-sm font-semibold">
          <span
            className="flex items-center gap-1.5 transition-opacity"
            style={{ color: YOU_LINE, opacity: yourTurn ? 1 : 0.4 }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: YOU_LINE }} aria-hidden="true" />
            You
          </span>
          <span
            className="flex items-center gap-1.5 transition-opacity"
            style={{ color: CPU_LINE, opacity: !yourTurn && !over ? 1 : 0.4 }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CPU_LINE }} aria-hidden="true" />
            CPU
          </span>
        </div>

        <div
          data-testid="dab-board"
          role="group"
          aria-label="Dots and Boxes board"
          className="grid aspect-square w-full rounded-xl bg-surface p-3 shadow-inner"
          style={{ gridTemplateColumns: template, gridTemplateRows: template }}
        >
          {cells}
        </div>

        <GameOverlay show={over && win?.player === YOU} variant="win" title="You win!" testId="dab-result-win">
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>

        <GameOverlay show={over && win?.player === CPU} variant="lose" title="Computer wins" testId="dab-result-lose">
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>

        <GameOverlay show={over && win?.player === null} variant="lose" title="It's a tie" testId="dab-result-tie">
          <GameButton onClick={restart} className="px-4 py-2">
            New Game
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
