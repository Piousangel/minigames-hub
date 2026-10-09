'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  STARTING_LIVES,
  SYMBOL_BOUNDARY_UNITS,
  createGame,
  multiplierFor,
  reduce,
  type MorseEventTag,
  type MorseRelayAction,
  type MorseRelayState,
  type Symbol as MorseSymbol,
} from '@/lib/games/morse-relay/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound, type SoundName } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { recordResult } from '@/lib/gameStats'
import { sendHit } from '@/lib/hit'
import {
  challengeUrl,
  compareChallenge,
  parseChallenge,
  type Challenge,
} from '@/lib/challenge'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

// Small celebratory pause after a word completes before the next target
// appears — long enough to read the "word complete" flash, short enough to
// keep the endless-survival pace up.
const WORD_ADVANCE_DELAY_MS = 550

/** Every MorseEventTag maps to one of the repo's fixed SoundName values. */
const SOUND: Record<MorseEventTag, SoundName | null> = {
  none: null,
  symbolOk: 'flip',
  symbolMistake: 'error',
  letterComplete: 'match',
  letterMistake: 'mismatch',
  wordComplete: 'win',
  timeout: 'error',
  gameOver: 'lose',
}

function freshSeed(): number {
  return (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0
}

function loadBest(storageKey: string): number {
  try {
    const raw = Number(localStorage.getItem(storageKey))
    return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
  } catch {
    return 0
  }
}

function saveBest(storageKey: string, score: number): void {
  try {
    localStorage.setItem(storageKey, String(score))
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

// 리더보드(Leaderboard.tsx)와 같은 키 — 한 번 적은 이름을 도전장에도 재사용.
const NAME_KEY = 'lb:name'

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // ignore storage failures
  }
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

function symbolGlyph(s: MorseSymbol): string {
  return s === '.' ? '•' : '—'
}

function patternText(pattern: MorseSymbol[]): string {
  return pattern.length ? pattern.map(symbolGlyph).join(' ') : ' '
}

/** ♥/♡ readout — STARTING_LIVES starts full, drained one at a time. */
function LivesHearts({ lives }: { lives: number }) {
  return (
    <span
      className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 text-sm"
      data-testid="lives"
      aria-label={`Lives: ${lives}`}
    >
      {'♥'.repeat(Math.max(0, lives))}
      {'♡'.repeat(Math.max(0, STARTING_LIVES - lives))}
    </span>
  )
}

function ComboBadge({ combo }: { combo: number }) {
  if (combo <= 0) return null
  return (
    <span
      data-testid="combo"
      className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-bold text-accent"
    >
      Combo {combo} · ×{multiplierFor(combo)}
    </span>
  )
}

type LetterStatus = 'clean' | 'correct' | 'mistake' | 'current' | 'upcoming'

const LETTER_STYLE: Record<LetterStatus, string> = {
  clean: 'border-neon-lime/70 bg-neon-lime/10 text-neon-lime',
  correct: 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan',
  mistake: 'border-neon-red/60 bg-neon-red/10 text-neon-red',
  current: 'border-accent bg-accent/15 text-accent',
  upcoming: 'border-border bg-bg-2/40 text-fg-muted',
}

function hintFor(state: MorseRelayState): string {
  if (state.lost) return 'Line went dead — press Try again to relay another word.'
  if (state.unitMs === null) {
    return 'Hold to key dots/dashes, release for gaps — the game learns your speed from your first press.'
  }
  return 'Short hold = dot, long hold = dash. Short gap = next symbol, medium = next letter, long = next word.'
}

export function GameMorseRelay({ storageKey }: { storageKey: string }) {
  // SSR safety: build the run only on the client (repo-wide template pattern).
  const [state, setState] = useState<MorseRelayState | null>(null)
  const [best, setBest] = useState(0)
  // 1:1 도전(?vs=...) — 있으면 모든 판을 도전자와 같은 시드로 시작한다(공정한 비교).
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const challengeRef = useRef<Challenge | null>(null)
  const [name, setName] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')

  const { play, muted, toggleMuted } = useGameSound()
  const { reduced } = useReducedMotion()

  const stateRef = useRef<MorseRelayState | null>(null)
  const bestRef = useRef(0)
  const mountTimeRef = useRef(0)
  const rafRef = useRef(0)
  const lastFrameTRef = useRef(0)
  const wordAdvanceTimerRef = useRef<number | null>(null)
  const overPersistedRef = useRef(false)
  // Latest-ref pattern: `frame` below has a stable identity (never recreated),
  // so it always reaches the current dispatch through this ref rather than a
  // stale closure.
  const dispatchRef = useRef<(action: MorseRelayAction) => void>(() => {})

  const commit = useCallback((next: MorseRelayState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Component-owned monotonic clock: elapsed ms since mount. The engine
  // itself never touches a clock — it only diffs two `t` values we hand it.
  const elapsedMs = useCallback(() => performance.now() - mountTimeRef.current, [])

  const persist = useCallback(
    (finalState: MorseRelayState) => {
      if (finalState.score > bestRef.current) {
        bestRef.current = finalState.score
        setBest(finalState.score)
      }
      saveBest(storageKey, Math.max(bestRef.current, finalState.score))
      recordResult(storageKey.replace(/^best:/, ''), { won: false })
      if (challengeRef.current) sendHit(storageKey.replace(/^best:/, ''), 'challenge-done')
    },
    [storageKey],
  )

  const dispatchAction = useCallback(
    (action: MorseRelayAction) => {
      const prev = stateRef.current
      if (!prev) return
      const next = reduce(prev, action)
      commit(next)

      const sound = SOUND[next.lastEvent]
      if (sound) play(sound)

      // Winning a word requires an explicit 'nextWord' dispatch (engine never
      // auto-advances) — schedule it after a short celebratory beat.
      if (next.lastEvent === 'wordComplete') {
        if (wordAdvanceTimerRef.current !== null) window.clearTimeout(wordAdvanceTimerRef.current)
        wordAdvanceTimerRef.current = window.setTimeout(() => {
          wordAdvanceTimerRef.current = null
          dispatchRef.current({ type: 'nextWord', t: performance.now() - mountTimeRef.current })
        }, WORD_ADVANCE_DELAY_MS)
      }

      if (next.lost && !overPersistedRef.current) {
        overPersistedRef.current = true
        persist(next)
      }
    },
    [commit, play, persist],
  )

  useEffect(() => {
    dispatchRef.current = dispatchAction
  }, [dispatchAction])

  // rAF loop: keeps dispatching 'tick' so ABANDON_MS-based timeouts fire on
  // their own (without waiting for another key press). Stable identity —
  // reaches the latest dispatch via dispatchRef, not a closure. Pauses
  // itself once the run is lost; resetGame() restarts it.
  const frame = useCallback(() => {
    const prev = stateRef.current
    if (!prev || prev.lost) {
      rafRef.current = 0
      return
    }
    const t = elapsedMs()
    lastFrameTRef.current = t
    dispatchRef.current({ type: 'tick', t })
    rafRef.current = requestAnimationFrame(frame)
  }, [elapsedMs])

  const startLoop = useCallback(() => {
    if (rafRef.current === 0) rafRef.current = requestAnimationFrame(frame)
  }, [frame])

  const resetGame = useCallback(() => {
    if (wordAdvanceTimerRef.current !== null) {
      window.clearTimeout(wordAdvanceTimerRef.current)
      wordAdvanceTimerRef.current = null
    }
    overPersistedRef.current = false
    lastFrameTRef.current = elapsedMs()
    setShareStatus('idle')
    commit(createGame(challengeRef.current?.seed ?? freshSeed()))
    startLoop()
  }, [commit, elapsedMs, startLoop])

  // Init (client only, SSR-safe).
  useEffect(() => {
    mountTimeRef.current = performance.now()
    const stored = loadBest(storageKey)
    bestRef.current = stored
    setBest(stored)
    const incoming = parseChallenge(window.location.search)
    challengeRef.current = incoming
    setChallenge(incoming)
    setName(loadName())
    resetGame()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      if (wordAdvanceTimerRef.current !== null) window.clearTimeout(wordAdvanceTimerRef.current)
    }
    // Mount once. resetGame is a stable useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const leaveChallenge = useCallback(() => {
    challengeRef.current = null
    setChallenge(null)
    clearChallengeParams()
    resetGame()
  }, [resetGame])

  // 결과 화면의 "친구에게 도전장": 방금 판의 시드+점수를 링크로. 받은 사람은 같은 판을 한다.
  const shareChallenge = useCallback(
    async (seed: number, score: number) => {
      const slug = storageKey.replace(/^best:/, '')
      const trimmed = name.trim()
      if (trimmed) saveName(trimmed)
      const url = challengeUrl(window.location.origin, slug, { seed, score, name: trimmed })
      const text = `I scored ${score} in Morse Relay. Same words, same run — can you beat me? 📡`
      sendHit(slug, 'challenge-sent')
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Morse Relay challenge', text, url })
        } else {
          await navigator.clipboard.writeText(`${text} ${url}`)
          setShareStatus('copied')
        }
      } catch {
        // 취소/불가 무시
      }
    },
    [name, storageKey],
  )

  const onDown = useCallback(() => {
    dispatchAction({ type: 'down', t: elapsedMs() })
  }, [dispatchAction, elapsedMs])

  const onUp = useCallback(() => {
    dispatchAction({ type: 'up', t: elapsedMs() })
  }, [dispatchAction, elapsedMs])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      onDown()
    },
    [onDown],
  )

  // Keyboard: Spacebar is the shared telegraph key, guarded against typing
  // targets and OS key-repeat so held-down keydown storms don't re-fire.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Spacebar') return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      if (e.repeat) return
      onDown()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Spacebar') return
      e.preventDefault()
      onUp()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onDown, onUp])

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-125 select-none">
        <div className="rounded-xl bg-surface p-6" data-testid="morse-relay-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">Loading…</p>
      </div>
    )
  }

  const holding = state.pendingDownT !== null
  const holdMs = holding ? Math.max(0, lastFrameTRef.current - (state.pendingDownT as number)) : 0
  const maxBarMs = state.unitMs !== null ? state.unitMs * 6 : 1200
  const holdRatio = Math.min(1, holdMs / maxBarMs)
  const dotDashBoundaryRatio =
    state.unitMs !== null ? Math.min(1, (SYMBOL_BOUNDARY_UNITS * state.unitMs) / maxBarMs) : null

  const outcome = challenge && state.lost ? compareChallenge(state.score, challenge.score) : null
  const overlayTitle = !outcome
    ? 'Line went dead'
    : outcome.kind === 'win'
      ? `You beat ${challenge!.name}!`
      : outcome.kind === 'tie'
        ? `Dead even with ${challenge!.name}`
        : `${challenge!.name} holds the line`

  const headerExtra = (
    <>
      <LivesHearts lives={state.lives} />
      <ComboBadge combo={state.combo} />
    </>
  )

  return (
    <GameShell
      stats={[
        { label: 'Score', value: state.score, testId: 'score', float: true },
        { label: 'WPM', value: state.wpm, testId: 'wpm' },
        { label: 'Best', value: best, testId: 'best' },
      ]}
      headerExtra={headerExtra}
      onNewGame={resetGame}
      newGameLabel={state.lost ? 'Play again' : 'New Game'}
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hintFor(state)}
      maxWidthClassName="max-w-125"
    >
      {challenge && (
        <div
          data-testid="challenge-banner"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm"
        >
          <span>
            ⚔️ <span className="font-bold">{challenge.name}</span> scored{' '}
            <span className="font-bold text-accent">{challenge.score}</span> on this exact run. Beat it!
          </span>
          <button
            type="button"
            onClick={leaveChallenge}
            className="text-xs text-fg-muted underline hover:text-fg"
            data-testid="challenge-leave"
          >
            Play solo
          </button>
        </div>
      )}
      <div className="relative rounded-xl bg-surface p-4" data-testid="morse-relay-board">
        <div className="mb-3 flex items-center justify-center gap-2 text-xs text-fg-muted">
          <span data-testid="level">Level {state.level}</span>
          <span aria-hidden="true">·</span>
          <span data-testid="target-label">Transmit &ldquo;{state.targetLabel}&rdquo;</span>
        </div>

        <div
          role="group"
          aria-label={`Target word ${state.targetLabel}`}
          className="mb-4 flex flex-wrap items-start justify-center gap-x-2 gap-y-3"
          data-testid="target-word"
        >
          {state.target.map((letter, i) => {
            const result = state.results[i]
            const isCurrent = i === state.letterIndex
            const status: LetterStatus = result
              ? !result.correct
                ? 'mistake'
                : result.clean
                  ? 'clean'
                  : 'correct'
              : isCurrent
                ? 'current'
                : 'upcoming'
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1"
                style={{ marginRight: letter.wordBreakAfter ? '0.75rem' : undefined }}
              >
                <div
                  data-testid="target-letter"
                  data-status={status}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-extrabold transition-colors ${LETTER_STYLE[status]}`}
                  style={status === 'current' && !reduced ? { animation: 'mr-current-pulse 1.1s ease-in-out infinite' } : undefined}
                >
                  {letter.char}
                </div>
                <span className="font-mono text-[10px] text-fg-muted">{patternText(letter.pattern)}</span>
                {isCurrent && (
                  <span className="min-h-[1em] font-mono text-sm text-accent" data-testid="entered-pattern">
                    {patternText(state.enteredPattern)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          data-testid="telegraph-key"
          aria-label={holding ? 'Telegraph key, transmitting — release to end' : 'Telegraph key — hold to key, release for a gap'}
          onPointerDown={onPointerDown}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          disabled={state.lost}
          className="btn-press relative flex h-24 w-full select-none items-center justify-center overflow-hidden rounded-lg border-2 border-border bg-bg-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50"
          style={{ touchAction: 'none' }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left bg-accent/30"
            style={{ transform: `scaleX(${holdRatio})` }}
          />
          {dotDashBoundaryRatio !== null && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-px bg-fg-muted/50"
              style={{ left: `${dotDashBoundaryRatio * 100}%` }}
            />
          )}
          <span className="relative z-10 text-sm font-bold uppercase tracking-widest text-fg-muted">
            {holding ? 'Transmitting…' : 'Hold to key'}
          </span>
        </button>

        <GameOverlay
          show={state.lost}
          variant={outcome?.kind === 'win' ? 'win' : 'lose'}
          title={overlayTitle}
          testId="game-over"
        >
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
          <div className="flex flex-col items-center gap-1 text-sm">
            <p>
              Score <span className="font-bold text-accent">{state.score}</span>
            </p>
            <p>
              Words relayed <span className="font-bold text-accent">{state.wordsCompleted}</span>
            </p>
            <p>
              Best WPM <span className="font-bold text-accent">{state.bestWpm}</span>
            </p>
            <p>
              Max combo <span className="font-bold text-accent">{state.maxCombo}</span>
            </p>
          </div>
          <GameButton onClick={resetGame}>{challenge ? 'Rematch' : 'Try again'}</GameButton>
          {state.score > 0 && (
            <div className="flex flex-col items-center gap-2" data-testid="challenge-share">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                placeholder="Your name"
                aria-label="Your name for the challenge link"
                className="w-40 rounded-lg border border-border bg-bg-2 px-3 py-1.5 text-center text-sm text-fg"
              />
              <GameButton variant="ghost" onClick={() => void shareChallenge(state.seed, state.score)}>
                {shareStatus === 'copied'
                  ? 'Link copied!'
                  : outcome?.kind === 'win'
                    ? `Send it back to ${challenge!.name}`
                    : 'Challenge a friend'}
              </GameButton>
            </div>
          )}
        </GameOverlay>

        <style>{`
          @keyframes mr-current-pulse {
            0%, 100% { box-shadow: 0 0 0 rgba(0,0,0,0); }
            50% { box-shadow: 0 0 12px var(--accent); }
          }
        `}</style>
      </div>
    </GameShell>
  )
}
