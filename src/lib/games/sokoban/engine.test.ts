import { describe, expect, it } from 'vitest'
import {
  LEVELS,
  levelCount,
  loadLevel,
  move,
  reset,
  isSolved,
  parseLevel,
  tileAt,
  keyOf,
  type Direction,
  type GameState,
} from './engine'

/** Build a state directly from ad-hoc level rows (for isolated scenarios). */
function fromRows(rows: string[]): GameState {
  const p = parseLevel(rows)
  return {
    levelIndex: 0,
    width: p.width,
    height: p.height,
    walls: p.walls,
    targets: p.targets,
    boxes: new Set(p.boxes),
    player: p.player,
    moves: 0,
  }
}

const serialize = (s: GameState): string =>
  `${keyOf(s.player.row, s.player.col)}|${[...s.boxes].sort().join(';')}`

/** BFS solver — proves a level is genuinely solvable (used to guard curation). */
function isLevelSolvable(index: number): boolean {
  const start = loadLevel(index)
  if (isSolved(start)) return true
  const seen = new Set<string>([serialize(start)])
  const queue: GameState[] = [start]
  const dirs: Direction[] = ['up', 'down', 'left', 'right']
  while (queue.length) {
    const cur = queue.shift() as GameState
    for (const d of dirs) {
      const next = move(cur, d)
      if (next === cur) continue // no-op move
      const key = serialize(next)
      if (seen.has(key)) continue
      if (isSolved(next)) return true
      seen.add(key)
      queue.push(next)
    }
  }
  return false
}

describe('parseLevel', () => {
  it('extracts a single player, and boxes/targets from notation', () => {
    const p = parseLevel(['#####', '#@$.#', '#####'])
    expect(p.player).toEqual({ row: 1, col: 1 })
    expect(p.boxes).toEqual([keyOf(1, 2)])
    expect(p.targets[1][3]).toBe(true)
    expect(p.walls[0][0]).toBe(true)
  })
  it('reads box-on-target (*) and player-on-target (+)', () => {
    const p = parseLevel(['####', '#+*#', '####'])
    expect(p.player).toEqual({ row: 1, col: 1 })
    expect(p.targets[1][1]).toBe(true) // player on target
    expect(p.targets[1][2]).toBe(true) // box on target
    expect(p.boxes).toEqual([keyOf(1, 2)])
  })
})

describe('move — player walking', () => {
  it('walks into floor and increments the move counter', () => {
    const s = fromRows(['####', '#@ #', '####'])
    const next = move(s, 'right')
    expect(next.player).toEqual({ row: 1, col: 2 })
    expect(next.moves).toBe(1)
  })
  it('walks onto a target cell', () => {
    const s = fromRows(['####', '#@.#', '####'])
    const next = move(s, 'right')
    expect(tileAt(next, 1, 2)).toBe('player-on-target')
  })
  it('is blocked by a wall and returns the same state (no move counted)', () => {
    const s = fromRows(['###', '#@#', '###'])
    const up = move(s, 'up')
    expect(up).toBe(s)
    expect(up.moves).toBe(0)
  })
})

describe('move — pushing boxes', () => {
  it('pushes a single box onto floor', () => {
    const s = fromRows(['#####', '#@$ #', '#####'])
    const next = move(s, 'right')
    expect(next.boxes.has(keyOf(1, 3))).toBe(true)
    expect(next.boxes.has(keyOf(1, 2))).toBe(false)
    expect(next.player).toEqual({ row: 1, col: 2 })
    expect(next.moves).toBe(1)
  })
  it('cannot push a box into a wall', () => {
    const s = fromRows(['####', '#@$#', '####'])
    const next = move(s, 'right')
    expect(next).toBe(s)
    expect(next.moves).toBe(0)
  })
  it('cannot push two boxes at once', () => {
    const s = fromRows(['######', '#@$$ #', '######'])
    const next = move(s, 'right')
    expect(next).toBe(s)
    expect(next.moves).toBe(0)
  })
})

describe('box-on-target & isSolved', () => {
  it('detects a box resting on a target', () => {
    const s = fromRows(['#####', '#@$.#', '#####'])
    const next = move(s, 'right')
    expect(tileAt(next, 1, 3)).toBe('box-on-target')
  })
  it('is not solved until every box is on a target', () => {
    const s = fromRows(['#####', '#@$.#', '#####'])
    expect(isSolved(s)).toBe(false)
    expect(isSolved(move(s, 'right'))).toBe(true)
  })
  it('multi-box level is solved only when all boxes are placed', () => {
    // Two boxes; push each right onto its target one at a time.
    const s = fromRows(['######', '#@$.$', '#####'].map((r) => r.padEnd(6, '#')))
    const one = move(s, 'right') // first box onto its target
    expect(isSolved(one)).toBe(false) // second box still off-target
  })
})

describe('reset & metadata', () => {
  it('reset restores the level to its starting position', () => {
    const s = loadLevel(0)
    const moved = move(move(s, 'right'), 'right')
    expect(moved.moves).toBeGreaterThan(0)
    const back = reset(moved)
    expect(back.moves).toBe(0)
    expect(back.player).toEqual(s.player)
    expect([...back.boxes].sort()).toEqual([...s.boxes].sort())
  })
  it('loadLevel wraps out-of-range indices', () => {
    expect(loadLevel(levelCount).levelIndex).toBe(0)
    expect(loadLevel(-1).levelIndex).toBe(levelCount - 1)
  })
})

describe('curated levels', () => {
  it('exposes at least 6 levels', () => {
    expect(levelCount).toBeGreaterThanOrEqual(6)
  })
  it.each(LEVELS.map((_, i) => i))('level %i is internally consistent', (i) => {
    const p = parseLevel(LEVELS[i])
    const s = loadLevel(i)
    // exactly one player
    const playerCount = LEVELS[i].join('').replace(/[^@+]/g, '').length
    expect(playerCount).toBe(1)
    // boxes count equals targets count
    let targetCount = 0
    for (const row of p.targets) for (const t of row) if (t) targetCount++
    expect(s.boxes.size).toBe(targetCount)
    expect(s.boxes.size).toBeGreaterThan(0)
    // no box starts already off-grid or on a wall
    for (const key of s.boxes) {
      const [r, c] = key.split(',').map(Number)
      expect(s.walls[r][c]).toBe(false)
    }
  })
  it.each(LEVELS.map((_, i) => i))('level %i is solvable (BFS)', (i) => {
    expect(isLevelSolvable(i)).toBe(true)
  })
})
