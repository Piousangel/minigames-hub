import { describe, it, expect } from 'vitest'
import { RATE_LIMIT_PRUNE_AGE_MS, rateLimitPruneCutoff, shouldPruneRateLimits } from './rateLimitPrune'
import { COMMENT_RATE_LIMIT_MS } from './comments'
import { SCORE_RATE_LIMIT_MS } from './leaderboard'

describe('comment_rate_limits pruning', () => {
  it('only prunes rows older than every cooldown (pruned row ≡ absent row ⇒ UPSERT semantics unchanged)', () => {
    expect(RATE_LIMIT_PRUNE_AGE_MS).toBeGreaterThanOrEqual(COMMENT_RATE_LIMIT_MS)
    expect(RATE_LIMIT_PRUNE_AGE_MS).toBeGreaterThanOrEqual(SCORE_RATE_LIMIT_MS)
  })

  it('cutoff is now minus one day', () => {
    expect(rateLimitPruneCutoff(1_000_000_000_000)).toBe(1_000_000_000_000 - 86_400_000)
  })

  it('prunes on roughly 1% of calls', () => {
    expect(shouldPruneRateLimits(() => 0)).toBe(true)
    expect(shouldPruneRateLimits(() => 0.0099)).toBe(true)
    expect(shouldPruneRateLimits(() => 0.01)).toBe(false)
    expect(shouldPruneRateLimits(() => 0.5)).toBe(false)
  })
})
