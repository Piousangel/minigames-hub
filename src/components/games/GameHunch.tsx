'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  MAX_TESTS,
  PAR_TOTAL,
  STAGES,
  STREAK_TO_CLEAR,
  LIVES,
  canPlay,
  canPredict,
  cardName,
  createGame,
  currentRule,
  deckExhausted,
  isRed,
  rankLabel,
  reduce,
  suitGlyph,
  type CardId,
  type HunchAction,
  type HunchEvent,
  type HunchState,
  type Slot,
} from '@/lib/games/hunch/engine'
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
 * 일일 연속 기록 전용 키. best 키(storageKey)에는 숫자만 넣는다 — 주간 리더보드가
 * 그 키를 Number()로 읽는다(모든 게임 공통 규약).
 */
const DAILY_KEY = 'hunch:daily'

const SOUND: Record<HunchEvent, SoundName | null> = {
  none: null,
  accept: 'match',
  reject: 'mismatch',
  predictMode: 'flip',
  correct: 'merge',
  wrong: 'error',
  cancel: 'flip',
  stageClear: 'win',
  nextStage: 'flip',
  win: 'win',
  lose: 'lose',
  illegal: 'error',
}

const STAGE_LABELS = ['Attribute', 'Sequence', 'Compound'] as const

/** First-look clue per stage — names the rule *family*, never the rule. */
const STAGE_CLUES = [
  'Tap a card twice to test it. Stage 1 rules judge the card alone — the START card is just a random opener.',
  'Stage 2 rules compare each card with the last accepted card on the line (rejects never count).',
  'Stage 3 rules combine two clues; some also compare with the last accepted card.',
] as const

/** 'YYYY-MM-DD' (UTC, from todayUTC()) → YYYYMMDD seed. */
function dailySeed(dateISO: string): number {
  return Number(dateISO.replace(/-/g, ''))
}

/** Event-handler / effect only — never during render (hydration). */
function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const n = Number(localStorage.getItem(storageKey))
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, score: number): void {
  try {
    localStorage.setItem(storageKey, String(score))
  } catch {
    // ignore storage failures
  }
}

const isEnded = (p: HunchState['phase']) => p === 'won' || p === 'lost'

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

type KeyLike = Pick<KeyboardEvent, 'key' | 'target' | 'preventDefault' | 'ctrlKey' | 'metaKey' | 'altKey'>

// ---------------------------------------------------------------------------
// Card visuals (unicode suits + CSS only)

const CARD_W = 56
const CARD_H = 80

function suitStyle(id: CardId): CSSProperties {
  const c = isRed(id) ? 'var(--neon-magenta)' : 'var(--neon-cyan)'
  return {
    color: c,
    borderColor: `color-mix(in oklab, ${c} 60%, transparent)`,
  }
}

function CardFace({
  id,
  scale = 1,
  className = '',
  style,
}: {
  id: CardId
  scale?: number
  className?: string
  style?: CSSProperties
}) {
  const w = Math.round(CARD_W * scale)
  const h = Math.round(CARD_H * scale)
  const rank = rankLabel(id)
  const suit = suitGlyph(id)
  return (
    <span
      aria-hidden="true"
      className={`hn-card relative block shrink-0 rounded-lg border-2 bg-bg font-bold leading-none ${className}`}
      style={{ width: w, height: h, ...suitStyle(id), ...style }}
    >
      <span className="absolute left-1 top-1 flex flex-col items-center" style={{ fontSize: 13 * scale }}>
        <span>{rank}</span>
        <span style={{ fontSize: 11 * scale }}>{suit}</span>
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{ fontSize: 28 * scale, textShadow: '0 0 10px currentColor' }}
      >
        {suit}
      </span>
      <span
        className="absolute bottom-1 right-1 flex flex-col items-center"
        style={{ fontSize: 13 * scale, transform: 'rotate(180deg)' }}
      >
        <span>{rank}</span>
        <span style={{ fontSize: 11 * scale }}>{suit}</span>
      </span>
    </span>
  )
}

