import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'battleship',
  title: 'Battleship Strategy: Where to Hide Your Fleet and How the Hard CPU Hunts',
  description:
    'I ran this site’s real Battleship engine thousands of times. How many shots each CPU level needs, which placements slow Hard down, and a hunt routine that matches it.',
  updated: '2026-11-13',
  sections: [
    {
      heading: 'What this guide is based on',
      paragraphs: [
        "The Battleship here is the classic format: two 10x10 grids, a fleet of five ships (Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2, so 17 ship squares in all), one shot per turn, and you fire first. Ships may touch side by side or corner to corner but cannot overlap.",
        "Every number below comes from running the game's actual engine and its three CPU opponents with a seeded random generator, 2,000 fleets per setting unless noted. The CPU only ever sees what a real opponent would: which of its shots missed, hit or sank something. The simulation code lives in the repository at scripts/content-sims/battleship.ts, so the figures can be reproduced.",
      ],
    },
    {
      heading: 'How good are the three CPU levels?',
      paragraphs: [
        "The cleanest yardstick is how many shots a CPU needs to sink a randomly placed fleet. There are only 100 squares, so the answer is bounded: you can never need more than 100.",
        "Easy fires at a uniformly random unfired square and ignores everything it has learned, so it needs about 95 shots, which is nearly the entire board. Normal hunts on a checkerboard pattern and, once it hits something, follows the line of the ship; it needs about 52 shots. Hard calculates, for every empty square, how many ways the ships still afloat could cover it, and fires at the best one; it needs about 46, with a typical game falling between 35 and 58.",
        "Those numbers are your benchmark. A human who clears the enemy fleet in under 46 shots has out-hunted Hard on that board; 52 means you have matched Normal; anything near 60 means your hunt has holes.",
      ],
      list: [
        'Easy: about 95 shots on average (measured on the 1,657 games that finished inside the 100-shot cap).',
        'Normal: 52.4 on average, median 53, middle 80% between 40 and 63.',
        'Hard: 46.3 on average, median 46, middle 80% between 35 and 58.',
      ],
    },
    {
      heading: 'Where random placement actually puts ships',
      paragraphs: [
        "A square does not have the same chance of holding a ship everywhere. With random placement, I counted how often each square ended up under a ship. A centre square (the inner 6x6) was occupied 20.7% of the time, the second ring 17.1%, an edge square 13.9%, and a corner only 7.5%. The reason is geometry: a long ship can cover a central square in many more positions than a corner square, where only a few placements fit.",
        "That bias is exactly what the Hard CPU exploits. Its density calculation naturally favours the middle of the board, so against a random fleet it spends its early shots there. If your fleet is also random, you are giving it the squares it already likes.",
      ],
    },
    {
      heading: 'Placement styles against the Hard CPU',
      paragraphs: [
        "To see whether placement matters, I built five styles of fleet and measured how many shots Hard needed to sink each one. Hiding everything on the outer rim is the clear winner: Hard needed 53.8 shots on average against 46.3 for a random fleet, about 7.5 shots more, and its median rose from 46 to 56. Stacking ships in the inner 6x6 does the opposite and gave Hard its easiest game at 44.2.",
        "Whether ships touch barely matters. A fleet where every ship was forced to lie against another needed 46.5 shots, no different from random, and a fleet where no two ships touch needed 45.3. The CPU does not use contact as a clue, so spending effort on adjacency is wasted.",
        "One caution: the rim result was measured against this engine's Hard CPU, which fires purely by probability. A human opponent who notices you always hide on the edge will start there. If you are playing someone who can learn, mix a couple of ships on the rim with one or two inside.",
      ],
    },
    {
      heading: 'A hunt routine that matches Normal and chases Hard',
      paragraphs: [
        "The smallest ship is two squares long, so every ship, however it lies, must cover at least one square of a checkerboard pattern. Fire only on alternating squares and you are guaranteed to touch every ship while skipping half the board. This is the first thing Normal does, and Hard does it too whenever it has no live hit.",
        "Within the checkerboard, prefer squares that many ship positions pass through: the middle first, then work outwards. When you score a hit, stop hunting and finish the ship. Fire the four neighbours; as soon as two hits line up, extend along that line in both directions until the ship sinks. The common mistake is leaving a wounded ship to go back to hunting, which just lets the same ship cost you extra turns later.",
        "Track what has sunk. Once the Destroyer is gone, no remaining ship is shorter than three, so you can widen the checkerboard to every third diagonal. Hard's calculation does this automatically, which is a large part of why it averages 46 shots rather than 52.",
      ],
      list: [
        'Hunt on a checkerboard, centre first.',
        'On a hit, probe the neighbours, then follow the line both ways.',
        'Finish a ship before returning to the hunt.',
        'After each sinking, re-think the smallest ship still afloat and widen your spacing.',
      ],
    },
    {
      heading: 'Does going first matter?',
      paragraphs: [
        "You always fire first in this game, which sounds like an edge. I tested it by letting two Hard players fight 2,000 games, one moving first. The first mover won 52.1% of them. With that many games the noise alone is about one percentage point, so first move is worth roughly one extra game in fifty. Bad hunting costs you far more than the tempo gives you.",
        "The practical reading is that a win comes from shot efficiency. Against Hard, which averages 46 shots, you need to finish in fewer to be favoured, and the routine above is how you get there.",
      ],
    },
  ],
  tables: [
    {
      caption: 'Hard CPU shots needed to sink each fleet style (2,000 fleets each)',
      columns: ['Fleet style', 'Mean shots', 'Median'],
      rows: [
        ['All ships on the outer rim', '53.8', '56'],
        ['Random placement', '46.3', '46'],
        ['No two ships touching', '45.3', '45'],
        ['Ships forced to touch', '46.5', '48'],
        ['Inner 6x6 only', '44.2', '45'],
      ],
    },
  ],
}
