import { describe, expect, it } from 'vitest'
import {
  aiMove,
  canPlace,
  cellsOf,
  cloneBoard,
  createGame,
  emptyBoard,
  fire,
  FLEET,
  FLEET_CELLS,
  fleetComplete,
  fleetDestroyed,
  inBounds,
  isSunk,
  mulberry32,
  placementCells,
  placeShip,
  randomBoard,
  randomFleet,
  shipsRemaining,
  SIZE,
  type Board,
  type Coord,
  type Difficulty,
  type GameState,
  type Ship,
  type ShipId,
} from './engine'

// ── helpers ──────────────────────────────────────────────────────────────────

const def = (id: ShipId) => FLEET.find((s) => s.id === id)!
const key = ([r, c]: Coord): string => `${r},${c}`

/** Place a single ship on a fresh board (helper for scripted positions). */
function boardWith(ships: Ship[]): Board {
  return { ships: ships.map((s) => ({ ...s })), shots: emptyBoard().shots }
}

function mkShip(id: ShipId, row: number, col: number, dir: 'H' | 'V'): Ship {
  const d = def(id)
  return { id, name: d.name, length: d.length, row, col, dir, hits: 0 }
}

/** All cells occupied by every ship on a board. */
function occupiedKeys(ships: Ship[]): Set<string> {
  const set = new Set<string>()
  for (const s of ships) for (const cell of cellsOf(s)) set.add(key(cell))
  return set
}

// ── fleet definition ─────────────────────────────────────────────────────────

describe('fleet definition', () => {
  it('is the standard 5-ship fleet with correct lengths', () => {
    expect(FLEET.map((s) => s.length)).toEqual([5, 4, 3, 3, 2])
    expect(FLEET.map((s) => s.id)).toEqual(['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer'])
  })

  it('totals 17 occupied cells', () => {
    expect(FLEET_CELLS).toBe(17)
  })

  it('cellsOf lays a ship out horizontally and vertically', () => {
    expect(cellsOf(mkShip('cruiser', 2, 3, 'H')).map(key)).toEqual(['2,3', '2,4', '2,5'])
    expect(cellsOf(mkShip('cruiser', 2, 3, 'V')).map(key)).toEqual(['2,3', '3,3', '4,3'])
  })
})

// ── placement legality ───────────────────────────────────────────────────────

describe('placement legality', () => {
  it('placementCells returns null when a ship runs off the grid', () => {
    expect(placementCells(0, 7, 'H', 5)).toBeNull() // 7..11 off the right edge
    expect(placementCells(8, 0, 'V', 5)).toBeNull() // 8..12 off the bottom
    expect(placementCells(0, 5, 'H', 5)).not.toBeNull() // 5..9 exactly fits
  })

  it('canPlace rejects off-grid placements', () => {
    expect(canPlace([], 0, 6, 'H', 5)).toBe(false)
    expect(canPlace([], 0, 5, 'H', 5)).toBe(true)
  })

  it('canPlace rejects overlapping placements', () => {
    const ships = [mkShip('carrier', 0, 0, 'H')] // occupies (0,0)..(0,4)
    expect(canPlace(ships, 0, 4, 'V', 3)).toBe(false) // (0,4) collides
    expect(canPlace(ships, 1, 0, 'H', 3)).toBe(true) // row 1 is clear
  })

  it('allows ships to TOUCH side-by-side (classic rule, adjacency permitted)', () => {
    const ships = [mkShip('carrier', 0, 0, 'H')] // (0,0)..(0,4)
    // Directly below, touching along the whole edge — legal under our rule.
    expect(canPlace(ships, 1, 0, 'H', 4)).toBe(true)
  })

  it('allows ships to touch at a corner (diagonal adjacency permitted)', () => {
    const ships = [mkShip('destroyer', 0, 0, 'H')] // (0,0),(0,1)
    expect(canPlace(ships, 1, 2, 'H', 3)).toBe(true) // corner-touch at (1,2)
  })

  it('placeShip returns a new fleet on success and null on overlap', () => {
    const one = placeShip([], def('carrier'), 0, 0, 'H')
    expect(one).not.toBeNull()
    const bad = placeShip(one!, def('battleship'), 0, 0, 'V') // (0,0) taken
    expect(bad).toBeNull()
    const good = placeShip(one!, def('battleship'), 2, 0, 'H')
    expect(good).toHaveLength(2)
  })

  it('placeShip re-places the same ship id without self-collision', () => {
    let ships = placeShip([], def('cruiser'), 0, 0, 'H')!
    ships = placeShip(ships, def('cruiser'), 0, 1, 'H')! // moved, ignores its own old cells
    expect(ships).toHaveLength(1)
    expect(ships[0].col).toBe(1)
  })

  it('fleetComplete only true once all five ships are down', () => {
    let ships: Ship[] = []
    expect(fleetComplete(ships)).toBe(false)
    for (const d of FLEET) ships = placeShip(ships, d, 0, 0, 'V') ?? ships // stack in column 0? no — spread
    // Place them properly instead:
    ships = []
    let col = 0
    for (const d of FLEET) {
      ships = placeShip(ships, d, 0, col, 'V')!
      col += 1
    }
    expect(fleetComplete(ships)).toBe(true)
  })
})

