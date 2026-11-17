import type { Metadata } from 'next'
import { StrokeSampler } from '@/components/StrokeSampler'

export const metadata: Metadata = {
  title: 'Stroke sample (internal)',
  robots: { index: false, follow: false },
}

export default function StrokeSamplePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-1 text-center text-xl font-bold">선 그리기 샘플 (내부용)</h1>
      <p className="mb-4 text-center text-xs text-fg-muted">새 게임의 난이도 기준을 정하려고 손으로 그은 선의 흔들림을 잽니다. 데이터는 이 화면 밖으로 전송되지 않아요.</p>
      <StrokeSampler />
    </main>
  )
}
