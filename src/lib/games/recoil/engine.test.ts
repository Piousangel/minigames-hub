import { describe, expect, it } from 'vitest'
import {
  ARENA_H,
  ARENA_W,
  BANK_PTS,
  DAILY_CONFIG,
  DIFFICULTIES,
  DIRS,
  DRIFT_LIMIT,
  FP,
  SHIP_R,
  SPAWN_CLEAR,
  SPAWN_X,
  SPAWN_Y,
  STAR_MIN_SEP,
  STAR_SPAWN_MIN,
  STAR_WALL_CLEAR,
  VMAX,
  WALL_GAP,
  applyImpulse,
  createGame,
  createGameForSeed,
  createGameFromLayout,
  dailySeedFor,
  difficultyOfSeed,
  dirFromVector,
  generateLayout,
  isOver,
  mulberry32,
  predictPath,
  rotateDir,
  seedWithDifficulty,
  setAim,
  step,
  timeBonus,
  type Phase,
  type RecoilConfig,
  type RecoilInput,
  type RecoilState,
  type Rng,
} from './engine'

// ---------- helpers ----------

type UWall = { x: number; y: number; w: number; h: number }

function L(
  cfg: RecoilConfig,
  walls: UWall[],
  stars: Array<[number, number]>,
  opts: { ship?: [number, number] } = {},
): RecoilState {
  const s = createGameFromLayout(cfg, {
    walls: walls.map((w) => ({ x: w.x * FP, y: w.y * FP, w: w.w * FP, h: w.h * FP })),
    stars: stars.map(([x, y], id) => ({ id, x: x * FP, y: y * FP, taken: false, takenAt: null })),
  })
  if (opts.ship) return { ...s, x: opts.ship[0] * FP, y: opts.ship[1] * FP }
  return s
}

function run(s: RecoilState, n: number): RecoilState {
  let cur = s
  for (let i = 0; i < n; i++) cur = step(cur, null)
  return cur
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v)
  }
  return o
}

function countingRng(inner: Rng): { rng: Rng; count: () => number } {
  let n = 0
  return {
    rng: () => {
      n++
      return inner()
    },
    count: () => n,
  }
}

function seqRng(values: number[]): Rng {
  let i = 0
  return () => {
    if (i >= values.length) throw new Error('rng sequence exhausted')
    return values[i++]
  }
}

const N = DIFFICULTIES.normal
const FAR: [number, number] = [40, 40]

// ---------- tables & basics ----------

describe('DIRS table', () => {
  it('has 16 integer unit vectors with exact antipodes', () => {
    expect(DIRS).toHaveLength(16)
    for (let d = 0; d < 16; d++) {
      const [dx, dy] = DIRS[d]
      expect(Number.isInteger(dx) && Number.isInteger(dy)).toBe(true)
      const [ox, oy] = DIRS[(d + 8) % 16]
      expect(ox + dx).toBe(0)
      expect(oy + dy).toBe(0)
      const m = dx * dx + dy * dy
      expect(m).toBeGreaterThanOrEqual(255 * 255)
      expect(m).toBeLessThanOrEqual(257 * 257)
    }
  })
})

describe('dirFromVector', () => {
  it('maps cardinal / diagonal vectors', () => {
    expect(dirFromVector(1, 0)).toBe(0)
    expect(dirFromVector(0, 1)).toBe(4)
    expect(dirFromVector(-1, 0)).toBe(8)
    expect(dirFromVector(0, -1)).toBe(12)
    expect(dirFromVector(1, 1)).toBe(2)
    expect(dirFromVector(-5, -5)).toBe(10)
  })
  it('returns null for the zero vector', () => {
    expect(dirFromVector(0, 0)).toBeNull()
  })
  it('breaks exact ties toward the smaller index', () => {
    // (98,19)·DIRS[0] = 25088 = (98,19)·DIRS[1]
    expect(98 * 256).toBe(98 * 237 + 19 * 98)
    expect(dirFromVector(98, 19)).toBe(0)
  })
})

