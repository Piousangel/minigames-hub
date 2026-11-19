import type { Metadata } from 'next'
import { GameSlimeSlide } from '@/components/games/GameSlimeSlide'

// 정식 출시 전 비공개 미리보기(일일·공유·점수 제출 흐름 확인용). 공개는 registry 등록 PR에서 오너 승인 후.
export const metadata: Metadata = {
  title: 'Slime Slide preview (internal)',
  robots: { index: false, follow: false },
}

export default function SlimeSlidePreviewPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-3">
      <h1 className="mb-1 text-center text-lg font-bold">Slime Slide</h1>
      <p className="mb-2 text-center text-xs text-fg-muted">Draw one line to send Mallang to the flower. Private preview.</p>
      <GameSlimeSlide />
    </main>
  )
}
