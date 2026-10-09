import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'tetris',
  title: 'Tetris Strategy Guide: The 7-Bag, the Speed Curve and Why Tetrises Pay 7.5x',
  description:
    'How this Tetris really works: a strict 7-bag randomizer, I-piece droughts capped at 12, gravity that bottoms out at level 13, and the exact score table.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'What this guide is based on',
      paragraphs: [
        'Every rule below was read out of the game code that runs on this page, and every percentage comes from a simulation that drives that same code. The script lives in the repository at scripts/content-sims/tetris.ts, so the numbers can be reproduced exactly. Where this version differs from other Tetris games you may have played, the difference is called out, because habits learned elsewhere can quietly cost you here.',
        'The short version: the piece order is far less random than it looks, the speed curve has a hard floor, scoring rewards one kind of clear above everything else, and there is no lock delay to save a late slide. Each of those facts changes how you should play.',
      ],
    },
    {
      heading: 'The randomizer is a strict 7-bag',
      paragraphs: [
        'Pieces are not drawn independently. The game shuffles all seven shapes (I, O, T, S, Z, J, L) into a bag, deals them one by one, and only reshuffles a fresh bag once the current one is empty. The single Next box always shows the top of that queue.',
        'To confirm this is what actually happens in play, the simulation ran one continuous game of 700,000 spawns. Every piece type appeared exactly 100,000 times — not roughly, exactly — which is the fingerprint of a bag, not a dice roll. The useful consequences for planning are these:',
      ],
      list: [
        'The gap between two I pieces averaged exactly 6 other pieces across 99,999 measured gaps, and the longest gap was 12. A 12-piece drought only happens when an I is first in one bag and last in the next; it showed up on 2.0% of gaps.',
        'Back-to-back I pieces (gap 0) also happen about 2% of the time, at a bag boundary. Do not assume you have used up your I for a while.',
        'The longest run of consecutive S and Z pieces in the whole 700,000-piece game was 4. Two S/Z pairs in a row is the worst snake flood this randomizer can produce.',
        'If you can count, you can predict: once six different shapes have appeared since the last bag boundary, the seventh is certain.',
      ],
    },
    {
      heading: 'Gravity: 65 ms faster every level, with a floor',
      paragraphs: [
        'You start at level 1 and gain a level every 10 cleared lines. The fall interval is 800 ms per row at level 1 and drops by exactly 65 ms per level, but never below 80 ms. Measured through the game\'s own gravity function, the time it takes an unassisted piece to fall the 19 rows from spawn to floor is:',
      ],
      list: [
        'Level 1 (0–9 lines): 800 ms per row, 15.2 s for the full fall.',
        'Level 5 (40–49 lines): 540 ms per row, 10.3 s.',
        'Level 10 (90–99 lines): 215 ms per row, 4.1 s.',
        'Level 11: 150 ms per row, 2.9 s. Level 12: 85 ms per row, 1.6 s.',
        'Level 13 onward (120+ lines): pinned at 80 ms per row, 1.5 s — the game never gets faster than this.',
      ],
    },
    {
      heading: 'The jump from level 10 to 12 is the real wall',
      paragraphs: [
        'Because the speed drops by a fixed number of milliseconds rather than a fixed percentage, the early levels feel almost identical while the late ones change dramatically. Going from level 1 to level 2 shortens a fall by about 8%. Going from level 11 to level 12 shortens it by 43%, and level 12 is barely slower than the 80 ms floor. In practice most runs that end between 100 and 120 lines end during that squeeze, not at level 13 itself.',
        'Two practical takeaways. First, the first 90 lines are your building time: the board is slow enough to set up clean stacks, so spend it building good habits rather than racing. Second, hard drop (Space) does not change gravity but it removes the fall entirely, so from level 10 onward it should be your default way of placing pieces. Waiting for gravity at that point only gives the stack more time to go wrong under you.',
      ],
    },
    {
      heading: 'The score table, and why one clear dominates',
      paragraphs: [
        'Line clears pay a base value multiplied by your level: 40 for a single, 100 for a double, 300 for a triple and 1,200 for four lines at once. The simulation confirmed this by feeding hand-built boards through the game\'s own lock routine. At level 1 that is 40 / 100 / 300 / 1,200; at level 5 it is 200 / 500 / 1,500 / 6,000; at level 10 it is 400 / 1,000 / 3,000 / 12,000.',
        'Compare clearing the same four lines two ways. Four singles at level 5 earn 800 points. One four-line clear at level 5 earns 6,000 — seven and a half times as much for exactly the same lines, at every level. Doubles and triples are also poor value per line (50 and 100 points per line at level 1, against 300 per line for a four-line clear). This is the entire economic argument for keeping a well open.',
        'One timing detail: the multiplier is the level you were on when the piece locked; the level-up is applied after scoring, so a clear that crosses a level boundary earns no extra.',
      ],
      list: [
        'Soft drop (Down) adds 1 point per row the piece moves.',
        'Hard drop (Space) adds 2 points per row skipped, on top of the clear.',
        'There are no combo, back-to-back or T-spin bonuses in this version — only the four clear sizes and the drop points.',
      ],
    },
    {
      heading: 'Locking, rotation and the moves that will not save you',
      paragraphs: [
        'This version has no lock delay. A piece that cannot move down any further locks on the very next gravity tick. You can still slide or rotate it while it rests, but only in the window before that tick arrives, and your inputs do not reset the timer. At level 1 that window can be most of a second; at level 13 it is at most 80 ms. Tucking a piece sideways under an overhang is therefore a low-level trick that disappears as you climb.',
        'Pressing Down on a piece that is already resting locks it immediately instead of waiting for gravity. That is handy for speed, and a common way to lose a late adjustment you meant to make.',
        'Rotation is clockwise only on both keyboard (Up) and the touch button — there is no counter-clockwise key, so a three-quarter turn costs three presses. When a rotation would collide, the game tries shifting the piece 1 column left, then 1 right, then 2 left, then 2 right, and keeps the first position that fits. It never kicks upward, so a piece jammed under a ledge may refuse to rotate at all. There is also no hold slot: the Next preview is the only look-ahead you get.',
      ],
    },
    {
      heading: 'A plan built for this specific game',
      paragraphs: [
        'Put the bag, the speed curve and the score table together and a clear strategy falls out. Keep one column empty — the rightmost is easiest, because an I piece spawns horizontally in columns 4–7 and needs one rotation plus a few taps to reach the edge. Build the other nine columns flat, and accept that an I arrives on average every seventh piece and at worst after twelve others. That worst case is your safety margin: twelve pieces add 48 cells, almost five full rows across nine columns, so if the stack beside your well is already past the middle of the board you are betting on a short drought.',
        'Use S and Z on the flat side in pairs where you can; with a maximum run of four from the randomizer you will never be forced into a long sequence of them. Save singles and doubles for emergencies, when the stack is above roughly the middle of the 20-row board.',
        'Finally, know your end condition. A game ends only when a new piece cannot spawn in the top rows, not when blocks merely reach high on the sides. A tall but narrow column at the edge is survivable; anything in the middle four columns near the top is not.',
      ],
      list: [
        'Lines 0–90: build the well, practise rotation counts, take four-line clears only.',
        'Lines 90–120: switch to hard drops for everything; keep the stack under half height.',
        'Lines 120+: the speed is fixed from here on — if you can survive level 13, you can survive any later level.',
      ],
    },
  ],
}
