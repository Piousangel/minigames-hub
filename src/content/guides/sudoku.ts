import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'sudoku',
  title: 'Sudoku Guide: How Our Puzzles Are Made and Which Techniques Each Level Needs',
  description:
    'How our Sudoku generator sets difficulty, plus a 6,000-puzzle study of which solving techniques Easy, Medium and Hard actually require.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'How a puzzle is born',
      paragraphs: [
        "Every board here is generated in your browser when you start a game. The generator first builds a complete, valid 9x9 grid, filling cells left to right and top to bottom and trying digits in a shuffled order at each one. It then visits the 81 cells in another random order and tries to remove each one. A removal is kept only if a solver confirms the puzzle still has exactly one solution. If removing the cell would allow a second solution, it goes back. The process stops as soon as the number of givens reaches the target for your difficulty: 43 for Easy, 34 for Medium and 28 for Hard.",
        "In other words, difficulty is set by how many givens are left, not by which techniques a puzzle demands. That is a common and perfectly reasonable design, but it means two Hard puzzles can feel very different. To find out how different, we generated a large batch with the real generator and solved each one the way a person would.",
      ],
    },
    {
      heading: 'The givens always hit the target',
      paragraphs: [
        "The engine allows for the clue count to stop above the target when uniqueness blocks further removals. In practice that never happened. Across 2,000 generated puzzles per difficulty, using a fixed seed so the run is reproducible, every Easy board had exactly 43 givens, every Medium exactly 34 and every Hard exactly 28. So the gap between levels is precise: Medium leaves 9 fewer clues than Easy, and Hard 6 fewer than Medium.",
      ],
    },
    {
      heading: 'What each difficulty actually requires',
      paragraphs: [
        "We solved each of those 6,000 puzzles with a step-by-step solver that only uses human techniques, always trying the simplest first: naked singles (a cell with one candidate left), hidden singles (a digit with only one possible cell in a row, column or box), locked candidates (a digit confined to where a box meets a line), naked pairs, hidden pairs and naked triples. For each puzzle we recorded the hardest technique it needed. If none of these could make progress, the puzzle was marked as needing something more advanced.",
        "Easy is almost entirely singles. 99.3% of Easy puzzles fell to naked singles alone, 0.6% also needed a hidden single, and 2 of the 2,000 (0.1%) stalled after every technique on the list. Medium is still mostly singles: 68.3% were solved with naked singles only and 28.6% needed hidden singles too. Locked candidates or a naked pair were the hardest step in 0.7%, and 2.5% needed more. Hard is where the spread appears. Only 12.7% fell to naked singles alone and 61.6% needed hidden singles, which makes singles enough for 74.3% in total. A further 7.6% needed locked candidates or a pair or triple, and 18.3%, almost one Hard puzzle in five, needed techniques beyond that list, such as X-wings or chains.",
      ],
      list: [
        'Easy (2,000 puzzles): 99.9% solvable with singles only.',
        'Medium (2,000 puzzles): 96.9% singles only; 2.5% need advanced techniques.',
        'Hard (2,000 puzzles): 74.3% singles only; 18.3% need advanced techniques.',
        'Hidden-single placements in an average solve: 1.9 on Medium, 9.1 on Hard.',
      ],
    },
    {
      heading: 'Playing Hard well: hunt hidden singles first',
      paragraphs: [
        "The numbers point to a clear habit for Hard. In a typical Hard solve our solver placed about nine digits by hidden single, the spots where a digit has only one home in its unit, against about two on Medium. Many players default to looking for cells with one candidate, which works well on Easy. On Hard, the faster approach is to pick a digit, say every 7, and check each box, row and column for the one place it can go, then move on to the next digit. Sweeping digit by digit like this finds hidden singles that cell-by-cell scanning often misses.",
        "When singles run out, write pencil marks for the whole grid before you look for anything clever. Locked candidates, a digit confined to one row or column inside a box, are the next most common breakthrough, and they are almost impossible to see without complete notes. If notes and pairs still leave you stuck, you have probably drawn one of the roughly one in five Hard puzzles that needs an advanced pattern. That is not a sign you missed something easy.",
      ],
    },
    {
      heading: 'Two interface details that change how you play',
      paragraphs: [
        "First, this version checks every entry against the stored solution. When you place a digit that does not match it, the cell shakes, an error sound plays, and the Mistakes counter goes up, even if the digit breaks no visible rule. Red highlighting is a separate system that only marks duplicates in a row, column or box. So the game tells you immediately when an entry is wrong. If you want the puzzle to stay a pure logic test, put tentative ideas in notes, which are never checked.",
        "Second, placing a digit clears the pencil marks in that cell only. Notes in the same row, column and box are left alone, so after each placement you need to remove that digit from its peers yourself. Stale notes are the most common cause of a false deduction on Hard, so make the cleanup a habit.",
      ],
      list: [
        'Keys 1–9 enter a digit; Backspace, Delete or 0 erases.',
        'Arrow keys move the selection.',
        'N switches notes mode on and off.',
      ],
    },
    {
      heading: 'Timing and best scores',
      paragraphs: [
        "The clock starts the moment the puzzle appears, not on your first entry, and it runs until the last correct digit completes the grid. Your best time is saved separately for each difficulty, and mistakes don't affect it, so the only penalty for a wrong entry is the seconds it takes to fix. If you are chasing a time, scan the whole grid once for quick singles before you settle into a region. On Easy, nearly every cell can be filled from the start by working out which digits are missing from its row, column and box.",
      ],
    },
    {
      heading: 'A practice route through the levels',
      paragraphs: [
        "Since every Easy puzzle we generated except two could be solved with singles alone, Easy is a good place to build speed with naked singles. Medium adds hidden singles in about three puzzles in ten, so it is the level for practising the digit-by-digit sweep. Hard then asks you to keep full notes and spot locked candidates and pairs, and roughly one board in five will reward studying a named advanced technique.",
        "Moving up a level once you can finish the current one without opening notes is a good pace. It matches how the technique requirements in our data climb from one difficulty to the next.",
      ],
    },
  ],
}
