import { describe, expect, it } from 'vitest'
import {
  bank,
  DEPTH_MULT,
  depthMult,
  fatalOdds,
  flip,
  gasRemaining,
  GAS_LIMIT,
  idleState,
  makeDeck,
  newDescent,
  nextFlipEV,
  peekNext,
  shouldBank,
  shuffle,
  TIER_NORMAL,
  tilesRemaining,
  type ProspectorState,
  type Tile,
  type TileKind,
} from './engine'

const gem = (value: number): Tile => ({ kind: 'gem', value })
const gas = (): Tile => ({ kind: 'gas', value: 0 })
const dyn = (): Tile => ({ kind: 'dynamite', value: 0 })

const S = (partial: Partial<ProspectorState>): ProspectorState => ({
  deck: [],
  cursor: 0,
  potValue: 0,
  safeFlips: 0,
  gasCount: 0,
  score: 0,
  phase: 'descending',
  lastTile: null,
  ...partial,
})

/** RNG that returns a fixed sequence, repeating the last value if exhausted. */
function seq(values: number[]): () => number {
  let i = 0
  return () => (i < values.length ? values[i++] : values[values.length - 1] ?? 0)
}

function histogram(deck: Tile[]) {
  const counts: Record<TileKind, number> = { gem: 0, gas: 0, dynamite: 0 }
  const gemValues: Record<number, number> = {}
  for (const t of deck) {
    counts[t.kind]++
    if (t.kind === 'gem') gemValues[t.value] = (gemValues[t.value] ?? 0) + 1
  }
  return { counts, gemValues }
}

describe('makeDeck', () => {
  it('NORMAL은 30장, 22젬/6가스/2다이너마이트, 젬값 히스토그램이 정확하다', () => {
    const deck = makeDeck(TIER_NORMAL)
    expect(deck).toHaveLength(30)
    const { counts, gemValues } = histogram(deck)
    expect(counts).toEqual({ gem: 22, gas: 6, dynamite: 2 })
    expect(gemValues).toEqual({ 1: 10, 2: 6, 3: 4, 5: 2 })
  })

  it('모든 티어는 gas 수가 GAS_LIMIT 이상이라 덱 소진이 불가능하다', () => {
    for (const tier of [TIER_NORMAL]) {
      const gasCount = makeDeck(tier).filter((t) => t.kind === 'gas').length
      expect(gasCount).toBeGreaterThanOrEqual(GAS_LIMIT)
    }
  })
})

describe('shuffle', () => {
  it('원본을 변형하지 않고 같은 멀티셋을 반환한다', () => {
    const deck = makeDeck(TIER_NORMAL)
    const before = JSON.stringify(deck)
    const out = shuffle(deck, seq([0.1, 0.9, 0.4, 0.7, 0.2]))
    expect(JSON.stringify(deck)).toBe(before) // input untouched
    expect(out).toHaveLength(deck.length)
    expect(histogram(out).counts).toEqual(histogram(deck).counts)
  })

  it('동일 rng이면 결정론적으로 같은 순서를 만든다', () => {
    const deck = makeDeck(TIER_NORMAL)
    const a = shuffle(deck, seq([0.3, 0.6, 0.1, 0.8, 0.5, 0.2]))
    const b = shuffle(deck, seq([0.3, 0.6, 0.1, 0.8, 0.5, 0.2]))
    expect(a).toEqual(b)
  })
})

describe('depthMult', () => {
  it('첫 안전 플립은 x1, 인덱스별로 테이블을 따른다', () => {
    expect(depthMult(0)).toBe(1)
    expect(depthMult(1)).toBe(1.2)
    expect(depthMult(2)).toBe(1.5)
  })
  it('테이블 끝을 넘으면 마지막 값으로 클램프된다', () => {
    const last = DEPTH_MULT[DEPTH_MULT.length - 1]
    expect(depthMult(DEPTH_MULT.length)).toBe(last)
    expect(depthMult(999)).toBe(last)
  })
})

