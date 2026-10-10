'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  extendSequence,
  newGame,
  pressPad,
  type Pad,
  type SimonState,
} from '@/lib/games/simon/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// 클래식 Simon 톤 주파수 (green / red / yellow / blue).
const PAD_FREQS = [415.3, 310.0, 252.0, 209.0] as const

// 패드 시각 정의. 각 패드는 어두운 기본색 + 밝게 켜지는 lit 색.
const PADS: {
  base: string
  lit: string
  label: string
}[] = [
  { base: 'bg-green-900', lit: 'bg-green-400', label: 'green' },
  { base: 'bg-red-900', lit: 'bg-red-400', label: 'red' },
  { base: 'bg-yellow-800', lit: 'bg-yellow-300', label: 'yellow' },
  { base: 'bg-blue-900', lit: 'bg-blue-400', label: 'blue' },
]

const CORNER = ['rounded-tl-[80%]', 'rounded-tr-[80%]', 'rounded-bl-[80%]', 'rounded-br-[80%]']

// 켜짐 펄스는 컴포넌트 스코프 keyframes — globals.css 는 건드리지 않는다.
const PULSE_STYLE = `
@keyframes simon-pulse {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.simon-pad-lit { animation: simon-pulse 0.28s ease-out; }`

type Phase = 'idle' | 'showing' | 'input' | 'roundwait' | 'over'

// 라운드가 올라갈수록 재생이 살짝 빨라진다 (하한선 있음).
function lightMs(round: number): number {
  return Math.max(240, 560 - round * 30)
}
function gapMs(round: number): number {
  return Math.max(120, 260 - round * 15)
}

/** 패드별로 서로 다른 음정을 내는 컴포넌트-로컬 Web Audio 헬퍼. */
function useSimonTones() {
  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)

  const ensure = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null
    let ctx = ctxRef.current
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
      ctxRef.current = ctx
      const master = ctx.createGain()
      master.gain.value = 0.16
      master.connect(ctx.destination)
      masterRef.current = master
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }, [])

  const playPad = useCallback(
    (pad: Pad, duration = 0.34) => {
      const ctx = ensure()
      const master = masterRef.current
      if (!ctx || !master) return
      const t0 = ctx.currentTime
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(PAD_FREQS[pad], t0)
      env.gain.setValueAtTime(0.0001, t0)
      env.gain.exponentialRampToValueAtTime(1, t0 + 0.012)
      env.gain.setValueAtTime(1, t0 + Math.max(0.02, duration - 0.06))
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
      osc.connect(env).connect(master)
      osc.start(t0)
      osc.stop(t0 + duration + 0.02)
    },
    [ensure],
  )

  return { playPad }
}

