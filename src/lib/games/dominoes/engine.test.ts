import { describe, it, expect } from 'vitest'
import {
  type State,
  type Tile,
  HAND_SIZE,
  aiMove,
  canPlay,
  deal,
  draw,
  handPips,
  hasPlay,
  isDouble,
  makeSet,
  mulberry32,
  pass,
  pips,
  play,
  playableTiles,
  shuffle,
} from './engine'

const SEED = 12345

/** Build a playing State with sensible defaults, overridable per-field. */
function mkState(over: Partial<State> = {}): State {
  return {
    hands: [[], []],
    line: [],
    leftEnd: -1,
    rightEnd: -1,
    boneyard: [],
    turn: 0,
    status: 'playing',
    winner: null,
    passes: 0,
    ...over,
  }
}

const key = (t: Tile) => `${t[0]}-${t[1]}`

describe('tile set', () => {
  it('makeSet is 28 tiles', () => {
    expect(makeSet()).toHaveLength(28)
  })

  it('makeSet tiles are all unique unordered pairs 0-0..6-6', () => {
    const set = makeSet()
    const keys = new Set(set.map(key))
    expect(keys.size).toBe(28)
    expect(keys.has('0-0')).toBe(true)
    expect(keys.has('6-6')).toBe(true)
    expect(keys.has('3-6')).toBe(true)
    // canonical order: a <= b, both within 0..6
    for (const [a, b] of set) {
      expect(a).toBeLessThanOrEqual(b)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(6)
    }
  })

  it('the set contains exactly 7 doubles', () => {
    expect(makeSet().filter(isDouble)).toHaveLength(7)
  })

  it('pips sums both faces', () => {
    expect(pips([3, 4])).toBe(7)
    expect(pips([0, 0])).toBe(0)
    expect(pips([6, 6])).toBe(12)
  })

  it('shuffle keeps the same multiset of tiles', () => {
    const shuffled = shuffle(makeSet(), mulberry32(SEED))
    expect(shuffled).toHaveLength(28)
    const keys = new Set(shuffled.map(key))
    expect(keys.size).toBe(28)
  })

  it('shuffle does not mutate its input', () => {
    const set = makeSet()
    const snapshot = JSON.stringify(set)
    shuffle(set, mulberry32(SEED))
    expect(JSON.stringify(set)).toBe(snapshot)
  })

  it('shuffle is deterministic for a fixed seed', () => {
    const a = shuffle(makeSet(), mulberry32(SEED))
    const b = shuffle(makeSet(), mulberry32(SEED))
    expect(a).toEqual(b)
  })
})

describe('deal', () => {
  it('deals 7 / 7 / 14 with an empty line, turn 0', () => {
    const s = deal(mulberry32(SEED))
    expect(s.hands[0]).toHaveLength(HAND_SIZE)
    expect(s.hands[1]).toHaveLength(HAND_SIZE)
    expect(s.boneyard).toHaveLength(14)
    expect(s.line).toHaveLength(0)
    expect(s.leftEnd).toBe(-1)
    expect(s.rightEnd).toBe(-1)
    expect(s.turn).toBe(0)
    expect(s.status).toBe('playing')
    expect(s.winner).toBeNull()
  })

  it('golden deal (seed 12345): known tiles in known places', () => {
    const s = deal(mulberry32(SEED))
    expect(s.hands[0][0]).toEqual([0, 6])
    expect(s.hands[1][0]).toEqual([1, 5])
    expect(s.boneyard[s.boneyard.length - 1]).toEqual([6, 6])
  })

  it('every dealt tile is accounted for exactly once (28 total)', () => {
    const s = deal(mulberry32(SEED))
    const all = [...s.hands[0], ...s.hands[1], ...s.boneyard]
    expect(all).toHaveLength(28)
    expect(new Set(all.map(key)).size).toBe(28)
  })
})

describe('canPlay', () => {
  it('empty line accepts any tile', () => {
    expect(canPlay([3, 5], -1, -1)).toBe(true)
  })

  it('matches either open end', () => {
    // ends 2 and 5
    expect(canPlay([2, 0], 2, 5)).toBe(true) // matches left (2)
    expect(canPlay([6, 5], 2, 5)).toBe(true) // matches right (5)
    expect(canPlay([5, 2], 2, 5)).toBe(true) // both faces match
  })

  it('rejects a tile matching neither end', () => {
    expect(canPlay([1, 4], 2, 5)).toBe(false)
  })
})

