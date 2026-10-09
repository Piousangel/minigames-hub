/**
 * Tetris content sim — measures the real engine's randomizer and speed curve.
 *
 * Run: npx --yes tsx@4.19.2 scripts/content-sims/tetris.ts
 *
 * 1. Piece randomizer: plays N spawns through the engine's own newGame/hardDrop
 *    loop (board reset whenever it tops out) and records the spawned sequence,
 *    so the 7-bag behaviour is observed, not assumed.
 * 2. Gravity curve: prints gravityMs(level) and how long a full 20-row fall takes.
 * 3. Score table: LINE_SCORES x level, derived through lockPiece on hand-built boards.
 */
import {
  emptyBoard,
  gravityMs,
  hardDrop,
  HEIGHT,
  lockPiece,
  newGame,
  WIDTH,
  type PieceType,
  type Rng,
  type TetrisState,
} from '../../src/lib/games/tetris/engine'

function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- 1. randomizer ----------
// One continuous game: every piece is hard-dropped, then the board is wiped so
// the game never tops out (a top-out restart would cut a bag short and bias
// the counts). The spawn order is still produced entirely by the engine.
const N = 700_000
// Also: gap between consecutive I pieces (pieces in between) and S/Z runs.
function droughts(piece: PieceType, spawns: number, seed: number) {
  const r = mulberry32(seed)
  let st = newGame(r)
  const counts: Record<string, number> = {}
  const hist = new Map<number, number>()
  let since = -1
  let maxSZRun = 0
  let curSZ = 0
  for (let i = 0; i < spawns; i++) {
    const t = st.active!.type
    counts[t] = (counts[t] ?? 0) + 1
    if (t === piece) {
      if (since >= 0) hist.set(since, (hist.get(since) ?? 0) + 1)
      since = 0
    } else if (since >= 0) since++
    if (t === 'S' || t === 'Z') {
      curSZ++
      maxSZRun = Math.max(maxSZRun, curSZ)
    } else curSZ = 0
    // lock in place then wipe the board so the game never ends
    st = hardDrop(st, r)
    st = { ...st, board: emptyBoard() }
    if (!st.active) throw new Error('unexpected top-out')
  }
  return { hist, maxSZRun, counts }
}
const { hist, maxSZRun, counts } = droughts('I', N, 20261009)
console.log(`# Randomizer (${N.toLocaleString()} spawns, one continuous game, seed 20261009)`)
for (const p of ['I', 'O', 'T', 'S', 'Z', 'J', 'L']) {
  console.log(`  ${p}: ${counts[p]} (${((100 * counts[p]) / N).toFixed(3)}%)`)
}
const gaps = [...hist.entries()].sort((a, b) => a[0] - b[0])
const totalGaps = gaps.reduce((a, [, n]) => a + n, 0)
const mean = gaps.reduce((a, [g, n]) => a + g * n, 0) / totalGaps
console.log(`\n# Pieces between consecutive I pieces (${totalGaps.toLocaleString()} gaps, one continuous ${N.toLocaleString()}-spawn game)`)
let cum = 0
for (const [g, n] of gaps) {
  cum += n
  console.log(`  gap ${String(g).padStart(2)}: ${((100 * n) / totalGaps).toFixed(2)}%  (cum ${((100 * cum) / totalGaps).toFixed(2)}%)`)
}
console.log(`  mean gap: ${mean.toFixed(3)}; max gap: ${gaps[gaps.length - 1][0]}`)
console.log(`  longest run of consecutive S/Z spawns: ${maxSZRun}`)

// ---------- 2. gravity ----------
console.log('\n# Gravity per level (gravityMs) and full 20-row fall time')
for (let L = 1; L <= 16; L++) {
  const ms = gravityMs(L)
  console.log(`  level ${String(L).padStart(2)} (lines ${(L - 1) * 10}-${L * 10 - 1}): ${ms} ms/row, ${((ms * (HEIGHT - 1)) / 1000).toFixed(2)} s to fall 19 rows`)
}

// ---------- 3. score table via lockPiece ----------
// Build a board with `n` full-minus-one rows and an I piece that completes them.
function clearScore(n: number, level: number): number {
  const board = emptyBoard()
  for (let r = HEIGHT - n; r < HEIGHT; r++) for (let c = 0; c < WIDTH - 1; c++) board[r][c] = 2
  const vertI = [[1], [1], [1], [1]].slice(0, 4)
  const base = newGame(mulberry32(1))
  const st: TetrisState = {
    ...base,
    board,
    level,
    lines: (level - 1) * 10,
    score: 0,
    active: { type: 'I', matrix: vertI, row: HEIGHT - 4, col: WIDTH - 1 },
  }
  return lockPiece(st, mulberry32(2)).score
}
console.log('\n# Points for a clear (measured through lockPiece)')
for (const L of [1, 2, 5, 10]) {
  // n<4 rows: only the bottom n rows are near-full; I still fills 4 cells of the last column
  const row = [1, 2, 3, 4].map((n) => clearScore(n, L))
  console.log(`  level ${L}: single ${row[0]}, double ${row[1]}, triple ${row[2]}, tetris ${row[3]}; 4 singles = ${4 * row[0]} vs 1 tetris = ${row[3]}`)
}
