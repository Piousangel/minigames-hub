'use client'

import { useCallback, useEffect, useRef } from 'react'
import { BARS, BAR_BEATS, BEAT_S, barNotes, midiToHz } from './plopMusic'

/**
 * 뿅 착지 오디오: 효과음 + 절차적 배경음악(Web Audio). 담당: PM·디자이너(docs/team/DESIGN-PROCESS 7번).
 * 규칙: 첫 사용자 입력 뒤에만 시작(unlock), 음소거면 아무 소리도 내지 않고 BGM은 페이드아웃, 탭이 숨겨지면 정지,
 * BGM은 효과음보다 훨씬 작게(마스터 0.14 × BGM 0.5), 시작 때 2초 페이드인.
 */
export type PlopSfx = 'charge' | 'cancel' | 'launch' | 'good' | 'perfect' | 'warn' | 'splash' | 'sunk'

const MASTER = 0.14
const BGM_LEVEL = 0.5
const LOOKAHEAD_S = 0.5

type AudioCtor = typeof AudioContext

function tone(ctx: AudioContext, dest: AudioNode, o: { freq: number; glideTo?: number; type?: OscillatorType; start?: number; dur: number; gain?: number; attack?: number }) {
  const t0 = ctx.currentTime + (o.start ?? 0)
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), t0 + o.dur)
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(o.gain ?? 1, t0 + (o.attack ?? 0.008))
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  osc.connect(env).connect(dest)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.03)
}

function noiseBurst(ctx: AudioContext, dest: AudioNode, o: { start?: number; dur: number; gain: number; freq: number }) {
  const n = Math.floor(ctx.sampleRate * o.dur)
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = o.freq
  const g = ctx.createGain()
  g.gain.value = o.gain
  src.connect(f).connect(g).connect(dest)
  src.start(ctx.currentTime + (o.start ?? 0))
}

function sfx(ctx: AudioContext, dest: AudioNode, name: PlopSfx, arg = 0) {
  switch (name) {
    case 'charge':
      tone(ctx, dest, { freq: 330 + arg * 520, type: 'sine', dur: 0.06, gain: 0.3 })
      break
    case 'cancel':
      tone(ctx, dest, { freq: 280, glideTo: 170, type: 'sine', dur: 0.12, gain: 0.35 })
      break
    case 'launch': // 뿅: 스프링처럼 올라가는 두 겹
      tone(ctx, dest, { freq: 240, glideTo: 640, type: 'sine', dur: 0.17, gain: 0.6 })
      tone(ctx, dest, { freq: 500, glideTo: 940, type: 'triangle', start: 0.03, dur: 0.12, gain: 0.3 })
      break
    case 'good':
      tone(ctx, dest, { freq: 160, glideTo: 90, type: 'sine', dur: 0.12, gain: 0.55 })
      tone(ctx, dest, { freq: 523.25, glideTo: 470, type: 'triangle', start: 0.01, dur: 0.14, gain: 0.45 })
      break
    case 'perfect': {
      tone(ctx, dest, { freq: 160, glideTo: 90, type: 'sine', dur: 0.12, gain: 0.5 })
      ;[659.25, 880, 1318.5].forEach((f, i) => tone(ctx, dest, { freq: f, type: 'triangle', start: 0.02 + i * 0.07, dur: 0.2, gain: 0.5 }))
      tone(ctx, dest, { freq: 2637, type: 'sine', start: 0.2, dur: 0.3, gain: 0.18 })
      break
    }
    case 'warn':
      tone(ctx, dest, { freq: 196, type: 'sine', dur: 0.1, gain: 0.35 })
      tone(ctx, dest, { freq: 196, type: 'sine', start: 0.16, dur: 0.1, gain: 0.35 })
      break
    case 'splash':
      tone(ctx, dest, { freq: 520, glideTo: 130, type: 'sine', dur: 0.32, gain: 0.5 })
      noiseBurst(ctx, dest, { start: 0.1, dur: 0.22, gain: 0.5, freq: 900 })
      break
    case 'sunk':
      tone(ctx, dest, { freq: 150, glideTo: 60, type: 'sine', dur: 0.5, gain: 0.55 })
      noiseBurst(ctx, dest, { start: 0.05, dur: 0.35, gain: 0.35, freq: 500 })
      break
  }
}

