'use client'

import { useEffect, useState } from 'react'
import { editionFor, type Edition } from '@/lib/home/edition'

/**
 * 마스트헤드 한 줄 "No. N · Thu, Nov 19"(D3). 날짜는 클라이언트 시계(UTC 자정 기준)로만 그린다 —
 * 정적 HTML에 빌드 날짜가 굳으면 다음 날부터 틀린다(리뷰 B9). 정적 HTML·첫 렌더는 날짜 없는
 * 자리 표시("Today's edition"). 줄 높이 고정(h-9) + tabular-nums라 글자가 바뀌어도 아무것도 밀리지 않는다(CLS 0).
 */
export function HeroMasthead() {
  const [ed, setEd] = useState<Edition | null>(null)
  useEffect(() => {
    const tick = () => setEd(editionFor(new Date()))
    tick()
    // 홈을 연 채 UTC 자정을 넘기면 다시 보일 때 새 호로
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <p
      data-testid="hero-masthead"
      className="flex h-9 items-center overflow-hidden whitespace-nowrap border-y border-t-2 border-garden-ink text-[15px] leading-5 text-garden-ink-deep tabular-nums lg:h-10 lg:text-[18px] lg:leading-6"
    >
      {ed ? (
        <>
          <b className="font-display font-semibold">No. {ed.no}</b>
          <span className="whitespace-pre"> · </span>
          <time dateTime={ed.dateUTC} className="font-display-italic italic">
            {ed.label}
          </time>
        </>
      ) : (
        <span className="font-display-italic italic">Today&rsquo;s edition</span>
      )}
    </p>
  )
}
