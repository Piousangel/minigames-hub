import { describe, expect, it } from 'vitest'
import {
  CELLS,
  COMBO_MAX,
  COMBO_WINDOW,
  GRID,
  MAX_STRIKES,
  emptyCells,
  harvest,
  newGame,
  spawnTile,
  spawnTileExcluding,
  tick,
  valueBounds,
  type Cell,
  type Tile,
  type ZeroHourState,
} from './engine'

/** Queued RNG: yields the given values in order. */
const rng = (...vals: number[]) => {
  let i = 0
  return () => {
    if (i >= vals.length) throw new Error(`rng exhausted after ${vals.length} draws`)
    return vals[i++]
  }
}

/** An rng that throws if called at all (asserts zero consumption). */
const throwingRng = () => {
  throw new Error('rng should not be called')
}

const tileAt = (v: number, id = 1): Tile => ({ value: v, id })

const S = (partial: Partial<ZeroHourState> = {}): ZeroHourState => ({
  ...newGame(),
  ...partial,
})

/** Build cells from a sparse map of index -> value. */
const cellsWith = (map: Record<number, number>): Cell[] => {
  const cells = Array<Cell>(CELLS).fill(null)
  let id = 100
  for (const k of Object.keys(map)) {
    const i = Number(k)
    cells[i] = { value: map[i], id: id++ }
  }
  return cells
}

describe('newGame', () => {
  it('25 null cells, all counters zero, multiplier 1, nextId 1, not over', () => {
    const s = newGame()
    expect(s.cells).toHaveLength(CELLS)
    expect(CELLS).toBe(GRID * GRID)
    expect(s.cells.every((c) => c === null)).toBe(true)
    expect(s.score).toBe(0)
    expect(s.strikes).toBe(0)
    expect(s.tick).toBe(0)
    expect(s.combo).toBe(0)
    expect(s.longestChain).toBe(0)
    expect(s.multiplier).toBe(1)
    expect(s.comboLastValue).toBeNull()
    expect(s.comboDeadline).toBe(0)
    expect(s.nextId).toBe(1)
    expect(s.over).toBe(false)
  })
})

describe('valueBounds golden table', () => {
  it('matches the spec table across levels', () => {
    expect(valueBounds(0)).toEqual({ min: 5, max: 9 })
    expect(valueBounds(29)).toEqual({ min: 5, max: 9 })
    expect(valueBounds(30)).toEqual({ min: 4, max: 8 })
    expect(valueBounds(59)).toEqual({ min: 4, max: 8 })
    expect(valueBounds(60)).toEqual({ min: 3, max: 7 })
    expect(valueBounds(89)).toEqual({ min: 3, max: 7 })
    expect(valueBounds(90)).toEqual({ min: 2, max: 6 })
    expect(valueBounds(120)).toEqual({ min: 2, max: 5 })
    expect(valueBounds(150)).toEqual({ min: 2, max: 4 })
  })

  it('always keeps min < max', () => {
    for (let t = 0; t <= 600; t += 7) {
      const { min, max } = valueBounds(t)
      expect(min).toBeLessThan(max)
    }
  })
})

describe('spawnTile — RNG order is position then value', () => {
  it('empty board tick0, rng(0,0) -> cell 0 value min(5)', () => {
    const next = spawnTile(newGame(), rng(0, 0))
    expect(next.cells[0]).toEqual({ value: 5, id: 1 })
    expect(next.cells.filter(Boolean)).toHaveLength(1)
    expect(next.nextId).toBe(2)
  })

  it('empty board tick0, rng(0.999,0.999) -> cell 24 value max(9)', () => {
    const next = spawnTile(newGame(), rng(0.999, 0.999))
    expect(next.cells[24]).toEqual({ value: 9, id: 1 })
  })

  it('full board -> unchanged, consumes zero rng', () => {
    const full = S({ cells: Array.from({ length: CELLS }, (_, i) => tileAt(5, i + 1)) })
    const next = spawnTile(full, throwingRng)
    expect(next).toBe(full)
  })

  it('spawnTileExcluding avoids the excluded cell when other empties exist', () => {
    // Only cells 0 and 1 empty; exclude 0 -> must land on 1.
    const cells = Array.from({ length: CELLS }, (_, i) => (i < 2 ? null : tileAt(5, i + 1)))
    const s = S({ cells })
    const next = spawnTileExcluding(s, rng(0, 0), 0)
    expect(next.cells[0]).toBeNull()
    expect(next.cells[1]).not.toBeNull()
  })

  it('spawnTileExcluding falls back to excluded cell when it is the only empty', () => {
    const cells = Array.from({ length: CELLS }, (_, i) => (i === 3 ? null : tileAt(5, i + 1)))
    const s = S({ cells })
    const next = spawnTileExcluding(s, rng(0, 0), 3)
    expect(next.cells[3]).not.toBeNull()
  })
})

