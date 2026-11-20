import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gamePages } from './registry'
import { GARDEN_BATCHES, GARDEN_CANVAS, GARDEN_FRAMED, GARDEN_ORIGINALS, gameWorld, gardenBatchOf, gardenPending } from './gardenRollout'

const all = Object.values(GARDEN_BATCHES).flat() as string[]

describe('정원 틀 배치 목록(R7)', () => {
  it('모든 slug가 실제 게임이고 중복이 없다', () => {
    const slugs = new Set(gamePages.map((p) => p.slug))
    for (const s of all) expect(slugs.has(s), s).toBe(true)
    expect(new Set(all).size).toBe(all.length)
  })

  it('배치마다 20개 이하, 오리지널 3종은 배치에 없다', () => {
    for (const [batch, list] of Object.entries(GARDEN_BATCHES)) expect(list.length, batch).toBeLessThanOrEqual(20)
    for (const o of GARDEN_ORIGINALS) expect(GARDEN_FRAMED.has(o), o).toBe(false)
  })

  it('세계 판정: 오리지널 = room, 배치 = garden, 그 밖 = null', () => {
    expect(gameWorld('slime-slide')).toBe('room')
    expect(gameWorld(all[0])).toBe('garden')
    expect(gardenBatchOf(all[0])).toBe('a')
    expect(gardenBatchOf('chess')).toBe('b')
    expect(gardenBatchOf('mastermind')).toBe('c')
    expect(gardenBatchOf('kakuro')).toBe('d')
    expect(gardenBatchOf('slosh')).toBe('e')
    expect(gardenBatchOf('breakout')).toBe('f')
    expect(gameWorld('not-a-game')).toBeNull()
    expect(gardenBatchOf('slime-slide')).toBeNull()
  })

  it('전 게임 정원 틀: 레지스트리의 모든 게임이 정원 틀이거나 오리지널 방이다(미적용 0)', () => {
    expect(gardenPending(gamePages.map((p) => p.slug))).toEqual([])
    expect(GARDEN_FRAMED.size + GARDEN_ORIGINALS.length).toBe(gamePages.length)
  })

  it('캔버스 게임 목록 = 배치 안에서 getContext로 그리는 게임 전부, 하드코딩 색 규칙은 DOM 배치 b~e만', () => {
    // GameRenderer의 slug → 컴포넌트 연결 대신, 배치 a 게임 컴포넌트 파일을 이름으로 찾아 본다.
    const file: Record<string, string> = {
      '2048': 'Game2048', '2048-animals': 'Game2048', snake: 'GameSnake', solitaire: 'GameSolitaire',
      battleship: 'GameBattleship', polarity: 'GamePolarity', beatline: 'GameBeatline', quarry: 'GameQuarry',
      bearing: 'GameBearing', hogline: 'GameHogline', countcircle: 'GameCountcircle', mancala: 'GameMancala',
      'typing-test': 'GameTyping', 'aim-trainer': 'GameAimTrainer', minesweeper: 'GameMinesweeper',
      sokoban: 'GameSokoban', 'word-guess': 'GameWordGuess', sudoku: 'GameSudoku', flow: 'GameFlow', clusters: 'GameClusters',
      chess: 'GameChess', mahjong: 'GameMahjong', 'memory-game': 'GameMemory', tetris: 'GameTetris',
      'tic-tac-toe': 'GameTicTacToe', 'connect-four': 'GameConnectFour', yahtzee: 'GameYahtzee', freecell: 'GameFreecell',
      spider: 'GameSpider', jigsaw: 'GameJigsaw', 'sliding-puzzle': 'GameSliding', 'reaction-time': 'GameReaction',
      hangman: 'GameHangman', simon: 'GameSimon', 'whack-a-mole': 'GameWhackAMole', 'rock-paper-scissors': 'GameRps',
      'lights-out': 'GameLightsOut', nonogram: 'GameNonogram', checkers: 'GameCheckers', reversi: 'GameReversi',
      mastermind: 'GameMastermind', maze: 'GameMaze', 'number-memory': 'GameNumberMemory',
      'word-search': 'GameWordSearch', 'gem-match': 'GameGemMatch', prospector: 'GameProspector', 'zero-hour': 'GameZeroHour',
      overload: 'GameOverload', ricochet: 'GameRicochet', stackpot: 'GameStackpot', overfold: 'GameOverfold',
      splice: 'GameSplice', duplex: 'GameDuplex', overdub: 'GameOverdub',
      pinwheel: 'GamePinwheel', cleave: 'GameCleave', umbra: 'GameUmbra', fuse: 'GameFuse',
      polytap: 'GamePolytap', deepdive: 'GameDeepdive',
      'dots-and-boxes': 'GameDotsAndBoxes', decant: 'GameDecant', sonar: 'GameSonar', handful: 'GameHandful',
      flapjack: 'GameFlapjack', interlock: 'GameInterlock', quadle: 'GameQuadle', equate: 'GameEquate',
      reactor: 'GameReactor', pyramid: 'GamePyramid', tripeaks: 'GameTripeaks', 'golf-solitaire': 'GameGolf',
      dominoes: 'GameDominoes', 'yukon-solitaire': 'GameYukon', gomoku: 'GameGomoku', kakuro: 'GameKakuro',
      skew: 'GameSkew', turntile: 'GameTurntile', stakehouse: 'GameStakehouse', grasp: 'GameGrasp',
      offbeat: 'GameOffbeat', prismbox: 'GamePrismbox', gravwell: 'GameGravwell', loopgrid: 'GameLoopgrid',
      bisect: 'GameBisect', slotter: 'GameSlotter', carousel: 'GameCarousel', gridlock: 'GameGridlock',
      strata: 'GameStrata', bankshot: 'GameBankshot', 'morse-relay': 'GameMorseRelay', lagline: 'GameLagline',
      recoil: 'GameRecoil', hunch: 'GameHunch', fizzbeat: 'GameFizzBeat', siteswap: 'GameSiteswap',
      shadowfit: 'GameShadowfit', slosh: 'GameSlosh',
      ticker: 'GameTicker', unblock: 'GameUnblock', breakout: 'GameBreakout', pong: 'GamePong',
      'bubble-shooter': 'GameBubbleShooter', flappy: 'GameFlappy', 'space-shooter': 'GameSpaceShooter',
      'tower-stack': 'GameTowerStack', flywheel: 'GameFlywheel', ripple: 'GameRipple', latch: 'GameLatch',
      backspace: 'GameBackspace',
    }
    const canvas = new Set<string>(GARDEN_CANVAS)
    for (const c of canvas) expect(GARDEN_FRAMED.has(c), c).toBe(true)
    for (const slug of Object.values(GARDEN_BATCHES).flat()) {
      const src = readFileSync(join(__dirname, '../../components/games', `${file[slug]}.tsx`), 'utf8')
      // 캔버스 게임은 GARDEN_CANVAS에 있어야 한다 — 캔버스 안 글자는 DOM 대비 게이트가 못 보므로
      // scripts/garden-canvas-contrast.mjs(fillText 대비)로 따로 잰다. 목록에 없는 캔버스 게임이 몰래 들어오지 않게.
      expect(src.includes('getContext'), slug).toBe(canvas.has(slug))
      // 선정 규칙 ②: 하드코딩 색(hex·rgba) 20개 미만 — DOM 배치 b~e만(a의 2048·2048-animals는 장부 점검 끝난 예외,
      // 마지막 배치 f는 그 규칙으로 뒤로 미룬 게임 자체라 대상 아님 — 대신 게이트·캔버스 대비 스크립트로 확인)
      if (!(GARDEN_BATCHES.a as readonly string[]).includes(slug) && !(GARDEN_BATCHES.f as readonly string[]).includes(slug)) {
        expect((src.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).length, slug).toBeLessThan(20)
      }
    }
  })
})
