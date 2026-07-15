'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Reveal — staggered scroll-in entrance (fade + slide-up) via IntersectionObserver.
 *
 * Progressive enhancement: the wrapper renders `data-reveal` with NO hidden
 * styles of its own. The hidden→visible entrance is expressed purely in CSS,
 * gated behind `.has-js` (added before first paint by an inline script in the
 * layout). So no-JS visitors and crawlers always receive fully visible content;
 * only JS-capable browsers get the animated entrance.
 *
 * Once revealed the element stays revealed and its observer disconnects.
 * Respects prefers-reduced-motion (reveals immediately, and CSS forces visible).
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  /** stagger offset in ms (applied as transition-delay) */
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            observer.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-reveal=""
      data-shown={shown ? 'true' : 'false'}
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