describe('rotateDir / applyImpulse / timeBonus', () => {
  it('rotateDir wraps', () => {
    expect(rotateDir(0, -1)).toBe(15)
    expect(rotateDir(15, 1)).toBe(0)
    expect(rotateDir(3, -20)).toBe(15)
  })
  it('applyImpulse clamps to VMAX', () => {
    let v = { vx: 0, vy: 0 }
    for (let i = 0; i < 5; i++) v = applyImpulse(v.vx, v.vy, 8)
    expect(v).toEqual({ vx: VMAX, vy: 0 })
    expect(VMAX).toBe(1024)
  })
  it('timeBonus', () => {
    expect(timeBonus(0)).toBe(600)
    expect(timeBonus(28)).toBe(595)
    expect(timeBonus(3600)).toBe(0)
    expect(timeBonus(9999)).toBe(0)
  })
})

// ---------- generation ----------

describe('generation', () => {
  it('is deterministic per (cfg, seed) and varies across seeds', () => {
    expect(generateLayout(N, mulberry32(42))).toEqual(generateLayout(N, mulberry32(42)))
    expect(createGame(N, 99)).toEqual(createGame(N, 99))
    const a = createGame(N, 1)
    const b = createGame(N, 2)
    expect(a.stars).not.toEqual(b.stars)
    expect(createGame(N, 12345).seed).toBe(12345)
  })

  it('honours every layout constraint for seeds 1..200', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const g = createGame(N, seed)
      const walls = g.walls.map((w) => ({ x: w.x / FP, y: w.y / FP, w: w.w / FP, h: w.h / FP }))
      for (const w of g.walls) {
        for (const v of [w.x, w.y, w.w, w.h]) expect(v % FP).toBe(0)
      }
      walls.forEach((w, i) => {
        expect(w.x % 8).toBe(0)
        expect(w.y % 8).toBe(0)
        expect(w.x).toBeGreaterThanOrEqual(16)
        expect(w.y).toBeGreaterThanOrEqual(16)
        expect(w.x + w.w).toBeLessThanOrEqual(ARENA_W - 16)
        expect(w.y + w.h).toBeLessThanOrEqual(ARENA_H - 16)
        const sx0 = SPAWN_X - SPAWN_CLEAR
        const sy0 = SPAWN_Y - SPAWN_CLEAR
        const hitsSpawn =
          w.x < sx0 + 2 * SPAWN_CLEAR && w.x + w.w > sx0 && w.y < sy0 + 2 * SPAWN_CLEAR && w.y + w.h > sy0
        expect(hitsSpawn).toBe(false)
        for (let j = 0; j < i; j++) {
          const o = walls[j]
          const tooClose =
            w.x < o.x + o.w + WALL_GAP &&
            w.x + w.w > o.x - WALL_GAP &&
            w.y < o.y + o.h + WALL_GAP &&
            w.y + w.h > o.y - WALL_GAP
          expect(tooClose).toBe(false)
        }
      })
      expect(g.stars).toHaveLength(5)
      g.stars.forEach((st, i) => {
        expect(st.x % FP).toBe(0)
        expect(st.y % FP).toBe(0)
        expect(st.id).toBe(i)
        const x = st.x / FP
        const y = st.y / FP
        expect((x - SPAWN_X) ** 2 + (y - SPAWN_Y) ** 2).toBeGreaterThanOrEqual(STAR_SPAWN_MIN ** 2)
        for (const w of walls) {
          const ddx = Math.max(w.x - x, 0, x - (w.x + w.w))
          const ddy = Math.max(w.y - y, 0, y - (w.y + w.h))
          expect(ddx * ddx + ddy * ddy).toBeGreaterThanOrEqual(STAR_WALL_CLEAR ** 2)
        }
        for (let j = 0; j < i; j++) {
          const o = g.stars[j]
          expect((x - o.x / FP) ** 2 + (y - o.y / FP) ** 2).toBeGreaterThanOrEqual(STAR_MIN_SEP ** 2)
        }
      })
    }
  })

  it('consumes rng in the documented order and count', () => {
    // walls:0 stars:1 → 2 calls: x=20+floor(.9*281)=272, y=20+floor(.5*185)=112
    const c1 = countingRng(seqRng([0.9, 0.5]))
    const l1 = generateLayout({ walls: 0, stars: 1, ammo: 12, parShots: 6 }, c1.rng)
    expect(c1.count()).toBe(2)
    expect(l1).toEqual({ walls: [], stars: [{ id: 0, x: 272 * FP, y: 112 * FP, taken: false, takenAt: null }] })

    // walls:1 stars:1 → 4 + 2 = 6 calls. h, len=40, x=16, y=16.
    const c2 = countingRng(seqRng([0.1, 0, 0, 0, 0.9, 0.5]))
    const l2 = generateLayout({ walls: 1, stars: 1, ammo: 12, parShots: 6 }, c2.rng)
    expect(c2.count()).toBe(6)
    expect(l2?.walls).toEqual([{ x: 16 * FP, y: 16 * FP, w: 40 * FP, h: 8 * FP }])
    expect(l2?.stars.map((s) => [s.x / FP, s.y / FP])).toEqual([[272, 112]])

    // vertical wall with non-zero picks (w=8 → 36 x-slots, len=72 → 16 y-slots)
    const c3 = countingRng(seqRng([0.7, 0.5, 0.99, 0.99, 0.0, 0.0]))
    const l3 = generateLayout({ walls: 1, stars: 1, ammo: 12, parShots: 6 }, c3.rng)
    // len = 40 + floor(.5*9)*8 = 72; x = 16 + floor(.99*36)*8 = 296; y = 16 + floor(.99*(224-32-72)/8+1=16)*8 = 136
    expect(l3?.walls).toEqual([{ x: 296 * FP, y: 136 * FP, w: 8 * FP, h: 72 * FP }])
    // star (20,20)
    expect(l3?.stars.map((s) => [s.x / FP, s.y / FP])).toEqual([[20, 20]])
    expect(c3.count()).toBe(6)
  })

  it('returns null for an impossible star count', () => {
    expect(generateLayout({ walls: 0, stars: 60, ammo: 12, parShots: 6 }, mulberry32(1))).toBeNull()
  })
})

