import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { hasLeaderboard } from '@/lib/leaderboard'
import type { GamePage } from '@/lib/games/registry'
import { AdSlot } from '@/components/ads/AdSlot'
import { Leaderboard } from '@/components/Leaderboard'
import { RecordPlay } from '@/components/RecordPlay'
import { Reveal } from '@/components/Reveal'
import { NextUp } from '@/components/NextUp'
import { GameStats } from '@/components/GameStats'
import { ObjectiveBanner } from '@/components/ObjectiveBanner'
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
    // --accent를 페이지 스코프로 깔아 게임 컴포넌트 밖(스탯 패널 등)에서도 text-accent가 먹게 한다.
    <main className="mx-auto max-w-3xl px-4 py-6" style={{ ['--accent' as string]: color }}>
      <RecordPlay slug={page.slug} />
      <h1 className="neon-text mb-4 text-center text-3xl font-bold" style={{ color }}>
        {page.h1}
      </h1>
      {/* 목표 한 줄(above-the-fold) — 낯선 유저가 승리 조건을 즉시 이해 */}
      <ObjectiveBanner slug={page.slug} />
      {children}

      {/* 게임 직후 개인 기록(트로피 케이스) — 데이터 없으면 안 뜸 */}
      <GameStats slug={page.slug} />

      {/* 다음 게임으로 잇는 체류 후크(게임오버 catch point, 크로스셀은 스택 마지막) */}
      <NextUp currentSlug={page.slug} />

      {hasLeaderboard(page.slug) && <Leaderboard slug={page.slug} />}

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
