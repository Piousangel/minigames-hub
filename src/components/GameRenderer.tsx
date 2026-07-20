import { Game2048 } from '@/components/games/Game2048'
import { GameAimTrainer } from '@/components/games/GameAimTrainer'
import { GameBackspace } from '@/components/games/GameBackspace'
import { GameBreakout } from '@/components/games/GameBreakout'
import { GameBubbleShooter } from '@/components/games/GameBubbleShooter'
import { GameCheckers } from '@/components/games/GameCheckers'
import { GameCleave } from '@/components/games/GameCleave'
import { GameConnectFour } from '@/components/games/GameConnectFour'
import { GameDecant } from '@/components/games/GameDecant'
import { GameDotsAndBoxes } from '@/components/games/GameDotsAndBoxes'
import { GameDuplex } from '@/components/games/GameDuplex'
import { GameFlappy } from '@/components/games/GameFlappy'
import { GameFuse } from '@/components/games/GameFuse'
import { GameFlywheel } from '@/components/games/GameFlywheel'
import { GameGemMatch } from '@/components/games/GameGemMatch'
import { GameHangman } from '@/components/games/GameHangman'
import { GameLatch } from '@/components/games/GameLatch'
import { GameMaze } from '@/components/games/GameMaze'
import { GameMemory } from '@/components/games/GameMemory'
import { GameMinesweeper } from '@/components/games/GameMinesweeper'
import { GameNonogram } from '@/components/games/GameNonogram'
import { GameNumberMemory } from '@/components/games/GameNumberMemory'
import { GameOverdub } from '@/components/games/GameOverdub'
import { GameOverload } from '@/components/games/GameOverload'
import { GamePinwheel } from '@/components/games/GamePinwheel'
import { GameDeepdive } from '@/components/games/GameDeepdive'
import { GameFlapjack } from '@/components/games/GameFlapjack'
import { GameHandful } from '@/components/games/GameHandful'
import { GameInterlock } from '@/components/games/GameInterlock'
import { GameClusters } from '@/components/games/GameClusters'
import { GameQuadle } from '@/components/games/GameQuadle'
import { GameEquate } from '@/components/games/GameEquate'
import { GameReactor } from '@/components/games/GameReactor'
import { GameSolitaire } from '@/components/games/GameSolitaire'
import { GameFreecell } from '@/components/games/GameFreecell'
import { GameSpider } from '@/components/games/GameSpider'
import { GamePyramid } from '@/components/games/GamePyramid'
import { GameTripeaks } from '@/components/games/GameTripeaks'
import { GameMahjong } from '@/components/games/GameMahjong'
import { GameChess } from '@/components/games/GameChess'
import { GamePolytap } from '@/components/games/GamePolytap'
import { GameSonar } from '@/components/games/GameSonar'
import { GameProspector } from '@/components/games/GameProspector'
import { GameOverfold } from '@/components/games/GameOverfold'
import { GameQuarry } from '@/components/games/GameQuarry'
import { GameReaction } from '@/components/games/GameReaction'
import { GameReversi } from '@/components/games/GameReversi'
import { GameRicochet } from '@/components/games/GameRicochet'
import { GameRipple } from '@/components/games/GameRipple'
import { GameSokoban } from '@/components/games/GameSokoban'
import { GameSpaceShooter } from '@/components/games/GameSpaceShooter'
import { GameSplice } from '@/components/games/GameSplice'
import { GameStackpot } from '@/components/games/GameStackpot'
import { GameTowerStack } from '@/components/games/GameTowerStack'
import { GameSimon } from '@/components/games/GameSimon'
import { GameLightsOut } from '@/components/games/GameLightsOut'
import { GameMastermind } from '@/components/games/GameMastermind'
import { GamePong } from '@/components/games/GamePong'
import { GameRps } from '@/components/games/GameRps'
import { GameSliding } from '@/components/games/GameSliding'
import { GameSnake } from '@/components/games/GameSnake'
import { GameSudoku } from '@/components/games/GameSudoku'
import { GameTetris } from '@/components/games/GameTetris'
import { GameTicker } from '@/components/games/GameTicker'
import { GameTicTacToe } from '@/components/games/GameTicTacToe'
import { GameTyping } from '@/components/games/GameTyping'
import { GameUmbra } from '@/components/games/GameUmbra'
import { GameWhackAMole } from '@/components/games/GameWhackAMole'
import { GameWordGuess } from '@/components/games/GameWordGuess'
import { GameWordSearch } from '@/components/games/GameWordSearch'
import { GameZeroHour } from '@/components/games/GameZeroHour'
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
    case 'bubble-shooter':
      return <GameBubbleShooter storageKey={`best:${page.slug}`} />
    case 'nonogram':
      return <GameNonogram storageKey={`best:${page.slug}`} />
    case 'sokoban':
      return <GameSokoban storageKey={`best:${page.slug}`} />
    case 'dots-and-boxes':
      return <GameDotsAndBoxes storageKey={`best:${page.slug}`} />
    case 'flappy':
      return <GameFlappy storageKey={`best:${page.slug}`} />
    case 'checkers':
      return <GameCheckers storageKey={`best:${page.slug}`} />
    case 'maze':
      return <GameMaze storageKey={`best:${page.slug}`} />
    case 'number-memory':
      return <GameNumberMemory storageKey={`best:${page.slug}`} />
    case 'word-search':
      return <GameWordSearch storageKey={`best:${page.slug}`} />
    case 'reversi':
      return <GameReversi storageKey={`best:${page.slug}`} />
    case 'gem-match':
      return <GameGemMatch storageKey={`best:${page.slug}`} />
    case 'space-shooter':
      return <GameSpaceShooter storageKey={`best:${page.slug}`} />
    case 'tower-stack':
      return <GameTowerStack storageKey={`best:${page.slug}`} />
    case 'prospector':
      return <GameProspector storageKey={`best:${page.slug}`} />
    case 'zero-hour':
      return <GameZeroHour storageKey={`best:${page.slug}`} />
    case 'overload':
      return <GameOverload storageKey={`best:${page.slug}`} />
    case 'ricochet':
      return <GameRicochet storageKey={`best:${page.slug}`} />
    case 'stackpot':
      return <GameStackpot storageKey={`best:${page.slug}`} />
    case 'flywheel':
      return <GameFlywheel storageKey={`best:${page.slug}`} />
    case 'ripple':
      return <GameRipple storageKey={`best:${page.slug}`} />
    case 'ticker':
      return <GameTicker storageKey={`best:${page.slug}`} />
    case 'overfold':
      return <GameOverfold storageKey={`best:${page.slug}`} />
    case 'splice':
      return <GameSplice storageKey={`best:${page.slug}`} />
    case 'quarry':
      return <GameQuarry storageKey={`best:${page.slug}`} />
    case 'latch':
      return <GameLatch storageKey={`best:${page.slug}`} />
    case 'decant':
      return <GameDecant storageKey={`best:${page.slug}`} />
    case 'backspace':
      return <GameBackspace storageKey={`best:${page.slug}`} />
    case 'duplex':
      return <GameDuplex storageKey={`best:${page.slug}`} />
    case 'overdub':
      return <GameOverdub storageKey={`best:${page.slug}`} />
    case 'pinwheel':
      return <GamePinwheel storageKey={`best:${page.slug}`} />
    case 'cleave':
      return <GameCleave storageKey={`best:${page.slug}`} />
    case 'umbra':
      return <GameUmbra storageKey={`best:${page.slug}`} />
    case 'fuse':
      return <GameFuse storageKey={`best:${page.slug}`} />
    case 'polytap':
      return <GamePolytap storageKey={`best:${page.slug}`} />
    case 'deepdive':
      return <GameDeepdive storageKey={`best:${page.slug}`} />
    case 'sonar':
      return <GameSonar storageKey={`best:${page.slug}`} />
    case 'handful':
      return <GameHandful storageKey={`best:${page.slug}`} />
    case 'flapjack':
      return <GameFlapjack storageKey={`best:${page.slug}`} />
    case 'interlock':
      return <GameInterlock storageKey={`best:${page.slug}`} />
    case 'clusters':
      return <GameClusters storageKey={`best:${page.slug}`} />
    case 'quadle':
      return <GameQuadle storageKey={`best:${page.slug}`} />
    case 'equate':
      return <GameEquate storageKey={`best:${page.slug}`} />
    case 'reactor':
      return <GameReactor storageKey={`best:${page.slug}`} />
    case 'solitaire':
      return <GameSolitaire storageKey={`best:${page.slug}`} />
    case 'freecell':
      return <GameFreecell storageKey={`best:${page.slug}`} />
    case 'spider':
      return <GameSpider storageKey={`best:${page.slug}`} />
    case 'pyramid':
      return <GamePyramid storageKey={`best:${page.slug}`} />
    case 'tripeaks':
      return <GameTripeaks storageKey={`best:${page.slug}`} />
    case 'mahjong':
      return <GameMahjong storageKey={`best:${page.slug}`} />
    case 'chess':
      return <GameChess storageKey={`best:${page.slug}`} />
    default: {
      page satisfies never
      return null
    }
  }
}
