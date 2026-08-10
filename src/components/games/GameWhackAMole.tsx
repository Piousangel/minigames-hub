'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GRID_SIZE,
  HOLES,
  hideMole,
  newGame,
  popMole,
  ROUND_MS,
  tickTime,
  whack,
  type WhackState,
} from '@/lib/games/whackamole/engine'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const TICK_MS = 80

// 라운드가 진행될수록(progress 0→1) 두더지가 더 자주, 더 짧게 등장한다.
function spawnDelay(progress: number) {
  return Math.round(880 - progress * 430) // 880ms → 450ms
}
function moleLife(progress: number) {
  return Math.round(1150 - progress * 500) // 1150ms → 650ms
}

interface HoleHit {
  id: number
  hole: number
}

export function GameWhackAMole({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<WhackState | null>(null)
  const [running, setRunning] = useState(false)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  // 타격 순간의 스쿼시 애니메이션 재트리거용 키(구멍별)
  const [whackKeys, setWhackKeys] = useState<number[]>(() => Array<number>(HOLES).fill(0))
  const [floats, setFloats] = useState<HoleHit[]>([])

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  // 타이머가 참조하는 최신 값들(재구독 없이 읽기 위한 ref)
  const lastTick = useRef(0)
  const nextSpawnAt = useRef(0)
  const deadlines = useRef<number[]>(Array<number>(HOLES).fill(0))
  const floatSeq = useRef(0)
  const prevOver = useRef(false)

  const over = state?.over ?? false

  const restart = useCallback(() => {
    setState(newGame())
    setRunning(false)
    setNewBest(false)
    setFloats([])
    deadlines.current = Array<number>(HOLES).fill(0)
    prevOver.current = false
  }, [])

  // 초기화 + best 로드 (클라이언트 전용)
  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) ? stored : 0)
  }, [restart, storageKey])

  const start = useCallback(() => {
    setState((s) => {
      if (!s) return s
      // 이미 끝난 라운드에서 Start를 누르면 새 라운드로.
      return s.over ? newGame() : s
    })
    setNewBest(false)
    setFloats([])
    deadlines.current = Array<number>(HOLES).fill(0)
    prevOver.current = false
    const now = performance.now()
    lastTick.current = now
    nextSpawnAt.current = now + 300
    setRunning(true)
  }, [])

  // 메인 루프: 시간 진행 + 두더지 자동 숨김 + 등장 스케줄링
  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => {
      const now = performance.now()
      const dt = now - lastTick.current
      lastTick.current = now

      setState((s) => {
        if (!s || s.over) return s
        let next = tickTime(s, dt)
        if (next.over) return next

        // 수명이 다한 두더지 내리기
        for (let h = 0; h < HOLES; h++) {
          if (next.moles[h] && deadlines.current[h] && now >= deadlines.current[h]) {
            next = hideMole(next, h)
            deadlines.current[h] = 0
          }
        }

        // 등장 스케줄
        const progress = 1 - next.timeLeft / ROUND_MS
        if (now >= nextSpawnAt.current) {
          const popped = popMole(next, Math.random)
          if (popped !== next) {
            for (let h = 0; h < HOLES; h++) {
              if (popped.moles[h] && !next.moles[h]) {
                deadlines.current[h] = now + moleLife(progress)
              }
            }
            next = popped
          }
          nextSpawnAt.current = now + spawnDelay(progress)
        }
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [running, over])

  // 탭 전환 시 일시정지
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setRunning(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // 라운드 종료 처리: best 갱신 + 승패 사운드
  useEffect(() => {
    if (!state) return
    if (state.over && !prevOver.current) {
      setRunning(false)
      const beat = state.score > best
      if (beat) {
        setBest(state.score)
        setNewBest(true)
        localStorage.setItem(storageKey, String(state.score))
        play('win')
      } else {
        play('lose')
      }
      recordResult(storageKey.replace(/^best:/, ''), { won: true })
    }
    prevOver.current = state.over
  }, [state, best, storageKey, play])

  const hit = useCallback(
    (hole: number) => {
      if (!running) return
      setState((s) => {
        if (!s || s.over) return s
        const res = whack(s, hole)
        if (res.hit) {
          deadlines.current[hole] = 0
          play('eat')
          setWhackKeys((keys) => {
            const nk = keys.slice()
            nk[hole] += 1
            return nk
          })
          const id = ++floatSeq.current
          setFloats((f) => [...f, { id, hole }])
        } else {
          play('error')
        }
        return res.state
      })
    },
    [running, play],
  )

  const secondsLeft = state ? Math.ceil(state.timeLeft / 1000) : Math.round(ROUND_MS / 1000)
  const timerPct = state ? Math.max(0, (state.timeLeft / ROUND_MS) * 100) : 100
  const score = state?.score ?? 0

  const hint = running ? 'Whack the moles before they duck!' : over ? 'Round over — press Start to play again.' : 'Press Start, then tap the moles.'

  const stats = [
    { label: 'Score', value: score, testId: 'score', float: true },
    { label: 'Time', value: secondsLeft },
    { label: 'Best', value: best },
  ]

  const board = (
    <div
      className="relative rounded-xl bg-surface p-4"
      style={reduced ? undefined : { animation: 'wam-board-in .3s ease-out both' }}
    >
      {/* 타이머 바 */}
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div
          className="h-full rounded-full bg-accent"
          style={{
            width: `${timerPct}%`,
            transition: reduced ? undefined : 'width .12s linear',
          }}
        />
      </div>

      <div
        className="grid touch-none gap-3"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
        data-testid="whack-board"
      >
        {Array.from({ length: HOLES }, (_, i) => {
          const up = state?.moles[i] ?? false
          const holeFloats = floats.filter((f) => f.hole === i)
          return (
            <button
              key={i}
              type="button"
              data-testid="whack-hole"
              aria-label={up ? 'Mole up — whack it' : 'Empty hole'}
              onPointerDown={(e) => {
                e.preventDefault()
                hit(i)
              }}
              className="btn-press relative flex aspect-square items-end justify-center overflow-hidden rounded-full bg-gradient-to-b from-stone-800/60 to-stone-900/80 shadow-inner"
            >
              {/* 흙더미 앞턱 */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-b-full bg-stone-700/70"
              />
              {/* 두더지 */}
              <span
                aria-hidden="true"
                className="pointer-events-none relative z-[1] mb-[6%] text-[clamp(1.6rem,9vw,3rem)] leading-none"
                style={{
                  transform: up ? 'translateY(0)' : 'translateY(120%)',
                  opacity: up ? 1 : 0,
                  transition: reduced
                    ? 'none'
                    : 'transform .13s cubic-bezier(.34,1.56,.64,1), opacity .1s ease-out',
                }}
              >
                🐹
              </span>
              {/* 타격 플래시 링(구멍별 whackKeys로 재트리거) */}
              {!reduced && whackKeys[i] > 0 && (
                <span
                  key={whackKeys[i]}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-2 z-[1] rounded-full border-2 border-accent"
                  style={{ animation: 'wam-flash .3s ease-out forwards' }}
                />
              )}
              {/* +1 플로트 */}
              {holeFloats.map((f) => (
                <span
                  key={f.id}
                  aria-hidden="true"
                  onAnimationEnd={() => setFloats((cur) => cur.filter((x) => x.id !== f.id))}
                  className="pointer-events-none absolute top-1 z-[2] text-sm font-extrabold text-accent"
                  style={reduced ? { display: 'none' } : { animation: 'wam-float .6s ease-out forwards' }}
                >
                  +1
                </span>
              ))}
            </button>
          )
        })}
      </div>

      <GameOverlay
        show={over}
        variant={newBest ? 'win' : 'lose'}
        title={newBest ? 'New best!' : "Time's up!"}
        testId="game-over"
      >
        <p className="text-fg-muted">Score: {score}</p>
        <GameButton onClick={start} className="px-4 py-2">
          Play again
        </GameButton>
      </GameOverlay>

      <style>{`
        @keyframes wam-board-in { from { opacity: 0; transform: scale(.97) } to { opacity: 1; transform: none } }
        @keyframes wam-flash { 0% { opacity: .9; transform: scale(.6) } 100% { opacity: 0; transform: scale(1.25) } }
        @keyframes wam-float { 0% { opacity: 1; transform: translateY(0) } 100% { opacity: 0; transform: translateY(-140%) } }
      `}</style>
    </div>
  )

  return (
    <GameShell
      stats={stats}
      onNewGame={start}
      newGameLabel={running ? 'Restart' : over ? 'Play again' : 'Start'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      {board}
    </GameShell>
  )
}
