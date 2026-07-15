'use client'

import Link from 'next/link'
import { useRef, type PointerEvent, type ReactNode } from 'react'

/**
 * SpotlightCard — the signature "spotlight" game card.
 *
 * On hover a soft radial glow in the card's neon accent follows the pointer:
 * we update the `--mx` / `--my` CSS custom properties (throttled to one rAF per
 * frame) and a `::before` radial-gradient (see globals.css) reads them.
 *
 * The glow itself is gated in CSS behind `@media (hover: hover) and
 * (pointer: fine)` and behind prefers-reduced-motion, so touch devices and
 * reduced-motion users get no glow — the pointer handler is a cheap no-op there.
 *
 * Content (icon, title, description, link) is passed as children and rendered on
 * the server, so the accessible link name and SEO text stay in the SSR HTML.
 */
export function SpotlightCard({
  href,
  accent,
  children,
}: {
  href: string
  accent: string
  children: ReactNode
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const frame = useRef<number | null>(null)

  function handlePointerMove(event: PointerEvent<HTMLAnchorElement>) {
    if (frame.current != null) return // throttle: one update per animation frame
    const { clientX, clientY } = event
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100
      el.style.setProperty('--mx', `${x}%`)
      el.style.setProperty('--my', `${y}%`)
    })
  }

  return (
    <Link
      ref={ref}
      href={href}
      style={{ color: accent }}
      onPointerMove={handlePointerMove}
      className="spotlight-card neon-box neon-box-hover group relative flex h-full flex-col gap-2 overflow-hidden rounded-xl border border-border bg-surface/80 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      {children}
    </Link>
  )
}
