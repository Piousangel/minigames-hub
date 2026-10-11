import { describe, it, expect } from 'vitest'
import {
  BANK,
  GROUP_COUNT,
  GROUP_SIZE,
  LIVES_START,
  createGame,
  dailySeed,
  generateGame,
  groupOfItem,
  mistakes,
  mulberry32,
  pickGroups,
  reduce,
  rotateTiles,
  score,
  type ClustersState,
  type Group,
} from './engine'

// -- helpers -----------------------------------------------------------------

/** Submit a full group by name, from any state where its 4 items are on the board. */
function solveGroupByName(state: ClustersState, name: string): ClustersState {
  const g = state.groups.find((x) => x.name === name)!
  // A wrong guess leaves its selection in place, so start from a clean slate.
  let s = reduce(state, { type: 'deselect' })
  for (const item of g.items) s = reduce(s, { type: 'select', item })
  return reduce(s, { type: 'submit' })
}

const SEED = 12345

/** Four DISTINCT wrong guesses for SEED (a repeated guess no longer costs a life). */
const DISTINCT_WRONG: string[][] = [
  ['Fork', 'Knife', 'Africa', 'Asia'],
  ['Fork', 'Knife', 'Tango', 'Waltz'],
  ['Fork', 'Knife', 'Lysine', 'Glycine'],
  ['Africa', 'Asia', 'Tango', 'Waltz'],
]

function submitGuess(state: ClustersState, items: string[]): ClustersState {
  let s = reduce(state, { type: 'deselect' })
  for (const item of items) s = reduce(s, { type: 'select', item })
  return reduce(s, { type: 'submit' })
}

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('produces floats in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 200; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)())
  })
})

