'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PACKS,
  dailySeed,
  generateDaily,
  goalSatisfaction,
  isWon,
  keyOf,
  levelCount,
  loadLevel,
  makeRng,
  preview,
  previewAll,
  starsFor,
  step,
  type Cell,
  type Direction,
  type GameState,
  type MirrorMode,
} from '@/lib/games/duplex/engine'
import { isTypingTarget } from '@/lib/isTypingTarget'
import { useGameSound } from '@/lib/sound/useGameSound'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { todayUTC as localISODate } from '@/lib/dailyDate'
import { bumpStreak, currentStreak, loadStreak, saveStreak } from '@/lib/dailyStreak'
import { DailyShareButton } from '@/components/DailyShareButton'
import { gradeFewer, barGlyph, resultSnippet } from '@/lib/dailyShare'
import { recordResult } from '@/lib/gameStats'
import { GameButton, GameOverlay, GameShell } from '@/components/game-shell'

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
}

const MODE_CHIP: Record<MirrorMode, string> = {
  horizontal: '⇄ Horizontal',
  vertical: '⇅ Vertical',
  point: '⟳ Point',
  diagonal: '⤢ Diagonal',
  antidiagonal: '⤡ Anti-Diagonal',
}

type CellKind = 'wall' | 'floor' | 'ice' | 'arrow' | 'you-goal' | 'echo-goal'
const ARROW_GLYPH: Record<Direction, string> = { up: '▲', down: '▼', left: '◀', right: '▶' }

interface Snapshot {
  you: Cell
  echo: Cell
  youPellets: string[]
  echoPellets: string[]
  moves: number
}

const bestKey = (storageKey: string, level: number) => `${storageKey}:lvl${level}:moves`
const solvedKey = (storageKey: string) => `${storageKey}:solved`
const dailyKey = (storageKey: string, date: string) => `${storageKey}:daily:${date}`

function readNumber(key: string): number | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function readSolved(storageKey: string): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(solvedKey(storageKey))
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (Array.isArray(arr)) return new Set(arr.filter((n): n is number => Number.isFinite(n)))
  } catch {
    /* ignore malformed */
  }
  return new Set()
}

function packOf(levelIndex: number) {
  return PACKS.find((p) => levelIndex >= p.start && levelIndex <= p.end) ?? PACKS[0]
}

/** A pack `k` is unlocked once the last level of pack `k-1` is solved. */
function isPackUnlocked(packIdx: number, solved: Set<number>): boolean {
  if (packIdx <= 0) return true
  return solved.has(PACKS[packIdx - 1].end)
}

