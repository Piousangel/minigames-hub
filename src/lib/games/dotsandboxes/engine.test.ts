import { describe, expect, it } from 'vitest'
import {
  aiMove,
  boxSides,
  drawEdge,
  isLegal,
  isOver,
  legalEdges,
  newGame,
  totalBoxes,
  totalEdges,
  winner,
  type Edge,
  type GameState,
  type Rng,
} from './engine'

// A deterministic RNG that always returns a fixed value (0 → first element).
const rngConst = (v: number): Rng => () => v
// A cycling RNG for exercising randomness reproducibly.
const rngSeq = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length]
}

// Draw a sequence of edges from a fresh game, ignoring turn logic (for setup).
function play(state: GameState, edges: Edge[]): GameState {
  return edges.reduce((s, e) => drawEdge(s, e), state)
}

describe('newGame — board shape', () => {
  it('creates a dots×dots grid with the right edge/box counts', () => {
    const s = newGame(5)
    expect(s.dots).toBe(5)
    expect(s.h.length).toBe(5) // 5 rows of horizontal edges
    expect(s.h[0].length).toBe(4) // 4 per row
    expect(s.v.length).toBe(4) // 4 rows of vertical edges
    expect(s.v[0].length).toBe(5) // 5 per row
    expect(s.owner.length).toBe(4)
    expect(s.owner[0].length).toBe(4)
    expect(s.current).toBe(0)
    expect(s.scores).toEqual([0, 0])
    expect(totalBoxes(5)).toBe(16)
    expect(totalEdges(5)).toBe(40)
  })

  it('defaults to a 5×5 grid', () => {
    expect(newGame().dots).toBe(5)
  })
})

describe('drawEdge — turn passing', () => {
  it('passes the turn to the opponent on a non-completing edge', () => {
    const s = drawEdge(newGame(3), { type: 'h', r: 0, c: 0 })
    expect(s.current).toBe(1) // was 0, now passes
    expect(s.scores).toEqual([0, 0])
  })

  it('rejects an already-drawn edge (returns the same reference)', () => {
    const s1 = drawEdge(newGame(3), { type: 'h', r: 0, c: 0 })
    const s2 = drawEdge(s1, { type: 'h', r: 0, c: 0 })
    expect(s2).toBe(s1) // no change
  })

  it('rejects an out-of-bounds edge', () => {
    const g = newGame(3)
    expect(isLegal(g, { type: 'h', r: 0, c: 5 })).toBe(false)
    expect(drawEdge(g, { type: 'h', r: 0, c: 5 })).toBe(g)
  })
})

describe('drawEdge — completing a box', () => {
  // In a 2×2-dot grid there is a single box with 4 edges:
  // top h(0,0), bottom h(1,0), left v(0,0), right v(0,1).
  it('needs all 4 edges before the box is claimed', () => {
    let s = newGame(2)
    s = drawEdge(s, { type: 'h', r: 0, c: 0 }) // top
    s = drawEdge(s, { type: 'v', r: 0, c: 0 }) // left
    s = drawEdge(s, { type: 'v', r: 0, c: 1 }) // right
    expect(boxSides(s, 0, 0)).toBe(3)
    expect(s.owner[0][0]).toBeNull()
    expect(s.scores).toEqual([0, 0])
  })

  it('scores AND keeps the same player when an edge completes a box', () => {
    // Set up 3 sides via player 0 and 1 alternating, then have player 0 close it.
    let s = newGame(2)
    s = drawEdge(s, { type: 'h', r: 0, c: 0 }) // p0 → passes to p1
    s = drawEdge(s, { type: 'v', r: 0, c: 0 }) // p1 → passes to p0
    s = drawEdge(s, { type: 'v', r: 0, c: 1 }) // p0 → passes to p1
    expect(s.current).toBe(1)
    const before = s.current
    s = drawEdge(s, { type: 'h', r: 1, c: 0 }) // p1 completes the box
    expect(s.owner[0][0]).toBe(before) // owned by p1
    expect(s.scores).toEqual([0, 1])
    expect(s.current).toBe(before) // same player goes again
  })

  it('claims two boxes at once with a shared edge and moves again', () => {
    // 3×2 dots → two boxes side by side sharing the middle vertical edge.
    // Boxes: (0,0) and (0,1). Shared edge v(0,1).
    let s = newGame(3)
    // Draw every edge of both boxes EXCEPT the shared middle v(0,1).
    const setup: Edge[] = [
      { type: 'h', r: 0, c: 0 },
      { type: 'h', r: 1, c: 0 },
      { type: 'v', r: 0, c: 0 }, // left box's left
      { type: 'h', r: 0, c: 1 },
      { type: 'h', r: 1, c: 1 },
      { type: 'v', r: 0, c: 2 }, // right box's right
    ]
    s = play(s, setup)
    expect(s.owner[0][0]).toBeNull()
    expect(s.owner[0][1]).toBeNull()
    const closer = s.current
    s = drawEdge(s, { type: 'v', r: 0, c: 1 }) // shared edge closes both
    expect(s.owner[0][0]).toBe(closer)
    expect(s.owner[0][1]).toBe(closer)
    expect(s.scores[closer]).toBe(2)
    expect(s.current).toBe(closer) // completing boxes → go again
  })
})

