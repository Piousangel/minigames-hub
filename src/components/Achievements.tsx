'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GOALS, goalState, type GoalState } from '@/lib/achievements'

/**
 * 홈 "Goals" 위젯 — "다음에 이룰 것"으로 계속 플레이/재방문하게 만드는 체류 장치.
 * 기존 localStorage 신호에서 진척 계산(클라이언트 전용, 하이드레이션 안전). 아직 아무것도 안 한
 * 완전 신규 방문자(전부 0)에겐 안 그려 첫 화면을 어지럽히지 않는다.
 */
const TIERS_KEY = 'goals:tiers'

export function Achievements() {
  const [states, setStates] = useState<(GoalState & { id: string; label: string; icon: string })[] | null>(
    null,
  )
  const [reached, setReached] = useState<string[]>([]) // 방금 넘은 티어(축하)

  useEffect(() => {
    const computed = GOALS.map((g) => {
      const v = g.value()
      return { id: g.id, label: g.label, icon: g.icon, ...goalState(g, v) }
    })
    setStates(computed)

    // 티어 달성 축하: 저장된 티어보다 올라갔으면 보상 배너. 최초(저장 없음)엔 기준선만 세팅
    // (기존 진척을 소급 축하하지 않음).
    try {
      const rawSeen = localStorage.getItem(TIERS_KEY)
      const seen: Record<string, number> = rawSeen ? JSON.parse(rawSeen) : {}
      const cur: Record<string, number> = {}
      const newly: string[] = []
      for (const s of computed) {
        cur[s.id] = s.tierIndex
        if (rawSeen && s.tierIndex > (seen[s.id] ?? 0)) {
          const [name] = s.label.split(' — ')
          const g = GOALS.find((x) => x.id === s.id)
          const tierVal = g?.tiers[s.tierIndex - 1]
          newly.push(`${s.icon} ${name}${tierVal ? ` — ${tierVal}` : ''}`)
        }
      }
      if (newly.length) setReached(newly)
      localStorage.setItem(TIERS_KEY, JSON.stringify(cur))
    } catch {
      /* ignore */
    }
  }, [])

  if (!states) return null
  // 아무 진척도 없으면(전부 0) 숨김 — 첫 방문 어지럽힘 방지.
  if (states.every((s) => s.value === 0)) return null

  return (
    <section aria-labelledby="goals" className="mb-12">
      <div className="mb-6 flex items-center gap-4">
        <h2 id="goals" className="font-pixel neon-text text-sm text-neon-lime sm:text-base">
          Goals
        </h2>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-neon-lime/50 to-transparent"
        />
      </div>

      {reached.length > 0 && (
        <div
          className="mb-4 rounded-xl border border-neon-amber/60 bg-neon-amber/10 px-4 py-3 text-sm text-neon-amber"
          role="status"
          data-testid="goal-reached"
        >
          🎉 Goal reached! {reached.join(' · ')}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {states.map((s) => {
          const pct = s.complete
            ? 100
            : Math.max(
                4,
                Math.min(100, Math.round(((s.value - s.prev) / Math.max(1, s.target - s.prev)) * 100)),
              )
          const [name, sub] = s.label.split(' — ')
          return (
            <div
              key={s.id}
              className={`rounded-xl border p-4 ${s.complete ? 'border-neon-lime/50 bg-neon-lime/5' : 'border-border bg-surface/60'}`}
              data-testid={`goal-${s.id}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-fg">
                  <span aria-hidden="true" className="mr-1">
                    {s.icon}
                  </span>
                  {name}
                </span>
                <span className="text-xs font-bold tabular-nums text-neon-lime">
                  {s.complete ? '★ Maxed' : `${s.value}/${s.target}`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-neon-lime" style={{ width: `${pct}%` }} />
              </div>
              {sub && <p className="mt-1.5 text-[11px] text-fg-muted">{sub}</p>}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-fg-muted">
        Keep playing to hit the next tier.{' '}
        <Link href="/guides" className="text-neon-cyan hover:underline">
          Read a strategy guide →
        </Link>
      </p>
    </section>
  )
}
