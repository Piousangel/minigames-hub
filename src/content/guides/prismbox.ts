export const guide = {
  slug: 'prismbox',
  title: 'Prismbox Deduction Guide: Reading Bends, Clearing Lanes and Beating Par by Ten',
  description:
    'How Prismbox beams really move, why one bend pins an atom exactly, and why a careful deducer needs about 6 shots on the daily board against a par of 16.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'How this guide was put together',
      paragraphs: [
        'Prismbox is inspired by the classic Black Box, but its beam rules are its own, and some of the advice that works in Black Box does not apply here. Everything below was taken from this site\'s game code and checked with a simulation that imports the real engine (scripts/content-sims/prismbox.ts in the repository). The simulation enumerates every atom layout the generator can produce, fires every port, and plays thousands of boards with deduction bots that see only what you see on screen.',
        'One clarification first, because it changes how you play: there is no way to place a guess or a marker. An atom counts as found only when one of your beams runs straight into it. Your goal is to work out where an atom is and then hit it.',
      ],
    },
    {
      heading: 'The board and the scoring',
      paragraphs: [
        'Easy is a 7x7 grid with 3 atoms, Normal is 8x8 with 4, and Hard is 9x9 with 5. The Daily puzzle always uses the Normal settings, and the board is fixed by the UTC date, so everyone gets the same one. Par is four shots per atom: 12, 16 and 20.',
        'Two placement rules shrink the search space a lot. Atoms are never placed in the outer ring of cells, and no two atoms ever touch, not even diagonally. On Normal that leaves 16,834 possible layouts in total; on Easy 964; on Hard 397,014.',
      ],
      list: [
        'Each new atom you hit: +100.',
        'Hitting the last atom: +500, plus a par bonus of up to 500.',
        'The par bonus is the full 500 at or under par and shrinks in proportion beyond it: 32 shots on a Normal board (twice par) earns 250.',
        'A perfect Normal score is therefore 1,400. Re-hitting a found atom is reported as "Already found" and still costs a shot.',
      ],
    },
    {
      heading: 'Exactly how a beam moves',
      paragraphs: [
        'A beam enters at the edge cell of its lane and checks three things at every cell, in this order:',
      ],
      list: [
        'Is the next cell straight ahead an atom? Then the beam is absorbed: a hit, and the atom lights up permanently.',
        'Are there atoms directly to the left and directly to the right of the current cell? Then the beam is reflected back out of its entry port.',
        'Is there an atom directly beside the current cell on one side? Then the beam turns 90 degrees away from it, and that cell glows as a bend.',
        'Otherwise it moves forward one cell. If it leaves the grid with no bends, that is a pass-through; with at least one bend, a refraction.',
      ],
    },
    {
      heading: 'Three deductions that do most of the work',
      paragraphs: [
        'A bend pins an atom exactly. Because the beam turns away from an atom that sits right beside it, the atom is always one cell from the glowing bend cell, on the side opposite the direction the beam left in. If a beam travelling down turns right (east), the atom is directly west of the bend. Every bend on a refracted path is a confirmed atom position, not a hint. This is the biggest difference from Black Box, where deflections only narrow things down.',
        'A pass-through clears three lanes, not one. A beam checks both of its side neighbours at every step, so a straight shot proves that its own lane and both lanes beside it are empty along its whole length. On an 8x8 board a single pass-through can rule out up to 24 cells.',
        'A reflection is never at the entry. The edge cell\'s side neighbours are also edge cells, and atoms are never placed there, so a reflection always happens somewhere inside the grid, at a cell with an atom on each side, two apart with one gap between. The game does not draw a reflected path, so a reflection is the vaguest clue you can get; the other two outcomes are far more valuable.',
      ],
    },
    {
      heading: 'What a shot is likely to show you',
      paragraphs: [
        'Firing all 32 ports on each of 200 generated Normal boards (6,400 shots), the outcomes split as follows: 46.5% refractions, 36.8% hits, 13.7% pass-throughs and 2.9% reflections. On Easy, pass-throughs rise to 16.0%; on Hard they fall to 12.2%, because more atoms leave fewer clean lanes.',
        'Refractions are the most common result and, by the rule above, the most informative. That is good news: most of your early shots will hand you an exact atom position for free.',
        'Hitting an atom you have located is not always trivial, though. An atom can be struck head-on from just 2.95 of the 32 ports on average on Normal (measured over 800 atoms). A beam aimed straight down an atom\'s column will bend away early if another atom sits beside that column further up, so pick the edge with the cleanest approach. Head-on contact wins over everything: an atom directly ahead is hit even if other atoms flank the beam.',
      ],
    },
    {
      heading: 'How few shots a careful player needs',
      paragraphs: [
        'Two bots played the same boards using only on-screen information, keeping an exact list of every layout still consistent with the clues. "Greedy-hit" fires whichever port is most likely to hit a new atom right now; "info-first" fires a guaranteed hit when one exists and otherwise the most informative shot. Each played 200 boards per difficulty.',
      ],
      list: [
        'Easy (par 12): greedy-hit averaged 4.42 shots, info-first 4.31; worst case 6.',
        'Normal and Daily (par 16): greedy-hit averaged 5.96 shots (median 6, worst 9); info-first 5.75 (median 6, worst 8).',
        'Hard (par 20): greedy-hit averaged 7.45 shots (worst 11), info-first 7.31 (worst 9). Both solved 196 of 200 boards; the other 4 contain an atom no beam can reach (see the last section).',
        'Every solved board finished within par, so both bots earned the full par bonus every time.',
      ],
    },
    {
      heading: 'Turning that into a routine',
      paragraphs: [
        'The bots show that par is generous for a careful solver, so the real targets are your own shot count and a clean streak of daily wins. A routine that captures most of what the bots do:',
      ],
      list: [
        'Know what the outermost lanes can do. A beam fired along the very edge of the grid travels through border cells, which never hold atoms, so it can never score a hit. It can only pass straight through or bend away from an atom in the second ring. Use edge lanes as cheap detectors, and inner lanes when you want a hit.',
        'After every refraction, mark the pinned atom mentally (or on paper) and fire at it next, choosing the edge with no other atoms beside the approach.',
        'Use pass-throughs to clear three-lane bands, and stop firing into areas they have already cleared.',
        'Do not re-fire a port: the result is always identical. Fired ports are dimmed for this reason.',
        'If a shot reports a refraction but draws no path, the beam was trapped in a loop between atoms. It is rare — 186 of 640,000 simulated Normal shots — and tells you little beyond "atoms are nearby".',
        'On Hard, be aware that about 1% of boards (197 of 20,000 tested) contain an atom that no port can hit at all, so the board cannot be completed. If you have pinned every atom and one stays unreachable from every edge, start a new board. Easy and Normal had no such boards in 20,000 tests each, and none of the 365 Daily boards from 2026-10-09 onward are affected.',
      ],
    },
  ],
}
