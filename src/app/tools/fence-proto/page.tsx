import type { Metadata } from 'next'
import { FenceProto } from '@/components/FenceProto'

export const metadata: Metadata = {
  title: 'Fence prototype (internal)',
  robots: { index: false, follow: false },
}

export default function FenceProtoPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-3">
      <h1 className="mb-1 text-center text-lg font-bold">꽃담 정원 (터치 시험판)</h1>
      <p className="mb-3 text-center text-xs text-fg-muted">비공개 시험판이에요. 기록은 이 화면 밖으로 전송되지 않고, 복사 버튼으로만 꺼낼 수 있어요.</p>
      <FenceProto />
    </main>
  )
}