// ── random placement across many seeds ───────────────────────────────────────

describe('random fleet placement', () => {
  it('produces a complete, legal, non-overlapping fleet for 300 seeds', () => {
    for (let seed = 0; seed < 300; seed++) {
      const ships = randomFleet(mulberry32(seed))
      // All five ships present, correct lengths.
      expect(ships).toHaveLength(FLEET.length)
      expect(fleetComplete(ships)).toBe(true)
      for (const d of FLEET) {
        const s = ships.find((x) => x.id === d.id)!
        expect(s.length).toBe(d.length)
      }
      // Every cell on-grid.
      const cells = ships.flatMap(cellsOf)
      for (const [r, c] of cells) expect(inBounds(r, c)).toBe(true)
      // No overlaps: 17 distinct cells.
      const uniq = occupiedKeys(ships)
      expect(uniq.size).toBe(FLEET_CELLS)
    }
  })

  it('is deterministic for a fixed seed', () => {
    const a = randomFleet(mulberry32(42))
    const b = randomFleet(mulberry32(42))
    expect(a).toEqual(b)
  })

  it('produces different layouts for different seeds', () => {
    const a = JSON.stringify(randomFleet(mulberry32(1)))
    const b = JSON.stringify(randomFleet(mulberry32(2)))
    expect(a).not.toBe(b)
  })

  it('randomBoard has a clean shot grid', () => {
    const b = randomBoard(mulberry32(7))
    expect(b.shots.flat().every((s) => s === 'none')).toBe(true)
  })
})

// ── firing: hit / miss / sunk ────────────────────────────────────────────────

