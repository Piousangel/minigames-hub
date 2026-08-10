/**
 * Shared "did this score just become a new personal best" tracker for score-attack
 * games (Breakout, Bubble Shooter, Space Shooter, ...). By the time a game-over event
 * fires, `bestRef.current` has usually already been bumped to the final score in the
 * same tick, so a same-tick `score >= bestRef.current` check can't tell "just beat it"
 * from "already was the best" — callers must use the boolean this function returns at
 * the moment the update happens, not re-derive it later from state.
 */
export function updateBestScore(
  score: number,
  bestRef: { current: number },
  storageKey: string,
  setBest: (n: number) => void,
): boolean {
  if (score > 0 && score > bestRef.current) {
    bestRef.current = score
    try {
      localStorage.setItem(storageKey, String(score))
    } catch {
      // Quota exceeded / storage disabled — the score still counts for this
      // session, it just won't survive a reload. Callers run this inside a
      // requestAnimationFrame loop, so a thrown exception here would kill the
      // loop outright (never reschedules the next frame) — must not propagate.
    }
    setBest(score)
    return true
  }
  return false
}
