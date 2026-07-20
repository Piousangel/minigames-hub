import { describe, it, expect } from 'vitest'
import {
  type Slot,
  type State,
  type Tile,
  LAYOUT,
  MAX_SHUFFLES,
  NUM_SLOTS,
  availableMatches,
  createGame,
  deal,
  findSolution,
  generate,
  freeTiles,
  hasMove,
  isFree,
  isFreeSlot,
  isSolvable,
  makeTilePairs,
  mulberry32,
  removePair,
  score,
  select,
  shuffle,
  tilesMatch,
} from './engine'

// -- fixture helpers ---------------------------------------------------------

function t(kind: Tile['kind'], value = 0): Tile {
  return { kind, value }
}

/** State with a custom `tiles` array; other fields sensible defaults. */
function mkState(tiles: (Tile | null)[], over: Partial<State> = {}): State {
  return {
    tiles,
    selected: null,
    status: 'playing',
    moves: 0,
    removed: tiles.filter((x) => x === null).length,
    shufflesLeft: MAX_SHUFFLES,
    ...over,
  }
}

// =============================================================================
// Tile set composition
// =============================================================================

describe('tile set composition', () => {
  it('makeTilePairs yields 72 pairs = 144 tiles', () => {
    const pairs = makeTilePairs()
    expect(pairs).toHaveLength(72)
    expect(pairs.flat()).toHaveLength(144)
  })

  it('every pair matches', () => {
    for (const [a, b] of makeTilePairs()) expect(tilesMatch(a, b)).toBe(true)
  })

  it('has exactly 4 copies of each suit rank (dot/bam/char 1..9)', () => {
    const tiles = makeTilePairs().flat()
    for (const kind of ['dot', 'bam', 'char'] as const) {
      for (let v = 1; v <= 9; v++) {
        const n = tiles.filter((x) => x.kind === kind && x.value === v).length
        expect(n).toBe(4)
      }
    }
  })

  it('has 4 winds × 4 copies and 3 dragons × 4 copies (28 honors)', () => {
    const tiles = makeTilePairs().flat()
    const winds = tiles.filter((x) => x.kind === 'wind')
    const dragons = tiles.filter((x) => x.kind === 'dragon')
    expect(winds).toHaveLength(16)
    expect(dragons).toHaveLength(12)
    for (let v = 0; v < 4; v++) expect(winds.filter((x) => x.value === v)).toHaveLength(4)
    for (let v = 0; v < 3; v++) expect(dragons.filter((x) => x.value === v)).toHaveLength(4)
  })

  it('has 4 flowers and 4 seasons (8 bonus)', () => {
    const tiles = makeTilePairs().flat()
    expect(tiles.filter((x) => x.kind === 'flower')).toHaveLength(4)
    expect(tiles.filter((x) => x.kind === 'season')).toHaveLength(4)
  })

  it('totals 108 suited + 28 honors + 8 bonus = 144', () => {
    const tiles = makeTilePairs().flat()
    const suited = tiles.filter((x) => ['dot', 'bam', 'char'].includes(x.kind)).length
    const honors = tiles.filter((x) => ['wind', 'dragon'].includes(x.kind)).length
    const bonus = tiles.filter((x) => ['flower', 'season'].includes(x.kind)).length
    expect([suited, honors, bonus]).toEqual([108, 28, 8])
    expect(suited + honors + bonus).toBe(144)
  })
})

// =============================================================================
// tilesMatch
// =============================================================================

