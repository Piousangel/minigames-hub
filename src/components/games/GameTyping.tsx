'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { computeAccuracy, computeWpm, sampleWords } from '@/lib/games/typing/engine'
import { useGameSound } from '@/lib/sound/useGameSound'
import { recordResult } from '@/lib/gameStats'
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
  const [inputErr, setInputErr] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const endAtRef = useRef<number | null>(null)
  const errTimer = useRef<number | null>(null)
  const finishedRef = useRef(false)

  const { play, muted, toggleMuted } = useGameSound()

  const restart = useCallback(() => {
    setWords(sampleWords(WORD_COUNT, Math.random))
    setProgress(freshProgress())
    setInput('')
    setSecondsLeft(TEST_SECONDS)
    setRunning(false)
    setFinished(false)
    setResultBest(false)
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

  const elapsedMs = (TEST_SECONDS - secondsLeft) * 1000
  const wpm = computeWpm(progress.correctChars, finished ? TEST_SECONDS * 1000 : elapsedMs)
  const accuracy = computeAccuracy(progress.correctChars, progress.typedChars)

  // 종료 시 결과 처리: 리절트 차임 + 최고 WPM 기록/컨피티 판정 (한 번만)
  useEffect(() => {
    if (finished && !finishedRef.current) {
      finishedRef.current = true
      play('win')
      if (wpm > best) {
        setResultBest(true)
        setBest(wpm)
        localStorage.setItem(storageKey, String(wpm))
      }
      recordResult(storageKey.replace(/^best:/, ''))
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
      setRunning(true)
      endAtRef.current = Date.now() + TEST_SECONDS * 1000
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
    { label: 'WPM', value: wpm, testId: 'wpm' },
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
      <div className="relative">
        <div
          className="anim-board-in flex min-h-28 flex-wrap content-start items-baseline gap-x-2 gap-y-1 rounded-xl bg-surface p-4 text-lg leading-relaxed"
          data-testid="typing-words"
        >
          {recent.map((ok, i) => (
            <span key={`r${i}`} className={ok ? 'text-green-400/60' : 'text-red-400/60'}>
              {ok ? '✓' : '✗'}
            </span>
          ))}
          <span className="rounded bg-accent/25 px-1 font-semibold whitespace-pre">{currentChars}</span>
          {upcoming.map((w, i) => (
            <span key={progress.wordIndex + 1 + i} className="text-fg-muted">
              {w}
            </span>
          ))}
        </div>
        <GameOverlay
          show={finished}
          variant={resultBest ? 'win' : 'lose'}
          title={`${wpm} WPM`}
          testId="typing-results"
        >
          <p className="text-fg-muted">
            Accuracy {accuracy}% · {progress.results.filter(Boolean).length} words
            {resultBest && <span className="ml-1 font-semibold text-accent">· New best!</span>}
          </p>
          <GameButton onClick={restart} className="px-4 py-2">
            Try again
          </GameButton>
        </GameOverlay>
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
          inputErr ? 'anim-shake ring-2 ring-red-500' : 'ring-accent focus:ring-2'
        }`}
      />
    </GameShell>
  )
}
