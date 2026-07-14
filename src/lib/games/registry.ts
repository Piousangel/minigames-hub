import { themes2048 } from './g2048/themes'

interface GamePageBase {
  slug: string
  title: string // <title>
  h1: string
  metaDescription: string
  shortDescription: string // 홈 카드용 한 줄
  howToPlay: string[]
  strategy: string[]
  faq: Array<{ q: string; a: string }>
}

export type GamePage = GamePageBase &
  (
    | { game: '2048'; themeKey: keyof typeof themes2048 }
    | { game: 'snake' }
    | { game: 'minesweeper' }
    | { game: 'memory' }
    | { game: 'typing' }
  )

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
  {
    slug: 'snake',
    game: 'snake',
    title: 'Play Snake Online — Free Classic Snake Game',
    h1: 'Snake',
    metaDescription:
      'Play the classic Snake game online for free. Eat food, grow longer, and avoid the walls in this timeless arcade game. Works on desktop and mobile — no download needed.',
    shortDescription: 'The timeless snake — eat, grow, survive.',
    howToPlay: [
      'Press any arrow key (or swipe on mobile) to start the game and steer the snake.',
      'Eat the red food to grow longer — each bite is worth one point.',
      'The snake keeps moving in its current direction; you can turn up, down, left, or right, but never straight backwards.',
      'The game ends when the snake hits a wall or runs into its own body.',
    ],
    strategy: [
      'Hug the edges early: sweeping along the walls keeps the middle of the board open for when your snake gets long.',
      'Plan two turns ahead — most deaths come from turning into a corridor your own body just closed off.',
      'Use the classic "lawnmower" pattern, sweeping back and forth in rows, once your snake takes up a big part of the board.',
      'Do not chase food the moment it spawns; approach it from a direction that leaves you an exit.',
      'A gap that looks closed will often open right as you arrive — the tail moves away every tick, so count cells before you panic-turn.',
    ],
    faq: [
      {
        q: 'Is this the classic snake game?',
        a: 'Yes — this is the classic snake formula: eat food, grow longer, avoid the walls and your own body. No power-ups and no gimmicks, just the pure game.',
      },
      {
        q: 'How do I control the snake on mobile?',
        a: 'Swipe anywhere on the board in the direction you want to turn. The snake starts moving on your first swipe.',
      },
      {
        q: "Why can't I reverse direction?",
        a: 'A 180-degree turn would make the head collide with the neck instantly, so classic snake rules only allow 90-degree turns.',
      },
      {
        q: 'What is a good score?',
        a: 'Anything above 20 is solid. Past 40 the board gets crowded and every turn matters — that is where the real game begins.',
      },
    ],
  },
  {
    slug: 'minesweeper',
    game: 'minesweeper',
    title: 'Play Minesweeper Online — Free Classic Minesweeper',
    h1: 'Minesweeper',
    metaDescription:
      'Play classic Minesweeper online for free. Reveal safe squares, read the numbers, and flag all 10 mines on a 9x9 board. No download, works on mobile.',
    shortDescription: 'Read the numbers, dodge the mines.',
    howToPlay: [
      'Click any square to start — your first click is always safe.',
      'A number tells you how many mines touch that square, including diagonals.',
      'Right-click (or turn on the 🚩 Flag toggle on mobile) to mark squares you think hide a mine.',
      'Reveal every safe square to win. Click a mine and the game is over.',
    ],
    strategy: [
      'Start from the big open areas: a revealed zero automatically opens all of its neighbors, giving you free information.',
      "If a number already touches exactly that many flags, every other neighbor is safe — this is the game's most-used deduction.",
      'A "1" on a wall or corner is your best friend: it has fewer neighbors, so its mine is easier to pin down.',
      'When two numbers overlap, subtract what they share — patterns like 1-2-1 and 1-2-2-1 have fixed, learnable solutions.',
      'Never guess while a certain deduction exists somewhere on the board. Scan everything before you gamble.',
    ],
    faq: [
      {
        q: 'Can I lose on the first click?',
        a: 'No. Mines are placed after your first click, so the first square you reveal is always safe.',
      },
      {
        q: 'What do the numbers mean?',
        a: 'Each number counts the mines in the up-to-eight squares touching it, including diagonals. A blank square means zero adjacent mines.',
      },
      {
        q: 'How do I flag mines on a phone?',
        a: 'Tap the 🚩 Flag toggle above the board, then tap squares to flag them. Tap the toggle again to go back to revealing.',
      },
      {
        q: 'How many mines are there?',
        a: 'This board is the classic beginner setup: a 9x9 grid with 10 mines. The mine counter shows how many are left unflagged.',
      },
    ],
  },
  {
    slug: 'memory-game',
    game: 'memory',
    title: 'Play Memory Game Online — Free Matching Pairs Game',
    h1: 'Memory Game',
    metaDescription:
      'Play the classic memory matching game online for free. Flip cards, remember what you saw, and find all 8 pairs in as few moves as you can. Great for kids and adults.',
    shortDescription: 'Find all the matching pairs.',
    howToPlay: [
      'Tap or click any card to flip it over and see the picture.',
      'Flip a second card. If the pictures match, the pair stays face up.',
      'If they do not match, both cards flip back — remember where they were!',
      'Match all 8 pairs to win. Fewer moves means a better score.',
    ],
    strategy: [
      'Say what you see (silently): naming the picture and its position makes it far easier to recall than just looking.',
      'Start with cards you have never flipped — new information beats re-checking cards you already know.',
      'When you flip a new card, check your memory first: have you already seen its partner? Only then flip a second card.',
      'Use the grid like a map — remember cards by row and corner ("banana, top-left") rather than as loose images.',
    ],
    faq: [
      {
        q: 'How many cards are there?',
        a: 'The board is a 4x4 grid with 16 cards — 8 matching pairs of pictures, shuffled every game.',
      },
      {
        q: 'What counts as a good score?',
        a: 'Every two flips count as one move. A perfect game is 8 moves; under 14 moves is a strong score for a 4x4 board.',
      },
      {
        q: 'Is this game good for kids?',
        a: 'Yes — memory matching is one of the best simple games for concentration and short-term memory, and the pictures make it friendly for young kids.',
      },
      {
        q: 'Do the cards shuffle every game?',
        a: 'Yes. Every new game deals a fresh random layout, so you cannot memorize positions between rounds.',
      },
    ],
  },
  {
    slug: 'typing-test',
    game: 'typing',
    title: 'Typing Speed Test — Free Online WPM Test',
    h1: 'Typing Speed Test',
    metaDescription:
      'Test your typing speed online for free. Type common English words for 60 seconds and get your WPM and accuracy instantly. No sign-up, works on any keyboard.',
    shortDescription: 'How fast can you type? 60-second WPM test.',
    howToPlay: [
      'Click the input box and start typing the highlighted word — the 60-second timer starts on your first keystroke.',
      'Press the space bar to submit each word and move to the next one.',
      'Correct words count toward your WPM; misspelled words hurt your accuracy.',
      'When the timer hits zero you get your words-per-minute score and accuracy.',
    ],
    strategy: [
      'Accuracy first, speed second: a fixed typo costs more time than slow-but-clean typing ever will.',
      'Read one word ahead while your fingers finish the current word — the pause between words is where most WPM is lost.',
      'Keep your eyes on the words, never on the keyboard. If you have to look down, that is the skill to train first.',
      'Use all ten fingers and return to the home row (ASDF–JKL;) after every word.',
      'Take the test a few times in a row: your second and third runs are usually 5-10 WPM faster as you warm up.',
    ],
    faq: [
      {
        q: 'What is WPM and how is it calculated?',
        a: 'WPM means words per minute. Following the standard convention, one "word" is 5 characters (including the space), so WPM = correct characters ÷ 5, scaled to one minute.',
      },
      {
        q: 'What is a good typing speed?',
        a: 'The average is around 40 WPM. 60-70 WPM is good, 80+ is fast, and professional typists reach 100 WPM and beyond.',
      },
      {
        q: 'Do mistakes lower my score?',
        a: 'Misspelled words do not add to your WPM, and they lower your accuracy percentage — so fixing your error rate is the fastest way to raise your score.',
      },
      {
        q: 'Can I retake the test?',
        a: 'Yes, as many times as you like. Hit Restart to get a fresh set of words; your best WPM is saved on this device.',
      },
    ],
  },
]