// ---------- step basics ----------

describe('step basics', () => {
  it('createGame initial state', () => {
    const g = createGame(DAILY_CONFIG, 7)
    expect(g.phase).toBe('ready')
    expect(g.ammo).toBe(DAILY_CONFIG.ammo)
    expect([g.x, g.y]).toEqual([160 * 256, 112 * 256])
    expect([g.vx, g.vy]).toEqual([0, 0])
    expect([g.score, g.ticks, g.collected]).toEqual([0, 0, 0])
    expect(g.events).toEqual([])
    expect(g.lastShot).toBeNull()
  })

  it('ready + null returns the same reference', () => {
    const g = createGame(N, 3)
    expect(step(g, null)).toBe(g)
  })

  it('first shot launches the ship opposite to the aim', () => {
    const s = step(L(N, [], [FAR]), { fire: 8 })
    expect(s.phase).toBe('flying')
    expect(s.ammo).toBe(11)
    expect([s.vx, s.vy]).toEqual([256, 0])
    expect(s.x).toBe(161 * 256)
    expect(s.ticks).toBe(1)
    expect(s.events).toEqual(['fire'])
    expect(s.lastShot).toEqual({ dir: 8, tick: 1 })
    expect(s.aim).toBe(8)
  })
})

// ---------- golden scenarios ----------

