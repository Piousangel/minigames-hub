'use client'

import { useEffect, useState } from 'react'
import { gameMeta } from '@/lib/games/gameMeta'
import { isNew } from '@/lib/newGames'

/**
 * 게임 카드 코너의 NEW 뱃지 — 최근 추가 게임 표시(DOMAIN §3 홈 신선함). addedDate 기준
 * 클라이언트 now로 판정해 자동 만료(재빌드 불필요). 최근이 아니면 안 그림.
 * 위치는 GameCard의 좌상단 뱃지 줄(하트=우상단과 안 겹침)이 정한다 — 여기선 모양만.
 */
export function NewBadge({ slug }: { slug: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(isNew(gameMeta[slug]?.addedDate, Date.now()))
  }, [slug])

  if (!show) return null
  return (
    <span
      className="font-pixel rounded-full border border-neon-lime/50 bg-surface px-1.5 py-0.5 text-[8px] tracking-[0.15em] text-neon-lime"
      data-testid="new-badge"
    >
      NEW
    </span>
  )
}
