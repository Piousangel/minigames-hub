'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canToss,
  dailySeed,
  laneDistance,
  laneRisk,
  mulberry32,
  newGame,
  placeChip,
  toss,
  wouldLock,
  type Rng,
  type StackpotState,
} from '@/lib/games/stackpot/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'
import { todayUTC as todayString } from '@/lib/dailyDate'
import { bumpStreak, currentStreak, loadStreak, saveStreak } from '@/lib/dailyStreak'

const COMBO_KEY_SUFFIX = ':combo'

const RISK_STYLES: Record<'safe' | 'warn' | 'danger', string> = {
  safe: 'border-neon-green/40',
  warn: 'border-neon-amber/70 shadow-[inset_0_0_16px_rgba(251,191,36,0.15)]',
  danger: 'border-neon-red/80 shadow-[inset_0_0_18px_rgba(255,77,109,0.22)]',
}

const RISK_LABEL: Record<'safe' | 'warn' | 'danger', string> = {
  safe: 'safe',
  warn: 'risky',
  danger: 'deadly',
}

const RISK_LABEL_STYLE: Record<'safe' | 'warn' | 'danger', string> = {
  safe: 'text-neon-green/80',
  warn: 'text-neon-amber',
  danger: 'text-neon-red',
}

export function GameStackpot({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<StackpotState | null>(null)
  const [best, setBest] = useState(0)
  const [bestCombo, setBestCombo] = useState(1)
  const [newBest, setNewBest] = useState(false)
  const [daily, setDaily] = useState(false)
  const [dayStreak, setDayStreak] = useState(0)
  // 마지막 액션 결과에 붙는 애니메이션 키 — 리렌더 때마다 증가.
  const [fxKey, setFxKey] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  const rngRef = useRef<Rng>(() => 0)
  const stateRef = useRef<StackpotState | null>(null)
  const dailyRef = useRef(false)
  const timersRef = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
  }, [])

  const commit = useCallback((s: StackpotState) => {
    stateRef.current = s
    setState(s)
    setFxKey((k) => k + 1)
  }, [])

  const restart = useCallback(() => {
    clearTimers()
    setNewBest(false)
    const seed = dailyRef.current ? dailySeed(todayString()) : Math.floor(Math.random() * 2 ** 32)
    rngRef.current = mulberry32(seed >>> 0)
    commit(newGame(rngRef.current))
  }, [clearTimers, commit])

  // 마운트 후 초기화(SSR 안전) + 저장값 하이드레이트.
  useEffect(() => {
    const storedBest = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(storedBest) ? storedBest : 0)
    const storedCombo = Number(localStorage.getItem(storageKey + COMBO_KEY_SUFFIX))
    setBestCombo(Number.isFinite(storedCombo) && storedCombo >= 1 ? storedCombo : 1)
    // 모드를 기억한다. 홈의 Daily 필터가 이 게임을 가리키므로 기본값은 daily.
    // restart()가 dailyRef를 읽어 시드를 정하므로 반드시 그 전에 세팅한다.
    const isDaily = localStorage.getItem(`${storageKey}:mode`) !== 'random'
    dailyRef.current = isDaily
    setDaily(isDaily)
    setDayStreak(currentStreak(loadStreak(`${storageKey}:streak`)))
    restart()
    return () => clearTimers()
  }, [restart, storageKey, clearTimers])

  // 사운드 + 화면 흔들림 등 이벤트 반응.
  useEffect(() => {
    if (!state || fxKey === 0) return
    const ev = state.event
    switch (ev.type) {
      case 'place':
        play('move')
        break
      case 'lock':
        play(state.combo >= 4 ? 'win' : 'match')
        break
      case 'bust':
        play('error')
        break
      case 'toss':
        play('flip')
        break
      default:
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxKey])

  // 게임 오버 시 베스트 갱신.
  useEffect(() => {
    if (!state || !state.over) return
    const beat = state.score > best && state.score > 0
    setNewBest(beat)
    if (beat) {
      setBest(state.score)
      localStorage.setItem(storageKey, String(state.score))
    }
    if (state.longestCombo > bestCombo) {
      setBestCombo(state.longestCombo)
      localStorage.setItem(storageKey + COMBO_KEY_SUFFIX, String(state.longestCombo))
    }
    if (dailyRef.current) {
      const streakKey = `${storageKey}:streak`
      const bumped = bumpStreak(loadStreak(streakKey))
      saveStreak(streakKey, bumped)
      setDayStreak(bumped.streak)
    }
    play(beat ? 'win' : 'lose')
    recordResult(storageKey.replace(/^best:/, ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.over])

  const doPlace = useCallback(
    (laneIndex: number) => {
      const s = stateRef.current
      if (!s || s.over) return
      commit(placeChip(s, laneIndex, rngRef.current))
    },
    [commit],
  )

  const doToss = useCallback(() => {
    const s = stateRef.current
    if (!s || !canToss(s)) return
    commit(toss(s, rngRef.current))
  }, [commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s || s.over || e.repeat) return
      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        doPlace(Number(e.key) - 1)
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        doToss()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doPlace, doToss])

  const toggleDaily = () => {
    const next = !dailyRef.current
    dailyRef.current = next
    setDaily(next)
    localStorage.setItem(`${storageKey}:mode`, next ? 'daily' : 'random')
    // 모드 전환 = 새 시퀀스로 새 게임.
    restart()
  }

  const hint = 'Tap a lane (or press 1–4) to drop the chip. D or the tray tosses it. Hit each target EXACTLY.'

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-120 select-none">
        <div className="aspect-[4/3] w-full rounded-xl bg-surface p-2" data-testid="stackpot-loading" />
        <p className="mt-3 text-center text-sm text-fg-muted">{hint}</p>
      </div>
    )
  }

  const reduced = reducedRef.current
  const ev = state.event
  const boardShake = !reduced && ev.type === 'bust'
  const boardFlash = !reduced && ev.type === 'lock'

  return (
    <>
      <style>{`
        @keyframes sp-drop { 0% { transform: translateY(-40%); } 60% { transform: translateY(6%); } 100% { transform: translateY(0); } }
        @keyframes sp-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        @keyframes sp-flash { 0% { opacity: 0.55; } 100% { opacity: 0; } }
        @keyframes sp-lockpulse { 0% { transform: scale(1); box-shadow: 0 0 0 rgba(52,227,155,0); } 40% { transform: scale(1.05); box-shadow: 0 0 24px rgba(52,227,155,0.7); } 100% { transform: scale(1); box-shadow: 0 0 0 rgba(52,227,155,0); } }
        @keyframes sp-drain { 0% { transform: scaleY(1); opacity: 1; } 100% { transform: scaleY(0.05); opacity: 0.3; } }
        @keyframes sp-coin { 0% { transform: translateY(0) scale(0.4); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-70px) scale(1.1); opacity: 0; } }
        @keyframes sp-tossout { 0% { transform: translateX(0) rotate(0); opacity: 1; } 100% { transform: translateX(60px) rotate(40deg); opacity: 0; } }
        @keyframes sp-fitpulse { 0%,100% { box-shadow: inset 0 0 0 2px rgba(251,191,36,0.4); } 50% { box-shadow: inset 0 0 20px 2px rgba(251,191,36,0.8); } }
        .sp-anim-drop { animation: sp-drop 220ms ease-out; }
        .sp-anim-shake { animation: sp-shake 320ms ease-in-out; }
        .sp-anim-lockpulse { animation: sp-lockpulse 420ms ease-out; }
        .sp-anim-drain { animation: sp-drain 300ms ease-in forwards; }
        .sp-fit { animation: sp-fitpulse 1s ease-in-out infinite; }
        .sp-coin { animation: sp-coin 700ms ease-out forwards; }
      `}</style>
      <GameShell
        stats={[
          { label: 'Score', value: state.score, testId: 'score', float: true },
          { label: 'Best', value: best },
          { label: 'Combo', value: state.combo, testId: 'combo' },
          ...(daily ? [{ label: 'Day Streak', value: dayStreak, testId: 'day-streak' }] : []),
        ]}
        headerExtra={
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDaily}
              aria-pressed={daily}
              aria-label={daily ? 'Switch to random chip sequence' : 'Switch to daily chip sequence'}
              className="btn-press rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-xs font-semibold hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {daily ? '📅 Daily' : '🎲 Random'}
            </button>
            <span className="rounded-lg border border-border bg-surface/80 px-2.5 py-1.5 text-xs text-fg-muted">
              Best combo <span className="font-bold text-accent">×{bestCombo}</span>
            </span>
          </div>
        }
        onNewGame={restart}
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
      >
        <div
          className={`relative rounded-xl bg-surface p-3 ${boardShake ? 'sp-anim-shake' : ''}`}
          data-testid="stackpot-board"
        >
          {boardFlash && (
            <div
              key={fxKey}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 rounded-xl bg-neon-green/30"
              style={{ animation: 'sp-flash 360ms ease-out forwards' }}
            />
          )}

          {/* Tray + toss row */}
          <div className="relative z-[1] mb-3 flex items-center justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="flex flex-col items-center">
                <span className="mb-1 text-[10px] uppercase tracking-wide text-fg-muted">Tray</span>
                <div
                  key={`tray-${fxKey}`}
                  data-testid="tray-chip"
                  className={`flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-extrabold text-stone-900 shadow-[0_0_18px_rgba(251,191,36,0.5)] ${!reduced && ev.type === 'place' ? 'sp-anim-drop' : ''}`}
                >
                  {state.tray}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="mb-1 text-[10px] uppercase tracking-wide text-fg-muted">Next</span>
                <div
                  data-testid="next-chip"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-bg-2/60 text-base font-bold text-fg-muted"
                >
                  {state.next}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <div data-testid="lives" aria-label={`${state.lives} lives remaining`} className="text-lg leading-none">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} aria-hidden="true">
                    {i < state.lives ? '❤️' : '🖤'}
                  </span>
                ))}
              </div>
              <GameButton
                variant="ghost"
                onClick={doToss}
                disabled={!canToss(state)}
                data-testid="stackpot-toss"
                aria-label={`Toss the tray chip ${state.tray}. ${state.tossesLeft} tosses left`}
              >
                🗑 Toss ×{state.tossesLeft}
              </GameButton>
            </div>
          </div>

          {/* Lanes */}
          <div className="relative z-[1] grid grid-cols-4 gap-2">
            {state.lanes.map((lane, i) => {
              const risk = laneRisk(lane)
              const dist = laneDistance(lane)
              const fits = wouldLock(lane, state.tray)
              const fill = Math.min(1, lane.total / lane.target)
              const justLocked = !reduced && ev.type === 'lock' && ev.lane === i
              const justBust = !reduced && ev.type === 'bust' && ev.lane === i
              return (
                <button
                  key={i}
                  onClick={() => doPlace(i)}
                  disabled={state.over}
                  data-testid={`lane-${i}`}
                  data-risk={risk}
                  aria-label={`Place chip ${state.tray} into lane ${i + 1}, target ${lane.target}, needs ${dist}${fits ? ' — this chip fits' : ''}`}
                  className={`group relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border-2 bg-bg-2/50 p-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 ${RISK_STYLES[risk]} ${fits ? 'sp-fit' : ''} ${justLocked ? 'sp-anim-lockpulse' : ''}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                    Lane {i + 1}
                  </span>
                  {/* Fill column */}
                  <div className="relative h-24 w-full overflow-hidden rounded-md bg-bg/60">
                    <div
                      className={`absolute bottom-0 left-0 w-full rounded-md bg-gradient-to-t from-accent/70 to-accent/30 ${justBust ? 'sp-anim-drain' : ''}`}
                      style={{ height: `${fill * 100}%`, transformOrigin: 'bottom' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span data-testid={`lane-total-${i}`} className="text-2xl font-extrabold text-fg drop-shadow">
                        {lane.total}
                      </span>
                    </div>
                    {justLocked &&
                      Array.from({ length: 5 }, (_, c) => (
                        <span
                          key={`${fxKey}-${c}`}
                          aria-hidden="true"
                          className="sp-coin pointer-events-none absolute bottom-2 text-lg"
                          style={{ left: `${12 + c * 18}%`, animationDelay: `${c * 40}ms` }}
                        >
                          🪙
                        </span>
                      ))}
                  </div>
                  <div className="flex w-full items-baseline justify-between px-0.5 text-[11px]">
                    <span className="text-fg-muted">
                      /<span data-testid={`lane-target-${i}`} className="font-bold text-fg">{lane.target}</span>
                    </span>
                    <span data-testid={`lane-distance-${i}`} className="font-bold text-accent">
                      −{dist}
                    </span>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase ${RISK_LABEL_STYLE[risk]}`}>
                    {fits ? 'fits!' : RISK_LABEL[risk]}
                  </span>
                </button>
              )
            })}
          </div>

          <GameOverlay
            show={state.over}
            variant={newBest ? 'win' : 'lose'}
            title={newBest ? 'New best!' : 'Game over'}
            testId="game-over"
          >
            <div className="flex flex-col items-center gap-1 text-sm">
              <p>
                Score <span className="font-bold text-accent">{state.score}</span>
              </p>
              <p className="text-fg-muted">
                Longest combo ×{state.longestCombo} · {state.locksTotal} locks
              </p>
            </div>
            <GameButton onClick={restart} className="px-4 py-2">
              Play Again
            </GameButton>
          </GameOverlay>
        </div>
      </GameShell>
    </>
  )
}
