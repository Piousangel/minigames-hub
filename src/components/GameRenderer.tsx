import { Game2048 } from '@/components/games/Game2048'
import { GameMemory } from '@/components/games/GameMemory'
import { GameMinesweeper } from '@/components/games/GameMinesweeper'
import { GameSnake } from '@/components/games/GameSnake'
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
    default: {
      page satisfies never
      return null
    }
  }
}