describe('fire — hit, miss, sunk', () => {
  function scriptedGame(): GameState {
    // Player board irrelevant here; CPU board has a known destroyer at (0,0)-(0,1).
    const player = boardWith([mkShip('carrier', 9, 0, 'H')])
    const g = createGame(player, mulberry32(0))
    // Overwrite the CPU board with a scripted single destroyer for clarity.
    return {
      ...g,
      cpuBoard: boardWith([mkShip('destroyer', 0, 0, 'H')]),
    }
  }

  it('marks a miss on empty water and hands over the turn', () => {
    const g = scriptedGame()
    const next = fire(g, [5, 5])
    expect(next).not.toBe(g)
    expect(next.cpuBoard.shots[5][5]).toBe('miss')
    expect(next.lastShot).toMatchObject({ by: 'player', result: 'miss', sunk: null })
    expect(next.turn).toBe('cpu')
  })

  it('marks a hit but not a sink when only part of a ship is struck', () => {
    const g = scriptedGame()
    const next = fire(g, [0, 0])
    expect(next.cpuBoard.shots[0][0]).toBe('hit')
    expect(next.lastShot).toMatchObject({ result: 'hit', sunk: null })
    const ship = next.cpuBoard.ships[0]
    expect(ship.hits).toBe(1)
    expect(isSunk(ship)).toBe(false)
  })

  it('detects a sink ONLY when every cell of a ship is hit', () => {
    let g = scriptedGame()
    g = fire(g, [0, 0]) // hit (player)
    g = fire(g, [3, 3]) // cpu fires somewhere (miss on player water)
    // Back to player: finish the destroyer.
    expect(g.turn).toBe('player')
    g = fire(g, [0, 1]) // sinks destroyer
    expect(g.lastShot).toMatchObject({ result: 'sunk', sunk: 'destroyer' })
    expect(isSunk(g.cpuBoard.ships[0])).toBe(true)
  })

  it('does not sink until the LAST cell — partial fleet stays afloat', () => {
    const player = boardWith([mkShip('carrier', 9, 0, 'H')])
    let g: GameState = {
      ...createGame(player, mulberry32(0)),
      cpuBoard: boardWith([mkShip('cruiser', 0, 0, 'H')]), // 3 long
    }
    g = fire(g, [0, 0]) // hit
    g = fire(g, [3, 3]) // cpu turn
    g = fire(g, [0, 1]) // hit
    expect(g.lastShot?.result).toBe('hit')
    g = fire(g, [4, 4]) // cpu turn
    g = fire(g, [0, 2]) // now sunk
    expect(g.lastShot?.result).toBe('sunk')
  })
})

// ── win detection ────────────────────────────────────────────────────────────

describe('win detection', () => {
  it('declares the player the winner only when ALL five enemy ships are sunk', () => {
    const player = randomBoard(mulberry32(1))
    // Full known enemy fleet in a compact block via randomFleet is awkward; use
    // a real random enemy fleet and just fire at every one of its cells.
    const enemy = randomBoard(mulberry32(99))
    let g: GameState = { ...createGame(player, mulberry32(1)), cpuBoard: enemy }
    const enemyCells = enemy.ships.flatMap(cellsOf)
    const enemyKeys = new Set(enemyCells.map(key))

    // Fire at each enemy ship cell in turn; between player shots the CPU also
    // fires (we let it miss into a corner-free area by scripting player-safe
    // shots — but simplest: just alternate, the CPU may hit us, that's fine as
    // long as it doesn't sink our whole fleet first — player has 17 cells too).
    let won = false
    for (const [r, c] of enemyCells) {
      if (g.winner) break
      if (g.turn !== 'player') {
        // give the CPU a harmless move by firing at a fixed spot far away
        // (deterministic easy AI); loop until player's turn returns.
        g = fire(g, aiMove(g, 'easy', mulberry32(g.playerBoard.shots.flat().filter((s) => s !== 'none').length + 1))!)
      }
      if (g.winner) break
      if (g.turn === 'player' && g.cpuBoard.shots[r][c] === 'none') {
        g = fire(g, [r, c])
      }
    }
    // Some player shots may have been consumed while it wasn't the player's turn;
    // finish deterministically: keep firing player shots at remaining enemy cells.
    let guard = 0
    while (!g.winner && guard++ < 500) {
      if (g.turn === 'cpu') {
        const m = aiMove(g, 'easy', mulberry32(guard))
        if (!m) break
        g = fire(g, m)
        continue
      }
      const target = enemyCells.find(([r, c]) => g.cpuBoard.shots[r][c] === 'none')
      if (!target) break
      g = fire(g, target)
    }
    won = g.winner === 'player'
    expect(won).toBe(true)
    expect(fleetDestroyed(g.cpuBoard)).toBe(true)
    // Sanity: everything we hit was an actual ship cell.
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (g.cpuBoard.shots[r][c] === 'hit') expect(enemyKeys.has(key([r, c]))).toBe(true)
  })

  it('is not won while a single enemy ship cell remains', () => {
    const player = boardWith([mkShip('carrier', 9, 0, 'H')])
    let g: GameState = {
      ...createGame(player, mulberry32(0)),
      cpuBoard: boardWith([mkShip('destroyer', 0, 0, 'H')]),
    }
    g = fire(g, [0, 0]) // hit one of two cells
    expect(g.winner).toBeNull()
    expect(fleetDestroyed(g.cpuBoard)).toBe(false)
  })

  it('shipsRemaining counts only unsunk ships', () => {
    const b = boardWith([mkShip('destroyer', 0, 0, 'H'), mkShip('cruiser', 2, 0, 'H')])
    expect(shipsRemaining(b)).toBe(2)
    b.ships[0].hits = 2 // sink the destroyer
    expect(shipsRemaining(b)).toBe(1)
  })
})

