'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  cleanOdds,
  createGame,
  maxGrabNow,
  reduce,
  type HandfulAction,
  type HandfulEvent,
  type HandfulState,
  type Item,
} from '@/lib/games/handful/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { bumpStreak, currentStreak, type DailyStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { todayUTC } from '@/lib/dailyDate'
import { gradeRatio, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

type Mode = 'daily' | 'practice'
type Difficulty = 'easy' | 'normal' | 'hard'

interface HandfulSave {
  score: number
  daily?: DailyStreak
}

/**
 * Daily 연속 기록 전용 키. best:<slug>에는 숫자만 넣는다 — 주간 리더보드가 그 키를
 * Number()로 읽으므로(모든 게임 공통 규약) JSON을 넣으면 점수를 못 읽는다.
 */
const DAILY_KEY = 'handful:daily'

function loadDaily(): DailyStreak | undefined {
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (!raw) return undefined
    const o = JSON.parse(raw) as Record<string, unknown>
    if (typeof o?.lastDate === 'string' && typeof o?.streak === 'number') {
      return { lastDate: o.lastDate, streak: o.streak }
    }
  } catch {
    // corrupt -> no streak
  }
  return undefined
}

function loadSave(storageKey: string): HandfulSave {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { score: 0 }
    const n = Number(raw)
    if (Number.isFinite(n)) return { score: Math.max(0, Math.floor(n)), daily: loadDaily() }
    const o = JSON.parse(raw) as Record<string, unknown>
    const score =
      typeof o?.score === 'number' && Number.isFinite(o.score) ? Math.max(0, Math.floor(o.score)) : 0
    let daily: DailyStreak | undefined
    const dd = o?.daily as Record<string, unknown> | undefined
    if (typeof dd?.lastDate === 'string' && typeof dd?.streak === 'number') {
      daily = { lastDate: dd.lastDate, streak: dd.streak }
    }
    saveAll(storageKey, { score, daily })
    return { score, daily }
  } catch {
    // corrupt / legacy -> reset
  }
  return { score: 0 }
}

