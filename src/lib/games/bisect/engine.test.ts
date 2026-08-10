import { describe, expect, it, vi } from 'vitest'
import {
  GOOD_MAX,
  LIVES,
  MAX_INTERVAL,
  MAX_LEAD,
  MIN_INTERVAL,
  MIN_LEAD,
  OK_MAX,
  PERFECT_MAX,
  POINTS,
  STREAK_BONUS_PER_HIT,
  TIMEOUT_TICKS,
  arm,
  generateRound,
  gradeForNormError,
  judge,
  mulberry32,
  newGame,
  step,
  tap,
  type BisectState,
  type Rng,
} from './engine'

/** A queued-array Rng like the decant template's deterministic tests use. */
function queued(values: number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

function fixed(v: number): Rng {
  return () => v
}

describe('newGame', () => {
  it('starts idle with fresh lives/score/streak and no round', () => {
    const s = newGame()
    expect(s.phase).toBe('idle')
    expect(s.lives).toBe(LIVES)
    expect(s.score).toBe(0)
    expect(s.streak).toBe(0)
    expect(s.bestStreak).toBe(0)
    expect(s.roundsPlayed).toBe(0)
    expect(s.round).toBeNull()
    expect(s.lastEvent).toBe('none')
  })
})

describe('mulberry32', () => {
  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('generateRound — golden bounds', () => {
  it('rng() -> 0,0 yields the exact minimums', () => {
    const round = generateRound(queued([0, 0]))
    expect(round.startTick).toBe(MIN_LEAD)
    expect(round.intervalLength).toBe(MIN_INTERVAL)
    expect(round.endTick).toBe(MIN_LEAD + MIN_INTERVAL)
    expect(round.trueMid).toBe((MIN_LEAD + MIN_LEAD + MIN_INTERVAL) / 2)
  })

  it('rng() -> 0.999999,0.999999 yields the exact maximums', () => {
    const round = generateRound(fixed(0.999999))
    const expectedLead = MIN_LEAD + Math.floor(0.999999 * (MAX_LEAD - MIN_LEAD + 1))
    const expectedInterval = MIN_INTERVAL + Math.floor(0.999999 * (MAX_INTERVAL - MIN_INTERVAL + 1))
    expect(expectedLead).toBe(MAX_LEAD)
    expect(expectedInterval).toBe(MAX_INTERVAL)
    expect(round.startTick).toBe(MAX_LEAD)
    expect(round.intervalLength).toBe(MAX_INTERVAL)
    expect(round.endTick).toBe(MAX_LEAD + MAX_INTERVAL)
  })
})

describe('generateRound — rng consumption', () => {
  it('calls rng exactly twice', () => {
    const spy = vi.fn(queued([0.1, 0.2]))
    generateRound(spy)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('first value maps to lead (startTick), second to intervalLength', () => {
    // Two distinct rng outputs (one near-max, one min) so the mapping
    // direction is unambiguous: if the mapping were swapped, these
    // assertions would fail.
    const round = generateRound(queued([0.999999, 0]))
    expect(round.startTick).toBe(MAX_LEAD)
    expect(round.intervalLength).toBe(MIN_INTERVAL)

    const round2 = generateRound(queued([0, 0.999999]))
    expect(round2.startTick).toBe(MIN_LEAD)
    expect(round2.intervalLength).toBe(MAX_INTERVAL)
  })
})

describe('rng isolation: only arm() touches rng', () => {
  it('step/tap never call the rng spy after arm', () => {
    const spy = vi.fn(queued([0, 0]))
    let s = arm(newGame(), spy)
    expect(spy).toHaveBeenCalledTimes(2)
    const round = s.round!
    s = step(s, round.startTick)
    s = step(s, round.startTick + 1)
    s = tap(s, round.trueMid)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('judge — golden', () => {
  it('judge(100, 200, 150) is a dead-center perfect', () => {
    const out = judge(100, 200, 150)
    expect(out.error).toBe(0)
    expect(out.absError).toBe(0)
    expect(out.normError).toBe(0)
    expect(out.grade).toBe('perfect')
  })

  it('a small offset within PERFECT_MAX stays perfect; just beyond becomes good', () => {
    // halfInterval = 50; PERFECT_MAX*50 = 3 exactly.
    const atBoundary = judge(100, 200, 150 + 3)
    expect(atBoundary.normError).toBe(3 / 50)
    expect(atBoundary.normError).toBeLessThanOrEqual(PERFECT_MAX)
    expect(atBoundary.grade).toBe('perfect')

    const justBeyond = judge(100, 200, 150 + 4)
    expect(justBeyond.normError).toBe(4 / 50)
    expect(justBeyond.normError).toBeGreaterThan(PERFECT_MAX)
    expect(justBeyond.grade).toBe('good')
  })

  it('OK_MAX boundary: inside is ok, just beyond is miss', () => {
    // halfInterval = 50; OK_MAX*50 = 20 exactly.
    const inside = judge(100, 200, 150 + 20)
    expect(inside.normError).toBe(20 / 50)
    expect(inside.normError).toBe(OK_MAX)
    expect(inside.grade).toBe('ok')

    const beyond = judge(100, 200, 150 + 21)
    expect(beyond.normError).toBe(21 / 50)
    expect(beyond.normError).toBeGreaterThan(OK_MAX)
    expect(beyond.grade).toBe('miss')
  })

  it('GOOD_MAX boundary is included/excluded correctly', () => {
    // halfInterval = 50; GOOD_MAX*50 = 9 exactly.
    const inside = judge(100, 200, 150 + 9)
    expect(inside.normError).toBe(GOOD_MAX)
    expect(inside.grade).toBe('good')

    const beyond = judge(100, 200, 150 + 10)
    expect(beyond.normError).toBeGreaterThan(GOOD_MAX)
    expect(beyond.grade).toBe('ok')
  })

  it('is symmetric around the midpoint', () => {
    const early = judge(100, 200, 150 - 7)
    const late = judge(100, 200, 150 + 7)
    expect(early.absError).toBe(late.absError)
    expect(early.normError).toBe(late.normError)
    expect(early.grade).toBe(late.grade)
    expect(early.error).toBe(-late.error)
  })

  it('tapping exactly at startTick yields normError 1 and a miss', () => {
    const out = judge(100, 200, 100)
    expect(out.normError).toBe(1)
    expect(out.grade).toBe('miss')
  })

  it('tapping exactly at endTick yields normError 1 and a miss', () => {
    const out = judge(100, 200, 200)
    expect(out.normError).toBe(1)
    expect(out.grade).toBe('miss')
  })

  it('degenerate zero-length interval: exact tap is a perfect zero-error, any offset is Infinity/miss', () => {
    const exact = judge(100, 100, 100)
    expect(exact.absError).toBe(0)
    expect(exact.normError).toBe(0)

    const off = judge(100, 100, 105)
    expect(off.absError).toBe(5)
    expect(off.normError).toBe(Infinity)
    expect(off.grade).toBe('miss')
  })
})

describe('gradeForNormError', () => {
  it('matches the threshold table directly', () => {
    expect(gradeForNormError(0)).toBe('perfect')
    expect(gradeForNormError(PERFECT_MAX)).toBe('perfect')
    expect(gradeForNormError(PERFECT_MAX + 1e-9)).toBe('good')
    expect(gradeForNormError(GOOD_MAX)).toBe('good')
    expect(gradeForNormError(GOOD_MAX + 1e-9)).toBe('ok')
    expect(gradeForNormError(OK_MAX)).toBe('ok')
    expect(gradeForNormError(OK_MAX + 1e-9)).toBe('miss')
  })
})

describe('step — armed', () => {
  function armedState(): BisectState {
    return arm(newGame(), queued([0, 0])) // startTick=MIN_LEAD, endTick=MIN_LEAD+MIN_INTERVAL
  }

  it('tick below startTick keeps phase armed with no event', () => {
    const s = armedState()
    const next = step(s, s.round!.startTick - 1)
    expect(next.phase).toBe('armed')
    expect(next.lastEvent).toBe('none')
  })

  it('tick reaching startTick transitions to live with a start event', () => {
    const s = armedState()
    const next = step(s, s.round!.startTick)
    expect(next.phase).toBe('live')
    expect(next.lastEvent).toBe('start')
  })
})

describe('step — live', () => {
  function liveState(): BisectState {
    let s = arm(newGame(), queued([0, 0]))
    s = step(s, s.round!.startTick)
    return s
  }

  it('crossing endTick for the first time fires an end courtesy event without changing phase/lives/score', () => {
    const s = liveState()
    const round = s.round!
    const before = step(s, round.endTick - 1) // still short of end
    expect(before.lastEvent).toBe('none')
    const crossing = step(before, round.endTick)
    expect(crossing.lastEvent).toBe('end')
    expect(crossing.phase).toBe('live')
    expect(crossing.lives).toBe(s.lives)
    expect(crossing.score).toBe(s.score)
  })

  it('timing out with lives remaining resolves as a miss with lastEvent timeout', () => {
    const s = liveState()
    const round = s.round!
    const next = step(s, round.endTick + TIMEOUT_TICKS)
    expect(next.lives).toBe(LIVES - 1)
    expect(next.streak).toBe(0)
    expect(next.lastGrade).toBe('miss')
    expect(next.phase).toBe('resolved')
    expect(next.lastEvent).toBe('timeout')
  })

  it('timing out on the last life resolves as over, overriding the timeout event', () => {
    let s = liveState()
    s = { ...s, lives: 1 }
    const round = s.round!
    const next = step(s, round.endTick + TIMEOUT_TICKS)
    expect(next.lives).toBe(0)
    expect(next.phase).toBe('over')
    expect(next.lastEvent).toBe('over')
  })
})

describe('step — no-op phases', () => {
  it('is a no-op for idle/resolved/over, changing only lastEvent', () => {
    for (const phase of ['idle', 'resolved', 'over'] as const) {
      const s: BisectState = { ...newGame(), phase, lastEvent: 'perfect' }
      const next = step(s, 500)
      expect(next).toEqual({ ...s, lastEvent: 'none' })
    }
  })
})

describe('tap — false start', () => {
  it('tapping while armed burns a life and resolves as falseStart when lives remain', () => {
    const s = arm(newGame(), queued([0, 0]))
    const next = tap(s, 5)
    expect(next.lives).toBe(LIVES - 1)
    expect(next.streak).toBe(0)
    expect(next.phase).toBe('resolved')
    expect(next.lastEvent).toBe('falseStart')
    expect(next.tapTick).toBe(5)
  })

  it('a false start that drains the last life resolves as over', () => {
    let s = arm(newGame(), queued([0, 0]))
    s = { ...s, lives: 1 }
    const next = tap(s, 5)
    expect(next.lives).toBe(0)
    expect(next.phase).toBe('over')
    expect(next.lastEvent).toBe('over')
  })
})

describe('tap — live, golden hits', () => {
  it('a dead-center perfect tap on the first hit scores POINTS.perfect with no streak bonus', () => {
    let s = arm(newGame(), queued([0, 0])) // startTick=20, endTick=50, trueMid=35
    s = step(s, s.round!.startTick)
    const next = tap(s, s.round!.trueMid)
    expect(next.lastGrade).toBe('perfect')
    expect(next.score).toBe(POINTS.perfect)
    expect(next.streak).toBe(1)
    expect(next.phase).toBe('resolved')
  })

  it('a second consecutive perfect hit adds the streak bonus', () => {
    let s = arm(newGame(), queued([0, 0]))
    s = step(s, s.round!.startTick)
    s = tap(s, s.round!.trueMid)
    expect(s.score).toBe(POINTS.perfect)

    s = arm(s, queued([0, 0]))
    s = step(s, s.round!.startTick)
    const next = tap(s, s.round!.trueMid)
    expect(next.streak).toBe(2)
    const gained = next.score - POINTS.perfect
    expect(gained).toBe(POINTS.perfect + STREAK_BONUS_PER_HIT * 1)
    expect(next.score).toBe(POINTS.perfect + (POINTS.perfect + STREAK_BONUS_PER_HIT))
  })
})

describe('tap — live, miss', () => {
  it('a miss-grade tap burns a life, resets streak, and leaves score unchanged', () => {
    let s = arm(newGame(), queued([0, 0])) // startTick=20 endTick=50
    s = step(s, s.round!.startTick)
    s = { ...s, streak: 3, score: 500 } // pretend we arrived with an active streak
    const round = s.round!
    const next = tap(s, round.startTick) // normError 1 -> miss
    expect(next.lives).toBe(LIVES - 1)
    expect(next.streak).toBe(0)
    expect(next.score).toBe(500)
    expect(next.phase).toBe('resolved')
    expect(next.lastEvent).toBe('miss')
  })
})

describe('tap — no-op phases', () => {
  it('idle/resolved/over require arm()/newGame() before the next round; tap alone is a no-op', () => {
    for (const phase of ['idle', 'resolved', 'over'] as const) {
      const s: BisectState = { ...newGame(), phase, lastEvent: 'perfect' }
      const next = tap(s, 500)
      expect(next).toEqual({ ...s, lastEvent: 'none' })
    }
  })
})

describe('bestStreak persistence', () => {
  it('keeps the peak streak after a later miss resets the live streak to 0', () => {
    let s = arm(newGame(), queued([0, 0]))
    s = step(s, s.round!.startTick)
    s = tap(s, s.round!.trueMid) // perfect, streak 1
    s = arm(s, queued([0, 0]))
    s = step(s, s.round!.startTick)
    s = tap(s, s.round!.trueMid) // perfect, streak 2
    expect(s.bestStreak).toBe(2)

    s = arm(s, queued([0, 0]))
    s = step(s, s.round!.startTick)
    s = tap(s, s.round!.startTick) // miss, streak resets to 0
    expect(s.streak).toBe(0)
    expect(s.bestStreak).toBe(2)
  })
})

describe('golden full sequence — mulberry32(1), 2 hits then a miss', () => {
  it('reproduces exact phase/score/lives/streak at every step', () => {
    const rng = mulberry32(1)
    let s = newGame()

    // Round 1
    s = arm(s, rng)
    expect(s.round).toEqual({ startTick: 64, endTick: 94, intervalLength: 30, trueMid: 79 })
    s = step(s, s.round!.startTick)
    expect(s.phase).toBe('live')
    s = tap(s, s.round!.trueMid) // tap dead-center -> perfect
    expect(s.phase).toBe('resolved')
    expect(s.lastGrade).toBe('perfect')
    expect(s.score).toBe(100)
    expect(s.streak).toBe(1)
    expect(s.lives).toBe(3)

    // Round 2
    s = arm(s, rng)
    expect(s.round).toEqual({ startTick: 57, endTick: 235, intervalLength: 178, trueMid: 146 })
    s = step(s, s.round!.startTick)
    s = tap(s, s.round!.trueMid)
    expect(s.lastGrade).toBe('perfect')
    expect(s.score).toBe(210)
    expect(s.streak).toBe(2)
    expect(s.bestStreak).toBe(2)
    expect(s.lives).toBe(3)

    // Round 3 — tap at startTick (normError 1) to force a miss
    s = arm(s, rng)
    expect(s.round).toEqual({ startTick: 88, endTick: 160, intervalLength: 72, trueMid: 124 })
    s = step(s, s.round!.startTick)
    s = tap(s, s.round!.startTick)
    expect(s.lastGrade).toBe('miss')
    expect(s.score).toBe(210) // unchanged
    expect(s.streak).toBe(0)
    expect(s.bestStreak).toBe(2) // preserved
    expect(s.lives).toBe(2)
    expect(s.phase).toBe('resolved')
    expect(s.roundsPlayed).toBe(3)
  })
})

describe('over requires newGame() before the next arm()', () => {
  it('arm() on an over state is a no-op; newGame() then arm() succeeds', () => {
    let s: BisectState = { ...newGame(), phase: 'over', lives: 0 }
    const armedAttempt = arm(s, queued([0, 0]))
    expect(armedAttempt.phase).toBe('over')
    expect(armedAttempt.round).toBeNull()

    s = newGame()
    const armed = arm(s, queued([0, 0]))
    expect(armed.phase).toBe('armed')
    expect(armed.round).not.toBeNull()
    expect(armed.lives).toBe(LIVES)
  })
})