describe('dailySeed', () => {
  it('is deterministic and stable per date string', () => {
    expect(dailySeed('2026-07-19')).toBe(dailySeed('2026-07-19'))
  })

  it('differs across dates', () => {
    expect(dailySeed('2026-07-19')).not.toBe(dailySeed('2026-07-20'))
  })

  it('returns a 32-bit unsigned integer', () => {
    const v = dailySeed('2026-01-01')
    expect(Number.isInteger(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(0xffffffff)
  })
})

describe('BANK', () => {
  it('has at least 40 groups', () => {
    expect(BANK.length).toBeGreaterThanOrEqual(40)
  })

  it('every group has exactly 4 items and a valid tier', () => {
    for (const g of BANK) {
      expect(g.items).toHaveLength(GROUP_SIZE)
      expect([0, 1, 2, 3]).toContain(g.tier)
      expect(g.name.length).toBeGreaterThan(0)
    }
  })

  it('covers all four tiers with several groups each', () => {
    for (const tier of [0, 1, 2, 3]) {
      const n = BANK.filter((g) => g.tier === tier).length
      expect(n).toBeGreaterThanOrEqual(4)
    }
  })

  it('has no duplicate items within any single group', () => {
    for (const g of BANK) {
      expect(new Set(g.items).size).toBe(GROUP_SIZE)
    }
  })
})

describe('generateGame', () => {
  it('produces exactly 4 groups and 16 distinct tiles', () => {
    const s = createGame(SEED)
    expect(s.groups).toHaveLength(GROUP_COUNT)
    expect(s.tiles).toHaveLength(GROUP_COUNT * GROUP_SIZE)
    expect(new Set(s.tiles).size).toBe(16)
  })

  it('chosen groups never share an item (no duplicate tile)', () => {
    for (let seed = 0; seed < 300; seed++) {
      const s = createGame(seed)
      expect(new Set(s.tiles).size).toBe(16)
      // every tile maps to exactly one chosen group
      for (const t of s.tiles) {
        const owners = s.groups.filter((g) => g.items.includes(t))
        expect(owners).toHaveLength(1)
      }
    }
  })

  it('prefers one group per tier when possible', () => {
    // With a rich bank this holds for essentially every seed.
    let allFourTiers = 0
    for (let seed = 0; seed < 100; seed++) {
      const tiers = new Set(createGame(seed).groups.map((g) => g.tier))
      if (tiers.size === 4) allFourTiers++
    }
    expect(allFourTiers).toBe(100)
  })

  it('groups are returned sorted by tier ascending', () => {
    for (let seed = 0; seed < 50; seed++) {
      const tiers = createGame(seed).groups.map((g) => g.tier)
      const sorted = [...tiers].sort((a, b) => a - b)
      expect(tiers).toEqual(sorted)
    }
  })

  it('is deterministic: same seed → identical board', () => {
    expect(createGame(SEED)).toEqual(createGame(SEED))
  })

  it('consumes rng only in generation (createGame twice with fresh rng matches)', () => {
    const a = generateGame(mulberry32(999), 999)
    const b = generateGame(mulberry32(999), 999)
    expect(a).toEqual(b)
  })

  it('starts with full lives, empty selection, playing status', () => {
    const s = createGame(SEED)
    expect(s.lives).toBe(LIVES_START)
    expect(s.selected).toEqual([])
    expect(s.solved).toEqual([])
    expect(s.status).toBe('playing')
    expect(s.guessRows).toEqual([])
    expect(s.lastResult).toBe('none')
  })
})

describe('GOLDEN seed 12345', () => {
  const s = createGame(SEED)

  it('picks a fixed set of groups (one per tier)', () => {
    expect(s.groups.map((g) => [g.name, g.tier])).toEqual([
      ['Kitchen tools', 0],
      ['Continents', 1],
      ['Ballroom dances', 2],
      ['Amino acids', 3],
    ])
  })

  it('lays out a fixed shuffled tile order', () => {
    expect(s.tiles).toEqual([
      'Knife',
      'Serine',
      'Fork',
      'Samba',
      'Glycine',
      'Plate',
      'Europe',
      'Antarctica',
      'Valine',
      'Africa',
      'Lysine',
      'Foxtrot',
      'Waltz',
      'Spoon',
      'Asia',
      'Tango',
    ])
  })

  it('first solve: Kitchen tools locks in and clears from the board', () => {
    const solved = solveGroupByName(s, 'Kitchen tools')
    expect(solved.lastResult).toBe('correct')
    expect(solved.solved.map((g) => g.name)).toEqual(['Kitchen tools'])
    expect(solved.tiles).toHaveLength(12)
    expect(solved.tiles).not.toContain('Fork')
    expect(solved.tiles).not.toContain('Plate')
    expect(solved.guessRows).toEqual([[0, 0, 0, 0]])
    expect(solved.lives).toBe(LIVES_START)
  })
})

describe('select', () => {
  const s = createGame(SEED)

  it('adds an item to the selection', () => {
    const n = reduce(s, { type: 'select', item: 'Fork' })
    expect(n.selected).toEqual(['Fork'])
  })

  it('toggles an already-selected item off', () => {
    let n = reduce(s, { type: 'select', item: 'Fork' })
    n = reduce(n, { type: 'select', item: 'Fork' })
    expect(n.selected).toEqual([])
  })

  it('caps the selection at 4 (5th select is a no-op)', () => {
    let n = s
    for (const it of ['Knife', 'Serine', 'Fork', 'Samba']) n = reduce(n, { type: 'select', item: it })
    expect(n.selected).toHaveLength(4)
    const capped = reduce(n, { type: 'select', item: 'Glycine' })
    expect(capped.selected).toHaveLength(4)
    expect(capped.selected).not.toContain('Glycine')
  })

  it('ignores an item not on the board', () => {
    const n = reduce(s, { type: 'select', item: 'NotAnItem' })
    expect(n.selected).toEqual([])
  })

  it('deselect clears the whole selection', () => {
    let n = reduce(s, { type: 'select', item: 'Fork' })
    n = reduce(n, { type: 'select', item: 'Knife' })
    n = reduce(n, { type: 'deselect' })
    expect(n.selected).toEqual([])
  })
})

describe('submit', () => {
  it('requires exactly 4 selected (no-op otherwise)', () => {
    const s = createGame(SEED)
    let n = reduce(s, { type: 'select', item: 'Fork' })
    n = reduce(n, { type: 'submit' })
    expect(n.guessRows).toHaveLength(0)
    expect(n.lives).toBe(LIVES_START)
  })

  it('correct guess locks the group and does not cost a life', () => {
    const s = createGame(SEED)
    const n = solveGroupByName(s, 'Continents')
    expect(n.lastResult).toBe('correct')
    expect(n.lives).toBe(LIVES_START)
    expect(n.solved.map((g) => g.name)).toEqual(['Continents'])
    expect(n.selected).toEqual([])
  })

  it('wrong guess costs a life and records the guessed tiers', () => {
    const s = createGame(SEED)
    // 2 kitchen + 2 continents = wrong, not one-away
    let n = s
    for (const it of ['Fork', 'Knife', 'Africa', 'Asia']) n = reduce(n, { type: 'select', item: it })
    n = reduce(n, { type: 'submit' })
    expect(n.lastResult).toBe('wrong')
    expect(n.lives).toBe(LIVES_START - 1)
    expect(n.guessRows).toHaveLength(1)
    expect(n.guessRows[0]).toHaveLength(4)
    // tiers present: two tier-0 (kitchen) and two tier-1 (continents)
    expect(n.guessRows[0].filter((t) => t === 0)).toHaveLength(2)
    expect(n.guessRows[0].filter((t) => t === 1)).toHaveLength(2)
  })

  it('"one away": exactly 3 of one group sets lastResult one-away', () => {
    const s = createGame(SEED)
    let n = s
    // 3 kitchen tools + 1 continent
    for (const it of ['Fork', 'Knife', 'Plate', 'Africa']) n = reduce(n, { type: 'select', item: it })
    n = reduce(n, { type: 'submit' })
    expect(n.lastResult).toBe('one-away')
    expect(n.lives).toBe(LIVES_START - 1)
  })

  it('ignores submit after the game is over', () => {
    const s = createGame(SEED)
    let n = s
    // lose all four lives with wrong guesses
    for (const wrong of DISTINCT_WRONG) n = submitGuess(n, wrong)
    expect(n.status).toBe('lost')
    const after = reduce(n, { type: 'select', item: 'Fork' })
    expect(after.selected).toEqual([])
    expect(after).toEqual({ ...n }) // select is a no-op once lost
  })
})

describe('win / lose', () => {
  it('solving all four groups wins', () => {
    let s = createGame(SEED)
    for (const g of s.groups) s = solveGroupByName(s, g.name)
    expect(s.status).toBe('won')
    expect(s.solved).toHaveLength(4)
    expect(s.tiles).toHaveLength(0)
  })

  it('four mistakes loses', () => {
    let s = createGame(SEED)
    for (const wrong of DISTINCT_WRONG) s = submitGuess(s, wrong)
    expect(s.status).toBe('lost')
    expect(s.lives).toBe(0)
    expect(mistakes(s)).toBe(4)
  })

  it('records one guessRow per submitted guess', () => {
    let s = createGame(SEED)
    s = solveGroupByName(s, 'Kitchen tools')
    // one wrong guess
    for (const it of ['Africa', 'Asia', 'Tango', 'Waltz']) s = reduce(s, { type: 'select', item: it })
    s = reduce(s, { type: 'submit' })
    expect(s.guessRows).toHaveLength(2)
  })
})

describe('shuffle', () => {
  it('keeps the same set of tiles but reorders them', () => {
    const s = createGame(SEED)
    const n = reduce(s, { type: 'shuffle' })
    expect(new Set(n.tiles)).toEqual(new Set(s.tiles))
    expect(n.tiles).not.toEqual(s.tiles)
  })

  it('is pure/deterministic', () => {
    const s = createGame(SEED)
    expect(reduce(s, { type: 'shuffle' })).toEqual(reduce(s, { type: 'shuffle' }))
  })

  it('rotateTiles handles small arrays', () => {
    expect(rotateTiles([])).toEqual([])
    expect(rotateTiles(['a'])).toEqual(['a'])
  })

  it('preserves the current selection across a shuffle', () => {
    let s = createGame(SEED)
    s = reduce(s, { type: 'select', item: 'Fork' })
    const n = reduce(s, { type: 'shuffle' })
    expect(n.selected).toEqual(['Fork'])
  })
})

describe('new / reset', () => {
  it('reset rebuilds the same board from the stored seed', () => {
    let s = createGame(SEED)
    s = reduce(s, { type: 'select', item: 'Fork' })
    const r = reduce(s, { type: 'reset' })
    expect(r).toEqual(createGame(SEED))
  })

  it('new builds a board from a fresh seed', () => {
    const s = createGame(SEED)
    const n = reduce(s, { type: 'new', seed: 777 })
    expect(n).toEqual(createGame(777))
  })
})

describe('score', () => {
  it('is 0 before any progress', () => {
    expect(score(createGame(SEED))).toBe(0)
  })

  it('increases monotonically as groups are solved (pre-win)', () => {
    let s = createGame(SEED)
    const order = ['Kitchen tools', 'Continents', 'Ballroom dances']
    let last = score(s)
    expect(last).toBe(0)
    for (const name of order) {
      s = solveGroupByName(s, name)
      const cur = score(s)
      expect(cur).toBeGreaterThan(last)
      last = cur
    }
    // 3 solved, not yet won
    expect(s.status).toBe('playing')
    expect(score(s)).toBe(3 * 150)
  })

  it('a flawless win scores 2000 (1000 + 4×250)', () => {
    let s = createGame(SEED)
    for (const g of s.groups) s = solveGroupByName(s, g.name)
    expect(s.status).toBe('won')
    expect(score(s)).toBe(1000 + 4 * 250)
  })

  it('a win with mistakes scores lower than a flawless win', () => {
    let s = createGame(SEED)
    // burn one life first
    for (const it of ['Fork', 'Knife', 'Africa', 'Asia']) s = reduce(s, { type: 'select', item: it })
    s = reduce(s, { type: 'submit' })
    for (const g of s.groups) s = solveGroupByName(s, g.name)
    expect(s.status).toBe('won')
    expect(score(s)).toBe(1000 + 3 * 250)
    expect(score(s)).toBeLessThan(2000)
  })

  it('always returns a non-negative integer', () => {
    for (let seed = 0; seed < 30; seed++) {
      const v = score(createGame(seed))
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('helpers', () => {
  it('groupOfItem finds the owning group', () => {
    const s = createGame(SEED)
    const g = groupOfItem(s, 'Fork') as Group
    expect(g.name).toBe('Kitchen tools')
    expect(groupOfItem(s, 'NotAnItem')).toBeUndefined()
  })

  it('pickGroups returns 4 non-conflicting groups', () => {
    const g = pickGroups(mulberry32(555))
    expect(g).toHaveLength(4)
    const items = g.flatMap((x) => x.items)
    expect(new Set(items).size).toBe(16)
  })
})

describe('wrong-guess ergonomics (audit 2026-10-10)', () => {
  it('keeps the selection after a wrong guess so "one away" means swap one tile', () => {
    let s = createGame(SEED)
    for (const it of ['Fork', 'Knife', 'Plate', 'Africa']) s = reduce(s, { type: 'select', item: it })
    s = reduce(s, { type: 'submit' })
    expect(s.lastResult).toBe('one-away')
    expect(s.selected).toEqual(['Fork', 'Knife', 'Plate', 'Africa'])
    // swap the stray tile and resubmit
    s = reduce(s, { type: 'select', item: 'Africa' })
    s = reduce(s, { type: 'select', item: 'Spoon' })
    s = reduce(s, { type: 'submit' })
    expect(s.lastResult).toBe('correct')
    expect(s.selected).toEqual([])
    expect(s.lives).toBe(LIVES_START - 1)
  })

  it('does not charge a life for resubmitting an already-tried combination', () => {
    let s = createGame(SEED)
    s = submitGuess(s, ['Fork', 'Knife', 'Africa', 'Asia'])
    expect(s.lives).toBe(LIVES_START - 1)
    // same four, in a different order
    s = submitGuess(s, ['Asia', 'Africa', 'Knife', 'Fork'])
    expect(s.lastResult).toBe('already-guessed')
    expect(s.lives).toBe(LIVES_START - 1)
    expect(s.guessRows).toHaveLength(1)
    expect(s.selected).toHaveLength(4)
  })

  it('a fresh board has no remembered guesses and reset forgets them', () => {
    let s = createGame(SEED)
    s = submitGuess(s, ['Fork', 'Knife', 'Africa', 'Asia'])
    const r = reduce(s, { type: 'reset' })
    const again = submitGuess(r, ['Fork', 'Knife', 'Africa', 'Asia'])
    expect(again.lastResult).toBe('wrong')
    expect(again.lives).toBe(LIVES_START - 1)
  })
})
