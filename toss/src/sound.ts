/**
 * 합성 효과음(에셋 없음). 웹 포털 useGameSound와 같은 음색을 쓰되, 토스 체크리스트에 맞춰
 * 백그라운드로 가면 즉시 멈추고(AudioContext suspend) 돌아오면 다시 켠다.
 */
export type SoundName = 'move' | 'eat' | 'flag' | 'error' | 'match' | 'win' | 'lose'

const MASTER_GAIN = 0.14
let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = MASTER_GAIN
  master.connect(ctx.destination)
  return ctx
}

function tone(
  c: AudioContext,
  dest: AudioNode,
  o: { freq: number; glideTo?: number; type?: OscillatorType; start?: number; duration: number; gain?: number },
) {
  const t0 = c.currentTime + (o.start ?? 0)
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + o.duration)
  const g = o.gain ?? 1
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(g, t0 + 0.01)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + o.duration)
  osc.connect(env).connect(dest)
  osc.start(t0)
  osc.stop(t0 + o.duration + 0.02)
}

export function playSound(name: SoundName): void {
  if (muted || document.hidden) return
  const c = ensure()
  if (!c || !master) return
  if (c.state === 'suspended') void c.resume()
  const m = master
  switch (name) {
    case 'move':
      tone(c, m, { freq: 180, type: 'triangle', duration: 0.06, gain: 0.5 })
      break
    case 'eat':
      tone(c, m, { freq: 520, glideTo: 760, type: 'square', duration: 0.09, gain: 0.5 })
      break
    case 'flag':
      tone(c, m, { freq: 440, type: 'square', duration: 0.05, gain: 0.4 })
      break
    case 'error':
      tone(c, m, { freq: 196, glideTo: 138, type: 'sawtooth', duration: 0.14, gain: 0.45 })
      break
    case 'match':
      tone(c, m, { freq: 587.33, type: 'triangle', duration: 0.16, gain: 0.6 })
      tone(c, m, { freq: 880, type: 'sine', start: 0.06, duration: 0.2, gain: 0.5 })
      break
    case 'win':
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(c, m, { freq: f, type: 'triangle', start: i * 0.1, duration: 0.28, gain: 0.7 }),
      )
      break
    case 'lose':
      tone(c, m, { freq: 300, glideTo: 90, type: 'sawtooth', duration: 0.4, gain: 0.6 })
      break
  }
}

export function setMuted(v: boolean): void {
  muted = v
}

/** 앱 시작 시 1회. 백그라운드 전환 시 소리를 즉시 끊고, 복귀하면 다시 켠다. */
export function installSoundLifecycle(): void {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else void ctx.resume()
  })
}
