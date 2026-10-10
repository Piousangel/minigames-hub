import { describe, expect, it } from 'vitest'
import {
  EARLY_PER_TICK,
  GAP_TICKS,
  MOVES,
  PASS_BASE,
  PERFECT_BONUS,
  STARTING_LIVES,
  WARN_TICKS,
  type Axis,
  type Cell,
  type Dir,
  type Rng,
  type ShadowfitState,
  type Vec3,
  type Wall,
  approachTicksFor,
  canonVoxels,
  cellStatuses,
  createGame,
  fitsNow,
  generateWall,
  growPolycube,
  makeWall,
  minParFor,
  mulberry32,
  multiplierFor,
  parTable,
  reduce,
  rotateVec,
  rotateVoxels,
  shadowCells,
  shadowKey,
  solveMoves,
  voxelKey,
  voxelsFor,
} from './engine'

const AXES: Axis[] = ['x', 'y', 'z']
const DIRS: Dir[] = [1, -1]
const L: Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
]
// Chiral, fully asymmetric pentacube (trivial symmetry group → 24 distinct orientations).
const ASYM: Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 0, 1],
  [-1, 0, 0],
]

const cellSet = (cs: readonly Cell[]) => new Set(cs.map((c) => `${c[0]},${c[1]}`))

/** Put an injected wall in play (approach phase, fresh orientation). */
function withWall(wall: Wall, overrides: Partial<ShadowfitState> = {}): ShadowfitState {
  const base = reduce(createGame(1), { type: 'start' })
  return {
    ...base,
    wallIndex: wall.index,
    wall,
    voxels: wall.piece,
    rotations: 0,
    distance: wall.approachTicks,
    ...overrides,
  }
}

function ticks(s: ShadowfitState, n: number): ShadowfitState {
  for (let i = 0; i < n; i++) s = reduce(s, { type: 'tick' })
  return s
}

function isFaceConnected(vs: readonly Vec3[]): boolean {
  const keys = new Set(vs.map((v) => v.join(',')))
  const seen = new Set<string>([vs[0].join(',')])
  const stack = [vs[0]]
  while (stack.length) {
    const [x, y, z] = stack.pop()!
    for (const d of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]) {
      const k = `${x + d[0]},${y + d[1]},${z + d[2]}`
      if (keys.has(k) && !seen.has(k)) {
        seen.add(k)
        stack.push([x + d[0], y + d[1], z + d[2]])
      }
    }
  }
  return seen.size === vs.length
}

