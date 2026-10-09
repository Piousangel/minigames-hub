/**
 * Connect Four: bots vs the site's real AI (`aiMove`) through the real engine.
 * Run: npx tsx scripts/content-sims/connectfour-vs-ai.ts
 * Deterministic: every random choice (bots and the AI's tie-breaks) draws from
 * one mulberry32 stream per matchup with a fixed seed.
 */
import {
  aiMove,
  dropDisc,
  isDraw,
  lowestEmptyRow,
  newGame,
  validCols,
  winner,
  type GameState,
  type Player,
  type Rng,
} from '../../src/lib/games/connectfour/engine'
import { mulberry32 } from '../../src/lib/games/yahtzee/engine'

type Bot = { name: string; move: (s: GameState, rng: Rng) => number }

const randomBot: Bot = { name: 'Random', move: (s, rng) => aiMove(s, 'easy', rng) }
const hardAi: Bot = { name: 'Site AI (hard)', move: (s, rng) => aiMove(s, 'hard', rng) }

function winsAt(s: GameState, col: number, p: Player): boolean {
  if (lowestEmptyRow(s.board, col) === -1) return false
  const probe = dropDisc({ ...s, current: p }, col)
  return winner(probe)?.player === p
}

/** Takes a win, blocks a loss, otherwise plays the legal column nearest the center. */
const centerBot: Bot = {
  name: 'Win/block/center',
  move: (s) => {
    const order = [3, 2, 4, 1, 5, 0, 6].filter((c) => validCols(s.board).includes(c))
    const opp: Player = s.current === 'R' ? 'Y' : 'R'
    return (
      order.find((c) => winsAt(s, c, s.current)) ??
      order.find((c) => winsAt(s, c, opp)) ??
      order[0]
    )
  },
}

/** Like centerBot, but never plays under a square the opponent would win on. */
const carefulBot: Bot = {
  name: 'Win/block/safe-center',
  move: (s, rng) => {
    const valid = validCols(s.board)
    const opp: Player = s.current === 'R' ? 'Y' : 'R'
    const order = [3, 2, 4, 1, 5, 0, 6].filter((c) => valid.includes(c))
    const win = order.find((c) => winsAt(s, c, s.current))
    if (win !== undefined) return win
    const block = order.find((c) => winsAt(s, c, opp))
    if (block !== undefined) return block
    const safe = order.filter((c) => {
      const after = dropDisc(s, c)
      return !validCols(after.board).some((c2) => winsAt(after, c2, opp))
    })
    const pool = safe.length ? safe : order
    // Slight randomness among the two most central safe options keeps games varied.
    return pool.length > 1 && rng() < 0.25 ? pool[1] : pool[0]
  },
}

function play(first: Bot, second: Bot, rng: Rng) {
  let s = newGame()
  let moves = 0
  let seq = ''
  while (!winner(s) && !isDraw(s)) {
    const bot = s.current === 'R' ? first : second
    const col = bot.move(s, rng)
    const next = dropDisc(s, col)
    if (next === s) throw new Error(`${bot.name} made an illegal move`)
    s = next
    moves++
    seq += col
  }
  return { w: winner(s)?.player ?? null, moves, seq }
}

function matchup(first: Bot, second: Bot, games: number, seed: number) {
  const rng = mulberry32(seed)
  let r = 0
  let y = 0
  let d = 0
  let len = 0
  const distinct = new Set<string>()
  const t0 = Date.now()
  for (let i = 0; i < games; i++) {
    const { w, moves, seq } = play(first, second, rng)
    distinct.add(seq)
    if (w === 'R') r++
    else if (w === 'Y') y++
    else d++
    len += moves
  }
  const p = (n: number) => ((100 * n) / games).toFixed(1) + '%'
  console.log(
    `${first.name.padEnd(22)} vs ${second.name.padEnd(22)} n=${games}  first wins ${p(r)}  second wins ${p(y)}  draws ${p(d)}  avg discs ${(len / games).toFixed(1)}  distinct games ${distinct.size}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  )
}

const N_FAST = 100_000
const N_AI = 2_000
console.log('first player = Red (the human seat on the site); second = Yellow (the CPU seat)\n')
matchup(randomBot, randomBot, N_FAST, 1)
matchup(centerBot, centerBot, N_AI, 2)
matchup(randomBot, hardAi, N_AI, 3)
matchup(centerBot, hardAi, N_AI, 4)
matchup(carefulBot, hardAi, N_AI, 5)
matchup(hardAi, randomBot, N_AI, 6)
matchup(hardAi, carefulBot, N_AI, 7)
matchup(hardAi, hardAi, N_AI, 8)
