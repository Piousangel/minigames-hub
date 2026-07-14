'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { computeAccuracy, computeWpm, sampleWords } from '@/lib/games/typing/engine'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const endAtRef = useRef<number | null>(null)

  const restart = useCallback(() => {
    setWords(sampleWords(WORD_COUNT, Math.random))
    setProgress(freshProgress())
    setInput('')
    setSecondsLeft(TEST_SECONDS)
    setRunning(false)
    setFinished(false)
    endAtRef.current = null
  }, [])

  useEffect(() => {
    restart()
    const stored = Number(localStorage.getItem(storageKey))
    setBest(Number.isFinite(stored) && stored > 0 ? stored : 0)
  }, [restart, storageKey])

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

  // 종료 시 최고 WPM 기록 (업데이터 밖 persist)
  useEffect(() => {
    if (finished && wpm > best) {
      setBest(wpm)
      localStorage.setItem(storageKey, String(wpm))
    }
  }, [finished, wpm, best, storageKey])

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

  const header = (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex gap-2 text-sm">
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Time <span className="font-bold" data-testid="typing-timer">{secondsLeft}</span>s
        </div>
        <div className="rounded-lg bg-surface px-3 py-1.5">
          WPM <span className="font-bold" data-testid="wpm">{wpm}</span>
        </div>
        <div className="rounded-lg bg-surface px-3 py-1.5">
          Best <span className="font-bold">{best > 0 ? best : '—'}</span>
        </div>
      </div>
      <button
        onClick={restart}
        disabled={!words}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-stone-900"
      >
        Restart
      </button>
    </div>
  )

  const hint = <p className="mt-3 text-center text-sm text-fg-muted">Type each word and press space. 60 seconds.</p>

  if (!words) {
    return (
      <div className="mx-auto w-full max-w-2xl select-none">
        {header}
        <div className="h-28 rounded-xl bg-surface" data-testid="typing-loading" />
        <div className="mt-3 h-12 rounded-lg bg-surface" />
        {hint}
      </div>
    )
  }

  const visible = words.slice(progress.wordIndex, progress.wordIndex + 18)
  const recent = progress.results.slice(-6)

  return (
    <div className="mx-auto w-full max-w-2xl">
      {header}
      <div className="relative">
        <div
          className="flex min-h-28 flex-wrap content-start gap-x-2 gap-y-1 rounded-xl bg-surface p-4 text-lg leading-relaxed"
          data-testid="typing-words"
        >
          {recent.map((ok, i) => (
            <span key={`r${i}`} className={ok ? 'text-green-400/60' : 'text-red-400/60'}>
              {ok ? '✓' : '✗'}
            </span>
          ))}
          {visible.map((w, i) => (
            <span key={progress.wordIndex + i} className={i === 0 ? 'rounded bg-accent/30 px-1 font-semibold' : 'text-fg-muted'}>
              {w}
            </span>
          ))}
        </div>
        {finished && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-bg/80"
            data-testid="typing-results"
          >
            <p className="text-3xl font-bold">{wpm} WPM</p>
            <p className="text-fg-muted">Accuracy {accuracy}% · {progress.results.filter(Boolean).length} words</p>
            <button onClick={restart} className="mt-2 rounded-lg bg-accent px-4 py-2 font-semibold text-stone-900">
              Try again
            </button>
          </div>
        )}
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
        className="mt-3 w-full rounded-lg bg-surface px-4 py-3 text-lg outline-none ring-accent focus:ring-2"
      />
      {hint}
    </div>
  )
}
