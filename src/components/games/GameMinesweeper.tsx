'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  chord,
  flagCount,
  MS_MINES,
  MS_SIZE,
  newMinesweeper,
  reveal,
  safeLeft,
  toggleFlag,
  type MsState,
} from '@/lib/games/minesweeper/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// 밤 정원 숫자 꽃색. 열린 칸 바탕(OPEN_TILE #1b1536) 위 대비(WCAG): 1 10.7 · 2 10.3 · 3 8.9 · 4 9.5 · 5 12.7 · 6 11.5 · 7 9.1 · 8 15.8
// (전부 7:1 이상). 1·2·3은 색 말고 숫자 자체로도 구분된다.
const NUMBER_COLORS: Record<number, string> = {
  1: 'text-[#8fd3ff]',
  2: 'text-[#8fd98a]',
  3: 'text-[#ffa184]',
  4: 'text-[#c9b6f2]',
  5: 'text-[#ffd966]',
  6: 'text-[#7fe3d6]',
  7: 'text-[#ff9ecb]',
  8: 'text-[#fff3dc]',
}

// 닫힌 칸 = 볼록한 라벤더 돌(윗면 하이라이트 + 아래 그림자), 열린 칸 = 움푹한 밤색 흙.
// 예전 bg-white/5 vs bg-white/10은 남보라 판 위에서 1.16:1이라 열린 빈칸과 닫힌 칸이 구분되지 않았다 → 3.07:1.
const CLOSED_TILE =
  'bg-[#7059ab] shadow-[inset_0_2px_0_rgba(255,243,220,0.22),inset_0_-3px_0_rgba(20,12,40,0.45)] hover:bg-[#7d67b8]'
const OPEN_TILE = 'bg-[#1b1536] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
const EXPLODED_TILE = 'bg-garden-danger shadow-[inset_0_0_0_2px_#fff3dc]'

// Flood-fill ripple: cells further from the click reveal slightly later.
const RIPPLE_STEP = 16 // ms per Manhattan step
const RIPPLE_CAP = 200 // ms

// 터치 길게 누르기 → 깃발. iOS Safari는 contextmenu를 쏘지 않아 직접 잰다. 손가락이 이만큼 움직이면(스크롤) 취소.
const LONG_PRESS_MS = 350
const LONG_PRESS_SLOP = 10 // px
// 진행 중 판에서 New Game을 한 번 누르면 'Restart?'로 바뀌고, 이 시간 안에 한 번 더 눌러야 판을 버린다(실수 방지).
const RESTART_CONFIRM_MS = 3000
// 패배 직후 결과 창을 늦게 띄운다 — 덮개(흐림)가 밟은 칸 💥·틀린 깃발 ❌을 가리기 전에 판을 보여 준다.
const LOSE_OVERLAY_DELAY_MS = 900

// 개인 베스트(클리어 시간, 낮을수록 좋음) 전용 키. 리더보드엔 넣지 않는다 —
// 리더보드는 "높을수록 좋은 정수" 규약이라 시간(낮을수록 좋음)과 맞지 않는다.
const MS_BEST_KEY = 'best:minesweeper:time'

const TOTAL_SAFE = MS_SIZE * MS_SIZE - MS_MINES

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function vibrate(ms: number) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms)
  } catch {
    // 권한 정책·미지원 — 무시
  }
}

