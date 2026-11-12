/**
 * Battleship content simulation — feeds src/content/guides/battleship.ts.
 *
 * Uses the REAL engine (randomFleet/fire/aiMove) with a seeded RNG and measures:
 *   1. shots each CPU difficulty needs to sink a random fleet (mean / median / p90);
 *   2. how often each region of the grid holds a ship cell under random placement;
 *   3. how many shots the Hard CPU needs against four hand-built placement styles;
 *   4. first-mover win rate when Hard plays Hard.
 *
 * Run: npx tsx scripts/content-sims/battleship.ts [games=2000]
 */
import {
  FLEET,
  SIZE,
  aiMove,
  cellsOf,
  createGame,
  emptyBoard,
  fire,
  mulberry32,
  randomBoard,
  randomFleet,
  canPlace,
  type Board,
  type Difficulty,
  type Orientation,
  type Rng,
  type Ship,
} from '../../src/lib/games/battleship/engine'

const N = Number(process.argv[2] ?? 2000)

/** Shots the CPU needs to sink every ship of `ships` (CPU alone on the board). */
function shotsToClear(ships: Ship[], diff: Difficulty, rng: Rng): number {
  const board: Board = { ships: ships.map((s) => ({ ...s })), shots: emptyBoard().shots }
  let state = createGame({ ships: board.ships, shots: board.shots }, rng)
  let shots = 0
  // Only the CPU shoots; hand the turn back after each shot so the dummy player never acts.
  while (state.winner === null && shots < 100) {
    const cell = aiMove(state, diff, rng)
    if (!cell) break
    state = { ...fire(state, cell), turn: 'cpu' }
    shots++
  }
  return state.winner === 'cpu' ? shots : NaN
}

const pct = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(a.length * p))]
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
const f1 = (x: number) => x.toFixed(1)

// 1) difficulty
console.log('## shots to sink a random fleet')
for (const d of ['easy', 'normal', 'hard'] as Difficulty[]) {
  const rng = mulberry32(1000 + d.length)
  const xs: number[] = []
  for (let i = 0; i < N; i++) {
    const v = shotsToClear(randomFleet(rng), d, rng)
    if (!Number.isNaN(v)) xs.push(v)
  }
  xs.sort((a, b) => a - b)
  console.log(d, 'n', xs.length, 'mean', f1(mean(xs)), 'median', pct(xs, 0.5), 'p10', pct(xs, 0.1), 'p90', pct(xs, 0.9))
}

// 2) occupancy by region under random placement
{
  const rng = mulberry32(7)
  const cnt = new Float64Array(SIZE * SIZE)
  const M = N * 5
  for (let i = 0; i < M; i++) for (const s of randomFleet(rng)) for (const [r, c] of cellsOf(s)) cnt[r * SIZE + c]++
  const region = { corner: [0, 0], edge: [0, 0], centre: [0, 0], ring2: [0, 0] }
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const d = Math.min(r, c, SIZE - 1 - r, SIZE - 1 - c)
      const corner = (r === 0 || r === SIZE - 1) && (c === 0 || c === SIZE - 1)
      const k = corner ? 'corner' : d === 0 ? 'edge' : d === 1 ? 'ring2' : 'centre'
      region[k][0] += cnt[r * SIZE + c]
      region[k][1]++
    }
  console.log('## per-cell chance a cell holds a ship (random placement)')
  for (const [k, [sum, n]] of Object.entries(region)) console.log(k, ((sum / n / M) * 100).toFixed(1) + '%', 'cells', n)
  console.log('fleet cells / 100 =', FLEET.reduce((a, s) => a + s.length, 0))
}

