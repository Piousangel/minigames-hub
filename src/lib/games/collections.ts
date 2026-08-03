import type { NeonAccent } from './gameMeta'

/**
 * 롱테일 컬렉션 — 무권위 신생 사이트가 실제로 이길 수 있는 "대안 탐색(games like X)"·"태그형
 * 의도(word/number/2-player/logic games)"를 각각의 URL로 잡는다(팀 결정 ⑤: 팀이 100% 통제 가능한
 * 유일 트래픽 채널). /category 4종(장르)보다 "좁은 의도"로 한정해 카니벌라이제이션·doorway를 피한다.
 *
 * 규약(collections.test.ts가 강제): 멤버 slug ≥5, 모든 slug은 registry에 존재, intro/FAQ는
 * 컬렉션마다 고유(near-duplicate 금지). 각 페이지는 canonical 자기지정.
 */
export interface Collection {
  slug: string
  h1: string
  title: string
  metaDescription: string
  /** 150~300단어 고유 프로즈. 얇은/중복 콘텐츠는 색인·랭킹을 죽인다. */
  intro: string
  games: string[] // 큐레이션된 순서, ≥5, 전부 registry에 존재
  faq: { q: string; a: string }[]
  accent: NeonAccent
}

export const COLLECTIONS: Record<string, Collection> = {
  'games-like-wordle': {
    slug: 'games-like-wordle',
    h1: 'Games Like Wordle',
    title: 'Games Like Wordle — Free Daily Word Puzzles, No App',
    metaDescription:
      'Love Wordle? Play free games like it — daily word-guessing puzzles you solve in a few tries, with color clues and a shareable grid. Quadle, word guess, Clusters and more, in your browser, no account.',
    intro:
      'If you finish Wordle every morning and want more of the same itch, this is the shelf for you. These are free browser games built on the same loop that made Wordle a habit: a small, fair puzzle with one right answer, color clues after every guess, and a spoiler-free grid you can share to compare with friends. Some stick close to the original one-word format, while others stretch it — solve four words at once, group sixteen tiles into hidden sets, or crack a hidden equation. Every one has a fresh daily board that is the same for everyone that day, so there is a new reason to come back tomorrow, and a streak to protect once you get going. No app, no account, no paywall — they load instantly and remember your streak right in your browser. Start with the closest cousins below and work outward as you get hooked.',
    games: ['quadle', 'word-guess', 'clusters', 'hangman', 'equate', 'word-search'],
    faq: [
      { q: 'Are these really free like Wordle?', a: 'Yes. Every game here is free in your browser with no account and no download. Your daily streak and stats save locally.' },
      { q: 'Which one is closest to Wordle?', a: 'The one-word guessing games are closest. Quadle takes it further — four hidden words solved with a shared set of guesses.' },
      { q: 'Is there a new puzzle every day?', a: 'Yes. Each of these has a daily board generated from the date, so everyone gets the same puzzle that day, plus a practice mode for unlimited plays.' },
      { q: 'Can I share my result without spoilers?', a: 'Yes. Each daily game makes a colored-square grid that shows how you did without revealing the answer.' },
    ],
    accent: 'lime',
  },

  'games-like-connections': {
    slug: 'games-like-connections',
    h1: 'Games Like Connections',
    title: 'Games Like Connections — Free Daily Grouping Puzzles',
    metaDescription:
      'Enjoy NYT Connections? Play free games like it — daily grouping and word puzzles where you sort tiles into hidden sets. Clusters and more, in your browser, no account, no app.',
    intro:
      'Connections turned a simple idea — sort sixteen words into four secret groups — into a daily ritual, and the satisfying part is spotting the trap tiles that look like they belong in two places at once. If that is the puzzle you crave, these free browser games scratch it. The headliner is a daily grouping puzzle with four hidden sets, four mistakes to spend, and a trickiest group that is deliberately misleading. Around it sit word games that reward the same kind of lateral thinking: guessing games, word searches, and grid puzzles where the answer hides in plain sight. All of them are free, run instantly with no download, and keep a streak in your browser so a missed day stings a little — which is the whole point. Everyone plays the same daily board, so you can compare how you did with a spoiler-free share grid. Begin with the grouping puzzle below, then branch into the wider word-puzzle set.',
    games: ['clusters', 'quadle', 'word-guess', 'word-search', 'hangman', 'equate'],
    faq: [
      { q: 'Which game is most like Connections?', a: 'The grouping puzzle, Clusters — sixteen tiles, four hidden groups of four, four mistakes allowed, with a deliberately tricky purple group.' },
      { q: 'Do I get a new puzzle daily?', a: 'Yes. The daily games generate the same board for everyone each day from the date, and practice mode gives endless fresh boards.' },
      { q: 'Are they free and account-free?', a: 'Yes. Free in the browser, no sign-up, no download. Streaks and stats save locally.' },
      { q: 'Can I share without spoiling the answer?', a: 'Yes. The share card is a grid of colored squares — it shows your path, not the solution.' },
    ],
    accent: 'lime',
  },

  'games-like-2048': {
    slug: 'games-like-2048',
    h1: 'Games Like 2048',
    title: 'Games Like 2048 — Free Merge & Number Tile Games',
    metaDescription:
      'Hooked on 2048? Play free games like it — slide and merge number tiles, match gems, and stack blocks to chase a high score. In your browser, no download, no sign-up.',
    intro:
      'The magic of 2048 is the one-more-slide compulsion: every swipe merges tiles, doubles a number, and inches you toward a bigger goal while the board quietly fills up. If that pull is what you are after, this set delivers the same tile-sliding, number-climbing, just-one-more-run feeling for free in your browser. You will find the original doubling game and a themed twist on it, plus games that share its DNA in different shapes — matching gems into clears, stacking falling blocks into tidy rows, and building tall towers a tap at a time. They all reward planning a couple of moves ahead and punish greedy ones, and each keeps your best score locally so there is always a number to beat. Nothing to install and no account to make — pick a board and start climbing. Your high score saves in the browser, and many of these have a weekly online leaderboard if you want to push past your personal best.',
    games: ['2048', '2048-animals', 'gem-match', 'tetris', 'tower-stack', 'sliding-puzzle', 'bubble-shooter'],
    faq: [
      { q: 'Is the original 2048 here?', a: 'Yes — the classic slide-and-merge game plus an animal-themed variant with the same doubling mechanic.' },
      { q: 'What makes a game "like 2048"?', a: 'The merge-and-climb loop: combine matching pieces into bigger ones and chase a high score. Tile-matching, stacking and tower games share that pull.' },
      { q: 'Do my scores save?', a: 'Yes, in your browser, and several of these have a weekly online leaderboard you can submit to.' },
      { q: 'Do they work on mobile?', a: 'Yes. They support touch and swipe controls and run on phones and tablets as well as desktop.' },
    ],
    accent: 'amber',
  },

  'word-games': {
    slug: 'word-games',
    h1: 'Free Word Games',
    title: 'Free Word Games — Play Word Puzzles Online, No Download',
    metaDescription:
      'Play free word games online — word guessing, hangman, word search, grouping and multi-word puzzles. Daily boards and a streak, in your browser, no sign-up.',
    intro:
      'A good word game is the perfect small break: quick to start, hard to put down, and just the right amount of clever. This collection gathers the browser word puzzles on the site in one place, from the daily guessing games that have become a morning habit to the classics you already know how to play. Guess a hidden five-letter word from color clues, race the clock in hangman, hunt terms in a letter grid, or sort a jumble of tiles into their hidden groups. Several have a daily board that is identical for every player that day, plus a practice mode when one puzzle is not enough. They are all free, need no account, and load instantly with nothing to install, and the daily ones keep a streak in your browser to pull you back tomorrow. Whether you want a five-minute warm-up or a genuine head-scratcher, there is a word puzzle here for it — start with a daily below or dive into a classic.',
    games: ['word-guess', 'quadle', 'clusters', 'word-search', 'hangman', 'equate'],
    faq: [
      { q: 'Are these word games free?', a: 'Yes. Every word game plays free in your browser with no account and no download.' },
      { q: 'Which have a daily puzzle?', a: 'The guessing and grouping games have a daily board that is the same for everyone that day, with a streak that saves locally.' },
      { q: 'Do they work on phones?', a: 'Yes. They use an on-screen keyboard and touch controls, so they work on mobile as well as desktop.' },
      { q: 'Do my streaks save?', a: 'Yes, in your browser — no account needed. Miss a day and a streak freeze can bridge it.' },
    ],
    accent: 'cyan',
  },

  'two-player-games': {
    slug: 'two-player-games',
    h1: 'Free 2 Player Games',
    title: 'Free 2 Player Games — Chess, Checkers & Classics vs a Friend',
    metaDescription:
      'Play free 2 player games online — chess, checkers, connect four, mancala, reversi, tic-tac-toe and dots and boxes. Take turns against a friend or the computer, in your browser, no download.',
    intro:
      'Some games are best with an opponent, and these are the timeless ones — quick to learn, endlessly replayable, and just as fun across a table as against a clever computer. This collection rounds up the turn-based classics on the site: outsmart your rival in chess, jump pieces in checkers, drop discs to connect four, sow and capture in mancala, flip the board in reversi, line up three in tic-tac-toe, and close the most squares in dots and boxes. Each plays instantly in the browser with no download and no sign-up, and you can pass-and-play with a friend on the same device or test yourself against a built-in opponent at the difficulty you choose. They are the kind of games that fill a spare few minutes without any setup — no board to dig out, no pieces to lose. Pick one below, choose your side, and take the first move. Every one works on phone, tablet and desktop, so the next match is always a tap away.',
    games: ['chess', 'checkers', 'connect-four', 'gomoku', 'mancala', 'reversi', 'dominoes', 'tic-tac-toe', 'dots-and-boxes'],
    faq: [
      { q: 'Can I play these against a friend?', a: 'Yes. These turn-based classics work as pass-and-play on one device, and several also offer a computer opponent.' },
      { q: 'Are they free?', a: 'Yes. Every game is free in your browser with no account and no download.' },
      { q: 'Do I need to install anything?', a: 'No. They run in any modern browser on phone, tablet or desktop — nothing to install.' },
      { q: 'Can I choose a difficulty?', a: 'For the games with a computer opponent, yes — you can pick how hard the AI plays.' },
    ],
    accent: 'red',
  },

  'solitaire-games': {
    slug: 'solitaire-games',
    h1: 'Free Solitaire Games',
    title: 'Free Solitaire Games — Klondike, Spider, FreeCell & More',
    metaDescription:
      'Play free solitaire games online — Klondike, Spider, FreeCell, Pyramid and TriPeaks. Every classic patience game in your browser, no download and no sign-up.',
    intro:
      'Every solitaire worth playing, free and instant in your browser — no download, no account, no ads getting in the way of the cards. Whether you grew up on the Klondike deal that shipped with every computer or you prefer the pure skill of an open board, this shelf has the patience game for you. Play classic Klondike with its stock and foundations, take on FreeCell where every card is face-up and almost every deal can be won, clear the eight suit runs of Spider at one, two or four suits, pair cards up to thirteen in Pyramid, or chain your way across the three peaks of TriPeaks. Each one keeps your best score in your browser, plays perfectly on phone or desktop, and starts a fresh shuffled deal whenever you want one. These are the games people come back to for years — quiet, satisfying, and always one more deal away. Pick a variant below and deal yourself in.',
    games: ['solitaire', 'freecell', 'spider', 'pyramid', 'tripeaks', 'golf-solitaire', 'yukon-solitaire'],
    faq: [
      { q: 'Which solitaire games are here?', a: 'Klondike (the classic solitaire), FreeCell, Spider (1, 2 and 4 suit), Pyramid, TriPeaks, Golf and Yukon — the most popular patience games, all free.' },
      { q: 'Which solitaire is easiest to win?', a: 'FreeCell — every card is dealt face-up, so almost every game can be won with careful planning. Klondike and Spider involve more luck.' },
      { q: 'Are they really free with no download?', a: 'Yes. Every solitaire game runs instantly in your browser with no install and no account. Your best scores save locally.' },
      { q: 'Do they work on mobile?', a: 'Yes. All of them use tap-to-move controls and play well on phones and tablets as well as desktop.' },
    ],
    accent: 'green',
  },

  'games-like-snake': {
    slug: 'games-like-snake',
    h1: 'Games Like Snake',
    title: 'Games Like Snake — Free Retro Arcade High-Score Games',
    metaDescription:
      'Loved Snake? Play free games like it — fast retro arcade games where one more run always beats your high score. Tetris, breakout, space shooter and more, in your browser, no download.',
    intro:
      'Snake is the phone-era classic that taught a generation the one-more-go reflex: a simple rule, a rising high score, and a run that ends the instant you get greedy. If that twitchy, keep-going arcade feeling is what you are chasing, this shelf is built for it. These are fast, free browser games where a single mistake ends the run and the only goal is to beat the number you got last time — dodge, stack, blast and pop your way up the board. Stack falling blocks into clean rows, break every brick, shoot down waves in space, or thread a bird through gaps that keep coming. None of them need a download or an account, they load in a second, and your best score is saved right in the browser so there is always a target on your back. Several also feed a weekly online leaderboard if you want to see how your reflexes stack up against everyone else. Pick a cabinet below and start a run.',
    games: ['snake', 'tetris', 'breakout', 'space-shooter', 'flappy', 'pong', 'bubble-shooter'],
    faq: [
      { q: 'What makes a game "like Snake"?', a: 'The arcade high-score loop: a simple rule, a run that ends on one mistake, and the pull to immediately try again and beat your last score.' },
      { q: 'Are they free with no download?', a: 'Yes. Every game runs instantly in your browser with no install and no account.' },
      { q: 'Do they keep a high score?', a: 'Yes, in your browser, and several also have a weekly online leaderboard you can submit to.' },
      { q: 'Do they work with touch controls?', a: 'Yes. They support touch and swipe input, so they play well on phones and tablets.' },
    ],
    accent: 'green',
  },

  'quick-games': {
    slug: 'quick-games',
    h1: 'Quick Games — Fun in Five Minutes',
    title: 'Quick Games — Free 5-Minute Games to Play on a Break',
    metaDescription:
      'Only have five minutes? Play free quick games — reaction time, aim trainer, whack-a-mole, typing test and more. Instant fun on a break, in your browser, no download.',
    intro:
      'Sometimes you just want a quick hit of fun on a coffee break, in a queue, or between tasks — no tutorial, no long game to commit to, just pick up and play. These are the fastest games on the site, the kind you can start and finish in a couple of minutes and still walk away with a score to beat next time. Test how fast you can react to a flash of colour, snap your aim onto targets before they vanish, whack moles as they pop, race the clock to type as many words as you can, or repeat a growing pattern until your memory cracks. Each one is instant to start, needs no download or account, and saves your best result locally so a spare moment always has a tiny challenge waiting. They are perfect for a short break and just as good for a quick warm-up before something longer. Grab any of them below — you will be playing within a second or two.',
    games: ['reaction-time', 'aim-trainer', 'whack-a-mole', 'typing-test', 'simon', 'number-memory', 'rock-paper-scissors', 'maze'],
    faq: [
      { q: 'How long do these take?', a: 'A minute or two each. They are designed for a quick break — start, play a round, beat your score, done.' },
      { q: 'Are they free?', a: 'Yes. Free in your browser with no download and no account.' },
      { q: 'What do they measure?', a: 'Reflexes, aim, memory and typing speed — quick skills you can improve with a few tries.' },
      { q: 'Do my best results save?', a: 'Yes, in your browser, and some have a weekly online leaderboard as well.' },
    ],
    accent: 'amber',
  },

  'games-like-nerdle': {
    slug: 'games-like-nerdle',
    h1: 'Games Like Nerdle',
    title: 'Games Like Nerdle — Free Daily Math & Number Puzzles',
    metaDescription:
      'Enjoy Nerdle? Play free games like it — daily math and number puzzles that reward logic, not luck. Equate, Sudoku, 2048 and more, in your browser, no download, no sign-up.',
    intro:
      'Nerdle proved that the daily-puzzle habit works just as well with numbers as with words: a hidden equation, a handful of guesses, and colour clues that turn arithmetic into deduction. If you like puzzles where the answer is a matter of logic rather than luck, this collection is your kind of maths. The centrepiece is a daily equation-guessing game — crack the hidden sum in six tries using standard order of operations — surrounded by other number and logic puzzles that reward the same careful thinking. Fill a Sudoku grid without a contradiction, slide tiles to build ever-bigger numbers, crack a secret code, or push your recall in a number-memory test. Every one is free, runs instantly with no download or account, and the daily puzzle keeps a streak in your browser to bring you back tomorrow. Whether you want a strict logic grind or a quick numbers warm-up, there is a puzzle here that adds up. Start with the daily equation below and branch out from there.',
    games: ['equate', 'sudoku', '2048', 'number-memory', 'mastermind', 'minesweeper'],
    faq: [
      { q: 'Which game is most like Nerdle?', a: 'Equate — a daily puzzle where you guess a hidden eight-character equation in six tries, with green/purple/grey colour clues after each guess.' },
      { q: 'Do these need maths skills?', a: 'Basic arithmetic and logic, not advanced maths. They reward careful reasoning and pattern-spotting more than calculation speed.' },
      { q: 'Is there a daily puzzle?', a: 'Yes. The equation game has a daily board that is the same for everyone that day, with a streak, plus a practice mode for endless puzzles.' },
      { q: 'Are they free and account-free?', a: 'Yes. Free in your browser, no download and no sign-up. Progress saves locally.' },
    ],
    accent: 'purple',
  },

  'logic-games': {
    slug: 'logic-games',
    h1: 'Free Logic Puzzle Games',
    title: 'Free Logic Puzzle Games — Deduction Puzzles Online, No App',
    metaDescription:
      'Play free logic puzzle games online — Sudoku, minesweeper, nonogram, Unblock, Flow, sokoban, lights out and mastermind. Pure deduction, no luck, in your browser with no download.',
    intro:
      'Logic puzzles are the quiet, satisfying kind: no timer pressure unless you want it, no luck involved, just you and a solvable board that always has one right answer if you reason carefully enough. This collection gathers the deduction puzzles on the site for anyone who likes to think a few steps ahead. Fill a Sudoku grid without a contradiction, clear a minefield from the numbers alone, paint a hidden picture in a nonogram, slide the jammed blocks aside to free the trapped one in Unblock, connect every pair and fill every square in Flow, push crates onto their targets in sokoban, switch off every light, or crack a secret code in mastermind. Each one rewards patience and pattern-spotting rather than fast fingers, and every board is fair — the answer is always deducible, never a guess. They are free, run instantly in the browser with nothing to install, and save your progress locally so you can put a hard one down and come back to it. If you like the feeling of a puzzle clicking into place, start with any board below.',
    games: ['sudoku', 'kakuro', 'minesweeper', 'nonogram', 'unblock', 'flow', 'sokoban', 'lights-out', 'mastermind'],
    faq: [
      { q: 'Are these puzzles solvable by logic alone?', a: 'Yes. Every board has a unique solution reachable by deduction — no guessing or luck required.' },
      { q: 'Are they free and account-free?', a: 'Yes. Free in your browser, no download and no sign-up. Progress saves locally.' },
      { q: 'Do they work on mobile?', a: 'Yes. They support touch input and work on phones and tablets as well as desktop.' },
      { q: 'Is there a timer?', a: 'Some track your time so you can beat your best, but you can take as long as you like to solve the board.' },
    ],
    accent: 'blue',
  },

  'brain-games': {
    slug: 'brain-games',
    h1: 'Free Brain Games',
    title: 'Free Brain Games — Puzzles to Train Focus & Memory, No App',
    metaDescription:
      'Play free brain games online — puzzles and brain teasers that stretch memory, focus and reasoning. Flow, Unblock, Sudoku, memory, mastermind and more, in your browser, no download or sign-up.',
    intro:
      'Brain games are the ones you play to feel a little sharper afterwards — small puzzles that make you hold a plan in your head, spot a pattern, or reason your way to the only answer that fits. This collection pulls together the site’s best brain teasers into one place, mixing pure logic with memory and focus. Trace pipes to connect every pair and fill the grid in Flow, slide the jammed traffic aside to free the trapped block in Unblock, fill a Sudoku without a contradiction, hold a growing pattern in your head in the memory games, or crack a hidden code in mastermind. What they share is that they reward thinking over reflexes: there is no luck to blame and no timer forcing a rushed move unless you want the challenge. Every one is free, loads instantly in your browser with nothing to install, and saves your progress and best scores locally so you can build a daily habit. They work just as well on a phone during a commute as on a desktop, so pick a puzzle below and give your brain a proper workout.',
    games: ['flow', 'unblock', 'sudoku', 'kakuro', 'memory-game', 'mahjong', 'mastermind', 'number-memory', 'nonogram', 'minesweeper'],
    faq: [
      { q: 'Do brain games actually help?', a: 'They are a fun, low-stakes way to practise focus, working memory and logical reasoning. Treat them as enjoyable mental exercise rather than a medical claim.' },
      { q: 'Which one should I start with?', a: 'Flow and Unblock are the most approachable — clear rules and instant feedback. Sudoku and mastermind reward deeper, slower thinking.' },
      { q: 'Are they free and account-free?', a: 'Yes. Every game is free in your browser with no sign-up and no download. Your progress and best scores save locally.' },
      { q: 'Do they work on mobile?', a: 'Yes. They all support touch controls and scale to phones and tablets as well as desktop.' },
    ],
    accent: 'purple',
  },

  'family-games': {
    slug: 'family-games',
    h1: 'Free Family Games',
    title: 'Free Family Games Online — Classic Tabletop Games, No App',
    metaDescription:
      'Play free family games online — the classic tabletop games everyone knows: Yahtzee, Mancala, dominoes, connect four, checkers and chess. Simple rules, quick rounds, in your browser, no download or sign-up.',
    intro:
      'These are the games that come out at the kitchen table — the ones with rules simple enough for a kid and enough bite to keep a grown-up hooked. This collection gathers the timeless tabletop classics in one place, no box to dig out and no pieces to lose down the sofa. Roll for a full house in Yahtzee, sow and capture your way around a Mancala board, match the ends in dominoes, drop discs to connect four, jump for a double in checkers, or settle it over a game of chess. They are the kind of games that turn ten spare minutes into a proper round, whether you are passing a phone back and forth on a car trip or playing the computer while you wait. Every one is free, loads instantly in the browser with nothing to install, keeps your record or best score locally, and scales cleanly to a phone, tablet or laptop. Pick a game below and deal everyone in.',
    games: ['yahtzee', 'mancala', 'battleship', 'dominoes', 'connect-four', 'checkers', 'chess', 'gomoku', 'jigsaw'],
    faq: [
      { q: 'Which of these is best for younger players?', a: 'Connect four, dominoes and Mancala have the simplest rules and quick rounds, so they are easy for kids to pick up while still fun for adults.' },
      { q: 'Can we play together on one device?', a: 'Yes. The two-player games support pass-and-play on a single phone or tablet, and several also offer a computer opponent when you are on your own.' },
      { q: 'Are they really free?', a: 'Yes. Every game is free in your browser with no account and no download. Your win record or best score saves locally.' },
      { q: 'Do they work on a phone?', a: 'Yes. All of them are built mobile-first with big touch targets and scale to phones, tablets and desktops.' },
    ],
    accent: 'amber',
  },

  'original-games': {
    slug: 'original-games',
    h1: 'Original Games',
    title: 'Original Online Games — Unique Games You Won’t Find Elsewhere',
    metaDescription:
      'Play original games you won’t find anywhere else — small, inventive puzzle, skill and nerve games designed and built just for Quick MiniGames. Free in your browser, no download, no sign-up.',
    intro:
      'Most game sites are shelves stacked with the same titles borrowed from around the web. This is the opposite: a collection of games that were invented, designed and coded specifically for this site — small original ideas you genuinely will not find anywhere else. Each one is built around a single clever mechanic that takes seconds to learn and a while to master. Some are pure logic: herd a fleeing target you can only sense in Quarry, snip a network into single-colour groups in Splice, pour colours that sink by weight in Decant, or drive two mirrored tokens with one input in Duplex. Some are tests of timing and nerve: swing from peg to peg on momentum alone in Latch, hold two clashing rhythms at once in Polytap, dive for treasure before your air runs out in Deepdive, or ride a hot streak and cash out before it breaks in Ticker. Others chase a high score through cascading chain reactions, like the one-tap bolt of Ricochet or the spreading overload of a full board. They share a look — retro neon — and a philosophy: one idea, taught instantly, deep enough to keep you chasing a better run. Every one is free, loads in about a second in your browser, saves your best locally, and asks for no account. If you have played the classics to death, this is where to find something new.',
    games: [
      'ricochet',
      'splice',
      'quarry',
      'decant',
      'duplex',
      'pinwheel',
      'overfold',
      'sonar',
      'latch',
      'flywheel',
      'overdub',
      'deepdive',
      'umbra',
      'reactor',
      'cleave',
      'fuse',
      'polytap',
      'ripple',
      'ticker',
      'backspace',
      'stackpot',
      'zero-hour',
      'overload',
      'prospector',
      'flapjack',
      'interlock',
      'handful',
    ],
    faq: [
      { q: 'What makes these games “original”?', a: 'They were not cloned or embedded from elsewhere — each was designed and coded from scratch for this site, around a mechanic you will not find in the usual game portals.' },
      { q: 'Are they hard to learn?', a: 'No. Each is built around one idea you can pick up in a few seconds; the depth comes from mastering it and chasing a higher score, not from complicated rules.' },
      { q: 'Are they free and account-free?', a: 'Yes. Every game here is free in your browser with no download and no sign-up. Your best scores save locally, and several feed a weekly leaderboard.' },
      { q: 'Do they work on mobile?', a: 'Yes. They are built mobile-first with touch controls and scale to phones, tablets and desktops.' },
    ],
    accent: 'magenta',
  },
}

export const COLLECTION_SLUGS = Object.keys(COLLECTIONS)

/** 특정 게임이 속한 컬렉션들(게임 페이지 역링크용). */
export function collectionsForGame(gameSlug: string): Collection[] {
  return COLLECTION_SLUGS.map((s) => COLLECTIONS[s]).filter((c) => c.games.includes(gameSlug))
}
