import Link from 'next/link'
import { accentVar, DEFAULT_META, gameMeta } from '@/lib/games/gameMeta'
import { gameWorld } from '@/lib/games/gardenRollout'
import { roundFont } from '@/app/roundFont'
import { GAME_INTROS } from '@/lib/games/gameIntros'
import { hasLeaderboard } from '@/lib/leaderboard'
import type { GamePage } from '@/lib/games/registry'
import { AdSlot } from '@/components/ads/AdSlot'
import { Leaderboard } from '@/components/Leaderboard'
import { Reactions } from '@/components/Reactions'
import { Comments } from '@/components/Comments'
import { RecordPlay } from '@/components/RecordPlay'
import { ShareButtons } from '@/components/ShareButtons'
import { Reveal } from '@/components/Reveal'
import { NextRail } from '@/components/NextRail'
import { GameNavProvider } from '@/components/GameNav'
import { GameSwitcher } from '@/components/GameSwitcher'
import { GameStats } from '@/components/GameStats'
import { DailyDock } from '@/components/DailyDock'
import { ObjectiveBanner } from '@/components/ObjectiveBanner'
import { CollectionLinks } from '@/components/CollectionLinks'
import { RelatedGames } from '@/components/RelatedGames'
import { articlesForGame, guideForGame } from '@/content'

/** 오리지널 방의 강조색(정원 금빛) — 제목 밖 섹션 머리·페이지 --accent */
const ROOM_GOLD = '#ffc933'

/** 하단 섹션 헤딩. 정원 틀(R7)은 Fraunces + ink(글로우·액센트색 없음).
 *  오리지널 방(garden-room)은 예전 화면 그대로 — 정원 금빛 산세리프 + 글로우(R8 뒤 남은 네온, HANDOFF). */
function SectionHeading({ children, garden }: { children: React.ReactNode; garden: boolean }) {
  if (garden) {
    return (
      <div className="mb-4 flex items-center gap-3">
        <h2 className="garden-section-heading font-display text-xl">{children}</h2>
        <span aria-hidden="true" className="garden-section-rule h-0.5 flex-1 rounded-full" />
      </div>
    )
  }
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2
        className="neon-text text-sm font-bold uppercase tracking-[0.15em]"
        style={{ color: ROOM_GOLD }}
      >
        {children}
      </h2>
      <span
        aria-hidden="true"
        className="h-px flex-1"
        style={{ background: `linear-gradient(to right, ${ROOM_GOLD}55, transparent)` }}
      />
    </div>
  )
}

