import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'unblock',
  title: 'Unblock Guide: Par, Opening Moves and the Shape of All 27 Levels',
  description:
    'I mapped every reachable position in all 27 Unblock levels. See how many opening moves keep par, where levels hide traps, and how to hit par.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'What counts as a move, and what par means here',
      paragraphs: [
        "In this version of Unblock, one move means sliding one block in one direction by any distance. Dragging a car across four empty squares counts as one move, the same as nudging it by a single square. Tapping a block and then tapping a destination counts the same way. This is the classic Rush Hour rule, and it is the rule the game's par numbers use. In practice, a slide that stops halfway is often a wasted move, because carrying on to the far end of the same lane would have cost nothing extra.",
        "The board is 6x6. Blocks are 2 or 3 squares long, and the red block is always two squares long on the third row. You win the moment its right end touches the right wall, so the final slide into the exit is part of the count. Par is not a designer's estimate. Each level's par is the exact minimum found by an exhaustive breadth-first search in the engine, and the game counts you as beating par when your total is at or below it.",
      ],
    },
    {
      heading: 'The level set in numbers',
      paragraphs: [
        "There are 27 levels, and their pars run 2, 2, 3, 3, 3, 4, 4, 4, 6, 6, 7, 8, 8, 8, 10, 10, 10, 12, 12, 12, 14, 15, 15, 17, 19, 25 and 25. Together that is 264 moves at par for the whole set, and the median level has a par of 8. The difficulty climbs steadily, with one big jump at the end: the last two levels, The Vault and Last Stand, each need 25 moves, six more than Endgame before them.",
        "To go beyond the par list, I wrote a script that uses the game's own slide function to explore every position each level can reach. Across the 27 levels that came to 459,397 distinct positions. Level size has almost nothing to do with difficulty. Deadlock, with a par of 12, has the largest space at 75,508 positions. Last Stand, with a par of 25, has only 521, and Tangle, with a par of 8, has just 297. Small spaces are tight: you have few legal moves at each step, but the one you need is usually not the one that looks productive.",
      ],
      list: [
        'Warm-up and easy tier (levels 1–8): par 2–4.',
        'Medium (levels 9–14): par 6–8.',
        'Hard (levels 15–20): par 10–12.',
        'Brutal (levels 21–27): par 14–25.',
      ],
    },
    {
      heading: 'Your first move decides more than you think',
      paragraphs: [
        "For each level I counted the legal opening moves and how many of them still allow a solution at par. Early levels are forgiving. Junction offers 18 legal openings and 8 of them keep par. Detour offers 16, of which 6 are optimal. The middle of the set narrows sharply. Gridlock has 8 legal openings and only one keeps par. Logjam has 3 legal openings and one good one. Last Stand, the final level, also has 3 legal openings and only one that leads to a 25-move solution.",
        "So on the harder boards, try to work out the whole first sequence before you touch anything. A first slide that looks harmless is usually off the optimal line, and fixing it later costs at least two moves: one to undo the damage and one to replace it. The in-game Undo button restores the move counter along with the board, so an undone experiment costs nothing. Use it freely while you explore, then replay the level cleanly when you know the line.",
      ],
    },
    {
      heading: 'How far a bad line can drag you',
      paragraphs: [
        "Another useful measure is the worst position you can reach: the reachable position that is furthest from any solution. On easy levels that ceiling is low, and on the first five levels no position is more than 8 moves from solved. Some medium levels are traps, though. Tangle has a par of 8, yet you can shuffle into positions that need 20 moves to finish. Standstill has a par of 10 and a worst case of 20. The Vault starts 25 moves from the exit and can be pushed out to 35.",
        "If your move count passes about twice par and the exit row still looks just as crowded, you have probably drifted into one of those far regions. Restarting the level costs less than digging your way back.",
      ],
    },
    {
      heading: 'The red block moves less than you expect',
      paragraphs: [
        "On the optimal solutions my solver found, the red block itself moved exactly once in 13 of the first 14 levels: a single final slide out. Tangle was the exception, with two red moves. From level 18 onward it moved two to four times, because the solution parks it part-way along its row to make room for vertical blocks to pass behind it.",
        "Bottleneck is the clearest example. Moving the red block forward is one of the four openings that keep par there, which runs against the usual advice to leave the target alone until the path is clear. On the late levels, when a vertical block needs the squares the red block is sitting on, sliding red forward or back can be the move that unlocks everything.",
      ],
    },
    {
      heading: 'A working method for hitting par',
      paragraphs: [
        "Reading the board backwards still works best, but count as you go. List the blocks that sit on the exit row to the right of the red block. For each one, ask which way it must slide to leave that row and what stands in its way. A vertical length-3 block that crosses the exit row can only clear it by moving down into the bottom three rows, because there are only two rows above the exit row. That makes it a fixed target, so plan around it first.",
        "Next, look for the move that serves two purposes. On levels with few optimal openings, prefer moves that help two blocks at once, such as freeing a second blocker or clearing a lane a later block will need. If a candidate move helps only one block, check whether another move would help that block and a second one too.",
      ],
      list: [
        'Count blockers on the exit row first; that number is a floor on the moves still to come.',
        'Slide every block as far as is useful in one go; partial slides waste moves.',
        'Use Undo to explore. It rolls back the move counter too.',
        'Past twice par with no progress? Reset rather than dig out.',
      ],
    },
    {
      heading: 'Progress and what gets saved',
      paragraphs: [
        "All 27 levels can be chosen from the level menu from the start. Each entry shows its par and a tick once you have solved it, so you can skip ahead to a tier that suits you. For each level the game keeps your fewest moves in your browser. The leaderboard number counts how many different levels you have solved, not your total moves, so a cleaner replay of an old level improves your personal best but not your rank.",
        "If you are going for par across the whole set, a sensible order is to clear everything once, then return to the levels where you went over. Each one has a single exact target, so you always know how far off you are.",
      ],
    },
  ],
}
