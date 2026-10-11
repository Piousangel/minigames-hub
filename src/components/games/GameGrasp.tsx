'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DAILY_CONFIG,
  DIFFICULTIES,
  createGame,
  currentCard,
  gaugeOf,
  graspsUntilCap,
  maxGrasps,
  reduce,
  type GraspAction,
  type GraspEvent,
  type GraspState,
} from '@/lib/games/grasp/engine'
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

interface GraspSave {
  score: number
  daily?: DailyStreak
}

/**
 * Daily 연속 기록 전용 키. best:<slug>에는 숫자만 넣는다 — 주간 리더보드가 그 키를
 * Number()로 읽으므로(모든 게임 공통 규약) JSON을 넣으면 점수를 못 읽는다.
 */
const DAILY_KEY = 'grasp:daily'
const ACCENT = '#fbbf24' // --neon-amber, 조급 게이지 톤과 맞춘 공유 카드 accent

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

/**
 * 점수식 버전. v2(2026-10-10): 마진 보너스 상한 100→15로 바꿔 "전부 놓기 = 300 만점"
 * 익스플로잇을 없앴다(engine.ts MARGIN_BONUS_MAX). 새 식의 최고점은 300에 못 미치므로
 * 버전 표시가 없는 옛 best는 영영 깰 수 없는 값 — 한 번 폐기한다(daily streak은 유지).
 */
const SCORE_VERSION_KEY = 'grasp:scoreVersion'
const SCORE_VERSION = '2'

/** Drops a pre-v2 best (keeps the daily streak). Returns the save to use. */
function migrateScoreVersion(storageKey: string, save: GraspSave): GraspSave {
  try {
    if (localStorage.getItem(SCORE_VERSION_KEY) === SCORE_VERSION) return save
    localStorage.removeItem(storageKey)
    localStorage.setItem(SCORE_VERSION_KEY, SCORE_VERSION)
    return { ...save, score: 0 }
  } catch {
    // storage unavailable -> nothing to migrate
    return save
  }
}

function loadSave(storageKey: string): GraspSave {
  return migrateScoreVersion(storageKey, loadRawSave(storageKey))
}

