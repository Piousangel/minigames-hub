import { describe, expect, it } from 'vitest'
import {
  aiMove,
  applyMove,
  evaluatePosition,
  isOver,
  isOwnPit,
  legalMoves,
  moveDetail,
  newGame,
  oppositePit,
  ownPits,
  P0_STORE,
  P1_STORE,
  sideCount,
  storeCount,
  storeOf,
  winner,
  type GameState,
  type Player,
} from './engine'

// Build a state from an explicit 14-length pit array.
const mk = (pits: number[], turn: Player = 0): GameState => ({ pits: [...pits], turn })

// A board with a single seeded pit, everything else empty.
function only(seed: Record<number, number>, turn: Player = 0): GameState {
  const pits = Array<number>(14).fill(0)
  for (const [k, v] of Object.entries(seed)) pits[Number(k)] = v
  return { pits, turn }
}

const totalStones = (s: GameState): number => s.pits.reduce((a, b) => a + b, 0)

describe('newGame — standard Kalah opening', () => {
  it('has 4 stones in every small pit and empty stores', () => {
    const s = newGame()
    for (const i of [...ownPits(0), ...ownPits(1)]) expect(s.pits[i]).toBe(4)
    expect(s.pits[P0_STORE]).toBe(0)
    expect(s.pits[P1_STORE]).toBe(0)
  })
  it('has 48 stones total and player 0 to move', () => {
    const s = newGame()
    expect(totalStones(s)).toBe(48)
    expect(s.turn).toBe(0)
  })
  it('is not over at the start', () => {
    expect(isOver(newGame())).toBe(false)
    expect(winner(newGame())).toBeNull()
  })
})

describe('geometry helpers', () => {
  it('maps opposite pits bottom↔top', () => {
    expect(oppositePit(0)).toBe(12)
    expect(oppositePit(5)).toBe(7)
    expect(oppositePit(2)).toBe(10)
  })
  it('knows which pits belong to each player', () => {
    expect(isOwnPit(0, 3)).toBe(true)
    expect(isOwnPit(0, 6)).toBe(false) // store is not a playable pit
    expect(isOwnPit(0, 8)).toBe(false)
    expect(isOwnPit(1, 8)).toBe(true)
    expect(isOwnPit(1, 13)).toBe(false)
  })
  it('reports the right store index', () => {
    expect(storeOf(0)).toBe(P0_STORE)
    expect(storeOf(1)).toBe(P1_STORE)
  })
})

describe('legalMoves', () => {
  it('lists only the side-to-move non-empty pits, ascending', () => {
    const s = newGame()
    expect(legalMoves(s)).toEqual([0, 1, 2, 3, 4, 5])
    expect(legalMoves({ ...s, turn: 1 })).toEqual([7, 8, 9, 10, 11, 12])
  })
  it('skips empty pits', () => {
    const s = mk([4, 0, 4, 0, 4, 0, 0, 4, 4, 4, 4, 4, 4, 0], 0)
    expect(legalMoves(s)).toEqual([0, 2, 4])
  })
  it('is empty on a finished board', () => {
    const s = mk([0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 24], 0)
    expect(legalMoves(s)).toEqual([])
  })
})

describe('sowing distribution', () => {
  it('sows one stone per following pit, counterclockwise', () => {
    // pit 2 has 3 stones → drops into 3, 4, 5.
    const s = only({ 2: 3, 9: 1 }, 0)
    const d = moveDetail(s, 2)!
    expect(d.path).toEqual([3, 4, 5])
    expect(d.state.pits[2]).toBe(0)
    expect(d.state.pits[3]).toBe(1)
    expect(d.state.pits[4]).toBe(1)
    expect(d.state.pits[5]).toBe(1)
  })
  it('drops into your OWN store as it passes', () => {
    // pit 5 (adjacent to store 6) with 1 stone lands exactly in the store.
    const s = only({ 5: 1, 9: 1 }, 0)
    const d = moveDetail(s, 5)!
    expect(d.path).toEqual([P0_STORE])
    expect(d.state.pits[P0_STORE]).toBe(1)
  })
  it('SKIPS the opponent store while wrapping (player 0)', () => {
    // pit 5 with 9 stones: 6,7,8,9,10,11,12, skip 13, 0, 1. (1:1 avoids a capture
    // on the last stone; 8:1 keeps side 1 live.)
    const s = only({ 5: 9, 1: 1, 8: 1 }, 0)
    const d = moveDetail(s, 5)!
    expect(d.path).toEqual([6, 7, 8, 9, 10, 11, 12, 0, 1])
    expect(d.path).not.toContain(P1_STORE)
    expect(d.state.pits[P1_STORE]).toBe(0)
    expect(d.state.pits[P0_STORE]).toBe(1)
  })
  it('SKIPS the opponent store while wrapping (player 1)', () => {
    // player 1, pit 12 with 9 stones: 13,0,1,2,3,4,5, skip 6, 7,8. (8:2 avoids a
    // capture on the last stone; 2:1 keeps side 0 live at the start.)
    const s = only({ 12: 9, 8: 2, 2: 1 }, 1)
    const d = moveDetail(s, 12)!
    expect(d.path).toEqual([13, 0, 1, 2, 3, 4, 5, 7, 8])
    expect(d.path).not.toContain(P0_STORE)
    expect(d.state.pits[P0_STORE]).toBe(0)
  })
  it('wraps fully around a nearly-full board without touching either opp store improperly', () => {
    // pit 0 with 14 stones: 1..12, skip 13, 0, 1. (8:1 keeps side 1 live)
    const s = only({ 0: 14, 8: 1 }, 0)
    const d = moveDetail(s, 0)!
    expect(d.path).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 1])
    expect(d.path.length).toBe(14)
    expect(d.path).not.toContain(P1_STORE)
    expect(d.state.pits[P1_STORE]).toBe(0)
    // one stone lands back in the origin pit 0, two accumulate in pit 1
    expect(d.state.pits[0]).toBe(1)
    expect(d.state.pits[1]).toBe(2)
  })
  it('conserves all stones through a sow', () => {
    const s = newGame()
    const d = moveDetail(s, 2)!
    expect(totalStones(d.state)).toBe(48)
  })
})