describe('winner — end detection', () => {
  it('returns null while edges remain', () => {
    expect(winner(newGame(3))).toBeNull()
    expect(isOver(newGame(3))).toBe(false)
  })

  it('detects a majority winner once every box is claimed', () => {
    // Fully play out the single-box 2×2 grid; player 1 closes it.
    let s = newGame(2)
    s = drawEdge(s, { type: 'h', r: 0, c: 0 }) // p0
    s = drawEdge(s, { type: 'v', r: 0, c: 0 }) // p1
    s = drawEdge(s, { type: 'v', r: 0, c: 1 }) // p0
    s = drawEdge(s, { type: 'h', r: 1, c: 0 }) // p1 → claims the only box
    expect(isOver(s)).toBe(true)
    expect(winner(s)).toEqual({ player: 1, scores: [0, 1] })
  })

  it('detects a tie when both players own equal boxes', () => {
    // A 3×3-dot board has four boxes; split 2–2 for a tie. Synthesize a
    // terminal state directly (ownership + scores) — isOver keys off the score
    // sum reaching totalBoxes.
    const tie: GameState = {
      ...newGame(3),
      owner: [
        [0, 1],
        [1, 0],
      ],
      scores: [2, 2],
    }
    expect(totalBoxes(3)).toBe(4)
    expect(isOver(tie)).toBe(true)
    expect(winner(tie)).toEqual({ player: null, scores: [2, 2] })
  })
})

describe('aiMove — easy', () => {
  it('returns a legal edge and null when the board is full', () => {
    const g = newGame(3)
    const e = aiMove(g, 'easy', rngConst(0))
    expect(e).not.toBeNull()
    expect(isLegal(g, e as Edge)).toBe(true)

    // Drain every edge, then expect null.
    let s = g
    let guard = 0
    while (legalEdges(s).length > 0 && guard++ < 100) {
      s = drawEdge(s, legalEdges(s)[0])
    }
    expect(aiMove(s, 'easy', rngConst(0))).toBeNull()
  })
})

describe('aiMove — hard', () => {
  it('takes a free box when one is available', () => {
    // Box (0,0) has 3 sides; the completing edge is h(1,0).
    let s = newGame(2)
    s = drawEdge(s, { type: 'h', r: 0, c: 0 })
    s = drawEdge(s, { type: 'v', r: 0, c: 0 })
    s = drawEdge(s, { type: 'v', r: 0, c: 1 })
    expect(boxSides(s, 0, 0)).toBe(3)
    const e = aiMove(s, 'hard', rngSeq([0.3, 0.7, 0.1]))
    expect(e).toEqual({ type: 'h', r: 1, c: 0 }) // the capturing edge
  })

  it('avoids adding the 3rd side of a box when a safe move exists', () => {
    // On a 3×3-dot board, pre-draw two sides of the center-ish box (0,0)
    // so that its remaining edges would become the "3rd side" (unsafe).
    // A larger board guarantees safe edges elsewhere.
    let s = newGame(3)
    s = drawEdge(s, { type: 'h', r: 0, c: 0 }) // box(0,0) top
    s = drawEdge(s, { type: 'v', r: 0, c: 0 }) // box(0,0) left  -> now 2 sides
    expect(boxSides(s, 0, 0)).toBe(2)

    // Try many RNG seeds: hard AI must never pick an edge that makes box(0,0)
    // reach 3 sides while safe edges remain.
    const unsafe = new Set(['h1-0', 'v0-1']) // bottom & right of box(0,0)
    for (let k = 0; k < 20; k++) {
      const e = aiMove(s, 'hard', rngSeq([k / 20, (k * 7) % 20 / 20, 0.5]))
      expect(e).not.toBeNull()
      expect(unsafe.has(`${e!.type}${e!.r}-${e!.c}`)).toBe(false)
    }
  })

  it('captures greedily rather than playing a safe non-capturing edge', () => {
    // A capturing edge and a safe edge both exist; hard must capture.
    let s = newGame(3)
    // Give box(0,0) three sides: top, left, bottom → capture via v(0,1).
    s = drawEdge(s, { type: 'h', r: 0, c: 0 })
    s = drawEdge(s, { type: 'v', r: 0, c: 0 })
    s = drawEdge(s, { type: 'h', r: 1, c: 0 })
    expect(boxSides(s, 0, 0)).toBe(3)
    const e = aiMove(s, 'hard', rngConst(0.99))
    // The only capturing edge for box(0,0) is v(0,1).
    expect(e).toEqual({ type: 'v', r: 0, c: 1 })
  })
})

describe('determinism', () => {
  it('produces identical results for the same RNG sequence', () => {
    const seed = () => rngSeq([0.1, 0.9, 0.42, 0.7, 0.3, 0.55])
    const a = aiMove(newGame(4), 'hard', seed())
    const b = aiMove(newGame(4), 'hard', seed())
    expect(a).toEqual(b)
  })
})
