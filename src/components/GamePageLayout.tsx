import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import type { GamePage } from '@/lib/games/registry'
import { AdSlot } from '@/components/ads/AdSlot'
import { Reveal } from '@/components/Reveal'
import { RelatedGames } from '@/components/RelatedGames'

/** 게임 액센트 네온 컬러의 섹션 헤딩(가독성 위해 픽셀폰트 대신 산세리프). */
function SectionHeading({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2
        className="neon-text text-sm font-bold uppercase tracking-[0.15em]"
        style={{ color }}
      >
        {children}
      </h2>
      <span
        aria-hidden="true"
        className="h-px flex-1"
        style={{ background: `linear-gradient(to right, ${color}55, transparent)` }}
      />
    </div>
  )
}

export function GamePageLayout({ page, children }: { page: GamePage; children: React.ReactNode }) {
  const color = accentVar((gameMeta[page.slug] ?? DEFAULT_META).accent)
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="neon-text mb-4 text-center text-3xl font-bold" style={{ color }}>
        {page.h1}
      </h1>
      {children}

      <Reveal>
        <section className="mt-12">
          <SectionHeading color={color}>How to play</SectionHeading>
          <ul className="list-disc space-y-2 pl-5 text-fg-muted">
            {page.howToPlay.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-8">
          <SectionHeading color={color}>Strategy &amp; tips</SectionHeading>
          <ul className="list-disc space-y-2 pl-5 text-fg-muted">
            {page.strategy.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-8">
          <SectionHeading color={color}>FAQ</SectionHeading>
          <div className="space-y-4">
            {page.faq.map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-semibold">{q}</h3>
                <p className="text-fg-muted">{a}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* 인콘텐츠 광고 자리(승인 전엔 렌더 안 됨) */}
      <AdSlot slot="game-incontent" className="mt-10" />

      <RelatedGames currentSlug={page.slug} />
    </main>
  )
}
