import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gamePages } from './registry'
import { GARDEN_BATCHES, GARDEN_FRAMED, GARDEN_ORIGINALS, gameWorld, gardenBatchOf } from './gardenRollout'

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
    const outside = gamePages.find((p) => !GARDEN_FRAMED.has(p.slug) && !(GARDEN_ORIGINALS as readonly string[]).includes(p.slug))!
    expect(gameWorld(outside.slug)).toBeNull()
    expect(gardenBatchOf(outside.slug)).toBeNull()
  })

  it('배치 a·b에는 캔버스로 직접 그리는 게임(getContext)이 없다', () => {
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
    }
    for (const slug of [...GARDEN_BATCHES.a, ...GARDEN_BATCHES.b]) {
      const src = readFileSync(join(__dirname, '../../components/games', `${file[slug]}.tsx`), 'utf8')
      expect(src.includes('getContext'), slug).toBe(false)
    }
  })
})
