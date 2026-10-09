import { describe, expect, it } from 'vitest'
import {
  CLEAR_BEATS,
  GRACE_BEATS,
  LANES,
  VIEW,
  applyCommand,
  beatMs,
  bpmForBeat,
  createGame,
  delayForBeat,
  emptyRow,
  generateRow,
  isCleared,
  isFatal,
  isGrowBeat,
  isInputLocked,
  mulberry32,
  nextReach,
  predictPath,
  reduce,
  rngFromState,
  stageForBeat,
  type Cell,
  type Cmd,
  type LagAction,
  type LagState,
  type Rng,
  type Row,
} from './engine'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const E = (): Row => emptyRow()
/** Row with walls in the given lanes. */
const W = (...lanes: number[]): Row => {
  const r = emptyRow()
  for (const l of lanes) r[l] = 'wall'
  return r
}
/** Row with hurdles in the given lanes. */
const H = (...lanes: number[]): Row => {
  const r = emptyRow()
  for (const l of lanes) r[l] = 'hurdle'
  return r
}

/** A 'running' state with hand-made ahead rows (rest empty) and optional overrides. */
function withAhead(rows: Row[], over: Partial<LagState> = {}): LagState {
  const base = createGame(1)
  const ahead: Row[] = []
  for (let k = 0; k < VIEW; k++) ahead.push(rows[k] ?? E())
  return { ...base, status: 'running', ahead, reach: [true, true, true, true, true], ...over }
}

function run(s: LagState, actions: LagAction[]): LagState {
  return actions.reduce(reduce, s)
}

const tick: LagAction = { type: 'tick' }
const input = (cmd: Cmd): LagAction => ({ type: 'input', cmd })

/** Rng from a fixed list that records consumption. */
function scripted(values: number[]): { rng: Rng; used: () => number } {
  let i = 0
  return {
    rng: () => {
      const v = values[i % values.length]
      i++
      return v
    },
    used: () => i,
  }
}

// ---------------------------------------------------------------------------
// determinism + generation
// ---------------------------------------------------------------------------

