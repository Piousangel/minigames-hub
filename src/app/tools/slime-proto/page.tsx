import type { Metadata } from 'next'
import { SlimeProto } from '@/components/SlimeProto'

export const metadata: Metadata = {
  title: 'Slime Slide prototype (internal)',
  robots: { index: false, follow: false },
}

export default function SlimeProtoPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-3">
      <h1 className="mb-1 text-center text-lg font-bold">말랑 미끄럼길 (시험판)</h1>
      <p className="mb-2 text-center text-xs text-fg-muted">선을 그어 말랑이를 꽃으로 보내세요. 비공개 시험판이에요.</p>
      <SlimeProto />
    </main>
  )
}
