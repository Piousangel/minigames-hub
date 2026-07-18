'use client'

import { useState } from 'react'
import { GameButton } from '@/components/game-shell'
import { shareDaily, type DailySharePayload } from '@/lib/dailyShare'

/**
 * 데일리 결과를 브랜드 이미지 카드 + 텍스트로 공유. payload는 클릭 시점에 현재
 * 상태를 읽도록 함수로 받는다(오버레이가 떠 있는 동안 값이 바뀔 수 있으므로).
 */
export function DailyShareButton({
  payload,
  className,
}: {
  payload: () => DailySharePayload
  className?: string
}) {
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <GameButton
      variant="ghost"
      className={className ?? 'px-4 py-2'}
      onClick={async () => {
        const r = await shareDaily(payload())
        setMsg(r.method === 'download' ? 'Saved!' : r.method === 'text-only' ? 'Copied!' : 'Shared!')
        window.setTimeout(() => setMsg(null), 2000)
      }}
    >
      {msg ?? '\u{1F4E3} Share result'}
    </GameButton>
  )
}