describe('tilesMatch', () => {
  it('identical suited tiles match', () => {
    expect(tilesMatch(t('dot', 5), t('dot', 5))).toBe(true)
    expect(tilesMatch(t('bam', 1), t('bam', 1))).toBe(true)
    expect(tilesMatch(t('char', 9), t('char', 9))).toBe(true)
  })

  it('same-kind different-value suited tiles do NOT match', () => {
    expect(tilesMatch(t('dot', 5), t('dot', 6))).toBe(false)
    expect(tilesMatch(t('char', 1), t('char', 2))).toBe(false)
  })

  it('different-kind tiles do NOT match', () => {
    expect(tilesMatch(t('dot', 5), t('bam', 5))).toBe(false)
    expect(tilesMatch(t('wind', 0), t('dragon', 0))).toBe(false)
    expect(tilesMatch(t('flower', 0), t('season', 0))).toBe(false)
  })

  it('honors match by value', () => {
    expect(tilesMatch(t('wind', 2), t('wind', 2))).toBe(true)
    expect(tilesMatch(t('wind', 0), t('wind', 1))).toBe(false)
    expect(tilesMatch(t('dragon', 1), t('dragon', 1))).toBe(true)
  })

  it('ANY flower matches ANY flower (even different faces)', () => {
    expect(tilesMatch(t('flower', 0), t('flower', 3))).toBe(true)
    expect(tilesMatch(t('flower', 1), t('flower', 2))).toBe(true)
  })

  it('ANY season matches ANY season (even different faces)', () => {
    expect(tilesMatch(t('season', 0), t('season', 3))).toBe(true)
    expect(tilesMatch(t('season', 2), t('season', 1))).toBe(true)
  })
})

// =============================================================================
// Layout
// =============================================================================

describe('layout', () => {
  it('has exactly 144 slots', () => {
    expect(NUM_SLOTS).toBe(144)
    expect(LAYOUT).toHaveLength(144)
  })

  it('has no two slots at the same (x, y, z)', () => {
    const seen = new Set<string>()
    for (const s of LAYOUT) {
      const k = `${s.x},${s.y},${s.z}`
      expect(seen.has(k)).toBe(false)
      seen.add(k)
    }
  })

  it('has the expected per-layer counts (84/40/12/8)', () => {
    const byZ = [0, 0, 0, 0]
    for (const s of LAYOUT) byZ[s.z]++
    expect(byZ).toEqual([84, 40, 12, 8])
  })

  it('never overlaps two tiles on the same layer', () => {
    for (let i = 0; i < LAYOUT.length; i++) {
      for (let j = i + 1; j < LAYOUT.length; j++) {
        const a = LAYOUT[i]
        const b = LAYOUT[j]
        if (a.z !== b.z) continue
        const overlap = Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2
        expect(overlap).toBe(false)
      }
    }
  })
})

// =============================================================================
// isFreeSlot — hand-built fixtures
// =============================================================================

describe('isFreeSlot fixtures', () => {
  const all = (n: number) => new Array<boolean>(n).fill(true)

  it('a lone tile is free', () => {
    const slots: Slot[] = [{ x: 0, y: 0, z: 0 }]
    expect(isFreeSlot(slots, [true], 0)).toBe(true)
  })

  it('a covered tile (something on top) is NOT free', () => {
    const slots: Slot[] = [
      { x: 0, y: 0, z: 0 }, // bottom
      { x: 0, y: 0, z: 1 }, // directly on top
    ]
    expect(isFreeSlot(slots, all(2), 0)).toBe(false)
    // The top tile itself is free.
    expect(isFreeSlot(slots, all(2), 1)).toBe(true)
  })

  it('a tile blocked on BOTH sides is NOT free', () => {
    const slots: Slot[] = [
      { x: 2, y: 0, z: 0 }, // middle
      { x: 0, y: 0, z: 0 }, // left neighbor
      { x: 4, y: 0, z: 0 }, // right neighbor
    ]
    expect(isFreeSlot(slots, all(3), 0)).toBe(false)
  })

  it('a tile blocked on only ONE side is free', () => {
    const slots: Slot[] = [
      { x: 2, y: 0, z: 0 }, // middle
      { x: 0, y: 0, z: 0 }, // left neighbor only
    ]
    expect(isFreeSlot(slots, all(2), 0)).toBe(true) // right side open
  })

  it('edge tile of a row is free (open outer side)', () => {
    const slots: Slot[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
    ]
    expect(isFreeSlot(slots, all(3), 0)).toBe(true) // leftmost
    expect(isFreeSlot(slots, all(3), 2)).toBe(true) // rightmost
    expect(isFreeSlot(slots, all(3), 1)).toBe(false) // middle blocked both sides
  })

  it('a same-side neighbor that does NOT vertically overlap does not block', () => {
    const slots: Slot[] = [
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 4, z: 0 }, // far below-left, no vertical overlap
      { x: 4, y: 4, z: 0 }, // far below-right, no vertical overlap
    ]
    expect(isFreeSlot(slots, all(3), 0)).toBe(true)
  })

  it('a tile at z+1 that does NOT overlap does not cover', () => {
    const slots: Slot[] = [
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: 1 }, // higher layer but far away
    ]
    expect(isFreeSlot(slots, all(2), 0)).toBe(true)
  })

  it('removing a neighbor frees a previously-blocked tile', () => {
    const slots: Slot[] = [
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
    ]
    expect(isFreeSlot(slots, [true, true, true], 0)).toBe(false)
    expect(isFreeSlot(slots, [true, true, false], 0)).toBe(true) // right gone
  })

  it('a removed (absent) tile is never free', () => {
    const slots: Slot[] = [{ x: 0, y: 0, z: 0 }]
    expect(isFreeSlot(slots, [false], 0)).toBe(false)
  })
})

