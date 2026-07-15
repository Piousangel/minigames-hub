import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  BUST_FLOOR,
  RET_BASE,
  RET_FLOOR,
  RET_SPREAD,
  START_W,
  TOTAL_TICKS,
  bestPossibleW,
  buildTape,
  commit,
  currentSnapshots,
  exitCallout,
  makeRng,
  newGame,
  optimalChoices,
  snapProbOf,
  snapRetOf,
  transition,
  vol,
  type AssetTick,
  type Bucket,
  type Choice,
  type MarketTape,
  type TickerState,
} from './engine'

describe('makeRng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng(12345)
    const b = makeRng(12345)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('yields different sequences for different seeds', () => {
    const a = Array.from({ length: 10 }, makeRng(1))
    const b = Array.from({ length: 10 }, makeRng(2))
    expect(a).not.toEqual(b)
  })

  it('always yields values in [0,1)', () => {
    const r = makeRng(9)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('coerces negative / float seeds via >>> 0 (no throw, valid stream)', () => {
    expect(() => makeRng(-1)()).not.toThrow()
    expect(() => makeRng(3.7)()).not.toThrow()
    expect(makeRng(0)()).toBeGreaterThanOrEqual(0)
  })
})

describe('buildTape structure', () => {
  it('has 20 ticks of 3 assets each', () => {
    const tape = buildTape(42)
    expect(tape.ticks.length).toBe(TOTAL_TICKS)
    for (const row of tape.ticks) expect(row.length).toBe(3)
  })

  it('after value-equals the next tick before (chained state invariant)', () => {
    const tape = buildTape(777)
    for (let t = 0; t < tape.ticks.length - 1; t++) {
      for (let i = 0; i < 3; i++) {
        expect(tape.ticks[t][i].after).toEqual(tape.ticks[t + 1][i].before)
      }
    }
  })

  it('every snap resets to cold / heat 0 and cold|warming never snap', () => {
    for (let seed = 0; seed < 40; seed++) {
      const tape = buildTape(seed)
      for (const row of tape.ticks) {
        for (const a of row) {
          if (a.snapped) {
            expect(a.after.bucket).toBe('cold')
            expect(a.after.heat).toBe(0)
            expect(a.before.bucket === 'hot' || a.before.bucket === 'overheated').toBe(true)
          }
          if (a.before.bucket === 'cold' || a.before.bucket === 'warming') {
            expect(a.before.snapProb).toBe(0)
            expect(a.snapped).toBe(false)
          }
        }
      }
    }
  })

  it('ret is always clamped at or above RET_FLOOR', () => {
    for (let seed = 0; seed < 30; seed++) {
      const tape = buildTape(seed)
      for (const row of tape.ticks) for (const a of row) expect(a.ret).toBeGreaterThanOrEqual(RET_FLOOR)
    }
  })

  it('opening buckets are exactly {cold, warming, hot} for every sampled seed', () => {
    for (let seed = 0; seed < 60; seed++) {
      const tape = buildTape(seed)
      const opening = tape.ticks[0].map((a) => a.before.bucket).sort()
      expect(opening).toEqual(['cold', 'hot', 'warming'])
      // hot opens at heat 1, the others at heat 0.
      for (const a of tape.ticks[0]) {
        expect(a.before.heat).toBe(a.before.bucket === 'hot' ? 1 : 0)
      }
    }
  })

  it('before.snapProb matches snapProbOf and after.snapProb matches too', () => {
    const tape = buildTape(2024)
    for (const row of tape.ticks) {
      for (const a of row) {
        expect(a.before.snapProb).toBe(snapProbOf(a.before.bucket, a.before.heat))
        expect(a.after.snapProb).toBe(snapProbOf(a.after.bucket, a.after.heat))
      }
    }
  })

  it('is a pure function of the seed', () => {
    expect(buildTape(555)).toEqual(buildTape(555))
  })
})

describe('transition table', () => {
  it('overheated only leaves via a snap (non-snap keeps overheated, heat climbs)', () => {
    expect(transition('overheated', 4, 0.0)).toEqual({ bucket: 'overheated', heat: 5 })
    expect(transition('overheated', 4, 0.99)).toEqual({ bucket: 'overheated', heat: 5 })
  })

  it('warming can drop to cold, hold, or ignite to hot heat 1', () => {
    expect(transition('warming', 0, 0.1)).toEqual({ bucket: 'cold', heat: 0 })
    expect(transition('warming', 0, 0.4)).toEqual({ bucket: 'warming', heat: 0 })
    expect(transition('warming', 0, 0.9)).toEqual({ bucket: 'hot', heat: 1 })
  })
})

describe('commit', () => {
  it('does not mutate the input state', () => {
    const s = newGame(1)
    const snapshotBefore = JSON.stringify(s)
    commit(s, 'A')
    expect(JSON.stringify(s)).toBe(snapshotBefore)
  })

  it('CASH leaves W unchanged and records chosenRet 0', () => {
    const s = newGame(3)
    const next = commit(s, 'CASH')
    expect(next.W).toBe(START_W)
    expect(next.history[0].chosenRet).toBe(0)
    expect(next.choices).toEqual(['CASH'])
  })

  it('a chosen asset applies exactly 1+ret and grows history/choices by 1', () => {
    const s = newGame(3)
    const ret = s.tape.ticks[0][0].ret
    const next = commit(s, 'A')
    expect(next.W).toBeCloseTo(START_W * (1 + ret), 10)
    expect(next.history.length).toBe(1)
    expect(next.choices.length).toBe(1)
    expect(next.tick).toBe(1)
  })

  it('is a no-op once over / at totalTicks', () => {
    let s = newGame(5)
    for (let i = 0; i < TOTAL_TICKS; i++) s = commit(s, 'CASH')
    expect(s.over).toBe(true)
    expect(s.tick).toBe(TOTAL_TICKS)
    const again = commit(s, 'A')
    expect(again).toBe(s)
  })

  it('busts and ends immediately when W drops below BUST_FLOOR', () => {
    // Follow the worst asset each tick to drive W toward 0.
    let s: TickerState = newGame(101)
    let busted = false
    while (!s.over) {
      const row = s.tape.ticks[s.tick]
      // Pick the asset with the most negative ret to sink W fast.
      let worst: Choice = 'A'
      let worstRet = row[0].ret
      const ids: Choice[] = ['A', 'B', 'C']
      for (const id of ids) {
        const r = row[id === 'A' ? 0 : id === 'B' ? 1 : 2].ret
        if (r < worstRet) {
          worstRet = r
          worst = id
        }
      }
      s = commit(s, worst)
      if (s.busted) {
        busted = true
        break
      }
    }
    if (busted) {
      expect(s.W).toBeLessThan(BUST_FLOOR)
      expect(s.over).toBe(true)
      // The run ended early — fewer resolved ticks than TOTAL_TICKS.
      expect(s.history.length).toBeLessThan(TOTAL_TICKS)
    } else {
      // If this seed never busts, at least confirm the loop terminated cleanly.
      expect(s.over).toBe(true)
    }
  })

  it('finishes after exactly 20 ticks when not busted (all cash)', () => {
    let s = newGame(7)
    for (let i = 0; i < TOTAL_TICKS; i++) {
      expect(s.over).toBe(false)
      s = commit(s, 'CASH')
    }
    expect(s.over).toBe(true)
    expect(s.busted).toBe(false)
    expect(s.W).toBe(START_W)
  })
})

describe('currentSnapshots', () => {
  it('returns the three before snapshots for the current tick', () => {
    const s = newGame(11)
    const snaps = currentSnapshots(s)
    expect(snaps.length).toBe(3)
    expect(snaps).toEqual(s.tape.ticks[0].map((a) => a.before))
  })

  it('returns empty once over', () => {
    let s = newGame(11)
    for (let i = 0; i < TOTAL_TICKS; i++) s = commit(s, 'CASH')
    expect(currentSnapshots(s)).toEqual([])
  })
})

describe('bestPossibleW', () => {
  it('is always >= START_W (target provably beatable)', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(bestPossibleW(buildTape(seed))).toBeGreaterThanOrEqual(START_W)
    }
  })

  it('equals the product of per-tick max(1, factors), floored', () => {
    const tape = buildTape(88)
    let w = START_W
    for (const row of tape.ticks) {
      w *= Math.max(1, 1 + row[0].ret, 1 + row[1].ret, 1 + row[2].ret)
    }
    expect(bestPossibleW(tape)).toBe(Math.floor(w))
  })

  it('a full-foresight playthrough reproduces bestPossibleW exactly', () => {
    const seed = 314
    const tape = buildTape(seed)
    const opt = optimalChoices(tape)
    let s = newGame(seed)
    for (const c of opt) s = commit(s, c)
    expect(Math.floor(s.W)).toBe(bestPossibleW(tape))
  })
})

