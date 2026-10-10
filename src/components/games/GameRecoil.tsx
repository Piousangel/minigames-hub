'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ARENA_H,
  ARENA_W,
  AMMO_PTS,
  BANK_PTS,
  DIRS,
  DRIFT_LIMIT,
  FP,
  PREVIEW_TICKS,
  STAR_PTS,
  WIN_BONUS,
  createGameForSeed,
  dailySeedFor,
  difficultyOfSeed,
  dirFromVector,
  isOver,
  predictPath,
  rotateDir,
  seedWithDifficulty,
  setAim,
  step,
  timeBonus,
  type Difficulty,
  type Dir,
  type Phase,
  type RecoilEvent,
  type RecoilInput,
  type RecoilState,
} from '@/lib/games/recoil/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak, loadStreak, saveStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { sendHit } from '@/lib/hit'
import { MAX_NAME_LEN, loadPlayerName, savePlayerName } from '@/lib/leaderboard'
import { challengeUrl, compareChallenge, parseChallenge, type Challenge } from '@/lib/challenge'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type SoundName = Parameters<ReturnType<typeof useGameSound>['play']>[0]

/**
 * best:<slug> holds a bare number (personal best; read with Number() by the trophy case). The day
 * streak lives in its own key in the shared `DailyStreak` JSON format — loadStreak/saveStreak keep
 * freezes/maxStreak. Old saves ({lastDate, streak}) are already that format, so they load as-is.
 */
const DAILY_KEY = 'recoil:daily'
/** Daily seed whose first finished run already counted toward best (blocks reload-farming the daily). */
const DAILY_TRIED_KEY = 'recoil:daily-tried'
const TICK_MS = 1000 / 60
const TRAIL_LEN = 20
const QUEUE_MAX = 3

function loadBest(storageKey: string): number {
  try {
    const n = Number(localStorage.getItem(storageKey) ?? 0)
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n))
  } catch {
    // ignore
  }
  return 0
}

function saveBest(storageKey: string, score: number): void {
  try {
    localStorage.setItem(storageKey, String(score))
  } catch {
    // ignore storage failures
  }
}

function loadDailyTried(): number | null {
  try {
    const n = Number(localStorage.getItem(DAILY_TRIED_KEY))
    return localStorage.getItem(DAILY_TRIED_KEY) !== null && Number.isFinite(n) ? n >>> 0 : null
  } catch {
    return null
  }
}

function saveDailyTried(seed: number): void {
  try {
    localStorage.setItem(DAILY_TRIED_KEY, String(seed >>> 0))
  } catch {
    // ignore
  }
}

/** Daily seed for a UTC 'YYYY-MM-DD' (from todayUTC()). */
function seedForDay(iso: string): number {
  return dailySeedFor(Number(iso.replace(/-/g, '')))
}

/** 도전 모드를 끄면 주소창에서 vs/n/ref를 지워, 새로고침해도 일반 판으로 돌아오게 한다. */
function clearChallengeParams(): void {
  try {
    const url = new URL(window.location.href)
    for (const k of ['vs', 'n', 'ref']) url.searchParams.delete(k)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    // ignore
  }
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

const SOUND_PRIORITY: Array<[RecoilEvent, SoundName]> = [
  ['win', 'win'],
  ['lose', 'lose'],
  ['bank', 'match'],
  ['star', 'eat'],
  ['bounce', 'flag'],
  ['fire', 'move'],
  ['dry', 'error'],
]

/** 5-point star polygon, outer radius 7, inner 3, tip up. Static geometry (render-safe). */
const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 7 : 3
  const a = -Math.PI / 2 + (i * Math.PI) / 5
  return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
}).join(' ')

const u = (v: number) => v / FP

interface Badge {
  seq: number
  x: number
  y: number
  text: string
}
interface Tracer {
  seq: number
  x: number
  y: number
  dir: Dir
}
interface Burst {
  seq: number
  x: number
  y: number
}

