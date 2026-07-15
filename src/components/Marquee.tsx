/**
 * Marquee — thin auto-scrolling arcade ticker (pixel font, neon).
 *
 * The band is decorative (aria-hidden). Content is duplicated so the CSS
 * transform loop (translateX 0 → -50%) is seamless. Motion is disabled under
 * prefers-reduced-motion (see globals.css) — it then renders as a static band.
 */
import { gamePages } from '@/lib/games/registry'

const ITEMS = [
  `${gamePages.length} GAMES`,
  '100% FREE',
  'NO SIGN-UP',
  'PLAY INSTANTLY',
] as const

function Group() {
  return (
    <div className="marquee-group flex shrink-0 items-center">
      {ITEMS.map((item) => (
        <span
          key={item}
          className="font-pixel flex items-center gap-3 px-6 text-[10px] tracking-[0.25em] sm:text-xs"
        >
          <span aria-hidden="true">▸</span>
          {item}
        </span>
      ))}
    </div>
  )
}

export function Marquee() {
  return (
    <div
      aria-hidden="true"
      className="marquee neon-text my-8 border-y border-border/70 py-2 text-neon-cyan"
    >
      <div className="marquee-track">
        <Group />
        <Group />
      </div>
    </div>
  )
}
