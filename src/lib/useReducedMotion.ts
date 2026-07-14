'use client'

import { useEffect, useRef, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Tracks the user's `prefers-reduced-motion` setting.
 *
 * Returns both a reactive boolean (for render) and a ref (for reading the
 * latest value inside event handlers / timers without re-subscribing).
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  const ref = useRef(false)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const update = () => {
      ref.current = mql.matches
      setReduced(mql.matches)
    }
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return { reduced, reducedRef: ref }
}
