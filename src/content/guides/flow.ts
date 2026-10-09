import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'flow',
  title: 'Flow Level Guide: What the 26 Boards Actually Ask of You',
  description:
    'A data-backed tour of all 26 Flow levels: solution counts, which boards are hardest, how pipe cutting works, and techniques for full-coverage solves.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'The bank at a glance',
      paragraphs: [
        'Flow ships 26 fixed levels in a set order: nine 5×5 boards (levels 1–9), nine 6×6 boards (10–18) and eight 7×7 boards (19–26). The Easy, Medium and Hard labels you see under the board come from size alone — any 5×5 is Easy, any 7×7 is Hard — so the label tells you nothing about how tricky a level is within its group.',
        'Pair counts climb more gently than you might expect. The 5×5 boards have 4 or 5 colours, the 6×6 boards 5 to 7, and the 7×7 boards 6 or 7. On a 7×7 board with six pairs, 37 of the 49 squares start empty, which is why the big boards feel open and slippery rather than crowded.',
        'There is no timer, no move limit and no score. The game counts moves internally but never shows or rewards them, and your saved best is simply the highest level number you have solved. Prev and Next are always available, so nothing is locked: if a level is beating you, you can skip it and come back, and pressing Next on level 26 wraps around to level 1.',
      ],
    },
    {
      heading: 'None of these puzzles has a single answer',
      paragraphs: [
        'Commercial pipe puzzles are usually built so that exactly one arrangement fills the board. These are not. I wrote an internal simulation script that loads the game’s real level data and exhaustively counts every way to link all pairs while filling every square. Not one of the 26 levels has a unique solution.',
        'The spread is wide. Level 7 is the tightest board in the game with just 2 full-coverage solutions; level 23 is the loosest with 352. The 5×5 boards range from 2 to 33 solutions, the 6×6 boards from 8 to 212, and the 7×7 boards from 4 to 352.',
        'This matters for how you play. On a unique-solution puzzle you can reason “this cell can only belong to blue”, because the designer guaranteed it. Here, that kind of forced logic only takes you part of the way — at some point you will face a genuine choice where both options can work. When you hit that wall, pick the option that keeps the empty space in one connected piece and commit; you are not missing a hidden deduction.',
      ],
    },
    {
      heading: 'Which levels are really hard',
      paragraphs: [
        'Solution count is one measure; another is how much trial and error it takes to find any solution. My script also counted the search steps a straightforward backtracking solver — the same algorithm the game’s own tests use to prove each level is solvable — needs before it finds its first full cover. It is a crude yardstick, since it tries colours in a fixed order rather than starting where a person would, but it tracks how many dead ends a board contains.',
        'By that yardstick the curve is real but lumpy. Level 7 falls in 33 steps. Level 14 is the stubborn one among the 6×6 boards at 22,453 steps, the most of any board below 7×7; only 3 of its 10 dots sit on the outer edge, which leaves fewer anchored routes to start from. Among the big boards, level 22 is comparatively gentle at 39,333 steps, while level 21 is the hardest in the bank at 2,457,137 steps and, with only 4 solutions, the least forgiving 7×7.',
      ],
      list: [
        'Tightest boards (fewest solutions): level 7 (2), level 9 (3), level 1, 3 and 21 (4 each).',
        'Loosest boards: level 23 (352), level 20 (232), level 11 (212).',
        'Most search to crack: level 21, then 19 (2,337,683), then 20 (967,354).',
      ],
    },
    {
      heading: 'How the drag rules really behave',
      paragraphs: [
        'A few rules in this version differ from what you might assume, and knowing them saves a lot of accidental damage.',
        'Dragging your pipe into a square another colour already occupies does not stop you — it cuts that other pipe at the square you entered and throws away everything beyond it, then claims the square. That is handy for rerouting, but it is also the most common way to wreck a nearly finished board. The only thing a pipe cannot enter is another colour’s dot.',
        'A plain tap never changes anything; a pipe only moves once your finger or cursor actually slides to a new square. Pressing on the middle of an existing pipe and dragging trims it back to that point and continues from there, which is the quickest way to fix the second half of a route without redrawing the first. Dragging back over your own pipe retracts it. Once a pipe reaches its matching dot it is locked from growing further; you can only pull it back.',
        'If you drag fast and skip squares, the game fills the gap for you one step at a time, moving along the longer direction first and then the shorter one. On cramped boards that automatic L-turn can take a route you did not intend, so on the 7×7 levels slow down around corners.',
      ],
    },
    {
      heading: 'Technique: solve the space, not the dots',
      paragraphs: [
        'The header shows two counters — pairs connected and percentage filled — and the second one is where levels are won or lost. Linking every pair the short way usually leaves squares over, so treat “Pairs” as a checklist and “Filled” as the real goal.',
        'Start with dots on the outer edge and in corners. A corner square has two neighbours, an edge square three, an interior square four, so a pipe leaving a corner dot has very few sensible directions. On 24 of the 26 levels at least half the dots are on the border — level 8 has 9 of 10 — and those are your anchors.',
        'Then hunt for empty squares with only one open neighbour left. A pipe passing through a square needs two ways in and out, so a square like that can only be filled by the tip of a pipe that is still growing right beside it. If no pipe head is next to it, it is already stranded — fix it now rather than discovering the gap at 98% filled.',
      ],
    },
    {
      heading: 'Adjacent dots are a trap, sometimes',
      paragraphs: [
        'When two dots of the same colour start next to each other, it is tempting to link them with a two-square pipe and move on. On many levels that is right, but not always: the short link leaves the surrounding squares to other colours, and if none of them can reach, the board cannot be filled.',
        'These pairs are common in the bank. Level 9 has 4 adjacent pairs out of 5, and level 18 has 5 out of 7. On boards like these, connect the adjacent pairs last, after the long pipes have settled. If there is a pocket of empty squares no long pipe can reach, the adjacent pair is the colour that should loop out and fill it.',
      ],
    },
    {
      heading: 'Using Undo and Clear well',
      paragraphs: [
        'Undo takes back one whole drag at a time — everything from pressing down to letting go — and that includes any pipe you cut along the way, so a speculative route can be unwound exactly. Clear resets every pipe on the level; the small coloured buttons under the board clear one colour at a time.',
        'A good rhythm on the 7×7 boards is to lay the two or three most constrained pipes from the edges, then make one exploratory choice in the open middle and play it out. If you reach an unfillable pocket, undo to the choice point, not to the beginning. Because every level has more than one solution, your first committed guess is often fine, and the cost of trying is only a few undos.',
      ],
      list: [
        'Keyboard, with the board focused: U undo, R clear the level, N or Right arrow next level, Left arrow previous level.',
        'Watch the Filled counter, not Pairs, to judge whether a route works.',
        'Never drag through a finished pipe unless you mean to cut it.',
      ],
    },
  ],
}