describe('flip — 젬/다이너마이트/가스', () => {
  it('첫 젬은 정확히 액면가 x1이다', () => {
    const s = flip(S({ deck: [gem(2)] }))
    expect(s.potValue).toBe(2)
    expect(s.safeFlips).toBe(1)
    expect(s.lastTile).toEqual(gem(2))
  })

  it('배수가 정확히 깊어진다: gem2, gem5, dynamite', () => {
    let s = S({ deck: [gem(2), gem(5), dyn()] })
    s = flip(s) // ×1 → pot 2, safe 1
    expect(s.potValue).toBe(2)
    expect(s.safeFlips).toBe(1)
    s = flip(s) // 2 + 5*1.2 = 8, safe 2
    expect(s.potValue).toBe(8)
    expect(s.safeFlips).toBe(2)
    s = flip(s) // dynamite doubles → 16, safe 3
    expect(s.potValue).toBe(16)
    expect(s.safeFlips).toBe(3)
  })

  it('다이너마이트는 팟을 2배로 하고 안전 플립을 늘린다', () => {
    const s = flip(S({ deck: [dyn()], potValue: 10, safeFlips: 4 }))
    expect(s.potValue).toBe(20)
    expect(s.safeFlips).toBe(5)
  })

  it('3번째 가스는 붕괴시키고 팟을 0으로 만든다', () => {
    let s = S({ deck: [gas(), gas(), gas()], potValue: 42 })
    s = flip(s)
    expect(s.gasCount).toBe(1)
    expect(s.potValue).toBe(42)
    s = flip(s)
    expect(s.gasCount).toBe(2)
    expect(s.potValue).toBe(42)
    s = flip(s)
    expect(s.phase).toBe('collapsed')
    expect(s.gasCount).toBe(3)
    expect(s.potValue).toBe(0)
  })

  it('1번째 가스는 배수와 팟을 바꾸지 않는다', () => {
    const s = flip(S({ deck: [gas()], potValue: 7, safeFlips: 3 }))
    expect(s.potValue).toBe(7)
    expect(s.safeFlips).toBe(3)
    expect(s.gasCount).toBe(1)
    expect(s.phase).toBe('descending')
  })

  it('소수 팟: safeFlips 1에서 gem1을 뒤집으면 1.2', () => {
    const s = flip(S({ deck: [gem(1)], safeFlips: 1 }))
    expect(s.potValue).toBeCloseTo(1.2)
  })
})

describe('fatalOdds', () => {
  it('가스 2개 up + 20장 남고 그중 4장 가스면 0.2', () => {
    // 4 gas total in deck, 2 flipped (gasCount 2), 20 tiles remaining.
    const deck: Tile[] = [gas(), gas(), gas(), gas()]
    while (deck.length < 22) deck.push(gem(1))
    // cursor 2 → 20 tiles remaining, gasRemaining 2? need 4 gas remaining among 20.
    const remainingDeck: Tile[] = [gas(), gas(), gas(), gas()]
    while (remainingDeck.length < 20) remainingDeck.push(gem(1))
    const full = [gas(), gas(), ...remainingDeck] // 2 flipped gas + 20 remaining (4 gas)
    const s = S({ deck: full, cursor: 2, gasCount: 2 })
    expect(tilesRemaining(s)).toBe(20)
    expect(gasRemaining(s)).toBe(4)
    expect(fatalOdds(s)).toBeCloseTo(0.2)
  })

  it('가스가 2개 미만이면 0', () => {
    const s = S({ deck: [gas(), gas(), gem(1)], cursor: 0, gasCount: 1 })
    expect(fatalOdds(s)).toBe(0)
  })

  it('descending이 아니면 0', () => {
    const s = S({ deck: [gas(), gem(1)], cursor: 0, gasCount: 2, phase: 'banked' })
    expect(fatalOdds(s)).toBe(0)
  })
})