export function GameRecoil({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<RecoilState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])
  const [tracers, setTracers] = useState<Tracer[]>([])
  const [bursts, setBursts] = useState<Burst[]>([])
  const [kickSeq, setKickSeq] = useState(0)
  const [announce, setAnnounce] = useState('')
  // 1:1 도전(?vs=...) — 있으면 모든 판(Retry/New Game 포함)을 도전자의 시드로 시작한다.
  // 난이도는 시드 하위 2비트에 담겨 있어(engine.difficultyOfSeed) 시드만으로 같은 판·같은 규칙이 재현된다.
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const challengeRef = useRef<Challenge | null>(null)
  const [name, setName] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')
  // UTC date the on-screen daily board belongs to (null for practice/challenge). Streak and the share
  // card use this, not "now" — a board dealt before UTC midnight stays yesterday's board.
  const [boardDay, setBoardDay] = useState<string | null>(null)
  // false when the finished run was a replay of an already-finished board (didn't count toward best).
  const [countedBest, setCountedBest] = useState(true)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced, reducedRef } = useReducedMotion()

  const stateRef = useRef<RecoilState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const difficultyRef = useRef<Difficulty>('normal')
  const trailRef = useRef<Array<{ x: number; y: number }>>([])
  const inputQueueRef = useRef<RecoilInput[]>([])
  const pressedRef = useRef(false)
  const prevPhaseRef = useRef<Phase | null>(null)
  const seqRef = useRef(0)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const shakeRef = useRef<SVGGElement | null>(null)
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const boardDayRef = useRef<string | null>(null)
  // Seeds whose run already finished: a later run on the same seed (Retry / Replay / Play again) is a
  // replay and never counts toward best — otherwise Retry farms a known board.
  const triedSeedsRef = useRef<Set<number>>(new Set())

  const setDay = useCallback((day: string | null) => {
    boardDayRef.current = day
    setBoardDay(day)
  }, [])

  const commit = useCallback((next: RecoilState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const resetCosmetics = useCallback(() => {
    trailRef.current = []
    inputQueueRef.current = []
    pressedRef.current = false
    setBadges([])
    setTracers([])
    setBursts([])
    setAnnounce('')
  }, [])

  // Init (client only — no Date/Math.random during render).
  useEffect(() => {
    setBest(loadBest(storageKey))
    setStreak(currentStreak(loadStreak(DAILY_KEY)))
    const tried = loadDailyTried()
    if (tried !== null) triedSeedsRef.current.add(tried)
    setName(loadPlayerName())
    const incoming = parseChallenge(window.location.search)
    challengeRef.current = incoming
    setChallenge(incoming)
    prevPhaseRef.current = 'ready'
    if (incoming) {
      // Challenge runs are never 'daily' — no streak bump, no daily share card.
      const d = difficultyOfSeed(incoming.seed)
      modeRef.current = 'practice'
      difficultyRef.current = d
      setMode('practice')
      setDifficulty(d)
      setDay(null)
      commit(createGameForSeed(incoming.seed))
    } else {
      const day = todayUTC()
      setDay(day)
      commit(createGameForSeed(seedForDay(day)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Clear any pending reduced-motion badge timers on unmount.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  const hasBoard = state !== null
  useEffect(() => {
    if (hasBoard) boardRef.current?.focus({ preventScroll: true })
  }, [hasBoard])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty, sameSeed: boolean) => {
      modeRef.current = nextMode
      const cur = stateRef.current
      const ch = challengeRef.current
      let g: RecoilState
      if (ch) {
        g = createGameForSeed(ch.seed)
        setDay(null)
      } else if (sameSeed && cur) {
        g = createGameForSeed(cur.seed) // same board → keeps its own boardDay
      } else if (nextMode === 'daily') {
        // Always today's board, recomputed now — never the (possibly pre-midnight) one on screen.
        const day = todayUTC()
        g = createGameForSeed(seedForDay(day))
        setDay(day)
      } else {
        g = createGameForSeed(seedWithDifficulty(freshSeed(), diff))
        setDay(null)
      }
      resetCosmetics()
      setShareStatus('idle')
      setCountedBest(true)
      prevPhaseRef.current = 'ready'
      commit(g)
      // Keep keyboard play working after clicking Retry / mode buttons (the overlay button unmounts).
      boardRef.current?.focus({ preventScroll: true })
    },
    [commit, resetCosmetics, setDay],
  )

  const addBadge = useCallback(
    (x: number, y: number, text: string) => {
      const seq = ++seqRef.current
      setBadges((b) => [...b, { seq, x, y, text }])
      if (reducedRef.current) {
        const t = setTimeout(() => {
          timersRef.current.delete(t)
          setBadges((b) => b.filter((x) => x.seq !== seq))
        }, 800)
        timersRef.current.add(t)
      }
    },
    [reducedRef],
  )

  /** Cosmetic + audio reaction to a batch of engine events (one call per frame). */
  const react = useCallback(
    (prev: RecoilState, next: RecoilState, evs: Set<RecoilEvent>) => {
      for (const [ev, sound] of SOUND_PRIORITY) {
        if (evs.has(ev)) {
          play(sound)
          break
        }
      }
      const rm = reducedRef.current
      if (evs.has('fire') && next.lastShot) {
        if (!rm) {
          const seq = ++seqRef.current
          const shot = next.lastShot
          setTracers((t) => [...t.slice(-5), { seq, x: prev.x, y: prev.y, dir: shot.dir }])
          setKickSeq((k) => k + 1)
          const el = shakeRef.current
          if (el) {
            el.style.animation = 'none'
            void el.getBoundingClientRect()
            el.style.animation = 'rc-shake .12s ease-out'
          }
        }
        if (next.ammo === 0 && prev.ammo > 0) setAnnounce('Out of ammo')
      }
      if (evs.has('star')) {
        const fresh = next.stars.filter((st, i) => st.taken && !prev.stars[i].taken)
        if (!rm) {
          setBursts((b) => [...b, ...fresh.map((st) => ({ seq: ++seqRef.current, x: st.x, y: st.y }))])
        }
        if (next.bankShots > prev.bankShots) {
          // bank badges for stars taken this frame — the engine flags bank per star; mark the last ones
          const banked = next.bankShots - prev.bankShots
          fresh.slice(-banked).forEach((st) => addBadge(st.x, st.y, `BANK +${BANK_PTS}`))
          setAnnounce('Bank shot')
        } else {
          setAnnounce(`Star ${next.collected} of ${next.stars.length}`)
        }
      }
      if (evs.has('win')) setAnnounce('All stars collected')
      if (evs.has('lose')) setAnnounce(next.endReason === 'stalled' ? 'Lost: stalled' : 'Lost: drifted')
    },
    [play, reducedRef, addBadge],
  )

  // Real-time loop: fixed 60Hz ticks, runs only while flying. Frame time only decides *how many*
  // whole `step`s run this frame (accumulator, ≤4 per frame); physics never sees dt, and each queued
  // shot is consumed by exactly one tick. So a run is fully determined by seed + (tick, shot dir) —
  // identical on a 60Hz phone and a 144Hz monitor, which keeps challenge links fair.
  const phase = state?.phase
  useEffect(() => {
    if (phase !== 'flying') return
    let raf = 0
    let last: number | null = null
    let acc = 0
    const frame = (ts: number) => {
      if (last === null) last = ts
      acc += Math.min(ts - last, 100)
      last = ts
      const prev = stateRef.current
      if (!prev || prev.phase !== 'flying') return
      let s = prev
      const evs = new Set<RecoilEvent>()
      let n = 0
      while (acc >= TICK_MS && n < 4) {
        s = step(s, inputQueueRef.current.shift() ?? null)
        acc -= TICK_MS
        n++
        for (const e of s.events) evs.add(e)
        trailRef.current.push({ x: s.x, y: s.y })
        if (trailRef.current.length > TRAIL_LEN) trailRef.current.shift()
        if (isOver(s)) break
      }
      if (n === 4) acc = Math.min(acc, TICK_MS)
      if (s !== prev) {
        commit(s)
        react(prev, s, evs)
      }
      if (!isOver(s)) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [phase, commit, react])

  // End-of-game bookkeeping: exactly once on flying → won|lost.
  useEffect(() => {
    const s = stateRef.current
    if (!s) return
    const was = prevPhaseRef.current
    prevPhaseRef.current = s.phase
    if (was !== 'flying' || !isOver(s)) return
    const won = s.phase === 'won'
    const slug = storageKey.replace(/^best:/, '')
    // 도전 판은 같은 시드를 무한 Rematch할 수 있어 최고기록·스트릭에 넣지 않는다(보드 파밍 방지).
    // 같은 시드의 재도전(Retry/Replay)도 최고기록엔 넣지 않는다 — 시드의 첫 판만 센다.
    if (!challengeRef.current) {
      const first = !triedSeedsRef.current.has(s.seed)
      triedSeedsRef.current.add(s.seed)
      const day = boardDayRef.current
      if (day !== null) saveDailyTried(s.seed)
      setCountedBest(first)
      if (first) {
        const nextBest = Math.max(loadBest(storageKey), s.score)
        saveBest(storageKey, nextBest)
        setBest(nextBest)
      }
      // 스트릭은 "그날의 판"을 그날 깼을 때만. 자정 전에 받은 판을 자정 후에 깨도 오늘로 치지 않는다.
      if (won && modeRef.current === 'daily' && day !== null && day === todayUTC()) {
        const bumped = bumpStreak(loadStreak(DAILY_KEY), day)
        saveStreak(DAILY_KEY, bumped)
        setStreak(bumped.streak)
      }
    }
    recordResult(slug, { won })
    if (challengeRef.current) sendHit(slug, 'challenge-done')
  }, [phase, storageKey])

  const aimTo = useCallback(
    (d: Dir) => {
      const s = stateRef.current
      if (!s) return
      const next = setAim(s, d)
      if (next !== s) commit(next)
    },
    [commit],
  )

  const fire = useCallback(() => {
    const s = stateRef.current
    if (!s || isOver(s)) return
    if (s.phase === 'ready') {
      const next = step(s, { fire: s.aim })
      trailRef.current = [{ x: s.x, y: s.y }, { x: next.x, y: next.y }]
      commit(next)
      react(s, next, new Set(next.events))
      return
    }
    if (inputQueueRef.current.length < QUEUE_MAX) inputQueueRef.current.push({ fire: s.aim })
  }, [commit, react])

  // Daily: always (re)deal *today's* board — after UTC midnight that is a new board, not a replay of
  // the one on screen. Practice: a fresh board. (Retry is the same-seed replay.)
  const onNewGame = useCallback(() => {
    startBoard(modeRef.current, difficultyRef.current, false)
  }, [startBoard])

  const retry = useCallback(() => startBoard(modeRef.current, difficultyRef.current, true), [startBoard])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      // Browser/OS shortcuts (Ctrl+R, Cmd+Enter, Alt+…) are never game input.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // Keys bubbling from a focused overlay control (Retry, Rematch, share, links…) belong to that
      // control: preventDefault on Enter/Space would block its native activation.
      const t = e.target
      if (t !== e.currentTarget && t instanceof Element && t.closest('button, a, input, select, textarea, [role="button"]')) {
        return
      }
      const s = stateRef.current
      if (!s) return
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (e.key === 'ArrowLeft') e.preventDefault()
          aimTo(rotateDir(s.aim, e.shiftKey ? -4 : -1))
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (e.key === 'ArrowRight') e.preventDefault()
          aimTo(rotateDir(s.aim, e.shiftKey ? 4 : 1))
          break
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (e.key === 'ArrowUp') e.preventDefault()
          aimTo(12)
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          if (e.key === 'ArrowDown') e.preventDefault()
          aimTo(4)
          break
        case ' ':
        case 'Enter':
          e.preventDefault()
          if (!e.repeat) fire()
          break
        case 'r':
        case 'R':
          retry()
          break
      }
    },
    [aimTo, fire, retry],
  )

  const pointerAim = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const s = stateRef.current
      const svg = svgRef.current
      if (!s || !svg) return
      const rect = svg.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const px = ((e.clientX - rect.left) * ARENA_W) / rect.width
      const py = ((e.clientY - rect.top) * ARENA_H) / rect.height
      const d = dirFromVector(Math.round(px * FP) - s.x, Math.round(py * FP) - s.y)
      if (d !== null) aimTo(d)
    },
    [aimTo],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      boardRef.current?.focus({ preventScroll: true })
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      pressedRef.current = true
      pointerAim(e)
    },
    [pointerAim],
  )
  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (pressedRef.current || e.pointerType === 'mouse') pointerAim(e)
    },
    [pointerAim],
  )
  const onPointerUp = useCallback(() => {
    if (!pressedRef.current) return
    pressedRef.current = false
    fire()
  }, [fire])
  const onPointerCancel = useCallback(() => {
    pressedRef.current = false
  }, [])

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m)
      startBoard(m, difficultyRef.current, false)
    },
    [startBoard],
  )
  const switchDifficulty = useCallback(
    (d: Difficulty) => {
      setDifficulty(d)
      difficultyRef.current = d
      if (modeRef.current === 'practice') startBoard('practice', d, false)
    },
    [startBoard],
  )

  const leaveChallenge = useCallback(() => {
    challengeRef.current = null
    setChallenge(null)
    clearChallengeParams()
    setMode('practice')
    startBoard('practice', difficultyRef.current, false)
  }, [startBoard])

  // 결과 화면의 "친구에게 도전장": 방금 판의 시드(난이도 포함)+점수를 링크로. 받은 사람은 같은 판을 한다.
  const shareChallenge = useCallback(
    async (seed: number, score: number) => {
      const slug = storageKey.replace(/^best:/, '')
      const trimmed = name.trim()
      if (trimmed) savePlayerName(trimmed)
      const url = challengeUrl(window.location.origin, slug, { seed, score, name: trimmed })
      const text = `I scored ${score} in Recoil. Same stars, same walls — can you beat me? 🚀`
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Recoil challenge', text, url })
        } else {
          await navigator.clipboard.writeText(`${text} ${url}`)
          setShareStatus('copied')
        }
        // 공유 시트 취소·클립보드 실패는 위에서 throw → 'sent'로 세지 않는다.
        sendHit(slug, 'challenge-sent')
      } catch {
        // 취소/불가 무시
      }
    },
    [name, storageKey],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-150 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="recoil-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const s = state
  const cfg = s.config
  const over = isOver(s)
  const won = s.phase === 'won'
  const lost = s.phase === 'lost'
  const total = s.stars.length
  const left = total - s.collected
  const bankPts = s.bankShots * BANK_PTS
  const starPts = s.collected * STAR_PTS
  const ammoPts = won ? s.ammo * AMMO_PTS : 0
  const tBonus = won ? timeBonus(s.ticks) : 0
  const shipX = u(s.x)
  const shipY = u(s.y)
  const aimDeg = s.aim * 22.5
  const preview = !over && s.ammo > 0 ? predictPath(s, s.aim, PREVIEW_TICKS) : []
  const previewPts = [`${shipX},${shipY}`, ...preview.map((p) => `${u(p.x)},${u(p.y)}`)].join(' ')
  const trailPts = trailRef.current.map((p) => `${u(p.x)},${u(p.y)}`).join(' ')
  const [adx, ady] = DIRS[s.aim]

  const outcome = challenge && over ? compareChallenge(s.score, challenge.score) : null
  const challengeTitle = !outcome
    ? null
    : outcome.kind === 'win'
      ? `You beat ${challenge!.name}!`
      : outcome.kind === 'tie'
        ? `Dead even with ${challenge!.name}`
        : `${challenge!.name} still leads`

  /** Shared by both result overlays: challenge verdict + Rematch + "challenge a friend". */
  const challengeBlock = (
    <>
      {outcome && (
        <p data-testid="challenge-result" className="text-base font-bold">
          {outcome.kind === 'win' && (
            <>
              🏆 +{outcome.diff} over {challenge!.name}&apos;s {challenge!.score}
            </>
          )}
          {outcome.kind === 'tie' && <>Both scored {challenge!.score} — break the tie</>}
          {outcome.kind === 'lose' && (
            <>
              {outcome.diff} short of {challenge!.score} ({outcome.pct}%) — one more?
            </>
          )}
        </p>
      )}
      {s.score > 0 && (
        <div className="flex flex-col items-center gap-2" data-testid="challenge-share">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LEN}
            placeholder="Your name"
            aria-label="Your name for the challenge link"
            className="w-40 rounded-lg border border-border bg-bg-2 px-3 py-1.5 text-center text-sm text-fg"
          />
          <GameButton variant="ghost" onClick={() => void shareChallenge(s.seed, s.score)}>
            {shareStatus === 'copied'
              ? 'Link copied!'
              : outcome?.kind === 'win'
                ? `Send it back to ${challenge!.name}`
                : 'Challenge a friend'}
          </GameButton>
        </div>
      )}
    </>
  )

  const hint = won
    ? `All ${total} stars in ${s.shotsFired} shots — ${s.score} points.`
    : lost
      ? `${s.endReason === 'stalled' ? 'Dead in space' : 'Drifted out'} with ${s.collected}/${total} stars.`
      : s.phase === 'ready'
        ? `Aim with ←/→ or point, fire with Space or release. Each shot pushes you the opposite way — collect all ${total} stars.`
        : s.ammo > 0
          ? 'No friction — fire along your motion to brake. Walls bounce for free.'
          : 'Out of ammo — drifting…'

  const headerExtra = challenge ? (
    <span
      className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm capitalize"
      data-testid="recoil-challenge-difficulty"
    >
      Challenge · {difficultyOfSeed(s.seed)}
    </span>
  ) : (
    <>
      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          onClick={() => switchMode('daily')}
          aria-pressed={mode === 'daily'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${mode === 'daily' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Daily
        </button>
        <button
          onClick={() => switchMode('practice')}
          aria-pressed={mode === 'practice'}
          className={`px-2.5 py-1.5 text-sm font-semibold ${mode === 'practice' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
        >
          Practice
        </button>
      </div>
      {mode === 'daily' ? (
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Streak <span className="font-bold text-accent">{streak}</span>
        </span>
      ) : (
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => switchDifficulty(d)}
              aria-pressed={difficulty === d}
              className={`px-2.5 py-1.5 text-sm font-semibold capitalize ${difficulty === d ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: s.score, testId: 'score', float: true },
        { label: 'Ammo', value: s.ammo, testId: 'ammo' },
        { label: 'Stars', value: `${s.collected}/${total}` },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={
        challenge ? (over ? 'Rematch' : 'Restart') : over ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Board'
      }
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-150"
    >
      {challenge && (
        <div
          data-testid="challenge-banner"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm"
        >
          <span>
            ⚔️ <span className="font-bold">{challenge.name}</span> scored{' '}
            <span className="font-bold text-accent">{challenge.score}</span> on this exact run. Beat it!
            <span className="block text-xs text-fg-muted">Challenge runs don&apos;t count toward your best.</span>
          </span>
          {/* 비행 중엔 숨긴다 — 보드 바로 위라 모바일 오탭 한 번에 판이 날아간다. */}
          {(s.phase === 'ready' || over) && (
            <button
              type="button"
              onClick={leaveChallenge}
              className="text-xs text-fg-muted underline hover:text-fg"
              data-testid="challenge-leave"
            >
              Play solo
            </button>
          )}
        </div>
      )}
      <div
        ref={boardRef}
        data-testid="recoil-board"
        role="group"
        aria-label="Recoil arena"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative select-none rounded-xl bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={reduced ? undefined : { animation: 'rc-board-in .3s ease-out both' }}
      >
        {/* Magazine */}
        <div className="mb-2 flex items-center gap-3">
          <div
            data-testid="recoil-ammo"
            aria-label={`Ammo ${s.ammo} of ${cfg.ammo}`}
            role="img"
            className="flex flex-wrap items-center gap-1"
          >
            {Array.from({ length: cfg.ammo }, (_, i) => {
              const live = i < s.ammo
              const last = live && s.ammo === 1 && !reduced
              return (
                <span
                  key={i}
                  aria-hidden="true"
                  className="block rounded-sm"
                  style={{
                    width: 6,
                    height: 10,
                    background: live ? 'var(--neon-magenta)' : 'transparent',
                    border: '1px solid var(--neon-magenta)',
                    opacity: live ? 1 : 0.35,
                    boxShadow: live ? '0 0 4px var(--neon-magenta)' : undefined,
                    animation: last ? 'rc-pip .6s ease-in-out infinite alternate' : undefined,
                  }}
                />
              )
            })}
          </div>
          <span className="ml-auto text-xs font-semibold tabular-nums text-fg-muted">
            {s.shotsFired} / par {cfg.parShots}
          </span>
        </div>

        {/* Drift bar */}
        {s.ammo === 0 && s.phase === 'flying' && (
          <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-border/40" aria-hidden="true">
            <div
              className="h-full w-full rounded-full"
              style={{
                background: 'var(--neon-red)',
                transformOrigin: 'left',
                transform: `scaleX(${Math.max(0, 1 - s.driftTicks / DRIFT_LIMIT)})`,
              }}
            />
          </div>
        )}

        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${ARENA_W} ${ARENA_H}`}
            className="block h-auto w-full cursor-crosshair"
            style={{ touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            aria-hidden="true"
          >
            <defs>
              <filter id="rc-glow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#22d3ee" floodOpacity="0.7" />
              </filter>
            </defs>
            <g ref={shakeRef}>
              {/* grid */}
              <g stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5}>
                {Array.from({ length: ARENA_W / 16 - 1 }, (_, i) => (
                  <line key={`v${i}`} x1={(i + 1) * 16} y1={0} x2={(i + 1) * 16} y2={ARENA_H} />
                ))}
                {Array.from({ length: ARENA_H / 16 - 1 }, (_, i) => (
                  <line key={`h${i}`} x1={0} y1={(i + 1) * 16} x2={ARENA_W} y2={(i + 1) * 16} />
                ))}
              </g>
              <rect
                x={0.75}
                y={0.75}
                width={ARENA_W - 1.5}
                height={ARENA_H - 1.5}
                rx={3}
                fill="none"
                stroke="var(--neon-cyan)"
                strokeWidth={1.5}
                filter="url(#rc-glow)"
              />

              {s.walls.map((w, i) => (
                <rect
                  key={i}
                  data-testid="recoil-wall"
                  x={u(w.x)}
                  y={u(w.y)}
                  width={u(w.w)}
                  height={u(w.h)}
                  rx={1.5}
                  fill="var(--neon-purple)"
                  fillOpacity={0.25}
                  stroke="var(--neon-purple)"
                  strokeWidth={1}
                />
              ))}

              {s.stars.map((st) => (
                <g
                  key={st.id}
                  data-testid="recoil-star"
                  data-taken={st.taken}
                  transform={`translate(${u(st.x)} ${u(st.y)})`}
                >
                  {!st.taken && (
                    <g
                      style={
                        reduced
                          ? undefined
                          : {
                              transformBox: 'fill-box',
                              transformOrigin: 'center',
                              animation: `rc-twinkle 1.6s ease-in-out ${(st.id * 0.37) % 1.6}s infinite alternate`,
                            }
                      }
                    >
                      <polygon points={STAR_POINTS} fill="var(--neon-amber)" stroke="var(--neon-amber)" strokeWidth={0.5} />
                    </g>
                  )}
                </g>
              ))}

              {bursts.map((b) => (
                <g key={b.seq} transform={`translate(${u(b.x)} ${u(b.y)})`} pointerEvents="none">
                  <g
                    style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'rc-burst .4s ease-out both' }}
                    onAnimationEnd={() => setBursts((cur) => cur.filter((x) => x.seq !== b.seq))}
                  >
                    <polygon points={STAR_POINTS} fill="var(--neon-amber)" />
                    <circle r={9} fill="none" stroke="var(--neon-lime)" strokeWidth={1.2} />
                  </g>
                </g>
              ))}

              {!reduced && trailPts && trailRef.current.length > 1 && (
                <polyline
                  points={trailPts}
                  fill="none"
                  stroke="var(--neon-cyan)"
                  strokeOpacity={0.3}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {preview.length > 0 && (
                <polyline
                  points={previewPts}
                  fill="none"
                  stroke="var(--neon-cyan)"
                  strokeOpacity={0.5}
                  strokeWidth={1}
                  strokeDasharray="1 3"
                  strokeLinecap="round"
                />
              )}

              {!over && (
                <line
                  x1={shipX}
                  y1={shipY}
                  x2={shipX + (adx * 14) / 256}
                  y2={shipY + (ady * 14) / 256}
                  stroke="var(--neon-magenta)"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              )}

              {(s.vx !== 0 || s.vy !== 0) && (
                <line
                  x1={shipX}
                  y1={shipY}
                  x2={shipX + (s.vx * 8) / 256}
                  y2={shipY + (s.vy * 8) / 256}
                  stroke="var(--neon-lime)"
                  strokeOpacity={0.7}
                  strokeWidth={1.2}
                  strokeLinecap="round"
                />
              )}

              {tracers.map((t) => (
                <g key={t.seq} transform={`translate(${u(t.x)} ${u(t.y)}) rotate(${t.dir * 22.5})`} pointerEvents="none">
                  <line
                    x1={6}
                    y1={0}
                    x2={46}
                    y2={0}
                    stroke="var(--neon-magenta)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    style={{ animation: 'rc-tracer .25s ease-out both' }}
                    onAnimationEnd={() => setTracers((cur) => cur.filter((x) => x.seq !== t.seq))}
                  />
                </g>
              ))}

              <g data-testid="recoil-ship" transform={`translate(${shipX} ${shipY})`}>
                <circle r={5} fill="rgba(34, 211, 238, .15)" stroke="var(--neon-cyan)" strokeWidth={1.2} />
                <g transform={`rotate(${aimDeg})`}>
                  <g key={kickSeq} style={reduced || kickSeq === 0 ? undefined : { animation: 'rc-kick .12s ease-out both' }}>
                    <line x1={0} y1={0} x2={9} y2={0} stroke="var(--neon-cyan)" strokeWidth={2} strokeLinecap="round" />
                  </g>
                </g>
                <circle r={1.5} fill="var(--neon-cyan)" />
              </g>
            </g>
          </svg>

          {badges.map((b) => (
            <span
              key={b.seq}
              data-testid="recoil-bank"
              aria-hidden="true"
              onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
              className="pointer-events-none absolute whitespace-nowrap rounded-full border border-accent/60 bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent"
              style={{
                left: `${(u(b.x) / ARENA_W) * 100}%`,
                top: `${(u(b.y) / ARENA_H) * 100}%`,
                transform: 'translate(-50%, -150%)',
                animation: reduced ? undefined : 'rc-badge .9s ease-out both',
              }}
            >
              {b.text}
            </span>
          ))}
        </div>

        <p aria-live="polite" className="sr-only">
          {announce}
        </p>

        <GameOverlay show={won} variant="win" title={challengeTitle ?? 'All stars!'} testId="you-win">
          <div className="flex flex-col items-center gap-0.5 text-sm tabular-nums">
            <p>
              Stars {s.collected} × {STAR_PTS} = <span className="font-bold text-accent">{starPts}</span>
            </p>
            <p>
              Bank {s.bankShots} × {BANK_PTS} = <span className="font-bold text-accent">{bankPts}</span>
            </p>
            <p>
              Win <span className="font-bold text-accent">+{WIN_BONUS}</span>
            </p>
            <p>
              Ammo left {s.ammo} × {AMMO_PTS} = <span className="font-bold text-accent">{ammoPts}</span>
            </p>
            <p>
              Time bonus <span className="font-bold text-accent">+{tBonus}</span>
            </p>
            <p className="mt-1 text-base">
              Total <span className="font-bold text-accent">{s.score}</span>
            </p>
            <p className="text-fg-muted">
              Shots used {s.shotsFired} / {cfg.ammo}
            </p>
            {!challenge && !countedBest && (
              <p className="text-xs text-fg-muted">Replays of the same board don&apos;t count toward your best.</p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === 'daily' && !challenge && (
              <DailyShareButton
                payload={() => {
                  const used = s.shotsFired
                  const par = cfg.parShots
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} SHOTS · PAR ${par}`)
                  return {
                    gameName: 'Recoil',
                    dateISO: boardDay ?? todayUTC(),
                    accent: '#22d3ee',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/recoil`,
                    isDaily: true,
                    grade,
                    scoreLine: `${s.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Recoil',
                      boardDay ?? todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `all ${total} stars in ${used} shots`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>{challenge ? 'Rematch' : 'Play again'}</GameButton>
          </div>
          {challengeBlock}
        </GameOverlay>

        <GameOverlay
          show={lost}
          variant={outcome?.kind === 'win' ? 'win' : 'lose'}
          title={challengeTitle ?? (s.endReason === 'stalled' ? 'Dead in space' : 'Drifted out')}
          testId="game-over"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              {s.collected}/{total} stars — {left} left
            </p>
            {left === 1 && <p className="font-bold text-accent">One star away — try saving a shot.</p>}
            <p className="text-fg-muted">
              Score <span className="font-bold text-accent">{s.score}</span>
            </p>
            {!challenge && !countedBest && (
              <p className="text-xs text-fg-muted">Replays of the same board don&apos;t count toward your best.</p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <GameButton onClick={retry}>{challenge ? 'Rematch' : 'Retry'}</GameButton>
          </div>
          {challengeBlock}
        </GameOverlay>

        <style>{`
          @keyframes rc-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes rc-twinkle { from { opacity: .7; transform: scale(.88) } to { opacity: 1; transform: scale(1.08) } }
          @keyframes rc-burst { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(2.2) } }
          @keyframes rc-tracer { from { opacity: 1; transform: translateX(0) } to { opacity: 0; transform: translateX(24px) } }
          @keyframes rc-kick { from { transform: translateX(-2px) } to { transform: translateX(0) } }
          @keyframes rc-badge {
            0% { transform: translate(-50%, -110%) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, -150%) scale(1.1); opacity: 1 }
            100% { transform: translate(-50%, -260%) scale(1); opacity: 0 }
          }
          @keyframes rc-pip { from { opacity: 1 } to { opacity: .35 } }
          @keyframes rc-shake {
            0% { transform: translate(0, 0) }
            25% { transform: translate(-1.5px, 1px) }
            50% { transform: translate(1.5px, -1px) }
            75% { transform: translate(-1px, -1.5px) }
            100% { transform: translate(0, 0) }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