describe('geometry', () => {
  it('1. rotateVec basic axes', () => {
    expect(rotateVec([0, 1, 0], 'x', 1)).toEqual([0, 0, 1])
    expect(rotateVec([1, 0, 0], 'y', 1)).toEqual([0, 0, -1])
    expect(rotateVec([1, 0, 0], 'z', 1)).toEqual([0, 1, 0])
  })

  it('2. four quarter turns are the identity on every axis/dir', () => {
    const v: Vec3 = [1, -1, 0]
    for (const a of AXES)
      for (const d of DIRS) {
        let r = v
        for (let i = 0; i < 4; i++) r = rotateVec(r, a, d)
        expect(r).toEqual(v)
      }
  })

  it('3. dir then -dir is the identity', () => {
    for (const a of AXES)
      for (const d of DIRS) {
        expect(rotateVoxels(rotateVoxels(ASYM, a, d), a, (-d) as Dir)).toEqual(canonVoxels(ASYM))
      }
  })

  it('4. rotateVoxels stays in range, keeps size, canonical, keeps origin', () => {
    for (const a of AXES)
      for (const d of DIRS) {
        const r = rotateVoxels(ASYM, a, d)
        expect(r).toHaveLength(ASYM.length)
        expect(r.flat().every((c) => c >= -1 && c <= 1)).toBe(true)
        expect(r).toEqual(canonVoxels(r))
        expect(r.some((v) => v[0] === 0 && v[1] === 0 && v[2] === 0)).toBe(true)
        expect(new Set(r.map((v) => v.join(','))).size).toBe(ASYM.length)
      }
  })

  it('5. MOVES-BFS enumerates exactly 24 orientations with histogram [1,6,11,6]', () => {
    const start = canonVoxels(ASYM)
    const dist = new Map<string, number>([[voxelKey(start), 0]])
    const queue: Vec3[][] = [start]
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i]
      const d = dist.get(voxelKey(cur))!
      for (const m of MOVES) {
        const nv = rotateVoxels(cur, m.axis, m.dir)
        const k = voxelKey(nv)
        if (!dist.has(k)) {
          dist.set(k, d + 1)
          queue.push(nv)
        }
      }
    }
    expect(dist.size).toBe(24)
    const hist = [0, 0, 0, 0]
    for (const d of dist.values()) hist[d]++
    expect(hist).toEqual([1, 6, 11, 6])
  })

  it('6. L-tricube shadows', () => {
    expect(cellSet(shadowCells(L))).toEqual(cellSet([[0, 0], [1, 0], [0, 1]]))
    expect(cellSet(shadowCells(rotateVoxels(L, 'x', 1)))).toEqual(cellSet([[0, 0], [1, 0]]))
    expect(cellSet(shadowCells(rotateVoxels(L, 'y', 1)))).toEqual(cellSet([[0, 0], [0, 1]]))
    expect(cellSet(shadowCells(rotateVoxels(L, 'z', 1)))).toEqual(cellSet([[-1, 0], [0, 0], [0, 1]]))
  })

  it('7. shadowKey is order-independent and merges z', () => {
    const a: Vec3[] = [
      [0, 0, 0],
      [0, 0, 1],
      [1, 0, -1],
    ]
    const b: Vec3[] = [a[2], a[0], a[1]]
    expect(shadowKey(a)).toBe(shadowKey(b))
    expect(shadowKey(a)).toBe('0,0;1,0')
    expect(voxelKey(a)).toBe(voxelKey(b))
    expect(shadowCells(a)).toHaveLength(2)
  })
})

describe('generation', () => {
  it('8. growPolycube: n distinct, in range, has origin, face-connected, n-1 rng calls', () => {
    for (const n of [3, 4, 5, 6]) {
      for (let s = 1; s <= 20; s++) {
        const base = mulberry32(s)
        let calls = 0
        const rng: Rng = () => {
          calls++
          return base()
        }
        const p = growPolycube(n, rng)
        expect(calls).toBe(n - 1)
        expect(p).toHaveLength(n)
        expect(new Set(p.map((v) => v.join(','))).size).toBe(n)
        expect(p.flat().every((c) => c >= -1 && c <= 1)).toBe(true)
        expect(p.some((v) => v.join(',') === '0,0,0')).toBe(true)
        expect(isFaceConnected(p)).toBe(true)
      }
    }
  })

  it('9. generateWall is deterministic and varies across indices', () => {
    expect(generateWall(777, 4)).toEqual(generateWall(777, 4))
    const keys = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const w = generateWall(777, i)
      keys.add(voxelKey(w.piece) + '|' + w.holeKey)
    }
    expect(keys.size).toBeGreaterThan(1)
  })

  it('10. every generated wall is solvable in exactly par (>=1) moves', () => {
    for (let seed = 1; seed <= 5; seed++) {
      for (let i = 0; i <= 120; i++) {
        const w = generateWall(seed, i)
        const sol = solveMoves(w.piece, w.holeKey)
        expect(sol).not.toBeNull()
        expect(sol!.length).toBe(w.par)
        expect(w.par).toBeGreaterThanOrEqual(1)
        // applying the solution really lands on the hole
        let v = w.piece
        for (const m of sol!) v = rotateVoxels(v, m.axis, m.dir)
        expect(shadowKey(v)).toBe(w.holeKey)
        expect(w.size).toBe(voxelsFor(i))
      }
    }
  })

  it('11. par respects minParFor or is the max par available', () => {
    for (let seed = 1; seed <= 5; seed++) {
      for (let i = 0; i <= 60; i++) {
        const w = generateWall(seed, i)
        const maxPar = Math.max(...parTable(w.piece).values())
        expect(w.par >= minParFor(i) || w.par === maxPar).toBe(true)
      }
    }
  })

  it('12. schedules are monotone and bounded', () => {
    expect(approachTicksFor(0)).toBe(70)
    for (let i = 0; i < 200; i++) {
      expect(voxelsFor(i + 1)).toBeGreaterThanOrEqual(voxelsFor(i))
      expect(voxelsFor(i)).toBeGreaterThanOrEqual(3)
      expect(voxelsFor(i)).toBeLessThanOrEqual(6)
      expect(approachTicksFor(i + 1)).toBeLessThanOrEqual(approachTicksFor(i))
      expect(approachTicksFor(i)).toBeGreaterThanOrEqual(18)
    }
  })

  it('13. multiplierFor', () => {
    expect(multiplierFor(1)).toBe(1)
    expect(multiplierFor(2)).toBe(1)
    expect(multiplierFor(3)).toBe(2)
    expect(multiplierFor(6)).toBe(3)
    expect(multiplierFor(9)).toBe(4)
    expect(multiplierFor(30)).toBe(4)
  })

  it('makeWall throws on an unreachable hole', () => {
    expect(() => makeWall(0, L, [[-1, -1], [1, 1]])).toThrow()
  })
})

