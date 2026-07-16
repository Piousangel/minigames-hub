import type { Metadata } from 'next'
import Link from 'next/link'
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
        We focus on puzzle and arcade games that are easy to learn but hard to master — from classics
        like number-merge puzzles, snake, and minesweeper to original games you won&apos;t find
        anywhere else. Many games have online leaderboards so you can compete for a weekly high score.
        Each game page also includes clear rules, practical strategy tips, and answers to common
        questions.
      </p>
      <p>
        {siteConfig.name} is built and maintained by an indie developer who goes by{' '}
        <strong>Pious Angel</strong>. New games are added regularly. If you have a suggestion or found
        a bug, I would love to hear from you on the{' '}
        <Link href="/contact" className="text-accent">contact page</Link>.
      </p>
    </ProsePage>
  )
}
