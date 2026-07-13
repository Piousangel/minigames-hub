import { Game2048 } from '@/components/games/Game2048'
import { themes2048 } from '@/lib/games/g2048/themes'
import type { GamePage } from '@/lib/games/registry'

export function GameRenderer({ page }: { page: GamePage }) {
  switch (page.game) {
    case '2048':
      return <Game2048 theme={themes2048[page.themeKey]} storageKey={`best:${page.slug}`} />
    case 'snake':
      return null // Task 5에서 GameSnake로 교체
    default: {
      page satisfies never
      return null
    }
  }
}