describe('optimalChoices', () => {
  it('ties resolve to CASH (an all-cold/negative tape yields CASH)', () => {
    // Hand-build a tape where every asset ret <= 0 → CASH is optimal everywhere.
    const mk = (ret: number): AssetTick => ({
      before: { bucket: 'cold', heat: 0, snapProb: 0 },
      ret,
      snapped: false,
      after: { bucket: 'cold', heat: 0, snapProb: 0 },
    })
    const tape: MarketTape = {
      seed: 0,
      totalTicks: 2,
      ticks: [
        [mk(-0.05), mk(0), mk(-0.02)],
        [mk(0), mk(-0.1), mk(-0.3)],
      ],
    }
    expect(optimalChoices(tape)).toEqual<Choice[]>(['CASH', 'CASH'])
  })
})

describe('exitCallout', () => {
  const mkAsset = (ret: number, bucket: Bucket = 'hot', snapped = false): AssetTick => ({
    before: { bucket, heat: 1, snapProb: snapProbOf(bucket, 1) },
    ret,
    snapped,
    after: { bucket: 'cold', heat: 0, snapProb: 0 },
  })

  it('returns null before the run is over', () => {
    expect(exitCallout(newGame(1))).toBeNull()
  })

  it("flags an 'early' cash exit when an asset still had room", () => {
    const tape: MarketTape = {
      seed: 0,
      totalTicks: 1,
      ticks: [[mkAsset(0.2, 'hot'), mkAsset(-0.05, 'cold'), mkAsset(-0.05, 'cold')]],
    }
    // Player chose CASH though A paid +20%.
    const s: TickerState = {
      tape,
      tick: 1,
      W: START_W,
      startW: START_W,
      history: [{ choice: 'CASH', chosenRet: 0, W: START_W, assets: tape.ticks[0] }],
      choices: ['CASH'],
      over: true,
      busted: false,
    }
    const c = exitCallout(s)
    expect(c?.kind).toBe('early')
    expect(c?.message).toContain('cash')
  })

  it("flags a 'late' hold when the player ate a snap and cash was optimal", () => {
    const tape: MarketTape = {
      seed: 0,
      totalTicks: 1,
      ticks: [[mkAsset(-0.36, 'overheated', true), mkAsset(-0.1, 'cold'), mkAsset(-0.2, 'cold')]],
    }
    const s: TickerState = {
      tape,
      tick: 1,
      W: 64,
      startW: START_W,
      history: [{ choice: 'A', chosenRet: -0.36, W: 64, assets: tape.ticks[0] }],
      choices: ['A'],
      over: true,
      busted: false,
    }
    const c = exitCallout(s)
    expect(c?.kind).toBe('late')
    expect(c?.message).toContain('snapped')
  })
})