describe('emptyCells', () => {
  it('returns ascending null indices', () => {
    const s = S({ cells: cellsWith({ 2: 5, 7: 4 }) })
    const empties = emptyCells(s)
    expect(empties).not.toContain(2)
    expect(empties).not.toContain(7)
    expect(empties[0]).toBe(0)
    expect(empties).toHaveLength(CELLS - 2)
  })
})

describe('harvest — no-op guards consume zero rng', () => {
  it('empty cell', () => {
    const s = S({ cells: cellsWith({ 5: 7 }) })
    const res = harvest(s, 0, throwingRng)
    expect(res.event.type).toBe('none')
    expect(res.state).toBe(s)
  })
  it('out of range', () => {
    const s = S({ cells: cellsWith({ 5: 7 }) })
    expect(harvest(s, -1, throwingRng).event.type).toBe('none')
    expect(harvest(s, CELLS, throwingRng).event.type).toBe('none')
  })
  it('after over', () => {
    const s = S({ cells: cellsWith({ 5: 7 }), over: true })
    const res = harvest(s, 5, throwingRng)
    expect(res.event.type).toBe('none')
    expect(res.state).toBe(s)
  })
})

describe('harvest — scoring + respawn', () => {
  it('single harvest of value 7 -> +7, combo1 x1, respawns exactly one tile elsewhere, 2 rng draws', () => {
    const s = S({ cells: cellsWith({ 10: 7 }) })
    const res = harvest(s, 10, rng(0, 0)) // respawn at cell 0 (excluding 10), value 5
    expect(res.event).toMatchObject({ type: 'harvest', value: 7, gained: 7, combo: 1, multiplier: 1, brokeChain: false })
    expect(res.state.score).toBe(7)
    expect(res.state.cells[10]).toBeNull()
    expect(res.state.cells.filter(Boolean)).toHaveLength(1)
    expect(res.state.cells[0]).not.toBeNull()
    expect(res.state.combo).toBe(1)
    expect(res.state.multiplier).toBe(1)
    expect(res.state.comboLastValue).toBe(7)
    expect(res.state.longestChain).toBe(1)
  })

  it('exactly 2 rng draws consumed (3rd throws)', () => {
    const s = S({ cells: cellsWith({ 10: 7 }) })
    const r = rng(0, 0, 0.5) // only 2 should be pulled
    const res = harvest(s, 10, r)
    expect(res.state.score).toBe(7)
    // a 3rd call would be the leftover; ensure it's still available (not consumed)
    expect(r()).toBe(0.5)
  })
})

describe('harvest — descending chain', () => {
  it('harvest 8 then 5 within window -> combo2 x2 gained 10, longestChain 2', () => {
    // Seed 8 @ cell 0, 5 @ cell 1, on a board that is otherwise full so respawn
    // lands predictably in the just-vacated cell.
    let s = S({ cells: cellsWith({ 0: 8, 1: 5 }) })
    // First harvest: value 8. Respawn elsewhere (many empties) at some cell.
    const r1 = harvest(s, 0, rng(0, 0))
    s = r1.state
    expect(r1.event).toMatchObject({ type: 'harvest', combo: 1, multiplier: 1, gained: 8 })
    // Second harvest: value 5 < 8 within window (tick unchanged = 0 <= deadline 3).
    const r2 = harvest(s, 1, rng(0.5, 0))
    expect(r2.event).toMatchObject({ type: 'chain', value: 5, combo: 2, multiplier: 2, gained: 10, brokeChain: false })
    expect(r2.state.longestChain).toBe(2)
    expect(r2.state.score).toBe(18)
  })
})

describe('harvest — chain break', () => {
  it('equal value breaks and restarts at combo 1', () => {
    let s = S({ combo: 2, comboLastValue: 5, comboDeadline: 5, multiplier: 2, longestChain: 2, cells: cellsWith({ 0: 5 }) })
    const res = harvest(s, 0, rng(0, 0))
    expect(res.event).toMatchObject({ combo: 1, multiplier: 1, brokeChain: true, gained: 5 })
    s = res.state
    expect(s.combo).toBe(1)
  })

  it('harvest after comboDeadline breaks the chain', () => {
    const s = S({ tick: 10, combo: 3, comboLastValue: 6, comboDeadline: 8, multiplier: 3, cells: cellsWith({ 0: 4 }) })
    // 4 < 6 but tick 10 > deadline 8 -> not continuing.
    const res = harvest(s, 0, rng(0, 0))
    expect(res.event).toMatchObject({ combo: 1, multiplier: 1, brokeChain: true })
  })
})

describe('harvest — multiplier cap at COMBO_MAX', () => {
  it('long strictly-descending chain clamps multiplier at COMBO_MAX', () => {
    // Manufacture a state already at combo COMBO_MAX with descending room.
    const s = S({
      combo: COMBO_MAX,
      comboLastValue: 20,
      comboDeadline: 100,
      multiplier: COMBO_MAX,
      tick: 0,
      cells: cellsWith({ 0: 9 }),
    })
    const res = harvest(s, 0, rng(0, 0)) // 9 < 20, continuing -> combo 9, capped mult 8
    expect(res.event).toMatchObject({ combo: COMBO_MAX + 1, multiplier: COMBO_MAX, gained: 9 * COMBO_MAX })
  })
})