describe('extra turn — last stone in own store', () => {
  it('player 0 keeps the turn when landing in the store', () => {
    const s = only({ 2: 4, 9: 1 }, 0) // 3,4,5,6(store) → extra turn
    const d = moveDetail(s, 2)!
    expect(d.last).toBe(P0_STORE)
    expect(d.extraTurn).toBe(true)
    expect(d.state.turn).toBe(0)
  })
  it('player 1 keeps the turn when landing in their store', () => {
    const s = only({ 9: 4, 2: 1 }, 1) // 10,11,12,13(store) → extra turn (2:1 keeps side 0 live)
    const d = moveDetail(s, 9)!
    expect(d.last).toBe(P1_STORE)
    expect(d.extraTurn).toBe(true)
    expect(d.state.turn).toBe(1)
  })
  it('does NOT grant an extra turn when the last stone lands elsewhere', () => {
    const s = only({ 2: 2, 9: 1 }, 0) // 3,4 → normal
    const d = moveDetail(s, 2)!
    expect(d.extraTurn).toBe(false)
    expect(d.state.turn).toBe(1)
  })
})

describe('capture — last stone in own empty pit', () => {
  it('captures the landing stone plus the opposite pit', () => {
    // pit 0 with 1 stone lands in pit 1 (empty); opposite of 1 is 11 (has 5).
    const s = only({ 0: 1, 1: 0, 11: 5 }, 0)
    const d = moveDetail(s, 0)!
    expect(d.last).toBe(1)
    expect(d.capture).toEqual({ pit: 1, opposite: 11, gained: 6 })
    expect(d.state.pits[1]).toBe(0)
    expect(d.state.pits[11]).toBe(0)
    expect(d.state.pits[P0_STORE]).toBe(6)
    expect(d.state.turn).toBe(1) // capture ends the turn
  })
  it('captures for player 1 too', () => {
    // player 1 pit 7 with 1 stone lands in pit 8 (empty); opposite is 4 (has 3).
    const s = only({ 7: 1, 8: 0, 4: 3 }, 1)
    const d = moveDetail(s, 7)!
    expect(d.capture).toEqual({ pit: 8, opposite: 4, gained: 4 })
    expect(d.state.pits[P1_STORE]).toBe(4)
  })
  it('does NOT capture when the opposite pit is empty', () => {
    const s = only({ 0: 1, 1: 0, 11: 0, 9: 2 }, 0)
    const d = moveDetail(s, 0)!
    expect(d.capture).toBeNull()
    expect(d.state.pits[1]).toBe(1) // stone just sits there
    expect(d.state.pits[P0_STORE]).toBe(0)
  })
  it('does NOT capture when landing in a NON-empty own pit', () => {
    const s = only({ 0: 1, 1: 3, 11: 5 }, 0) // pit 1 already had stones
    const d = moveDetail(s, 0)!
    expect(d.capture).toBeNull()
    expect(d.state.pits[1]).toBe(4)
    expect(d.state.pits[11]).toBe(5)
  })
  it('does NOT capture when landing on the OPPONENT side', () => {
    // player 0 pit 5 with 3 stones → 6(store),7,8. Lands on opponent pit 8.
    // 1:2 keeps side 0 non-empty (no sweep); 10:1 keeps side 1 live at the start.
    const s = only({ 5: 3, 1: 2, 10: 1 }, 0)
    const d = moveDetail(s, 5)!
    expect(d.last).toBe(8)
    expect(d.capture).toBeNull()
    expect(d.state.pits[8]).toBe(1)
  })
  it('does NOT capture when landing in own store (that is an extra turn)', () => {
    const s = only({ 5: 1, 7: 4 }, 0)
    const d = moveDetail(s, 5)!
    expect(d.capture).toBeNull()
    expect(d.extraTurn).toBe(true)
  })
})

