'use client'

import { useEffect, useState } from 'react'
import { formatCountdown, msUntilNextUTCDay } from '@/lib/dailyStreak'

/**
 * '다음 퍼즐까지 HH:MM:SS' — /daily 허브 상단 어포인트먼트 훅(DOMAIN §3). 데일리 검색으로
 * 랜딩한 유저에게 "매일 새 판" 리듬을 즉시 보여준다. 클라이언트 전용 초 단위 틱(하이드레이션 후).
 *
 * 리디자인 v2 R9: '밤 정원 판'(남보라 #3d3170 → #241c4a, 크림 글자) — 내일 판이 오기 전의 밤.
 * 자리는 처음부터 잡아 둔다(예전엔 하이드레이션 전 null → 아래 게임 목록이 밀렸다). 숫자만 틱 뒤에 채운다.
 */
export function DailyCountdown() {
  const [cd, setCd] = useState('')
  useEffect(() => {
    const tick = () => setCd(formatCountdown(msUntilNextUTCDay(Date.now())))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="mb-8 -mt-2 sm:-mt-4">
      <p
        className="inline-flex h-12 items-center gap-3 rounded-[14px] border-2 border-garden-ink px-4 text-garden-cream"
        // 밤 정원 판(눌리는 버튼과 헷갈리지 않게 알약·판 그림자 없이 각진 판). 단색 = --garden-sky-night 가운데 값 — 대비 검사(bgOf)가 읽는 색
        style={{ backgroundColor: '#2f2660', backgroundImage: 'var(--garden-sky-night)' }}
        data-testid="daily-hub-countdown-board"
      >
        <span aria-hidden="true" className="text-[13px] leading-4 font-semibold text-[#e6dbff]">
          Next puzzles in
        </span>
        <span className="font-display min-w-[7.5ch] text-[20px] leading-6 font-semibold tabular-nums" data-testid="daily-hub-countdown">
          {cd || '--:--:--'}
        </span>
      </p>
    </div>
  )
}