describe('golden scenarios', () => {
  it('collects a star at step 28 and wins with exact score', () => {
    let s = step(L(N, [], [[200, 112]]), { fire: 8 })
    s = run(s, 26)
    expect(s.ticks).toBe(27)
    expect(s.collected).toBe(0)
    s = step(s, null)
    expect(s.x).toBe(188 * 256)
    expect(s.collected).toBe(1)
    expect(s.phase).toBe('won')
    expect(s.events).toEqual(['star', 'win'])
    expect(s.score).toBe(100 + 500 + 11 * 150 + 595)
    expect(s.score).toBe(2845)
    expect(s.stars[0].takenAt).toBe(28)
    expect(isOver(s)).toBe(true)
  })

  it('bounces off the outer wall', () => {
    let s = step(L(N, [], [FAR], { ship: [300, 112] }), { fire: 8 })
    s = run(s, 14)
    expect(s.x).toBe(315 * 256)
    s = step(s, null)
    expect(s.x).toBe(314 * 256)
    expect(s.vx).toBe(-256)
    expect(s.bounces).toBe(1)
    expect(s.bouncesSinceFire).toBe(1)
    expect(s.events).toEqual(['bounce'])
  })

  it('bounces off an interior wall', () => {
    let s = step(L(N, [{ x: 200, y: 100, w: 8, h: 24 }], [FAR], { ship: [180, 112] }), { fire: 8 })
    s = run(s, 14)
    expect(s.x).toBe(195 * 256)
    s = step(s, null)
    expect(s.x).toBe(194 * 256)
    expect(s.vx).toBe(-256)
    expect(s.events).toContain('bounce')
  })

  it('is perfectly elastic and stays inside the arena', () => {
    let s = L(N, [], [FAR])
    s = step(s, { fire: 1 })
    s = step(s, { fire: 1 })
    s = step(s, { fire: 2 })
    const ax = Math.abs(s.vx)
    const ay = Math.abs(s.vy)
    expect(ax).toBeGreaterThan(0)
    const R = SHIP_R * FP
    for (let i = 0; i < 2000; i++) {
      s = step(s, null)
      if (s.phase !== 'flying') break
      expect(Math.abs(s.vx)).toBe(ax)
      expect(Math.abs(s.vy)).toBe(ay)
      expect(s.x).toBeGreaterThanOrEqual(R)
      expect(s.x).toBeLessThanOrEqual(ARENA_W * FP - R)
      expect(s.y).toBeGreaterThanOrEqual(R)
      expect(s.y).toBeLessThanOrEqual(ARENA_H * FP - R)
    }
  })

  it('opposite shots cancel exactly', () => {
    for (const [a, b] of [
      [1, 9],
      [3, 11],
      [6, 14],
    ]) {
      let s = step(L(N, [], [FAR]), { fire: a })
      s = step(s, { fire: b })
      expect([s.vx, s.vy]).toEqual([0, 0])
    }
  })
})

// ---------- bank shots ----------

describe('bank shots', () => {
  it('a star taken after a wall bounce is a bank shot', () => {
    let s = step(L(N, [], [[250, 112], FAR], { ship: [300, 112] }), { fire: 8 })
    let guard = 0
    while (s.collected === 0 && guard++ < 200) s = step(s, null)
    const iStar = s.events.indexOf('star')
    expect(iStar).toBeGreaterThanOrEqual(0)
    expect(s.events[iStar + 1]).toBe('bank')
    expect(s.bankShots).toBe(1)
    expect(s.score).toBe(100 + BANK_PTS)
    expect(s.score).toBe(150)
  })

  it('firing again resets bouncesSinceFire; a direct hit is not a bank', () => {
    let s = step(L(N, [], [[200, 112], FAR], { ship: [300, 112] }), { fire: 8 })
    s = run(s, 15)
    expect(s.bouncesSinceFire).toBe(1)
    s = step(s, { fire: 0 })
    expect(s.bouncesSinceFire).toBe(0)
    expect(s.vx).toBe(-512)
    let guard = 0
    while (s.collected === 0 && guard++ < 200) s = step(s, null)
    expect(s.events).toContain('star')
    expect(s.events).not.toContain('bank')
    expect(s.bankShots).toBe(0)
    expect(s.score).toBe(100)
  })
})

// ---------- losing ----------

describe('losing', () => {
  it('stalled: last shot cancels all velocity', () => {
    const cfg = { ...N, ammo: 2 }
    let s = step(L(cfg, [], [FAR]), { fire: 8 })
    s = step(s, { fire: 0 })
    expect(s.phase).toBe('lost')
    expect(s.endReason).toBe('stalled')
    expect(s.ammo).toBe(0)
    expect(s.events).toEqual(['fire', 'lose'])
    expect(s.score).toBe(0)
  })

  it('drift: loses after DRIFT_LIMIT ticks with no ammo', () => {
    const cfg = { ...N, ammo: 1 }
    let s = step(L(cfg, [], [FAR]), { fire: 0 })
    expect(s.driftTicks).toBe(1)
    s = run(s, 478)
    expect(s.driftTicks).toBe(479)
    expect(s.phase).toBe('flying')
    s = step(s, null)
    expect(s.driftTicks).toBe(DRIFT_LIMIT)
    expect(s.phase).toBe('lost')
    expect(s.endReason).toBe('drift')
    expect(s.events).toContain('lose')
  })

  it('winning while drifting beats losing', () => {
    const cfg = { ...N, ammo: 1 }
    let s = step(L(cfg, [], [[200, 112]]), { fire: 8 })
    s = run(s, 27)
    expect(s.phase).toBe('won')
    expect(s.ticks).toBe(28)
    expect(s.score).toBe(100 + 500 + 0 + 595)
    expect(s.events).not.toContain('lose')
  })

  it('dry fire does nothing but emit dry', () => {
    const cfg = { ...N, ammo: 1 }
    const s1 = step(L(cfg, [], [FAR]), { fire: 8 })
    const s2 = step(s1, { fire: 4 })
    expect(s2.events[0]).toBe('dry')
    expect([s2.vx, s2.vy]).toEqual([s1.vx, s1.vy])
    expect(s2.ammo).toBe(0)
    expect(s2.shotsFired).toBe(1)
    expect(s2.aim).toBe(4)
  })
})