export function usePlopAudio(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const bgmGainRef = useRef<GainNode | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mutedRef = useRef(muted)
  const tintRef = useRef<0 | 1 | 2>(0)
  const wantBgm = useRef(false)
  const next = useRef({ bar: 0, time: 0 })

  const ensure = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current
    if (typeof window === 'undefined') return null
    const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    const master = ctx.createGain()
    master.gain.value = MASTER
    master.connect(ctx.destination)
    const bgm = ctx.createGain()
    bgm.gain.value = 0.0001
    bgm.connect(master)
    ctxRef.current = ctx
    masterRef.current = master
    bgmGainRef.current = bgm
    return ctx
  }, [])

  const scheduleBar = useCallback((ctx: AudioContext, bgm: GainNode, tint: 0 | 1 | 2, bar: number, at: number) => {
    for (const n of barNotes(tint, bar)) {
      const t0 = at + n.beat * BEAT_S
      const dur = n.beats * BEAT_S
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = n.kind === 'lead' ? 'sine' : n.kind === 'bass' ? 'triangle' : 'sine'
      osc.frequency.value = midiToHz(n.midi)
      const attack = n.kind === 'pad' ? 0.6 : n.kind === 'bass' ? 0.04 : 0.008
      env.gain.setValueAtTime(0.0001, t0)
      env.gain.exponentialRampToValueAtTime(n.gain, t0 + attack)
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.connect(env).connect(bgm)
      osc.start(t0)
      osc.stop(t0 + dur + 0.05)
      if (n.kind === 'lead') {
        // 뮤직박스의 밝은 배음(2배음)을 아주 작게
        const o2 = ctx.createOscillator()
        const e2 = ctx.createGain()
        o2.type = 'sine'
        o2.frequency.value = midiToHz(n.midi) * 2
        e2.gain.setValueAtTime(0.0001, t0)
        e2.gain.exponentialRampToValueAtTime(n.gain * 0.25, t0 + 0.006)
        e2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.5)
        o2.connect(e2).connect(bgm)
        o2.start(t0)
        o2.stop(t0 + dur * 0.5 + 0.05)
      }
    }
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const stopBgm = useCallback(() => {
    wantBgm.current = false
    stopTimer()
    const ctx = ctxRef.current
    const g = bgmGainRef.current
    if (ctx && g) {
      g.gain.cancelScheduledValues(ctx.currentTime)
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12)
    }
  }, [stopTimer])

  const startBgm = useCallback(
    (tint: 0 | 1 | 2) => {
      tintRef.current = tint
      if (mutedRef.current) return
      const ctx = ctxRef.current // 첫 사용자 입력(unlock) 전에는 컨텍스트를 만들지 않는다(자동재생 정책)
      const bgm = bgmGainRef.current
      if (!ctx || !bgm) return
      if (ctx.state === 'suspended') void ctx.resume()
      if (wantBgm.current && tintRef.current === tint && timerRef.current) return
      stopTimer()
      tintRef.current = tint
      wantBgm.current = true
      bgm.gain.cancelScheduledValues(ctx.currentTime)
      bgm.gain.setValueAtTime(0.0001, ctx.currentTime)
      bgm.gain.exponentialRampToValueAtTime(BGM_LEVEL, ctx.currentTime + 2) // 2초 페이드인
      next.current = { bar: 0, time: ctx.currentTime + 0.1 }
      const pump = () => {
        const c = ctxRef.current
        const g = bgmGainRef.current
        if (!c || !g || !wantBgm.current) return
        while (next.current.time < c.currentTime + LOOKAHEAD_S) {
          scheduleBar(c, g, tintRef.current, next.current.bar % BARS, next.current.time)
          next.current.time += BAR_BEATS * BEAT_S
          next.current.bar += 1
        }
      }
      pump()
      timerRef.current = setInterval(pump, 150)
    },
    [scheduleBar, stopTimer],
  )

  /** 첫 사용자 입력에서 호출: AudioContext를 만들고(자동재생 정책) BGM 시작 */
  const unlock = useCallback(
    (tint: 0 | 1 | 2) => {
      tintRef.current = tint
      const ctx = ensure()
      if (ctx && ctx.state === 'suspended') void ctx.resume()
      if (!mutedRef.current && !wantBgm.current) startBgm(tint)
    },
    [ensure, startBgm],
  )

  const play = useCallback(
    (name: PlopSfx, arg?: number) => {
      if (mutedRef.current) return
      const ctx = ctxRef.current
      const master = masterRef.current
      if (!ctx || !master) return
      if (ctx.state === 'suspended') void ctx.resume()
      sfx(ctx, master, name, arg)
    },
    [],
  )

  // 음소거 토글: 끄면 BGM 페이드아웃, 켜면(이미 unlock 했다면) 다시 시작
  useEffect(() => {
    mutedRef.current = muted
    if (muted) stopBgm()
    else if (ctxRef.current) startBgm(tintRef.current)
  }, [muted, stopBgm, startBgm])

  // 탭이 숨겨지면 정지, 돌아오면(음소거 아님) 재개
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        const ctx = ctxRef.current
        if (ctx && ctx.state === 'running') void ctx.suspend()
      } else if (!mutedRef.current) {
        const ctx = ctxRef.current
        if (ctx && ctx.state === 'suspended') void ctx.resume()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(
    () => () => {
      stopTimer()
      const ctx = ctxRef.current
      ctxRef.current = null
      if (ctx) void ctx.close().catch(() => {})
    },
    [stopTimer],
  )

  return { play, unlock, startBgm, stopBgm }
}