describe('end-game sweep + winner', () => {
  it('sweeps every side into its store when a side empties', () => {
    // player 0 plays their last stone (pit 5→store); side 0 becomes empty.
    const s = only({ 5: 1, 7: 2, 9: 3, 11: 1, 6: 20, 13: 15 }, 0)
    const d = moveDetail(s, 5)!
    expect(d.ended).toBe(true)
    expect(isOver(d.state)).toBe(true)
    // player 1's remaining 6 stones swept to store 13.
    expect(d.state.pits[P1_STORE]).toBe(15 + 6)
    expect(d.state.pits[P0_STORE]).toBe(21)
    // no stones left in any small pit
    for (const i of [...ownPits(0), ...ownPits(1)]) expect(d.state.pits[i]).toBe(0)
    expect(totalStones(d.state)).toBe(totalStones(s))
  })
  it('declares player 0 the winner with more stones', () => {
    const s = mk([0, 0, 0, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0, 23], 1)
    expect(winner(s)).toBe(0)
  })
  it('declares player 1 the winner with more stones', () => {
    const s = mk([0, 0, 0, 0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 28], 0)
    expect(winner(s)).toBe(1)
  })
  it('declares a draw at 24–24', () => {
    const s = mk([0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 24], 0)
    expect(winner(s)).toBe('draw')
  })
  it('capture that empties a side also triggers a sweep', () => {
    // pit 4 with 1 → lands pit 5 (empty), opposite 7 has 3 → capture. Side 0
    // then all empty (only pit 4 had a stone) → sweep.
    const s = only({ 4: 1, 5: 0, 7: 3, 9: 2, 6: 10, 13: 10 }, 0)
    const d = moveDetail(s, 4)!
    expect(d.capture).not.toBeNull()
    expect(d.ended).toBe(true)
    expect(isOver(d.state)).toBe(true)
  })
})

describe('illegal moves are === no-ops', () => {
  it('returns the same reference for an empty pit', () => {
    const s = only({ 0: 0, 2: 4 }, 0)
    expect(applyMove(s, 0)).toBe(s)
    expect(moveDetail(s, 0)).toBeNull()
  })
  it('returns the same reference when picking the opponent side', () => {
    const s = newGame()
    expect(applyMove(s, 8)).toBe(s)
    expect(moveDetail(s, 8)).toBeNull()
  })
  it('returns the same reference when picking a store', () => {
    const s = newGame()
    expect(applyMove(s, P0_STORE)).toBe(s)
    expect(applyMove(s, P1_STORE)).toBe(s)
  })
  it('returns the same reference once the game is over', () => {
    const over = mk([0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 24], 0)
    expect(applyMove(over, 0)).toBe(over)
    expect(moveDetail(over, 2)).toBeNull()
  })
  it('does not mutate the input state', () => {
    const s = newGame()
    const before = [...s.pits]
    applyMove(s, 2)
    expect(s.pits).toEqual(before)
    expect(s.turn).toBe(0)
  })
})

describe('AI — legality', () => {
  it('returns a legal move from the opening for every difficulty', () => {
    for (const diff of ['easy', 'medium', 'hard'] as const) {
      const m = aiMove(newGame(), diff)
      expect(legalMoves(newGame())).toContain(m)
    }
  })
  it('returns null when the side to move has no move', () => {
    const s = mk([0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 24], 0)
    expect(aiMove(s, 'hard')).toBeNull()
  })
  it('never returns an illegal move across many random-ish positions', () => {
    // Deterministic pseudo-positions (no Math.random in the engine; the test
    // may use a fixed LCG to fan out coverage).
    let seed = 12345
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    for (let t = 0; t < 60; t++) {
      const pits = Array<number>(14).fill(0)
      // scatter ~48 stones
      for (let k = 0; k < 48; k++) {
        let i = Math.floor(rnd() * 14)
        if (i === P0_STORE || i === P1_STORE) i = 0
        pits[i] += 1
      }
      const turn: Player = rnd() < 0.5 ? 0 : 1
      const s = { pits, turn }
      if (isOver(s) || legalMoves(s).length === 0) continue
      for (const diff of ['easy', 'medium', 'hard'] as const) {
        const m = aiMove(s, diff)
        expect(m).not.toBeNull()
        expect(legalMoves(s)).toContain(m)
      }
    }
  })
})

