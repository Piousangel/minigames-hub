'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

/**
 * 히어로의 1차 CTA — "PLAY INSTANTLY" 약속을 실제 행동으로. 콜드 방문자를 곧바로
 * 즐길 만한 게임에 떨어뜨려 활성화(=체류)를 앞당긴다. 엄선(graspable) 게임 중 랜덤이라
 * 매 클릭이 "빠른 시작/서프라이즈"가 된다. JS 없이도 href(solitaire)로 동작(점진적 향상).
 * Math.random은 렌더가 아니라 클릭 핸들러에서만 쓴다(하이드레이션/순수성 안전).
 */
const PICKS = [
  'solitaire',
  '2048',
  'flow',
  'unblock',
  'minesweeper',
  'snake',
  'tetris',
  'mahjong',
  'clusters',
  'chess',
]

export function HeroPlayButton() {
  const router = useRouter()
  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // 새 탭/보조클릭은 기본 동작(href) 존중
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      const slug = PICKS[Math.floor(Math.random() * PICKS.length)]
      router.push(`/${slug}`)
    },
    [router],
  )

  return (
    <Link
      href="/solitaire"
      onClick={onClick}
      className="hero-breathe font-pixel neon-box inline-flex items-center gap-2 rounded-xl border-2 border-neon-cyan bg-neon-cyan/10 px-8 py-4 text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:text-sm"
      style={{ color: 'var(--neon-cyan)' }}
      aria-label="Play a game now"
    >
      <span aria-hidden="true">▶</span> PLAY NOW
    </Link>
  )
}