export function GameDuplex({ storageKey }: { storageKey: string }) {
  const [state, setState] = useState<GameState | null>(null)
  const [isDaily, setIsDaily] = useState(false)
  const [streak, setStreak] = useState(0)
  const [dailyDate, setDailyDate] = useState('')
  const [best, setBest] = useState<number | null>(null)
  const [newBest, setNewBest] = useState(false)
  const [solved, setSolved] = useState(false)
  const [solvedSeen, setSolvedSeen] = useState(false)
  const [showGhosts, setShowGhosts] = useState(true)
  const [hoverDir, setHoverDir] = useState<Direction | null>(null)
  const [nudge, setNudge] = useState<{ dir: Direction; key: number } | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [flipKey, setFlipKey] = useState(0)
  const [solvedSet, setSolvedSet] = useState<Set<number>>(() => new Set())
  const [, forceHistory] = useState(0)

  const { play, muted, toggleMuted } = useGameSound()
  const { reducedRef } = useReducedMotion()

  // Ambient echo-ghosts (touch): where Echo would land for each direction.
  const echoGhosts = useMemo(() => {
    const set = new Set<string>()
    if (!state || !showGhosts || hoverDir) return set
    const all = previewAll(state)
    for (const d of ['up', 'down', 'left', 'right'] as Direction[]) {
      const cell = all[d].echo
      if (cell.row === state.echo.row && cell.col === state.echo.col) continue
      set.add(keyOf(cell.row, cell.col))
    }
    return set
  }, [state, showGhosts, hoverDir])

  const stateRef = useRef<GameState | null>(null)
  const solvedRef = useRef(false)
  const historyRef = useRef<Snapshot[]>([])
  const nudgeSeq = useRef(0)
  const isDailyRef = useRef(false)
  const dailyDateRef = useRef('')
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const commit = useCallback((s: GameState) => {
    stateRef.current = s
    setState(s)
  }, [])

  const refreshBest = useCallback(
    (s: GameState, daily: boolean, date: string) => {
      setBest(daily ? readNumber(dailyKey(storageKey, date)) : readNumber(bestKey(storageKey, s.levelIndex)))
    },
    [storageKey],
  )

  const startLevel = useCallback(
    (index: number) => {
      const s = loadLevel(index)
      historyRef.current = []
      solvedRef.current = false
      isDailyRef.current = false
      setIsDaily(false)
      setSolved(false)
      setSolvedSeen(false)
      setNewBest(false)
      setNudge(null)
      setHoverDir(null)
      if (LEVEL_INTRO(s.levelIndex)) setFlipKey((k) => k + 1)
      commit(s)
      refreshBest(s, false, '')
      forceHistory((n) => n + 1)
    },
    [commit, refreshBest],
  )

  const startDaily = useCallback(() => {
    const date = localISODate()
    const s = generateDaily(makeRng(dailySeed(date)))
    historyRef.current = []
    solvedRef.current = false
    isDailyRef.current = true
    dailyDateRef.current = date
    setIsDaily(true)
    setDailyDate(date)
    setStreak(currentStreak(loadStreak(`${storageKey}:streak`)))
    setSolved(false)
    setSolvedSeen(false)
    setNewBest(false)
    setNudge(null)
    setHoverDir(null)
    setFlipKey((k) => k + 1)
    commit(s)
    refreshBest(s, true, date)
    forceHistory((n) => n + 1)
  }, [commit, refreshBest, storageKey])

  // Initial mount (client only) — level 0.
  useEffect(() => {
    setSolvedSet(readSolved(storageKey))
    startLevel(0)
  }, [startLevel, storageKey])

  const persistSolved = useCallback(
    (levelIndex: number) => {
      const set = readSolved(storageKey)
      set.add(levelIndex)
      if (typeof window !== 'undefined') {
        localStorage.setItem(solvedKey(storageKey), JSON.stringify([...set].sort((a, b) => a - b)))
      }
      setSolvedSet(set)
    },
    [storageKey],
  )

  const doMove = useCallback(
    (dir: Direction) => {
      const s = stateRef.current
      if (!s || solvedRef.current) return
      const next = step(s, dir)
      if (next === s) {
        play('error')
        setShakeKey((k) => k + 1)
        return
      }
      historyRef.current.push({
        you: s.you,
        echo: s.echo,
        youPellets: [...s.youPellets],
        echoPellets: [...s.echoPellets],
        moves: s.moves,
      })
      commit(next)
      forceHistory((n) => n + 1)

      nudgeSeq.current += 1
      if (!reducedRef.current) setNudge({ dir, key: nudgeSeq.current })

      const before = goalSatisfaction(s)
      const after = goalSatisfaction(next)
      if (isWon(next)) {
        solvedRef.current = true
        setSolved(true)
        play('win')
        const daily = isDailyRef.current
        const prev = daily
          ? readNumber(dailyKey(storageKey, dailyDateRef.current))
          : readNumber(bestKey(storageKey, next.levelIndex))
        const improved = prev === null || next.moves < prev
        if (improved && typeof window !== 'undefined') {
          const key = daily ? dailyKey(storageKey, dailyDateRef.current) : bestKey(storageKey, next.levelIndex)
          localStorage.setItem(key, String(next.moves))
          setBest(next.moves)
        } else {
          setBest(prev)
        }
        setNewBest(improved)
        if (daily) {
          // 오늘의 데일리를 풀면 day-streak을 올린다(멱등 — 같은 날 재풀이는 안 셈).
          const streakKey = `${storageKey}:streak`
          const bumped = bumpStreak(loadStreak(streakKey))
          saveStreak(streakKey, bumped)
          setStreak(bumped.streak)
        } else {
          persistSolved(next.levelIndex)
        }
        recordResult(storageKey.replace(/^best:/, ''), { won: true })
      } else if (next.youPellets.size < s.youPellets.size || next.echoPellets.size < s.echoPellets.size) {
        play('eat')
      } else if ((after.you && !before.you) || (after.echo && !before.echo)) {
        play('match')
      } else if ((!after.you && before.you) || (!after.echo && before.echo)) {
        play('mismatch')
      } else {
        play('move')
      }
    },
    [commit, persistSolved, play, reducedRef, storageKey],
  )

  const undo = useCallback(() => {
    const s = stateRef.current
    const snap = historyRef.current.pop()
    if (!s || !snap) return
    solvedRef.current = false
    setSolved(false)
    setSolvedSeen(false)
    setNudge(null)
    commit({
      ...s,
      you: snap.you,
      echo: snap.echo,
      youPellets: new Set(snap.youPellets),
      echoPellets: new Set(snap.echoPellets),
      moves: snap.moves,
    })
    forceHistory((n) => n + 1)
    play('flip')
  }, [commit, play])

  const restart = useCallback(() => {
    if (isDailyRef.current) startDaily()
    else {
      const s = stateRef.current
      if (s) startLevel(s.levelIndex)
    }
  }, [startDaily, startLevel])

  // No wrap-around, and no entering a pack that is still locked (◀ on Level 1
  // used to jump straight into the locked final pack).
  const canGoTo = useCallback(
    (index: number) =>
      index >= 0 && index < levelCount && isPackUnlocked(PACKS.indexOf(packOf(index)), solvedSet),
    [solvedSet],
  )

  const gotoLevel = useCallback(
    (index: number) => {
      if (!canGoTo(index)) return
      startLevel(index)
    },
    [canGoTo, startLevel],
  )

  const nextLevel = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    gotoLevel(s.levelIndex + 1)
  }, [gotoLevel])

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        undo()
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        restart()
        return
      }
      const dir = KEY_DIRS[e.key]
      if (dir) {
        e.preventDefault()
        doMove(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doMove, undo, restart])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  // 목표를 먼저 말한다. 자체 창작 게임이라 방문자의 사전 지식이 0이고,
  // registry의 howToPlay는 첫 화면 밖(보드 아래 mt-12 섹션)에 있어 안 읽힌다.
  const hint =
    'Land both tokens on their goals to clear the level. Arrows / WASD / swipe move BOTH at once — amber Echo mirrors you. Use walls to split them. ↩ Undo · R restart.'

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-100 select-none">
        <div className="aspect-square w-full rounded-xl bg-surface p-2" data-testid="duplex-board" />
        <p className="mt-3 text-center text-sm text-fg-muted">{hint}</p>
      </div>
    )
  }

  const s = state
  const winOverlayVisible = solved && !solvedSeen
  const isLastLevel = !isDaily && s.levelIndex === levelCount - 1
  const canUndo = historyRef.current.length > 0 && !solved
  const packIdx = PACKS.indexOf(packOf(s.levelIndex))
  const stars = starsFor(s.moves, s.par)

  // Ghost preview targets (hover/focus on a dpad direction).
  const hoverPreview = showGhosts && hoverDir ? preview(s, hoverDir) : null

  const levelStat = isDaily
    ? { label: 'Daily', value: Number(dailyDate.slice(-2)) }
    : { label: 'Level', value: s.levelIndex + 1 }

  return (
    <GameShell
      stats={[
        levelStat,
        { label: 'Moves', value: s.moves, testId: 'moves' },
        { label: 'Par', value: s.par },
        { label: 'Best', value: best ?? 0 },
        // day-streak은 데일리 모드에서만.
        ...(isDaily ? [{ label: 'Streak', value: streak, testId: 'streak' }] : []),
      ]}
      headerExtra={
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-testid="duplex-mirror"
            className="rounded-lg border border-neon-purple/50 bg-surface/80 px-2 py-1.5 text-sm font-semibold text-neon-purple"
          >
            {MODE_CHIP[s.mode]}
          </span>
          {!isDaily && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous level"
                onClick={() => gotoLevel(s.levelIndex - 1)}
                disabled={!canGoTo(s.levelIndex - 1)}
                className="btn-press disabled:cursor-not-allowed disabled:opacity-40 rounded-lg border border-border bg-surface/80 px-2 py-1.5 text-sm hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
              >
                <span aria-hidden="true">◀</span>
              </button>
              <button
                type="button"
                aria-label="Next level"
                onClick={() => gotoLevel(s.levelIndex + 1)}
                disabled={!canGoTo(s.levelIndex + 1)}
                className="btn-press disabled:cursor-not-allowed disabled:opacity-40 rounded-lg border border-border bg-surface/80 px-2 py-1.5 text-sm hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
              >
                <span aria-hidden="true">▶</span>
              </button>
            </div>
          )}
          <button
            type="button"
            aria-pressed={isDaily}
            onClick={startDaily}
            className={`btn-press rounded-lg border px-2 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
              isDaily
                ? 'border-neon-amber/70 bg-neon-amber/15 text-neon-amber'
                : 'border-border bg-surface/80 text-fg hover:border-neon-cyan/60'
            }`}
          >
            Daily
          </button>
        </div>
      }
      onNewGame={restart}
      newGameLabel="Restart"
      muted={muted}
      onToggleMute={toggleMuted}
      hint={hint}
    >
      <style>{keyframes}</style>
      <div
        key={flipKey}
        className={`anim-board-in relative w-full touch-none rounded-xl bg-surface p-2 ${
          !reducedRef.current ? 'dux-flip' : ''
        }`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-testid="duplex-board"
      >
        <ShakeLayer shakeKey={shakeKey} reduced={reducedRef.current}>
          <div
            className="grid w-full gap-px overflow-hidden rounded-lg"
            style={{ gridTemplateColumns: `repeat(${s.width}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: s.height }, (_, r) =>
              Array.from({ length: s.width }, (_, c) => {
                const kind = cellKind(s, r, c)
                const arrow = s.arrows[r][c]
                const youHere = s.you.row === r && s.you.col === c
                const echoHere = s.echo.row === r && s.echo.col === c
                const youPellet = s.youPellets.has(keyOf(r, c))
                const echoPellet = s.echoPellets.has(keyOf(r, c))
                const youGhost =
                  (hoverPreview && hoverPreview.you.row === r && hoverPreview.you.col === c) || false
                const echoGhost =
                  (hoverPreview && hoverPreview.echo.row === r && hoverPreview.echo.col === c) ||
                  echoGhosts.has(keyOf(r, c))
                const sat = goalSatisfaction(s)
                return (
                  <div
                    key={`${r}-${c}`}
                    data-testid="duplex-cell"
                    data-kind={kind}
                    data-arrow={arrow ?? undefined}
                    className={`relative flex aspect-square items-center justify-center text-lg leading-none ${cellBg(
                      kind,
                    )}`}
                  >
                    {kind === 'ice' && (
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 dux-ice" />
                    )}
                    {kind === 'you-goal' && <GoalRing color="var(--neon-blue)" active={youHere && sat.you} />}
                    {kind === 'echo-goal' && <GoalRing color="var(--neon-amber)" active={echoHere && sat.echo} />}
                    {arrow && (
                      <span aria-hidden="true" className="pointer-events-none text-sm text-neon-cyan/70">
                        {ARROW_GLYPH[arrow]}
                      </span>
                    )}
                    {youPellet && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute h-1.5 w-1.5 rounded-full"
                        style={{ background: 'var(--neon-blue)', boxShadow: '0 0 6px var(--neon-blue)' }}
                      />
                    )}
                    {echoPellet && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute h-1.5 w-1.5 rounded-full"
                        style={{ background: 'var(--neon-amber)', boxShadow: '0 0 6px var(--neon-amber)' }}
                      />
                    )}
                    {/* Ghost previews of where the tokens will land. */}
                    {youGhost && !youHere && (
                      <span
                        aria-hidden="true"
                        className="dux-ghost pointer-events-none absolute h-2.5 w-2.5 rounded-full border"
                        style={{ borderColor: 'var(--neon-blue)' }}
                      />
                    )}
                    {echoGhost && !echoHere && (
                      <span
                        aria-hidden="true"
                        className="dux-ghost pointer-events-none absolute h-2.5 w-2.5 rounded-full border"
                        style={{ borderColor: 'var(--neon-amber)' }}
                      />
                    )}
                    {youHere && (
                      <span
                        key={nudge?.key ?? 0}
                        data-testid="duplex-you"
                        className={`relative z-[1] h-[70%] w-[70%] rounded-full ${
                          youHere && sat.you ? 'dux-pop' : ''
                        } ${youHere && nudge ? nudgeAnim(nudge.dir) : ''}`}
                        style={{
                          background: 'radial-gradient(circle at 35% 30%, #9dc0ff, var(--neon-blue))',
                          boxShadow: '0 0 10px var(--neon-blue)',
                        }}
                      />
                    )}
                    {echoHere && (
                      <span
                        key={`e${nudge?.key ?? 0}`}
                        data-testid="duplex-echo"
                        className={`absolute z-[1] h-[46%] w-[46%] rounded-full ${
                          echoHere && sat.echo ? 'dux-pop' : ''
                        }`}
                        style={{
                          background: 'radial-gradient(circle at 35% 30%, #ffe4a3, var(--neon-amber))',
                          boxShadow: '0 0 8px var(--neon-amber)',
                          right: '8%',
                          bottom: '8%',
                        }}
                      />
                    )}
                  </div>
                )
              }),
            )}
          </div>
        </ShakeLayer>

        <GameOverlay
          show={winOverlayVisible}
          variant="win"
          title={isLastLevel ? 'All levels cleared!' : 'Solved!'}
          testId="duplex-win"
        >
          <p className="text-sm text-fg-muted">
            Solved in <span className="font-bold text-accent">{s.moves}</span> moves (par {s.par})
            {newBest ? ' — new best!' : ''}
          </p>
          <p className="text-2xl tracking-widest" aria-label={`${stars} of 3 stars`}>
            {'★★★'.slice(0, stars)}
            <span className="text-fg-muted/40">{'★★★'.slice(stars)}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {!isLastLevel && !isDaily && (
              <GameButton onClick={nextLevel} className="px-4 py-2">
                Next Level
              </GameButton>
            )}
            {isDaily && (
              <DailyShareButton
                payload={() => {
                  const used = s.moves
                  const par = s.par
                  const grade = gradeFewer(used, par)
                  const glyph = barGlyph(used, par, `${used} MOVES · PAR ${par}`)
                  return {
                    gameName: 'Duplex',
                    dateISO: localISODate(),
                    accent: '#4d7cff',
                    lines: [],
                    streak,
                    url: `${window.location.origin}/duplex`,
                    isDaily: true,
                    grade,
                    scoreLine: `${used} / ${par} MOVES`,
                    glyph,
                    textSnippet: resultSnippet('Duplex', localISODate(), true, grade, glyph.cells, par, `solved in ${used} moves (par ${par})`),
                  }
                }}
              />
            )}
            <GameButton variant="ghost" onClick={restart} className="px-4 py-2">
              Replay
            </GameButton>
          </div>
        </GameOverlay>
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GameButton
            variant="ghost"
            onClick={undo}
            disabled={!canUndo}
            className="px-3 py-2"
            aria-label="Undo last move"
          >
            ↩ Undo
          </GameButton>
          <button
            type="button"
            aria-pressed={showGhosts}
            onClick={() => setShowGhosts((v) => !v)}
            className={`btn-press rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${
              showGhosts
                ? 'border-neon-cyan/70 bg-neon-cyan/10 text-neon-cyan'
                : 'border-border bg-surface/80 text-fg hover:border-neon-cyan/60'
            }`}
          >
            Ghosts {showGhosts ? 'on' : 'off'}
          </button>
        </div>

        <div
          className="grid grid-cols-3 grid-rows-2 gap-1.5"
          role="group"
          aria-label="Direction pad"
          data-testid="duplex-dpad"
        >
          <DpadButton dir="up" label="Move up" onPress={doMove} onHover={setHoverDir} className="col-start-2 row-start-1">
            ▲
          </DpadButton>
          <DpadButton dir="left" label="Move left" onPress={doMove} onHover={setHoverDir} className="col-start-1 row-start-2">
            ◀
          </DpadButton>
          <DpadButton dir="down" label="Move down" onPress={doMove} onHover={setHoverDir} className="col-start-2 row-start-2">
            ▼
          </DpadButton>
          <DpadButton dir="right" label="Move right" onPress={doMove} onHover={setHoverDir} className="col-start-3 row-start-2">
            ▶
          </DpadButton>
        </div>
      </div>

      {/* Pack progress strip */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs">
        {PACKS.map((p, i) => {
          const unlocked = isPackUnlocked(i, solvedSet)
          const current = i === packIdx && !isDaily
          return (
            <span
              key={p.name}
              className={`rounded-md border px-2 py-1 ${
                current
                  ? 'border-neon-purple/70 bg-neon-purple/15 text-neon-purple'
                  : unlocked
                    ? 'border-border bg-surface/70 text-fg-muted'
                    : 'border-border bg-surface/40 text-fg-muted/50'
              }`}
              title={unlocked ? p.name : `Clear ${PACKS[i - 1]?.name} to unlock`}
            >
              {unlocked ? '' : '🔒 '}
              {p.name}
            </span>
          )
        })}
      </div>
    </GameShell>
  )
}

/** Whether a level index is the first of its pack (plays the flip intro). */
function LEVEL_INTRO(levelIndex: number): boolean {
  return PACKS.some((p) => p.start === levelIndex)
}

function useMemoGhosts(s: GameState, enabled: boolean): Set<string> {
  return useMemo(() => {
    if (!enabled) return new Set<string>()
    const all = previewAll(s)
    const set = new Set<string>()
    for (const d of ['up', 'down', 'left', 'right'] as Direction[]) {
      const cell = all[d].echo
      // Skip if Echo would idle (destination equals current position).
      if (cell.row === s.echo.row && cell.col === s.echo.col) continue
      set.add(keyOf(cell.row, cell.col))
    }
    return set
  }, [s, enabled])
}

function ShakeLayer({
  shakeKey,
  reduced,
  children,
}: {
  shakeKey: number
  reduced: boolean
  children: React.ReactNode
}) {
  return (
    <div key={reduced ? undefined : shakeKey} className={shakeKey > 0 && !reduced ? 'dux-shake' : ''}>
      {children}
    </div>
  )
}

function GoalRing({ color, active }: { color: string; active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-[15%] rounded-full border-2 ${active ? 'dux-pop' : ''}`}
      style={{ borderColor: color, boxShadow: `inset 0 0 8px ${color}, 0 0 6px ${color}` }}
    />
  )
}