describe('reducer', () => {
  it('14. createGame initial state', () => {
    const s = createGame(42)
    expect(s.phase).toBe('ready')
    expect(s.lives).toBe(STARTING_LIVES)
    expect(s.score).toBe(0)
    expect(s.voxels).toEqual(s.wall.piece)
    expect(s.distance).toBe(s.wall.approachTicks)
    expect(s.lastEvent).toBe('none')
    expect(s.lastResult).toBeNull()
  })

  it('15. ready ignores tick/rotate; start enters approach', () => {
    const s = createGame(42)
    const t = reduce(s, { type: 'tick' })
    expect(t.distance).toBe(s.distance)
    expect(t.phase).toBe('ready')
    const r = reduce(s, { type: 'rotate', axis: 'x', dir: 1 })
    expect(r.lastEvent).toBe('blocked')
    expect(r.voxels).toEqual(s.voxels)
    expect(r.rotations).toBe(0)
    const st = reduce(s, { type: 'start' })
    expect(st.phase).toBe('approach')
    expect(st.lastEvent).toBe('start')
    expect(s.phase).toBe('ready') // input untouched
  })

  it('16. rotate in approach changes voxels, counts, keeps distance', () => {
    const s = reduce(createGame(42), { type: 'start' })
    const r = reduce(s, { type: 'rotate', axis: 'z', dir: 1 })
    expect(r.voxels).toEqual(rotateVoxels(s.voxels, 'z', 1))
    expect(r.rotations).toBe(1)
    expect(r.distance).toBe(s.distance)
    expect(r.lastEvent).toBe('rotate')
  })

  it('17. tick decrements distance and warns at WARN_TICKS', () => {
    let s = reduce(createGame(42), { type: 'start' })
    const d0 = s.distance
    s = reduce(s, { type: 'tick' })
    expect(s.distance).toBe(d0 - 1)
    expect(s.lastEvent).toBe('tick')
    expect(s.totalTicks).toBe(1)
    s = ticks(s, d0 - 1 - WARN_TICKS)
    expect(s.distance).toBe(WARN_TICKS)
    expect(s.lastEvent).toBe('warn')
  })

  it('18. correct orientation at timeout passes with early=0', () => {
    const wall = makeWall(0, L, [[0, 0], [1, 0]]) // X+ shadow, par 1
    expect(wall.par).toBe(1)
    let s = withWall(wall)
    s = reduce(s, { type: 'rotate', axis: 'x', dir: 1 })
    expect(fitsNow(s)).toBe(true)
    s = ticks(s, wall.approachTicks)
    expect(s.lastEvent).toBe('perfect')
    expect(s.phase).toBe('resolve')
    expect(s.lastResult).toEqual({ wallIndex: 0, passed: true, early: 0, perfect: true, mult: 1, gain: PASS_BASE + PERFECT_BONUS })
    expect(s.score).toBe(150)

    // non-perfect variant: 3 rotations → 'pass', gain exactly PASS_BASE
    let t = withWall(wall)
    t = reduce(t, { type: 'rotate', axis: 'x', dir: 1 })
    t = reduce(t, { type: 'rotate', axis: 'y', dir: 1 })
    t = reduce(t, { type: 'rotate', axis: 'y', dir: -1 })
    t = ticks(t, wall.approachTicks)
    expect(t.lastEvent).toBe('pass')
    expect(t.lastResult!.gain).toBe(PASS_BASE)
  })

  it('19. early drop adds 5 per remaining tick', () => {
    const wall = makeWall(0, L, [[0, 0], [1, 0]])
    let s = withWall(wall)
    s = reduce(s, { type: 'rotate', axis: 'x', dir: 1 })
    s = ticks(s, 20)
    const d = s.distance
    s = reduce(s, { type: 'drop' })
    expect(s.lastResult!.early).toBe(d)
    expect(s.lastResult!.gain).toBe(PASS_BASE + EARLY_PER_TICK * d + PERFECT_BONUS)
  })

  it('20. wrong drop crashes', () => {
    let s = withWall(makeWall(0, L, [[0, 0], [1, 0]]), { streak: 4, score: 999 })
    s = reduce(s, { type: 'drop' })
    expect(s.lastEvent).toBe('crash')
    expect(s.lives).toBe(STARTING_LIVES - 1)
    expect(s.streak).toBe(0)
    expect(s.score).toBe(999)
    expect(s.lastResult!.gain).toBe(0)
    expect(s.phase).toBe('resolve')
  })

  it('21. perfect only when rotations === par', () => {
    const wall = makeWall(0, L, [[0, 0], [1, 0]])
    const p = reduce(reduce(withWall(wall), { type: 'rotate', axis: 'x', dir: 1 }), { type: 'drop' })
    expect(p.lastEvent).toBe('perfect')
    expect(p.perfects).toBe(1)
    let w = withWall(wall)
    w = reduce(w, { type: 'rotate', axis: 'x', dir: 1 })
    w = reduce(w, { type: 'rotate', axis: 'x', dir: -1 })
    w = reduce(w, { type: 'rotate', axis: 'x', dir: 1 })
    w = reduce(w, { type: 'drop' })
    expect(w.lastEvent).toBe('pass')
    expect(w.perfects).toBe(0)
    expect(p.lastResult!.gain - w.lastResult!.gain).toBe(PERFECT_BONUS)
  })

  it('22. resolve blocks input; GAP_TICKS advances to next wall', () => {
    let s = reduce(createGame(9), { type: 'start' })
    s = reduce(s, { type: 'rotate', axis: 'y', dir: 1 })
    s = reduce(s, { type: 'drop' })
    expect(s.phase).toBe('resolve')
    const b = reduce(s, { type: 'rotate', axis: 'x', dir: 1 })
    expect(b.lastEvent).toBe('blocked')
    expect(b.voxels).toEqual(s.voxels)
    expect(reduce(s, { type: 'drop' }).lastEvent).toBe('blocked')
    s = ticks(s, GAP_TICKS - 1)
    expect(s.phase).toBe('resolve')
    s = reduce(s, { type: 'tick' })
    expect(s.lastEvent).toBe('next')
    expect(s.wallIndex).toBe(1)
    expect(s.rotations).toBe(0)
    expect(s.voxels).toEqual(generateWall(9, 1).piece)
    expect(s.distance).toBe(approachTicksFor(1))
    expect(s.phase).toBe('approach')
  })

  it('23. three crashes end the run; over is inert', () => {
    let s = reduce(createGame(5), { type: 'start' })
    for (let i = 0; i < 3; i++) {
      s = reduce(s, { type: 'drop' })
      if (i < 2) {
        expect(s.lastEvent).toBe('crash')
        s = ticks(s, GAP_TICKS)
      }
    }
    expect(s.lastEvent).toBe('over')
    expect(s.phase).toBe('over')
    expect(s.lives).toBe(0)
    for (const a of [
      { type: 'tick' },
      { type: 'rotate', axis: 'x', dir: 1 },
      { type: 'drop' },
      { type: 'start' },
    ] as const) {
      expect(reduce(s, a)).toEqual(s)
    }
  })

  it('24. new resets to createGame(seed)', () => {
    let s = reduce(createGame(5), { type: 'start' })
    s = reduce(s, { type: 'drop' })
    expect(reduce(s, { type: 'new', seed: 31337 })).toEqual(createGame(31337))
  })

  it('cellStatuses maps hole/shadow to the 3x3 screen grid', () => {
    const wall = makeWall(0, L, [[0, 0], [1, 0]])
    const s = withWall(wall) // shadow {(0,0),(1,0),(0,1)}
    const st = cellStatuses(s)
    expect(st).toHaveLength(9)
    // row 0 (y=1): (−1,1) solid, (0,1) collide, (1,1) solid
    expect(st.slice(0, 3)).toEqual(['solid', 'collide', 'solid'])
    // row 1 (y=0): (−1,0) solid, (0,0) fit, (1,0) fit
    expect(st.slice(3, 6)).toEqual(['solid', 'fit', 'fit'])
    expect(st.slice(6, 9)).toEqual(['solid', 'solid', 'solid'])
    const r = reduce(s, { type: 'rotate', axis: 'z', dir: 1 }) // shadow {(-1,0),(0,0),(0,1)}
    expect(cellStatuses(r).slice(3, 6)).toEqual(['collide', 'fit', 'open'])
  })
})

