'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Synthesized sound effects for the game template.
 *
 * - No audio assets: every sound is generated live with the Web Audio API.
 * - The AudioContext is created lazily on the first `play()` call so it starts
 *   only after a user gesture (browser autoplay policy).
 * - Mute state is persisted to localStorage and shared across games.
 */

const STORAGE_KEY = 'minigames:muted'
const MASTER_GAIN = 0.14

export type SoundName = 'move' | 'merge' | 'win' | 'lose' | 'eat' | 'flag'

type AudioCtor = typeof AudioContext

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
  return Ctor ? new Ctor() : null
}

/** One synthesized tone with an attack/decay envelope. */
function tone(
  ctx: AudioContext,
  destination: AudioNode,
  {
    freq,
    glideTo,
    type = 'sine',
    start = 0,
    duration,
    gain = 1,
  }: {
    freq: number
    glideTo?: number
    type?: OscillatorType
    start?: number
    duration: number
    gain?: number
  },
) {
  const t0 = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (glideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + duration)
  }
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(env).connect(destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

function render(ctx: AudioContext, master: AudioNode, name: SoundName) {
  switch (name) {
    case 'move':
      tone(ctx, master, { freq: 180, type: 'triangle', duration: 0.06, gain: 0.5 })
      break
    case 'merge':
      tone(ctx, master, { freq: 330, glideTo: 520, type: 'triangle', duration: 0.12, gain: 0.8 })
      tone(ctx, master, { freq: 660, type: 'sine', start: 0.02, duration: 0.1, gain: 0.4 })
      break
    case 'eat':
      tone(ctx, master, { freq: 520, glideTo: 760, type: 'square', duration: 0.09, gain: 0.5 })
      break
    case 'flag':
      tone(ctx, master, { freq: 440, type: 'square', duration: 0.05, gain: 0.4 })
      break
    case 'win': {
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((f, i) => tone(ctx, master, { freq: f, type: 'triangle', start: i * 0.1, duration: 0.28, gain: 0.7 }))
      break
    }
    case 'lose':
      tone(ctx, master, { freq: 300, glideTo: 90, type: 'sawtooth', duration: 0.4, gain: 0.6 })
      break
  }
}

export function useGameSound() {
  const [muted, setMuted] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const mutedRef = useRef(false)

  // Hydrate mute state from storage after mount (avoids SSR mismatch).
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const value = stored === '1'
    mutedRef.current = value
    setMuted(value)
  }, [])

  const play = useCallback((name: SoundName) => {
    if (mutedRef.current) return
    let ctx = ctxRef.current
    if (!ctx) {
      ctx = getAudioContext()
      if (!ctx) return
      ctxRef.current = ctx
      const master = ctx.createGain()
      master.gain.value = MASTER_GAIN
      master.connect(ctx.destination)
      masterRef.current = master
    }
    // Resume if the context was suspended by autoplay policy.
    if (ctx.state === 'suspended') void ctx.resume()
    if (masterRef.current) render(ctx, masterRef.current, name)
  }, [])

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      mutedRef.current = next
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  return { muted, toggleMuted, play }
}