// ── illegal moves are === no-ops ─────────────────────────────────────────────

describe('illegal fire is a no-op (=== same reference)', () => {
  const player = boardWith([mkShip('carrier', 9, 0, 'H')])
  const base: GameState = {
    ...createGame(player, mulberry32(0)),
    cpuBoard: boardWith([mkShip('destroyer', 0, 0, 'H')]),
  }

  it('firing the same cell twice returns the SAME state', () => {
    const once = fire(base, [5, 5])
    // it's the CPU's turn now; force back to player for the repeat test
    const playerTurn: GameState = { ...once, turn: 'player' }
    const twice = fire(playerTurn, [5, 5]) // already a miss here
    expect(twice).toBe(playerTurn)
  })

  it('firing after the game is over returns the SAME state', () => {
    // Sink the destroyer to end this (single-ship) game.
    let g = fire(base, [0, 0])
    g = { ...g, turn: 'player' } // skip CPU
    g = fire(g, [0, 1]) // sunk → player wins
    expect(g.winner).toBe('player')
    const after = fire(g, [7, 7])
    expect(after).toBe(g)
  })

  it('firing off the grid returns the SAME state', () => {
    expect(fire(base, [-1, 0])).toBe(base)
    expect(fire(base, [0, SIZE])).toBe(base)
  })

  it('a legal fire returns a NEW state (not the same reference)', () => {
    expect(fire(base, [4, 4])).not.toBe(base)
  })
})

// ── AI: never repeats, never illegal ─────────────────────────────────────────

describe('AI never fires the same cell twice or fires illegally', () => {
  const diffs: Difficulty[] = ['easy', 'normal', 'hard']

  for (const diff of diffs) {
    it(`${diff}: over 20 full games, every CPU shot is unfired and on-grid`, () => {
      for (let seed = 0; seed < 20; seed++) {
        const rng = mulberry32(seed * 101 + 7)
        // Random player fleet for the CPU to hunt.
        let g: GameState = {
          ...createGame(randomBoard(mulberry32(seed)), mulberry32(seed + 1)),
          turn: 'cpu',
        }
        const fired = new Set<string>()
        let guard = 0
        while (!g.winner && guard++ < 200) {
          if (g.turn === 'cpu') {
            const move = aiMove(g, diff, rng)
            expect(move).not.toBeNull()
            const [r, c] = move!
            expect(inBounds(r, c)).toBe(true)
            expect(g.playerBoard.shots[r][c]).toBe('none') // never a repeat
            expect(fired.has(key(move!))).toBe(false)
            fired.add(key(move!))
            g = fire(g, move!)
          } else {
            // player fires harmlessly (deterministic) to advance the game
            const spot = firstUnfired(g.cpuBoard)
            if (!spot) break
            g = fire(g, spot)
          }
        }
        // CPU should have been able to sink the whole player fleet.
        expect(fleetDestroyed(g.playerBoard) || g.winner !== null).toBe(true)
      }
    })
  }
})

function firstUnfired(board: Board): Coord | null {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (board.shots[r][c] === 'none') return [r, c]
  return null
}

// ── AI: hunt uses parity ─────────────────────────────────────────────────────