// =============================================================================
// deal — determinism & solvability
// =============================================================================

describe('deal', () => {
  it('fills all 144 slots with a full matching multiset', () => {
    const s = createGame(12345)
    expect(s.tiles.filter((x) => x !== null)).toHaveLength(144)
    // The tile multiset equals makeTilePairs (order-independent).
    const count = (arr: (Tile | null)[]) => {
      const m = new Map<string, number>()
      for (const x of arr) if (x) m.set(`${x.kind}:${x.value}`, (m.get(`${x.kind}:${x.value}`) ?? 0) + 1)
      return m
    }
    const dealt = count(s.tiles)
    const expected = count(makeTilePairs().flat())
    expect(dealt).toEqual(expected)
  })

  it('is deterministic for a fixed seed', () => {
    const a = createGame(999)
    const b = createGame(999)
    expect(a.tiles).toEqual(b.tiles)
  })

  it('createGame(seed) equals deal(mulberry32(seed))', () => {
    expect(createGame(777).tiles).toEqual(deal(mulberry32(777)).tiles)
  })

  it('different seeds generally produce different boards', () => {
    const a = createGame(1)
    const b = createGame(2)
    expect(a.tiles).not.toEqual(b.tiles)
  })

  it('starts with status playing, no selection, full shuffles', () => {
    const s = createGame(7)
    expect(s.status).toBe('playing')
    expect(s.selected).toBeNull()
    expect(s.moves).toBe(0)
    expect(s.removed).toBe(0)
    expect(s.shufflesLeft).toBe(MAX_SHUFFLES)
  })

  it('has at least one available match at the start', () => {
    for (const seed of [1, 2, 3, 42, 12345]) {
      expect(hasMove(createGame(seed))).toBe(true)
    }
  })

  // The critical guarantee: a concrete winning line clears every generated deal
  // when replayed move-by-move through the REAL removePair validator. Each move
  // must independently pass free+match validation, so a win proves solvability.
  it('every generated deal is SOLVABLE — its winning line clears the board', () => {
    for (const seed of [1, 2, 3, 7, 42, 100, 999, 12345, 54321, 2024]) {
      const { state, solution } = generate(mulberry32(seed))
      expect(solution).toHaveLength(72)
      let s = state
      for (const [i, j] of solution) {
        const next = removePair(s, i, j)
        expect(next).not.toBe(s) // every move is a legal free+matching removal
        s = next
      }
      expect(s.status).toBe('won')
      expect(s.moves).toBe(72)
      expect(s.tiles.every((t) => t === null)).toBe(true)
    }
  })
})

// =============================================================================
// removePair
// =============================================================================

