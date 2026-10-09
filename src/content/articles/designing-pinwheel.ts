import type { Article } from '../types'

export const article: Article = {
  slug: 'designing-pinwheel',
  title: 'Designing Pinwheel: a puzzle with no individual moves',
  description:
    'Pinwheel spins the whole board around a pin you choose. How I generate solvable boards backwards, why par is a proof, and the mouse bug unit tests missed.',
  published: '2026-10-09',
  kind: 'design-notes',
  relatedGames: ['pinwheel'],
  sections: [
    {
      heading: 'The idea: you never move a piece',
      paragraphs: [
        'In most grid puzzles you move one thing at a time: slide a block, swap two tiles, push a crate. Pinwheel removes that option entirely. The board holds a set of dots that behave as one rigid shape, which I call the constellation, and a matching set of hollow rings called anchors. On your turn you plant a pin on any cell and spin the entire constellation 90 degrees around it, clockwise or counter-clockwise. Every dot moves every turn.',
        'The only way to make progress is to shed. After a spin, any dot that lands exactly on a free anchor is pinned there for good. It drops out of the constellation and becomes a fixed wall. The remaining dots keep spinning together. You win when every dot is pinned.',
        'The engine comment that describes the rules ends with the sentence I consider the design brief: “There are no individual moves. The only channel to a solution is shedding.”',
      ],
    },
    {
      heading: 'The constraint: rigid shapes and a hard edge',
      paragraphs: [
        'A rotation about an arbitrary pin is powerful. It can carry a dot from one corner of the board to another in a single move. Without limits, almost any board would be easy. Two rules supply the tension.',
        'First, the edge is lethal. If any dot in the constellation would land off the board, or on top of a dot that is already pinned, the constellation shatters and the run ends. There is no partial move and no bounce. A spin that would pin three dots but throw a fourth off the edge is simply a loss.',
        'Second, pinned dots are walls. Every dot you shed shrinks the constellation, which makes it easier to steer, but it also adds an obstacle that the rest of the shape must never land on. Early pins are cheap; late pins are made in an increasingly crowded room.',
        'Together these turn a free rotation into a planning problem. You are not asking “where can this dot go?” but “which pin sends one dot home without throwing any of the others away?”',
      ],
    },
    {
      heading: 'Making every board solvable, by walking backwards',
      paragraphs: [
        'A puzzle like this is only fair if every board has a solution, and I did not want to ship hand-made levels or rely on a brute-force solver. So boards are generated in reverse. The generator starts from the solved state, every dot sitting on its anchor, and walks backwards. Each reverse step un-pins zero or one dot, then applies the inverse rotation to all of the unpinned dots. Read forwards, that sequence of steps is a solution.',
        'The subtle part is keeping the reverse walk honest. If an unpinned dot ever passed over a free anchor on the way back, then replaying the solution forwards would pin it early, and the stated solution would no longer describe what actually happens. The generator therefore keeps a strict invariant: no unpinned dot may ever rest on a free anchor. Candidate reverse rotations that break it, leave the board, land on a pinned dot, or revisit a configuration already seen are discarded.',
        'That invariant is what makes the par number trustworthy. With it, replaying the script forwards pins exactly the dots it is supposed to at each step, and nothing more. Par is therefore not an estimate. It is the length of a solution I know works, so it is a guaranteed upper bound on the number of moves you need. You can sometimes beat it, because the generator only records one route and the shortest route may be another.',
      ],
    },
    {
      heading: 'Generation details',
      paragraphs: [
        'The generator is deterministic. It takes a seed, and every random draw happens in a fixed order so that the same seed always rebuilds the same board. A few concrete choices:',
      ],
      list: [
        'Anchors are chosen with a partial shuffle that always consumes exactly one random number per anchor, so the number of draws never depends on luck.',
        'Each reverse step draws exactly three numbers: whether to un-pin a dot, which dot, and which rotation. The first reverse step always un-pins, because the final forward move must pin something.',
        'The chance of un-pinning a dot on an ordinary step is 60%, with a forcing rule that guarantees every dot is free by the end of the walk.',
        'If a walk runs out of legal moves, the generator tries the next seed, up to 30 attempts.',
        'If all 30 fail, there is a fallback board: on an odd square board, a spin about the exact centre maps the board onto itself, so a one-move puzzle built that way is always valid.',
        'The solution script is never stored in the game state, so it cannot be read out of the browser’s developer tools.',
      ],
    },
    {
      heading: 'Difficulty and scoring',
      paragraphs: [
        'There are three difficulty settings. Easy is a 5×5 board with 3 dots and 4 reverse steps. Normal is 7×7 with 4 dots and 6 steps. Hard is 7×7 with 5 dots and 8 steps. The number of reverse steps is the par for that board, and the generator requires it to be at least the number of dots, since each dot must be un-pinned on some step.',
        'Scoring is built to reward pinning several dots in one spin, which is the most satisfying thing that can happen in the game. Pinning k dots in a single spin is worth 100 × k, plus 150 for every pair among them. One dot is 100, two dots in the same spin are 350, three are 750. Winning adds 1,000, plus a par bonus of 1,000 × par ÷ moves, rounded. Matching par earns the full 1,000; beating it earns more.',
        'You get 3 undos per board. Undo is there to forgive a misread rotation, not to replace planning, so it only reaches back three moves and cannot be used after a crash.',
      ],
    },
    {
      heading: 'Showing the future before you commit',
      paragraphs: [
        'Rotations are hard to visualize, especially around a pin that is not near the shape. So once you choose a pin, the board shows both possible outcomes as ghost dots: one color for counter-clockwise, another for clockwise. A ghost that will pin is drawn filled, a crashing landing is marked in red, and a small badge reads “+2 pin” or “Crash” for each direction. The engine computes these previews with the same function the real spin uses, so a preview cannot disagree with the move.',
        'On a keyboard, the arrow keys move the pin, Q spins counter-clockwise and E spins clockwise. On a touch screen, you tap a cell to plant the pin and then choose a direction.',
      ],
    },
    {
      heading: 'What testing missed, and what playing found',
      paragraphs: [
        'Pinwheel came out of my sixth batch of original games. That round started with twenty ideas, scored each one on originality, feasibility, how compulsive it felt and how appealing it was, and cut anything below 5.5 on originality or feasibility before choosing three to build. Pinwheel’s engine shipped with 31 unit tests passing and a clean type check.',
        'It still could not be played with a mouse. Each cell armed the pin when it received focus, and toggled the pin when clicked. A real mouse click focuses the element first, so the focus handler planted the pin and the click handler immediately removed it. The pin never stayed. Keyboard players had the opposite problem: when no pin was planted, every cell was taken out of the tab order, so there was no way to tab into the board at all.',
        'Neither bug is visible to an engine test, because both live in the interface. I fixed them before release. Focus now only arms a pin when the focus comes from the keyboard (the browser’s focus-visible state), and when no pin exists the centre cell becomes the entry point for Tab. Both paths are now covered by end-to-end tests that use a real mouse click and real Tab and arrow presses.',
        'This was the moment I stopped treating “all tests green” as “the game works.” My release checklist has said it ever since: drive every new game with a real mouse and keyboard before trusting a passing test run.',
      ],
    },
    {
      heading: 'What is next',
      paragraphs: [
        'Par is honest but not tight. Because it comes from one generated route, an experienced player can sometimes finish under it, which inflates the par bonus. A solver that searches for the true shortest solution on each board would make par a sharper target, at the cost of generation time. I have not added one yet.',
        'I also want to look more closely at how the three difficulty settings feel in practice. The step counts were chosen so that each setting needs at least one move per dot with some room to spare, but whether 8 reverse steps on a 7×7 board is the right top end is something only more play will tell me.',
      ],
    },
  ],
}