function CardBack({ scale = 1 }: { scale?: number }) {
  return (
    <span
      aria-hidden="true"
      className="block shrink-0 rounded-lg border-2 border-neon-purple/60 bg-bg"
      style={{
        width: Math.round(CARD_W * scale),
        height: Math.round(CARD_H * scale),
        backgroundImage: 'repeating-linear-gradient(45deg, var(--neon-purple) 0 4px, transparent 4px 10px)',
        opacity: 0.6,
      }}
    />
  )
}

// ---------------------------------------------------------------------------

export function GameHunch({ storageKey }: { storageKey: string }) {
  // SSR safety: build the run only on the client.
  const [state, setState] = useState<HunchState | null>(null)
  const [mode, setMode] = useState<Mode>('daily')
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [focus, setFocus] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [verdictSeq, setVerdictSeq] = useState(0)
  // 1:1 도전(?vs=...) — 있으면 모든 판(재시작 포함)을 도전자와 같은 시드로 시작한다.
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const challengeRef = useRef<Challenge | null>(null)
  const [name, setName] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<HunchState | null>(null)
  const modeRef = useRef<Mode>('daily')
  // UTC date of the daily board on the table (null = not a daily board). A tab left open
  // past UTC midnight still holds yesterday's board — it must not bump today's streak.
  const dailyDateRef = useRef<string | null>(null)
  const [dailyDate, setDailyDate] = useState<string | null>(null)
  const prevPhaseRef = useRef<HunchState['phase']>('test')
  const interactedRef = useRef(false)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const lineRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  const acceptRef = useRef<HTMLButtonElement | null>(null)
  const nextRef = useRef<HTMLButtonElement | null>(null)

  const slug = storageKey.replace(/^best:/, '')

  const commit = useCallback((next: HunchState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Init run + hydrate save (client only).
  useEffect(() => {
    setBest(loadBest(storageKey))
    setStreak(currentStreak(loadStreak(DAILY_KEY)))
    const incoming = parseChallenge(window.location.search)
    challengeRef.current = incoming
    setChallenge(incoming)
    setName(loadPlayerName())
    if (incoming) {
      // 도전 판은 데일리가 아니다 — 스트릭·데일리 공유와 분리.
      modeRef.current = 'practice'
      setMode('practice')
    }
    const today = incoming ? null : todayUTC()
    dailyDateRef.current = today
    setDailyDate(today)
    const g = createGame(today ? dailySeed(today) : incoming!.seed)
    prevPhaseRef.current = g.phase
    commit(g)
  }, [storageKey, commit])

  /** Runs exactly once per run, on the first transition into won/lost. */
  const finish = useCallback(
    (next: HunchState) => {
      const won = next.phase === 'won' // 패배를 승리로 기록하지 않도록 반드시 phase로 계산
      // 도전 판은 같은 시드를 무한 Rematch할 수 있어(규칙 암기) 최고기록·스트릭에 넣지 않는다.
      if (!challengeRef.current) {
        const nextBest = Math.max(loadBest(storageKey), next.score)
        saveBest(storageKey, nextBest)
        setBest(nextBest)
        if (won && modeRef.current === 'daily' && dailyDateRef.current === todayUTC()) {
          const bumped = bumpStreak(loadStreak(DAILY_KEY))
          saveStreak(DAILY_KEY, bumped)
          setStreak(bumped.streak)
        }
      }
      recordResult(slug, { won })
      if (challengeRef.current) sendHit(slug, 'challenge-done')
    },
    [storageKey, slug],
  )

  const dispatch = useCallback(
    (action: HunchAction) => {
      const prev = stateRef.current
      if (!prev) return
      interactedRef.current = true
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      if (next.lastVerdict && next.lastVerdict !== prev.lastVerdict) setVerdictSeq((n) => n + 1)
      if (next.lastEvent === 'accept' || next.lastEvent === 'reject' || next.lastEvent === 'nextStage') {
        setSelected(null)
      }
      if (action.type === 'reset' || action.type === 'new' || next.lastEvent === 'nextStage') {
        setFocus(0)
        setSelected(null)
      }
      if (next.hand.length > 0) setFocus((f) => Math.min(f, next.hand.length - 1))

      if (isEnded(next.phase) && !isEnded(prevPhaseRef.current)) finish(next)
      prevPhaseRef.current = next.phase
    },
    [commit, play, finish],
  )

  const startRun = useCallback(
    (nextMode: Mode) => {
      modeRef.current = nextMode
      const today = !challengeRef.current && nextMode === 'daily' ? todayUTC() : null
      dailyDateRef.current = today
      setDailyDate(today)
      const seed = challengeRef.current?.seed ?? (today ? dailySeed(today) : freshSeed())
      const g = createGame(seed)
      prevPhaseRef.current = g.phase
      setFocus(0)
      setSelected(null)
      setShareStatus('idle')
      commit(g)
    },
    [commit],
  )

  const onNewGame = useCallback(() => {
    setShareStatus('idle')
    // 도전 판은 같은 시드로 재시작(reset = 같은 규칙·덱·프로브).
    // 데일리는 항상 "오늘" 시드로 새로 연다 — UTC 자정을 넘긴 탭에서 reset하면 어제 판이 된다.
    if (challengeRef.current) dispatch({ type: 'reset' })
    else if (modeRef.current === 'daily') startRun('daily')
    else dispatch({ type: 'new', seed: freshSeed() })
  }, [dispatch, startRun])

  const leaveChallenge = useCallback(() => {
    challengeRef.current = null
    setChallenge(null)
    clearChallengeParams()
    setMode('practice')
    startRun('practice')
  }, [startRun])

  // 결과 화면의 "친구에게 도전장": 방금 판의 시드+점수만 링크로 — 규칙 이름은 절대 넣지 않는다.
  const shareChallenge = useCallback(
    async (seed: number, score: number) => {
      const trimmed = name.trim()
      if (trimmed) savePlayerName(trimmed)
      const url = challengeUrl(window.location.origin, slug, { seed, score, name: trimmed })
      const text = `I scored ${score} in Hunch. Same hidden rules, same deck — can you crack them better? 🃏`
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Hunch challenge', text, url })
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
    [name, slug],
  )

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m)
      startRun(m)
    },
    [startRun],
  )

  const playCard = useCallback(
    (i: number) => {
      const s = stateRef.current
      if (!s || i < 0 || i >= s.hand.length) return
      dispatch({ type: 'play', index: i })
    },
    [dispatch],
  )

  const onCardClick = useCallback(
    (i: number) => {
      interactedRef.current = true
      setFocus(i)
      if (selected === i) playCard(i)
      else setSelected(i)
    },
    [selected, playCard],
  )

  const handleKey = useCallback(
    (e: KeyLike) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const s = stateRef.current
      if (!s) return
      interactedRef.current = true
      const n = s.hand.length
      const t = e.target as HTMLElement
      const onOtherButton = t.tagName === 'BUTTON' && t.dataset.testid !== 'hunch-card'
      const k = e.key
      if (s.phase === 'test' && n > 0 && (k === 'ArrowLeft' || k === 'ArrowRight')) {
        e.preventDefault()
        setFocus((f) => (k === 'ArrowLeft' ? (f - 1 + n) % n : (f + 1) % n))
        return
      }
      if (/^[1-8]$/.test(k)) {
        const i = Number(k) - 1
        if (s.phase === 'test' && i < n) {
          e.preventDefault()
          setFocus(i)
          setSelected(i)
        }
        return
      }
      switch (k) {
        case 'Enter':
        case ' ':
          if (onOtherButton) return // let the focused button activate natively
          if (s.phase === 'stageClear') {
            if (k === 'Enter') {
              e.preventDefault()
              dispatch({ type: 'nextStage' })
            }
          } else if (s.phase === 'test') {
            e.preventDefault()
            playCard(focus)
          }
          break
        case 'p':
        case 'P':
          if (s.phase === 'test') {
            e.preventDefault()
            dispatch({ type: 'predict' })
          }
          break
        case 'a':
        case 'A':
        case 'y':
        case 'Y':
          if (s.phase === 'predict') {
            e.preventDefault()
            dispatch({ type: 'answer', accept: true })
          }
          break
        case 'x':
        case 'X':
        case 'n':
        case 'N':
          if (s.phase === 'predict') {
            e.preventDefault()
            dispatch({ type: 'answer', accept: false })
          }
          break
        case 'Escape':
          if (s.phase === 'predict') {
            e.preventDefault()
            dispatch({ type: 'cancelPredict' })
          } else setSelected(null)
          break
      }
    },
    [dispatch, focus, playCard],
  )

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => handleKey(e), [handleKey])

  // Nothing focused yet (fresh page load / after clicking empty space): route keys
  // to the board so 1–8, Enter, P, A/X work without tabbing in first. Keys that
  // land inside the board are handled by its own onKeyDown — never twice.
  useEffect(() => {
    const onWindowKey = (e: KeyboardEvent) => {
      if (e.target !== document.body && e.target !== document.documentElement) return
      handleKey(e)
    }
    window.addEventListener('keydown', onWindowKey)
    return () => window.removeEventListener('keydown', onWindowKey)
  }, [handleKey])

  // Keep DOM focus in sync with the roving index / phase, but only after the
  // player has interacted (never steal focus on page load).
  const phase = state?.phase
  useEffect(() => {
    if (!interactedRef.current || !phase) return
    const active = typeof document !== 'undefined' ? document.activeElement : null
    const board = boardRef.current
    const lostFocus = !active || active === document.body || (board && !board.contains(active))
    if (phase === 'test') {
      const inHand = active instanceof HTMLElement && active.dataset.testid === 'hunch-card'
      if (inHand || lostFocus || active === board) cardRefs.current[focus]?.focus({ preventScroll: true })
    } else if (phase === 'predict') {
      if (lostFocus || active === board || (active instanceof HTMLElement && active.dataset.testid === 'hunch-card'))
        acceptRef.current?.focus({ preventScroll: true })
    } else if (phase === 'stageClear') {
      nextRef.current?.focus({ preventScroll: true })
    }
  }, [focus, phase, state?.hand])

  // Auto-scroll the main line to its newest entry.
  const lineLen = state ? state.line.length + state.line[state.line.length - 1].rejects.length : 0
  useEffect(() => {
    const el = lineRef.current
    if (!el) return
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: el.scrollWidth, behavior: reduced ? 'auto' : 'smooth' })
    else el.scrollLeft = el.scrollWidth
  }, [lineLen, state?.stageIndex, reduced])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-160 select-none">
        <div
          className="flex min-h-80 items-center justify-center gap-2 rounded-xl bg-surface p-4"
          data-testid="hunch-board"
        >
          <CardBack />
          <CardBack />
          <CardBack />
        </div>
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const rule = currentRule(state)
  const ended = isEnded(state.phase)
  const budgetSpent = state.phase === 'test' && state.tests >= MAX_TESTS
  const playable = canPlay(state)
  const predictable = canPredict(state)
  const lv = state.lastVerdict
  const stageBonusEarned = state.stageScores[state.stageIndex] ?? 0

  const exhausted = deckExhausted(state)
  const hint =
    state.phase === 'won'
      ? 'All three rules cracked!'
      : state.phase === 'lost'
        ? exhausted
          ? 'The deck ran dry — the rule is revealed below.'
          : 'Out of lives — the rule is revealed below.'
        : state.phase === 'stageClear'
          ? 'Rule cracked! On to the next one.'
          : state.phase === 'predict'
            ? 'Accept or reject? Judge it against the last card on the line. 5 correct in a row cracks the rule.'
            : budgetSpent
              ? 'Test budget spent — predict!'
              : state.tests === 0
                ? STAGE_CLUES[state.stageIndex]
                : 'Accepted cards join the line, rejects hang below it. Press Predict (P) once you can call 5 in a row.'

  const outcome = challenge && ended ? compareChallenge(state.score, challenge.score) : null
  const challengeTitle = !outcome
    ? null
    : outcome.kind === 'win'
      ? `You beat ${challenge!.name}!`
      : outcome.kind === 'tie'
        ? `Dead even with ${challenge!.name}`
        : `${challenge!.name} still leads`
  const challengeFooter = (
    <>
      {outcome && (
        <p data-testid="challenge-result" className="text-base font-bold">
          {outcome.kind === 'win' && <>🏆 +{outcome.diff} over {challenge!.name}&apos;s {challenge!.score}</>}
          {outcome.kind === 'tie' && <>Both scored {challenge!.score} — break the tie</>}
          {outcome.kind === 'lose' && (
            <>
              {outcome.diff} short of {challenge!.score} ({outcome.pct}%) — one more?
            </>
          )}
        </p>
      )}
      {state.score > 0 && (
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
          <GameButton variant="ghost" className="min-h-11" onClick={() => void shareChallenge(state.seed, state.score)}>
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

  const liveText = lv
    ? `${cardName(lv.id)} ${lv.accepted ? 'accepted' : 'rejected'}${
        lv.via === 'predict' ? (lv.correct ? '. Correct prediction' : '. Wrong prediction') : ''
      }`
    : ''

  const headerExtra = (
    <>
      {!challenge && (
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => switchMode('daily')}
            aria-pressed={mode === 'daily'}
            className={`min-h-11 px-2.5 py-1.5 text-sm font-semibold ${mode === 'daily' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
          >
            Daily
          </button>
          <button
            onClick={() => switchMode('practice')}
            aria-pressed={mode === 'practice'}
            className={`min-h-11 px-2.5 py-1.5 text-sm font-semibold ${mode === 'practice' ? 'bg-accent text-stone-900' : 'bg-surface text-fg-muted'}`}
          >
            Practice
          </button>
        </div>
      )}
      {mode === 'daily' && !challenge && (
        <span className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm">
          Streak <span className="font-bold text-accent">{streak}</span>
        </span>
      )}
    </>
  )

  const anim = (name: string): CSSProperties | undefined => (reduced ? undefined : { animation: name })

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'Tests', value: state.tests, testId: 'tests' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={onNewGame}
      newGameLabel={
        challenge ? (ended ? 'Rematch' : 'Restart') : ended ? 'Play again' : mode === 'daily' ? 'Replay Daily' : 'New Rule Set'
      }
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-160"
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
          {/* 진행 중인 판에선 숨긴다 — 오탭 한 번에 판이 날아간다. */}
          {((state.stageIndex === 0 && state.totalTests === 0 && state.phase === 'test') || ended) && (
            <button
              type="button"
              onClick={leaveChallenge}
              className="min-h-11 text-xs text-fg-muted underline hover:text-fg"
              data-testid="challenge-leave"
            >
              Play solo
            </button>
          )}
        </div>
      )}
      <div
        ref={boardRef}
        role="group"
        aria-label="Hunch board"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative rounded-xl bg-surface p-4 focus:outline-none"
        style={anim('hn-board-in .3s ease-out both')}
        data-testid="hunch-board"
      >
        {/* 1. Status bar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <ol className="flex flex-wrap gap-1.5" aria-label="Stages">
            {Array.from({ length: STAGES }, (_, i) => {
              const cleared = i < state.stageIndex || (i === state.stageIndex && (state.phase === 'stageClear' || state.phase === 'won'))
              const current = i === state.stageIndex && !cleared
              return (
                <li
                  key={i}
                  aria-current={current ? 'step' : undefined}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    cleared
                      ? 'border-neon-lime text-neon-lime'
                      : current
                        ? 'border-neon-cyan text-neon-cyan'
                        : 'border-border text-fg-muted'
                  }`}
                >
                  {i + 1} {STAGE_LABELS[i]}
                  {cleared ? ' ✓' : ''}
                </li>
              )
            })}
          </ol>
          <div className="flex items-center gap-3">
            <span
              key={`lives-${state.wrong}`}
              data-testid="hunch-lives"
              aria-label={`${state.lives} of ${LIVES} lives left`}
              className="flex gap-0.5 text-lg leading-none"
              style={
                state.wrong > 0 && (state.lastEvent === 'wrong' || state.lastEvent === 'lose')
                  ? anim('hn-shake .3s ease-in-out both')
                  : undefined
              }
            >
              {Array.from({ length: LIVES }, (_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  style={{ color: 'var(--neon-red)', opacity: i < state.lives ? 1 : 0.25 }}
                >
                  ♥
                </span>
              ))}
            </span>
            <span
              data-testid="hunch-streak"
              aria-label={`Prediction streak ${state.streak} of ${STREAK_TO_CLEAR}`}
              className="flex items-center gap-1"
            >
              {Array.from({ length: STREAK_TO_CLEAR }, (_, i) => {
                const filled = i < state.streak
                const fresh = filled && i === state.streak - 1 && state.lastEvent !== 'none'
                return (
                  <span
                    key={`${i}-${filled ? state.streak : 0}`}
                    aria-hidden="true"
                    className="block h-3 w-3 rounded-full border"
                    style={{
                      borderColor: filled ? 'var(--neon-lime)' : 'var(--color-border, rgba(255,255,255,.2))',
                      background: filled ? 'var(--neon-lime)' : 'transparent',
                      boxShadow: filled ? '0 0 8px var(--neon-lime)' : undefined,
                      ...(fresh ? anim('hn-pip .2s ease-out both') : undefined),
                    }}
                  />
                )
              })}
            </span>
          </div>
        </div>

        {/* 2. Main line (the lab notebook) */}
        <div className="relative">
          <div
            ref={lineRef}
            data-testid="hunch-line"
            aria-label="Main line: accepted cards on top, rejected cards hang below"
            className="flex min-h-36 items-start gap-2 overflow-x-auto rounded-lg border border-border/60 p-2 pb-3"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            {state.line.map((entry) => {
              const fresh = lv?.uid === entry.slot.uid && lv.accepted
              return (
                <div key={entry.slot.uid} className="flex shrink-0 flex-col items-center">
                  <div className="relative" style={fresh ? anim('hn-slide .26s ease-out both') : undefined}>
                    <CardFace id={entry.slot.id} />
                    {entry.starter && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-neon-purple px-1 text-[9px] font-bold tracking-wider text-stone-900">
                        START
                      </span>
                    )}
                  </div>
                  {entry.rejects.length > 0 && (
                    <div className="mt-1 flex flex-col items-center">
                      {entry.rejects.map((r, j) => {
                        const freshRej = lv?.uid === r.uid && !lv.accepted
                        return (
                          <div
                            key={r.uid}
                            style={{
                              marginTop: j === 0 ? 0 : -28,
                              ...(freshRej ? anim('hn-reject .32s ease-out both') : undefined),
                            }}
                          >
                            <CardFace
                              id={r.id}
                              scale={0.75}
                              style={{ opacity: 0.55, borderColor: 'var(--neon-red)' }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 3. Verdict badge */}
          {lv && (
            <span
              key={verdictSeq}
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-2 rounded-full border px-3 py-1 text-xs font-bold tracking-wider"
              style={{
                color: lv.accepted ? 'var(--neon-lime)' : 'var(--neon-red)',
                borderColor: lv.accepted ? 'var(--neon-lime)' : 'var(--neon-red)',
                background: 'color-mix(in oklab, var(--color-bg, #000) 85%, transparent)',
                ...anim('hn-badge .9s ease-out both'),
              }}
            >
              {lv.accepted ? 'ACCEPTED' : 'REJECTED'}
              {lv.via === 'predict' && (lv.correct ? ' · ✓ Correct' : ' · ✗ Wrong')}
            </span>
          )}
          <p className="sr-only" aria-live="polite">
            {liveText}
          </p>
        </div>

        {/* 4. Bottom zone */}
        <div className="mt-4">
          {(state.phase === 'test' || state.phase === 'predict' || ended) && (
            <div className="relative">
              <div
                className="grid grid-cols-4 justify-items-center gap-2 pt-2 sm:grid-cols-8"
                inert={state.phase !== 'test'}
                style={{ opacity: state.phase === 'test' ? 1 : 0.35 }}
                aria-label="Your hand"
              >
                {state.hand.map((slot: Slot, i) => {
                  const isSel = selected === i
                  return (
                    <button
                      key={slot.uid}
                      ref={(el) => {
                        cardRefs.current[i] = el
                      }}
                      type="button"
                      data-testid="hunch-card"
                      aria-label={`Test ${cardName(slot.id)}`}
                      aria-pressed={isSel}
                      tabIndex={i === focus ? 0 : -1}
                      disabled={!playable}
                      onFocus={() => setFocus(i)}
                      onClick={() => onCardClick(i)}
                      className={`hn-hand relative min-h-11 min-w-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                        isSel ? 'hn-selected' : ''
                      } ${reduced ? '' : 'hn-hand-motion'}`}
                    >
                      <CardFace id={slot.id} />
                      <span className="absolute -bottom-1 -right-1 rounded bg-surface px-1 text-[10px] text-fg-muted">
                        {i + 1}
                      </span>
                    </button>
                  )
                })}
              </div>

              {state.phase === 'test' && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <GameButton
                    variant="ghost"
                    className="min-h-11"
                    disabled={selected === null || !playable}
                    onClick={() => selected !== null && playCard(selected)}
                  >
                    Test card
                  </GameButton>
                  <GameButton
                    className="min-h-11"
                    data-testid="hunch-predict"
                    disabled={!predictable}
                    onClick={() => dispatch({ type: 'predict' })}
                  >
                    Predict (P)
                  </GameButton>
                </div>
              )}

              {state.phase === 'predict' && state.probe && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-surface/70 py-2 backdrop-blur-[2px]">
                  <div style={{ transform: 'perspective(600px)' }}>
                    <div key={state.probe.uid} data-testid="hunch-probe" style={anim('hn-flip .3s ease-out both')}>
                      <CardFace id={state.probe.id} scale={1.4} className="hn-probe" />
                    </div>
                  </div>
                  <span className="sr-only" aria-live="polite">
                    Probe card: {cardName(state.probe.id)}. Accept or reject?
                  </span>
                </div>
              )}
            </div>
          )}

          {state.phase === 'predict' && state.probe && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="flex w-full max-w-sm gap-3">
                <button
                  ref={acceptRef}
                  type="button"
                  data-testid="hunch-accept"
                  onClick={() => dispatch({ type: 'answer', accept: true })}
                  className="btn-press min-h-14 flex-1 rounded-xl border-2 text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-lime focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  style={{
                    color: 'var(--neon-lime)',
                    borderColor: 'var(--neon-lime)',
                    background: 'color-mix(in oklab, var(--neon-lime) 12%, transparent)',
                    boxShadow: '0 0 14px color-mix(in oklab, var(--neon-lime) 35%, transparent)',
                  }}
                >
                  ✓ Accept (A)
                </button>
                <button
                  type="button"
                  data-testid="hunch-reject"
                  onClick={() => dispatch({ type: 'answer', accept: false })}
                  className="btn-press min-h-14 flex-1 rounded-xl border-2 text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-red focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  style={{
                    color: 'var(--neon-red)',
                    borderColor: 'var(--neon-red)',
                    background: 'color-mix(in oklab, var(--neon-red) 12%, transparent)',
                    boxShadow: '0 0 14px color-mix(in oklab, var(--neon-red) 35%, transparent)',
                  }}
                >
                  ✗ Reject (X)
                </button>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'cancelPredict' })}
                className="min-h-11 px-3 text-sm text-fg-muted underline underline-offset-4 hover:text-fg"
              >
                Back to testing (Esc)
              </button>
            </div>
          )}

          {state.phase === 'stageClear' && (
            <div
              data-testid="hunch-stage-clear"
              className="flex flex-col items-center gap-2 rounded-xl border-2 border-neon-lime/70 p-4 text-center"
              style={{
                background: 'color-mix(in oklab, var(--neon-lime) 8%, transparent)',
                ...anim('hn-board-in .3s ease-out both'),
              }}
            >
              <p className="text-xs font-bold tracking-widest text-neon-lime">STAGE {state.stageIndex + 1} CLEAR</p>
              <p className="text-lg font-bold">Rule cracked: {rule.name}</p>
              <p className="text-sm text-fg-muted">{rule.text}</p>
              <p className="text-sm">
                Tests used <span className="font-bold text-accent">{state.tests}</span>
                <span className="mx-2 text-fg-muted">·</span>
                <span className="font-bold text-neon-lime">+{stageBonusEarned}</span>
              </p>
              <button
                ref={nextRef}
                type="button"
                onClick={() => dispatch({ type: 'nextStage' })}
                className="btn-press mt-1 min-h-11 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-stone-900 shadow-[0_0_14px_rgba(251,191,36,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Next rule (Enter)
              </button>
            </div>
          )}
        </div>

        {/* 6. Overlays */}
        <GameOverlay
          show={state.phase === 'won'}
          variant="win"
          title={challengeTitle ?? 'Rules cracked!'}
          testId="you-win"
        >
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Total tests <span className="font-bold text-accent">{state.totalTests}</span> / Par{' '}
              <span className="font-bold text-accent">{PAR_TOTAL}</span>
            </p>
            <p>
              Lives left <span className="font-bold text-accent">{state.lives}</span>
            </p>
            {mode === 'daily' && !challenge && (
              <p>
                Streak <span className="font-bold text-accent">{streak}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {mode === 'daily' && !challenge && (
              <DailyShareButton
                payload={() => {
                  const used = state.totalTests
                  const par = PAR_TOTAL
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} TESTS · PAR ${par}`)
                  return {
                    gameName: 'Hunch',
                    dateISO: dailyDate ?? todayUTC(),
                    accent: '#a855f7',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/${slug}`,
                    isDaily: true,
                    grade,
                    scoreLine: `${state.score} PTS`,
                    glyph,
                    textSnippet: resultSnippet(
                      'Hunch',
                      dailyDate ?? todayUTC(),
                      true,
                      grade,
                      glyph.cells,
                      par,
                      `cracked 3 rules in ${used} test cards`,
                    ),
                  }
                }}
              />
            )}
            <GameButton className="min-h-11" onClick={onNewGame}>
              {challenge ? 'Rematch' : 'Play again'}
            </GameButton>
          </div>
          {challengeFooter}
        </GameOverlay>

        <GameOverlay
          show={state.phase === 'lost'}
          variant={outcome?.kind === 'win' ? 'win' : 'lose'}
          title={challengeTitle ?? (exhausted ? 'Deck ran dry' : 'Out of lives')}
          testId="game-over"
        >
          <div className="flex max-w-xs flex-col items-center gap-1 text-center text-sm">
            <p className="text-fg-muted">The rule was</p>
            <p className="text-base font-bold text-neon-cyan">{rule.name}</p>
            <p className="text-fg-muted">{rule.text}</p>
            <p className="mt-1">
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
          </div>
          <GameButton className="min-h-11" onClick={onNewGame}>
            {challenge ? 'Rematch' : 'Play again'}
          </GameButton>
          {challengeFooter}
        </GameOverlay>

        <style>{`
          @keyframes hn-board-in { from { opacity: 0; transform: scale(.98) } to { opacity: 1; transform: none } }
          @keyframes hn-slide { from { opacity: .3; transform: translateY(90px) scale(.85) } to { opacity: 1; transform: none } }
          @keyframes hn-reject {
            0% { opacity: 0; transform: translateY(-30px) }
            60% { opacity: 1; transform: translateY(0) }
            70% { transform: translateX(-4px) }
            80% { transform: translateX(4px) }
            90% { transform: translateX(-4px) }
            100% { transform: translateX(0) }
          }
          @keyframes hn-flip { from { opacity: 0; transform: rotateY(90deg) } to { opacity: 1; transform: none } }
          @keyframes hn-badge {
            0% { opacity: 0; transform: translateY(0) scale(.7) }
            25% { opacity: 1; transform: translateY(-4px) scale(1.1) }
            60% { opacity: 1; transform: translateY(-8px) scale(1) }
            100% { opacity: 0; transform: translateY(-12px) scale(1) }
          }
          @keyframes hn-pip { from { transform: scale(1.4) } to { transform: scale(1) } }
          @keyframes hn-shake {
            0%, 100% { transform: translateX(0) }
            20% { transform: translateX(-5px) }
            40% { transform: translateX(5px) }
            60% { transform: translateX(-4px) }
            80% { transform: translateX(3px) }
          }
          .hn-card { box-shadow: 0 2px 8px rgba(0,0,0,.35), inset 0 0 10px rgba(255,255,255,.03); }
          .hn-hand-motion { transition: transform .15s ease-out, filter .15s ease-out; }
          .hn-hand:not(:disabled):hover .hn-card { filter: brightness(1.15); }
          .hn-selected { transform: translateY(-8px); }
          .hn-selected .hn-card { box-shadow: 0 0 16px rgba(251,191,36,.6), 0 0 0 2px var(--neon-amber); }
          .hn-probe { box-shadow: 0 0 22px color-mix(in oklab, var(--neon-purple) 55%, transparent); }
        `}</style>
      </div>
    </GameShell>
  )
}
