'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { sendHit } from '@/lib/hit'

/**
 * 히어로의 랜덤 시작 링크(R3부터 1차 CTA는 오늘 호 카드의 Play, 이건 보조). 콜드 방문자를 곧바로
 * 즐길 만한 게임에 떨어뜨려 활성화(=체류)를 앞당긴다. 오리지널 대표작(11-17 실험 E1, docs/team/specs/2026-11-17-hero-play-originals.md) 중 랜덤이라
 * 매 클릭이 "빠른 시작/서프라이즈"가 된다. JS 없이도 href(recoil)로 동작(점진적 향상).
 * Math.random은 렌더가 아니라 클릭 핸들러에서만 쓴다(하이드레이션/순수성 안전).
 */
export const PICKS = [
  'recoil',
  'lagline',
  'hunch',
  'fizzbeat',
  'unblock',
  'plop-landing',
  'acorn-hop',
  'slime-slide',
]

/**
 * R3(리디자인 v2): 홈 히어로 오늘 호 카드 아래 보조 링크 "or toss a random seed". 노란 버튼은 카드의
 * Play 하나뿐이라(시안 규칙) 이쪽은 글자 링크다. 보이는 글자가 곧 접근 이름(WCAG 2.5.3).
 */
export function HeroPlayButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // 새 탭/보조클릭은 기본 동작(href) 존중
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      const slug = PICKS[Math.floor(Math.random() * PICKS.length)]
      sendHit(slug, 'hero_play')
      router.push(`/${slug}?ref=hero`)
    },
    [router],
  )

  return (
    <Link href="/recoil" onClick={onClick} className={className}>
      or toss a random seed
    </Link>
  )
}