// ---------- terminal & purity ----------

describe('terminal states and purity', () => {
  it('won/lost states are absorbing (same reference)', () => {
    const won = run(step(L(N, [], [[200, 112]]), { fire: 8 }), 27)
    const lost = step(step(L({ ...N, ammo: 2 }, [], [FAR]), { fire: 8 }), { fire: 0 })
    for (const s of [won, lost]) {
      expect(isOver(s)).toBe(true)
      expect(step(s, { fire: 3 })).toBe(s)
      expect(step(s, null)).toBe(s)
      expect(setAim(s, 5)).toBe(s)
    }
  })

  it('step / setAim / predictPath never mutate their input', () => {
    const base = step(L(N, [{ x: 200, y: 100, w: 8, h: 24 }], [[200, 112], FAR]), { fire: 9 })
    const snap = JSON.parse(JSON.stringify(base))
    const frozen = deepFreeze(base)
    expect(() => {
      let s = frozen
      for (let i = 0; i < 300; i++) s = step(s, i % 50 === 0 ? { fire: i % 16 } : null)
      setAim(frozen, 3)
      predictPath(frozen, 5, 60)
      step(frozen, { fire: 2 })
    }).not.toThrow()
    expect(JSON.parse(JSON.stringify(frozen))).toEqual(snap)
  })

  it('setAim only changes aim and events', () => {
    const s = step(L(N, [], [FAR]), { fire: 8 })
    const a = setAim(s, 3)
    expect(a.aim).toBe(3)
    expect(a.events).toEqual(['aim'])
    expect({ ...a, aim: s.aim, events: s.events }).toEqual(s)
    expect(setAim(a, 3)).toBe(a)
    const ready = L(N, [], [FAR])
    const r2 = setAim(ready, 6)
    expect(r2.phase).toBe('ready')
    expect(r2.ticks).toBe(0)
  })

  it('predictPath matches the real step trajectory', () => {
    // Star-free in effect: a single pre-taken star can never be collected, so no win/lose interferes.
    const l0 = L(N, [{ x: 200, y: 40, w: 8, h: 80 }, { x: 40, y: 160, w: 96, h: 8 }], [FAR])
    const s0 = { ...l0, stars: l0.stars.map((st) => ({ ...st, taken: true })) }
    const path = predictPath(s0, 2, 100)
    expect(path).toHaveLength(100)
    let s = step(s0, { fire: 2 })
    expect({ x: s.x, y: s.y }).toEqual(path[0])
    for (let k = 1; k < 100; k++) {
      s = step(s, null)
      expect({ x: s.x, y: s.y }).toEqual(path[k])
    }
    // mid-flight from a moving state too
    const mid = run(step(s0, { fire: 5 }), 10)
    const p2 = predictPath(mid, 13, 50)
    let m = step(mid, { fire: 13 })
    expect({ x: m.x, y: m.y }).toEqual(p2[0])
    for (let k = 1; k < 50; k++) {
      m = step(m, null)
      expect({ x: m.x, y: m.y }).toEqual(p2[k])
    }
  })

  it('predictPath ignores d when out of ammo', () => {
    const s = step(L({ ...N, ammo: 1 }, [], [FAR]), { fire: 3 })
    expect(s.ammo).toBe(0)
    expect(predictPath(s, 5, 30)).toEqual(predictPath(s, null, 30))
    expect(predictPath(s, 5, 0)).toEqual([])
  })
})

// ---------- determinism ----------