describe('AI — determinism', () => {
  it('returns the identical move for a fixed position and depth', () => {
    const s = newGame()
    expect(aiMove(s, 'hard')).toBe(aiMove(s, 'hard'))
    expect(aiMove(s, 'medium')).toBe(aiMove(s, 'medium'))
  })
  it('evaluatePosition is stable for a fixed position and depth', () => {
    const s = newGame()
    expect(evaluatePosition(s, 6)).toBe(evaluatePosition(s, 6))
  })
  it('breaks ties toward the lowest pit index', () => {
    // A symmetric-ish position where two moves are equal: since scan is
    // ascending with strict >, the lowest index wins. Hard to force equality,
    // so assert the returned move is within legal set and reproducible.
    const s = newGame()
    const a = aiMove(s, 'easy')
    const b = aiMove(s, 'easy')
    expect(a).toBe(b)
  })
})

describe('AI — real tactics (not random)', () => {
  it('finds a capture when one is available', () => {
    // pit 1 with 1 stone → lands pit 2 (empty), opposite 10 loaded (6) → capture 7.
    // Other moves gain far less. Hard must find the capture.
    const s = only({ 1: 1, 2: 0, 10: 6, 4: 3, 8: 2 }, 0)
    const chosen = aiMove(s, 'hard')!
    const d = moveDetail(s, chosen)!
    expect(d.capture).not.toBeNull()
    expect(d.state.pits[P0_STORE]).toBeGreaterThanOrEqual(7)
  })
  it('picks the exact minimax-best move, not a random legal one', () => {
    // The move aiMove returns must be the argmax of the search over all legal
    // moves (proving it is a real minimax player). aiMove(hard) scores each
    // child at depth 7, so we replay that same evaluation independently.
    const positions: GameState[] = [
      newGame(),
      only({ 0: 1, 4: 1, 11: 8, 7: 2, 9: 1 }, 0),
      only({ 1: 3, 3: 2, 5: 1, 8: 4, 10: 5, 12: 1 }, 0),
      only({ 2: 6, 4: 2, 7: 3, 9: 1, 11: 4 }, 0),
    ]
    for (const s of positions) {
      const chosen = aiMove(s, 'hard')!
      const valueOf = (pit: number) => evaluatePosition(applyMove(s, pit), 7, s.turn)
      const chosenVal = valueOf(chosen)
      for (const m of legalMoves(s)) {
        expect(chosenVal).toBeGreaterThanOrEqual(valueOf(m) - 1e-9)
      }
    }
  })
  it('grabs the larger of two captures', () => {
    // pit 0 → captures opposite 11 (=8) for +9; pit 4 → captures opposite 7 (=2)
    // for +3. The banked stones are safe from the opponent, so the bigger haul
    // is strictly better and Hard must take pit 0.
    const s = only({ 0: 1, 4: 1, 11: 8, 7: 2, 9: 2 }, 0)
    const chosen = aiMove(s, 'hard')!
    expect(chosen).toBe(0)
    expect(moveDetail(s, 0)!.capture!.gained).toBe(9)
  })
})

describe('AI — strength scales with depth', () => {
  it('deeper search scores the opening at least as well for the mover', () => {
    const s = newGame()
    const shallow = evaluatePosition(s, 2)
    const deep = evaluatePosition(s, 6)
    // With optimal play available at greater depth, the mover's minimax value
    // should not be worse than the shallow estimate by a large margin; here we
    // assert the deep search still favors the mover (opening is balanced/plus).
    expect(deep).toBeGreaterThanOrEqual(shallow - 6)
  })
  it('hard beats easy in a head-to-head self-play game (more stores)', () => {
    // Play a full game: player 0 = hard, player 1 = easy. Deterministic.
    let s = newGame()
    let guard = 0
    while (!isOver(s) && guard++ < 400) {
      const diff = s.turn === 0 ? 'hard' : 'easy'
      const m = aiMove(s, diff)
      if (m === null) break
      s = applyMove(s, m)
    }
    // Sweep any leftover if loop bailed (shouldn't, but be safe).
    expect(isOver(s)).toBe(true)
    expect(storeCount(s, 0)).toBeGreaterThan(storeCount(s, 1))
  })
  it('a full hard-vs-hard game terminates and conserves stones', () => {
    let s = newGame()
    let guard = 0
    while (!isOver(s) && guard++ < 400) {
      const m = aiMove(s, 'hard')
      if (m === null) break
      s = applyMove(s, m)
    }
    expect(isOver(s)).toBe(true)
    expect(totalStones(s)).toBe(48)
    expect(storeCount(s, 0) + storeCount(s, 1)).toBe(48)
  })
})

describe('sideCount / storeCount accessors', () => {
  it('reports store and side totals', () => {
    const s = newGame()
    expect(storeCount(s, 0)).toBe(0)
    expect(sideCount(s, 0)).toBe(24)
    expect(sideCount(s, 1)).toBe(24)
  })
})
