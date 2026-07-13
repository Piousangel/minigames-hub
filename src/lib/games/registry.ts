export interface GamePage {
  slug: string
  game: '2048' // Plan 2에서 'snake' | 'minesweeper' | ... 로 확장
  themeKey: string
  title: string // <title>
  h1: string
  metaDescription: string
  shortDescription: string // 홈 카드용 한 줄
  howToPlay: string[]
  strategy: string[]
  faq: Array<{ q: string; a: string }>
}

export const gamePages: GamePage[] = [
  {
    slug: '2048',
    game: '2048',
    themeKey: 'classic',
    title: 'Play 2048 Online — Free, No Download',
    h1: '2048',
    metaDescription:
      'Play 2048 online for free. Slide the tiles, merge matching numbers, and reach the 2048 tile. Works on desktop and mobile — no download or sign-up needed.',
    shortDescription: 'Merge tiles to reach 2048.',
    howToPlay: [
      'Use your arrow keys (or swipe on mobile) to slide all tiles in one direction.',
      'When two tiles with the same number touch, they merge into one tile with double the value.',
      'After every move, a new tile (2 or 4) appears in a random empty cell.',
      'Reach the 2048 tile to win — or keep going for a higher score. The game ends when no moves are left.',
    ],
    strategy: [
      'Pick one corner and keep your highest tile there for the whole game — most players use the bottom-left.',
      'Prefer two directions (e.g. left and down) and avoid the opposite ones unless forced. This keeps your board ordered.',
      'Build tiles in a descending "snake" pattern along one edge so merges chain naturally into your corner.',
      'Never make a move that lifts your biggest tile out of its corner — one careless swipe can unravel the board.',
      'Slow down in the endgame: when the board is over half full, count what each move spawns space for before you swipe.',
    ],
    faq: [
      { q: 'Is 2048 free to play?', a: 'Yes — this version of 2048 is completely free, with no download, installation, or account required. It runs in your browser on desktop and mobile.' },
      { q: 'Can I keep playing after reaching 2048?', a: 'Yes. Reaching the 2048 tile wins the game, but you can continue playing to chase 4096, 8192, and a higher score.' },
      { q: 'Is 2048 a game of luck or skill?', a: 'Mostly skill. Tile spawns are random, but corner strategy and disciplined move directions let good players reach 2048 consistently.' },
      { q: 'Does my best score save?', a: 'Your best score is saved in your browser (localStorage), so it persists between visits on the same device.' },
    ],
  },
  {
    slug: '2048-animals',
    game: '2048',
    themeKey: 'animals',
    title: 'Play 2048 Animals Online — Cute Animal Merge Game',
    h1: '2048 Animals',
    metaDescription:
      'Play 2048 Animals free online — merge cute animals from mouse to dragon in this animal-themed 2048 game. No download needed, works on mobile.',
    shortDescription: 'The classic 2048 with cute animals.',
    howToPlay: [
      'Swipe or use arrow keys to slide every animal tile in one direction.',
      'When two identical animals touch, they merge and evolve into the next animal.',
      'The chain goes from mouse all the way up to the dragon — the animal version of the 2048 tile.',
      'A new animal appears after each move. The game ends when the board is full and nothing can merge.',
    ],
    strategy: [
      'The rules are identical to classic 2048, so the same corner strategy applies: keep your strongest animal parked in one corner.',
      'Learn the animal order early (mouse → hamster → rabbit → fox → …) so you can read the board at a glance.',
      'Stick to two swipe directions to keep the animals sorted from strongest to weakest.',
      'If you get stuck, look for the smallest pair on the board first — clearing small animals opens space safely.',
    ],
    faq: [
      { q: 'What is 2048 Animals?', a: 'It is the classic 2048 puzzle with animals instead of numbers. Matching animals merge and evolve into the next animal in the chain, ending at the dragon.' },
      { q: 'What is the animal order?', a: 'Mouse, hamster, rabbit, fox, cat, dog, wolf, lion, tiger, bear, and finally the dragon — which is the equivalent of the 2048 tile.' },
      { q: 'Is it harder than normal 2048?', a: 'The mechanics are identical, so it plays the same. Some players find animals easier to track than numbers; others prefer the classic tiles.' },
    ],
  },
]
