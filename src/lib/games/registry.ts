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
    | { game: 'tetris' }
    | { game: 'sliding' }
    | { game: 'breakout' }
    | { game: 'word-guess' }
    | { game: 'tic-tac-toe' }
    | { game: 'reaction-time' }
    | { game: 'connect-four' }
    | { game: 'hangman' }
    | { game: 'simon' }
    | { game: 'whack-a-mole' }
    | { game: 'aim-trainer' }
    | { game: 'sudoku' }
    | { game: 'rps' }
    | { game: 'pong' }
    | { game: 'lights-out' }
    | { game: 'mastermind' }
    | { game: 'bubble-shooter' }
    | { game: 'nonogram' }
    | { game: 'sokoban' }
    | { game: 'dots-and-boxes' }
    | { game: 'flappy' }
    | { game: 'checkers' }
    | { game: 'maze' }
    | { game: 'number-memory' }
    | { game: 'word-search' }
    | { game: 'reversi' }
    | { game: 'gem-match' }
    | { game: 'space-shooter' }
    | { game: 'tower-stack' }
    | { game: 'prospector' }
    | { game: 'zero-hour' }
    | { game: 'overload' }
    | { game: 'ricochet' }
    | { game: 'stackpot' }
    | { game: 'flywheel' }
    | { game: 'ripple' }
    | { game: 'ticker' }
    | { game: 'overfold' }
    | { game: 'splice' }
    | { game: 'quarry' }
    | { game: 'latch' }
    | { game: 'decant' }
    | { game: 'backspace' }
    | { game: 'duplex' }
    | { game: 'overdub' }
    | { game: 'pinwheel' }
    | { game: 'cleave' }
    | { game: 'umbra' }
    | { game: 'fuse' }
    | { game: 'polytap' }
    | { game: 'deepdive' }
    | { game: 'sonar' }
    | { game: 'handful' }
    | { game: 'flapjack' }
    | { game: 'interlock' }
    | { game: 'clusters' }
    | { game: 'quadle' }
    | { game: 'equate' }
    | { game: 'reactor' }
    | { game: 'solitaire' }
    | { game: 'freecell' }
    | { game: 'spider' }
    | { game: 'pyramid' }
    | { game: 'tripeaks' }
    | { game: 'mahjong' }
    | { game: 'chess' }
    | { game: 'golf-solitaire' }
    | { game: 'dominoes' }
    | { game: 'jigsaw' }
    | { game: 'yukon' }
    | { game: 'gomoku' }
    | { game: 'flow' }
    | { game: 'unblock' }
    | { game: 'yahtzee' }
    | { game: 'mancala' }
    | { game: 'battleship' }
    | { game: 'kakuro' }
    | { game: 'beatline' }
    | { game: 'skew' }
    | { game: 'turntile' }
    | { game: 'stakehouse' }
    | { game: 'grasp' }
    | { game: 'countcircle' }
    | { game: 'offbeat' }
    | { game: 'hogline' }
    | { game: 'prismbox' }
    | { game: 'gravwell' }
    | { game: 'loopgrid' }
    | { game: 'bisect' }
    | { game: 'slotter' }
    | { game: 'carousel' }
    | { game: 'gridlock' }
    | { game: 'bearing' }
    | { game: 'strata' }
    | { game: 'bankshot' }
    | { game: 'morse-relay' }
    | { game: 'lagline' }
    | { game: 'recoil' }
    | { game: 'hunch' }
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
      { q: 'Is the new tile always a 2?', a: 'No. After every move a new tile appears on a random empty square: a 2 nine times out of ten and a 4 the other time.' },
      { q: 'Can I keep playing after reaching 2048?', a: 'Yes. Reaching the 2048 tile wins the game, but you can continue playing to chase 4096, 8192, and a higher score.' },
      { q: 'Is 2048 a game of luck or skill?', a: 'More skill than it looks, but the corner rule alone is not enough. Tile spawns are random; keeping your biggest tile in a corner is necessary but not sufficient. In my simulations a strict corner rule never reached 2048 in 2,000 games, while a player that also looked one spawn ahead reached it in 76% of games.' },
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
  {
    slug: 'tetris',
    game: 'tetris',
    title: 'Play Tetris Online — Free Classic Block Puzzle',
    h1: 'Tetris',
    metaDescription:
      'Play Tetris online for free. Slide, rotate, and drop falling blocks to clear lines in this classic block puzzle. No download, works on desktop and mobile.',
    shortDescription: 'Stack and clear the falling blocks.',
    howToPlay: [
      'Move the falling piece left or right with the arrow keys (or the on-screen buttons on mobile).',
      'Press up to rotate the piece and down to soft-drop it faster; press space to hard-drop it instantly.',
      'Fill a full horizontal row and it clears, keeping your stack low.',
      'Clear four rows at once with the I-piece for a "Tetris" and a big bonus. The game ends when the stack reaches the top.',
    ],
    strategy: [
      'Keep your stack flat and low — a bumpy surface leaves gaps you cannot fill later.',
      'Leave one column empty on the side and feed it I-pieces to score Tetrises (four-line clears) for maximum points.',
      'Use the ghost outline and next-piece preview to plan two moves ahead, not just the current piece.',
      'Rotate against the wall — pieces kick away from the edge, so you can squeeze into tight spots.',
      'The gravity speeds up every ten lines, so bank clears early while the pace is still slow.',
    ],
    faq: [
      { q: 'Are the pieces completely random?', a: 'Not quite. Pieces are dealt from a shuffled bag of all seven shapes, so every shape appears exactly once in each set of seven. That means an I-piece never waits more than 12 other pieces.' },
      { q: 'How do I play Tetris on mobile?', a: 'On-screen buttons let you move, rotate, soft-drop, and hard-drop with your thumbs. Everything works by touch.' },
      { q: 'What is a "Tetris"?', a: 'Clearing four lines at once with a single vertical I-piece. It is the highest-scoring single move in the game.' },
    ],
  },
  {
    slug: 'sliding-puzzle',
    game: 'sliding',
    title: 'Play Sliding Puzzle Online — Free 15 Puzzle Game',
    h1: 'Sliding Puzzle',
    metaDescription:
      'Play the classic 15 puzzle online for free. Slide the numbered tiles into order using the empty space, in as few moves as you can. No download, works on mobile.',
    shortDescription: 'Slide the tiles back into order.',
    howToPlay: [
      'The board is a 4x4 grid of tiles numbered 1 to 15, with one empty space.',
      'Click or tap a tile next to the empty space to slide it into the gap (or use the arrow keys).',
      'Rearrange the tiles into counting order — 1 through 15 — with the empty space in the bottom-right corner.',
      'Every board is always solvable. The challenge is doing it in as few moves as possible.',
    ],
    strategy: [
      'Solve the top row first, then the left column, working the puzzle down to a smaller and smaller square.',
      'Once only the bottom two rows remain, solve them two columns at a time.',
      'Set up the last two tiles of a row as a pair before rotating them into place together.',
      'Think a couple of slides ahead — moving one tile into place often means temporarily moving others out.',
      'Fewer moves means a better score, so avoid undoing progress you already made.',
    ],
    faq: [
      { q: 'What is the 15 puzzle?', a: 'A classic sliding tile puzzle: a 4x4 grid with 15 numbered tiles and one empty space. You slide tiles into the gap to sort them 1 to 15.' },
      { q: 'Is every board solvable?', a: 'Yes. Each board is generated by shuffling from a solved state with real moves, so it can always be solved.' },
      { q: 'How do I control it on mobile?', a: 'Tap any tile next to the empty space and it slides into the gap. No keyboard needed.' },
    ],
  },
  {
    slug: 'breakout',
    game: 'breakout',
    title: 'Play Breakout Online — Free Brick Breaker Game',
    h1: 'Breakout',
    metaDescription:
      'Play Breakout (brick breaker) online for free. Bounce the ball off your paddle to smash every brick without dropping the ball. No download, works on mobile.',
    shortDescription: 'Bounce the ball, break every brick.',
    howToPlay: [
      'Move your paddle with the mouse, your finger, or the arrow keys.',
      'Press space or tap to launch the ball off the paddle.',
      'Bounce the ball into the bricks to break them — clear every brick to win.',
      'Do not let the ball fall past your paddle. You have three lives.',
    ],
    strategy: [
      'Hit the ball with the edge of the paddle to angle your shots and reach tricky corners.',
      'Aim to punch a channel up one side so the ball bounces along the top, clearing rows on its own.',
      'Higher rows are worth more points, so prioritise digging up to them.',
      'Keep the paddle roughly under the ball and make small adjustments — big last-second swings cause misses.',
      'When the ball speeds up, watch its angle rather than chasing its position.',
    ],
    faq: [
      { q: 'Are all bricks worth the same?', a: 'No. Bricks are scored by row: the top row is worth 60 points and each row below is worth 10 less, down to 10 for the bottom row.' },
      { q: 'How do I control the paddle on mobile?', a: 'Slide your finger across the play area and the paddle follows. Tap to launch the ball.' },
      { q: 'How many lives do I get?', a: 'Three. You lose a life whenever the ball falls past your paddle, and the game ends at zero.' },
    ],
  },
  {
    slug: 'word-guess',
    game: 'word-guess',
    title: 'Word Guess — Free Online 5-Letter Word Game',
    h1: 'Word Guess',
    metaDescription:
      'Play Word Guess free online — guess the hidden 5-letter word in six tries. Green, yellow, and gray clues guide you. No download, no sign-up, works on mobile.',
    shortDescription: 'Guess the hidden 5-letter word.',
    howToPlay: [
      'Type any valid 5-letter word and press Enter to make a guess.',
      'Green means a letter is correct and in the right spot; yellow means it is in the word but a different spot; gray means it is not in the word.',
      'Use the colour clues — mirrored on the on-screen keyboard — to narrow down the answer.',
      'You have six guesses to find the word. A new word is picked every game.',
    ],
    strategy: [
      'Open with a word rich in common vowels and consonants (like "crane" or "slate") to light up as many clues as possible.',
      'On your second guess, use a word with five brand-new letters to test more of the alphabet.',
      'Keep known green letters in place and shuffle yellow letters to new positions.',
      'Watch for double letters — a letter can appear twice, and the clues account for it.',
      'Save risky guesses for when you have spare turns; play it safe when you are down to your last one.',
    ],
    faq: [
      { q: 'How many guesses do I get?', a: 'Six. Each guess must be a valid five-letter word, and the colour clues tell you how close you are.' },
      { q: 'How do I play on mobile?', a: 'Tap the on-screen keyboard to type your guess and press Enter. Everything works by touch.' },
      { q: 'Is there a new word each time?', a: 'Yes. Every game picks a fresh hidden word, so you can play as many rounds as you like.' },
    ],
  },
  {
    slug: 'tic-tac-toe',
    game: 'tic-tac-toe',
    title: 'Play Tic-Tac-Toe Online — Free vs Computer',
    h1: 'Tic-Tac-Toe',
    metaDescription:
      'Play Tic-Tac-Toe online for free against the computer. Choose Easy or an unbeatable Hard AI. No download, no sign-up — works on desktop and mobile.',
    shortDescription: 'Three in a row versus the computer.',
    howToPlay: [
      'You play as X; the computer plays as O.',
      'Tap any empty square to place your mark, then the computer takes its turn.',
      'Get three of your marks in a row — across, down, or diagonally — to win.',
      'Choose Easy for a beatable opponent or Hard for a perfect AI you can only draw against.',
    ],
    strategy: [
      'Take the centre when you can — it is part of the most winning lines.',
      'If you go second, grab a corner rather than an edge.',
      'Create a "fork" — two ways to win at once — so your opponent cannot block both.',
      'Always block the computer when it has two in a row, or it will win next turn.',
      'Against the Hard AI, perfect play leads to a draw; look for a slip only the Easy AI will make.',
    ],
    faq: [
      { q: 'Can I beat the Hard AI?', a: 'No — the Hard opponent uses a perfect strategy and never loses. The best you can force is a draw. Pick Easy for a winnable game.' },
      { q: 'Do I play against a person?', a: 'You play against the computer. It responds to each of your moves automatically.' },
      { q: 'What happens if the board fills up with no winner?', a: 'Neither player wins — the game ends in a draw, and you can start a new one immediately.' },
    ],
  },
  {
    slug: 'reaction-time',
    game: 'reaction-time',
    title: 'Reaction Time Test — Free Online Reflex Test',
    h1: 'Reaction Time Test',
    metaDescription:
      'Test your reaction time online for free. Wait for green, then click as fast as you can to measure your reflexes in milliseconds. No download, works on mobile.',
    shortDescription: 'How fast are your reflexes?',
    howToPlay: [
      'Click Start, then wait for the red screen to turn green.',
      'As soon as it turns green, click or tap (or press Space) as fast as you can.',
      'Your reaction time is measured in milliseconds — lower is better.',
      'If you click before it turns green, it counts as "Too soon" and you retry that attempt.',
    ],
    strategy: [
      'Rest your finger lightly on the button so you can react the instant the colour changes.',
      'Watch the whole screen, not one spot — the change fills your view and you will catch it faster.',
      'Do not try to guess the timing; the delay is random, so anticipating just causes "Too soon" fails.',
      'Take a few attempts to warm up — your average usually improves after the first couple.',
      'Stay relaxed. Tension slows you down more than it speeds you up.',
    ],
    faq: [
      { q: 'What is a good reaction time?', a: 'Around 250ms is average for a click. Under 200ms is fast, and top gamers reach 150ms or lower.' },
      { q: 'How is it measured?', a: 'A high-resolution browser timer measures the gap between the screen turning green and your click, accurate to the millisecond.' },
      { q: 'Why does it say "Too soon"?', a: 'You clicked before the screen turned green. The delay is random on purpose, so you have to react, not guess.' },
    ],
  },
  {
    slug: 'connect-four',
    game: 'connect-four',
    title: 'Play Connect Four Online — Free vs Computer',
    h1: 'Connect Four',
    metaDescription:
      'Play Connect Four online for free against the computer. Drop discs and line up four in a row. Easy and Hard AI. No download, works on desktop and mobile.',
    shortDescription: 'Line up four discs to win.',
    howToPlay: [
      'You drop red discs; the computer drops yellow ones.',
      'Tap a column to drop your disc — it falls to the lowest open slot.',
      'Line up four of your discs in a row — horizontally, vertically, or diagonally — to win.',
      'Choose Easy for a casual game or Hard for a sharper computer opponent.',
    ],
    strategy: [
      'Play the centre column early — it is part of the most possible four-in-a-rows.',
      'Watch for the computer getting three in a row and block it before it connects the fourth.',
      'Set up a "double threat" — two ways to win at once — so a single block cannot stop you.',
      'Think about diagonals; they are the easiest wins to miss on both sides.',
      'Do not stack straight up unless it helps — you may be handing the square above to your opponent.',
    ],
    faq: [
      { q: 'Who moves first?', a: 'You do. You always play Red and drop the first disc, and the computer answers as Yellow.' },
      { q: 'How do I win?', a: 'Be the first to line up four of your discs in a row, in any direction: horizontal, vertical, or diagonal.' },
      { q: 'How hard is the computer?', a: 'Easy makes casual moves; Hard always takes a winning move, blocks your threats, and favours the centre.' },
    ],
  },
  {
    slug: 'hangman',
    game: 'hangman',
    title: 'Play Hangman Online — Free Word Guessing Game',
    h1: 'Hangman',
    metaDescription:
      'Play Hangman online for free. Guess the hidden word one letter at a time before the drawing is complete. Category hints, hundreds of words. No download, on mobile.',
    shortDescription: 'Guess the word before it is too late.',
    howToPlay: [
      'A hidden word is shown as blanks, one for each letter, with a category hint.',
      'Guess letters using the on-screen A-Z bank or your keyboard.',
      'A correct letter fills in every place it appears; a wrong letter draws another part of the figure.',
      'Guess the whole word before six wrong guesses complete the drawing.',
    ],
    strategy: [
      'Start with common vowels (E, A, O, I) to open up the word.',
      'Then try frequent consonants like R, S, T, N, and L.',
      'Use the category hint and revealed letters to guess likely word shapes.',
      'Look for common endings (-ING, -ED, -TION) once you have a few letters.',
      'Save risky letters until you are confident — every wrong guess costs you.',
    ],
    faq: [
      { q: 'How many wrong guesses do I get?', a: 'Six. Each wrong letter adds a part to the drawing, and the game ends when it is complete.' },
      { q: 'Are there hints?', a: 'Yes. Every word comes with a category hint (like animals or food) to help you start.' },
      { q: 'Does it save my streak?', a: 'Yes. Your wins and streak are stored in your browser between games on the same device.' },
    ],
  },
  {
    slug: 'simon',
    game: 'simon',
    title: 'Play Simon Online — Free Memory Sequence Game',
    h1: 'Simon',
    metaDescription:
      'Play Simon online for free — the classic light and sound memory game. Watch the sequence, repeat it, and see how long a pattern you can remember. No download, on mobile.',
    shortDescription: 'Repeat the growing colour sequence.',
    howToPlay: [
      'Press Start and watch the four colour pads flash a sequence with sound.',
      'Repeat the sequence by tapping the pads in the same order.',
      'Each round the sequence grows by one and plays a little faster.',
      'One wrong pad ends the game — how long a pattern can you remember?',
    ],
    strategy: [
      'Say the colours to yourself as they flash — naming them locks them into memory.',
      'Listen to the tones as well as watching; each pad has its own pitch to lean on.',
      'Group the sequence into small chunks (like phone-number style) instead of one long list.',
      'Keep your eyes on the whole board, not one pad, so you catch every flash.',
      'Stay calm as it speeds up — rushing your taps causes more mistakes than the pace does.',
    ],
    faq: [
      { q: 'Does the sequence change every round?', a: 'No. Each round replays the same sequence with one new random step added at the end, so you only have one new step to learn — but a single wrong press ends the game.' },
      { q: 'How does it get harder?', a: 'Every round adds one more step to the sequence and the playback speeds up, so it gets tougher the longer you last.' },
      { q: 'Can I play on my phone?', a: 'Yes. Just tap the colour pads — the whole game works by touch.' },
    ],
  },
  {
    slug: 'whack-a-mole',
    game: 'whack-a-mole',
    title: 'Play Whack-a-Mole Online — Free Reflex Game',
    h1: 'Whack-a-Mole',
    metaDescription:
      'Play Whack-a-Mole online for free. Bonk the moles as they pop up before they duck back down and rack up points in 30 seconds. No download, works on mobile.',
    shortDescription: 'Bonk the moles before they duck.',
    howToPlay: [
      'Press Start to begin a 30-second round.',
      'Moles pop up from the holes at random — click or tap them to score.',
      'Each mole only stays up for a moment, so be quick.',
      'The game speeds up as time runs out. Score as many hits as you can.',
    ],
    strategy: [
      'Keep your cursor or finger near the centre so you can reach any hole fast.',
      'Watch the whole grid, not one hole — moles can pop up anywhere.',
      'Tap the instant you see a mole; hesitation lets it duck back down.',
      'Do not waste swings on empty holes — misses cost you time.',
      'As the pace ramps up near the end, focus on clean hits over frantic tapping.',
    ],
    faq: [
      { q: 'How long is a round?', a: 'Thirty seconds. Score as many mole hits as you can before the timer runs out.' },
      { q: 'How do I play on mobile?', a: 'Just tap the moles as they pop up. The whole game works by touch.' },
      { q: 'Does it save my best score?', a: 'Yes. Your best score is stored in your browser between games on the same device.' },
    ],
  },
  {
    slug: 'aim-trainer',
    game: 'aim-trainer',
    title: 'Aim Trainer — Free Online Click Accuracy Test',
    h1: 'Aim Trainer',
    metaDescription:
      'Train your aim online for free. Click 30 targets as fast and accurately as you can, and track your time, accuracy, and targets per second. No download, works on mobile.',
    shortDescription: 'Click the targets as fast as you can.',
    howToPlay: [
      'Press Start, then click or tap each target as it appears.',
      'Hitting a target scores it and spawns the next one instantly.',
      'Clicking empty space counts as a miss and lowers your accuracy.',
      'Clear all 30 targets — your time, accuracy, and targets per second are shown at the end.',
    ],
    strategy: [
      'Move and click in one motion instead of stopping over each target.',
      'Keep your eyes slightly ahead, anticipating where the next target may appear.',
      'Accuracy matters as much as speed — wild clicking tanks your score.',
      'Use a comfortable, consistent grip or steady finger for repeatable aim.',
      'Warm up with a few runs; your targets-per-second usually climbs as you settle in.',
    ],
    faq: [
      { q: 'What does Aim Trainer measure?', a: 'Your click speed and accuracy: total time for 30 targets, your hit accuracy percentage, and targets cleared per second.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap the targets instead of clicking; the play area is fully touch-friendly.' },
      { q: 'What counts as a miss?', a: "Clicking anywhere that isn't a target counts as a miss and lowers your accuracy percentage — the target itself doesn't disappear until you hit it." },
    ],
  },
  {
    slug: 'sudoku',
    game: 'sudoku',
    title: 'Play Sudoku Online — Free Easy, Medium & Hard',
    h1: 'Sudoku',
    metaDescription:
      'Play Sudoku online for free with Easy, Medium, and Hard puzzles. Every board has a unique solution. Notes, conflict highlighting, and a timer. No download, on mobile.',
    shortDescription: 'Fill the grid 1 to 9.',
    howToPlay: [
      'Fill the 9x9 grid so every row, column, and 3x3 box contains the digits 1 to 9.',
      'Tap a cell, then type a number or use the on-screen number pad.',
      'Use notes (pencil marks) to jot down candidate numbers for a cell.',
      'The given numbers cannot change. Solve the whole grid to win.',
    ],
    strategy: [
      'Scan for cells where only one number can possibly go, and fill those first.',
      'Work box by box, and row by row, looking for a digit that fits only one spot.',
      'Use pencil notes to track candidates, then eliminate them as you place numbers.',
      'Look for "naked pairs" — two cells in a unit that can only be the same two numbers.',
      'When stuck, switch to a different row, column, or box; a new angle often reveals a move.',
    ],
    faq: [
      { q: 'Does every puzzle have one solution?', a: 'Yes. Every board is generated with a unique solution, so it can always be solved by logic without guessing.' },
      { q: 'What are the difficulties?', a: 'Easy, Medium, and Hard, which differ by how many numbers are given at the start.' },
      { q: 'Does it track my time?', a: 'Yes. A timer runs while you solve, and your best time per difficulty is saved in your browser.' },
    ],
  },
  {
    slug: 'rock-paper-scissors',
    game: 'rps',
    title: 'Play Rock Paper Scissors Online — Free vs Computer',
    h1: 'Rock Paper Scissors',
    metaDescription:
      'Play Rock Paper Scissors online for free against the computer. Pick rock, paper, or scissors and watch the reveal. Win streaks and a running tally. No download.',
    shortDescription: 'Rock, paper, scissors vs the computer.',
    howToPlay: [
      'Pick rock, paper, or scissors.',
      'The computer secretly picks too, then both choices are revealed.',
      'Rock beats scissors, scissors beats paper, and paper beats rock. Same choice is a draw.',
      'Your wins, losses, and draws are tallied as you play.',
    ],
    strategy: [
      'People (and simple bots) rarely play truly randomly — look for patterns and exploit them.',
      'After a loss, many players switch to what would have beaten your last move; anticipate it.',
      'Do not fall into repeating the same throw; mix it up so you stay unpredictable.',
      'Against a random computer the odds are even, so focus on long-run consistency and streaks.',
    ],
    faq: [
      { q: 'Is the computer random?', a: 'The computer picks its move at random each round, so every game is a fair coin-flip of skill and luck.' },
      { q: 'Can I play a match?', a: 'Yes. Play endlessly or set a first-to-3 or first-to-5 match to crown a winner.' },
      { q: "What's the win condition in a match?", a: "In a first-to-3 or first-to-5 match, the first player to reach that many wins takes the match; ties don't count toward the total." },
    ],
  },
  {
    slug: 'pong',
    game: 'pong',
    title: 'Play Pong Online — Free Classic Paddle Game',
    h1: 'Pong',
    metaDescription:
      'Play Pong online for free against the computer. Move your paddle, rally the ball, and be first to seven points. Easy and Hard AI. No download, works on mobile.',
    shortDescription: 'Classic paddle tennis vs the computer.',
    howToPlay: [
      'Move your paddle with the mouse, your finger, or the up and down arrow keys.',
      'Keep the ball in play by bouncing it back with your paddle.',
      'You score when the computer misses; the computer scores when you miss.',
      'First to seven points wins. Choose Easy or Hard for the computer.',
    ],
    strategy: [
      'Hit the ball with the edge of your paddle to send it back at a sharper angle.',
      'Return to the centre after each hit so you can cover either direction.',
      'Watch the ball’s angle off the walls to predict where it will arrive.',
      'On Hard, vary your return angles so the computer cannot settle into a rhythm.',
      'Stay calm as rallies speed up — small adjustments beat big lunges.',
    ],
    faq: [
      { q: 'How do I control my paddle?', a: 'Move the mouse or your finger up and down over the play area, or use the up and down arrow keys.' },
      { q: 'How do I win?', a: 'Be the first to reach seven points. You score whenever the computer fails to return the ball.' },
      { q: 'Does it save my record?', a: 'Yes. Your win count is stored in your browser and persists between games on the same device.' },
    ],
  },
  {
    slug: 'lights-out',
    game: 'lights-out',
    title: 'Play Lights Out Online — Free Classic Logic Puzzle',
    h1: 'Lights Out',
    metaDescription:
      'Play Lights Out online for free. Turn off every light on the 5x5 grid — each tap flips a light and its neighbors. Always solvable. No download, works on mobile.',
    shortDescription: 'Switch every light off.',
    howToPlay: [
      'The board is a 5x5 grid of lights, some on and some off.',
      'Tapping a light toggles it and its four neighbors (up, down, left, right).',
      'Your goal is to turn every light off.',
      'Every board is always solvable — do it in as few moves as you can.',
    ],
    strategy: [
      'Work top to bottom: clear the top row, then use the row below to fix what remains.',
      'The "chase the lights" method — press the cell below any lit light, row by row — solves most boards.',
      'Remember pressing a cell twice cancels out, so avoid undoing your own moves.',
      'Plan a few presses ahead; a single tap changes up to five lights at once.',
      'Fewer moves means a better score, so look for presses that clear the most lights.',
    ],
    faq: [
      { q: 'Is every board solvable?', a: 'Yes. Each board is scrambled from a solved state with real presses, so it can always be turned off.' },
      { q: 'How many presses does a board need?', a: 'At most eight. Each board is scrambled with eight random presses from an all-off grid, and pressing a light twice cancels out, so repeating those presses in any order switches everything off.' },
      { q: 'How does tapping work?', a: 'Tapping a light flips it and its four orthogonal neighbors. Corner and edge cells flip fewer lights.' },
    ],
  },
  {
    slug: 'mastermind',
    game: 'mastermind',
    title: 'Play Mastermind Online — Free Code Breaking Game',
    h1: 'Mastermind',
    metaDescription:
      'Play Mastermind online for free. Crack the hidden 4-colour code in ten guesses using black and white peg clues. A classic logic puzzle. No download, on mobile.',
    shortDescription: 'Crack the hidden colour code.',
    howToPlay: [
      'A secret code of four colours (from six, repeats allowed) is hidden.',
      'Build a guess from the colour palette and submit it.',
      'A black peg means a colour is right and in the right spot; a white peg means a colour is right but in the wrong spot.',
      'Use the clues to crack the code within ten guesses.',
    ],
    strategy: [
      'Start with a guess that uses two different colours to learn which are in the code.',
      'Track black versus white pegs carefully — black is position-perfect, white is right-colour-wrong-place.',
      'Change one thing at a time between guesses so each clue tells you something specific.',
      'Remember colours can repeat, so a low peg count does not rule a colour out entirely.',
      'Use elimination: rule colours in or out before worrying about their exact positions.',
    ],
    faq: [
      { q: 'How does the feedback work?', a: 'Each guess returns black pegs (right colour, right spot) and white pegs (right colour, wrong spot), never double-counting a peg.' },
      { q: 'Can colours repeat in the code?', a: 'Yes. The secret can contain the same colour more than once, which makes the puzzle trickier.' },
      { q: 'How many guesses do I get?', a: 'Ten. Crack the four-colour code before you run out to win.' },
    ],
  },
  {
    slug: 'bubble-shooter',
    game: 'bubble-shooter',
    title: 'Play Bubble Shooter Online — Free Bubble Pop Game',
    h1: 'Bubble Shooter',
    metaDescription:
      'Play Bubble Shooter online for free. Aim and fire bubbles, match three or more of the same colour to pop them, and clear the board. No download, works on mobile.',
    shortDescription: 'Match 3+ bubbles to pop them.',
    howToPlay: [
      'Aim with your mouse or finger — a guide line shows where the bubble will go.',
      'Click or tap to fire the bubble toward the cluster at the top.',
      'Match three or more bubbles of the same colour to pop them.',
      'Clear all the bubbles to win. If the bubbles reach the bottom line, the game is over.',
    ],
    strategy: [
      'Bounce shots off the side walls to reach bubbles tucked into corners.',
      'Aim for the bubbles holding up a big group — popping them drops everything below.',
      'Plan around your next bubble (shown at the shooter), not just the current one.',
      'Clear bubbles near the bottom first to keep away from the danger line.',
      'Save a colour you have plenty of for setting up a big chain drop.',
    ],
    faq: [
      { q: 'How are points scored?', a: 'Every bubble you pop is worth 10 points and every bubble that drops after losing its support is worth 20, so cutting a cluster loose pays double.' },
      { q: 'How do I pop bubbles?', a: 'Land a bubble next to two or more of the same colour so the connected group is three or more, and they pop.' },
      { q: 'What are the dropping bubbles?', a: 'When you pop the bubbles holding up others, the now-disconnected bubbles fall and score bonus points.' },
    ],
  },
  {
    slug: 'nonogram',
    game: 'nonogram',
    title: 'Play Nonogram Online — Free Picross Logic Puzzle',
    h1: 'Nonogram',
    metaDescription:
      'Play Nonogram (Picross) online for free. Use the row and column number clues to fill the grid and reveal a hidden picture. Easy and hard sizes. No download, on mobile.',
    shortDescription: 'Solve the picture from number clues.',
    howToPlay: [
      'Numbers along each row and column tell you the runs of filled cells in order.',
      'Tap a cell to fill it, or switch to Mark mode to X-out cells you know are empty.',
      'A clue like "3 1" means a run of three filled cells, a gap, then one filled cell.',
      'Fill exactly the right cells to reveal the picture and win.',
    ],
    strategy: [
      'Start with the biggest clues — in a 10-wide row, a clue of 8 leaves little room and forces cells.',
      'Mark cells you know are empty with an X; ruling out is as useful as filling in.',
      'Cross-reference rows and columns: a cell filled by a row clue can unlock a column, and vice versa.',
      'Look for overlaps — where a large run must cover the same cells no matter where it sits.',
      'Work from the clues you are certain about outward; never guess when a deduction exists.',
    ],
    faq: [
      { q: 'What is a Nonogram?', a: 'A logic puzzle (also called Picross or Griddlers) where number clues on each row and column tell you which cells to fill to reveal a hidden picture.' },
      { q: 'How do I mark empty cells?', a: 'Switch to Mark mode and tap a cell to place an X, which flags it as empty without filling it.' },
      { q: 'Does it track my time?', a: 'Yes. A timer runs while you solve, and your best time per size is saved in your browser.' },
    ],
  },
  {
    slug: 'sokoban',
    game: 'sokoban',
    title: 'Play Sokoban Online — Free Box Pushing Puzzle',
    h1: 'Sokoban',
    metaDescription:
      'Play Sokoban online for free. Push every box onto its target square in this classic warehouse puzzle. Hand-crafted solvable levels, undo. No download, works on mobile.',
    shortDescription: 'Push every box onto a target.',
    howToPlay: [
      'Move your character with the arrow keys or the on-screen D-pad.',
      'Walk into a box to push it — but only if the space beyond it is clear.',
      'You can only push one box at a time, and never pull. Push carefully.',
      'Get every box onto a glowing target square to solve the level.',
    ],
    strategy: [
      'Never push a box into a corner (unless the corner is a target) — it gets stuck there forever.',
      'Avoid pushing a box flat against a wall along a side with no target; it can no longer come off that wall.',
      'Solve the boxes that are hardest to reach first, while you still have room to maneuver.',
      'Plan the final resting order — sometimes you must place the back boxes before the front ones.',
      'Use Undo freely to test a push, and Restart if you deadlock a box.',
    ],
    faq: [
      { q: 'Are the levels always solvable?', a: 'Yes. Every level is hand-crafted and verified solvable, so there is always a way to push all the boxes onto their targets.' },
      { q: 'Can I undo a mistake?', a: 'Yes. There is an Undo button (and a Restart) so you can recover if you push a box into a bad spot.' },
      { q: 'How do I play on mobile?', a: 'Use the on-screen D-pad to move. Everything works by touch.' },
    ],
  },
  {
    slug: 'dots-and-boxes',
    game: 'dots-and-boxes',
    title: 'Play Dots and Boxes Online — Free vs Computer',
    h1: 'Dots and Boxes',
    metaDescription:
      'Play Dots and Boxes online for free against the computer. Draw lines, complete boxes to claim them, and own the most to win. Easy and Hard AI. No download, on mobile.',
    shortDescription: 'Complete boxes to claim them.',
    howToPlay: [
      'Take turns drawing a single line between two adjacent dots.',
      'Complete the fourth side of a box to claim it in your colour — and take another turn.',
      'You are the first player; the computer plays against you.',
      'When every line is drawn, whoever owns the most boxes wins.',
    ],
    strategy: [
      'Early on, avoid drawing the third side of any box — it hands your opponent a free box.',
      'Chaining matters: completing one box lets you go again, so line up runs of boxes.',
      'Learn the "double-cross" — leaving the last two boxes of a chain forces your opponent to open the next one.',
      'Count safe moves left; when they run out, whoever must "open" a chain usually loses it.',
      'On Hard, the computer never gives away a free box, so set traps rather than hoping for mistakes.',
    ],
    faq: [
      { q: 'How do I win?', a: 'Own the most boxes when all the lines are drawn. Completing a box also earns you an extra turn.' },
      { q: 'Do I play a person or the computer?', a: 'You play against the computer. Choose Easy for a casual game or Hard for a sharp opponent.' },
      { q: 'What is the double-cross strategy?', a: 'Leaving the last two boxes of a chain open forces your opponent to open the next chain for you, instead of you having to open one yourself — a key late-game technique.' },
    ],
  },
  {
    slug: 'flappy',
    game: 'flappy',
    title: 'Play Flappy Online — Free Tap to Fly Game',
    h1: 'Flappy',
    metaDescription:
      'Play Flappy online for free. Tap to flap and fly through the gaps between pipes for as long as you can. One-tap arcade fun. No download, works on mobile.',
    shortDescription: 'Tap to fly through the gaps.',
    howToPlay: [
      'Click, tap, or press Space to give a flap of lift.',
      'Each flap pushes you up; gravity always pulls you down.',
      'Fly through the gap between each pair of pipes to score a point.',
      'Hit a pipe, the ground, or the ceiling and the run is over.',
    ],
    strategy: [
      'Tap in a steady rhythm rather than mashing — small, regular flaps keep you level.',
      'Aim for the middle of each gap so you have room for error above and below.',
      'Look ahead to the next gap while you clear the current one.',
      'Stay calm after a near miss; panic-tapping sends you into the top pipe.',
      'Short taps for small adjustments, a firmer tap only when you need real height.',
    ],
    faq: [
      { q: 'Does the gap get smaller as I go?', a: 'No. Every pair of pipes leaves the same size opening and the pipes scroll at a constant speed; only the height of the gap changes, and it never sits right against the ceiling or the ground.' },
      { q: 'How do I control it?', a: 'One input: click, tap, or press Space to flap. That is the whole game.' },
      { q: 'How do I score?', a: 'You earn a point each time you pass safely through the gap between a pair of pipes.' },
    ],
  },
  {
    slug: 'checkers',
    game: 'checkers',
    title: 'Play Checkers Online — Free vs Computer',
    h1: 'Checkers',
    metaDescription:
      'Play Checkers (draughts) online for free against the computer. Jump and capture, king your pieces, and clear the board. Easy and Hard AI. No download, on mobile.',
    shortDescription: 'Jump, capture, and king vs the computer.',
    howToPlay: [
      'Move your pieces diagonally forward one square onto an empty dark square.',
      'Capture by jumping diagonally over an opponent piece to the empty square beyond — and keep jumping if you can.',
      'If a capture is available you must take it.',
      'Reach the far row to be crowned a king, which can move and jump both directions. Clear all the computer’s pieces to win.',
    ],
    strategy: [
      'Control the center — pieces in the middle have more moves and influence.',
      'Keep your back row intact early to stop the computer from getting easy kings.',
      'Look for multi-jumps: setting up a chain capture can swing the game.',
      'Trade pieces when you are ahead; keep pieces when you are behind.',
      'Since captures are forced, you can bait the computer into a jump that opens up a bigger capture for you.',
    ],
    faq: [
      { q: 'Are captures mandatory?', a: 'Yes. If a jump is available you must take it, and chained multi-jumps continue in the same turn — standard checkers rules.' },
      { q: 'Can I beat the Hard computer?', a: 'The Hard AI looks several moves ahead and punishes mistakes, but it is beatable with good strategy. Easy is more forgiving.' },
      { q: 'How do I get a king?', a: "Move one of your pieces into the far row from where it started — it's then crowned a king and can move and capture diagonally in both directions." },
    ],
  },
  {
    slug: 'maze',
    game: 'maze',
    title: 'Play Maze Online — Free Labyrinth Puzzle Game',
    h1: 'Maze',
    metaDescription:
      'Play Maze online for free. Navigate from the start to the exit of a randomly generated labyrinth. Easy, medium, and hard sizes. No download, works on mobile.',
    shortDescription: 'Find your way to the exit.',
    howToPlay: [
      'Move with the arrow keys, WASD, swipe, or the on-screen D-pad.',
      'Walls block your path — you can only move through openings.',
      'Start at the top-left and reach the glowing exit at the bottom-right.',
      'Every maze is randomly generated and always solvable. Pick a bigger size for a tougher challenge.',
    ],
    strategy: [
      'Try the "wall follower" method — keep one hand on the same wall and you will eventually reach the exit.',
      'At each junction, commit to a direction and remember where you have been.',
      'Use the visited-cell trail to avoid looping back on yourself.',
      'Scan ahead toward the exit corner rather than wandering randomly.',
      'On big mazes, race the clock — your best time per size is saved.',
    ],
    faq: [
      { q: 'Is every maze solvable?', a: 'Yes. Each maze is generated as a "perfect" maze with exactly one path between any two cells, so there is always a route to the exit.' },
      { q: 'How do I play on mobile?', a: 'Swipe in the direction you want to move, or use the on-screen D-pad. No keyboard needed.' },
      { q: 'How many maze sizes are there?', a: 'Easy, medium, and hard sizes — bigger mazes have more cells and take longer to solve.' },
    ],
  },
  {
    slug: 'number-memory',
    game: 'number-memory',
    title: 'Number Memory Test — Free Online Memory Game',
    h1: 'Number Memory',
    metaDescription:
      'Test your number memory online for free. A number flashes, then you type it from memory — and it grows one digit each level. How many digits can you recall? No download.',
    shortDescription: 'How many digits can you remember?',
    howToPlay: [
      'Press Start — a number appears on screen for a few seconds.',
      'Memorise it before it disappears.',
      'Type the number from memory and submit.',
      'Get it right to advance — each level adds one more digit. One wrong answer ends the game.',
    ],
    strategy: [
      'Chunk the digits into small groups (like a phone number) instead of one long string.',
      'Say the number to yourself as it shows — hearing it helps you hold it.',
      'Find a rhythm or pattern in the digits to make them stick.',
      'Do not second-guess; your first recall is usually the most accurate.',
      'Stay relaxed — stress shrinks your working memory more than the extra digit does.',
    ],
    faq: [
      { q: 'What is a good number memory span?', a: 'Most people can hold about 7 digits. Reaching 10 or more is a strong result.' },
      { q: 'How long is the number shown?', a: 'A few seconds, scaling slightly with length, then it hides and you type it from memory.' },
      { q: 'What happens after a wrong answer?', a: 'The run ends immediately — the level you reached (the number of digits you correctly recalled) is your score for that run.' },
    ],
  },
  {
    slug: 'word-search',
    game: 'word-search',
    title: 'Play Word Search Online — Free Word Find Puzzle',
    h1: 'Word Search',
    metaDescription:
      'Play Word Search online for free. Find every hidden word in the letter grid — across, down, and diagonally, forwards or backwards. Fresh boards. No download, on mobile.',
    shortDescription: 'Find the hidden words.',
    howToPlay: [
      'A list of hidden words sits beside a grid of letters.',
      'Drag across the letters of a word to select it — horizontally, vertically, or diagonally.',
      'Words can run forwards or backwards.',
      'Find every word on the list to complete the puzzle.',
    ],
    strategy: [
      'Scan for the first letter of each target word, then check the eight directions around it.',
      'Look for uncommon letters (Q, Z, X) — they narrow down where a word can be.',
      'Sweep the grid row by row so you do not miss a word.',
      'Do not forget the diagonals and backwards words — they are the easiest to overlook.',
      'Cross off words as you find them to focus on what is left, and race your best time.',
    ],
    faq: [
      { q: 'Which directions can words go?', a: 'Any of the eight: horizontal, vertical, and both diagonals, running either forwards or backwards.' },
      { q: 'How do I select a word?', a: 'Drag from the first letter to the last letter of the word. It works with a mouse or by touch on mobile.' },
      { q: 'Are the boards different each time?', a: 'Yes. Every game generates a fresh grid and word placement, so no two puzzles are the same.' },
    ],
  },
  {
    slug: 'reversi',
    game: 'reversi',
    title: 'Play Reversi (Othello) Online — Free vs Computer',
    h1: 'Reversi',
    metaDescription:
      'Play Reversi (Othello) online for free against the computer. Flank your opponent’s discs to flip them and own the most of the 8x8 board. Easy and Hard AI. No download.',
    shortDescription: 'Flip discs, own the board.',
    howToPlay: [
      'Place a disc so it traps a line of the computer’s discs between your new disc and another of yours.',
      'Every trapped disc in that line flips to your colour — in any direction, including diagonals.',
      'You can only play a move that flips at least one disc. If you have no move, your turn passes.',
      'When neither side can move, whoever owns more discs wins.',
    ],
    strategy: [
      'Grab the corners — they can never be flipped, so they anchor your position.',
      'Avoid the squares next to a corner early; they often hand the corner to your opponent.',
      'Do not flip too many discs early; keeping fewer discs (mobility) mid-game is often stronger.',
      'Aim to control edges, which are hard for the opponent to flip.',
      'Late game, count carefully — a single move can flip a whole row and swing the majority.',
    ],
    faq: [
      { q: 'Is Reversi the same as Othello?', a: 'Yes. Reversi and Othello are the same disc-flipping strategy game on an 8x8 board.' },
      { q: 'How do I win?', a: 'Own the most discs when neither player can make a legal move. Trapping and flipping lines is how you take the lead.' },
      { q: 'Why did my turn get skipped?', a: 'If you have no legal move that flips at least one disc, your turn is skipped automatically and play passes back to the computer.' },
    ],
  },
  {
    slug: 'gem-match',
    game: 'gem-match',
    title: 'Play Gem Match Online — Free Match 3 Puzzle',
    h1: 'Gem Match',
    metaDescription:
      'Play Gem Match online for free — a match-3 swap puzzle. Swap gems to line up three or more, trigger cascading combos, and score big in 30 moves. No download, on mobile.',
    shortDescription: 'Swap gems, match 3, chain combos.',
    howToPlay: [
      'Tap or drag to swap two adjacent gems.',
      'Line up three or more of the same gem in a row or column to clear them.',
      'Gems above fall to fill the gaps, and new gems drop in from the top.',
      'A swap that makes no match is undone. Score as much as you can before your moves run out.',
    ],
    strategy: [
      'Look for moves that set up a cascade — clears that trigger more clears score a combo multiplier.',
      'Match four or five in a line when you can; bigger matches are worth more.',
      'Work near the bottom of the board so the drop-in creates fresh chances above.',
      'Scan the whole board before spending a move; do not waste a swap on a single three.',
      'Keep an eye on your remaining moves and prioritise the highest-scoring swaps.',
    ],
    faq: [
      { q: 'How do I make a match?', a: 'Swap two neighbouring gems so that three or more of the same kind line up horizontally or vertically.' },
      { q: 'What is a cascade?', a: 'When cleared gems drop and form a new match automatically, you get a chain combo worth bonus points.' },
      { q: 'How many moves do I get?', a: 'Thirty. Only a swap that makes a match uses a move — a swap that matches nothing is undone for free — and the game ends when your moves run out.' },
    ],
  },
  {
    slug: 'space-shooter',
    game: 'space-shooter',
    title: 'Play Space Shooter Online — Free Arcade Shooter',
    h1: 'Space Shooter',
    metaDescription:
      'Play Space Shooter online for free — a Space Invaders-style arcade game. Blast waves of descending aliens, dodge their fire, and chase a high score. No download, on mobile.',
    shortDescription: 'Blast the alien waves.',
    howToPlay: [
      'Move your ship with the arrow keys or by dragging with the mouse or your finger.',
      'Fire with Space or tap — hold to keep shooting.',
      'Destroy every alien in the wave before they reach the bottom.',
      'Dodge enemy fire. Lose all your lives and the game is over; clear a wave to face a faster one.',
    ],
    strategy: [
      'Pick off the edges of the formation first to give yourself more room to dodge.',
      'Keep moving — a stationary ship is an easy target for enemy fire.',
      'Prioritise enemies that have dropped lowest; they threaten to end the game.',
      'Fire in bursts aimed at columns rather than spraying randomly.',
      'Learn the formation’s side-to-side rhythm so you can time your shots and retreats.',
    ],
    faq: [
      { q: 'Why do the aliens speed up?', a: 'Two reasons: each new wave starts faster than the last, and within a wave the formation speeds up as you thin it out, so the last few aliens move almost twice as fast as a full formation. You have three lives.' },
      { q: 'How do I control my ship?', a: 'Arrow keys or mouse/touch drag to move, and Space or tap to fire. Hold to keep shooting.' },
      { q: 'How do I win a wave?', a: 'Destroy every alien in the formation. Clearing a wave brings a new, faster one.' },
    ],
  },
  {
    slug: 'tower-stack',
    game: 'tower-stack',
    title: 'Play Tower Stack Online — Free Block Stacking Game',
    h1: 'Tower Stack',
    metaDescription:
      'Play Tower Stack online for free. Time your tap to drop each sliding block onto the tower — the overhang is sliced off. Stack as high as you can. No download, on mobile.',
    shortDescription: 'Drop blocks, stack them high.',
    howToPlay: [
      'A block slides back and forth above the tower.',
      'Tap, click, or press Space to drop it.',
      'Any part hanging over the block below is sliced off, so your blocks get narrower with each miss.',
      'A near-perfect drop keeps full width. Miss the tower entirely and the game is over.',
    ],
    strategy: [
      'Aim for perfect drops — lining up exactly keeps your block full width and builds a combo.',
      'Watch the block’s speed; it moves faster the higher you climb, so start your tap early.',
      'Find a rhythm and drop on the beat rather than reacting at the last instant.',
      'If your block gets narrow, play it safe and centre each drop to survive.',
      'Stay relaxed — tension makes you tap late and shave off width.',
    ],
    faq: [
      { q: 'How do I score?', a: 'Every successful drop adds one to your height. The higher your tower, the better your score.' },
      { q: 'What is a perfect drop?', a: 'Dropping a block almost exactly over the one below keeps its full width (and can even regain a little), plus a combo bonus.' },
      { q: 'What happens if I miss the tower completely?', a: "The run ends immediately — dropping a block with zero overlap on the tower below doesn't slice it, it ends the game." },
    ],
  },
  {
    slug: 'prospector',
    game: 'prospector',
    title: 'Play Prospector Online — Free Push-Your-Luck Mining Game',
    h1: 'Prospector',
    metaDescription:
      'Play Prospector free online — a push-your-luck mining game. Flip tiles to grow your loot or bank it before the gas collapses the shaft. Count the odds, press your luck. No download.',
    shortDescription: 'Dig deeper or bank your loot?',
    howToPlay: [
      'Each descent uses a known, face-up deck of tiles: gems, dynamite, and gas.',
      'Choose FLIP to reveal the next tile, or BANK to lock in your loot and end the descent safely.',
      'Gems grow your pot by their value times a rising depth multiplier; dynamite doubles it.',
      'Flip the third gas tile and the shaft collapses — you lose everything not yet banked.',
    ],
    strategy: [
      'Every flipped tile stays visible, so count what is left: you can work out the exact chance the next flip is gas.',
      'Bank when the odds of a fatal flip outweigh the extra loot on offer — that is the whole game.',
      'Early flips are cheap risk; the deeper multiplier makes late gems worth chasing when the deck is safe.',
      'Dynamite is worth pushing one more flip for when only one gas tile remains.',
      'Chase your best single bank, not just survival — a fat banked run beats a timid one.',
    ],
    faq: [
      { q: 'Why are deeper gems worth more?', a: 'A depth multiplier climbs with every gem or dynamite tile you flip in a descent — ×1 for the first, then ×1.2, ×1.5, ×2 and upward — so the same gem pays far more the deeper you push your luck.' },
      { q: 'Is it luck or skill?', a: 'Both. Tiles are shuffled, but the deck is fully known and flipped tiles stay visible, so banking is a countable expected-value decision.' },
      { q: 'What ends a descent?', a: 'Banking (safe, you keep your loot) or flipping the third gas tile (the shaft collapses and you lose the un-banked pot).' },
    ],
  },
  {
    slug: 'zero-hour',
    game: 'zero-hour',
    title: 'Play Zero Hour Online — Free Number Puzzle Game',
    h1: 'Zero Hour',
    metaDescription:
      'Play Zero Hour free online — a one-finger number puzzle where each tile’s number is both its value and its fuse. Harvest it before it hits zero. Chain combos. No download, on mobile.',
    shortDescription: 'Each number is its own countdown.',
    howToPlay: [
      'Every tile shows a number that is both its point value AND its fuse.',
      'Each tick, every tile’s number drops by one.',
      'Tap a tile to harvest it for its current value before it reaches zero and cracks.',
      'Three cracks end the run. A fresh tile drops in to replace each one you harvest.',
    ],
    strategy: [
      'Triage constantly: a 9 is worth more but lives longer, while a 2 is about to detonate.',
      'Harvest strictly-descending values in quick succession to build a combo multiplier up to x8.',
      'Do not hoard high tiles too long — the whole board ticks down together.',
      'Sweep up low, short-fuse tiles before they crack, even for a few points.',
      'Balance greed (chasing combos) against survival (avoiding cracks) every second.',
    ],
    faq: [
      { q: 'What is the twist in Zero Hour?', a: 'A tile’s number is both its score and its countdown — value and time are the same thing, so you constantly trade worth against survival.' },
      { q: 'How does a run end?', a: 'When three tiles crack (reach zero before you harvest them), the game is over.' },
      { q: 'What is the combo multiplier?', a: 'Harvesting tiles in strictly descending value back-to-back builds a multiplier up to x8, so chaining a 9 into a 7 into a 5 scores far more than harvesting them in random order.' },
    ],
  },
  {
    slug: 'overload',
    game: 'overload',
    title: 'Play Overload Online — Free Chain Reaction Puzzle',
    h1: 'Overload',
    metaDescription:
      'Play Overload free online — a one-tap chain-reaction puzzle. Charge cells until they overload and cascade energy across the grid in combo waves. Find the perfect tap. No download.',
    shortDescription: 'One tap, chain-reaction cascade.',
    howToPlay: [
      'Every cell’s capacity equals its number of neighbours (corner 2, edge 3, centre 4).',
      'Tap a cell to add one charge.',
      'The instant a cell reaches capacity it overloads: it resets and pushes energy into each neighbour.',
      'Neighbours that fill up overload too, cascading in waves. You have a limited number of taps — score big chains.',
    ],
    strategy: [
      'Look for cells already near capacity next to other near-full cells — one tap can start a rolling chain.',
      'Centre cells reach more neighbours, so a well-placed centre overload spreads furthest.',
      'Set up a cascade rather than spending taps one at a time; the combo multiplier rewards big chains.',
      'Aim to clear the whole board in a run for the Perfect Storm bonus.',
      'Spend your last taps to trigger the biggest possible single cascade.',
    ],
    faq: [
      { q: 'What happens when a cell overloads?', a: 'It resets to zero and sends one charge to each orthogonal neighbour at once; any neighbour that reaches capacity then overloads too, chaining across the board.' },
      { q: 'How many taps do I get?', a: 'Puzzle mode gives you 12 taps per board, and a Perfect Storm pays 500 points plus 50 for every tap you still have. Endless mode starts you with 10 taps and adds 5 more after each Perfect Storm.' },
      { q: 'How do I score high?', a: 'Trigger long cascades — each overload in a single chain raises the combo multiplier, so one perfect tap can sweep the grid.' },
    ],
  },
  {
    slug: 'ricochet',
    game: 'ricochet',
    title: 'Play Ricochet Online — Free One-Tap Chain Puzzle',
    h1: 'Ricochet',
    metaDescription:
      'Play Ricochet free online — a one-tap chain puzzle. Every tile is a distance and a direction; fire a bolt that hops across the board obeying each tile it lands on. Chain long trails. No download.',
    shortDescription: 'One tap, a bolt snakes the board.',
    howToPlay: [
      'Every tile shows a number (1–4) and an arrow direction.',
      'Tap a tile to fire a bolt: it hops that many cells along its arrow.',
      'Where it lands, the tile clears, scores, and the bolt then obeys that new tile’s number and arrow.',
      'The chain continues until the bolt lands on an empty cell or flies off the board. Longer trails score much more.',
    ],
    strategy: [
      'Read the board like a route — trace where a tile’s arrow and number would send the bolt next.',
      'Scoring is convex: one long chain is worth far more than several short ones, so hunt the big ignition.',
      'Watch for tiles whose arrows loop back into a dense area to keep the chain alive longer.',
      'Corners and edges often cut chains short — start bolts that travel inward.',
      'After gravity refills the board, new trails appear; rescan before every tap.',
    ],
    faq: [
      { q: 'How does the bolt move?', a: 'It jumps a tile’s number of cells in that tile’s arrow direction, then repeats from wherever it lands, chaining across the board.' },
      { q: 'Can it loop forever?', a: 'No. Each landed tile clears, so any revisit or an off-board hop ends the chain — it always terminates.' },
      { q: 'How do Daily and Endless differ?', a: 'Daily gives everyone the same board for the UTC day and exactly five taps to score with. Endless has no tap limit, so you can keep chaining for as long as you like.' },
    ],
  },
  {
    slug: 'stackpot',
    game: 'stackpot',
    title: 'Play Stackpot Online — Free Push-Your-Luck Number Game',
    h1: 'Stackpot',
    metaDescription:
      'Play Stackpot free online — parallel forced-placement blackjack. Drop each dealt chip into one of four pots, hit the exact target to lock and bank, overshoot and you bust. No download, on mobile.',
    shortDescription: 'Land the pot exactly, or bust.',
    howToPlay: [
      'Four pots each have a target (15, 20, 25, 30). Each turn you are dealt one chip worth 1–9.',
      'You must place the chip into a pot, adding its value to that pot’s total.',
      'Hit a pot’s target exactly to LOCK it — bank the reward times your combo multiplier, then the lane returns with a bigger target.',
      'Overshoot a target and that pot busts, costing one of your three lives.',
    ],
    strategy: [
      'You cannot choose your chip, so spread risk: keep every pot able to accept a range of values.',
      'Consecutive locks build a multiplier, so avoid busts to keep greed compounding.',
      'Watch each pot’s gap to target — a pot at 22 of 25 busts on any chip of 4 or more.',
      'Use your one discard on a chip that would bust your safest lane.',
      'Sometimes take a small safe add over chasing an exact lock that a bad chip would ruin.',
    ],
    faq: [
      { q: 'Can I choose which number I get?', a: 'No — each chip is dealt at random and you must place it. The skill is triaging where a number you did not pick should go.' },
      { q: 'What ends a run?', a: 'Losing all three lives to busts. Your score is the total you have banked.' },
      { q: 'Can I get rid of a bad chip?', a: 'Sometimes. A toss discards the chip in your tray. You start with one and earn another for every five lanes you lock, so save them for chips that would otherwise force a bust.' },
    ],
  },
  {
    slug: 'flywheel',
    game: 'flywheel',
    title: 'Play Flywheel Online — Free One-Tap Rhythm Skill Game',
    h1: 'Flywheel',
    metaDescription:
      'Play Flywheel free online — a one-tap rhythm game where your own timing sets the tempo. Tap as the marker sweeps the strike zone; perfect taps speed the wheel up. How long can you keep control? No download.',
    shortDescription: 'Your timing sets the tempo.',
    howToPlay: [
      'A wheel spins with a marker on its rim and a strike zone at the top.',
      'Tap each time the marker sweeps through the zone.',
      'A perfect, dead-centre tap adds momentum — the wheel speeds up and the next beat comes sooner.',
      'Miss the zone entirely and you lose a life. Three misses end the run.',
    ],
    strategy: [
      'Aim for the centre of the zone, not just anywhere inside it — perfect taps drive your score up.',
      'The better you play, the faster it spins, so settle into the rhythm rather than rushing.',
      'When the wheel accelerates, tap slightly earlier to account for the tighter window.',
      'Do not panic after a good-but-not-perfect tap; hold your timing steady.',
      'Watch the marker, not the clock — let the wheel’s motion cue your taps.',
    ],
    faq: [
      { q: 'What makes Flywheel different?', a: 'Your timing accuracy sets the tempo: the wheel’s speed is your score, so playing well makes it faster and harder — you author your own difficulty.' },
      { q: 'How does a run end?', a: 'When you miss the strike zone three times. Your score is how fast (and how long) you kept the wheel spinning.' },
      { q: 'What counts as a perfect tap?', a: 'Tapping when the marker is dead-centre in the strike zone — a perfect tap adds the most momentum and speeds the wheel up the most.' },
    ],
  },
  {
    slug: 'ripple',
    game: 'ripple',
    title: 'Play Ripple Online — Free One-Tap Timing Arcade Game',
    h1: 'Ripple',
    metaDescription:
      'Play Ripple free online — a one-tap timing game. Tap the water to send an expanding ring that pops floating buoys as its crest sweeps through them. Aim in time, not space. No download.',
    shortDescription: 'Tap the water, pop with the wave.',
    howToPlay: [
      'Tap empty water to drop a stone — it sends out a ring that expands outward.',
      'A buoy pops the instant the ring’s edge sweeps across it, so aim where the wave will reach buoys in sequence.',
      'Up to three rings can expand at once; two crests hitting one buoy together score an interference combo.',
      'A rising swell drowns un-popped buoys over time — clear them before they sink.',
    ],
    strategy: [
      'You aim in time, not at a target: pick the spot whose growing ring will roll through a line of buoys.',
      'Drop near clusters so one ring sweeps several buoys for a big combo.',
      'Overlap two rings on the same buoy for interference bonuses.',
      'Keep a ring in reserve for buoys about to drown from the swell.',
      'Read the drift — buoys move slowly, so lead your ripples slightly.',
    ],
    faq: [
      { q: 'How do I pop a buoy?', a: 'Not by tapping it — you tap open water, and the expanding ring pops each buoy at the moment its edge sweeps across it.' },
      { q: 'What is an interference combo?', a: 'When two ring crests reach the same buoy on the same beat, you score a multiplier for the overlap.' },
      { q: 'How does a run end?', a: 'Periodic swells wash over the water: an un-popped buoy survives its first swell and drowns on the second, and five drowned buoys end the run. Up to three rings can expand at once, so keep stones in the water.' },
    ],
  },
  {
    slug: 'ticker',
    game: 'ticker',
    title: 'Play Ticker Online — Free All-In Momentum Market Game',
    h1: 'Ticker',
    metaDescription:
      'Play Ticker free online — an all-in momentum game. Read three assets’ momentum, go all-in on one (or cash out), and compound your worth over 20 rounds. Time the exit. No download, on mobile.',
    shortDescription: 'Ride the momentum, time your exit.',
    howToPlay: [
      'You start with a worth of 100. Three assets each show a momentum meter and a recent sparkline.',
      'Each round, go all-in on one asset — or pick CASH to sit out safely.',
      'Hot assets tend to pay off, but the longer one stays hot the higher its risk of a sharp snap down.',
      'Your worth compounds each round over about 20 rounds. Finish as high as you can.',
    ],
    strategy: [
      'The whole skill is timing the exit — ride a hot asset, then cash out before it snaps.',
      'Watch the tension on overheated assets; greed is a legible dare, not a blind gamble.',
      'Cold assets bottom out and rebound, so a beaten-down asset can be the next hot one.',
      'Small correct early reads compound into a huge finish, so protect your worth when unsure with CASH.',
      'Later rounds swing harder — take bigger, better-timed bets as the stakes rise.',
    ],
    faq: [
      { q: 'What is the goal in Ticker?', a: 'Grow your worth as high as possible over the run by going all-in on the right asset at the right time and cashing out before it snaps.' },
      { q: 'What does CASH do?', a: 'It sits the round out with a 0% return — a safe skip when no asset looks worth the risk.' },
      { q: 'How many rounds does a run last?', a: 'About 20 rounds — your worth compounds each round, so early reads matter less than staying alive and correct near the end.' },
    ],
  },
  {
    slug: 'overfold',
    game: 'overfold',
    title: 'Play Overfold Online — Free Paper-Folding Match Puzzle',
    h1: 'Overfold',
    metaDescription:
      'Play Overfold free online — an original folding puzzle. Fold the paper grid across a crease to overlap cells; matching colored pips seal and clear. Fold space itself. No download, on mobile.',
    shortDescription: 'Fold the paper, match the pips.',
    howToPlay: [
      'The paper grid holds colored pips, each colour in a matching pair.',
      'Tap a crease between two rows or columns to fold the smaller flap over the rest.',
      'Where a pip lands on a matching pip, both seal and score; several seals in one fold combo.',
      'Different colours colliding jam a cell permanently. The board is solved when no pips remain — sealed or jammed.',
    ],
    strategy: [
      'Every fold shrinks the paper permanently, so plan the order — the board only gets smaller.',
      'Line up matching pips to land on each other, and try to seal several in a single fold.',
      'Avoid folding different colours onto each other; a jam blocks that cell for good.',
      'Use Unfold sparingly to recover from a bad fold — you get only three per board.',
      'Every board is solvable within its par fold count; chase a cleaner solve each retry.',
    ],
    faq: [
      { q: 'How does folding work?', a: 'Tapping a crease folds the smaller flap over the rest, reflecting its cells onto the ones beneath so pips can meet, seal, or jam.' },
      { q: 'Is every board solvable?', a: 'Yes. Each board is generated by scrambling a solved layout with inverse folds, so there is always a way to seal every pip.' },
      { q: 'Can I undo a fold?', a: 'Yes, with Unfold (the button or the U key). It restores the board, fold count and score exactly, but you get only three per board and they are not refunded.' },
    ],
  },
  {
    slug: 'splice',
    game: 'splice',
    title: 'Play Splice Online — Free Graph-Cutting Puzzle Game',
    h1: 'Splice',
    metaDescription:
      'Play Splice free online — an original graph puzzle. Cut one edge per turn; any group that becomes a single colour collapses for big points and chains combos. Clear the network. No download.',
    shortDescription: 'Cut edges, collapse single-colour groups.',
    howToPlay: [
      'The board is a network of colored nodes joined by edges.',
      'Each turn, tap an edge to cut it.',
      'Any group that ends up a single colour collapses instantly for points — bigger groups score much more.',
      'A collapse can split the rest and trigger more collapses in the same turn. Clear the whole network in as few cuts as you can.',
    ],
    strategy: [
      'Scoring is by group size squared, so aim to make one big single-colour group collapse rather than many small ones.',
      'Look for a single cut that isolates a large same-colour cluster.',
      'Set up chains — one collapse can disconnect the board and cascade into more.',
      'Hover (or preview) shows the two groups an edge bridges; use it to plan.',
      'Fewer cuts means a better score, so hunt the minimum-cut line.',
    ],
    faq: [
      { q: 'How do I score in Splice?', a: 'When a connected group becomes a single colour it collapses for its size squared in points, and collapses can chain within one turn.' },
      { q: 'Is every board solvable?', a: 'Yes. Each board is generated with a guaranteed achievable par, so it can always be cleared.' },
      { q: 'Can I undo a cut?', a: 'In puzzle and daily modes you get five undos per board, and your cut budget is par plus three. Endless mode has no undo.' },
    ],
  },
  {
    slug: 'quarry',
    game: 'quarry',
    title: 'Play Quarry Online — Free Hunt-the-Hidden Deduction Game',
    h1: 'Quarry',
    metaDescription:
      'Play Quarry free online — a pursuit-deduction puzzle. Each probe reveals the distance to a hidden target and spooks it away. Track where it can be and catch it. No download, on mobile.',
    shortDescription: 'Probe, track, and catch the hidden target.',
    howToPlay: [
      'A quarry hides on one cell of the grid.',
      'Tap a cell to probe: it reveals how many steps (king moves) away the quarry is.',
      'Each probe also spooks the quarry one cell directly away from you — so probing near a wall pins it.',
      'Land a probe on the quarry (distance 0) to catch it, within your probe budget.',
    ],
    strategy: [
      'Reveal and movement are the same action: a reading of d means the quarry is now d + 1 from that probe, unless a wall pinned it.',
      'Choose probes that split the possible cells, not ones that chase or herd — a wall pin never narrows down where the quarry can be.',
      'Do not open in the centre; an edge cell next to a corner (5×5) or third along an edge (7×7) tells you far more.',
      'Combine readings from two different directions before committing to a guess.',
      'Fewer probes means a better score, so set up the capture in as few moves as you can.',
    ],
    faq: [
      { q: 'How is Quarry different from minesweeper?', a: 'There is no static mine map — a single hidden target actively flees on a known rule, so you herd it rather than read neighbour counts.' },
      { q: 'Does the target always move?', a: 'Not always. It hops one cell away from each probe, but it never leaves the board, so when a wall blocks its escape it stays put.' },
      { q: 'How big is the board?', a: 'Levels 1 and 2 are 5×5 with 8 probes; from level 3 on the board is 7×7 with 10 probes, and the run continues until you fail to catch the quarry within your budget.' },
    ],
  },
  {
    slug: 'latch',
    game: 'latch',
    title: 'Play Latch Online — Free One-Button Swinging Skill Game',
    h1: 'Latch',
    metaDescription:
      'Play Latch free online — a one-button momentum game. Hold to grab a peg and swing, release to fly off and catch the next. No steering, just timing. How far can you go? No download.',
    shortDescription: 'Swing, release, catch the next peg.',
    howToPlay: [
      'You swing from pegs on a tether — there is no steering, jumping, or thrust.',
      'Hold to latch the nearest reachable peg ahead; gravity swings you and builds speed.',
      'Release to fly off with your momentum and arc toward the next peg.',
      'Latch too early and you fall short; too late and you swing past. Chain as many pegs as you can.',
    ],
    strategy: [
      'Timing is everything — release at the bottom of a swing for the most forward momentum.',
      'Build speed on longer swings so you can clear wider peg gaps ahead.',
      'Read the next peg before you release so you arc to reach it.',
      'Grab the glints on the ideal arc to stack a combo multiplier.',
      'Stay loose as the pegs scroll faster; panic grabs end runs.',
    ],
    faq: [
      { q: 'How do I control Latch?', a: 'One button: hold to grab and swing, release to launch. You never steer directly — your path comes from timing and momentum.' },
      { q: 'How does a run end?', a: 'When you miss a peg and fall. Your score is how many pegs (and how far) you chained.' },
      { q: 'What do the glints do?', a: 'Flying through glints builds your combo: every two glints raise the score multiplier by one, up to ×5. Latch onto a peg without collecting a glint on that arc and the multiplier drops back to ×1.' },
    ],
  },
  {
    slug: 'decant',
    game: 'decant',
    title: 'Play Decant Online — Free Test Tube Color Sorting Puzzle',
    h1: 'Decant',
    metaDescription:
      'Play Decant free online — a test tube sorting puzzle where color is density. Pour the top band and watch it sink to its layer, merging and cascading. Daily puzzle plus easy, normal and hard. No download.',
    shortDescription: 'Pour colors; heavier ones sink.',
    howToPlay: [
      'Click a tube to pick it up, then click another to pour — click the same tube again to cancel.',
      'A pour lifts the whole top band (the lightest exposed color) and sinks it to its density layer in the target tube.',
      'Every tube stays sorted heaviest-at-the-bottom, so a poured band can slide under lighter ones and push them up.',
      'Sort every color into its own tube to win. You get five undos per board.',
    ],
    strategy: [
      'Colors are ranked by weight, not just hue — a heavy band sinks past lighter ones, which is how you dig colors out of the middle.',
      'Use the empty tubes as scratch space, but do not fill both or you lose your room to manoeuvre.',
      'Look for pours that merge two bands of the same color: fewer bands means fewer moves.',
      'Set up cascades — one pour that displaces a band into its own merge chains bonus points.',
      'Beat par to earn the completion bonus, and undo early rather than pouring your way deeper into a deadlock.',
    ],
    faq: [
      { q: 'How is Decant different from other water sorting games?', a: 'Color is density. A poured band does not just stack on top — it sinks to its own layer and pushes lighter bands up, so tubes reorder themselves as you play.' },
      { q: 'What is the daily puzzle?', a: 'Everyone gets the same board each day. Solve it on consecutive days to build a streak, which is saved in your browser.' },
      { q: 'What happens if I get stuck?', a: 'If no legal pour remains, the game tells you — use Undo to step back, or start a new board.' },
    ],
  },
  {
    slug: 'backspace',
    game: 'backspace',
    title: 'Play Backspace Online — Free Endless Dodger With Time Rewind',
    h1: 'Backspace',
    metaDescription:
      'Play Backspace free online — a five-lane endless dodger where you hold Space to rewind the whole world and re-pick your lane. Crashing is survivable while the meter holds. No download, no sign-up.',
    shortDescription: 'Dodge, or rewind time and retry.',
    howToPlay: [
      'Use the arrow keys or A and D — or tap either side of the board — to switch between five lanes.',
      'Blocks scroll toward your marker; thread the gaps to survive and score.',
      'Hold Space (or the BACKSPACE button) to scrub the world backward — obstacles retreat and you rewind to an earlier instant.',
      'Release to resume from that moment and pick a different lane. The rewind meter drains as you scrub, and a crash only ends the run when it is empty.',
    ],
    strategy: [
      'Rewind is a resource, not a free undo — spent meter is never refunded, so save it for gaps you genuinely cannot read.',
      'Scrub back just far enough to reach the fork you needed, then release. Over-rewinding burns meter and distance.',
      'Surviving without rewinding builds your clutch multiplier, so clean stretches are worth far more than scrappy ones.',
      'Commit to a lane early. Late lane changes at high speed are what fill the block wall in front of you.',
      'The world speeds up with distance — start planning two rows ahead before you need to.',
    ],
    faq: [
      { q: 'How does rewinding work?', a: 'Hold Space and the entire world runs backward — obstacles retreat and your distance unwinds. Release and play resumes forward from that earlier instant, so you can take a different lane.' },
      { q: 'Does a crash end my run?', a: 'Only when the rewind meter is empty. Otherwise a safety net rewinds you automatically so you can fork to a different lane.' },
      { q: 'What is the clutch multiplier?', a: 'It grows while you survive without rewinding and boosts your score. It resets when you scrub back.' },
    ],
  },
  {
    slug: 'duplex',
    game: 'duplex',
    title: 'Play Duplex Online — Free Mirror Puzzle With Two Linked Tokens',
    h1: 'Duplex',
    metaDescription:
      'Play Duplex free online — one input moves two mirrored tokens at once. Use walls to break the symmetry and land both on their goals. 17 levels across five mirror axes, plus a daily puzzle. No download.',
    shortDescription: 'One move, two mirrored tokens.',
    howToPlay: [
      'Press an arrow key (or WASD, or swipe) and both tokens move at once — You in blue, Echo in amber.',
      'Echo moves along the level’s mirror axis, so it may travel the opposite way, or at right angles.',
      'A token blocked by a wall or edge stands still while its twin keeps going — that is how you break the symmetry lock.',
      'Collect the pellets and land both tokens on their goals to clear the level.',
    ],
    strategy: [
      'Walls are the tool, not the obstacle. Park one token against a wall so a shared press moves only the other.',
      'Work backwards from the goals — figure out the final press, then what has to be true before it.',
      'Watch the move counter: match par to earn three stars, so hunt the shortest path rather than any path.',
      'On diagonal axes, think in terms of which press separates the tokens rather than which press advances one.',
      'If you are stuck, reset and replan. The levels are built around one clean idea, not long grinds.',
    ],
    faq: [
      { q: 'How do the two tokens move?', a: 'One press drives both. You steps the direction you pressed; Echo steps the direction the level’s mirror axis dictates — horizontal, vertical, point, diagonal or anti-diagonal.' },
      { q: 'How many levels are there?', a: '17 hand-built levels across five mirror axes, each introducing a new way the reflection behaves — plus a fresh daily puzzle.' },
      { q: 'How do I get three stars?', a: 'Clear the level in par moves or fewer. Par is the shortest possible solution, so three stars means you found the optimal path.' },
    ],
  },
  {
    slug: 'overdub',
    game: 'overdub',
    title: 'Play Overdub Online — Free Rhythm Loop Game',
    h1: 'Overdub',
    metaDescription:
      'Play Overdub free online — tap to stamp notes onto a 16-step loop as the playhead circles. Notes are permanent, so your own past becomes the obstacle. Land beside them to double your score. No download.',
    shortDescription: 'Stamp the loop; dodge your own past.',
    howToPlay: [
      'A playhead circles a 16-step loop. Tap anywhere (or press Space) to stamp a note wherever the head is right now.',
      'Notes are permanent. Tap a step that already holds one and the run ends.',
      'Stamping next to an existing note doubles your points — beside two of them, quadruples.',
      'Fill all 16 steps to clear the loop for a big bonus. The loop then comes back faster, forever.',
    ],
    strategy: [
      'The board fills with your own decisions, so early notes decide how hard the late game is.',
      'Chase adjacency — a note stamped beside another is worth far more than an isolated one, and consecutive multiplied stamps build a chain bonus.',
      'Leave yourself an escape lane. Ringing the loop with notes early means nowhere safe to land later.',
      'You are never forced to tap. Idling never kills you and never scores, so wait for the head to reach the step you actually want.',
      'Every clear speeds the loop up permanently, so bank the chain bonuses while the head is still slow.',
    ],
    faq: [
      { q: 'How do I aim a note at a specific step?', a: 'You do not — you time it. The whole board is one button and the note lands wherever the playhead is, which is what makes it a rhythm game rather than a targeting game.' },
      { q: 'How does a run end?', a: 'Only by stamping a step that already has a note. Waiting never kills you, so every loss comes from your own last tap.' },
      { q: 'What happens when the loop fills up?', a: 'It clears for a bonus, a fresh set of blocked steps appears, and the playhead gets permanently faster.' },
    ],
  },
  {
    slug: 'pinwheel',
    game: 'pinwheel',
    title: 'Play Pinwheel Online — Free Rotation Puzzle Game',
    h1: 'Pinwheel',
    metaDescription:
      'Play Pinwheel free online — pin any square and spin the whole board 90° around it. Dots that land on their anchors lock forever. You never move a piece directly. No download, no sign-up.',
    shortDescription: 'Pin a square, spin the whole board.',
    howToPlay: [
      'Tap any square to plant your pin, then spin the entire constellation of dots 90° around it.',
      'You never move a dot on its own — every dot turns together, as one rigid piece.',
      'A dot that lands on an empty anchor pins there permanently and stops rotating with the rest.',
      'Pin every dot to win. If any dot would land off the board or on a pinned one, the board shatters.',
    ],
    strategy: [
      'The pin is the only thing you choose. Move it, and the same board turns a completely different way.',
      'Locking a dot is the only way to break the constellation apart — that is your one lever, so plan which dot to shed next.',
      'Preview both directions before committing. The counter-clockwise and clockwise results are rarely mirror images once anchors are involved.',
      'Beating par pays a bonus with no ceiling, so once you can win, hunt for a shorter route.',
      'Pinned dots become walls. Shed them in an order that keeps the rest of the constellation clear of them.',
    ],
    faq: [
      { q: 'Can I move a single dot?', a: 'No. Every dot rotates together around your pin. Landing dots on anchors is the only way to separate them.' },
      { q: 'Why did my board shatter?', a: 'A spin sent at least one dot off the grid or onto an already-pinned dot. Preview the spin before committing, or undo.' },
      { q: 'What is par?', a: 'The shortest possible solution for that board. It is proven by construction, not guessed, and beating it pays an uncapped bonus.' },
    ],
  },
  {
    slug: 'cleave',
    game: 'cleave',
    title: 'Play Cleave Online — Free I-Cut-You-Choose Strategy Game',
    h1: 'Cleave',
    metaDescription:
      'Play Cleave free online — split the loot into two piles and your rival takes the one it wants. Whatever is left is your score. One item is always sealed. No download, no sign-up.',
    shortDescription: 'You cut, your rival chooses.',
    howToPlay: [
      'Each round you split the loot into two piles by tapping items to move them across.',
      'Your rival then takes one pile by a rule you can see, and the pile it leaves behind is your score.',
      'The rival wants magenta; you score cyan. So the split, not the grab, is the whole game.',
      'One item each round is sealed — you only see the range its value falls in, never the number.',
    ],
    strategy: [
      'You are not trying to build the best pile. You are trying to make the pile your rival wants be the one you want least.',
      'The rival rule is published, so every round has a guaranteed floor you can reach without luck. Losing is always a misread, never a bad roll.',
      'Treat the sealed item as its worst case when it matters. Plan around the range, not the number you hope it is.',
      'Balance the magenta so the rival is nearly indifferent, then load your cyan into the pile it will not take.',
      'Miss the quota and you burn a life, so take the safe split when your lives are low.',
    ],
    faq: [
      { q: 'How does the rival choose?', a: 'By a rule shown to you: it takes the pile with more magenta, breaking ties on cyan and then on the second pile. It never sees the sealed value either.' },
      { q: 'Is this luck?', a: 'No. Every round has a floor you can guarantee using only the visible ranges, so a loss always traces back to your own split.' },
      { q: 'What is the sealed item?', a: 'One item per round shows only a range instead of its value. It shapes the risk without ever making the round unwinnable.' },
    ],
  },
  {
    slug: 'umbra',
    game: 'umbra',
    title: 'Play Umbra Online — Free Timing Game in the Dark',
    h1: 'Umbra',
    metaDescription:
      'Play Umbra free online — a marble vanishes into a tunnel and never reappears. Read its speed at the entrance, then tap the exact moment it reaches the far end. No download, no sign-up.',
    shortDescription: 'Tap the moment it arrives — while blind.',
    howToPlay: [
      'A marble starts at the left edge and rolls at a constant speed toward a dark tunnel.',
      'You can see it only before it enters the dark. After that it is gone until it exits.',
      'Tap its lane the instant it reaches the marker on the far right. Keys 1, 2, 3 hit lanes 1 to 3.',
      'Perfect taps score most, close ones score less, and a tap outside the window costs a life.',
    ],
    strategy: [
      'Watch the marble in the lit stretch and read its speed there. Every marble holds that speed to the end, so the arrival time is fully determined the moment it enters the dark.',
      'Count in your head rather than guessing. The marble never reappears, so a last-second glance is not coming to save you.',
      'Faster marbles are worth more points, so they reward the read rather than punish it.',
      'Perfect taps build a combo, and multiple marbles in flight multiply the whole thing. Chase both once you can hold a rhythm.',
      'As you level up, the lit entrance shrinks from wide to a sliver. The read gets harder, not the timing window.',
    ],
    faq: [
      { q: 'Does the marble ever reappear?', a: 'No. Once it enters the dark it stays hidden through the exit and beyond. That is the whole game — you are timing something you cannot see.' },
      { q: 'Is this reaction speed?', a: 'No. It is extrapolation. You read the speed early and predict the arrival, so there is nothing to react to at the moment you tap.' },
      { q: 'Can I just spam taps?', a: 'No. A tap outside the window on a lane holding a marble costs a life, so spamming is self-defeating.' },
    ],
  },
  {
    slug: 'fuse',
    game: 'fuse',
    title: 'Play Fuse Online — Free Scheduling Puzzle Game',
    h1: 'Fuse',
    metaDescription:
      'Play Fuse free online — several fuses burn at once but you have only one hand, and moving costs real time. The order you visit them is the whole puzzle. No download, no sign-up.',
    shortDescription: 'One hand, many burning fuses.',
    howToPlay: [
      'Fuses light up across a 5x5 grid and burn down on their own clocks.',
      'Tap a cell to send your hand there. Your hand moves at a fixed speed, so distance costs time.',
      'Reaching a lit fuse in time defuses it. Let one burn out and it explodes, costing a life.',
      'Every cell tells you whether your hand can still reach it in time, so the information is never hidden.',
    ],
    strategy: [
      'This is a routing problem, not a reflex test. Ask which order lets you reach the most fuses, not which fuse is scariest.',
      'The board marks fuses you can no longer save. Abandon them early and spend those ticks on ones you can still reach.',
      'Move toward where the next fuse is likely to appear while you wait. An empty-cell move is often the strongest one.',
      'Defusing without a loss builds a chain that raises the value of every save, so a clean streak is worth more than a frantic one.',
      'Nothing rewards waiting next to a fuse — there is no last-second bonus. Arrive, defuse, leave.',
    ],
    faq: [
      { q: 'Is this a reaction game?', a: 'No. Your hand moves at a set speed and every deadline is shown, so it rewards planning the route rather than fast fingers.' },
      { q: 'Why can I not save every fuse?', a: 'Sometimes you genuinely cannot. The board tells you which ones are already lost so you can stop spending time on them.' },
      { q: 'Can I farm the chain bonus?', a: 'No. The chain only grows when you save fuses, and stalling makes them explode, which resets it.' },
    ],
  },
  {
    slug: 'polytap',
    game: 'polytap',
    title: 'Play Polytap Online — Free Polyrhythm Rhythm Game',
    h1: 'Polytap',
    metaDescription:
      'Play Polytap free online — F every 3 beats, J every 4. Keep two clocks running at once and hit both together when they collide. No download, no sign-up.',
    shortDescription: 'Two clocks, one pair of hands.',
    howToPlay: [
      'Press F on its own beat and J on its own beat. The two run on different cycles.',
      'Because the cycles differ, they drift apart and then collide on a shared beat.',
      'On a collision beat, press both keys together. Hit them close enough and you lock it.',
      'You can also tap the two pads instead of the keys, so it plays on a phone.',
    ],
    strategy: [
      'Do not count both clocks at once. Hold one as a steady pulse and let the other ride against it.',
      'The timing window never shrinks. What grows is interference between the clocks, so the difficulty is mental, not mechanical.',
      'The collision beat is the payoff and it pays more each time you clear one. Learn to feel it coming instead of reading it.',
      'Locking both keys within a couple of ticks pays a bonus, so aim for together rather than merely both.',
      'Missing a collision ends the run outright, no matter how many lives you hold. Everything else only costs a life.',
    ],
    faq: [
      { q: 'What is a polyrhythm?', a: 'Two rhythms of different lengths running at the same time — here one key every 3 beats against another every 4. They line up only now and then, and those moments are the game.' },
      { q: 'Do I need musical training?', a: 'No. The first cycle is a warm-up that does not count against you, and the window stays the same width for the whole run.' },
      { q: 'Why did my run end at full lives?', a: 'Missing a collision beat is an instant loss. It is the one thing lives do not cover.' },
    ],
  },
  {
    slug: 'deepdive',
    game: 'deepdive',
    title: 'Play Deepdive Online — Free Push-Your-Luck Diving Game',
    h1: 'Deepdive',
    metaDescription:
      'Play Deepdive free online — dive a vertical shaft grabbing richer treasure the deeper you go, but every step down is a breath you need to climb back. Run out of air before the surface and you lose it all. No download, no sign-up.',
    shortDescription: 'Dive deep, but save the breath to climb back.',
    howToPlay: [
      'Tap an adjacent cell to move there (or use the arrow keys / WASD on desktop). Each step costs air.',
      'The deeper you go, the more valuable the treasure — but you spend air getting there.',
      'You only bank treasure when you climb back to the surface. Reach it before your air runs out.',
      'Run out of air below the surface and you drown, losing everything you were carrying.',
    ],
    strategy: [
      'Air is a single tank that only ever goes down. Every step deeper is a step you must pay for again on the way up.',
      'Bank early and often. Unbanked treasure is worth nothing until it touches the surface.',
      'Before you take a tempting step down, count whether you can still afford the climb home.',
      'A greedy run that drowns scores zero for that dive. A modest run you actually surface scores real points.',
      'Grab 60 or more in one dive for a jackpot, but only if you can make it back.',
    ],
    faq: [
      { q: 'What happens if I run out of air?', a: 'If you cannot move to any affordable cell below the surface, you drown and lose all the treasure you were carrying. Your banked score stays.' },
      { q: 'When do I actually score?', a: 'Only when you reach the surface. Treasure you are carrying banks the moment you touch the top row.' },
      { q: 'Does air refill?', a: 'No. Air is one tank for the whole dive and only decreases. Plan the whole round-trip around it.' },
    ],
  },
  {
    slug: 'sonar',
    game: 'sonar',
    title: 'Play Sonar Online — Free Deduction Puzzle Game',
    h1: 'Sonar',
    metaDescription:
      'Play Sonar free online — hidden targets lurk in a dark sea. Ping any cell and it returns just one number: the distance to the nearest target. Triangulate their positions in as few pings as you can. No download, no sign-up.',
    shortDescription: 'One ping, one number. Triangulate the hidden targets.',
    howToPlay: [
      'Ping any cell (Enter or click) and it returns a single number: the distance to the nearest hidden target.',
      'That ping also clears every cell within that distance as proven empty.',
      'Where the distance rings from different pings intersect, a target must sit.',
      'Mark a cell you are sure of to capture it with no ping — deduction is worth more than brute pinging.',
    ],
    strategy: [
      'A ping tells you the nearest target, not all of them. Read what its cleared area rules out, not just the number.',
      'Two or three pings from spread-out cells pin a target down faster than pinging next to it.',
      'Marking a correct cell pays more than a lucky direct hit — the game rewards knowing over guessing.',
      'You get three wrong marks before it is over, so only mark when the rings leave one answer.',
      'Fewer pings means a bigger par bonus at the finish. Solve it clean, not just solve it.',
    ],
    faq: [
      { q: 'Does the ping tell me every target?', a: 'No. It returns only the distance to the nearest still-hidden target, and clears that radius as empty. The rest you deduce.' },
      { q: 'Why mark instead of ping?', a: 'A correct mark scores more than a direct-hit ping, because deduction is the point. But a wrong mark costs a life.' },
      { q: 'How do I lose?', a: 'Three wrong marks ends the run. Only mark a cell when the distance rings leave no other option.' },
    ],
  },
  {
    slug: 'handful',
    game: 'handful',
    title: 'Play Handful Online — Free Push-Your-Luck Grab Game',
    h1: 'Handful',
    metaDescription:
      'Play Handful free online — you can see everything left in the basket, but not the order. Choose how big a handful to grab, then grab blind. Bigger handfuls score more, but one rotten item spoils the whole grab. No download, no sign-up.',
    shortDescription: 'Decide how big to grab, then grab blind.',
    howToPlay: [
      'The basket shows exactly how many good and rotten items are left — only the order is hidden.',
      'Each turn, tap the on-screen +/- to size your handful (or use the up/right and down/left keys on desktop), then tap GRAB.',
      'Grab a clean handful and you score more the bigger it was, and clean streaks build a combo.',
      'Grab even one rotten item and the whole handful scores nothing and your combo resets.',
    ],
    strategy: [
      'Everything is visible, so the odds are exact, not a guess. Weigh the rotten-to-good ratio before each grab.',
      'Bigger handfuls score more but are more likely to catch a rotten one. Size the grab to the current odds.',
      'A clean streak multiplies your score, so protect a good combo with a smaller safe grab when rotten items are dense.',
      'Late in the basket the ratio swings hard — sometimes one careful small grab beats a greedy big one.',
      'There is no losing, only the score you leave with, so every grab is a pure risk-reward call.',
    ],
    faq: [
      { q: 'Can I see what I am grabbing?', a: 'You see the whole basket contents — how many good and rotten remain — but not the order, so each grab is a calculated risk, not blind luck.' },
      { q: 'What does one rotten item do?', a: 'It spoils the entire handful: that grab scores nothing and your clean-streak combo resets to zero.' },
      { q: 'Can I lose?', a: 'No. There is no fail state — the basket empties and you keep your score. It is all about how much you dare to grab.' },
    ],
  },
  {
    slug: 'flapjack',
    game: 'flapjack',
    title: 'Play Flapjack Online — Free Pancake Sorting Puzzle',
    h1: 'Flapjack',
    metaDescription:
      'Play Flapjack free online — a messy stack of different-sized pancakes. Slide the spatula in anywhere and flip everything above it. Sort them big-to-small in as few flips as you can. No download, no sign-up.',
    shortDescription: 'Flip the top of the stack to sort the pancakes.',
    howToPlay: [
      'The pancakes are stacked in a jumbled order of sizes.',
      'Tap a pancake to slide the spatula under it and flip the whole stack above it upside down.',
      'Keep flipping until the stack is sorted, largest on the bottom to smallest on top.',
      'Every flip counts — the fewer you use, the better your score.',
    ],
    strategy: [
      'Work from the bottom up: get the biggest pancake to the bottom first, then the next, and so on.',
      'To place the biggest pancake, flip it to the top, then flip the whole stack so it drops to the bottom.',
      'Each pancake usually takes at most two flips to lock in place, so plan the pair before you touch anything.',
      'The par is a greedy benchmark. Beating it means you found a shorter route, not just a lucky one.',
      'Undo is there for planning, so try a flip in your head before you commit.',
    ],
    faq: [
      { q: 'What exactly does a flip do?', a: 'It reverses the order of every pancake above where you insert the spatula, like flipping that whole chunk of the stack over at once.' },
      { q: 'Can I lose?', a: 'No. There is no fail state — you just keep flipping until it is sorted. The challenge is doing it in few flips.' },
      { q: 'Is this the pancake sorting problem?', a: 'Yes. It is the classic prefix-reversal puzzle: sort the stack using only flips of the top portion.' },
    ],
  },
  {
    slug: 'interlock',
    game: 'interlock',
    title: 'Play Interlock Online — Free Ring Rotation Puzzle',
    h1: 'Interlock',
    metaDescription:
      'Play Interlock free online — two bead rings mesh at two shared points. Rotate the left or right ring one step at a time to sort the scrambled colored beads back to their home arcs. No download, no sign-up.',
    shortDescription: 'Rotate two meshed rings to sort the beads home.',
    howToPlay: [
      'Two rings of colored beads overlap and share two crossing beads.',
      'Rotate the left ring or the right ring one step at a time.',
      'Turning a ring carries the shared beads into the other ring, so every move mixes both.',
      'Return every bead to its own colored home arc to solve it.',
    ],
    strategy: [
      'The two shared crossing points are the only way beads move between rings — everything routes through them.',
      'Line up a bead at a crossing point, then rotate the other ring to carry it where it belongs.',
      'Solving one ring can disturb the other, so work the two together rather than finishing one alone.',
      'Fewer moves scores higher, so undo and re-plan when a sequence turns out longer than expected.',
      'Think a few rotations ahead — like a round version of a sliding puzzle.',
    ],
    faq: [
      { q: 'How do beads move between the rings?', a: 'Only through the two shared crossing beads. Rotating one ring shifts those shared beads into the other ring, which is what lets you sort them.' },
      { q: 'Is this like a Rubik style puzzle?', a: 'It shares DNA with Hungarian Rings — two interlocked loops you rotate to sort. It is pure logic, no luck.' },
      { q: 'Can I undo a rotation?', a: 'Yes. Undo lets you back out of a line that is not working, though a solved-in-fewer-moves run scores best.' },
    ],
  },
  {
    slug: 'clusters',
    game: 'clusters',
    title: 'Play Clusters Online — Free Daily Word Grouping Puzzle',
    h1: 'Clusters',
    metaDescription:
      'Play Clusters free online — a daily word grouping puzzle. Sixteen tiles hide four secret groups of four. Find every group before your fourth mistake, then share your spoiler-free grid. New puzzle every day, no download, no sign-up.',
    shortDescription: 'Sort 16 tiles into their four hidden groups.',
    howToPlay: [
      'Sixteen tiles hide four secret groups of four — by category, theme, or connection.',
      'Tap four tiles you think share a group, then press Submit.',
      'A correct guess locks that group in as a colored row; a wrong guess costs one of your four lives.',
      'Find all four groups before you run out of lives to win the day.',
    ],
    strategy: [
      'Start with the group you are surest of — locking it in removes four tiles and clears the clutter.',
      'Each puzzle has exactly one group per difficulty tier, from yellow (easiest) to purple (trickiest) — expect the purple group to be the least obvious.',
      'If a guess is "one away", three of your four belong together — swap the odd one out instead of starting over.',
      'Do not spend a life on a hunch. Shuffle rotates the tiles to a new arrangement (neighbours stay neighbours), so look for groups across the whole grid rather than relying on it.',
      'The fewer mistakes you make, the higher your grade — a flawless solve is worth the patience.',
    ],
    faq: [
      { q: 'Is there a new puzzle every day?', a: 'Yes. Clusters is a daily puzzle — the same 16 tiles for everyone that day, generated from the UTC date so no server is needed. Practice mode deals a new random board any time, drawn from the same fixed bank of groups, so you will see familiar groups come back.' },
      { q: 'How many mistakes can I make?', a: 'Four. Each wrong group of four costs one life; run out and the puzzle ends. Solve all four groups first to win.' },
      { q: 'What does "one away" mean?', a: 'Your guess had three tiles from a single group and one that belongs elsewhere. Keep the three, swap the fourth.' },
      { q: 'Can I share my result without spoilers?', a: 'Yes. The share card is a colored emoji grid of your guesses — it shows how you did without revealing the answers, just like the daily word games.' },
    ],
  },
  {
    slug: 'quadle',
    game: 'quadle',
    title: 'Play Quadle Online — Free Daily 4-Word Puzzle',
    h1: 'Quadle',
    metaDescription:
      'Play Quadle free online — solve four hidden 5-letter words at once. Every guess is scored against all four boards. You get nine guesses; crack all four to win, then share your spoiler-free grid. New puzzle daily, no download, no sign-up.',
    shortDescription: 'Guess four hidden words at once in nine tries.',
    howToPlay: [
      'Four hidden five-letter words fill four boards shown at the same time.',
      'Type any real five-letter word and it is guessed on all four boards at once.',
      'Green means right letter, right spot; yellow means right letter, wrong spot; grey means not in that word.',
      'You have nine guesses total — solve all four boards before they run out to win.',
    ],
    strategy: [
      'Open with words full of common letters to light up all four boards fast.',
      'A letter can be green on one board and grey on another — read each board on its own.',
      'Once a board is nearly solved, finish it quickly to stop it eating your limited guesses.',
      'Save a guess for a board that is still wide open rather than confirming one you already know.',
      'Nine guesses for four words is tight — every guess should gather clues on more than one board.',
    ],
    faq: [
      { q: 'How is Quadle different from a normal word game?', a: 'You solve four words at once, not one. Each guess is scored against all four boards, so you juggle four puzzles with a shared, limited pool of nine guesses.' },
      { q: 'Is there a new puzzle every day?', a: 'Yes. Quadle is a daily puzzle — the same four words for everyone that day, generated from the date so no server is needed. Practice mode gives endless fresh puzzles any time.' },
      { q: 'How many guesses do I get?', a: 'Nine. That is six as in a single word game plus one for each extra board. Solve all four boards within nine guesses to win.' },
      { q: 'Do invalid words cost a guess?', a: 'No. A word that is not in the dictionary is rejected and does not use up one of your nine guesses.' },
      { q: 'Can I share my result without spoilers?', a: 'Yes. The share card shows which guess solved each board in a small grid — no letters revealed, just like the daily word games.' },
    ],
  },
  {
    slug: 'equate',
    game: 'equate',
    title: 'Play Equate Online — Free Daily Math Equation Puzzle',
    h1: 'Equate',
    metaDescription:
      'Play Equate free online — a daily math puzzle. Guess the hidden eight-character equation in six tries, with color clues after every guess. New puzzle every day, no download, no sign-up.',
    shortDescription: 'Guess the hidden equation in six tries.',
    howToPlay: [
      'A hidden eight-character equation uses digits and the signs + - * / =.',
      'Type any valid equation — the left side must truly equal the right — and submit it.',
      'Green means right symbol, right spot; purple means right symbol, wrong spot; grey means not in the equation.',
      'Crack the equation within six guesses to win the day.',
    ],
    strategy: [
      'Open with a guess that uses several different digits and two operators to test a lot at once.',
      'The equals sign is always there — once you find its column, the rest falls into place faster.',
      'Remember standard math order: multiply and divide happen before add and subtract.',
      'A purple digit is in the equation but somewhere else — slide it to a new column next guess.',
      'Fewer guesses score higher, so use your color clues before spending another try.',
    ],
    faq: [
      { q: 'What counts as a valid guess?', a: 'Any eight-character equation where the left side genuinely equals the right, using digits and + - * / and exactly one =. Invalid math is rejected and does not cost a guess.' },
      { q: 'Does order of operations matter?', a: 'Yes. Multiplication and division are applied before addition and subtraction, and division must come out to a whole number.' },
      { q: 'Is there a new puzzle every day?', a: 'Yes. Equate is a daily puzzle — the same equation for everyone that day, generated from the date so no server is needed. Practice mode gives endless puzzles any time.' },
      { q: 'Can I share my result without spoilers?', a: 'Yes. The share card is a grid of colored squares showing how you did, with no numbers revealed — just like the daily word games.' },
    ],
  },
  {
    slug: 'reactor',
    game: 'reactor',
    title: 'Play Reactor Online — Free Neon Idle Clicker Game',
    h1: 'Reactor',
    metaDescription:
      'Play Reactor free online — a neon idle clicker. Tap to charge, buy generators that produce energy automatically, and keep earning while you are away. Prestige to reboot for a permanent multiplier. No download, no sign-up.',
    shortDescription: 'Tap and automate a neon reactor that never stops.',
    howToPlay: [
      'Tap the reactor core to add charge by hand.',
      'Spend charge on modules — each one produces energy automatically, every second.',
      'Your reactor keeps earning while the tab is closed; come back for a welcome-back payout.',
      'When your lifetime energy is high enough, Reboot to reset for a permanent production boost.',
    ],
    strategy: [
      'Early on, tap to afford your first Capacitor, then let auto-production snowball.',
      'Buy by payback, not price: pick the module with the lowest cost ÷ output — it reaches Reboot about twice as fast as cheapest-first.',
      'Check back after a break: offline earnings often buy the next tier outright.',
      'Reboot resets your modules but multiplies all future output, so time it when growth stalls.',
      'Each reboot adds +10% production (linear) and +1 tap power; the next one needs another 1M lifetime energy.',
    ],
    faq: [
      { q: 'Do I have to keep tapping?', a: 'No. Tapping only bootstraps your first modules. After that the reactor produces energy automatically, even while the tab is closed.' },
      { q: 'Does it really earn while I am away?', a: 'Yes. Offline progress is capped at eight hours, and you get a welcome-back summary of what your reactor made while you were gone.' },
      { q: 'What does Reboot (prestige) do?', a: 'It resets your charge and modules but keeps your lifetime energy, adds +10% to all production per reboot and +1 tap power. The first reboot unlocks at 1M lifetime energy, and each later one needs another 1M.' },
      { q: 'Is my progress saved?', a: 'Yes, in your browser. Your reactor, modules and reboots are stored locally, and your best lifetime energy can go on the weekly leaderboard.' },
    ],
  },
  {
    slug: 'solitaire',
    game: 'solitaire',
    title: 'Play Solitaire Online — Free Klondike Card Game, No Download',
    h1: 'Solitaire',
    metaDescription:
      'Play Solitaire free online — the classic Klondike card game, draw three. Move cards to the foundations and clear the board. No download, no sign-up, works on desktop and mobile.',
    shortDescription: 'The classic Klondike solitaire card game.',
    howToPlay: [
      'Build the four foundations up by suit, from Ace to King, to win.',
      'On the tableau, stack cards down in alternating colours — a red six goes on a black seven.',
      'Move a face-up run of cards together; an empty column can only start with a King.',
      'Tap the stock to deal three cards to the waste, and recycle it when the stock runs out.',
    ],
    strategy: [
      'Turn over face-down tableau cards as early as you can — hidden cards are your biggest obstacle.',
      'Do not rush every Ace and low card to the foundation; you may still need them to move cards around.',
      'Try to empty a column so you have a free spot for a King and the run beneath it.',
      'Play cards from the stock deliberately — you can cycle it, but each pass changes which cards line up.',
      'Use undo to explore a line, and finish quickly once the board is all face-up for a higher score.',
    ],
    faq: [
      { q: 'Is this draw one or draw three?', a: 'Draw three — the stock deals three cards to the waste at a time, the classic desktop solitaire default. You can recycle the stock as many times as you like.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a card to pick up its run and tap where to drop it, or double-tap to send a card to a foundation. It works on phones and tablets as well as desktop.' },
      { q: 'Can I undo a move?', a: 'Yes. Undo steps back through your moves, so you can back out of a line that is not working.' },
      { q: 'Is every deal winnable?', a: 'Not every Klondike deal is solvable — that is part of the classic game. Start a new deal any time, and use auto-finish once the board is all face-up.' },
    ],
  },
  {
    slug: 'freecell',
    game: 'freecell',
    title: 'Play FreeCell Online — Free Solitaire Card Game, No Download',
    h1: 'FreeCell',
    metaDescription:
      'Play FreeCell free online — the classic open solitaire where every card is face-up and almost every deal can be won with skill. Four free cells, no download, no sign-up.',
    shortDescription: 'Open solitaire — nearly every deal is winnable.',
    howToPlay: [
      'Every card is dealt face-up across eight columns — no hidden cards, so it is all skill.',
      'Build the four foundations up by suit from Ace to King to win.',
      'Columns build down in alternating colours; use the four free cells to park a card you need to move.',
      'Move a run of cards at once when you have enough free cells and empty columns to do it.',
    ],
    strategy: [
      'Because nothing is hidden, plan several moves ahead before you commit — almost every deal is winnable.',
      'Keep free cells empty when you can; each free card doubles how big a run you can move.',
      'Emptying a whole column is powerful — it lets you move even longer sequences.',
      'Get the low cards to the foundations early, but keep a few mid cards back to shuffle runs around.',
      'Use undo freely to test a line; a solve in fewer moves scores higher.',
    ],
    faq: [
      { q: 'How is FreeCell different from Klondike solitaire?', a: 'Every card is face-up from the start and there is no stock pile — you win through planning, not luck. Four free cells let you temporarily hold cards while you rearrange the columns.' },
      { q: 'Can every FreeCell game be won?', a: 'Almost all deals are solvable with the right moves — that is the appeal. A tiny fraction are not, but the vast majority come down to skill.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a card to pick up its run and tap where to drop it, or double-tap to send a card home. It works on phones and tablets as well as desktop.' },
      { q: 'What is a free cell?', a: 'One of four single-card slots where you can park a card to get it out of the way. The more free cells and empty columns you have, the more cards you can move in one go.' },
    ],
  },
  {
    slug: 'spider',
    game: 'spider',
    title: 'Play Spider Solitaire Online — Free, 1 2 & 4 Suit',
    h1: 'Spider Solitaire',
    metaDescription:
      'Play Spider Solitaire free online — one, two or four suits. Build runs down and clear eight suit sequences from King to Ace. No download, no sign-up, in your browser.',
    shortDescription: 'Build eight King-to-Ace runs to clear the board.',
    howToPlay: [
      'Build cards down in order on the ten columns — any suit can sit on the next rank up.',
      'A group of cards only moves together if they are the same suit in order.',
      'Complete a full King-to-Ace run of one suit and it is cleared from the board.',
      'When you are stuck, deal a new row from the stock — but only when no column is empty.',
    ],
    strategy: [
      'Start on 1-suit to learn the flow, then step up to 2 and 4 suits for a real challenge.',
      'Uncover face-down cards early and try to keep one column empty as a workspace.',
      'Build same-suit runs whenever you can — mixed-suit stacks cannot move as a group.',
      'Do not deal from the stock too soon; clear what you can first, since a deal fills every column.',
      'Clearing a full suit run opens up huge room to manoeuvre, so aim for the first one fast.',
    ],
    faq: [
      { q: 'What is the difference between 1, 2 and 4 suit?', a: 'The number of suits sets the difficulty. One suit is the easiest and most forgiving; two suits is a solid challenge; four suits is the hardest, classic Spider. You can switch any time — it starts a fresh deal.' },
      { q: 'How do I win Spider Solitaire?', a: 'Clear all eight complete King-to-Ace runs of a single suit. Each completed run is removed from the board; clear all eight and you win.' },
      { q: 'Why can I not move a stack of cards?', a: 'A run of cards only moves together when they are the same suit in descending order. A mixed-suit stack has to be moved one card at a time.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a card to pick up its run and tap a column to drop it. It works on phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'pyramid',
    game: 'pyramid',
    title: 'Play Pyramid Solitaire Online — Free Card Game, No Download',
    h1: 'Pyramid Solitaire',
    metaDescription:
      'Play Pyramid Solitaire free online — pair cards that add up to 13 to clear the pyramid. Kings go on their own. No download, no sign-up, in your browser.',
    shortDescription: 'Pair cards that add up to 13 to clear the pyramid.',
    howToPlay: [
      'Remove cards in pairs that add up to 13 — a 6 with a 7, a 9 with a 4, and so on.',
      'A Jack is 11, a Queen is 12, and a King is 13, so Kings are removed on their own.',
      'You can only take a card when nothing overlaps it from below.',
      'Turn cards from the stock to the waste to find more matches, up to three passes.',
    ],
    strategy: [
      'Look for pairs that free up the most cards behind them, not just the easiest match.',
      'Keep an eye on which cards you still need — do not bury a card you must pair later.',
      'Use the stock deliberately; you only get three passes through it.',
      'Clear Kings as soon as they are free — they take no partner and open the pyramid up.',
      'Plan a few moves ahead so a needed card is not left stranded under others.',
    ],
    faq: [
      { q: 'How do I win Pyramid Solitaire?', a: 'Clear every card from the pyramid by removing pairs that total 13 (and Kings on their own). Empty the pyramid and you win.' },
      { q: 'What are the card values?', a: 'Ace is 1, number cards are their face value, Jack is 11, Queen is 12, and King is 13. Pairs must add up to exactly 13.' },
      { q: 'How many times can I go through the stock?', a: 'Three passes. When the stock runs out you can recycle the waste back into it, up to the pass limit.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap two free cards that add up to 13 to remove them, or tap a King to clear it. It works on phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'tripeaks',
    game: 'tripeaks',
    title: 'Play TriPeaks Solitaire Online — Free Card Game, No Download',
    h1: 'TriPeaks Solitaire',
    metaDescription:
      'Play TriPeaks Solitaire free online — clear three peaks by picking cards one rank above or below the waste. Build long chains for a big score. No download, no sign-up.',
    shortDescription: 'Clear three peaks one card up or down at a time.',
    howToPlay: [
      'Clear a card when it is one rank above or below the card on the waste pile.',
      'Ranks wrap around, so an Ace plays on a King or a two, and a King plays on an Ace or a Queen.',
      'Only cards with nothing overlapping them are free to play.',
      'Draw from the stock when you are stuck, but each draw breaks your chain.',
    ],
    strategy: [
      'Chain as many cards in a row as you can before drawing — longer chains score much higher.',
      'Look ahead: pick the card that opens up the most new cards behind it.',
      'Save a card you can reach later as a bridge back to a stuck peak.',
      'Do not draw from the stock too early — squeeze every move out of the board first.',
      'Clearing a whole peak frees a big cluster, so work toward finishing one.',
    ],
    faq: [
      { q: 'How do I play a card in TriPeaks?', a: 'Tap a free card whose rank is exactly one above or one below the top of the waste pile. Ranks wrap, so Ace connects to both King and two.' },
      { q: 'What is a chain?', a: 'Each card you clear without drawing from the stock extends your chain. Longer chains earn more, so string together as many as you can.' },
      { q: 'How do I win?', a: 'Clear all the cards from the three peaks. When every peak is empty, you win the deal.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a free, rank-adjacent card to send it to the waste, or tap the stock to draw. It works on phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'mahjong',
    game: 'mahjong',
    title: 'Play Mahjong Solitaire Online — Free Tile Match Game, No Download',
    h1: 'Mahjong Solitaire',
    metaDescription:
      'Play Mahjong Solitaire free online — match pairs of free tiles to clear all 144 from the layout. Every deal is solvable. No download, no sign-up, in your browser.',
    shortDescription: 'Match free tile pairs to clear all 144.',
    howToPlay: [
      'Clear the board by removing matching pairs of tiles until none are left.',
      'A tile is free to take only when nothing sits on top of it and one of its long sides is open.',
      'Tap a free tile, then its match — identical tiles pair, and any flower matches any flower, any season any season.',
      'Every deal can be solved; if a wrong order strands you, Undo steps back as far as you need, and Shuffle is a limited last resort.',
    ],
    strategy: [
      'Take tiles that unblock the most other tiles, not just the first pair you spot.',
      'Free the tiles trapped under the upper layers early — they are the hardest to reach.',
      'When several copies of a tile are exposed, think about which pair opens up more of the board.',
      'Keep a matching pair in reserve rather than clearing every match the moment you see it.',
      'Hint only shows the first legal pair it finds, not a good one — use it to spot a match, then judge the move yourself.',
      'If you get stuck, Undo back to your mistake before you Shuffle — Undo is unlimited and keeps the board solvable, while a reshuffled board is not guaranteed to clear and you get only three.',
    ],
    faq: [
      { q: 'How do you play Mahjong Solitaire?', a: 'Match and remove pairs of free tiles until all 144 are gone. A tile is free when no tile covers it and at least one of its left or right sides is open.' },
      { q: 'Which tiles match?', a: 'Two tiles match if they are identical. The exception is the bonus tiles: any flower matches any other flower, and any season matches any other season.' },
      { q: 'Is every Mahjong board winnable?', a: 'Every new deal is built to be solvable, so with the right order of moves you can clear it. A wrong order can still leave you stuck; Undo rewinds to a position that is still solvable, while a shuffle gives you a fresh layout that is not guaranteed to be solvable.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a free tile and then its match to clear the pair. It works on phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'chess',
    game: 'chess',
    title: 'Play Chess Online — Free vs Computer or 2 Player, No Download',
    h1: 'Chess',
    metaDescription:
      'Play chess free online — against the computer at three difficulty levels or two-player on one device. Full rules, legal moves only, checkmate detection. No download, no sign-up.',
    shortDescription: 'Play chess vs the computer or a friend.',
    howToPlay: [
      'Tap one of your pieces to see every legal move highlighted, then tap a square to move.',
      'Play against the computer — pick your colour and Easy, Medium or Hard — or pass and play with a friend.',
      'Only legal moves are allowed, including castling, en passant and pawn promotion.',
      'Put the enemy king in checkmate to win; a king with no legal move and no check is stalemate, a draw.',
    ],
    strategy: [
      'Control the centre early and develop your knights and bishops before moving the same piece twice.',
      'Castle early to tuck your king safe and connect your rooks.',
      'Do not bring your queen out too soon — it becomes a target you waste moves saving.',
      'Look for undefended pieces and forks before every move, on both sides of the board.',
      'In the endgame, push your king forward — it becomes a strong attacking piece.',
    ],
    faq: [
      { q: 'Can I play chess against the computer?', a: 'Yes. Choose to play the computer as White or Black at Easy, Medium or Hard. The engine only makes legal moves and plays a real game.' },
      { q: 'Can two people play on one device?', a: 'Yes. Two-player mode is pass-and-play — take turns on the same screen, no account needed.' },
      { q: 'Does it enforce all the rules?', a: 'Yes. Castling, en passant, promotion, check, checkmate and stalemate are all handled, and only legal moves are permitted — verified move-for-move against standard chess.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a piece to see its legal moves and tap a square to play. It works on phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'golf-solitaire',
    game: 'golf-solitaire',
    title: 'Play Golf Solitaire Online — Free Card Game, No Download',
    h1: 'Golf Solitaire',
    metaDescription:
      'Play Golf Solitaire free online — clear the columns by playing cards one rank up or down from the waste. Fast, simple and addictive. No download, no sign-up, in your browser.',
    shortDescription: 'Clear the columns one rank up or down.',
    howToPlay: [
      'Play the bottom card of any column onto the waste if it is one rank higher or lower.',
      'Keep chaining cards up and down to clear whole columns in a run.',
      'When you are stuck, deal the next card from the stock to the waste.',
      'Clear every card from all seven columns to win the deal.',
    ],
    strategy: [
      'Look for long up-and-down chains before you deal a new card from the stock.',
      'Clear the taller columns first so you do not get stuck with buried cards.',
      'The stock is limited, so spend each deal only when no column card will play.',
      'Turn on the around-the-corner option to let Aces and Kings connect for easier runs.',
      'Plan a couple of moves ahead — the order you clear cards in decides how far you get.',
    ],
    faq: [
      { q: 'How do you play Golf Solitaire?', a: 'Move the exposed bottom card of any column onto the waste pile when it is exactly one rank above or below the card there. Deal from the stock when no column card will play.' },
      { q: 'Do Aces and Kings connect?', a: 'In the classic game, no — Ace is low and does not wrap to King. There is an around-the-corner toggle that lets them connect if you prefer an easier game.' },
      { q: 'How do I win?', a: 'Clear every card from all seven columns before the stock runs out and you get stuck.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a column card to play it onto the waste, or tap the stock to deal. It works on phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'dominoes',
    game: 'dominoes',
    title: 'Play Dominoes Online — Free vs Computer or 2 Player, No Download',
    h1: 'Dominoes',
    metaDescription:
      'Play dominoes free online — the classic double-six tile game against the computer or a friend. Match the ends, empty your hand, and win. No download, no sign-up.',
    shortDescription: 'Match the ends and empty your hand first.',
    howToPlay: [
      'Each player starts with seven tiles from the double-six set.',
      'Play a tile so one of its numbers matches an open end of the line.',
      'If you cannot play, draw from the boneyard until you can, or pass when it is empty.',
      'Be the first to play all your tiles to win, or hold the fewest pips if the game blocks up.',
    ],
    strategy: [
      'Play your heavy tiles early — being caught with them when the game blocks costs you.',
      'Watch which numbers your opponent keeps passing on and try to force those ends.',
      'Hold a double or two as flexible tiles you can drop when the ends line up.',
      'Count what has been played to guess what your opponent is still holding.',
      'When ahead, keep the line simple; when behind, open both ends to make more plays.',
    ],
    faq: [
      { q: 'Can I play dominoes against the computer?', a: 'Yes. Play a full game against a built-in opponent, or switch to two-player pass-and-play on one device.' },
      { q: 'How do you win at dominoes?', a: 'Be the first to play all your tiles. If nobody can move and the boneyard is empty, the player with the fewest pips left in hand wins.' },
      { q: 'What is the boneyard?', a: 'The pile of leftover tiles after the deal. If you cannot match an open end, you draw from it until you can, or pass when it is empty.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a tile in your hand and tap an open end to play it. It works on phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'jigsaw',
    game: 'jigsaw',
    title: 'Play Jigsaw Puzzles Online — Free, No Download',
    h1: 'Jigsaw Puzzle',
    metaDescription:
      'Play free jigsaw puzzles online — assemble a fresh neon picture piece by piece, at easy, medium or hard sizes. Relaxing and always solvable. No download, no sign-up.',
    shortDescription: 'Assemble the neon picture piece by piece.',
    howToPlay: [
      'A neon picture is cut into interlocking pieces and scattered into the tray.',
      'Tap a piece to pick it up — its home spot on the board lights up.',
      'Tap the highlighted spot to snap the piece into place; it locks when correct.',
      'Fill the whole board to complete the picture and win.',
    ],
    strategy: [
      'Turn on the preview to see the finished picture as a guide while you build.',
      'Start with the corners and edges — flat-sided pieces are easy to spot.',
      'Group pieces by colour and pattern to find where each one belongs faster.',
      'Bump the grid up to 4×4 or 6×6 once the small puzzles feel too quick.',
      'There is no timer, so relax — every piece has exactly one right home.',
    ],
    faq: [
      { q: 'Do I need to download anything?', a: 'No. The puzzle runs entirely in your browser — pick a size and start assembling right away on phone, tablet or desktop.' },
      { q: 'Where do the pictures come from?', a: 'Each picture is generated fresh in the neon style of the site, so every puzzle is unique, always solvable, and needs no downloaded images.' },
      { q: 'How do I place a piece?', a: 'Tap a piece in the tray to select it, then tap its highlighted home cell to snap it in. On desktop you can also drag it. Only the correct spot accepts a piece, so you can never place one wrong.' },
      { q: 'Can I make it harder?', a: 'Yes. Switch between 3×3, 4×4 and 6×6 grids — more pieces means a bigger challenge.' },
    ],
  },
  {
    slug: 'yukon-solitaire',
    game: 'yukon',
    title: 'Play Yukon Solitaire Online — Free Card Game, No Download',
    h1: 'Yukon Solitaire',
    metaDescription:
      'Play Yukon Solitaire free online — a Klondike cousin with no stock, where you can move any face-up card with the whole pile on top. Every card is in play. No download, no sign-up.',
    shortDescription: 'Move any face-up card with its whole pile.',
    howToPlay: [
      'All the cards are dealt to seven columns — there is no stock or waste pile to draw from.',
      'Build the four foundations up by suit from Ace to King to win.',
      'On the tableau, stack cards down in alternating colours — a red six on a black seven.',
      'Move ANY face-up card and everything on top of it as one group, even if that group is not in order.',
    ],
    strategy: [
      'The move-any-pile rule is powerful — use it to dig out buried cards you need.',
      'Turn over face-down cards as fast as you can; they are the whole challenge.',
      'Try to empty a column so you can park a King and the pile beneath it.',
      'Do not rush cards to the foundations — you may still need them to shuffle piles around.',
      'Plan a few moves ahead; with no stock to bail you out, order of moves matters.',
    ],
    faq: [
      { q: 'How is Yukon different from Klondike solitaire?', a: 'There is no stock or waste — every card is on the table from the start. And you can move any face-up card along with all the cards on top of it, even when they are not in sequence.' },
      { q: 'How do I win Yukon Solitaire?', a: 'Move all 52 cards to the four foundations, built up by suit from Ace to King.' },
      { q: 'Can I move a group of cards that are not in order?', a: 'Yes — that is the signature Yukon rule. As long as the bottom card of the group lands legally, everything on top of it comes along.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a face-up card to pick up its pile and tap a column to drop it. It works on phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'gomoku',
    game: 'gomoku',
    title: 'Play Gomoku Online — Free Five in a Row vs Computer or 2 Player',
    h1: 'Gomoku',
    metaDescription:
      'Play Gomoku (Five in a Row) free online — against the computer at three difficulty levels or two-player on one device. Get five stones in a row to win. No download, no sign-up.',
    shortDescription: 'Get five in a row to win.',
    howToPlay: [
      'Take turns placing stones on the 15×15 board — Black moves first.',
      'Make an unbroken line of five of your stones to win.',
      'A line counts in any direction: across, down, or diagonally.',
      'Play the computer at Easy, Medium or Hard, or pass and play with a friend.',
    ],
    strategy: [
      'Build an "open three" (three in a row with both ends free) — it forces your opponent to react.',
      'An "open four" is an instant win threat; make one and always block your opponent’s.',
      'Watch both ends of every line — a four blocked on one side can still be extended on the other.',
      'Create two threats at once (a fork); your opponent can only block one.',
      'Do not just attack — one missed block from the opponent’s four loses the game.',
    ],
    faq: [
      { q: 'How do you win at Gomoku?', a: 'Be the first to line up five of your stones in a row — horizontally, vertically or diagonally — on the 15×15 board.' },
      { q: 'Can I play against the computer?', a: 'Yes. Choose your colour and Easy, Medium or Hard. The computer takes wins, blocks your threats and plays a real game. Two-player pass-and-play is also available.' },
      { q: 'Who goes first?', a: 'Black moves first, which is a small advantage — switch colours between games to keep it fair.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap an empty spot to place a stone. The board scales to fit phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'flow',
    game: 'flow',
    title: 'Play Flow Free Online — Connect the Dots Pipe Puzzle',
    h1: 'Flow',
    metaDescription:
      'Play Flow free online — connect each pair of coloured dots with a pipe and fill the whole grid without crossing. 26 hand-made levels from 5×5 to 7×7. No download, no sign-up.',
    shortDescription: 'Connect the dots, fill the grid.',
    howToPlay: [
      'Drag from a coloured dot to its matching twin to lay a pipe of that colour.',
      'Pipes cannot cross or overlap another pipe.',
      'You win when every pair is connected AND every square is filled.',
      'Drag back over your own pipe to erase it, or tap a colour dot below the board to clear it.',
    ],
    strategy: [
      'Start with the corners and edges — they have the fewest ways in and out.',
      'A pair on the same row or column rarely connects in a straight line; you usually need the detour to help fill the grid.',
      'If a pipe would trap an empty square with only one opening, reroute — every cell must be reachable.',
      'Full coverage is the real goal: connecting all pairs the short way often leaves gaps and does not solve the level.',
      'Use Undo freely to test a route without losing your other pipes.',
    ],
    faq: [
      { q: 'How do you win at Flow?', a: 'Connect every pair of same-coloured dots with a pipe AND fill all squares. Connecting the pairs alone is not enough — the whole grid must be covered.' },
      { q: 'Can pipes cross each other?', a: 'No. Each square holds at most one pipe. Dragging through another colour’s pipe cuts that pipe back at the crossing point (only its dots block you); drag back over your own pipe to shorten it.' },
      { q: 'How many levels are there?', a: 'There are 26 hand-made levels that get bigger and trickier — nine 5×5, nine 6×6 and eight 7×7 boards. Your furthest level is saved locally.' },
      { q: 'Does it work on mobile?', a: 'Yes. Drag with your finger from dot to dot. The board scales to fit phones, tablets and desktop.' },
    ],
  },
  {
    slug: 'unblock',
    game: 'unblock',
    title: 'Play Unblock Online — Free Sliding Block Puzzle (Rush Hour)',
    h1: 'Unblock',
    metaDescription:
      'Play Unblock free online — slide the blocking cars out of the way and drive the red block out through the exit. 27 hand-made levels from easy to expert. No download, no sign-up.',
    shortDescription: 'Slide the blocks, free the red one.',
    howToPlay: [
      'Drag a block along its own axis — horizontal blocks move left/right, vertical blocks move up/down.',
      'Blocks stop against the walls and against each other; they cannot turn or jump.',
      'Clear a path so the red block can slide out through the gap on the right edge.',
      'Solve each level in as few moves as you can — every level has a known best.',
    ],
    strategy: [
      'Work backwards from the exit: find what is directly blocking the red block, then what blocks that.',
      'A vertical block only helps when it slides fully clear of the red block’s row — half-way is still in the way.',
      'Do not shuffle blindly; each move should open a specific block’s path, not just rearrange the jam.',
      'Corner and edge blocks have the least freedom — plan their one useful move early.',
      'If you are stuck, Undo back a few moves and try freeing a different blocker first.',
    ],
    faq: [
      { q: 'How do you win at Unblock?', a: 'Slide the other blocks out of the way until the red block has a clear path, then slide it out through the gap on the right edge.' },
      { q: 'Which way can blocks move?', a: 'Only along their own length. A horizontal block slides left and right; a vertical block slides up and down. They never rotate.' },
      { q: 'How many levels are there?', a: 'There are 27 hand-made levels, verified solvable, from 2-move warm-ups up to a 25-move expert. Your best move count per level is saved locally.' },
      { q: 'Does it work on mobile?', a: 'Yes. Drag blocks with your finger, or tap a block then tap where it should go. The board scales to fit any screen.' },
    ],
  },
  {
    slug: 'yahtzee',
    game: 'yahtzee',
    title: 'Play Yahtzee Online — Free Dice Game, No App or Sign-Up',
    h1: 'Yahtzee',
    metaDescription:
      'Play Yahtzee free online — roll five dice, hold the ones you want and fill all 13 scoring boxes for the highest total. Live score previews, upper bonus, Yahtzee bonus. No download, no sign-up.',
    shortDescription: 'Roll the dice, fill the scorecard.',
    howToPlay: [
      'Roll all five dice, then tap any dice to HOLD them and re-roll the rest — up to three rolls per turn.',
      'When you are happy, tap a scorecard row to bank the roll into that category.',
      'Every unused row shows the score you would get right now, so you can pick the best one.',
      'Fill all 13 categories over 13 turns; score 63+ in the upper section for a +35 bonus.',
    ],
    strategy: [
      'Chase the upper bonus early — banking three or more of each number from Ones to Sixes hits 63 and adds 35.',
      'Keep the Chance box in reserve for a wasted roll instead of zeroing a big category.',
      'Hold toward a Large Straight (40) or Full House (25) only when a couple of dice already fit — do not force it.',
      'Score a rubbish roll into Ones or Twos rather than throwing away Yahtzee, Large Straight or Four of a Kind.',
      'Once you have scored a 50 Yahtzee, every extra five-of-a-kind is worth a +100 bonus — hold for it if you are close.',
    ],
    faq: [
      { q: 'How do you score a Yahtzee?', a: 'Roll five dice of the same number and bank it in the Yahtzee box for 50 points. Each extra Yahtzee after that adds a +100 bonus.' },
      { q: 'How many rolls do I get per turn?', a: 'Up to three rolls in total: the first roll of all five dice, then up to two re-rolls of whichever dice you have not held, before you must score.' },
      { q: 'What is the upper bonus?', a: 'If the six upper boxes (Ones through Sixes) add up to 63 or more, you get a +35 bonus — roughly three of each number.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap dice to hold and tap a row to score. The dice and scorecard scale to fit phones and tablets.' },
    ],
  },
  {
    slug: 'mancala',
    game: 'mancala',
    title: 'Play Mancala Online — Free Kalah Board Game vs Computer or 2 Player',
    h1: 'Mancala',
    metaDescription:
      'Play Mancala (Kalah) free online — sow the stones around the board, land in your store to go again, and capture to build the biggest pile. Versus the computer at three levels or two players. No download, no sign-up.',
    shortDescription: 'Sow the stones, fill your store.',
    howToPlay: [
      'On your turn, pick one of your own pits and sow its stones one by one counter-clockwise.',
      'Sow into your own store (on your right) but skip your opponent’s store.',
      'If your last stone lands in your store, you take another turn.',
      'If it lands in an empty pit on your side, capture that stone and the pit directly opposite into your store.',
    ],
    strategy: [
      'Chain extra turns: a pit with exactly the right number of stones to end in your store lets you move again.',
      'Set up captures — leave a pit empty so a later sow lands there and grabs a full pit opposite.',
      'Watch your opponent’s threats; a pit poised to reach their store hands them a free extra move.',
      'Late game, hoard stones on your own side — when a side empties, each player keeps the stones left on theirs.',
      'Loading your rightmost pits keeps more sowings ending in your store instead of feeding the opponent.',
    ],
    faq: [
      { q: 'How do you win Mancala?', a: 'Collect more stones in your store than your opponent. The game ends when one side’s pits are empty, and each player banks the stones remaining on their own side.' },
      { q: 'When do I get an extra turn?', a: 'Whenever the last stone you sow lands in your own store. Chaining extra turns is the heart of good Mancala play.' },
      { q: 'How does a capture work?', a: 'If your last stone lands in an empty pit on your own side, you capture that stone plus every stone in the pit directly across from it, into your store.' },
      { q: 'Can I play the computer?', a: 'Yes — choose Easy, Medium or Hard. The computer uses real look-ahead, takes captures and chains extra turns. Two-player pass-and-play is also available.' },
    ],
  },
  {
    slug: 'battleship',
    game: 'battleship',
    title: 'Play Battleship Online — Free Naval Strategy Game vs Computer',
    h1: 'Battleship',
    metaDescription:
      'Play Battleship free online — place your fleet, then fire on a 10×10 grid to hunt and sink the computer’s ships before it sinks yours. Smart hunting AI at three levels. No download, no sign-up.',
    shortDescription: 'Hunt and sink the enemy fleet.',
    howToPlay: [
      'Place your five ships on your grid, or tap Auto-place to set the whole fleet at once.',
      'Take turns firing at one cell of the enemy grid — a shot is a hit or a miss.',
      'Hit every cell of a ship to sink it; sink all five enemy ships to win.',
      'Watch the enemy’s shots on your own grid and protect your remaining ships.',
    ],
    strategy: [
      'Fire in a checkerboard pattern while hunting — no ship longer than one cell can hide from it, so you cover the board in half the shots.',
      'After a hit, fire the four cells around it to find the ship’s direction, then follow that line until it sinks.',
      'Spread your own ships out and avoid clustering them, so one lucky enemy hit does not reveal two ships.',
      'Keep count of which enemy ships are still afloat — knowing a 5-length Carrier remains tells you where it can still fit.',
      'Placing ships flush against the edges makes them a little harder for a probability-based opponent to find.',
    ],
    faq: [
      { q: 'How do you win at Battleship?', a: 'Be the first to sink your opponent’s entire fleet — all five ships — by hitting every cell each ship occupies.' },
      { q: 'How big is the fleet?', a: 'Five ships: a Carrier (5 cells), a Battleship (4), a Cruiser (3), a Submarine (3) and a Destroyer (2), placed on a 10×10 grid.' },
      { q: 'Does the computer play a real strategy?', a: 'Yes. On Normal and Hard it hunts with a parity pattern and, once it lands a hit, targets the surrounding cells and follows the ship’s line until it sinks — it does not fire at random.' },
      { q: 'Do I have to place my own ships?', a: 'Only if you want to. Tap Auto-place to drop the whole fleet legally in one go, or place and rotate each ship yourself.' },
    ],
  },
  {
    slug: 'kakuro',
    game: 'kakuro',
    title: 'Play Kakuro Online — Free Cross Sums Number Puzzle, No App',
    h1: 'Kakuro',
    metaDescription:
      'Play Kakuro free online — fill the white cells 1–9 so every run adds up to its clue with no repeated digits. 16 hand-checked puzzles from easy to expert, with notes and a combo helper. No download, no sign-up.',
    shortDescription: 'Cross-sums: fill the grid to the clues.',
    howToPlay: [
      'Fill each empty white cell with a digit from 1 to 9.',
      'Every horizontal and vertical run of white cells must add up to the clue number for that run.',
      'No digit may repeat within the same run.',
      'The clue for an across run sits in the top-right of the black cell to its left; a down-run clue sits in the bottom-left of the black cell above it.',
    ],
    strategy: [
      'Start with the most constrained runs — a two-cell run summing to 3 can only be 1+2, and a 17 can only be 8+9.',
      'Use the combo helper: it lists which sets of digits can make a run’s sum in the number of cells it has.',
      'Work the crossings — a cell shared by an across run and a down run must satisfy both, which often pins it to one digit.',
      'Pencil in candidates when a cell has a few options, then eliminate as the crossing runs fill in.',
      'It is pure logic — every puzzle has exactly one solution, so you never need to guess.',
    ],
    faq: [
      { q: 'How is Kakuro different from Sudoku?', a: 'Both are no-repeat number logic puzzles, but in Kakuro the clues are sums: each run of white cells must total its clue number, and digits only can’t repeat within a run rather than across a whole row or box.' },
      { q: 'Can a digit repeat in a run?', a: 'No. Within any single across or down run every digit must be different, though the same digit can appear in a different run that crosses it.' },
      { q: 'Do I have to guess?', a: 'Never. Every puzzle here is checked to have exactly one solution reachable by logic, so careful deduction always gets you there.' },
      { q: 'What does the combo helper do?', a: 'For the selected run it shows the possible sets of digits that add up to the clue in that many cells — the classic Kakuro solving aid.' },
    ],
  },
  {
    slug: 'beatline',
    game: 'beatline',
    title: 'Play Beatline Online — Free 4-Lane Rhythm Game, No App',
    h1: 'Beatline',
    metaDescription:
      'Play Beatline free online — hit falling notes in the right lane at the right beat across 5 stages. Daily challenge and practice mode, live combo and multiplier. No download, no sign-up.',
    shortDescription: 'Hit the note, on the beat, in the lane.',
    howToPlay: [
      'Notes fall down four lanes toward the judgement line at the bottom.',
      'Press the matching lane key (D, F, J, K) — or tap the lane on touch — exactly as the note crosses the line.',
      'A Perfect hit scores more than a Good hit; missing a note costs a life and resets your combo.',
      'Clear all 5 stages before you run out of lives to win the run.',
    ],
    strategy: [
      'Watch the judgement line, not the falling note — let the note come to you instead of chasing it up the lane.',
      'Perfect is ±50 ms and Good is ±120 ms, so if you are consistently early or late, correct by a few tens of milliseconds — not by a half beat, which is wider than the whole Good window.',
      'Combo drives your score multiplier, so protecting an unbroken streak beats chasing one risky Perfect.',
      'Later stages layer more notes per beat — lock onto the rhythm rather than reacting note-by-note.',
      'Daily mode is the same chart for everyone that day; Practice deals a fresh random five-stage run every time, so use it to drill the faster stages without touching your streak.',
    ],
    faq: [
      { q: 'How do you play Beatline?', a: 'Press the lane key (D, F, J, K) exactly as the falling note crosses the judgement line. Hitting inside the tight window scores a Perfect; a wider window scores a Good.' },
      { q: 'What happens if I miss a note?', a: 'A miss breaks your combo and costs one of your four lives — and so does pressing a lane with no note in it. Lives carry across all five stages; run out and the run ends.' },
      { q: 'How many stages are there?', a: 'Five stages, each with a denser note chart than the last. Clear all five to win the run.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a lane button as the note crosses the line — the four lanes span the width of the board on any screen.' },
    ],
  },
  {
    slug: 'skew',
    game: 'skew',
    title: 'Play Skew Online — Free Tilt & Match Puzzle, No App',
    h1: 'Skew',
    metaDescription:
      'Play Skew free online — tilt the whole board instead of swiping tiles, shear the grid diagonally, and match 5 colours in cascading waves. No download, no sign-up.',
    shortDescription: 'Tilt the board, let the colours line up.',
    howToPlay: [
      'Tap the left or right tilt button (or press ←/→) to shear the whole board diagonally, one row at a time.',
      'Tilting scatters and realigns colours across the diagonal — matching 3 or more in a row or column clears them.',
      'Cleared tiles drop and refill, and a fresh match can cascade into another for a wave bonus.',
      'You have a limited number of tilts — score as high as you can before they run out.',
    ],
    strategy: [
      'A tilt shifts every row (except the top) by a different amount, so plan for the whole board moving, not one tile.',
      'Chain a match right after your last one to keep the combo streak alive — a tilt with no match resets it.',
      'Cascading waves multiply your score, so a tilt that sets up a chain reaction beats one that only clears a single line.',
      'There is no invalid move — every tilt changes the board, so there is never a need to hunt for a legal move.',
      'Alternate tilt direction when obvious matches run out — the other diagonal often opens fresh lines.',
    ],
    faq: [
      { q: 'How do you play Skew?', a: 'Tap the left or right button to tilt the whole board diagonally. Rows shift by different amounts, scattering colours until three or more line up and clear.' },
      { q: 'Do I swipe individual tiles?', a: 'No — Skew has no tile swapping. You only ever tilt the entire board left or right; the diagonal shear does the rearranging.' },
      { q: 'How many tilts do I get?', a: 'You start with 30 tilts. Score as many cascading matches as you can before they run out.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap the on-screen tilt buttons, or swipe left or right on the board itself.' },
    ],
  },
  {
    slug: 'turntile',
    game: 'turntile',
    title: 'Play Turntile Online — Free Flip & Reveal Tile Puzzle',
    h1: 'Turntile',
    metaDescription:
      'Play Turntile free online — flip 2×2 blocks to swap tiles and reveal their hidden face until every tile on the board shows the same symbol. No download, no sign-up.',
    shortDescription: 'Flip a block, reveal its faces, match the whole board.',
    howToPlay: [
      'Every tile has two faces; only one is showing at a time.',
      'Tap a pivot point to flip the 2×2 block around it — the four tiles swap positions point-symmetrically and their hidden faces are revealed.',
      'A block counts as matched (and scores) the moment all four of its tiles show the same face — but a later flip can break it again, so nothing is locked.',
      'Win by making every tile on the board show the same face — fewer flips than the par is a better score.',
    ],
    strategy: [
      'Flipping is its own undo — flip the same block again and it returns exactly to where it was.',
      'Track which faces you have already seen on nearby tiles; a flip both moves tiles and refreshes your memory of them.',
      'Work outward from a block you can already match rather than flipping at random — each flip touches four tiles at once, so plan for the ripple.',
      'A block near the edge has fewer overlapping neighbours, so a match there is less likely to be broken by your next flips.',
      'The par shown is the exact number of flips used to scramble the board, so matching or beating it is always possible.',
    ],
    faq: [
      { q: 'How do you play Turntile?', a: 'Tap a pivot to flip the surrounding 2×2 block. The four tiles swap positions and reveal their hidden face; a block counts as matched while all four faces agree, and later flips can undo that.' },
      { q: 'How do I win?', a: 'Get every tile on the board to show the same face at once — which is the same as every overlapping 2×2 block being matched at the same time.' },
      { q: 'Can I undo a flip?', a: 'There is no separate undo button, but every flip is its own reverse — flip the same pivot again to put it back.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap a pivot point to flip its block — the grid scales to fit phones and tablets as well as desktop.' },
    ],
  },
  {
    slug: 'stakehouse',
    game: 'stakehouse',
    title: 'Play Stakehouse Online — Free Push-Your-Luck Jar Betting Game',
    h1: 'Stakehouse',
    metaDescription:
      'Play Stakehouse free online — split your bankroll across four jars of fully visible odds and cash in as gems and duds get drawn. No download, no sign-up.',
    shortDescription: 'Spread your bets across four jars of visible odds.',
    howToPlay: [
      'Each of the four jars starts full of gem and dud tokens, and you can see exactly how many of each remain at all times.',
      'Before each round, spread your bankroll across as many jars as you like — the smaller the share of gems left in a jar, the higher its payout multiplier.',
      "Commit the round and all four jars draw one token at once, whether you bet on them or not: a gem pays your stake at that jar's multiplier, a dud takes your bet.",
      'Survive 12 rounds with bankroll left to complete the run — hit zero and the run ends.',
    ],
    strategy: [
      'A jar with a low share of gems pays big because it will usually miss — multipliers are set slightly below fair odds, so no jar is free money.',
      'Spreading bets across jars smooths your variance; going all-in on one jar is higher risk for a higher single payout.',
      'Watch the odds shift every round — a jar that looked safe early can turn into the best, or worst, bet later.',
      'Sitting a round out with no bet is always valid — sometimes the best move is to wait for better odds.',
    ],
    faq: [
      { q: 'How do you play Stakehouse?', a: 'Split your bankroll across four jars before each round. When you commit, all four jars draw one token — on the jars you bet on, a gem pays out and a dud costs you the bet.' },
      { q: 'How do I know the odds?', a: 'Every jar shows its exact remaining gem and dud count, and its payout multiplier is always visible before you bet. Multipliers come from those counts, trimmed slightly below a fair payout.' },
      { q: 'What happens if I lose all my bankroll?', a: 'Hitting zero bankroll ends the run immediately. Survive all 12 rounds with bankroll remaining to complete it.' },
    ],
  },
  {
    slug: 'grasp',
    game: 'grasp',
    title: 'Play Grasp Online — Free Push-Your-Luck Card Gauge Game',
    h1: 'Grasp',
    metaDescription:
      'Play Grasp free online — grasp or release each card as it flips, but every grasp fills your haste gauge until it forces the round to end. No download, no sign-up.',
    shortDescription: 'Grasp cards for points, but the haste gauge is always rising.',
    howToPlay: [
      'Cards flip one at a time from a shuffled deck. Grasp a card to add its value to your score, or release it for free and move on.',
      'Every grasp fills your haste gauge a little more — release costs you nothing but the chance to score.',
      'The instant the gauge fills, the round ends on the spot, wherever you are.',
      'See the deck through to the very last card before the gauge caps and you clear the round for a big bonus instead.',
    ],
    strategy: [
      'Every grasp costs the same amount of gauge, and unused gauge is paid out as a margin bonus when you clear — so weigh each card’s value against the margin it will cost you.',
      'Watch the gauge closely near the end of the deck: reaching the last card the instant it would cap turns a bust into a clear.',
      'Releasing costs nothing but potential score, so when the gauge is near full, release freely to survive to the finish.',
      'The grasp that fills the gauge comes sooner on Easy (the 6th of 20 cards) than on Normal (8th of 30) or Hard (10th of 42), so plan how many grasps you can afford from the very first card.',
    ],
    faq: [
      { q: 'How do you play Grasp?', a: 'As each card flips, choose to grasp it (add its value to your score, fill the gauge) or release it (no score, no gauge cost).' },
      { q: 'What happens when the gauge fills?', a: 'The round ends immediately, wherever you are — unless you grasp the very last card in the deck at that same moment, which clears the round for a bonus instead.' },
      { q: 'What is the difference between difficulties?', a: 'Easy deals 20 cards worth 1–5 and caps on the 6th grasp; Normal deals 30 cards worth 1–6 and caps on the 8th; Hard deals 42 cards worth 1–7 and caps on the 10th. Longer decks mean more decisions before you reach the end.' },
    ],
  },
  {
    slug: 'countcircle',
    game: 'countcircle',
    title: 'Play Countcircle Online — Free Josephus Survival Arcade Game',
    h1: 'Countcircle',
    metaDescription:
      'Play Countcircle free online — the deadly count is already heading for your seat. Swap places before the window closes and survive as long as you can. No download, no sign-up.',
    shortDescription: 'Swap seats before the deadly count reaches you.',
    howToPlay: [
      'You sit in a circle of seats. Every elimination cycle, a target seat is telegraphed with a pulsing ring.',
      'If the target is you, swap with the seat on either side before the countdown window closes, or you are eliminated.',
      'Clearing a round, down to the last survivor, instantly starts a bigger circle with no pause between rounds.',
      'The count keeps going forever — survive as many eliminations and rounds as you can for the highest score.',
    ],
    strategy: [
      "The countdown window shrinks as eliminations pile up, so react fast and don't wait for confirmation before swapping.",
      'Escaping a window where you were the actual target earns a clutch bonus — cutting it close pays off if you make it.',
      'Clearing a round adds three more seats immediately, so the circle only gets more dangerous the longer you survive.',
      'Watch the ring, not the number — the pulsing highlight tells you exactly which seat is about to be hit.',
    ],
    faq: [
      { q: 'How do you play Countcircle?', a: 'Watch for the pulsing ring marking the next target seat. If it lands on you, press left or right to swap with an adjacent seat before the window closes.' },
      { q: 'What happens when I get caught?', a: 'Getting caught on your own seat ends the run immediately — your final score reflects how many eliminations and rounds you survived.' },
      { q: 'Does the game ever end?', a: 'No — Countcircle is an endless survival run. Each cleared round adds more seats and the countdown windows get tighter.' },
    ],
  },
  {
    slug: 'offbeat',
    game: 'offbeat',
    title: 'Play Offbeat Online — Free Inverted Rhythm Survival Game',
    h1: 'Offbeat',
    metaDescription:
      'Play Offbeat free online — an inverted rhythm game where you tap the silent gap between beats, not the beat itself. Survive as the pulse speeds up. No download, no sign-up.',
    shortDescription: 'Tap the silence between the beats, not the beats.',
    howToPlay: [
      'A steady pulse fires and speeds up every cycle — watch the ring fill between each pulse.',
      'Tap exactly halfway between two pulses, the silent gap — not on the pulse itself.',
      'Tapping on a pulse, too early, too late, or missing a pulse entirely costs one of your three lives.',
      'A close tap scores Good, a dead-centre tap scores Perfect and builds your combo. The run ends when you run out of lives.',
    ],
    strategy: [
      'Watch the lime marker on the ring — that is the exact offbeat target, not the pulse flash itself.',
      'The gap between pulses shrinks steadily, but from the sixth cycle on a beat can occasionally arrive early — keep watching the ring rather than tapping on autopilot.',
      'A big combo pays off — perfect taps in a row score increasingly more, so consistency beats the occasional lucky hit.',
      'When the pulse speeds up hardest, resist the urge to tap on reflex — aim for the shrinking midpoint, not the beat.',
    ],
    faq: [
      { q: 'How do you play Offbeat?', a: 'Watch the pulse ring and tap (or press Space/Enter) exactly halfway between two beats — the silent gap, not the beat itself.' },
      { q: 'Why does tapping on the beat lose a life?', a: 'Offbeat inverts standard rhythm-game rules — the beat itself is the danger zone. Only the midpoint between beats is safe to tap.' },
      { q: 'Does the game get harder over time?', a: 'Yes — the pulse accelerates every cycle, so the safe window between beats keeps shrinking the longer you survive.' },
    ],
  },
  {
    slug: 'hogline',
    game: 'hogline',
    title: 'Play Hogline Online — Free Curling Momentum Puzzle',
    h1: 'Hogline',
    metaDescription:
      'Play Hogline free online — a curling-inspired momentum puzzle. Throw stones with the right power and angle, bounce off obstacles, and control the house. No download, no sign-up.',
    shortDescription: 'Throw stones, control the house, master the bounce.',
    howToPlay: [
      'Set your throw power and angle, then release — your stone slides and slows down under friction as it travels up the sheet.',
      'Stones bounce off each other realistically, so a well-placed throw can knock obstacle stones out of the house or into position.',
      'Your score is the house count — if your stone is closest to the button, each of your stones closer than the nearest obstacle stone scores 1–3 points by ring.',
      'Use all your shots, or bank early for a bonus on any you skip. Reach the target score to win.',
    ],
    strategy: [
      'A stone deep in the house is safer than one on the edge — closer beats farther when counting control of the centre.',
      'Use a lighter throw to nudge an obstacle stone out of the way before committing to a hard shot at the button.',
      'Banking early trades potential points for a guaranteed bonus — only worth it once you are safely ahead.',
      'Angle matters as much as power: stones travel in straight lines, so use a side-wall bounce or a glancing hit off another stone to reach a spot a direct throw cannot.',
    ],
    faq: [
      { q: 'How do you play Hogline?', a: 'Set your power and angle (arrow keys, drag, or the on-screen controls) and release to throw. Your stone slides and slows under friction, bouncing off any stones in its path.' },
      { q: 'What is the “house”?', a: 'The house is the target circle at the top of the sheet. If your stone is closest to its centre, every one of your stones nearer than the closest obstacle stone scores by ring; if an obstacle stone is closest, you score nothing.' },
      { q: 'Can I play a fresh puzzle every day?', a: 'Yes — Daily mode gives everyone the same seeded layout each day, with a streak counter for playing on consecutive days. Practice mode gives you a fresh random layout anytime.' },
    ],
  },
  {
    slug: 'prismbox',
    game: 'prismbox',
    title: 'Play Prismbox Online — Free Light Beam Deduction Puzzle',
    h1: 'Prismbox',
    metaDescription:
      'Play Prismbox free online — fire beams of light from the edge of a hidden grid and deduce where the atoms are from how each beam exits. No download, no sign-up.',
    shortDescription: 'Fire light beams, deduce the hidden atoms.',
    howToPlay: [
      'Hidden atoms sit somewhere on the grid — you cannot see them directly.',
      'Fire a beam of light from any edge port and watch how it exits: a direct hit, a straight pass-through, a reflection back the way it came, or a bent refraction.',
      'Use the pattern of hits, refractions, and reflections across multiple beams to work out exactly where each atom is hiding.',
      'An atom counts as found when a beam hits it head-on — find every atom to win. Fewer beams used earns a bigger bonus.',
    ],
    strategy: [
      'A beam that passes straight through tells you an entire lane is clear — use that to rule out large parts of the grid fast.',
      'A reflection means the beam came back out of its own port — somewhere along its route it was flanked by atoms on both sides — but a reflection alone gives no coordinates.',
      'Refracted beams bend around atoms without hitting them — the atom sits next to the bend point, not on the beam path itself.',
      'Fire beams from ports on different sides early to build overlapping clues before committing to a guess.',
    ],
    faq: [
      { q: 'How do you play Prismbox?', a: 'Fire a beam of light from any edge port (click, tap, or arrow keys + Enter) and use how it exits — hit, pass-through, reflection, or refraction — to deduce where the hidden atoms are.' },
      { q: 'What is this game based on?', a: 'Prismbox is inspired by the classic deduction game Black Box, reimagined with a light-beam theme and daily seeded puzzles.' },
      { q: 'What does a refracted beam mean?', a: 'A refraction means your beam bent around an atom without directly hitting it — the atom sits next to the bend point, not on the straight path.' },
    ],
  },
  {
    slug: 'gravwell',
    game: 'gravwell',
    title: 'Play Gravwell Online — Free Gravity Slingshot Puzzle',
    h1: 'Gravwell',
    metaDescription:
      'Play Gravwell free online — aim and launch a probe past orbiting planets and let gravity bend its path into the target ring. One shot, then physics takes over. No download, no sign-up.',
    shortDescription: 'One shot. Gravity bends the rest.',
    howToPlay: [
      'Drag the launch pad, use the angle/power steppers, or the arrow keys to aim your probe.',
      'Press Launch (or Space) to fire — after that, you only watch as the planets’ gravity curves the flight path.',
      'Reach the target ring to win. Crash into a planet, fly off the board, or time out and the shot is wasted.',
      'A close graze past a planet scores a bonus without ending the attempt — but drift too close and it is a crash.',
    ],
    strategy: [
      'Watch the dashed preview line while aiming — it shows exactly where gravity will carry the current angle and power.',
      'A heavier planet bends the path more sharply from farther away — use that curve instead of fighting it with raw power.',
      'Grazing a planet’s pull adds bonus points, so a trajectory that skims close (without crashing) beats a wide, safe miss.',
      'Fewer shots to reach the ring score a bigger par bonus — a good first-attempt read beats trial and error.',
    ],
    faq: [
      { q: 'How do you play Gravwell?', a: 'Drag the launch pad or use the angle/power steppers (or arrow keys) to aim, then press Launch. Gravity from nearby planets bends the flight path after that — you cannot steer mid-flight.' },
      { q: 'What happens if I crash into a planet?', a: 'The probe is destroyed and that shot is wasted. You get a limited number of shots per difficulty, so a crash costs one of them.' },
      { q: 'What is a "graze"?', a: 'Flying close to a planet without colliding scores a graze bonus, since it means you read the gravity well correctly without playing it too safe.' },
    ],
  },
  {
    slug: 'loopgrid',
    game: 'loopgrid',
    title: 'Play Loopgrid Online — Free Cyclic Grid Puzzle',
    h1: 'Loopgrid',
    metaDescription:
      'Play Loopgrid free online — cycle whole rows and columns of a color grid (the far end wraps around) to line up every row. No empty tile, no sliding — every move loops. No download, no sign-up.',
    shortDescription: 'Cycle rows and columns — the far end always wraps around.',
    howToPlay: [
      'Every tile in the grid has a color. There is no empty slot — you never slide a single tile.',
      'Press a row or column arrow to cycle the whole row or column one step in that direction; the tile that falls off one end reappears on the other.',
      'Turn a full row into its own single color to complete it — the first completion of each row scores a bonus, even if later moves disturb it again.',
      'Win by having every row complete at the same time. There is no move limit: par is the number of scramble moves, and finishing at or under par earns the full efficiency bonus.',
    ],
    strategy: [
      'Think in whole loops, not single tiles — every cycle shifts an entire row or column at once, so plan a few moves ahead.',
      'Completing several rows with the same move scores a combo — the bonus grows with the square of the rows finished together.',
      'A row’s completion bonus is only paid once, but the win needs every row correct at the same time, so a finished row you disturb must be rebuilt.',
      'On harder difficulties the grid is bigger, so scan for the row or column closest to done before committing a move.',
    ],
    faq: [
      { q: 'How do you play Loopgrid?', a: 'Use the row and column arrow buttons around the grid to cycle a full row or column one step. The tile that leaves one end reappears on the opposite end.' },
      { q: 'Why can’t I just slide one tile?', a: 'Loopgrid has no empty slot — unlike a sliding puzzle, every move shifts an entire row or column as a loop, which changes the whole solving approach.' },
      { q: 'Can I play a fresh puzzle every day?', a: 'Yes — Daily mode gives everyone the same seeded grid each day, with a streak counter for playing on consecutive days. Practice mode gives you a fresh random grid at any difficulty.' },
    ],
  },
  {
    slug: 'bisect',
    game: 'bisect',
    title: 'Play Bisect Online — Free Midpoint Timing Game',
    h1: 'Bisect',
    metaDescription:
      'Play Bisect free online — a pure timing game with no clock and no countdown. Watch for a start signal and an end signal, then tap the exact halfway point between them. No download, no sign-up.',
    shortDescription: 'No clock, no countdown — tap the exact midpoint between two signals.',
    howToPlay: [
      'Press Space, tap, or click to arm a round — after a short random pause a start flash fires, and an interval of unknown length begins.',
      'There is no visible countdown or progress bar between the two flashes — only your internal sense of time.',
      'Tap again exactly halfway through that interval — before it ends. Your tap ends the round immediately; the end flash only appears if you have not tapped yet, and a tap after it is always a miss.',
      'You have three lives — a false start, a miss, or a badly-timed tap costs one. The run ends when you run out.',
    ],
    strategy: [
      'The screen stays completely blank between flashes on purpose — resist the urge to count out loud and instead judge the gap by feel.',
      'Because the end flash only comes after the midpoint, waiting for it never works — a steady, practised delay from the start flash scores better than reacting.',
      'A streak of good taps in a row builds a growing bonus, so consistency across rounds is worth more than one lucky perfect hit.',
      'Tapping too early is treated the same as tapping too late — aim to feel the gap shrink rather than guessing towards either end.',
    ],
    faq: [
      { q: 'How do you play Bisect?', a: 'Press Space, tap, or click to start a round. After the start flash, tap again at the moment you judge to be halfway through the interval — you have to predict the midpoint, because tapping after the end flash is too late. There is no visible timer.' },
      { q: 'Why is there no countdown or progress bar?', a: 'The blank screen is the entire point — Bisect tests your internal sense of elapsed time, not your ability to read a clock.' },
      { q: 'Does the game ever end?', a: 'There is no round limit — Bisect is an endless survival run. It ends only when you lose all three lives.' },
    ],
  },
  {
    slug: 'slotter',
    game: 'slotter',
    title: 'Play Slotter Online — Free Sorted-Row Insertion Game',
    h1: 'Slotter',
    metaDescription:
      'Play Slotter free online — a number card approaches the deadline every round. Click the exact gap in your sorted row before it arrives, or the row breaks. No download, no sign-up.',
    shortDescription: 'Slot the card into the exact gap before it reaches the deadline.',
    howToPlay: [
      'A number card appears and slides steadily toward the deadline on a fixed schedule.',
      'Click the gap in your row where the card belongs — your row is always kept in ascending order, left to right.',
      'Placing it in the wrong gap breaks the row and ends the run immediately.',
      'Placing it correctly keeps the run going, but the next card comes in a little faster than the last.',
    ],
    strategy: [
      'Scan the row for the two neighbors the incoming number falls between — the correct gap is always the one place it fits without breaking the order.',
      'React early: as the pace ramps up, deciding while the card is still approaching beats waiting for it to get close.',
      'A run of correct placements in a row builds a streak bonus, so consistency under pressure pays off more than any single perfect placement.',
      'Keyboard players can move between gaps with the arrow keys and confirm with Enter — often faster than reaching for the right gap by mouse.',
    ],
    faq: [
      { q: 'How do you play Slotter?', a: 'Click (or use arrow keys + Enter) on the gap in your sorted row where the incoming number card belongs, before it reaches the deadline on the right.' },
      { q: 'What happens if I pick the wrong gap?', a: 'The row breaks immediately and the run ends — as it does if the card reaches the deadline. Your score is the points earned before that: each card pays more the longer your row and the faster you place it, multiplied by your streak.' },
      { q: 'Does the game get harder over time?', a: 'Yes — each correctly placed card slightly speeds up the pace of the next one, so the deadline window keeps shrinking.' },
    ],
  },
  {
    slug: 'carousel',
    game: 'carousel',
    title: 'Play Carousel Online — Free Rotating Ring Match Game',
    h1: 'Carousel',
    metaDescription:
      'Play Carousel free online — a ring of slots rotates on its own every time you place a marble. Line up three of the same color along the ring before it fills up. No download, no sign-up.',
    shortDescription: 'Place a marble, the ring turns itself — line up three to clear them.',
    howToPlay: [
      'Choose a colored marble from your hand and place it in the loader slot.',
      'After every placement, the whole ring automatically rotates a fixed number of slots — you never control the rotation directly.',
      'Line up three marbles of the same color anywhere along the ring and they clear, scoring points and opening space.',
      'If the slot the loader stops at next is already filled, the run ends — even if other slots on the ring are still open.',
    ],
    strategy: [
      'Think one rotation ahead — since the ring always turns the same amount after your placement, you can predict exactly where today’s marble will land next turn.',
      'Difficulty changes the ring size and rotation step, so a plan that works on Easy will not directly transfer to Hard.',
      'Clearing early keeps the ring from filling up, which matters more than chasing a bigger match once space gets tight.',
      'Watch for near-complete color runs building up around the ring, not just next to the loader — the rotation will bring them to you.',
    ],
    faq: [
      { q: 'How do you play Carousel?', a: 'Pick a marble from your hand (click, tap, or number keys 1-3) and place it at the loader. The ring then rotates on its own by a fixed amount before your next turn.' },
      { q: 'Why did the ring move without me doing anything?', a: 'That is the core twist — every placement triggers an automatic rotation, so you are always planning around where the ring will be next, not just where it is now.' },
      { q: 'When does the run end?', a: 'As soon as the slot that rotates under the loader is already occupied — which can happen before the whole ring is full. Clear same-color runs of three or more to keep slots open where the loader will land.' },
    ],
  },
  {
    slug: 'gridlock',
    game: 'gridlock',
    title: 'Play Gridlock Online — Free Traffic Intersection Survival Game',
    h1: 'Gridlock',
    metaDescription:
      'Play Gridlock free online — four lanes of traffic approach a single intersection. Grant right-of-way to one lane at a time and keep every car moving without a crash or a timeout. No download, no sign-up.',
    shortDescription: 'One intersection, four lanes — grant right-of-way without a crash.',
    howToPlay: [
      'Cars approach a single shared intersection continuously from all four directions.',
      'Use the arrow keys (or WASD) to grant right-of-way to one lane at a time — only that lane may enter the intersection.',
      'Switching to a lane while another car is still crossing causes a crash and ends the run.',
      'Leaving a waiting car stuck too long at the stop line also ends the run — the wait timer shows as amber, then red.',
    ],
    strategy: [
      'Watch every lane at once, not just the active one — a car turning red while you are focused elsewhere is the most common way runs end.',
      'Switch lanes proactively before a car reaches a critical wait, rather than reacting only once it starts flashing red.',
      'Traffic spawns faster as your score climbs, so a rotation rhythm that works early will need to tighten up later.',
      'When two lanes are both getting urgent, prioritize whichever has waited longer — a fresh arrival can usually wait one more cycle.',
    ],
    faq: [
      { q: 'How do you play Gridlock?', a: 'Use the arrow keys or WASD to grant right-of-way to one lane (N/S/E/W) at a time. Only cars in the active lane may enter the intersection.' },
      { q: 'What ends a run?', a: 'Either a crash (switching lanes while a car is still crossing the intersection) or a timeout (a waiting car left too long at the stop line).' },
      { q: 'Does the game ever end on its own?', a: 'No — Gridlock is an endless survival run. Your score is how many vehicles you safely processed before a crash or timeout.' },
    ],
  },
  {
    slug: 'bearing',
    game: 'bearing',
    title: 'Play Bearing Online — Free Compass Deduction Treasure Hunt',
    h1: 'Bearing',
    metaDescription:
      'Play Bearing free online — a treasure is buried somewhere on the grid. Each dig only tells you which direction to go, never how far. Triangulate the exact spot before you run out of shovels. No download, no sign-up.',
    shortDescription: 'Every dig gives a direction, never a distance — triangulate the treasure.',
    howToPlay: [
      'A treasure is hidden somewhere on the grid, but you cannot see it directly.',
      'Dig any cell (click, tap, or arrow keys + Enter) and you get a compass direction pointing toward the treasure — N, S, E, W, or a diagonal.',
      'A direction only tells you which way to go, never how far — each dig rules out a whole region of the grid, not just one cell.',
      'Keep digging closer using the directions you have gathered. Find the treasure before you run out of shovels to win.',
    ],
    strategy: [
      'Treat every dig as ruling out a whole half (or quarter) of the grid, not just missing on one cell — the dimmed region shows exactly what is left.',
      'A diagonal direction (like northeast) is more informative than a pure cardinal one, since it narrows two axes down at once.',
      'Dig near the center of your remaining region rather than the edges — a central dig splits the remaining area more evenly.',
      'Harder difficulties use a bigger grid with a tighter shovel budget, so plan each dig to cut the search area as much as possible.',
    ],
    faq: [
      { q: 'How do you play Bearing?', a: 'Dig a cell (click, tap, or arrow keys + Enter) and you get a compass direction toward the hidden treasure. Use each direction to narrow down where it could be, then dig again.' },
      { q: 'Why doesn’t the game tell me how far away the treasure is?', a: 'That is the whole puzzle — you only ever get a direction, never a distance, so you have to triangulate the exact cell using multiple digs.' },
      { q: 'Can I play a fresh puzzle every day?', a: 'Yes — Daily mode gives everyone the same seeded board each day, with a streak counter for playing on consecutive days. Practice mode gives you a fresh random board at any difficulty.' },
    ],
  },
  {
    slug: 'strata',
    game: 'strata',
    title: 'Play Strata Online — Free 3D Voxel Deduction Puzzle',
    h1: 'Strata',
    metaDescription:
      'Play Strata free online — a hidden 3D shape is buried in a cube grid. Slice through it to see cross-sections, then reconstruct the exact shape from what you learn. No download, no sign-up.',
    shortDescription: 'Slice a hidden 3D shape to see its cross-sections, then reconstruct it.',
    howToPlay: [
      'A 3D shape is hidden somewhere inside the cube grid — you cannot see it directly.',
      'Query a slice along any axis and layer to reveal that single layer as a flat grid of filled and empty cells.',
      'Use the cross-sections you have gathered to build your best guess of the full 3D shape, layer by layer.',
      'Submit your guess to check it against the hidden shape — an exact match wins, and giving up early still scores partial credit for how close you got.',
    ],
    strategy: [
      'Slice along different axes early — an X-axis slice and a Y-axis slice of the same layer reveal different information about the same region.',
      'A cross-section rules out every cell that is empty in it, not just confirms the cells that are filled — use the negative space too.',
      'You have a limited number of slices, so prioritize the layers most likely to disambiguate between the shapes you are still considering.',
      'Partial credit rewards a close guess, so if you run low on slices, submit your best reconstruction rather than guessing wildly.',
    ],
    faq: [
      { q: 'How do you play Strata?', a: 'Query slices along the X, Y, or Z axis to reveal flat cross-sections of the hidden 3D shape, then paint your guess onto the voxel grid layer by layer and submit it.' },
      { q: 'What happens if I run out of slices?', a: 'You can still submit your best guess or give up — either way you score partial credit based on how close your guess is to the actual hidden shape.' },
      { q: 'Can I play a fresh puzzle every day?', a: 'Yes — Daily mode gives everyone the same seeded shape each day, with a streak counter for playing on consecutive days. Practice mode gives you a fresh random shape at any difficulty.' },
    ],
  },
  {
    slug: 'bankshot',
    game: 'bankshot',
    title: 'Play Bankshot Online — Free Cushion Physics Billiards Puzzle',
    h1: 'Bankshot',
    metaDescription:
      'Play Bankshot free online — aim and fire a ball off cushion walls to reach the target. Real bounce physics and rolling friction decide where it stops. No download, no sign-up.',
    shortDescription: 'Bank the ball off the walls — physics decides where it stops.',
    howToPlay: [
      'Drag from the launch point (or use the angle/power steppers) to aim, then fire.',
      'The ball bounces off the board edges and any walls in its path, slowing down every tick under rolling friction.',
      'Watch where it comes to rest — landing inside the target circle wins the board.',
      'Not happy with a shot? Undo it (a limited number of times) and try a different angle or power.',
    ],
    strategy: [
      'Think in bounces, not straight lines — a wall in the way is often the fastest path to the target, not an obstacle to avoid.',
      'Higher power travels farther before friction kills its speed, but overshooting past the target is just as much a miss as falling short.',
      'Use your undos on early attempts to feel out how a wall’s angle redirects the ball, then commit once you have a read on it.',
      'Fewer shots to sink the target score a bigger bonus, so a confident, well-aimed guess beats poking around at random.',
    ],
    faq: [
      { q: 'How do you play Bankshot?', a: 'Drag from the launch point to set angle and power (or use the steppers / keyboard), then fire. The ball bounces off walls and slows under friction until it stops.' },
      { q: 'What happens if I miss?', a: 'You can undo a limited number of shots to retry, or just fire again — there is no shot limit, only a cap on undos.' },
      { q: 'Can I play a fresh puzzle every day?', a: 'Yes — Daily mode gives everyone the same seeded board each day, with a streak counter for playing on consecutive days. Practice mode gives you a fresh random board at any difficulty.' },
    ],
  },
  {
    slug: 'morse-relay',
    game: 'morse-relay',
    title: 'Play Morse Relay Online — Free Morse Code Typing Game',
    h1: 'Morse Relay',
    metaDescription:
      'Play Morse Relay free online — key a target word in real Morse code by holding for dots and dashes, and resting for the right gaps between them. No download, no sign-up.',
    shortDescription: 'Hold to key dots and dashes, release for gaps — send the word in Morse code.',
    howToPlay: [
      'A target word appears — key it out in Morse code using a single telegraph key.',
      'Hold briefly for a dot, hold longer for a dash, then release. The first press of each word sets the speed the rest of that word is judged against.',
      'Rest between symbols, letters, and words for the right length gap — a wrong gap after a letter breaks your combo and costs the clean-word bonus.',
      'You have five lives. A wrong symbol, or pausing long enough to end a letter before it is finished, costs one. Clear words to advance and keep your run going.',
    ],
    strategy: [
      'Your first press sets the pace for the whole word, so commit to a comfortable, repeatable rhythm from the very first symbol.',
      'Dashes and long gaps both take roughly three times as long as a dot or a short gap — count in multiples of your own unit, not the clock.',
      'A clean run of correct symbols builds a combo multiplier, so consistency is worth more than rushing through individual letters.',
      'Harder levels tighten the timing tolerance, so as your run goes on, aim for your cleanest, most deliberate taps yet.',
    ],
    faq: [
      { q: 'How do you play Morse Relay?', a: 'Hold the telegraph key (on-screen or Spacebar) for a dot or a dash and release, resting between presses for the right gap length. The game calibrates to your own tapping speed from the first press of each word.' },
      { q: 'What happens if I mistime a press?', a: 'A press read as the wrong symbol, or a pause that cuts a letter short, costs one of your five lives. A wrong-length gap after a finished letter only breaks your combo. Lose all five lives and the run ends.' },
      { q: 'Does the game ever end on its own?', a: 'No — Morse Relay is an endless survival run. You score points for cleanly keyed letters (boosted by your combo multiplier) and for each word you finish, with a bonus for mistake-free words.' },
    ],
  },
  {
    slug: 'lagline',
    game: 'lagline',
    title: 'Play Lagline Online — Delayed-Input Lane Dodging Game',
    h1: 'Lagline',
    metaDescription:
      'Play Lagline free online: every move you make lands 3 beats late. Read the lanes ahead, queue dodges and jumps early, and survive as the tempo climbs.',
    shortDescription: 'Every move lands 3 beats late — dodge walls and jump hurdles by planning ahead.',
    howToPlay: [
      'Five lanes of red walls and amber hurdles scroll toward you one row per beat. Press an arrow key, swipe, or tap an on-screen button to start.',
      'Every command (left, right, jump, or stay) joins a queue and runs 3 beats later. The queue strip shows the moves you have committed, and ghost rings show where they will take you; a red ✕ marks a crash.',
      'Walls always end the run, so move out of their lane. Hurdles must be jumped: a jump keeps you in the same lane. If you press nothing during a beat, you stay where you are; if you press more than once, only the last press counts.',
      'Your score is the number of beats you survive. Every 32 beats a new stage speeds the tempo up from 96 BPM toward 160, and reaching 160 beats counts as staying in sync.',
    ],
    strategy: [
      'Look at the row as many beats ahead as the Lag badge shows, not the row you are standing on. That is the row your next press will actually land on.',
      'Trust the ghost rings. If one shows a red ✕, queue a correction right away; any later press can only change beats further down the line.',
      'Stay near the middle lanes when you can. From lane 3 you can reach either side, while an edge lane cuts your escape routes in half.',
      'From stage 5 the second half of each stage stretches the lag to 4. The beat it grows forces a stay, and the beat it shrinks back shows SYNC and ignores your input, so plan around both.',
    ],
    faq: [
      { q: 'How do you play Lagline?', a: 'Steer a runner across five lanes with the arrow keys or WASD (Space also jumps), by swiping, or with the on-screen buttons. Every command is queued and runs 3 beats after you give it, so you dodge walls and jump hurdles by reading the field ahead.' },
      { q: 'Why did my move happen late?', a: 'That is the core rule. Moves always run on a delay of 3 beats, or 4 during the purple "Lag 4" stretches from stage 5 on. On the beat the lag shrinks back to 3, the queue slot shows SYNC and that beat\'s input is ignored.' },
      { q: 'Is every run winnable?', a: 'The first 8 rows are always empty, and each new row is generated so that at least one lane stays reachable under the movement rules. A careful planner always has a way through. Pressing P or Esc pauses the run, and switching tabs pauses it automatically.' },
    ],
  },
  {
    slug: 'recoil',
    game: 'recoil',
    title: 'Play Recoil Online — Zero-Gravity Shooting Puzzle Game',
    h1: 'Recoil',
    metaDescription:
      'Play Recoil free online: every shot pushes your ship the opposite way. Bounce off walls, collect all five stars and save rounds in a frictionless arena.',
    shortDescription: 'Shooting is your only thruster — kick yourself through a frictionless box to grab all five stars.',
    howToPlay: [
      'Aim the ship’s gun by pointing with the mouse, touching and dragging on the arena, or with the keys: ←/→ turn 22.5° (hold Shift for 90°), ↑/↓ point straight up or down.',
      'Fire by releasing the click or tap, or with Space / Enter. Each shot pushes the ship exactly one unit of speed in the opposite direction to your aim — shooting is the only way to move.',
      'There is no friction: you keep drifting until another shot changes your velocity. The outer walls and the purple bars bounce you back with no speed lost. Fly through all five stars to win.',
      'Rounds are limited — 14 on Easy, 12 on Normal, 10 on Hard. With the magazine empty you get 8 seconds of drift to reach the remaining stars, and the run ends at once if your last shot leaves you motionless.',
    ],
    strategy: [
      'Trust the dotted ghost line: it traces the next 45 ticks (about three-quarters of a second) of flight for the direction you are aiming, bounces included.',
      'To brake, fire in the direction you are already moving — even at top speed one shot takes off a full unit. A shot followed by one in exactly the opposite direction cancels out completely, unless the first only pushed against the speed limit. A slow ship is far easier to steer than a fast one.',
      'Let the walls do the turning. A bounce costs nothing, and any star you collect after a bounce since your last shot is a bank shot worth an extra 50 points.',
      'Spend rounds sparingly: every unused round pays 150 on a win, more than a star, while the time bonus (up to 600) drops 10 points per second. Try to finish at or under the par shown above the arena.',
    ],
    faq: [
      { q: 'How is Recoil scored?', a: 'Each star is worth 100, plus 50 more if it was a bank shot. Collecting all five adds a 500 win bonus, 150 for every unused round, and a time bonus of up to 600 that shrinks by 10 points per second after your first shot. A failed run keeps its star and bank points.' },
      { q: 'Why did my run end while I was still moving?', a: 'Once you are out of rounds you only have 8 seconds of drift to collect the remaining stars. If you finish a shot with zero velocity and no rounds left, the run ends immediately as "Dead in space".' },
      { q: 'Is there a daily board or a way to challenge friends?', a: 'Daily mode gives everyone the same Normal board each UTC day, with a streak for daily wins; Practice deals a fresh board at Easy, Normal or Hard. After any run that scored points you can send a challenge link — it carries the board and difficulty, so your friend flies the exact same walls and stars against your score. Challenge runs do not count toward your best or your streak.' },
    ],
  },
  {
    slug: 'hunch',
    game: 'hunch',
    title: 'Play Hunch Online — Crack the Hidden Card Rule',
    h1: 'Hunch',
    metaDescription:
      'Test cards against a secret rule, read what gets accepted, then call five verdicts in a row to crack it. Three rules per run and a new daily set every day.',
    shortDescription: 'Test cards, spot the hidden rule, then call five verdicts in a row to crack it.',
    howToPlay: [
      'A hidden rule decides which cards are accepted. Tap a card in your eight-card hand, then tap it again (or press Test card) to try it. Accepted cards join the main line, and rejected ones hang under the last card on the line.',
      'Each run has three stages. Stage 1 rules judge the card alone. Stage 2 rules compare it with the last accepted card on the line. Stage 3 rules combine two clues. The START card is just a random opener.',
      'When you think you know the rule, press Predict. A probe card appears, and you call Accept or Reject. Five correct calls in a row crack the rule and move you to the next stage. You can go back to testing at any time, but that resets your streak.',
      'A wrong call costs one of three lives and sends you back to testing. You get 40 tests per stage. Crack all three rules to win. Lose your last life and the run ends with the rule revealed.',
    ],
    strategy: [
      'Pick tests that split your guesses. If you suspect "red", play a red card and a black card of the same rank, not two more hearts.',
      'From stage 2 on, judge every card against the last accepted card, not the last one you played. Rejected cards never become the reference.',
      'Probes are a deliberate mix of cards the rule accepts and rejects, so answering the same way every time will not work. Only predict when you can explain every card on the line.',
      'Each stage pays 20 extra points for every test you save under 20, so after a few tests a confident prediction beats more probing. Unused lives pay a bonus when you finish the run.',
    ],
    faq: [
      { q: 'How is Hunch scored?', a: 'Each correct prediction is worth 10 points. Cracking a stage adds a base bonus of 300, 500 or 800 points, plus 20 for every test you used under 20. Winning all three stages adds 150 points per life you have left.' },
      { q: 'What kinds of rules are there?', a: 'There are 36 rules, 12 per stage. Stage 1 rules look at one card: its color, suit or rank. Stage 2 rules compare a card with the last accepted card. Stage 3 rules combine two such clues with "and" or "or".' },
      { q: 'What is the difference between Daily and Practice?', a: 'Daily gives everyone the same three rules and deck for the UTC day, keeps a streak and has a shareable result. Practice deals a new rule set every time. Any run that scores can also become a challenge link that replays your exact rules and deck for a friend.' },
    ],
  },
]