describe('EV regression (tuned inequalities)', () => {
  // Non-snap ret expectation over uniform dRet in [0,1): base + spread * 0.5.
  const nonSnapEV = (b: Bucket) => RET_BASE[b] + RET_SPREAD[b] * 0.5

  it('warming EV > 0 (hold pays)', () => {
    // warming never snaps; EV at vol 1 is just the non-snap band midpoint.
    expect(nonSnapEV('warming') * vol(0)).toBeGreaterThan(0)
    expect(nonSnapEV('warming')).toBeCloseTo(0.05, 10)
  })

  it('hot heat 1 EV > 0 (early hot is a hold)', () => {
    const p = snapProbOf('hot', 1)
    const ev = p * snapRetOf('hot', 1) + (1 - p) * nonSnapEV('hot')
    expect(ev).toBeGreaterThan(0)
    expect(ev).toBeCloseTo(0.083, 3)
  })

  it('overheated heat >= 3 EV < 0 (bail to cash)', () => {
    for (const h of [3, 4, 5]) {
      const p = snapProbOf('overheated', h)
      const ev = p * snapRetOf('overheated', h) + (1 - p) * nonSnapEV('overheated')
      expect(p).toBeGreaterThanOrEqual(0.5)
      expect(ev).toBeLessThan(0)
    }
  })
})

describe('engine purity (no wall-clock / Math.random)', () => {
  it('the engine source contains no Math.random, Date, or performance references', () => {
    const src = fs.readFileSync(path.join(__dirname, 'engine.ts'), 'utf8')
    expect(src).not.toMatch(/Math\.random/)
    expect(src).not.toMatch(/Date\.now|new Date/)
    expect(src).not.toMatch(/performance\.now/)
  })
})