describe('determinism and generation', () => {
  it('1. createGame is a pure function of the seed', () => {
    expect(createGame(42)).toEqual(createGame(42))
    const a = createGame(42)
    const b = createGame(43)
    expect(a.rngState !== b.rngState || JSON.stringify(a.ahead) !== JSON.stringify(b.ahead)).toBe(true)
  })

  it('2. same seed + same 300-action script → identical final state', () => {
    const pattern: LagAction[] = [input('left'), tick, input('right'), tick, tick, input('jump'), tick, input('stay'), tick, tick]
    const script: LagAction[] = []
    while (script.length < 300) script.push(...pattern)
    script.length = 300
    const a = run(reduce(createGame(7), { type: 'start' }), script)
    const b = run(reduce(createGame(7), { type: 'start' }), script)
    expect(a).toEqual(b)
  })

  it('2b. challenge replay: a seed alone fixes the whole map, so identical play gives identical scores', () => {
    // Two "players" on the same seed who never press anything see the same rows and die on the same beat.
    const idle = (seed: number) => {
      let s = reduce(createGame(seed), { type: 'start' })
      const rows: string[] = []
      for (let i = 0; i < 500 && s.status === 'running'; i++) {
        s = reduce(s, { type: 'tick' })
        rows.push(s.current.join(','))
      }
      return { beat: s.beat, status: s.status, rows }
    }
    for (const seed of [0, 1, 123456, 0xffffffff]) expect(idle(seed)).toEqual(idle(seed))
    // 'new' with the same seed resets to exactly the fresh game (rematch path).
    const played = run(reduce(createGame(99), { type: 'start' }), [input('left'), tick, tick, tick, tick])
    expect(reduce(played, { type: 'new', seed: 99 })).toEqual(createGame(99))
  })

  it('3. mulberry32 and rngFromState yield the same sequence', () => {
    const m = mulberry32(7)
    const { rng, state } = rngFromState(7)
    for (let i = 0; i < 5; i++) {
      const v = m()
      expect(v).toBe(rng())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    // resuming from the accumulator continues the same stream
    const resumed = rngFromState(state()).rng
    expect(resumed()).toBe(m())
  })

  it('4. grace rows (absolute beats 1..8) are empty', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const g = createGame(seed)
      for (let k = 0; k < GRACE_BEATS; k++) expect(g.ahead[k]).toEqual(E())
      expect(g.ahead).toHaveLength(VIEW)
    }
  })

  it('5. grace rows consume no rng; a gap roll consumes exactly one', () => {
    const reach = [false, false, true, false, false]
    const c1 = scripted([0.99])
    const g1 = generateRow(reach, 5, c1.rng)
    expect(c1.used()).toBe(0)
    expect(g1.row).toEqual(E())

    const c2 = scripted([0.0])
    const g2 = generateRow(reach, 9, c2.rng)
    expect(c2.used()).toBe(1)
    expect(g2.row).toEqual(E())
  })

  it('6. per-cell rng order: lane roll then kind roll', () => {
    const c = scripted([0.9, 0.0, 0.0, 0.9, 0.2, 0.9])
    const g = generateRow([false, false, true, false, false], 9, c.rng)
    expect(c.used()).toBe(4) // r1, r2(count=1), lane, kind
    expect(g.row).toEqual(W(0))
    expect(g.reach.some(Boolean)).toBe(true)
  })

  it('7. an always-blocking rng falls back to an empty row after MAX_ROW_ATTEMPTS', () => {
    // stage 2 (beat 65): count = 1 + floor(.99*3) = 3; lanes cycle 1,2,3, all walls
    const c = scripted([0.99, 0.99, 0.2, 0.99, 0.4, 0.99, 0.6, 0.99])
    expect(stageForBeat(65)).toBe(2)
    const g = generateRow([false, false, true, false, false], 65, c.rng)
    expect(c.used()).toBe(8 * 8)
    expect(g.row).toEqual(E())
    expect(g.reach).toEqual([false, true, true, true, false])
  })

  it('8. 50 seeds × 400 beats: reach never empties and an oracle bot survives every beat', () => {
    const N = 400
    for (let seed = 1; seed <= 50; seed++) {
      const s0 = createGame(seed * 7919)
      // rows for beats 1..N+VIEW, generated exactly as the game does
      const { rng } = rngFromState(s0.seed)
      const rows: Row[] = [E()] // index 0 unused
      let reach: boolean[] = [false, false, true, false, false]
      for (let b = 1; b <= N + VIEW; b++) {
        const g = generateRow(reach, b, rng)
        expect(g.reach.some(Boolean)).toBe(true)
        rows.push(g.row)
        reach = g.reach
      }
      expect(rows.slice(1, VIEW + 1)).toEqual(s0.ahead)

      // backward DP: good[b][x] = standing in lane x after beat b leads to survival through N
      const forced = (b: number) => b <= 3 || isGrowBeat(b)
      const cmds: Cmd[] = ['stay', 'left', 'right', 'jump']
      const good: boolean[][] = Array.from({ length: N + 1 }, () => Array<boolean>(LANES).fill(false))
      good[N].fill(true)
      const choice: Cmd[][] = Array.from({ length: N + 1 }, () => Array<Cmd>(LANES).fill('stay'))
      for (let b = N - 1; b >= 0; b--) {
        for (let x = 0; x < LANES; x++) {
          for (const c of forced(b + 1) ? (['stay'] as Cmd[]) : cmds) {
            const to = applyCommand(x, c).lane
            if (!isFatal(rows[b + 1][to], c) && good[b + 1][to]) {
              good[b][x] = true
              choice[b][x] = c
              break
            }
          }
        }
      }
      expect(good[0][2]).toBe(true)
      const plan: Cmd[] = [] // plan[b] = command executed on beat b
      let lane = 2
      for (let b = 0; b < N; b++) {
        plan[b + 1] = choice[b][lane]
        lane = applyCommand(lane, plan[b + 1]).lane
      }

      // Bot: feed each input so that it lands on the beat that needs it.
      let s = reduce(s0, { type: 'start' })
      for (let n = 1; n <= N; n++) {
        if (!isInputLocked(s)) {
          const e = execBeat(n, s.queue.length)
          if (e <= N) s = reduce(s, input(plan[e]))
        }
        s = reduce(s, tick)
        expect(s.status).toBe('running')
        expect(s.reach.some(Boolean)).toBe(true)
      }
      expect(s.beat).toBe(N)
    }
  })
})

/** Beat on which an input given before tick n executes (mirrors the queue rules). */
function execBeat(n: number, queueLen: number): number {
  let len = queueLen
  let idx: number
  if (len < delayForBeat(n)) {
    idx = len
    len += 1
  } else {
    idx = len - 1
  }
  for (let m = n + 1; ; m++) {
    const d = delayForBeat(m)
    if (len < d) {
      len += 1 // grow: no shift
      continue
    }
    if (idx === 0) return m
    idx -= 1
    if (len > d) len -= 1
  }
}

