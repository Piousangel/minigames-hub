import { describe, expect, it } from 'vitest'
import {
  COST_GROWTH,
  MAX_SCORE,
  MODULES,
  PRESTIGE_THRESHOLD,
  buy,
  canPrestige,
  costOf,
  fmt,
  initialState,
  nextCost,
  offlineGain,
  prestige,
  prestigeMultiplier,
  productionPerSec,
  score,
  tap,
  tapGain,
  tick,
  type State,
} from './engine'

describe('initialState', () => {
  it('starts empty and deterministic', () => {
    const s = initialState()
    expect(s.charge).toBe(0)
    expect(s.lifetime).toBe(0)
    expect(s.prestige).toBe(0)
    expect(s.tapPower).toBe(1)
    expect(s.levels).toEqual(MODULES.map(() => 0))
    expect(s.levels).toHaveLength(6)
  })

  it('returns independent instances (no shared arrays)', () => {
    const a = initialState()
    const b = initialState()
    a.levels[0] = 5
    expect(b.levels[0]).toBe(0)
  })
})

describe('MODULES config', () => {
  it('is an ordered 6-tier ladder of rising cost and rate', () => {
    expect(MODULES).toHaveLength(6)
    for (let i = 1; i < MODULES.length; i++) {
      expect(MODULES[i].baseCost).toBeGreaterThan(MODULES[i - 1].baseCost)
      expect(MODULES[i].baseRate).toBeGreaterThan(MODULES[i - 1].baseRate)
    }
  })
})

describe('costOf', () => {
  it('equals baseCost at level 0', () => {
    for (const m of MODULES) expect(costOf(m, 0)).toBe(m.baseCost)
  })

  it('grows by ×1.15 per level (ceil)', () => {
    const m = MODULES[0] // baseCost 10
    expect(costOf(m, 0)).toBe(10)
    expect(costOf(m, 1)).toBe(Math.ceil(10 * COST_GROWTH))
    expect(costOf(m, 2)).toBe(Math.ceil(10 * COST_GROWTH ** 2))
    expect(costOf(m, 1)).toBe(12) // ceil(11.5)
  })

  it('is monotonically increasing with level', () => {
    const m = MODULES[2]
    let prev = 0
    for (let lvl = 0; lvl < 30; lvl++) {
      const c = costOf(m, lvl)
      expect(c).toBeGreaterThan(prev)
      prev = c
    }
  })

  it('nextCost reflects the current owned level', () => {
    const s = initialState()
    expect(nextCost(s, 1)).toBe(MODULES[1].baseCost)
    s.levels[1] = 3
    expect(nextCost(s, 1)).toBe(costOf(MODULES[1], 3))
  })
})

describe('prestigeMultiplier', () => {
  it('is 1 with no reboots and +10% per reboot', () => {
    expect(prestigeMultiplier(initialState())).toBe(1)
    expect(prestigeMultiplier({ ...initialState(), prestige: 1 })).toBeCloseTo(1.1)
    expect(prestigeMultiplier({ ...initialState(), prestige: 5 })).toBeCloseTo(1.5)
  })
})

describe('productionPerSec', () => {
  it('is 0 with no modules', () => {
    expect(productionPerSec(initialState())).toBe(0)
  })

  it('sums level*rate across tiers', () => {
    const s: State = { ...initialState(), levels: [2, 1, 0, 0, 0, 0] }
    // 2*0.1 + 1*1 = 1.2
    expect(productionPerSec(s)).toBeCloseTo(1.2)
  })

  it('applies the prestige multiplier to the whole sum', () => {
    const s: State = { ...initialState(), levels: [0, 3, 0, 0, 0, 0], prestige: 2 }
    // 3*1 * (1 + 2*0.1) = 3 * 1.2 = 3.6
    expect(productionPerSec(s)).toBeCloseTo(3.6)
  })
})

describe('tap', () => {
  it('adds tapPower to charge and lifetime', () => {
    const s = tap(initialState())
    expect(s.charge).toBe(1)
    expect(s.lifetime).toBe(1)
  })

  it('scales with tapPower and prestige multiplier', () => {
    const s: State = { ...initialState(), tapPower: 3, prestige: 1 }
    expect(tapGain(s)).toBeCloseTo(3.3)
    const t = tap(s)
    expect(t.charge).toBeCloseTo(3.3)
    expect(t.lifetime).toBeCloseTo(3.3)
  })

  it('is pure — does not mutate input', () => {
    const s = initialState()
    tap(s)
    expect(s.charge).toBe(0)
  })
})

