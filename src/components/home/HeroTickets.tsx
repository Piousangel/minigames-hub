'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { GameIcon } from '@/components/icons/GameIcon'
import { RECENT_KEY } from '@/components/RecordPlay'
import { BudIcon, FlowerIcon } from '@/components/site-chrome/GardenIcons'
import { sendHit } from '@/lib/hit'
import { GARDEN_SLUGS, nextSlot, type Garden, type GardenSlot, type GardenSlug } from '@/lib/home/garden'
import { useTodayGarden } from '@/lib/home/useTodayGarden'

export type TicketGame = { slug: string; title: string }

// 티켓 모양(시안 hub-v2.html data-ticket): 384×120, 모서리 22, 절취선 x=120에 위·아래 홈(반지름 9), 윤곽 4px, 판 그림자 6px.
// 런타임 JS로 그리지 않도록 경로를 상수로 둔다(계획서 0장 '정적 인라인 SVG').
const W = 384
const H = 120
const R = 22
const PX = 120
const NR = 9
const SW = 4
const TICKET_PATH = (() => {
  const o = SW / 2
  const t = o
  const b = H - o
  const l = o
  const r = W - o
  const rr = R - o
  return `M${l + rr} ${t} H${PX - NR} A${NR} ${NR} 0 0 0 ${PX + NR} ${t} H${r - rr} A${rr} ${rr} 0 0 1 ${r} ${t + rr} V${b - rr} A${rr} ${rr} 0 0 1 ${r - rr} ${b} H${PX + NR} A${NR} ${NR} 0 0 0 ${PX - NR} ${b} H${l + rr} A${rr} ${rr} 0 0 1 ${l} ${b - rr} V${t + rr} A${rr} ${rr} 0 0 1 ${l + rr} ${t} Z`
})()

const SKY: Record<GardenSlug, string> = { 'slime-slide': 'Sunset sky', 'plop-landing': 'Dawn sky', 'acorn-hop': 'Night sky' }

type Ticket =
  | { kind: 'garden'; slot: GardenSlot; title: string }
  | { kind: 'continue'; slug: string; title: string }
  | { kind: 'daily' }

/**
 * 티켓 3장 고르기(순수): 히어로 카드의 노란 Play가 가리키는 게임은 빼고(중복 방지) 정원 순서대로,
 * 모자라면 세 번째는 Continue(최근에 한 정원 밖 게임) → 없으면 Daily puzzles(/daily).
 * - first: 카드 = Slime → Plop · Acorn · Continue/Daily (정적 HTML은 Plop · Acorn · Daily)
 * - in-progress: 카드 = 다음 안 핀 게임 → 나머지 둘 + Continue/Daily
 * - complete: 카드 = /daily → 세 정원 게임 모두(결과 숫자와 함께)
 */
export function pickTickets(garden: Garden, titles: Record<string, string>, recent: string[]): Ticket[] {
  const cta: GardenSlug | null = garden.state === 'first' ? 'slime-slide' : nextSlot(garden)
  const out: Ticket[] = garden.slots.filter((s) => s.slug !== cta).map((slot) => ({ kind: 'garden', slot, title: titles[slot.slug] ?? slot.slug }))
  if (out.length < 3) {
    const garden3 = new Set<string>(GARDEN_SLUGS)
    const pick = recent.find((s) => !garden3.has(s) && titles[s])
    out.push(pick ? { kind: 'continue', slug: pick, title: titles[pick] } : { kind: 'daily' })
  }
  return out.slice(0, 3)
}

function status(slot: GardenSlot): string {
  if (slot.status !== 'bloomed') return 'Unplayed'
  const r = slot.result
  return r ? `Bloomed · ${r.primary.label === 'points' ? 'best' : r.primary.label} ${r.primary.value}` : 'Bloomed'
}

/**
 * 데스크톱 히어로 바닥 '오늘 호 티켓' 줄(리디자인 v2 R5, R4 이월). 1280 이상에서만 보인다(globals.css).
 * 칸 3개·크기 고정 — 상태가 바뀌어도 높이가 같아 CLS 0. 정적 HTML = first 모양.
 */
