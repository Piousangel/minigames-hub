import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DELTAS,
  LEVELS,
  MIRROR,
  PACKS,
  dailySeed,
  generateDaily,
  goalSatisfaction,
  isWon,
  keyOf,
  levelCount,
  loadLevel,
  makeRng,
  mirror,
  parseLevel,
  preview,
  previewAll,
  reset,
  resolveMove,
  solveOptimal,
  starsFor,
  step,
  type Direction,
  type GameState,
  type Level,
  type MirrorMode,
} from './engine'

const DIRS: Direction[] = ['up', 'down', 'left', 'right']
const MODES: MirrorMode[] = ['horizontal', 'vertical', 'point', 'diagonal', 'antidiagonal']

/** Build a state directly from ad-hoc rows for isolated scenarios. */
const mk = (mode: MirrorMode, grid: string[], par = 1): GameState =>
  parseLevel({ name: 'test', mode, par, grid })

describe('MIRROR table', () => {
  it('is a bijection on the 4 directions for every mode', () => {
    for (const mode of MODES) {
      const images = DIRS.map((d) => MIRROR[mode][d])
      expect(new Set(images).size).toBe(4)
    }
  })

  it('mirror() is an involution for every mode', () => {
    for (const mode of MODES) {
      for (const d of DIRS) {
        expect(mirror(mirror(d, mode), mode)).toBe(d)
      }
    }
  })

  it('point = horizontal ∘ vertical', () => {
    for (const d of DIRS) {
      expect(mirror(mirror(d, 'vertical'), 'horizontal')).toBe(mirror(d, 'point'))
    }
  })
})

describe('resolveMove', () => {
  it('idles (empty path) when blocked by a wall or edge', () => {
    const s = mk('horizontal', ['#####', '#Y G#', '#E  #', '#####'])
    // Up from You(1,1) hits the top border wall.
    expect(resolveMove(s, s.you, 'up').path).toHaveLength(0)
    // Left from You(1,1) hits the left border wall.
    const left = resolveMove(s, s.you, 'left')
    expect(left.path).toHaveLength(0)
    expect(left.rest).toEqual(s.you)
  })

  it('path excludes the origin and lists entered cells in order', () => {
    const s = mk('horizontal', ['#####', '#Y G#', '#E  #', '#####'])
    const r = resolveMove(s, s.you, 'right')
    // A non-ice step advances exactly one cell.
    expect(r.path).toEqual([{ row: 1, col: 2 }])
    expect(r.rest).toEqual({ row: 1, col: 2 })
    expect(r.path).not.toContainEqual(s.you)
  })

  it('slides across ice until the first non-ice tile', () => {
    // You slides right over two ice tiles and rests on the pellet cell.
    const s = mk('horizontal', ['######', '#Y~~o#', '#E   #', '######'])
    const r = resolveMove(s, s.you, 'right')
    expect(r.path).toEqual([
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
    ])
    expect(r.rest).toEqual({ row: 1, col: 4 })
  })

  it('one-way arrow admits only the matching direction', () => {
    // Arrow '>' at (1,2). Entering rightward is allowed...
    const s = mk('horizontal', ['######', '#Y> G#', '#E   #', '######'])
    const rightIn = resolveMove(s, s.you, 'right')
    expect(rightIn.rest).toEqual({ row: 1, col: 2 })
    // ...but a token below the gate trying to move up through it is blocked.
    const g = mk('horizontal', ['######', '#Y> G#', '# E  #', '######'])
    const below = { row: 2, col: 2 }
    const up = resolveMove(g, below, 'up')
    expect(up.path).toHaveLength(0)
  })
})

describe('step', () => {
  it('moves both tokens: You by dir, Echo by the mirrored dir', () => {
    const s = mk('horizontal', ['#######', '#YG HE#', '#######'])
    const next = step(s, 'right')
    expect(next.you).toEqual({ row: 1, col: 2 }) // onto G
    expect(next.echo).toEqual({ row: 1, col: 4 }) // mirror LEFT onto H
    expect(next.moves).toBe(1)
  })

  it('lets a blocked token idle while its twin keeps moving', () => {
    // Under horizontal, LEFT drives You left (into wall → idle) and Echo right.
    const s = mk('horizontal', ['######', '#Y E #', '#G  H#', '######'])
    const next = step(s, 'left')
    expect(next).not.toBe(s)
    expect(next.you).toEqual(s.you) // idled at the left wall
    expect(next.echo).toEqual({ row: 1, col: 4 }) // Echo advanced right
    expect(next.moves).toBe(1)
  })

  it('returns the same reference when both tokens idle (no-op)', () => {
    const s = mk('horizontal', ['#####', '#Y E#', '#G H#', '#####'])
    // Up drives both tokens into the top wall.
    expect(step(s, 'up')).toBe(s)
  })

  it('collects pellets along the path (including ice-slide intermediates)', () => {
    const s = mk('horizontal', ['######', '#Y~~o#', '#E   #', '######'])
    expect(s.youPellets.has(keyOf(1, 4))).toBe(true)
    const next = step(s, 'right')
    expect(next.youPellets.size).toBe(0)
    // Original set is untouched (immutability).
    expect(s.youPellets.size).toBe(1)
  })
})