function saveAll(storageKey: string, save: HandfulSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

const SOUND: Record<HandfulEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  size: 'flip',
  clean: 'eat',
  spoiled: 'mismatch',
  over: 'win',
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

const RIPE_HEX = '#84e04a' // --neon-lime 계열, 공유 카드 accent
const REVEAL_LIMIT = 8

interface ComboBadge {
  seq: number
  combo: number
}

export function GameHandful({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<HandfulState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState<ComboBadge[]>([])
  const [isNewBest, setIsNewBest] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<HandfulState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevOver = useRef(false)
  const badgeSeq = useRef(0)

  const commit = useCallback((next: HandfulState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily))
    const g = createGame(DAILY_CONFIG, dailySeed(new Date()))
    prevOver.current = false
    setIsNewBest(false)
    commit(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const startBoard = useCallback(
    (nextMode: Mode, diff: Difficulty) => {
      modeRef.current = nextMode
      const g =
        nextMode === 'daily'
          ? createGame(DAILY_CONFIG, dailySeed(new Date()))
          : createGame(DIFFICULTIES[diff], freshSeed())
      prevOver.current = false
      setIsNewBest(false)
      setBadges([])
      commit(g)
    },
    [commit],
  )

  const persistWin = useCallback(
    (next: HandfulState) => {
      const save = loadSave(storageKey)
      const beat = next.score > save.score
      setIsNewBest(beat)
      let nextSave: HandfulSave = { ...save, score: Math.max(save.score, next.score) }
      if (modeRef.current === 'daily') {
        const bumped = bumpStreak(save.daily)
        nextSave = { ...nextSave, daily: bumped }
        setStreak(bumped.streak)
      }
      setBest(nextSave.score)
      saveAll(storageKey, nextSave)
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: HandfulAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastEvent === 'clean' && next.combo >= 2) {
        const seq = ++badgeSeq.current
        setBadges((b) => [...b, { seq, combo: next.combo }])
      }
      if (next.over && !prevOver.current) {
        persistWin(next)
        recordResult(storageKey.replace(/^best:/, ''))
      }
      prevOver.current = next.over
    },
    [commit, play, persistWin, storageKey],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          e.preventDefault()
          dispatch({ type: 'incSize', delta: 1 })
          break
        case 'ArrowDown':
        case 'ArrowLeft':
          e.preventDefault()
          dispatch({ type: 'incSize', delta: -1 })
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          dispatch({ type: 'grab' })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard(modeRef.current, difficulty)
          break
        default:
          if (e.key >= '1' && e.key <= '9') {
            e.preventDefault()
            dispatch({ type: 'setSize', size: Number(e.key) })
          }
      }
    },
    [dispatch, difficulty, startBoard],
  )

  const onNewGame = useCallback(() => {
    if (mode === 'daily') dispatch({ type: 'reset' })
    else startBoard('practice', difficulty)
  }, [mode, difficulty, dispatch, startBoard])

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m)
      startBoard(m, difficulty)
    },
    [difficulty, startBoard],
  )

  const switchDifficulty = useCallback(
    (d: Difficulty) => {
      setDifficulty(d)
      if (modeRef.current === 'practice') startBoard('practice', d)
    },
    [startBoard],
  )

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="handful-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const over = state.over
  const maxNow = maxGrabNow(state)
  const size = state.size
  const oddsPct = Math.round(cleanOdds(state.ripeLeft, state.rottenLeft, size) * 100)
  const grab = state.lastGrab

  const hint = over
    ? `Basket empty — final score ${state.score}.`
    : `Tap +/- to size your handful, then GRAB. Bigger scores more — but one rotten spoils the whole handful. All-ripe chance: ${oddsPct}%`

  const headerExtra = (
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
        { label: 'Score', value: state.score, float: true, testId: 'points' },
        { label: 'Best', value: best, testId: 'score' },
        { label: 'Combo', value: state.combo },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={over ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Basket'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        role="group"
        aria-label="Handful board"
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="relative rounded-xl bg-surface p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        style={reduced ? undefined : { animation: 'hf-board-in .3s ease-out both' }}
        data-testid="handful-board"
      >
        {/* Basket — composition fully public, only order hidden */}
        <div className="mb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-fg">In the basket</span>
            <span className="text-xs text-fg-muted">
              {state.ripeLeft} ripe · {state.rottenLeft} rotten — order hidden
            </span>
          </div>
          <div
            aria-label={`Basket: ${state.ripeLeft} ripe, ${state.rottenLeft} rotten`}
            className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-bg/40 p-3"
          >
            {Array.from({ length: state.ripeLeft }, (_, i) => (
              <span
                key={`ripe-${i}`}
                aria-hidden="true"
                className="inline-block h-4 w-4 rounded-full"
                style={{ background: RIPE_HEX, boxShadow: `0 0 6px ${RIPE_HEX}66` }}
              />
            ))}
            {Array.from({ length: state.rottenLeft }, (_, i) => (
              <span
                key={`rot-${i}`}
                aria-hidden="true"
                className="inline-block h-4 w-4 rounded-full border border-stone-700"
                style={{
                  background:
                    'radial-gradient(circle at 35% 30%, #4a3a2a, #241a12)',
                }}
              />
            ))}
            {state.ripeLeft + state.rottenLeft === 0 && (
              <span className="text-sm text-fg-muted">Empty</span>
            )}
          </div>
        </div>

        {/* Handful size control */}
        <div className="mb-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            <GameButton
              variant="ghost"
              onClick={() => dispatch({ type: 'incSize', delta: -1 })}
              disabled={over || size <= 1}
              aria-label="Smaller handful"
            >
              −
            </GameButton>
            <div className="flex min-w-24 flex-col items-center">
              <span
                className="neon-text text-4xl font-extrabold tabular-nums text-accent"
                aria-hidden="true"
              >
                {over ? '—' : size}
              </span>
              <span className="text-xs text-fg-muted">handful</span>
            </div>
            <GameButton
              variant="ghost"
              onClick={() => dispatch({ type: 'incSize', delta: 1 })}
              disabled={over || size >= maxNow}
              aria-label="Bigger handful"
            >
              +
            </GameButton>
            <span
              className="rounded-full border px-3 py-1 text-sm font-bold tabular-nums"
              style={{ borderColor: `${RIPE_HEX}80`, color: RIPE_HEX }}
              aria-hidden="true"
            >
              all-ripe {over ? 0 : oddsPct}%
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(1, maxNow)}
            step={1}
            value={over ? 1 : size}
            disabled={over}
            onChange={(e) => dispatch({ type: 'setSize', size: Number(e.target.value) })}
            aria-label="Handful size"
            aria-valuetext={`${over ? 0 : size} of ${maxNow}, all-ripe chance ${over ? 0 : oddsPct} percent`}
            className="h-2 w-full max-w-80 cursor-pointer accent-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          />
        </div>

        <div className="mb-2 flex justify-center">
          <GameButton onClick={() => dispatch({ type: 'grab' })} disabled={over || size < 1}>
            GRAB {over ? '' : `×${size}`}
          </GameButton>
        </div>

        {/* Reveal zone */}
        <div
          data-testid="reveal"
          className="flex min-h-16 flex-wrap items-center justify-center gap-1.5 rounded-lg border border-border bg-bg/40 p-3"
          style={
            reduced || !grab || grab.clean
              ? undefined
              : { animation: 'hf-shake .4s ease-in-out both' }
          }
        >
          {grab ? (
            <>
              {grab.drawn.slice(0, REVEAL_LIMIT).map((item: Item, i) => (
                <RevealCard key={`${state.grabs}-${i}`} item={item} index={i} reduced={reduced} />
              ))}
              <span
                className={`ml-2 text-sm font-bold ${grab.clean ? '' : 'text-neon-red'}`}
                style={grab.clean ? { color: RIPE_HEX } : undefined}
              >
                {grab.clean ? `+${grab.gained}` : 'SPOILED'}
              </span>
            </>
          ) : (
            <span className="text-sm text-fg-muted">
              Pick a handful size, then grab. Ripe cards score; a rotten one spoils them all.
            </span>
          )}
        </div>

        {badges.map((b) => (
          <span
            key={b.seq}
            data-testid="combo"
            aria-hidden="true"
            onAnimationEnd={() => setBadges((cur) => cur.filter((x) => x.seq !== b.seq))}
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-sm font-bold text-accent"
            style={reduced ? undefined : { animation: 'hf-badge .9s ease-out both' }}
          >
            Combo ×{b.combo}
          </span>
        ))}

        <GameOverlay show={over} variant="win" title="Basket cleared!" testId="you-win">
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Clean <span className="font-bold text-accent">{state.cleanGrabs}</span> · Spoiled{' '}
              <span className="font-bold text-accent">{state.spoiledGrabs}</span>
            </p>
            <p>
              Biggest clean <span className="font-bold text-accent">{state.biggestClean}</span> · Best
              combo <span className="font-bold text-accent">{state.bestCombo}</span>
            </p>
            {mode === 'daily' && (
              <p>
                Streak <span className="font-bold text-accent">{streak}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === 'daily' && (
              <DailyShareButton
                payload={() => {
                  const grade = gradeRatio(state.score, best, isNewBest)
                  const glyph = barGlyph(
                    Math.min(10, state.cleanGrabs),
                    undefined,
                    `${state.cleanGrabs} CLEAN · ${state.score} PTS`,
                  )
                  return {
                    gameName: 'Handful',
                    dateISO: todayUTC(),
                    accent: RIPE_HEX,
                    lines: [],
                    streak,
                    url: `${window.location.origin}/handful`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Handful',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      undefined,
                      `${state.score} pts · biggest clean ${state.biggestClean}`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes hf-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes hf-flip {
            0% { opacity: .2; transform: rotateY(90deg) }
            100% { opacity: 1; transform: rotateY(0) }
          }
          @keyframes hf-shake {
            0%,100% { transform: translateX(0) }
            20% { transform: translateX(-6px) }
            40% { transform: translateX(6px) }
            60% { transform: translateX(-4px) }
            80% { transform: translateX(4px) }
          }
          @keyframes hf-badge {
            0% { transform: translate(-50%, 6px) scale(.7); opacity: 0 }
            25% { transform: translate(-50%, 0) scale(1.12); opacity: 1 }
            100% { transform: translate(-50%, -14px) scale(1); opacity: 0 }
          }
        `}</style>
      </div>
    </GameShell>
  )
}

function RevealCard({
  item,
  index,
  reduced,
}: {
  item: Item
  index: number
  reduced: boolean
}) {
  const ripe = item === 1
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 items-center justify-center rounded-md text-lg font-bold ${
        ripe ? '' : 'text-stone-200'
      }`}
      style={{
        background: ripe ? RIPE_HEX : 'radial-gradient(circle at 35% 30%, #5a4632, #241a12)',
        color: ripe ? '#12300a' : undefined,
        border: ripe ? 'none' : '1px solid var(--neon-red)',
        animation: reduced ? undefined : `hf-flip .22s ease-out ${index * 0.05}s both`,
      }}
    >
      {ripe ? '●' : '✕'}
    </span>
  )
}