describe('nextFlipEV / shouldBank', () => {
  it('초반(작은 팟, 젬 다수)에서는 +EV → shouldBank false', () => {
    const s = S({ deck: makeDeck(TIER_NORMAL), cursor: 0, potValue: 0, gasCount: 0 })
    expect(nextFlipEV(s)).toBeGreaterThan(0)
    expect(shouldBank(s)).toBe(false)
  })

  it('가스 2개 up + 높은 팟 + 높은 치명확률에서는 −EV → shouldBank true', () => {
    // Remaining: 3 gas, 1 gem(1) → fatal on every gas draw, small gem gain.
    const deck: Tile[] = [gas(), gas(), gas(), gas(), gas(), gem(1)]
    const s = S({ deck, cursor: 2, potValue: 100, safeFlips: 5, gasCount: 2 })
    // remaining tiles: gas,gas,gas,gem1 (4). EV = (-100*3 + 1*mult) / 4 < 0
    expect(nextFlipEV(s)).toBeLessThan(0)
    expect(shouldBank(s)).toBe(true)
  })

  it('descending이 아니거나 남은 타일이 없으면 0', () => {
    expect(nextFlipEV(S({ phase: 'banked', deck: [gem(1)] }))).toBe(0)
    expect(nextFlipEV(S({ deck: [gem(1)], cursor: 1 }))).toBe(0)
  })
})

describe('bank', () => {
  it('팟을 반올림해 점수에 더하고 banked로 가며 덱/커서는 유지된다', () => {
    const deck = [gem(1), gas()]
    const s = bank(S({ deck, cursor: 1, potValue: 8.6, score: 100 }))
    expect(s.score).toBe(109) // 8.6 → 9
    expect(s.phase).toBe('banked')
    expect(s.deck).toBe(deck)
    expect(s.cursor).toBe(1)
    expect(peekNext(s)).toEqual(gas()) // deck[cursor] still peekable
  })

  it('빈 팟 뱅크는 0을 더하고도 banked로 전환된다', () => {
    const s = bank(S({ deck: [gem(1)], potValue: 0, score: 50 }))
    expect(s.score).toBe(50)
    expect(s.phase).toBe('banked')
  })
})

describe('가드 — descending이 아니면 no-op', () => {
  it('flip/bank는 banked/collapsed/idle에서 상태를 바꾸지 않는다', () => {
    for (const phase of ['banked', 'collapsed', 'idle'] as const) {
      const s = S({ deck: [gem(1), gas()], phase, potValue: 5, score: 3 })
      const f = flip(s)
      expect(f.phase).toBe(phase)
      expect(f.potValue).toBe(5)
      expect(f.cursor).toBe(s.cursor)
      const b = bank(s)
      expect(b.phase).toBe(phase)
      expect(b.score).toBe(3)
    }
  })

  it('커서가 덱 끝일 때 flip은 가드된 no-op이다', () => {
    const s = S({ deck: [gem(1)], cursor: 1 })
    expect(flip(s)).toEqual(s)
  })
})

describe('idleState / newDescent', () => {
  it('idleState는 빈 덱 idle이며 점수를 보존한다', () => {
    const s = idleState(77)
    expect(s.phase).toBe('idle')
    expect(s.deck).toEqual([])
    expect(s.score).toBe(77)
  })

  it('newDescent는 풀덱을 섞고 카운터를 리셋하되 점수를 보존한다', () => {
    const prev = S({ score: 42, phase: 'banked', potValue: 99, safeFlips: 5, gasCount: 2 })
    const d = newDescent(TIER_NORMAL, seq([0.2, 0.5, 0.9, 0.1]), prev)
    expect(d.phase).toBe('descending')
    expect(d.deck).toHaveLength(30)
    expect(d.cursor).toBe(0)
    expect(d.potValue).toBe(0)
    expect(d.safeFlips).toBe(0)
    expect(d.gasCount).toBe(0)
    expect(d.score).toBe(42)
    expect(d.lastTile).toBeNull()
  })
})