describe('win / satisfaction / stars', () => {
  it('isWon requires both goals satisfied and both pellet sets empty', () => {
    const s = mk('horizontal', ['#######', '#YG HE#', '#######'])
    expect(isWon(s)).toBe(false)
    const won = step(s, 'right')
    expect(isWon(won)).toBe(true)
  })

  it('goalSatisfaction reports per-token goal occupancy', () => {
    const s = mk('horizontal', ['#######', '#YG HE#', '#######'])
    expect(goalSatisfaction(s)).toEqual({ you: false, echo: false })
    const won = step(s, 'right')
    expect(goalSatisfaction(won)).toEqual({ you: true, echo: true })
  })

  it('starsFor honours the par boundaries', () => {
    expect(starsFor(4, 4)).toBe(3) // <= par
    expect(starsFor(5, 4)).toBe(2) // <= par + ceil(par/2)=6
    expect(starsFor(6, 4)).toBe(2)
    expect(starsFor(7, 4)).toBe(1) // beyond
    expect(starsFor(1, 1)).toBe(3)
    expect(starsFor(2, 1)).toBe(2) // par + ceil(0.5)=2
    expect(starsFor(3, 1)).toBe(1)
  })
})

describe('preview', () => {
  it('reports resting cells without mutating state', () => {
    const s = mk('horizontal', ['#######', '#YG HE#', '#######'])
    const p = preview(s, 'right')
    expect(p.you).toEqual({ row: 1, col: 2 })
    expect(p.echo).toEqual({ row: 1, col: 4 })
    // State is unchanged.
    expect(s.you).toEqual({ row: 1, col: 1 })
    const all = previewAll(s)
    expect(all.right).toEqual(p)
    expect(Object.keys(all).sort()).toEqual(['down', 'left', 'right', 'up'])
  })
})

describe('parseLevel validation', () => {
  it('throws when there is no objective', () => {
    expect(() => mk('horizontal', ['####', '#YE#', '####'])).toThrow(/objective/)
  })

  it('throws on duplicate You markers', () => {
    expect(() => mk('horizontal', ['#####', '#YYE#', '#G  #', '#####'])).toThrow(/one Y/)
  })

  it('throws on an unknown glyph', () => {
    expect(() => mk('horizontal', ['####', '#Y?#', '#EG#', '####'])).toThrow(/glyph/)
  })

  it('pads short rows with floor', () => {
    const s = mk('horizontal', ['#####', '#Y G', '#E', '#####'])
    expect(s.width).toBe(5)
    expect(s.walls[1][4]).toBe(false) // padded floor, not a wall
  })
})

describe('LEVELS + packs', () => {
  it('every level parses, is solvable, and par equals the BFS optimum', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const s = loadLevel(i)
      expect(isWon(s)).toBe(false) // never trivially won at load
      const opt = solveOptimal(s)
      expect(opt, `level ${i + 1} (${LEVELS[i].name}) solvable`).not.toBeNull()
      expect(opt, `level ${i + 1} (${LEVELS[i].name}) par`).toBe(LEVELS[i].par)
    }
  })

  it('levelCount matches the array and packs cover every level once', () => {
    expect(levelCount).toBe(LEVELS.length)
    const covered = new Set<number>()
    for (const p of PACKS) {
      expect(p.end).toBeGreaterThanOrEqual(p.start)
      for (let i = p.start; i <= p.end; i++) {
        expect(covered.has(i)).toBe(false)
        covered.add(i)
        expect(LEVELS[i].mode).toBe(p.mode)
      }
    }
    expect(covered.size).toBe(LEVELS.length)
  })

  it('each pack first level flags the flip intro', () => {
    for (const p of PACKS) {
      expect(LEVELS[p.start].intro).toBe(true)
    }
  })

  it('reset returns the level to its initial state', () => {
    const s = step(loadLevel(0), 'right')
    const r = reset(s)
    expect(r.moves).toBe(0)
    expect(r.you).toEqual(loadLevel(0).you)
  })
})

describe('rng + daily', () => {
  it('makeRng is reproducible for a given seed', () => {
    const a = makeRng(12345)
    const b = makeRng(12345)
    const seqA = Array.from({ length: 8 }, () => a())
    const seqB = Array.from({ length: 8 }, () => b())
    expect(seqA).toEqual(seqB)
    for (const v of seqA) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of seqA) expect(v).toBeLessThan(1)
  })

  it('dailySeed is stable and generateDaily is deterministic + solvable', () => {
    for (const date of ['2026-07-14', '2026-01-01', '2025-12-31']) {
      const seed = dailySeed(date)
      expect(dailySeed(date)).toBe(seed)
      const a = generateDaily(makeRng(seed))
      const b = generateDaily(makeRng(seed))
      expect(a.mode).toBe(b.mode)
      expect(a.you).toEqual(b.you)
      expect(a.echo).toEqual(b.echo)
      expect(a.youGoal).toEqual(b.youGoal)
      expect(a.echoGoal).toEqual(b.echoGoal)
      expect(a.par).toBe(b.par)
      expect(isWon(a)).toBe(false)
      expect(solveOptimal(a)).toBe(a.par)
    }
  })

  it('DELTAS are unit steps and engine.ts contains no Math.random', () => {
    expect(DELTAS.up).toEqual({ row: -1, col: 0 })
    const src = readFileSync(fileURLToPath(new URL('./engine.ts', import.meta.url)), 'utf8')
    expect(/Math\.random\s*\(/.test(src)).toBe(false)
  })
})

// Type-only usage so the Level import is exercised.
const _sample: Level = LEVELS[0]
void _sample
