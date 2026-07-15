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
]