describe('tick — decrement', () => {
  it('all values -1, tick +1', () => {
    const s = S({ cells: cellsWith({ 0: 5, 12: 3 }), tick: 4 })
    const res = tick(s)
    expect(res.state.tick).toBe(5)
    expect((res.state.cells[0] as Tile).value).toBe(4)
    expect((res.state.cells[12] as Tile).value).toBe(2)
    expect((res.state.cells[0] as Tile).id).toBe((s.cells[0] as Tile).id) // id preserved
    expect(res.event.cracked).toEqual([])
  })

  it('all-empty board just advances tick', () => {
    const res = tick(newGame())
    expect(res.state.tick).toBe(1)
    expect(res.event.cracked).toEqual([])
    expect(res.state.cells.every((c) => c === null)).toBe(true)
  })
})

describe('tick — crack', () => {
  it('value-1 tile -> cracked index in event, cell nulled, strikesAdded 1', () => {
    const s = S({ cells: cellsWith({ 6: 1, 9: 5 }) })
    const res = tick(s)
    expect(res.event.cracked).toEqual([6])
    expect(res.event.strikesAdded).toBe(1)
    expect(res.state.cells[6]).toBeNull()
    expect(res.state.strikes).toBe(1)
    expect((res.state.cells[9] as Tile).value).toBe(4)
    expect(res.state.over).toBe(false)
  })

  it('double crack from strikes 2 -> over true, strikes clamped to 3', () => {
    const s = S({ strikes: 2, cells: cellsWith({ 1: 1, 3: 1 }) })
    const res = tick(s)
    expect(res.event.cracked).toEqual([1, 3])
    expect(res.event.strikesAdded).toBe(2)
    expect(res.state.strikes).toBe(MAX_STRIKES)
    expect(res.state.over).toBe(true)
    expect(res.event.over).toBe(true)
  })
})

describe('tick — chain expiry', () => {
  it('active chain with deadline passed -> chainEnded true, combo reset', () => {
    const s = S({ tick: 5, combo: 2, multiplier: 2, comboLastValue: 4, comboDeadline: 5, cells: cellsWith({ 0: 8 }) })
    // newTick = 6 > deadline 5 -> chain ends.
    const res = tick(s)
    expect(res.event.chainEnded).toBe(true)
    expect(res.state.combo).toBe(0)
    expect(res.state.multiplier).toBe(1)
    expect(res.state.comboLastValue).toBeNull()
  })

  it('chain within window survives a tick', () => {
    const s = S({ tick: 1, combo: 2, multiplier: 2, comboLastValue: 4, comboDeadline: 5, cells: cellsWith({ 0: 8 }) })
    const res = tick(s) // newTick 2 <= 5, no crack
    expect(res.event.chainEnded).toBe(false)
    expect(res.state.combo).toBe(2)
  })

  it('a crack ends the chain even inside the window', () => {
    const s = S({ tick: 1, combo: 2, multiplier: 2, comboLastValue: 4, comboDeadline: 9, cells: cellsWith({ 0: 1 }) })
    const res = tick(s)
    expect(res.event.cracked).toEqual([0])
    expect(res.event.chainEnded).toBe(true)
    expect(res.state.combo).toBe(0)
  })
})

describe('tick — after over is a no-op', () => {
  it('returns same state, over event', () => {
    const s = S({ over: true, cells: cellsWith({ 0: 5 }) })
    const res = tick(s)
    expect(res.state).toBe(s)
    expect(res.event.over).toBe(true)
    expect(res.event.cracked).toEqual([])
  })
})

describe('purity / immutability', () => {
  it('harvest does not mutate the input state', () => {
    const cells = cellsWith({ 4: 7 })
    const s = S({ cells })
    const beforeVal = (s.cells[4] as Tile).value
    const beforeScore = s.score
    harvest(s, 4, rng(0, 0))
    expect((s.cells[4] as Tile).value).toBe(beforeVal)
    expect(s.score).toBe(beforeScore)
    expect(s.cells).toBe(cells) // reference untouched
  })

  it('tick does not mutate the input cells array or tiles', () => {
    const cells = cellsWith({ 0: 5, 1: 1 })
    const s = S({ cells })
    tick(s)
    expect((s.cells[0] as Tile).value).toBe(5)
    expect(s.cells[1]).not.toBeNull()
    expect(s.tick).toBe(0)
  })

  it('COMBO_WINDOW and COMBO_MAX constants are sane', () => {
    expect(COMBO_WINDOW).toBe(3)
    expect(COMBO_MAX).toBe(8)
  })
})
