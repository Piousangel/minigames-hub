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
      { q: 'Is Tetris free to play here?', a: 'Yes — this Tetris runs free in your browser with no download, install, or account, on both desktop and mobile.' },
      { q: 'How do I play Tetris on mobile?', a: 'On-screen buttons let you move, rotate, soft-drop, and hard-drop with your thumbs. Everything works by touch.' },
      { q: 'What is a "Tetris"?', a: 'Clearing four lines at once with a single vertical I-piece. It is the highest-scoring single move in the game.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser (localStorage) and persists between visits on the same device.' },
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
      { q: 'Does it track my best?', a: 'Yes — your fewest-moves best is saved in your browser and shown between games on the same device.' },
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
      { q: 'Is Breakout free to play?', a: 'Yes — this brick breaker runs free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How do I control the paddle on mobile?', a: 'Slide your finger across the play area and the paddle follows. Tap to launch the ball.' },
      { q: 'How many lives do I get?', a: 'Three. You lose a life whenever the ball falls past your paddle, and the game ends at zero.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser and persists between visits on the same device.' },
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
      { q: 'Is Word Guess free?', a: 'Yes — it plays free in your browser with no download, install, or account, on desktop and mobile.' },
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
      { q: 'Is it free to play?', a: 'Yes, completely free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does it keep score?', a: 'Yes. Your wins, losses, and draws are saved in your browser between games on the same device.' },
      { q: 'Do I play against a person?', a: 'You play against the computer. It responds to each of your moves automatically.' },
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
      { q: 'Does it save my best?', a: 'Yes. Your fastest time is stored in your browser and shown between attempts on the same device.' },
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
      { q: 'Is Connect Four free to play?', a: 'Yes — it runs free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How do I win?', a: 'Be the first to line up four of your discs in a row, in any direction: horizontal, vertical, or diagonal.' },
      { q: 'How hard is the computer?', a: 'Easy makes casual moves; Hard always takes a winning move, blocks your threats, and favours the centre.' },
      { q: 'Does it keep my record?', a: 'Yes. Your wins are saved in your browser and persist between games on the same device.' },
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
      { q: 'Is Hangman free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
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
      { q: 'Is Simon free to play?', a: 'Yes — it runs free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How does it get harder?', a: 'Every round adds one more step to the sequence and the playback speeds up, so it gets tougher the longer you last.' },
      { q: 'Can I play on my phone?', a: 'Yes. Just tap the colour pads — the whole game works by touch.' },
      { q: 'Does it save my best?', a: 'Yes. Your best round is saved in your browser between games on the same device.' },
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
      { q: 'Is it free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
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
      { q: 'Is it free?', a: 'Yes — it runs free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does it work on mobile?', a: 'Yes. Tap the targets instead of clicking; the play area is fully touch-friendly.' },
      { q: 'Does it save my best?', a: 'Yes. Your best run is stored in your browser and shown between attempts on the same device.' },
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
      { q: 'Is Sudoku free here?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
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
      { q: 'Is it free?', a: 'Yes — Rock Paper Scissors plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Is the computer random?', a: 'The computer picks its move at random each round, so every game is a fair coin-flip of skill and luck.' },
      { q: 'Does it keep score?', a: 'Yes. Your running win/loss/draw tally and best streak are saved in your browser between games.' },
      { q: 'Can I play a match?', a: 'Yes. Play endlessly or set a first-to-3 or first-to-5 match to crown a winner.' },
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
      { q: 'Is Pong free to play?', a: 'Yes — it runs free in your browser with no download or sign-up, on desktop and mobile.' },
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
      { q: 'Is Lights Out free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How does tapping work?', a: 'Tapping a light flips it and its four orthogonal neighbors. Corner and edge cells flip fewer lights.' },
      { q: 'Does it track my best?', a: 'Yes. Your fewest-moves best is saved in your browser between games on the same device.' },
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
      { q: 'Is Mastermind free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
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
      { q: 'Is Bubble Shooter free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How do I pop bubbles?', a: 'Land a bubble next to two or more of the same colour so the connected group is three or more, and they pop.' },
      { q: 'What are the dropping bubbles?', a: 'When you pop the bubbles holding up others, the now-disconnected bubbles fall and score bonus points.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is it free to play?', a: 'Yes — it runs free in your browser with no download or sign-up, on desktop and mobile.' },
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
      { q: 'Is Sokoban free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
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
      { q: 'Is it free to play?', a: 'Yes — it runs free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Do I play a person or the computer?', a: 'You play against the computer. Choose Easy for a casual game or Hard for a sharp opponent.' },
      { q: 'Does it keep score?', a: 'Yes. Your wins are saved in your browser and persist between games on the same device.' },
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
      { q: 'Is Flappy free to play?', a: 'Yes — it runs free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How do I control it?', a: 'One input: click, tap, or press Space to flap. That is the whole game.' },
      { q: 'How do I score?', a: 'You earn a point each time you pass safely through the gap between a pair of pipes.' },
      { q: 'Does my best score save?', a: 'Yes. Your best run is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is it free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does it keep my record?', a: 'Yes. Your wins are saved in your browser and persist between games on the same device.' },
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
      { q: 'Is it free?', a: 'Yes — it runs free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How do I play on mobile?', a: 'Swipe in the direction you want to move, or use the on-screen D-pad. No keyboard needed.' },
      { q: 'Does it track my best?', a: 'Yes. Your best time for each size is saved in your browser between games.' },
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
      { q: 'Is it free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How long is the number shown?', a: 'A few seconds, scaling slightly with length, then it hides and you type it from memory.' },
      { q: 'Does it save my best?', a: 'Yes. Your highest level reached is saved in your browser between games.' },
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
      { q: 'Is Word Search free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
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
      { q: 'Is it free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How do I win?', a: 'Own the most discs when neither player can make a legal move. Trapping and flipping lines is how you take the lead.' },
      { q: 'Does it keep my record?', a: 'Yes. Your wins are saved in your browser and persist between games on the same device.' },
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
      { q: 'Is Gem Match free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is Space Shooter free?', a: 'Yes — it runs free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How do I control my ship?', a: 'Arrow keys or mouse/touch drag to move, and Space or tap to fire. Hold to keep shooting.' },
      { q: 'How do I win a wave?', a: 'Destroy every alien in the formation. Clearing a wave brings a new, faster one.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is it free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does my best save?', a: 'Yes. Your best height is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is Prospector free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Is it luck or skill?', a: 'Both. Tiles are shuffled, but the deck is fully known and flipped tiles stay visible, so banking is a countable expected-value decision.' },
      { q: 'What ends a descent?', a: 'Banking (safe, you keep your loot) or flipping the third gas tile (the shaft collapses and you lose the un-banked pot).' },
      { q: 'Does my best save?', a: 'Yes. Your best banked run is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is it free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is Overload free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'How do I score high?', a: 'Trigger long cascades — each overload in a single chain raises the combo multiplier, so one perfect tap can sweep the grid.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is Ricochet free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is Stackpot free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is it free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does my best save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is Ripple free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does my best score save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
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
      { q: 'Is it free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does my best save?', a: 'Yes. Your best final worth is stored in your browser and persists between games on the same device.' },
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
      'Different colours colliding jam a cell permanently. Seal every pip to solve the board.',
    ],
    strategy: [
      'Every fold shrinks the paper permanently, so plan the order — the board only gets smaller.',
      'Line up matching pips to land on each other, and try to seal several in a single fold.',
      'Avoid folding different colours onto each other; a jam blocks that cell for good.',
      'Use Unfold sparingly to recover from a bad fold — it is your only safety valve.',
      'Every board is solvable within its par fold count; chase a cleaner solve each retry.',
    ],
    faq: [
      { q: 'How does folding work?', a: 'Tapping a crease folds the smaller flap over the rest, reflecting its cells onto the ones beneath so pips can meet, seal, or jam.' },
      { q: 'Is every board solvable?', a: 'Yes. Each board is generated by scrambling a solved layout with inverse folds, so there is always a way to seal every pip.' },
      { q: 'Is Overfold free?', a: 'Yes — it plays free in your browser with no download or sign-up, on desktop and mobile.' },
      { q: 'Does my best save?', a: 'Yes. Your best score is stored in your browser and persists between games on the same device.' },
    ],
  },
]
