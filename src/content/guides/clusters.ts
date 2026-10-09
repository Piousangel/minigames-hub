import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'clusters',
  title: 'Clusters Guide: How the Daily Board Is Built, and How to Spend Your Four Lives',
  description:
    'Inside Clusters: one group per colour tier on every board, a fixed 44-group bank, a UTC daily seed, and what "one away" and Shuffle really tell you.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'Where these numbers come from',
      paragraphs: [
        'This guide describes the Clusters that runs on this site, read directly from its source code and measured with a script that imports the game\'s own engine (scripts/content-sims/clusters.ts in the repository). The script reports only aggregate statistics. Nothing here names a group or tile from any specific day, so you can read it without spoiling a puzzle.',
        'If you already know the basic loop — pick four, submit, find all four groups — the useful part is knowing how the board is assembled. Several details of the generator give you real information that most players never use.',
      ],
    },
    {
      heading: 'Every board has exactly one group from each colour',
      paragraphs: [
        'Groups live in a fixed bank of 44, split evenly into four difficulty tiers of 11: yellow (easiest), green, blue and purple (trickiest). The generator walks the tiers in order and picks one group at random from each. Across 100,000 generated boards the script found exactly one group per tier on 100% of them. With 11 choices per tier there are 14,641 possible combinations of groups, before the tiles are even shuffled.',
        'That structure is a strong hint you can lean on. A board never contains two purple-tier groups, and it never consists of four easy ones. When you lock in a group, its colour is revealed; once you have found, say, yellow and blue, you know for certain that one of the two remaining groups is green-tier and the other is the purple one. If one of your candidate sets feels like a straightforward category and the other relies on specialist knowledge, you now know which is which.',
        'The bank has 176 items and every one of them is unique — no tile word belongs to two groups in the bank, and the generator also refuses to place two groups that share an item. A tile therefore always has exactly one correct home. Any overlap you see is in meaning, not in spelling.',
      ],
    },
    {
      heading: 'About those "traps"',
      paragraphs: [
        'It is tempting to assume the puzzle was hand-tuned so tiles can be read two ways. In this version it was not: the generator picks groups at random within each tier and only checks that they do not share an item or a name. When a tile looks like it could fit two groups, that is a coincidence of the draw, not a designed red herring. The practical difference is that you should not hunt for a hidden fifth meaning behind every word. If four tiles form a clean, specific category, they are very likely just that category.',
        'Where real ambiguity does arise, it is usually across tiers: a word that fits an everyday category on the easy side and a specialist category on the purple side. Use the one-group-per-tier rule to break the tie — ask which of the two categories looks like it belongs in the hardest tier, and remember the board has only one of those.',
      ],
    },
    {
      heading: 'Lives, grades and what a mistake actually costs',
      paragraphs: [
        'You start with four lives. Each wrong submission removes one, and the puzzle ends the moment the fourth is gone — so to win you must find all four groups with at most three mistakes. Your grade is S for a flawless solve, then A, B and C for one, two or three mistakes, and D if you run out.',
        'The score is steep. A win is worth 1,000 points plus 250 for each life you still have, so a flawless solve scores 2,000, one mistake 1,750, two 1,500 and three 1,250. A loss scores only 150 per group you did find, at most 450. Even a three-mistake win is worth almost three times the best possible loss, which argues for patience on your final life rather than a hopeful stab.',
      ],
      list: [
        'There is no protection against repeating a guess. Submitting the exact same wrong four tiles twice costs two lives, so keep track of what you have already tried.',
        'Only a daily win extends your day streak. Practice boards never touch it.',
      ],
    },
    {
      heading: 'Reading "one away" correctly',
      paragraphs: [
        'The game says "one away" when exactly three of your four tiles belong to the same group. It does not tell you which tile is the odd one, and it does not say anything about the other groups. To see how much information that is, the script submitted every one of the 1,820 possible first guesses on a single board through the game\'s own reducer: 4 were correct (0.22%), 192 were one away (10.55%), and the remaining 1,624 were plain wrong.',
        'So a "one away" is genuinely rare and valuable — it means you have found three-quarters of a group. The efficient follow-up is to keep three tiles, swap one, and choose the swap that tests a specific suspicion. Do not swap two at once: if that guess comes back one away again, you will not know which change mattered.',
        'A plain "wrong" is also informative. It means no three of your four share a group. If you were sure about three of them, that certainty was misplaced, and it is worth re-examining all three, not just the fourth.',
      ],
    },
    {
      heading: 'Shuffle is a rotation, not a re-deal',
      paragraphs: [
        'The Shuffle button (or the S key) does not randomise the tiles. It moves every remaining tile five places back in reading order, wrapping around. On a four-column grid that slides each tile one row up and one column left. The script confirmed what this means: with 16 tiles left the layout returns to where it started after exactly 16 presses, and every pair of tiles that were next to each other in reading order is still next to each other after a press.',
        'If you are using Shuffle to break a mental association between two tiles that sit side by side, it will not help — they travel together. What it does do is move tiles into different rows and columns, which can be enough to see a new grouping. If you need a genuinely fresh look, read the grid column by column instead of row by row, or say each word aloud with a different meaning in mind; both break up pairings that Shuffle preserves.',
      ],
    },
    {
      heading: 'The daily seed, and why groups feel familiar',
      paragraphs: [
        'The daily board is generated from the current UTC date, so it changes at midnight UTC and is the same for every player worldwide. Practice mode uses a random seed instead, giving a new board every time.',
        'Because the bank is fixed, regular players will recognise groups. The script generated the 365 daily boards starting 2026-10-09: 34.6% of days (126 of 364) shared at least one group with the day before, and 96.1% (344 of 358) shared at least one with the previous seven days. Every one of the 44 groups appeared during the year, between 19 and 45 times each, and two pairs of days drew the identical set of four groups.',
        'That is not a flaw to exploit so much as a skill to build. Over time you will know the shape of the bank — how specific the purple categories tend to be, how literal the yellow ones are — and that knowledge is legitimate. It is the same thing experienced players of any daily word game develop.',
      ],
    },
    {
      heading: 'A disciplined order of play',
      paragraphs: [
        'Putting it together, a steady approach looks like this:',
      ],
      list: [
        'Scan for the most specific category first. Specific beats obvious, because a specific category rarely has a fifth candidate.',
        'Submit only when you can name the category in a few words. A set chosen because "these four seem related" is the main source of lost lives.',
        'After each solve, note the revealed colour and narrow down which tiers are left.',
        'On a "one away", change exactly one tile per guess.',
        'Keep a mental list of submitted sets so you never repeat one.',
        'On your last life, stop and reason about the remaining tiers before submitting — a 1,250-point win is still worth far more than any loss.',
      ],
    },
  ],
}
