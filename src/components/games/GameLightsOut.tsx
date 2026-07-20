'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  crossCells,
  newGame,
  press,
  SIZE,
  type GameState,
} from '@/lib/games/lightsout/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const RIPPLE_STEP = 45 // ms of extra delay per Manhattan step from the pressed cell

export function GameLightsOut({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 보드는 클라이언트에서만 생성
  const [state, setState] = useState<GameState | null>(null)
  const [best, setBest] = useState(0)
  // Increments each press so the toggled cells' inner span remounts and re-runs
  // its cross-ripple animation exactly once per press.
  const [pressKey, setPressKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const stateRef = useRef<GameState | null>(null)
  // Origin of the last press — drives the ripple's staggered delay.
  const originRef = useRef<{ row: number; col: number } | null>(null)
  const bestRef = useRef(0)

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const restart = useCallback(() => {
    originRef.current = null
    setPressKey(0)
    commit(newGame(Math.random))
  }, [commit])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    const value = Number.isFinite(stored) && stored > 0 ? stored : 0
    bestRef.current = value
    setBest(value)
  }, [restart, storageKey])

  const handlePress = useCallback(
    (row: number, col: number) => {
      const s = stateRef.current
      if (!s || s.solved) return
      const next = press(s, row, col)
      originRef.current = { row, col }
      setPressKey((k) => k + 1)
      commit(next)

      if (next.solved) {
        play('win')
        const prevBest = bestRef.current
        if (prevBest === 0 || next.moves < prevBest) {
          bestRef.current = next.moves
          setBest(next.moves)
          localStorage.setItem(storageKey, String(next.moves))
        }
        // 개인 기록: 완료 판수 누적(라이츠아웃은 패배 없음 → 항상 승) + 사용 이동 수 분포.
        recordResult(storageKey.replace(/^best:/, ''), { won: true, bucket: next.moves })
      } else {
        // 'flip' is a soft, short tick — fits a light toggling on/off.
        play('flip')
      }
    },
    [commit, play, storageKey],
  )

  const hint = 'Turn every light off. Clicking a cell flips it and its 4 neighbours.'

  if (!state) {
    return (
      <GameShell
        stats={[
          { label: 'Moves', value: 0, testId: 'moves' },
          { label: 'Best', value: 0, testId: 'best' },
        ]}
        onNewGame={restart}
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="aspect-square w-full rounded-xl bg-surface" data-testid="lightsout-loading" />
      </GameShell>
    )
  }

  const origin = originRef.current
  const rippleActive = pressKey > 0 && !reducedRef.current

  return (
    <GameShell
      stats={[
        { label: 'Moves', value: state.moves, testId: 'moves' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      onNewGame={restart}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{`
        @keyframes lo-ripple {
          0% { transform: scale(1); }
          45% { transform: scale(0.82); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div
        className="anim-board-in relative grid aspect-square w-full gap-2 rounded-xl bg-surface p-2"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        data-testid="lightsout-board"
      >
        {state.grid.flatMap((row, r) =>
          row.map((on, c) => {
            // Was this cell part of the most recent press cross? If so, ripple it.
            const inCross =
              rippleActive &&
              origin != null &&
              crossCells(origin.row, origin.col).some(([rr, cc]) => rr === r && cc === c)
            const delay = inCross && origin
              ? (Math.abs(r - origin.row) + Math.abs(c - origin.col)) * RIPPLE_STEP
              : 0

            return (
              <button
                key={`${r},${c}`}
                data-testid="lightsout-cell"
                data-on={on}
                aria-label={`Light row ${r + 1}, column ${c + 1}: ${on ? 'on' : 'off'}`}
                aria-pressed={on}
                onClick={() => handlePress(r, c)}
                className="btn-press aspect-square rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <span
                  key={inCross ? `p${pressKey}` : 'idle'}
                  className={`flex h-full w-full items-center justify-center rounded-lg transition-[background-color,box-shadow] duration-200 ${
                    on
                      ? 'bg-accent shadow-[0_0_16px_rgba(251,191,36,0.75),inset_0_0_10px_rgba(255,255,255,0.35)]'
                      : 'bg-white/[0.06] shadow-inner hover:bg-white/[0.12]'
                  }`}
                  style={
                    inCross
                      ? { animation: `lo-ripple 260ms ease-out`, animationDelay: `${delay}ms` }
                      : undefined
                  }
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full transition-colors duration-200 ${
                      on ? 'bg-stone-900/70' : 'bg-white/20'
                    }`}
                  />
                </span>
              </button>
            )
          }),
        )}

        <GameOverlay show={state.solved} variant="win" title="Lights out!" testId="game-over">
          <p className="text-sm text-fg-muted">
            Solved in <span className="font-bold text-accent">{state.moves}</span>{' '}
            {state.moves === 1 ? 'move' : 'moves'}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