describe('golden', () => {
  function runGolden(): ShadowfitState {
    let s = reduce(createGame(12345), { type: 'start' })
    for (let w = 0; w < 5; w++) {
      const sol = solveMoves(s.voxels, s.wall.holeKey)!
      for (const m of sol) s = reduce(s, { type: 'rotate', axis: m.axis, dir: m.dir })
      s = reduce(s, { type: 'drop' })
      s = ticks(s, GAP_TICKS)
    }
    for (let i = 0; i < 3; i++) {
      s = reduce(s, { type: 'drop' })
      if (s.phase !== 'over') s = ticks(s, GAP_TICKS)
    }
    return s
  }

  it('25. seed 12345 scripted run', () => {
    const s = runGolden()
    expect(s.score).toBe(3810)
    expect(s.passed).toBe(5)
    expect(s.perfects).toBe(5)
    expect(s.bestStreak).toBe(5)
    expect(s.lives).toBe(0)
    expect(s.phase).toBe('over')
    expect(s.wallIndex).toBe(7)
    expect(runGolden()).toEqual(s)
  })

  it('26. pinned wall 0 for seed 12345', () => {
    const w = generateWall(12345, 0)
    expect(w.piece).toEqual([
      [0, -1, 0],
      [0, 0, 0],
      [0, 0, 1],
    ])
    expect(w.hole).toEqual([
      [0, -1],
      [0, 0],
      [1, 0],
    ])
    expect(w.par).toBe(1)
    expect(w.holeKey).toBe('0,-1;0,0;1,0')
    expect(w.approachTicks).toBe(70)
  })
})
