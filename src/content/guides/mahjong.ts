import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'mahjong',
  title: 'Mahjong Solitaire: Why Solvable Deals Still Get Stuck',
  description:
    'I played 500 deals of this site’s Mahjong Solitaire with different habits. What the layout, scoring, Hint and Shuffle really do, and the habits that clear boards.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'A solvable deal is not a forgiving one',
      paragraphs: [
        'Every deal here is generated backwards from a winning line: the game first works out an order in which pairs of positions can be emptied, then places matching tiles on each of those pairs. So when a board opens, there is always at least one way to clear all 144 tiles. That guarantee is about the deal, not about you. A wrong pair taken early can bury the only copies of a tile under each other, and from then on that game cannot be won without help.',
        'To find out how easily that happens, I drove the game’s real engine with simple automated players across the same 500 deals in my internal simulation script (fixed random seed). A player that picks a random available pair every turn, with no shuffles, cleared only 122 of 500 boards — 24.4%. The deal was solvable every time; the habit was the problem.',
      ],
    },
    {
      heading: 'Know the layout',
      paragraphs: [
        'This is not the traditional turtle. It is a symmetrical stack of four nested rectangles: a bottom layer of 84 tiles in six rows of 14, then 40 tiles in four rows of 10, then 12 in two rows of 6, and a cap of 8 in two rows of 4. The upper layers are centred, so each one hides the middle of the layer below.',
        'A tile can be taken when nothing in the layer above overlaps it and at least one of its left or right neighbours in the same row is gone. Because of the layout, every deal starts with exactly the same 28 free tiles: the two end tiles of each of the 6 bottom rows (12), the ends of the 4 rows on layer two (8), the two outer tiles of each row on layer three (4), and the four end tiles of the cap (4). What changes from deal to deal is how many of those 28 happen to match. Across my 500 deals the opening offered 12.7 matching pairs on average, with a low of 5 and a high of 23.',
        'The bottleneck is the long rows. A bottom row of 14 can only be eaten from its ends, so the middle tiles of those rows — on four of the six rows also sitting under the upper layers — are the last to come free. Most stuck boards are stuck because the matches for those deep middle tiles were spent elsewhere.',
      ],
    },
    {
      heading: 'The tile set and the two wildcard groups',
      paragraphs: [
        'The 144 tiles are three suits of 1 to 9 (dots, bamboo and characters, four copies each, 108 tiles), four winds and three dragons (four copies each, 28 tiles), and eight bonus tiles: four flowers and four seasons. Any flower matches any flower and any season matches any season, even though their faces differ, so each bonus group behaves like one face with four copies.',
        'Thinking in groups of four is the most useful habit in the game. Every face appears exactly four times. When you see two free copies, ask where the other two are. If they are also free, or already gone, clearing this pair is completely safe — it cannot block anything, because every remaining copy is already reachable. If one of the other copies is buried in the middle of a long row, the two free ones may be its only way out later.',
      ],
    },
    {
      heading: 'Do not trust the Hint button',
      paragraphs: [
        'Hint highlights a legal pair, but not a good one. It simply shows the first matching pair in the game’s internal tile order, which starts with the bottom layer. In practice it nudges you towards clearing tiles on the edges of the bottom layer while the upper layers stay put — the opposite of what you want.',
        'The numbers make the point. A player that always takes the hinted pair cleared 72 of 500 boards without shuffles (14.4%), well below the random player’s 24.4%. Use Hint to find a pair you overlooked, then decide for yourself whether to take it.',
      ],
    },
    {
      heading: 'What a better habit buys you',
      paragraphs: [
        'My best simple rule was: first take any safe pair (all remaining copies free); otherwise take the pair that frees the most new tiles; break ties towards higher layers. That cleared 138 of 500 boards with no shuffles (27.6%). A second rule that favoured the longest rows and tiles covering others did about the same, 136 of 500 (27.2%).',
        'Those modest gains are the honest answer: no one-move-ahead rule gets close to clearing every board, because the mistakes that kill a game happen many moves before you notice them. What does work is looking ahead and backing out, which leads to the two buttons that matter.',
      ],
      list: [
        'Random pairs: 24.4% cleared, 53.9 tiles left on average when stuck.',
        'Always taking the Hint pair: 14.4% cleared, 54.2 tiles left when stuck.',
        'Safe pairs first, then most tiles freed: 27.6% cleared, 49.5 tiles left when stuck.',
      ],
    },
    {
      heading: 'Undo before you Shuffle',
      paragraphs: [
        'When no free pair matches, the game lets you shuffle: all remaining tiles are randomly redistributed among the occupied positions. You get three per deal, and the game is only lost once you are out of moves with no shuffles left. Shuffles certainly extend games — with up to three, my random player went from 24.4% to 58.0% cleared and the best rule from 27.6% to 58.6%.',
        'But a shuffle throws away the guarantee. The deal was solvable because of how tiles were placed; a random rearrangement is just random. I took 200 boards where the random player had got stuck, shuffled each once, and asked the game’s own solver to clear the result. It found a winning line for only 37 of them (18.5%). The same solver cleared all 200 of 200 positions of similar size that were known to be solvable, so this is not the solver giving up early — most reshuffled boards are simply worse.',
        'Undo has no such cost. It is unlimited, it rewinds exactly, and stepping back to before your mistake returns you to a position that is still solvable. When you get stuck, undo a few pairs and look for the place where you used two copies of a face that a buried tile needed. Reach for Shuffle only when you cannot find the mistake.',
      ],
    },
    {
      heading: 'How the score works',
      paragraphs: [
        'The score is simple: 100 points for every tile removed, plus 10,000 for clearing the board. A full clear is therefore worth 24,400, and nothing reduces it — not the clock, not hints, not undos, not shuffles. The timer is shown for your own interest and does not touch the score.',
        'The clear bonus dominates. A game that stalls with 20 tiles left scores 12,400; finishing it is worth 24,400, almost double. Your saved best is your highest score, so once you have one 24,400 game, only another full clear can match it. Spend time freely: since slow, careful play is never penalised, there is no reason to rush a pair you are unsure about.',
      ],
      list: [
        'Before every pair, locate the other two copies of that face.',
        'Prefer pairs that open the middle of long rows or uncover an upper-layer tile.',
        'Treat flowers and seasons as one four-copy face each.',
        'When stuck, undo to the mistake first; shuffle is the last resort.',
      ],
    },
  ],
}