// ---------------------------------------------------------------------------
// queue + delay
// ---------------------------------------------------------------------------

describe('queue and delay', () => {
  const running = () => reduce(createGame(5), { type: 'start' })

  it('9. explicit stay keeps lane 2 and queue length 3', () => {
    let s = reduce(running(), input('stay'))
    for (let i = 0; i < 3; i++) {
      s = reduce(s, tick)
      expect(s.lane).toBe(2)
      expect(s.queue).toHaveLength(3)
    }
  })

  it('10. golden A: left is queued at the tail', () => {
    const s = run(running(), [input('left'), tick])
    expect(s.lastTick?.cmd).toBe('stay')
    expect(s.queue).toEqual(['stay', 'stay', 'left'])
    expect(s.lane).toBe(2)
  })

  it('11. golden B: the left lands exactly 3 beats later', () => {
    let s = run(running(), [input('left'), tick])
    s = run(s, [tick, tick])
    expect(s.lane).toBe(2)
    s = reduce(s, tick)
    expect(s.lane).toBe(1)
    expect(s.lastEvent).toBe('move')
    expect(s.beat).toBe(4)
    expect(s.lastTick?.beat).toBe(4)
  })

  it('12. golden C: dodging a wall requires queuing 3 beats early', () => {
    const rows = [E(), E(), E(), W(2)]
    const dodged = run(withAhead(rows), [input('left'), tick, tick, tick, tick])
    expect(dodged.status).toBe('running')
    expect(dodged.beat).toBe(4)
    expect(dodged.lane).toBe(1)

    const hit = run(withAhead(rows), [tick, tick, tick, tick])
    expect(hit.status).toBe('dead')
    expect(hit.beat).toBe(3)
    expect(hit.deathCause).toBe('wall')
    expect(hit.lastEvent).toBe('dead')
  })

  it('13. golden D: hurdles need a jump', () => {
    const rows = [E(), E(), E(), H(2)]
    const jumped = run(withAhead(rows), [input('jump'), tick, tick, tick, tick])
    expect(jumped.status).toBe('running')
    expect(jumped.lastEvent).toBe('jump')
    expect(jumped.lane).toBe(2)

    const fell = run(withAhead(rows), [input('stay'), tick, tick, tick, tick])
    expect(fell.status).toBe('dead')
    expect(fell.deathCause).toBe('hurdle')
  })

  it('14. last input within a beat wins', () => {
    const s = run(running(), [input('right'), input('left'), input('jump')])
    expect(s.pending).toBe('jump')
    expect(reduce(s, tick).queue).toEqual(['stay', 'stay', 'jump'])
  })

  it('15. left at lane 0 bumps', () => {
    const s = reduce(withAhead([], { lane: 0, queue: ['left', 'stay', 'stay'] }), tick)
    expect(s.lane).toBe(0)
    expect(s.lastTick?.bumped).toBe(true)
    expect(s.lastEvent).toBe('bump')
    expect(applyCommand(4, 'right')).toEqual({ lane: 4, bumped: true })
    expect(applyCommand(2, 'jump')).toEqual({ lane: 2, bumped: false })
  })

  it('16. delayForBeat schedule', () => {
    for (const b of [1, 128, 144, 161]) expect(delayForBeat(b)).toBe(3)
    for (const b of [145, 160, 177]) expect(delayForBeat(b)).toBe(4)
    for (let b = 1; b <= 144; b++) expect(delayForBeat(b)).toBe(3)
    expect(isGrowBeat(145)).toBe(true)
    expect(isGrowBeat(146)).toBe(false)
  })

  it('17. grow beat: queue lengthens, forced stay, head not shifted', () => {
    const s0 = withAhead([], { beat: 144, queue: ['left', 'right', 'jump'] })
    const s = run(s0, [input('right'), tick])
    expect(s.queue).toEqual(['left', 'right', 'jump', 'right'])
    expect(s.lastTick?.cmd).toBe('stay')
    expect(s.lastEvent).toBe('delay-up')
    expect(s.lane).toBe(2)
  })

  it('18. shrink beat: input locked, queue shortens, head executes', () => {
    const s0 = withAhead([], { beat: 160, queue: ['right', 'stay', 'left', 'jump'] })
    expect(isInputLocked(s0)).toBe(true)
    const locked = reduce(s0, input('left'))
    expect(locked.lastEvent).toBe('locked')
    expect(locked.pending).toBeNull()
    const s = reduce(locked, tick)
    expect(s.queue).toEqual(['stay', 'left', 'jump'])
    expect(s.lastTick?.cmd).toBe('right')
    expect(s.lastTick?.inputDropped).toBe(false)
    expect(s.lane).toBe(3)
    expect(s.lastEvent).toBe('delay-down')
  })

  it('19. queue length stays 3 or 4 across delay transitions', () => {
    let s = withAhead([], { beat: 130 })
    const pattern: Cmd[] = ['left', 'right', 'stay', 'jump']
    for (let i = 0; i < 300; i++) {
      // keep the field clear so the run survives — we only care about the queue
      s = { ...s, ahead: s.ahead.map(() => E()) }
      s = reduce(s, input(pattern[i % 4]))
      s = reduce(s, tick)
      expect(s.status).toBe('running')
      expect([3, 4]).toContain(s.queue.length)
      expect(Math.abs(s.queue.length - delayForBeat(s.beat + 1))).toBeLessThanOrEqual(1)
      expect(s.ahead).toHaveLength(VIEW)
      expect(s.lane).toBeGreaterThanOrEqual(0)
      expect(s.lane).toBeLessThanOrEqual(4)
    }
    expect(s.beat).toBe(430)
  })
})

