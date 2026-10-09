import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'quarry',
  title: 'Quarry Strategy: Tracking the Quarry Instead of Chasing It',
  description:
    'How Quarry really works: the exact flee rule, par and star maths, and an exhaustive analysis showing every start cell can be caught in four probes or fewer.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'The rule that makes Quarry solvable',
      paragraphs: [
        'Quarry looks like hot-and-cold with a moving target, but the quarry never moves randomly. The only random thing in a level is where it starts; after that, every hop is a fixed function of where it is and where you probed.',
        'Your probe reads the king-move distance (the larger of the row gap and the column gap) before anything moves. Then the quarry steps one cell directly away from your probe along whichever axis it is further away on. If the row gap and column gap are equal — a perfect diagonal — it flees vertically. If the step would take it off the board, it stays put instead.',
        'That gives you a rule worth memorising: if you read a distance d, the quarry is now exactly d + 1 away from the cell you probed, unless it was pressed against the wall it tried to flee into, in which case it is still at distance d. A reading is not a snapshot of where the quarry was; it is a ring that moves outward by one the instant you see it.',
      ],
    },
    {
      heading: 'Board sizes, budget and par',
      paragraphs: [
        'Levels 1 and 2 use a 5×5 board with 8 probes and a par of 5. Every level from 3 onward is 7×7 with 10 probes and a par of 7. The board stops growing there; the run only ends when you lose a level.',
        'Stars are judged against par: three stars for catching it in par minus 2 or fewer probes, two stars for par or fewer, one star for anything over par. On 5×5 that means 3 probes or fewer for three stars; on 7×7 it is 5 or fewer.',
        'Points per catch are 10, plus 2 for every probe you finish under par (going over par subtracts 2 per probe, never below zero), plus a star bonus of 30, 15 or 5. On top of that comes a streak bonus of 5 points for every consecutive under-par catch, counting the current one. Under par means strictly fewer probes than par: 4 or fewer on 5×5, 6 or fewer on 7×7. One over-par catch or one loss resets the streak to zero, and a loss also ends the run. Your saved best is the total score of your best run, not a probe count.',
      ],
      list: [
        '5×5, 3 probes: 10 + 4 + 30 = 44 points before streak.',
        '5×5, 4 probes: 10 + 2 + 15 = 27 points — one extra probe costs 17.',
        '7×7, 4 probes: 10 + 6 + 30 = 46 points before streak.',
      ],
    },
    {
      heading: 'Keep a list of where it could be',
      paragraphs: [
        'Because the movement is deterministic, you can play Quarry by tracking a candidate set: every cell the quarry might be on right now. At the start that is the whole board. After each probe, keep only the cells whose distance to your probe matches the reading, then push each of them one step away using the flee rule. When the set shrinks to one cell, probe that cell and you win.',
        'Two habits get most of the benefit without perfect bookkeeping. First, after each reading, picture the ring at distance d, then grow it by one — that is the region the quarry is in now, with only the wall cells it was trapped against staying behind. Second, intersect the rings from successive probes; readings taken from different directions cut the board far more than repeated probes from one spot.',
      ],
    },
    {
      heading: 'Do not open in the centre',
      paragraphs: [
        'The centre feels like the safe first probe, and it is the worst opening on both boards. From the centre of a 5×5 board the reading can only be 0, 1 or 2, and 16 of the 25 starting cells give the same reading of 2. From the centre of a 7×7 board, 24 of 49 cells all read 3.',
        'An edge probe splits the board into many more bands. On 5×5, probing the centre leaves an average of 12.8 possible cells; a corner leaves 6.56; the cell next to a corner on the top edge, row 1 column 2, leaves 6.0 and is the best opening I found. On 7×7, the centre leaves 18.3 cells on average, a corner 9.3, and the third cell along the top edge (row 1, column 3) 8.3.',
              ],
    },
    {
      heading: 'What perfect tracking actually achieves',
      paragraphs: [
        'The quarry starts on a uniformly random cell and everything after that is deterministic, so I did not need to sample: my internal simulation script runs each strategy through the game’s real probe function from every possible starting cell — all 25 on 5×5 and all 49 on 7×7 — and reports exact results.',
        'A naive tracker that opens in the centre and then always probes the first cell still in its candidate list never loses. It averages 3.56 probes on 5×5 and 3.61 on 7×7, needs at most 5, and earns three stars from 11 of 25 starting cells on 5×5 but all 49 on 7×7.',
        'A greedy tracker that chooses each probe to make the expected candidate list as small as possible does better: 2.96 probes on average on 5×5 and 3.04 on 7×7, and it never needs more than 4 probes on either board. That is three stars from 20 of the 25 starting cells on 5×5, and from all 49 on 7×7. A deeper search over probe sequences matched it on 5×5 (2.96) and only shaved 7×7 to 3.02, so greedy splitting is essentially as good as it gets.',
      ],
      list: [
        'Greedy tracker, 5×5: 1 start cell caught in 1 probe, 4 in 2, 15 in 3, 5 in 4.',
        'Greedy tracker, 7×7: 1 in 1, 5 in 2, 34 in 3, 9 in 4.',
        'Average points per catch before streak bonus: 41.1 on 5×5, 47.9 on 7×7.',
      ],
    },
    {
      heading: 'Why 7×7 is easier to three-star than 5×5',
      paragraphs: [
        'Par grows with the board — from 5 to 7 — while the probes a good tracker needs barely move: 2.96 on 5×5 against 3.04 on 7×7. The three-star line on 7×7 sits at 5 probes, a full probe above the worst case of good tracking. On 5×5 the line is 3, and 5 of the 25 starting cells need 4 probes even with the best strategy I could find.',
        'So treat levels 1 and 2 as the hard part of the run and expect to drop a star there now and then. From level 3 on, a two-star catch means you wasted probes, and every catch should be under par so that the streak bonus keeps climbing. The tenth consecutive under-par catch is worth 50 points of streak bonus on its own.',
      ],
    },
    {
      heading: 'Walls and corners: less useful than they look',
      paragraphs: [
        'Herding the quarry into a corner sounds like the natural plan, and it is true that a quarry on the wall it is fleeing toward cannot move. But in the tracking picture, that pin buys you surprisingly little. I checked every probe cell on both boards against every pair of candidate cells that would give the same reading: in no case do two of them land on the same cell after the flee — 0 merges on 5×5 and 0 on 7×7. A wall never squeezes your candidate list; only new readings do.',
        'What a pin does change is the ring rule: a pinned quarry stays at distance d instead of moving to d + 1. And every probe spent pushing the quarry toward a corner is a probe not spent splitting the candidates. The greedy tracker above never aims for a corner and never needs more than 4 probes. Read first, and herd only when the most informative probe happens to push toward a wall.',
      ],
    },
    {
      heading: 'Daily runs and a checklist',
      paragraphs: [
        'Daily mode seeds the run from the UTC date, so every player gets the same sequence of starting cells that day; free mode picks a random seed each run.',
      ],
      list: [
        'Open on an edge cell next to a corner (5×5) or third along an edge (7×7), never the centre.',
        'After a reading d, the quarry is at d + 1 from that probe unless it was pinned on the wall.',
        'Intersect rings from two different directions before committing to a guess.',
        'On 7×7, anything over 5 probes is a lost star and over 6 breaks your streak.',
      ],
    },
  ],
}
