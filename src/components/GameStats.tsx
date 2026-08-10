'use client'

import { useEffect, useState } from 'react'
import { loadStats, winRate, type GameStats as Stats } from '@/lib/gameStats'
import { currentStreak, loadStreak } from '@/lib/dailyStreak'
import { DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { LEADERBOARD_GAMES } from '@/lib/leaderboard'

/**
 * 게임 페이지 개인 기록('트로피 케이스', DOMAIN §3). 완료 판수/승률/스트릭/최고점을 보여
 * 재방문 동기를 만든다(Wordle 스탯모달 = 84% 익일복귀 근거).
 *
 * 클라이언트 전용. 완료 기록(plays>0)이 없으면 아무것도 안 그림 → SSR/SEO 무해. 값은
 * 게임이 recordResult를 호출해야 채워지므로, 아직 미채택 게임에선 자연히 숨는다.
 * 스트릭 키 컨벤션은 `best:<slug>:streak`(현재 채택 게임 공통).
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-surface/60 px-2 py-3">
      <span className="text-xl font-bold tabular-nums text-accent">{value}</span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wide text-fg-muted">{label}</span>
    </div>
  )
}

export function GameStats({ slug }: { slug: string }) {
  const [ready, setReady] = useState(false)
  const [stats, setStats] = useState<Stats>({ plays: 0, wins: 0 })
  const [best, setBest] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)

  const meta = gameMeta[slug] ?? DEFAULT_META

  useEffect(() => {
    setStats(loadStats(slug))
    const storedBest = Number(localStorage.getItem(`best:${slug}`))
    setBest(Number.isFinite(storedBest) && storedBest > 0 ? Math.floor(storedBest) : 0)
    if (meta.daily) {
      const rec = loadStreak(`best:${slug}:streak`)
      setStreak(currentStreak(rec))
      setMaxStreak(rec?.maxStreak ?? 0)
    }
    setReady(true)
  }, [slug, meta.daily])

  // Maze/Sliding/WordSearch never call recordResult() on purpose: their "best" is a
  // lower-is-better time, and this panel's "Best" display assumes higher-is-better —
  // wiring them in would show a misleading trophy case. Don't "fix" that here.
  if (!ready || stats.plays === 0) return null

  const scoreLabel = LEADERBOARD_GAMES[slug]?.label ?? 'Best'
  const cells: Array<{ label: string; value: string }> = [
    { label: 'Played', value: String(stats.plays) },
    { label: 'Win %', value: String(winRate(stats)) },
  ]
  if (meta.daily) {
    cells.push({ label: 'Streak', value: String(streak) })
    cells.push({ label: 'Max streak', value: String(maxStreak) })
  }
  if (best > 0) cells.push({ label: scoreLabel, value: best.toLocaleString() })

  return (
    <section aria-label="Your stats" className="mt-8" data-testid="game-stats">
      <h2 className="neon-text mb-3 text-sm font-bold uppercase tracking-[0.15em] text-accent">
        Your stats
      </h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {cells.map((c) => (
          <Stat key={c.label} label={c.label} value={c.value} />
        ))}
      </div>
    </section>
  )
}