export function GameMinesweeper() {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<MsState | null>(null)
  const [flagMode, setFlagMode] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [best, setBest] = useState<number | null>(null)
  // 승리 직전의 최고 기록 — 결과 화면의 'New best!' / '+Ns' 비교용
  const [prevBest, setPrevBest] = useState<number | null>(null)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const confirmTimerRef = useRef<number | null>(null)
  // 결과 창 표시(승리는 즉시, 패배는 LOSE_OVERLAY_DELAY_MS 뒤)
  const [showOverlay, setShowOverlay] = useState(false)
  const overlayTimerRef = useRef<number | null>(null)
  const elapsedRef = useRef(0)
  const bestRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const runningRef = useRef(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()
  const mutedRef = useRef(muted)
  useEffect(() => {
    mutedRef.current = muted
  }, [muted])
  useEffect(() => {
    bestRef.current = best
  }, [best])
  // 진동은 음소거를 따른다(소리 끈 사람에게 떨림도 끔).
  const buzz = useCallback((ms: number) => {
    if (!mutedRef.current) vibrate(ms)
  }, [])

  // Latest state read synchronously in handlers (avoids stale closures / double
  // side-effects from running sound inside a setState updater).
  const stateRef = useRef<MsState | null>(null)
  // Origin of the last reveal — drives the flood-fill ripple delay.
  const originRef = useRef<{ x: number; y: number } | null>(null)

  const commit = useCallback((s: MsState | null) => {
    stateRef.current = s
    setState(s)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    runningRef.current = false
  }, [])

  const startTimer = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    timerRef.current = window.setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)
  }, [])

  const clearConfirm = useCallback(() => {
    if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current)
    confirmTimerRef.current = null
    setConfirmRestart(false)
  }, [])

  const clearOverlayTimer = useCallback(() => {
    if (overlayTimerRef.current !== null) window.clearTimeout(overlayTimerRef.current)
    overlayTimerRef.current = null
  }, [])

  const restart = useCallback(() => {
    clearConfirm()
    clearOverlayTimer()
    setShowOverlay(false)
    originRef.current = null
    stopTimer()
    elapsedRef.current = 0
    setElapsed(0)
    commit(newMinesweeper())
    setFlagMode(false)
  }, [clearConfirm, clearOverlayTimer, commit, stopTimer])

  // 헤더 New Game: 진행 중(첫 칸을 연 뒤, 끝나기 전)이면 두 번 눌러야 판을 버린다. 시작 전·종료 후는 바로.
  const onNewGame = useCallback(() => {
    const s = stateRef.current
    const inProgress = !!s && s.minesPlaced && !s.over
    if (!inProgress || confirmTimerRef.current !== null) {
      restart()
      return
    }
    setConfirmRestart(true)
    confirmTimerRef.current = window.setTimeout(() => {
      confirmTimerRef.current = null
      setConfirmRestart(false)
    }, RESTART_CONFIRM_MS)
  }, [restart])

  useEffect(() => {
    restart()
    const raw = Number(localStorage.getItem(MS_BEST_KEY))
    setBest(Number.isFinite(raw) && raw > 0 ? raw : null)
    return () => {
      stopTimer()
      if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current)
      if (overlayTimerRef.current !== null) window.clearTimeout(overlayTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCell = useCallback(
    (x: number, y: number, flag: boolean) => {
      const s = stateRef.current
      if (!s || s.over) return
      if (flag && !s.grid[y][x].revealed) {
        const next = toggleFlag(s, x, y)
        if (next === s) return
        play('flag')
        commit(next)
        return
      }
      // 열린 숫자 칸을 누르면 코드(주변 깃발이 숫자만큼이면 나머지 닫힌 이웃을 한 번에 연다). 깃발 모드에서도 같다.
      const next = s.grid[y][x].revealed ? chord(s, x, y) : reveal(s, x, y, Math.random)
      if (next === s) return
      clearConfirm()
      const wasFirstReveal = originRef.current === null
      originRef.current = { x, y }
      if (next.over) {
        stopTimer()
        if (next.won) {
          const t = elapsedRef.current
          setPrevBest(bestRef.current)
          setBest((prev) => {
            if (prev === null || t < prev) {
              try {
                localStorage.setItem(MS_BEST_KEY, String(t))
              } catch {
                /* ignore */
              }
              return t
            }
            return prev
          })
          play('win')
          setShowOverlay(true)
        } else {
          play('lose')
          buzz(40)
          clearOverlayTimer()
          overlayTimerRef.current = window.setTimeout(() => {
            overlayTimerRef.current = null
            setShowOverlay(true)
          }, LOSE_OVERLAY_DELAY_MS)
        }
        // 개인 기록: 완료 판수/승수 누적 → 게임 페이지 스탯 패널이 읽는다.
        recordResult('minesweeper', { won: next.won })
      } else {
        if (wasFirstReveal) startTimer() // 첫 오픈에서 시계 시작
        play('move')
      }
      commit(next)
    },
    [buzz, clearConfirm, clearOverlayTimer, commit, play, startTimer, stopTimer],
  )

  // 길게 누르기(터치·펜) → 깃발. 깃발이 꽂히면 뒤따르는 click(공개)은 버린다.
  const pressRef = useRef<{ px: number; py: number; timer: number } | null>(null)
  const suppressClickRef = useRef(false)
  const lastPointerRef = useRef<string>('mouse')
  const cancelPress = useCallback(() => {
    if (pressRef.current) window.clearTimeout(pressRef.current.timer)
    pressRef.current = null
  }, [])
  useEffect(() => cancelPress, [cancelPress])

  const onCellPointerDown = (e: React.PointerEvent, x: number, y: number) => {
    lastPointerRef.current = e.pointerType
    suppressClickRef.current = false
    cancelPress()
    if (e.pointerType === 'mouse') return
    const timer = window.setTimeout(() => {
      pressRef.current = null
      const s = stateRef.current
      if (!s || s.over || s.grid[y][x].revealed) return
      suppressClickRef.current = true
      buzz(12)
      handleCell(x, y, true)
    }, LONG_PRESS_MS)
    pressRef.current = { px: e.clientX, py: e.clientY, timer }
  }
  const onCellPointerMove = (e: React.PointerEvent) => {
    const p = pressRef.current
    if (p && Math.hypot(e.clientX - p.px, e.clientY - p.py) > LONG_PRESS_SLOP) cancelPress()
  }
  const onCellClick = (x: number, y: number) => {
    cancelPress()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    handleCell(x, y, flagMode)
  }

  // 판 아래 엄지 자리의 모드 스위치(파기 / 깃발). 예전엔 헤더 구석의 배경 없는 글자라 버튼으로 안 보였다.
  const modeSwitch = (
    <div
      role="group"
      aria-label="Tap mode"
      className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-border bg-[#1b1536] p-1"
    >
      {(
        [
          ['dig', '⛏️', 'Dig', false],
          ['flag', '🚩', 'Flag', true],
        ] as const
      ).map(([id, icon, label, isFlag]) => {
        const on = flagMode === isFlag
        return (
          <button
            key={id}
            type="button"
            data-testid={`ms-mode-${id}`}
            onClick={() => setFlagMode(isFlag)}
            aria-pressed={on}
            className={`btn-press min-h-11 rounded-lg text-sm font-bold ${
              on ? 'bg-garden-sunflower text-garden-ink-deep shadow-garden-button' : 'text-fg-muted hover:text-fg'
            }`}
          >
            <span aria-hidden="true">{icon}</span> {label}
          </button>
        )
      })}
    </div>
  )

  // compactHeader의 Stat과 같은 모양(라벨 위·값 아래, 고정 높이) — Time은 매초 바뀌어 Stat의 pulse를 쓰지 않는다.
  const chip = (label: string, value: string, testId: string) => (
    <div className="flex min-w-14 flex-col items-center whitespace-nowrap rounded-lg border border-border bg-surface/80 px-2 py-0.5 leading-tight sm:px-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</span>{' '}
      <span className="font-bold tabular-nums text-fg" data-testid={testId}>
        {value}
      </span>
    </div>
  )
  const headerChips = (
    <>
      {chip('Time', fmtTime(elapsed), 'ms-time')}
      {chip('Best', best !== null ? fmtTime(best) : '—', 'ms-best')}
    </>
  )

  const hint = 'Long-press or right-click to flag. Tap a number once its flags are placed to clear around it.'

  if (!state) {
    return (
      <GameShell
        stats={[{ label: 'Mines', value: MS_MINES, testId: 'mines-left' }]}
        headerExtra={headerChips}
        onNewGame={restart}
        newGameDisabled
        compactHeader
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div className="aspect-square rounded-xl bg-surface" data-testid="ms-loading" />
        {modeSwitch}
      </GameShell>
    )
  }

  const origin = originRef.current
  const lost = state.over && !state.won
  const exploded = state.exploded
  const left = safeLeft(state)

  return (
    <GameShell
      stats={[
        {
          label: 'Mines',
          // 이기면 판에 지뢰 자리 깃발이 다 보이므로 0
          value: state.won ? 0 : MS_MINES - flagCount(state),
          testId: 'mines-left',
        },
      ]}
      headerExtra={headerChips}
      onNewGame={onNewGame}
      newGameLabel={confirmRestart ? 'Restart?' : 'New Game'}
      compactHeader
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <div
        className="anim-board-in relative grid aspect-square gap-[2px] rounded-xl bg-[#2a2150] p-1"
        style={{ gridTemplateColumns: `repeat(${MS_SIZE}, minmax(0, 1fr))` }}
        data-testid="ms-board"
      >
        {state.grid.flatMap((row, y) =>
          row.map((cell, x) => {
            // A key that only changes when the cell's face changes, so the inner
            // span remounts (and re-runs its entrance animation) exactly once per
            // transition — on reveal or flag — and never on unrelated re-renders.
            const face = cell.revealed ? 'r' : cell.flagged ? 'f' : 'e'
            const isExploded = !!exploded && exploded[0] === x && exploded[1] === y
            const wrongFlag = lost && cell.flagged && !cell.mine
            // 스크린리더용 칸 상태: 'hidden' / 'flagged' / 'empty' / 숫자 / 'mine' / 'wrong flag'
            const cellState =
              (state.won && cell.mine) || (cell.flagged && !wrongFlag && !cell.revealed)
                ? 'flagged'
                : wrongFlag
                  ? 'wrong flag'
                  : !cell.revealed
                    ? 'hidden'
                    : cell.mine
                      ? 'mine'
                      : cell.adjacent > 0
                        ? String(cell.adjacent)
                        : 'empty'

            let content = ''
            let faceAnim = ''
            let faceStyle: React.CSSProperties | undefined
            if (state.won && cell.mine) {
              // 이기면 남은 지뢰 자리에 깃발을 꽂아 '다 찾았다'를 보여준다
              content = '🚩'
            } else if (wrongFlag) {
              // 지고 나면 틀린 깃발을 표시 — 어디서 추론이 어긋났는지 보인다
              content = '❌'
            } else if (cell.revealed) {
              content = cell.mine ? (isExploded ? '💥' : '💣') : cell.adjacent > 0 ? String(cell.adjacent) : ''
              if (content && !reducedRef.current) {
                faceAnim = 'anim-spawn [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]'
                const delay = origin
                  ? Math.min((Math.abs(x - origin.x) + Math.abs(y - origin.y)) * RIPPLE_STEP, RIPPLE_CAP)
                  : 0
                faceStyle = delay ? { animationDelay: `${delay}ms` } : undefined
              } else if (content) {
                faceAnim = '[text-shadow:0_1px_2px_rgba(0,0,0,0.5)]'
              }
            } else if (cell.flagged) {
              content = '🚩'
              if (!reducedRef.current) faceAnim = 'anim-pop'
            }

            return (
              <button
                key={`${x},${y}`}
                data-testid="ms-cell"
                data-revealed={cell.revealed}
                aria-label={`cell ${x + 1}, ${y + 1}: ${cellState}`}
                onPointerDown={(e) => onCellPointerDown(e, x, y)}
                onPointerMove={onCellPointerMove}
                onPointerUp={cancelPress}
                onPointerCancel={cancelPress}
                onPointerLeave={cancelPress}
                onClick={() => onCellClick(x, y)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  // 터치 길게 누르기는 위 타이머가 처리한다(Android가 contextmenu도 쏴서 깃발이 두 번 토글되지 않게).
                  if (lastPointerRef.current !== 'mouse') return
                  handleCell(x, y, true)
                }}
                className={`btn-press flex aspect-square items-center justify-center rounded-md text-lg font-extrabold [-webkit-touch-callout:none] sm:text-xl ${
                  isExploded ? EXPLODED_TILE : cell.revealed ? OPEN_TILE : CLOSED_TILE
                } ${NUMBER_COLORS[cell.adjacent] ?? ''}`}
              >
                <span key={face} className={faceAnim} style={faceStyle}>
                  {content}
                </span>
              </button>
            )
          }),
        )}
        <GameOverlay
          show={state.over && showOverlay}
          variant={state.won ? 'win' : 'lose'}
          title={state.won ? 'You win!' : 'Boom!'}
          testId="game-over"
          compact
        >
          <p data-testid="ms-result" className="text-sm font-semibold text-fg">
            {state.won ? (
              <>
                Cleared in <span className="tabular-nums">{fmtTime(elapsed)}</span>
                {' · '}
                {prevBest === null || elapsed < prevBest ? (
                  <span className="text-garden-sunflower">{prevBest === null ? 'First clear!' : 'New best!'}</span>
                ) : (
                  <span className="text-fg-muted">
                    best <span className="tabular-nums">{fmtTime(prevBest)}</span>
                    {elapsed > prevBest ? ` (+${elapsed - prevBest}s)` : ''}
                  </span>
                )}
              </>
            ) : (
              <>
                {TOTAL_SAFE - left}/{TOTAL_SAFE} safe squares cleared
                <span className="text-fg-muted"> · {left} to go</span>
              </>
            )}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            {state.won ? 'Play again' : 'Try again'}
          </GameButton>
        </GameOverlay>
      </div>
      {modeSwitch}
    </GameShell>
  )
}