export function GameSimon({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 초기 상태는 클라이언트에서만 생성
  const [state, setState] = useState<SimonState | null>(null)
  const [best, setBest] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [active, setActive] = useState<Pad | null>(null)
  const [newBest, setNewBest] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()
  const { playPad } = useSimonTones()

  const stateRef = useRef<SimonState | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const mutedRef = useRef(false)
  const bestBeforeRef = useRef(0)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const commitState = useCallback((s: SimonState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
  }, [])

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }, [])

  // 패드를 켠다: 색 변화 + 음정. reduced-motion 이어도 색은 바뀐다.
  const lightPad = useCallback(
    (pad: Pad) => {
      setActive(pad)
      if (!mutedRef.current) playPad(pad)
    },
    [playPad],
  )

  // 시퀀스를 재생한 뒤 입력 단계로 넘어간다.
  const playbackSequence = useCallback(
    (seq: Pad[], round: number) => {
      clearTimers()
      setPhaseBoth('showing')
      setActive(null)
      const on = lightMs(round)
      const gap = gapMs(round)
      let t = 420 // 시작 전 짧은 여유
      seq.forEach((pad) => {
        after(t, () => lightPad(pad))
        after(t + on, () => setActive(null))
        t += on + gap
      })
      after(t, () => {
        setActive(null)
        setPhaseBoth('input')
      })
    },
    [after, clearTimers, lightPad, setPhaseBoth],
  )

  const startNextRound = useCallback(
    (base: SimonState) => {
      const next = extendSequence(base, Math.random)
      commitState(next)
      playbackSequence(next.sequence, next.round)
    },
    [commitState, playbackSequence],
  )

  const start = useCallback(() => {
    clearTimers()
    setNewBest(false)
    bestBeforeRef.current = best
    startNextRound(newGame())
  }, [best, clearTimers, startNextRound])

  // 마운트 시 idle 상태 준비 + best 로드
  useEffect(() => {
    const fresh = newGame()
    commitState(fresh)
    setPhaseBoth('idle')
    const stored = Number(localStorage.getItem(storageKey))
    const value = Number.isFinite(stored) ? stored : 0
    setBest(value)
    bestBeforeRef.current = value
    return () => clearTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPadPress = useCallback(
    (pad: Pad) => {
      if (phaseRef.current !== 'input') return
      const cur = stateRef.current
      if (!cur) return

      lightPad(pad)
      // 짧게 켰다 끈다 (재생과 동일한 느낌)
      after(200, () => setActive((a) => (a === pad ? null : a)))

      const res = pressPad(cur, pad)
      commitState(res.state)

      if (!res.correct) {
        clearTimers()
        setPhaseBoth('over')
        const isBest = res.state.score > bestBeforeRef.current
        setNewBest(isBest && res.state.score > 0)
        after(180, () => (isBest && res.state.score > 0 ? play('win') : play('lose')))
        recordResult(storageKey.replace(/^best:/, ''))
        return
      }

      // best 라이브 업데이트
      if (res.state.score > best) {
        setBest(res.state.score)
        localStorage.setItem(storageKey, String(res.state.score))
      }

      if (res.roundComplete) {
        setPhaseBoth('roundwait')
        after(700, () => startNextRound(res.state))
      }
    },
    [after, best, clearTimers, commitState, lightPad, play, setPhaseBoth, startNextRound, storageKey],
  )

  const round = state ? state.sequence.length : 0
  const score = state ? state.score : 0

  const hint =
    phase === 'input'
      ? 'Your turn — repeat the sequence.'
      : phase === 'showing'
        ? 'Watch the pattern…'
        : 'Press Start, then repeat the color sequence.'

  const idleOverlay = phase === 'idle'
  const overOverlay = phase === 'over'

  return (
    <GameShell
      stats={[
        { label: 'Round', value: round, testId: 'round', float: true },
        { label: 'Score', value: score, testId: 'score' },
        { label: 'Best', value: best },
      ]}
      onNewGame={start}
      newGameLabel={phase === 'idle' ? 'Start' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{PULSE_STYLE}</style>
      <div
        className="relative aspect-square w-full rounded-full bg-surface p-3"
        data-testid="simon-board"
        aria-label="Simon color pads"
      >
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-3">
          {PADS.map((p, i) => {
            const pad = i as Pad
            const isLit = active === pad
            const interactive = phase === 'input'
            const litMotion = isLit && !reducedRef.current ? 'simon-pad-lit' : ''
            return (
              <button
                key={p.label}
                type="button"
                data-testid="simon-pad"
                aria-label={`${p.label} pad`}
                disabled={!interactive}
                onClick={() => onPadPress(pad)}
                className={`${CORNER[i]} ${isLit ? p.lit : p.base} ${litMotion} h-full w-full origin-center border border-black/30 shadow-inner transition-colors duration-100 ${
                  isLit ? 'brightness-110' : ''
                } ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
              />
            )
          })}
        </div>

        {/* 중앙 허브 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex aspect-square w-[34%] items-center justify-center rounded-full bg-bg/90 text-center shadow-lg">
            <span className="text-sm font-bold tracking-widest text-fg-muted">SIMON</span>
          </div>
        </div>

        {idleOverlay && (
          <div
            role="dialog"
            aria-label="Ready to play"
            className="anim-backdrop-in absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-full bg-bg/75"
          >
            <p className="text-2xl font-extrabold tracking-tight text-fg">Ready?</p>
            <GameButton onClick={start} className="px-4 py-2">
              Start
            </GameButton>
          </div>
        )}

        <GameOverlay
          show={overOverlay && newBest}
          variant="win"
          title={`New best! ${score}`}
          testId="you-win"
        >
          <GameButton onClick={start} className="px-4 py-2">
            Play again
          </GameButton>
        </GameOverlay>

        <GameOverlay
          show={overOverlay && !newBest}
          variant="lose"
          title="Game over"
          testId="game-over"
        >
          <GameButton onClick={start} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
