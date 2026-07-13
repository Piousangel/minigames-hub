import type { Metadata } from 'next'
import { ProsePage } from '@/components/ProsePage'
import { siteConfig } from '@/lib/siteConfig'

export const metadata: Metadata = { title: 'About', alternates: { canonical: '/about' } }

export default function AboutPage() {
  return (
    <ProsePage title={`About ${siteConfig.name}`}>
      <p>
        {siteConfig.name} is a collection of free browser games you can play instantly — no downloads,
        no installs, and no account required. Every game on this site is built by hand to load fast,
        work great on both desktop and mobile, and respect your time.
      </p>
      <p>
        We focus on classic puzzle and arcade games that are easy to learn but hard to master: number
        merge puzzles, snake, minesweeper, memory games, and more. Each game page also includes clear
        rules, practical strategy tips, and answers to common questions.
      </p>
      <p>
        New games and game variants are added regularly. If you have a suggestion or found a bug,
        we would love to hear from you on the <a href="/contact" className="text-accent">contact page</a>.
      </p>
    </ProsePage>
  )
}