describe('removePair', () => {
  it('removes a matching free pair and advances counters', () => {
    // Two lone matching tiles (both free).
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    // slot 0 and slot 1 are on the bottom edge → free.
    tiles[0] = t('dot', 3)
    tiles[1] = t('dot', 3)
    const s = mkState(tiles)
    const next = removePair(s, 0, 1)
    expect(next).not.toBe(s)
    expect(next.tiles[0]).toBeNull()
    expect(next.tiles[1]).toBeNull()
    expect(next.moves).toBe(1)
    expect(next.removed).toBe(s.removed + 2)
  })

  it('is a === no-op for a non-matching pair', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('dot', 3)
    tiles[1] = t('bam', 3)
    const s = mkState(tiles)
    expect(removePair(s, 0, 1)).toBe(s)
  })

  it('is a === no-op when an index is empty', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('dot', 3)
    const s = mkState(tiles)
    expect(removePair(s, 0, 1)).toBe(s)
  })

  it('is a === no-op for identical indices', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('dot', 3)
    const s = mkState(tiles)
    expect(removePair(s, 0, 0)).toBe(s)
  })

  it('is a === no-op for out-of-range indices', () => {
    const s = createGame(5)
    expect(removePair(s, -1, 0)).toBe(s)
    expect(removePair(s, 0, NUM_SLOTS)).toBe(s)
  })

  it('is a === no-op when a tile is NOT free (blocked)', () => {
    // Build a covered pair: bottom tile covered by a top tile.
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    // LAYOUT[0] is z0 (0,0); find its z1 cover. Slot at (4,2,1) is index 84.
    // Instead craft directly: put matching tiles on a blocked bottom cell.
    // Slot index 15 is z0 (x=2,y=2) — interior; block it and try.
    // Simpler: cover slot 84? Use two z0 middle tiles blocked by neighbors.
    // Row y=0: slots 0..13 (x 0..26). slot 1 (x=2) has neighbors 0 and 2.
    tiles[0] = t('char', 1)
    tiles[1] = t('char', 1) // slot 1 blocked left by slot 0
    tiles[2] = t('char', 1) // slot 1 blocked right by slot 2
    const s = mkState(tiles)
    // slot 1 is blocked both sides → removing (1, 0) illegal? slot 0 is free
    // (left edge open) but slot 1 blocked right by 2 and left by 0 → not free.
    expect(isFree(s, 1)).toBe(false)
    expect(removePair(s, 0, 1)).toBe(s)
  })

  it('removing a tile frees a previously-blocked neighbor', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('bam', 5)
    tiles[1] = t('bam', 7) // middle, blocked left by 0, right by 2
    tiles[2] = t('bam', 5)
    const s = mkState(tiles)
    expect(isFree(s, 1)).toBe(false) // blocked both sides
    const next = removePair(s, 0, 2) // remove the two bam5 (both free ends)
    expect(next).not.toBe(s)
    expect(isFree(next, 1)).toBe(true) // now both neighbors gone → free
  })

  it('sets status to won when the last pair is removed', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('flower', 0)
    tiles[1] = t('flower', 2) // flowers match across faces
    const s = mkState(tiles, { removed: 142 })
    const next = removePair(s, 0, 1)
    expect(next.status).toBe('won')
    expect(next.tiles.every((x) => x === null)).toBe(true)
  })
})

// =============================================================================
// select
// =============================================================================

describe('select', () => {
  function twoFreePair(): State {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('dot', 1)
    tiles[13] = t('dot', 1) // both are row-y=0 ends (0 and 13) → free
    return mkState(tiles)
  }

  it('selects a free tile', () => {
    const s = twoFreePair()
    const next = select(s, 0)
    expect(next.selected).toBe(0)
  })

  it('deselects when the same tile is tapped again', () => {
    const s = { ...twoFreePair(), selected: 0 }
    expect(select(s, 0).selected).toBeNull()
  })

  it('matching second free tile removes the pair', () => {
    const s = { ...twoFreePair(), selected: 0 }
    const next = select(s, 13)
    expect(next.tiles[0]).toBeNull()
    expect(next.tiles[13]).toBeNull()
    expect(next.selected).toBeNull()
    expect(next.moves).toBe(1)
  })

  it('non-matching second free tile moves the selection', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('dot', 1)
    tiles[13] = t('bam', 1)
    const s = mkState(tiles, { selected: 0 })
    const next = select(s, 13)
    expect(next.selected).toBe(13)
    expect(next.tiles[0]).not.toBeNull()
  })

  it('selecting a non-free tile is a === no-op', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('dot', 1)
    tiles[1] = t('dot', 2)
    tiles[2] = t('dot', 1) // slot 1 blocked both sides
    const s = mkState(tiles)
    expect(select(s, 1)).toBe(s)
  })

  it('selecting an empty slot is a === no-op', () => {
    const s = twoFreePair()
    expect(select(s, 5)).toBe(s)
  })
})

