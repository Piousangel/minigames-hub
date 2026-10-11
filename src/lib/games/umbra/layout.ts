import { TRACK } from './engine'

/**
 * Width of the exit-marker box drawn at the right end of every lane (Tailwind `w-9`).
 * Its left border is the line the player aims at, so the rendered track must end there:
 * engine x = TRACK has to land on `100cqw - EXIT_MARKER_REM`, not on the lane's far edge.
 */
export const EXIT_MARKER_REM = 2.25

/** Fraction of the track (0 = entrance, 1 = exit marker line) for an engine x. */
export function trackFrac(x: number): number {
  return x / TRACK
}

/**
 * CSS length for an engine x inside a lane (the lane is the size container, so `cqw`
 * resolves against it). `base` lets callers pass a length relative to the lane box
 * (`'%'`-based widths) instead of `cqw` (transforms).
 */
export function trackCss(x: number, base: '100cqw' | '100%' = '100cqw'): string {
  const f = Number(trackFrac(x).toFixed(4))
  return `calc(${f} * (${base} - ${EXIT_MARKER_REM}rem))`
}