describe('AI hunt mode uses a parity / checkerboard pattern', () => {
  it('normal AI opens on an even-parity cell (no hits yet)', () => {
    const g: GameState = { ...createGame(randomBoard(mulberry32(3)), mulberry32(4)), turn: 'cpu' }
    for (let s = 0; s < 30; s++) {
      const move = aiMove(g, 'normal', mulberry32(s))!
      expect((move[0] + move[1]) % 2).toBe(0)
    }
  })

  it('hard AI opens on an even-parity cell (density + parity gate)', () => {
    const g: GameState = { ...createGame(randomBoard(mulberry32(5)), mulberry32(6)), turn: 'cpu' }
    for (let s = 0; s < 30; s++) {
      const move = aiMove(g, 'hard', mulberry32(s))!
      expect((move[0] + move[1]) % 2).toBe(0)
    }
  })
})

// ── AI: TARGET behaviour after a hit ─────────────────────────────────────────

describe('AI target mode — after a hit it fires adjacent, then follows the line', () => {
  /** A player board whose only unsunk-relevant ship is a cruiser at (4,4)-(4,6). */
  function planted(): GameState {
    const player = boardWith([mkShip('cruiser', 4, 4, 'H')])
    return { ...createGame(player, mulberry32(0)), turn: 'cpu', cpuBoard: boardWith([mkShip('destroyer', 0, 0, 'H')]) }
  }

  it('after a single hit, the next CPU shot is orthogonally adjacent to it', () => {
    let g = planted()
    // Force a hit at (4,4) by having the CPU fire there.
    g = fire(g, [4, 4])
    expect(g.playerBoard.shots[4][4]).toBe('hit')
    // Skip the player's turn.
    g = { ...g, turn: 'cpu' }
    for (let s = 0; s < 20; s++) {
      const move = aiMove(g, 'normal', mulberry32(s))!
      const adjacent = Math.abs(move[0] - 4) + Math.abs(move[1] - 4) === 1
      expect(adjacent).toBe(true)
    }
  })

  it('after TWO colinear hits, the CPU continues along that line (not off-axis)', () => {
    let g = planted()
    g = fire(g, [4, 4]) // hit
    g = { ...g, turn: 'cpu' }
    g = fire(g, [4, 5]) // hit — now (4,4)&(4,5) are colinear (row 4)
    g = { ...g, turn: 'cpu' }
    for (let s = 0; s < 20; s++) {
      const move = aiMove(g, 'normal', mulberry32(s))!
      // Must extend the horizontal line: same row, at col 3 or col 6.
      expect(move[0]).toBe(4)
      expect(move[1] === 3 || move[1] === 6).toBe(true)
    }
  })

  it('hard AI also concentrates fire adjacent to a lone hit', () => {
    let g = planted()
    g = fire(g, [4, 4])
    g = { ...g, turn: 'cpu' }
    for (let s = 0; s < 20; s++) {
      const move = aiMove(g, 'hard', mulberry32(s))!
      const adjacent = Math.abs(move[0] - 4) + Math.abs(move[1] - 4) === 1
      expect(adjacent).toBe(true)
    }
  })
})

// ── AI: sinks a planted ship faster than random ──────────────────────────────