// =============================================================================
// shuffle
// =============================================================================

describe('shuffle', () => {
  it('keeps the same tiles occupying the same slots (permutation)', () => {
    const s = createGame(3)
    const next = shuffle(s, mulberry32(1))
    const filledBefore = s.tiles.map((x) => x !== null)
    const filledAfter = next.tiles.map((x) => x !== null)
    expect(filledAfter).toEqual(filledBefore)
    expect(next.shufflesLeft).toBe(s.shufflesLeft - 1)
  })

  it('is a === no-op when no shuffles remain', () => {
    const s = { ...createGame(3), shufflesLeft: 0 }
    expect(shuffle(s, mulberry32(1))).toBe(s)
  })

  it('preserves the full tile multiset', () => {
    const s = createGame(8)
    const next = shuffle(s, mulberry32(2))
    const count = (arr: (Tile | null)[]) => {
      const m = new Map<string, number>()
      for (const x of arr) if (x) m.set(`${x.kind}:${x.value}`, (m.get(`${x.kind}:${x.value}`) ?? 0) + 1)
      return m
    }
    expect(count(next.tiles)).toEqual(count(s.tiles))
  })
})

// =============================================================================
// queries & scoring
// =============================================================================

describe('queries', () => {
  it('freeTiles matches isFree for every slot', () => {
    const s = createGame(11)
    const free = new Set(freeTiles(s))
    for (let i = 0; i < NUM_SLOTS; i++) {
      expect(free.has(i)).toBe(isFree(s, i))
    }
  })

  it('availableMatches only lists matching free pairs', () => {
    const s = createGame(11)
    for (const [i, j] of availableMatches(s)) {
      expect(isFree(s, i)).toBe(true)
      expect(isFree(s, j)).toBe(true)
      expect(tilesMatch(s.tiles[i]!, s.tiles[j]!)).toBe(true)
    }
  })

  it('hasMove is true iff availableMatches is non-empty', () => {
    const s = createGame(11)
    expect(hasMove(s)).toBe(availableMatches(s).length > 0)
  })
})

describe('score', () => {
  it('is zero at the start', () => {
    expect(score(createGame(1))).toBe(0)
  })

  it('is monotonic with pairs removed', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('dot', 1)
    tiles[13] = t('dot', 1)
    const s0 = mkState(tiles, { removed: 0 })
    const s1 = removePair(s0, 0, 13)
    expect(score(s1)).toBeGreaterThan(score(s0))
  })

  it('adds a win bonus on a cleared board', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('season', 0)
    tiles[1] = t('season', 3)
    const s = mkState(tiles, { removed: 142 })
    const won = removePair(s, 0, 1)
    expect(won.status).toBe('won')
    // 144 removed × 100 + 10000 bonus.
    expect(score(won)).toBe(144 * 100 + 10000)
  })
})

// =============================================================================
// full playthrough — a generated deal can actually be cleared move-by-move
// =============================================================================

describe('independent solver', () => {
  it('clears a small hand-built board from scratch (no construction hints)', () => {
    // Two matching free pairs on the bottom edge → findSolution must clear it.
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('dot', 4)
    tiles[13] = t('dot', 4)
    tiles[1] = t('bam', 2)
    tiles[12] = t('bam', 2)
    const solution = findSolution(tiles)
    expect(solution).not.toBeNull()
    expect(solution!).toHaveLength(2)
    expect(isSolvable(tiles)).toBe(true)
  })

  it('reports an unsolvable board (a lone unmatchable tile) as unsolvable', () => {
    const tiles: (Tile | null)[] = new Array(NUM_SLOTS).fill(null)
    tiles[0] = t('dot', 4)
    tiles[13] = t('bam', 4) // different kind → never matches
    expect(isSolvable(tiles)).toBe(false)
  })

  it('clears a full generated deal by replaying its winning line to a win', () => {
    const { state, solution } = generate(mulberry32(2024))
    let s = state
    for (const [i, j] of solution) s = removePair(s, i, j)
    expect(s.status).toBe('won')
    expect(s.moves).toBe(72)
    expect(score(s)).toBe(144 * 100 + 10000)
  })
})
