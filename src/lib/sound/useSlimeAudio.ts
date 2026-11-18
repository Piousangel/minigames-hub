'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * 말랑 미끄럼길 효과음(Web Audio, 절차 생성 — 파일 없음). 뿅 착지 오디오(usePlopAudio)와 같은 규칙:
 * 첫 사용자 입력(unlock) 전에는 AudioContext를 만들지 않고, 음소거면 아무 소리도 내지 않으며, 탭이 숨겨지면 멈춘다.
 * BGM은 시험판 반응을 본 뒤 추가한다.
 */
export type SlimeSfx = 'draw' | 'release' | 'acorn' | 'nest' | 'spiked' | 'fell' | 'stalled' | 'invalid'

const MASTER = 0.16

type AudioCtor = typeof AudioContext

/** n번째 도토리(1~3)의 음 높이(Hz): 도-미-솔로 올라가 '연속으로 먹는 쾌감'을 만든다. */
export function acornFreq(n: number): number {
  return [523.25, 659.25, 783.99][Math.max(0, Math.min(2, n - 1))]
}

function tone(ctx: AudioContext, dest: AudioNode, o: { freq: number; glideTo?: number; type?: OscillatorType; start?: number; dur: number; gain?: number; attack?: number }) {
  const t0 = ctx.currentTime + (o.start ?? 0)
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + o.dur)
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(o.gain ?? 0.4, t0 + (o.attack ?? 0.008))
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  osc.connect(env).connect(dest)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.05)
}

function noiseBurst(ctx: AudioContext, dest: AudioNode, o: { start?: number; dur: number; gain: number; freq: number }) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const filt = ctx.createBiquadFilter()
  filt.type = 'bandpass'
  filt.frequency.value = o.freq
  const env = ctx.createGain()
  const t0 = ctx.currentTime + (o.start ?? 0)
  env.gain.setValueAtTime(o.gain, t0)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  src.connect(filt).connect(env).connect(dest)
  src.start(t0)
}

function playSfx(ctx: AudioContext, dest: AudioNode, sfx: SlimeSfx, n = 1) {
  switch (sfx) {
    case 'draw': // 분필이 닿는 짧은 틱
      noiseBurst(ctx, dest, { dur: 0.05, gain: 0.18, freq: 3200 })
      break
    case 'release': // 놓는 순간: 휙 하고 미끄러지기 시작
      noiseBurst(ctx, dest, { dur: 0.22, gain: 0.3, freq: 1400 })
      tone(ctx, dest, { freq: 420, glideTo: 220, type: 'sine', dur: 0.2, gain: 0.3 })
      break
    case 'acorn':
      tone(ctx, dest, { freq: acornFreq(n), type: 'triangle', dur: 0.2, gain: 0.5 })
      tone(ctx, dest, { freq: acornFreq(n) * 2, type: 'sine', start: 0.01, dur: 0.14, gain: 0.18 })
      break
    case 'nest': // 도착: 올라가는 아르페지오
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ctx, dest, { freq: f, type: 'triangle', start: i * 0.08, dur: 0.26, gain: 0.45 }))
      tone(ctx, dest, { freq: 2093, type: 'sine', start: 0.3, dur: 0.35, gain: 0.15 })
      break
    case 'spiked': // 뾱: 짧은 팝
      tone(ctx, dest, { freq: 700, glideTo: 180, type: 'square', dur: 0.1, gain: 0.25 })
      noiseBurst(ctx, dest, { dur: 0.1, gain: 0.35, freq: 2200 })
      break
    case 'fell': // 아래로 사라지는 소리
      tone(ctx, dest, { freq: 520, glideTo: 90, type: 'sine', dur: 0.5, gain: 0.4 })
      break
    case 'stalled': // 멈춤: 풀 죽은 두 음
      tone(ctx, dest, { freq: 330, type: 'sine', dur: 0.18, gain: 0.3 })
      tone(ctx, dest, { freq: 247, type: 'sine', start: 0.16, dur: 0.28, gain: 0.3 })
      break
    case 'invalid': // 너무 짧음/스폰 반경: 낮은 톡
      tone(ctx, dest, { freq: 160, type: 'sine', dur: 0.08, gain: 0.3 })
      break
  }
}

export function useSlimeAudio(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const mutedRef = useRef(muted)

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // 첫 사용자 입력 뒤에만 컨텍스트를 만든다(자동재생 정책·불필요한 오디오 방지)
  const unlock = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
      if (!Ctor) return null
      const ctx = new Ctor()
      const master = ctx.createGain()
      master.gain.value = MASTER
      master.connect(ctx.destination)
      ctxRef.current = ctx
      masterRef.current = master
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const play = useCallback((sfx: SlimeSfx, n = 1) => {
    if (mutedRef.current) return
    const ctx = ctxRef.current
    const master = masterRef.current
    if (!ctx || !master || ctx.state === 'closed') return // unlock 전에는 소리 없음
    playSfx(ctx, master, sfx, n)
  }, [])

  // 탭이 숨겨지면 멈춘다
  useEffect(() => {
    const onVis = () => {
      const ctx = ctxRef.current
      if (!ctx) return
      if (document.hidden) void ctx.suspend()
      else if (!mutedRef.current) void ctx.resume()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [])

  return { unlock, play }
}
