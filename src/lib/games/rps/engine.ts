// Rock Paper Scissors — pure, deterministic engine.
// Computer moves come from an injected rng so nothing here touches Math.random.

export type Move = 'rock' | 'paper' | 'scissors'
export type Outcome = 'win' | 'lose' | 'draw'
export type Rng = () => number

export const MOVES: readonly Move[] = ['rock', 'paper', 'scissors'] as const

// What each move beats.
const BEATS: Record<Move, Move> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
}

export interface Round {
  player: Move
  computer: Move
  outcome: Outcome
}

export interface Tallies {
  wins: number
  losses: number
  draws: number
}

export interface GameState {
  tallies: Tallies
  /** The most recently played round, or null before the first play. */
  last: Round | null
  /** Consecutive player wins (resets on loss or draw). */
  streak: number
}

/** Judge the player's move against the computer's move from the player's POV. */
export function judge(player: Move, computer: Move): Outcome {
  if (player === computer) return 'draw'
  return BEATS[player] === computer ? 'win' : 'lose'
}

/** Pick a computer move from an rng in [0, 1). Always within MOVES. */
export function computerMove(rng: Rng): Move {
  const index = Math.floor(rng() * MOVES.length)
  // Clamp defensively in case rng returns exactly 1 (or slightly out of range).
  return MOVES[Math.min(MOVES.length - 1, Math.max(0, index))]
}

export function newGame(): GameState {
  return {
    tallies: { wins: 0, losses: 0, draws: 0 },
    last: null,
    streak: 0,
  }
}

/** Play one round: the player picks a move, the computer's is drawn from rng. */
export function play(state: GameState, playerMove: Move, rng: Rng): GameState {
  const computer = computerMove(rng)
  const outcome = judge(playerMove, computer)
  const tallies: Tallies = {
    wins: state.tallies.wins + (outcome === 'win' ? 1 : 0),
    losses: state.tallies.losses + (outcome === 'lose' ? 1 : 0),
    draws: state.tallies.draws + (outcome === 'draw' ? 1 : 0),
  }
  return {
    tallies,
    last: { player: playerMove, computer, outcome },
    streak: outcome === 'win' ? state.streak + 1 : 0,
  }
}
