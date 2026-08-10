import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { GAME_INTROS } from '@/lib/games/gameIntros'
import { hasLeaderboard } from '@/lib/leaderboard'
import type { GamePage } from '@/lib/games/registry'
import { AdSlot } from '@/components/ads/AdSlot'
import { Leaderboard } from '@/components/Leaderboard'
import { Reactions } from '@/components/Reactions'
import { RecordPlay } from '@/components/RecordPlay'
import { Reveal } from '@/components/Reveal'
import { NextUp } from '@/components/NextUp'
import { GameNavProvider } from '@/components/GameNav'
import { GameSwitcher } from '@/components/GameSwitcher'
import { GameStats } from '@/components/GameStats'
import { DailyDock } from '@/components/DailyDock'
import { ObjectiveBanner } from '@/components/ObjectiveBanner'
import { CollectionLinks } from '@/components/CollectionLinks'
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

      {/* 게임(children의 GameOverlay)과 NextUp이 같은 '다음 게임' 픽을 공유 → 승/패 모달의
          '다음 게임' 버튼 + 보드 아래 NextUp 카드가 일관, RUN 카운터 이중 증가 없음(체류 세션연장). */}
      <GameNavProvider slug={page.slug}>
        {children}

        {/* 최근 게임 퀵스위처 — 게임 중에도 방금 하던 게임으로 원탭 전환(체류) */}
        <GameSwitcher currentSlug={page.slug} />

        {/* 게임 직후 개인 기록(트로피 케이스) — 데이터 없으면 안 뜸 */}
        <GameStats slug={page.slug} />

        {/* 착지 페이지 리턴 훅: 사이트 streak + 오늘 퀘스트 + 다음 데일리 카운트다운 */}
        <DailyDock />

        {/* 다음 게임으로 잇는 체류 후크(게임오버 catch point, 크로스셀은 스택 마지막) */}
        <NextUp currentSlug={page.slug} />
      </GameNavProvider>

      {/* 게임별 이모지 리액션 — 리더보드 유무와 무관하게 전 게임 공용(사이트 내장 커뮤니티 v1) */}
      <Reactions slug={page.slug} />

      {hasLeaderboard(page.slug) && <Leaderboard slug={page.slug} />}

      {GAME_INTROS[page.slug] && (
        <Reveal>
          <section className="mt-12">
            <SectionHeading color={color}>About {page.h1}</SectionHeading>
            <div className="space-y-4 leading-relaxed text-fg-muted">
              {GAME_INTROS[page.slug].split('\n\n').map((para) => (
                <p key={para.slice(0, 32)}>{para}</p>
              ))}
            </div>
          </section>
        </Reveal>
      )}

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

      {/* 게임 페이지 → 컬렉션 역링크(내부링크 권위 + 유사 게임 발견) */}
      <CollectionLinks slug={page.slug} />

      {/* 인콘텐츠 광고 자리(승인 전엔 렌더 안 됨) */}
      <AdSlot slot="game-incontent" className="mt-10" />

      <RelatedGames currentSlug={page.slug} />
    </main>
  )
}