export function HeroTickets({ games, dailyCount }: { games: TicketGame[]; dailyCount: number }) {
  const { garden } = useTodayGarden()
  const [recent, setRecent] = useState<string[]>([])
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
      setRecent(Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [])
    } catch {
      setRecent([])
    }
  }, [])
  const titles = Object.fromEntries(games.map((g) => [g.slug, g.title]))
  const tickets = pickTickets(garden, titles, recent)

  return (
    <nav className="home-hero__tickets font-ui" aria-label="Today’s edition" data-testid="hero-tickets">
      <span className="inline-flex h-7 items-center rounded-full border-2 border-garden-ink bg-garden-cream px-3 text-[13px] leading-none font-semibold text-garden-ink-deep">
        {/* 호수(No. N)는 마스트헤드·공유 카드 두 곳에만(계획서 0장) */}
        Also in today’s edition
      </span>
      <ul className="mt-3 flex gap-6">
        {tickets.map((t, i) => {
          const href = t.kind === 'garden' ? `/${t.slot.slug}` : t.kind === 'continue' ? `/${t.slug}` : '/daily'
          const key = `${i}` // 칸 위치로 key(내용이 바뀌어도 칸이 '이동'하지 않게 — R4 Continue와 같은 이유)
          const bloomed = t.kind === 'garden' && t.slot.status === 'bloomed'
          return (
            <li key={key} className="relative h-[126px] w-[384px] shrink-0">
              <Link
                href={`${href}?ref=hero-ticket`}
                onClick={() => sendHit(href.slice(1), 'hero_ticket')}
                data-testid={`hero-ticket-${i}`}
                data-slug={t.kind === 'garden' ? t.slot.slug : t.kind === 'continue' ? t.slug : 'daily'}
                className="group absolute inset-0 block rounded-[22px] text-garden-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink focus-visible:ring-offset-2"
              >
                <svg aria-hidden="true" width={W} height={H + 6} viewBox={`0 0 ${W} ${H + 6}`} className="absolute inset-0 overflow-visible">
                  <path d={TICKET_PATH} transform="translate(0 6)" fill="#3a2410" />
                  <path d={TICKET_PATH} fill="#fff3dc" stroke="#5b3a1e" strokeWidth={SW} />
                  <path d={`M${PX} ${NR + 6} V${H - NR - 6}`} stroke="#7a5636" strokeWidth="2" strokeDasharray="0.1 7" strokeLinecap="round" />
                  <path d={`M${R} ${SW + 1.5} H${PX - NR - 2}`} stroke="#fff8ea" strokeWidth="2" />
                </svg>
                <span className="absolute inset-x-0 top-0 flex h-[120px] items-center px-4">
                  <span className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-garden-ink bg-garden-cream-2">
                    {t.kind === 'garden' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/art/thumb-${t.slot.slug}-144.webp`} srcSet={`/art/thumb-${t.slot.slug}-144.webp 144w, /art/thumb-${t.slot.slug}.webp 512w`} sizes="88px" alt="" width={88} height={88} loading="lazy" decoding="async" className="block h-full w-full object-cover" />
                    ) : t.kind === 'continue' ? (
                      <GameIcon slug={t.slug} className="h-10 w-10" />
                    ) : (
                      <FlowerIcon className="h-11 w-11" />
                    )}
                  </span>
                  <span className="ml-[33px] block min-w-0 flex-1">
                    <span className="block truncate text-[12px] leading-4 font-medium text-garden-ink-soft">
                      {t.kind === 'garden' ? SKY[t.slot.slug] : t.kind === 'continue' ? 'Continue' : 'More in today’s edition'}
                    </span>
                    <span className="font-display mt-0.5 mb-1 block truncate text-[24px] leading-7 font-semibold tracking-[-0.015em] group-hover:underline">
                      {t.kind === 'daily' ? `${dailyCount} daily puzzles` : t.title}
                    </span>
                    <span className={`flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold whitespace-nowrap ${bloomed ? 'text-garden-leaf-text' : 'text-garden-ink'}`} data-testid={`hero-ticket-status-${i}`}>
                      {t.kind === 'garden' ? (
                        <>
                          {bloomed ? <FlowerIcon className="h-4 w-4" /> : <BudIcon className="h-4 w-4" />}
                          {status(t.slot)}
                        </>
                      ) : t.kind === 'continue' ? (
                        'Pick up where you left off'
                      ) : (
                        'Fresh boards every day'
                      )}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
