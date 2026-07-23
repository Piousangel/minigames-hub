'use client'

import dynamic from 'next/dynamic'

// 게임별 코드 스플리팅: 각 게임 페이지가 자기 게임 청크만 로드(First Load JS 대폭 감소).
// 보드는 원래 클라이언트 전용(useState(null))이라 ssr:false로 SSR 손실 없음.
function Loading() {
  return <div className="min-h-[420px] w-full animate-pulse rounded-xl bg-surface/40" aria-hidden="true" />
}

const Game2048 = dynamic(() => import('@/components/games/Game2048').then((m) => m.Game2048), { ssr: false, loading: Loading })
const GameAimTrainer = dynamic(() => import('@/components/games/GameAimTrainer').then((m) => m.GameAimTrainer), { ssr: false, loading: Loading })
const GameBackspace = dynamic(() => import('@/components/games/GameBackspace').then((m) => m.GameBackspace), { ssr: false, loading: Loading })
const GameBreakout = dynamic(() => import('@/components/games/GameBreakout').then((m) => m.GameBreakout), { ssr: false, loading: Loading })
const GameBubbleShooter = dynamic(() => import('@/components/games/GameBubbleShooter').then((m) => m.GameBubbleShooter), { ssr: false, loading: Loading })
const GameCheckers = dynamic(() => import('@/components/games/GameCheckers').then((m) => m.GameCheckers), { ssr: false, loading: Loading })
const GameCleave = dynamic(() => import('@/components/games/GameCleave').then((m) => m.GameCleave), { ssr: false, loading: Loading })
const GameConnectFour = dynamic(() => import('@/components/games/GameConnectFour').then((m) => m.GameConnectFour), { ssr: false, loading: Loading })
const GameDecant = dynamic(() => import('@/components/games/GameDecant').then((m) => m.GameDecant), { ssr: false, loading: Loading })
const GameDotsAndBoxes = dynamic(() => import('@/components/games/GameDotsAndBoxes').then((m) => m.GameDotsAndBoxes), { ssr: false, loading: Loading })
const GameDuplex = dynamic(() => import('@/components/games/GameDuplex').then((m) => m.GameDuplex), { ssr: false, loading: Loading })
const GameFlappy = dynamic(() => import('@/components/games/GameFlappy').then((m) => m.GameFlappy), { ssr: false, loading: Loading })
const GameFuse = dynamic(() => import('@/components/games/GameFuse').then((m) => m.GameFuse), { ssr: false, loading: Loading })
const GameFlywheel = dynamic(() => import('@/components/games/GameFlywheel').then((m) => m.GameFlywheel), { ssr: false, loading: Loading })
const GameGemMatch = dynamic(() => import('@/components/games/GameGemMatch').then((m) => m.GameGemMatch), { ssr: false, loading: Loading })
const GameHangman = dynamic(() => import('@/components/games/GameHangman').then((m) => m.GameHangman), { ssr: false, loading: Loading })
const GameLatch = dynamic(() => import('@/components/games/GameLatch').then((m) => m.GameLatch), { ssr: false, loading: Loading })
const GameMaze = dynamic(() => import('@/components/games/GameMaze').then((m) => m.GameMaze), { ssr: false, loading: Loading })
const GameMemory = dynamic(() => import('@/components/games/GameMemory').then((m) => m.GameMemory), { ssr: false, loading: Loading })
const GameMinesweeper = dynamic(() => import('@/components/games/GameMinesweeper').then((m) => m.GameMinesweeper), { ssr: false, loading: Loading })
const GameNonogram = dynamic(() => import('@/components/games/GameNonogram').then((m) => m.GameNonogram), { ssr: false, loading: Loading })
const GameNumberMemory = dynamic(() => import('@/components/games/GameNumberMemory').then((m) => m.GameNumberMemory), { ssr: false, loading: Loading })
const GameOverdub = dynamic(() => import('@/components/games/GameOverdub').then((m) => m.GameOverdub), { ssr: false, loading: Loading })
const GameOverload = dynamic(() => import('@/components/games/GameOverload').then((m) => m.GameOverload), { ssr: false, loading: Loading })
const GamePinwheel = dynamic(() => import('@/components/games/GamePinwheel').then((m) => m.GamePinwheel), { ssr: false, loading: Loading })
const GameDeepdive = dynamic(() => import('@/components/games/GameDeepdive').then((m) => m.GameDeepdive), { ssr: false, loading: Loading })
const GameFlapjack = dynamic(() => import('@/components/games/GameFlapjack').then((m) => m.GameFlapjack), { ssr: false, loading: Loading })
const GameHandful = dynamic(() => import('@/components/games/GameHandful').then((m) => m.GameHandful), { ssr: false, loading: Loading })
const GameInterlock = dynamic(() => import('@/components/games/GameInterlock').then((m) => m.GameInterlock), { ssr: false, loading: Loading })
const GameClusters = dynamic(() => import('@/components/games/GameClusters').then((m) => m.GameClusters), { ssr: false, loading: Loading })
const GameQuadle = dynamic(() => import('@/components/games/GameQuadle').then((m) => m.GameQuadle), { ssr: false, loading: Loading })
const GameEquate = dynamic(() => import('@/components/games/GameEquate').then((m) => m.GameEquate), { ssr: false, loading: Loading })
const GameReactor = dynamic(() => import('@/components/games/GameReactor').then((m) => m.GameReactor), { ssr: false, loading: Loading })
const GameSolitaire = dynamic(() => import('@/components/games/GameSolitaire').then((m) => m.GameSolitaire), { ssr: false, loading: Loading })
const GameFreecell = dynamic(() => import('@/components/games/GameFreecell').then((m) => m.GameFreecell), { ssr: false, loading: Loading })
const GameSpider = dynamic(() => import('@/components/games/GameSpider').then((m) => m.GameSpider), { ssr: false, loading: Loading })
const GamePyramid = dynamic(() => import('@/components/games/GamePyramid').then((m) => m.GamePyramid), { ssr: false, loading: Loading })
const GameTripeaks = dynamic(() => import('@/components/games/GameTripeaks').then((m) => m.GameTripeaks), { ssr: false, loading: Loading })
const GameMahjong = dynamic(() => import('@/components/games/GameMahjong').then((m) => m.GameMahjong), { ssr: false, loading: Loading })
const GameChess = dynamic(() => import('@/components/games/GameChess').then((m) => m.GameChess), { ssr: false, loading: Loading })
const GameGolf = dynamic(() => import('@/components/games/GameGolf').then((m) => m.GameGolf), { ssr: false, loading: Loading })
const GameDominoes = dynamic(() => import('@/components/games/GameDominoes').then((m) => m.GameDominoes), { ssr: false, loading: Loading })
const GameJigsaw = dynamic(() => import('@/components/games/GameJigsaw').then((m) => m.GameJigsaw), { ssr: false, loading: Loading })
const GameYukon = dynamic(() => import('@/components/games/GameYukon').then((m) => m.GameYukon), { ssr: false, loading: Loading })
const GameGomoku = dynamic(() => import('@/components/games/GameGomoku').then((m) => m.GameGomoku), { ssr: false, loading: Loading })
const GameFlow = dynamic(() => import('@/components/games/GameFlow').then((m) => m.GameFlow), { ssr: false, loading: Loading })
const GameUnblock = dynamic(() => import('@/components/games/GameUnblock').then((m) => m.GameUnblock), { ssr: false, loading: Loading })
const GameYahtzee = dynamic(() => import('@/components/games/GameYahtzee').then((m) => m.GameYahtzee), { ssr: false, loading: Loading })
const GamePolytap = dynamic(() => import('@/components/games/GamePolytap').then((m) => m.GamePolytap), { ssr: false, loading: Loading })
const GameSonar = dynamic(() => import('@/components/games/GameSonar').then((m) => m.GameSonar), { ssr: false, loading: Loading })
const GameProspector = dynamic(() => import('@/components/games/GameProspector').then((m) => m.GameProspector), { ssr: false, loading: Loading })
const GameOverfold = dynamic(() => import('@/components/games/GameOverfold').then((m) => m.GameOverfold), { ssr: false, loading: Loading })
const GameQuarry = dynamic(() => import('@/components/games/GameQuarry').then((m) => m.GameQuarry), { ssr: false, loading: Loading })
const GameReaction = dynamic(() => import('@/components/games/GameReaction').then((m) => m.GameReaction), { ssr: false, loading: Loading })
const GameReversi = dynamic(() => import('@/components/games/GameReversi').then((m) => m.GameReversi), { ssr: false, loading: Loading })
const GameRicochet = dynamic(() => import('@/components/games/GameRicochet').then((m) => m.GameRicochet), { ssr: false, loading: Loading })
const GameRipple = dynamic(() => import('@/components/games/GameRipple').then((m) => m.GameRipple), { ssr: false, loading: Loading })
const GameSokoban = dynamic(() => import('@/components/games/GameSokoban').then((m) => m.GameSokoban), { ssr: false, loading: Loading })
const GameSpaceShooter = dynamic(() => import('@/components/games/GameSpaceShooter').then((m) => m.GameSpaceShooter), { ssr: false, loading: Loading })
const GameSplice = dynamic(() => import('@/components/games/GameSplice').then((m) => m.GameSplice), { ssr: false, loading: Loading })
const GameStackpot = dynamic(() => import('@/components/games/GameStackpot').then((m) => m.GameStackpot), { ssr: false, loading: Loading })
const GameTowerStack = dynamic(() => import('@/components/games/GameTowerStack').then((m) => m.GameTowerStack), { ssr: false, loading: Loading })
const GameSimon = dynamic(() => import('@/components/games/GameSimon').then((m) => m.GameSimon), { ssr: false, loading: Loading })
const GameLightsOut = dynamic(() => import('@/components/games/GameLightsOut').then((m) => m.GameLightsOut), { ssr: false, loading: Loading })
const GameMastermind = dynamic(() => import('@/components/games/GameMastermind').then((m) => m.GameMastermind), { ssr: false, loading: Loading })
const GamePong = dynamic(() => import('@/components/games/GamePong').then((m) => m.GamePong), { ssr: false, loading: Loading })
const GameRps = dynamic(() => import('@/components/games/GameRps').then((m) => m.GameRps), { ssr: false, loading: Loading })
const GameSliding = dynamic(() => import('@/components/games/GameSliding').then((m) => m.GameSliding), { ssr: false, loading: Loading })
const GameSnake = dynamic(() => import('@/components/games/GameSnake').then((m) => m.GameSnake), { ssr: false, loading: Loading })
const GameSudoku = dynamic(() => import('@/components/games/GameSudoku').then((m) => m.GameSudoku), { ssr: false, loading: Loading })
const GameTetris = dynamic(() => import('@/components/games/GameTetris').then((m) => m.GameTetris), { ssr: false, loading: Loading })
const GameTicker = dynamic(() => import('@/components/games/GameTicker').then((m) => m.GameTicker), { ssr: false, loading: Loading })
const GameTicTacToe = dynamic(() => import('@/components/games/GameTicTacToe').then((m) => m.GameTicTacToe), { ssr: false, loading: Loading })
const GameTyping = dynamic(() => import('@/components/games/GameTyping').then((m) => m.GameTyping), { ssr: false, loading: Loading })
const GameUmbra = dynamic(() => import('@/components/games/GameUmbra').then((m) => m.GameUmbra), { ssr: false, loading: Loading })
const GameWhackAMole = dynamic(() => import('@/components/games/GameWhackAMole').then((m) => m.GameWhackAMole), { ssr: false, loading: Loading })
const GameWordGuess = dynamic(() => import('@/components/games/GameWordGuess').then((m) => m.GameWordGuess), { ssr: false, loading: Loading })
const GameWordSearch = dynamic(() => import('@/components/games/GameWordSearch').then((m) => m.GameWordSearch), { ssr: false, loading: Loading })
const GameZeroHour = dynamic(() => import('@/components/games/GameZeroHour').then((m) => m.GameZeroHour), { ssr: false, loading: Loading })
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
    case 'golf-solitaire':
      return <GameGolf storageKey={`best:${page.slug}`} />
    case 'dominoes':
      return <GameDominoes storageKey={`best:${page.slug}`} />
    case 'jigsaw':
      return <GameJigsaw storageKey={`best:${page.slug}`} />
    case 'yukon':
      return <GameYukon storageKey={`best:${page.slug}`} />
    case 'gomoku':
      return <GameGomoku storageKey={`best:${page.slug}`} />
    case 'flow':
      return <GameFlow storageKey={`best:${page.slug}`} />
    case 'unblock':
      return <GameUnblock storageKey={`best:${page.slug}`} />
    case 'yahtzee':
      return <GameYahtzee storageKey={`best:${page.slug}`} />
    default: {
      page satisfies never
      return null
    }
  }
}