describe('playableTiles / hasPlay', () => {
  it('empty line: every tile is playable (single placement)', () => {
    const s = mkState({ hands: [[[1, 2], [3, 4]], []] })
    const p = playableTiles(s, 0)
    expect(p).toHaveLength(2)
    expect(p[0].sides).toEqual(['right'])
    expect(hasPlay(s, 0)).toBe(true)
  })

  it('lists correct sides and a double-end tile plays both', () => {
    const s = mkState({
      hands: [[[2, 3], [1, 6], [3, 5]], []],
      line: [[2, 3]],
      leftEnd: 2,
      rightEnd: 3,
    })
    const p = playableTiles(s, 0)
    // [2,3] matches left(2) and right(3); [3,5] matches right(3); [1,6] neither
    const byIdx = new Map(p.map((x) => [x.tileIndex, x.sides]))
    expect(byIdx.get(0)).toEqual(['left', 'right'])
    expect(byIdx.get(2)).toEqual(['right'])
    expect(byIdx.has(1)).toBe(false)
  })

  it('hasPlay is false when nothing matches', () => {
    const s = mkState({ hands: [[[1, 1], [4, 6]], []], line: [[2, 3]], leftEnd: 2, rightEnd: 3 })
    expect(hasPlay(s, 0)).toBe(false)
  })
})

describe('play — opening', () => {
  it('first move places the tile and sets both ends', () => {
    const s = mkState({ hands: [[[3, 5], [1, 2]], [[0, 0]]] })
    const next = play(s, 0, 0, 'right')
    expect(next.line).toEqual([[3, 5]])
    expect(next.leftEnd).toBe(3)
    expect(next.rightEnd).toBe(5)
    expect(next.hands[0]).toEqual([[1, 2]])
    expect(next.turn).toBe(1)
  })
})

describe('play — orientation & ends', () => {
  it('append (right) orients so the joining face touches rightEnd', () => {
    const s = mkState({ hands: [[[6, 3]], []], line: [[2, 3]], leftEnd: 2, rightEnd: 3, turn: 0 })
    const next = play(s, 0, 0, 'right')
    // [6,3] must flip to [3,6] so its left face (3) meets rightEnd (3)
    expect(next.line).toEqual([[2, 3], [3, 6]])
    expect(next.leftEnd).toBe(2)
    expect(next.rightEnd).toBe(6)
  })

  it('append (right) keeps orientation when the first face already matches', () => {
    const s = mkState({ hands: [[[3, 6]], []], line: [[2, 3]], leftEnd: 2, rightEnd: 3, turn: 0 })
    const next = play(s, 0, 0, 'right')
    expect(next.line).toEqual([[2, 3], [3, 6]])
    expect(next.rightEnd).toBe(6)
  })

  it('prepend (left) orients so the joining face touches leftEnd', () => {
    const s = mkState({ hands: [[[2, 6]], []], line: [[2, 3]], leftEnd: 2, rightEnd: 3, turn: 0 })
    const next = play(s, 0, 0, 'left')
    // [2,6] must flip to [6,2] so its right face (2) meets leftEnd (2)
    expect(next.line).toEqual([[6, 2], [2, 3]])
    expect(next.leftEnd).toBe(6)
    expect(next.rightEnd).toBe(3)
  })

  it('keeps adjacency invariant line[i][1] === line[i+1][0]', () => {
    let s = mkState({ hands: [[[2, 3], [3, 6], [6, 1], [2, 4]], []] })
    s = play(s, 0, 0, 'right') // open [2,3]
    s = { ...s, turn: 0 } // solo-drive same hand for the invariant check
    s = play(s, 0, 0, 'right') // [3,6] -> right end 3
    s = { ...s, turn: 0 }
    s = play(s, 0, 0, 'right') // [6,1] -> right end 6
    s = { ...s, turn: 0 }
    s = play(s, 0, 0, 'left') // [2,4] -> left end 2
    for (let i = 0; i < s.line.length - 1; i++) {
      expect(s.line[i][1]).toBe(s.line[i + 1][0])
    }
  })
})