export function GamePageLayout({ page, children }: { page: GamePage; children: React.ReactNode }) {
  // room = 오리지널 3종(자기 방을 그림 — 정원 제목만), 그 밖 = R7 정원 틀(크림 바깥 + 밤 정원 게임판).
  // R7f로 전 게임이 둘 중 하나라 예전 네온 화면 갈래는 R8에서 지웠다. 배치에 아직 없는 새 게임도 정원 틀로 그리고,
  // 배치 목록 누락은 gardenRollout.test.ts('전 게임 정원 틀' — gameWorld null 0)가 잡는다.
  const garden = gameWorld(page.slug) === 'room'
  const framed = !garden
  const neon = accentVar((gameMeta[page.slug] ?? DEFAULT_META).accent)
  const guide = guideForGame(page.slug)
  const related = articlesForGame(page.slug)
  return (
    // --accent를 페이지 스코프로 깔아 게임 컴포넌트 밖(스탯 패널 등)에서도 text-accent가 먹게 한다.
    // 정원 틀(framed)은 --accent를 CSS 스코프가 정한다(바깥 = coral 글자색, 게임판 = 아래 data-garden-board 인라인).
    <main
      className="mx-auto max-w-3xl px-4 py-6"
      style={framed ? undefined : { ['--accent' as string]: ROOM_GOLD }}
      data-world={garden ? 'garden-room' : 'garden'}
      data-game-page
    >
      <RecordPlay slug={page.slug} />
      {framed ? (
        <h1 className="garden-page-title font-display mb-4 text-center text-3xl sm:text-4xl">{page.h1}</h1>
      ) : (
        <h1 className={`garden-title ${roundFont.className} mb-4 text-center text-4xl`}>{page.h1}</h1>
      )}
      {/* 목표 한 줄(above-the-fold) — 낯선 유저가 승리 조건을 즉시 이해 */}
      <ObjectiveBanner slug={page.slug} />

      {/* 게임(children의 GameOverlay)과 NextRail이 같은 '다음 게임' 픽을 공유 → 승/패 모달의
          '다음 게임' 버튼 + 보드 아래 NextRail이 일관, RUN 카운터 이중 증가 없음(체류 세션연장). */}
      <GameNavProvider slug={page.slug}>
        {framed ? (
          // D8 '밤 정원' 게임판: 게임 컴포넌트 전체를 남보라 판에 올린다. --accent는 여기서 정원 꽃색(--neon-* 재매핑)으로.
          <div data-garden-board style={{ ['--accent' as string]: neon }}>
            {children}
          </div>
        ) : (
          children
        )}

        {/* 게임 바로 아래, 스크롤 없이 보이는 위치 — 리액션은 눈에 띄어야 눌린다(사용자 피드백,
            2026-08-10: "이거 보고 잘 눌를것같지 않은데"). GameSwitcher/GameStats/DailyDock/NextRail
            보다 먼저 둬서 시선이 첫 번째로 닿는 위젯으로 만듦. */}
        <Reactions slug={page.slug} />

        {/* 다음 게임 레일(같은 장르·다른 입력 2장, 광고 없음) — 구 NextUp(5번째 블록)을 대체해 2번째로 승격 */}
        <NextRail />

        {/* 최근 게임 퀵스위처 — 게임 중에도 방금 하던 게임으로 원탭 전환(체류) */}
        <GameSwitcher currentSlug={page.slug} />

        {/* 게임 직후 개인 기록(트로피 케이스) — 데이터 없으면 안 뜸 */}
        <GameStats slug={page.slug} />

        {/* 착지 페이지 리턴 훅: 사이트 streak + 오늘 퀘스트 + 다음 데일리 카운트다운 */}
        <DailyDock />

      </GameNavProvider>

      {/* 공유(Threads·Facebook·KakaoTalk·Instagram·링크 복사) — 유입은 ?ref=share-<채널>로 측정 */}
      <ShareButtons slug={page.slug} title={page.h1} description={page.shortDescription} />

      {hasLeaderboard(page.slug) && <Leaderboard slug={page.slug} />}

      {/* 게임별 익명 댓글 — 리더보드 유무와 무관하게 전 게임 공용(사이트 내장 커뮤니티 Approach A) */}
      <Comments slug={page.slug} />

      {GAME_INTROS[page.slug] && (
        <Reveal>
          <section className="mt-12">
            <SectionHeading garden={framed}>About {page.h1}</SectionHeading>
            <div className="space-y-4 leading-relaxed text-fg-muted">
              {GAME_INTROS[page.slug].split('\n\n').map((para) => (
                <p key={para.slice(0, 32)}>{para}</p>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {(guide || related.length > 0) && (
        <Reveal>
          <section className="mt-8 rounded-xl border border-accent/30 bg-accent/5 p-4" data-testid="game-guides">
            <p className="mb-2 text-sm font-semibold text-fg">Go deeper</p>
            <ul className="space-y-1 text-sm">
              {guide && (
                <li>
                  <Link href={`/guides/${guide.slug}`} className="text-accent hover:underline">
                    📖 {guide.title}
                  </Link>
                </li>
              )}
              {related.map((a) => (
                <li key={a.slug}>
                  <Link href={`/guides/${a.slug}`} className="text-accent hover:underline">
                    {a.kind === 'data' ? '📊' : '✏️'} {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section className="mt-12">
          <SectionHeading garden={framed}>How to play</SectionHeading>
          <ul className="list-disc space-y-2 pl-5 text-fg-muted">
            {page.howToPlay.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-8">
          <SectionHeading garden={framed}>Strategy &amp; tips</SectionHeading>
          <ul className="list-disc space-y-2 pl-5 text-fg-muted">
            {page.strategy.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      </Reveal>

      <Reveal>
        <section className="mt-8">
          <SectionHeading garden={framed}>FAQ</SectionHeading>
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

      {/* 광고 자리 앞 표시(높이 0) — 광고가 꺼져 있을 때 e2e가 광고 위치를 이 아랫변으로 잰다(D11 게임판 ↔ 광고 150px) */}
      <div data-ad-after="game-incontent" aria-hidden="true" />

      {/* 인콘텐츠 광고 자리(승인 전엔 렌더 안 됨) */}
      <AdSlot slot="game-incontent" className="mt-10" />

      <RelatedGames currentSlug={page.slug} room={garden} />
    </main>
  )
}
