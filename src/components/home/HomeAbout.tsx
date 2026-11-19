import Link from 'next/link'
import { Mascot } from '@/components/Mascot'
import { siteConfig } from '@/lib/siteConfig'
import { contentBySlug } from '@/content'

/** "From the guides" 3편 — 실제 /guides/<slug> 페이지(src/content). 없어지면 빌드 전 테스트가 잡는다. */
export const HOME_GUIDE_SLUGS = ['2048', 'minesweeper', 'word-guess-best-opening-words'] as const

const link = 'font-semibold underline decoration-garden-ink/40 decoration-2 underline-offset-[3px] hover:text-garden-coral-text'

/**
 * 홈 편집 블록 "About this garden"(리디자인 v2 R4, 리뷰 B5: 심사자가 착지하는 홈의 고유 문장).
 * 사이트 목적·만든 방식·오리지널·데일리·무료·개인정보 최소를 사실만으로 120~200단어. 수(게임·데일리)는 계산값(D4).
 * 개인정보 문장은 /privacy와 같은 사실만 — 기록은 브라우저 안, 서버로는 익명 사용 통계만, 계정 없음.
 * 예전 HomeAbout(다크 네온)의 내용을 줄여 다듬었다.
 * R6: 머리에 안내자 해씨(등불) 96px. 바로 아래가 광고 1(home-about)이라 해씨와 400px 이상(D6)이 되게 1024+에서도 한 단
 * (본문 720px + 가이드 3칸 줄) — 예전 두 단(본문 | 가이드 360px)은 1440에서 블록 높이가 430px뿐이라 거리가 292px였다.
 */
export function HomeAbout({ gameCount, dailyCount }: { gameCount: number; dailyCount: number }) {
  const guides = HOME_GUIDE_SLUGS.map((slug) => contentBySlug(slug)).filter((c) => c != null)
  return (
    <section aria-labelledby="about-site" className="font-ui grid gap-8 text-garden-ink lg:gap-10">
      <div data-testid="home-about" className="max-w-[720px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] leading-4 font-semibold text-garden-coral-text">About {siteConfig.name}</p>
            <h2 id="about-site" className="font-display mt-1 text-[24px] leading-[30px] font-semibold tracking-[-0.015em]">
              About <em className="font-display-italic italic">this garden</em>
            </h2>
          </div>
          {/* 안내자 해씨(등불, D5 '안내') 96px — 이 블록 머리. 광고 1(About 아래)과 400px 이상(D6) */}
          <Mascot art="haessi-guide" size={96} className="home-about__guide -mb-1" />
        </div>
        <div data-testid="home-about-body" className="mt-3 space-y-3 text-[16px] leading-[26px] text-garden-ink-deep">
          <p>
            {siteConfig.name} is a small garden of {gameCount} free games that run in your browser. There is nothing to
            download and no account to make: open a page and the game is ready, on a phone or a computer.
          </p>
          <p>
            Every game here was designed and coded for this site instead of being embedded from somewhere else, so each
            one loads quickly and is tuned for both touch and keyboard. Three originals,{' '}
            <Link href="/slime-slide" className={link}>
              Slime Slide
            </Link>
            ,{' '}
            <Link href="/plop-landing" className={link}>
              Plop Landing
            </Link>{' '}
            and{' '}
            <Link href="/acorn-hop" className={link}>
              Acorn Hop
            </Link>
            , grow in today’s sunset garden on this page, and {dailyCount}{' '}
            <Link href="/daily" className={link}>
              daily games
            </Link>{' '}
            give everyone the same fresh puzzle each day.
          </p>
          <p>
            Everything is free. Your scores, streaks and favorites stay in your own browser. The site has no accounts:
            apart from scores or comments you choose to post, it sends only anonymous usage events, with no name or
            email, to its own server — the{' '}
            <Link href="/privacy" className={link}>
              privacy page
            </Link>{' '}
            lists exactly what is kept. Weekly{' '}
            <Link href="/leaderboards" className={link}>
              leaderboards
            </Link>{' '}
            are there when you want them, and new games are planted regularly.
          </p>
        </div>
      </div>

      <div>
        <p className="text-[12px] leading-4 font-semibold text-garden-coral-text">Read before you play</p>
        <h2 className="font-display mt-1 text-[24px] leading-[30px] font-semibold tracking-[-0.015em]">
          From <em className="font-display-italic italic">the guides</em>
        </h2>
        <ul className="mt-3 grid border-t-2 border-garden-ink lg:grid-cols-3 lg:gap-x-6" data-testid="home-guides">
          {guides.map((g) => (
            <li key={g.entry.slug} className="border-b border-[#c4a27c]">
              <Link
                href={`/guides/${g.entry.slug}`}
                className="flex min-h-[56px] items-center py-2 text-[15px] leading-[21px] font-semibold hover:text-garden-coral-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-ink"
              >
                {g.entry.title}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/guides"
          className="mt-1 inline-flex min-h-11 items-center text-[14px] font-semibold underline decoration-garden-ink/40 decoration-2 underline-offset-[3px] hover:text-garden-coral-text"
        >
          All guides and articles
        </Link>
      </div>
    </section>
  )
}