describe('determinism', () => {
  const script = new Map<number, number>([
    [1, 3],
    [40, 11],
    [90, 6],
    [150, 0],
    [220, 13],
    [300, 8],
  ])
  function replay(): RecoilState {
    let s = createGame(DAILY_CONFIG, 20261009)
    for (let t = 1; t <= 1200; t++) {
      const d = script.get(t)
      s = step(s, d === undefined ? null : { fire: d })
      if (isOver(s)) break
    }
    return s
  }

  it('golden replay is reproducible', () => {
    const a = replay()
    const b = replay()
    expect(a).toEqual(b)
    const { x, y, vx, vy, collected, ammo, phase, score, ticks } = a
    expect({ x, y, vx, vy, collected, ammo, phase, score, ticks }).toMatchInlineSnapshot(`
      {
        "ammo": 6,
        "collected": 0,
        "phase": "flying",
        "score": 0,
        "ticks": 1200,
        "vx": 83,
        "vy": -418,
        "x": 22795,
        "y": 24113,
      }
    `)
  })

  it('fuzz: score/ammo/velocity/phase invariants hold', () => {
    const rng = mulberry32(7)
    const order: Record<Phase, number> = { ready: 0, flying: 1, won: 2, lost: 2 }
    for (let game = 0; game < 4; game++) {
      let s = createGame(DIFFICULTIES.hard, 1000 + game)
      for (let t = 0; t < 3000; t++) {
        const input: RecoilInput | null =
          s.phase === 'ready' || rng() < 0.15 ? { fire: Math.floor(rng() * 16) } : null
        const n = step(s, input)
        expect(Number.isInteger(n.score)).toBe(true)
        expect(n.score).toBeGreaterThanOrEqual(s.score)
        expect(n.ammo).toBeGreaterThanOrEqual(0)
        expect(n.ammo).toBeLessThanOrEqual(n.config.ammo)
        expect(Math.abs(n.vx)).toBeLessThanOrEqual(VMAX)
        expect(Math.abs(n.vy)).toBeLessThanOrEqual(VMAX)
        expect(order[n.phase]).toBeGreaterThanOrEqual(order[s.phase])
        if (s.phase === 'won' || s.phase === 'lost') expect(n.phase).toBe(s.phase)
        expect(n.ticks - s.ticks).toBe(n === s ? 0 : 1)
        s = n
      }
    }
  })
})

// ---------- seeds carry difficulty (1:1 challenge links) ----------

describe('seed ⇒ difficulty encoding', () => {
  it('stamps and decodes difficulty in the low 2 bits without touching the rest', () => {
    for (const raw of [0, 1, 0xdeadbeef, 0xffffffff, 123456789]) {
      for (const d of ['easy', 'normal', 'hard'] as const) {
        const seed = seedWithDifficulty(raw, d)
        expect(seed).toBeGreaterThanOrEqual(0)
        expect(seed).toBeLessThanOrEqual(0xffffffff)
        expect(difficultyOfSeed(seed)).toBe(d)
        expect(seed >>> 2).toBe(raw >>> 2)
      }
    }
    expect(difficultyOfSeed(3)).toBe('normal')
  })

  it('daily seeds are always normal and distinct per day', () => {
    const a = dailySeedFor(20261009)
    const b = dailySeedFor(20261010)
    expect(a).not.toBe(b)
    expect(difficultyOfSeed(a)).toBe('normal')
    expect(createGameForSeed(a).config).toEqual(DAILY_CONFIG)
  })

  it('createGameForSeed: same seed → identical board and rules', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const seed = seedWithDifficulty(0x9e3779b9, d)
      const a = createGameForSeed(seed)
      const b = createGameForSeed(seed)
      expect(a).toEqual(b)
      expect(a.seed).toBe(seed)
      expect(a.config).toEqual(DIFFICULTIES[d])
      expect(a).toEqual(createGame(DIFFICULTIES[d], seed))
    }
  })

  it('same seed + same (tick, shot) script → same outcome', () => {
    const seed = seedWithDifficulty(424242, 'hard')
    const script = new Map<number, number>([
      [0, 2],
      [30, 9],
      [75, 14],
      [140, 5],
      [200, 0],
    ])
    const play = () => {
      let s = createGameForSeed(seed)
      for (let t = 0; t < 900 && !isOver(s); t++) {
        const d = script.get(t)
        s = step(s, d === undefined ? null : { fire: d })
      }
      return s
    }
    expect(play()).toEqual(play())
  })
})
