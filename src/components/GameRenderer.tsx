import { Game2048 } from '@/components/games/Game2048'
import { GameAimTrainer } from '@/components/games/GameAimTrainer'
import { GameBreakout } from '@/components/games/GameBreakout'
import { GameConnectFour } from '@/components/games/GameConnectFour'
import { GameHangman } from '@/components/games/GameHangman'
import { GameMemory } from '@/components/games/GameMemory'
import { GameMinesweeper } from '@/components/games/GameMinesweeper'
import { GameReaction } from '@/components/games/GameReaction'
import { GameSimon } from '@/components/games/GameSimon'
import { GameLightsOut } from '@/components/games/GameLightsOut'
import { GameMastermind } from '@/components/games/GameMastermind'
import { GamePong } from '@/components/games/GamePong'
import { GameRps } from '@/components/games/GameRps'
import { GameSliding } from '@/components/games/GameSliding'
import { GameSnake } from '@/components/games/GameSnake'
import { GameSudoku } from '@/components/games/GameSudoku'
import { GameTetris } from '@/components/games/GameTetris'
import { GameTicTacToe } from '@/components/games/GameTicTacToe'
import { GameTyping } from '@/components/games/GameTyping'
import { GameWhackAMole } from '@/components/games/GameWhackAMole'
import { GameWordGuess } from '@/components/games/GameWordGuess'
import { themes2048 } from '@/lib/games/g2048/themes'
import type { GamePage } from '@/lib/games/registry'

export function GameRenderer({ page }: { page: GamePage }) {
  switch (page.game) {
    case '2048':
      return <Game2048 theme={themes2048[page.themeKey]} storageKey={`best:${page.slug}`} />
    case 'snake':
      return <GameSnake storageKey={`best:${page.slug}`} />
    case 'minesweeper':
      return <GameMinesweeper />
    case 'memory':
      return <GameMemory storageKey={`best:${page.slug}`} />
    case 'typing':
      return <GameTyping storageKey={`best:${page.slug}`} />
    case 'tetris':
      return <GameTetris storageKey={`best:${page.slug}`} />
    case 'sliding':
      return <GameSliding storageKey={`best:${page.slug}`} />
    case 'breakout':
      return <GameBreakout storageKey={`best:${page.slug}`} />
    case 'word-guess':
      return <GameWordGuess storageKey={`best:${page.slug}`} />
    case 'tic-tac-toe':
      return <GameTicTacToe storageKey={`best:${page.slug}`} />
    case 'reaction-time':
      return <GameReaction storageKey={`best:${page.slug}`} />
    case 'connect-four':
      return <GameConnectFour storageKey={`best:${page.slug}`} />
    case 'hangman':
      return <GameHangman storageKey={`best:${page.slug}`} />
    case 'simon':
      return <GameSimon storageKey={`best:${page.slug}`} />
    case 'whack-a-mole':
      return <GameWhackAMole storageKey={`best:${page.slug}`} />
    case 'aim-trainer':
      return <GameAimTrainer storageKey={`best:${page.slug}`} />
    case 'sudoku':
      return <GameSudoku storageKey={`best:${page.slug}`} />
    case 'rps':
      return <GameRps storageKey={`best:${page.slug}`} />
    case 'pong':
      return <GamePong storageKey={`best:${page.slug}`} />
    case 'lights-out':
      return <GameLightsOut storageKey={`best:${page.slug}`} />
    case 'mastermind':
      return <GameMastermind storageKey={`best:${page.slug}`} />
    default: {
      page satisfies never
      return null
    }
  }
}