function DpadButton({
  dir,
  label,
  onPress,
  onHover,
  className,
  children,
}: {
  dir: Direction
  label: string
  onPress: (d: Direction) => void
  onHover: (d: Direction | null) => void
  className: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onPress(dir)}
      onMouseEnter={() => onHover(dir)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(dir)}
      onBlur={() => onHover(null)}
      className={`btn-press flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface/80 text-sm text-fg hover:border-neon-cyan/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan ${className}`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}

function cellKind(s: GameState, r: number, c: number): CellKind {
  if (s.walls[r][c]) return 'wall'
  if (s.youGoal && s.youGoal.row === r && s.youGoal.col === c) return 'you-goal'
  if (s.echoGoal && s.echoGoal.row === r && s.echoGoal.col === c) return 'echo-goal'
  if (s.ice[r][c]) return 'ice'
  if (s.arrows[r][c]) return 'arrow'
  return 'floor'
}

function cellBg(kind: CellKind): string {
  if (kind === 'wall') return 'bg-white/10'
  if (kind === 'ice') return 'bg-neon-cyan/10'
  return 'bg-white/[0.03]'
}

function nudgeAnim(dir: Direction): string {
  switch (dir) {
    case 'up':
      return 'dux-step-up'
    case 'down':
      return 'dux-step-down'
    case 'left':
      return 'dux-step-left'
    case 'right':
      return 'dux-step-right'
  }
}

// Component-scoped keyframes — no shared globals touched.
const keyframes = `
.dux-step-up { animation: dux-step-up 130ms ease-out; }
.dux-step-down { animation: dux-step-down 130ms ease-out; }
.dux-step-left { animation: dux-step-left 130ms ease-out; }
.dux-step-right { animation: dux-step-right 130ms ease-out; }
.dux-pop { animation: dux-pop 260ms ease-out; }
.dux-shake { animation: dux-shake 220ms ease-in-out; }
.dux-flip { animation: dux-flip 480ms ease-out; }
.dux-ghost { animation: dux-ghost 1.4s ease-in-out infinite; }
.dux-ice { background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(34,211,238,0.18) 3px, rgba(34,211,238,0.18) 5px); }
@keyframes dux-step-up { from { transform: translateY(38%); } to { transform: translateY(0); } }
@keyframes dux-step-down { from { transform: translateY(-38%); } to { transform: translateY(0); } }
@keyframes dux-step-left { from { transform: translateX(38%); } to { transform: translateX(0); } }
@keyframes dux-step-right { from { transform: translateX(-38%); } to { transform: translateX(0); } }
@keyframes dux-pop { 0% { transform: scale(1); } 45% { transform: scale(1.3); } 100% { transform: scale(1); } }
@keyframes dux-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
@keyframes dux-flip { 0% { transform: perspective(600px) rotateX(88deg); opacity: 0.2; } 60% { transform: perspective(600px) rotateX(-8deg); opacity: 1; } 100% { transform: perspective(600px) rotateX(0deg); } }
@keyframes dux-ghost { 0%,100% { opacity: 0.35; transform: scale(0.86); } 50% { opacity: 0.85; transform: scale(1.05); } }
@media (prefers-reduced-motion: reduce) {
  .dux-step-up, .dux-step-down, .dux-step-left, .dux-step-right, .dux-pop, .dux-shake, .dux-flip, .dux-ghost { animation: none; }
}
`