// 3) placement styles vs Hard
type Style = (rng: Rng) => Ship[]
function build(rng: Rng, pick: (len: number, rng: Rng, placed: Ship[]) => [number, number, Orientation][]): Ship[] {
  const ships: Ship[] = []
  for (const def of FLEET) {
    const cands = pick(def.length, rng, ships).filter(([r, c, d]) => canPlace(ships, r, c, d, def.length))
    const [r, c, d] = cands[Math.floor(rng() * cands.length)]
    ships.push({ id: def.id, name: def.name, length: def.length, row: r, col: c, dir: d, hits: 0 })
  }
  return ships
}
const allSlots = (len: number): [number, number, Orientation][] => {
  const out: [number, number, Orientation][] = []
  for (const d of ['H', 'V'] as Orientation[])
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const er = d === 'V' ? r + len - 1 : r
        const ec = d === 'H' ? c + len - 1 : c
        if (er < SIZE && ec < SIZE) out.push([r, c, d])
      }
  return out
}
const cellsOfSlot = (s: [number, number, Orientation], len: number) =>
  cellsOf({ row: s[0], col: s[1], dir: s[2], length: len })
const depth = (r: number, c: number) => Math.min(r, c, SIZE - 1 - r, SIZE - 1 - c)
const styles: Record<string, Style> = {
  random: (rng) => randomFleet(rng),
  'all on the rim': (rng) =>
    build(rng, (len) => allSlots(len).filter((s) => cellsOfSlot(s, len).every(([r, c]) => depth(r, c) === 0))),
  'centre block': (rng) =>
    build(rng, (len) => allSlots(len).filter((s) => cellsOfSlot(s, len).every(([r, c]) => depth(r, c) >= 2))),
  'ships touching': (rng) =>
    build(rng, (len, _r, placed) => {
      const slots = allSlots(len)
      if (placed.length === 0) return slots
      const occ = new Set(placed.flatMap((p) => cellsOf(p).map(([r, c]) => r * SIZE + c)))
      const touch = slots.filter((s) =>
        cellsOfSlot(s, len).some(([r, c]) =>
          [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => occ.has((r + dr) * SIZE + (c + dc))),
        ),
      )
      return touch.length ? touch : slots
    }),
  'no two ships touching': (rng) =>
    build(rng, (len, _r, placed) => {
      const occ = new Set(
        placed.flatMap((p) =>
          cellsOf(p).flatMap(([r, c]) => {
            const o: number[] = []
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) o.push((r + dr) * SIZE + (c + dc))
            return o
          }),
        ),
      )
      const ok = allSlots(len).filter((s) => cellsOfSlot(s, len).every(([r, c]) => !occ.has(r * SIZE + c)))
      return ok.length ? ok : allSlots(len)
    }),
}
console.log('## Hard CPU shots to clear, by placement style')
for (const [name, mk] of Object.entries(styles)) {
  const rng = mulberry32(99)
  const xs: number[] = []
  for (let i = 0; i < N; i++) {
    let fleet: Ship[]
    try { fleet = mk(rng) } catch { continue }
    const v = shotsToClear(fleet, 'hard', rng)
    if (!Number.isNaN(v)) xs.push(v)
  }
  xs.sort((a, b) => a - b)
  console.log(name.padEnd(24), 'n', xs.length, 'mean', f1(mean(xs)), 'median', pct(xs, 0.5), 'p90', pct(xs, 0.9))
}

// 4) Hard vs Hard, first mover
{
  const rng = mulberry32(4242)
  let firstWins = 0
  const M = N
  for (let i = 0; i < M; i++) {
    let state = createGame(randomBoard(rng), rng) // player moves first
    while (state.winner === null) {
      const cell =
        state.turn === 'cpu'
          ? aiMove(state, 'hard', rng)
          : aiMove({ ...state, playerBoard: state.cpuBoard }, 'hard', rng)
      if (!cell) break
      state = fire(state, cell)
    }
    if (state.winner === 'player') firstWins++
  }
  console.log('## Hard vs Hard first mover win rate', ((firstWins / M) * 100).toFixed(1) + '%', 'n', M)
}