describe('play — rejection (=== no-op)', () => {
  const base = mkState({ hands: [[[6, 5]], [[1, 1]]], line: [[2, 3]], leftEnd: 2, rightEnd: 3, turn: 0 })

  it('rejects an illegal side (tile does not match that end)', () => {
    // [6,5] matches neither end; playing right must be a no-op
    expect(play(base, 0, 0, 'right')).toBe(base)
    expect(play(base, 0, 0, 'left')).toBe(base)
  })

  it('rejects a move out of turn', () => {
    const s = { ...base, turn: 1 as const }
    expect(play(s, 0, 0, 'right')).toBe(s)
  })

  it('rejects an out-of-range tile index', () => {
    expect(play(base, 0, 9, 'right')).toBe(base)
    expect(play(base, 0, -1, 'right')).toBe(base)
  })

  it('rejects any move when the game is over', () => {
    const s = { ...base, status: 'won' as const, winner: 0 as const }
    expect(play(s, 0, 0, 'right')).toBe(s)
  })

  it('a matching tile on the wrong-but-legal side still applies', () => {
    // [3,3] matches rightEnd(3): playing right is legal, left is not.
    const s = mkState({ hands: [[[3, 3]], []], line: [[2, 3]], leftEnd: 2, rightEnd: 3, turn: 0 })
    expect(play(s, 0, 0, 'left')).toBe(s) // 3 != leftEnd 2
    const ok = play(s, 0, 0, 'right')
    expect(ok).not.toBe(s)
    expect(ok.rightEnd).toBe(3)
  })
})

describe('play — win', () => {
  it('emptying the hand wins and freezes the turn', () => {
    const s = mkState({ hands: [[[2, 5]], [[1, 1], [4, 4]]], line: [[2, 3]], leftEnd: 2, rightEnd: 3, turn: 0 })
    const next = play(s, 0, 0, 'left')
    expect(next.hands[0]).toHaveLength(0)
    expect(next.status).toBe('won')
    expect(next.winner).toBe(0)
    expect(next.turn).toBe(0) // not advanced
  })

  it('does not mutate the input state', () => {
    const s = mkState({ hands: [[[2, 5], [0, 1]], []], line: [[2, 3]], leftEnd: 2, rightEnd: 3, turn: 0 })
    const snap = JSON.stringify(s)
    play(s, 0, 0, 'left')
    expect(JSON.stringify(s)).toBe(snap)
  })
})

describe('draw', () => {
  it('moves one tile from the boneyard to the hand; turn unchanged', () => {
    const s = mkState({ hands: [[[1, 1]], []], boneyard: [[2, 2], [3, 4]], turn: 0 })
    const next = draw(s, 0)
    expect(next.hands[0]).toHaveLength(2)
    expect(next.boneyard).toHaveLength(1)
    expect(next.hands[0][1]).toEqual([3, 4]) // took from the end
    expect(next.turn).toBe(0)
  })

  it('is a no-op when the boneyard is empty', () => {
    const s = mkState({ hands: [[[1, 1]], []], boneyard: [], turn: 0 })
    expect(draw(s, 0)).toBe(s)
  })

  it('is a no-op out of turn', () => {
    const s = mkState({ boneyard: [[2, 2]], turn: 1 })
    expect(draw(s, 0)).toBe(s)
  })
})

