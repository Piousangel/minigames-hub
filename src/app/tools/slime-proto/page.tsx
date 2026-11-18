import type { Metadata } from 'next'
import { SlimeProto } from '@/components/SlimeProto'

export const metadata: Metadata = {
  title: 'Slime Slide prototype (internal)',
  robots: { index: false, follow: false },
}

export default function SlimeProtoPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-1 text-center text-xl font-bold">말랑 미끄럼길 (시험판)</h1>
      <p className="mb-3 text-center text-xs text-fg-muted">
        손가락으로 선을 그어 말랑이를 둥지로 보내세요. 비공개 시험판이라 사이트 어디에도 링크돼 있지 않아요. 한 판 끝날 때마다 기록이 이 화면에만 쌓이고, 아래 버튼으로 복사해 보내 주시면 난이도 조정에 써요.
      </p>
      <SlimeProto />
    </main>
  )
}