describe('tick', () => {
  it('accrues exactly rate*seconds', () => {
    const s: State = { ...initialState(), levels: [0, 10, 0, 0, 0, 0] } // 10/sec
    const t = tick(s, 3000)
    expect(t.charge).toBeCloseTo(30)
    expect(t.lifetime).toBeCloseTo(30)
  })

  it('accrues fractional seconds precisely', () => {
    const s: State = { ...initialState(), levels: [5, 0, 0, 0, 0, 0] } // 0.5/sec
    const t = tick(s, 250) // 0.25s → 0.125
    expect(t.charge).toBeCloseTo(0.125)
  })

  it('adds nothing when production is 0', () => {
    const s = initialState()
    const t = tick(s, 100000)
    expect(t).toBe(s) // same ref
    expect(t.charge).toBe(0)
  })

  it('adds nothing for non-positive elapsed', () => {
    const s: State = { ...initialState(), levels: [0, 1, 0, 0, 0, 0] }
    expect(tick(s, 0)).toBe(s)
    expect(tick(s, -500)).toBe(s)
  })

  it('is pure — does not mutate input', () => {
    const s: State = { ...initialState(), levels: [0, 1, 0, 0, 0, 0] }
    tick(s, 1000)
    expect(s.charge).toBe(0)
  })
})

describe('buy', () => {
  it('subtracts cost and increments the level when affordable', () => {
    const s: State = { ...initialState(), charge: 50 }
    const b = buy(s, 0) // cost 10
    expect(b.charge).toBe(40)
    expect(b.levels[0]).toBe(1)
  })

  it('is a no-op (same ref) when broke', () => {
    const s: State = { ...initialState(), charge: 5 }
    const b = buy(s, 0) // cost 10
    expect(b).toBe(s)
    expect(b.levels[0]).toBe(0)
  })

  it('is a no-op for out-of-range indices', () => {
    const s: State = { ...initialState(), charge: 1e9 }
    expect(buy(s, -1)).toBe(s)
    expect(buy(s, 99)).toBe(s)
  })

  it('escalates the price of the same module across buys', () => {
    let s: State = { ...initialState(), charge: 1000 }
    s = buy(s, 0) // pay 10 → charge 990, level 1
    expect(s.levels[0]).toBe(1)
    s = buy(s, 0) // pay 12 → charge 978, level 2
    expect(s.charge).toBe(978)
    expect(s.levels[0]).toBe(2)
  })

  it('is pure — does not mutate input levels', () => {
    const s: State = { ...initialState(), charge: 50 }
    buy(s, 0)
    expect(s.levels[0]).toBe(0)
    expect(s.charge).toBe(50)
  })
})

describe('canPrestige / prestige', () => {
  it('is locked below the threshold', () => {
    expect(canPrestige({ ...initialState(), lifetime: PRESTIGE_THRESHOLD - 1 })).toBe(false)
  })

  it('is unlocked at/above the threshold', () => {
    expect(canPrestige({ ...initialState(), lifetime: PRESTIGE_THRESHOLD })).toBe(true)
    expect(canPrestige({ ...initialState(), lifetime: PRESTIGE_THRESHOLD * 3 })).toBe(true)
  })

  it('resets charge & levels, bumps prestige + tapPower, keeps lifetime', () => {
    const s: State = {
      charge: 5000,
      lifetime: PRESTIGE_THRESHOLD * 2,
      levels: [4, 3, 2, 1, 0, 0],
      prestige: 1,
      tapPower: 2,
    }
    const p = prestige(s)
    expect(p.charge).toBe(0)
    expect(p.levels).toEqual([0, 0, 0, 0, 0, 0])
    expect(p.prestige).toBe(2)
    expect(p.tapPower).toBe(3)
    expect(p.lifetime).toBe(PRESTIGE_THRESHOLD * 2) // kept
  })

  it('raises the production multiplier after reboot', () => {
    const before: State = { ...initialState(), lifetime: PRESTIGE_THRESHOLD, prestige: 0 }
    const after = prestige(before)
    expect(prestigeMultiplier(after)).toBeCloseTo(1.1)
  })

  it('is a no-op (same ref) when locked', () => {
    const s: State = { ...initialState(), lifetime: 10 }
    expect(prestige(s)).toBe(s)
  })
})