describe('AI hunt/target sinks faster than random fire', () => {
  /** Shots the given AI needs to sink the whole player fleet. */
  function shotsToClear(diff: Difficulty, seed: number): number {
    let g: GameState = { ...createGame(randomBoard(mulberry32(seed)), mulberry32(seed + 1)), turn: 'cpu' }
    const rng = mulberry32(seed * 31 + 3)
    let shots = 0
    let guard = 0
    while (!fleetDestroyed(g.playerBoard) && guard++ < 500) {
      // Always keep it the CPU's turn — we only measure the CPU's hunting.
      const cpuState: GameState = { ...g, turn: 'cpu' }
      const move = aiMove(cpuState, diff, rng)
      if (!move) break
      g = fire(cpuState, move)
      shots++
    }
    return shots
  }

  it('normal beats easy on total shots summed across many seeds', () => {
    let normalTotal = 0
    let easyTotal = 0
    for (let seed = 0; seed < 25; seed++) {
      normalTotal += shotsToClear('normal', seed)
      easyTotal += shotsToClear('easy', seed)
    }
    // Random fire needs ~95+ shots on average; hunt/target needs far fewer.
    expect(normalTotal).toBeLessThan(easyTotal)
  })

  it('hard beats easy and is no worse than normal on total shots', () => {
    let hardTotal = 0
    let normalTotal = 0
    let easyTotal = 0
    for (let seed = 0; seed < 25; seed++) {
      hardTotal += shotsToClear('hard', seed)
      normalTotal += shotsToClear('normal', seed)
      easyTotal += shotsToClear('easy', seed)
    }
    expect(hardTotal).toBeLessThan(easyTotal)
    expect(hardTotal).toBeLessThanOrEqual(normalTotal)
  })

  it('a wounded ship is finished efficiently (no wasted shots off its cells once found)', () => {
    // Cruiser at (4,4)-(4,6); once the CPU hits it, target mode should finish it
    // within a handful of shots.
    let g: GameState = {
      ...createGame(boardWith([mkShip('cruiser', 4, 4, 'H')]), mulberry32(0)),
      turn: 'cpu',
    }
    g = fire(g, [4, 5]) // seed a middle hit
    const rng = mulberry32(9)
    let shots = 0
    while (!fleetDestroyed(g.playerBoard) && shots < 12) {
      const cpu: GameState = { ...g, turn: 'cpu' }
      g = fire(cpu, aiMove(cpu, 'normal', rng)!)
      shots++
    }
    expect(fleetDestroyed(g.playerBoard)).toBe(true)
    // Middle hit + 2 more ship cells + at most 2 probes around = well under 12.
    expect(shots).toBeLessThanOrEqual(6)
  })
})

// ── AI: determinism ──────────────────────────────────────────────────────────

describe('AI determinism for fixed state + seed', () => {
  const diffs: Difficulty[] = ['easy', 'normal', 'hard']

  for (const diff of diffs) {
    it(`${diff}: same state + same seed → identical move`, () => {
      const g: GameState = { ...createGame(randomBoard(mulberry32(11)), mulberry32(12)), turn: 'cpu' }
      const a = aiMove(g, diff, mulberry32(77))
      const b = aiMove(g, diff, mulberry32(77))
      expect(a).toEqual(b)
    })
  }

  it('does not mutate the state it is given', () => {
    const g: GameState = { ...createGame(randomBoard(mulberry32(13)), mulberry32(14)), turn: 'cpu' }
    const snapshot = JSON.stringify(g)
    aiMove(g, 'hard', mulberry32(1))
    expect(JSON.stringify(g)).toBe(snapshot)
  })
})

// ── state hygiene ────────────────────────────────────────────────────────────

describe('state hygiene', () => {
  it('createGame gives the player the first move and a clean player shot grid', () => {
    const player = randomBoard(mulberry32(1))
    const g = createGame(player, mulberry32(2))
    expect(g.turn).toBe('player')
    expect(g.winner).toBeNull()
    expect(g.lastShot).toBeNull()
    expect(g.playerBoard.shots.flat().every((s) => s === 'none')).toBe(true)
    expect(g.cpuBoard.ships).toHaveLength(FLEET.length)
  })

  it('fire does not mutate the previous state', () => {
    const player = boardWith([mkShip('carrier', 9, 0, 'H')])
    const g: GameState = { ...createGame(player, mulberry32(0)), cpuBoard: boardWith([mkShip('destroyer', 0, 0, 'H')]) }
    const snapshot = JSON.stringify(g)
    fire(g, [0, 0])
    expect(JSON.stringify(g)).toBe(snapshot)
  })

  it('cloneBoard makes an independent deep copy', () => {
    const b = randomBoard(mulberry32(1))
    const c = cloneBoard(b)
    c.shots[0][0] = 'miss'
    c.ships[0].hits = 3
    expect(b.shots[0][0]).toBe('none')
    expect(b.ships[0].hits).toBe(0)
  })
})