function loadRawSave(storageKey: string): GraspSave {
  try {
    const raw = localStorage.getItem(storageKey)
    // No best yet (or dropped by the score-version migration) — the streak lives
    // under its own key, so still load it.
    if (!raw) return { score: 0, daily: loadDaily() }
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

function saveAll(storageKey: string, save: GraspSave): void {
  try {
    localStorage.setItem(storageKey, String(save.score))
    if (save.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(save.daily))
  } catch {
    // ignore storage failures
  }
}

const SOUND: Record<GraspEvent, Parameters<ReturnType<typeof useGameSound>['play']>[0] | null> = {
  none: null,
  grasp: 'eat',
  release: 'flip',
  capped: 'lose',
  cleared: 'win',
}

function dailySeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

export function GameGrasp({ storageKey }: { storageKey: string }) {
  // SSR safety: build the board only on the client.
  const [state, setState] = useState<GraspState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<GraspState | null>(null)
  const modeRef = useRef<Mode>('daily')
  const prevOver = useRef(false)

  const commit = useCallback((next: GraspState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init board + hydrate save (client only).
  useEffect(() => {
    const save = loadSave(storageKey)
    setBest(save.score)
    setStreak(currentStreak(save.daily)) // 끊긴 streak은 0으로
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
      commit(g)
    },
    [commit],
  )

  const persistWin = useCallback(
    (next: GraspState) => {
      const save = loadSave(storageKey)
      const beat = next.score > save.score
      setIsNewBest(beat)
      let nextSave: GraspSave = { ...save, score: Math.max(save.score, next.score) }
      if (modeRef.current === 'daily') {
        const bumped = bumpStreak(save.daily) // 어제 완료면 +1, 아니면 1, 오늘 중복은 멱등
        nextSave = { ...nextSave, daily: bumped }
        setStreak(bumped.streak)
      }
      setBest(nextSave.score)
      saveAll(storageKey, nextSave)
      recordResult(storageKey.replace(/^best:/, ''), { won: next.cleared })
    },
    [storageKey],
  )

  const dispatch = useCallback(
    (action: GraspAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      // capped든 cleared든 라운드 종료 순간엔 항상 점수를 저장한다(패배해도 0점 처리 없음).
      if (next.over && !prevOver.current) persistWin(next)
      prevOver.current = next.over
    },
    [commit, play, persistWin],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(e.target)) return
      const s = stateRef.current
      if (!s) return
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
        case ' ':
        case 'g':
        case 'G':
          e.preventDefault()
          if (!s.over) dispatch({ type: 'decide', decision: 'grasp' })
          break
        case 'ArrowLeft':
        case 'Backspace':
        case 's':
        case 'S':
          e.preventDefault()
          if (!s.over) dispatch({ type: 'decide', decision: 'release' })
          break
        case 'r':
        case 'R':
          e.preventDefault()
          startBoard(modeRef.current, difficulty)
          break
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
        <div className="rounded-xl bg-surface p-6" data-testid="grasp-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const cfg = state.config
  const over = state.over
  const cleared = state.cleared
  const card = currentCard(state)
  const gauge = gaugeOf(state)
  const gaugeRatio = Math.min(1, gauge / cfg.gaugeMax)
  const danger = gaugeRatio >= 0.7
  const leftGrasps = graspsUntilCap(state)
  const totalGrasps = maxGrasps(cfg)

  const hint = over
    ? cleared
      ? `Cleared — every card seen. Final score ${state.score}.`
      : `Haste maxed out and capped the round. Final score ${state.score}.`
    : 'Grasp scores the card and fills the haste gauge; release costs nothing. A full gauge ends the round on the spot.'

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
        { label: 'Left', value: cfg.deckSize - state.cursor },
        { label: 'Best', value: best, testId: 'score' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={over ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Round'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-125"
    >
      <div
        role="group"
        aria-label="Grasp board"
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="relative rounded-xl bg-surface p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        style={reduced ? undefined : { animation: 'gr-board-in .3s ease-out both' }}
        data-testid="grasp-board"
      >
        {/* Haste gauge — fills with every grasp, force-ends the round at gaugeMax */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-fg-muted">
            <span>Haste</span>
            <span className="tabular-nums">
              {gauge}/{cfg.gaugeMax}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={cfg.gaugeMax}
            aria-valuenow={gauge}
            aria-label={`Haste ${gauge} of ${cfg.gaugeMax}`}
            className="h-3 w-full overflow-hidden rounded-full border border-border bg-bg/60"
          >
            <div
              aria-hidden="true"
              className={`h-full origin-left rounded-full ${danger ? 'bg-neon-red' : 'bg-neon-amber'} ${
                danger && !reduced ? 'gr-gauge-pulse' : ''
              }`}
              style={{
                width: '100%',
                transform: `scaleX(${gaugeRatio})`,
                transition: reduced ? undefined : 'transform .25s ease-out',
              }}
            />
          </div>
        </div>

        {/* Current card */}
        <div className="mb-4 flex justify-center">
          {over ? (
            <div
              data-testid="grasp-result"
              className={`flex h-28 w-28 items-center justify-center rounded-2xl border-2 text-lg font-extrabold ${
                cleared ? 'border-neon-green text-neon-green' : 'border-neon-red text-neon-red'
              }`}
            >
              {cleared ? 'Cleared!' : 'Capped!'}
            </div>
          ) : (
            <div
              key={state.cursor}
              data-testid="current-card"
              className="neon-text flex h-28 w-24 items-center justify-center rounded-2xl border-2 border-accent bg-bg/60 text-5xl font-extrabold text-accent"
              style={reduced ? undefined : { animation: 'gr-card-in .16s ease-out both' }}
            >
              {card}
            </div>
          )}
        </div>

        {/* Remaining composition — full information, order only is hidden */}
        <div
          className="mb-4 flex flex-wrap justify-center gap-1.5"
          aria-label="Remaining card values in the deck"
        >
          {Array.from({ length: cfg.valueMax }, (_, i) => {
            const v = i + 1
            const count = state.valueCounts[i]
            return (
              <span
                key={v}
                className={`rounded-lg border px-2 py-1 text-xs font-bold tabular-nums ${
                  count === 0 ? 'border-border text-fg-muted opacity-40' : 'border-accent/50 text-accent'
                }`}
              >
                {v}×{count}
              </span>
            )
          })}
        </div>

        {/* Grasp / Release */}
        <div className="mb-3 flex justify-center gap-3">
          <GameButton
            variant="ghost"
            className="min-h-11 min-w-28 text-base"
            onClick={() => dispatch({ type: 'decide', decision: 'release' })}
            disabled={over}
          >
            RELEASE
          </GameButton>
          <GameButton
            variant="accent"
            className="min-h-11 min-w-28 text-base"
            onClick={() => dispatch({ type: 'decide', decision: 'grasp' })}
            disabled={over}
          >
            GRASP
          </GameButton>
        </div>

        <div className="flex justify-center">
          <span className="rounded-full border border-border bg-surface/80 px-3 py-1 text-xs font-semibold text-fg-muted">
            Grasps left {leftGrasps}/{totalGrasps}
          </span>
        </div>

        <GameOverlay
          show={over}
          variant={cleared ? 'win' : 'lose'}
          title={cleared ? 'Deck cleared!' : 'Haste got you'}
          testId="you-win"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
              {isNewBest && <span className="ml-1 text-neon-lime">New best!</span>}
            </p>
            <p>
              Grasped <span className="font-bold text-accent">{state.graspCount}</span> · Biggest{' '}
              <span className="font-bold text-accent">{state.biggestGrasp}</span>
            </p>
            <p>
              Best <span className="font-bold text-accent">{best}</span>
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
                    Math.min(10, state.graspCount),
                    undefined,
                    `${state.graspCount} grasped · ${state.score} PTS`,
                  )
                  return {
                    gameName: 'Grasp',
                    dateISO: todayUTC(),
                    accent: ACCENT,
                    lines: [],
                    streak,
                    url: `${window.location.origin}/grasp`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Grasp',
                      todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      undefined,
                      cleared
                        ? `cleared the deck, ${state.score} pts`
                        : `capped at ${state.graspCount} grasps, ${state.score} pts`,
                    ),
                  }
                }}
              />
            )}
            <GameButton onClick={onNewGame}>Play again</GameButton>
          </div>
        </GameOverlay>

        <style>{`
          @keyframes gr-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes gr-card-in { from { opacity: .2; transform: translateY(-8px) } to { opacity: 1; transform: none } }
          @keyframes gr-gauge-pulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(255,77,109,.6) }
            50% { opacity: .7; box-shadow: 0 0 14px rgba(255,77,109,.9) }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
