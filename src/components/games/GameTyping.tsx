'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { compareToBest, computeAccuracy, computeWpm, liveWpm, sampleWords } from '@/lib/games/typing/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordFinish } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const TEST_SECONDS = 60
const WORD_COUNT = 200

interface Progress {
  wordIndex: number
  correctChars: number
  typedChars: number
  results: boolean[] // 단어별 정오
}

const freshProgress = (): Progress => ({ wordIndex: 0, correctChars: 0, typedChars: 0, results: [] })

export function GameTyping({ storageKey }: { storageKey: string }) {
  // SSR 불일치 방지: 단어는 클라이언트에서만 샘플링
  const [words, setWords] = useState<string[] | null>(null)
  const [progress, setProgress] = useState<Progress>(freshProgress())
  const [input, setInput] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(TEST_SECONDS)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [best, setBest] = useState(0)
  const [resultBest, setResultBest] = useState(false)
  // 이번 판 직전의 최고 — 결과 화면 '최고 대비' 줄(diff)용. best는 종료 시 갱신되므로 따로 잡아 둔다.
  const [prevBest, setPrevBest] = useState(0)
  const [startAt, setStartAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [inputErr, setInputErr] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const endAtRef = useRef<number | null>(null)
  const errTimer = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const autoFocusedRef = useRef(false)

  const { play, muted, toggleMuted } = useGameSound()

  const restart = useCallback(() => {
    setWords(sampleWords(WORD_COUNT, Math.random))
    setProgress(freshProgress())
    setInput('')
    setSecondsLeft(TEST_SECONDS)
    setRunning(false)
    setFinished(false)
    setResultBest(false)
    setStartAt(null)
    setInputErr(false)
    endAtRef.current = null
    finishedRef.current = false
    if (errTimer.current) window.clearTimeout(errTimer.current)
  }, [])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? stored : 0)
  }, [restart, storageKey])

  useEffect(() => () => void (errTimer.current && window.clearTimeout(errTimer.current)), [])

  useEffect(() => {
    if (!running || finished) return
    const id = setInterval(() => {
      const endAt = endAtRef.current
      setNow(Date.now())
      if (endAt !== null) setSecondsLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)))
    }, 250)
    return () => clearInterval(id)
  }, [running, finished])

  useEffect(() => {
    if (secondsLeft <= 0 && running) {
      setRunning(false)
      setFinished(true)
    }
  }, [secondsLeft, running])

  useEffect(() => {
    if (!finished) inputRef.current?.focus()
  }, [finished])

  // 첫 진입 자동 포커스: 위 효과는 마운트 때 입력칸이 아직 없어(words null) 헛돌았다 → 데스크톱에서 클릭부터 해야 했다.
  // 손가락 기기는 제외(포커스만 가고 키보드는 안 떠 혼란 — 판·입력칸 탭으로 연다).
  useEffect(() => {
    if (!words || autoFocusedRef.current) return
    autoFocusedRef.current = true
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true })
  }, [words])

  // 최종 점수는 예전 그대로 60초 기준. 진행 중 표시만 실제 경과 ms로(초반 튐은 '—').
  const wpm = computeWpm(progress.correctChars, TEST_SECONDS * 1000)
  const shownWpm = finished ? wpm : running && startAt !== null ? (liveWpm(progress.correctChars, now - startAt) ?? '—') : 0
  const accuracy = computeAccuracy(progress.correctChars, progress.typedChars)

  // 종료 시 결과 처리: 리절트 차임 + 최고 WPM 기록/컨피티 판정 (한 번만)
  useEffect(() => {
    if (finished && !finishedRef.current) {
      finishedRef.current = true
      play('win')
      // 손가락 기기: 키보드를 내려 결과 패널이 가려지지 않게(Try again이 다시 포커스).
      // 데스크톱은 포커스를 그대로 둔다 — 풀면 60초 순간 치고 있던 스페이스가 body로 가 페이지가 한 화면 내려간다.
      if (window.matchMedia?.('(pointer: coarse)').matches) inputRef.current?.blur()
      setPrevBest(best)
      if (wpm > best) {
        setResultBest(true)
        setBest(wpm)
        localStorage.setItem(storageKey, String(wpm))
      }
      recordFinish(storageKey.replace(/^best:/, ''))
    }
  }, [finished, wpm, best, play, storageKey])

  const flashError = useCallback(() => {
    setInputErr(true)
    if (errTimer.current) window.clearTimeout(errTimer.current)
    errTimer.current = window.setTimeout(() => setInputErr(false), 260)
  }, [])

  const handleChange = (value: string) => {
    if (finished || !words) return
    if (!running && value.length > 0) {
      const t = Date.now()
      setRunning(true)
      setStartAt(t)
      setNow(t)
      endAtRef.current = t + TEST_SECONDS * 1000
    }
    if (value.endsWith(' ')) {
      const typed = value.trim()
      if (typed.length === 0) {
        setInput('')
        return
      }
      const target = words[progress.wordIndex]
      const correct = typed === target
      if (correct) play('flag')
      else {
        play('error')
        flashError()
      }
      setProgress((p) => ({
        wordIndex: p.wordIndex + 1,
        correctChars: p.correctChars + (correct ? target.length + 1 : 0),
        typedChars: p.typedChars + typed.length + 1,
        results: [...p.results, correct],
      }))
      setInput('')
      if (progress.wordIndex + 1 >= words.length) {
        setRunning(false)
        setFinished(true)
      }
      return
    }
    setInput(value)
  }

  const stats = [
    { label: 'Time', value: secondsLeft, testId: 'typing-timer' },
    { label: 'WPM', value: shownWpm, testId: 'wpm' },
    { label: 'Best', value: best },
  ]

  const hint = 'Type each word and press space. 60 seconds.'

  if (!words) {
    return (
      <GameShell
        stats={stats}
        onNewGame={restart}
        newGameLabel="Restart"
        newGameDisabled
        muted={muted}
        onToggleMute={toggleMuted}
        hint={hint}
        maxWidthClassName="max-w-2xl"
      >
        <div className="h-28 rounded-xl bg-surface" data-testid="typing-loading" />
        <div className="mt-3 h-12 rounded-lg bg-surface" />
      </GameShell>
    )
  }

  const correctWords = progress.results.filter(Boolean).length
  const missedWords = progress.results.length - correctWords
  // 결과 화면 '한 판 더' 줄: 최고 대비 차이·다음 목표(예전엔 신기록일 때만 'New best!', 아니면 최고와의 거리가 안 보였다).
  const cmp = compareToBest(wpm, prevBest)
  const bestLine =
    cmp.kind === 'new'
      ? `New best! +${cmp.diff} over ${prevBest}`
      : cmp.kind === 'first'
        ? 'First record — now beat it'
        : cmp.kind === 'tie'
          ? prevBest > 0
            ? `Tied your best ${prevBest} — 1 more to beat it`
            : 'No correct words yet — one more?'
          : `${cmp.diff} WPM short of your best ${prevBest}`
  const current = words[progress.wordIndex] ?? ''
  const upcoming = words.slice(progress.wordIndex + 1, progress.wordIndex + 18)
  const recent = progress.results.slice(-6)
  const caretPos = Math.min(input.length, current.length)

  // Current word: per-character live feedback (green flash correct / red shake wrong).
  const currentChars: React.ReactNode[] = []
  current.split('').forEach((ch, i) => {
    if (i === caretPos) currentChars.push(<span key="caret" aria-hidden="true" className="inline-block h-5 w-0.5 -translate-y-0.5 bg-accent align-middle" />)
    const typed = i < input.length
    const ok = typed && input[i] === ch
    const bad = typed && input[i] !== ch
    currentChars.push(
      <span key={i} className={ok ? 'text-green-400 anim-char-ok' : bad ? 'rounded bg-red-500/25 text-red-400 anim-shake' : ''}>
        {ch}
      </span>,
    )
  })
  if (caretPos === current.length) currentChars.push(<span key="caret-end" aria-hidden="true" className="inline-block h-5 w-0.5 -translate-y-0.5 bg-accent align-middle" />)
  // Overflow: extra characters typed past the target word length.
  if (input.length > current.length) {
    input
      .slice(current.length)
      .split('')
      .forEach((ch, i) => currentChars.push(
        <span key={`o${i}`} className="rounded bg-red-500/25 text-red-400 anim-shake">
          {ch}
        </span>,
      ))
  }

  return (
    <GameShell
      stats={stats}
      onNewGame={restart}
      newGameLabel="Restart"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
      maxWidthClassName="max-w-2xl"
    >
      {/* 결과 덮개는 이 상자(단어 판+입력칸)를 채운다. 끝나면 결과 패널(≈400px)이 들어가도록 높이를 확보 —
          예전엔 128px 단어 판에만 덮여 패널이 목표 띠·입력칸·페이지 위로 넘쳤다(390). */}
      <div className={`relative ${finished ? 'min-h-[27rem]' : ''}`} data-testid="typing-area">
        <div
          className="anim-board-in flex min-h-28 cursor-text flex-wrap content-start items-baseline gap-x-2 gap-y-1 rounded-xl bg-surface p-4 text-lg leading-relaxed"
          data-testid="typing-words"
          // 단어 판을 눌러도 입력칸이 잡힌다(모바일: 첫 탭이 단어 쪽이어도 키보드가 뜬다).
          onClick={() => inputRef.current?.focus()}
        >
          {recent.map((ok, i) => (
            <span key={`r${i}`} className={ok ? 'text-green-400/60' : 'text-red-400/60'}>
              {ok ? '✓' : '✗'}
            </span>
          ))}
          <span className="rounded bg-accent/25 px-1 font-semibold whitespace-pre" data-testid="typing-current">
            {currentChars}
          </span>
          {upcoming.map((w, i) => (
            <span key={progress.wordIndex + 1 + i} className="text-fg-muted">
              {w}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Start typing here…"
          aria-label="Typing test input"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-testid="typing-input"
          className={`mt-3 w-full select-text rounded-lg bg-surface px-4 py-3 text-lg outline-none transition-shadow ${
            // 끝난 뒤엔 링을 끈다 — 덮개(70% 투명) 밑으로 밝은 포커스 링이 비쳐 보였다.
            finished ? '' : inputErr ? 'anim-shake ring-2 ring-red-500' : 'ring-accent focus:ring-2'
          }`}
        />
        <GameOverlay
          show={finished}
          variant={resultBest ? 'win' : 'lose'}
          title={`${wpm} WPM`}
          testId="typing-results"
          tone="cozy"
          compact
        >
          <p className="font-semibold tabular-nums text-garden-ink-soft">
            Accuracy {accuracy}% · {correctWords} words{missedWords > 0 ? ` · ${missedWords} missed` : ''}
          </p>
          <p
            data-testid="typing-best-compare"
            className={`text-sm font-bold tabular-nums ${cmp.kind === 'new' || cmp.kind === 'first' ? 'text-garden-coral-text' : ''}`}
          >
            {bestLine}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
      </div>
    </GameShell>
  )
}
