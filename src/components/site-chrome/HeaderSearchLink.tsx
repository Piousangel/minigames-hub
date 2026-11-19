'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MouseEvent } from 'react'
import { SEARCH_ANCHOR } from './anchors'
import { SearchIcon } from './GardenIcons'

/**
 * 헤더 검색 버튼(44px). 사이트에 검색 페이지는 없고 검색은 홈 GameBrowser 입력뿐이라
 * 그 입력으로 보낸다(새 검색 페이지는 만들지 않음 — R2 결정).
 * - 다른 페이지: `/#search`로 이동 → GameBrowser가 마운트 때 해시를 보고 입력에 포커스.
 * - 홈: 같은 페이지 해시 이동은 Next가 포커스를 주지 않으므로 직접 스크롤 + 포커스.
 * JS가 없어도 평범한 `<a href="/#search">`라 입력 위치로는 간다.
 */
export function HeaderSearchLink({ className }: { className?: string }) {
  const pathname = usePathname()

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (pathname !== '/') return
    const input = document.getElementById(SEARCH_ANCHOR)
    if (!input) return
    e.preventDefault()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    input.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    input.focus({ preventScroll: true })
    history.replaceState(null, '', `#${SEARCH_ANCHOR}`)
  }

  return (
    <Link href={`/#${SEARCH_ANCHOR}`} aria-label="Search games" onClick={onClick} className={className}>
      <SearchIcon className="h-6 w-6" />
    </Link>
  )
}