describe('pass', () => {
  it('is legal only with no play AND empty boneyard; advances turn', () => {
    const s = mkState({ hands: [[[1, 1]], [[4, 4]]], line: [[2, 3]], leftEnd: 2, rightEnd: 3, boneyard: [], turn: 0 })
    const next = pass(s, 0)
    expect(next.turn).toBe(1)
    expect(next.passes).toBe(1)
    expect(next.status).toBe('playing')
  })

  it('is a no-op when the player still has a play', () => {
    const s = mkState({ hands: [[[2, 5]], []], line: [[2, 3]], leftEnd: 2, rightEnd: 3, boneyard: [], turn: 0 })
    expect(pass(s, 0)).toBe(s)
  })

  it('is a no-op when the boneyard is not empty (must draw)', () => {
    const s = mkState({ hands: [[[1, 1]], []], line: [[2, 3]], leftEnd: 2, rightEnd: 3, boneyard: [[6, 6]], turn: 0 })
    expect(pass(s, 0)).toBe(s)
  })

  it('two consecutive passes block the game; lower pips wins', () => {
    const s = mkState({
      hands: [[[1, 1]], [[6, 6], [5, 5]]], // p0 pips 2, p1 pips 22
      line: [[2, 3]],
      leftEnd: 2,
      rightEnd: 3,
      boneyard: [],
      turn: 0,
      passes: 0,
    })
    const afterP0 = pass(s, 0)
    expect(afterP0.passes).toBe(1)
    const blocked = pass(afterP0, 1)
    expect(blocked.status).toBe('blocked')
    expect(blocked.winner).toBe(0) // 2 < 22
  })

  it('blocked with equal pips is a draw (winner null)', () => {
    const s = mkState({
      hands: [[[3, 3]], [[3, 3]]], // both pips 6 (fabricated for the tie path)
      line: [[2, 5]],
      leftEnd: 2,
      rightEnd: 5,
      boneyard: [],
      turn: 0,
      passes: 1,
    })
    const blocked = pass(s, 0)
    expect(blocked.status).toBe('blocked')
    expect(blocked.winner).toBeNull()
  })
})

describe('handPips', () => {
  it('sums pips across a hand', () => {
    expect(handPips([[6, 6], [1, 2], [0, 0]])).toBe(15)
    expect(handPips([])).toBe(0)
  })
})

describe('aiMove', () => {
  it('returns a legal play and prefers the heaviest tile', () => {
    const s = mkState({
      hands: [[], [[0, 2], [6, 3], [1, 1]]], // ends 2/3: [0,2] pips2, [6,3] pips9
      line: [[2, 3]],
      leftEnd: 2,
      rightEnd: 3,
      turn: 1,
    })
    const action = aiMove(s, 1, mulberry32(SEED))
    expect(action.type).toBe('play')
    if (action.type === 'play') {
      expect(action.tileIndex).toBe(1) // the heavy [6,3]
      const applied = play(s, 1, action.tileIndex, action.side)
      expect(applied).not.toBe(s) // it was legal
    }
  })

  it('draws when it cannot play and the boneyard has tiles', () => {
    const s = mkState({ hands: [[], [[1, 1]]], line: [[2, 3]], leftEnd: 2, rightEnd: 3, boneyard: [[6, 6]], turn: 1 })
    expect(aiMove(s, 1, mulberry32(SEED)).type).toBe('draw')
  })

  it('passes when it cannot play and the boneyard is empty', () => {
    const s = mkState({ hands: [[], [[1, 1]]], line: [[2, 3]], leftEnd: 2, rightEnd: 3, boneyard: [], turn: 1 })
    expect(aiMove(s, 1, mulberry32(SEED)).type).toBe('pass')
  })

  it('is deterministic given the same seed', () => {
    const s = mkState({ hands: [[], [[0, 3], [3, 3]]], line: [[2, 3]], leftEnd: 2, rightEnd: 3, turn: 1 })
    const a = aiMove(s, 1, mulberry32(SEED))
    const b = aiMove(s, 1, mulberry32(SEED))
    expect(a).toEqual(b)
  })
})

describe('full-game invariant (drive to a domino)', () => {
  it('a scripted line reaches a won terminal', () => {
    // p0: [2,3][3,4]; p1: [1,1]. p0 opens, p1 has no play & no boneyard -> block
    // path instead: give p0 a two-tile emptying run.
    let s = mkState({ hands: [[[2, 3], [3, 4]], [[1, 1]]], turn: 0 })
    s = play(s, 0, 0, 'right') // open [2,3], ends 2/3, turn -> 1
    expect(s.turn).toBe(1)
    // p1 [1,1] can't play (ends 2/3), boneyard empty -> pass
    s = pass(s, 1)
    expect(s.turn).toBe(0)
    s = play(s, 0, 0, 'right') // [3,4] on right end 3 -> empties p0 hand
    expect(s.status).toBe('won')
    expect(s.winner).toBe(0)
  })
})