// ---------------------------------------------------------------------------
// status + events
// ---------------------------------------------------------------------------

describe('status and events', () => {
  it('20. tick in ready does nothing', () => {
    const g = createGame(3)
    const s = reduce(g, tick)
    expect(s.lastEvent).toBe('none')
    expect(s.beat).toBe(0)
    expect(s.status).toBe('ready')
    expect(s.ahead).toEqual(g.ahead)
  })

  it('21. input in ready starts the run and queues', () => {
    const s = reduce(createGame(3), input('left'))
    expect(s.status).toBe('running')
    expect(s.pending).toBe('left')
    expect(s.lastEvent).toBe('queued')
  })

  it('22. dead is terminal and the fatal tick consumes no rng', () => {
    const before = withAhead([W(2)])
    const dead = reduce(before, tick)
    expect(dead.status).toBe('dead')
    expect(dead.beat).toBe(0)
    expect(dead.rngState).toBe(before.rngState)
    expect(dead.ahead).toEqual(before.ahead)
    const t = reduce(dead, tick)
    const i = reduce(dead, input('left'))
    expect(t).toEqual({ ...dead, lastEvent: 'none' })
    expect(i).toEqual({ ...dead, lastEvent: 'none' })
  })

  it('23. crossing beat 32 → 33 raises the stage', () => {
    const s = reduce(withAhead([], { beat: 32 }), tick)
    expect(s.lastEvent).toBe('stage')
    expect(bpmForBeat(33)).toBe(104)
    expect(stageForBeat(32)).toBe(0)
    expect(stageForBeat(33)).toBe(1)
  })

  it('24. predictPath simulates the committed queue without mutating', () => {
    const s = withAhead([E(), W(0)], { lane: 1, queue: ['left', 'left', 'right'] })
    const snapshot = JSON.parse(JSON.stringify(s)) as LagState
    const p = predictPath(s)
    expect(p.map((x) => x.lane)).toEqual([0, 0, 1])
    expect(p.map((x) => x.cmd)).toEqual(['left', 'left', 'right'])
    expect(p.map((x) => x.fatal)).toEqual([false, true, false])
    expect(p.map((x) => x.beat)).toEqual([1, 2, 3])
    expect(s).toEqual(snapshot)
  })

  it('isCleared boundary, beatMs, isFatal and nextReach rules', () => {
    expect(isCleared(withAhead([], { beat: CLEAR_BEATS - 1 }))).toBe(false)
    expect(isCleared(withAhead([], { beat: CLEAR_BEATS }))).toBe(true)
    expect(beatMs(1)).toBe(625)
    for (let b = 2; b < 400; b++) expect(beatMs(b)).toBeLessThanOrEqual(beatMs(b - 1))
    const cells: Cell[] = ['empty', 'wall', 'hurdle']
    expect(cells.map((c) => isFatal(c, 'jump'))).toEqual([false, true, false])
    expect(cells.map((c) => isFatal(c, 'left'))).toEqual([false, true, true])
    // a hurdle is only reachable from its own lane (jumping never changes lane)
    expect(nextReach([false, true, false, false, false], H(2))).toEqual([true, true, false, false, false])
    expect(nextReach([false, false, true, false, false], H(2))).toEqual([false, true, true, true, false])
  })
})