describe('offlineGain', () => {
  it('accrues production over elapsed when under the cap', () => {
    const s: State = { ...initialState(), levels: [0, 2, 0, 0, 0, 0] } // 2/sec
    expect(offlineGain(s, 5000, 60000)).toBeCloseTo(10)
  })

  it('caps elapsed at capMs', () => {
    const s: State = { ...initialState(), levels: [0, 1, 0, 0, 0, 0] } // 1/sec
    const cap = 8 * 3600 * 1000 // 8h
    // 100 hours elapsed → only 8h counted → 8*3600 = 28800
    expect(offlineGain(s, 100 * 3600 * 1000, cap)).toBeCloseTo(28800)
  })

  it('is 0 with no production', () => {
    expect(offlineGain(initialState(), 999999, 8e7)).toBe(0)
  })

  it('never returns negative for weird elapsed', () => {
    const s: State = { ...initialState(), levels: [0, 1, 0, 0, 0, 0] }
    expect(offlineGain(s, -5000, 60000)).toBe(0)
  })

  it('matches what a same-clamped tick would apply', () => {
    const s: State = { ...initialState(), levels: [3, 2, 0, 0, 0, 0] }
    const gain = offlineGain(s, 4000, 8000)
    const ticked = tick(s, 4000)
    expect(ticked.charge - s.charge).toBeCloseTo(gain)
  })
})

describe('score', () => {
  it('is a non-negative integer', () => {
    const s = score({ ...initialState(), lifetime: 1234.9 })
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBe(1234)
  })

  it('is monotonic in lifetime (same prestige)', () => {
    const a = score({ ...initialState(), lifetime: 500 })
    const b = score({ ...initialState(), lifetime: 900 })
    expect(b).toBeGreaterThanOrEqual(a)
  })

  it('rewards prestige', () => {
    const a = score({ ...initialState(), lifetime: PRESTIGE_THRESHOLD, prestige: 0 })
    const b = score({ ...initialState(), lifetime: PRESTIGE_THRESHOLD, prestige: 1 })
    expect(b).toBeGreaterThan(a)
  })

  it('caps at MAX_SCORE', () => {
    const s = score({ ...initialState(), lifetime: 1e12, prestige: 50 })
    expect(s).toBe(MAX_SCORE)
  })
})

describe('fmt', () => {
  it('formats plain numbers under 1000', () => {
    expect(fmt(0)).toBe('0')
    expect(fmt(7)).toBe('7')
    expect(fmt(999)).toBe('999')
    expect(fmt(48.7)).toBe('48')
  })

  it('formats K / M / B', () => {
    expect(fmt(1200)).toBe('1.2K')
    expect(fmt(48200)).toBe('48.2K')
    expect(fmt(3_400_000)).toBe('3.4M')
    expect(fmt(5_600_000_000)).toBe('5.6B')
  })

  it('drops trailing .0 and rounds ≥100 without decimals', () => {
    expect(fmt(1000)).toBe('1K')
    expect(fmt(250_000)).toBe('250K')
  })

  it('handles negatives and non-finite input', () => {
    expect(fmt(-1500)).toBe('-1.5K')
    expect(fmt(NaN)).toBe('0')
    expect(fmt(Infinity)).toBe('0')
  })
})

describe('golden: initial → 10 taps → buy Capacitor → 5s tick', () => {
  it('reaches known charge/lifetime/production', () => {
    let s = initialState()
    for (let i = 0; i < 10; i++) s = tap(s) // +1 each → charge 10, lifetime 10
    expect(s.charge).toBe(10)
    expect(s.lifetime).toBe(10)

    s = buy(s, 0) // Capacitor cost 10 → charge 0, level 1
    expect(s.charge).toBe(0)
    expect(s.levels[0]).toBe(1)
    expect(productionPerSec(s)).toBeCloseTo(0.1)

    s = tick(s, 5000) // +0.1*5 = 0.5
    expect(s.charge).toBeCloseTo(0.5)
    expect(s.lifetime).toBeCloseTo(10.5)
  })
})

describe('golden: multi-tier production with prestige', () => {
  it('computes a known compound production', () => {
    const s: State = { ...initialState(), levels: [10, 5, 2, 0, 0, 0], prestige: 3 }
    // base = 10*0.1 + 5*1 + 2*8 = 1 + 5 + 16 = 22; ×(1+0.3) = 28.6
    expect(productionPerSec(s)).toBeCloseTo(28.6)
    const t = tick(s, 10000) // +286
    expect(t.charge).toBeCloseTo(286)
  })
})
